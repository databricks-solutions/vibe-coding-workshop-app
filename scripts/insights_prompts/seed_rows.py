"""Reads rows out of the section_input_prompts seed SQL.

The seed is a list of INSERT statements with SQL string literals ('' escapes).
Only literals, numbers, booleans, NULL and zero-arg function calls appear.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, Iterator, List

SEED = Path(__file__).resolve().parents[2] / "db" / "lakebase" / "dml_seed" / "02_seed_section_input_prompts.sql"

_INSERT = re.compile(r"INSERT INTO \$\{catalog\}\.\$\{schema\}\.section_input_prompts\s*\(([^)]*)\)\s*VALUES\s*", re.S)
_TOKEN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\(\)|[^,)]+")


def _values(sql: str, i: int) -> tuple[List[List[Any]], int]:
    """Parses `(..), (..);` starting at i. Returns the tuples and the index after the `;`."""
    rows: List[List[Any]] = []
    n = len(sql)
    while i < n:
        while i < n and sql[i] in " \t\r\n,":
            i += 1
        if i < n and sql[i] == ";":
            return rows, i + 1
        if sql[i] != "(":
            raise ValueError(f"expected '(' at {i}: {sql[i:i + 40]!r}")
        i += 1
        row: List[Any] = []
        while True:
            while sql[i] in " \t\r\n":
                i += 1
            if sql[i] == "'":
                j = i + 1
                buf = []
                while True:
                    k = sql.index("'", j)
                    buf.append(sql[j:k])
                    if k + 1 < n and sql[k + 1] == "'":
                        buf.append("'")
                        j = k + 2
                        continue
                    i = k + 1
                    break
                row.append("".join(buf))
            else:
                m = _TOKEN.match(sql, i)
                tok = m.group(0).strip()
                i = m.end()
                low = tok.lower()
                if low in ("true", "false"):
                    row.append(low == "true")
                elif low == "null":
                    row.append(None)
                elif re.fullmatch(r"-?\d+", tok):
                    row.append(int(tok))
                else:
                    row.append(tok)
            while sql[i] in " \t\r\n":
                i += 1
            if sql[i] == ",":
                i += 1
                continue
            if sql[i] == ")":
                i += 1
                break
            raise ValueError(f"unexpected {sql[i:i + 40]!r} at {i}")
        rows.append(row)
    return rows, i


def iter_rows(path: Path = SEED) -> Iterator[Dict[str, Any]]:
    sql = path.read_text()
    pos = 0
    while True:
        m = _INSERT.search(sql, pos)
        if not m:
            return
        cols = [c.strip() for c in m.group(1).split(",")]
        rows, pos = _values(sql, m.end())
        for r in rows:
            if len(r) != len(cols):
                raise ValueError(f"column mismatch near {r[:2]}")
            d = dict(zip(cols, r))
            d.setdefault("coding_assistant", "__default__")
            yield d


def latest(tag: str, assistant: str = "__default__", path: Path = SEED) -> Dict[str, Any] | None:
    """The highest active version of a row, as the backend would resolve it from a fresh seed."""
    best = None
    for r in iter_rows(path):
        if r["section_tag"] == tag and r["coding_assistant"] == assistant and r.get("is_active", True):
            if best is None or int(r.get("version", 1)) >= int(best.get("version", 1)):
                best = r
    return best
