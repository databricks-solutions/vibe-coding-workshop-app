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

    def test_impact_keeps_distinct_secondary_levers_rollout_and_capture(self):
        out = ideate._normalize("impact", {
            **IMPACT,
            "questions": IMPACT["questions"] + [
                {"key": "rollout_units", "question": "How many hubs?", "unit": "units",
                 "options": [{"label": "5", "value": 5}, {"label": "10", "value": 10}]},
            ],
            "assumed": [{"key": "hourly_rate", "label": "Rate", "value": 45, "unit": "$/hour", "from_answer": True}],
            "secondary": [
                {"driver": "time_saved", "label": "same as primary", "inputs": [{"key": "headcount", "value": 3}]},
                {"driver": "cost_avoided", "label": "Fewer delays", "inputs": [
                    {"key": "events_per_year", "value": 300, "unit": "events"},
                    {"key": "events_per_year", "value": 1},
                    {"key": "bogus", "value": 1},
                ]},
                {"driver": "cost_avoided", "label": "duplicate driver", "inputs": [{"key": "cost_per_event", "value": 1}]},
                {"driver": "revenue_uplift", "label": "no numbers", "inputs": [{"key": "uplift_pct", "value": "x"}]},
            ],
            "rollout": {"unit": "hubs", "pilot": 0, "full": 99999, "why": "network"},
            "capture_rate": 3,
        })
        self.assertEqual(out["questions"][-1]["key"], "rollout_units")
        self.assertTrue(out["assumed"][0]["fromAnswer"])
        self.assertEqual([s["driver"] for s in out["secondary"]], ["cost_avoided"])
        self.assertEqual([i["key"] for i in out["secondary"][0]["inputs"]], ["events_per_year"])
        self.assertEqual(out["rollout"], {"unit": "hubs", "pilot": 1.0, "full": 10000.0, "why": "network"})
        self.assertEqual(out["captureRate"], 1.0)

    def test_impact_drops_rollout_question_without_rollout_and_needs_two_real_questions(self):
        rollout_q = {"key": "rollout_units", "question": "How many?", "unit": "units",
                     "options": [{"label": "5", "value": 5}, {"label": "10", "value": 10}]}
        out = ideate._normalize("impact", {**IMPACT, "questions": IMPACT["questions"] + [rollout_q]})
        self.assertNotIn("rollout_units", [q["key"] for q in out["questions"]])
        self.assertIsNone(out["rollout"])
        self.assertIsNone(out["captureRate"])
        only_one = {**IMPACT, "questions": IMPACT["questions"][:1] + [rollout_q], "rollout": {"unit": "hubs"}}
        self.assertIsNone(ideate._normalize("impact", only_one))

    def test_clarify_and_followup_carry_why_recommended_and_multi(self):
        out = ideate._normalize("clarify", {"questions": [
            {"dimension": "user", "question": "Who?", "why": "Names the persona", "options": ["a", "b", "c"], "recommended": 1, "multi": True, "max_picks": 9},
            {"dimension": "trigger", "question": "Why now?", "options": ["a", "b", "c"], "multi": True},
            {"dimension": "scope", "question": "Not do?", "options": ["a", "b", "c", "d"], "recommended": 7, "multi": False, "max_picks": 99},
            {"dimension": "cost", "question": "Cost?", "options": ["a", "b"], "recommended": True, "multi": True, "max_picks": 2},
        ]})
        user, trigger, scope, cost = out["questions"]
        self.assertEqual((user["why"], user["recommended"], user["multi"], user["maxPicks"]), ("Names the persona", 1, True, 2))
        self.assertEqual((trigger["multi"], trigger["maxPicks"]), (True, 2))
        self.assertEqual((scope["recommended"], scope["multi"], scope["maxPicks"]), (-1, True, 3))
        self.assertEqual(cost["recommended"], -1)
        self.assertFalse(cost["multi"])
        self.assertNotIn("maxPicks", cost)
        f = ideate._normalize("followup", {"followup": {"question": "Scale?", "options": ["a", "b"], "recommended": 0, "multi": True, "max_picks": 2}})["followup"]
        self.assertEqual((f["dimension"], f["recommended"], f["multi"], f["isFollowup"]), ("business", 0, False, True))
        self.assertNotIn("maxPicks", f)

    def test_shape_keeps_one_recommendation_and_valid_value_fields(self):
        out = ideate._normalize("shape", {"options": [
            {"kind": "copilot", "title": "A", "value_lever": "cost_avoided", "value_size": "$$$", "hard_share": "Mostly Hard",
             "recommended": True, "recommended_why": "Biggest hard dollars"},
            {"kind": "automation", "title": "B", "value_lever": "vibes", "value_size": "lots", "recommended": True, "recommended_why": "x"},
        ]})
        a, b = out["options"]
        self.assertEqual((a["valueLever"], a["valueSize"], a["hardShare"], a["recommended"]), ("cost_avoided", "$$$", "mostly hard", True))
        self.assertEqual((b["valueLever"], b["valueSize"], b["recommended"], b["recommendedWhy"]), (None, None, False, ""))

    def test_shape_enforces_genie_bundle_per_kind(self):
        out = ideate._normalize("shape", {"options": [
            {"kind": "copilot", "title": "A", "surfaces": ["Databricks App"], "ask_examples": ["Which gates are short?", "", "Why?", "x?", "y?"]},
            {"kind": "automation", "title": "B", "surfaces": ["Agent", "Lakebase"], "genie_placement": "nowhere"},
            {"kind": "insight", "title": "C", "surfaces": ["AI/BI Dashboard"], "no_genie_why": "Read-only wallboard", "ask_examples": ["Q?"]},
        ]})
        a, b, c = out["options"]
        self.assertEqual((a["surfaces"], a["geniePlacement"]), (["App", "Genie", "Dashboard"], "in_app"))
        self.assertEqual(a["askExamples"], ["Which gates are short?", "Why?", "x?"])
        self.assertNotIn("noGenieWhy", a)
        self.assertEqual((b["surfaces"], b["geniePlacement"]), (["App", "Agent", "Genie", "Dashboard", "Lakebase"], "in_app"))
        self.assertEqual((c["surfaces"], c["geniePlacement"], c["askExamples"], c["noGenieWhy"]),
                         (["Dashboard"], "genie_space", [], "Read-only wallboard"))
        insights = ideate._normalize("shape", {"options": [{"kind": "ask", "title": "D", "surfaces": ["Genie"]}]}, {"mode": "insights"})
        self.assertEqual(insights["options"][0]["surfaces"], ["Genie", "Dashboard"])

    def test_summary_and_spark_value_fields(self):
        out = ideate._normalize("summary", {
            "subtitle": "s", "what_we_build": "w", "problem_today": "p", "metric": {"label": "m"},
            "pilot_success": "Down 15% in 8 weeks", "kill_criterion": "No change", "unlocks_next": ["a", "b", "c"],
        })
        self.assertEqual((out["pilotSuccess"], out["killCriterion"], out["unlocksNext"]), ("Down 15% in 8 weeks", "No change", ["a", "b"]))
        spark = ideate._normalize("spark", {"title": "t", "statement": "s", "industry": "Airlines", "business_line": "Cost", "value_hypothesis": "v"})
        self.assertEqual((spark["businessLine"], spark["valueHypothesis"]), ("cost", "v"))
        self.assertIsNone(ideate._normalize("spark", {"title": "t", "statement": "s", "industry": "x", "business_line": "fun"})["businessLine"])


class TestInsightsMode(unittest.TestCase):
    def test_insights_prompts_limit_surfaces_and_use_insight_shapes(self):
        prompt = ideate.build_step_system_prompt("shape", "insights")
        self.assertIn('"ask"', prompt)
        self.assertIn('"signal"', prompt)
        self.assertNotIn('"Agent"', prompt)
        self.assertIn('"copilot"', ideate.build_step_system_prompt("shape"))

    def test_insights_brief_has_question_and_data_sections(self):
        prompt = ideate.brief_prompt_for("insights")
        self.assertIn("## Questions It Will Answer", prompt)
        self.assertIn("## Data It Needs", prompt)
        self.assertNotIn("## Test Scenarios", prompt)
        self.assertIn("## Test Scenarios", ideate.brief_prompt_for("ideate"))

    def test_shape_kinds_follow_mode(self):
        data = {"options": [{"kind": "copilot", "title": "A"}, {"kind": "Monitor", "title": "B"}]}
        kinds = [o["kind"] for o in ideate._normalize("shape", data, {"mode": "insights"})["options"]]
        self.assertEqual(kinds, ["ask", "monitor"])
        kinds = [o["kind"] for o in ideate._normalize("shape", data)["options"]]
        self.assertEqual(kinds, ["copilot", "copilot"])

    def test_questions_keep_provided_first_and_dedupe(self):
        out = ideate._normalize("questions", {"questions": [
            "Which stores missed target last week?",
            "1. which stores missed target last week",
            "- What drove returns this month",
            "30-day churn by region?",
            "A?", "B?", "C?",
        ]}, {"providedQuestions": ["Which stores missed target last week?"]})
        self.assertEqual(out["questions"][:3], [
            "Which stores missed target last week?",
            "What drove returns this month?",
            "30-day churn by region?",
        ])
        self.assertEqual(len(out["questions"]), ideate.MAX_GENIE_QUESTIONS)

    def test_questions_alternates_are_distinct_from_the_main_set(self):
        out = ideate._normalize("questions", {
            "questions": ["Which stores missed target?", "What drove returns?"],
            "alternates": ["which stores missed target", "Shrink by region?", "Top late suppliers?", "A?", "B?", "C?"],
        }, {})
        self.assertEqual(out["questions"], ["Which stores missed target?", "What drove returns?"])
        self.assertEqual(out["alternates"][:2], ["Shrink by region?", "Top late suppliers?"])
        self.assertEqual(len(out["alternates"]), ideate.MAX_GENIE_ALTERNATES)

    def test_insights_business_case_describes_a_genie_build(self):
        prompt = ideate.build_step_system_prompt("summary", "insights")
        self.assertIn("Genie space", prompt)
        self.assertNotIn("Declarative Pipelines", prompt)
        self.assertIn("Declarative Pipelines", ideate.build_step_system_prompt("summary"))

    def test_questions_step_is_known(self):
        self.assertIn("questions", ideate.STEP_PROMPTS)
        self.assertIsNone(ideate._normalize("questions", {"questions": []}, {}))


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

    def test_tags_submission_source_for_review_queue(self):
        self._submit(industry="travel")
        sql, _ = self.inserts[0]
        self.assertIn("source", sql)
        self.assertIn("'ideate'", sql)

    def test_falls_back_without_source_column(self):
        calls = []
        ideate.execute_insert = lambda sql, params=None: calls.append(sql) or len(calls) > 1
        self._submit(industry="travel")
        self.assertEqual(len(calls), 2)
        self.assertNotIn("source", calls[1])
        self.assertIn("category", calls[1])

    def test_falls_back_to_legacy_columns(self):
        calls = []
        ideate.execute_insert = lambda sql, params=None: calls.append(sql) or len(calls) > 2
        self._submit(industry="travel")
        self.assertEqual(len(calls), 3)
        self.assertNotIn("category", calls[2])


if __name__ == "__main__":
    unittest.main()
