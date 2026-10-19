"""Match a use case to the tables of a model or schema, at any size.

Same approach as the Vibe Data Modeling agent uses on large models: split the
request into needs, resolve each need to concrete tables locally, and only then
ask the AI, over a slice of the model that fits a fixed budget.

1. Needs: a small AI call over the use case alone (no model), cached by its text.
   It returns the data needs with search terms. Without the AI, each question
   becomes a need.
2. Resolve: score every table against each need locally. Exact table names and
   `area.table` references win outright; otherwise BM25 over table names,
   descriptions, area names and column names ranks them. One-hop joins that tie
   the top tables together are added.
3. Pack: the candidate tables with their columns, then their join neighbours,
   then one line per remaining area, under a character budget. The prompt
   stays the same size however large the schema is.
4. Reason: the industry fit prompt over that slice, validated by `normalize_fit`.
   On a timeout it retries once with a smaller slice.
5. Fallback: without the AI, a fit built straight from step 2, so every
   question still shows the tables that answer it.

The whole AI pass runs under one deadline. The browser does not wait on it:
`start_match` returns the step 5 fit at once as an interim result and runs the
AI pass as a background job that `poll_match` reports on, so no request lasts
long enough for a proxy to cut it off.
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import time
from collections import Counter, OrderedDict, defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException

from src.backend.api import insights_cache as cache
from src.backend.api.blueprint_fit import (
    CACHE_TTL_S, FIT_PROMPT, MAX_NEEDS, _ask, _parse, _short, _text, joins_of, normalize_fit,
)
from src.backend.api.blueprints import best_recipe

logger = logging.getLogger(__name__)

PROMPT_VERSION = "m1"
PACK_BUDGET_CHARS = 40_000
SMALL_PACK_CHARS = 16_000
NEEDS_TIMEOUT_S = 45
TOP_PER_NEED = 4
TOP_PER_QUESTION = 3
MAX_CANDIDATES = 36
MAX_BRIDGES = 10
MAX_COLUMNS = 14
COVERAGE_GUARD = 0.8
MATCH_DEADLINE_S = 150
MIN_CALL_S = 10
JOB_TTL_S = 600
MAX_JOBS = 200

_index_cache = cache.namespace("match-index", max_mb=96, ttl_s=CACHE_TTL_S)
_needs_cache = cache.namespace("match-needs", max_mb=8, ttl_s=CACHE_TTL_S, persist=True)
_fit_cache = cache.namespace("match-fit", max_mb=32, ttl_s=CACHE_TTL_S, persist=True)

NEEDS_PROMPT = """You are a senior data analyst. Before looking at any tables, list the data a business use case depends on.

Return ONLY a JSON object:
{"needs": [{"need": "Scheduled and actual departure times per flight", "grain": "per flight leg", "importance": "must",
            "terms": ["flight leg", "scheduled departure", "actual departure", "delay minutes", "on-time"]}],
 "questions": [{"index": 0, "terms": ["delay", "departure", "next hour"]}]}

Rules:
- 4 to 8 needs. A need names the records the team acts on or measures, in under 10 words, with its grain and "must" or "nice".
- "terms" are 4 to 10 short words or phrases a table or column holding that data would be named with: entity names, column words (status, reason, minutes, amount, date), synonyms and common abbreviations. Lowercase.
- For each numbered question, 3 to 8 such terms.
- Write needs in the language of the use case; terms in English."""

DRAFT_NOTE = """

DRAFT NEEDS lists needs drafted from the use case alone, with the tables a search found for each. Refine them; the candidate tables are listed in MODEL, other areas are summarised with their table count."""

RETRY_NOTE = "\n\nYour previous reply was not valid JSON or used ids that are not in MODEL. Return ONLY the JSON object, using ids exactly as listed."

_STOP = set("""a about above after again all also am an and any are as at be because been before being below between both but by can
could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its
itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the
their them then there these they this those through to too under until up very was we were what when where which while who whom why
will with would you your yours per via vs etc using use used need needs want wants show shows find give get track tracking which
data table tables record records value values info information list lists based each every id ids key keys flag""".split())

_TOKEN = re.compile(r"[a-z0-9]+")


def _stem(w: str) -> str:
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 4 and w.endswith(("sses", "shes", "ches", "xes")):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is")):
        return w[:-1]
    if len(w) > 5 and w.endswith("ing"):
        return w[:-3]
    if len(w) > 4 and w.endswith("ed") and not w.endswith("eed"):
        return w[:-2]
    return w


def tokens(text: str) -> List[str]:
    out = []
    for w in _TOKEN.findall(str(text or "").lower().replace("_", " ")):
        if len(w) < 2 or w in _STOP or w.isdigit():
            continue
        out.append(_stem(w))
    return out


def _san(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


# --------------------------------------------------------------------------------------
# index
# --------------------------------------------------------------------------------------

class Index:
    """BM25 over one document per table, plus the join graph."""

    K1, B = 1.2, 0.75

    def __init__(self, digest: Dict[str, Any]):
        self.tables: List[Dict[str, Any]] = list(digest.get("tables") or [])
        self.ids = [t["id"] for t in self.tables]
        self.pos = {tid: i for i, tid in enumerate(self.ids)}
        self.area_of = {t["id"]: t.get("area", "") for t in self.tables}
        self.by_area: Dict[str, List[str]] = defaultdict(list)
        for t in self.tables:
            self.by_area[t.get("area", "")].append(t["id"])
        self.name_key = {t["id"]: _san(t.get("name") or t["id"].split(".")[-1]) for t in self.tables}
        self.name_parts = {t["id"]: [w for w in re.split(r"[^a-z0-9]+", (t.get("name") or "").lower()) if len(w) >= 3] for t in self.tables}

        postings: Dict[str, Dict[int, float]] = defaultdict(dict)
        self.lengths: List[float] = []
        for i, t in enumerate(self.tables):
            tf: Counter = Counter()
            for w in tokens(t.get("name") or ""):
                tf[w] += 3
            for w in tokens(t.get("area") or ""):
                tf[w] += 1
            for w in tokens(t.get("subdomain") or ""):
                tf[w] += 1
            for w in tokens(t.get("purpose") or ""):
                tf[w] += 1
            for c in t.get("columns") or []:
                for w in set(tokens(c.get("n") or "")):
                    tf[w] += 1
            for w, n in tf.items():
                postings[w][i] = float(n)
            self.lengths.append(float(sum(tf.values())) or 1.0)
        self.postings = dict(postings)
        n = max(1, len(self.tables))
        self.avg_len = sum(self.lengths) / n if self.lengths else 1.0
        self.idf = {w: math.log(1 + (n - len(p) + 0.5) / (len(p) + 0.5)) for w, p in self.postings.items()}

        self.adj: Dict[str, Set[str]] = defaultdict(set)
        for t in self.tables:
            for ln in t.get("linksTo") or []:
                to = ln.get("to")
                if to in self.pos and to != t["id"]:
                    self.adj[t["id"]].add(to)
                    self.adj[to].add(t["id"])

    def bm25(self, query: List[str]) -> Dict[int, float]:
        scores: Dict[int, float] = defaultdict(float)
        for w in set(query):
            p = self.postings.get(w)
            if not p:
                continue
            idf = self.idf[w]
            for i, tf in p.items():
                norm = tf * (self.K1 + 1) / (tf + self.K1 * (1 - self.B + self.B * self.lengths[i] / self.avg_len))
                scores[i] += idf * norm
        return scores

    def resolve(self, text: str, terms: List[str]) -> List[Tuple[str, float]]:
        """Tables for one need or question, best first, as (id, score)."""
        blob = " ".join([text] + list(terms))
        query = tokens(blob)
        scores = self.bm25(query)
        top = max(scores.values()) if scores else 0.0
        boost = max(top, 1.0)
        raw_tokens = {_san(w) for w in re.findall(r"[A-Za-z0-9_]+", blob)}
        stems = set(query)
        named: Set[int] = set()
        for m in re.findall(r"[A-Za-z0-9_]+\.[A-Za-z0-9_]+", blob):
            if m in self.pos:
                named.add(self.pos[m])
        for tid, key in self.name_key.items():
            parts = self.name_parts[tid]
            if len(key) >= 4 and key in raw_tokens:
                named.add(self.pos[tid])
            elif len(parts) >= 2 and all(_stem(w) in stems for w in parts):
                named.add(self.pos[tid])
        if len(named) >= max(40, int(COVERAGE_GUARD * len(self.ids))):
            named = set()
        for i in named:
            scores[i] = scores.get(i, 0.0) + boost
        ranked = sorted(scores.items(), key=lambda kv: (-kv[1], self.ids[kv[0]]))
        if not ranked:
            return []
        floor = ranked[0][1] * 0.25
        return [(self.ids[i], round(s, 3)) for i, s in ranked if s >= floor]


def index_for(digest: Dict[str, Any], key: str) -> Index:
    hit = _index_cache.get(key)
    if hit is None:
        idx = Index(digest)
        size = 64 * sum(len(p) for p in idx.postings.values()) + 256 * len(idx.ids)
        hit = _index_cache.put(key, idx, size=size)
    return hit


# --------------------------------------------------------------------------------------
# needs
# --------------------------------------------------------------------------------------

def _clean_terms(v: Any) -> List[str]:
    out = []
    for t in v if isinstance(v, list) else []:
        s = _text(t, 40).lower()
        if s and s not in out:
            out.append(s)
    return out[:12]


def normalize_needs(raw: Any, n_questions: int) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    needs = []
    for n in (raw.get("needs") or [])[:MAX_NEEDS]:
        if isinstance(n, dict) and _text(n.get("need"), 80):
            needs.append({
                "need": _short(n.get("need"), 80),
                "grain": _short(n.get("grain"), 60),
                "importance": "nice" if str(n.get("importance", "")).lower() == "nice" else "must",
                "terms": _clean_terms(n.get("terms")),
            })
    questions = {}
    for q in raw.get("questions") or []:
        try:
            i = int(q.get("index")) if isinstance(q, dict) else -1
        except (TypeError, ValueError):
            continue
        if 0 <= i < n_questions:
            questions[i] = _clean_terms(q.get("terms"))
    if not needs:
        return None
    return {"needs": needs, "questions": [questions.get(i, []) for i in range(n_questions)]}


def fallback_needs(context: str, questions: List[str]) -> Dict[str, Any]:
    needs = [{"need": _short(q, 80), "grain": "", "importance": "must", "terms": []} for q in questions[:MAX_NEEDS]]
    if not needs:
        needs = [{"need": _short(context, 80), "grain": "", "importance": "must", "terms": []}]
    return {"needs": needs, "questions": [[] for _ in questions]}


async def extract_needs(context: str, questions: List[str]) -> Tuple[Dict[str, Any], bool]:
    """(needs, from_ai). Cached by the use case text, so every model and schema tried reuses it."""
    key = cache.fingerprint(PROMPT_VERSION, context, questions)

    async def build():
        prompt = "\n\n".join([
            f"USE CASE:\n{context or '(only the questions below)'}",
            "QUESTIONS:\n" + ("\n".join(f"{i}. {q}" for i, q in enumerate(questions)) or "(none)"),
        ])
        try:
            reply = await asyncio.wait_for(_ask(NEEDS_PROMPT, prompt, 1500), timeout=NEEDS_TIMEOUT_S)
            out = normalize_needs(_parse(reply["text"]), len(questions))
            if out:
                return {**out, "ai": True}, True
        except Exception as e:
            logger.warning(f"[Matcher] needs extraction fell back: {type(e).__name__}: {str(e)[:160]}")
        return {**fallback_needs(context, questions), "ai": False}, False

    out = await _needs_cache.get_or_build(key, build)
    return out, bool(out.get("ai"))


# --------------------------------------------------------------------------------------
# resolve + pack
# --------------------------------------------------------------------------------------

def resolve_all(idx: Index, context: str, questions: List[str], needs: Dict[str, Any]) -> Dict[str, Any]:
    per_need = [idx.resolve(n["need"] + " " + n.get("grain", ""), n.get("terms") or []) for n in needs["needs"]]
    q_terms = needs.get("questions") or [[] for _ in questions]
    per_question = [idx.resolve(q, q_terms[i] if i < len(q_terms) else []) for i, q in enumerate(questions)]
    overall = idx.resolve(context, [t for n in needs["needs"] for t in n.get("terms") or []]) if context else []

    score: Dict[str, float] = defaultdict(float)
    for hits, k in [(h, TOP_PER_NEED) for h in per_need] + [(h, TOP_PER_QUESTION) for h in per_question] + [(overall, TOP_PER_NEED)]:
        for rank, (tid, s) in enumerate(hits[:k]):
            score[tid] += s / (1 + rank * 0.5)
    candidates = [tid for tid, _ in sorted(score.items(), key=lambda kv: -kv[1])][:MAX_CANDIDATES]
    chosen = set(candidates)

    bridge_votes: Counter = Counter()
    for tid in candidates:
        for nb in idx.adj.get(tid, ()):
            if nb not in chosen:
                bridge_votes[nb] += 1
    bridges = [tid for tid, v in bridge_votes.most_common() if v >= 2][:MAX_BRIDGES]
    return {"perNeed": per_need, "perQuestion": per_question, "candidates": candidates, "bridges": bridges, "score": dict(score)}


def _columns_line(t: Dict[str, Any]) -> str:
    cols = [c.get("n") for c in t.get("columns") or [] if c.get("n") and c.get("k") != "pk"]
    return ", ".join(cols[:MAX_COLUMNS])


def pack(digest: Dict[str, Any], idx: Index, res: Dict[str, Any], budget: int, with_columns: bool = True) -> Dict[str, Any]:
    """The MODEL block for the fit prompt: candidates first, then bridges, then every other area in one line."""
    by_id = {t["id"]: t for t in digest.get("tables") or []}
    tier1 = [tid for tid in res["candidates"] if tid in by_id]
    tier2 = [tid for tid in res["bridges"] if tid in by_id]

    def build(t1: List[str], t2: List[str], cols: bool) -> Dict[str, Any]:
        rows: Dict[str, List[List[str]]] = defaultdict(list)
        for tid in t1:
            t = by_id[tid]
            about = _short(t.get("purpose"), 160)
            if cols:
                line = _columns_line(t)
                about = f"{about} Columns: {line}" if line else about
            rows[t.get("area", "")].append([tid, t.get("label", ""), about])
        for tid in t2:
            t = by_id[tid]
            rows[t.get("area", "")].append([tid, t.get("label", ""), _short(t.get("purpose"), 100)])
        listed = set(t1) | set(t2)
        areas = []
        for a in digest.get("areas") or []:
            name = a["name"]
            members = idx.by_area.get(name, [])
            rest = [tid for tid in members if tid not in listed]
            entry = {"name": name, "label": a.get("label", ""), "about": _short(a.get("description"), 200), "tables": rows.get(name, [])}
            if rest:
                sample = ", ".join(by_id[tid].get("name", tid) for tid in rest[:6])
                entry["more"] = f"{len(rest)} more tables, e.g. {sample}"
            areas.append(entry)
        joins = [j for j in joins_of(digest) if j[0] in listed and j[1] in listed][:120]
        kpis = [[k["id"], k.get("label", ""), k.get("area", "")] for k in digest.get("kpis") or [] if k.get("table") in listed or not k.get("table")]
        return {"model": digest.get("label", ""), "areas": areas, "kpis": kpis[:80], "joins": joins}

    t1, t2, cols = tier1, tier2, with_columns
    model = build(t1, t2, cols)
    while len(json.dumps(model, separators=(",", ":"))) > budget:
        if t2:
            t2 = t2[: len(t2) // 2]
        elif cols:
            cols = False
        elif len(t1) > 8:
            t1 = t1[: max(8, int(len(t1) * 0.75))]
        else:
            break
        model = build(t1, t2, cols)
    return model


def _draft(needs: Dict[str, Any], res: Dict[str, Any]) -> str:
    lines = []
    for i, n in enumerate(needs["needs"]):
        hits = [tid for tid, _ in res["perNeed"][i][:TOP_PER_NEED]] if i < len(res["perNeed"]) else []
        lines.append(f"- {n['need']} ({n['importance']}): {', '.join(hits) or 'nothing found'}")
    return "\n".join(lines)


# --------------------------------------------------------------------------------------
# fallback fit
# --------------------------------------------------------------------------------------

def _best_kpi(digest: Dict[str, Any], tables: List[str]) -> Optional[str]:
    best = None
    for k in digest.get("kpis") or []:
        if k.get("table") not in tables:
            continue
        rec = best_recipe(k)
        s = (rec[2] if rec else -99) - tables.index(k["table"])
        if best is None or s > best[0]:
            best = (s, k["id"])
    return best[1] if best else None


OTHER_SCHEMA_SHARE = 0.8


def within_leading_schema(scored: List[Tuple[str, float]], digest: Dict[str, Any]) -> List[Tuple[str, float]]:
    """With several schemas selected, keep areas in the schema the idea is most about (its two best areas
    together), plus only near-top areas from the others. `scored` is (area, score), best first."""
    schema_of = {a["name"]: a.get("division") or "" for a in digest.get("areas") or []}
    by_schema: Dict[str, List[float]] = {}
    for a, s in scored:
        by_schema.setdefault(schema_of.get(a, ""), []).append(s)
    if len(by_schema) < 2 or not scored:
        return scored
    lead = max(by_schema, key=lambda k: sum(sorted(by_schema[k], reverse=True)[:2]))
    top = scored[0][1]
    return [(a, s) for a, s in scored if schema_of.get(a, "") == lead or s >= top * OTHER_SCHEMA_SHARE]


def deterministic_fit(digest: Dict[str, Any], idx: Index, needs: Dict[str, Any], res: Dict[str, Any], n_questions: int) -> Optional[Dict[str, Any]]:
    """A fit straight from the local resolution, in the same raw shape the AI returns."""
    raw_needs = []
    area_score: Counter = Counter()
    for i, n in enumerate(needs["needs"]):
        hits = res["perNeed"][i][:TOP_PER_NEED] if i < len(res["perNeed"]) else []
        tables = [tid for tid, _ in hits]
        for tid, s in hits:
            area_score[idx.area_of[tid]] += s * (2 if n["importance"] == "must" else 1)
        raw_needs.append({"need": n["need"], "grain": n.get("grain", ""), "importance": n["importance"], "tables": tables,
                          "areas": [], "gap": "" if tables else "No table in this source holds it."})
    for hits in res["perQuestion"]:
        for tid, s in hits[:TOP_PER_QUESTION]:
            area_score[idx.area_of[tid]] += s
    areas = [{"name": a, "role": "core" if r < 3 else "supporting", "why": "Holds the tables that match your questions"}
             for r, (a, _) in enumerate(within_leading_schema(area_score.most_common(), digest)[:6])]
    questions = []
    for i, hits in enumerate(res["perQuestion"][:n_questions]):
        tables = [tid for tid, _ in hits[:TOP_PER_QUESTION]]
        questions.append({"index": i, "kpi": _best_kpi(digest, tables), "tables": tables,
                          "how": ("Start from " + ", ".join(t.split(".")[-1] for t in tables)) if tables else ""})
    covered = sum(1 for n in raw_needs if n["tables"] and n["importance"] == "must")
    musts = sum(1 for n in raw_needs if n["importance"] == "must") or 1
    raw = {"needs": raw_needs, "areas": areas, "questions": questions,
           "fit": "strong" if covered == musts else "partial" if covered else "weak",
           "summary": "Matched on table names, descriptions and columns; the AI review was not available."}
    fit = normalize_fit(raw, digest, n_questions)
    return (fit, raw) if fit else None


# --------------------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------------------

def match_key(digest_key: str, context: str, questions: List[str], suggested: List[str], note: str = "") -> str:
    return cache.fingerprint(PROMPT_VERSION, digest_key, context, questions, sorted(suggested), note)


async def match(digest: Dict[str, Any], digest_key: str, context: str, questions: List[str], suggested: List[str],
                note: str = "", attach=None) -> Dict[str, Any]:
    """The fit for one use case on one digest. `attach(fit, raw, digest)` adds per-question tables (approved sources).

    Without the AI, or when it runs past MATCH_DEADLINE_S, the fit comes from local matching, with mode "tables"
    and a `reason`: "timeout", "unavailable" or "invalid". Only AI fits are cached.
    """
    key = match_key(digest_key, context, questions, suggested, note)

    async def build():
        t0 = time.monotonic()
        deadline = t0 + MATCH_DEADLINE_S
        idx = index_for(digest, digest_key)
        needs, needs_ai = await extract_needs(context, questions)
        res = resolve_all(idx, context, questions, needs)
        head = "\n\n".join([
            f"USE CASE:\n{context or '(only the questions below)'}",
            "QUESTIONS:\n" + ("\n".join(f"{i}. {q}" for i, q in enumerate(questions)) or "(none)"),
            "SUGGESTED AREAS:\n" + (", ".join(suggested) or "(none)"),
            "DRAFT NEEDS:\n" + _draft(needs, res),
        ])
        system = FIT_PROMPT + DRAFT_NOTE + note
        model_name, mode, reason, fit, raw, tried, retry_note = "", "ai", "", None, None, [], ""
        for budget, cols in ((PACK_BUDGET_CHARS, True), (SMALL_PACK_CHARS, False)):
            model = pack(digest, idx, res, budget, cols)
            prompt = head + "\n\nMODEL:\n" + json.dumps(model, separators=(",", ":"))
            # After a timeout, a retry only helps if the prompt got clearly smaller.
            if tried and not retry_note and len(prompt) >= tried[-1] * 0.8:
                break
            left = deadline - time.monotonic()
            if left < MIN_CALL_S:
                reason = reason or "timeout"
                break
            tried.append(len(prompt))
            try:
                reply = await asyncio.wait_for(_ask(system, prompt + retry_note, 8000), timeout=left)
            except (asyncio.TimeoutError, HTTPException) as e:
                detail = getattr(e, "detail", "") or ""
                logger.warning(f"[Matcher] fit call failed with {len(prompt)} chars after {time.monotonic() - t0:.1f}s: "
                               f"{type(e).__name__} {str(detail)[:160]}")
                if isinstance(e, HTTPException):
                    reason = "unavailable"
                    break
                reason, retry_note = "timeout", ""
                continue
            raw = _parse(reply["text"])
            fit = normalize_fit(raw, digest, len(questions))
            if fit:
                model_name, reason = reply.get("model", ""), ""
                break
            reason, retry_note = "invalid", RETRY_NOTE
        if not fit:
            mode = "tables"
            det = deterministic_fit(digest, idx, needs, res, len(questions))
            if not det:
                raise HTTPException(status_code=502, detail="Could not match the use case to these tables.")
            fit, raw = det
        if attach:
            fit = attach(fit, raw, digest)
        out = {**fit, "slug": digest.get("slug", ""), "model": model_name, "mode": mode}
        if mode == "tables":
            out["reason"] = reason or "unavailable"
        logger.info(
            f"[Matcher] {digest.get('slug', '')}: tables={len(idx.ids)} candidates={len(res['candidates'])} "
            f"bridges={len(res['bridges'])} prompt_chars={tried} needs_ai={needs_ai} mode={mode} "
            f"reason={out.get('reason', '')} {time.monotonic() - t0:.1f}s"
        )
        return out, mode == "ai"

    return await _fit_cache.get_or_build(key, build)


def interim_fit(digest: Dict[str, Any], digest_key: str, context: str, questions: List[str], attach=None) -> Optional[Dict[str, Any]]:
    """The local fit, with no AI call: what the browser shows while the AI pass runs."""
    idx = index_for(digest, digest_key)
    needs = _needs_cache.get(cache.fingerprint(PROMPT_VERSION, context, questions)) or fallback_needs(context, questions)
    res = resolve_all(idx, context, questions, needs)
    det = deterministic_fit(digest, idx, needs, res, len(questions))
    if not det:
        return None
    fit, raw = det
    if attach:
        fit = attach(fit, raw, digest)
    return {**fit, "slug": digest.get("slug", ""), "model": "", "mode": "tables", "reason": "pending"}


# --------------------------------------------------------------------------------------
# background jobs
# --------------------------------------------------------------------------------------

_jobs: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()


def _expire_jobs() -> None:
    now = time.time()
    for key in [k for k, j in _jobs.items() if j["status"] != "running" and now - j["at"] > JOB_TTL_S]:
        _jobs.pop(key, None)
    while len(_jobs) > MAX_JOBS:
        oldest = next((k for k, j in _jobs.items() if j["status"] != "running"), None)
        if oldest is None:
            break
        _jobs.pop(oldest)


def _view(key: str, job: Dict[str, Any]) -> Dict[str, Any]:
    return {"job": key, "status": job["status"], "fit": job["fit"], "error": job.get("error", "")}


async def start_match(digest: Dict[str, Any], digest_key: str, context: str, questions: List[str], suggested: List[str],
                      note: str = "", attach=None, retry: bool = False) -> Dict[str, Any]:
    """{"job", "status": "running" | "done" | "failed", "fit", "error"}, returned at once.

    While running, `fit` is the local interim fit (or null for the moment it is being built). A finished job is
    kept for JOB_TTL_S so polls and reloads see it; `retry` drops a finished job whose fit is not from the AI.
    """
    key = match_key(digest_key, context, questions, suggested, note)
    _expire_jobs()
    job = _jobs.get(key)
    if job and retry and job["status"] != "running" and (job["fit"] or {}).get("mode") != "ai":
        _jobs.pop(key, None)
        job = None
    if job:
        return _view(key, job)
    hit = await _fit_cache.lookup(key)
    if hit is not None:
        return {"job": key, "status": "done", "fit": hit, "error": ""}

    job = {"status": "running", "fit": None, "at": time.time()}
    _jobs[key] = job

    async def run() -> None:
        try:
            job["fit"] = await asyncio.to_thread(interim_fit, digest, digest_key, context, questions, attach)
        except Exception as e:
            logger.warning(f"[Matcher] interim fit failed: {type(e).__name__}: {str(e)[:160]}")
        try:
            job["fit"] = await match(digest, digest_key, context, questions, suggested, note=note, attach=attach)
            job["status"] = "done"
        except Exception as e:
            detail = getattr(e, "detail", "") or str(e)
            logger.warning(f"[Matcher] job {key[:8]} failed: {type(e).__name__}: {str(detail)[:200]}")
            if job["fit"]:
                job["fit"] = {**job["fit"], "reason": "unavailable"}
                job["status"] = "done"
            else:
                job["status"], job["error"] = "failed", str(detail)[:200] or "Could not match the use case to these tables."
        finally:
            job["at"] = time.time()

    job["task"] = asyncio.create_task(run())
    # The interim fit is quick; give it a moment so the first reply already carries it.
    try:
        await asyncio.wait_for(asyncio.shield(_interim_ready(job)), timeout=3)
    except asyncio.TimeoutError:
        pass
    return _view(key, job)


async def _interim_ready(job: Dict[str, Any]) -> None:
    while job["fit"] is None and job["status"] == "running":
        await asyncio.sleep(0.05)


def poll_match(key: str) -> Dict[str, Any]:
    job = _jobs.get(key)
    if not job:
        raise HTTPException(status_code=404, detail="This match is no longer running; start it again.")
    return _view(key, job)
