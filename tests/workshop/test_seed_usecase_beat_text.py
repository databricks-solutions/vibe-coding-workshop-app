"""Seed row 958 (use_case_selection) is the first beat of the Genie Code journey.

Under Option A the use-case beat runs BEFORE project_setup, so its how_to_apply
must not claim project_setup as a prerequisite.
"""

import pathlib
import re

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
SEED = REPO_ROOT / "db" / "lakebase" / "dml_seed" / "02_seed_section_input_prompts.sql"

# Column order of the 958 INSERT; how_to_apply is the 8th value.
_COLUMNS = (
    "input_id",
    "section_tag",
    "input_template",
    "system_prompt",
    "section_title",
    "section_description",
    "order_number",
    "how_to_apply",
)


def _row_958_values() -> list[str]:
    """Tokenize row 958's VALUES tuple far enough to reach how_to_apply."""
    seed = SEED.read_text()
    pos = seed.index("(958, 'use_case_selection',") + 1
    values: list[str] = []
    while len(values) < len(_COLUMNS):
        while seed[pos] in " \n,":
            pos += 1
        if seed[pos] == "'":
            # SQL string literal: '' is an escaped quote.
            end = pos + 1
            while True:
                end = seed.index("'", end)
                if seed[end + 1 : end + 2] == "'":
                    end += 2
                    continue
                break
            values.append(seed[pos + 1 : end].replace("''", "'"))
            pos = end + 1
        else:
            m = re.match(r"[^,\n]+", seed[pos:])
            values.append(m.group(0).strip())
            pos += m.end()
    return values


def test_row_958_tokenizes_to_expected_columns():
    values = _row_958_values()
    assert values[0] == "958"
    assert values[1] == "use_case_selection"
    assert values[4] == "Define Your Use Case"
    assert values[7].startswith("## 1️⃣ How To Apply")


def test_usecase_beat_has_no_project_setup_prerequisite():
    how_to_apply = _row_958_values()[_COLUMNS.index("how_to_apply")]
    assert "`project_setup` complete" not in how_to_apply
    assert "before** Set Up Project" in how_to_apply
