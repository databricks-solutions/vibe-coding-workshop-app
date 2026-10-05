"""Grounded coaching on ``vibe_explain_step(focus=...)`` (D-22..D-25, D8 §4a).

Offline: the serving endpoint (``services.llm.call_databricks_serving_endpoint``)
and the Lakebase interaction reads/writes are mocked. C1–C15 map to the plan's
acceptance contract (docs/superpowers/plans/2026-10-05-coaching-explain-step.md).

Tampers (each turns the named test red):
- remove the timeout handler in ``_single_flight`` -> test_c3_fail_open
- drop the 8-word overlap check in ``scrub_output`` -> test_c5_scrub
- call ``coach()`` even when focus is None -> test_c11_no_focus_parity
- drop the in-flight registry check -> test_c8_cache_and_single_flight
- drop ``focus`` from the extended INSERT -> test_c14_lakebase
"""

import contextlib
import copy
import pathlib
import re
import sys
import threading
import time
import types

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server  # noqa: E402
from src.backend.services import coaching, lakebase, llm  # noqa: E402

SESSION_ID = "coaching-session"
TAG = "prd_generation"
PROMPT = (
    "Create a product requirements document that covers the personas goals and success "
    "metrics for the governed app"
)
BRIEF = "Retail demand forecasting for store managers"
# Built at runtime so no token-shaped literal lives in the repo (secret scan).
FAKE_TOKEN = "da" + "pi" + "0123456789abcdef" * 2
CLEAN = "This step turns your use case brief into a PRD that every later step builds on."
STATIC_KEYS = {"sectionTag", "title", "why", "how_to_apply", "expected_output"}
NEW_DEFAULTS = {"coaching": None, "focus": None, "grounded_on": [], "is_fallback": False}
CONTEXT_KEYS = {
    "focus", "track", "title", "why", "how_to_apply", "expected_output", "gate",
    "execution", "prompt", "captured_outputs", "prior_answers", "industry", "use_case",
}


def _record():
    return {
        "session_id": SESSION_ID,
        "created_by": None,
        "completed_gates": ["use_case_selection"],
        "captured_outputs": {"use_case_brief": BRIEF},
        "session_parameters": {"industry": "Retail", "use_case": "demand_forecasting"},
    }


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    monkeypatch.delenv("VIBE_COACHING_ENABLED", raising=False)
    coaching.clear_caches()
    yield
    coaching.clear_caches()


@pytest.fixture
def env(monkeypatch):
    """Session store + mocked model + mocked coaching telemetry/history."""

    store = {SESSION_ID: _record()}
    saves = []
    calls = []
    telemetry = []
    model = {"reply": {"response": CLEAN, "source": "llm_generated"}}

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append((session_id, fields))
        return True

    def delta_write(*args, **kwargs):
        saves.append((args, kwargs))
        return True

    async def fake_model(prompt, endpoint_name=None, max_tokens=4000, temperature=0.5, system_prompt=None):
        calls.append(
            {
                "prompt": prompt,
                "endpoint_name": endpoint_name,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "system_prompt": system_prompt,
            }
        )
        reply = model["reply"]
        if isinstance(reply, BaseException):
            raise reply
        if callable(reply):
            return reply()
        return reply

    def append(*args, **kwargs):
        telemetry.append((args, kwargs))
        return True

    interactions = [
        {"section_tag": TAG, "interaction_id": "coach.why", "kind": "coaching", "answer": None},
        {"section_tag": TAG, "interaction_id": "prd_generation.why", "kind": "pre", "answer": "B"},
    ]

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session, raising=False)
    monkeypatch.setattr(mcp_server, "save_session_applying_mcp_delta", delta_write)
    monkeypatch.setattr(mcp_server, "append_session_interaction", append)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {
            "input": PROMPT,
            "how_to_apply": "Paste the prompt into a new agent chat.",
            "expected_output": "A docs/design_prd.md is produced.",
            "user_trigger_prompt": "trigger",
        },
    )
    monkeypatch.setattr(llm, "call_databricks_serving_endpoint", fake_model)
    monkeypatch.setattr(lakebase, "append_session_interaction", append)
    monkeypatch.setattr(lakebase, "list_session_interactions", lambda session_id, limit=10: list(interactions))
    return types.SimpleNamespace(
        store=store, saves=saves, calls=calls, telemetry=telemetry, model=model
    )


def _step():
    return mcp_server.engine.resolve_step(
        mcp_server.DEFAULT_TRACK, mcp_server.build_session_state(_record()), TAG
    )


def _coach_direct(focus="why", track=mcp_server.DEFAULT_TRACK, session_id=SESSION_ID):
    state = mcp_server.build_session_state(_record())
    step = _step()
    help = {
        "title": step.title,
        "why": step.why or "",
        "how_to_apply": "Paste the prompt into a new agent chat.",
        "expected_output": "A docs/design_prd.md is produced.",
        "prompt": PROMPT,
    }
    return coaching.coach(
        session_id=session_id,
        step=step,
        state=state,
        help=help,
        focus=focus,
        track=track,
        run_blocking=mcp_server._run_async_blocking,
    )


def _coaching_rows(env):
    return [kw for _, kw in env.telemetry if kw.get("kind") == "coaching"]


def _wait(predicate, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return False


def test_c1_grounding(env):
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="what_now")
    assert result.coaching == CLEAN
    assert result.is_fallback is False
    assert len(env.calls) == 1
    call = env.calls[0]
    assert call["system_prompt"] == coaching.COACH_SYSTEM
    assert call["max_tokens"] == 400
    assert call["temperature"] == coaching.COACH_TEMPERATURE
    assert call["endpoint_name"] is None
    message = call["prompt"]
    top_keys = set(re.findall(r"^([a-z_]+):", message, flags=re.MULTILINE))
    assert top_keys <= CONTEXT_KEYS, top_keys - CONTEXT_KEYS
    assert "focus: what_now" in message
    assert "REFERENCE ONLY" in message and PROMPT in message
    assert f"- use_case_brief: {BRIEF}" in message
    assert "- prd_generation.why: B" in message
    assert "coach.why" not in message  # prior coaching rows are not grounding

    step = _step()
    expected = ["focus", "track", "title"]
    expected += ["why"] if step.why else []
    expected += ["how_to_apply", "expected_output"]
    expected += ["gate"] if step.gate else []
    expected += ["execution", "prompt", "captured_outputs:use_case_brief", "prior_answers", "industry", "use_case"]
    assert result.grounded_on == expected

    # Grounding excerpts drop data rows, secrets and emails, and are capped.
    raw = f"intro\n| a | b |\nx,y,z,w\nkey: {FAKE_TOKEN}\nmail bob@example.com\n" + "w " * 400
    scrubbed = coaching.scrub_input(raw)
    assert "| a | b |" not in scrubbed and "x,y,z,w" not in scrubbed
    assert FAKE_TOKEN not in scrubbed and "bob@example.com" not in scrubbed
    env.store[SESSION_ID]["captured_outputs"]["use_case_brief"] = raw
    coaching.clear_caches()
    mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    brief_line = next(l for l in env.calls[-1]["prompt"].splitlines() if l.startswith("- use_case_brief:"))
    assert len(brief_line) <= len("- use_case_brief: ") + coaching.OUTPUT_EXCERPT_CAP


def test_c2_system_prompt_track_neutral():
    system = coaching.COACH_SYSTEM
    assert "NEVER restate, paraphrase, or \"improve\" the step's verbatim PROMPT body." in system
    assert "Genie Accelerator" not in system
    assert "a hands-on Databricks workshop (the track named in the CONTEXT)" in system
    for header in ("HARD RULES", "FOCUS (from the CONTEXT's `focus` field)", "STYLE"):
        assert header in system
    for focus in coaching.FOCI:
        assert f"- {focus}" in system


def test_c3_fail_open(env, monkeypatch):
    baseline = mcp_server.vibe_explain_step(SESSION_ID, TAG).model_dump()

    env.model["reply"] = RuntimeError("endpoint exploded")
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert isinstance(result, mcp_server.StepHelpResult)  # never an isError result
    assert result.is_fallback is True and result.coaching is None
    assert {k: result.model_dump()[k] for k in STATIC_KEYS} == {k: baseline[k] for k in STATIC_KEYS}

    env.model["reply"] = {
        "response": "[Error] No serving endpoint configured or available.",
        "model": "none",
        "usage": {},
    }
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="unblock")
    assert isinstance(result, mcp_server.StepHelpResult)
    assert result.is_fallback is True and result.coaching is None

    # Budget timeout: a slow model returns the fallback within budget + 1 s.
    release = threading.Event()
    monkeypatch.setattr(coaching, "COACH_BUDGET_S", 0.3)

    def slow():
        release.wait(5)
        return {"response": CLEAN}

    env.model["reply"] = slow
    started = time.monotonic()
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="review")
    elapsed = time.monotonic() - started
    release.set()
    assert isinstance(result, mcp_server.StepHelpResult)
    assert result.is_fallback is True
    assert result.coaching is None
    assert elapsed < 0.3 + 1.0
    assert {k: result.model_dump()[k] for k in STATIC_KEYS} == {k: baseline[k] for k in STATIC_KEYS}
    assert _wait(lambda: not coaching._INFLIGHT)


def test_c4_kill_switch(env, monkeypatch):
    for value in ("0", "false", "OFF", "No"):
        monkeypatch.setenv("VIBE_COACHING_ENABLED", value)
        result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
        assert result.is_fallback is True and result.coaching is None
    assert env.calls == []
    assert coaching.coach  # sanity: the module is wired
    monkeypatch.setenv("VIBE_COACHING_ENABLED", "1")
    assert mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why").is_fallback is False
    assert len(env.calls) == 1


@pytest.mark.parametrize(
    "planted",
    [
        "Your PRD should " + "covers the personas goals and success metrics for the governed app" + ".",
        f"Authenticate with {FAKE_TOKEN} before you continue.",
        "Ask jane.doe@example.com for access to the catalog.",
        "Run this first:\n```python\nprint(1)\n```",
        "Then check SELECT name FROM main.sales.orders to confirm.",
    ],
    ids=["overlap8", "secret", "email", "code_fence", "sql"],
)
def test_c5_scrub(env, planted):
    env.model["reply"] = {"response": planted}
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert result.is_fallback is True
    assert result.coaching is None
    rows = _coaching_rows(env)
    assert len(rows) == 1 and rows[0]["coaching_shown"] is None

    # The 8-word overlap threshold, directly: 8 shared words reject, 7 pass.
    source = "one two three four five six seven eight nine"
    assert coaching.scrub_output("x one two three four five six seven eight y", forbidden_sources=[source]) is None
    assert coaching.scrub_output("x one two three four five six seven y", forbidden_sources=[source]) is not None
    # Clean text passes through unchanged.
    assert coaching.scrub_output(CLEAN, forbidden_sources=[PROMPT, BRIEF]) == CLEAN


def test_c5_scrub_raising_is_fallback(env, monkeypatch):
    def boom(*args, **kwargs):
        raise ValueError("scrub broke")

    monkeypatch.setattr(coaching, "_scrub_output", boom)
    assert coaching.scrub_output(CLEAN, forbidden_sources=[]) is None
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert result.is_fallback is True and result.coaching is None


def test_c5_scrub_clean_passes_through(env):
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert result.coaching == CLEAN and result.is_fallback is False
    assert _coaching_rows(env)[0]["coaching_shown"] == CLEAN


def test_c6_read_only(env):
    before_state = mcp_server.build_session_state(copy.deepcopy(env.store[SESSION_ID]))
    before_next = mcp_server.vibe_next_step(SESSION_ID).model_dump()
    saves_before = len(env.saves)
    record_before = copy.deepcopy(env.store[SESSION_ID])

    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="what_now")
    assert result.is_fallback is False

    after_state = mcp_server.build_session_state(copy.deepcopy(env.store[SESSION_ID]))
    assert after_state.completed_gates == before_state.completed_gates
    assert after_state.captured_outputs == before_state.captured_outputs
    assert after_state.session_parameters == before_state.session_parameters
    assert env.store[SESSION_ID] == record_before
    assert mcp_server.vibe_next_step(SESSION_ID).model_dump() == before_next
    assert len(env.saves) == saves_before == 0


def test_c7_provenance(env, monkeypatch):
    mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="unblock")
    rows = _coaching_rows(env)
    assert len(rows) == 1
    (args, kwargs), = env.telemetry
    assert args == (SESSION_ID, TAG)
    assert kwargs["interaction_id"] == "coach.unblock"
    assert kwargs["kind"] == "coaching"
    assert kwargs["focus"] == "unblock"
    assert kwargs["is_fallback"] is False
    assert kwargs["surface"] == "mcp"
    assert kwargs["answer"] is None

    # A cache hit still writes exactly one row.
    mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="unblock")
    assert len(_coaching_rows(env)) == 2

    # Telemetry returning False or raising never breaks the tool.
    monkeypatch.setattr(lakebase, "append_session_interaction", lambda *a, **k: False)
    assert mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why").coaching == CLEAN

    def raising(*args, **kwargs):
        raise RuntimeError("lakebase down")

    monkeypatch.setattr(lakebase, "append_session_interaction", raising)
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="review")
    assert isinstance(result, mcp_server.StepHelpResult) and result.coaching == CLEAN


def test_c8_cache_and_single_flight(env):
    mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert len(env.calls) == 1
    mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="what_now")
    assert len(env.calls) == 2

    # N concurrent joiners on a fresh key -> one model call.
    def slow():
        time.sleep(0.4)
        return {"response": CLEAN}

    env.model["reply"] = slow
    joiners = 6
    barrier = threading.Barrier(joiners)
    outcomes = []

    def worker():
        barrier.wait()
        outcomes.append(_coach_direct(focus="review"))

    threads = [threading.Thread(target=worker) for _ in range(joiners)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(10)
    assert len(env.calls) == 3
    assert len(outcomes) == joiners
    assert all(o.coaching == CLEAN and o.is_fallback is False for o in outcomes)


def test_c9_retry_after_failure(env, monkeypatch):
    key = (SESSION_ID, TAG, "why")
    env.model["reply"] = RuntimeError("boom")
    assert mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why").is_fallback is True
    assert key in coaching._NEGATIVE
    assert len(env.calls) == 1

    env.model["reply"] = {"response": CLEAN}
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert result.is_fallback is True
    assert len(env.calls) == 1  # within the TTL: no model call

    real_monotonic = time.monotonic
    later = types.SimpleNamespace(monotonic=lambda: real_monotonic() + coaching.COACH_NEGATIVE_TTL_S + 1)
    monkeypatch.setattr(coaching, "time", later)
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert result.is_fallback is False and result.coaching == CLEAN
    assert len(env.calls) == 2
    assert coaching._CACHE[key] == CLEAN
    mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert len(env.calls) == 2


def test_c10_late_success(env, monkeypatch):
    key = (SESSION_ID, TAG, "why")
    release = threading.Event()
    monkeypatch.setattr(coaching, "COACH_BUDGET_S", 0.2)

    def slow():
        release.wait(5)
        return {"response": CLEAN}

    env.model["reply"] = slow
    first = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert first.is_fallback is True
    assert key not in coaching._NEGATIVE  # abandonment is not a failure

    release.set()
    assert _wait(lambda: key in coaching._CACHE)
    assert key not in coaching._NEGATIVE
    second = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="why")
    assert second.is_fallback is False and second.coaching == CLEAN
    assert len(env.calls) == 1


def test_c11_no_focus_parity(env, monkeypatch):
    coach_calls = []
    real_coach = coaching.coach

    def spy(**kwargs):
        coach_calls.append(kwargs)
        return real_coach(**kwargs)

    monkeypatch.setattr(mcp_server.coaching, "coach", spy)
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG)
    dumped = result.model_dump()
    old_shape = {k: v for k, v in dumped.items() if k not in NEW_DEFAULTS}
    assert set(old_shape) == STATIC_KEYS
    assert old_shape == {
        "sectionTag": TAG,
        "title": "PRD Generation",
        "why": _step().why or "",
        "how_to_apply": "Paste the prompt into a new agent chat.",
        "expected_output": "A docs/design_prd.md is produced.",
    }
    assert {k: dumped[k] for k in NEW_DEFAULTS} == NEW_DEFAULTS
    assert coach_calls == []
    assert env.calls == []
    assert env.telemetry == []


def test_invalid_focus_is_invalid_parameter(env):
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG, focus="lecture")
    assert result["isError"] is True
    assert result["structuredContent"]["error"]["code"] == "INVALID_PARAMETER"
    assert env.calls == [] and env.telemetry == []


def test_c12_tool_count_and_annotations():
    tools = {tool.name: tool for tool in mcp_server.mcp._tool_manager.list_tools()}
    assert len(tools) == 7
    tool = tools["vibe_explain_step"]
    annotations = tool.annotations
    assert annotations.readOnlyHint is True
    assert annotations.destructiveHint is False
    assert annotations.idempotentHint is True
    assert annotations.openWorldHint is True
    assert "focus" in tool.parameters["properties"]
    assert "focus" not in tool.parameters.get("required", [])
    assert 200 <= len(tool.description) <= 400


def test_c13_every_track(env):
    outcome = _coach_direct(focus="why", track="app-only")
    assert outcome.is_fallback is False
    assert "track: app-only" in env.calls[-1]["prompt"].splitlines()
    source = pathlib.Path(coaching.__file__).read_text()
    assert "genie-accelerator" not in source
    assert "Genie Accelerator" not in source


_LEGACY_INSERT = """
            INSERT INTO s.session_interactions (
                session_id, section_tag, interaction_id, kind,
                answer, recommended, was_default, coaching_shown, surface, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            """


def _fake_db(monkeypatch, executed, rows=()):
    class Cursor:
        def execute(self, query, params=None):
            executed.append((query, params))

        def fetchall(self):
            return list(rows)

        def close(self):
            pass

    class Conn:
        def cursor(self, *args, **kwargs):
            return Cursor()

        def commit(self):
            pass

    @contextlib.contextmanager
    def get_connection():
        yield Conn()

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "get_schema", lambda: "s")
    monkeypatch.setattr(lakebase, "get_connection", get_connection)
    monkeypatch.setattr(lakebase, "_dict_cursor", lambda conn: conn.cursor())


def test_c14_lakebase(monkeypatch):
    executed = []
    _fake_db(monkeypatch, executed)
    assert lakebase.append_session_interaction(SESSION_ID, TAG, "prd_generation.why", "pre", answer="B")
    query, params = executed[-1]
    assert query == _LEGACY_INSERT
    assert len(params) == 9

    assert lakebase.append_session_interaction(
        SESSION_ID, TAG, "coach.why", "coaching", coaching_shown=CLEAN, is_fallback=False, focus="why"
    )
    query, params = executed[-1]
    columns = re.search(r"\(([^)]*)\)\s*VALUES", query).group(1)
    assert "is_fallback" in columns
    assert "focus" in columns
    assert query.count("%s") == 11 == len(params)
    assert params[-2:] == (False, "why")

    rows = [{"section_tag": TAG, "interaction_id": "prd_generation.why", "kind": "pre", "answer": "B"}]
    _fake_db(monkeypatch, executed, rows)
    assert lakebase.list_session_interactions(SESSION_ID) == rows
    assert "ORDER BY created_at DESC" in executed[-1][0]

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: False)
    assert lakebase.list_session_interactions(SESSION_ID) == []

    @contextlib.contextmanager
    def broken():
        raise RuntimeError("no db")
        yield  # pragma: no cover

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "get_connection", broken)
    assert lakebase.list_session_interactions(SESSION_ID) == []


def test_c15_ddl():
    path = REPO_ROOT / "db" / "lakebase" / "ddl" / "13_mcp_coaching.sql"
    text = path.read_text()
    body = "\n".join(line for line in text.splitlines() if not line.strip().startswith("--"))
    statements = [s.strip() for s in body.split(";") if s.strip()]
    pattern = re.compile(
        r"^ALTER TABLE \$\{schema\}\.session_interactions ADD COLUMN IF NOT EXISTS (\w+)\s+(.+)$"
    )
    columns = {}
    for statement in statements:
        match = pattern.match(" ".join(statement.split()))
        assert match, statement
        columns[match.group(1)] = match.group(2)
    assert columns == {"is_fallback": "BOOLEAN DEFAULT FALSE", "focus": "VARCHAR(16)"}
    for forbidden in ("DROP", "ALTER COLUMN", "TYPE", "DELETE", "UPDATE", "TRUNCATE", "INSERT", "INDEX"):
        assert forbidden not in body.upper(), forbidden
