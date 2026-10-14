"""app.yaml.template sets the coaching budget override (D-106).

Offline: parses the tracked template and checks the value against
``coaching._knob``. Plan: docs/superpowers/plans/2026-10-14-coach-budget-env.md.

Tampers (each turns the test red):
- delete the VIBE_COACH_BUDGET_S entry -> test_app_template_env
- rename it to VIBE_COACH_BUDGET -> test_app_template_env
- set its value to "0", "abc" or "-1" -> test_app_template_env
- duplicate the entry -> test_app_template_env
"""

import pathlib
import sys

import yaml

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.services import coaching  # noqa: E402

TEMPLATE = REPO_ROOT / "app.yaml.template"


def test_app_template_env(monkeypatch):
    config = yaml.safe_load(TEMPLATE.read_text())
    names = [entry["name"] for entry in config["env"]]
    assert len(names) == len(set(names))

    entries = [entry for entry in config["env"] if entry["name"] == "VIBE_COACH_BUDGET_S"]
    assert len(entries) == 1
    assert entries[0]["value"] == "20"

    monkeypatch.setenv("VIBE_COACH_BUDGET_S", entries[0]["value"])
    assert coaching._knob("VIBE_COACH_BUDGET_S", coaching.COACH_BUDGET_S, float) == 20.0
