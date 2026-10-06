"""D-37: deliver NEW seed rows to an existing install without touching admin edits.

Imported by the embedded Python in scripts/setup-lakebase.sh (sys.path insert of
PROJECT_ROOT/scripts). Pure helpers: no DB driver is imported here; every
function that talks to the database takes a DB-API cursor.

Model (see docs/superpowers/plans/2026-10-05-seed-new-rows-existing-install.md):
  * scripts/seed_baseline.json lists every PK present in the 01/02 seed files at
    ca9ff61. Those rows count as ALREADY APPLIED on an existing install and are
    never (re)inserted here, so an admin deletion of a baseline row sticks.
  * ${schema}.seed_rows_applied (DDL 14) ledgers every post-baseline seed row
    that has reached this install. A ledgered row is never re-inserted, so an
    admin deletion of a post-baseline row sticks too.
  * A post-baseline row that is neither in the baseline nor in the ledger is
    inserted with ON CONFLICT (pk) DO NOTHING. If an admin-created row already
    owns that PK the insert conflicts: we WARN and do not ledger it.
  * D-38 (docs/superpowers/plans/2026-10-06-seed-ledger-crash-window.md):
    F1 the insert and its ledger row are ONE statement (a data-modifying CTE),
    atomic under the runner's autocommit. F2 a bulk seed of 01/02 is bracketed
    by a ${schema}.seed_bulk_pending marker (DDL 15); a marker left by an
    interrupted run is recovered (ledgered) before the next run gates.
  * D-40 (docs/superpowers/plans/2026-10-06-seed-unique-conflict.md): an S4
    insert that hits section_input_prompts' partial unique index
    uq_section_assistant_version_active (an admin's ACTIVE row already owns the
    (section_tag, coding_assistant, version) slot) WARNs and is not ledgered,
    like a PK collision. Any other error still fails closed.
  * Nothing here issues UPDATE, DROP or TRUNCATE. The only DELETE clears our
    own seed_bulk_pending marker row; seed and user data are never deleted.
"""

import glob
import json
import os
import re

SEED_BASELINE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_baseline.json")

LEDGER_TABLE = "seed_rows_applied"
BULK_PENDING_TABLE = "seed_bulk_pending"

# D-40: the one unique violation the S4 apply absorbs (DDL 07's partial unique
# index on section_input_prompts (section_tag, coding_assistant, version)
# WHERE is_active). Matched by SQLSTATE + constraint name, no driver import.
UNIQUE_VIOLATION = "23505"
ACTIVE_TRIPLE_INDEX = "uq_section_assistant_version_active"

# (table, pk column, seed file) for the two config tables whose seed rows carry
# explicit SERIAL primary keys and no ON CONFLICT clause.
SEED_TABLES = [
    ("usecase_descriptions", "config_id", "01_seed_usecase_descriptions.sql"),
    ("section_input_prompts", "input_id", "02_seed_section_input_prompts.sql"),
]

# Seed files that are safe on every invocation (ON CONFLICT DO NOTHING inserts,
# updated_by='seed'-guarded UPDATEs) and therefore run in create mode always.
POST_SEED_MIGRATIONS = [
    "08_seed_step_visibility_overrides.sql",
    "09_seed_path_visibility_overrides.sql",
]


class SeedError(Exception):
    """A seed file can't be applied safely; raised before any write."""


# =============================================================================
# Statement splitting: byte-for-byte mirror of setup-lakebase.sh
# parse_sql_statements (pinned by tests/workshop/test_seed_new_rows.py).
# =============================================================================

def split_statements(sql_content: str) -> list:
    """
    Parse SQL content into individual statements.
    Handles multi-line INSERT statements with complex string values.
    Uses character-by-character parsing to properly handle embedded quotes.
    """
    statements = []
    current_stmt = []
    i = 0
    content_len = len(sql_content)
    
    while i < content_len:
        # Check for comment at start of line or after statement boundary
        if sql_content[i:i+2] == '--':
            # Skip to end of line
            while i < content_len and sql_content[i] != '\n':
                i += 1
            i += 1  # Skip the newline
            continue
        
        # Skip whitespace at statement boundaries
        if not current_stmt and sql_content[i] in ' \t\n\r':
            i += 1
            continue
        
        # Start of a new statement
        stmt_start = i
        in_string = False
        paren_depth = 0
        
        # Process until we find the end of the statement
        while i < content_len:
            char = sql_content[i]
            
            # Handle string literals
            if char == "'" and not in_string:
                in_string = True
                i += 1
                continue
            elif char == "'" and in_string:
                # Check for escaped quote ('')
                if i + 1 < content_len and sql_content[i + 1] == "'":
                    i += 2  # Skip both quotes
                    continue
                in_string = False
                i += 1
                continue
            
            if in_string:
                i += 1
                continue
            
            # Handle comments outside strings
            if char == '-' and i + 1 < content_len and sql_content[i + 1] == '-':
                # Skip to end of line
                while i < content_len and sql_content[i] != '\n':
                    i += 1
                i += 1
                continue
            
            # Track parentheses
            if char == '(':
                paren_depth += 1
            elif char == ')':
                paren_depth -= 1
            
            # Statement end: semicolon outside string and balanced parens
            if char == ';' and not in_string and paren_depth <= 0:
                stmt = sql_content[stmt_start:i+1].strip()
                if stmt and not stmt.startswith('--'):
                    statements.append(stmt)
                i += 1
                break
            
            i += 1
        else:
            # Reached end without semicolon
            stmt = sql_content[stmt_start:].strip()
            if stmt and not stmt.startswith('--'):
                # Try to salvage incomplete statement
                if 'INSERT' in stmt.upper() or 'CREATE' in stmt.upper():
                    statements.append(stmt)
            break
    
    return statements


def transform_sql_for_postgres(sql_content: str, schema: str) -> str:
    """Same placeholder rewrite as setup-lakebase.sh transform_sql_for_postgres."""
    sql_content = re.sub(r'\$\{catalog\}\.\$\{schema\}\.', f'{schema}.', sql_content)
    sql_content = sql_content.replace('${schema}', schema)
    sql_content = sql_content.replace('current_timestamp()', 'CURRENT_TIMESTAMP')
    sql_content = sql_content.replace('current_user()', 'CURRENT_USER')
    return sql_content


# =============================================================================
# Seed row extraction
# =============================================================================

_INSERT_RE = re.compile(r"\s*INSERT\s+INTO\s+(\S+?)\s*\(", re.IGNORECASE)


def _read_paren_group(stmt: str, start: int):
    """Split the parenthesized group opening at stmt[start] into top-level items.

    Returns (items, index just past the closing paren). Quotes follow the
    runner's rules ('' escapes); nested parens are kept inside an item.
    """
    if start >= len(stmt) or stmt[start] != '(':
        raise SeedError(f"expected '(' at offset {start}")
    items, buf, depth, in_string, i = [], [], 0, False, start + 1
    while i < len(stmt):
        ch = stmt[i]
        if in_string:
            buf.append(ch)
            if ch == "'":
                if i + 1 < len(stmt) and stmt[i + 1] == "'":
                    buf.append("'")
                    i += 2
                    continue
                in_string = False
            i += 1
            continue
        if ch == "'":
            in_string = True
            buf.append(ch)
        elif ch == '(':
            depth += 1
            buf.append(ch)
        elif ch == ')':
            if depth == 0:
                items.append(''.join(buf).strip())
                return items, i + 1
            depth -= 1
            buf.append(ch)
        elif ch == ',' and depth == 0:
            items.append(''.join(buf).strip())
            buf = []
        else:
            buf.append(ch)
        i += 1
    raise SeedError("unterminated parenthesized group")


def _insert_pk(stmt: str, table: str, pk_col: str):
    """The explicit PK of an INSERT into ``table``; None if it targets another table."""
    m = _INSERT_RE.match(stmt)
    if not m or m.group(1).split('.')[-1].lower() != table.lower():
        return None
    head = stmt[:80].replace('\n', ' ')
    cols, end = _read_paren_group(stmt, m.end() - 1)
    cols = [c.strip().strip('"').lower() for c in cols]
    if pk_col.lower() not in cols:
        raise SeedError(f"{table}: INSERT without an explicit {pk_col}: {head}")
    vm = re.compile(r"\s*VALUES\s*", re.IGNORECASE).match(stmt, end)
    if not vm:
        raise SeedError(f"{table}: INSERT is not a VALUES insert: {head}")
    values, end = _read_paren_group(stmt, vm.end())
    if len(values) != len(cols):
        raise SeedError(f"{table}: column/value count mismatch: {head}")
    raw = values[cols.index(pk_col.lower())]
    if not re.fullmatch(r"\d+", raw):
        raise SeedError(f"{table}: unparseable {pk_col} {raw[:40]!r}: {head}")
    if stmt[end:].strip() != ';':
        # A second VALUES tuple or an existing ON CONFLICT clause: fail closed.
        raise SeedError(f"{table}: unsupported INSERT tail after the first VALUES tuple: {head}")
    return int(raw)


def seed_rows(path: str, table: str, pk_col: str, schema: str = None) -> list:
    """[(pk, INSERT statement)] for every INSERT into ``table`` in the seed file.

    UPDATE/DELETE (and every other non-INSERT) statement is never returned. Any
    INSERT into ``table`` whose PK can't be parsed, or a duplicate PK, raises
    SeedError. With ``schema`` the file gets the runner's placeholder rewrite.
    """
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if schema is not None:
        content = transform_sql_for_postgres(content, schema)
    rows, seen = [], set()
    for stmt in split_statements(content):
        pk = _insert_pk(stmt, table, pk_col)
        if pk is None:
            continue
        if pk in seen:
            raise SeedError(f"{table}: duplicate {pk_col} {pk} in {os.path.basename(path)}")
        seen.add(pk)
        rows.append((pk, stmt))
    return rows


def load_baseline(path: str = SEED_BASELINE_PATH) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return {table: set(pks) for table, pks in data.items()}


# =============================================================================
# Database operations (DB-API cursor)
# =============================================================================


def _ledgered(cursor, schema: str, table: str) -> set:
    cursor.execute(f"SELECT pk FROM {schema}.{LEDGER_TABLE} WHERE table_name = %s", (table,))
    return {r[0] for r in cursor.fetchall()}


def _ledger(cursor, schema: str, table: str, pk: int) -> None:
    cursor.execute(
        f"INSERT INTO {schema}.{LEDGER_TABLE} (table_name, pk) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (table, pk),
    )


def _atomic_apply(stmt: str, pk_col: str, schema: str) -> str:
    """F1: the seed INSERT and its ledger row as ONE statement (atomic under autocommit).

    Rows skipped by ON CONFLICT DO NOTHING are not RETURNed, so the ledger row
    is written iff the seed row was. The statement is executed with the table
    name as its only parameter, so a literal '%' in the seed text is doubled.
    """
    body = stmt.rstrip()
    if not body.endswith(';'):
        raise SeedError(f"statement without a terminating ';': {body[:80]!r}")
    body = body[:-1].rstrip().replace('%', '%%')
    return (
        f"WITH ins AS (\n{body}\nON CONFLICT ({pk_col}) DO NOTHING\nRETURNING {pk_col}\n)\n"
        f"INSERT INTO {schema}.{LEDGER_TABLE} (table_name, pk) SELECT %s, {pk_col} FROM ins ON CONFLICT DO NOTHING"
    )


def _is_active_triple_conflict(exc) -> bool:
    """True iff ``exc`` is a unique violation on ACTIVE_TRIPLE_INDEX.

    psycopg3 spells the SQLSTATE ``sqlstate``, psycopg2 ``pgcode``; both carry
    ``diag.constraint_name``.
    """
    sqlstate = getattr(exc, "sqlstate", None) or getattr(exc, "pgcode", None)
    constraint = getattr(getattr(exc, "diag", None), "constraint_name", None)
    return sqlstate == UNIQUE_VIOLATION and constraint == ACTIVE_TRIPLE_INDEX


def apply_new_rows(cursor, schema, table, pk_col, rows, baseline, mode, log=print) -> dict:
    """Apply the post-baseline seed rows of one table.

    mode="insert" (S4, populated install): insert each post-baseline row that
    is not ledgered, with ON CONFLICT (pk) DO NOTHING, and ledger it in the
    same statement (F1); WARN (nothing ledgered) when an existing row owns the
    PK or, D-40, an active row owns its uq_section_assistant_version_active
    slot; then raise the PK sequence (never lower).
    mode="ledger" (S5, after a bulk seed): ledger every post-baseline PK that
    now exists in the table. Inserts nothing into ``table``.
    """
    post = [(pk, stmt) for pk, stmt in rows if pk not in baseline]
    result = {"inserted": 0, "warnings": 0, "ledgered": 0}
    if mode == "ledger":
        if post:
            cursor.execute(
                f"SELECT {pk_col} FROM {schema}.{table} WHERE {pk_col} = ANY(%s)",
                ([pk for pk, _ in post],),
            )
            for (pk,) in cursor.fetchall():
                _ledger(cursor, schema, table, pk)
                result["ledgered"] += 1
        log(f"    {table}: {result['ledgered']} post-baseline rows ledgered")
        return result
    if mode != "insert":
        raise ValueError(f"unknown mode {mode!r}")

    applied = _ledgered(cursor, schema, table)
    for pk, stmt in post:
        if pk in applied:
            continue
        try:
            cursor.execute(_atomic_apply(stmt, pk_col, schema), (table,))
        except Exception as e:
            # The runner connects with autocommit=True (setup-lakebase.sh
            # ~:582/:589), so the failed statement rolls back alone and the
            # next row's statement runs normally.
            if not _is_active_triple_conflict(e):
                raise
            log(
                f"    WARNING: {table} {pk_col}={pk} skipped: an active row for "
                f"(section_tag, coding_assistant, version) already exists "
                f"({ACTIVE_TRIPLE_INDEX}); seed row not applied"
            )
            result["warnings"] += 1
            continue
        if cursor.rowcount == 1:
            result["inserted"] += 1
        else:
            log(f"    WARNING: {table} {pk_col}={pk} is held by an existing row; seed row not applied")
            result["warnings"] += 1
    raise_sequence_never_lower(cursor, schema, table, pk_col, log=log)
    log(f"    {table}: {result['inserted']} inserted / {result['warnings']} warnings")
    return result


def raise_sequence_never_lower(cursor, schema, table, pk_col, log=print):
    """setval(seq, max_pk + 1, false) only if that is above the sequence's next value.

    next value: last_value NULL -> start_value (pg_sequences); is_called ->
    last_value + 1; not is_called -> last_value. Returns the value set, or None.
    """
    seq_rel = f"{table}_{pk_col}_seq"
    seq = f"{schema}.{seq_rel}"
    cursor.execute(f"SELECT MAX({pk_col}) FROM {schema}.{table}")
    max_pk = cursor.fetchone()[0] or 0
    cursor.execute(f"SELECT last_value, is_called FROM {seq}")
    last_value, is_called = cursor.fetchone()
    if last_value is None:
        cursor.execute(
            "SELECT start_value FROM pg_sequences WHERE schemaname = %s AND sequencename = %s",
            (schema, seq_rel),
        )
        next_value = cursor.fetchone()[0]
    elif is_called:
        next_value = last_value + 1
    else:
        next_value = last_value
    target = max_pk + 1
    if target > next_value:
        cursor.execute("SELECT setval(%s, %s, false)", (seq, target))
        log(f"    {table}.{pk_col} sequence raised {next_value} -> {target}")
        return target
    log(f"    {table}.{pk_col} sequence kept at {next_value} (max {pk_col} {max_pk})")
    return None


def _count(cursor, schema, table) -> int:
    cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table}")
    return cursor.fetchone()[0]


def _parse_all(schema, dml_dir):
    """Parse every seed table's rows up front so a parse error stops before any write."""
    return {
        table: seed_rows(os.path.join(dml_dir, seed_file), table, pk_col, schema)
        for table, pk_col, seed_file in SEED_TABLES
    }


# =============================================================================
# F2 (D-38): bulk-in-progress marker ${schema}.seed_bulk_pending (DDL 15)
# =============================================================================


def _pending_bulk_tables(cursor, schema) -> set:
    cursor.execute(f"SELECT table_name FROM {schema}.{BULK_PENDING_TABLE}")
    return {r[0] for r in cursor.fetchall()}


def mark_bulk_pending(cursor, schema, tables) -> set:
    """Write the marker for each table BEFORE its bulk seed.

    Returns the tables that already had a marker, i.e. whose earlier bulk seed
    was interrupted before it was ledgered.
    """
    leftover = _pending_bulk_tables(cursor, schema) & set(tables)
    for table in tables:
        cursor.execute(
            f"INSERT INTO {schema}.{BULK_PENDING_TABLE} (table_name) VALUES (%s) ON CONFLICT DO NOTHING",
            (table,),
        )
    return leftover


def _clear_bulk_pending(cursor, schema, table) -> None:
    # Our own bookkeeping row only; never seed or user data.
    cursor.execute(f"DELETE FROM {schema}.{BULK_PENDING_TABLE} WHERE table_name = %s", (table,))


def _recover(cursor, schema, parsed, baseline, tables, log) -> set:
    """Ledger the post-baseline rows an interrupted bulk seed left un-ledgered.

    Every post-baseline PK now present in a marked table came from that bulk
    seed, so it is ledgered (mode="ledger"); then the never-lower sequence
    raise (F3) and the marker is cleared. Rows the bulk never reached stay
    absent and un-ledgered; the S4 path inserts them atomically (F1).
    """
    recovered = set()
    for table, pk_col, _ in SEED_TABLES:
        if table not in tables:
            continue
        result = apply_new_rows(cursor, schema, table, pk_col, parsed[table], baseline.get(table, set()), "ledger", log=log)
        raise_sequence_never_lower(cursor, schema, table, pk_col, log=log)
        _clear_bulk_pending(cursor, schema, table)
        log(f"  {table}: recovered interrupted bulk seed ({result['ledgered']} post-baseline rows ledgered)")
        recovered.add(table)
    return recovered


def recover_interrupted_bulks(cursor, schema, dml_dir, tables, baseline_path=SEED_BASELINE_PATH, log=print) -> set:
    """--recreate: recover the tables mark_bulk_pending reported as left over."""
    if not tables:
        return set()
    return _recover(cursor, schema, _parse_all(schema, dml_dir), load_baseline(baseline_path), set(tables), log)


def record_applied_rows(cursor, schema, dml_dir, baseline_path=SEED_BASELINE_PATH, log=print) -> None:
    """S5: after a bulk seed, ledger every post-baseline seed PK that now exists, then clear its marker."""
    parsed = _parse_all(schema, dml_dir)
    baseline = load_baseline(baseline_path)
    for table, pk_col, _ in SEED_TABLES:
        apply_new_rows(cursor, schema, table, pk_col, parsed[table], baseline.get(table, set()), "ledger", log=log)
        _clear_bulk_pending(cursor, schema, table)


def run_create_mode_seed(cursor, schema, dml_dir, run_sql_file, baseline_path=SEED_BASELINE_PATH, log=print) -> None:
    """Create-mode seeding with per-table gating (S4-S6).

    First (F2) any table whose seed_bulk_pending marker survived an interrupted
    run is recovered: its post-baseline rows are ledgered and the marker cleared.
    Seed files then run in the runner's sorted order (via ``run_sql_file``, the
    runner's execute_sql_file):
      * 01/02 only when their own table is EMPTY, bracketed by the marker
        (written before the file, cleared after a never-lower sequence raise
        and S5 ledgering). A POPULATED table (COUNT > 0, even partially seeded)
        gets only the S4 new-row path; missing baseline rows are admin
        deletions and stay deleted.
      * 08/09 every time (ON CONFLICT DO NOTHING / updated_by='seed' guards).
      * any other seed file (the generated 03_seed_workshop_parameters.sql)
        only on a fresh install, i.e. when every SEED_TABLES table is empty,
        which is when the old bulk gate ran it on a first deploy.
    """
    parsed = _parse_all(schema, dml_dir)
    baseline = load_baseline(baseline_path)
    _recover(cursor, schema, parsed, baseline, _pending_bulk_tables(cursor, schema), log)
    counts = {table: _count(cursor, schema, table) for table, _, _ in SEED_TABLES}
    by_file = {seed_file: (table, pk_col) for table, pk_col, seed_file in SEED_TABLES}
    fresh = all(count == 0 for count in counts.values())

    bulk = []
    for path in sorted(glob.glob(os.path.join(dml_dir, '*.sql'))):
        name = os.path.basename(path)
        if name in by_file:
            table, pk_col = by_file[name]
            if counts[table] == 0:
                log(f"  {table}: empty -> bulk seed {name}")
                mark_bulk_pending(cursor, schema, [table])
                run_sql_file(path)
                bulk.append((table, pk_col))
            else:
                log(
                    f"  {table}: populated ({counts[table]} rows) -> post-baseline new-row apply "
                    f"(missing baseline rows are treated as admin deletions)"
                )
        elif name in POST_SEED_MIGRATIONS:
            log(f"  {name}: idempotent post-seed migration -> run")
            run_sql_file(path)
        elif fresh:
            log(f"  {name}: fresh install -> run")
            run_sql_file(path)
        else:
            log(f"  {name}: existing install -> skipped")

    for table, pk_col in bulk:
        raise_sequence_never_lower(cursor, schema, table, pk_col, log=log)
        apply_new_rows(cursor, schema, table, pk_col, parsed[table], baseline.get(table, set()), "ledger", log=log)
        _clear_bulk_pending(cursor, schema, table)

    bulk_tables = {table for table, _ in bulk}
    for table, pk_col, _ in SEED_TABLES:
        if table not in bulk_tables:
            apply_new_rows(cursor, schema, table, pk_col, parsed[table], baseline.get(table, set()), "insert", log=log)
