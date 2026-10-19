export interface DataSourceRow {
  catalog: string;
  schema: string;
  label: string;
  note?: string;
}

const IDENT = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/** The `approved_data_sources` value as rows; null when it is not a JSON list. */
export function parseDataSources(value: string | undefined): DataSourceRow[] | null {
  if (!value) return [];
  try {
    const rows = JSON.parse(value);
    if (!Array.isArray(rows)) return null;
    return rows
      .filter(r => r && typeof r === 'object')
      .map(r => ({ catalog: String(r.catalog ?? ''), schema: String(r.schema ?? ''), label: String(r.label ?? ''), ...(r.note ? { note: String(r.note) } : {}) }));
  } catch {
    return null;
  }
}

/** Rows that would be dropped by the server: blank or invalid names, duplicates. */
export function invalidDataSourceRows(rows: DataSourceRow[]): number[] {
  const seen = new Set<string>();
  return rows.flatMap((r, i) => {
    const id = `${r.catalog}.${r.schema}`;
    const bad = !IDENT.test(r.catalog) || !IDENT.test(r.schema) || seen.has(id);
    seen.add(id);
    return bad ? [i] : [];
  });
}
