#!/usr/bin/env python3
"""Generate the workshop manifest from the read-only workflow TS source."""

from __future__ import annotations

import ast
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_SOURCE = ROOT / "src/constants/workflowSections.ts"
MANIFEST_PATH = ROOT / "src/backend/workshop/manifest.json"


@dataclass(frozen=True)
class SourceStep:
    number: int
    title: str
    section_tag: str


@dataclass(frozen=True)
class SourceSection:
    section_id: str
    chapter: str
    title: str
    focus: str
    steps: list[int]


@dataclass(frozen=True)
class SourceTrack:
    track_id: str
    title: str
    section_ids: list[str]
    chapters: set[str]


GENIE_ONTOLOGY_FLAG = "includeGenieOntology"
GENIE_LAKEHOUSE_FLAG = "includeLakehouse"

# ---------------------------------------------------------------------------
# Phase 3 T3a — composition axes (mirrors src/constants/workflowSections.ts).
# These tables are hand-mirrored from the TS source. Parity is now guarded by a
# FROZEN golden matrix (tests/workshop/test_outline_parity.py vs
# fixtures/golden_outline_matrix.json): the golden's `ts` column was captured from
# the real TS transforms while they were live and was FROZEN in Phase 3 T4b (the
# TS getFilteredSections and its node oracle scripts/dump_outline_matrix.mjs were
# retired), so the engine must reproduce that permanent reference cell-for-cell —
# any drift in these tables fails the gate rather than shipping silently.
# ---------------------------------------------------------------------------

# AXIS 3+4 — AI-module + medallion sub-toggles: six DEFAULT-TRUE session flags,
# each a pure step-disable over a disjoint set of gated sectionTags (one tag maps
# to exactly one flag). Mirrors getDisabledTagsForAIModules /
# getDisabledTagsForMedallionLayers (workflowSections.ts:127,192).
AI_MODULE_FLAG_TAGS: dict[str, list[str]] = {
    "ai.genie": ["genie_space", "optimize_genie"],
    "ai.agent": ["agent_framework", "wire_ui_agent"],
    "ai.dashboard": ["aibi_dashboard"],
}
MEDALLION_FLAG_TAGS: dict[str, list[str]] = {
    "medallion.bronze": ["bronze_table_metadata", "bronze_layer_creation"],
    "medallion.silver": ["silver_layer_sdp"],
    "medallion.gold": ["gold_layer_design", "gold_layer_pipeline"],
}

# LEVELS_WITH_AI_MODULES (workflowSections.ts:86) + APPLICABLE_AI_MODULES (:107):
# reverse-lakebase narrows to {genie,dashboard} because the reverse section
# transforms in _filtered_sections (this file) already strip its Agent steps.
LEVELS_WITH_AI_MODULES: set[str] = {
    "lakehouse-di",
    "end-to-end",
    "accelerator",
    "reverse-lakehouse-di",
    "reverse-lakebase",
    "reverse-app",
}
APPLICABLE_AI_MODULES: dict[str, set[str]] = {
    "lakehouse-di": {"genie", "agent", "dashboard"},
    "end-to-end": {"genie", "agent", "dashboard"},
    "accelerator": {"genie", "agent", "dashboard"},
    "reverse-lakehouse-di": {"genie", "agent", "dashboard"},
    "reverse-lakebase": {"genie", "dashboard"},
    "reverse-app": {"genie", "agent", "dashboard"},
}
# LEVELS_WITH_MEDALLION_TOGGLES (workflowSections.ts:150) — all three layers
# applicable on every listed level (APPLICABLE_MEDALLION_LAYERS is empty ==
# default to all three).
LEVELS_WITH_MEDALLION_TOGGLES: set[str] = {
    "lakehouse",
    "lakehouse-di",
    "end-to-end",
    "accelerator",
    "data-engineering-accelerator",
    "reverse-lakehouse",
    "reverse-lakehouse-di",
    "reverse-lakebase",
    "reverse-app",
}

# AXIS 1 — direction=reverse. The four reverse-* levels render ONLY in reverse
# direction (direction is 1:1 with these level names in the UI), so reverse is
# baked into their manifest tracks intrinsically. end-to-end is direction-
# agnostic, so its reverse form is a runtime variant (see build_manifest).
REVERSE_TRACKS: set[str] = {
    "reverse-lakehouse",
    "reverse-lakehouse-di",
    "reverse-lakebase",
    "reverse-app",
}
# REVERSE_SECTION_ORDER — stable section re-sort applied in reverse direction,
# before the iterate-enhance/cleanup tail sort. This is the generator's OWN copy of
# the ordering (the TS REVERSE_SECTION_ORDER it mirrored was deleted in Phase 3
# T4b); the frozen-golden parity harness pins that the composed reverse order it
# produces stays correct.
REVERSE_SECTION_ORDER: list[str] = [
    "define-usecase",
    "lakehouse",
    "data-intelligence",
    "activation",
    "iterate-enhance",
    "cleanup",
]

# AXIS 2 — additive-chain climb. APP_CHAIN (workflowSections.ts:947); climbing to
# lakehouse / lakehouse-di with chainContext='app' re-admits the app+lakebase
# sections via the cumulative sectionIds/chapterVisibility union
# (getCumulativeOverrides :1123). Modelled as a runtime variant.
APP_CHAIN: list[str] = ["app-only", "app-database", "lakehouse", "lakehouse-di"]
CLIMB_TRACKS: set[str] = {"lakehouse", "lakehouse-di"}

GENIE_STEP_METADATA: dict[str, dict[str, Any]] = {
    "semlayer_locate": {
        "requiresGate": None,
        "execution": "agent-doable",
    },
    "semlayer_profile": {
        "requiresGate": "semlayer_locate",
        "execution": "agent-doable",
    },
    "semlayer_measures": {
        "requiresGate": "semlayer_profile",
        "execution": "hybrid",
    },
    "semlayer_metric_view": {
        "requiresGate": "semlayer_measures",
        "execution": "agent-doable",
    },
    "semlayer_synonyms": {
        "requiresGate": "semlayer_metric_view",
        "execution": "agent-doable",
    },
    "gagent_describe": {
        "requiresGate": "semlayer_metric_view",
        "execution": "agent-doable",
    },
    "gagent_instructions": {
        "requiresGate": "gagent_describe",
        "execution": "agent-doable",
    },
    "gagent_verified": {
        "requiresGate": "gagent_instructions",
        "execution": "agent-doable",
    },
    "gagent_benchmarks": {
        "requiresGate": "gagent_verified",
        "execution": "agent-doable",
    },
    "gagent_optimize": {
        "requiresGate": "gagent_benchmarks",
        "execution": "agent-doable",
    },
    "gaccel_dashboard": {
        "requiresGate": "semlayer_metric_view",
        "execution": "agent-doable",
    },
    "ontology_domain": {
        "requiresGate": "gagent_optimize",
        "execution": "hybrid",
    },
    "ontology_pages": {
        "requiresGate": "ontology_domain",
        "execution": "ui-driven",
    },
    "ontology_routing": {
        "requiresGate": "ontology_pages",
        "execution": "ui-driven",
    },
    "gaccel_activation": {
        "requiresGate": "gagent_optimize",
        "execution": "agent-doable",
    },
}

# Hand-transcribed from the `previousOutputs` literals in
# `WorkflowDiagram.tsx`, mirrored by `stepPreviousOutputs.ts`. Keys are the
# object keys passed to the assembler; values are the source step numbers.
CHAINING_LITERAL_REFERENCES: dict[int, dict[str, int]] = {
    10: {"prd_document": 3},
    11: {"table_metadata": 10},
    12: {"table_metadata": 10},
    13: {"synthetic_data": 12},
    14: {"gold_layer_design": 11},
    15: {"prd_document": 3, "gold_layer_design": 11},
    16: {"prd_document": 3, "gold_layer_design": 11},
    17: {"usecase_plan": 15},
    18: {"prd_document": 3, "gold_layer_design": 11},
    19: {"agent_framework": 18},
    21: {"iteration_plan": 20},
    27: {"exploration_findings": 26},
    28: {"skill_strategy": 27},
    29: {"skill_definition": 28},
    30: {"applied_skill": 29},
    32: {
        "gold_layer_design": 11,
        "usecase_plan": 15,
        "prd_document": 3,
        "activation_plan": 72,
    },
    34: {"gold_layer_design": 11, "prd_document": 3},
    35: {"activation_app_design": 34},
    39: {"agent_spec_design": 38},
    40: {"agent_tool_selection": 39},
    41: {"uc_resources_foundation": 40},
    42: {"mlflow_agent_tracing_uc": 41},
    43: {"knowledge_assistant_create": 42},
    44: {"track_a_agent_app_clone_framework": 43},
    45: {"track_a_agent_ka_genie_tools": 44},
    46: {"track_a_agent_auth_memory": 45},
    47: {"track_a_agent_eval_deploy": 46},
    48: {"appkit_agent_app_proxy_chat": 47},
    49: {"appkit_chat_feedback_mlflow": 48},
    50: {"mlflow_prompt_registry": 49},
    51: {"mlflow_evaluation_datasets": 50},
    52: {"mlflow_scorers_and_judges": 51},
    53: {"mlflow_evaluation_runs_and_iteration": 52},
    54: {"mlflow_human_review_and_signoff": 53},
    55: {"mlflow_logged_model_uc_registration": 54},
    56: {"mlflow_gateway_and_deployment": 55},
    73: {"activation_wire_lakebase": 36},
}

# Shared use-case chaining override (D-33, every track): prd_generation (3)
# consumes use_case_brief. The producer, use_case_selection, was retired as a
# numbered step (step 70) and is now resolved PRE-JOURNEY — mirroring the App's
# step 1 "Define Your Intent" (source step 1), which never appears in any manifest
# track's numbered outline. Pointed at 1 (the pre-journey producer's identity):
# source step 1 is never in ``present_numbers``, so no numbered step is stamped as
# the ``use_case_brief`` producer (the MCP engine writes it up front via
# ``resolve_use_case``), while prd_generation still gets
# ``consumes: ["use_case_brief"]`` (consumes is keyed on the literal keys,
# independent of whether the producer is a present numbered step). Shared since
# the brief exists on every track once the use case locks; a session whose intent
# is defined without a lock gets the assembler placeholder. See D11 §3.2–3.3.
USE_CASE_CHAINING_LITERAL_OVERRIDES: dict[int, dict[str, int]] = {
    3: {"use_case_brief": 1},
}

# Genie-accelerator-only chaining overrides, merged after the shared ones.
GENIE_CHAINING_LITERAL_OVERRIDES: dict[int, dict[str, int]] = {
    11: {"table_metadata": 22, "prd_document": 3},
    17: {"prd_document": 3, "table_metadata": 10},
    71: {"metric_view": 60, "prd_document": 3},
    72: {"aibi_dashboard": 71, "prd_document": 3},
}

# Shared use-case ``requiresGate`` override (D-33, every track) — decouples
# prd_generation's gate from its immediate predecessor in the composed outline.
# prd_generation gates on ``use_case_selection`` (resolved pre-journey by the MCP
# engine, or credited from defined intent by ``build_session_state``, D-34) even
# though use_case_selection is not the numbered step preceding it; without this
# the generator would derive requiresGate="project_setup" from the previous step
# and the use-case gate would no longer unlock PRD.
USE_CASE_REQUIRES_GATE_OVERRIDES: dict[str, str] = {
    "prd_generation": "use_case_selection",
}

def _ts_string(value: str) -> str:
    return ast.literal_eval(f"'{value}'")


def _field(body: str, name: str) -> str:
    match = re.search(rf"\b{name}:\s*'((?:\\.|[^'])*)'", body)
    if not match:
        raise ValueError(f"Could not find {name!r}")
    return _ts_string(match.group(1))


def _int_list(body: str, name: str) -> list[int]:
    match = re.search(rf"\b{name}:\s*\[([^\]]*)\]", body, re.S)
    if not match:
        raise ValueError(f"Could not find {name!r}")
    return [int(value) for value in re.findall(r"\d+", match.group(1))]


def _object_blocks(source: str, marker: str) -> list[str]:
    start = source.index(marker)
    end = source.index("\n];", start) + 3
    region = source[start:end]
    return [
        match.group("body")
        for match in re.finditer(
            r"  \{\n(?P<body>.*?)(?=\n  \},)",
            region,
            re.S,
        )
    ]


def parse_source(source: str) -> tuple[dict[int, SourceStep], dict[str, SourceSection], dict[str, SourceTrack]]:
    steps: dict[int, SourceStep] = {}
    for match in re.finditer(
        r"^\s*(\d+): \{ number: \d+, title: '((?:\\.|[^'])*)'.*?sectionTag: '([^']+)' \},$",
        source,
        re.M,
    ):
        number = int(match.group(1))
        steps[number] = SourceStep(number, _ts_string(match.group(2)), match.group(3))

    sections: dict[str, SourceSection] = {}
    for body in _object_blocks(source, "export const WORKFLOW_SECTIONS"):
        section_id = _field(body, "id")
        sections[section_id] = SourceSection(
            section_id=section_id,
            chapter=_field(body, "chapter"),
            title=_field(body, "title"),
            focus=_field(body, "focus"),
            steps=_int_list(body, "steps"),
        )

    level_start = source.index("export const WORKSHOP_LEVELS")
    level_end = source.index("\n};", level_start) + 3
    levels: dict[str, SourceTrack] = {}
    level_region = source[level_start:level_end]
    for match in re.finditer(
        r"^  '([^']+)': \{\n(?P<body>.*?)(?=\n  \},\n  '|\n};)",
        level_region,
        re.M | re.S,
    ):
        track_id = match.group(1)
        body = match.group("body")
        section_ids_match = re.search(r"sectionIds:\s*\[([^\]]*)\]", body, re.S)
        if section_ids_match is None:
            raise ValueError(f"Could not find sectionIds for {track_id}")
        levels[track_id] = SourceTrack(
            track_id=track_id,
            title=_field(body, "label"),
            section_ids=[_ts_string(value) for value in re.findall(r"'([^']+)'", section_ids_match.group(1))],
            chapters=set(),
        )

    visibility_start = source.index("export const CHAPTER_VISIBILITY")
    visibility_end = source.index("\n};", visibility_start) + 3
    visibility_region = source[visibility_start:visibility_end]
    for match in re.finditer(
        r"^  '([^']+)': (?P<body>[^\n]+)",
        visibility_region,
        re.M,
    ):
        track_id = match.group(1)
        track = levels[track_id]
        levels[track_id] = SourceTrack(
            track_id=track.track_id,
            title=track.title,
            section_ids=track.section_ids,
            chapters=set(re.findall(r"'((?:ch)[1-4])'", match.group("body"))),
        )
    return steps, sections, levels


def _filtered_sections(
    track_id: str,
    section_id_set: set[str],
    chapters: set[str],
    direction: str,
    sections: dict[str, SourceSection],
    steps: dict[int, SourceStep],
) -> list[SourceSection]:
    """Reproduce getFilteredSections (workflowSections.ts:750) for one track.

    Iterates WORKFLOW_SECTIONS in DECLARATION order filtered by ``section_id_set``
    membership (exactly like the TS ``WORKFLOW_SECTIONS.filter(...)``), applies the
    per-section step transforms for the given ``chapters`` and ``direction``, then
    the reverse section re-sort (reverse only) and the iterate-enhance/cleanup tail
    sort. ``sections`` preserves declaration order (parse_source builds it from the
    source array), so iterating it yields the TS section order regardless of the
    order in which section ids appear in a track's sectionIds / override union.
    """

    is_genie = track_id == "genie-accelerator"
    is_skills = track_id == "skills-accelerator"
    is_reverse = direction == "reverse"
    genie_track_section_ids = {"semantic-layer", "genie-agent", "genie-ontology", "genie-activate"}

    filtered: list[SourceSection] = []
    for section_id, section in sections.items():
        if section_id not in section_id_set:
            continue
        section_steps = list(section.steps)
        # The branches below mirror the sequential `if (...) return {...}` blocks
        # in getFilteredSections; the first matching branch wins (hence elif).
        if section_id in genie_track_section_ids and not is_genie:
            section_steps = []
        elif section_id == "define-usecase" and is_skills:
            # Skills Accelerator drops the PRD step (3) from foundation. (Step 70
            # use_case_selection was retired as a pre-journey intent beat, so there
            # is no longer a genie-only numbered node to strip here.)
            section_steps = [number for number in section_steps if number != 3]
        elif section_id == "lakehouse" and is_genie:
            section_steps = [number for number in section_steps if number in {22, 11, 14, 23}]
        elif section_id == "data-intelligence" and is_genie:
            section_steps = []
        elif section_id == "lakehouse" and not is_genie:
            section_steps = [number for number in section_steps if number != 22]
            if "ch2" not in chapters or is_reverse:
                section_steps = [number for number in section_steps if number != 9]
        elif section_id == "activation" and not is_reverse:
            section_steps = []
        elif section_id == "activation" and track_id == "reverse-lakebase":
            section_steps = [number for number in section_steps if number in {32, 33}]
        elif section_id in {"databricks-app", "lakebase"} and is_reverse:
            section_steps = []
        elif section_id == "data-intelligence" and ("ch1" not in chapters or is_reverse):
            section_steps = [number for number in section_steps if number != 19]
            if is_reverse:
                # reverse-lakebase has no app to wire an agent to: drop Build Agent.
                if track_id == "reverse-lakebase":
                    section_steps = [number for number in section_steps if number != 18]
                # In reverse ETL, Genie Space (17) must precede AI/BI Dashboard (16).
                if 16 in section_steps and 17 in section_steps:
                    i16 = section_steps.index(16)
                    i17 = section_steps.index(17)
                    if i16 < i17:
                        section_steps[i16], section_steps[i17] = section_steps[i17], section_steps[i16]
        if section_steps:
            filtered.append(SourceSection(section.section_id, section.chapter, section.title, section.focus, section_steps))

    if is_reverse:
        filtered.sort(
            key=lambda item: REVERSE_SECTION_ORDER.index(item.section_id)
            if item.section_id in REVERSE_SECTION_ORDER
            else 999
        )
    filtered.sort(key=lambda item: (998 if item.section_id == "iterate-enhance" else 999 if item.section_id == "cleanup" else 0))
    return filtered


def _metadata(
    track_id: str,
    step: SourceStep,
    previous_tag: str | None,
    ontology_tags: set[str],
    lakehouse_tags: set[str],
    consumes_by_step: dict[int, list[str]],
    produces_by_step: dict[int, str],
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "order": 0,
        "sectionTag": step.section_tag,
        "title": step.title,
        "why": None,
        "gate": None,
        "requiresGate": previous_tag,
        "consumes": consumes_by_step.get(step.number, []),
        "produces": produces_by_step.get(step.number),
        "execution": "agent-doable",
        "surfaces": ["ui", "mcp"],
        "flag": None,
    }
    if step.section_tag in GENIE_STEP_METADATA:
        data.update(GENIE_STEP_METADATA[step.section_tag])
    # Shared requiresGate override (every track, D-33): keep prd_generation gating
    # on the pre-journey use_case_selection gate rather than its numbered
    # predecessor. Applied after GENIE_STEP_METADATA so it wins.
    if step.section_tag in USE_CASE_REQUIRES_GATE_OVERRIDES:
        data["requiresGate"] = USE_CASE_REQUIRES_GATE_OVERRIDES[step.section_tag]
    # Both optional-chapter flags are genie-accelerator-only (mirrors
    # LEVELS_WITH_LAKEHOUSE_TOGGLE / the ontology toggle in workflowSections.ts):
    # their flag DEFINITIONS live only on that track, so a shared lakehouse step
    # (gold_layer_design/pipeline/deploy_lakehouse_assets also appear in other
    # tracks) must NOT be stamped elsewhere or outline_order would drop it by
    # default with no matching flag definition.
    if track_id == "genie-accelerator":
        if step.section_tag in ontology_tags:
            data["flag"] = GENIE_ONTOLOGY_FLAG
        elif step.section_tag in lakehouse_tags:
            data["flag"] = GENIE_LAKEHOUSE_FLAG
    return data


def _chaining_references(track_id: str) -> dict[int, dict[str, int]]:
    references = dict(CHAINING_LITERAL_REFERENCES)
    references.update(USE_CASE_CHAINING_LITERAL_OVERRIDES)
    if track_id == "genie-accelerator":
        references.update(GENIE_CHAINING_LITERAL_OVERRIDES)
    if track_id == "agents-accelerator":
        references[17] = {"prd_document": 3, "table_metadata": 10}
    return references


def _chaining_metadata(
    track_id: str,
    present_numbers: set[int],
) -> tuple[dict[int, list[str]], dict[int, str]]:
    references = _chaining_references(track_id)
    consumes_by_step = {
        consumer_number: list(literals)
        for consumer_number, literals in references.items()
    }
    produces_by_step: dict[int, str] = {}
    for literals in references.values():
        for output_key, source_number in literals.items():
            if source_number not in present_numbers:
                continue
            existing_key = produces_by_step.get(source_number)
            if existing_key is not None and existing_key != output_key:
                raise ValueError(
                    f"Step {source_number} has conflicting output keys: "
                    f"{existing_key!r} and {output_key!r}"
                )
            produces_by_step[source_number] = output_key
    return consumes_by_step, produces_by_step


def _subtoggle_flags_for_track(track_id: str) -> dict[str, list[str]]:
    """Return the DEFAULT-TRUE sub-toggle flags applicable to this track, as
    ``{flag_name: [affected sectionTags]}``. Only AI modules that are applicable
    on the level (APPLICABLE_AI_MODULES) contribute an ``ai.*`` flag; every
    medallion-toggle level gets all three ``medallion.*`` flags. Order is fixed
    (genie, agent, dashboard, then bronze, silver, gold) for deterministic
    manifest output."""

    flags: dict[str, list[str]] = {}
    if track_id in LEVELS_WITH_AI_MODULES:
        applicable = APPLICABLE_AI_MODULES.get(track_id, set())
        for module in ("genie", "agent", "dashboard"):
            if module in applicable:
                name = f"ai.{module}"
                flags[name] = list(AI_MODULE_FLAG_TAGS[name])
    if track_id in LEVELS_WITH_MEDALLION_TOGGLES:
        for layer in ("bronze", "silver", "gold"):
            name = f"medallion.{layer}"
            flags[name] = list(MEDALLION_FLAG_TAGS[name])
    return flags


def _subtoggle_note(flag_name: str) -> str:
    if flag_name.startswith("ai."):
        return "AI module sub-toggle (default ON); mirrors getDisabledTagsForAIModules."
    return "Medallion layer sub-toggle (default ON); mirrors getDisabledTagsForMedallionLayers."


def _cumulative_override(track_id: str, levels: dict[str, SourceTrack]) -> tuple[set[str], set[str]]:
    """Mirror getCumulativeOverrides for an APP_CHAIN climb (chainContext='app').

    Returns the union of sectionIds and the union of chapterVisibility across
    APP_CHAIN[0..idx] for ``track_id``. Section ORDER is irrelevant (the assembler
    iterates WORKFLOW_SECTIONS declaration order), so a set of ids suffices."""

    idx = APP_CHAIN.index(track_id)
    section_ids: set[str] = set()
    chapters: set[str] = set()
    for level_id in APP_CHAIN[: idx + 1]:
        level = levels[level_id]
        section_ids.update(level.section_ids)
        chapters.update(level.chapters)
    return section_ids, chapters


def _serialize_sections(
    track_id: str,
    section_id_set: set[str],
    chapters: set[str],
    direction: str,
    sections: dict[str, SourceSection],
    steps: dict[int, SourceStep],
    ontology_tags: set[str],
    lakehouse_tags: set[str],
    subtoggle_tag_to_flag: dict[str, str],
) -> list[dict[str, Any]]:
    """Assemble one ordered section list (default track or a variant) into the
    serialized manifest shape, chaining ``requiresGate``/consumes/produces over the
    composed order and stamping the default-true sub-toggle flags."""

    ordered_sections = _filtered_sections(
        track_id, section_id_set, chapters, direction, sections, steps
    )
    present_numbers = {number for section in ordered_sections for number in section.steps}
    consumes_by_step, produces_by_step = _chaining_metadata(track_id, present_numbers)
    track_steps: list[dict[str, Any]] = []
    previous_tag: str | None = None
    serialized_sections: list[dict[str, Any]] = []
    for section in ordered_sections:
        serialized_steps: list[dict[str, Any]] = []
        for number in section.steps:
            source_step = steps[number]
            step_data = _metadata(
                track_id,
                source_step,
                previous_tag,
                ontology_tags,
                lakehouse_tags,
                consumes_by_step,
                produces_by_step,
            )
            # Sub-toggle stamping (AI/medallion, default TRUE). Never overrides a
            # genie-scoped flag set by _metadata; a step maps to at most one flag.
            if step_data["flag"] is None:
                flag_name = subtoggle_tag_to_flag.get(source_step.section_tag)
                if flag_name is not None:
                    step_data["flag"] = flag_name
            step_data["order"] = len(track_steps) + 1
            serialized_steps.append(step_data)
            track_steps.append(step_data)
            previous_tag = source_step.section_tag
        serialized_sections.append(
            {
                "id": section.section_id,
                "chapter": section.chapter,
                "title": section.title,
                "why": section.focus,
                "steps": serialized_steps,
            }
        )
    return serialized_sections


def build_manifest(source: str) -> dict[str, Any]:
    steps, sections, levels = parse_source(source)
    ontology_match = re.search(
        r"GENIE_ONTOLOGY_TAGS\s*=\s*\[([^\]]*)\]",
        source,
        re.S,
    )
    if ontology_match is None:
        raise ValueError("Could not find GENIE_ONTOLOGY_TAGS in workflowSections.ts")
    ontology_tags_in_order = [
        _ts_string(value)
        for value in re.findall(r"'([^']+)'", ontology_match.group(1))
    ]
    ontology_tags = set(ontology_tags_in_order)
    lakehouse_match = re.search(
        r"GENIE_LAKEHOUSE_TAGS\s*=\s*\[([^\]]*)\]",
        source,
        re.S,
    )
    if lakehouse_match is None:
        raise ValueError("Could not find GENIE_LAKEHOUSE_TAGS in workflowSections.ts")
    lakehouse_tags_in_order = [
        _ts_string(value)
        for value in re.findall(r"'([^']+)'", lakehouse_match.group(1))
    ]
    lakehouse_tags = set(lakehouse_tags_in_order)
    tracks: dict[str, Any] = {}
    for track_id, track in levels.items():
        subtoggle_flags = _subtoggle_flags_for_track(track_id)
        subtoggle_tag_to_flag = {
            tag: flag_name
            for flag_name, tags in subtoggle_flags.items()
            for tag in tags
        }
        section_id_set = set(track.section_ids)
        # AXIS 1: reverse is intrinsic to the four reverse-* tracks — bake it in.
        default_direction = "reverse" if track_id in REVERSE_TRACKS else "forward"
        serialized_sections = _serialize_sections(
            track_id,
            section_id_set,
            track.chapters,
            default_direction,
            sections,
            steps,
            ontology_tags,
            lakehouse_tags,
            subtoggle_tag_to_flag,
        )

        # AXIS 2 (climb) + end-to-end reverse: runtime variants selected by the
        # engine from session_parameters (chainContext / direction). Not distinct
        # tracks — one track carrying alternate composed orderings.
        variants: list[dict[str, Any]] = []
        if track_id in CLIMB_TRACKS:
            override_ids, override_chapters = _cumulative_override(track_id, levels)
            variants.append(
                {
                    "when": {"chainContext": "app"},
                    "sections": _serialize_sections(
                        track_id,
                        override_ids,
                        override_chapters,
                        "forward",
                        sections,
                        steps,
                        ontology_tags,
                        lakehouse_tags,
                        subtoggle_tag_to_flag,
                    ),
                }
            )
        if track_id == "end-to-end":
            variants.append(
                {
                    "when": {"direction": "reverse"},
                    "sections": _serialize_sections(
                        track_id,
                        section_id_set,
                        track.chapters,
                        "reverse",
                        sections,
                        steps,
                        ontology_tags,
                        lakehouse_tags,
                        subtoggle_tag_to_flag,
                    ),
                }
            )

        flags: dict[str, Any] = {}
        if track_id == "genie-accelerator":
            flags[GENIE_ONTOLOGY_FLAG] = {
                "default": False,
                "affectsSteps": ontology_tags_in_order,
                "note": "Genie Ontology is opt-in; mirrors getDisabledTagsForGenieOntology.",
            }
            flags[GENIE_LAKEHOUSE_FLAG] = {
                "default": False,
                "affectsSteps": lakehouse_tags_in_order,
                "note": "Genie lakehouse chapter is opt-in; mirrors getDisabledTagsForLakehouse.",
            }
        for flag_name, tags in subtoggle_flags.items():
            flags[flag_name] = {
                "default": True,
                "affectsSteps": tags,
                "note": _subtoggle_note(flag_name),
            }

        track_entry: dict[str, Any] = {
            "id": track_id,
            "title": track.title,
            "assistants": ["default"],
            "flags": flags,
            "sections": serialized_sections,
        }
        if variants:
            track_entry["variants"] = variants
        tracks[track_id] = track_entry

    # Global step-number -> sectionTag map (T5 PR1, decision D-2). Authority is the
    # frontend ALL_STEPS object (parse_source keys `steps` by its GLOBAL number, not
    # the track-local Step.order). The App-origin completed_steps/skipped_steps
    # back-resolution this once fed in state.build_session_state was retired in R4b
    # (reads went gates-only, no numeric fallback). The map now serves the App's own
    # tag<->number bridges and the analytics inverse
    # (completion_keying.tag_to_global_number: tag -> GLOBAL number). Emitted
    # string-keyed and sorted for deterministic (byte-identical) regeneration.
    step_number_to_tag = {
        str(number): steps[number].section_tag for number in sorted(steps)
    }
    return {
        "version": "1",
        "step_number_to_tag": step_number_to_tag,
        "tracks": tracks,
    }


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 1:
        raise SystemExit("generate_manifest.py accepts no arguments")
    manifest = build_manifest(WORKFLOW_SOURCE.read_text(encoding="utf-8"))
    _write_json(MANIFEST_PATH, manifest)


if __name__ == "__main__":
    main()
