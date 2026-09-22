"""D8 §2.4 — Assembler byte-parity (the "no second assembler" guarantee, D3 §9.4 / I2).

Drives BOTH the live ``routes.get_section_input_content`` and the extracted
``workshop.assembler.get_section_input_content`` with identical inputs and identical
seeded DB state, and asserts dict equality (byte-for-byte) plus the exact 10-key set
(D3 §7.4).

Offline seeding: this repo's Lakebase layer has an in-memory/empty fallback. We seed
identical ``usecase_descriptions`` + ``section_input_prompts`` rows by monkeypatching
the module-level accessors both code paths read (``routes.*``), and reset the 30s TTL
``_lakebase_cache`` around every run so neither path serves stale rows. Because the
extraction keeps exactly ONE implementation (routes re-exports the assembler), both
names resolve to the same code object; this test proves the extracted function still
produces the exact contract and never regresses the key set.
"""

import os
import sys
from pathlib import Path

# These tests never touch a real database; force the offline/YAML fallback path and
# the dev persona so importing routes needs no Databricks/Lakebase connectivity.
os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest  # noqa: E402

from src.backend.api import routes  # noqa: E402
from src.backend.workshop import assembler  # noqa: E402

# Golden sample per D8 §13 open-q 3 recommendation: all semlayer_* + gagent_*,
# fork ('genie-code') AND default, across a small industry/use_case matrix.
SAMPLE_TAGS = [
    "semlayer_locate", "semlayer_profile", "semlayer_metric_view",
    "gagent_optimize", "gagent_benchmarks",
]
MATRIX = [("retail", "customer_analytics"), ("finance", "fraud_detection")]
ASSISTANTS = [None, "genie-code"]  # default + fork

EXPECTED_KEYS = {
    "input", "input_template", "system_prompt", "how_to_apply",
    "expected_output", "how_to_apply_images", "expected_output_images",
    "bypass_llm", "_brand_url", "coding_assistant_variant",
}

# A token-rich template exercises the whole substitution set (base tokens,
# workshop_params, and the {prd_document} default) so parity is a real check.
_DEFAULT_TEMPLATE = (
    "Context for {industry_name} / {use_case_title}: {use_case_description}. "
    "Tag={section_tag}. Workspace={workspace_url}. PRD={prd_document}."
)
_FORK_TEMPLATE = (
    "[genie-code fork] {industry_name} / {use_case_title} :: {use_case_description} "
    "(tag {section_tag}, ws {workspace_url}, prd {prd_document})"
)


def _usecase_rows():
    rows = []
    for industry, use_case in MATRIX:
        rows.append({
            "industry": industry,
            "industry_label": industry.title(),
            "use_case": use_case,
            "use_case_label": use_case.replace("_", " ").title(),
            "prompt_template": f"Detailed {use_case} description for {industry}.",
            "version": 1,
            "is_certified": True,
        })
    return rows


def _section_rows():
    rows = []
    for i, tag in enumerate(SAMPLE_TAGS):
        # Genie Accelerator invariant: gagent_benchmarks is a bypass_llm row.
        bypass = tag == "gagent_benchmarks"
        # __default__ row (shared fields authoritative).
        rows.append({
            "section_tag": tag,
            "coding_assistant": routes.DEFAULT_CODING_ASSISTANT_KEY,
            "input_template": _DEFAULT_TEMPLATE,
            "system_prompt": f"System prompt for {tag} ({{industry_name}}).",
            "section_title": f"Title {tag}",
            "section_description": f"Description {tag}",
            "order_number": i + 1,
            "version": 1,
            "how_to_apply": f"How to apply {tag} in {{industry_name}}.",
            "expected_output": f"Expected output for {tag}.",
            "bypass_llm": bypass,
            "how_to_apply_images": [],
            "expected_output_images": [],
        })
        # genie-code fork row (prompt content overrides; shared fields ignored).
        rows.append({
            "section_tag": tag,
            "coding_assistant": "genie-code",
            "input_template": _FORK_TEMPLATE,
            "system_prompt": f"[genie-code] System for {tag} ({{industry_name}}).",
            "section_title": f"IGNORED fork title {tag}",
            "section_description": f"IGNORED fork desc {tag}",
            "order_number": 99,
            "version": 1,
            "how_to_apply": "IGNORED fork how_to_apply",
            "expected_output": "IGNORED fork expected_output",
            "bypass_llm": bypass,
            "how_to_apply_images": [],
            "expected_output_images": [],
        })
    return rows


_WORKSHOP_PARAMS = {
    "workspace_url": "https://example.cloud.databricks.com",
    "default_warehouse": "wh-123",
    "lakebase_instance_name": "vibe-lakebase",
    "lakebase_host_name": "vibe-lakebase.example.com",
    "company_brand_url": "",  # empty -> no brand injection (and none of these tags gate it)
}


@pytest.fixture
def seeded_prompt_rows(monkeypatch):
    """Seed identical section_input_prompts + usecase rows into the in-memory
    fallback both code paths read (routes.*), and reset the TTL cache so neither
    path serves stale rows."""
    routes.clear_lakebase_cache()
    usecase_rows = _usecase_rows()
    section_rows = _section_rows()
    monkeypatch.setattr(routes, "get_usecase_descriptions_from_lakebase", lambda: usecase_rows)
    monkeypatch.setattr(routes, "get_section_input_prompts_from_lakebase", lambda: section_rows)
    monkeypatch.setattr(routes, "get_workshop_parameters_sync", lambda: dict(_WORKSHOP_PARAMS))
    yield
    routes.clear_lakebase_cache()


@pytest.mark.parametrize("tag", SAMPLE_TAGS)
@pytest.mark.parametrize("industry,use_case", MATRIX)
@pytest.mark.parametrize("assistant", ASSISTANTS)
def test_assembler_byte_parity(seeded_prompt_rows, tag, industry, use_case, assistant):
    live = routes.get_section_input_content(
        industry, use_case, tag, coding_assistant_override=assistant
    )
    extracted = assembler.get_section_input_content(
        industry, use_case, tag, coding_assistant_override=assistant
    )
    assert extracted == live, f"assembler drift for {tag}/{industry}/{use_case}/{assistant}"
    # Lock the exact key set (D3 §7.4).
    assert set(extracted.keys()) == EXPECTED_KEYS
    # Sanity: the seeded content was actually substituted (not an empty fallback).
    assert extracted["input"], "assembler produced empty input for a seeded row"
    if assistant == "genie-code":
        assert extracted["coding_assistant_variant"] == "genie-code"
        assert extracted["input"].startswith("[genie-code fork]")
    else:
        assert extracted["coding_assistant_variant"] == routes.DEFAULT_CODING_ASSISTANT_KEY
