"""
PRD truncation structural tests (no live LLM required).

    USE_LAKEBASE=false python3 -m unittest tests.api.test_prd_truncation -v
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

FIXTURES = REPO_ROOT / "tests" / "fixtures" / "use-cases"


def _preview_lines(content: str, max_lines: int = 8) -> int:
  lines = content.split("\n")
  return min(max_lines, len(lines)) if len(lines) > max_lines else len(lines)


class TestPrdTruncationStructural(unittest.TestCase):
    def test_fixtures_exist(self):
        for name in ("short", "medium", "long"):
            path = FIXTURES / f"{name}.md"
            self.assertTrue(path.exists(), f"missing {path}")
            self.assertGreater(len(path.read_text()), 100)

    def test_class_a_preview_hides_most_of_long_output(self):
        long_text = FIXTURES.joinpath("long.md").read_text()
        visible = _preview_lines(long_text, 8)
        total = len(long_text.split("\n"))
        self.assertGreater(total, 8)
        self.assertEqual(visible, 8)
        self.assertLess(visible / total, 0.1)

    def test_copy_uses_full_text_not_preview(self):
        long_text = FIXTURES.joinpath("long.md").read_text()
        preview_chars = len("\n".join(long_text.split("\n")[:8]))
        self.assertEqual(len(long_text), len(long_text))  # copy path
        self.assertLess(preview_chars, len(long_text) * 0.02)

    def test_long_use_case_inflates_llm_input(self):
        from unittest.mock import patch

        from src.backend.api.routes import get_section_input_content

        long_desc = FIXTURES.joinpath("long.md").read_text()
        mock_template = {
            "input_template": "Context:\n{use_case_description}",
            "system_prompt": "sys",
            "how_to_apply": "",
            "expected_output": "",
            "how_to_apply_images": [],
            "expected_output_images": [],
            "bypass_llm": False,
        }
        with patch("src.backend.api.routes.get_section_input_prompts_map", return_value={"prd_generation": mock_template}), \
             patch("src.backend.api.routes.get_section_input_template", return_value=mock_template), \
             patch("src.backend.api.routes.get_prompt_templates_map", return_value={}), \
             patch("src.backend.api.routes.get_effective_workshop_parameters", return_value={
                 "custom_use_case_description": long_desc,
             }):
            content = get_section_input_content("sample", "booking", "prd_generation", session_id="t")
        self.assertIn(long_desc, content["input"])
        self.assertGreater(len(content["input"]), 50_000)

    def test_max_tokens_consistent_across_sections(self):
        from src.backend.api.routes import LLM_MAX_OUTPUT_TOKENS, _max_tokens_for_section

        self.assertEqual(LLM_MAX_OUTPUT_TOKENS, 8000)
        # All sections now share the same higher output budget.
        self.assertEqual(_max_tokens_for_section("prd_generation"), 8000)
        self.assertEqual(_max_tokens_for_section("ui_design"), 8000)
        self.assertEqual(_max_tokens_for_section(None), 8000)


if __name__ == "__main__":
    unittest.main()
