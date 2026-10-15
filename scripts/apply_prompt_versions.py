#!/usr/bin/env python3
"""Append prompt rows to a running app through its config API (never a reseed).

Reads rows (default: scripts/insights_prompts/rows.json), compares each with the app's
latest active row for the same (section_tag, coding_assistant), and posts only rows that
differ to POST /api/config/section-inputs, which appends a new version. Default rows are
posted before forks because a fork needs an active Default row.

    python scripts/apply_prompt_versions.py                  # dry run (default)
    python scripts/apply_prompt_versions.py --apply          # post the changes
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROWS = ROOT / "scripts" / "insights_prompts" / "rows.json"
DEFAULT_KEY = "__default__"
COMPARED = ("input_template", "system_prompt", "bypass_llm", "section_title",
            "section_description", "order_number", "how_to_apply", "expected_output")


def _cli(*args: str) -> str:
    return subprocess.run(["databricks", *args], check=True, capture_output=True, text=True).stdout


def app_url(app: str, profile: str) -> str:
    url = json.loads(_cli("apps", "get", app, "--profile", profile, "--output", "json")).get("url")
    if not url:
        raise SystemExit(f"app {app} has no url")
    return url.rstrip("/")


def token(profile: str) -> str:
    return json.loads(_cli("auth", "token", "--profile", profile))["access_token"]


def call(method: str, url: str, tok: str, body: Dict[str, Any] | None = None) -> Any:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {url} -> {e.code}: {e.read()[:500]!r}")


def live_rows(base: str, tok: str, assistant: str) -> Dict[str, Dict[str, Any]]:
    rows = call("GET", f"{base}/api/config/section-inputs/latest?coding_assistant={assistant}", tok)
    return {r["section_tag"]: r for r in rows if (r.get("coding_assistant") or DEFAULT_KEY) == assistant}


def differs(row: Dict[str, Any], live: Dict[str, Any] | None) -> List[str]:
    if not live:
        return ["new"]
    return [k for k in COMPARED if k in row and (live.get(k) or "") != (row[k] or "")
            and not (k == "bypass_llm" and bool(live.get(k)) == bool(row[k]))]


def plan(rows: List[Dict[str, Any]], base: str, tok: str) -> List[Tuple[Dict[str, Any], List[str]]]:
    cache: Dict[str, Dict[str, Dict[str, Any]]] = {}
    todo = []
    for row in sorted(rows, key=lambda r: r["coding_assistant"] != DEFAULT_KEY):
        assistant = row["coding_assistant"]
        if assistant not in cache:
            cache[assistant] = live_rows(base, tok, assistant)
        changed = differs(row, cache[assistant].get(row["section_tag"]))
        if changed:
            todo.append((row, changed))
    return todo


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=Path, default=DEFAULT_ROWS)
    ap.add_argument("--app", default="donotdelete-vibe-coding-app")
    ap.add_argument("--profile", default="e2-demo-field-eng")
    ap.add_argument("--apply", action="store_true", help="post the changes (default is a dry run)")
    args = ap.parse_args()

    rows = json.loads(args.rows.read_text())
    base, tok = app_url(args.app, args.profile), token(args.profile)
    todo = plan(rows, base, tok)
    print(f"{base}: {len(rows)} rows, {len(todo)} to post{'' if args.apply else ' (dry run)'}")
    for row, changed in todo:
        print(f"  {row['section_tag']:<24} {row['coding_assistant']:<12} {', '.join(changed)}")
    if not args.apply or not todo:
        return 0
    for row, _ in todo:
        body = {k: v for k, v in row.items() if v is not None}
        body["coding_assistant"] = row["coding_assistant"]
        res = call("POST", f"{base}/api/config/section-inputs", tok, body)
        print(f"  posted {row['section_tag']} {row['coding_assistant']} -> v{res.get('version')}")
    left = plan(rows, base, tok)
    if left:
        print(f"still different after apply: {[(r['section_tag'], r['coding_assistant']) for r, _ in left]}")
        return 1
    print("all rows live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
