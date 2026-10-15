"""Industry blueprints for the Insights flow.

Reads the public Databricks Industry Solutions data-model gallery
(databricks-industry-solutions/lakehouse-industry-data-models), condenses a
model into an analyst-friendly digest, and installs it once per industry into a
shared `idm_<slug>_<flavour>` catalog with the repo's own installer notebook.

Self-contained: no database access and no shared helpers with side effects, so a
failure here can only disable blueprints.
"""
from __future__ import annotations

import asyncio
import base64
import datetime as _dt
import gzip
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
import yaml
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response

router = APIRouter()

REPO = "databricks-industry-solutions/lakehouse-industry-data-models"
REPO_URL = f"https://github.com/{REPO}"
RAW = f"https://raw.githubusercontent.com/{REPO}"
GH_API = f"https://api.github.com/repos/{REPO}"
GALLERY_URL = "https://databricks-industry-solutions.github.io/lakehouse-industry-data-models/"
NOTICE_TEXT = "Copyright (2025) Databricks, Inc."
INSTALLER_PATH = "model-installer/data-model-installer.ipynb"
SAMPLE_ROWS = "100"
# The optional LLM realism pass runs in waves of this size with a 90 s budget each.
SAMPLE_THREADS = "24"
MAX_CONCURRENT_INSTALLS = 2

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_SLUG_RE = re.compile(r"^[a-z0-9_]{2,40}$")


def _flag(name: str, default: bool = True) -> bool:
    v = os.getenv(name)
    if v is None or v.strip() == "":
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _enabled() -> bool:
    return _flag("INSIGHTS_BLUEPRINTS_ENABLED", True)


def _install_enabled() -> bool:
    return _flag("INSIGHTS_BLUEPRINT_INSTALL_ENABLED", True)


# --------------------------------------------------------------------------------------
# small TTL cache + HTTP
# --------------------------------------------------------------------------------------

_CACHE: Dict[str, Tuple[float, Any]] = {}


def _cache_get(key: str, ttl: float) -> Any:
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    return None


def _cache_put(key: str, value: Any) -> Any:
    _CACHE[key] = (time.time(), value)
    if len(_CACHE) > 64:
        oldest = sorted(_CACHE.items(), key=lambda kv: kv[1][0])[:16]
        for k, _ in oldest:
            _CACHE.pop(k, None)
    return value


_HEADERS = {"User-Agent": "v2v-insights-blueprints", "Accept": "application/vnd.github+json"}


async def _get(url: str, *, accept: Optional[str] = None, timeout: float = 30.0) -> httpx.Response:
    headers = dict(_HEADERS)
    if accept:
        headers["Accept"] = accept
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        r = await client.get(url, headers=headers)
        r.raise_for_status()
        return r


async def _head_sha() -> str:
    """The gallery's current `main` commit, so the digest and the install agree."""
    cached = _cache_get("sha", 3600)
    if cached:
        return cached
    try:
        r = await _get(f"{GH_API}/commits/main", accept="application/vnd.github.sha", timeout=15)
        sha = r.text.strip()
        if re.fullmatch(r"[0-9a-f]{40}", sha):
            return _cache_put("sha", sha)
    except Exception as e:  # pragma: no cover - network dependent
        print(f"[Blueprints] could not resolve main sha: {e}")
    return "main"


def _source(sha: str, path: str = "", agent_version: str = "", generated_at: str = "") -> Dict[str, Any]:
    ref = sha or "main"
    return {
        "repo": REPO,
        "repoUrl": REPO_URL,
        "commitSha": ref,
        "shortSha": ref[:7] if ref != "main" else "main",
        "commitUrl": f"{REPO_URL}/commit/{ref}" if ref != "main" else f"{REPO_URL}/commits/main",
        "path": path,
        "treeUrl": f"{REPO_URL}/tree/{ref}/{path}" if path else f"{REPO_URL}/tree/{ref}",
        "licenseUrl": f"{REPO_URL}/blob/{ref}/LICENSE.md",
        "noticeUrl": f"{REPO_URL}/blob/{ref}/NOTICE.md",
        "noticeText": NOTICE_TEXT,
        "galleryUrl": GALLERY_URL,
        "agentVersion": agent_version,
        "generatedAt": generated_at,
    }


# --------------------------------------------------------------------------------------
# manifest
# --------------------------------------------------------------------------------------

def _bundled_manifest() -> Dict[str, Any]:
    with open(_DATA_DIR / "blueprints_manifest.json", "r") as f:
        return json.load(f)


def _condense_manifest(m: Dict[str, Any]) -> Dict[str, Any]:
    industries = []
    for ind in m.get("industries", []):
        latest = ind.get("latest")
        version = next((v for v in ind.get("versions", []) if v.get("version") == latest), None)
        if not version:
            continue
        flavours = {f["flavour"]: f for f in version.get("flavours", [])}
        mvm = flavours.get("mvm")
        if not mvm:
            continue
        counts = mvm.get("counts", {})
        industries.append({
            "slug": ind["slug"],
            "label": ind.get("display") or ind["slug"],
            "section": ind.get("section", ""),
            "version": latest,
            "flavour": "mvm",
            "counts": {
                "areas": counts.get("domains", 0),
                "tables": counts.get("products", 0),
                "columns": counts.get("attributes", 0),
                "links": counts.get("foreign_keys", 0),
                "kpiSets": counts.get("metric_views", 0),
            },
        })
    sections = [{"name": s["name"], "industries": s.get("industries", [])} for s in m.get("sections", [])]
    return {"sections": sections, "industries": industries}


async def _manifest() -> Tuple[Dict[str, Any], str, bool]:
    """(condensed manifest, sha, live?)"""
    cached = _cache_get("manifest", 3600)
    if cached:
        return cached
    sha = await _head_sha()
    live = True
    try:
        r = await _get(f"{RAW}/{sha}/docs/manifest.json")
        raw = r.json()
    except Exception as e:  # pragma: no cover - network dependent
        print(f"[Blueprints] manifest fetch failed, using bundled copy: {e}")
        raw = _bundled_manifest()
        live = False
    result = (_condense_manifest(raw), sha, live)
    if live:
        _cache_put("manifest", result)
    return result


# --------------------------------------------------------------------------------------
# digest
# --------------------------------------------------------------------------------------

_ACRONYMS = {
    "id", "sku", "gmv", "aov", "pos", "kpi", "bopis", "ropis", "sfs", "dc", "dcs", "uom", "rma",
    "sla", "atp", "oms", "wms", "erp", "crm", "upc", "gtin", "rfid", "mfc", "b2b", "b2c", "vmi",
    "ytd", "mtd", "qtd", "roi", "ltv", "nps", "csat", "eta", "otd", "oee", "wip", "bom", "api",
    "url", "ip", "ssn", "npi", "icd", "cpt", "hcpcs", "drg", "ndc", "kyc", "aml", "apr", "fx",
    "iso", "gl", "ach", "atm", "pii", "hr", "ev", "co2", "ghg", "esg", "pnl", "cogs", "sms",
    "usd", "los", "cet1", "mpi", "adt", "caqh", "ebitda", "arpu", "mrr", "arr", "cac",
}


def _humanize(name: str) -> str:
    words = [w for w in re.split(r"[_\s]+", name or "") if w]
    out = []
    for i, w in enumerate(words):
        lw = w.lower()
        if lw in _ACRONYMS:
            out.append(lw.upper())
        elif i == 0:
            out.append(lw.capitalize())
        else:
            out.append(lw)
    return " ".join(out)


def _trim(text: str, n: int) -> str:
    t = " ".join((text or "").split())
    if len(t) <= n:
        return t
    cut = t[:n].rsplit(" ", 1)[0]
    return cut.rstrip(",;:") + "…"


def _first_sentence(text: str, n: int = 220) -> str:
    t = " ".join((text or "").split())
    m = re.match(r"(.+?[.!?])(\s|$)", t)
    s = m.group(1) if m else t
    return _trim(s, n)


_AMOUNT_HINT = re.compile(r"amount|price|cost|value|total|revenue|fee|balance|spend|margin|charge|salary|tax", re.I)


def _friendly_type(col: str, sql_type: str) -> str:
    t = (sql_type or "").upper()
    if t.startswith("BOOLEAN"):
        return "Yes/No"
    if t.startswith("TIMESTAMP"):
        return "Date & time"
    if t.startswith("DATE"):
        return "Date"
    if t.startswith("DECIMAL") or t.startswith("DOUBLE") or t.startswith("FLOAT"):
        return "Amount" if _AMOUNT_HINT.search(col) else "Number"
    if t.startswith("BIGINT") or t.startswith("INT") or t.startswith("SMALLINT") or t.startswith("TINYINT"):
        return "ID" if col.endswith("_id") else "Number"
    return "Text"


def _kind(product_type: str) -> str:
    t = (product_type or "").lower()
    if t.startswith("transaction"):
        return "event"
    if t.startswith("reference"):
        return "lookup"
    if t.startswith("associat"):
        return "link"
    return "thing"


def _sensitive(attr: Dict[str, Any]) -> Optional[str]:
    keys = [str(tg.get("key", "")).lower() for tg in attr.get("tag_set") or []]
    for k in keys:
        if k.startswith("pii"):
            return k.replace("pii_", "").replace("pii", "personal") or "personal"
    for k in keys:
        if k in ("restricted", "confidential"):
            return k
    return None


def _standards(text: str) -> List[str]:
    out = []
    for part in re.split(r"[;,]", text or ""):
        p = part.strip()
        if not p or "llm generated" in p.lower() or p.lower().startswith("internal"):
            continue
        if len(p) <= 40:
            out.append(p)
    return out


_TIME_HINT = re.compile(r"(_date|_month|_year|_week|_quarter|_day|_time|_period)$|^(date|month|year|week|quarter)")


def _slice_kind(name: str, expr: str, comment: str) -> str:
    name = _key(name)
    e = (expr or "").upper()
    if "DATE_TRUNC" in e or e.startswith("YEAR(") or e.startswith("MONTH(") or _TIME_HINT.search(name):
        return "time"
    if name.endswith("_flag") or name.startswith(("is_", "has_")) or (comment or "").lower().startswith("whether"):
        return "flag"
    return "category"


def _agg_kind(expr: str) -> str:
    e = (expr or "").upper()
    for k in ("AVG", "COUNT", "SUM", "MIN", "MAX"):
        if e.startswith(k + "("):
            return k.lower()
    if "/" in e:
        return "ratio"
    return "calc"


def _parse_metric_view(sql: str) -> Optional[Dict[str, Any]]:
    m = re.search(r"\$\$(.*)\$\$", sql or "", re.S)
    if not m:
        return None
    try:
        y = yaml.safe_load(m.group(1))
    except Exception:
        return None
    return y if isinstance(y, dict) else None


_GOOD_MEASURE = re.compile(r"primary|key|core|revenue|sales|value|rate|margin|cost|spend|profit|volume|average|avg|on-time|satisfaction|utilization|conversion|retention|churn", re.I)
_WEAK_MEASURE = re.compile(r"^(row|record)_?count$|record_count|_id$|^count$|latitude|longitude|factor|threshold|sequence|version|limit|index|checksum|data_quality|_units$", re.I)
_GOOD_SLICE = re.compile(r"status|type|channel|category|segment|tier|region|reason|method|stage|priority|class|level|country|state|brand|department|division|source|outcome|grade|plan|program", re.I)
_WEAK_SLICE = re.compile(r"_id$|_number$|_code$|address|line_?\d|_name$|email|phone|postal|zip|_by$|checksum|url|description|comment|note", re.I)


def _key(name: str) -> str:
    return re.sub(r"[\s\-]+", "_", (name or "").strip().lower())


def _measure_score(m: Dict[str, Any]) -> float:
    s = 0.0
    name = _key(m["name"])
    if _WEAK_MEASURE.search(name):
        s -= 5
    if _GOOD_MEASURE.search(m["comment"]) or _GOOD_MEASURE.search(name):
        s += 3
    if m["agg"] in ("avg", "ratio", "sum"):
        s += 1
    return s


def _slice_score(sl: Dict[str, Any]) -> float:
    s = 0.0
    name = _key(sl["name"])
    if _WEAK_SLICE.search(name):
        s -= 5
    if _GOOD_SLICE.search(name):
        s += 3
    if sl["kind"] == "time" and re.search(r"month|quarter|year|week", name):
        s += 2
    if sl["kind"] == "flag":
        s -= 1
    return s


def best_recipe(kpi: Dict[str, Any]) -> Optional[Tuple[Dict[str, Any], Dict[str, Any], float]]:
    if not kpi["measures"] or not kpi["slices"]:
        return None
    m = max(kpi["measures"], key=_measure_score)
    sl = max(kpi["slices"], key=_slice_score)
    return m, sl, _measure_score(m) + _slice_score(sl)


def _build_digest(slug: str, version: str, flavour: str, sha: str, data: Dict[str, Any]) -> Dict[str, Any]:
    model = data.get("model") or {}
    path = f"data-models/{slug}/{version}/{flavour}"
    blob = f"{REPO_URL}/blob/{sha}/{path}"
    vtag = f"{version}_{flavour}"
    meta = data.get("_vibe_session_metadata") or {}
    stats_meta = meta.get("model_stats_at_generation") or {}

    tables: Dict[str, Dict[str, Any]] = {}
    areas: List[Dict[str, Any]] = []
    link_counts: Dict[Tuple[str, str], int] = {}
    sensitive_total = 0
    standards_count: Dict[str, int] = {}
    col_total = 0

    for dom in model.get("domains") or []:
        dname = dom.get("name", "")
        dstandards = _standards(dom.get("references", ""))
        for s in dstandards:
            standards_count[s] = standards_count.get(s, 0) + 1
        area_tables: List[str] = []
        area_sensitive = 0
        for p in dom.get("products") or []:
            pname = p.get("name", "")
            tid = f"{dname}.{pname}"
            cols, key_cols, links = [], [], []
            for a in p.get("attributes") or []:
                cname = a.get("column_name") or a.get("name") or ""
                col_total += 1
                is_pk = "primary_key" in str(a.get("tags") or "") or any(
                    tg.get("key") == "primary_key" for tg in a.get("tag_set") or [])
                fk = a.get("foreign_key_to") or ""
                sens = _sensitive(a)
                if sens:
                    sensitive_total += 1
                    area_sensitive += 1
                label = (a.get("business_glossary_term") or _humanize(cname)).replace(" (Foreign Key)", "")
                col = {"n": cname, "l": label, "t": _friendly_type(cname, a.get("type", ""))}
                if sens:
                    col["s"] = sens
                if is_pk:
                    col["k"] = "pk"
                if fk:
                    col["k"] = "fk"
                cols.append(col)
                if fk:
                    parts = fk.split(".")
                    if len(parts) >= 2:
                        target = f"{parts[0]}.{parts[1]}"
                        desc = a.get("description") or ""
                        reason = ""
                        if "Business justification:" in desc and parts[1] in desc.split("Business justification:")[0]:
                            reason = _first_sentence(desc.split("Business justification:", 1)[1], 180)
                        links.append({"to": target, "via": label, "reason": reason})
                        if parts[0] != dname:
                            key = tuple(sorted((dname, parts[0])))
                            link_counts[key] = link_counts.get(key, 0) + 1
                elif not is_pk and len(key_cols) < 8 and not cname.endswith("_id"):
                    key_cols.append(label)
            tables[tid] = {
                "id": tid,
                "name": pname,
                "area": dname,
                "label": _humanize(pname),
                "kind": _kind(p.get("type", "")),
                "subdomain": _humanize(p.get("subdomain", "")),
                "purpose": _first_sentence(p.get("description", ""), 240),
                "keyColumns": key_cols,
                "columns": cols,
                "linksTo": links[:24],
                "standard": _trim(p.get("reference", ""), 60),
            }
            area_tables.append(tid)
        areas.append({
            "name": dname,
            "label": _humanize(dname),
            "division": _humanize(dom.get("division", "")),
            "description": _trim(dom.get("description", ""), 520),
            "standards": dstandards[:6],
            "subdomains": [_humanize(s.get("name", "")) for s in dom.get("subdomains") or []],
            "tableIds": area_tables,
            "kpiIds": [],
            "sensitiveCount": area_sensitive,
            "schemaUrl": f"{blob}/schemas/{slug}_{dname}_schema_{vtag}.sql",
            "metricsUrl": f"{blob}/metrics/{slug}_{dname}_metrics_{vtag}.sql",
            "readmeUrl": f"{blob}/readme.md#domain-{dname}",
        })

    area_by_name = {a["name"]: a for a in areas}
    kpis: List[Dict[str, Any]] = []
    for mv in model.get("metric_views") or []:
        y = _parse_metric_view(mv.get("sql", ""))
        if not y:
            continue
        area = mv.get("owner_domain", "")
        view = mv.get("view_name", "")
        measures = []
        for me in (y.get("measures") or [])[:12]:
            if not isinstance(me, dict) or not me.get("name"):
                continue
            measures.append({
                "name": me["name"],
                "label": _humanize(me["name"]),
                "comment": _trim(me.get("comment", ""), 150),
                "agg": _agg_kind(me.get("expr", "")),
            })
        slices = []
        for d in (y.get("dimensions") or [])[:12]:
            if not isinstance(d, dict) or not d.get("name"):
                continue
            slices.append({
                "name": d["name"],
                "label": _humanize(d["name"]),
                "comment": _trim(d.get("comment", ""), 120),
                "kind": _slice_kind(d["name"], d.get("expr", ""), d.get("comment", "")),
            })
        if not measures:
            continue
        product = mv.get("owner_product", "")
        label = _humanize(view[len(area) + 1:] if view.startswith(area + "_") else view)
        kpis.append({
            "id": view,
            "area": area,
            "table": f"{area}.{product}",
            "label": label,
            "description": _trim(mv.get("description") or y.get("comment", ""), 200),
            "measures": measures,
            "slices": slices,
            "sourceUrl": f"{blob}/metrics/{slug}_{area}_metrics_{vtag}.sql",
        })
        if area in area_by_name:
            area_by_name[area]["kpiIds"].append(view)

    # How central each area is: tables plus how many cross-area links touch it.
    centrality = {a["name"]: len(a["tableIds"]) for a in areas}
    for (x, z), n in link_counts.items():
        centrality[x] = centrality.get(x, 0) + n / 10
        centrality[z] = centrality.get(z, 0) + n / 10

    starters: List[Dict[str, Any]] = []
    by_area: Dict[str, List[Tuple[float, Dict[str, Any], Dict[str, Any], Dict[str, Any]]]] = {}
    inbound: Dict[str, int] = {}
    for t in tables.values():
        for ln in t["linksTo"]:
            inbound[ln["to"]] = inbound.get(ln["to"], 0) + 1
    for k in kpis:
        rec = best_recipe(k)
        if rec and rec[2] > 0 and _measure_score(rec[0]) >= 0 and _slice_score(rec[1]) >= 0:
            score = rec[2] + min(4.0, inbound.get(k["table"], 0) / 4)
            by_area.setdefault(k["area"], []).append((score, k, rec[0], rec[1]))
    for a in by_area:
        by_area[a].sort(key=lambda x: -x[0])
    ranked_areas = sorted(by_area.keys(), key=lambda a: -centrality.get(a, 0))
    seen = set()
    for round_i in range(3):
        for a in ranked_areas:
            if round_i >= len(by_area[a]):
                continue
            _, k, measure, sl = by_area[a][round_i]
            q = f"{measure['label']} by {sl['label'].lower()}"
            if q.lower() in seen:
                continue
            seen.add(q.lower())
            starters.append({"question": q, "kpi": k["id"], "measure": measure["name"], "slice": sl["name"], "area": a})
            if len(starters) >= 24:
                break
        if len(starters) >= 24:
            break

    top_standards = [s for s, _ in sorted(standards_count.items(), key=lambda kv: -kv[1])[:6]]
    links = [{"a": a, "b": b, "n": n} for (a, b), n in sorted(link_counts.items(), key=lambda kv: -kv[1])]
    fk_total = stats_meta.get("fk_count") or sum(len(t["linksTo"]) for t in tables.values())

    return {
        "slug": slug,
        "label": model.get("name") or _humanize(slug),
        "version": version,
        "flavour": flavour,
        "catalog": f"idm_{slug}_{flavour}",
        "description": _trim(model.get("description", ""), 400),
        "source": {
            **_source(sha, path, data.get("agent_version", ""), meta.get("end_time", "")[:10]),
            "modelUrl": f"{blob}/model.json",
            "readmeUrl": f"{blob}/readme.md",
            "dictionaryUrl": f"{blob}/docs/{slug}_model_{vtag}.csv",
            "galleryUrl": f"{GALLERY_URL}?industry={slug}&version={version}&flavour={flavour}",
            "installerUrl": f"{REPO_URL}/blob/{sha}/{INSTALLER_PATH}",
        },
        "trust": {
            "qualityScore": data.get("native_quality_pct"),
            "standards": top_standards,
            "sensitiveFields": sensitive_total,
            "links": fk_total,
            "brokenLinks": stats_meta.get("unlinked_id_count", 0),
            "siloedTables": stats_meta.get("siloed_count", 0),
        },
        "stats": {
            "areas": len(areas),
            "tables": len(tables),
            "columns": col_total,
            "links": fk_total,
            "kpiSets": len(kpis),
            "measures": sum(len(k["measures"]) for k in kpis),
        },
        "areas": areas,
        "tables": list(tables.values()),
        "kpis": kpis,
        "links": links,
        "starterQuestions": starters,
    }


def _gzip_json(request: Request, payload: Any, max_age: int = 600) -> Response:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    headers = {"Cache-Control": f"private, max-age={max_age}"}
    if "gzip" in (request.headers.get("accept-encoding") or "") and len(body) > 2048:
        return Response(gzip.compress(body, 6), media_type="application/json",
                        headers={**headers, "Content-Encoding": "gzip", "Vary": "Accept-Encoding"})
    return Response(body, media_type="application/json", headers=headers)


def _check_slug(slug: str) -> None:
    if not _SLUG_RE.match(slug or ""):
        raise HTTPException(status_code=400, detail="Unknown blueprint")


async def _resolve(slug: str) -> Tuple[Dict[str, Any], str]:
    manifest, sha, _ = await _manifest()
    ind = next((i for i in manifest["industries"] if i["slug"] == slug), None)
    if not ind:
        raise HTTPException(status_code=404, detail="Unknown blueprint")
    return ind, sha


# --------------------------------------------------------------------------------------
# workspace (service principal) helpers
# --------------------------------------------------------------------------------------

def _client():
    from src.backend.identity import get_tagged_workspace_client
    return get_tagged_workspace_client()


def _sp_name(w) -> str:
    cached = _cache_get("sp_name", 3600)
    if cached:
        return cached
    me = w.current_user.me()
    return _cache_put("sp_name", me.user_name or "")


def _can_install_sync() -> Dict[str, Any]:
    if not _install_enabled():
        return {"canInstall": False, "reason": "disabled"}
    w = _client()
    sp = _sp_name(w)
    ms = w.metastores.current()
    eff = w.grants.get_effective("metastore", ms.metastore_id, principal=sp)
    privs = set()
    for pa in eff.privilege_assignments or []:
        for p in pa.privileges or []:
            privs.add(str(getattr(p.privilege, "value", p.privilege)))
    ok = "CREATE_CATALOG" in privs or "CREATE CATALOG" in privs
    return {"canInstall": ok, "reason": "" if ok else "no_create_catalog"}


async def _capabilities() -> Dict[str, Any]:
    cached = _cache_get("caps", 600)
    if cached:
        return cached
    try:
        caps = await asyncio.to_thread(_can_install_sync)
    except Exception as e:
        caps = {"canInstall": False, "reason": f"probe_failed: {str(e)[:120]}"}
    return _cache_put("caps", caps)


def _workspace_host(w) -> str:
    return (w.config.host or "").rstrip("/")


def _manifest_file(catalog: str, slug: str, flavour: str) -> str:
    return f"/Volumes/{catalog}/_install/logs/manifest_{slug}_{flavour}.json"


def _probe_installed_sync(catalog: str, slug: str, flavour: str) -> str:
    """'installed' | 'not_installed' | 'unknown' (ours, unfinished) | 'exists' (someone else's, unfinished or unshared)."""
    w = _client()
    try:
        w.files.get_metadata(_manifest_file(catalog, slug, flavour))
        return "installed"
    except Exception:
        pass
    try:
        info = w.catalogs.get(catalog)
    except Exception as e:
        name = type(e).__name__
        msg = str(e).lower()
        if name == "NotFound" or "does not exist" in msg or "not found" in msg:
            return "not_installed"
        return "unknown"
    # The provenance comment is only written after a successful install, and stays
    # readable when the manifest volume is not (no READ VOLUME on a catalog we don't own).
    if (info.comment or "").startswith(f"Installed from {REPO}"):
        return "installed"
    # Never start a second installer on a catalog someone else is filling in.
    try:
        if info.owner and info.owner != _sp_name(w):
            return "exists"
    except Exception:
        pass
    return "unknown"


# --------------------------------------------------------------------------------------
# install orchestration
# --------------------------------------------------------------------------------------

_PHASES = [
    ("prepare", "Getting the blueprint", 3),
    ("schema", "Creating business areas", 2),
    ("table", "Creating tables", 8),
    ("fk", "Connecting tables", 14),
    ("tag", "Labelling sensitive fields", 16),
    ("metric", "Adding ready-made KPIs", 7),
    ("retry", "Double-checking", 2),
    ("sample", "Filling in realistic sample data", 46),
    ("share", "Sharing with everyone", 2),
]
_PHASE_IDX = {p[0]: i for i, p in enumerate(_PHASES)}
_LINE_RE = re.compile(r"\[(schema|table|fk|tag|metric|other)\]\s+(START|DONE|(\d+)/(\d+))")
_POOLS_RE = re.compile(r"LLM pools (\d+)/(\d+)")

_INSTALLS: Dict[str, Dict[str, Any]] = {}
_LOCKS: Dict[str, asyncio.Lock] = {}
_SHARED_OK: set = set()


def _run_name(slug: str, flavour: str) -> str:
    return f"idm_install_{slug}_{flavour}"


def _progress_from_log(text: str) -> Tuple[str, float]:
    """(phase id, fraction of that phase done) from the installer's live log."""
    phase, frac = "prepare", 0.5
    for line in text.splitlines():
        m = _LINE_RE.search(line)
        if m:
            p = m.group(1) if m.group(1) != "other" else "metric"
            if m.group(2) == "START":
                phase, frac = p, 0.0
            elif m.group(2) == "DONE":
                phase, frac = p, 1.0
            else:
                d, t = int(m.group(3)), int(m.group(4))
                phase, frac = p, (d / t) if t else 0.0
        elif "retry pass" in line or "First-pass failures" in line:
            phase, frac = "retry", 0.5
        elif "SAMPLE DATA:" in line and "wrote" in line:
            phase, frac = "sample", 1.0
        elif (pm := _POOLS_RE.search(line)) and int(pm.group(2)):
            phase, frac = "sample", 0.05 + 0.6 * int(pm.group(1)) / int(pm.group(2))
        elif "LLM value pools for" in line or "LLM pass hit its" in line:
            phase, frac = "sample", 0.65
        elif "SAMPLE DATA:" in line or "sample:" in line:
            phase, frac = "sample", max(frac if phase == "sample" else 0.0, 0.03)
    return phase, frac


def _overall_pct(phase: str, frac: float) -> int:
    idx = _PHASE_IDX.get(phase, 0)
    total = sum(p[2] for p in _PHASES)
    done = sum(p[2] for p in _PHASES[:idx]) + _PHASES[idx][2] * max(0.0, min(1.0, frac))
    return int(round(100 * done / total))


def _tail_log_sync(catalog: str, slug: str, flavour: str) -> str:
    w = _client()
    folder = f"/Volumes/{catalog}/_install/logs"
    prefix = f"install_{slug}_{flavour}_"
    newest = None
    for entry in w.files.list_directory_contents(folder):
        name = entry.name or ""
        if name.startswith(prefix) and name.endswith(".log") and (newest is None or name > newest):
            newest = name
    if not newest:
        return ""
    resp = w.files.download(f"{folder}/{newest}")
    data = resp.contents.read()
    return data.decode("utf-8", "replace")[-60000:]


def _humanize_line(line: str) -> str:
    s = re.sub(r"^\s*\[?\d{2}:\d{2}:\d{2}\]?\s*", "", line).strip()
    return _trim(s, 140)


def _share_sync(catalog: str, source: Dict[str, Any]) -> List[str]:
    """Read access for everyone, plus a visible pointer back to the source repo."""
    from databricks.sdk.service.catalog import PermissionsChange, Privilege
    w = _client()
    notes = []
    w.grants.update("catalog", catalog, changes=[PermissionsChange(
        principal="account users",
        add=[Privilege.USE_CATALOG, Privilege.USE_SCHEMA, Privilege.SELECT, Privilege.READ_VOLUME],
    )])
    notes.append("granted read to account users")
    comment = (
        f"Installed from {REPO} ({source.get('path')} @ {source.get('shortSha')}) "
        f"via the V2V Insights flow. Source: {source.get('treeUrl')}. "
        f"Sample values are synthetic. {NOTICE_TEXT}"
    )
    try:
        w.catalogs.update(catalog, comment=comment)
        notes.append("catalog comment set")
    except Exception as e:
        notes.append(f"comment skipped: {str(e)[:80]}")
    tags = {
        "source_repo": REPO,
        "source_path": source.get("path", ""),
        "source_commit": source.get("commitSha", ""),
        "installed_via": "v2v_insights",
    }
    try:
        from databricks.sdk.service.catalog import EntityTagAssignment
        for k, v in tags.items():
            try:
                w.entity_tag_assignments.create(EntityTagAssignment(
                    entity_type="catalogs", entity_name=catalog, tag_key=k, tag_value=v[:255]))
            except Exception as e:
                if "already" not in str(e).lower():
                    notes.append(f"tag {k} skipped: {str(e)[:60]}")
    except Exception as e:
        notes.append(f"tags skipped: {str(e)[:80]}")
    return notes


def _submit_sync(slug: str, flavour: str, sha: str, catalog: str) -> Dict[str, Any]:
    from databricks.sdk.service import jobs, workspace
    import urllib.request

    w = _client()
    sp = _sp_name(w)
    with urllib.request.urlopen(
        urllib.request.Request(f"{RAW}/{sha}/{INSTALLER_PATH}", headers={"User-Agent": "v2v-insights"}),
        timeout=60,
    ) as r:
        nb = r.read()
    folder = f"/Workspace/Users/{sp}/idm"
    nb_path = f"{folder}/data-model-installer"
    w.workspace.mkdirs(folder)
    w.workspace.import_(
        nb_path,
        content=base64.b64encode(nb).decode("ascii"),
        format=workspace.ImportFormat.JUPYTER,
        overwrite=True,
    )
    params = {
        "operation": "Install",
        "model": slug,
        "model_size": flavour,
        "catalog_name": catalog,
        "cataloging_style": "One Catalog",
        "catalog_prefix": "",
        "catalog_suffix": "",
        "local_install": "",
        "generate_samples": "Yes",
        "sample_rows": SAMPLE_ROWS,
        "sample_threads": SAMPLE_THREADS,
        "source_ref": sha,
        "session_id": str((uuid.uuid4().int >> 64) & 9223372036854775807),
    }
    waiter = w.jobs.submit(
        run_name=_run_name(slug, flavour),
        tasks=[jobs.SubmitTask(
            task_key="install",
            notebook_task=jobs.NotebookTask(notebook_path=nb_path, base_parameters=params),
        )],
        access_control_list=[jobs.JobAccessControlRequest(
            group_name="users", permission_level=jobs.JobPermissionLevel.CAN_VIEW)],
        timeout_seconds=7200,
    )
    run_id = waiter.run_id if hasattr(waiter, "run_id") else waiter.response.run_id
    run = w.jobs.get_run(run_id)
    return {"runId": run_id, "runUrl": run.run_page_url or f"{_workspace_host(w)}/jobs/runs/{run_id}"}


def _find_active_run_sync(slug: str, flavour: str) -> Optional[Dict[str, Any]]:
    from databricks.sdk.service.jobs import RunType
    w = _client()
    want = _run_name(slug, flavour)
    for run in w.jobs.list_runs(active_only=True, run_type=RunType.SUBMIT_RUN, limit=25):
        if run.run_name == want:
            return {"runId": run.run_id, "runUrl": run.run_page_url or "",
                    "startedAt": (run.start_time or 0) / 1000}
    return None


def _run_state_sync(run_id: int) -> Tuple[str, str, str]:
    w = _client()
    run = w.jobs.get_run(run_id)
    st = run.state
    life = str(getattr(st.life_cycle_state, "value", st.life_cycle_state) or "") if st else ""
    result = str(getattr(st.result_state, "value", st.result_state) or "") if st else ""
    msg = (st.state_message or "") if st else ""
    if result and result != "SUCCESS":
        try:
            task_id = run.tasks[0].run_id if run.tasks else run_id
            out = w.jobs.get_run_output(task_id)
            msg = out.error or (out.notebook_output.result if out.notebook_output else "") or msg
        except Exception:
            pass
    return life, result, msg


async def _monitor(key: str) -> None:
    rec = _INSTALLS[key]
    terminal = {"TERMINATED", "INTERNAL_ERROR", "SKIPPED"}
    while True:
        await asyncio.sleep(8)
        try:
            life, result, msg = await asyncio.to_thread(_run_state_sync, rec["runId"])
        except Exception as e:
            rec["note"] = f"status check retrying: {str(e)[:80]}"
            continue
        try:
            text = await asyncio.to_thread(_tail_log_sync, rec["catalog"], rec["slug"], rec["flavour"])
            if text:
                phase, frac = _progress_from_log(text)
                rec["phase"], rec["phaseFraction"] = phase, frac
                rec["recent"] = [_humanize_line(l) for l in text.strip().splitlines()[-4:]]
        except Exception:
            pass
        if life in terminal:
            if result == "SUCCESS":
                rec["phase"], rec["phaseFraction"] = "share", 0.5
                try:
                    rec["shareNotes"] = await asyncio.to_thread(_share_sync, rec["catalog"], rec["source"])
                    _SHARED_OK.add(rec["catalog"])
                except Exception as e:
                    rec["shareNotes"] = [f"share failed: {str(e)[:120]}"]
                rec["state"] = "installed"
                rec["finishedAt"] = time.time()
            else:
                rec["state"] = "failed"
                rec["error"] = _trim(msg or f"{life} {result}", 400)
                rec["finishedAt"] = time.time()
            return


def _public(rec: Dict[str, Any]) -> Dict[str, Any]:
    phase = rec.get("phase", "prepare")
    out = {k: rec.get(k) for k in (
        "state", "catalog", "runId", "runUrl", "startedBy", "startedAt", "finishedAt", "error", "recent")}
    out["phase"] = phase
    out["phaseLabel"] = next((p[1] for p in _PHASES if p[0] == phase), "")
    out["percent"] = 100 if rec.get("state") == "installed" else _overall_pct(phase, rec.get("phaseFraction", 0))
    out["phases"] = [{"id": p[0], "label": p[1]} for p in _PHASES]
    out["source"] = rec.get("source")
    return out


async def _status(slug: str, flavour: str = "mvm") -> Dict[str, Any]:
    ind, sha = await _resolve(slug)
    catalog = f"idm_{slug}_{flavour}"
    key = catalog
    source = _source(sha, f"data-models/{slug}/{ind['version']}/{flavour}")
    rec = _INSTALLS.get(key)
    if rec and rec.get("state") in ("installing", "failed"):
        return _public(rec)
    try:
        probe = await asyncio.to_thread(_probe_installed_sync, catalog, slug, flavour)
    except Exception:
        probe = "unknown"
    host = ""
    try:
        host = _workspace_host(_client())
    except Exception:
        pass
    if probe == "installed":
        if catalog not in _SHARED_OK and _install_enabled():
            try:
                await asyncio.to_thread(_share_sync, catalog, (rec or {}).get("source") or source)
            except Exception:
                pass
            _SHARED_OK.add(catalog)
        return {"state": "installed", "catalog": catalog, "percent": 100, "phase": "share",
                "catalogUrl": f"{host}/explore/data/{catalog}" if host else "",
                "startedBy": (rec or {}).get("startedBy"), "source": (rec or {}).get("source") or source}
    try:
        active = await asyncio.to_thread(_find_active_run_sync, slug, flavour)
    except Exception:
        active = None
    if active:
        rec = _INSTALLS.setdefault(key, {
            "state": "installing", "slug": slug, "flavour": flavour, "catalog": catalog,
            "runId": active["runId"], "runUrl": active["runUrl"], "startedAt": active["startedAt"],
            "startedBy": None, "phase": "prepare", "phaseFraction": 0.5, "source": source,
        })
        if not rec.get("monitor"):
            rec["monitor"] = asyncio.create_task(_monitor(key))
        return _public(rec)
    return {"state": probe if probe in ("not_installed", "unknown", "exists") else "unknown",
            "catalog": catalog, "percent": 0, "source": source}


# --------------------------------------------------------------------------------------
# routes
# --------------------------------------------------------------------------------------

def _guard() -> None:
    if not _enabled():
        raise HTTPException(status_code=404, detail="Blueprints are turned off")


@router.get("/blueprints", summary="Industry blueprint catalog")
async def list_blueprints(request: Request):
    _guard()
    manifest, sha, live = await _manifest()
    return _gzip_json(request, {**manifest, "live": live, "source": _source(sha)}, max_age=900)


@router.get("/blueprints/capabilities", summary="Can the app install blueprints itself")
async def blueprint_capabilities():
    _guard()
    caps = await _capabilities()
    return {**caps, "installEnabled": _install_enabled()}


_IDM_RE = re.compile(r"^idm_([a-z0-9_]+?)_(mvm|ecm)$")


def _installed_sync() -> List[Dict[str, Any]]:
    w = _client()
    host = ""
    try:
        host = _workspace_host(w)
    except Exception:
        pass
    found = []
    for c in w.catalogs.list(max_results=1000):
        name = c.name or ""
        m = _IDM_RE.match(name)
        comment = c.comment or ""
        ours = comment.startswith(f"Installed from {REPO}")
        if not (m or ours):
            continue
        slug, flavour = (m.group(1), m.group(2)) if m else ("", "mvm")
        path = re.search(r"\((data-models/[^ ]+) @ ([0-9a-f]{7,40})\)", comment)
        found.append({
            "catalog": name,
            "slug": slug,
            "flavour": flavour,
            "owner": c.owner or "",
            "ready": ours,
            "sourcePath": path.group(1) if path else "",
            "shortSha": path.group(2)[:7] if path else "",
            "catalogUrl": f"{host}/explore/data/{name}" if host else "",
        })
    found.sort(key=lambda x: (not x["ready"], x["catalog"]))
    return found


@router.get("/blueprints/installed", summary="Industry data models already in this workspace")
async def installed_blueprints():
    _guard()
    cached = _cache_get("installed", 600)
    if cached is not None:
        return {"models": cached}
    try:
        models = await asyncio.to_thread(_installed_sync)
    except Exception as e:
        return {"models": [], "error": str(e)[:200]}
    _cache_put("installed", models)
    return {"models": models}


@router.get("/blueprints/{slug}", summary="Analyst digest of one industry blueprint")
async def get_blueprint(slug: str, request: Request, flavour: str = "mvm"):
    _guard()
    return _gzip_json(request, await load_digest(slug, flavour), max_age=3600)


async def load_digest(slug: str, flavour: str = "mvm") -> Dict[str, Any]:
    """The cached analyst digest of one model; raises HTTPException when it can't be had."""
    _check_slug(slug)
    if flavour not in ("mvm", "ecm"):
        raise HTTPException(status_code=400, detail="flavour must be mvm or ecm")
    ind, sha = await _resolve(slug)
    version = ind["version"]
    key = f"digest:{slug}:{version}:{flavour}:{sha}"
    digest = _cache_get(key, 12 * 3600)
    if digest is None:
        try:
            r = await _get(f"{RAW}/{sha}/data-models/{slug}/{version}/{flavour}/model.json", timeout=60)
            data = r.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not reach the blueprint library: {str(e)[:120]}")
        digest = await asyncio.to_thread(_build_digest, slug, version, flavour, sha, data)
        _cache_put(key, digest)
    return digest


@router.get("/blueprints/{slug}/status", summary="Install status of a blueprint")
async def blueprint_status(slug: str, flavour: str = "mvm"):
    _guard()
    _check_slug(slug)
    try:
        return await _status(slug, flavour)
    except HTTPException:
        raise
    except Exception as e:
        return {"state": "unknown", "error": str(e)[:200]}


@router.post("/blueprints/{slug}/install", summary="Install a blueprint once for everyone")
async def install_blueprint(slug: str, request: Request, flavour: str = "mvm"):
    _guard()
    _check_slug(slug)
    if flavour != "mvm":
        raise HTTPException(status_code=400, detail="Only the MVM blueprint can be installed here")
    caps = await _capabilities()
    if not caps.get("canInstall"):
        return JSONResponse({"state": "needs_genie_code", "reason": caps.get("reason")}, status_code=200)

    catalog = f"idm_{slug}_{flavour}"
    lock = _LOCKS.setdefault(catalog, asyncio.Lock())
    async with lock:
        status = await _status(slug, flavour)
        if status.get("state") in ("installed", "installing", "exists"):
            return status
        busy = [r for r in _INSTALLS.values() if r.get("state") == "installing"]
        if len(busy) >= MAX_CONCURRENT_INSTALLS:
            return JSONResponse({"state": "busy", "detail": "Another blueprint is installing. Try again in a few minutes."},
                                status_code=429)
        ind, sha = await _resolve(slug)
        source = _source(sha, f"data-models/{slug}/{ind['version']}/{flavour}")
        user = ""
        try:
            from src.backend.api.routes import _get_session_user
            user = _get_session_user(request)
        except Exception:
            user = request.headers.get("x-forwarded-email", "")
        try:
            sub = await asyncio.to_thread(_submit_sync, slug, flavour, sha, catalog)
        except Exception as e:
            return JSONResponse({"state": "failed", "error": _trim(str(e), 300)}, status_code=200)
        rec = {
            "state": "installing", "slug": slug, "flavour": flavour, "catalog": catalog,
            "runId": sub["runId"], "runUrl": sub["runUrl"], "startedAt": time.time(),
            "startedBy": user.split("@")[0].replace(".", " ").title() if user else None,
            "phase": "prepare", "phaseFraction": 0.2, "source": source,
            "startedIso": _dt.datetime.utcnow().isoformat() + "Z",
        }
        _INSTALLS[catalog] = rec
        rec["monitor"] = asyncio.create_task(_monitor(catalog))
        return _public(rec)
