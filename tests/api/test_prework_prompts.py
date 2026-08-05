"""
Guards for the data pre-work prompt content.

The bug these exist for: the first version of these prompts referenced
`{committed_entities}`, `{committed_fact_grain}` and friends, on the assumption that
_decision_params prefixes committed values with `committed_`. It does not — tokens are
named after the FIELD KEY itself, so a field `fact_grain` is available as `{fact_grain}`.
(`{committed_features}` works elsewhere only because that field is literally named
`committed_features`.)

The result was a prompt that reached the attendee with four raw placeholders in it. Every
test passed, the seed applied cleanly, and the only way to see it was to read the SERVED
prompt. So these tests assert the seed against the substitution mechanism directly.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_prework_prompts -v
"""

import os
import re
import sys
import unittest
from pathlib import Path

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes  # noqa: E402

SEED = (REPO_ROOT / "db" / "lakebase" / "dml_seed" / "21_seed_prework_steps.sql").read_text()

# Token assertions run against executable SQL only, for two reasons: the repair UPDATE at
# the end must NAME the broken tokens in order to replace them, and the header comments
# legitimately discuss `{committed_fact_grain}` while explaining why it is wrong. Comments
# are stripped and the repair block dropped, leaving the prompt text an attendee sees.
SEED_INSERTS = "\n".join(
    line for line in SEED.split("-- Repair:")[0].splitlines()
    if not line.strip().startswith("--")
)


class PreworkTokenTest(unittest.TestCase):
    """Every token the pre-work prompts use must actually be produced."""

    # Fields declared across the three pre-work steps.
    DECLARED_FIELDS = {
        "data_source", "key_question",          # step 57
        "entities", "fact_grain", "story_anomaly",  # step 58
    }

    def test_decision_params_names_tokens_after_the_field_key(self):
        """The mechanism the prompts depend on, asserted rather than assumed."""
        params = routes._decision_params({
            "data_model_design": {
                "decision": {
                    "fact_grain": "one delivery attempt per parcel",
                    "entities": ["deliveries", "carriers"],
                }
            }
        })

        self.assertIn("fact_grain", params)
        self.assertIn("entities", params)
        self.assertNotIn("committed_fact_grain", params)
        # Lists render as a numbered list so priority order survives.
        self.assertIn("deliveries", params["entities"])

    def test_no_prompt_uses_a_committed_prefixed_token(self):
        """
        The exact regression. A `{committed_x}` token in these prompts resolves to
        nothing and is rendered to the attendee verbatim.
        """
        leaked = sorted(set(re.findall(r"\{committed_[a-z_]+\}", SEED_INSERTS)))

        self.assertEqual(
            leaked, [],
            f"these tokens will never substitute: {leaked} — _decision_params names "
            f"tokens after the field key",
        )

    def test_every_decision_token_matches_a_declared_field(self):
        """
        Catches the inverse mistake: referencing a field that no step actually collects,
        which also leaks a raw placeholder.
        """
        # Tokens the session supplies rather than a decision step.
        session_tokens = {
            "industry_name", "use_case_title", "use_case_description",
            "user_catalog", "user_schema_prefix", "synthetic_row_target",
            "industry_model_repo", "schema",
        }

        used = set(re.findall(r"\{([a-z_][a-z0-9_]*)\}", SEED_INSERTS))
        unexplained = used - session_tokens - self.DECLARED_FIELDS

        self.assertEqual(
            unexplained, set(),
            f"tokens with no source: {sorted(unexplained)}",
        )

    def test_the_generation_brief_carries_the_skill_and_its_rules(self):
        """
        The prompt's whole value is that the agent starts from a governed model and
        produces data with a story. Losing any of these turns it into "make some rows".
        """
        for required in (
            "databricks-synthetic-data-gen",   # the skill that does the work
            "v1/mvm",                          # MVM tier, not the far larger ECM
            "No uniform distributions",        # flat data has nothing to demonstrate
            "parent tables to Delta first",    # valid foreign keys
            "report_gate",                     # how the dataset gets back to the app
        ):
            self.assertIn(required, SEED, f"generation brief lost: {required!r}")

    def test_provision_step_declares_a_registered_check(self):
        from src.backend.services import verification

        check = re.search(r'"check":\s*"([a-z_]+)"', SEED)
        self.assertIsNotNone(check, "step 59 declares no verification check")
        self.assertIn(check.group(1), verification._CHECK_REGISTRY)

    def test_repair_update_is_guarded_against_clobbering_admin_edits(self):
        """The one UPDATE in this seed must never overwrite an edited prompt."""
        self.assertIn("created_by = 'seed'", SEED)


if __name__ == "__main__":
    unittest.main(verbosity=2)
