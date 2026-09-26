"""Workstream C — custom use case via the app's FMAPI over MCP.

Covers:
  1. ``routes.generate_usecase_description`` — the non-streaming wrapper that
     aggregates the builder's SSE ``content`` deltas (and raises on ``error``).
  2. ``vibe_set_parameters(mode="draft_custom")`` — drafts a PRD-grade brief via
     the wrapper (through the sync->async thread bridge) and returns it WITHOUT
     persisting a description; precondition failures return DRAFT_PRECONDITION.
  3. Confirm/wiring — a locked custom use case mirrors ``use_case_description``
     into ``custom_use_case_description`` (and the label), which is the field the
     prompt assembler actually reads.
"""

import asyncio
import copy
import json
import pathlib
import re
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes

SESSION_ID = "custom-usecase-draft-session"
CANNED_MD = "## Application Type\nA curbside pickup ETA app.\n\n## Key Personas\n- Shopper"


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


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


# --- 1. Non-streaming aggregation wrapper ------------------------------------


def test_generate_usecase_description_aggregates_content(monkeypatch):
    async def fake_stream(messages, **kwargs):
        yield _sse({"type": "start", "model": "test"})
        yield _sse({"type": "content", "content": "Hello "})
        yield _sse({"type": "content", "content": "world"})
        yield _sse({"type": "done"})

    monkeypatch.setattr(routes, "_stream_with_retry", fake_stream)

    request = routes.UseCaseGenerateRequest(industry="retail", use_case_name="Curbside ETA")
    text = asyncio.run(routes.generate_usecase_description(request))

    assert text == "Hello world"


def test_generate_usecase_description_raises_on_error_event(monkeypatch):
    async def fake_stream(messages, **kwargs):
        yield _sse({"type": "start", "model": "test"})
        yield _sse({"type": "error", "error": "LLM not available"})

    monkeypatch.setattr(routes, "_stream_with_retry", fake_stream)

    request = routes.UseCaseGenerateRequest(industry="retail", use_case_name="Curbside ETA")
    with pytest.raises(RuntimeError, match="LLM not available"):
        asyncio.run(routes.generate_usecase_description(request))


def test_generate_usecase_description_raises_on_empty_output(monkeypatch):
    async def fake_stream(messages, **kwargs):
        yield _sse({"type": "start", "model": "test"})
        yield _sse({"type": "done"})

    monkeypatch.setattr(routes, "_stream_with_retry", fake_stream)

    request = routes.UseCaseGenerateRequest(industry="retail", use_case_name="Curbside ETA")
    with pytest.raises(RuntimeError, match="no content"):
        asyncio.run(routes.generate_usecase_description(request))


# --- 2. draft_custom branch --------------------------------------------------


def test_draft_custom_returns_draft_without_persisting_description(session_store, monkeypatch):
    store, _ = session_store

    async def fake_generate(request_body):
        # The wrapper receives the builder request assembled from session params.
        assert request_body.industry == "retail"
        assert request_body.use_case_name == "Curbside Pickup ETA"
        assert request_body.hints == "predict wait from order + traffic"
        return CANNED_MD

    monkeypatch.setattr(routes, "generate_usecase_description", fake_generate)

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case_label": "Curbside Pickup ETA",
            "use_case_hints": "predict wait from order + traffic",
            "use_case_source": "custom",
        },
        mode="draft_custom",
    )

    assert result.drafted_description == CANNED_MD
    persisted = store[SESSION_ID]["session_parameters"]
    # The draft is for review only — no description is persisted yet.
    assert "custom_use_case_description" not in persisted
    assert "use_case_description" not in persisted
    # Merged inputs ARE persisted (source/label/hints).
    assert persisted["use_case_source"] == "custom"
    assert persisted["use_case_label"] == "Curbside Pickup ETA"


def test_draft_custom_requires_custom_source(session_store, monkeypatch):
    monkeypatch.setattr(
        routes,
        "generate_usecase_description",
        pytest.fail,  # must never be called on a precondition failure
    )

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {"industry": "retail", "use_case_label": "X", "use_case_source": "curated"},
        mode="draft_custom",
    )

    assert _error_code(result) == "DRAFT_PRECONDITION"


def test_draft_custom_requires_name_or_hints(session_store, monkeypatch):
    monkeypatch.setattr(routes, "generate_usecase_description", pytest.fail)

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {"industry": "retail", "use_case_source": "custom"},
        mode="draft_custom",
    )

    assert _error_code(result) == "DRAFT_PRECONDITION"


# --- 3. Confirm / assembler wiring -------------------------------------------


def test_confirm_custom_mirrors_description_and_label(session_store):
    store, _ = session_store

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case": "curbside_eta",
            "use_case_label": "Curbside Pickup ETA",
            "use_case_source": "custom",
            "use_case_description": CANNED_MD,
        },
    )

    assert result.missing_required == []
    persisted = store[SESSION_ID]["session_parameters"]
    # The fields the assembler actually reads are now populated.
    assert persisted["custom_use_case_description"] == CANNED_MD
    assert persisted["custom_use_case_label"] == "Curbside Pickup ETA"
    # The lock is genuinely satisfied for a custom use case.
    assert mcp_server._custom_usecase_locked(persisted) is True


def test_seed_body_steers_custom_path_to_draft_custom():
    """The seeded use_case_selection body (958) must route custom authoring through
    the app's FMAPI draft (mode="draft_custom"), not free-author the description."""
    seed = (
        REPO_ROOT
        / "db"
        / "lakebase"
        / "dml_seed"
        / "02_seed_section_input_prompts.sql"
    ).read_text()
    # Isolate the use_case_selection block (input_id 958) so we assert against it,
    # not some unrelated row.
    marker = "(958, 'use_case_selection',"
    start = seed.index(marker)
    # End at the next VALUES row start (line beginning "(<digits>, '"), so a body
    # line that happens to start with "(" doesn't truncate the block.
    tail = re.search(r"\n\(\d+, '", seed[start + len(marker):])
    end = start + len(marker) + tail.start() if tail else len(seed)
    block = seed[start:end]

    assert 'mode="draft_custom"' in block, "958 must instruct the draft_custom flow"
    assert "drafted_description" in block
    # The old free-author instruction must be gone.
    assert (
        "a one-paragraph description of what the application does and who uses it"
        not in block
    )
