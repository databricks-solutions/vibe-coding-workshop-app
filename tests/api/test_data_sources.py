"""Approved data sources: UC tables -> explorer digest, without a workspace."""
import pathlib
import sys

import pytest
from fastapi import HTTPException

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import data_sources as ds


def col(name, type_="STRING", comment=""):
    return {"name": name, "type": type_, "comment": comment}


def table(name, cols, comment="", pks=None, fks=None, type_="MANAGED", view=""):
    return {"name": name, "comment": comment, "type": type_, "viewDefinition": view, "columns": cols, "pks": pks or [], "fks": fks or []}


TABLES = [
    table("bookings", [col("booking_id", "BIGINT"), col("user_id", "BIGINT"), col("property_id", "BIGINT"),
                       col("check_in", "DATE"), col("total_amount", "DECIMAL(10,2)"), col("status")], "One row per booking."),
    table("properties", [col("property_id", "BIGINT"), col("host_id", "BIGINT"), col("city"), col("base_price", "DOUBLE")]),
    table("hosts", [col("host_id", "BIGINT"), col("name"), col("email")]),
    table("users", [col("user_id", "BIGINT"), col("name"), col("email"), col("country")]),
    table("countries", [col("code"), col("label")]),
]


def test_parse_sources_drops_bad_rows_and_duplicates():
    rows = ds.parse_sources('[{"catalog":"samples","schema":"wanderbricks"},{"catalog":"samples","schema":"wanderbricks"},'
                            '{"catalog":"bad name","schema":"x"},{"catalog":"main"}]')
    assert rows == [{"catalog": "samples", "schema": "wanderbricks", "label": "samples.wanderbricks", "note": ""}]
    assert ds.parse_sources("not json") == []


def test_split_source_rejects_non_identifiers():
    assert ds.split_source("samples.wanderbricks") == ("samples", "wanderbricks")
    for bad in ["samples", "a.b.c", "a;drop.b", ".b"]:
        with pytest.raises(HTTPException):
            ds.split_source(bad)


def test_infer_links_from_id_columns_and_declared_fks():
    links = ds.infer_links(TABLES)
    assert ("user_id", "users") in links["bookings"]
    assert ("property_id", "properties") in links["bookings"]
    assert links["properties"] == [("host_id", "hosts")]
    assert links["users"] == []

    declared = [table("orders", [col("cust", "BIGINT")], fks=[{"columns": ["cust"], "parent": "c.s.customers", "parentColumns": ["id"]}]),
                table("customers", [col("id", "BIGINT")])]
    assert ds.infer_links(declared)["orders"] == [("cust", "customers")]


def test_normalize_enrich_keeps_only_real_tables_and_columns():
    links = ds.infer_links(TABLES)
    raw = {
        "description": "Vacation rentals.",
        "areas": [
            {"name": "Bookings", "label": "Bookings", "tables": ["bookings", "ghost_table"]},
            {"name": "places", "label": "Places", "tables": ["properties", "hosts", "bookings"]},
        ],
        "kpis": [
            {"id": "booking_revenue", "table": "bookings", "measures": [
                {"name": "revenue", "agg": "sum", "column": "total_amount"},
                {"name": "bad", "agg": "sum", "column": "status"},
                {"name": "made_up", "agg": "sum", "column": "nope"},
                {"name": "bookings", "agg": "count", "column": "*"}],
             "slices": [{"name": "month", "column": "check_in", "kind": "time"}, {"name": "x", "column": "nope"}]},
            {"id": "ghost", "table": "ghost_table", "measures": [{"name": "m", "agg": "count", "column": "*"}]},
        ],
    }
    out = ds.normalize_enrich(raw, TABLES, links)
    by_area = {a["name"]: a["tables"] for a in out["areas"]}
    assert by_area["bookings"][0] == "bookings"
    assert "bookings" not in by_area["places"]
    assigned = sorted(t for ts in by_area.values() for t in ts)
    assert assigned == sorted(t["name"] for t in TABLES)
    [kpi] = out["kpis"]
    assert [m["expr"] for m in kpi["measures"]] == ["SUM(total_amount)", "COUNT(*)"]
    assert [s["column"] for s in kpi["slices"]] == ["check_in"]


def test_normalize_enrich_falls_back_to_join_groups():
    out = ds.normalize_enrich(None, TABLES, ds.infer_links(TABLES))
    assert out["kpis"] == []
    names = [a["name"] for a in out["areas"]]
    assert "other" in names
    assert sorted(t for a in out["areas"] for t in a["tables"]) == sorted(t["name"] for t in TABLES)


def test_build_digest_matches_explorer_shape():
    links = ds.infer_links(TABLES)
    enrich = ds.normalize_enrich({
        "areas": [{"name": "bookings", "tables": ["bookings", "users", "countries"]}, {"name": "places", "tables": ["properties", "hosts"]}],
        "kpis": [{"id": "booking_revenue", "table": "bookings", "label": "Booking revenue",
                  "measures": [{"name": "total_revenue", "label": "Total revenue", "agg": "sum", "column": "total_amount"}],
                  "slices": [{"name": "status", "label": "Status", "column": "status", "kind": "category"}]}],
    }, TABLES, links)
    mv = table("booking_metrics", [], type_="METRIC_VIEW", view="source: samples.wanderbricks.bookings\nmeasures:\n  - name: avg_amount\n    expr: AVG(total_amount)\ndimensions:\n  - name: status\n    expr: status\n")
    d = ds.build_digest([{"catalog": "samples", "schema": "wanderbricks", "label": "Wanderbricks", "tables": TABLES,
                          "links": links, "enrich": enrich, "metricViews": [mv]}], certified=True, host="https://h")
    ids = {t["id"] for t in d["tables"]}
    assert "bookings.bookings" in ids and "places.properties" in ids
    for t in d["tables"]:
        assert t["id"] == f"{t['area']}.{t['name']}"
        assert t["fqn"] == f"samples.wanderbricks.{t['name']}"
        for l in t["linksTo"]:
            assert l["to"] in ids
    assert {"a": "bookings", "b": "places", "n": 1} in d["links"]
    kpis = {k["id"]: k for k in d["kpis"]}
    assert kpis["booking_revenue"]["proposed"] is True and kpis["booking_revenue"]["table"] == "bookings.bookings"
    assert "proposed" not in kpis["booking_metrics"] and kpis["booking_metrics"]["area"] == "bookings"
    assert d["trust"]["certified"] is True and d["trust"]["sensitiveFields"] == 2
    assert d["stats"]["tables"] == 5 and d["stats"]["kpiSets"] == 2
    assert d["slug"] == "uc:samples.wanderbricks"
    assert any(s["kpi"] == "booking_revenue" for s in d["starterQuestions"])
    bk = next(t for t in d["tables"] if t["name"] == "bookings")
    keys = {c["n"]: c.get("k") for c in bk["columns"]}
    assert keys["booking_id"] == "pk" and keys["user_id"] == "fk"


def test_build_digest_keeps_area_names_unique_across_schemas():
    links = ds.infer_links(TABLES)
    enrich = ds.normalize_enrich({"areas": [{"name": "core", "tables": [t["name"] for t in TABLES]}]}, TABLES, links)
    part = {"tables": TABLES, "links": links, "enrich": enrich, "metricViews": []}
    d = ds.build_digest([{**part, "catalog": "a", "schema": "s1", "label": "A"}, {**part, "catalog": "b", "schema": "s2", "label": "B"}], certified=False)
    names = [a["name"] for a in d["areas"]]
    assert names == ["core", "s2_core"]
    assert len({t["id"] for t in d["tables"]}) == 10
    assert d["trust"]["certified"] is False
    assert {a["division"] for a in d["areas"]} == {"a.s1", "b.s2"}


class _Named:
    def __init__(self, name, comment=""):
        self.name, self.comment = name, comment


def test_named_hides_internal_entries_and_sorts():
    rows = ds._named([_Named("sales"), _Named("system"), _Named("__databricks_internal"), _Named("Main", "Core"), _Named("")],
                     ds._HIDDEN_CATALOGS)
    assert rows == [{"name": "Main", "comment": "Core"}, {"name": "sales", "comment": ""}]
    assert ds._named([_Named("information_schema"), _Named("bronze")], ds._HIDDEN_SCHEMAS) == [{"name": "bronze", "comment": ""}]


def test_list_schemas_rejects_bad_names_and_reports_access_errors(monkeypatch):
    import asyncio
    with pytest.raises(HTTPException) as bad:
        asyncio.run(ds.list_schemas("bad name"))
    assert bad.value.status_code == 400

    def deny(_catalog):
        raise PermissionError("no USE CATALOG")
    monkeypatch.setattr(ds, "_list_schemas_sync", deny)
    monkeypatch.setattr(ds, "_cache_get", lambda *_: None)
    with pytest.raises(HTTPException) as denied:
        asyncio.run(ds.list_schemas("locked"))
    assert denied.value.status_code == 403


def test_attach_question_tables_validates_ids():
    digest = {"tables": [{"id": "bookings.bookings"}]}
    fit = {"questions": [{"index": 0, "kpi": None}]}
    raw = {"questions": [{"index": 0, "tables": ["bookings.bookings", "made.up"], "how": "Sum amounts by month"}]}
    out = ds.attach_question_tables(fit, raw, digest)
    assert out["questions"][0]["tables"] == ["bookings.bookings"]
    assert out["questions"][0]["how"] == "Sum amounts by month"
