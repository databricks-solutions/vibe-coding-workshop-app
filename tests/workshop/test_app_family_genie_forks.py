"""P4.3 family 1 — app-only + app-database are walkable in Genie Code (D-39).

The prompt table here is the REAL seed: every active ``section_input_prompts``
INSERT in ``02_seed_section_input_prompts.sql`` is parsed and handed to the
resolver in place of the Lakebase cache, so these tests read exactly what a fresh
deployment serves.

F1 fork resolution: a genie-code session gets the 1001 (workspace_setup_deploy) and
   1002 (redeploy_test) fork bodies on both app tracks; a non-genie session still
   gets the default rows (input_id 4 and 15).
F2 marker lint: every step a genie-code session is served on app-only and
   app-database carries no local-IDE marker beyond a reviewed per-step allowance.
   The same lint over genie-accelerator is RECORDED, never failed.
"""

import copy
import os
import pathlib
import re
import sys

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest  # noqa: E402

from scripts import seed_new_rows  # noqa: E402
from src.backend import mcp_server  # noqa: E402
from src.backend.api import routes  # noqa: E402
from src.backend.workshop import assembler, engine, manifest  # noqa: E402

SEED = REPO_ROOT / "db" / "lakebase" / "dml_seed" / "02_seed_section_input_prompts.sql"
APP_TRACKS = ("app-only", "app-database")
INDUSTRY = "travel"
USE_CASE = "ai_driven_booking"
# (section_tag -> (fork input_id, default input_id)) for the forks this PR adds.
NEW_FORKS = {"workspace_setup_deploy": (1001, 4), "redeploy_test": (1002, 15)}

_WORKSHOP_PARAMS = {
    "workspace_url": "https://example.cloud.databricks.com",
    "default_warehouse": "wh-123",
    "lakebase_instance_name": "vibe-lakebase",
    "lakebase_host_name": "vibe-lakebase.example.com",
    "company_brand_url": "",
}


def _literal(raw):
    if raw.startswith("'"):
        return raw[1:-1].replace("''", "'")
    if raw.lower() in ("true", "false"):
        return raw.lower() == "true"
    if re.fullmatch(r"\d+", raw):
        return int(raw)
    return None  # current_timestamp() / current_user()


def _row(stmt):
    match = seed_new_rows._INSERT_RE.match(stmt)
    cols, end = seed_new_rows._read_paren_group(stmt, match.end() - 1)
    values_at = re.compile(r"\s*VALUES\s*", re.IGNORECASE).match(stmt, end).end()
    values, _ = seed_new_rows._read_paren_group(stmt, values_at)
    return {col.strip().lower(): _literal(value) for col, value in zip(cols, values)}


SEED_ROWS = {
    pk: _row(stmt)
    for pk, stmt in seed_new_rows.seed_rows(str(SEED), "section_input_prompts", "input_id")
}


def _cache_rows():
    """The latest active row per (section_tag, coding_assistant), shaped like the
    Lakebase cache query in routes._refresh_lakebase_cache."""
    latest = {}
    for row in SEED_ROWS.values():
        if row.get("is_active") is False:
            continue
        row = dict(row, coding_assistant=row.get("coding_assistant") or routes.DEFAULT_CODING_ASSISTANT_KEY)
        key = (row["section_tag"], row["coding_assistant"])
        if key not in latest or row.get("version", 1) > latest[key].get("version", 1):
            latest[key] = row
    return list(latest.values())


@pytest.fixture
def seeded(monkeypatch):
    routes.clear_lakebase_cache()
    rows = _cache_rows()
    monkeypatch.setattr(routes, "get_usecase_descriptions_from_lakebase", lambda: [])
    monkeypatch.setattr(routes, "get_section_input_prompts_from_lakebase", lambda: rows)
    monkeypatch.setattr(routes, "get_workshop_parameters_sync", lambda: dict(_WORKSHOP_PARAMS))
    yield
    routes.clear_lakebase_cache()


@pytest.fixture
def store(monkeypatch):
    records: dict = {}

    def load_session(session_id):
        record = records.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        records.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")
    monkeypatch.setattr(mcp_server, "_curated_pair_status", lambda industry, use_case: "known")
    monkeypatch.setattr(mcp_server, "_industry_label_for", lambda industry, echo: "Travel")
    monkeypatch.setattr(mcp_server, "_use_case_label_for", lambda industry, use_case: None)
    return records


def _distinct_line(body, other):
    """The longest token-free line of ``body`` that ``other`` does not contain."""
    lines = [
        line.strip()
        for line in body.splitlines()
        if len(line.strip()) > 40 and "{" not in line and line.strip() not in other
    ]
    assert lines, "no distinguishing line"
    return max(lines, key=len)


def _served(track, tag):
    """The prompt _step_payload serves a genie-code (MCP) session for ``tag``."""
    state = engine.SessionState(session_parameters={"industry": INDUSTRY, "use_case": USE_CASE})
    return mcp_server._step_payload(track, state, engine.resolve_step(track, state, tag)).prompt


def _track_tags(track):
    return [step.sectionTag for step in manifest.load_manifest().track_steps(track)]


# --- F1: fork resolution ----------------------------------------------------------


@pytest.mark.parametrize("tag", sorted(NEW_FORKS))
def test_f1_seed_carries_the_fork_rows(tag):
    fork_id, default_id = NEW_FORKS[tag]
    fork, default = SEED_ROWS.get(fork_id), SEED_ROWS[default_id]
    assert fork is not None, f"seed has no input_id {fork_id}"
    assert (fork["section_tag"], fork["coding_assistant"]) == (tag, "genie-code")
    assert default["section_tag"] == tag and "coding_assistant" not in default
    # Seed header rule 4: only the prompt fields, at the default's bypass_llm.
    assert (fork["version"], fork["is_active"], fork["bypass_llm"]) == (1, True, default["bypass_llm"])
    assert "section_title" not in fork and "how_to_apply" not in fork


@pytest.mark.parametrize(
    ("track", "tag"),
    [("app-only", "redeploy_test"), ("app-database", "workspace_setup_deploy"), ("app-database", "redeploy_test")],
)
def test_f1_genie_get_step_resolves_the_new_forks(seeded, store, track, tag):
    tags = _track_tags(track)
    store["s"] = {
        "session_id": "s",
        "workshop_level": track,
        "industry": INDUSTRY,
        "use_case": USE_CASE,
        # Everything before the step is done, so its requiresGate holds.
        "completed_gates": ["use_case_selection", *tags[: tags.index(tag)]],
        "captured_outputs": {},
        "session_parameters": {"industry": INDUSTRY, "use_case": USE_CASE, "coding_assistant": "genie-code"},
    }
    got = mcp_server.vibe_get_step("s", tag)
    assert not isinstance(got, dict), got
    fork_id, default_id = NEW_FORKS[tag]
    fork, default = SEED_ROWS[fork_id]["input_template"], SEED_ROWS[default_id]["input_template"]
    assert _distinct_line(fork, default) in got.prompt
    assert _distinct_line(default, fork) not in got.prompt
    assert got.prompt == _served(track, tag)


def test_f1_workspace_setup_deploy_is_app_database_only():
    assert "workspace_setup_deploy" in _track_tags("app-database")
    assert "workspace_setup_deploy" not in _track_tags("app-only")


@pytest.mark.parametrize("tag", sorted(NEW_FORKS))
@pytest.mark.parametrize("assistant", [None, routes.DEFAULT_CODING_ASSISTANT_KEY, "coda"])
def test_f1_non_genie_session_still_gets_the_default(seeded, tag, assistant):
    fork_id, default_id = NEW_FORKS[tag]
    fork, default = SEED_ROWS[fork_id]["input_template"], SEED_ROWS[default_id]["input_template"]
    body = assembler.get_section_input_content(
        industry=INDUSTRY,
        use_case=USE_CASE,
        section_tag=tag,
        coding_assistant_override=assistant,
    )["input"]
    assert _distinct_line(default, fork) in body
    assert _distinct_line(fork, default) not in body


# --- F2: marker lint --------------------------------------------------------------

MARKERS = {
    "npm/npx": re.compile(r"\bnp[mx]\s"),
    "localhost": re.compile(r"localhost"),
    "auth login": re.compile(r"databricks\s+auth\s+login"),
    ".sh invocation": re.compile(r"(?:\./|\bbash\s+|\bsh\s+)[\w./-]*\.sh\b"),
    # A bare @-mention of a repo file. CLI `--json @file.json` args and npm scopes
    # (`@databricks/lakebase`) are not mentions.
    "@-mention": re.compile(r"@[\w.-]+(?:/[\w.-]+)*\.md\b"),
}

# Reviewed allowances: (section_tag, marker) -> (max hits, reason). Every other
# app-family step, including the 1001/1002 forks, is allowed none.
_PROHIBITIONS = (
    "existing fork, reviewed 2026-10-06: every hit is a NEVER / do-NOT prohibition "
    "or a description of the server-side build"
)
ALLOWED = {
    ("cursor_copilot_ui_design", "npm/npx"): (11, _PROHIBITIONS),
    ("cursor_copilot_ui_design", "localhost"): (5, _PROHIBITIONS),
    ("cursor_copilot_ui_design", "auth login"): (1, _PROHIBITIONS),
    ("deploy_databricks_app", "npm/npx"): (7, _PROHIBITIONS),
    ("deploy_databricks_app", "localhost"): (6, _PROHIBITIONS),
    ("deploy_databricks_app", "auth login"): (2, _PROHIBITIONS),
    ("setup_lakebase", "npm/npx"): (4, _PROHIBITIONS),
    ("setup_lakebase", "localhost"): (1, _PROHIBITIONS),
    ("setup_lakebase", "auth login"): (3, _PROHIBITIONS),
    ("wire_ui_lakebase", "npm/npx"): (7, _PROHIBITIONS),
    ("wire_ui_lakebase", "localhost"): (1, _PROHIBITIONS),
    ("wire_ui_lakebase", "auth login"): (2, _PROHIBITIONS),
}


def _hits(body):
    return {name: len(rx.findall(body)) for name, rx in MARKERS.items() if rx.search(body)}


@pytest.mark.parametrize("track", APP_TRACKS)
def test_f2_app_family_bodies_carry_no_local_ide_markers(seeded, track):
    excess = {}
    for tag in _track_tags(track):
        for marker, count in _hits(_served(track, tag)).items():
            allowed = ALLOWED.get((tag, marker), (0, None))[0]
            if count > allowed:
                excess[(tag, marker)] = (count, allowed)
    assert excess == {}, f"{track}: local-IDE markers over the allowance {excess}"


def test_f2_new_forks_are_marker_clean():
    for fork_id, _ in NEW_FORKS.values():
        assert _hits(SEED_ROWS[fork_id]["input_template"]) == {}, fork_id


def test_f2_genie_accelerator_hits_are_recorded(seeded, record_property):
    """Recorded, not failed: the reference track is not judged by this lint."""
    hits = {tag: _hits(_served("genie-accelerator", tag)) for tag in _track_tags("genie-accelerator")}
    hits = {tag: found for tag, found in hits.items() if found}
    record_property("genie_accelerator_marker_hits", hits)
    print(f"genie-accelerator marker hits: {hits}")
