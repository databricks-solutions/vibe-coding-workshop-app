"""D12 PR 1: Mermaid twins on the MCP surface (spec §3.5, D-84..D-87).

Genie Code shows a ```mermaid fence as code with a Run button that fails (F1,
F6). ``vibe_explain_step`` asks the assembler for ``render_target="mcp"``,
which swaps each seed fence for its reviewed text twin in
``src/backend/workshop/mcp_visuals/``. The web path is untouched.

A1  40 twins + index.json (36 from D12 PR 1, 4 for main's Insights copies); every twin passes lint_visual; only diagram twins
    carry the D-84 caption.
A2  coverage guard: every __default__ seed fence has a twin with a matching
    hash, and no twin is an orphan.
A3  no "```mermaid" in any MCP payload on any track.
A4  web output is byte-identical to base de70b96 (WEB_GOLDEN below was
    generated at de70b96 with this file's ``_web_digest``, before any change).
A5  a hash mismatch falls back with one content-free WARNING.
A6  fences with {placeholders} still swap (hash taken before substitution).
A7  the D-87 residual net (MCP only).
A8  lint_visual: each §3.2 rule has a passing and a failing case.
"""

import copy
import hashlib
import json
import logging
import re

import pytest

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.services import coaching
from src.backend.workshop import assembler, engine, visuals

from .test_app_family_genie_forks import (  # noqa: F401  (seeded, store are fixtures)
    INDUSTRY,
    SEED_ROWS,
    USE_CASE,
    _WORKSHOP_PARAMS,
    _cache_rows,
    seeded,
    store,
)

FIELDS = ("how_to_apply", "expected_output")
CAPTION = visuals.DIAGRAM_CAPTION
FENCE = "```mermaid"


def _is_default(row):
    return row.get("coding_assistant") in (None, routes.DEFAULT_CODING_ASSISTANT_KEY)


def _seed_fences():
    """``{twin name: mermaid_hash}`` for every fence in a __default__ seed row."""
    fences = {}
    for row in SEED_ROWS.values():
        if not _is_default(row):
            continue
        for field in FIELDS:
            for n, (_, close, body) in enumerate(visuals.iter_mermaid_fences(row.get(field) or ""), 1):
                assert close is not None, f"unclosed fence in {row['section_tag']}.{field}.{n}"
                name = f"{row['section_tag']}.{field}.{n}"
                assert name not in fences, f"two __default__ rows carry {name} with different text"
                fences[name] = visuals.mermaid_hash(body)
    return fences


def _index():
    return json.loads(visuals.INDEX_PATH.read_text(encoding="utf-8"))


def _twin_files():
    return {p.name for p in visuals.TWIN_DIR.iterdir() if p.name != "index.json"}


def _twin_text(name):
    kind = _index()[name]["kind"]
    suffix = ".txt" if kind == "diagram" else ".md"
    return (visuals.TWIN_DIR / f"{name}{suffix}").read_text(encoding="utf-8").rstrip("\n")


@pytest.fixture(autouse=True)
def _fresh_twins():
    visuals.load_twins.cache_clear()
    yield
    visuals.load_twins.cache_clear()


def _rows_with(monkeypatch, edit):
    """The real seed cache rows with ``edit(rows)`` applied, served to the assembler."""
    routes.clear_lakebase_cache()
    rows = copy.deepcopy(_cache_rows())
    edit(rows)
    monkeypatch.setattr(routes, "get_usecase_descriptions_from_lakebase", lambda: [])
    monkeypatch.setattr(routes, "get_section_input_prompts_from_lakebase", lambda: rows)
    monkeypatch.setattr(routes, "get_workshop_parameters_sync", lambda: dict(_WORKSHOP_PARAMS))
    return rows


def _default_row(rows, tag):
    return next(r for r in rows if r["section_tag"] == tag and _is_default(r))


def _assemble(tag, **kwargs):
    return assembler.get_section_input_content(industry=INDUSTRY, use_case=USE_CASE, section_tag=tag, **kwargs)


# --- A1: the twin set -----------------------------------------------------------


def test_twin_set_shape():
    index = _index()
    assert len(index) == 40
    fields = [name.split(".")[1] for name in index]
    assert (fields.count("how_to_apply"), fields.count("expected_output")) == (36, 4)
    tables = sorted(name for name, entry in index.items() if entry["kind"] == "table")
    assert tables == ["semlayer_profile.expected_output.1"]  # the erDiagram
    assert {entry["kind"] for entry in index.values()} == {"diagram", "table"}
    for name in index:
        assert re.fullmatch(r"[a-z0-9_]+\.(how_to_apply|expected_output)\.\d+", name), name


@pytest.mark.parametrize("name", sorted(_index()))
def test_every_twin_passes_lint(name):
    kind = _index()[name]["kind"]
    caption = CAPTION if kind == "diagram" else "How the TPC-H tables relate."
    text = _twin_text(name)
    assert visuals.lint_visual(text, kind, caption) == []
    if kind == "diagram":
        assert text.startswith("```text\n") and text.endswith("\n```")
        assert text.count("```") == 2  # one fence and nothing else
    else:
        assert all(line.startswith("|") for line in text.split("\n"))


def test_swap_diagram_gets_caption_table_does_not(seeded):
    profile = _assemble("semlayer_profile", render_target="mcp")
    diagram, table = _twin_text("semlayer_profile.how_to_apply.1"), _twin_text("semlayer_profile.expected_output.1")
    assert f"{diagram}\n\n{CAPTION}" in profile["how_to_apply"]
    assert table in profile["expected_output"]
    assert CAPTION not in profile["expected_output"]
    assert FENCE not in profile["how_to_apply"] + profile["expected_output"]


# --- A2: coverage guard ---------------------------------------------------------


def test_coverage_guard():
    fences = _seed_fences()
    index = _index()
    assert len(fences) == 40
    missing = sorted(set(fences) - set(index))
    orphans = sorted(set(index) - set(fences))
    assert not missing, f"seed fences without a twin: {missing}"
    assert not orphans, f"twins without a seed fence: {orphans}"
    stale = sorted(name for name in fences if index[name]["sha256"] != fences[name])
    assert not stale, f"seed fence edited, refresh the twin and its hash: {stale}"
    expected_files = {
        f"{name}{'.txt' if entry['kind'] == 'diagram' else '.md'}" for name, entry in index.items()
    }
    assert _twin_files() == expected_files, "twin files and index.json must match 1:1"


def test_fork_rows_carry_no_mermaid():
    # Shared fields are always read from the __default__ row (seed header rule 4).
    for row in SEED_ROWS.values():
        if not _is_default(row):
            assert not any(FENCE in (row.get(field) or "") for field in FIELDS), row["section_tag"]


# --- A3: no Mermaid on any MCP payload -------------------------------------------


@pytest.fixture
def mcp_store(seeded, store, monkeypatch):
    monkeypatch.setenv("VIBE_COACHING_ENABLED", "0")
    coaching.clear_caches()
    monkeypatch.setattr(
        routes, "load_session", lambda sid: copy.deepcopy(store[sid]) if sid in store else None
    )
    return store


def _use_case(track):
    # skills-accelerator only resolves under its locked use case (track_resolution).
    return "build_skill" if track == "skills-accelerator" else USE_CASE


def _session(store, track, sid):
    use_case = _use_case(track)
    store[sid] = {
        "session_id": sid,
        "workshop_level": track,
        "industry": INDUSTRY,
        "use_case": use_case,
        "completed_gates": ["use_case_selection"],
        "captured_outputs": {},
        "session_parameters": {"industry": INDUSTRY, "use_case": use_case, "coding_assistant": "genie-code"},
    }
    assert mcp_server._session_track(store[sid]) == track
    return sid


def _dump(result):
    return result if isinstance(result, str) else json.dumps(
        result if isinstance(result, dict) else result.model_dump(), default=str
    )


@pytest.mark.parametrize("track", sorted(engine.MANIFEST.tracks))
def test_mcp_path_no_mermaid(mcp_store, track):
    sid = _session(mcp_store, track, f"s-{track}")
    tags = [step.sectionTag for step in engine.MANIFEST.track_steps(track)]
    seed_tags = {name.split(".")[0] for name in _index()}
    for tag in tags:
        for focus in (None, *coaching.FOCI):
            result = mcp_server.vibe_explain_step(sid, tag, focus=focus)
            assert not isinstance(result, dict), (tag, focus, result)
            payload = _dump(result)
            assert FENCE not in payload, (track, tag, focus)
            if tag in seed_tags:
                assert visuals.FALLBACK_LINE not in payload, (track, tag, "twin did not match")
    for tag in tags:
        assert FENCE not in _dump(mcp_server.vibe_get_step(sid, tag)), (track, tag)
    assert FENCE not in _dump(mcp_server.vibe_next_step(sid))
    started = mcp_server.vibe_start_track(track, use_case=_use_case(track), industry=INDUSTRY)
    assert FENCE not in _dump(started)
    assert FENCE not in mcp_server._session_state_resource(sid)


def test_mcp_explain_serves_the_twin(mcp_store):
    sid = _session(mcp_store, "genie-accelerator", "s-twin")
    for focus in (None, "why"):
        result = mcp_server.vibe_explain_step(sid, "semlayer_metric_view", focus=focus)
        assert f"{_twin_text('semlayer_metric_view.how_to_apply.1')}\n\n{CAPTION}" in result.how_to_apply


# --- A4: web byte-identity ---------------------------------------------------------


def _web_digest(tag, assistant, **kwargs):
    result = _assemble(tag, coding_assistant_override=assistant, **kwargs)
    return hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()


def test_web_byte_identity(seeded):
    tags = sorted({row["section_tag"] for row in SEED_ROWS.values()})
    assert len(WEB_GOLDEN) == 2 * len(tags)
    for tag in tags:
        for assistant in (None, "genie-code"):
            golden = WEB_GOLDEN[f"{tag}|{assistant or 'default'}"]
            assert _web_digest(tag, assistant) == golden, (tag, assistant)
            assert _web_digest(tag, assistant, render_target="web") == golden, (tag, assistant)


def test_web_keeps_every_fence(seeded):
    total = 0
    for row in _cache_rows():
        if not _is_default(row):
            continue
        served = _assemble(row["section_tag"])
        for field in FIELDS:
            count = len(list(visuals.iter_mermaid_fences(row.get(field) or "")))
            assert len(list(visuals.iter_mermaid_fences(served[field]))) == count, (row["section_tag"], field)
            assert visuals.FALLBACK_LINE not in served[field] and CAPTION not in served[field]
            total += count
    assert total == 38  # 40 minus the two inactive rows (gagent_share, gaccel_productionize)


# --- A5: hash mismatch -------------------------------------------------------------


def test_hash_mismatch_warning_content(monkeypatch, caplog):
    tag = "semlayer_profile"
    original = _default_row(_cache_rows(), tag)["how_to_apply"]
    mutated = original.replace('prof --> erd["ERD"]', 'prof --> erd["ERD v2"]')
    assert mutated != original
    _rows_with(monkeypatch, lambda rows: _default_row(rows, tag).update(how_to_apply=mutated))
    with caplog.at_level(logging.WARNING, logger=visuals.logger.name):
        result = _assemble(tag, render_target="mcp")
    assert visuals.FALLBACK_LINE in result["how_to_apply"]
    assert FENCE not in result["how_to_apply"]
    # The other fence on the same step still swaps.
    assert _twin_text(f"{tag}.expected_output.1") in result["expected_output"]
    warnings = [r for r in caplog.records if r.name == visuals.logger.name and r.levelno == logging.WARNING]
    assert len(warnings) == 1
    message = warnings[0].getMessage()
    assert tag in message and "how_to_apply" in message and "n=1" in message
    _, _, body = next(visuals.iter_mermaid_fences(mutated))
    for line in [*body.split("\n"), "flowchart", "ERD v2", "mermaid"]:
        if line.strip():
            assert line.strip() not in message, line


def test_load_error_fails_open(seeded, monkeypatch, tmp_path):
    monkeypatch.setattr(visuals, "INDEX_PATH", tmp_path / "missing.json")
    visuals.load_twins.cache_clear()
    result = _assemble("semlayer_metric_view", render_target="mcp")
    assert result["how_to_apply"].count(visuals.FALLBACK_LINE) == 1
    assert FENCE not in result["how_to_apply"]


def _twin_copy(monkeypatch, tmp_path):
    """Serve twins from a tmp copy of mcp_visuals, so a test can break one file."""
    copy_dir = tmp_path / "mcp_visuals"
    copy_dir.mkdir()
    for path in visuals.TWIN_DIR.iterdir():
        (copy_dir / path.name).write_bytes(path.read_bytes())
    monkeypatch.setattr(visuals, "TWIN_DIR", copy_dir)
    monkeypatch.setattr(visuals, "INDEX_PATH", copy_dir / "index.json")
    visuals.load_twins.cache_clear()
    return copy_dir


def _assert_only_profile_diagram_falls_back(caplog):
    with caplog.at_level(logging.WARNING, logger=visuals.logger.name):
        profile = _assemble("semlayer_profile", render_target="mcp")
        other = _assemble("semlayer_metric_view", render_target="mcp")
    assert profile["how_to_apply"].count(visuals.FALLBACK_LINE) == 1
    assert FENCE not in profile["how_to_apply"]
    # The other fence on the same step, and a fence on another step, still swap.
    assert _twin_text("semlayer_profile.expected_output.1") in profile["expected_output"]
    assert f"{_twin_text('semlayer_metric_view.how_to_apply.1')}\n\n{CAPTION}" in other["how_to_apply"]
    dropped = [r.getMessage() for r in caplog.records if "dropped" in r.getMessage()]
    assert len(dropped) == 1 and "semlayer_profile.how_to_apply.1" in dropped[0]
    assert "profile (read-only)" not in dropped[0] and "ERD" not in dropped[0]


def test_missing_twin_file_degrades_only_its_fence(seeded, monkeypatch, tmp_path, caplog):
    copy_dir = _twin_copy(monkeypatch, tmp_path)
    (copy_dir / "semlayer_profile.how_to_apply.1.txt").unlink()
    _assert_only_profile_diagram_falls_back(caplog)


def test_lint_failing_twin_degrades_only_its_fence(seeded, monkeypatch, tmp_path, caplog):
    copy_dir = _twin_copy(monkeypatch, tmp_path)
    path = copy_dir / "semlayer_profile.how_to_apply.1.txt"
    path.write_text(path.read_text(encoding="utf-8").replace("\n│\n", "\n │\n", 1), encoding="utf-8")
    assert visuals.lint_visual(path.read_text(encoding="utf-8"), "diagram", CAPTION) != []
    _assert_only_profile_diagram_falls_back(caplog)


def test_text_without_a_fence_is_unchanged():
    text = "Step help\n```sql\nSELECT 1\n```\n"
    assert visuals.swap_mermaid_for_mcp(text, "t", "how_to_apply") is text
    assert visuals.strip_residual_mermaid(text, "t", "how_to_apply") is text


# --- A6: placeholder order ---------------------------------------------------------


def test_placeholder_order(seeded):
    token = re.compile(r"\{([a-z][a-z0-9_]*)\}")
    with_tokens = [name for name in _seed_fences() if token.search(_seed_body(name))]
    assert len(with_tokens) == 4
    for name in with_tokens:
        tag, field, _ = name.split(".")
        # Fill every token in the fence, so substitution really changes its text.
        filled = {key: f"filled_{key}" for key in token.findall(_seed_body(name))}
        web = _assemble(tag, previous_outputs=filled)[field]
        assert all(f"{{{key}}}" not in web for key in filled), name
        served = _assemble(tag, previous_outputs=filled, render_target="mcp")[field]
        assert _twin_text(name) in served, name
        assert visuals.FALLBACK_LINE not in served, name


def _seed_body(name):
    tag, field, n = name.split(".")
    row = next(r for r in SEED_ROWS.values() if r["section_tag"] == tag and _is_default(r) and r.get(field))
    return list(visuals.iter_mermaid_fences(row[field]))[int(n) - 1][2]


# --- A7: the D-87 residual net ------------------------------------------------------


RESIDUAL_TAG = "forge_residual_probe"
PRIOR = "Prior output:\n```mermaid\nflowchart LR\n  a --> b\n```\nend"


def _residual_rows(rows):
    rows.append({
        "section_tag": RESIDUAL_TAG,
        "coding_assistant": routes.DEFAULT_CODING_ASSISTANT_KEY,
        "version": 1,
        "is_active": True,
        "input_template": "Build it.",
        "how_to_apply": "Before\n{prior_diagram}\nAfter",
        "expected_output": "{prior_diagram}",
    })


def test_residual_net(monkeypatch, caplog):
    _rows_with(monkeypatch, _residual_rows)
    previous = {"prior_diagram": PRIOR}
    with caplog.at_level(logging.WARNING, logger=visuals.logger.name):
        mcp = _assemble(RESIDUAL_TAG, previous_outputs=previous, render_target="mcp")
    for field in FIELDS:
        assert FENCE not in mcp[field]
        assert visuals.FALLBACK_LINE in mcp[field]
    assert mcp["how_to_apply"] == f"Before\nPrior output:\n{visuals.FALLBACK_LINE}\nend\nAfter"
    warnings = [r.getMessage() for r in caplog.records if r.name == visuals.logger.name]
    assert len(warnings) == 2 and all(RESIDUAL_TAG in m and "a --> b" not in m for m in warnings)
    web = _assemble(RESIDUAL_TAG, previous_outputs=previous)
    assert web["how_to_apply"] == f"Before\n{PRIOR}\nAfter"
    assert web["expected_output"] == PRIOR


# --- A8: lint_visual, one passing and one failing case per §3.2 rule -----------------


def _diagram(*lines):
    return "```text\n" + "\n".join(lines) + "\n```"


def _table(rows, columns=2):
    header = "| " + " | ".join(f"H{i}" for i in range(columns)) + " |"
    sep = "|" + "---|" * columns
    return "\n".join([header, sep, *("| " + " | ".join(row) + " |" for row in rows)])


GOOD = _diagram("Step one", "│", "▼", "Step two ─▶ note")

LINT_CASES = [
    # (rule, passing text, failing text, kind)
    ("fence open", GOOD, GOOD.replace("```text", "```plaintext"), "diagram"),
    ("fence close", GOOD, GOOD[: -len("```")] + "``", "diagram"),
    ("nothing outside the fence", GOOD, GOOD + "\nafter", "diagram"),
    ("column 0", _diagram("a", "│", "b"), _diagram("a", " │", "b"), "diagram"),
    ("width", _diagram("x" * 60), _diagram("x" * 61), "diagram"),
    ("width counts glyphs as one", _diagram("─" * 60), _diagram("─" * 61), "diagram"),
    ("height", _diagram(*["a"] * 20), _diagram(*["a"] * 21), "diagram"),
    ("box glyphs allowed", _diagram("┌┐└┘├┤┬┴┼▼▲◀▶│─"), _diagram("a → b"), "diagram"),
    ("printable ASCII only", _diagram("a ~ b"), _diagram("a · b"), "diagram"),
    ("no backtick", _diagram("a ' b"), _diagram("a ` b"), "diagram"),
    ("no -->", _diagram("a ─▶ b"), _diagram("a --> b"), "diagram"),
    ("no ->", _diagram("a ─▶ b"), _diagram("a -> b"), "diagram"),
    ("no --", _diagram("read-only"), _diagram("deploy --target dev"), "diagram"),
    ("no tabs", _diagram("a b"), _diagram("a\tb"), "diagram"),
    ("no trailing whitespace", _diagram("a b"), _diagram("a b "), "diagram"),
    ("no placeholders", _diagram("your gold schema"), _diagram("{catalog}.gold"), "diagram"),
    ("table rows", _table([["a", "b"]] * 8), _table([["a", "b"]] * 9), "table"),
    ("table columns", _table([["a", "b", "c"]], 3), _table([["a", "b", "c", "d"]], 4), "table"),
    ("table cell width", _table([["x" * 40, "b"]]), _table([["x" * 41, "b"]]), "table"),
    ("no fence in a cell", _table([["a", "b"]]), _table([["```sql", "b"]]), "table"),
    ("table separator", _table([["a", "b"]]), _table([["a", "b"]]).replace("|---|---|", "| a | b |"), "table"),
]


@pytest.mark.parametrize(("rule", "good", "bad", "kind"), LINT_CASES, ids=[c[0] for c in LINT_CASES])
def test_lint_rule(rule, good, bad, kind):
    caption = CAPTION if kind == "diagram" else "Takeaway."
    assert visuals.lint_visual(good, kind, caption) == [], rule
    assert visuals.lint_visual(bad, kind, caption) != [], rule


def test_lint_caption():
    assert visuals.lint_visual(GOOD, "diagram", f"{CAPTION} The steps in order.") == []
    assert visuals.lint_visual(GOOD, "diagram", "The steps in order.") != []
    assert visuals.lint_visual(GOOD, "diagram", None) != []
    table = _table([["a", "b"]])
    assert visuals.lint_visual(table, "table", "Takeaway.") == []
    assert visuals.lint_visual(table, "table", "") != []
    assert visuals.lint_visual(GOOD, "chart", CAPTION) != []


# --- D-86: the hash -----------------------------------------------------------------


def test_mermaid_hash_normalises_crlf_and_trailing_space():
    body = "flowchart LR\n  a --> b"
    assert visuals.mermaid_hash(body) == hashlib.sha256(body.encode("utf-8")).hexdigest()
    assert visuals.mermaid_hash("flowchart LR  \r\n  a --> b\t") == visuals.mermaid_hash(body)
    assert visuals.mermaid_hash("flowchart TD\n  a --> b") != visuals.mermaid_hash(body)


def test_fence_detection_uses_strip():
    text = "intro\n  ```mermaid\nflowchart LR\n  a --> b\n  ```\nafter"
    assert list(visuals.iter_mermaid_fences(text)) == [(1, 4, "flowchart LR\n  a --> b")]


# Golden web output at base de70b96: sha256 of json.dumps(result, sort_keys=True)
# from ``_web_digest`` for every seed section tag, default and genie-code.
WEB_GOLDEN = {
    "activation_app_design|default": "2960677f2d194ebd4ace9f72b0f1e9b9c7ff07cfa0372b42c30524d28195b273",
    "activation_app_design|genie-code": "379e8df4663f1626f73f17b8665a80398d1597c723524f44c8245dafc47830fd",
    "activation_build_wire|default": "4773ace2f17d14680972b04411b86644410cfbf178406737be6d0b3aab441b06",
    "activation_build_wire|genie-code": "1e9c37b0bf4fdf8154f15d2a28c55cdacf69cd2d213a2a9c6ebf3f0d214b6c04",
    "activation_deploy_validate|default": "57da5e1ae1c46619e8a92dea2e27caa19c2d7d3e2490885d25f701193def049f",
    "activation_deploy_validate|genie-code": "8100f92149bbf72e3318a1ae581252d4f8a54d79f89b9fdb91dad7bfdcd15982",
    "activation_reverse_sync|default": "ce47b58ae1dc142dddfb5b4ea355025d4e569aa44faf274ed6524a487ad32795",
    "activation_reverse_sync|genie-code": "f8c5f5f6315701215cdaae5319b6bba8d739547c87c20b146ac509686c8632d2",
    "activation_table_design|default": "3cc22dfc5da9a8fe4ee29ad8a0c1811606e88b5d11e1b7d4a6ead8a33be1691c",
    "activation_table_design|genie-code": "0c0062078098cf13cc4950975ece0da9c5a2789fd3c2dfe2713edcd6b888d1b5",
    "activation_wire_genie|default": "a4a21bf9efa493f4dec0131feba826a2a8a7ed103d00e405f79f6e22919f3bd8",
    "activation_wire_genie|genie-code": "32fd016d9bfbcb0d51317882e18e5df2197599294dd81432e74d9ac7359c4994",
    "activation_wire_lakebase|default": "d1b3999103ecc03fb4ec0341c87eb2eda99c6733c1d3ec0557522f108db4010d",
    "activation_wire_lakebase|genie-code": "0e192ce4b22b30f07d3f5eccfdff151450885c13296a7512c4b1a8ddd640ecc0",
    "agent_framework|default": "d0ec3c5f97dc7ab3c03686626489f79d5c8dc1f2bf412926085c7bee09fd62cc",
    "agent_framework|genie-code": "3986da5b43ca75ec04f3fb3ef126f2eef280a5e6026e41b75ecccd98b4ab5b35",
    "agent_spec_design|default": "30ff33226c79e0fd280d7310888bad94603b21196993856aa792c5f69429fe1f",
    "agent_spec_design|genie-code": "ae0f65c5ad6746215c96b3c4e4b94e2c8897e023fc99134989117cc33bd3fa4a",
    "agent_tool_selection|default": "b52bf38efd6f6e0415728665318e4812deb2a77add5287ddeb9872d42ce966de",
    "agent_tool_selection|genie-code": "d1afbacac3eddff9cff780add114028427cc6ded3717c49e7a9c4efee03c9809",
    "aibi_dashboard|default": "f2245bb2f6b5a57ef87d513934bff66df6e0da5a9edd3711294547815a6b892d",
    "aibi_dashboard|genie-code": "8303111db87e7b112c70a9007c0302471ee4061497d7b3c22a0b6ca3bd4a5a79",
    "appkit_agent_app_proxy_chat|default": "3241ca06c07b49f1a1f56e908aed6693d9f12c4962fa9854e3b28ba742b1ffa8",
    "appkit_agent_app_proxy_chat|genie-code": "7d9029e7cbceae3beacf2c40cee4f2532e04f0902daf19740528e7c06d19b469",
    "appkit_chat_feedback_mlflow|default": "bac749801c0c580d04ee31b1104ee6b73360ae230b7753d3b3deee5f4bb50863",
    "appkit_chat_feedback_mlflow|genie-code": "5fc8734216bb07e7fce4ac3fff0a6e05cd21109ca2fabb44f2fc0f1b769c03ce",
    "bronze_layer_creation_upload|default": "2f25f34dcc14c9c023a7472c435a3177ac15f864083996e2d4e09ccd55c4173c",
    "bronze_layer_creation_upload|genie-code": "2f25f34dcc14c9c023a7472c435a3177ac15f864083996e2d4e09ccd55c4173c",
    "bronze_layer_creation|default": "7d24eadae62176d987d69912ca10505a4eb6f2cfe6e005ced394b43033633ec7",
    "bronze_layer_creation|genie-code": "1cd240ed7b6b2f58ee0714f6c083a49a286932c83e0c23ebb7270f1b9268ce11",
    "bronze_table_metadata_generate|default": "73c9c31f431eec577d5147a1bead985d819aeeecf79799b9bb07fd88019686af",
    "bronze_table_metadata_generate|genie-code": "73c9c31f431eec577d5147a1bead985d819aeeecf79799b9bb07fd88019686af",
    "bronze_table_metadata_upload|default": "cc7fd683c0fb6c5a6dca1ded36100c300399cb2a35d05edb23f4a00a29c6cc30",
    "bronze_table_metadata_upload|genie-code": "cc7fd683c0fb6c5a6dca1ded36100c300399cb2a35d05edb23f4a00a29c6cc30",
    "bronze_table_metadata|default": "b4c84e0286a869790a14c738a423d0eba99af03f1c6fa6fd7a4558c784d16eae",
    "bronze_table_metadata|genie-code": "b4c84e0286a869790a14c738a423d0eba99af03f1c6fa6fd7a4558c784d16eae",
    "cursor_copilot_ui_design|default": "50ebc8312587fb939ea3cf0316b237b69285384949f065f6ed5ecedfa33f259a",
    "cursor_copilot_ui_design|genie-code": "cf5f9f7af807cb745a7fbc6e1d2ba14d51f8106ade607dc477f69e255381551c",
    "default|default": "d8badcd0fda81faf1b9cd3a49a5f0d7478e8c36ebed516e7d5bbadfd3f2832bd",
    "default|genie-code": "d8badcd0fda81faf1b9cd3a49a5f0d7478e8c36ebed516e7d5bbadfd3f2832bd",
    "deploy_databricks_app|default": "96a2711e497677445a1308c4ea88bcbf45b897acec4621e05f7a296967c5ef87",
    "deploy_databricks_app|genie-code": "370b649452379b385d4bd2b120c4af5df923d0ed80f72aab0ca275a79de4997c",
    "deploy_di_assets|default": "23c25e5c91439d3f00d3f60a1723865a6414f351dbbe15458a295e41acbf6cf7",
    "deploy_di_assets|genie-code": "7075729b8680e452d7c8e6ab55c63d322858247eb6c533c47a9bec493c27d0a6",
    "deploy_lakehouse_assets|default": "51a4c18c4fc173b1beb8760409ca58dbb3a1e7389cb23d23d261b6121dd71b5d",
    "deploy_lakehouse_assets|genie-code": "10bc40b16c7d5725a55559f2c2de7e3f8a77bda33ca8ce6f122a025d4d7ba1be",
    "figma_ui_design|default": "924b392741bd9f60ad51e5cf8522b4921c0d97cb0c6317b6719a99b32221c25f",
    "figma_ui_design|genie-code": "924b392741bd9f60ad51e5cf8522b4921c0d97cb0c6317b6719a99b32221c25f",
    "gaccel_activation|default": "79046c625f3f9e3643cfe5432785e95fd741c553d9001f0bda1b46aeacd91561",
    "gaccel_activation|genie-code": "a6f430baf2e1e1defc037c10ae8a36e77e8704e573ecfc8302823635cafa1956",
    "gaccel_dashboard|default": "c6cac703157ee4ad118031baa9f088b3e01c9f9cf1067ea2c1b0faf09789b418",
    "gaccel_dashboard|genie-code": "c6060eeee3c736856d3528e9edd8fbdef02051644dab0c5b448f8f7e37ed4c43",
    "gaccel_productionize|default": "84b22bcb1861fe5461ca6fd51f9177bd6789f2b2106de78ff633b1034fd8242a",
    "gaccel_productionize|genie-code": "84b22bcb1861fe5461ca6fd51f9177bd6789f2b2106de78ff633b1034fd8242a",
    "gagent_benchmarks|default": "49ddff8cf9cca56d90b1f808dec131c94a8ca7da1a549122b7a4c9578799ef98",
    "gagent_benchmarks|genie-code": "d0c3a5ca8d78a093352d6a710acf806346c72fd958a9a729b92734c8347ede1e",
    "gagent_describe|default": "0851a79e26d81bcdc1d1319d944028991f3795419a2c27676b3239375cf0d9a7",
    "gagent_describe|genie-code": "0026cca9087fa779be46b1db58ceaf1ee57a2ff08bbbedd58f0ca95f6e8cf175",
    "gagent_instructions|default": "05e632b11de8f900cd6065bc7ee421bc593677280b52bf482a31655eca82447c",
    "gagent_instructions|genie-code": "a7be61c70fd22b24c412a90acad421c3652035d3ffff86684afa64d0617f48c6",
    "gagent_optimize|default": "9aca8e37b945384f48116abe3ba37da85293be3021ee04abc019bad6edd40383",
    "gagent_optimize|genie-code": "aef835cd275a569615d5d53f3780183780ee1440ff9d0607ada364ec8749b51e",
    "gagent_share|default": "6d7dc7362634104f583470d6a92173e11343838c8a15d5d0030d1741ab99f95c",
    "gagent_share|genie-code": "6d7dc7362634104f583470d6a92173e11343838c8a15d5d0030d1741ab99f95c",
    "gagent_verified|default": "ef6aa30f61c851ac05250a6940fe43a368cc99b9dfc44032f0acb2c888683a5f",
    "gagent_verified|genie-code": "7ef24872c093e91be18fc76c37601f8c3daa19524fb48a382909cd5cef6eabaa",
    "genie_gold_design|default": "72c6fd0083870a884958270c556f2f3603f6c78e17d63613814e222dd2c18ae0",
    "genie_gold_design|genie-code": "72c6fd0083870a884958270c556f2f3603f6c78e17d63613814e222dd2c18ae0",
    "genie_silver_metadata_generate|default": "f60da21d1839027860c9d1906b200ea338aaf932c415b7210ff47aed94ca7dfe",
    "genie_silver_metadata_generate|genie-code": "f60da21d1839027860c9d1906b200ea338aaf932c415b7210ff47aed94ca7dfe",
    "genie_silver_metadata_upload|default": "6aaad9ce16fc9e3e09b5557ef5233d24221528a49b030ff21700abdb1283062f",
    "genie_silver_metadata_upload|genie-code": "6aaad9ce16fc9e3e09b5557ef5233d24221528a49b030ff21700abdb1283062f",
    "genie_silver_metadata|default": "458b6ebe0f1de864ebc0fe04e76dd13c2f1c7e7961b69a21daf711800c88d13b",
    "genie_silver_metadata|genie-code": "b43ce5d9d7605fa57eedd3b51dca83394be905995f6f13bedc72da332738d870",
    "genie_space|default": "66938ee0bf13682f0e8da0018895993ef67414617fd9926d004934e0b27d93ae",
    "genie_space|genie-code": "44d9c8644af859e9edb3fb8f7c5fd272fddd3c8a6d0eb6d164f19394590fdc7a",
    "gold_layer_design|default": "06be9a1755c48e246a85d67e2c23ef91364739f82baa66214474c0f06f8a6c39",
    "gold_layer_design|genie-code": "cb897eb741d956fa63b1a19c4b4f79b140de6d72ec5624fd3756e429ea572e2c",
    "gold_layer_pipeline|default": "32d60b687e708ce8e0999e55bf97932ccb742573daadbcb425b56dacaffbd2a4",
    "gold_layer_pipeline|genie-code": "65466f463e6a4c458970c738cce9924ac0d1e9ef1501eefac3eaf914bd835745",
    "iterate_enhance|default": "7fbf6f9d81e6adee4835d0ff6e80233716ddef1f4d945a7a8a571cddb41794b1",
    "iterate_enhance|genie-code": "7fbf6f9d81e6adee4835d0ff6e80233716ddef1f4d945a7a8a571cddb41794b1",
    "knowledge_assistant_create|default": "5c29146575365f4ae86b5514b54d422b0c18cf8fefb5685ed3f305cd3ea39e11",
    "knowledge_assistant_create|genie-code": "0a5188476f89384657d3cd9ed7d49034c986f93131a5f319fcdacf56576796f0",
    "mlflow_agent_tracing_uc|default": "987a8786f1b3c4f0f19862d403f798de4bde9c200706de1bd1be3287d4b91d0c",
    "mlflow_agent_tracing_uc|genie-code": "041a92e6829d8371d5a114a60b986a99f9dea58daa6ceb00b8e5fcf5d4afd7b3",
    "mlflow_evaluation_datasets|default": "d0579786a3e3b5a0229b76b229e2814e266f25538908284d41d250e94bcac078",
    "mlflow_evaluation_datasets|genie-code": "53b837a96001270e7d7d833f0195c4f393ed49fd6bb84c98d3850ad9634aafa3",
    "mlflow_evaluation_runs_and_iteration|default": "60b8c2e27492c34ad30e57cc1a1eeaf98ff113b04048d8212ce475ff6f835bf2",
    "mlflow_evaluation_runs_and_iteration|genie-code": "0c28de69664d4227548a5947c43dbb54515cb0d0b842797508a95e972d1ed4c2",
    "mlflow_gateway_and_deployment|default": "32c4782857181612b70d690793a84d940f795bcd6c63870cd12d8b211e7e805e",
    "mlflow_gateway_and_deployment|genie-code": "77fc8e756254365748e409755642d069550025cd39c93544034ccf5ea46a1f37",
    "mlflow_human_review_and_signoff|default": "ef3e4635ab214e955060d6514fd5df900e202cee4b60174e5688e1cf24b1801b",
    "mlflow_human_review_and_signoff|genie-code": "5911ad73ac996df36207b2d4e456b2595d7a24a28228efd8370a50f09c7c2a1e",
    "mlflow_logged_model_uc_registration|default": "de412f3072c52d03326d66899d94f7241f2033c197ee3644879632135becba4b",
    "mlflow_logged_model_uc_registration|genie-code": "04a1d10b9265c4e894a5f0eaaf9a6223e3a0c68893852cf5f7e604cad4931012",
    "mlflow_production_monitoring_and_debugging|default": "c617755ac66cc222bb6f71babaf22362086f83f6627b755fa94b3e40e54a3bb9",
    "mlflow_production_monitoring_and_debugging|genie-code": "67822faef21594c97a1b3d46d428bf1f0c5965aabc80195bcdf0d60131aeaa4b",
    "mlflow_prompt_registry|default": "316d3b7802756ec231fc1a561b2d79c8666436b519185fb1bf01c1152bdffc6c",
    "mlflow_prompt_registry|genie-code": "07d2f8146d2c1799550192e275480e115a302626c803ad822672c4d3e1295312",
    "mlflow_scorers_and_judges|default": "419f9acf403477a293e89c7c05e591d05dc5f7f8b574237fd7d27bc002acdadf",
    "mlflow_scorers_and_judges|genie-code": "5eacb5b33686fab740fd504970e9abb8817c2bfad5145dd81c326aa9896f7a6b",
    "ontology_domain|default": "c6d79ad196d4567c668760d2adc7a7630c994799014e2db7053b8979a40ac3c0",
    # D-144 (genie-default-ontology PR 1): the served row is now the v3 1124, so this one
    # cell changes on purpose (was 60e22a22cf4808bccc25e7125d7d5ffa7cb294ef1b011f4843c9124b03fb536d).
    "ontology_domain|genie-code": "bce0b25525d6d59f3341bc32f05441d0945b891fa42fecf805eaefd78bac1d43",
    "ontology_pages|default": "1c4c07a81234c43cdd38365f4d1f6b7021749bcf4677e677854d73593d43d521",
    "ontology_pages|genie-code": "0c8537aca2bf3cb342e8b2010a2ca740d85a7c505f6e3c4a4a96eb2099c43f18",
    "ontology_routing|default": "c68f828607a0dda90f9846aba9a5ca42db2538d615351a202d7f8dbc6159f9df",
    "ontology_routing|genie-code": "2c3a91ce283ddba3bea8374875029da3bec88479a6e122c882843a240da251d3",
    "optimize_genie|default": "e74e1c6abc088d7f7c1a99dd834006097fb094348faa292863f9c98a044a45ae",
    "optimize_genie|genie-code": "67d09911061d90c84ac3fa632535e64d4ead6a83b6dfcb7dab470bf749575e17",
    "prd_generation|default": "c448e630cd2b6e1a03750d4f5975cc8bc8bf2aeed3603b1192d1ba31a7726bdf",
    "prd_generation|genie-code": "c448e630cd2b6e1a03750d4f5975cc8bc8bf2aeed3603b1192d1ba31a7726bdf",
    "redeploy_test|default": "f587f3e005c02263c96fe444877208e204cf1aa1d3d474782d2db7a202f55636",
    "redeploy_test|genie-code": "0d9b44b1aa0da2293b8b5c04a14b4e0fa776a27cbe044c60d6363ced5061a9e9",
    "semlayer_locate_prebuilt|default": "88c6fbb81547dd6319daa63ebe3f3fff2a6167133e828786de337f382cc1fe03",
    "semlayer_locate_prebuilt|genie-code": "1d8165ec8e7f8181ea8dc200ecbf833dc29e18899fb19847d636927fea7b3124",
    "semlayer_locate_synthetic|default": "d0fc4121b21e9558afd017a71208cd50e599e0c459bcf8f50d4e12553865bf05",
    "semlayer_locate_synthetic|genie-code": "8441643b29baca5540a8fd63f3c3c955d7d97b8a203f72233bfe8e7c4d2fa327",
    "semlayer_locate_upload|default": "e98791b52d8ef895d5a38c9d1b96255aea0be16bfc20a2448ac6bdee37932b5a",
    "semlayer_locate_upload|genie-code": "3b8ebd3834bf35dbf153f71397818bb6a7bdced2db47ed99629b072219443608",
    "semlayer_locate|default": "d19c87474c34aea940ff90eb039fad770c1cbf5dd62ba6a37916f937c94756ff",
    "semlayer_locate|genie-code": "33d36bd1663b7cbd73e1b430a1202691969f271f67d3ce0a317cc6c603f0910e",
    "semlayer_measures|default": "c51bdec3f062261fdc24ba2f4e6ed04c08db11325e6e3f25e454fc57f22b3062",
    "semlayer_measures|genie-code": "7d3ad4c40b98d12ce70a5aa942bd2bd3fde15ec5676943f2ff911c4dc5537183",
    "semlayer_metric_view_importbi|default": "822b43a5f144745af75092b081cfe17c60babc3c943003b99dc87e27e071a2c4",
    "semlayer_metric_view_importbi|genie-code": "52be11c03ffff2b76632e4e8cc76a0ae7660a1f4491e2f38632a24518b3647ff",
    "semlayer_metric_view|default": "97fc6e8cc36419c8ea3780a100d3511916a71351b7317dbd037b9e57ec8a8a64",
    "semlayer_metric_view|genie-code": "74ab8e8cb9683b1085eef72cae908e21f0105b70249989265a4ec0061950bdc0",
    "semlayer_profile|default": "87ba8a79b8bd51a0a7b763d6b53878b418c3b71146da7c2247f664187deb921b",
    "semlayer_profile|genie-code": "f523d73ca8cbbb156ca4e0ef778201892d1e4f12dc7f3feb4d9b483b2f912b08",
    "semlayer_synonyms|default": "9f27803203dab322bbcbff2280f5b1891f08f318bc0e68308e4286c8f0c3555e",
    "semlayer_synonyms|genie-code": "100a6f722975011ca3081580bc83cf7b80d81f78b90a3f958910f17066eb19d6",
    "setup_lakebase|default": "8a4896fcda53bdeb3bbf3176baa6e9b95fda3bba3a1ba086d10b3a5488628f22",
    "setup_lakebase|genie-code": "6587b74e655393df1f0c51b801d4078f90f8d86d24e5780519c11a3c8dd68105",
    "silver_layer_sdp|default": "d059b44d38455ce602ed68f679b24301337dea781ad40c87d6dd6df114aa7eda",
    "silver_layer_sdp|genie-code": "1fc3072b52bc3393d2d1d3221cce6ce3f92dffee098704ae4241f6e879b1abd9",
    "skill_apply_contracts|default": "d1171d7d5ba64137b42b3a88c1863be69426f246f8f99cbb9fb52cd69ba7a3de",
    "skill_apply_contracts|genie-code": "fd17a41462f6752b837a9bdfd0ec7d348a42f201c097c9449c178b57e40dfc6c",
    "skill_certify_tables|default": "629710bdcf73089c13e6e66a3e835f0a73f52452576834e243d2650b35789b06",
    "skill_certify_tables|genie-code": "201d6a69f50f5b1ae49a889f2ac5d22427a04f4258e5a7ecfd2ea1ea6ffa9ee1",
    "skill_create_skillmd|default": "efe9f41076990e1db480b212452b1ba007422171615aea26814a8eba804c0072",
    "skill_create_skillmd|genie-code": "efe9f41076990e1db480b212452b1ba007422171615aea26814a8eba804c0072",
    "skill_define_strategy|default": "207d5bcd5708c51d6ed53f7b17af7815d2b24d9ca99c0993a11a54540119a9a2",
    "skill_define_strategy|genie-code": "207d5bcd5708c51d6ed53f7b17af7815d2b24d9ca99c0993a11a54540119a9a2",
    "skill_install_explore|default": "4e0683ce682e4c957a75386255f3d381c07c8a29ce6303448caf3433ef076a6e",
    "skill_install_explore|genie-code": "5b2ef7620ee977f2e663895b4949d09654d13312cb3f424ca5379fc928e3ca96",
    "sync_from_lakebase|default": "20e24f907c0a64cbff7f466c74e490e9bfe4d1bc29cd667ee1176c6b098d85e1",
    "sync_from_lakebase|genie-code": "22a9c7585af0f8594a4d336e47aa0129b18d6f875932533d4aadb7f181edad32",
    "track_a_agent_app_clone_framework|default": "e100a9c6d48b92a4b115b9d07e34ba609cb90b59e5148d6958b1b4a342027739",
    "track_a_agent_app_clone_framework|genie-code": "57e536a72e9d196d9fe4f2ce3c1448b8500eec3a3a0323626b51e3f823c2754e",
    "track_a_agent_auth_memory|default": "c577c438bd768a9d7319befdadaacb839f93a2cd76cda8282db972c0c431f2d4",
    "track_a_agent_auth_memory|genie-code": "7e442fb2636689c6bfa0e6f5b892e2298dc9f12d7c86da3a9ba73b48ca89fa89",
    "track_a_agent_eval_deploy|default": "27841f771bdc8225e037af4067589eaea4b3475c847bc833335e1525bce19b02",
    "track_a_agent_eval_deploy|genie-code": "d37d1a30ebfd5169d2444c89e63bced34c026743baf97dcc95cc683a6264edae",
    "track_a_agent_ka_genie_tools|default": "9dda20f13dad9acdfdb9ffbdb54a1e5d3d616b030b4f31bf1cfe46d855b40e65",
    "track_a_agent_ka_genie_tools|genie-code": "0b4d69552b43e9fa87cb748a0b63b6c9c5de6655178527a5719529cb68df5d36",
    "uc_resources_foundation|default": "517ba9575e0032b1650d132a8a5e518cc13ffa1bb5fa51114d092b1aadda51df",
    "uc_resources_foundation|genie-code": "c79a1a8f2c167422ebafaf1073455c902dd2bb7fae3186144680cc89ea08e00a",
    "use_case_selection|default": "1f849668d60b6c53757546c0b4e996b4a40ff361b5d6421f00393e723ec349ba",
    "use_case_selection|genie-code": "1f849668d60b6c53757546c0b4e996b4a40ff361b5d6421f00393e723ec349ba",
    "usecase_plan|default": "02771dfeaee3168661511993d5fd804b06b62fc76e81d613dbe5f4b1fbcfce28",
    "usecase_plan|genie-code": "420f013f7be1449bdbb26236b22f6dab0f1a392e0a7a73e117d5ff5c1dd9ac64",
    "wire_ui_agent|default": "38e1a737ec335ff391f152d289cd6067e97b2103b53d2f4f7274679caa3f1197",
    "wire_ui_agent|genie-code": "bb1a0257283355af9251d229d0d138b331b595fb223f318bf55d74cddca2632f",
    "wire_ui_lakebase|default": "ad0963ea1579c4ee287c876b005472bbfc9f29c635a5f682ca5c7c134ede19fe",
    "wire_ui_lakebase|genie-code": "643d61e5e5672d47f2c3782c381b46430e559905a54458b0fa5525529fec9268",
    "workspace_cleanup|default": "47d8fa4e6fe56c871d6bf72e9d3c94a545a9c35f0a3a0adfaee77aa95949584a",
    "workspace_cleanup|genie-code": "c2463c8b4d2c1223268b7cb27ee4cc15846b65e512c161b2b4e6cccec178d6a1",
    "workspace_setup_deploy|default": "7ce6999d85648b1c5fc2d6291e69754891ec65e47826518c7c0029cb6af72d2b",
    "workspace_setup_deploy|genie-code": "bf4c5216656eab9290b24999161e08a598c74f8e262d5a57e55aa0d2668a2bb8",
    # Main's Insights sections (merged into integration): web output at the merge head.
    "insights_activation|default": "bcebc745a60336c98ee262906198fa7db2c0083e72b307e6d493b3343a3ec095",
    "insights_activation|genie-code": "b68e0308caa92b631177d0e538cfc26eddfd47c603183a0d2ee732bb1fab3982",
    "insights_alerts|default": "50ea29ae95cf9836fb3ba0a71043d2581787f37e9e7336933e1cd74ead0ec1e3",
    "insights_alerts|genie-code": "90e0246ddf9ecf0b2efa0060d5cd9bb3d852bd2683f3ef1371dc9e3bf10daeed",
    "insights_app_deploy|default": "74f1cddae6c4787f4463e1d8d1fbd8a66d9fe1e93c6888780305789ce0bfcf08",
    "insights_app_deploy|genie-code": "afe948c9d73061daedfa3119a9e10f01fa0c3953062b7acb60cfd8f631256f53",
    "insights_genie_in_app|default": "e63611de6b44cde03fe098862a711d72b5a88e7cffdf3bd7b205ebd448bddffc",
    "insights_genie_in_app|genie-code": "e7bd163c4f7cadd611ebec677676d462285cfd182844f5d3d51fc52800e6e3e3",
    "insights_reverse_sync|default": "f1df749969508fb8bc20f5b616ee1012eab233d7a2924ebbba488569da12f281",
    "insights_reverse_sync|genie-code": "74f81169b1d9e0677f08f955b387179b558875d9e3cbe44e8b161d397852815f",
    "insights_table_design|default": "ed6a6591422d2ddd70655c40429ae96679612da3cf43b06b62f7168ba02feb82",
    "insights_table_design|genie-code": "3a9a21fb0713a7ffb754f18d3ab0e79ba1059ce02fa1b98050e218a0c1f7dbfc",
}
