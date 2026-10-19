"""Approved data sources for the Insights flow.

Admins list certified Unity Catalog schemas in the `approved_data_sources`
workshop parameter. This router reads those schemas live from Unity Catalog and
turns them into the same digest shape the industry data model explorer uses
(areas, tables, joins, KPIs, starter questions), so the browser can show them
with the same screens.

The digest is built without the AI, for every table in the schema:
- Areas come from a domain tag on the tables (`idm_domain`, `data_domain` or
  `domain`) when most tables carry one, else from how the tables join.
- Proposed KPIs come from each table's numeric, date and category columns.
A cheap column-free listing fingerprints the schema; only tables whose
`updated_at` moved are read again, and a digest is reused until the
fingerprint changes. Matching a use case goes through `table_matcher`.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple

import yaml
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.backend.api import insights_cache, table_matcher
from src.backend.api.blueprint_fit import MAX_CONTEXT_CHARS, MAX_QUESTIONS, _short, _text
from src.backend.api.blueprints import (
    _cache_get, _cache_put, _client, _friendly_type, _gzip_json, _humanize, _measure_score,
    _slice_kind, _slice_score, _workspace_host, best_recipe,
)

logger = logging.getLogger(__name__)
router = APIRouter()

PARAM_KEY = "approved_data_sources"
UC_SLUG_PREFIX = "uc:"
DEFAULT_SOURCES = [{"catalog": "samples", "schema": "wanderbricks", "label": "Wanderbricks (sample)"}]
MAX_SOURCES = 4
MAX_SCAN_TABLES = 2000
MAX_LISTED_TABLES = 200
MAX_AREAS = 16
MAX_PROPOSED_KPIS = 40
LIST_TTL_S = 600
LIGHT_TTL_S = 60
DIGEST_TTL_S = 24 * 3600
FULL_REFETCH_AT = 25
TAG_WORKERS = 16
TAG_PROBE = 8
TAG_COVERAGE = 0.6
DOMAIN_TAGS = ("idm_domain", "dbx_domain", "data_domain", "domain", "business_domain")
SUBDOMAIN_TAGS = ("idm_subdomain", "dbx_subdomain", "data_subdomain", "subdomain")
# A schema is read as a copy of a gallery industry model when most of its tables carry the model's table names.
MODEL_MIN_SCHEMA_SHARE = 0.6
MODEL_MIN_MODEL_SHARE = 0.3
MODEL_MIN_TABLES = 5
# Databricks' system tag for certified data; Catalog Explorer shows it as a Certified badge.
CERT_TAG = "system.certification_status"
CERT_VALUE = "certified"
# Setting a tag does not move a table's updated_at, so certification is re-read on its own clock.
CERT_TTL_S = 300
_IDM_CATALOG = re.compile(r"^idm_([a-z0-9_]+?)_(mvm|ecm)$")

_IDENT = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_\-]{0,127}$")
_AREA = re.compile(r"[^a-z0-9_]+")
_SENSITIVE = re.compile(r"email|phone|ssn|social_security|birth|address|passport|credit_card|card_number|iban", re.I)
_DATEISH = re.compile(r"DATE|TIMESTAMP")
_NUMERIC = re.compile(r"^(DECIMAL|DOUBLE|FLOAT|INT|BIGINT|SMALLINT|TINYINT|LONG|SHORT|BYTE)")
_SUMMABLE = re.compile(r"amount|revenue|cost|price|fee|total|qty|quantity|count|units|minutes|hours|seconds|duration|weight|volume|spend|sales|value|balance|miles|distance", re.I)
_NOT_MEASURE = re.compile(r"(_id|_key|_code|_number|_no|_seq|_sequence|_version|_year|_month|_day|_hour|_rank|_order|_lat|_lon|latitude|longitude|_zip|_postal)$", re.I)
_CATEGORY = re.compile(r"status|type|category|class|reason|channel|segment|region|country|tier|level|kind|source|mode|method|stage|cabin|grade|brand|code$", re.I)

_light = insights_cache.namespace("uc-light", max_mb=8, ttl_s=LIGHT_TTL_S)
_records = insights_cache.namespace("uc-tables", max_mb=192, ttl_s=7 * 24 * 3600)
_digests = insights_cache.namespace("uc-digest", max_mb=128, ttl_s=DIGEST_TTL_S, persist=True)
_certs = insights_cache.namespace("uc-cert", max_mb=4, ttl_s=CERT_TTL_S)

SOURCE_FIT_NOTE = """

This MODEL is the team's own governed tables in Unity Catalog, not an industry model. KPIs marked as proposed do not exist yet; Genie Code creates them.
For each entry in "questions" also return "tables": up to 3 table ids from MODEL that answer it, and "how": under 20 words on how they answer it (for example "Sum booking amounts by check-in month, joined to properties for city")."""


# --------------------------------------------------------------------------------------
# approved list
# --------------------------------------------------------------------------------------

def parse_sources(raw: Any) -> List[Dict[str, str]]:
    """The approved list as clean {catalog, schema, label, note} rows; bad rows are dropped."""
    try:
        items = json.loads(raw) if isinstance(raw, str) else raw
    except (TypeError, ValueError):
        return []
    out: List[Dict[str, str]] = []
    seen = set()
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            continue
        cat, sch = str(it.get("catalog") or "").strip(), str(it.get("schema") or "").strip()
        if not (_IDENT.match(cat) and _IDENT.match(sch)) or f"{cat}.{sch}" in seen:
            continue
        seen.add(f"{cat}.{sch}")
        out.append({
            "catalog": cat,
            "schema": sch,
            "label": _text(it.get("label"), 80) or f"{cat}.{sch}",
            "note": _text(it.get("note"), 200),
        })
    return out


def _approved_sync() -> List[Dict[str, str]]:
    try:
        from src.backend.api.routes import get_workshop_parameters_sync
        raw = get_workshop_parameters_sync().get(PARAM_KEY)
    except Exception as e:
        logger.warning(f"[DataSources] could not read {PARAM_KEY}: {e}")
        raw = None
    return parse_sources(raw) if raw is not None else parse_sources(DEFAULT_SOURCES)


def split_source(value: str) -> Tuple[str, str]:
    parts = (value or "").strip().split(".")
    if len(parts) != 2 or not all(_IDENT.match(p) for p in parts):
        raise HTTPException(status_code=400, detail=f"Not a catalog.schema name: {value[:80]}")
    return parts[0], parts[1]


# --------------------------------------------------------------------------------------
# Unity Catalog reads
# --------------------------------------------------------------------------------------

def _enum(v: Any) -> str:
    return str(getattr(v, "value", v) or "")


def table_record(t: Any) -> Dict[str, Any]:
    """A TableInfo as a plain dict, so digest building is testable without the SDK."""
    pks: List[str] = []
    fks: List[Dict[str, Any]] = []
    for c in getattr(t, "table_constraints", None) or []:
        pk = getattr(c, "primary_key_constraint", None)
        if pk:
            pks.extend(pk.child_columns or [])
        fk = getattr(c, "foreign_key_constraint", None)
        if fk:
            fks.append({"columns": list(fk.child_columns or []), "parent": fk.parent_table or "", "parentColumns": list(fk.parent_columns or [])})
    return {
        "name": t.name or "",
        "comment": t.comment or "",
        "type": _enum(getattr(t, "table_type", "")),
        "updatedAt": getattr(t, "updated_at", None) or 0,
        "viewDefinition": getattr(t, "view_definition", None) or "",
        "columns": [
            {"name": c.name or "", "type": (c.type_text or _enum(c.type_name) or "").upper(), "comment": c.comment or ""}
            for c in (t.columns or [])
        ],
        "pks": pks,
        "fks": fks,
        "tags": {},
    }


def _list_tables_sync(catalog: str, schema: str, columns: bool = True) -> List[Dict[str, Any]]:
    """Every table in the schema, paged, up to one past MAX_SCAN_TABLES so a cut-off shows."""
    out = []
    for t in _client().tables.list(catalog, schema, omit_columns=not columns, omit_properties=True):
        out.append(table_record(t))
        if len(out) > MAX_SCAN_TABLES:
            break
    return out


def _parallel(fn, items: List[Any]) -> List[Any]:
    if not items:
        return []
    with ThreadPoolExecutor(max_workers=min(TAG_WORKERS, len(items))) as ex:
        return list(ex.map(fn, items))


def _get_tables_sync(catalog: str, schema: str, names: List[str]) -> List[Dict[str, Any]]:
    w = _client()

    def one(name: str) -> Optional[Dict[str, Any]]:
        try:
            return table_record(w.tables.get(f"{catalog}.{schema}.{name}"))
        except Exception as e:
            logger.warning(f"[DataSources] could not read {catalog}.{schema}.{name}: {e}")
            return None
    return [r for r in _parallel(one, names) if r]


def _tags_sync(catalog: str, schema: str, names: List[str]) -> Dict[str, Dict[str, str]]:
    """name -> {tag: value} for domain and subdomain tags. A sample goes first; untagged schemas stop there."""
    w = _client()
    wanted = set(DOMAIN_TAGS) | set(SUBDOMAIN_TAGS)

    def one(name: str) -> Dict[str, str]:
        try:
            got = w.entity_tag_assignments.list(entity_type="tables", entity_name=f"{catalog}.{schema}.{name}")
            return {a.tag_key: a.tag_value or "" for a in got if a.tag_key in wanted}
        except Exception:
            return {}

    probe = names[:TAG_PROBE]
    out = dict(zip(probe, _parallel(one, probe)))
    if len(names) > len(probe) and not any(out.values()):
        return {n: {} for n in names}
    rest = names[len(probe):]
    out.update(zip(rest, _parallel(one, rest)))
    return out


def _certified_sync(catalog: str, schema: str, names: List[str]) -> List[str]:
    """The names in `names` tagged `system.certification_status = certified`. Unreadable tags count as not certified."""
    w = _client()

    def one(name: str) -> bool:
        try:
            got = w.entity_tag_assignments.list(entity_type="tables", entity_name=f"{catalog}.{schema}.{name}")
            return any(a.tag_key == CERT_TAG and (a.tag_value or "").strip().lower() == CERT_VALUE for a in got)
        except Exception:
            return False

    return sorted(n for n, ok in zip(names, _parallel(one, names)) if ok)


async def certified_tables(catalog: str, schema: str, light: List[Dict[str, Any]]) -> set:
    names = sorted(r["name"] for r in light)
    key = f"{catalog}.{schema}:{insights_cache.fingerprint(names)}"

    async def build():
        return await asyncio.to_thread(_certified_sync, catalog, schema, names), True

    try:
        return set(await _certs.get_or_build(key, build))
    except Exception as e:
        logger.warning(f"[DataSources] could not read certification for {catalog}.{schema}: {e}")
        return set()


def _schema_tables_sync(catalog: str, schema: str, light: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Full records for every table in `light`, reading again only the ones whose updated_at moved."""
    key = f"{catalog}.{schema}"
    prev: Dict[str, Dict[str, Any]] = _records.get(key) or {}
    changed = [r["name"] for r in light if r["name"] not in prev or (r["updatedAt"] and prev[r["name"]]["updatedAt"] != r["updatedAt"])]
    fresh: Dict[str, Dict[str, Any]] = {}
    if changed:
        if not prev or len(changed) > FULL_REFETCH_AT:
            rows = _list_tables_sync(catalog, schema, True)[:MAX_SCAN_TABLES]
            want = set(changed)
            fresh = {r["name"]: r for r in rows if r["name"] in want}
        else:
            fresh = {r["name"]: r for r in _get_tables_sync(catalog, schema, changed)}
        for name, tags in _tags_sync(catalog, schema, list(fresh)).items():
            fresh[name]["tags"] = tags
    merged = {r["name"]: fresh.get(r["name"]) or prev.get(r["name"]) for r in light}
    merged = {n: r for n, r in merged.items() if r}
    _records.put(key, merged, size=sum(400 + 120 * len(r["columns"]) for r in merged.values()))
    logger.info(f"[DataSources] {key}: {len(light)} tables, {len(fresh)} read, {len(merged) - len(fresh)} reused")
    return [merged[r["name"]] for r in light if r["name"] in merged]


async def _light_listing(catalog: str, schema: str) -> List[Dict[str, Any]]:
    """The column-free listing: name, type, updated_at. Shared by summaries, fingerprints and refresh."""
    key = f"{catalog}.{schema}"

    async def build():
        rows = await asyncio.to_thread(_list_tables_sync, catalog, schema, False)
        return [{"name": r["name"], "type": r["type"], "updatedAt": r["updatedAt"], "comment": r["comment"]} for r in rows], True

    return await _light.get_or_build(key, build)


_HIDDEN_CATALOGS = {"system", "__databricks_internal", "hive_metastore"}
_HIDDEN_SCHEMAS = {"information_schema"}


def _named(items: Any, hidden: set) -> List[Dict[str, str]]:
    """Visible {name, comment} rows, sorted by name; hidden and internal names dropped."""
    out = []
    for it in items:
        name = getattr(it, "name", None) or ""
        if not name or name.lower() in hidden or name.startswith("__"):
            continue
        out.append({"name": name, "comment": _short(getattr(it, "comment", None) or "", 160)})
    return sorted(out, key=lambda r: r["name"].lower())


def _list_catalogs_sync() -> List[Dict[str, str]]:
    return _named(_client().catalogs.list(max_results=1000), _HIDDEN_CATALOGS)


def _list_schemas_sync(catalog: str) -> List[Dict[str, str]]:
    return _named(_client().schemas.list(catalog_name=catalog, max_results=1000), _HIDDEN_SCHEMAS)


async def _source_summary(src: Dict[str, str]) -> Dict[str, Any]:
    key = f"ds-list:{src['catalog']}.{src['schema']}"
    hit = _cache_get(key, LIST_TTL_S)
    if hit is None:
        try:
            rows = await _light_listing(src["catalog"], src["schema"])
            tables = [{"name": r["name"], "comment": _short(r["comment"], 160)} for r in rows if r["type"] != "METRIC_VIEW"]
            metric_views = sum(1 for r in rows if r["type"] == "METRIC_VIEW")
            hit = _cache_put(key, {"readable": True, "tableCount": len(tables), "metricViews": metric_views,
                                   "tables": tables[:MAX_LISTED_TABLES], "error": ""})
        except Exception as e:
            # Not cached, so a fixed grant shows up on the next visit.
            hit = {"readable": False, "tableCount": 0, "metricViews": 0, "tables": [], "error": _short(str(e), 200)}
    out = {**src, "id": f"{src['catalog']}.{src['schema']}", **hit, "certifiedCount": 0}
    if hit["readable"]:
        rows = await _light_listing(src["catalog"], src["schema"])
        certs = await certified_tables(src["catalog"], src["schema"], rows)
        out["certifiedCount"] = sum(1 for r in rows if r["type"] != "METRIC_VIEW" and r["name"] in certs)
        out["tables"] = [{**t, "certified": t["name"] in certs} for t in hit["tables"]]
    return out


# --------------------------------------------------------------------------------------
# digest
# --------------------------------------------------------------------------------------

def _singular(name: str) -> List[str]:
    n = name.lower()
    out = [n]
    if n.endswith("ies"):
        out.append(n[:-3] + "y")
    if n.endswith("es"):
        out.append(n[:-2])
    if n.endswith("s"):
        out.append(n[:-1])
    return out


def infer_links(tables: List[Dict[str, Any]]) -> Dict[str, List[Tuple[str, str]]]:
    """name -> [(column, target table name)]: declared foreign keys, else `x_id` columns that match a table `x`."""
    by_name = {t["name"].lower(): t for t in tables}
    owner: Dict[str, str] = {}
    for t in tables:
        for s in _singular(t["name"]):
            owner.setdefault(f"{s}_id", t["name"])
            owner.setdefault(f"{s}_key", t["name"])
    links: Dict[str, List[Tuple[str, str]]] = {}
    for t in tables:
        found: List[Tuple[str, str]] = []
        declared = False
        for fk in t.get("fks") or []:
            parent = (fk.get("parent") or "").split(".")[-1].lower()
            if parent in by_name and fk.get("columns"):
                found.append((fk["columns"][0], by_name[parent]["name"]))
                declared = True
        if not declared:
            for c in t["columns"]:
                cn = c["name"].lower()
                target = owner.get(cn)
                if not target or target == t["name"]:
                    continue
                tcols = {x["name"].lower() for x in by_name[target.lower()]["columns"]}
                if cn in tcols or "id" in tcols:
                    found.append((c["name"], target))
        links[t["name"]] = found
    return links


def _pk_columns(t: Dict[str, Any]) -> List[str]:
    if t.get("pks"):
        return list(t["pks"])
    names = {c["name"].lower(): c["name"] for c in t["columns"]}
    for s in _singular(t["name"]):
        if f"{s}_id" in names:
            return [names[f"{s}_id"]]
    return [names["id"]] if "id" in names else []


def _table_kind(t: Dict[str, Any], n_links: int) -> str:
    cols = t["columns"]
    has_time = any(_DATEISH.search(c["type"]) for c in cols)
    if n_links >= 2 and len(cols) <= n_links + 3:
        return "link"
    if has_time and n_links >= 1:
        return "event"
    if len(cols) <= 4 and not has_time:
        return "lookup"
    return "thing"


def _area_name(v: Any) -> str:
    return _AREA.sub("_", str(v or "").lower()).strip("_")[:40]


def _tag(t: Dict[str, Any], keys: Tuple[str, ...]) -> str:
    tags = t.get("tags") or {}
    return next((tags[k] for k in keys if tags.get(k)), "")


def _graph(tables: List[Dict[str, Any]], links: Dict[str, List[Tuple[str, str]]]) -> Dict[str, set]:
    adj: Dict[str, set] = {t["name"]: set() for t in tables}
    for a, outs in links.items():
        for _, b in outs:
            if a in adj and b in adj and a != b:
                adj[a].add(b)
                adj[b].add(a)
    return adj


def tag_areas(tables: List[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    """name -> area from domain tags, when most tables carry one."""
    tagged = {t["name"]: _area_name(_tag(t, DOMAIN_TAGS)) for t in tables}
    tagged = {n: a for n, a in tagged.items() if a}
    return tagged if tables and len(tagged) >= TAG_COVERAGE * len(tables) else None


def community_areas(tables: List[Dict[str, Any]], adj: Dict[str, set]) -> Dict[str, str]:
    """name -> area by label propagation over the join graph.

    A neighbour's vote is divided by its number of joins, so a table everything joins to (a calendar, a
    currency) can't pull unrelated tables into one area.
    """
    names = sorted(adj)
    label = {n: n for n in names}
    for _ in range(30):
        moved = False
        for n in names:
            votes: Dict[str, float] = defaultdict(float)
            for o in adj[n]:
                votes[label[o]] += 1.0 / len(adj[o])
            if not votes:
                continue
            top = max(votes.values())
            best = sorted(l for l, v in votes.items() if v >= top - 1e-9)
            pick = label[n] if label[n] in best else best[0]
            if pick != label[n]:
                label[n], moved = pick, True
        if not moved:
            break
    return label


def _settle(names: List[str], area_of: Dict[str, str], adj: Dict[str, set], max_areas: int = MAX_AREAS,
            keep_small: bool = False) -> Dict[str, str]:
    """Place untagged tables, fold areas under 3 tables into their neighbours (unless `keep_small`), and keep at most `max_areas`."""
    out = dict(area_of)

    def home(n: str, allowed: Optional[set] = None) -> Optional[str]:
        votes = Counter(out[o] for o in adj.get(n, ()) if o in out and (allowed is None or out[o] in allowed) and out[o] != out.get(n))
        return votes.most_common(1)[0][0] if votes else None

    for n in names:
        if n not in out:
            h = home(n)
            if h:
                out[n] = h
    for _ in range(3):
        sizes = Counter(out.values())
        big = {a for a, c in sizes.items() if c >= 3 or keep_small}
        keep = {a for a, _ in sizes.most_common(max_areas - 1) if a in big} or big
        changed = False
        for n in names:
            if n in out and out[n] not in keep:
                h = home(n, keep)
                if h:
                    out[n], changed = h, True
        if not changed:
            break
    sizes = Counter(out.values())
    keep = {a for a, _ in sizes.most_common(max_areas - 1)}
    for n in names:
        if n not in out or out[n] not in keep:
            out[n] = "other"
    return out


def assign_areas(tables: List[Dict[str, Any]], links: Dict[str, List[Tuple[str, str]]],
                 model: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """{"areas": [{name, label, description, tables, subdomains}], "by": "model" | "tags" | "joins"}.

    With a recognised industry `model` (see `ModelMatch`), each copied table goes to its model domain.
    """
    adj = _graph(tables, links)
    names = [t["name"] for t in tables]
    max_areas = MAX_AREAS
    if model:
        by, raw = "model", {n: model["area_of"][n] for n in names if n in model["area_of"]}
        max_areas = max(MAX_AREAS, len(set(raw.values())) + 1)
    else:
        tagged = tag_areas(tables)
        by = "tags" if tagged else "joins"
        raw = tagged if tagged else community_areas(tables, adj)
    area_of = _settle(names, raw, adj, max_areas, keep_small=bool(model))
    if by == "joins":
        # Join-based areas are named after their best-connected table.
        hub_of: Dict[str, str] = {}
        for a in set(area_of.values()):
            if a == "other":
                continue
            members = [n for n in names if area_of[n] == a]
            hub_of[a] = max(members, key=lambda n: (len(adj[n]), -len(n), n))
        area_of = {n: (_area_name(hub_of[a]) if a in hub_of else a) for n, a in area_of.items()}
    by_t = {t["name"]: t for t in tables}
    groups: Dict[str, List[str]] = defaultdict(list)
    for n in names:
        groups[area_of[n]].append(n)
    areas = []
    for a, members in sorted(groups.items(), key=lambda kv: (kv[0] == "other", -len(kv[1]), kv[0])):
        top = sorted(members, key=lambda n: (-len(adj[n]), n))[:4]
        subs = Counter(_tag(by_t[n], SUBDOMAIN_TAGS) for n in members)
        subs.pop("", None)
        label = "Other tables" if a == "other" else _humanize(a)
        about = (model or {}).get("areas", {}).get(a, {})
        areas.append({
            "name": a,
            "label": about.get("label") or label,
            "description": about.get("description") or f"{len(members)} tables, including {', '.join(_humanize(n).lower() for n in top)}.",
            "tables": members,
            "subdomains": [_humanize(s) for s, _ in subs.most_common(8)],
        })
    return {"areas": areas, "by": by}


def _measures_of(t: Dict[str, Any], pk: set, fk_cols: set) -> List[Dict[str, Any]]:
    label = _humanize(t["name"]).lower()
    out = [{"name": f"{_area_name(t['name'])}_count", "label": f"Number of {label} records", "comment": "", "agg": "count", "expr": "COUNT(*)"}]
    for c in t["columns"]:
        cn = c["name"]
        low = cn.lower()
        if low in pk or low in fk_cols or not _NUMERIC.match(c["type"]) or _NOT_MEASURE.search(low):
            continue
        averaged = re.search(r"rate|pct|percent|ratio|score|avg|average", low)
        if not (_SUMMABLE.search(low) or averaged):
            continue
        agg = "avg" if averaged else "sum"
        verb = "Total" if agg == "sum" else "Average"
        out.append({"name": f"{agg}_{_area_name(cn)}", "label": f"{verb} {_humanize(cn).lower()}", "comment": _short(c["comment"], 150),
                    "agg": agg, "expr": f"{agg.upper()}({cn})"})
    head, rest = out[:1], sorted(out[1:], key=lambda m: -_measure_score(m))
    return head + rest[:3]


def _slices_of(t: Dict[str, Any], pk: set, fk_cols: set) -> List[Dict[str, Any]]:
    out = []
    for c in t["columns"]:
        cn = c["name"]
        low = cn.lower()
        if low in pk or low in fk_cols:
            continue
        typ = c["type"]
        if _DATEISH.search(typ):
            kind = "time"
        elif typ.startswith("BOOLEAN"):
            kind = "flag"
        elif typ.startswith(("STRING", "VARCHAR", "CHAR")) and _CATEGORY.search(low) and not low.endswith("_id"):
            kind = "category"
        else:
            continue
        out.append({"name": _area_name(cn), "label": _humanize(cn), "comment": _short(c["comment"], 120), "kind": kind, "column": cn})
    return sorted(out, key=lambda s: -_slice_score(s))[:5]


def propose_kpis(tables: List[Dict[str, Any]], links: Dict[str, List[Tuple[str, str]]], area_of: Dict[str, str]) -> List[Dict[str, Any]]:
    """KPIs a team would track, one per fact-like table, from its numeric, date and category columns.

    Ranked by how central the table is (joins in and out), then by whether it has a real total and a time slice.
    """
    referenced = Counter(b for outs in links.values() for _, b in outs)
    ranked = []
    for t in tables:
        outs = links.get(t["name"], [])
        kind = _table_kind(t, len(outs))
        if kind in ("link", "lookup"):
            continue
        pk = {c.lower() for c in _pk_columns(t)}
        fk_cols = {c.lower() for c, _ in outs}
        measures, slices = _measures_of(t, pk, fk_cols), _slices_of(t, pk, fk_cols)
        if not slices:
            continue
        kpi = {
            "id": _area_name(t["name"]),
            "area": area_of[t["name"]],
            "table": t["name"],
            "label": _humanize(t["name"]),
            "description": _short(t["comment"], 200) or f"Measures over {_humanize(t['name']).lower()}.",
            "measures": measures,
            "slices": slices,
        }
        rec = best_recipe(kpi)
        score = ((rec[2] if rec else -9) + 2 * min(len(measures) - 1, 2) + (2 if kind == "event" else 0)
                 + (2 if any(s["kind"] == "time" for s in slices) else 0)
                 + min(len(outs), 4) + min(referenced[t["name"]], 6) / 2)
        ranked.append((score, t["name"], kpi))
    ranked.sort(key=lambda r: (-r[0], r[1]))
    return [k for _, _, k in ranked[:MAX_PROPOSED_KPIS]]


# --------------------------------------------------------------------------------------
# copies of gallery industry models
# --------------------------------------------------------------------------------------

def model_match(model_digest: Dict[str, Any], names: List[str], whole_model: bool = True) -> Optional[Dict[str, Any]]:
    """What a schema copied from an industry model can reuse from it, or None when it is not such a copy.

    A copy keeps the model's table and column names but loses what lives outside the tables: foreign keys are often
    dropped and the metric views are separate objects. `whole_model` False accepts a schema holding one domain of
    the model, as the app's own installer lays it out.
    """
    by_name = {t["name"]: t for t in model_digest.get("tables") or []}
    hits = [n for n in names if n in by_name]
    if len(hits) < MODEL_MIN_TABLES or len(hits) < MODEL_MIN_SCHEMA_SHARE * len(names):
        return None
    if whole_model and len(hits) < MODEL_MIN_MODEL_SHARE * len(by_name):
        return None
    present = set(hits)
    links = {
        n: [(ln["column"], ln["to"].split(".")[-1]) for ln in by_name[n].get("linksTo") or []
            if ln.get("column") and ln.get("to", "").split(".")[-1] in present]
        for n in hits
    }
    return {
        "slug": model_digest.get("slug", ""),
        "label": model_digest.get("label", ""),
        "version": model_digest.get("version", ""),
        "sha": (model_digest.get("source") or {}).get("commitSha", ""),
        "matched": len(hits),
        "total": len(by_name),
        "area_of": {n: _area_name(by_name[n]["area"]) for n in hits},
        "areas": {_area_name(a["name"]): {"label": a.get("label", ""), "description": a.get("description", "")}
                  for a in model_digest.get("areas") or []},
        "purpose": {n: by_name[n].get("purpose", "") for n in hits},
        "links": links,
        "kpis": [{**k, "table": k["table"].split(".")[-1]} for k in model_digest.get("kpis") or []
                 if k.get("table", "").split(".")[-1] in present],
    }


def model_summary(model: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not model:
        return None
    return {k: model[k] for k in ("slug", "label", "version", "matched", "total")}


def apply_model(tables: List[Dict[str, Any]], links: Dict[str, List[Tuple[str, str]]],
                model: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, List[Tuple[str, str]]]]:
    """Tables with the model's descriptions where theirs are empty, and links plus the model's joins they lost."""
    out_tables = [t if t.get("comment") or not model["purpose"].get(t["name"]) else {**t, "comment": model["purpose"][t["name"]]}
                  for t in tables]
    cols = {t["name"]: {c["name"].lower() for c in t["columns"]} for t in tables}
    out_links = {n: list(v) for n, v in links.items()}
    for name, extra in model["links"].items():
        have = {(c.lower(), target) for c, target in out_links.get(name, [])}
        for column, target in extra:
            if column.lower() in cols.get(name, ()) and target in cols and target != name and (column.lower(), target) not in have:
                out_links.setdefault(name, []).append((column, target))
                have.add((column.lower(), target))
    return out_tables, out_links


def model_kpis(model: Dict[str, Any], area_of: Dict[str, str], own_views: set, catalog_views: Dict[str, str]) -> List[Dict[str, Any]]:
    """The model's KPI sets on the copied tables: live where the metric view exists, else proposed for Genie Code."""
    out = []
    for k in model["kpis"]:
        if k["table"] not in area_of or k["id"] in own_views:
            continue
        url = catalog_views.get(k["id"], "")
        out.append({**k, "area": area_of[k["table"]], "proposed": not url, "model": model["slug"],
                    "sourceUrl": url or k.get("sourceUrl", "")})
    return out


async def recognise_model(catalog: str, schema: str, names: List[str]) -> Optional[Dict[str, Any]]:
    """The gallery model a schema was copied from, judged by its table names. Best effort: None on any failure."""
    from src.backend.api import blueprints
    try:
        manifest, _, _ = await blueprints._manifest()
    except Exception as e:
        logger.warning(f"[DataSources] model gallery unavailable: {e}")
        return None
    slugs = {i["slug"] for i in manifest.get("industries") or []}
    installed = _IDM_CATALOG.match(catalog.lower())
    in_install = bool(installed and installed.group(1) in slugs)
    candidates = [s for s in dict.fromkeys([schema.lower(), installed.group(1) if installed else ""]) if s in slugs]
    for slug in candidates:
        try:
            found = model_match(await blueprints.load_digest(slug, "mvm"), names, whole_model=not in_install)
        except Exception as e:
            logger.warning(f"[DataSources] could not load model {slug}: {e}")
            continue
        if found:
            logger.info(f"[DataSources] {catalog}.{schema} is a copy of {slug}: {found['matched']} of {found['total']} tables")
            return found
    return None


async def _catalog_metric_views(catalog: str) -> Dict[str, str]:
    """name -> explorer URL of the metric views in `<catalog>._metrics`, where the installer puts them."""
    key = f"ds-metric-views:{catalog}"
    hit = _cache_get(key, LIST_TTL_S)
    if hit is not None:
        return hit
    try:
        rows = await _light_listing(catalog, "_metrics")
    except Exception:
        rows = []
    host = ""
    try:
        host = _workspace_host(_client())
    except Exception:
        pass
    return _cache_put(key, {r["name"]: (f"{host}/explore/data/{catalog}/_metrics/{r['name']}" if host else "")
                            for r in rows if r["type"] == "METRIC_VIEW"})


def layout_of(tables: List[Dict[str, Any]], links: Dict[str, List[Tuple[str, str]]], model: Optional[Dict[str, Any]] = None,
              own_views: Optional[set] = None, catalog_views: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Areas and KPIs for one schema, with no AI call. A copy of an industry model takes its domains and KPIs."""
    placed = assign_areas(tables, links, model)
    area_of = {n: a["name"] for a in placed["areas"] for n in a["tables"]}
    kpis = model_kpis(model, area_of, own_views or set(), catalog_views or {}) if model else []
    covered = {k["table"] for k in kpis}
    kpis += propose_kpis([t for t in tables if t["name"] not in covered], links, area_of)
    description = ""
    if model:
        description = (f"A copy of the {model['label']} industry data model ({model['matched']} of {model['total']} tables): "
                       "business areas, joins and KPIs come from the model.")
    return {"description": description, "areas": placed["areas"], "areasBy": placed["by"], "kpis": kpis}


def _metric_view_kpi(t: Dict[str, Any], area_of_table: Dict[str, str], fallback_area: str) -> Optional[Dict[str, Any]]:
    try:
        y = yaml.safe_load(t.get("viewDefinition") or "")
    except Exception:
        return None
    if not isinstance(y, dict):
        return None
    src = str(y.get("source") or "").split(".")[-1]
    table = src if src in area_of_table else ""
    area = area_of_table.get(table, fallback_area)
    measures = []
    for m in (y.get("measures") or [])[:12]:
        if isinstance(m, dict) and m.get("name"):
            expr = str(m.get("expr") or "")
            agg = next((k for k in ("avg", "count", "sum", "min", "max") if expr.upper().startswith(k.upper() + "(")), "ratio" if "/" in expr else "calc")
            measures.append({"name": m["name"], "label": _humanize(m["name"]), "comment": _short(m.get("comment"), 150), "agg": agg, "expr": expr})
    slices = []
    for d in (y.get("dimensions") or [])[:12]:
        if isinstance(d, dict) and d.get("name"):
            slices.append({"name": d["name"], "label": _humanize(d["name"]), "comment": _short(d.get("comment"), 120),
                           "kind": _slice_kind(d["name"], str(d.get("expr") or ""), str(d.get("comment") or ""))})
    if not measures:
        return None
    return {"id": _area_name(t["name"]), "area": area, "table": table, "label": _humanize(t["name"]),
            "description": _short(t.get("comment") or y.get("comment"), 200), "measures": measures, "slices": slices}


def build_digest(parts: List[Dict[str, Any]], certified: bool, host: str = "",
                 all_sources: Optional[List[str]] = None) -> Dict[str, Any]:
    """parts: [{catalog, schema, label, tables, links, layout, truncated, certified?}] -> a BlueprintDigest-shaped dict.

    `all_sources` are the catalog.schema ids asked for, kept in the slug even when a part was left out.
    """
    multi = len(parts) > 1
    areas: List[Dict[str, Any]] = []
    tables_out: List[Dict[str, Any]] = []
    kpis: List[Dict[str, Any]] = []
    link_counts: Dict[Tuple[str, str], int] = {}
    sensitive_total = col_total = 0
    used_area_names: set = set()
    descriptions: List[str] = []

    for p in parts:
        cat, sch = p["catalog"], p["schema"]
        layout = p["layout"]
        if layout.get("description"):
            descriptions.append(layout["description"])
        rename: Dict[str, str] = {}
        for a in layout["areas"]:
            name = a["name"]
            if name in used_area_names:
                name = _area_name(f"{sch}_{a['name']}")
            if name in used_area_names:
                name = _area_name(f"{cat}_{sch}_{a['name']}")
            used_area_names.add(name)
            rename[a["name"]] = name
        area_of = {tn: rename[a["name"]] for a in layout["areas"] for tn in a["tables"]}
        tid = {tn: f"{area_of[tn]}.{tn}" for tn in area_of}
        by_name = {t["name"]: t for t in p["tables"]}
        certified_names = p.get("certified") or set()

        for a in layout["areas"]:
            area_sensitive = 0
            ids = []
            for tn in a["tables"]:
                t = by_name[tn]
                pk = {c.lower() for c in _pk_columns(t)}
                outs = p["links"].get(tn, [])
                fk_cols = {c.lower(): target for c, target in outs}
                cols = []
                key_cols = []
                for c in t["columns"]:
                    col_total += 1
                    col: Dict[str, Any] = {"n": c["name"], "l": _humanize(c["name"]), "t": _friendly_type(c["name"], c["type"])}
                    if _SENSITIVE.search(c["name"]):
                        col["s"] = "personal"
                        sensitive_total += 1
                        area_sensitive += 1
                    if c["name"].lower() in fk_cols:
                        col["k"] = "fk"
                    elif c["name"].lower() in pk:
                        col["k"] = "pk"
                    elif len(key_cols) < 8 and not c["name"].lower().endswith("_id"):
                        key_cols.append(_humanize(c["name"]))
                    cols.append(col)
                links_to = []
                for c, target in outs:
                    links_to.append({"to": tid[target], "via": _humanize(c), "reason": ""})
                    if area_of[target] != area_of[tn]:
                        k = tuple(sorted((area_of[tn], area_of[target])))
                        link_counts[k] = link_counts.get(k, 0) + 1
                tables_out.append({
                    "id": tid[tn],
                    "name": tn,
                    "fqn": f"{cat}.{sch}.{tn}",
                    "area": area_of[tn],
                    "label": _humanize(tn),
                    "kind": _table_kind(t, len(outs)),
                    "subdomain": _humanize(_tag(t, SUBDOMAIN_TAGS)),
                    "purpose": _short(t["comment"], 240) or f"Table {cat}.{sch}.{tn}",
                    "keyColumns": key_cols,
                    "columns": cols,
                    "linksTo": links_to[:24],
                    "certified": tn in certified_names,
                })
                ids.append(tid[tn])
            areas.append({
                "name": rename[a["name"]],
                "label": a["label"],
                "division": f"{cat}.{sch}" if multi else "",
                "description": a.get("description") or "",
                "standards": [],
                "subdomains": a.get("subdomains") or [],
                "tableIds": ids,
                "kpiIds": [],
                "sensitiveCount": area_sensitive,
                "schemaUrl": f"{host}/explore/data/{cat}/{sch}" if host else "",
            })

        first_area = rename[layout["areas"][0]["name"]] if layout["areas"] else ""
        for mv in p.get("metricViews") or []:
            k = _metric_view_kpi(mv, area_of, first_area)
            if k:
                k["table"] = tid.get(k["table"], "")
                k["sourceUrl"] = f"{host}/explore/data/{cat}/{sch}/{mv['name']}" if host else ""
                kpis.append(k)
        for k in layout["kpis"]:
            kpis.append({"proposed": True, "sourceUrl": "", **k, "area": area_of[k["table"]], "table": tid[k["table"]]})

    area_by_name = {a["name"]: a for a in areas}
    seen_ids: set = set()
    unique = []
    for k in kpis:
        if k["id"] in seen_ids:
            k = {**k, "id": f"{k['id']}_{len(seen_ids)}"}
        seen_ids.add(k["id"])
        unique.append(k)
        if k["area"] in area_by_name:
            area_by_name[k["area"]]["kpiIds"].append(k["id"])
    kpis = unique

    starters = []
    # Guessed KPIs arrive already ranked; metric views and the industry model's KPIs go first, best recipe first.
    def guessed(k: Dict[str, Any]) -> bool:
        return bool(k.get("proposed")) and not k.get("model")

    ranked = sorted(kpis, key=lambda k: (guessed(k), 0 if guessed(k) else -(best_recipe(k) or (None, None, -99))[2]))
    seen_q = set()
    for k in ranked:
        rec = best_recipe(k)
        if not rec or _measure_score(rec[0]) < 0 or _slice_score(rec[1]) < 0:
            continue
        q = f"{rec[0]['label']} by {rec[1]['label'].lower()}"
        if q.lower() in seen_q:
            continue
        seen_q.add(q.lower())
        starters.append({"question": q, "kpi": k["id"], "measure": rec[0]["name"], "slice": rec[1]["name"], "area": k["area"]})
        if len(starters) >= 24:
            break

    if multi:
        # The same area name in two schemas ("Loyalty") would read as one area on the map.
        seen_labels = Counter(a["label"] for a in areas)
        for a in areas:
            if seen_labels[a["label"]] > 1:
                a["label"] = f"{a['label']} ({a['division'].split('.')[-1]})"

    ids = list(all_sources or [f"{p['catalog']}.{p['schema']}" for p in parts])
    first = parts[0] if parts else dict(zip(("catalog", "schema"), (ids[0].split(".", 1) if ids else ["", ""])))
    explore = f"{host}/explore/data/{first['catalog']}/{first['schema']}" if host else ""
    fk_total = sum(len(t["linksTo"]) for t in tables_out)
    label = parts[0].get("label") if len(parts) == 1 and len(ids) == 1 else " + ".join(
        p.get("label") or f"{p['catalog']}.{p['schema']}" for p in parts) or ", ".join(ids)
    truncated = [f"{p['catalog']}.{p['schema']}" for p in parts if p.get("truncated")]
    linked_to = {l["to"] for t in tables_out for l in t["linksTo"]}
    return {
        "slug": UC_SLUG_PREFIX + ",".join(ids),
        "label": label or ids[0],
        "version": "",
        "flavour": "uc",
        "catalog": first["catalog"],
        "sources": ids,
        "description": " ".join(descriptions)[:400] or f"Governed tables in {', '.join(ids)}.",
        "source": {
            "repo": ", ".join(ids), "repoUrl": explore, "commitSha": "", "shortSha": "", "commitUrl": "",
            "path": ", ".join(ids), "treeUrl": explore, "licenseUrl": "", "noticeUrl": "", "noticeText": "",
            "galleryUrl": "", "agentVersion": "", "generatedAt": "",
        },
        "trust": {
            "qualityScore": None,
            "standards": [],
            "sensitiveFields": sensitive_total,
            "links": fk_total,
            "brokenLinks": 0,
            "siloedTables": sum(1 for t in tables_out if not t["linksTo"] and t["id"] not in linked_to),
            "certified": certified,
            "truncated": truncated,
            "areasBy": sorted({p["layout"].get("areasBy", "") for p in parts} - {""}),
        },
        "stats": {
            "areas": len(areas),
            "tables": len(tables_out),
            "columns": col_total,
            "links": fk_total,
            "kpiSets": len(kpis),
            "measures": sum(len(k["measures"]) for k in kpis),
        },
        "areas": areas,
        "tables": tables_out,
        "kpis": kpis,
        "links": [{"a": a, "b": b, "n": n} for (a, b), n in sorted(link_counts.items(), key=lambda kv: -kv[1])],
        "starterQuestions": starters,
        "models": [{"source": f"{p['catalog']}.{p['schema']}", **p["model"]} for p in parts if p.get("model")],
    }


def scope_of(pairs: List[Tuple[str, str]], lights: List[List[Dict[str, Any]]], certs: List[set],
             certified_only: bool) -> Dict[str, Any]:
    """What a scan covers: tables only (metric views are not counted), certified and in total, per schema."""
    per = []
    for (c, s), light, cert in zip(pairs, lights, certs):
        names = [r["name"] for r in light[:MAX_SCAN_TABLES] if r["type"] != "METRIC_VIEW"]
        per.append({"id": f"{c}.{s}", "certified": sum(1 for n in names if n in cert), "total": len(names)})
    total = sum(p["total"] for p in per)
    certified = sum(p["certified"] for p in per)
    return {
        "certifiedOnly": certified_only,
        "scanned": certified if certified_only else total,
        "certified": certified,
        "total": total,
        "perSource": per,
    }


def _parse_source_list(value: str) -> List[Tuple[str, str]]:
    """catalog.schema pairs from a comma-joined list; a digest slug ("uc:a.b,c.d") is accepted too."""
    out: List[Tuple[str, str]] = []
    value = (value or "").strip()
    if value.startswith(UC_SLUG_PREFIX):
        value = value[len(UC_SLUG_PREFIX):]
    for part in value.split(","):
        if part.strip():
            pair = split_source(part)
            if pair not in out:
                out.append(pair)
    if not out:
        raise HTTPException(status_code=400, detail="Pick at least one catalog.schema.")
    return out[:MAX_SOURCES]


async def load_source_digest(value: str, certified_only: bool = False) -> Dict[str, Any]:
    """The digest for one or more schemas, rebuilt only when a table in them changes.

    With `certified_only`, only tables and views tagged certified are scanned; a schema with none is left out
    rather than failing. `scope` on the digest says what was scanned and what was skipped.
    """
    pairs = _parse_source_list(value)
    approved = {f"{s['catalog']}.{s['schema']}": s for s in await asyncio.to_thread(_approved_sync)}
    lights: List[List[Dict[str, Any]]] = []
    for cat, sch in pairs:
        try:
            lights.append(await _light_listing(cat, sch))
        except Exception as e:
            raise HTTPException(status_code=403, detail=f"The app cannot read {cat}.{sch}: {_short(str(e), 160)}")
    labels = [approved.get(f"{c}.{s}", {}).get("label") or f"{c}.{s}" for c, s in pairs]
    certified = all(f"{c}.{s}" in approved for c, s in pairs)
    models = [await recognise_model(c, s, [r["name"] for r in light if r["type"] != "METRIC_VIEW"])
              for (c, s), light in zip(pairs, lights)]
    catalog_views: Dict[str, Dict[str, str]] = {}
    for (c, _), m in zip(pairs, models):
        if m and c not in catalog_views:
            catalog_views[c] = await _catalog_metric_views(c)
    certs = [await certified_tables(c, s, light) for (c, s), light in zip(pairs, lights)]
    scope = scope_of(pairs, lights, certs, certified_only)
    scanned = [[r for r in light if r["name"] in cert] if certified_only else light for light, cert in zip(lights, certs)]
    key = insights_cache.fingerprint(
        "uc-digest-v4", pairs, labels, certified, certified_only,
        [[(r["name"], r["updatedAt"]) for r in light] for light in scanned],
        [sorted(c) for c in certs],
        [(m["slug"], m["version"], m["sha"]) if m else None for m in models],
        {c: sorted(v) for c, v in catalog_views.items()},
    )

    async def build():
        parts = []
        for (cat, sch), light, label, model, cert in zip(pairs, scanned, labels, models, certs):
            truncated = len(light) > MAX_SCAN_TABLES
            light = light[:MAX_SCAN_TABLES]
            rows = await asyncio.to_thread(_schema_tables_sync, cat, sch, light) if light else []
            tables = [r for r in rows if r["type"] != "METRIC_VIEW"]
            if not tables and certified_only:
                continue
            if not tables:
                raise HTTPException(status_code=404, detail=f"No tables found in {cat}.{sch}.")
            metric_views = [r for r in rows if r["type"] == "METRIC_VIEW"]
            links = infer_links(tables)
            if model:
                tables, links = apply_model(tables, links, model)
            own_views = {_area_name(r["name"]) for r in metric_views}
            layout = await asyncio.to_thread(layout_of, tables, links, model, own_views, catalog_views.get(cat, {}))
            parts.append({
                "catalog": cat, "schema": sch, "label": label, "truncated": truncated,
                "tables": tables, "links": links, "layout": layout,
                "metricViews": metric_views, "model": model_summary(model), "certified": cert,
            })
        host = ""
        try:
            host = _workspace_host(_client())
        except Exception:
            pass
        digest = await asyncio.to_thread(build_digest, parts, certified, host, [f"{c}.{s}" for c, s in pairs])
        digest["scope"] = scope
        digest["fingerprint"] = key
        return digest, True

    return await _digests.get_or_build(key, build)


# --------------------------------------------------------------------------------------
# fit
# --------------------------------------------------------------------------------------

def attach_question_tables(fit: Dict[str, Any], raw: Any, digest: Dict[str, Any]) -> Dict[str, Any]:
    """Add the per-question tables (ids checked) and a short how."""
    table_ids = {t["id"] for t in digest.get("tables") or []}
    by_index: Dict[int, Dict[str, Any]] = {}
    for q in (raw or {}).get("questions") or []:
        if not isinstance(q, dict):
            continue
        try:
            by_index[int(q.get("index"))] = q
        except (TypeError, ValueError):
            continue
    for q in fit.get("questions") or []:
        r = by_index.get(q["index"], {})
        q["tables"] = [t for t in dict.fromkeys(r.get("tables") or []) if t in table_ids][:3]
        q["how"] = _short(r.get("how"), 160)
    return fit


class SourceFitRequest(BaseModel):
    sources: List[str] = []
    context: str = ""
    questions: List[str] = []
    suggested: List[str] = []
    retry: bool = False
    certifiedOnly: bool = False


@router.get("/data-sources", summary="Approved Unity Catalog schemas for the Insights flow")
async def list_sources():
    approved = await asyncio.to_thread(_approved_sync)
    summaries = await asyncio.gather(*[_source_summary(s) for s in approved])
    return {"sources": list(summaries)}


@router.get("/data-sources/catalogs", summary="Catalogs the app can see, for the source picker")
async def list_catalogs():
    hit = _cache_get("ds-catalogs", LIST_TTL_S)
    if hit is None:
        try:
            hit = _cache_put("ds-catalogs", await asyncio.to_thread(_list_catalogs_sync))
        except Exception as e:
            raise HTTPException(status_code=403, detail=f"The app cannot list catalogs: {_short(str(e), 160)}")
    return {"catalogs": hit}


@router.get("/data-sources/schemas", summary="Schemas in one catalog, for the source picker")
async def list_schemas(catalog: str):
    if not _IDENT.match(catalog or ""):
        raise HTTPException(status_code=400, detail=f"Not a catalog name: {(catalog or '')[:80]}")
    key = f"ds-schemas:{catalog}"
    hit = _cache_get(key, LIST_TTL_S)
    if hit is None:
        try:
            hit = _cache_put(key, await asyncio.to_thread(_list_schemas_sync, catalog))
        except Exception as e:
            raise HTTPException(status_code=403, detail=f"The app cannot read catalog {catalog}: {_short(str(e), 160)}")
    return {"schemas": hit}


@router.get("/data-sources/check", summary="Can the app read a catalog.schema")
async def check_source(source: str):
    cat, sch = split_source(source)
    return await _source_summary({"catalog": cat, "schema": sch, "label": f"{cat}.{sch}", "note": ""})


@router.get("/data-sources/digest", summary="Explorer digest of one or more catalog.schema sources")
async def source_digest(sources: str, request: Request, certified: bool = False):
    return _gzip_json(request, await load_source_digest(sources, certified_only=certified), max_age=600)


@router.get("/data-sources/cache-stats", summary="Hit, miss and size counters for the Insights caches")
async def cache_stats():
    return insights_cache.stats()


async def _fit_args(body: SourceFitRequest) -> Tuple[Dict[str, Any], str, List[str], List[str]]:
    digest = await load_source_digest(",".join(body.sources), certified_only=body.certifiedOnly)
    if not digest.get("tables"):
        raise HTTPException(status_code=409, detail="No certified tables in these sources. Include uncertified tables to match on them.")
    context = _text(body.context, MAX_CONTEXT_CHARS)
    questions = [_text(q, 200) for q in body.questions if _text(q, 200)][:MAX_QUESTIONS]
    if not context and not questions:
        raise HTTPException(status_code=400, detail="Describe the use case or add a question.")
    area_names = {a["name"] for a in digest.get("areas") or []}
    suggested = sorted({s for s in body.suggested if s in area_names})
    return digest, context, questions, suggested


@router.post("/data-sources/fit", summary="Match an idea to the tables in approved sources (waits for the result)")
async def source_fit(body: SourceFitRequest):
    digest, context, questions, suggested = await _fit_args(body)
    return await table_matcher.match(digest, digest["fingerprint"], context, questions, suggested,
                                     note=SOURCE_FIT_NOTE, attach=attach_question_tables)


@router.post("/data-sources/fit/start", summary="Start matching an idea to approved sources; poll for the result")
async def source_fit_start(body: SourceFitRequest):
    digest, context, questions, suggested = await _fit_args(body)
    return await table_matcher.start_match(digest, digest["fingerprint"], context, questions, suggested,
                                           note=SOURCE_FIT_NOTE, attach=attach_question_tables, retry=body.retry)


@router.get("/data-sources/fit/{job}", summary="Progress of a match started with /data-sources/fit/start")
async def source_fit_poll(job: str):
    return table_matcher.poll_match(job)
