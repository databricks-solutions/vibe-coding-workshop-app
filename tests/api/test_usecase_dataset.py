"""
API tests for per-use-case sample dataset resolution.

The bug these guard: an attendee running a Retail use case had Step 10 source
`samples.wanderbricks` — a hotel-booking dataset — and modelled a Bronze layer of
properties, hosts and bookings for a store-performance app.

It was NOT a substitution failure. Every prompt correctly templates
{chapter_3_lakehouse_catalog}/{chapter_3_lakehouse_schema}; those parameters were
simply global, and their product default is the booking dataset. One global default
served all 48 use cases across 4 industries. The per-session override that was meant
to cover this is written only when Step 9 completes, so any path that skips step 9
inherits tourism data.

Resolution must therefore be: session override > use-case default > global default.
The middle term is new, and the first must still win — a facilitator or step 9 that
has set an explicit value has to beat the seeded per-industry guess.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_usecase_dataset -v
"""

import json
import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes  # noqa: E402

GLOBALS = {
    "chapter_3_lakehouse_catalog": "samples",
    "chapter_3_lakehouse_schema": "wanderbricks",
}


class UseCaseDatasetResolutionTest(unittest.TestCase):
    """get_effective_workshop_parameters applies the use-case dataset."""

    def setUp(self):
        self._orig_globals = routes.get_workshop_parameters_sync
        self._orig_query = routes.execute_query
        self._orig_insert = routes.execute_insert
        routes.get_workshop_parameters_sync = lambda: dict(GLOBALS)
        # Derived-parameter persistence is irrelevant here and needs no database.
        routes.execute_insert = lambda *a, **k: 1

    def tearDown(self):
        routes.get_workshop_parameters_sync = self._orig_globals
        routes.execute_query = self._orig_query
        routes.execute_insert = self._orig_insert

    def _session(self, *, session_params=None, sample_catalog=None, sample_schema=None,
                 use_case="retailer_insights", workshop_level="end-to-end"):
        """Stub the session + LATERAL use-case join that resolution performs."""
        row = {
            "session_parameters": json.dumps(session_params or {}),
            "created_by": "attendee@example.com",
            "use_case_label": "Retailer Insights",
            "use_case": use_case,
            "workshop_level": workshop_level,
            "sample_catalog": sample_catalog,
            "sample_schema": sample_schema,
        }
        routes.execute_query = lambda sql, params=None: [row]

    def test_use_case_default_beats_global_default(self):
        """The reported bug: a retail session must not read the booking dataset."""
        self._session(sample_catalog="samples", sample_schema="bakehouse")
        params = routes.get_effective_workshop_parameters("s1")

        self.assertEqual(params["chapter_3_lakehouse_catalog"], "samples")
        self.assertEqual(params["chapter_3_lakehouse_schema"], "bakehouse")

    def test_session_override_still_wins(self):
        """
        Step 9 and the facilitator's editor write session overrides. Those are explicit
        choices about this attendee's workspace and must outrank a seeded per-industry
        default, or registering Lakebase in UC would stop taking effect.
        """
        self._session(
            session_params={
                "chapter_3_lakehouse_catalog": "my_catalog",
                "chapter_3_lakehouse_schema": "my_schema",
            },
            sample_catalog="samples",
            sample_schema="bakehouse",
        )
        params = routes.get_effective_workshop_parameters("s1")

        self.assertEqual(params["chapter_3_lakehouse_catalog"], "my_catalog")
        self.assertEqual(params["chapter_3_lakehouse_schema"], "my_schema")

    def test_no_use_case_default_keeps_global(self):
        """An industry nobody has seeded a dataset for behaves exactly as before."""
        self._session(sample_catalog=None, sample_schema=None)
        params = routes.get_effective_workshop_parameters("s1")

        self.assertEqual(params["chapter_3_lakehouse_schema"], "wanderbricks")

    def test_partial_use_case_default_only_overrides_what_it_sets(self):
        """A schema-only default must not blank the catalog."""
        self._session(sample_catalog=None, sample_schema="bakehouse")
        params = routes.get_effective_workshop_parameters("s1")

        self.assertEqual(params["chapter_3_lakehouse_catalog"], "samples")
        self.assertEqual(params["chapter_3_lakehouse_schema"], "bakehouse")

    def test_accelerator_output_schema_is_not_renamed_by_the_dataset(self):
        """
        Accelerator paths name their OUTPUT schema after the GLOBAL lakehouse schema.
        That is a naming rule, unrelated to which sample data a use case reads, so
        pointing Retail at bakehouse must not silently rename an attendee's target
        schema from user_wanderbricks to user_bakehouse.
        """
        self._session(
            sample_catalog="samples",
            sample_schema="bakehouse",
            workshop_level="accelerator",
        )
        params = routes.get_effective_workshop_parameters("s1")

        self.assertEqual(params["user_schema_prefix"], "attendee_wanderbricks")
        # The source dataset still resolves to the use case's own choice.
        self.assertEqual(params["chapter_3_lakehouse_schema"], "bakehouse")

    def test_missing_dataset_columns_degrade_to_globals(self):
        """
        An install that has not yet run ddl/14 must keep working. The lookup fails, and
        the fallback query must still return the session's parameters rather than
        losing them.
        """
        calls = {"n": 0}

        def query(sql, params=None):
            calls["n"] += 1
            if "sample_catalog" in sql:
                raise RuntimeError('column "sample_catalog" does not exist')
            return [{
                "session_parameters": json.dumps({"user_app_name": "kept-app"}),
                "created_by": "attendee@example.com",
                "use_case_label": "Retailer Insights",
                "use_case": "retailer_insights",
                "workshop_level": "end-to-end",
            }]

        routes.execute_query = query
        params = routes.get_effective_workshop_parameters("s1")

        self.assertEqual(calls["n"], 2, "should retry without the dataset columns")
        self.assertEqual(params["chapter_3_lakehouse_schema"], "wanderbricks")
        self.assertEqual(params["user_app_name"], "kept-app")


class SeedCoverageTest(unittest.TestCase):
    """
    The seed must cover every industry that ships, or the bug survives for whichever
    one was missed. Asserted against the seed files rather than a live database so it
    runs anywhere.
    """

    def setUp(self):
        seed_dir = REPO_ROOT / "db" / "lakebase" / "dml_seed"
        self.usecases = (seed_dir / "01_seed_usecase_descriptions.sql").read_text()
        self.datasets = (seed_dir / "18_seed_usecase_datasets.sql").read_text()

    def test_every_seeded_industry_gets_a_dataset(self):
        import re

        industries = set(
            re.findall(r"^\(\d+,\s*'([a-z_-]+)'", self.usecases, re.MULTILINE)
        )
        self.assertTrue(industries, "could not parse industries from the seed")

        for industry in industries:
            self.assertIn(
                f"'{industry}'",
                self.datasets,
                f"industry '{industry}' has no sample dataset, so it inherits the "
                f"global default — the exact bug this fixes",
            )

    def test_retail_and_cpg_do_not_get_the_booking_dataset(self):
        """
        The regression itself, stated plainly. Asserted against the UPDATE statements
        only — comment prose legitimately mentions both datasets when explaining the
        choice, so matching raw file text would pass or fail for the wrong reason.
        """
        import re

        sql_only = "\n".join(
            line for line in self.datasets.splitlines() if not line.strip().startswith("--")
        )
        updates = [s for s in sql_only.split(";") if "UPDATE" in s]
        self.assertTrue(updates, "no UPDATE statements found in the seed")

        for stmt in updates:
            industries = set(re.findall(r"'(retail|cpg|travel|sample)'", stmt))
            schema_match = re.search(r"sample_schema\s*=\s*'([a-z_]+)'", stmt)
            self.assertIsNotNone(schema_match, f"no sample_schema set in: {stmt[:80]}")
            schema = schema_match.group(1)

            if industries & {"retail", "cpg"}:
                self.assertEqual(
                    schema,
                    "bakehouse",
                    "retail/CPG must get the retail-shaped dataset, not a booking one",
                )
            if industries & {"travel", "sample"}:
                self.assertEqual(schema, "wanderbricks")

    def test_seed_is_guarded_so_admin_choices_survive_redeploy(self):
        self.assertIn("sample_catalog IS NULL", self.datasets)


if __name__ == "__main__":
    unittest.main(verbosity=2)
