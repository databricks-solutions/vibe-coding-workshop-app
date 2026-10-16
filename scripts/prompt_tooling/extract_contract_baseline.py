#!/usr/bin/env python3
"""
Extract contract tokens from in-scope section MDs into _templates/contract_baseline.json.

The baseline is the regression bar for the workshop-friendly Input Template rewrite:
every token captured here MUST appear verbatim in the rewritten file's `## Input Template`
body, or the lint --check-contract fails.

Run this BEFORE any rewrite. Re-running OVERWRITES the baseline; only do that when you
intentionally want to retire/update a contract (and you've confirmed downstream gate
consumers agree).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

SECTIONS_DIR = Path(__file__).parent / "sections"
OUT_PATH = Path(__file__).parent / "_templates" / "contract_baseline.json"

# In-scope files for the workshop-friendly Input Template plan.
CLASS_A_FILES = ["38-agent_spec_design.md", "39-agent_tool_selection.md"]
CLASS_B_FILES = [
    "40-uc_resources_foundation.md",
    "41-mlflow_agent_tracing_uc.md",
    "42-knowledge_assistant_create.md",
    "43-track_a_agent_app_clone_framework.md",
    "44-track_a_agent_ka_genie_tools.md",
    "45-track_a_agent_auth_memory.md",
    "46-track_a_agent_eval_deploy.md",
    "47-appkit_agent_app_proxy_chat.md",
    "48-appkit_chat_feedback_mlflow.md",
    "49-mlflow_prompt_registry.md",
    "50-mlflow_evaluation_datasets.md",
    "51-mlflow_scorers_and_judges.md",
    "52-mlflow_evaluation_runs_and_iteration.md",
    "53-mlflow_human_review_and_signoff.md",
    "54-mlflow_logged_model_uc_registration.md",
    "55-mlflow_gateway_and_deployment.md",
    "56-mlflow_production_monitoring_and_debugging.md",
]

PLACEHOLDER_RE = re.compile(r"\{[a-z][a-z0-9_]*\}")


def _input_template_body(text: str) -> str:
    """Slice between `## Input Template` and the next canonical H2."""
    m = re.search(
        r"^---\s*\n+## Input Template\s*\n(.*?)(?=^---\s*\n+## (?:How to Apply|Expected Output)\s*\n)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if not m:
        raise SystemExit("could not slice Input Template body")
    return m.group(1)


def _system_prompt_body(text: str) -> str:
    m = re.search(
        r"^---\s*\n+## System Prompt\s*\n(.*?)(?=^---\s*\n+## Input Template\s*\n)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    return m.group(1) if m else ""


def _extract_class_b(input_body: str) -> dict:
    """Class B: capture the **Invoke skills (in order):** block + the **Gate:** line."""
    m = re.search(
        r"(\*\*Invoke skills \(in order\):\*\*.*?)(?=^---\s*\n|\Z)",
        input_body,
        re.MULTILINE | re.DOTALL,
    )
    if not m:
        raise SystemExit("Class B: missing Invoke-skills block")
    invoke_block = m.group(1).rstrip()
    gate_match = re.search(r"^\*\*Gate:\*\*[^\n]+", invoke_block, re.MULTILINE)
    if not gate_match:
        raise SystemExit("Class B: missing Gate: line inside invoke block")
    return {
        "class": "B",
        "verbatim_substrings": [invoke_block],
        "placeholders": sorted(set(PLACEHOLDER_RE.findall(input_body))),
    }


def _extract_class_a(input_body: str, system_body: str) -> dict:
    """Class A: capture IMPORTANT-READ-FIRST + Save-it-to + OUTPUT FORMAT RULES.

    Two valid forms for the IMPORTANT-READ-FIRST block:
      1. Triple-backtick fenced (legacy): ```\n## IMPORTANT - READ FIRST ... ```
      2. Plain H2 (current): ## IMPORTANT - READ FIRST ... <until next H2 or Save-it-to>
    Same for the Save-it-to closing block.
    """
    verbatim = []

    # IMPORTANT - READ FIRST: try fenced first, then plain H2.
    m = re.search(r"```\n## IMPORTANT - READ FIRST.*?\n```", input_body, re.DOTALL)
    if m is None:
        m = re.search(
            r"## IMPORTANT - READ FIRST\n.*?(?=\n## (?!IMPORTANT)|\nSave it to:)",
            input_body,
            re.DOTALL,
        )
    if m is None:
        raise SystemExit("Class A: missing IMPORTANT-READ-FIRST block")
    verbatim.append(m.group(0).rstrip())

    # Closing "Save it to: ..." stanza: try fenced first, then plain.
    m = re.search(r"```\nSave it to:.*?\n```", input_body, re.DOTALL)
    if m is None:
        m = re.search(r"Save it to:.*?(?=\n---|\Z)", input_body, re.DOTALL)
    if m is None:
        raise SystemExit("Class A: missing Save-it-to closing block")
    verbatim.append(m.group(0).rstrip())

    # OUTPUT FORMAT RULES from System Prompt (lives there, not in Input Template)
    m = re.search(
        r"\*\*OUTPUT FORMAT RULES:\*\*\n(?:- [^\n]+\n)+",
        system_body,
    )
    if m:
        verbatim.append(m.group(0).rstrip())

    return {
        "class": "A",
        "verbatim_substrings": verbatim,
        "placeholders": sorted(set(PLACEHOLDER_RE.findall(input_body))),
    }


def main() -> int:
    out: dict[str, dict] = {}
    for name in CLASS_A_FILES + CLASS_B_FILES:
        path = SECTIONS_DIR / name
        text = path.read_text()
        try:
            input_body = _input_template_body(text)
        except SystemExit as e:
            raise SystemExit(f"{name}: {e}") from e
        if name in CLASS_A_FILES:
            entry = _extract_class_a(input_body, _system_prompt_body(text))
        else:
            entry = _extract_class_b(input_body)
        out[name] = entry

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(out)} entries to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
