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

GENIE_CHAINING_LITERAL_OVERRIDES: dict[int, dict[str, int]] = {
    # prd_generation (3) consumes use_case_brief, produced by use_case_selection
    # (70). Genie-only: step 70 is stripped from every other track, and keeping
    # this override off the shared table stops non-genie prd_generation from
    # gaining a phantom consumes entry (consumes is populated regardless of
    # whether the producing step is present in the track). See D11 §3.2–3.3.
    3: {"use_case_brief": 70},
    11: {"table_metadata": 22, "prd_document": 3},
    17: {"prd_document": 3, "table_metadata": 10},
    71: {"metric_view": 60, "prd_document": 3},
    72: {"aibi_dashboard": 71, "prd_document": 3},
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


def _filtered_sections(track: SourceTrack, sections: dict[str, SourceSection], steps: dict[int, SourceStep]) -> list[SourceSection]:
    is_genie = track.track_id == "genie-accelerator"
    is_skills = track.track_id == "skills-accelerator"
    filtered: list[SourceSection] = []
    for section_id in track.section_ids:
        section = sections[section_id]
        section_steps = list(section.steps)
        # use_case_selection (step 70) is a genie-accelerator-only beat (D11, Phase
        # 2B); mirror getFilteredSections and strip it from every non-genie track.
        if not is_genie and section_id == "define-usecase":
            section_steps = [number for number in section_steps if number != 70]
        if is_skills and section_id == "define-usecase":
            section_steps = [number for number in section_steps if number != 3]
        if is_genie and section_id == "lakehouse":
            section_steps = [number for number in section_steps if number in {22, 11, 14, 23}]
        if is_genie and section_id == "data-intelligence":
            section_steps = []
        if not is_genie and section_id == "lakehouse":
            section_steps = [number for number in section_steps if number != 22]
            if "ch2" not in track.chapters:
                section_steps = [number for number in section_steps if number != 9]
        if section_id == "activation":
            section_steps = []
        if section_id == "data-intelligence" and "ch1" not in track.chapters:
            section_steps = [number for number in section_steps if number != 19]
        if section_steps:
            filtered.append(SourceSection(section.section_id, section.chapter, section.title, section.focus, section_steps))
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
        ordered_sections = _filtered_sections(track, sections, steps)
        present_numbers = {
            number for section in ordered_sections for number in section.steps
        }
        consumes_by_step, produces_by_step = _chaining_metadata(
            track_id, present_numbers
        )
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
        tracks[track_id] = {
            "id": track_id,
            "title": track.title,
            "assistants": ["default"],
            "flags": flags,
            "sections": serialized_sections,
        }
    return {"version": "1", "tracks": tracks}


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
