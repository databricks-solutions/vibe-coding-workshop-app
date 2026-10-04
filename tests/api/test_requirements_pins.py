"""Pin guard for requirements.txt: never-float deps must be exact ``==`` pins.

databricks-sdk must also equal the installed SDK so the suite env cannot drift
from what the platform installs (the #77/#78 timeout/retry reasoning is anchored
to that version).
"""

import re
from pathlib import Path

import databricks.sdk.version

REQUIREMENTS = Path(__file__).resolve().parents[2] / "requirements.txt"
EXACT_PINNED = ("databricks-sdk", "mcp")


def _specs() -> dict[str, str]:
    specs = {}
    for raw in REQUIREMENTS.read_text().splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        m = re.match(r"^([A-Za-z0-9_.-]+)(\[[^\]]*\])?\s*(.*)$", line)
        specs[m.group(1).lower()] = m.group(3).strip()
    return specs


def test_never_float_deps_are_exact_pins():
    specs = _specs()
    for name in EXACT_PINNED:
        assert name in specs, f"{name} missing from requirements.txt"
        assert re.fullmatch(r"==\d+(\.\d+)*", specs[name]), (
            f"{name} must be an exact == pin, got {specs[name]!r}"
        )


def test_databricks_sdk_pin_matches_installed():
    pinned = _specs()["databricks-sdk"].removeprefix("==")
    assert pinned == databricks.sdk.version.__version__
