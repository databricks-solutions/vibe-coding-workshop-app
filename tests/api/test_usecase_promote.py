"""
API tests for promoting an attendee-defined use case.

A use case built in the use case builder lives in `saved_usecase_descriptions`, which is
a text library — nothing can select it as a session's use case, and crucially it has no
row in `usecase_descriptions`, which is where a use case's own dataset is recorded
(`ddl/14`). So a self-defined use case resolved neither a session override nor a
use-case default and inherited the global `samples.wanderbricks`: the same silent
fallback that had a retail workshop modelling hotel bookings.

Promotion gives it a real row, and deliberately leaves the dataset NULL so the pre-work
fills it in. Guessing a dataset is the bug being fixed, not the fix.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_usecase_promote -v
"""

import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.backend.api import routes  # noqa: E402


class PromoteUseCaseTest(unittest.TestCase):
    def setUp(self):
        self._orig_query = routes.execute_query
        self._orig_insert = routes.execute_insert
        self._orig_cache = routes.clear_lakebase_cache

        self.inserts = []
        routes.execute_query = lambda sql, params=None: [{"max_version": 0}]
        routes.execute_insert = lambda sql, params=None: self.inserts.append((sql, params)) or True
        routes.clear_lakebase_cache = lambda: None

        app = FastAPI()
        app.include_router(routes.router)
        self.client = TestClient(app)

    def tearDown(self):
        routes.execute_query = self._orig_query
        routes.execute_insert = self._orig_insert
        routes.clear_lakebase_cache = self._orig_cache

    def _promote(self, **body):
        payload = {
            "industry": "Fleet Logistics",
            "use_case_name": "Delivery SLA Breaches",
            "description": "Track late deliveries and the cost of each breach.",
        }
        payload.update(body)
        return self.client.post("/usecase-builder/promote", json=payload)

    def test_promotes_with_slugified_identifiers(self):
        response = self._promote()

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["industry"], "fleet_logistics")
        self.assertEqual(data["use_case"], "delivery_sla_breaches")

    def test_dataset_is_left_unset_on_purpose(self):
        """
        The whole point. Promotion must NOT invent a dataset — it creates the place for
        one, and the pre-work fills it. A promoted use case that silently carried the
        product default would reproduce the bug this exists to fix.
        """
        data = self._promote().json()

        self.assertEqual(data["dataset_status"], "unset")

        _, params = self.inserts[0]
        self.assertNotIn("samples", params, "no dataset value may be written at promotion")
        self.assertNotIn("wanderbricks", params)

    def test_row_is_active_so_it_appears_in_the_picker(self):
        """
        Seed 01 ships most product content inactive and /api/industries filters on
        is_active, so a promoted use case that defaulted to inactive would be invisible
        in the picker it was just created from.
        """
        self._promote()
        sql, _ = self.inserts[0]

        self.assertIn("TRUE", sql)
        self.assertIn("is_active", sql)

    def test_marked_as_attendee_origin_with_attribution(self):
        """
        A facilitator clearing up after a workshop needs to tell attendee content from
        shipped product content, and who created it.
        """
        self._promote()
        sql, params = self.inserts[0]

        self.assertIn("origin", sql)
        self.assertIn("'attendee'", sql)
        self.assertIn("created_by_email", sql)
        # The description and both identity columns are bound parameters.
        self.assertIn("Track late deliveries and the cost of each breach.", params)

    def test_second_promotion_appends_a_version(self):
        """
        Append-only: an attendee refining their idea must not invalidate a session
        already running against the earlier text.
        """
        routes.execute_query = lambda sql, params=None: [{"max_version": 3}]

        self.assertEqual(self._promote().json()["version"], 4)

    def test_missing_industry_or_name_is_rejected(self):
        self.assertEqual(self._promote(industry="").status_code, 400)
        self.assertEqual(self._promote(use_case_name="").status_code, 400)

    def test_empty_description_is_rejected(self):
        self.assertEqual(self._promote(description="   ").status_code, 400)

    def test_unsluggable_names_are_rejected(self):
        """
        Punctuation-only input would slugify to an empty string, producing a row that can
        never be joined against a session.
        """
        self.assertEqual(self._promote(industry="!!!").status_code, 400)
        self.assertEqual(self._promote(use_case_name="???").status_code, 400)

    def test_database_failure_does_not_leak_a_column_error(self):
        def boom(sql, params=None):
            raise RuntimeError('column "origin" does not exist')

        routes.execute_insert = boom
        response = self._promote()

        self.assertEqual(response.status_code, 500)
        self.assertNotIn("origin", response.json()["detail"])
        self.assertIn("migrations", response.json()["detail"])

    def test_picker_cache_is_cleared(self):
        """Without this the attendee cannot see the use case they just created."""
        cleared = {"n": 0}
        routes.clear_lakebase_cache = lambda: cleared.__setitem__("n", cleared["n"] + 1)

        self._promote()

        self.assertEqual(cleared["n"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
