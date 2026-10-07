"""workshop-level-too-narrow (D-48, D-49): sessions.workshop_level fits every
track id, and vibe_start_track fails closed when the new session is not saved.

The live probe of 0b07fc0 found that data-engineering-accelerator sessions never
persist: vibe_start_track stamps the track id (28 chars) into
sessions.workshop_level, a VARCHAR(20) column. The save raised
StringDataRightTruncation inside save_session_applying_mcp_delta, which catches
every exception and returns False, and vibe_start_track discarded that bool and
handed back a session_id that did not exist in Lakebase.

(a) every manifest track id fits the column width after DDL 03 and every later
    ALTER in file order (red on 20).
(b) DDL 16 widens the column to VARCHAR(n >= 64) and does nothing destructive.
(c) Lakebase configured + the first save returns False -> an isError result with
    code SESSION_NOT_SAVED.
(d) the first save returns True -> the StartTrackResult is unchanged.

TAMPER (verified, see PR body):
* X1 revert 03 to VARCHAR(20) and delete 16 -> (a) fails.
* X2 16 to VARCHAR(25) -> (a) fails.
* X3 add `DELETE FROM sessions;` to 16 -> (b) fails.
* X4 drop the return-value check in vibe_start_track -> (c) fails.
* X5 return the error even on True -> (d) fails.
"""

import pathlib
import re
import sys
import uuid

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine

DDL_DIR = REPO_ROOT / "db" / "lakebase" / "ddl"
DDL_03 = DDL_DIR / "03_sessions.sql"
DDL_16 = DDL_DIR / "16_widen_workshop_level.sql"
TRACK = "data-engineering-accelerator"

_CREATE_WIDTH = re.compile(r"\bworkshop_level\s+VARCHAR\s*\(\s*(\d+)\s*\)", re.IGNORECASE)
_ALTER_WIDTH = re.compile(
    r"ALTER\s+TABLE\s+\$\{schema\}\.sessions\s+ALTER\s+COLUMN\s+workshop_level\s+"
    r"TYPE\s+VARCHAR\s*\(\s*(\d+)\s*\)",
    re.IGNORECASE,
)


def _sql(path: pathlib.Path) -> str:
    """The file's SQL with `--` comments stripped (headers may name keywords)."""

    return "\n".join(line.split("--", 1)[0] for line in path.read_text().splitlines())


def _effective_width() -> int:
    """workshop_level's width after every DDL file runs in setup-lakebase.sh order."""

    created = _CREATE_WIDTH.findall(_sql(DDL_03))
    assert len(created) == 1, created
    width = int(created[0])
    for path in sorted(DDL_DIR.glob("*.sql")):
        for altered in _ALTER_WIDTH.findall(_sql(path)):
            width = int(altered)
    return width


# --- (a) every manifest track id fits the column ----------------------------


def test_a_every_track_id_fits_the_effective_ddl_width():
    width = _effective_width()
    too_long = {t: len(t) for t in engine.MANIFEST.tracks if len(t) > width}
    assert not too_long, f"workshop_level is VARCHAR({width}); too long: {too_long}"
    assert TRACK in engine.MANIFEST.tracks


# --- (b) migration pin: a widen, nothing destructive -------------------------


def test_b_ddl_16_widens_and_is_non_destructive():
    assert DDL_16.exists(), DDL_16
    sql = _sql(DDL_16)
    widths = [int(n) for n in _ALTER_WIDTH.findall(sql)]
    assert widths and all(n >= 64 for n in widths), widths
    for keyword in ("DROP", "TRUNCATE", "DELETE", "USING", "SET DEFAULT", "UPDATE", "INSERT"):
        assert not re.search(rf"\b{keyword}\b", sql, re.IGNORECASE), keyword
    # Fresh installs match, and the default is kept.
    assert re.search(r"workshop_level\s+VARCHAR\(64\)\s+DEFAULT\s+'300'", DDL_03.read_text())


# --- (c) / (d) vibe_start_track honours the first save's result --------------


def _start_env(monkeypatch, saved: bool):
    saves: list = []

    def delta_write(session_id, **kwargs):
        saves.append((session_id, kwargs))
        return saved

    monkeypatch.setattr(mcp_server, "save_session_applying_mcp_delta", delta_write)
    monkeypatch.setattr(mcp_server, "load_session", lambda session_id: None)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")
    return saves


def test_c_failed_first_save_returns_session_not_saved(monkeypatch):
    saves = _start_env(monkeypatch, saved=False)

    result = mcp_server.vibe_start_track(TRACK)

    assert isinstance(result, dict) and result["isError"] is True, result
    assert result["error"]["code"] == "SESSION_NOT_SAVED"
    assert result["structuredContent"]["error"]["code"] == "SESSION_NOT_SAVED"
    assert "nothing was started" in result["error"]["message"]
    assert any("SESSION_NOT_SAVED" in block.text for block in result["content"])
    # The failure came from the new-session save, which stamps the track id.
    assert len(saves) == 1
    assert saves[0][1]["workshop_level"] == TRACK


def test_d_successful_first_save_returns_unchanged_start_track_result(monkeypatch):
    saves = _start_env(monkeypatch, saved=True)

    result = mcp_server.vibe_start_track(TRACK)

    assert isinstance(result, mcp_server.StartTrackResult), result
    assert str(uuid.UUID(result.session_id)) == result.session_id
    assert result.track == TRACK
    assert len(saves) == 1 and saves[0][0] == result.session_id

    # Same outline as a start that never touches Lakebase.
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: False)
    baseline = mcp_server.vibe_start_track(TRACK)
    assert isinstance(baseline, mcp_server.StartTrackResult), baseline
    assert result.model_dump(exclude={"session_id"}) == baseline.model_dump(exclude={"session_id"})
