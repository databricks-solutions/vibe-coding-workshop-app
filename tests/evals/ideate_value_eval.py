"""
Ideate value eval: runs a golden set of ideas through the live Impact step and
scores whether the business case it proposes is sized like a finance partner
would size it.

Not part of the unit suite: it calls the real serving endpoint, so it needs the
same Databricks credentials as the app (DATABRICKS_HOST / profile, and
IDEATE_ANALYSIS_ENDPOINT if you want to test the analysis model).

    python3 -m tests.evals.ideate_value_eval               # every case, 1 run each
    python3 -m tests.evals.ideate_value_eval --runs 3      # also scores run-to-run spread
    python3 -m tests.evals.ideate_value_eval --case airline_delays --out /tmp/eval.json

Value is computed the way the browser does (businessCase.ts): best-guess
answers, pilot inputs, times full / pilot rollout, soft dollars at the capture
rate. Exit code is 1 when the pass rate is under --min-pass.
"""

import argparse
import asyncio
import json
import os
import statistics
import sys
from typing import Any, Dict, List, Optional

os.environ.setdefault("USE_LAKEBASE", "false")

from src.backend.api.ideate import IdeateStepRequest, ideate_step  # noqa: E402

FALLBACK = {
    "baseline_minutes": 30, "target_minutes": 10, "events_per_day": 5, "headcount": 1,
    "people_per_event": 1, "days_per_year": 250, "hourly_rate": 60,
    "events_per_year": 50, "reduction_pct": 20, "cost_per_event": 5000,
    "volume_per_year": 10000, "uplift_pct": 2, "value_per_unit": 100,
}
HARD = {"cost_avoided", "revenue_uplift"}
DEFAULT_CAPTURE = 0.5


def _idea(title: str, statement: str, industry: str, answers: List[Dict[str, str]], shape: str) -> Dict[str, Any]:
    return {
        "mode": "ideate",
        "rawIdea": statement,
        "industry": industry,
        "confirmedIntent": {"title": title, "statement": statement, "industry": industry},
        "answers": answers,
        "chosenApproach": {"title": shape, "kind": "insight"},
    }


GOLDEN: List[Dict[str, Any]] = [
    {
        "id": "airline_delays",
        "idea": _idea(
            "Predict crew timeout risk", "Flag flights likely to lose their crew to duty-time limits hours ahead so ops can swap crews before a delay.",
            "Travel & Hospitality",
            [{"dimension": "scope", "question": "Where would this start?", "answer": "One hub, about 300 departures a day"},
             {"dimension": "cost", "question": "What does a miss cost?", "answer": "A crew timeout usually means a 2+ hour delay or a cancellation"}],
            "Crew risk dashboard with hourly refresh",
        ),
        "drivers": {"cost_avoided"},
        "value_band": (1_000_000, 50_000_000),
        "expect_rollout": True,
        "min_hard_share": 0.6,
    },
    {
        "id": "retail_stockouts",
        "idea": _idea(
            "Shelf gap alerts", "Alert store managers to likely stockouts on top sellers before the shelf empties.",
            "Retail",
            [{"dimension": "scope", "question": "Where would this start?", "answer": "10 pilot stores out of 400"}],
            "Store-level alerting on sales and inventory",
        ),
        "drivers": {"revenue_uplift", "cost_avoided"},
        "value_band": (500_000, 40_000_000),
        "expect_rollout": True,
        "min_hard_share": 0.6,
    },
    {
        "id": "plant_downtime",
        "idea": _idea(
            "Predictive maintenance on packaging lines", "Spot failing motors on packaging lines from sensor data before they stop the line.",
            "Manufacturing",
            [{"dimension": "scope", "question": "Where would this start?", "answer": "Two lines in one plant; we have 6 plants"}],
            "Anomaly scores on sensor data with maintenance work orders",
        ),
        "drivers": {"cost_avoided"},
        "value_band": (500_000, 30_000_000),
        "expect_rollout": True,
        "min_hard_share": 0.6,
    },
    {
        "id": "finance_close",
        "idea": _idea(
            "Faster month-end reconciliations", "Auto-match intercompany transactions so the finance team closes the books faster.",
            "Financial Services",
            [{"dimension": "scope", "question": "Who does this today?", "answer": "A team of 12 accountants, 3 days every month"}],
            "Matching pipeline with an exceptions queue",
        ),
        "drivers": {"time_saved", "cost_avoided"},
        "value_band": (50_000, 5_000_000),
        "expect_rollout": False,
        "min_hard_share": 0.0,
    },
    {
        "id": "claims_fraud",
        "idea": _idea(
            "Flag suspicious claims at intake", "Score new insurance claims for fraud risk so investigators look at the right ones first.",
            "Financial Services",
            [{"dimension": "scope", "question": "How many claims?", "answer": "About 40,000 claims a year in the pilot region"}],
            "Risk score on claims with an investigator worklist",
        ),
        "drivers": {"cost_avoided"},
        "value_band": (500_000, 50_000_000),
        "expect_rollout": True,
        "min_hard_share": 0.6,
    },
    {
        "id": "clinic_no_shows",
        "idea": _idea(
            "Reduce appointment no-shows", "Predict patients likely to miss appointments and send targeted reminders or overbook slots.",
            "Healthcare",
            [{"dimension": "scope", "question": "Where would this start?", "answer": "Three outpatient clinics out of 25"}],
            "No-show risk list for schedulers",
        ),
        "drivers": {"revenue_uplift", "cost_avoided"},
        "value_band": (250_000, 30_000_000),
        "expect_rollout": True,
        "min_hard_share": 0.5,
    },
]


def _lever_value(driver: str, values: Dict[str, float]) -> float:
    v = {**FALLBACK, **values}
    if driver == "time_saved":
        return max(0.0, v["baseline_minutes"] - v["target_minutes"]) / 60 * v["events_per_day"] * v["headcount"] * v["people_per_event"] * v["days_per_year"] * v["hourly_rate"]
    if driver == "cost_avoided":
        return v["events_per_year"] * v["reduction_pct"] / 100 * v["cost_per_event"]
    return v["volume_per_year"] * v["uplift_pct"] / 100 * v["value_per_unit"]


def figures(impact: Dict[str, Any]) -> Dict[str, float]:
    """Full-rollout annual value from best guesses, split hard and soft."""
    primary = {a["key"]: a["value"] for a in impact.get("assumed", [])}
    for q in impact.get("questions", []):
        primary.setdefault(q["key"], q["estimate"]["value"])
    rollout = impact.get("rollout")
    multiplier = 1.0
    if rollout:
        full = primary.get("rollout_units", rollout["full"])
        multiplier = max(1.0, full / max(1.0, rollout["pilot"]))
    capture = impact.get("captureRate") or DEFAULT_CAPTURE
    hard = soft = 0.0
    levers = [(impact["driver"], primary)] + [(s["driver"], {i["key"]: i["value"] for i in s["inputs"]}) for s in impact.get("secondary", [])]
    for driver, values in levers:
        value = _lever_value(driver, values) * multiplier
        if driver in HARD:
            hard += value
        else:
            soft += value * capture
    return {"hard": hard, "soft": soft, "total": hard + soft}


def score(case: Dict[str, Any], impact: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not impact:
        return {"parsed": False, "checks": {"parsed": False}, "total": 0.0}
    f = figures(impact)
    low, high = case["value_band"]
    asked = [q for q in impact["questions"] if q["key"] != "rollout_units"]
    drivers = [impact["driver"]] + [s["driver"] for s in impact.get("secondary", [])]
    hard_share = f["hard"] / f["total"] if f["total"] else 0.0
    checks = {
        "parsed": True,
        "driver": impact["driver"] in case["drivers"],
        "value_in_band": low <= f["total"] <= high,
        "questions_2_to_4": 2 <= len(asked) <= 4,
        "rollout": (impact.get("rollout") is not None) or not case["expect_rollout"],
        "rollout_question": (not impact.get("rollout")) or any(q["key"] == "rollout_units" for q in impact["questions"]),
        "no_double_count": len(drivers) == len(set(drivers)),
        "hard_share": hard_share >= case["min_hard_share"],
        "capture_rate": ("time_saved" not in drivers) or impact.get("captureRate") is not None,
    }
    return {"parsed": True, "checks": checks, "total": f["total"], "hard": f["hard"], "soft": f["soft"], "driver": impact["driver"]}


async def run_case(case: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    res = await ideate_step(IdeateStepRequest(step="impact", idea=case["idea"]))
    if isinstance(res, dict):
        return res.get("data")
    return None


def _money(n: float) -> str:
    return f"${n / 1e6:.1f}M" if n >= 1e6 else f"${n / 1e3:.0f}k"


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--case", action="append", help="Only run these case ids")
    ap.add_argument("--out", help="Write the full results as JSON")
    ap.add_argument("--min-pass", type=float, default=0.8, help="Required share of checks passed")
    args = ap.parse_args()

    cases = [c for c in GOLDEN if not args.case or c["id"] in args.case]
    results, passed, total = [], 0, 0
    print(f"{'case':<20} {'run':>3}  {'driver':<15} {'value':>9} {'hard':>9}  failed checks")
    for case in cases:
        runs = []
        for i in range(args.runs):
            s = score(case, await run_case(case))
            runs.append(s)
            failed = [k for k, ok in s["checks"].items() if not ok]
            passed += sum(s["checks"].values())
            total += len(s["checks"])
            print(f"{case['id']:<20} {i + 1:>3}  {s.get('driver', '-'):<15} {_money(s['total']):>9} {_money(s.get('hard', 0)):>9}  {', '.join(failed) or 'none'}")
        values = [r["total"] for r in runs if r["parsed"] and r["total"] > 0]
        spread = (max(values) / min(values)) if len(values) > 1 else None
        if spread:
            print(f"{'':<20} spread {spread:.1f}x between runs" + ("  (unstable)" if spread > 3 else ""))
        results.append({"id": case["id"], "runs": runs, "spread": spread})

    rate = passed / total if total else 0.0
    print(f"\nPassed {passed} of {total} checks ({rate:.0%}). Target {args.min_pass:.0%}.")
    if args.out:
        with open(args.out, "w") as fh:
            json.dump({"passRate": rate, "results": results}, fh, indent=2)
    return 0 if rate >= args.min_pass else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
