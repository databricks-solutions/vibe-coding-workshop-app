"""D-35 — the deploy tables step is additive; destructive reseeds need a double opt-in.

Incident: the deploy tables step ran ``setup-lakebase.sh --recreate --yes``
unconditionally, dropping usecase_descriptions + section_input_prompts on every
reseed. These tests pin the fix:

  S1  the deploy tables step calls setup-lakebase.sh without --recreate/--drop,
      except under the guarded ``--tables-recreate`` branch.
  S2  setup-lakebase.sh --recreate/--drop refuse without --yes AND
      VIBE_CONFIRM_DESTRUCTIVE_RESEED=<schema>, before any connection attempt.
  S3  deploy --tables-recreate refuses without the matching confirm env, before
      any network call.
  S4  the default create path (IF NOT EXISTS + ON CONFLICT DO NOTHING) is unchanged.
  S5  --full-setup resolves to the additive create action; --full-setup --recreate
      without the confirm env refuses.
  S6  vibe2value uninstall opts in (sets the confirm env) before calling --drop.

Offline only: every subprocess runs with DATABRICKS_CONFIG_FILE=/dev/null and a
fake ``databricks`` (and a ``python3`` that blocks the Lakebase entry points)
first on PATH, each recording its invocation and exiting 1, so no test can reach
a workspace or a database — even against a tampered script.
"""

import ast
import os
import re
import shutil
import stat
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = REPO_ROOT / "scripts"
DEPLOY_SH = SCRIPTS / "deploy.sh"
SETUP_SH = SCRIPTS / "setup-lakebase.sh"
VIBE2VALUE_PY = SCRIPTS / "vibe2value.py"

CONFIRM_ENV = "VIBE_CONFIRM_DESTRUCTIVE_RESEED"
SCHEMA = "forge_test_schema"

pytestmark = pytest.mark.skipif(shutil.which("bash") is None, reason="bash not available")


# ---------------------------------------------------------------------------
# Offline subprocess harness
# ---------------------------------------------------------------------------


@pytest.fixture
def offline(tmp_path):
    """Env + call log for running the scripts with a fake, logging ``databricks``."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    log = tmp_path / "databricks_calls.log"
    fake = bin_dir / "databricks"
    fake.write_text(f'#!/bin/bash\necho "databricks $*" >> "{log}"\nexit 1\n')
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    # python3 passes ``-c`` snippets (local YAML/JSON parsing) to the real
    # interpreter but blocks the two Lakebase entry points: lakebase_manager.py
    # and the stdin heredoc runner that opens the database connection.
    py = bin_dir / "python3"
    py.write_text(
        "#!/bin/bash\n"
        f'if [[ "$1" == "-c" ]]; then exec "{sys.executable}" "$@"; fi\n'
        f'echo "python3 $*" >> "{log}"\n'
        "exit 1\n"
    )
    py.chmod(py.stat().st_mode | stat.S_IEXEC)

    env = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith(("DATABRICKS_", "LAKEBASE_")) and k != CONFIRM_ENV
    }
    env["PATH"] = f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"
    env["DATABRICKS_CONFIG_FILE"] = "/dev/null"
    return env, log


def _run(script, args, env, cwd=REPO_ROOT):
    proc = subprocess.run(
        ["bash", str(script), *args],
        cwd=cwd,
        env=env,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return proc.returncode, proc.stdout + proc.stderr


def _assert_refused_offline(rc, out, log):
    assert rc != 0, out
    assert "Refusing" in out, out
    assert CONFIRM_ENV in out, out
    assert "Connected" not in out, out
    assert "Dropping" not in out, out
    assert not log.exists(), f"databricks was invoked before the refusal: {log.read_text()}"


def _code_lines(text):
    return [(i, line) for i, line in enumerate(text.splitlines()) if not line.lstrip().startswith("#")]


# ---------------------------------------------------------------------------
# S1 — deploy tables step is additive except under the guarded flag
# ---------------------------------------------------------------------------


def test_s1_deploy_tables_step_only_recreates_under_guard():
    text = DEPLOY_SH.read_text()
    lines = text.splitlines()
    calls = [(i, line) for i, line in _code_lines(text) if "setup-lakebase.sh" in line and "./scripts/" in line]
    destructive = [(i, line) for i, line in calls if re.search(r"--recreate\b|--drop\b", line)]
    additive = [(i, line) for i, line in calls if not re.search(r"--recreate\b|--drop\b", line)]

    assert len(additive) == 1 and re.search(r"setup-lakebase\.sh --yes;", additive[0][1]), additive
    assert len(destructive) == 1, f"--recreate/--drop outside the single guarded call: {destructive}"

    guard = [i for i, line in enumerate(lines) if re.match(r'\s*if \[\[ "\$TABLES_RECREATE" == true \]\]; then', line)]
    assert guard, "missing the --tables-recreate guard branch"
    start = guard[-1]
    indent = len(lines[start]) - len(lines[start].lstrip())
    end = next(
        j
        for j in range(start + 1, len(lines))
        if re.match(r"(elif|else|fi)\b", lines[j].lstrip()) and len(lines[j]) - len(lines[j].lstrip()) == indent
    )
    assert start < destructive[0][0] < end, "the --recreate call is not inside the --tables-recreate branch"
    assert "applied additively (create-if-not-exists + ON CONFLICT DO NOTHING seed)" in text


def test_s1_deploy_documents_tables_recreate_flag():
    header = DEPLOY_SH.read_text().split("set -e", 1)[0]
    assert "--tables-recreate" in header
    assert CONFIRM_ENV in header


# ---------------------------------------------------------------------------
# S2 — setup-lakebase.sh destructive actions refuse before connecting
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("action", ["--recreate", "--drop"])
def test_s2_destructive_action_refuses_without_confirm(offline, action):
    env, log = offline
    env["LAKEBASE_SCHEMA_OVERRIDE"] = SCHEMA
    rc, out = _run(SETUP_SH, [action, "--yes"], env)
    _assert_refused_offline(rc, out, log)


@pytest.mark.parametrize("action", ["--recreate", "--drop"])
def test_s2_destructive_action_refuses_on_schema_mismatch(offline, action):
    env, log = offline
    env["LAKEBASE_SCHEMA_OVERRIDE"] = SCHEMA
    env[CONFIRM_ENV] = "some_other_schema"
    rc, out = _run(SETUP_SH, [action, "--yes"], env)
    _assert_refused_offline(rc, out, log)


def test_s2_destructive_action_refuses_without_yes(offline):
    env, log = offline
    env["LAKEBASE_SCHEMA_OVERRIDE"] = SCHEMA
    env[CONFIRM_ENV] = SCHEMA
    rc, out = _run(SETUP_SH, ["--recreate"], env)
    _assert_refused_offline(rc, out, log)


def test_s2_confirmed_destructive_action_passes_the_guard(offline):
    """With --yes + matching env the guard lets it through (it then stops at the fake CLI)."""
    env, log = offline
    env["LAKEBASE_SCHEMA_OVERRIDE"] = SCHEMA
    env[CONFIRM_ENV] = SCHEMA
    rc, out = _run(SETUP_SH, ["--recreate", "--yes"], env)
    assert "Refusing" not in out, out
    assert rc != 0 and "Could not determine current Databricks user" in out, out
    assert "Connected" not in out and "Dropping" not in out, out
    assert log.exists(), "expected the guard to pass through to the (fake) databricks CLI"


# ---------------------------------------------------------------------------
# S3 — deploy --tables-recreate refuses before any network call
# ---------------------------------------------------------------------------


def test_s3_deploy_tables_recreate_refuses_without_confirm(offline):
    env, log = offline
    rc, out = _run(DEPLOY_SH, ["--tables-only", "--tables-recreate"], env)
    assert rc != 0, out
    assert "Refusing --tables-recreate" in out, out
    assert CONFIRM_ENV in out, out
    assert not log.exists(), f"databricks was invoked before the refusal: {log.read_text()}"


@pytest.fixture
def fake_project(tmp_path):
    """A throwaway project root with the real deploy script and a minimal databricks.yml."""
    root = tmp_path / "project"
    (root / "scripts").mkdir(parents=True)
    shutil.copy(DEPLOY_SH, root / "scripts" / DEPLOY_SH.name)
    (root / "databricks.yml").write_text(
        "variables:\n"
        "  lakebase_schema:\n"
        f'    default: "{SCHEMA}"\n'
        "targets:\n"
        "  user:\n"
        "    variables:\n"
        '      app_name: "vibe-forge-test"\n'
        f'      lakebase_schema: "{SCHEMA}"\n'
    )
    return root


def test_s3_deploy_tables_recreate_refuses_on_schema_mismatch(offline, fake_project):
    env, log = offline
    env[CONFIRM_ENV] = "some_other_schema"
    rc, out = _run(fake_project / "scripts" / DEPLOY_SH.name, ["--tables-only", "--tables-recreate"], env, cwd=fake_project)
    assert rc != 0, out
    assert "Refusing --tables-recreate" in out and "does not match" in out, out
    assert not log.exists(), f"databricks was invoked before the refusal: {log.read_text()}"


def test_s3_deploy_tables_recreate_confirmed_passes_the_guard(offline, fake_project):
    env, log = offline
    env[CONFIRM_ENV] = SCHEMA
    rc, out = _run(fake_project / "scripts" / DEPLOY_SH.name, ["--tables-only", "--tables-recreate"], env, cwd=fake_project)
    assert "Refusing" not in out, out
    assert rc != 0 and "Not authenticated to Databricks" in out, out
    assert log.exists(), "expected the guard to pass through to the (fake) databricks CLI"


# ---------------------------------------------------------------------------
# S4 — the default create path is unchanged (regression pin)
# ---------------------------------------------------------------------------


def test_s4_default_create_path_is_additive():
    text = SETUP_SH.read_text()
    parse_section = text.split("while [[ $# -gt 0 ]]", 1)[0]
    assert re.search(r'^ACTION="create"$', parse_section, re.MULTILINE), "default action must stay create"

    create_branch = text.split('elif ACTION == "create":', 1)[1].split("\n    elif ACTION ==", 1)[0]
    assert 'cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")' in create_branch
    assert "ON CONFLICT DO NOTHING" in create_branch
    assert "DROP TABLE" not in create_branch


# ---------------------------------------------------------------------------
# S5 — --full-setup is additive unless --recreate is explicit (and confirmed)
# ---------------------------------------------------------------------------


def test_s5_full_setup_resolves_to_create():
    text = SETUP_SH.read_text()
    block = text.split('if [[ "$ACTION" == "full-setup" ]]; then', 1)[1].split("\nfi\n", 1)[0]
    code = "\n".join(line for _, line in _code_lines(block))
    assert re.search(
        r'if \[\[ "\$EXPLICIT_RECREATE" == true \]\]; then\s*ACTION="recreate"\s*else\s*ACTION="create"\s*fi',
        code,
    ), f"--full-setup must resolve to ACTION=create unless --recreate is explicit:\n{code}"
    assert len(re.findall(r'ACTION="recreate"', code)) == 1, code


@pytest.mark.parametrize("args", [["--full-setup", "--recreate", "--yes"], ["--recreate", "--full-setup", "--yes"]])
def test_s5_full_setup_with_recreate_refuses_without_confirm(offline, args):
    env, log = offline
    env["LAKEBASE_SCHEMA_OVERRIDE"] = SCHEMA
    rc, out = _run(SETUP_SH, args, env)
    _assert_refused_offline(rc, out, log)


# ---------------------------------------------------------------------------
# S6 — vibe2value uninstall opts in before calling --drop
# ---------------------------------------------------------------------------


def test_s6_vibe2value_uninstall_sets_confirm_before_drop():
    source = VIBE2VALUE_PY.read_text()
    fn = next(
        node
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.FunctionDef) and node.name == "cmd_uninstall"
    )
    body = ast.get_source_segment(source, fn)
    opt_in = re.search(r'drop_env\["' + CONFIRM_ENV + r'"\]\s*=\s*lb\.get\("schema"', body)
    drop_call = re.search(r'_run_sh\(setup_lakebase_sh, \["--drop", "--yes"\]', body)
    assert opt_in, "uninstall must set VIBE_CONFIRM_DESTRUCTIVE_RESEED to the target schema"
    assert drop_call, "uninstall must call setup-lakebase.sh --drop --yes"
    assert opt_in.start() < drop_call.start()
    assert "env=drop_env" in body[drop_call.start():]
