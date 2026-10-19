#!/usr/bin/env python3
"""Mark every table and view in one or more schemas as certified in Unity Catalog.

Sets the Databricks system tag `system.certification_status = 'certified'`, which Catalog Explorer
shows as a Certified badge and the Insights data step reads for "Certified assets only".

    .venv/bin/python scripts/certify_tables.py -p e2-demo-field-eng --dry-run main.sales
    .venv/bin/python scripts/certify_tables.py -p e2-demo-field-eng main.sales main.finance
    .venv/bin/python scripts/certify_tables.py -p e2-demo-field-eng --only orders,customers main.sales

Tables already certified are skipped. If the tag API refuses the system tag and --warehouse is
given, the script falls back to ALTER TABLE ... SET TAGS on that SQL warehouse.
"""

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Tuple

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.catalog import EntityTagAssignment

CERT_TAG = "system.certification_status"
CERT_VALUE = "certified"


def _q(name: str) -> str:
    return "`" + name.replace("`", "``") + "`"


def current_value(w: WorkspaceClient, fqn: str) -> Optional[str]:
    for a in w.entity_tag_assignments.list(entity_type="tables", entity_name=fqn):
        if a.tag_key == CERT_TAG:
            return a.tag_value or ""
    return None


def certify(w: WorkspaceClient, fqn: str, warehouse: str, dry_run: bool) -> Tuple[str, str]:
    try:
        now = current_value(w, fqn)
    except Exception as e:
        return "failed", f"could not read tags: {str(e)[:160]}"
    if now == CERT_VALUE:
        return "skipped", "already certified"
    if dry_run:
        return "would tag", f"currently {now!r}" if now is not None else "untagged"
    try:
        if now is None:
            w.entity_tag_assignments.create(EntityTagAssignment(
                entity_type="tables", entity_name=fqn, tag_key=CERT_TAG, tag_value=CERT_VALUE))
        else:
            w.entity_tag_assignments.update(entity_type="tables", entity_name=fqn, tag_key=CERT_TAG,
                                            tag_assignment=EntityTagAssignment(
                                                entity_type="tables", entity_name=fqn, tag_key=CERT_TAG,
                                                tag_value=CERT_VALUE),
                                            update_mask="tag_value")
        return "tagged", ""
    except Exception as e:
        if not warehouse:
            return "failed", str(e)[:200]
    try:
        cat, sch, tbl = fqn.split(".", 2)
        stmt = f"ALTER TABLE {_q(cat)}.{_q(sch)}.{_q(tbl)} SET TAGS ('{CERT_TAG}' = '{CERT_VALUE}')"
        r = w.statement_execution.execute_statement(statement=stmt, warehouse_id=warehouse, wait_timeout="30s")
        state = r.status.state.value if r.status and r.status.state else ""
        if state != "SUCCEEDED":
            return "failed", f"SQL {state}: {(r.status.error.message if r.status and r.status.error else '')[:160]}"
        return "tagged", "via SQL"
    except Exception as e:
        return "failed", str(e)[:200]


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("schemas", nargs="+", help="catalog.schema")
    ap.add_argument("-p", "--profile", default=None)
    ap.add_argument("--warehouse", default="", help="SQL warehouse id for the ALTER TABLE fallback")
    ap.add_argument("--only", default="", help="comma-separated table names to limit to")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args(argv)

    w = WorkspaceClient(profile=args.profile)
    only = {t.strip().lower() for t in args.only.split(",") if t.strip()}
    totals = {"tagged": 0, "skipped": 0, "would tag": 0, "failed": 0}
    for source in args.schemas:
        cat, _, sch = source.partition(".")
        if not cat or not sch:
            print(f"Not a catalog.schema: {source}", file=sys.stderr)
            return 2
        names = [t.name for t in w.tables.list(cat, sch, omit_columns=True, omit_properties=True)
                 if t.name and (not only or t.name.lower() in only)]
        fqns = [f"{cat}.{sch}.{n}" for n in names]
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
            results = list(ex.map(lambda f: certify(w, f, args.warehouse, args.dry_run), fqns))
        counts = {k: 0 for k in totals}
        for fqn, (status, note) in zip(fqns, results):
            counts[status] += 1
            if status == "failed" or args.dry_run:
                print(f"  {status:9} {fqn}{f'  ({note})' if note else ''}")
        print(f"{source}: {len(fqns)} tables · " + ", ".join(f"{v} {k}" for k, v in counts.items() if v))
        for k, v in counts.items():
            totals[k] += v
    return 1 if totals["failed"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
