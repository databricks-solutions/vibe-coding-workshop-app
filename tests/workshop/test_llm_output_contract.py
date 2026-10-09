"""D-72 / D-77 — iterate_enhance, skill_define_strategy and skill_create_skillmd get
version-2 ``__default__`` rows that ask the LLM for a shorter output.

Same real-seed harness as the family tests (test_app_family_genie_forks.py): every
active ``section_input_prompts`` INSERT is parsed and served in place of the
Lakebase cache, which keeps the highest version per (section_tag, coding_assistant)
like routes._refresh_lakebase_cache. ``input_template`` is the column the LLM
receives (routes._section_row_to_template "input" -> mcp_server._generate_step_prompt).

C1 for each tag the served row, for a default and a genie-code session, is the v2 id.
C2 v2 == v1 byte-for-byte except input_id, version and the output length contract
   appended to input_template (with the per-tag N).
C3 bypass_llm is false on all 3 v2 rows.
C4 no other row changed against the base commit, and v1 stays active.
"""

import shutil
import subprocess

import pytest

from scripts import seed_new_rows
from src.backend.api import routes

from .test_app_family_genie_forks import REPO_ROOT, SEED, SEED_ROWS, _row, seeded  # noqa: F401  (seeded is a fixture)

BASE_COMMIT = "952a487"
SIP = "section_input_prompts"
# section_tag -> (v1 input_id, v2 input_id, N words).
V2 = {
    "iterate_enhance": (14, 1034, 900),
    "skill_define_strategy": (131, 1035, 900),
    "skill_create_skillmd": (132, 1036, 1200),
}
CONTRACT = (
    "\n\n## Output length contract\n"
    "Keep the prompt you write under {n} words. Prefer a short ordered checklist over prose; "
    "name each file, command or check once; do not restate this specification, the PRD or "
    "earlier outputs; omit examples unless one is essential. If the full scope does not fit, "
    "cover the highest-value items and end with one line listing what was left out."
)
NEW_IDS = {v2 for _, v2, _ in V2.values()}


def _statements(path):
    return dict(seed_new_rows.seed_rows(str(path), SIP, "input_id"))


# --- C1: the served row ------------------------------------------------------------


@pytest.mark.parametrize("tag", sorted(V2))
@pytest.mark.parametrize("assistant", [None, "genie-code"])
def test_c1_served_row_is_v2(seeded, tag, assistant):
    _, v2, _ = V2[tag]
    served = routes.get_section_input_template(tag, assistant)
    assert served["input"] == SEED_ROWS[v2]["input_template"]
    assert served["input"].endswith(CONTRACT.format(n=V2[tag][2]))


# --- C2: v2 = v1 + the contract ----------------------------------------------------


@pytest.mark.parametrize("tag", sorted(V2))
def test_c2_v2_is_v1_plus_the_contract(tag):
    v1, v2, n = V2[tag]
    old, new = SEED_ROWS[v1], SEED_ROWS[v2]
    assert (old["section_tag"], old["version"], new["version"], new["is_active"]) == (tag, 1, 2, True)
    assert "coding_assistant" not in new and list(new) == list(old)
    assert new["input_template"] == old["input_template"] + CONTRACT.format(n=n)
    rest = {k: v for k, v in new.items() if k not in ("input_id", "input_template", "version")}
    assert rest == {k: v for k, v in old.items() if k not in ("input_id", "input_template", "version")}
    # Byte level: the raw statement differs only in the id, the contract and the version.
    stmts = _statements(SEED)
    assert stmts[v2].count(CONTRACT.format(n=n)) == 1
    expected = (
        stmts[v1]
        .replace(f"VALUES\n({v1}, '{tag}',", f"VALUES\n({v2}, '{tag}',", 1)
        .replace("1, true, current_timestamp()", "2, true, current_timestamp()", 1)
    )
    assert stmts[v2].replace(CONTRACT.format(n=n), "", 1) == expected


def test_c2_each_v2_sits_right_after_its_v1():
    order = list(SEED_ROWS)
    for v1, v2, _ in V2.values():
        assert order.index(v2) == order.index(v1) + 1


# --- C3: still LLM-generated -------------------------------------------------------


@pytest.mark.parametrize("tag", sorted(V2))
def test_c3_v2_is_not_bypassed(tag):
    _, v2, _ = V2[tag]
    assert SEED_ROWS[v2].get("bypass_llm", False) is False


# --- C4: nothing else changed ------------------------------------------------------


def test_c4_no_other_row_changed(tmp_path):
    if shutil.which("git") is None:
        pytest.skip("git binary not available")
    blob = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "show", f"{BASE_COMMIT}:db/lakebase/dml_seed/02_seed_section_input_prompts.sql"],
        capture_output=True,
        text=True,
    )
    assert blob.returncode == 0, f"{BASE_COMMIT} missing from the repo; fetch full history"
    base_path = tmp_path / "02_base.sql"
    base_path.write_text(blob.stdout)
    base, head = _statements(base_path), _statements(SEED)
    assert set(head) - set(base) == NEW_IDS
    assert {pk: head[pk] for pk in base} == base
    for v1, _, _ in V2.values():
        assert _row(head[v1])["is_active"] is True
