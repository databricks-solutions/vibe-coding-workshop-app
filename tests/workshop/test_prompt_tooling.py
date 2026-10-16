"""prompt-tooling-tracked (D-194, D-196) — the prompt tooling in scripts/prompt_tooling.

  P1  extract_to_markdown.py turns the current app seed into sections in a temp dir:
      one manifest row per INSERT block, one file per distinct manifest file name.
  P2  parse_markdown round-trips a generated section: every genie-code fork row in the
      builder's layout comes back byte for byte through markdown.
  P3  each seed writer refuses a real write without --i-know-this-overwrites-the-seed
      (exit != 0, refusal printed, seed bytes unchanged) and, with it, writes the temp
      copy only.
  P4  sync_markdown_to_seed.py / splice_genie_to_app_seed.py --dry-run are not refused
      and write nothing.
  P5  nothing in the folder points at the template checkout (the tooling's old home).

Offline: the scripts run as subprocesses on a temp copy of the folder; no app import.
"""

import hashlib
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
TOOLING = REPO_ROOT / "scripts" / "prompt_tooling"
SEED = REPO_ROOT / "db" / "lakebase" / "dml_seed" / "02_seed_section_input_prompts.sql"
SEED_NAME = SEED.name
INSERT_MARKER = "INSERT INTO ${catalog}.${schema}.section_input_prompts"
FLAG = "--i-know-this-overwrites-the-seed"
REFUSAL = (
    "Seed edits go through builders (e.g. scripts/insights_prompts/build_rows.py) and "
    "reviewed PRs. Re-run with --i-know-this-overwrites-the-seed to bypass."
)
# The column header _build_coding_assistant_block writes for a genie-code fork row.
FORK_HEADER = [
    "INSERT INTO ${catalog}.${schema}.section_input_prompts",
    "(input_id, section_tag, coding_assistant, input_template, system_prompt,",
    " bypass_llm, version, is_active, inserted_at, updated_at, created_by)",
]
# Generated outputs a run in place leaves behind (git-ignored); never part of a copy.
OUTPUTS = shutil.ignore_patterns("sections", "__pycache__", "*.sql", "[0-9][0-9]-*.md")
MANIFEST_ROW = re.compile(r"^\| \[([^\]]+)\]\([^)]+\) \| (\d+) \|")


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


SEED_SHA = _sha(SEED)


def _run(cwd: Path, *args: str) -> subprocess.CompletedProcess:
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    return subprocess.run([sys.executable, *args], cwd=cwd, env=env, text=True,
                          capture_output=True, timeout=300)


@pytest.fixture(scope="module")
def extracted(tmp_path_factory) -> Path:
    """A copy of the tooling with the app seed and the sections extracted from it."""
    root = tmp_path_factory.mktemp("prompt_tooling") / "prompt_tooling"
    shutil.copytree(TOOLING, root, ignore=OUTPUTS)
    shutil.copyfile(SEED, root / SEED_NAME)
    ex = _run(root, "extract_to_markdown.py")
    assert ex.returncode == 0, ex.stderr
    return root


@pytest.fixture
def work(extracted, tmp_path) -> Path:
    """A fresh copy of `extracted` a test may edit."""
    root = tmp_path / "prompt_tooling"
    shutil.copytree(extracted, root)
    return root


@pytest.fixture(autouse=True)
def _app_seed_untouched():
    yield
    assert _sha(SEED) == SEED_SHA, "the app seed changed"


def _insert_statements() -> int:
    """INSERT statements in the app seed (commented-out ones excluded)."""
    return sum(line.startswith(INSERT_MARKER) for line in SEED.read_text().splitlines())


def _manifest(sections: Path) -> list[tuple[str, int]]:
    rows = []
    for line in (sections / "README.md").read_text().splitlines():
        if m := MANIFEST_ROW.match(line):
            rows.append((m.group(1), int(m.group(2))))
    return rows


def _edit_section(root: Path, tag_prefix: str) -> Path:
    """Append a marker to the System Prompt of the first fork section whose tag starts
    with `tag_prefix`, so a write-back would change the seed."""
    for md in sorted((root / "sections").glob(f"*-{tag_prefix}*.genie-code.md")):
        text = md.read_text()
        if "## System Prompt\n" in text:
            md.write_text(text.replace("## System Prompt\n", "## System Prompt\n\nP3-EDIT\n", 1))
            return md
    raise AssertionError(f"no fork section for {tag_prefix}")


# --- P1 ------------------------------------------------------------------------


def test_extract_writes_one_manifest_row_per_insert_block(extracted):
    blocks = _insert_statements()
    rows = _manifest(extracted / "sections")
    assert blocks > 0 and len(rows) == blocks
    files = {p.name for p in (extracted / "sections").glob("*.md")} - {"README.md"}
    assert files == {name for name, _ in rows}


def test_extract_falls_back_to_the_app_seed(tmp_path):
    """No seed snapshot in the folder: read ../../db/lakebase/dml_seed/, never write it."""
    root = tmp_path / "repo" / "scripts" / "prompt_tooling"
    shutil.copytree(TOOLING, root, ignore=OUTPUTS)
    app_seed = tmp_path / "repo" / SEED.relative_to(REPO_ROOT)
    app_seed.parent.mkdir(parents=True)
    shutil.copyfile(SEED, app_seed)
    ex = _run(root, "extract_to_markdown.py")
    assert ex.returncode == 0, ex.stderr
    assert len(_manifest(root / "sections")) == _insert_statements()
    assert not (root / SEED_NAME).exists() and _sha(app_seed) == SEED_SHA


def test_extract_seed_and_out_options(tmp_path):
    root = tmp_path / "prompt_tooling"
    shutil.copytree(TOOLING, root, ignore=OUTPUTS)
    out = tmp_path / "out"
    ex = _run(root, "extract_to_markdown.py", "--seed", str(SEED), "--out", str(out))
    assert ex.returncode == 0, ex.stderr
    assert len(_manifest(out)) == _insert_statements()
    assert not (root / "sections").exists() and not (root / SEED_NAME).exists()


# --- P2 ------------------------------------------------------------------------


def test_parse_markdown_round_trips_the_fork_sections(extracted):
    sys.path.insert(0, str(extracted))
    try:
        from sync_markdown_to_seed import build_insert_block, parse_markdown
    finally:
        sys.path.pop(0)
        for name in ("sync_markdown_to_seed", "_seed_parser", "_seed_guard"):
            sys.modules.pop(name, None)
    seed_lines = SEED.read_text().splitlines()
    checked = 0
    for md in sorted((extracted / "sections").glob("*.genie-code.md")):
        fields = parse_markdown(md)
        start = next(i for i, line in enumerate(seed_lines)
                     if line.startswith(f"({fields['input_id']}, '"))
        header = next(i for i in range(start, -1, -1) if seed_lines[i].startswith(INSERT_MARKER))
        if seed_lines[header:header + 3] != FORK_HEADER:
            continue  # another layout (e.g. the Insights builder's rows)
        end = next(i for i in range(header, len(seed_lines)) if "current_user());" in seed_lines[i])
        want = seed_lines[header - len(fields.get("sql_comments", [])):end + 1]
        assert build_insert_block(fields) == want, md.name
        checked += 1
    assert checked > 0


# --- P3 ------------------------------------------------------------------------


def test_sync_refuses_without_the_flag(work):
    _edit_section(work, "gagent_")
    before = _sha(work / SEED_NAME)
    run = _run(work, "sync_markdown_to_seed.py")
    assert run.returncode != 0 and REFUSAL in run.stderr
    assert _sha(work / SEED_NAME) == before


def test_sync_writes_the_temp_seed_with_the_flag(work):
    _edit_section(work, "gagent_")
    run = _run(work, "sync_markdown_to_seed.py", FLAG)
    assert run.returncode == 0, run.stderr
    assert "P3-EDIT" in (work / SEED_NAME).read_text()


def test_splice_refuses_without_the_flag(work, tmp_path):
    _edit_section(work, "gagent_")
    app = tmp_path / "dml_seed"
    app.mkdir()
    shutil.copyfile(SEED, app / SEED_NAME)
    run = _run(work, "splice_genie_to_app_seed.py", "--app-seed-dir", str(app))
    assert run.returncode != 0 and REFUSAL in run.stderr
    assert _sha(app / SEED_NAME) == SEED_SHA


def test_splice_writes_the_temp_seed_with_the_flag(work, tmp_path):
    _edit_section(work, "gagent_")
    app = tmp_path / "dml_seed"
    app.mkdir()
    shutil.copyfile(SEED, app / SEED_NAME)
    run = _run(work, "splice_genie_to_app_seed.py", "--app-seed-dir", str(app), FLAG)
    assert run.returncode == 0, run.stderr
    assert "P3-EDIT" in (app / SEED_NAME).read_text()


def _edit_sql_source(root: Path) -> None:
    ex = _run(root, "extract_sql_blocks.py")
    assert ex.returncode == 0, ex.stderr
    src = root / "01-scaffold-build-test.sql"
    src.write_text("-- P3-EDIT\n" + src.read_text())


def test_replace_inserts_refuses_without_the_flag(work):
    _edit_sql_source(work)
    before = _sha(work / SEED_NAME)
    run = _run(work, "replace_inserts.py")
    assert run.returncode != 0 and REFUSAL in run.stderr
    assert _sha(work / SEED_NAME) == before


def test_replace_inserts_writes_the_temp_seed_with_the_flag(work):
    _edit_sql_source(work)
    run = _run(work, "replace_inserts.py", FLAG)
    assert run.returncode == 0, run.stderr
    assert "-- P3-EDIT" in (work / SEED_NAME).read_text()


# --- P4 ------------------------------------------------------------------------


def test_sync_dry_run_is_not_refused(work):
    _edit_section(work, "gagent_")
    before = _sha(work / SEED_NAME)
    run = _run(work, "sync_markdown_to_seed.py", "--dry-run")
    assert run.returncode == 0, run.stderr
    assert REFUSAL not in run.stderr and "P3-EDIT" in run.stdout
    assert _sha(work / SEED_NAME) == before


def test_splice_dry_run_is_not_refused(work, tmp_path):
    _edit_section(work, "gagent_")
    app = tmp_path / "dml_seed"
    app.mkdir()
    shutil.copyfile(SEED, app / SEED_NAME)
    run = _run(work, "splice_genie_to_app_seed.py", "--dry-run", "--app-seed-dir", str(app))
    assert run.returncode == 0, run.stderr
    assert REFUSAL not in run.stderr and "P3-EDIT" in run.stdout
    assert _sha(app / SEED_NAME) == SEED_SHA


# --- P5 ------------------------------------------------------------------------

# A home-rooted path to the template checkout, e.g. <home>/Projects/vibe-coding-workshop-template.
TEMPLATE_PATH = re.compile(r"(?:/(?:Users|home)/[^\s'\"]+|~)/[^\s'\"]*vibe-coding-workshop-template")


def test_no_file_points_at_the_template_checkout():
    hits = []
    for path in sorted(TOOLING.rglob("*")):
        rel = path.relative_to(TOOLING)
        if not path.is_file() or OUTPUTS(str(TOOLING), rel.parts):
            continue
        for n, line in enumerate(path.read_text(errors="replace").splitlines(), 1):
            if TEMPLATE_PATH.search(line):
                hits.append(f"{rel}:{n}: {line.strip()}")
    assert hits == []
