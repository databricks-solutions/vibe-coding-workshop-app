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

GENIE_STEP_METADATA: dict[str, dict[str, Any]] = {
    "semlayer_locate": {
        "requiresGate": None,
        "consumes": ["prd_document"],
        "produces": "genie_brief",
        "execution": "agent-doable",
    },
    "semlayer_profile": {
        "requiresGate": "semlayer_locate",
        "consumes": ["genie_brief"],
        "produces": "schema_profile",
        "execution": "agent-doable",
    },
    "semlayer_measures": {
        "requiresGate": "semlayer_profile",
        "consumes": ["schema_profile"],
        "produces": "measures_signoff",
        "execution": "hybrid",
    },
    "semlayer_metric_view": {
        "requiresGate": "semlayer_measures",
        "consumes": ["measures_signoff"],
        "produces": "metric_view",
        "execution": "agent-doable",
    },
    "semlayer_synonyms": {
        "requiresGate": "semlayer_metric_view",
        "consumes": ["metric_view"],
        "produces": "synonyms",
        "execution": "agent-doable",
    },
    "gagent_describe": {
        "requiresGate": "semlayer_metric_view",
        "consumes": ["metric_view"],
        "produces": "genie_space",
        "execution": "agent-doable",
    },
    "gagent_instructions": {
        "requiresGate": "gagent_describe",
        "consumes": ["genie_space"],
        "produces": "agent_instructions",
        "execution": "agent-doable",
    },
    "gagent_verified": {
        "requiresGate": "gagent_instructions",
        "consumes": ["agent_instructions"],
        "produces": "verified_queries",
        "execution": "agent-doable",
    },
    "gagent_benchmarks": {
        "requiresGate": "gagent_verified",
        "consumes": ["verified_queries"],
        "produces": "benchmarks",
        "execution": "agent-doable",
    },
    "gagent_optimize": {
        "requiresGate": "gagent_benchmarks",
        "consumes": ["benchmarks"],
        "produces": "optimize_gate",
        "execution": "agent-doable",
    },
    "gaccel_dashboard": {
        "requiresGate": "semlayer_metric_view",
        "consumes": ["metric_view"],
        "produces": "dashboard_inventory",
        "execution": "agent-doable",
    },
    "ontology_domain": {
        "requiresGate": "gagent_optimize",
        "consumes": ["optimize_gate"],
        "produces": "domain_model",
        "execution": "hybrid",
    },
    "ontology_pages": {
        "requiresGate": "ontology_domain",
        "consumes": ["domain_model"],
        "produces": "pages",
        "execution": "ui-driven",
    },
    "ontology_routing": {
        "requiresGate": "ontology_pages",
        "consumes": ["pages"],
        "produces": "routing_page",
        "execution": "ui-driven",
    },
    "gaccel_activation": {
        "requiresGate": "gagent_optimize",
        "consumes": ["aibi_dashboard", "prd_document"],
        "produces": "sync_plan",
        "execution": "agent-doable",
    },
}

OUTPUT_BY_TAG = {
    "prd_generation": "prd_document",
    "bronze_table_metadata": "table_metadata",
    "gold_layer_design": "gold_layer_design",
    "bronze_layer_creation": "synthetic_data",
    "silver_layer_sdp": "silver_layer",
    "gold_layer_pipeline": "gold_layer_pipeline",
    "usecase_plan": "usecase_plan",
    "aibi_dashboard": "aibi_dashboard",
    "genie_space": "genie_space",
    "agent_framework": "agent_framework",
    "wire_ui_agent": "wire_ui_agent",
    "iterate_enhance": "iteration_plan",
    "skill_install_explore": "exploration_findings",
    "skill_define_strategy": "skill_strategy",
    "skill_create_skillmd": "skill_definition",
    "skill_apply_contracts": "applied_skill",
    "skill_certify_tables": "certified_skill",
    "activation_table_design": "activation_table_design",
    "activation_reverse_sync": "activation_reverse_sync",
    "activation_app_design": "activation_app_design",
    "activation_build_wire": "activation_build_wire",
    "activation_wire_lakebase": "activation_wire_lakebase",
    "activation_deploy_validate": "activation_app",
}

CONSUMES_BY_TAG = {
    "bronze_table_metadata": ["prd_document"],
    "gold_layer_design": ["table_metadata"],
    "bronze_layer_creation": ["table_metadata"],
    "silver_layer_sdp": ["synthetic_data"],
    "gold_layer_pipeline": ["gold_layer_design"],
    "usecase_plan": ["prd_document", "gold_layer_design"],
    "aibi_dashboard": ["prd_document", "gold_layer_design"],
    "genie_space": ["usecase_plan"],
    "agent_framework": ["prd_document", "gold_layer_design"],
    "wire_ui_agent": ["agent_framework"],
    "redeploy_test": ["iteration_plan"],
    "skill_define_strategy": ["exploration_findings"],
    "skill_create_skillmd": ["skill_strategy"],
    "skill_apply_contracts": ["skill_definition"],
    "skill_certify_tables": ["applied_skill"],
    "activation_app_design": ["gold_layer_design", "prd_document"],
    "activation_build_wire": ["activation_app_design"],
    "activation_table_design": [
        "gold_layer_design",
        "usecase_plan",
        "prd_document",
        "activation_plan",
    ],
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
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "order": 0,
        "sectionTag": step.section_tag,
        "title": step.title,
        "why": None,
        "gate": None,
        "requiresGate": previous_tag,
        "consumes": list(CONSUMES_BY_TAG.get(step.section_tag, [])),
        "produces": OUTPUT_BY_TAG.get(step.section_tag),
        "execution": "agent-doable",
        "surfaces": ["ui", "mcp"],
        "flag": None,
    }
    if step.section_tag in GENIE_STEP_METADATA:
        data.update(GENIE_STEP_METADATA[step.section_tag])
    if track_id == "genie-accelerator" and step.section_tag == "gold_layer_design":
        data["consumes"] = ["table_metadata", "prd_document"]
    if track_id == "agents-accelerator" and step.section_tag == "genie_space":
        data["consumes"] = ["prd_document", "table_metadata"]
    if step.section_tag in ontology_tags:
        data["flag"] = GENIE_ONTOLOGY_FLAG
    return data


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
    tracks: dict[str, Any] = {}
    for track_id, track in levels.items():
        ordered_sections = _filtered_sections(track, sections, steps)
        track_steps: list[dict[str, Any]] = []
        previous_tag: str | None = None
        serialized_sections: list[dict[str, Any]] = []
        for section in ordered_sections:
            serialized_steps: list[dict[str, Any]] = []
            for number in section.steps:
                source_step = steps[number]
                step_data = _metadata(track_id, source_step, previous_tag, ontology_tags)
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
