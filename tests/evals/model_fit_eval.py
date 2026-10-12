"""
Model fit eval: runs golden use cases through the live /blueprints/pick and
/blueprints/{slug}/fit and scores whether the model and areas chosen are the
ones an analyst would choose.

Not part of the unit suite: it calls the real serving endpoint and reads the
public data-model gallery, so it needs Databricks credentials (profile or
DATABRICKS_HOST) and network access.

    python3 -m tests.evals.model_fit_eval                 # every case, 1 run each
    python3 -m tests.evals.model_fit_eval --runs 3        # also scores run-to-run agreement
    python3 -m tests.evals.model_fit_eval --case ground_ops --out /tmp/fit.json

Per case: the pick is one of the expected models; every expected area is chosen
(recall); chosen areas are expected or acceptable (precision); known gaps are
named. Exit code is 1 when the pass rate is under --min-pass.
"""

import argparse
import asyncio
import json
import os
import sys
from typing import Any, Dict, List

os.environ.setdefault("USE_LAKEBASE", "false")

from src.backend.api import blueprints  # noqa: E402
from src.backend.api.blueprint_fit import FitRequest, PickRequest, blueprint_fit, blueprint_pick  # noqa: E402

GOLDEN: List[Dict[str, Any]] = [
    {
        "id": "ground_ops",
        "slug": "airlines",
        "context": (
            "Ground Ops Resource Planning Tool. Airline ground operations at hub stations: plan gate agents, ramp crews, "
            "baggage loaders and ground equipment (GPUs, tugs, belt loaders) for each departure bank. Forecast staffing "
            "from the flight schedule, passenger loads and turn times; spot shift gaps before they cause delays and "
            "misconnects; reduce overtime. Personas: station manager, ground ops planner, crew scheduler."
        ),
        "questions": [
            "Which stations had the most overtime hours last month?",
            "How many gate agents do we need per departure bank tomorrow?",
            "Which flights were delayed because of ground handling?",
            "What is the on-time departure rate by station?",
        ],
        "expect": ["airport", "flight"],
        "acceptable": ["crew", "fleet", "maintenance", "passenger", "finance", "route", "reservation", "inventory"],
        "gaps": ["equipment", "gse", "ground staff", "ground support", "roster"],
    },
    {
        "id": "retail_stockouts",
        "slug": "retail",
        "picks": ["retail", "grocery"],
        "context": (
            "Store stockout early warning for a grocery and general merchandise retailer. Store managers and replenishment "
            "planners want to see which SKUs will run out in the next 3 days at each store, why (late supplier deliveries, "
            "promotions, forecast misses) and what to reorder."
        ),
        "questions": [
            "Which SKUs are most likely to stock out this week by store?",
            "Which suppliers deliver late most often?",
            "How much revenue did we lose to out of stocks last month?",
        ],
        "expect": ["inventory", "product", "supplier"],
        "acceptable": ["store", "order", "promotion", "supplychain", "fulfillment", "merchandising", "pricing"],
        "gaps": [],
    },
    {
        "id": "readmissions",
        "slug": "healthcare",
        "context": (
            "Reduce 30-day readmissions at a hospital network. Care managers want to see which discharged patients are "
            "at high risk of coming back, by diagnosis, attending provider and discharge disposition, so they can schedule "
            "follow-up calls and visits."
        ),
        "questions": [
            "What is our 30-day readmission rate by diagnosis?",
            "Which providers have the highest readmission rates?",
            "How many discharged patients had no follow-up appointment within 7 days?",
        ],
        "expect": ["encounter", "patient"],
        "acceptable": ["provider", "clinical", "scheduling", "pharmacy", "claim", "reference", "laboratory", "order", "billing"],
        "gaps": [],
    },
    {
        "id": "card_fraud",
        "slug": "banking",
        "picks": ["banking", "payments_fintech"],
        "context": (
            "Card fraud monitoring for a retail bank. The fraud operations team wants to spot unusual card transactions, "
            "see which merchants and channels have the most confirmed fraud, and how quickly alerts are worked."
        ),
        "questions": [
            "How much confirmed fraud did we have last month by channel?",
            "Which merchants have the highest fraud rate?",
            "What share of fraud alerts are false positives?",
        ],
        "expect": ["fraud", "payment"],
        "acceptable": ["account", "customer", "channel", "risk", "compliance", "reference"],
        "gaps": [],
    },
]


def _clear_llm_cache() -> None:
    for k in [k for k in blueprints._CACHE if k.startswith(("fit:", "pick:"))]:
        blueprints._CACHE.pop(k, None)


async def run_case(case: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {"id": case["id"]}
    try:
        pick = await blueprint_pick(PickRequest(context=case["context"]))
        out["pick"] = pick["slug"]
    except Exception as e:  # noqa: BLE001
        out["pick"] = f"error: {e}"
    try:
        fit = await blueprint_fit(case["slug"], FitRequest(context=case["context"], questions=case["questions"]))
    except Exception as e:  # noqa: BLE001
        out["error"] = str(getattr(e, "detail", e))
        return out
    areas = [a["name"] for a in fit["areas"]]
    allowed = set(case["expect"]) | set(case["acceptable"])
    gap_text = " ".join(n["gap"].lower() + " " + n["need"].lower() for n in fit["needs"] if n["gap"])
    out.update({
        "areas": areas,
        "core": [a["name"] for a in fit["areas"] if a["role"] == "core"],
        "fit": fit["fit"],
        "gaps": [n["need"] for n in fit["needs"] if n["gap"]],
        "pick_ok": out["pick"] in case.get("picks", [case["slug"]]),
        "recall": sum(a in areas for a in case["expect"]) / len(case["expect"]),
        "precision": sum(a in allowed for a in areas) / len(areas) if areas else 0.0,
        "gap_ok": (not case["gaps"]) or any(g in gap_text for g in case["gaps"]),
    })
    out["pass"] = out["pick_ok"] and out["recall"] == 1 and out["precision"] >= 0.75 and out["gap_ok"]
    return out


def agreement(runs: List[List[str]]) -> float:
    sets = [set(r) for r in runs if r]
    if len(sets) < 2:
        return 1.0
    pairs = [(a, b) for i, a in enumerate(sets) for b in sets[i + 1:]]
    return sum(len(a & b) / len(a | b) for a, b in pairs) / len(pairs)


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--case")
    ap.add_argument("--out")
    ap.add_argument("--min-pass", type=float, default=0.75)
    args = ap.parse_args()

    cases = [c for c in GOLDEN if not args.case or c["id"] == args.case]
    results = []
    for case in cases:
        runs = []
        for _ in range(args.runs):
            _clear_llm_cache()
            runs.append(await run_case(case))
        r = runs[0]
        r["agreement"] = round(agreement([x.get("areas", []) for x in runs]), 2)
        r["pass"] = all(x.get("pass") for x in runs)
        r["runs"] = [{k: x.get(k) for k in ("pick", "areas", "pass", "error")} for x in runs]
        results.append(r)
        flag = "PASS" if r["pass"] else "FAIL"
        print(f"{flag} {case['id']:<17} pick={r.get('pick')} areas={r.get('areas')} fit={r.get('fit')} "
              f"recall={r.get('recall')} precision={round(r.get('precision', 0), 2)} gap_ok={r.get('gap_ok')} "
              f"agreement={r['agreement']}" + (f" error={r['error']}" if r.get("error") else ""))
        for i, x in enumerate(runs[1:], 2):
            if not x.get("pass"):
                print(f"     run {i} failed: pick={x.get('pick')} areas={x.get('areas')} error={x.get('error')}")
        if r.get("gaps"):
            print(f"     gaps: {r['gaps']}")

    rate = sum(r["pass"] for r in results) / len(results) if results else 0
    print(f"\n{sum(r['pass'] for r in results)}/{len(results)} passed")
    if args.out:
        with open(args.out, "w") as f:
            json.dump(results, f, indent=2)
    return 0 if rate >= args.min_pass else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
