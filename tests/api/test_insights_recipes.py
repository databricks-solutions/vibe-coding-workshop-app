"""
GET /api/config/insights-recipes reads INSIGHTS_BUILD_RECIPES and stays off by default.

    USE_LAKEBASE=false python3 -m unittest tests/api/test_insights_recipes.py -v
"""

import os
import sys
import unittest
from pathlib import Path
from unittest import mock

os.environ.setdefault("USE_LAKEBASE", "false")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from starlette.testclient import TestClient  # noqa: E402
from app import app  # noqa: E402

client = TestClient(app)


def _enabled(value):
    env = {k: v for k, v in os.environ.items() if k != "INSIGHTS_BUILD_RECIPES"}
    if value is not None:
        env["INSIGHTS_BUILD_RECIPES"] = value
    with mock.patch.dict(os.environ, env, clear=True):
        res = client.get("/api/config/insights-recipes")
    assert res.status_code == 200, res.text
    return res.json()["enabled"]


class TestInsightsRecipes(unittest.TestCase):
    def test_off_when_unset_or_blank(self):
        self.assertEqual(_enabled(None), [])
        self.assertEqual(_enabled(""), [])

    def test_all(self):
        self.assertEqual(_enabled("all"), ["ontology", "alerts", "app_view", "copilot"])

    def test_filters_unknown_and_normalizes(self):
        self.assertEqual(_enabled(" Alerts , bogus,copilot "), ["alerts", "copilot"])


if __name__ == "__main__":
    unittest.main()
