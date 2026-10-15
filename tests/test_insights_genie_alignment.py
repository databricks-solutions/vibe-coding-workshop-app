"""
Keeps the Insights build aligned with the Genie Accelerator prompts and skills.

    python3 -m unittest tests.test_insights_genie_alignment -v
"""

import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "insights_prompts"))

import build_rows  # noqa: E402
from seed_rows import SEED, iter_rows, latest  # noqa: E402

JOURNEY = REPO_ROOT / "src" / "components" / "insights" / "journey.ts"
RECIPES = REPO_ROOT / "src" / "components" / "insights" / "recipes.ts"
SKILLS = REPO_ROOT / "src" / "constants" / "skillsNavigatorData.ts"
NEW_TAGS = {
    "insights_activation", "insights_table_design", "insights_reverse_sync",
    "insights_genie_in_app", "insights_app_deploy", "insights_alerts",
}


def _tags(path: Path) -> list[str]:
    return re.findall(r"\btag: '([a-z0-9_]+)'", path.read_text())


def _skills(path: Path) -> list[str]:
    return re.findall(r"\bskill: '([a-z0-9-]+)'", path.read_text())


class TestInsightsPrompts(unittest.TestCase):
    def test_generated_rows_and_seed_block_are_current(self):
        rows = build_rows.build()
        self.assertEqual(json.loads(build_rows.ROWS_JSON.read_text()), rows)
        seed = SEED.read_text()
        self.assertEqual(build_rows.with_block(seed, build_rows.seed_block(rows)), seed)

    def test_new_tags_have_default_and_genie_code_rows(self):
        for tag in NEW_TAGS:
            for assistant in ("__default__", "genie-code"):
                row = latest(tag, assistant)
                self.assertIsNotNone(row, f"{tag}/{assistant}")
                self.assertTrue(row["bypass_llm"], tag)
                self.assertNotIn("{genie_space_id}", row["input_template"], tag)

    def test_every_insights_tag_has_a_default_row(self):
        defaults = {r["section_tag"] for r in iter_rows() if r["coding_assistant"] == "__default__"}
        setup = set(re.findall(r"\btag: '([a-z0-9_]+)', chapter: '\w+', kind: 'setup'", JOURNEY.read_text()))
        for tag in set(_tags(JOURNEY) + _tags(RECIPES)) - setup:
            self.assertIn(tag, defaults, tag)

    def test_new_tags_are_only_used_by_insights(self):
        insights = JOURNEY.parent
        for path in (REPO_ROOT / "src").rglob("*.ts*"):
            if insights in path.parents:
                continue
            text = path.read_text(errors="ignore")
            for tag in NEW_TAGS:
                self.assertNotIn(f"'{tag}'", text, f"{tag} used in {path}")

    def test_copilot_deploys_before_lakebase(self):
        tags = _tags(RECIPES)
        self.assertLess(tags.index("deploy_databricks_app"), tags.index("setup_lakebase"))
        self.assertLess(tags.index("wire_ui_lakebase"), tags.index("insights_app_deploy"))

    def test_existing_rows_are_unchanged(self):
        try:
            head = subprocess.run(
                ["git", "show", f"HEAD:{SEED.relative_to(REPO_ROOT)}"],
                cwd=REPO_ROOT, check=True, capture_output=True, text=True,
            ).stdout
        except (OSError, subprocess.CalledProcessError):
            self.skipTest("git history not available")
        if build_rows.BEGIN in head:
            head = head.split(build_rows.BEGIN, 1)[0]
        tmp = REPO_ROOT / "tests" / ".seed_head.sql"
        tmp.write_text(head)
        try:
            before = [r for r in iter_rows(tmp)]
        finally:
            tmp.unlink()
        after = [r for r in iter_rows() if not r["section_tag"].startswith("insights_")]
        self.assertEqual(before, after)


class TestInsightsSkills(unittest.TestCase):
    def test_skill_ids_exist_in_the_navigator(self):
        known = set(re.findall(r'"id": "([a-z0-9-]+)"', SKILLS.read_text()))
        names = set(re.findall(r"'([a-z0-9-]+)': '", JOURNEY.read_text()))
        for skill in _skills(JOURNEY) + _skills(RECIPES):
            self.assertIn(skill, known, skill)
            self.assertIn(skill, names, f"{skill} missing from ACCELERATOR_SKILLS")


if __name__ == "__main__":
    unittest.main()
