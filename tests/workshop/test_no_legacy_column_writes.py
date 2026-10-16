"""Phase 3 T5 R4a — ABSENCE-OF-WRITES pin for the three legacy step columns.

R4a stops writing ``current_step`` / ``completed_steps`` / ``skipped_steps``. This
file pins that no write path can persist them again — WITHOUT touching the reads
(R4a keeps the number fallback on the read side; the full name-grep absence pin is
R4b). It is write-specific on purpose:

- ``lakebase.save_session`` is the single chokepoint for every backend session
  write. Its signature no longer declares the three columns (so a residual write
  call is a runtime ``TypeError``) and its body references none of them (so the
  INSERT column list, VALUES and ON CONFLICT SET clauses are clean).
- The MCP sync-bridge helper ``_legacy_progress`` is gone, and ``mcp_server.py``
  passes no legacy write kwargs anywhere.
- The frontend request types (``SessionSaveRequest`` /
  ``UpdateSessionMetadataRequest`` in ``client.ts``) no longer declare the fields,
  and ``App.tsx`` constructs no request object literal with those keys.

TAMPER (any reintroduced write fails here):
- re-add a ``completed_steps`` param to ``save_session`` → signature test fails;
- re-add it to the INSERT / SET → body test fails;
- restore ``_legacy_progress`` → the bridge-removed test fails;
- re-add ``completed_steps=...`` to any ``mcp_server`` save → the kwarg test fails;
- re-add a ``completed_steps`` field to a request interface or an
  ``App.tsx`` write literal → the frontend tests fail.
"""

import inspect
import pathlib
import re
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.services import lakebase

LEGACY = ("current_step", "completed_steps", "skipped_steps")


# --- backend: save_session is the write chokepoint ----------------------------


def test_save_session_signature_has_no_legacy_params():
    params = set(inspect.signature(lakebase.save_session).parameters)
    offenders = params & set(LEGACY)
    assert not offenders, f"save_session still accepts legacy write params: {offenders}"


def test_save_session_body_references_no_legacy_columns():
    src = inspect.getsource(lakebase.save_session)
    offenders = [name for name in LEGACY if name in src]
    assert offenders == [], f"save_session body still touches legacy columns: {offenders}"


# --- backend: MCP sync bridge no longer writes the numbers --------------------


def test_legacy_progress_bridge_removed():
    assert not hasattr(mcp_server, "_legacy_progress")


def test_mcp_server_passes_no_legacy_write_kwargs():
    src = pathlib.Path(mcp_server.__file__).read_text()
    # A kwarg write is `name=` (no space); prose/comments use `name/` or `name `.
    offenders = re.findall(r"\b(?:current_step|completed_steps|skipped_steps)\s*=", src)
    assert offenders == [], f"mcp_server.py still passes legacy write kwargs: {offenders}"


# --- frontend: request types + App write literals -----------------------------


def _interface_body(source: str, name: str) -> str:
    match = re.search(rf"export interface {name} \{{(.*?)\n\}}", source, re.DOTALL)
    assert match, f"interface {name} not found in client.ts"
    return match.group(1)


def test_frontend_request_types_drop_legacy_fields():
    client_ts = (REPO_ROOT / "src" / "api" / "client.ts").read_text()
    for iface in ("SessionSaveRequest", "UpdateSessionMetadataRequest"):
        body = _interface_body(client_ts, iface)
        for name in LEGACY:
            # A field DECLARATION is `name:` or `name?:` at line start; comments
            # (which may mention the names) start with `//` and never match.
            assert not re.search(rf"^\s*{name}\??\s*:", body, re.MULTILINE), (
                f"{iface} still declares a legacy field: {name}"
            )


def test_app_tsx_constructs_no_legacy_write_literals():
    app_tsx = (REPO_ROOT / "src" / "App.tsx").read_text()
    # Object-literal write keys `name:` at line start. Reads are `response.name`
    # (dot access, no leading `name:`), so this matches only request-body writes.
    offenders = re.findall(
        r"^\s*(?:current_step|completed_steps|skipped_steps)\s*:", app_tsx, re.MULTILINE
    )
    assert offenders == [], f"App.tsx still writes legacy fields in a request literal: {offenders}"
