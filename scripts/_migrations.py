"""
Lightweight per-file migration tracker for Lakebase DDL/seed application.

Stores one row per applied SQL file in a workshop-internal ``_migrations`` table:

    CREATE TABLE <schema>._migrations (
        filename    TEXT PRIMARY KEY,
        sha256      TEXT NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        applied_by  TEXT NOT NULL DEFAULT CURRENT_USER
    );

Files whose ``filename`` is already present skip re-application, so the entire
post_deploy flow is safe to re-run after any partial failure.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Iterable, Set


def file_sha256(path: Path) -> str:
    """Hex SHA-256 of a file's bytes (used as a cheap content fingerprint)."""
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(64 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_migrations_table(cursor, schema: str) -> None:
    """Create ``<schema>._migrations`` if it doesn't exist (idempotent)."""
    cursor.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    cursor.execute(
        f'''
        CREATE TABLE IF NOT EXISTS "{schema}"._migrations (
            filename   TEXT PRIMARY KEY,
            sha256     TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            applied_by TEXT NOT NULL DEFAULT CURRENT_USER
        )
        '''
    )


def already_applied(cursor, schema: str) -> Set[str]:
    """Return the set of filenames recorded in ``<schema>._migrations``."""
    cursor.execute(f'SELECT filename FROM "{schema}"._migrations')
    return {row[0] for row in cursor.fetchall()}


def record_applied(cursor, schema: str, filename: str, sha256: str) -> None:
    """Insert (or update) a row marking ``filename`` as applied."""
    cursor.execute(
        f'''
        INSERT INTO "{schema}"._migrations (filename, sha256)
        VALUES (%s, %s)
        ON CONFLICT (filename) DO UPDATE
            SET sha256     = EXCLUDED.sha256,
                applied_at = CURRENT_TIMESTAMP,
                applied_by = CURRENT_USER
        ''',
        (filename, sha256),
    )


def filter_pending(files: Iterable[Path], applied: Set[str]) -> list[Path]:
    """Return files in ``files`` whose basename is not yet in ``applied``."""
    return [f for f in files if f.name not in applied]
