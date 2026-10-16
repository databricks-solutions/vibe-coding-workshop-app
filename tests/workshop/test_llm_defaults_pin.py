"""Pin the LLM endpoint defaults in services/llm.py (app-small-followups P1).

L1 with DATABRICKS_SERVING_ENDPOINT unset, SERVING_ENDPOINT_NAME is
   "databricks-claude-sonnet-5-5".
L2 FALLBACK_ENDPOINTS is the exact 8-entry list, in order (equal to main
   ec50e37's, per the #158 review).

llm is imported in a fresh interpreter with the variable removed, so a
developer's own DATABRICKS_SERVING_ENDPOINT can't mask a default change. No
importlib.reload: reloading resets llm's module state and breaks the routes.py
re-export identity checks in test_llm_service.py.
"""

import json
import os
import pathlib
import subprocess
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]

EXPECTED_DEFAULT = "databricks-claude-sonnet-5-5"
EXPECTED_FALLBACKS = [
    "databricks-claude-sonnet-4-6",
    "databricks-claude-sonnet-4-5",
    "databricks-meta-llama-3-3-70b-instruct",
    "databricks-llama-4-maverick",
    "databricks-gemma-3-12b",
    "databricks-meta-llama-3-1-8b-instruct",
    "databricks-qwen3-next-80b-a3b-instruct",
    "databricks-gpt-oss-120b",
]

_PROBE = (
    "import json, sys\n"
    f"sys.path.insert(0, {str(REPO_ROOT)!r})\n"
    "from src.backend.services import llm\n"
    "print(json.dumps({'default': llm.SERVING_ENDPOINT_NAME, 'fallbacks': llm.FALLBACK_ENDPOINTS}))\n"
)


def _defaults_with_env_unset():
    env = {k: v for k, v in os.environ.items() if k != "DATABRICKS_SERVING_ENDPOINT"}
    env["LAKEBASE_HOST"] = ""
    env["DATABRICKS_CONFIG_FILE"] = os.devnull
    out = subprocess.run(
        [sys.executable, "-c", _PROBE],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    ).stdout
    return json.loads(out.strip().splitlines()[-1])


def test_serving_endpoint_default_is_claude_sonnet_5_5():
    assert _defaults_with_env_unset()["default"] == EXPECTED_DEFAULT


def test_fallback_endpoints_are_the_exact_ordered_list():
    assert _defaults_with_env_unset()["fallbacks"] == EXPECTED_FALLBACKS
