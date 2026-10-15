"""A session is reported missing only when the store answered, never when it could not be reached."""
import asyncio

from src.backend.api import routes


def _load(monkeypatch, exists):
    monkeypatch.setattr(routes, "load_session", lambda sid: None)
    monkeypatch.setattr(routes, "session_exists", lambda sid: exists)
    return asyncio.run(routes.load_session_endpoint("abc"))


def test_missing_when_the_store_has_no_row(monkeypatch):
    r = _load(monkeypatch, False)
    assert r.success is False and r.missing is True


def test_not_missing_when_the_store_is_unreachable(monkeypatch):
    r = _load(monkeypatch, None)
    assert r.success is False and r.missing is False


def test_found_session_is_not_missing(monkeypatch):
    monkeypatch.setattr(routes, "load_session", lambda sid: {"session_name": "x"})
    r = asyncio.run(routes.load_session_endpoint("abc"))
    assert r.success is True and r.missing is False
