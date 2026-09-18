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
    # data_model_design (step 58, seed 21), and both are correct: 58 commits the grain of
    # the SOURCE model, 11 the grain of the GOLD fact built from it.
    #
    # No longer papered over. _decision_params emits a scoped `<section_tag>__<key>` token
    # for every field, and seed 26 points each consumer at the one it means, so the shared
    # name no longer makes any prompt ambiguous. Kept in the allow-list because the two
    # steps genuinely both need a field by that name — the guarantee is enforced by
    # ScopedDecisionTokenTest below rather than by forbidding the name.
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
        A new shared name must either be renamed or given the scoped-token treatment.
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


class ScopedDecisionTokenTest(unittest.TestCase):
    """
    The fix for the fact_grain ambiguity.

    Two steps commit a field called `fact_grain` and both are right — step 58 the grain of
    the SOURCE model, step 11 the grain of the GOLD fact built from it. The bug was that
    the bare `{fact_grain}` token resolved to whichever the dict happened to yield last,
    i.e. by Python insertion order rather than by anything the attendee did.

    The damage was quiet: step 59's brief tells a generating agent what grain to produce
    rows at. Receiving the coarser gold grain there means the agent generates
    pre-aggregated data and every layer built on it re-grains rows that were never at the
    grain they claim. Nothing errors; the numbers are just wrong.
    """

    SRC = {
        "decision": {"fact_grain": "SOURCE: one sale line, per store, per day"},
        "committed_at": "2026-08-10T10:00:00Z",
    }
    GOLD = {
        "decision": {"fact_grain": "GOLD: one order line per day"},
        "committed_at": "2026-08-10T11:00:00Z",
    }

    def test_each_step_gets_its_own_scoped_token(self):
        params = routes._decision_params({
            "data_model_design": self.SRC, "gold_layer_design": self.GOLD,
        })
        self.assertEqual(
            params["data_model_design__fact_grain"],
            "SOURCE: one sale line, per store, per day",
        )
        self.assertEqual(
            params["gold_layer_design__fact_grain"], "GOLD: one order line per day",
        )

    def test_the_bare_token_no_longer_depends_on_insertion_order(self):
        """The exact regression: same decisions, different dict order, same answer."""
        a = routes._decision_params({
            "data_model_design": self.SRC, "gold_layer_design": self.GOLD,
        })
        b = routes._decision_params({
            "gold_layer_design": self.GOLD, "data_model_design": self.SRC,
        })
        self.assertEqual(a["fact_grain"], b["fact_grain"])
        # Latest commitment wins, which is the only defensible reading of a bare token.
        self.assertEqual(a["fact_grain"], "GOLD: one order line per day")

    def test_it_is_deterministic_without_timestamps(self):
        """
        Sessions saved before committed_at existed have no timestamp, and a decision
        submitted over MCP could in principle lack one too. Those must still resolve to one
        stable answer rather than falling back to dict order.
        """
        one = routes._decision_params({
            "data_model_design": {"decision": {"fact_grain": "SRC"}},
            "gold_layer_design": {"decision": {"fact_grain": "GOLD"}},
        })
        two = routes._decision_params({
            "gold_layer_design": {"decision": {"fact_grain": "GOLD"}},
            "data_model_design": {"decision": {"fact_grain": "SRC"}},
        })
        self.assertEqual(one["fact_grain"], two["fact_grain"])

    def test_a_scoped_token_cannot_be_corrupted_by_the_bare_one(self):
        """
        Substitution is an unordered chain of str.replace calls, so if the bare token were
        a substring of the scoped one, replacing it first would mangle the scoped token.
        The leading brace prevents it — asserted because it is the kind of thing a later
        rename (to `fact_grain_gold_layer_design`, say) would silently break.
        """
        for tag in ("gold_layer_design", "data_model_design"):
            scoped = "{" + f"{tag}__fact_grain" + "}"
            self.assertNotIn("{fact_grain}", scoped)

    def test_scoping_preserves_list_and_per_row_rendering(self):
        params = routes._decision_params({"gold_layer_design": {
            "decision": {
                "scd_decisions::dim_customer": "Type 2",
                "scd_decisions::dim_store": "Type 1",
                "committed_features": ["A", "B"],
            },
            "committed_at": "2026-01-01T00:00:00Z",
        }})
        self.assertEqual(params["committed_features"], "1. A\n2. B")
        self.assertEqual(
            params["gold_layer_design__scd_decisions"],
            "- dim_customer: Type 2\n- dim_store: Type 1",
        )

    def test_per_row_fields_do_not_interleave_across_steps(self):
        """
        radio_per_row rows used to accumulate into one shared bucket keyed by field name,
        so two steps both using `scd_decisions` would merge their rows into a single
        block. Grouping is now per step.
        """
        params = routes._decision_params({
            "gold_layer_design": {"decision": {"scd_decisions::dim_a": "Type 1"},
                                  "committed_at": "2026-01-01T00:00:00Z"},
            "activation_table_design": {"decision": {"scd_decisions::dim_b": "Type 2"},
                                        "committed_at": "2026-01-02T00:00:00Z"},
        })
        self.assertEqual(params["gold_layer_design__scd_decisions"], "- dim_a: Type 1")
        self.assertEqual(params["activation_table_design__scd_decisions"], "- dim_b: Type 2")

    def test_consumers_that_care_use_the_scoped_token(self):
        """
        The half that makes the guarantee real. Emitting a scoped token is useless if the
        prompts keep using the ambiguous one, so assert the four rewrites in seed 26.
        """
        seed = _sql_only((SEED_DIR / "26_scope_fact_grain_tokens.sql").read_text())
        # Both of step 59's references (the recap header and the generation brief) live on
        # data_provision, NOT on data_model_design — the step that COLLECTS the field is
        # not the step whose prompt quotes it back. Asserting the wrong owner here is what
        # the replay caught.
        for tag, expected in (
            ("gold_layer_design", "{gold_layer_design__fact_grain}"),
            ("data_provision", "{data_model_design__fact_grain}"),
            ("usecase_plan", "{data_model_design__fact_grain}"),
        ):
            stmts = [s for s in _statements(seed) if f"section_tag = '{tag}'" in s]
            self.assertEqual(len(stmts), 1, f"expected one rewrite for {tag}")
            self.assertIn(expected, stmts[0], f"{tag} does not use {expected}")

    def test_no_rewrite_targets_a_step_that_does_not_use_the_token(self):
        """
        A replace() aimed at the wrong step matches nothing, and ignore_errors=True hides
        it. data_model_design collects fact_grain but never substitutes it, so a rewrite
        naming it would be silently dead.
        """
        seed = _sql_only((SEED_DIR / "26_scope_fact_grain_tokens.sql").read_text())
        prework = (SEED_DIR / "21_seed_prework_steps.sql").read_text()

        # Prove the premise rather than trusting it: the 58 INSERT must not contain the
        # token, and the 59 INSERT must.
        insert_58 = prework.split("'data_model_design',")[1].split("WHERE NOT EXISTS")[0]
        insert_59 = prework.split("'data_provision',")[1].split("WHERE NOT EXISTS")[0]
        self.assertNotIn("{fact_grain}", insert_58)
        self.assertIn("{fact_grain}", insert_59)

        self.assertEqual(
            [s for s in _statements(seed) if "section_tag = 'data_model_design'" in s],
            [],
            "data_model_design never substitutes {fact_grain}, so a rewrite for it is dead",
        )

    def test_the_generation_brief_asks_for_the_source_grain(self):
        """
        The one that was actually exposed. Step 59 hands this to
        databricks-synthetic-data-gen as the grain to generate at, so it must never be the
        gold grain — that would produce pre-aggregated data.
        """
        seed = _sql_only((SEED_DIR / "26_scope_fact_grain_tokens.sql").read_text())
        stmt = [s for s in _statements(seed) if "section_tag = 'data_provision'" in s][0]
        self.assertIn("{data_model_design__fact_grain}", stmt)
        self.assertNotIn("{gold_layer_design__fact_grain}", stmt)

    def test_the_rewrites_are_idempotent(self):
        """
        These are replace() calls, so a re-run must find nothing left to replace. Guarded
        on the bare token still being present.
        """
        seed = _sql_only((SEED_DIR / "26_scope_fact_grain_tokens.sql").read_text())
        for stmt in _statements(seed):
            if "UPDATE" not in stmt.upper():
                continue
            self.assertIn("{fact_grain}", stmt, "rewrite is not guarded on the old token")
            self.assertIn("is_active = TRUE", stmt)

    def test_guards_match_literally_not_by_wildcard(self):
        """
        In SQL LIKE, `_` is a single-character wildcard, so '%__fact_grain}%' would match
        far more than the double-prefixed token it is meant to detect. These guards compare
        literally with position() for that reason.
        """
        seed = _sql_only((SEED_DIR / "26_scope_fact_grain_tokens.sql").read_text())
        for stmt in _statements(seed):
            if "UPDATE" not in stmt.upper():
                continue
            self.assertNotIn(
                "LIKE '%{fact_grain}", stmt,
                "use position() — LIKE treats the underscores in these tokens as wildcards",
            )

    def test_the_global_rewrite_cannot_double_prefix(self):
        """
        data_provision's rewrite is an unanchored global replace, so without a guard a
        second pass would produce {data_model_design__data_model_design__fact_grain}.
        """
        seed = _sql_only((SEED_DIR / "26_scope_fact_grain_tokens.sql").read_text())
        stmt = [s for s in _statements(seed) if "section_tag = 'data_provision'" in s][0]
        self.assertIn("position('__fact_grain}' in input_template) = 0", stmt)


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


class ConnectBranchDefaultTest(unittest.TestCase):
    """
    The generate branch needs a Python 3.12 venv, a pinned databricks-connect and faker
    shipped to the serverless executors. Each fails somewhere other than its cause, so a
    participant who picks it unprepared loses the part of the session they came for.
    Seeds 27 and 28 make connect the recommended default and state the cost up front.
    """

    SEED_27 = (SEED_DIR / "27_fix_datagen_prereqs.sql").read_text()
    SEED_28 = (SEED_DIR / "28_default_to_connect_branch.sql").read_text()

    def test_the_option_strings_are_never_reworded(self):
        """
        Load-bearing. Step 59's branch headings switch on the literal option text
        ('## If you chose "I have existing tables"'), and every committed decision so far
        is stored against these exact strings. Rewording them would orphan saved sessions
        and silently break both headings.
        """
        # Match on the jsonb PATH rather than on the literal option text, because that is
        # what any rewrite has to name however it is spaced or quoted. An earlier version
        # of this test looked for '"options": [' and a guarded rewrite using
        # jsonb_set(..., '{fields,0,options}', ...) sailed straight past it.
        normalised = re.sub(r"\s+", "", self.SEED_28)
        self.assertNotIn(
            "options}", normalised,
            "seed 28 must not write the radio options — step 59's headings switch on the "
            "literal option text and committed sessions are stored against it. Only the "
            "hint and the prose may change.",
        )
        # And the seed must say why, so the next person does not try.
        self.assertIn("not change the OPTION STRINGS", self.SEED_28)

    def test_the_generate_option_still_exists(self):
        """
        Steering is not removing. Some attendees have no usable data, and a question with
        one answer is not a decision.
        """
        prework = (SEED_DIR / "21_seed_prework_steps.sql").read_text()
        self.assertIn('"Generate a dataset for me"', prework)
        self.assertNotIn("DELETE FROM", self.SEED_28)

    def test_the_cost_is_stated_where_the_choice_is_made(self):
        """Step 57, not three steps later once they have already committed."""
        self.assertIn("Before you pick this, know what it costs", self.SEED_28)
        self.assertIn("Python 3.12", self.SEED_28)
        self.assertIn("recommended default", self.SEED_28)

    def test_step_59_prereqs_name_all_three_traps(self):
        for required in ("--python 3.12", "16.4,<17.4", "addArtifacts"):
            self.assertIn(
                required, self.SEED_27,
                f"step 59's prerequisites lost {required!r} — the trap it guards is silent",
            )

    def test_both_seeds_are_guarded_and_registered(self):
        setup = (REPO_ROOT / "scripts" / "setup-lakebase.sh").read_text()
        block = setup.split("POST_SEED_MIGRATIONS = [")[1].split("]")[0]
        for name, sql in (
            ("27_fix_datagen_prereqs.sql", self.SEED_27),
            ("28_default_to_connect_branch.sql", self.SEED_28),
        ):
            self.assertIn(name, block, f"{name} never reaches an existing install")
            for stmt in _statements(_sql_only(sql)):
                if "UPDATE" not in stmt.upper():
                    continue
                guarded = "position(" in stmt or "NOT LIKE" in stmt
                self.assertTrue(guarded, f"{name}: unguarded UPDATE re-applies every deploy")
                self.assertIn("is_active = TRUE", stmt)

    def test_doctor_reports_the_generate_branch_without_failing(self):
        """
        The check must be advisory. Connecting existing data is the default and needs none
        of this, so a missing .venv-datagen must never fail doctor for the whole room.
        """
        src = (REPO_ROOT / "scripts" / "vibe2value.py").read_text()
        self.assertIn("def check_datagen_readiness", src)
        body = src.split("def check_datagen_readiness")[1].split("\ndef ")[0]
        self.assertNotIn(
            "all_ok = False", body,
            "the datagen check must never fail doctor — the connect branch is the default",
        )
        for signal in ("3.12", "16.4", "serverless_compute_id"):
            self.assertIn(signal, body, f"the check does not look at {signal}")


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
