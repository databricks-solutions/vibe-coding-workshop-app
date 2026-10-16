"""Step-prompt prefetch (plan 2026-10-15-step-prompt-prefetch, D-160).

When a payload makes step N current, the MCP server starts N+1's prompt
generation in the background so vibe_complete_step(N) finds it cached (or joins
it in flight) instead of waiting 20-47 s. Only when N+1's assembled input is
already final: N+1 consumes nothing N produces and every N+1 consume is captured.

Offline: the REAL assembler runs over an in-memory session store. The DB layer is
stubbed (D-146): routes.execute_query serves the two SELECTs the assembler issues
from the store, routes.execute_insert applies the derived-params merge to the
store, and lakebase.get_connection fails the test if anything reaches it. The LLM
is a fake stream that blocks until the test releases it.

Tampers (each turns a test red; output in the PR body):
- X1 drop the "N+1 consumes N's output" check -> test_skills_dependent_steps_are_never_prefetched
- X2 join the prefetch thread in _prefetch_step_prompt -> test_current_response_never_waits_on_the_prefetch
- X3 hand the prefetch a different cache key -> test_prefetch_then_complete_makes_no_second_call
- X4 ignore VIBE_STEP_PROMPT_PREFETCH -> test_switch_off_means_no_prefetch_and_identical_payloads
"""

import copy
import hashlib
import pathlib
import sys
import threading
import time

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server  # noqa: E402
from src.backend.api import routes  # noqa: E402
from src.backend.services import lakebase as lakebase_service  # noqa: E402
from src.backend.workshop import assembler, engine, manifest  # noqa: E402

SESSION_ID = "prefetch-session"
TEMPLATE = "Step {section_tag} for {industry_name} / {use_case_title}; brief={use_case_brief}; plan={iteration_plan}"
_REAL_ASSEMBLE = assembler.get_section_input_content


def _steps(track):
    return engine._ordered_steps(track, engine.SessionState())


def _section_rows(bypass=()):
    rows = []
    for track in manifest.load_manifest().tracks:
        for step in _steps(track):
            rows.append({
                "section_tag": step.sectionTag,
                "coding_assistant": routes.DEFAULT_CODING_ASSISTANT_KEY,
                "input_template": TEMPLATE,
                "system_prompt": "SYS",
                "bypass_llm": step.sectionTag in bypass,
            })
    return rows


class LLM:
    """Fake ``collect_step_prompt_via_stream``; blocks the N+1 tags until released.

    The current step's own render (any tag not in ``blocked``) returns at once, so
    only the prefetched generation is held open.
    """

    def __init__(self, result="ok"):
        self.gate = threading.Event()
        self.calls = []
        self.result = result
        self.blocked = {"prd_generation", "iterate_enhance", "skill_define_strategy", "skill_create_skillmd"}

    async def __call__(self, *, section_tag, **kwargs):
        import asyncio

        self.calls.append(section_tag)
        while section_tag in self.blocked and not self.gate.is_set():
            await asyncio.sleep(0.005)
        if self.result == "fail":
            return None
        return {"source": "llm_generated", "prompt": f"GEN {section_tag}"}

    def count(self, tag):
        return self.calls.count(tag)

    def wait_for(self, tag, n=1, timeout=10.0):
        deadline = time.monotonic() + timeout
        while self.count(tag) < n and time.monotonic() < deadline:
            time.sleep(0.005)
        return self.count(tag)


def _drain(timeout=10.0):
    """Wait for every prefetch thread so a test ends with nothing in the background."""

    deadline = time.monotonic() + timeout
    for thread in threading.enumerate():
        if thread.name == "step-prompt-prefetch":
            thread.join(max(0.0, deadline - time.monotonic()))
            assert not thread.is_alive(), "prefetch thread still running"


@pytest.fixture
def env(monkeypatch):
    """In-memory store + D-146 DB stub + blocking fake LLM; prefetch switch unset (= on)."""

    monkeypatch.delenv("VIBE_STEP_PROMPT_PREFETCH", raising=False)
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 30.0)
    with mcp_server._STEP_PROMPT_LOCK:
        mcp_server._STEP_PROMPT_INFLIGHT.clear()
    store = {}
    writes = []
    connections = []
    assembled = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    def execute_query(sql, params=None):
        assert sql.lstrip().upper().startswith("SELECT"), sql
        if "workshop_parameters" in sql:
            return []
        record = store.get(params[0]) if params else None
        if record is None:
            return []
        return [{
            "session_parameters": copy.deepcopy(record.get("session_parameters") or {}),
            "created_by": record.get("created_by"),
            "use_case_label": record.get("use_case_label"),
            "use_case": record.get("use_case"),
            "workshop_level": record.get("workshop_level"),
        }]

    def execute_insert(sql, params=None):
        # The derived-params merge get_effective_workshop_parameters persists.
        import json

        writes.append(sql)
        patch, session_id = params
        store[session_id]["session_parameters"].update(json.loads(patch))
        return True

    def get_connection(*args, **kwargs):
        connections.append(args)
        raise AssertionError("no Lakebase connection in this test")

    def spy_assemble(**kwargs):
        out = _REAL_ASSEMBLE(**kwargs)
        assembled.append((kwargs["section_tag"], threading.current_thread().name, out.get("input")))
        return out

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "append_session_interaction", lambda *a, **k: True, raising=False)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase_service, "get_connection", get_connection)
    monkeypatch.setattr(routes, "get_schema", lambda: "test_schema")
    monkeypatch.setattr(routes, "execute_query", execute_query)
    monkeypatch.setattr(routes, "execute_insert", execute_insert)
    monkeypatch.setattr(routes, "get_section_input_prompts_from_lakebase", lambda: _section_rows())
    monkeypatch.setattr(routes, "get_usecase_descriptions_from_lakebase", lambda: [])
    monkeypatch.setattr(mcp_server.assembler, "get_section_input_content", spy_assemble)
    llm = LLM()
    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", llm)

    ns = type("Env", (), {})()
    ns.store, ns.writes, ns.assembled, ns.llm = store, writes, assembled, llm
    yield ns
    llm.gate.set()
    _drain()
    assert connections == []
    # Only the assembler's derived-params merge reaches the (stubbed) DB writer.
    assert all("UPDATE" in sql and "session_parameters" in sql for sql in writes)


def _seed(env, track, current, *, outputs=None, use_case=("retail", "customer_analytics")):
    """Store a session on ``track`` whose current step is ``current``."""

    tags = [s.sectionTag for s in _steps(track)]
    done = tags[: tags.index(current)]
    captured = {"use_case_brief": '{"use_case": "customer_analytics"}'}
    captured.update(outputs or {})
    env.store[SESSION_ID] = {
        "session_id": SESSION_ID,
        "created_by": "learner@example.com",
        "workshop_level": track,
        "use_case": use_case[1],
        "use_case_label": "Customer Analytics",
        "completed_gates": ["use_case_selection", *done],
        "captured_outputs": captured,
        "session_parameters": {
            "industry": use_case[0],
            "use_case": use_case[1],
            "coding_assistant": "genie-code",
            "user_email": "learner@example.com",
        },
    }
    return tags[tags.index(current) + 1]


def _key(env, tag):
    inputs = {i for t, _, i in env.assembled if t == tag}
    assert len(inputs) == 1, (tag, inputs)
    return (SESSION_ID, tag, hashlib.sha256(inputs.pop().encode("utf-8")).hexdigest())


SKILLS_USE_CASE = ("sample", "build_skill")
QUALIFYING = [
    ("genie-accelerator", "project_setup", None),
    ("end-to-end", "project_setup", None),
    ("genie-accelerator", "activation_deploy_validate", None),
    ("app-only", "deploy_databricks_app", None),
    ("skills-accelerator", "skill_certify_tables", SKILLS_USE_CASE),
]


@pytest.mark.parametrize("track,current,use_case", QUALIFYING)
def test_prefetch_then_complete_makes_no_second_call(env, track, current, use_case):
    nxt = _seed(env, track, current, **({"use_case": use_case} if use_case else {}))
    assert nxt in ("prd_generation", "iterate_enhance")

    payload = mcp_server.vibe_get_step(SESSION_ID)
    assert payload.sectionTag == current
    assert env.llm.wait_for(nxt) == 1  # exactly one prefetch, started in the background
    env.llm.gate.set()
    deadline = time.monotonic() + 10
    while not any(k[1] == nxt for k in mcp_server._STEP_PROMPT_CACHE) and time.monotonic() < deadline:
        time.sleep(0.005)

    result = mcp_server.vibe_complete_step(SESSION_ID, current, "done")
    assert result.next.sectionTag == nxt
    assert result.next.prompt == f"GEN {nxt}"  # served from the prefetch's cache entry
    assert env.llm.count(nxt) == 1  # no second LLM call
    # Critic Q1: the input assembled at prefetch time is the input at complete time.
    prefetch = [i for t, th, i in env.assembled if t == nxt and th == "step-prompt-prefetch"]
    read = [i for t, th, i in env.assembled if t == nxt and th != "step-prompt-prefetch"]
    assert prefetch and read and set(prefetch) == set(read)
    assert mcp_server._STEP_PROMPT_CACHE[_key(env, nxt)] == f"GEN {nxt}"


def test_complete_joins_an_in_flight_prefetch(env):
    _seed(env, "genie-accelerator", "project_setup")
    mcp_server.vibe_get_step(SESSION_ID)
    assert env.llm.wait_for("prd_generation") == 1

    box = {}
    worker = threading.Thread(
        target=lambda: box.setdefault("r", mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "done"))
    )
    worker.start()
    time.sleep(0.1)
    assert worker.is_alive()  # waiting on the prefetch's Future, not a new call
    env.llm.gate.set()
    worker.join(10)
    assert box["r"].next.prompt == "GEN prd_generation"
    assert env.llm.count("prd_generation") == 1


def test_current_response_never_waits_on_the_prefetch(env, monkeypatch):
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 600.0)
    _seed(env, "genie-accelerator", "project_setup")
    box = {}
    worker = threading.Thread(target=lambda: box.setdefault("p", mcp_server.vibe_get_step(SESSION_ID)))
    worker.start()
    assert env.llm.wait_for("prd_generation") == 1
    # The fake stream is still blocked (never released); the response is already back.
    worker.join(10)
    assert not worker.is_alive(), "vibe_get_step waited on the prefetch"
    assert not env.llm.gate.is_set()
    assert box["p"].sectionTag == "project_setup"


@pytest.mark.parametrize(
    "current,outputs",
    [
        ("skill_install_explore", {}),
        ("skill_define_strategy", {"exploration_findings": "found"}),
    ],
)
def test_skills_dependent_steps_are_never_prefetched(env, current, outputs):
    nxt = _seed(env, "skills-accelerator", current, outputs=outputs, use_case=SKILLS_USE_CASE)
    env.llm.blocked = {nxt}
    assert nxt in ("skill_define_strategy", "skill_create_skillmd")
    # Give the dependent step its input so only the "consumes N's output" rule holds it back.
    produced = {"skill_install_explore": "exploration_findings", "skill_define_strategy": "skill_strategy"}[current]
    env.store[SESSION_ID]["captured_outputs"][produced] = "previous run"

    mcp_server.vibe_get_step(SESSION_ID)
    env.llm.gate.set()
    _drain()
    assert env.llm.count(nxt) == 0


def test_bypass_llm_next_step_is_never_prefetched(env, monkeypatch):
    monkeypatch.setattr(
        routes, "get_section_input_prompts_from_lakebase", lambda: _section_rows(bypass={"prd_generation"})
    )
    _seed(env, "genie-accelerator", "project_setup")
    mcp_server.vibe_get_step(SESSION_ID)
    env.llm.gate.set()
    _drain()
    assert env.llm.calls == []


def test_prefetch_failure_negative_caches_and_complete_serves_template(env):
    env.llm.result = "fail"
    _seed(env, "genie-accelerator", "project_setup")
    mcp_server.vibe_get_step(SESSION_ID)
    assert env.llm.wait_for("prd_generation") == 1
    env.llm.gate.set()
    _drain()
    key = _key(env, "prd_generation")
    assert key in mcp_server._STEP_PROMPT_NEGATIVE

    result = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "done")
    template = [i for t, th, i in env.assembled if t == "prd_generation" and th != "step-prompt-prefetch"][-1]
    assert result.next.prompt == template  # the template, exactly as after any failure
    assert env.llm.count("prd_generation") == 1


def test_prefetch_starts_only_one_generation_per_session(env):
    _seed(env, "genie-accelerator", "project_setup")
    mcp_server.vibe_get_step(SESSION_ID)
    assert env.llm.wait_for("prd_generation") == 1
    for _ in range(3):
        mcp_server.vibe_get_step(SESSION_ID)
        mcp_server.vibe_next_step(SESSION_ID)
    _drain_while_blocked = [t for t in threading.enumerate() if t.name == "step-prompt-prefetch"]
    assert len(_drain_while_blocked) <= 1
    env.llm.gate.set()
    _drain()
    assert env.llm.calls == ["prd_generation"]  # one prefetch, nothing beyond N+1


def test_no_prefetch_while_the_use_case_is_unresolved(env):
    _seed(env, "genie-accelerator", "project_setup")
    record = env.store[SESSION_ID]
    record["completed_gates"].remove("use_case_selection")
    record["captured_outputs"].pop("use_case_brief")
    mcp_server.vibe_get_step(SESSION_ID, sectionTag="project_setup")
    env.llm.gate.set()
    _drain()
    assert env.llm.calls == []


def _base_and_real(monkeypatch):
    """Route _step_payload's helper through a toggle: base (today's code, no helper) or real."""

    real = mcp_server._prefetch_step_prompt
    mode = {"base": True}
    monkeypatch.setattr(
        mcp_server, "_prefetch_step_prompt", lambda *a, **k: None if mode["base"] else real(*a, **k)
    )
    return mode


@pytest.mark.parametrize("value", ["0", "false", "off", "no", " OFF "])
def test_switch_off_means_no_prefetch_and_identical_payloads(env, monkeypatch, value):
    _seed(env, "genie-accelerator", "project_setup")
    env.llm.gate.set()
    mode = _base_and_real(monkeypatch)
    base_step = mcp_server.vibe_get_step(SESSION_ID).model_dump()
    base_next = mcp_server.vibe_next_step(SESSION_ID).model_dump()
    base_done = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "done").model_dump()
    _seed(env, "genie-accelerator", "project_setup")
    mcp_server._STEP_PROMPT_CACHE.clear()
    env.llm.calls.clear()

    mode["base"] = False
    monkeypatch.setenv("VIBE_STEP_PROMPT_PREFETCH", value)
    assert mcp_server.vibe_get_step(SESSION_ID).model_dump() == base_step
    assert mcp_server.vibe_next_step(SESSION_ID).model_dump() == base_next
    _drain()
    assert env.llm.calls == []  # zero prefetches
    assert mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "done").model_dump() == base_done


@pytest.mark.parametrize("value", [None, "", "1", "true", "on", "yes"])
def test_switch_unset_or_any_other_value_is_on(env, monkeypatch, value):
    if value is not None:
        monkeypatch.setenv("VIBE_STEP_PROMPT_PREFETCH", value)
    _seed(env, "genie-accelerator", "project_setup")
    mcp_server.vibe_get_step(SESSION_ID)
    assert env.llm.wait_for("prd_generation") == 1


@pytest.mark.parametrize("track", sorted(manifest.load_manifest().tracks))
def test_prefetch_never_changes_a_payload_on_any_track(env, monkeypatch, track):
    """Every step of every track renders the same payload with the prefetch on as without it."""

    env.llm.gate.set()
    mode = _base_and_real(monkeypatch)
    steps = _steps(track)
    tags = [s.sectionTag for s in steps]
    _seed(env, track, tags[0])
    outputs = {"use_case_brief": "brief", **{s.produces: "x" for s in steps if s.produces}}
    for index, step in enumerate(steps):
        state = engine.SessionState(
            completed_gates=["use_case_selection", *tags[:index]],
            captured_outputs=dict(outputs),
            session_parameters={"industry": "retail", "use_case": "customer_analytics"},
        )
        mode["base"] = True
        base = mcp_server._step_payload(track, state, step, session_id=SESSION_ID).model_dump()
        mode["base"] = False
        assert mcp_server._step_payload(track, state, step, session_id=SESSION_ID).model_dump() == base
        _drain()


def test_app_template_sets_the_switch_to_its_default(monkeypatch):
    import yaml

    config = yaml.safe_load((REPO_ROOT / "app.yaml.template").read_text())
    entries = [e for e in config["env"] if e["name"] == "VIBE_STEP_PROMPT_PREFETCH"]
    assert len(entries) == 1 and entries[0]["value"] == "true"
    monkeypatch.setenv("VIBE_STEP_PROMPT_PREFETCH", entries[0]["value"])
    assert mcp_server._step_prompt_prefetch_enabled()
