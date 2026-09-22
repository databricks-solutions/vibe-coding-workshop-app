"""Typed access to the generated workshop track manifest."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal


Execution = Literal["agent-doable", "ui-driven", "hybrid"]
Surface = Literal["ui", "mcp"]


@dataclass(frozen=True)
class Step:
    order: int
    sectionTag: str
    title: str
    why: str | None = None
    gate: str | None = None
    requiresGate: str | None = None
    consumes: list[str] = field(default_factory=list)
    produces: str | None = None
    execution: Execution = "agent-doable"
    surfaces: list[Surface] = field(default_factory=lambda: ["ui", "mcp"])
    flag: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Step":
        return cls(
            order=int(data["order"]),
            sectionTag=str(data["sectionTag"]),
            title=str(data["title"]),
            why=data.get("why"),
            gate=data.get("gate"),
            requiresGate=data.get("requiresGate"),
            consumes=[str(value) for value in data.get("consumes", [])],
            produces=data.get("produces"),
            execution=data.get("execution", "agent-doable"),
            surfaces=[str(value) for value in data.get("surfaces", ["ui", "mcp"])],
            flag=data.get("flag"),
        )


@dataclass(frozen=True)
class Section:
    id: str
    title: str
    steps: list[Step]
    chapter: str | None = None
    why: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Section":
        return cls(
            id=str(data["id"]),
            title=str(data["title"]),
            steps=[Step.from_dict(step) for step in data.get("steps", [])],
            chapter=data.get("chapter"),
            why=data.get("why"),
        )


@dataclass(frozen=True)
class Flag:
    default: bool
    affectsSteps: list[str] = field(default_factory=list)
    note: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Flag":
        return cls(
            default=bool(data.get("default", False)),
            affectsSteps=[str(value) for value in data.get("affectsSteps", [])],
            note=data.get("note"),
        )


@dataclass(frozen=True)
class Track:
    id: str
    title: str
    sections: list[Section]
    assistants: list[str] = field(default_factory=list)
    flags: dict[str, Flag] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Track":
        return cls(
            id=str(data["id"]),
            title=str(data["title"]),
            sections=[Section.from_dict(section) for section in data.get("sections", [])],
            assistants=[str(value) for value in data.get("assistants", [])],
            flags={
                str(name): Flag.from_dict(value)
                for name, value in data.get("flags", {}).items()
            },
        )

    def steps(self) -> list[Step]:
        return [step for section in self.sections for step in section.steps]


@dataclass(frozen=True)
class Manifest:
    version: str
    tracks: dict[str, Track]

    def track_steps(self, track_id: str) -> list[Step]:
        return self._track(track_id).steps()

    def outline_order(
        self, track_id: str, flags: dict[str, bool] | None = None
    ) -> list[Step]:
        track = self._track(track_id)
        requested_flags = flags or {}
        steps: list[Step] = []
        for step in track.steps():
            if step.flag is None:
                steps.append(step)
                continue
            flag_definition = track.flags.get(step.flag)
            default = flag_definition.default if flag_definition else False
            if bool(requested_flags.get(step.flag, default)):
                steps.append(step)
        return steps

    def _track(self, track_id: str) -> Track:
        try:
            return self.tracks[track_id]
        except KeyError as error:
            available = ", ".join(sorted(self.tracks))
            raise KeyError(f"Unknown track {track_id!r}; available tracks: {available}") from error


def _manifest_path(path: str | None) -> Path:
    return Path(path) if path is not None else Path(__file__).with_name("manifest.json")


def load_manifest(path: str | None = None) -> Manifest:
    manifest_path = _manifest_path(path)
    with manifest_path.open(encoding="utf-8") as stream:
        data = json.load(stream)
    return Manifest(
        version=str(data["version"]),
        tracks={
            str(track_id): Track.from_dict(track_data)
            for track_id, track_data in data["tracks"].items()
        },
    )


def track_steps(track_id: str, path: str | None = None) -> list[Step]:
    return load_manifest(path).track_steps(track_id)
