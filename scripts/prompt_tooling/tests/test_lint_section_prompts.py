"""Tests for lint_section_prompts.py — validates section markdown files
match the Tier A teaching standard."""
import sys
from pathlib import Path

import pytest

# Make the parent dir importable so we can `import lint_section_prompts`.
sys.path.insert(0, str(Path(__file__).parent.parent))

from lint_section_prompts import LintReport, lint_file  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures" / "lint"


def test_good_section_passes():
    report = lint_file(FIXTURES / "good_section.md")
    assert report.ok, f"expected pass, got: {report.errors}"


def test_missing_what_block_fails():
    report = lint_file(FIXTURES / "bad_missing_what.md")
    assert not report.ok
    assert any("2️⃣ What Are We Building" in e for e in report.errors)


def test_missing_why_block_fails():
    report = lint_file(FIXTURES / "bad_missing_why.md")
    assert not report.ok
    assert any("3️⃣ Why Are We Building" in e for e in report.errors)


def test_missing_how_block_fails():
    report = lint_file(FIXTURES / "bad_missing_how.md")
    assert not report.ok
    assert any("4️⃣ What Happens Behind" in e for e in report.errors)


def test_mode_card_passes_without_full_blocks():
    """A file marked `mode_card_anchor: <path>` in frontmatter is exempt from
    the 2️⃣/3️⃣/4️⃣ block requirement."""
    report = lint_file(FIXTURES / "good_mode_card.md")
    assert report.ok, f"expected pass for mode card, got: {report.errors}"


def test_inactive_files_are_skipped():
    """Files with is_active: false should never error."""
    inactive = FIXTURES / "good_section.md"
    text = inactive.read_text()
    text_inactive = text.replace("is_active: true", "is_active: false")
    tmp = FIXTURES / "_tmp_inactive.md"
    tmp.write_text(text_inactive)
    try:
        report = lint_file(tmp)
        assert report.ok
        assert report.skipped
    finally:
        tmp.unlink()


def test_canonical_heading_outside_position_fails():
    """A `## How to Apply` H2 inside the body (after the first one) corrupts
    the SQL round-trip and must fail."""
    bad = FIXTURES / "good_section.md"
    text = bad.read_text()
    # Inject a duplicate canonical heading inside the body.
    corrupted = text.replace(
        "## 2️⃣ What Are We Building?",
        "---\n\n## How to Apply\n\nduplicate!\n\n---\n\n## 2️⃣ What Are We Building?",
    )
    tmp = FIXTURES / "_tmp_corrupted.md"
    tmp.write_text(corrupted)
    try:
        report = lint_file(tmp)
        assert not report.ok
        assert any("duplicate canonical heading" in e.lower() for e in report.errors)
    finally:
        tmp.unlink()


def test_contract_check_off_by_default():
    """Without check_contract=True, the contract is NOT inspected — even a
    paraphrased contract block passes lint as long as the canonical headings
    + numbered blocks are present."""
    report = lint_file(FIXTURES / "contract_red_b.md")
    assert report.ok, (
        f"with no contract baseline, red fixture should still pass structural lint, "
        f"got: {report.errors}"
    )


def _baseline_path():
    return FIXTURES / "contract_baseline_fixture.json"


def test_contract_byte_equality_green_b_passes():
    """Class B file with verbatim contract block passes when --check-contract is on."""
    report = lint_file(
        FIXTURES / "contract_green_b.md",
        check_contract=True,
        baseline_path=_baseline_path(),
    )
    assert report.ok, f"green B fixture should pass, got: {report.errors}"


def test_contract_byte_equality_red_b_fails():
    """Class B file with paraphrased Gate: line fails when --check-contract is on."""
    report = lint_file(
        FIXTURES / "contract_red_b.md",
        check_contract=True,
        baseline_path=_baseline_path(),
    )
    assert not report.ok
    assert any("contract token missing" in e for e in report.errors), (
        f"expected 'contract token missing' error, got: {report.errors}"
    )


def test_contract_byte_equality_green_a_passes():
    """Class A file with verbatim IMPORTANT-READ-FIRST block passes."""
    report = lint_file(
        FIXTURES / "contract_green_a.md",
        check_contract=True,
        baseline_path=_baseline_path(),
    )
    assert report.ok, f"green A fixture should pass, got: {report.errors}"


def test_contract_byte_equality_red_a_fails():
    """Class A file with reworded IMPORTANT-READ-FIRST block fails."""
    report = lint_file(
        FIXTURES / "contract_red_a.md",
        check_contract=True,
        baseline_path=_baseline_path(),
    )
    assert not report.ok
    assert any("contract token missing" in e for e in report.errors)


def test_contract_check_passes_on_file_not_in_baseline():
    """A file that exists but is NOT in the baseline JSON is NOT contract-checked
    (still gets the structural lint though)."""
    report = lint_file(
        FIXTURES / "good_section.md",
        check_contract=True,
        baseline_path=_baseline_path(),
    )
    assert report.ok, (
        f"file outside the baseline must pass contract check (no entry = no check), "
        f"got: {report.errors}"
    )
