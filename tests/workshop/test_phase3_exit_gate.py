"""Phase 3 exit gate — the MCP and SPA read paths agree for ONE session.

test_outline_parity.py pins ``engine.outline`` against the FROZEN golden matrix.
What it does not pin is the two READ PATHS agreeing for the SAME persisted row:

* MCP: ``vibe_start_track(track, session_id=...).outline`` and
  ``_outline_items(track, state)`` over ``_load_session_for_request`` (the
  function vibe_start_track and the vibe://session state resource use);
* SPA: ``GET /api/track/{track}/outline?session_id=`` (routes.py, the T3c
  read-path authority the SPA orders and projects status from).

X1 pins identical ordered sectionTags and per-step status per session, for the
14 default cells plus the genie-accelerator includeLakehouse on/off pair and one
reverse and one climb variant, after two steps completed through MCP. X2 pins
status agreement after mixed-surface progress (one step via MCP
vibe_complete_step, one via the App's update-metadata with base_completed_gates,
the #90 path). X3 is a static guard: every direct read of the SPA's numeric
completed/skipped step sets is on an allowlist with a reason, and the sets those
reads see are gate-derived (deriveCompletedStepNumbers / mergeStatus). X3b pins
the copy-based reads (Array.from / new Set / spread) the same way, and X3c pins
every numeric-literal ``.add(<n>)`` on a completed/skipped set (today only the
step-1 intent credit, written back as the usecase_selection gate). X3d pins
numeric-literal adds on any receiver (a renamed copy escapes X3c), and X3e pins
for-of iteration over the sets (a copy-like read X3b does not see).

All offline: the REAL load_session / save paths run against #84's in-memory
``_fake_sessions_db``; the route runs through a TestClient.
"""

import json
import pathlib
import re
import sys
from collections import Counter

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

_API_TESTS = pathlib.Path(__file__).resolve().parents[1] / "api"
if str(_API_TESTS) not in sys.path:
    sys.path.insert(0, str(_API_TESTS))

from _fake_sessions_db import FakeSessionsDB, install  # noqa: E402

from src.backend import mcp_server  # noqa: E402
from src.backend.api import routes  # noqa: E402

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MATRIX = json.loads(
    (pathlib.Path(__file__).parent / "fixtures" / "golden_outline_matrix.json").read_text(encoding="utf-8")
)
SESSION_ID = "phase3-exit-gate-session"
MCP_STEPS = ("project_setup", "prd_generation")  # completed through vibe_complete_step


def _cell(track, combo):
    return next(c for c in MATRIX["cells"] if c["track"] == track and c["combo"] == combo)


_CELLS = [_cell(track, "default") for track in MATRIX["tracks"]] + [
    _cell("genie-accelerator", "flags:includeLakehouse"),
    _cell("end-to-end", "direction:reverse"),
    _cell("lakehouse", "climb:app"),
]
_FLAG_PAIR = [  # genie-accelerator includeLakehouse on and off, as the SPA persists them
    ("includeLakehouse-on", {"includeLakehouse": True}),
    ("includeLakehouse-off", {"includeLakehouse": False}),
]


@pytest.fixture
def db(monkeypatch):
    fake = FakeSessionsDB()
    install(monkeypatch, fake)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    # The REAL routes.save_session / load_session / save_session_merging_gates run
    # against the fake; only the unrelated session_parameters helpers are stubbed.
    monkeypatch.setattr(routes, "execute_insert", lambda *a, **k: True)
    monkeypatch.setattr(routes, "execute_query", lambda *a, **k: [])
    monkeypatch.setattr(routes, "get_schema", lambda: "test_schema")
    return fake


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    return TestClient(app)


def _seed(db, track, flags=None, direction=None, chain_context=None):
    params = {"flags": dict(flags or {})}
    if direction is not None:
        params["direction"] = direction
    if chain_context is not None:
        params["chainContext"] = chain_context
    db.row = {
        "session_id": SESSION_ID,
        "created_by": None,
        "workshop_level": track,
        # The use case is locked (the MCP-resolved intent beat), so prd_generation
        # is completable and the walk reaches the track's numbered steps.
        "completed_gates": ["use_case_selection"],
        "captured_outputs": {},
        "session_parameters": params,
    }


def _mcp_complete(sectionTag):
    result = mcp_server.vibe_complete_step(SESSION_ID, sectionTag, f"{sectionTag} output")
    assert not isinstance(result, dict), result
    assert sectionTag in result.completed_gates, result


def _mcp_outlines(track):
    """Both MCP outline reads: the start-track resume payload and _outline_items."""
    started = mcp_server.vibe_start_track(track, session_id=SESSION_ID)
    assert not isinstance(started, dict), started
    loaded = mcp_server._load_session_for_request(SESSION_ID, None, track)
    assert loaded is not None
    state, _ = loaded
    via_items = mcp_server._outline_items(track, state)
    as_pairs = lambda items: [(item.sectionTag, item.status) for item in items]  # noqa: E731
    return as_pairs(started.outline), as_pairs(via_items)


def _http_outline(client, track):
    resp = client.get(f"/api/track/{track}/outline", params={"session_id": SESSION_ID})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["track"] == track and body["session_id"] == SESSION_ID
    return [(item["sectionTag"], item["status"]) for item in body["outline"]]


def _assert_same_session_parity(client, track, golden_tags):
    started, via_items = _mcp_outlines(track)
    http = _http_outline(client, track)
    assert started == via_items, "vibe_start_track and _outline_items disagree"
    # Ordered sectionTags AND per-step status, for the same persisted row.
    assert started == http, f"MCP vs SPA outline differ on {track}"
    # Non-vacuous: both are the frozen golden order, and the MCP-completed steps
    # the track shows are done on both paths.
    assert [tag for tag, _ in http] == golden_tags
    status = dict(http)
    shown = [tag for tag in MCP_STEPS if tag in status]
    assert shown, f"{track} shows none of {MCP_STEPS}"
    assert all(status[tag] == "done" for tag in shown), status
    assert sum(1 for _, s in http if s == "current") <= 1


# --- X1: same-session parity -------------------------------------------------------


@pytest.mark.parametrize("cell", _CELLS, ids=lambda c: f"{c['track']}:{c['combo']}")
def test_x1_mcp_outline_equals_spa_outline_for_one_session(client, db, cell):
    # TAMPER T1 (reverse the HTTP outline list) / T2 (reverse _outline_items) ->
    # the ordered tag lists differ -> red.
    _seed(db, cell["track"], cell["flags"], cell["direction"], cell["chainContext"])
    for tag in MCP_STEPS:
        _mcp_complete(tag)

    _assert_same_session_parity(client, cell["track"], cell["ts"])


@pytest.mark.parametrize("label,flags", _FLAG_PAIR, ids=[label for label, _ in _FLAG_PAIR])
def test_x1_genie_accelerator_include_lakehouse_on_and_off(client, db, label, flags):
    golden = _cell("genie-accelerator", "flags:includeLakehouse" if flags["includeLakehouse"] else "default")
    _seed(db, "genie-accelerator", flags)
    for tag in MCP_STEPS:
        _mcp_complete(tag)

    _assert_same_session_parity(client, "genie-accelerator", golden["ts"])


# --- X2: status agreement after mixed-surface progress ------------------------------


def test_x2_mcp_and_app_completions_read_back_identically(client, db):
    # TAMPER T4 (update-metadata skips the completed-gates write) -> step B never
    # reaches the row -> neither path reports it done -> red.
    track = "genie-accelerator"
    _seed(db, track)
    step_a, step_b = "project_setup", "prd_generation"

    _mcp_complete(step_a)  # step A via MCP

    # Step B via the App: the SPA posts the complete gate set it now holds, with
    # the set it last saw as the merge base (D-12, the #90 path).
    seen = list(db.row["completed_gates"])
    resp = client.post(
        "/api/session/update-metadata",
        json={
            "session_id": SESSION_ID,
            "completed_gates": [*seen, step_b],
            "base_completed_gates": seen,
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json().get("success") is True, resp.json()

    started, via_items = _mcp_outlines(track)
    http = _http_outline(client, track)
    assert started == via_items == http
    status = dict(http)
    assert status[step_a] == "done" and status[step_b] == "done", status
    assert Counter(s for _, s in started) == Counter(s for _, s in http)
    # vibe_next_step walks the same outline: its next step is the SPA's current one.
    current = [tag for tag, s in http if s == "current"]
    nxt = mcp_server.vibe_next_step(SESSION_ID)
    assert current and nxt.model_dump().get("sectionTag") == current[0], (current, nxt)


# --- X3: no number-key consumers ------------------------------------------------------

# A direct read of the SPA's numeric step sets. The sets are Set<number> keyed by
# global step number; the gate (sectionTag) set is the cross-surface truth.
_NUMERIC_READ = re.compile(r"\b(completedSteps|skippedSteps)\??\.(has|size|forEach|values|keys|entries)\b")

# file -> (exact count of direct numeric reads, why they are allowed). Every set
# these reads see is gate-derived: App hydrates completedSteps/skippedSteps from
# deriveCompletedStepNumbers/deriveSkippedStepNumbers(completed_gates /
# skipped_gates), plus the step-1 intent overlay pinned by X3c, and WorkflowDiagram receives the mergeStatus projection of the
# endpoint outline (pinned by test_x3_numeric_sets_are_gate_derived).
NUMERIC_READ_ALLOWLIST = {
    "src/App.tsx": (1, "header progress count (completedSteps.size), display only"),
    "src/components/WorkflowDiagram.tsx": (
        133,
        "renders the number-addressed step components from the mergeStatus-projected set",
    ),
    "src/components/SectionedWorkflowSidebar.tsx": (
        4,
        "sidebar ticks; receives WorkflowDiagram's projected completedSteps prop",
    ),
    "src/components/SectionDetailPanel.tsx": (
        2,
        "section detail ticks; receives WorkflowDiagram's projected completedSteps prop",
    ),
    "src/constants/scoring.ts": (2, "pure points calculator over the caller's (projected) sets"),
    "src/constants/workflowSections.ts": (
        2,
        "climb-chain inference from APP_LAKEBASE_STEPS over a gate-derived set",
    ),
}


def _frontend_sources():
    src = REPO_ROOT / "src"
    for path in sorted(src.rglob("*")):
        if path.suffix not in (".ts", ".tsx") or "backend" in path.relative_to(src).parts:
            continue
        yield path.relative_to(REPO_ROOT).as_posix(), path.read_text(encoding="utf-8")


def test_x3_every_numeric_step_set_read_is_allowlisted():
    # TAMPER T3 (add `completedSteps.has(999)` to any scanned file) -> red.
    found = {}
    for rel, text in _frontend_sources():
        count = len(_NUMERIC_READ.findall(text))
        if count:
            found[rel] = count
    expected = {rel: count for rel, (count, _why) in NUMERIC_READ_ALLOWLIST.items()}
    assert found == expected, (
        "numeric step-set reads changed; route a new consumer through the gate-derived "
        "helpers or allowlist it with a reason (and update the count when one is removed)"
    )
    assert all(why.strip() for _count, why in NUMERIC_READ_ALLOWLIST.values())


# X3b: copy-based reads of the same sets escape _NUMERIC_READ, so they are pinned
# separately: Array.from(...), new Set(...) and spread of completedSteps/skippedSteps.
_NUMERIC_COPY = re.compile(
    r"(?:Array\.from\(\s*|new Set\(\s*|\.\.\.\s*)(completedSteps|skippedSteps)\b"
)

# file -> (exact count of copy-based reads, why they are allowed). Measured at 3d5b700.
NUMERIC_COPY_ALLOWLIST = {
    "src/App.tsx": (
        8,
        "direction lock and level-switch guards (step >= 4 / >= 2 thresholds), the "
        "initial expanded step, and the stepNumbersToGates writes (toggle skipped_gates "
        "and handleSaveSession); includes one comment line naming WorkflowDiagram's seeds",
    ),
    "src/components/LevelSelector.tsx": (
        1,
        "hasStartedWorkflow (any step >= 2) path-lock threshold over the completedSteps prop",
    ),
    "src/components/WorkflowDiagram.tsx": (
        8,
        "toggle/reset/skip handler seeds over the mergeStatus-projected prop; the next set "
        "goes back to App and is written through stepNumbersToGates",
    ),
    "src/constants/scoring.ts": (3, "pure points calculator normalising the caller's (projected) sets"),
}

# X3c: a numeric literal added to a completed/skipped step set bypasses the gates.
_NUMERIC_ADD = re.compile(r"\b\w*(?:[Cc]ompleted|[Ss]kipped)\w*\??\.add\(\s*\d+\s*\)")

# file -> (exact count of numeric-literal adds, why they are allowed). All are the
# step-1 "Define Your Intent" credit (ALL_STEPS[1], gate usecase_selection). They
# are not display-only: stepNumbersToGates writes step 1 back as usecase_selection.
NUMERIC_ADD_ALLOWLIST = {
    "src/App.tsx": (
        2,
        "step-1 intent overlay on both hydration paths when industry and use_case are set; "
        "persisted as the usecase_selection gate on the next gate write",
    ),
    "src/components/WorkflowDiagram.tsx": (
        1,
        "the learner picks a use case: step 1 completes, written as usecase_selection",
    ),
}


def _scan_counts(pattern):
    found = {}
    for rel, text in _frontend_sources():
        count = len(pattern.findall(text))
        if count:
            found[rel] = count
    return found


def test_x3b_every_numeric_step_set_copy_is_allowlisted():
    # TAMPER (add `const copy = Array.from(completedSteps);` to any scanned file) -> red.
    expected = {rel: count for rel, (count, _why) in NUMERIC_COPY_ALLOWLIST.items()}
    assert _scan_counts(_NUMERIC_COPY) == expected, (
        "copy-based numeric step-set reads changed; route a new consumer through the "
        "gate-derived helpers or allowlist it with a reason (and update the count)"
    )
    assert all(why.strip() for _count, why in NUMERIC_COPY_ALLOWLIST.values())


def test_x3c_every_numeric_step_literal_add_is_allowlisted():
    # TAMPER (add `completedSteps.add(7);` to any scanned file) -> red.
    expected = {rel: count for rel, (count, _why) in NUMERIC_ADD_ALLOWLIST.items()}
    assert _scan_counts(_NUMERIC_ADD) == expected, (
        "numeric-literal adds to a completed/skipped step set changed; a new one "
        "credits a step by number, not by gate"
    )
    assert all(why.strip() for _count, why in NUMERIC_ADD_ALLOWLIST.values())
    # Every allowlisted add is step 1, and step 1 is the usecase_selection gate.
    for rel in NUMERIC_ADD_ALLOWLIST:
        text = (REPO_ROOT / rel).read_text(encoding="utf-8")
        assert all(re.search(r"\.add\(\s*1\s*\)$", m) for m in _NUMERIC_ADD.findall(text)), rel
    sections = (REPO_ROOT / "src" / "constants" / "workflowSections.ts").read_text(encoding="utf-8")
    assert re.search(r"\n\s*1: \{ number: 1,[^\n]*sectionTag: 'usecase_selection'", sections)


# X3d: X3c keys on the receiver's name, so a numeric literal added to a copy held
# under another name (e.g. `newSet.add(5)`) escapes it. This pins every
# numeric-literal `.add(<n>)` on ANY receiver, step set or not, so a new one shows
# up for review.
_ANY_NUMERIC_ADD = re.compile(r"\b[A-Za-z_]\w*\??\.add\(\s*\d+\s*\)")

# file -> (exact count of numeric-literal adds on any receiver, why). Measured at a175f3a.
NUMERIC_ANY_ADD_ALLOWLIST = {
    "src/App.tsx": (
        2,
        "restoredCompleted.add(1) (restoreSession) and loadedCompleted.add(1) (session "
        "load): the step-1 intent overlay over the deriveCompletedStepNumbers set when "
        "industry and use_case are set; written back as usecase_selection by stepNumbersToGates",
    ),
    "src/components/WorkflowDiagram.tsx": (
        2,
        "newCompletedSteps.add(1) in handlePromptGenerated (the learner picks a use case: "
        "step 1, passed up via onCompletedStepsChange and written as usecase_selection); "
        "visibleStepNumbers.add(1) in triggerCelebration is a visibility set for chapter "
        "completion, not a completion set, and is never persisted",
    ),
}


def test_x3d_every_numeric_literal_add_on_any_receiver_is_allowlisted():
    # TAMPER (add `newSet.add(5);` inside handleSetUpProjectComplete in WorkflowDiagram.tsx) -> red.
    expected = {rel: count for rel, (count, _why) in NUMERIC_ANY_ADD_ALLOWLIST.items()}
    assert _scan_counts(_ANY_NUMERIC_ADD) == expected, (
        "numeric-literal .add(<n>) calls changed; a new one may credit a step by number "
        "through a copy, so allowlist it with a reason (and update the count)"
    )
    assert all(why.strip() for _count, why in NUMERIC_ANY_ADD_ALLOWLIST.values())


# X3e: a for-of over a completed/skipped set is a copy-like read _NUMERIC_COPY misses.
_NUMERIC_FOR_OF = re.compile(
    r"for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+[\w.]*?(completedSteps|skippedSteps)\b"
)

# file -> (exact count of for-of reads, why they are allowed). Measured at a175f3a.
NUMERIC_FOR_OF_ALLOWLIST = {
    "src/constants/scoring.ts": (
        1,
        "getCompletedChapter merges the caller's (projected) skippedSteps into a local "
        "allDone set for the chapter-done check; pure, never persisted",
    ),
}


def test_x3e_every_numeric_step_set_for_of_is_allowlisted():
    # TAMPER (add `for (const s of completedSteps) { void s; }` to App.tsx) -> red.
    expected = {rel: count for rel, (count, _why) in NUMERIC_FOR_OF_ALLOWLIST.items()}
    assert _scan_counts(_NUMERIC_FOR_OF) == expected, (
        "for-of reads of the numeric step sets changed; route a new consumer through the "
        "gate-derived helpers or allowlist it with a reason (and update the count)"
    )
    assert all(why.strip() for _count, why in NUMERIC_FOR_OF_ALLOWLIST.values())


def test_x3_numeric_sets_are_gate_derived():
    app = (REPO_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
    # Hydration: both load paths derive the numeric sets from the gate columns.
    assert len(re.findall(r"deriveCompletedStepNumbers\(\s*response\.completed_gates", app)) == 2
    assert len(re.findall(r"deriveSkippedStepNumbers\(\s*response\.skipped_gates", app)) == 2
    # Every set*Steps call takes a derived set, a fresh empty set, or a handler's
    # next set (the toggles grow the projected set WorkflowDiagram passes up).
    allowed_args = {
        "restoredCompleted", "loadedCompleted", "new Set()", "newSteps",
        "new Set(skippedStepsArray)", "new Set(loadedSkippedSteps)", "newSkipped",
    }
    args = re.findall(r"set(?:Completed|Skipped)Steps\(([^;]*?)\);", app)
    assert args and set(args) <= allowed_args, args
    # The numeric set WorkflowDiagram renders from is the endpoint projection.
    assert re.search(r"projectedCompletedSteps = useMemo\(\s*\(\) => mergeStatus\(", app)
    assert "completedSteps={projectedCompletedSteps}" in app
    # Writes go back as gates, never as numbers.
    assert "completed_gates: stepNumbersToGates(" in app
    for _rel, text in _frontend_sources():
        assert "completed_steps" not in text
