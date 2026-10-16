#!/usr/bin/env python3
"""
Generate / refresh the contract-baseline entries for the `*.genie-code.md` forks.

The forks are functionally tested; their load-bearing phrases (the ones
`scripts/genie_gate.py` greps for) must survive any readability refactor. This
script records, per fork, the EXACT-cased guarded phrases that are CURRENTLY
present plus the fork's default `{tokens}`, and merges them into
`_templates/contract_baseline.json` (preserving the existing default entries).

`lint_section_prompts.py --check-contract --strict` then asserts byte-equality of
those phrases on every edit — so a reflow that silently drops a guarded phrase is
caught at the file level, complementing genie_gate's repo-level discipline gates.

Run from apps_lakebase/prompts:
    python gen_fork_contract_baseline.py            # write/merge
    python gen_fork_contract_baseline.py --dry-run  # print the diff only
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SECTIONS = HERE / "sections"
BASELINE = HERE / "_templates" / "contract_baseline.json"

# Candidate guarded phrases, keyed by the family that owns them in
# scripts/genie_gate.py. All candidates are matched case-INSENSITIVELY for
# presence, then the EXACT-cased slice from the file is recorded as the verbatim
# substring (so the byte-equality check is exact). Only phrases actually present
# in a given fork are recorded, so the generated baseline always passes today and
# pins the phrase against future drift.
STATE_CANDIDATES = [
    "mandatory ritual, not advisory",
    "NOT complete until",
    "<dp_bundle_root>/.vibecoding-state.md",
    "<app_root>/.vibecoding-state.md",
    "<agent_app_root>/.vibecoding-state.md",
]
DEPLOY_CANDIDATES = [
    "body of the bundle job",
    "do not fall back to direct sql",
    "databricks.yml not found",
    "not sufficient",
    "bundle editor",
    "bundle-editor",
    "escape hatch",
    "fails the gate",
]
LAKEHOUSE_CANDIDATES = [
    "source_linked_deployment",
    "preflight acknowledgement",
    'readSkillFile("skills/vibe-coding-workshop/',
    "os.path.exists",
    "listFiles",
    "no-create invariant",
    "CREATE CATALOG",
    "saveAsTable",
    "validate_gold",
    "population_strategy",
    "just-in-time",
    "DESIGN_GAP_ANALYSIS.md",
    "upstream cross-reference",
    "DEFAULT` column clause",
    "column inventory",
    "DESCRIBE TABLE",
    "contract test",
]
HYBRID_CANDIDATES = [
    "serialized_space",
    "metric_views",
    "data-rooms",
    "extract-back",
    "extract back",
    "non-dev",
    "persisted",
    "reproducible",
    "drift",
    "orphan",
    "openAsset",
    "readAssetById",
    "benchmark",
]


def _tokens(text: str) -> list[str]:
    """Template variables `{like_this}` (excludes bundle `${vars}`)."""
    return sorted(set(re.findall(r"(?<![$\\])\{[A-Za-z0-9_]+\}", text or "")))


def _present_exact(text: str, candidate: str) -> str | None:
    """Return the exact-cased slice of `text` matching `candidate` (case-insensitive
    search), or None if absent. Records what is really in the file, byte-for-byte."""
    idx = text.lower().find(candidate.lower())
    if idx == -1:
        return None
    return text[idx : idx + len(candidate)]


def _gate_markup(text: str) -> str | None:
    m = re.search(r"\*\*Gate:\*\*\s*`[^`]+`", text or "")
    return m.group(0) if m else None


def build_entry(fork_text: str) -> dict:
    low = fork_text.lower()
    subs: list[str] = []

    def add_from(candidates: list[str]) -> None:
        for c in candidates:
            got = _present_exact(fork_text, c)
            if got and got not in subs:
                subs.append(got)

    # State-lock phrases (only state-bearing forks).
    if "state-lock:" in low:
        add_from(STATE_CANDIDATES)
    # Deploy / bundle phrases.
    if "bundle deploy" in low:
        add_from(DEPLOY_CANDIDATES)
    # Lakehouse + hybrid phrases (recorded whenever present — presence is the test).
    add_from(LAKEHOUSE_CANDIDATES)
    add_from(HYBRID_CANDIDATES)

    # The single Gate markup line — the gate name is downstream-referenced and must
    # never be paraphrased.
    gate = _gate_markup(fork_text)
    if gate:
        subs.append(gate)

    # placeholders = the fork's OWN current tokens. This guards the refactor against
    # dropping a token the fork relies on. Fork-vs-default token PARITY is owned by
    # scripts/genie_gate.py::check_fork_parity (the authority); the contract check
    # deliberately does not duplicate it, so a pre-existing parity gap is not baked in.
    return {
        "class": "fork",
        "verbatim_substrings": subs,
        "placeholders": _tokens(fork_text),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    import sys

    sys.path.insert(0, str(HERE))
    from sync_markdown_to_seed import parse_markdown

    forks: list[tuple[str, dict]] = []
    for p in sorted(SECTIONS.glob("*.md")):
        if p.name == "README.md":
            continue
        f = parse_markdown(p)
        if p.name.endswith(".genie-code.md") or (f.get("coding_assistant") not in (None, "", "__default__")):
            forks.append((p.name, f))

    baseline = json.loads(BASELINE.read_text()) if BASELINE.exists() else {}
    new_entries = {}
    for name, f in forks:
        fork_text = (f.get("input_template", "") or "") + "\n" + (f.get("system_prompt", "") or "")
        new_entries[name] = build_entry(fork_text)

    merged = dict(baseline)
    merged.update(new_entries)
    merged = {k: merged[k] for k in sorted(merged)}

    if args.dry_run:
        added = sorted(set(new_entries) - set(baseline))
        changed = [k for k in new_entries if k in baseline and baseline[k] != new_entries[k]]
        print(f"forks: {len(new_entries)} | added: {len(added)} | changed: {len(changed)}")
        for k in new_entries:
            e = new_entries[k]
            print(f"  {k}: {len(e['verbatim_substrings'])} substrings, "
                  f"{len(e['placeholders'])} placeholders")
        return 0

    BASELINE.write_text(json.dumps(merged, indent=2) + "\n")
    print(f"Wrote {len(merged)} entries ({len(new_entries)} forks) -> {BASELINE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
