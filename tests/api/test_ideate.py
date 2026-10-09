"""
API tests for Ideate's structured steps and the submit-to-catalog endpoint.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_ideate -v

The LLM and Lakebase accessors are monkeypatched on `src.backend.api.ideate`,
so no Databricks connectivity is needed.
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

from src.backend.api import ideate  # noqa: E402


IMPACT = {
    "driver": "time_saved",
    "driver_label": "Faster swap decisions per event",
    "scope": "Crew schedulers at one hub",
    "questions": [
        {"key": "baseline_minutes", "question": "How long today?", "unit": "minutes",
         "options": [{"label": "15 to 30 minutes", "value": 22.5}, {"label": "30 to 45 minutes", "value": 37.5}],
         "estimate": {"label": "About 37 minutes", "value": 37.5}, "why": "Typical IROP swap"},
        {"key": "target_minutes", "question": "How long after?", "unit": "minutes",
         "options": [{"label": "Under 5", "value": 3}, {"label": "About 10", "value": 10}]},
        {"key": "bogus_key", "question": "Ignored?", "unit": "minutes",
         "options": [{"label": "a", "value": 1}, {"label": "b", "value": 2}]},
        {"key": "events_per_day", "question": "How often?", "unit": "furlongs",
         "options": [{"label": "A few", "value": 3}, {"label": "Bad", "value": "x"}, {"label": "Many", "value": 10}]},
    ],
    "assumed": [
        {"key": "hourly_rate", "label": "Loaded hourly rate", "value": 45, "unit": "$/hour"},
        {"key": "baseline_minutes", "label": "dup of an asked key", "value": 1},
    ],
    "cost": {"data_gb_per_day": 0.5, "refresh": "frequent", "transforms": "medium", "users": 10, "hours_per_day": 99},
}


class TestNormalize(unittest.TestCase):
    def test_impact_keeps_valid_questions_and_clamps_cost(self):
        out = ideate._normalize("impact", IMPACT)
        self.assertEqual(out["driver"], "time_saved")
        self.assertEqual([q["key"] for q in out["questions"]], ["baseline_minutes", "target_minutes", "events_per_day"])
        events = out["questions"][2]
        self.assertEqual(events["unit"], "units")
        self.assertEqual([o["value"] for o in events["options"]], [3.0, 10.0])
        self.assertEqual(out["questions"][1]["estimate"]["value"], 10.0)
        self.assertEqual([a["key"] for a in out["assumed"]], ["hourly_rate"])
        self.assertEqual(out["cost"]["hoursPerDay"], 24)
        self.assertEqual(out["cost"]["refresh"], "frequent")

    def test_impact_rejects_unknown_driver_or_too_few_questions(self):
        self.assertIsNone(ideate._normalize("impact", {**IMPACT, "driver": "vibes"}))
        self.assertIsNone(ideate._normalize("impact", {**IMPACT, "questions": IMPACT["questions"][:1]}))

    def test_summary_maps_to_camel_case(self):
        out = ideate._normalize("summary", {
            "subtitle": "s", "what_we_build": "w", "problem_today": "p",
            "metric": {"label": "Time to swap", "today": "30 to 45 minutes", "target": "within minutes"},
            "workflow_steps": ["a", "b", "c", "d", "e"],
            "stack": {"data": "Sample data", "serve": ""},
            "risks": [{"risk": "r", "guard": "g"}, "junk"],
            "next_steps": ["1", "2", "3"], "decision": "d",
        })
        self.assertEqual(out["problemToday"], "p")
        self.assertEqual(len(out["workflowSteps"]), 4)
        self.assertEqual(out["stack"]["serve"], "Not needed")
        self.assertEqual(out["risks"], [{"risk": "r", "guard": "g"}])
        self.assertIsNone(ideate._normalize("summary", {"subtitle": "only"}))

    def test_spark_is_specific_and_drops_duplicate_alternatives(self):
        out = ideate._normalize("spark", {
            "title": "t", "statement": "s", "industry": "Airlines",
            "industry_alternatives": ["airlines", "Airports"], "catalog_industry": "travel",
        })
        self.assertEqual(out["industryAlternatives"], ["Airports"])
        self.assertEqual(out["catalogIndustry"], "travel")


class _Req:
    headers: dict = {}


class TestSubmit(unittest.TestCase):
    def setUp(self):
        self.inserts = []
        self.rows = {"label": [{"industry_label": "Travel & Hospitality"}], "taken": [{"use_case": "crew_timeout_risk"}], "version": [{"v": 0}]}
        self._orig = {n: getattr(ideate, n) for n in (
            "is_lakebase_configured", "execute_query", "execute_insert", "get_schema",
            "_invalidate_cache", "_get_session_user", "call_databricks_serving_endpoint")}

        def query(sql, params=None):
            s = " ".join(sql.split()).lower()
            if s.startswith("select industry_label"):
                return self.rows["label"]
            if "distinct use_case" in s:
                return self.rows["taken"]
            if "max(version)" in s:
                return self.rows["version"]
            return []

        async def llm(**kwargs):
            return {"response": "## Business Context\nGenerated."}

        ideate.is_lakebase_configured = lambda: True
        ideate.execute_query = query
        ideate.execute_insert = lambda sql, params=None: self.inserts.append((sql, params)) or True
        ideate.get_schema = lambda: "s"
        ideate._invalidate_cache = lambda: None
        ideate._get_session_user = lambda request: "me@example.com"
        ideate.call_databricks_serving_endpoint = llm

    def tearDown(self):
        for n, f in self._orig.items():
            setattr(ideate, n, f)

    def _submit(self, **kw):
        body = ideate.IdeateSubmitRequest(industry_label="Travel & Hospitality", use_case_label="Crew Timeout Risk", **kw)
        return asyncio.run(ideate.ideate_submit(body, _Req()))

    def test_inserts_inactive_with_unique_key(self):
        out = self._submit(industry="travel", category="Operations")
        self.assertEqual(out["useCase"], "crew_timeout_risk_2")
        self.assertEqual(out["version"], 1)
        sql, params = self.inserts[0]
        self.assertIn("FALSE", sql)
        self.assertIn("category", sql)
        self.assertEqual(params[0], "travel")
        self.assertEqual(params[4], "## Business Context\nGenerated.")

    def test_resubmit_reuses_key_and_bumps_version(self):
        self.rows["version"] = [{"v": 1}]
        out = self._submit(industry="travel", use_case="crew_timeout_risk")
        self.assertEqual(out["useCase"], "crew_timeout_risk")
        self.assertEqual(out["version"], 2)

    def test_new_industry_gets_a_key_from_its_label(self):
        self.rows["label"] = []
        self.rows["taken"] = []
        body = ideate.IdeateSubmitRequest(industry_label="Airlines", use_case_label="Crew Timeout Risk")
        out = asyncio.run(ideate.ideate_submit(body, _Req()))
        self.assertEqual(out["industry"], "airlines")
        self.assertEqual(out["industryLabel"], "Airlines")

    def test_falls_back_to_legacy_columns(self):
        calls = []
        ideate.execute_insert = lambda sql, params=None: calls.append(sql) or len(calls) > 1
        self._submit(industry="travel")
        self.assertEqual(len(calls), 2)
        self.assertNotIn("category", calls[1])


if __name__ == "__main__":
    unittest.main()
