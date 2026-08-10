"""
Guards for the Solution Builder practices seeded in 23/24/25.

Three classes of bug these exist for, all of which have actually happened in this repo:

  1. **A token that never substitutes.** _decision_params names tokens after the FIELD KEY,
     so a field `protagonist` is `{protagonist}` and never `{committed_protagonist}`. The
     pre-work seed shipped with four such tokens and every test passed; the only way to see
     it was to read the SERVED prompt.

  2. **A field key that silently collides.** _decision_params flattens every step's fields
     into ONE namespace, so two steps declaring the same key means the last one committed
     wins and the other step's downstream prompt quietly changes meaning. `fact_grain` is
     already in this state (steps 11 and 58). Nothing in the codebase enforced uniqueness
     before this file.

  3. **Text that gets "simplified" back out.** The temporal-anchoring rules in the
     generation brief are the fix for spikes landing at max(date). They read like prose
     someone might tidy up, so they are asserted.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_story_and_coherence -v
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

SEED_DIR = REPO_ROOT / "db" / "lakebase" / "dml_seed"
STORY = (SEED_DIR / "23_seed_story_fields.sql").read_text()
COHERENCE = (SEED_DIR / "24_seed_coherence_gate.sql").read_text()
HANDOFF = (SEED_DIR / "25_seed_handoff_before_cleanup.sql").read_text()

NEW_SEEDS = {
    "23_seed_story_fields.sql": STORY,
    "24_seed_coherence_gate.sql": COHERENCE,
    "25_seed_handoff_before_cleanup.sql": HANDOFF,
}


def _sql_only(text: str) -> str:
    """
    Executable SQL with comments stripped.

    Necessary because the header comments in these seeds legitimately discuss the very
    mistakes being asserted against — 23's header names `{committed_protagonist}` while
    explaining why it is wrong, and matching that would fail the test it documents.
    """
    return "\n".join(
        line for line in text.splitlines() if not line.strip().startswith("--")
    )


def _statements(sql: str) -> list:
    """
    Split into statements on semicolons that are NOT inside a string literal.

    A naive split on ';' truncates these seeds mid-statement, because the prompt text
    legitimately contains semicolons — the protagonist hint reads "…accountable for return
    rate" is; "operations users" is not'. The first version of this file split naively and
    reported every UPDATE as unguarded, because the WHERE clause had been cut off. The
    real seed executor (parse_sql_statements in setup-lakebase.sh) is quote-aware for
    exactly this reason, so the test has to be too.
    """
    out, cur, in_string, i = [], [], False, 0
    while i < len(sql):
        ch = sql[i]
        if ch == "'":
            # '' is an escaped quote inside a literal, not a close-then-open.
            if in_string and i + 1 < len(sql) and sql[i + 1] == "'":
                cur.append("''")
                i += 2
                continue
            in_string = not in_string
        elif ch == ";" and not in_string:
            out.append("".join(cur))
            cur = []
            i += 1
            continue
        cur.append(ch)
        i += 1
    if "".join(cur).strip():
        out.append("".join(cur))
    return [s for s in out if s.strip()]


def _updates(sql: str) -> list:
    """Every UPDATE against section_input_prompts, whole and un-truncated."""
    return [
        s for s in _statements(_sql_only(sql))
        if s.lstrip().upper().startswith("UPDATE") and "section_input_prompts" in s
    ]


class FieldKeyNamespaceTest(unittest.TestCase):
    """
    _decision_params has one flat namespace, and nothing enforced uniqueness in it.

    A collision is invisible: both steps render fine, both commits save, and the only
    symptom is that a downstream prompt substitutes the OTHER step's value. This is the
    guard that stops the next person adding a fifth `fact_grain`.
    """

    # `fact_grain` is declared by BOTH gold_layer_design (step 11, seeds 12/17) and
    # data_model_design (step 58, seed 21), so whichever the attendee committed most
    # recently wins everywhere.
    #
    # Deliberately allow-listed rather than fixed. The two steps mean nearly the same
    # thing by it — step 58 commits the grain of the source model, step 11 the grain of
    # the gold fact built from it — so in the common case the collision is harmless and
    # arguably desirable. Renaming 58's key would mean editing its already-shipped
    # generation brief in lockstep, which is not a change to make days before a pilot.
    # The real fix is namespacing tokens by section_tag, and that breaks every {token} in
    # seed 02.
    KNOWN_COLLISIONS = {"fact_grain"}

    def _declared_keys_by_seed(self):
        """Map field key -> set of seed files that declare it."""
        owners = {}
        for path in sorted(SEED_DIR.glob("*.sql")):
            sql = _sql_only(path.read_text())
            for key in re.findall(r'"key":\s*"([a-z_][a-z0-9_]*)"', sql):
                # radio_per_row composites ("scd_decisions::dim_customer") are grouped by
                # their base key, so only the base is a real namespace entry.
                owners.setdefault(key.split("::")[0], set()).add(path.name)
        return owners

    def test_no_two_steps_declare_the_same_decision_field_key(self):
        owners = self._declared_keys_by_seed()

        # A key legitimately appears in several seeds when a later one re-states the whole
        # field array in order to extend it (jsonb_set replaces '{fields}' wholesale). So
        # counting seeds is not the test — the collision that matters is one key attached to
        # two different SECTION TAGS, because that is what makes _decision_params ambiguous.
        real = {}
        for key, seeds in owners.items():
            if key in self.KNOWN_COLLISIONS:
                continue
            tags = set()
            for name in seeds:
                for stmt in _statements(_sql_only((SEED_DIR / name).read_text())):
                    if f'"key": "{key}"' not in stmt:
                        continue
                    tags.update(self._tags_of(stmt))
            if len(tags) > 1:
                real[key] = sorted(tags)

        self.assertEqual(
            real, {},
            "these field keys are declared by more than one step, so _decision_params "
            "will silently substitute whichever was committed last: "
            f"{real}. Rename one, or allow-list it with a reason.",
        )

    @staticmethod
    def _tags_of(stmt: str) -> set:
        """
        The section_tag(s) a statement writes to.

        Two shapes: an UPDATE names them in a WHERE clause, while an INSERT ... SELECT
        (seed 21's idiom) carries the tag as the second selected literal.
        """
        tags = set(re.findall(r"section_tag\s*(?:=|IN \()\s*'([a-z_0-9]+)'", stmt))
        tags.update(re.findall(r"'([a-z_0-9]+)',\s*$", stmt, re.M))
        # Drop the literals that are not step tags: created_by values, field kinds and
        # step kinds all match the same trailing-literal shape.
        return {t for t in tags if t not in {"seed", "text", "decision", "verify",
                                             "instant_prompt", "composite", "freeform"}}

    def test_the_known_collision_is_still_only_fact_grain(self):
        """
        If a second collision gets allow-listed without thought this fails, which is the
        point: the allow-list is a record of one deliberate decision, not a dumping ground.
        """
        self.assertEqual(self.KNOWN_COLLISIONS, {"fact_grain"})

    def test_new_keys_do_not_collide_with_the_existing_namespace(self):
        """The four keys added by 23 and 24, checked directly."""
        owners = self._declared_keys_by_seed()
        for key, seed in (
            ("protagonist", "23_seed_story_fields.sql"),
            ("dollar_impact", "23_seed_story_fields.sql"),
            ("anomaly_timing", "23_seed_story_fields.sql"),
            ("coherence_trace", "24_seed_coherence_gate.sql"),
        ):
            self.assertIn(key, owners, f"{key} is not declared anywhere")
            self.assertEqual(
                owners[key], {seed},
                f"{key} is declared outside {seed} too: {sorted(owners[key])}",
            )


class StoryTokenTest(unittest.TestCase):
    """Every token these prompts use has to actually be produced by something."""

    # Committed by the seeds under test.
    NEW_FIELDS = {"protagonist", "dollar_impact", "anomaly_timing", "coherence_trace"}
    # Committed by earlier steps, reachable because _decision_params is one flat namespace.
    EARLIER_FIELDS = {"fact_grain", "entities", "story_anomaly", "primary_business_question"}
    # Supplied by the session or the workshop_parameters table.
    SESSION_TOKENS = {
        "industry_name", "use_case_title", "use_case_description", "section_tag",
        "lakehouse_default_catalog", "user_schema_prefix", "synthetic_row_target",
        "schema",
    }

    def test_decision_params_produces_the_new_tokens(self):
        """The mechanism the prompts depend on, asserted rather than assumed."""
        params = routes._decision_params({
            "prd_generation": {"decision": {
                "protagonist": "Claire Dubois, VP Operations",
                "dollar_impact": "$1.2M of margin",
            }},
            "data_model_design": {"decision": {"anomaly_timing": "Peak 2-3 weeks ago, now decaying"}},
            "usecase_plan": {"decision": {"coherence_trace": "fact_delivery.sla_breach_flag ..."}},
        })

        for key in self.NEW_FIELDS:
            self.assertIn(key, params, f"{key} never becomes a substitutable token")
            self.assertNotIn(f"committed_{key}", params)

        # The radio must arrive as the literal option string, because the generation brief
        # is written to read correctly for each of the three options.
        self.assertEqual(params["anomaly_timing"], "Peak 2-3 weeks ago, now decaying")

    def test_no_prompt_uses_a_committed_prefixed_token(self):
        for name, sql in NEW_SEEDS.items():
            leaked = sorted(set(re.findall(r"\{committed_[a-z_]+\}", _sql_only(sql))))
            self.assertEqual(
                leaked, [],
                f"{name}: these tokens never substitute and reach the attendee verbatim: "
                f"{leaked}",
            )

    def test_every_token_has_a_source(self):
        """Catches the inverse mistake — referencing a field nothing collects."""
        known = self.NEW_FIELDS | self.EARLIER_FIELDS | self.SESSION_TOKENS
        # jsonb_set's path argument is literally '{fields}', which is a JSON path and not a
        # substitution token. Same shape, different language.
        jsonb_paths = {"fields"}
        for name, sql in NEW_SEEDS.items():
            used = set(re.findall(r"\{([a-z_][a-z0-9_]*)\}", _sql_only(sql)))
            unexplained = used - known - jsonb_paths
            self.assertEqual(
                unexplained, set(),
                f"{name}: tokens with no source: {sorted(unexplained)}",
            )


class CatalystTimingTest(unittest.TestCase):
    """
    The temporal-anchoring rules are the fix for the failure this whole change exists for:
    an agent given a story but no timing anchors the spike at max(date), and the attendee
    gets a cliff at the right-hand edge of every chart instead of an incident with a
    before, a peak and an after.

    Asserted because it reads like prose someone would tidy up.
    """

    def test_the_brief_anchors_the_peak_in_the_past(self):
        brief = _sql_only(STORY)
        for required in (
            "SPIKE_PEAK",        # an explicit, code-level anchor
            "NOW -",             # relative to now, not to the data's own max
            "max(date)",         # the specific thing being forbidden
            "buildup",           # the arc, not just the peak
        ):
            self.assertIn(
                required, brief,
                f"the generation brief lost {required!r} — without it the spike lands at "
                f"the edge of the chart",
            )

    def test_the_brief_explains_why_not_just_what(self):
        """A rule with no reason attached is the first thing an agent overrides."""
        self.assertIn("reads as a cliff", _sql_only(STORY))

    def test_the_timing_field_offers_the_wrong_answer_too(self):
        """
        "Building now, still rising" is offered deliberately: letting someone pick the
        edge-anchored option and then explaining the cost is the lesson. Removing it would
        turn a decision into a quiz.
        """
        self.assertIn("Building now, still rising", STORY)

    def test_the_brief_handles_every_timing_option(self):
        """
        {anomaly_timing} substitutes as the LITERAL option string, so the brief has to read
        correctly for all three — including the one it argues against.
        """
        self.assertIn("still rising", _sql_only(STORY).split("Make the Data Carry Your Story")[1])

    def test_contrast_rule_survives(self):
        """Realistic noise plus a subtle event looks like real data and demonstrates nothing."""
        brief = _sql_only(STORY)
        self.assertIn("dominate ordinary variation", brief)


class MoneyAndProtagonistTest(unittest.TestCase):
    def test_step_three_collects_both(self):
        stmt = _sql_only(STORY).split("WHERE section_tag = 'prd_generation'")[0]
        self.assertIn('"key": "protagonist"', stmt)
        self.assertIn('"key": "dollar_impact"', stmt)

    def test_step_three_keeps_its_existing_fields(self):
        """
        jsonb_set on '{fields}' replaces the whole array, so a partial re-statement would
        silently DELETE committed_features and success_metric — and every downstream prompt
        that substitutes them.
        """
        stmt = _sql_only(STORY).split("WHERE section_tag = 'prd_generation'")[0]
        self.assertIn('"key": "committed_features"', stmt)
        self.assertIn('"key": "success_metric"', stmt)

    def test_step_58_keeps_its_existing_fields(self):
        stmt = _sql_only(STORY).split("WHERE section_tag = 'data_model_design'")[0]
        for key in ("entities", "fact_grain", "story_anomaly"):
            self.assertIn(f'"key": "{key}"', stmt, f"step 58 would lose {key}")

    def test_step_15_keeps_its_existing_field(self):
        stmt = _sql_only(COHERENCE).split("WHERE section_tag = 'usecase_plan'")[0]
        self.assertIn('"key": "primary_business_question"', stmt)

    def test_the_currency_rule_is_stated_not_implied(self):
        """"Improve efficiency" is what this field exists to reject."""
        self.assertIn("$500K at risk", STORY)


class FiveSecondTestPlacementTest(unittest.TestCase):
    def test_it_lands_in_expected_output_not_the_build_instruction(self):
        """
        expected_output is the checklist an attendee reads to decide whether they are done.
        input_template is the ~500-line instruction handed to the agent, where an
        acceptance criterion would just be more text to skim.
        """
        stmt = [
            s for s in _sql_only(STORY).split("UPDATE ")[1:]
            if "aibi_dashboard" in s
        ]
        self.assertEqual(len(stmt), 1, "expected exactly one aibi_dashboard update")
        body = stmt[0][: stmt[0].index(";")]
        self.assertIn("SET expected_output = expected_output ||", body)
        self.assertNotIn("SET input_template", body)

    def test_it_asks_for_the_currency_figure_on_the_dashboard(self):
        """
        The point of threading {dollar_impact} all the way here: a dashboard that does not
        show the number the use case was justified with has not closed the loop.
        """
        self.assertIn("{dollar_impact}", _sql_only(STORY).split("The 5-Second Test")[1])


class CoherenceGateTest(unittest.TestCase):
    def test_it_walks_the_whole_chain(self):
        """
        Solution Builder's contract is data -> pipeline -> dashboard -> agent queries. A
        gate that only checks one link is not a coherence gate.
        """
        prompt = _sql_only(COHERENCE)
        for link in ("**Data.**", "**Pipeline.**", "**Dashboard.**", "**Genie.**"):
            self.assertIn(link, prompt, f"the coherence review skips {link}")

    def test_it_asks_solution_builders_closing_question(self):
        self.assertIn(
            "coherent story with data supporting every downstream consumer",
            _sql_only(COHERENCE),
        )

    def test_the_trace_demands_more_than_a_sentence(self):
        """
        The value is in being forced to walk the chain. Lower this if a live room stalls,
        but not to the point where "it all connects" satisfies it.
        """
        field = re.search(
            r'"key": "coherence_trace".*?"min_chars": (\d+)', COHERENCE, re.S
        )
        self.assertIsNotNone(field, "coherence_trace declares no min_chars")
        self.assertGreaterEqual(int(field.group(1)), 100)

    def test_it_is_a_decision_not_a_verification(self):
        """
        Deliberate: the app reads the workspace as its own Service Principal with no OBO
        and often cannot see an attendee's personal catalog, so a real coherence check
        would return `unknown` for most of a room. A gate that cannot verify what it
        claims to is worse than no gate.
        """
        self.assertNotIn('"check"', COHERENCE)
        self.assertIn("step_kind = 'decision'", COHERENCE)


class HandoffTest(unittest.TestCase):
    def test_the_checklist_precedes_the_destructive_instructions(self):
        """
        Prepended, not appended. Cleanup is irreversible, so a checklist below it is a
        checklist nobody reads in time.
        """
        self.assertIn("|| input_template", HANDOFF)
        self.assertNotIn("input_template ||", HANDOFF.replace("|| input_template", ""))

    def test_it_names_artefacts_that_stop_existing(self):
        for artefact in ("Screenshot your dashboard", "story chain", "row counts"):
            self.assertIn(artefact, HANDOFF)


class SeedDisciplineTest(unittest.TestCase):
    """
    execute_sql_file(..., ignore_errors=True) swallows failures silently, and these seeds
    run on every deploy via POST_SEED_MIGRATIONS. An unguarded UPDATE either re-applies
    endlessly or clobbers a facilitator's edits, and either way nobody is told.
    """

    def test_every_update_is_idempotency_guarded(self):
        for name, sql in NEW_SEEDS.items():
            stmts = _updates(sql)
            self.assertGreater(len(stmts), 0, f"{name} contains no UPDATE")
            for body in stmts:
                guarded = "NOT LIKE" in body or "NOT step_config" in body
                self.assertTrue(
                    guarded,
                    f"{name}: an UPDATE with no NOT LIKE / NOT @> guard re-applies on "
                    f"every redeploy:\n{body[-400:]}",
                )
                self.assertIn(
                    "is_active = TRUE", body,
                    f"{name}: an UPDATE that ignores is_active edits retired rows",
                )

    def test_field_updates_check_the_step_is_still_a_decision(self):
        """
        Writing a fields array onto a step an admin converted away from `decision` would
        leave config the renderer never reads.
        """
        for name in ("23_seed_story_fields.sql", "24_seed_coherence_gate.sql"):
            checked = 0
            for body in _updates(NEW_SEEDS[name]):
                if "jsonb_set(step_config" not in body:
                    continue
                checked += 1
                self.assertIn("step_kind = 'decision'", body, f"{name}: {body[-300:]}")
            self.assertGreater(checked, 0, f"{name}: no field-array update found")

    def test_seeds_are_registered_for_existing_installs(self):
        """
        A seed not listed in POST_SEED_MIGRATIONS only ever reaches a fresh install, so
        every existing deployment silently keeps the old prompts.
        """
        setup = (REPO_ROOT / "scripts" / "setup-lakebase.sh").read_text()
        block = setup.split("POST_SEED_MIGRATIONS = [")[1].split("]")[0]
        for name in NEW_SEEDS:
            self.assertIn(name, block, f"{name} is not in POST_SEED_MIGRATIONS")

    def test_seeds_run_after_the_seeds_they_extend(self):
        """
        23 re-states step 3's field array, and 17 is the current authority on it. If 23 ran
        first, 17 would overwrite the new fields back out.
        """
        setup = (REPO_ROOT / "scripts" / "setup-lakebase.sh").read_text()
        block = setup.split("POST_SEED_MIGRATIONS = [")[1].split("]")[0]
        order = [
            m for m in re.findall(r"'(\d+_[a-z_0-9]+\.sql)'", block)
        ]
        self.assertLess(
            order.index("17_add_decision_examples.sql"),
            order.index("23_seed_story_fields.sql"),
            "23 re-states field arrays that 17 also writes; it must run after",
        )
        self.assertLess(
            order.index("21_seed_prework_steps.sql"),
            order.index("23_seed_story_fields.sql"),
            "23 extends step 58, which 21 creates",
        )
        self.assertLess(
            order.index("13_seed_more_decisions.sql"),
            order.index("24_seed_coherence_gate.sql"),
            "24 extends step 15, which 13 turns into a decision",
        )

    def test_the_02_seed_is_untouched(self):
        """
        02 carries explicit input_ids and duplicate-PK inserts are skipped, so an edit
        there never reaches an existing install. Every change must be a later migration.
        """
        import subprocess
        out = subprocess.run(
            ["git", "diff", "--name-only", "HEAD", "--",
             "db/lakebase/dml_seed/02_seed_section_input_prompts.sql"],
            cwd=REPO_ROOT, capture_output=True, text=True,
        ).stdout.strip()
        self.assertEqual(out, "", "02_seed_section_input_prompts.sql must not be edited")


if __name__ == "__main__":
    unittest.main(verbosity=2)
