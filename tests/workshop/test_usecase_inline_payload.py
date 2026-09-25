"""Workstream D — fold industry/use-case lists into the tool payloads.

Genie Code's agent cannot read ``vibe://`` resources, so the use-case discovery
lists are inlined into the tools:

  1. ``_step_payload`` for ``use_case_selection`` carries ``available_industries``,
     plus certified-first ``available_use_cases`` once an industry is set; every
     other step (and the pre-industry case) leaves them None.
  2. ``vibe_set_parameters`` echoes the same lists on any selection-touching call,
     and rejects an unknown industry (the transcript ``industry="travel"`` bug)
     with ``isError``/``UNKNOWN_INDUSTRY`` — while a plain non-selection merge
     stays untouched.

The backing seams (``get_industries`` / ``get_use_cases_map``) are mocked so the
suite runs fully offline, mirroring test_usecase_resources.py.
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server

SESSION_ID = "usecase-inline-session"

# get_industries() returns a leading placeholder, then real options (routes.py).
INDUSTRIES_FIXTURE = [
    {"value": "", "label": "Select an industry..."},
    {"value": "retail", "label": "Retail & CPG"},
    {"value": "travel", "label": "Travel & Hospitality"},
]

# get_use_cases_map() returns RAW Lakebase order (certified-first is enforced by
# the seam helper). Only "retail" has rows here, so it is the only KNOWN industry:
# "travel" is a valid industry OPTION but has no use cases -> unknown to validation.
USE_CASES_FIXTURE = {
    "retail": [
        {"value": "", "label": "Select a use case..."},
        {"value": "returns_analysis", "label": "Returns Analysis",
         "path_type": "use_case", "is_certified": False, "category": "Ops"},
        {"value": "demand_forecasting", "label": "Demand Forecasting",
         "path_type": "use_case", "is_certified": True, "category": "Planning"},
        {"value": "assortment", "label": "Assortment Optimization",
         "path_type": "use_case", "is_certified": True, "category": "Planning"},
        {"value": "pricing", "label": "Dynamic Pricing",
         "path_type": "use_case", "is_certified": False, "category": "Revenue"},
    ]
}

CERTIFIED_FIRST_VALUES = ["demand_forecasting", "assortment", "returns_analysis", "pricing"]


def _mock_seams(monkeypatch):
    monkeypatch.setattr("src.backend.api.routes.get_industries", lambda: copy.deepcopy(INDUSTRIES_FIXTURE))
    monkeypatch.setattr("src.backend.api.routes.get_use_cases_map", lambda: copy.deepcopy(USE_CASES_FIXTURE))


def _stub_assembler(monkeypatch):
    """Isolate _step_payload from seed data — only the inlined lists are under test."""
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {"input": "", "how_to_apply": "", "expected_output": ""},
    )


def _step(section_tag):
    steps = mcp_server.engine.MANIFEST.track_steps(mcp_server.DEFAULT_TRACK)
    step = next((s for s in steps if s.sectionTag == section_tag), None)
    assert step is not None, f"step not found in {mcp_server.DEFAULT_TRACK}: {section_tag}"
    return step


def _error_code(result):
    assert result["isError"] is True
    assert result["content"]
    return result["structuredContent"]["error"]["code"]


@pytest.fixture
def session_store(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            "completed_gates": [],
            "captured_outputs": {},
            "session_parameters": {},
        }
    }
    saves = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append((session_id, copy.deepcopy(fields)))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    return store, saves


# --- 1. _step_payload inlining -----------------------------------------------


def test_step_payload_inlines_industries_and_certified_first_use_cases(monkeypatch):
    _mock_seams(monkeypatch)
    _stub_assembler(monkeypatch)

    state = mcp_server.engine.SessionState(session_parameters={"industry": "retail"})
    payload = mcp_server._step_payload(mcp_server.DEFAULT_TRACK, state, _step("use_case_selection"))

    assert [o["value"] for o in payload.available_industries] == ["retail", "travel"]
    # Placeholder stripped; each option carries value/label.
    for opt in payload.available_industries:
        assert opt["value"] and set(("value", "label")) <= set(opt)

    assert [c["value"] for c in payload.available_use_cases] == CERTIFIED_FIRST_VALUES
    assert [c["is_certified"] for c in payload.available_use_cases] == [True, True, False, False]
    for case in payload.available_use_cases:
        assert set(("value", "label", "category", "is_certified")) <= set(case)


def test_step_payload_omits_use_cases_before_an_industry_is_chosen(monkeypatch):
    _mock_seams(monkeypatch)
    _stub_assembler(monkeypatch)

    state = mcp_server.engine.SessionState()  # no industry yet
    payload = mcp_server._step_payload(mcp_server.DEFAULT_TRACK, state, _step("use_case_selection"))

    assert [o["value"] for o in payload.available_industries] == ["retail", "travel"]
    assert payload.available_use_cases is None


def test_step_payload_leaves_lists_none_on_other_steps(monkeypatch):
    _mock_seams(monkeypatch)
    _stub_assembler(monkeypatch)

    state = mcp_server.engine.SessionState(session_parameters={"industry": "retail"})
    payload = mcp_server._step_payload(mcp_server.DEFAULT_TRACK, state, _step("project_setup"))

    assert payload.available_industries is None
    assert payload.available_use_cases is None


# --- 2. vibe_set_parameters: echo + unknown-industry validation --------------


def test_set_parameters_echoes_lists_on_bare_industry_call(session_store, monkeypatch):
    _mock_seams(monkeypatch)

    # The reworded step body tells the agent to send just `industry` to fetch use cases.
    result = mcp_server.vibe_set_parameters(SESSION_ID, {"industry": "retail"})

    assert [o["value"] for o in result.available_industries] == ["retail", "travel"]
    assert [c["value"] for c in result.available_use_cases] == CERTIFIED_FIRST_VALUES
    assert [c["is_certified"] for c in result.available_use_cases] == [True, True, False, False]


def test_set_parameters_rejects_unknown_industry(session_store, monkeypatch):
    _mock_seams(monkeypatch)

    # "travel" is a valid OPTION but has no use cases -> not a known industry.
    result = mcp_server.vibe_set_parameters(SESSION_ID, {"industry": "travel"})

    assert _error_code(result) == "UNKNOWN_INDUSTRY"
    # Nothing was persisted for the rejected industry.
    assert session_store[0][SESSION_ID]["session_parameters"].get("industry") != "travel"


def test_set_parameters_accepts_known_industry(session_store, monkeypatch):
    _mock_seams(monkeypatch)

    result = mcp_server.vibe_set_parameters(SESSION_ID, {"industry": "retail"})

    assert result.resolved_params["industry"] == "retail"


def test_non_selection_merge_skips_echo_and_validation(session_store, monkeypatch):
    # If validation ran it would call these; if it doesn't touch selection it must not.
    def _boom():
        raise AssertionError("non-selection merge must not read use-case seams")

    monkeypatch.setattr("src.backend.api.routes.get_industries", _boom)
    monkeypatch.setattr("src.backend.api.routes.get_use_cases_map", _boom)

    result = mcp_server.vibe_set_parameters(SESSION_ID, {"catalog": "prod"})

    assert result.available_industries is None
    assert result.available_use_cases is None
    assert result.resolved_params["catalog"] == "prod"
