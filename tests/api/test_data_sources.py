"""Approved data sources: UC tables -> explorer digest, without a workspace."""
import asyncio
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


def table(name, cols, comment="", pks=None, fks=None, type_="MANAGED", view="", tags=None, updated=1):
    return {"name": name, "comment": comment, "type": type_, "viewDefinition": view, "columns": cols, "pks": pks or [], "fks": fks or [],
            "tags": tags or {}, "updatedAt": updated}


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


def tagged(domains):
    return [{**t, "tags": {"idm_domain": domains[t["name"]], "idm_subdomain": "stays"}} if t["name"] in domains else t for t in TABLES]


def test_areas_come_from_domain_tags_and_untagged_tables_follow_their_joins():
    tables = tagged({"bookings": "bookings", "users": "bookings", "properties": "places", "hosts": "places"})
    out = ds.assign_areas(tables, ds.infer_links(tables))
    assert out["by"] == "tags"
    by_area = {a["name"]: a["tables"] for a in out["areas"]}
    assert set(by_area["bookings"]) == {"bookings", "users"}
    assert set(by_area["places"]) == {"properties", "hosts"}
    assert by_area["other"] == ["countries"]
    assert next(a for a in out["areas"] if a["name"] == "places")["subdomains"] == ["Stays"]


def test_areas_fall_back_to_join_communities_named_after_their_hub():
    out = ds.assign_areas(TABLES, ds.infer_links(TABLES))
    assert out["by"] == "joins"
    assert sorted(t for a in out["areas"] for t in a["tables"]) == sorted(t["name"] for t in TABLES)
    assert all(a["description"] for a in out["areas"])


def test_join_communities_keep_clusters_apart_despite_a_shared_hub():
    # Two star schemas (3 facts over 4 dimensions each), and a calendar every fact joins to.
    tables, links = [table("calendar", [col("calendar_id", "BIGINT")])], {"calendar": []}
    for side in ("sales", "stock"):
        dims = [f"{side}_dim_{i}" for i in range(4)]
        for d in dims:
            tables.append(table(d, [col(f"{d}_id", "BIGINT")]))
            links[d] = []
        for i in range(3):
            fact = f"{side}_fact_{i}"
            tables.append(table(fact, [col("calendar_id", "BIGINT")]))
            links[fact] = [("calendar_id", "calendar")] + [(f"{d}_id", d) for d in dims]
    out = ds.assign_areas(tables, links)
    groups = [set(a["tables"]) for a in out["areas"]]
    for side in ("sales", "stock"):
        members = {t["name"] for t in tables if t["name"].startswith(side)}
        assert any(members <= g for g in groups)
    assert not any({"sales_fact_0", "stock_fact_0"} <= g for g in groups)


def test_proposed_kpis_use_real_numeric_time_and_category_columns():
    links = ds.infer_links(TABLES)
    layout = ds.layout_of(TABLES, links)
    kpis = {k["table"]: k for k in layout["kpis"]}
    bk = kpis["bookings"]
    exprs = [m["expr"] for m in bk["measures"]]
    assert exprs[0] == "COUNT(*)" and "SUM(total_amount)" in exprs
    assert not any("booking_id" in e or "user_id" in e for e in exprs)
    assert {s["column"] for s in bk["slices"]} == {"check_in", "status"}
    assert "hosts" not in kpis


def test_build_digest_matches_explorer_shape():
    links = ds.infer_links(TABLES)
    layout = {
        "description": "",
        "areas": [{"name": "bookings", "label": "Bookings", "tables": ["bookings", "users", "countries"]},
                  {"name": "places", "label": "Places", "tables": ["properties", "hosts"], "subdomains": ["Stays"]}],
        "kpis": [{"id": "booking_revenue", "table": "bookings", "label": "Booking revenue", "description": "",
                  "measures": [{"name": "total_revenue", "label": "Total revenue", "agg": "sum", "expr": "SUM(total_amount)", "comment": ""}],
                  "slices": [{"name": "status", "label": "Status", "column": "status", "kind": "category", "comment": ""}]}],
    }
    mv = table("booking_metrics", [], type_="METRIC_VIEW", view="source: samples.wanderbricks.bookings\nmeasures:\n  - name: avg_amount\n    expr: AVG(total_amount)\ndimensions:\n  - name: status\n    expr: status\n")
    d = ds.build_digest([{"catalog": "samples", "schema": "wanderbricks", "label": "Wanderbricks", "tables": TABLES,
                          "links": links, "layout": layout, "metricViews": [mv]}], certified=True, host="https://h")
    ids = {t["id"] for t in d["tables"]}
    assert "bookings.bookings" in ids and "places.properties" in ids
    assert next(a for a in d["areas"] if a["name"] == "places")["subdomains"] == ["Stays"]
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
    layout = {"areas": [{"name": "core", "label": "Core", "tables": [t["name"] for t in TABLES]}], "kpis": []}
    part = {"tables": TABLES, "links": links, "layout": layout, "metricViews": []}
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


def test_refresh_reads_only_changed_tables(monkeypatch):
    reads = {"full": 0, "get": [], "tags": []}

    def full(catalog, schema, columns=True):
        reads["full"] += 1
        return [dict(t) for t in TABLES]

    def get(catalog, schema, names):
        reads["get"].append(list(names))
        return [{**next(t for t in TABLES if t["name"] == n), "updatedAt": 2} for n in names]

    def tags(catalog, schema, names):
        reads["tags"].append(list(names))
        return {n: {} for n in names}

    monkeypatch.setattr(ds, "_list_tables_sync", full)
    monkeypatch.setattr(ds, "_get_tables_sync", get)
    monkeypatch.setattr(ds, "_tags_sync", tags)
    light = [{"name": t["name"], "type": t["type"], "updatedAt": 1, "comment": ""} for t in TABLES]
    first = ds._schema_tables_sync("c", "refresh_test", light)
    assert len(first) == 5 and reads["full"] == 1 and len(reads["tags"][0]) == 5

    same = ds._schema_tables_sync("c", "refresh_test", light)
    assert same == first and reads["full"] == 1 and reads["get"] == [] and len(reads["tags"]) == 1

    light[0] = {**light[0], "updatedAt": 2}
    after = ds._schema_tables_sync("c", "refresh_test", light)
    assert reads["full"] == 1 and reads["get"] == [["bookings"]] and reads["tags"][-1] == ["bookings"]
    assert after[0]["updatedAt"] == 2 and after[1:] == first[1:]


def test_tags_stop_after_an_untagged_sample(monkeypatch):
    asked = []

    class Tags:
        def list(self, entity_type, entity_name):
            asked.append(entity_name)
            return []

    class Client:
        entity_tag_assignments = Tags()

    monkeypatch.setattr(ds, "_client", lambda: Client())
    out = ds._tags_sync("c", "s", [f"t{i}" for i in range(200)])
    assert len(out) == 200 and len(asked) == ds.TAG_PROBE


def test_attach_question_tables_validates_ids():
    digest = {"tables": [{"id": "bookings.bookings"}]}
    fit = {"questions": [{"index": 0, "kpi": None}]}
    raw = {"questions": [{"index": 0, "tables": ["bookings.bookings", "made.up"], "how": "Sum amounts by month"}]}
    out = ds.attach_question_tables(fit, raw, digest)
    assert out["questions"][0]["tables"] == ["bookings.bookings"]
    assert out["questions"][0]["how"] == "Sum amounts by month"


def test_a_digest_slug_is_accepted_as_a_source_list():
    # The explorer hands its digest slug to the fit; it used to be rejected with a 400.
    assert ds._parse_source_list("uc:cat.airlines,cat.travel_hospitality") == [("cat", "airlines"), ("cat", "travel_hospitality")]
    assert ds._parse_source_list("cat.airlines") == [("cat", "airlines")]
    with pytest.raises(HTTPException):
        ds._parse_source_list("uc:")


def test_dbx_domain_tags_from_the_model_installer_drive_areas():
    tables = [{**t, "tags": {"dbx_domain": "stays", "dbx_subdomain": "booking"}} for t in TABLES]
    out = ds.assign_areas(tables, ds.infer_links(tables))
    assert out["by"] == "tags" and [a["name"] for a in out["areas"]] == ["stays"]
    assert out["areas"][0]["subdomains"] == ["Booking"]


# A small industry model in the gallery digest shape, and a flat copy of it as `CREATE TABLE ... AS SELECT` leaves it:
# same table and column names, no keys, no metric views.
def _mt(area, name, purpose, cols, links=()):
    return {"id": f"{area}.{name}", "name": name, "area": area, "purpose": purpose, "columns": [{"n": c} for c in cols],
            "linksTo": [{"to": to, "via": c, "reason": "", "column": c} for c, to in links]}


MODEL = {
    "slug": "airlines", "label": "Airlines", "version": "v1", "source": {"commitSha": "abc123"},
    "areas": [{"name": "flight", "label": "Flight", "description": "Flight legs, delays and schedules."},
              {"name": "airport", "label": "Airport", "description": "Gates and ground handling."},
              {"name": "crew", "label": "Crew", "description": "Pairings and rosters."}],
    "tables": [
        _mt("flight", "flight_leg", "One flight leg.", ["flight_leg_id", "gate_id", "scheduled_departure", "departure_delay_minutes", "status"],
            [("gate_id", "airport.gate")]),
        _mt("flight", "delay_record", "A delay on a leg.", ["delay_record_id", "flight_leg_id", "delay_code", "delay_minutes"],
            [("flight_leg_id", "flight.flight_leg")]),
        _mt("flight", "schedule", "Planned schedule.", ["schedule_id", "season"]),
        _mt("airport", "gate", "A gate.", ["gate_id", "terminal"]),
        _mt("airport", "turnaround", "A turnaround at a gate.", ["turnaround_id", "gate_leg", "turn_minutes"],
            [("gate_leg", "airport.gate")]),
        _mt("crew", "pairing", "A crew pairing.", ["pairing_id", "duty_hours"]),
    ],
    "kpis": [
        {"id": "flight_on_time", "area": "flight", "table": "flight.flight_leg", "label": "On time", "description": "",
         "measures": [{"name": "avg_departure_delay", "label": "Avg departure delay", "agg": "avg", "comment": "",
                       "expr": "AVG(departure_delay_minutes)"}],
         "slices": [{"name": "status", "label": "Status", "kind": "category", "comment": "", "column": "status"}],
         "sourceUrl": "https://github/metrics.sql"},
        {"id": "airport_turnaround", "area": "airport", "table": "airport.turnaround", "label": "Turnaround", "description": "",
         "measures": [{"name": "avg_turn", "label": "Avg turn", "agg": "avg", "comment": "", "expr": "AVG(turn_minutes)"}],
         "slices": [], "sourceUrl": ""},
    ],
}

COPY = [
    table("flight_leg", [col("flight_leg_id", "BIGINT"), col("gate_id", "BIGINT"), col("scheduled_departure", "TIMESTAMP"),
                         col("departure_delay_minutes", "INT"), col("status")], "One flight leg, copied."),
    table("delay_record", [col("delay_record_id", "BIGINT"), col("flight_leg_id", "BIGINT"), col("delay_code"),
                           col("delay_minutes", "INT"), col("recorded_at", "TIMESTAMP")]),
    table("schedule", [col("schedule_id", "BIGINT"), col("season")], "Planned schedule."),
    table("gate", [col("gate_id", "BIGINT"), col("terminal")], "A gate."),
    table("turnaround", [col("turnaround_id", "BIGINT"), col("gate_leg", "BIGINT"), col("turn_minutes", "INT"),
                         col("started_at", "TIMESTAMP")], "A turnaround."),
    table("pairing", [col("pairing_id", "BIGINT"), col("duty_hours", "DOUBLE")], "A pairing."),
]


def test_a_flat_copy_of_an_industry_model_is_recognised():
    m = ds.model_match(MODEL, [t["name"] for t in COPY])
    assert m and (m["slug"], m["matched"], m["total"]) == ("airlines", 6, 6)
    assert m["area_of"]["turnaround"] == "airport"
    assert ("gate_leg", "gate") in m["links"]["turnaround"]
    assert {k["table"] for k in m["kpis"]} == {"flight_leg", "turnaround"}
    # A schema that only shares a couple of names is not a copy.
    assert ds.model_match(MODEL, ["gate", "pairing", "a", "b", "c", "d", "e", "f"]) is None
    # One domain of the model on its own is a copy only inside the installer's own catalog layout.
    one_area = ["flight_leg", "delay_record", "schedule", "gate", "turnaround"]
    big = {**MODEL, "tables": MODEL["tables"] + [_mt("crew", f"t{i}", "", ["x"]) for i in range(20)]}
    assert ds.model_match(big, one_area) is None
    assert ds.model_match(big, one_area, whole_model=False) is not None


def test_a_copy_gets_back_the_joins_and_descriptions_it_lost():
    m = ds.model_match(MODEL, [t["name"] for t in COPY])
    tables, links = ds.apply_model(COPY, ds.infer_links(COPY), m)
    # gate_leg does not look like a key to a table called gate; only the model knows that join.
    assert ("gate_leg", "gate") not in ds.infer_links(COPY)["turnaround"]
    assert ("gate_leg", "gate") in links["turnaround"]
    assert links["delay_record"].count(("flight_leg_id", "flight_leg")) == 1
    assert next(t for t in tables if t["name"] == "delay_record")["comment"] == "A delay on a leg."
    assert next(t for t in tables if t["name"] == "flight_leg")["comment"] == "One flight leg, copied."


def test_a_copy_takes_the_models_areas_and_kpis():
    m = ds.model_match(MODEL, [t["name"] for t in COPY])
    tables, links = ds.apply_model(COPY, ds.infer_links(COPY), m)
    layout = ds.layout_of(tables, links, m, set(), {"flight_on_time": "https://ws/explore/data/cat/_metrics/flight_on_time"})
    assert layout["areasBy"] == "model"
    areas = {a["name"]: a for a in layout["areas"]}
    assert set(areas["flight"]["tables"]) == {"flight_leg", "delay_record", "schedule"}
    assert areas["airport"]["description"] == "Gates and ground handling."
    kpis = {k["id"]: k for k in layout["kpis"]}
    # Live where the metric view exists in the catalog, proposed (with its definition) where it does not.
    assert kpis["flight_on_time"]["proposed"] is False and kpis["flight_on_time"]["sourceUrl"].endswith("/flight_on_time")
    assert kpis["airport_turnaround"]["proposed"] is True and kpis["airport_turnaround"]["model"] == "airlines"
    assert kpis["airport_turnaround"]["measures"][0]["expr"] == "AVG(turn_minutes)"
    # Tables the model has no KPI for still get a guessed one.
    assert any(k["table"] == "delay_record" and not k.get("model") for k in layout["kpis"])
    assert "copy of the Airlines industry data model (6 of 6 tables)" in layout["description"]

    d = ds.build_digest([{"catalog": "cat", "schema": "airlines", "label": "Airlines copy", "tables": tables, "links": links,
                          "layout": layout, "metricViews": [], "model": ds.model_summary(m)}], certified=True)
    dk = {k["id"]: k for k in d["kpis"]}
    assert dk["flight_on_time"]["proposed"] is False and dk["airport_turnaround"]["table"] == "airport.turnaround"
    assert d["models"] == [{"source": "cat.airlines", "slug": "airlines", "label": "Airlines", "version": "v1", "matched": 6, "total": 6}]
    assert d["starterQuestions"][0]["kpi"] in ("flight_on_time", "airport_turnaround")


def test_recognise_model_uses_the_schema_name_and_is_best_effort(monkeypatch):
    from src.backend.api import blueprints

    async def manifest():
        return {"industries": [{"slug": "airlines"}, {"slug": "retail"}]}, "sha", True

    async def digest(slug, flavour="mvm"):
        assert slug == "airlines"
        return MODEL

    monkeypatch.setattr(blueprints, "_manifest", manifest)
    monkeypatch.setattr(blueprints, "load_digest", digest)
    names = [t["name"] for t in COPY]
    assert asyncio.run(ds.recognise_model("cat", "airlines", names))["slug"] == "airlines"
    assert asyncio.run(ds.recognise_model("idm_airlines_mvm", "flight", names))["slug"] == "airlines"
    assert asyncio.run(ds.recognise_model("cat", "sales", names)) is None

    async def offline():
        raise RuntimeError("no network")

    monkeypatch.setattr(blueprints, "_manifest", offline)
    assert asyncio.run(ds.recognise_model("cat", "airlines", names)) is None


def test_duplicate_area_names_across_schemas_are_labelled_with_their_schema():
    links = ds.infer_links(TABLES)
    layout = {"areas": [{"name": "loyalty", "label": "Loyalty", "tables": [t["name"] for t in TABLES]}], "kpis": []}
    part = {"tables": TABLES, "links": links, "layout": layout, "metricViews": []}
    d = ds.build_digest([{**part, "catalog": "c", "schema": "airlines", "label": "A"},
                         {**part, "catalog": "c", "schema": "travel_hospitality", "label": "T"}], certified=False)
    assert [a["label"] for a in d["areas"]] == ["Loyalty (airlines)", "Loyalty (travel_hospitality)"]


class _Tag:
    def __init__(self, key, value):
        self.tag_key, self.tag_value = key, value


def test_certified_sync_reads_only_the_system_certification_tag(monkeypatch):
    tags = {
        "c.s.good": [_Tag("idm_domain", "fleet"), _Tag("system.certification_status", "certified")],
        "c.s.loud": [_Tag("system.certification_status", " Certified ")],
        "c.s.old": [_Tag("system.certification_status", "deprecated")],
        "c.s.other": [_Tag("certified", "certified")],
    }

    class Tags:
        def list(self, entity_type, entity_name):
            if entity_name == "c.s.broken":
                raise PermissionError("no access")
            return tags.get(entity_name, [])

    class Client:
        entity_tag_assignments = Tags()

    monkeypatch.setattr(ds, "_client", lambda: Client())
    assert ds._certified_sync("c", "s", ["good", "loud", "old", "other", "broken", "none"]) == ["good", "loud"]


def _wire_digest(monkeypatch, schemas, certified):
    """Fake UC reads: schemas {schema: [table names]}, certified {schema: set}."""
    by_name = {t["name"]: t for t in TABLES}

    async def light(cat, sch):
        return [{"name": n, "type": "MANAGED", "updatedAt": 1, "comment": ""} for n in schemas[sch]]

    async def certs(cat, sch, rows):
        return set(certified.get(sch, set()))

    async def no_model(*_):
        return None

    monkeypatch.setattr(ds, "_light_listing", light)
    monkeypatch.setattr(ds, "certified_tables", certs)
    monkeypatch.setattr(ds, "recognise_model", no_model)
    monkeypatch.setattr(ds, "_approved_sync", lambda: [])
    monkeypatch.setattr(ds, "_schema_tables_sync", lambda c, s, rows: [dict(by_name[r["name"]]) for r in rows])
    monkeypatch.setattr(ds, "_workspace_host", lambda _w: "")
    monkeypatch.setattr(ds, "_client", lambda: None)


def test_certified_only_scans_just_the_certified_tables(monkeypatch):
    names = [t["name"] for t in TABLES]
    _wire_digest(monkeypatch, {"cert_a": names}, {"cert_a": {"bookings", "properties", "users"}})
    every = asyncio.run(ds.load_source_digest("certcat.cert_a"))
    only = asyncio.run(ds.load_source_digest("certcat.cert_a", certified_only=True))
    assert len(every["tables"]) == 5 and len(only["tables"]) == 3
    assert {t["name"] for t in only["tables"]} == {"bookings", "properties", "users"}
    assert all(t["certified"] for t in only["tables"])
    assert {t["name"] for t in every["tables"] if not t["certified"]} == {"hosts", "countries"}
    assert only["scope"] == {"certifiedOnly": True, "scanned": 3, "certified": 3, "total": 5,
                             "perSource": [{"id": "certcat.cert_a", "certified": 3, "total": 5}]}
    assert every["scope"]["certifiedOnly"] is False and every["scope"]["scanned"] == 5
    assert only["fingerprint"] != every["fingerprint"]


def test_a_schema_with_nothing_certified_is_left_out_not_failed(monkeypatch):
    names = [t["name"] for t in TABLES]
    _wire_digest(monkeypatch, {"cert_b": names, "cert_c": names}, {"cert_b": {"bookings", "users"}})
    d = asyncio.run(ds.load_source_digest("certcat.cert_b,certcat.cert_c", certified_only=True))
    assert d["slug"] == "uc:certcat.cert_b,certcat.cert_c" and d["sources"] == ["certcat.cert_b", "certcat.cert_c"]
    assert {t["fqn"] for t in d["tables"]} == {"certcat.cert_b.bookings", "certcat.cert_b.users"}
    assert d["scope"]["perSource"][1] == {"id": "certcat.cert_c", "certified": 0, "total": 5}

    empty = asyncio.run(ds.load_source_digest("certcat.cert_c", certified_only=True))
    assert empty["tables"] == [] and empty["slug"] == "uc:certcat.cert_c" and empty["scope"]["scanned"] == 0

    with pytest.raises(HTTPException) as no_match:
        asyncio.run(ds._fit_args(ds.SourceFitRequest(sources=["certcat.cert_c"], context="delays", certifiedOnly=True)))
    assert no_match.value.status_code == 409


def test_source_summaries_count_certified_tables(monkeypatch):
    async def light(cat, sch):
        return [{"name": n, "type": "MANAGED", "updatedAt": 1, "comment": ""} for n in ("a", "b", "c")] + [
            {"name": "mv", "type": "METRIC_VIEW", "updatedAt": 1, "comment": ""}]

    async def certs(cat, sch, rows):
        return {"a", "c", "mv"}

    monkeypatch.setattr(ds, "_light_listing", light)
    monkeypatch.setattr(ds, "certified_tables", certs)
    monkeypatch.setattr(ds, "_cache_get", lambda *_: None)
    monkeypatch.setattr(ds, "_cache_put", lambda _k, v: v)
    out = asyncio.run(ds._source_summary({"catalog": "c", "schema": "summ", "label": "S", "note": ""}))
    assert out["tableCount"] == 3 and out["certifiedCount"] == 2
    assert [t["certified"] for t in out["tables"]] == [True, False, True]
