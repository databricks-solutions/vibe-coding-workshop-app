"""D12 PR 2: server-built coach visuals on ``vibe_explain_step`` (spec §3.3-§3.7, §6.1).

Offline: the model and Lakebase are mocked (``env`` from test_coaching); the
twin tests reuse PR 1's seeded ``mcp_store``. A1-A15 map to the plan's
acceptance contract (docs/superpowers/plans/2026-10-13-coach-visuals.md).

Tampers (each turns the named test red):
- remove the try/except in build_visual -> test_fail_open
- make visuals_enabled() always True -> test_kill_switch
- drop the visual kind from the coaching cache key -> test_coaching.py::test_c8_cache_and_single_flight
- call coach() on a visual-only request -> test_no_model_call_for_visual_only
- label from captured_outputs[key] instead of key_label(key) -> test_firewall
- pad a downstream line to 61 characters -> test_builders_snapshot
- why/auto -> progress table -> test_selection_matrix
- change one word of the description -> test_mcp_contract.py::test_exactly_seven_tools_with_contract_metadata
- gate the PR 1 twin swap on visuals_enabled() -> test_kill_switch_twin_swap
- put the visual text into build_context -> test_context_contains_only_kind_and_caption
- drop the MLflow casing in key_label -> test_labels_max_length
"""

import asyncio
import hashlib
import inspect
import re

import jsonschema
import pytest

from src.backend import mcp_server
from src.backend.services import coach_visuals as cv
from src.backend.services import coaching
from src.backend.workshop import engine, visuals

from .test_app_family_genie_forks import seeded, store  # noqa: F401  (fixtures)
from .test_coaching import CLEAN, SESSION_ID, TAG, _clean, env  # noqa: F401  (fixtures)
from .test_mcp_visual_twins import _fresh_twins, _session, _twin_text, mcp_store  # noqa: F401

GENIE = "genie-accelerator"
BEAT = mcp_server._INTENT_BEAT_STEP
CAPTION = visuals.DIAGRAM_CAPTION
TRIPLE = ("visual", "visual_kind", "visual_caption")
# Built at runtime; short and lint-clean, so a leak would pass the lint and show.
TOKEN = "Qz" + "Firewall" + "7x"


@pytest.fixture(autouse=True)
def _visuals_on(monkeypatch):
    monkeypatch.delenv("VIBE_COACH_VISUALS_ENABLED", raising=False)


def _tags(track):
    return [step.sectionTag for step in engine._ordered_steps(track, engine.SessionState())]


def _step(track, tag):
    if tag == BEAT.sectionTag:
        return BEAT
    return next(step for step in engine.MANIFEST.track_steps(track) if step.sectionTag == tag)


def _state(done=(), captured=None, use_case=True, params=None):
    gates = ([engine.USE_CASE_GATE] if use_case else []) + list(done)
    return engine.SessionState(
        completed_gates=gates, captured_outputs=dict(captured or {}), session_parameters=dict(params or {})
    )


def _states(track):
    tags = _tags(track)
    return {
        "fresh": (_state(use_case=False), True),
        "mid": (_state(tags[:3], {"use_case_brief": "x", "prd_document": "y"}), False),
        "all_done": (_state(tags, {"use_case_brief": "x", "prd_document": "y"}), False),
        "blocked": (_state(["project_setup"], use_case=False), True),
        # D-98: a skipped step stays in n but is never a row.
        "skipped": (_state(params={"skipped_gates": ["project_setup"]}), False),
    }


def _shape(track, state_name, shape, tag, served=""):
    state, needs = _states(track)[state_name]
    request = cv._Request(_step(track, tag), state, track, served, needs, BEAT.title)
    return cv.BUILDERS[shape](request)


def _build(track, tag, state, needs, focus, visual, served=""):
    return cv.build_visual(
        step=_step(track, tag),
        state=state,
        track=track,
        focus=focus,
        visual=visual,
        served_how_to_apply=served,
        needs_use_case=needs,
        beat_title=BEAT.title,
    )


def _diagram(*lines):
    return "\n".join(["```text", *lines, "```"])


def _chain(*titles):
    lines = []
    for i, title in enumerate(titles):
        lines += (["│", "▼"] if i else []) + [title]
    return _diagram(*lines)


# --- A2: lint rules PR 1 did not already pin ----------------------------------------


TABLE_LINT_CASES = [
    # (rule, passing text, failing text)
    ("header and separator", "| a | b |\n|---|---|", "| a | b |"),
    ("pipe edges", "| a | b |\n|---|---|\n| x | y |", "| a | b |\n|---|---|\nx | y |"),
    ("cells match the header", "| a | b |\n|---|---|\n| x | y |", "| a | b |\n|---|---|\n| x | y | z |"),
    ("no placeholder in a cell", "| a | b |\n|---|---|\n| gold | y |", "| a | b |\n|---|---|\n| {catalog} | y |"),
    ("no tab", "| a | b |\n|---|---|\n| x | y |", "| a | b |\n|---|---|\n| x\t| y |"),
    ("no trailing whitespace", "| a | b |\n|---|---|\n| x | y |", "| a | b |\n|---|---|\n| x | y | "),
]


@pytest.mark.parametrize(("rule", "good", "bad"), TABLE_LINT_CASES, ids=[c[0] for c in TABLE_LINT_CASES])
def test_lint_table_rules(rule, good, bad):
    assert visuals.lint_visual(good, "table", "Takeaway.") == [], rule
    assert visuals.lint_visual(bad, "table", "Takeaway.") != [], rule


def test_lint_diagram_fence_inside():
    assert visuals.lint_visual(_diagram("a", "```", "b"), "diagram", CAPTION) != []


# --- A3: builder snapshots ---------------------------------------------------------------


PROGRESS_FRESH = """| Step | Status |
|---|---|
| **Define Your Use Case** | **Now** |
| Set Up Project | Next |
| PRD Generation | Next |
| 22 more steps | Later |"""
PROGRESS_MID = """| Step | Status |
|---|---|
| Locate Data & Bring Context | Done |
| **Profile Your Schema** | **Now** |
| Measures Analysis | Next |
| Draft the Metric View | Next |
| 18 more steps | Later |"""
PROGRESS_ALL_DONE = """| Step | Status |
|---|---|
| Deploy & Validate | Done |
| Iterate & Enhance | Done |
| Redeploy & Test | Done |
| Workspace Clean Up | Done |"""
PROGRESS_BLOCKED = """| Step | Status |
|---|---|
| Set Up Project | Done |
| **Define Your Use Case** | **Now** |
| PRD Generation | Next |
| Locate Data & Bring Context | Next |
| 21 more steps | Later |"""
PROGRESS_SKIPPED = """| Step | Status |
|---|---|
| **PRD Generation** | **Now** |
| Locate Data & Bring Context | Next |
| Profile Your Schema | Next |
| 20 more steps | Later |"""
UNBLOCK_DASHBOARD = """| Kind | Needs | Status |
|---|---|---|
| Previous step | Draft the Metric View | {gate} |
| Input | Metric view | Missing |
| Input | PRD document | {prd} |"""
UNBLOCK_READY = """| Kind | Needs | Status |
|---|---|---|
| None | Nothing blocks this step | Ready |"""
UNBLOCK_PRD = """| Kind | Needs | Status |
|---|---|---|
| Use case | Use case locked | Not done |
| Input | Use case brief | Missing |"""
DASHBOARD_CHAIN = _chain("AI/BI Dashboard", "Choose What to Activate", "Design & Provision Synced Tables")
BUILT_MID = _chain("Set Up Project", "PRD Generation ─▶ PRD document", "Locate Data & Bring Context")
BUILT_ALL_DONE = _chain(
    "Wire to Lakebase ─▶ Activation wire lakebase",
    "Wire Genie",
    "Deploy & Validate",
    "Iterate & Enhance ─▶ Iteration plan",
    "Redeploy & Test",
    "Workspace Clean Up",
)

GENIE_SNAPSHOTS = [
    # (state, shape, tag, expected (text, kind, caption) or None)
    ("fresh", "progress", "gaccel_dashboard", (PROGRESS_FRESH, "table", "0 of 24 steps done. Now: Define Your Use Case.")),
    ("mid", "progress", "gaccel_dashboard", (PROGRESS_MID, "table", "3 of 24 steps done. Now: Profile Your Schema.")),
    ("all_done", "progress", "gaccel_dashboard", (PROGRESS_ALL_DONE, "table", "All 24 steps done.")),
    ("blocked", "progress", "gaccel_dashboard", (PROGRESS_BLOCKED, "table", "1 of 24 steps done. Now: Define Your Use Case.")),
    ("skipped", "progress", "gaccel_dashboard", (PROGRESS_SKIPPED, "table", "0 of 24 steps done. Now: PRD Generation.")),
    ("skipped", "built", "gaccel_dashboard", None),
    ("fresh", "unblock", "gaccel_dashboard",
     (UNBLOCK_DASHBOARD.format(gate="Not done", prd="Missing"), "table", "0 of 3 needs met.")),
    ("mid", "unblock", "gaccel_dashboard",
     (UNBLOCK_DASHBOARD.format(gate="Not done", prd="Present"), "table", "1 of 3 needs met.")),
    ("all_done", "unblock", "gaccel_dashboard",
     (UNBLOCK_DASHBOARD.format(gate="Done", prd="Present"), "table", "2 of 3 needs met.")),
    ("blocked", "unblock", "prd_generation", (UNBLOCK_PRD, "table", "0 of 2 needs met.")),
    ("mid", "unblock", "semlayer_locate", (UNBLOCK_READY, "table", "0 of 0 needs met.")),
    ("mid", "downstream", "gaccel_dashboard",
     (DASHBOARD_CHAIN, "diagram", f"{CAPTION} Steps that build on AI/BI Dashboard.")),
    # Consumers of prd_document, transitively, capped at 5 nodes.
    ("mid", "downstream", "prd_generation",
     (_chain("PRD Generation", "AI/BI Dashboard", "Choose What to Activate",
             "Design & Provision Synced Tables", "Design Analytics App"),
      "diagram", f"{CAPTION} Steps that build on PRD Generation.")),
    # Nothing consumes it: the next 4 outline steps.
    ("mid", "downstream", "semlayer_locate",
     (_chain("Locate Data & Bring Context", "Profile Your Schema", "Measures Analysis",
             "Draft the Metric View", "Review & Expand Synonyms"),
      "diagram", f"{CAPTION} Steps that build on Locate Data & Bring Context.")),
    # The intent beat is not in the outline; its use_case_brief feeds PRD Generation.
    ("fresh", "downstream", BEAT.sectionTag,
     (_chain("Define Your Use Case", "PRD Generation", "AI/BI Dashboard", "Choose What to Activate",
             "Design & Provision Synced Tables"),
      "diagram", f"{CAPTION} Steps that build on Define Your Use Case.")),
    # The last step: a chain of itself only is no visual.
    ("mid", "downstream", "workspace_cleanup", None),
    ("fresh", "built", "gaccel_dashboard", None),
    ("mid", "built", "gaccel_dashboard", (BUILT_MID, "diagram", f"{CAPTION} What you have built so far.")),
    ("all_done", "built", "gaccel_dashboard", (BUILT_ALL_DONE, "diagram", f"{CAPTION} What you have built so far.")),
    ("blocked", "built", "gaccel_dashboard", (_diagram("Set Up Project"), "diagram", f"{CAPTION} What you have built so far.")),
    # No served twin for this call: curated falls back to the downstream chain.
    ("mid", "curated", "gaccel_dashboard",
     (DASHBOARD_CHAIN, "diagram", f"{CAPTION} Steps that build on AI/BI Dashboard.")),
]

def _check(built, expected):
    if expected is None:
        assert built is None
        return
    assert built is not None
    assert (built.text, built.kind, built.caption) == expected
    assert visuals.lint_visual(built.text, built.kind, built.caption) == []


@pytest.mark.parametrize(("state", "shape", "tag", "expected"), GENIE_SNAPSHOTS,
                         ids=[f"{c[0]}-{c[1]}-{c[2]}" for c in GENIE_SNAPSHOTS])
def test_builders_snapshot(state, shape, tag, expected):
    _check(_shape(GENIE, state, shape, tag), expected)
    # Through build_visual too, so the lint gate is on the snapshot path.
    if expected is not None and shape != "curated":
        focus, visual = {
            "progress": ("what_now", "table"),
            "unblock": ("unblock", "table"),
            "downstream": ("why", "diagram"),
            "built": ("review", "diagram"),
        }[shape]
        st, needs = _states(GENIE)[state]
        _check(_build(GENIE, tag, st, needs, focus, visual), expected)


def test_builders_snapshot_app_only():
    tags = _tags("app-only")
    mid = _state(tags[:2], {"prd_document": "x"})
    req = lambda tag: cv._Request(_step("app-only", tag), mid, "app-only", "", False, BEAT.title)  # noqa: E731
    _check(cv._progress(req("prd_generation")), (
        "| Step | Status |\n|---|---|\n| PRD Generation | Done |\n| **UI Design** | **Now** |\n"
        "| Deploy App | Next |\n| Iterate & Enhance | Next |\n| 2 more steps | Later |",
        "table", "2 of 7 steps done. Now: UI Design.",
    ))
    _check(cv._unblock(req("cursor_copilot_ui_design")), (
        "| Kind | Needs | Status |\n|---|---|---|\n| Previous step | PRD Generation | Done |",
        "table", "1 of 1 needs met.",
    ))
    _check(cv._downstream(req("prd_generation")), (
        _chain("PRD Generation", "UI Design", "Deploy App", "Iterate & Enhance", "Redeploy & Test"),
        "diagram", f"{CAPTION} Steps that build on PRD Generation.",
    ))
    _check(cv._downstream(req("iterate_enhance")), (
        _chain("Iterate & Enhance", "Redeploy & Test"),
        "diagram", f"{CAPTION} Steps that build on Iterate & Enhance.",
    ))
    _check(cv._built(req("prd_generation")), (
        _chain("Set Up Project", "PRD Generation ─▶ PRD document"),
        "diagram", f"{CAPTION} What you have built so far.",
    ))


def test_progress_denominator_counts_skipped_steps():
    """D-98 regression: n is the full outline length, skipped entries included."""

    state = _state(params={"skipped_gates": ["project_setup"]})
    assert len(engine.outline(GENIE, state)) == 24
    built = _build(GENIE, "prd_generation", state, False, None, "table")
    assert built.caption == "0 of 24 steps done. Now: PRD Generation."
    assert "Set Up Project" not in built.text


def test_progress_all_done_with_one_skipped():
    tags = _tags(GENIE)
    state = _state([t for t in tags if t != "project_setup"], params={"skipped_gates": ["project_setup"]})
    built = _build(GENIE, "prd_generation", state, False, "what_now", "table")
    assert built.caption == "23 of 24 steps done. The rest were skipped."
    assert built.text == PROGRESS_ALL_DONE
    # With nothing skipped, all done still reads "All <n> steps done."
    done = _state(tags)
    assert _build(GENIE, "prd_generation", done, False, "what_now", "table").caption == "All 24 steps done."


def test_unblock_overflow_row():
    step = engine.MANIFEST.track_steps(GENIE)[0]
    many = type(step)(order=1, sectionTag="x", title="X", requiresGate="project_setup",
                      consumes=[f"key_{i}" for i in range(9)])
    built = cv._unblock(cv._Request(many, _state(), GENIE, "", False, BEAT.title))
    rows = built.text.split("\n")[2:]
    assert len(rows) == 8
    assert rows[-1] == "| Input | 3 more inputs | See step |"
    assert built.caption == "0 of 10 needs met."
    assert visuals.lint_visual(built.text, built.kind, built.caption) == []


@pytest.mark.parametrize("track", sorted(engine.MANIFEST.tracks))
def test_every_visual_passes_lint(track):
    """Every shape, on every step and fixed state of every track, lints clean."""

    seen = 0
    for tag in [BEAT.sectionTag, *_tags(track)]:
        for state_name in _states(track):
            for shape in cv.BUILDERS:
                built = _shape(track, state_name, shape, tag)
                if built is not None:
                    seen += 1
                    assert visuals.lint_visual(built.text, built.kind, built.caption) == [], (tag, shape)
    assert seen


# --- A4: selection (spec §3.4) -------------------------------------------------------------


SELECTION_CELLS = [
    ("what_now", "auto", "progress"), ("what_now", "table", "progress"), ("what_now", "diagram", "curated"),
    ("why", "auto", "curated"), ("why", "table", "progress"), ("why", "diagram", "curated"),
    ("unblock", "auto", "unblock"), ("unblock", "table", "unblock"), ("unblock", "diagram", "curated"),
    ("review", "auto", "built"), ("review", "table", "progress"), ("review", "diagram", "built"),
    (None, "auto", None), (None, "table", "progress"), (None, "diagram", "curated"),
    # "none", and the defaults: auto with focus, none without.
    ("what_now", "none", None), (None, "none", None),
    ("what_now", None, "progress"), ("why", None, "curated"), ("unblock", None, "unblock"),
    ("review", None, "built"), (None, None, None),
]


@pytest.mark.parametrize(("focus", "visual", "shape"), SELECTION_CELLS)
def test_selection_matrix(focus, visual, shape):
    assert cv.select_shape(focus, visual) == shape


def test_curated_uses_the_served_twin_only(mcp_store):
    sid = _session(mcp_store, GENIE, "s-curated")
    twin = _twin_text("semlayer_metric_view.how_to_apply.1")
    result = mcp_server.vibe_explain_step(sid, "semlayer_metric_view", visual="diagram")
    assert result.visual == twin
    assert result.visual_kind == "diagram"
    assert result.visual_caption == f"{CAPTION} How Draft the Metric View fits together."
    # D-95: a twin the call did not serve (edited row) is never shown.
    step = _step(GENIE, "semlayer_metric_view")
    stale = cv._curated(cv._Request(step, _state(), GENIE, "edited row", False, BEAT.title))
    assert stale.text != twin and stale.caption.startswith(f"{CAPTION} Steps that build on")


def test_curated_table_twin_caption(monkeypatch):
    table = "| a | b |\n|---|---|\n| x | y |"
    monkeypatch.setattr(cv, "twin_visual", lambda name: (table, "table"))
    step = _step(GENIE, "semlayer_profile")
    built = cv._curated(cv._Request(step, _state(), GENIE, f"before\n{table}\nafter", False, BEAT.title))
    assert (built.text, built.kind, built.caption) == (table, "table", "How Profile Your Schema fits together.")


# --- A5: legacy (no focus, no visual) ------------------------------------------------------


def test_legacy_no_focus_no_visual(env, monkeypatch):
    calls = []
    monkeypatch.setattr(cv, "BUILDERS", {name: lambda r: calls.append(r) for name in cv.BUILDERS})
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG)
    assert {k: getattr(result, k) for k in TRIPLE} == dict.fromkeys(TRIPLE)
    assert (result.coaching, result.focus, result.grounded_on, result.is_fallback) == (None, None, [], False)
    assert calls == [] and env.calls == []


# --- A6: fail-open -------------------------------------------------------------------------------


def test_fail_open(env, monkeypatch, caplog):
    caplog.set_level("WARNING", logger=cv.logger.name)

    def boom(request):
        raise RuntimeError(f"leak {TOKEN}")

    monkeypatch.setattr(cv, "BUILDERS", {**cv.BUILDERS, "progress": boom})
    state, needs = _states(GENIE)["mid"]
    assert _build(GENIE, TAG, state, needs, "what_now", "table") is None
    records = [r for r in caplog.records if r.name == cv.logger.name]
    assert [r.getMessage() for r in records] == [f"Coach visual failed section={TAG} shape=progress"]
    assert records[0].exc_info is None

    # Through the tool: coaching is still returned, the triple is null, no error.
    caplog.clear()
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="what_now")
    assert isinstance(result, mcp_server.StepHelpResult)
    assert result.coaching == CLEAN and result.is_fallback is False
    assert {k: getattr(result, k) for k in TRIPLE} == dict.fromkeys(TRIPLE)
    assert all(TOKEN not in r.getMessage() for r in caplog.records)


def test_fail_open_on_lint(env, monkeypatch, caplog):
    caplog.set_level("WARNING", logger=cv.logger.name)
    bad = cv.Visual(_diagram("x" * 61), "diagram", CAPTION)
    monkeypatch.setattr(cv, "BUILDERS", {**cv.BUILDERS, "built": lambda request: bad})
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="review")
    assert result.coaching == CLEAN
    assert {k: getattr(result, k) for k in TRIPLE} == dict.fromkeys(TRIPLE)
    assert [r.getMessage() for r in caplog.records if r.name == cv.logger.name] == [
        f"Coach visual failed lint section={TAG} shape=built"
    ]


def test_fail_open_call_site(env, monkeypatch):
    def boom(**kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(mcp_server.coach_visuals, "build_visual", boom)
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why", visual="diagram")
    assert isinstance(result, mcp_server.StepHelpResult) and result.coaching == CLEAN
    assert {k: getattr(result, k) for k in TRIPLE} == dict.fromkeys(TRIPLE)


# --- A7: kill switch ------------------------------------------------------------------------------


@pytest.mark.parametrize("value", ["0", "false", "OFF", " no "])
def test_kill_switch(env, monkeypatch, value):
    state, needs = _states(GENIE)["mid"]
    assert _build(GENIE, TAG, state, needs, "what_now", "table") is not None
    monkeypatch.setenv("VIBE_COACH_VISUALS_ENABLED", value)
    assert cv.visuals_enabled() is False
    assert _build(GENIE, TAG, state, needs, "what_now", "table") is None
    for focus, visual in (("what_now", None), (None, "table"), ("why", "diagram")):
        result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus=focus, visual=visual)
        assert {k: getattr(result, k) for k in TRIPLE} == dict.fromkeys(TRIPLE)
    # Any other value leaves visuals on.
    monkeypatch.setenv("VIBE_COACH_VISUALS_ENABLED", "1")
    assert cv.visuals_enabled() is True
    assert mcp_server.vibe_explain_step(SESSION_ID, TAG, visual="table").visual_kind == "table"


def test_kill_switch_twin_swap(mcp_store, monkeypatch):
    """The PR 1 twin swap is a defect fix, not behind the visuals switch (§3.7)."""

    monkeypatch.setenv("VIBE_COACH_VISUALS_ENABLED", "0")
    sid = _session(mcp_store, GENIE, "s-kill")
    twin = _twin_text("semlayer_metric_view.how_to_apply.1")
    result = mcp_server.vibe_explain_step(sid, "semlayer_metric_view", visual="diagram")
    assert f"{twin}\n\n{CAPTION}" in result.how_to_apply
    assert "```mermaid" not in result.how_to_apply
    assert result.visual is None


# --- A8: a visual-only request makes no model call -----------------------------------------


@pytest.mark.parametrize("visual", ["table", "diagram"])
def test_no_model_call_for_visual_only(env, monkeypatch, visual):
    coach_calls = []
    monkeypatch.setattr(mcp_server.coaching, "coach", lambda **kw: coach_calls.append(kw))
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, visual=visual)
    assert result.visual_kind == visual and result.visual and result.visual_caption
    assert (result.coaching, result.focus, result.is_fallback) == (None, None, False)
    assert coach_calls == [] and env.calls == [] and env.telemetry == []


# --- A9: the firewall --------------------------------------------------------------------------------


def _every_key():
    keys = {engine.USE_CASE_BRIEF}
    for track in engine.MANIFEST.tracks:
        for step in engine.MANIFEST.track_steps(track):
            keys.update(step.consumes)
            if step.produces:
                keys.add(step.produces)
    return keys


@pytest.mark.parametrize("track", sorted(engine.MANIFEST.tracks))
def test_firewall(track):
    """A value planted in every captured output and parameter never reaches a visual."""

    captured = dict.fromkeys(_every_key(), TOKEN)
    params = {"industry": TOKEN, "use_case": TOKEN, "use_case_label": TOKEN, "user_email": TOKEN}
    tags = _tags(track)
    states = [
        (_state(captured=captured, params=params, use_case=False), True),
        (_state(tags[: len(tags) // 2], captured, params=params), False),
        (_state(tags, captured, params=params), False),
        (_state(captured=captured, params={**params, "skipped_gates": tags[:1]}), False),
    ]
    served = f"how to apply {TOKEN}"
    built_any = 0
    for tag in [BEAT.sectionTag, *tags]:
        for state, needs in states:
            for shape in cv.BUILDERS:
                built = cv.BUILDERS[shape](
                    cv._Request(_step(track, tag), state, track, served, needs, BEAT.title)
                )
                if built is None:
                    continue
                built_any += 1
                assert TOKEN not in built.text and TOKEN not in built.caption, (tag, shape)
            for focus, visual in [(f, v) for f in (None, *coaching.FOCI) for v in ("auto", "table", "diagram")]:
                built = _build(track, tag, state, needs, focus, visual, served)
                if built is not None:
                    assert TOKEN not in built.text and TOKEN not in built.caption, (tag, focus, visual)
    assert built_any


def test_firewall_through_the_tool(env):
    record = env.store[SESSION_ID]
    record["captured_outputs"] = dict.fromkeys(_every_key(), TOKEN)
    record["session_parameters"] = {"industry": TOKEN, "use_case": TOKEN}
    for focus in (None, *coaching.FOCI):
        for visual in ("auto", "table", "diagram"):
            result = mcp_server.vibe_explain_step(SESSION_ID, "gaccel_dashboard", focus=focus, visual=visual)
            assert TOKEN not in (result.visual or "") and TOKEN not in (result.visual_caption or "")


def test_labels_max_length():
    """Every title and key label fits a cell by construction (r1 f), MLflow cased (d-93a)."""

    labels = set()
    for track in engine.MANIFEST.tracks:
        for step in engine.MANIFEST.track_steps(track):
            assert len(step.title) <= visuals.MAX_CELL, step.title
            assert len(f"**{step.title}**") <= visuals.MAX_CELL, step.title
            labels.update(cv.key_label(key) for key in [*step.consumes, step.produces] if key)
    assert len(f"**{BEAT.title}**") <= visuals.MAX_CELL
    for label in labels:
        assert len(label) <= visuals.MAX_CELL, label
        assert len(f"**{label}**") <= visuals.MAX_CELL, label
        assert not re.search(r"\bmlflow\b", label, re.IGNORECASE) or "MLflow" in label, label
    assert "MLflow evaluation runs and iteration" in labels
    assert cv.key_label("prd_document") == "PRD document"
    assert cv.key_label("mlflow_evaluation_runs_and_iteration") == "MLflow evaluation runs and iteration"
    assert cv.key_label("appkit_chat_feedback_mlflow") == "Appkit chat feedback MLflow"
    assert cv.key_label("uc_resources_foundation") == "UC resources foundation"
    assert cv.key_label("api_id_kpi_sql_bi_er_ui_llm_mcp") == "API ID KPI SQL BI ER UI LLM MCP"
    assert cv.key_label("use_case_brief") == "Use case brief"


# --- A10 lives in test_coaching.py::test_c8_cache_and_single_flight (D-96) ---------------------


# --- A11: contract ---------------------------------------------------------------------------------


def test_contract_visual_argument_and_schema(env):
    tool = {t.name: t for t in mcp_server.mcp._tool_manager.list_tools()}["vibe_explain_step"]
    assert "visual" in tool.parameters["properties"]
    assert "visual" not in tool.parameters.get("required", [])
    assert len(tool.parameters["properties"]) < 8
    for name in TRIPLE:
        assert name in tool.output_schema["properties"], name
    for arguments in (
        {"session_id": SESSION_ID, "sectionTag": TAG, "visual": "table"},
        {"session_id": SESSION_ID, "sectionTag": TAG, "focus": "why", "visual": "diagram"},
    ):
        _, structured = asyncio.run(tool.run(arguments, convert_result=True))
        jsonschema.validate(structured, tool.output_schema)
        assert structured["visual_kind"] == arguments["visual"]
        assert structured["visual"] and structured["visual_caption"]
    with pytest.raises(Exception):
        mcp_server.StepHelpResult(sectionTag="a", title="b", why="", how_to_apply="", expected_output="",
                                  visual_kind="chart")


def test_invalid_visual_is_invalid_parameter(env, monkeypatch):
    loads = []
    monkeypatch.setattr(mcp_server, "load_session", lambda sid: loads.append(sid))
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why", visual="bogus")
    assert result["isError"] is True
    error = result["structuredContent"]["error"]
    assert error["code"] == "INVALID_PARAMETER"
    assert error["message"] == "visual must be one of auto, none, table, diagram."
    assert loads == [] and env.calls == [] and env.telemetry == []


# --- A12: the scrub is byte-identical to base e0078d2 --------------------------------------------


SCRUB_SOURCE_SHA256 = {
    "_has_secret": "84521488ee3aac0186660f06d2d6c37ba1624a48d7e1e4af3b45fcd3b8a7a748",
    "scrub_input": "633f28a41834f63a9fc98e73e1e86c24b2bb2804eae0ee6e685fc2599ea305e3",
    "_ngrams": "206b74e2f82c23155a4b40185f863e0130a78cd8067615f541c621fa10082f30",
    "_labelled": "73b6913538ea51b3bd5e28d3b1b5ceb822b16bfcea06d3228ad96bcb4a5912f5",
    "_scrub_output": "b454ec4dab0097b710606037bc6c878291873420173af1e1ffed3fe96e456c7e",
    "scrub_output_with_reason": "8199d42088e6beb1857b38ecc8569850e519449036f8711387e4c5768a9be47e",
    "scrub_output": "0b08bf42ec0cf54424c16d6b6e485e8013d8186a15320e36fe899618ceaf9305",
}


@pytest.mark.parametrize("name", sorted(SCRUB_SOURCE_SHA256))
def test_scrub_source_unchanged(name):
    source = inspect.getsource(getattr(coaching, name)).rstrip("\n")
    assert hashlib.sha256(source.encode("utf-8")).hexdigest() == SCRUB_SOURCE_SHA256[name]


def test_model_fence_is_still_scrubbed():
    text = "See the diagram:\n```text\nA\n```"
    assert coaching.scrub_output_with_reason(text, forbidden_sources=[]) == (None, "code_fence")


# --- A13: the two nit twins; index.json unchanged -------------------------------------------------


INDEX_SHA256 = "9c754214e7db89857dc2a88389e50c43fdcbeca46452da46d34459a74b6b85f0"  # base e0078d2


def test_index_json_unchanged():
    assert hashlib.sha256(visuals.INDEX_PATH.read_bytes()).hexdigest() == INDEX_SHA256


def test_nit_semlayer_profile_header():
    text = _twin_text("semlayer_profile.expected_output.1")
    assert text.split("\n")[0] == "| Entity | Columns | Relates to |"
    assert "Key columns" not in text
    assert visuals.lint_visual(text, "table", "twin") == []


def test_nit_sync_from_lakebase_alignment():
    text = _twin_text("sync_from_lakebase.how_to_apply.1")
    lines = text.split("\n")
    assert lines[3] == "│  ─▶ your Lakebase clone schema (Delta) ───┐"
    assert "_lakebase schema" not in text
    edge = lines[3].index("┐")
    assert edge == 44 and len(lines[3]) == 45
    for line in lines[4:8]:
        assert line[edge] in "│┤", line
        assert len(line) == len(lines[3])
    assert lines[8].index("┘") == edge
    assert visuals.lint_visual(text, "diagram", CAPTION) == []


# --- build_context / COACH_SYSTEM (§3.6) ---------------------------------------------------------


def test_coach_system_visual_sentence():
    sentence = (
        "- If the CONTEXT has `visual`, a visual is shown after your text. You may point to it "
        "(\"the table below\"). Never draw one, and never describe it line by line."
    )
    assert sentence in coaching.COACH_SYSTEM.split("\n")
    style = coaching.COACH_SYSTEM.split("STYLE\n", 1)[1]
    assert style.split("\n")[0].startswith("- 2–5 sentences.")
    assert "- Output prose only." in style


def test_context_contains_only_kind_and_caption(env):
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="what_now")
    assert result.visual_kind == "table"
    message = env.calls[-1]["prompt"]
    visual_lines = [line for line in message.split("\n") if line.startswith("visual")]
    assert visual_lines == [f"visual: table, {result.visual_caption}"]
    for line in result.visual.split("\n"):
        assert line not in message, line
    assert "visual" in result.grounded_on

    # Direct: no kind, no line; a kind adds exactly the one line.
    step = _step(GENIE, TAG)
    state = _state()
    plain, grounded = coaching.build_context(step, state, {}, GENIE, [])
    assert "visual" not in grounded and "\nvisual:" not in plain
    with_visual, grounded = coaching.build_context(
        step, state, {}, GENIE, [], visual_kind="diagram", visual_caption="Cap."
    )
    assert "visual" in grounded
    assert [l for l in with_visual.split("\n") if l.startswith("visual")] == ["visual: diagram, Cap."]


# --- A15: the timings line ---------------------------------------------------------------------------


def test_timings_line_visual(env, caplog):
    caplog.set_level("INFO", logger=coaching.logger.name)
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="what_now")
    lines = [r.getMessage() for r in caplog.records if r.getMessage().startswith("coaching timings")]
    assert len(lines) == 1
    assert lines[0].endswith(" visual=table")
    assert result.visual_caption not in lines[0]
    for line in result.visual.split("\n"):
        assert line not in lines[0]
    caplog.clear()
    mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why", visual="none")
    lines = [r.getMessage() for r in caplog.records if r.getMessage().startswith("coaching timings")]
    assert lines and lines[0].endswith(" visual=none")


# --- Session frontier and branches (D-94) ----------------------------------------------------------


def test_progress_shows_the_session_frontier(env):
    # The requested step is not the frontier: the table still shows the session.
    env.store[SESSION_ID]["completed_gates"] = []
    result = mcp_server.vibe_explain_step(SESSION_ID, "gaccel_dashboard", visual="table")
    assert result.visual.split("\n")[2] == "| **Define Your Use Case** | **Now** |"
    assert result.visual_caption == "0 of 24 steps done. Now: Define Your Use Case."


def test_beat_and_project_setup_branches(env):
    env.store[SESSION_ID]["completed_gates"] = []
    beat = mcp_server.vibe_explain_step(SESSION_ID, visual="diagram")
    assert beat.sectionTag == BEAT.sectionTag
    assert beat.visual_caption == f"{CAPTION} Steps that build on Define Your Use Case."
    setup = mcp_server.vibe_explain_step(SESSION_ID, "project_setup", focus="unblock")
    assert setup.visual.split("\n")[2] == "| None | Nothing blocks this step | Ready |"
    assert setup.coaching == CLEAN
