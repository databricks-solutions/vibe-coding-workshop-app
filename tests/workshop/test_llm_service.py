"""services/llm.py extract (D4 §1.2, D-20): a move + import rewire, no behavior change.

Seven offline tests:

  E1 identity: every re-exported name is the SAME object on routes and services.llm.
     TAMPER: drop a name from the routes re-export -> AttributeError / not-identical.
  E2 no layer crossing: importing services.llm in a fresh interpreter leaves
     src.backend.api.routes unimported, and llm.py has no src.backend.api import.
     TAMPER: add `import src.backend.api.routes` to llm.py.
  E3 routes no longer DEFINES the moved names (AST scan of routes.py).
     TAMPER: add `def get_workspace_client(): pass` to routes.py.
  E4 single singleton: routes.get_workspace_client() returns llm._workspace_client.
  E5 seam for coaching: llm.call_databricks_serving_endpoint works offline with its
     helpers patched on llm (the owner module).
  E6 body fidelity: each moved function's source is byte-identical to its source in
     routes.py at the pinned pre-extract base SHA; call_databricks_serving_endpoint
     only after applying E6_INTENTIONAL_EDITS (llm-response-log-redact, D-27).
     TAMPER: change one character in llm.call_databricks_serving_endpoint.
     A clone without the base object FAILS (fetch full history), never skips (D-21).
  E7 no stale patch target: no test monkeypatches a moved name (or the
     DATABRICKS_SDK_AVAILABLE flag the moved code reads from llm) on routes; that
     patch lands on the re-export and never reaches the moved code.
     TAMPER: put `routes` back in test_offload_fallback_paths.py's SDK-flag patch.
"""

import ast
import asyncio
import inspect
import os
import pathlib
import re
import shutil
import subprocess
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes  # noqa: E402
from src.backend.services import llm  # noqa: E402

# Pre-extract base: routes.py still defines the moved functions here. Pinned, not the
# integration branch, because that branch's routes.py loses them once this merges.
BASE_SHA = "3d5b700195464c3da9af16e2acb9ce4ff5ef7865"

REEXPORTED = [
    "SERVING_ENDPOINT_NAME",
    "FALLBACK_ENDPOINTS",
    "get_workspace_client",
    "get_available_serving_endpoints",
    "get_best_available_endpoint",
    "_extract_text",
    "call_databricks_serving_endpoint",
]
MOVED_FUNCTIONS = [
    "call_databricks_serving_endpoint",
    "get_workspace_client",
    "get_available_serving_endpoints",
    "get_best_available_endpoint",
    "_extract_text",
]
MOVED_STATE = [
    "SERVING_ENDPOINT_NAME",
    "FALLBACK_ENDPOINTS",
    "_workspace_client",
    "_available_endpoints_cache",
]

ROUTES_PY = REPO_ROOT / "src" / "backend" / "api" / "routes.py"
LLM_PY = REPO_ROOT / "src" / "backend" / "services" / "llm.py"


def test_e1_routes_reexports_are_the_same_objects():
    for name in REEXPORTED:
        assert getattr(routes, name) is getattr(llm, name), name


def test_e2_llm_does_not_import_the_api_layer():
    code = (
        "import sys; import src.backend.services.llm; "
        "print('src.backend.api.routes' in sys.modules, "
        "any(m == 'src.backend.api' or m.startswith('src.backend.api.') for m in sys.modules))"
    )
    env = dict(os.environ, DATABRICKS_CONFIG_FILE="/dev/null")
    out = subprocess.run(
        [sys.executable, "-c", code], cwd=REPO_ROOT, env=env,
        capture_output=True, text=True, check=True,
    )
    assert out.stdout.split()[-2:] == ["False", "False"], out.stdout + out.stderr

    tree = ast.parse(LLM_PY.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods = [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            mods = [node.module or ""]
        else:
            continue
        for mod in mods:
            assert not (mod == "src.backend.api" or mod.startswith("src.backend.api.")), (
                f"llm.py:{node.lineno} imports {mod}"
            )


def test_e3_routes_no_longer_defines_the_moved_names():
    tree = ast.parse(ROUTES_PY.read_text(encoding="utf-8"))
    defs = [
        (n.name, n.lineno) for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in MOVED_FUNCTIONS
    ]
    assert defs == [], f"routes.py still defines {defs}"

    assigned = []
    for n in tree.body:
        if isinstance(n, ast.Assign):
            targets = n.targets
        elif isinstance(n, (ast.AnnAssign, ast.AugAssign)):
            targets = [n.target]
        else:
            continue
        for t in targets:
            for x in ast.walk(t):
                if isinstance(x, ast.Name) and x.id in MOVED_STATE:
                    assigned.append((x.id, n.lineno))
    assert assigned == [], f"routes.py still assigns {assigned}"


def test_e4_single_workspace_client_singleton(monkeypatch):
    sentinel = object()
    monkeypatch.setattr(llm, "_workspace_client", sentinel)
    assert routes.get_workspace_client() is sentinel


class _FakeConfig:
    host = "https://example.cloud.databricks.com"


class _FakeApiClient:
    def do(self, method, path, body):  # noqa: ARG002 — mimics the SDK signature
        return {"choices": [{"message": {"content": "coach says hi"}}], "model": "ep"}


class _FakeClient:
    config = _FakeConfig()
    api_client = _FakeApiClient()
    serving_endpoints = None


def test_e5_llm_seam_works_offline_with_helpers_patched_on_llm(monkeypatch):
    monkeypatch.setattr(llm, "DATABRICKS_SDK_AVAILABLE", True)
    monkeypatch.setattr(llm, "get_workspace_client", lambda: _FakeClient())
    monkeypatch.setattr(llm, "get_best_available_endpoint", lambda: "ep")

    result = asyncio.run(llm.call_databricks_serving_endpoint("hi", endpoint_name="ep"))

    assert result["response"] == "coach says hi"


def _base_routes_source():
    if shutil.which("git") is None:
        pytest.skip("git is not available")
    out = subprocess.run(
        ["git", "show", f"{BASE_SHA}:src/backend/api/routes.py"],
        cwd=REPO_ROOT, capture_output=True, text=True,
    )
    if out.returncode != 0:
        pytest.fail(
            f"base SHA {BASE_SHA} is not in this clone; fetch full history "
            f"(git fetch --unshallow) — E6 must not skip: {out.stderr.strip()}"
        )
    return out.stdout


# post-move intentional edits (llm-response-log-redact, D-27): ordered
# (old_line, new_line_or_None) pairs applied to the base body of
# call_databricks_serving_endpoint; None deletes the line. Each old line must occur
# exactly once in the base body; any other difference stays red.
E6_INTENTIONAL_EDITS = [
    (
        '        logger.info(f"  Response repr: {repr(query_response)[:500]}")',
        '        logger.info(f"  Response received: type={type(query_response).__name__}")',
    ),
    ('                val_preview = str(val)[:100] if val else "None"', None),
    (
        "                logger.debug(f\"    Key '{key}': type={val_type}, value={val_preview}\")",
        "                logger.debug(f\"    Key '{key}': type={val_type}, length={len(str(val))}\")",
    ),
    ("            preview = str(content)[:150]", None),
    (
        "            logger.info(f\"     Preview: {preview}{'...' if len(str(content)) > 150 else ''}\")",
        None,
    ),
]
E6_EDITED_FUNCTION = "call_databricks_serving_endpoint"


def _apply_intentional_edits(body, edits):
    lines = body.split("\n")
    for old, new in edits:
        hits = [i for i, line in enumerate(lines) if line == old]
        assert len(hits) == 1, f"intentional edit must match exactly once, got {len(hits)}: {old!r}"
        if new is None:
            del lines[hits[0]]
        else:
            lines[hits[0]] = new
    return "\n".join(lines)


def test_e6_moved_function_bodies_are_byte_identical_to_base():
    base_src = _base_routes_source()
    base_tree = ast.parse(base_src)
    base_defs = {
        n.name: ast.get_source_segment(base_src, n)
        for n in base_tree.body
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in MOVED_FUNCTIONS
    }
    assert sorted(base_defs) == sorted(MOVED_FUNCTIONS)
    for name in MOVED_FUNCTIONS:
        moved = inspect.getsource(getattr(llm, name)).rstrip("\n")
        expected = base_defs[name]
        if name == E6_EDITED_FUNCTION:
            expected = _apply_intentional_edits(expected, E6_INTENTIONAL_EDITS)
        assert moved == expected, f"{name} body differs from routes.py@{BASE_SHA[:7]}"


def test_e7_no_test_patches_a_moved_name_on_routes():
    names = MOVED_FUNCTIONS + MOVED_STATE + ["DATABRICKS_SDK_AVAILABLE"]
    pattern = re.compile(
        r"""monkeypatch\.setattr\(\s*routes\s*,\s*["'](%s)["']"""
        % "|".join(re.escape(n) for n in names)
    )
    this_file = pathlib.Path(__file__).resolve()
    hits = []
    for path in sorted((REPO_ROOT / "tests").rglob("*.py")):
        if path.resolve() == this_file:
            continue
        text = path.read_text(encoding="utf-8")
        for m in pattern.finditer(text):
            lineno = text.count("\n", 0, m.start()) + 1
            hits.append(f"{path.relative_to(REPO_ROOT)}:{lineno}: {m.group(1)}")
    assert hits == [], "patch these on services.llm, not routes:\n" + "\n".join(hits)
