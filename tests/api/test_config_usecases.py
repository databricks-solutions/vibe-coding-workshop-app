"""
API tests for the use-case / industry configuration placeholder handling.

Covers the fix for the "create a new industry (category) then add use cases"
chicken-and-egg bug:

  * Read paths (get_industries / get_use_cases_map) must EXCLUDE the
    `_placeholder` rows that represent a brand-new empty industry, so a
    half-created industry never leaks into the end-user workshop.
  * Write paths (add_industry / add_use_case) must create the placeholder on
    industry creation and a real row on use-case creation.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_config_usecases -v

These tests monkeypatch the module-level data accessors on
`src.backend.api.routes`, so no Databricks / Lakebase connectivity is needed.
"""

import asyncio
import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes  # noqa: E402


def _rows(*specs):
    """Build minimal lakebase-style rows from (industry, use_case, **extra)."""
    out = []
    for industry, use_case, extra in specs:
        row = {
            "industry": industry,
            "industry_label": industry.title(),
            "use_case": use_case,
            "use_case_label": "(No use cases yet)" if use_case == "_placeholder" else use_case.title(),
            "prompt_template": "" if use_case == "_placeholder" else "spec text",
            "version": 1,
            "is_certified": False,
        }
        row.update(extra or {})
        out.append(row)
    return out


class TestReadPathPlaceholderExclusion(unittest.TestCase):
    """get_industries / get_use_cases_map must hide `_placeholder` rows."""

    def setUp(self):
        self._orig = routes.get_usecase_descriptions_from_lakebase

    def tearDown(self):
        routes.get_usecase_descriptions_from_lakebase = self._orig

    def _patch(self, rows):
        routes.get_usecase_descriptions_from_lakebase = lambda: rows

    def test_industry_with_only_placeholder_is_hidden(self):
        self._patch(_rows(
            ("travel", "real_uc", None),
            ("airline", "_placeholder", None),
        ))
        values = [i["value"] for i in routes.get_industries()]
        self.assertIn("travel", values)
        self.assertNotIn("airline", values)

    def test_industry_with_real_usecase_is_shown(self):
        self._patch(_rows(
            ("airline", "_placeholder", None),
            ("airline", "loyalty", None),
        ))
        values = [i["value"] for i in routes.get_industries()]
        self.assertIn("airline", values)

    def test_use_cases_map_excludes_placeholder(self):
        self._patch(_rows(
            ("airline", "_placeholder", None),
            ("airline", "loyalty", None),
        ))
        uc_map = routes.get_use_cases_map()
        use_case_values = [u["value"] for u in uc_map.get("airline", [])]
        self.assertIn("loyalty", use_case_values)
        self.assertNotIn("_placeholder", use_case_values)

    def test_use_cases_map_still_passes_category_fields(self):
        self._patch(_rows(
            ("travel", "disruption", {
                "category": "Agentic AI Operations",
                "category_order": 1,
                "display_order": 1,
            }),
        ))
        uc_map = routes.get_use_cases_map()
        entry = next(u for u in uc_map["travel"] if u["value"] == "disruption")
        self.assertEqual(entry["category"], "Agentic AI Operations")
        self.assertEqual(entry["category_order"], 1)


class _FakeDB:
    """Minimal in-memory stand-in for execute_query / execute_insert.

    Understands just enough SQL shape to drive add_industry / add_use_case /
    create_prompt_config without a real Postgres.
    """

    def __init__(self):
        self.rows = []
        self.inserts = []

    def query(self, sql, params=None):
        s = " ".join(sql.lower().split())
        params = params or ()
        if "select 1 from" in s and "where industry = %s" in s:
            ind = params[0]
            return [{"exists": 1}] if any(r["industry"] == ind for r in self.rows) else []
        if "coalesce(max(version)" in s:
            ind, uc = params[0], params[1]
            versions = [r["version"] for r in self.rows if r["industry"] == ind and r["use_case"] == uc]
            return [{"max_version": max(versions) if versions else 0}]
        if "select is_certified from" in s:
            ind, uc = params[0], params[1]
            matches = [r for r in self.rows if r["industry"] == ind and r["use_case"] == uc]
            return [{"is_certified": matches[-1]["is_certified"]}] if matches else []
        if "select industry_label from" in s:
            ind = params[0]
            matches = [r for r in self.rows if r["industry"] == ind]
            return [{"industry_label": matches[0]["industry_label"]}] if matches else []
        return []

    def insert(self, sql, params=None):
        s = " ".join(sql.lower().split())
        params = params or ()
        self.inserts.append((s, params))
        if s.startswith("insert into") and "usecase_descriptions" in s:
            # Column order per create_prompt_config INSERT.
            self.rows.append({
                "industry": params[0],
                "industry_label": params[1],
                "use_case": params[2],
                "use_case_label": params[3],
                "prompt_template": params[4],
                "version": params[5],
                "is_certified": params[7] if len(params) > 7 else False,
            })
        return True


class TestWritePathPlaceholder(unittest.TestCase):
    """add_industry creates a placeholder; add_use_case creates a real row."""

    def setUp(self):
        self.db = _FakeDB()
        self._orig_q = routes.execute_query
        self._orig_i = routes.execute_insert
        routes.execute_query = self.db.query
        routes.execute_insert = self.db.insert

    def tearDown(self):
        routes.execute_query = self._orig_q
        routes.execute_insert = self._orig_i

    def test_add_industry_creates_placeholder_row(self):
        result = asyncio.run(routes.add_industry(
            routes.IndustryCreate(industry="airline", industry_label="Airline")
        ))
        self.assertTrue(result["success"])
        placeholders = [r for r in self.db.rows if r["use_case"] == "_placeholder"]
        self.assertEqual(len(placeholders), 1)
        self.assertEqual(placeholders[0]["industry"], "airline")

    def test_add_use_case_creates_real_row(self):
        asyncio.run(routes.add_industry(
            routes.IndustryCreate(industry="airline", industry_label="Airline")
        ))
        asyncio.run(routes.add_use_case(
            routes.UseCaseCreate(
                industry="airline",
                use_case="loyalty",
                use_case_label="Loyalty Program",
                prompt_template="Design a loyalty program.",
            )
        ))
        real = [r for r in self.db.rows if r["use_case"] == "loyalty"]
        self.assertEqual(len(real), 1)
        self.assertEqual(real[0]["industry"], "airline")

    def test_add_duplicate_industry_rejected(self):
        asyncio.run(routes.add_industry(
            routes.IndustryCreate(industry="airline", industry_label="Airline")
        ))
        with self.assertRaises(routes.HTTPException) as ctx:
            asyncio.run(routes.add_industry(
                routes.IndustryCreate(industry="airline", industry_label="Airline")
            ))
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
