// The Insights brief keeps the approved-data explorer's pick: composeBrief writes
// a "Governed source:" line plus one "Proposed KPI:" line per pinned proposed KPI,
// and parseBrief reads them back.
//
// Run: node --experimental-strip-types --test tests/frontend/governedSourceBrief.node.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

// brief.ts reaches journeykit, which imports stylesheets; stub them out.
async function load<T>(srcPath: string): Promise<T> {
  const { module } = await runnerImport<T>(`${ROOT}${srcPath}`, {
    configFile: false,
    root: ROOT,
    logLevel: 'silent',
    esbuild: { jsx: 'automatic' },
    plugins: [{
      name: 'stub-css',
      enforce: 'pre',
      resolveId: id => (id.endsWith('.css') ? '\0stub-css' : null),
      load: id => (id === '\0stub-css' ? 'export default ""' : null),
    }],
  });
  return module;
}

type BriefModule = typeof import('../../src/components/insights/brief.ts');
type SourcesModule = typeof import('../../src/components/insights/sources/sourcesApi.ts');
type LevelModule = typeof import('../../src/components/insights/blueprint/matchLevel.ts');

const { composeBrief, parseBrief } = await load<BriefModule>('src/components/insights/brief.ts');
const { sourcesIn, sourceKey, matchTables, addToLocation, removeFromLocation, locationEntries, isSourceId } = await load<SourcesModule>('src/components/insights/sources/sourcesApi.ts');
const { matchLevel } = await load<LevelModule>('src/components/insights/blueprint/matchLevel.ts');

const source = {
  sources: ['samples.wanderbricks'],
  label: 'Wanderbricks (sample)',
  certified: true,
  areas: ['bookings_payments', 'properties_amenities'],
  tables: ['samples.wanderbricks.bookings', 'samples.wanderbricks.payments'],
  kpis: ['booking_revenue', 'listing_pricing'],
  proposed: ['booking_revenue on samples.wanderbricks.bookings: SUM(total_amount) AS total_revenue; by check_in, status'],
  evidence: { fit: 'strong' as const, matchedQuestions: 3, totalQuestions: 4 },
};

test('governed source round-trips through the brief', () => {
  const text = composeBrief({
    name: 'Booking insights',
    industryLabel: 'Travel',
    questions: ['Revenue by month?', 'Top cities by bookings?'],
    dataSource: 'existing',
    dataLocation: 'samples.wanderbricks',
    source,
  });
  assert.match(text, /^Data: Use data that already exists in Databricks "Wanderbricks sample" \(samples\.wanderbricks\)\.$/m);
  assert.match(text, /^Governed source: samples\.wanderbricks \| certified \| areas: bookings_payments, properties_amenities \|/m);
  assert.match(text, /^Proposed KPI: booking_revenue on samples\.wanderbricks\.bookings: SUM\(total_amount\) AS total_revenue; by check_in, status \(create as a metric view\)$/m);

  const parsed = parseBrief(text);
  assert.equal(parsed.dataSource, 'existing');
  assert.equal(parsed.dataLocation, 'samples.wanderbricks');
  assert.deepEqual(parsed.questions, ['Revenue by month?', 'Top cities by bookings?']);
  assert.deepEqual(parsed.source, { ...source, label: 'Wanderbricks sample' });
});

test('briefs without a governed source are unchanged', () => {
  const text = composeBrief({ name: 'X', industryLabel: '', questions: ['Q?'], dataSource: 'existing', dataLocation: 'main.sales' });
  assert.doesNotMatch(text, /Governed source:/);
  const parsed = parseBrief(text);
  assert.equal(parsed.source, null);
  assert.equal(parsed.dataLocation, 'main.sales');
});

test('a governed source is ignored for non-existing data paths', () => {
  const text = composeBrief({ name: 'X', industryLabel: '', questions: ['Q?'], dataSource: 'sample', dataLocation: '', source });
  assert.doesNotMatch(text, /Governed source:/);
});

test('match level thresholds', () => {
  assert.equal(matchLevel(0, 0), 'ok');
  assert.equal(matchLevel(0, 4), 'veryLow');
  assert.equal(matchLevel(1, 4), 'veryLow');
  assert.equal(matchLevel(2, 6), 'low');
  assert.equal(matchLevel(2, 4, 'weak'), 'veryLow');
  assert.equal(matchLevel(2, 4, 'partial'), 'ok');
  assert.equal(matchLevel(2, 5), 'low');
  assert.equal(matchLevel(3, 4, 'weak'), 'ok');
  assert.equal(matchLevel(4, 4), 'ok');
});

test('a very low match the participant continued past is written and read back', () => {
  const text = composeBrief({
    name: 'X', industryLabel: '', questions: ['A?', 'B?', 'C?', 'D?'], dataSource: 'existing', dataLocation: 'samples.tpch',
    source: { ...source, sources: ['samples.tpch'], certified: false, evidence: { fit: 'weak', matchedQuestions: 1, totalQuestions: 4 }, lowMatch: true },
  });
  assert.match(text, /^Match warning: very low \(1 of 4 questions answered\)\./m);
  assert.equal(parseBrief(text).source?.lowMatch, true);
  assert.doesNotMatch(composeBrief({ name: 'X', industryLabel: '', questions: ['A?'], dataSource: 'existing', dataLocation: 'samples.wanderbricks', source }), /Match warning:/);
});

test('location entries: added sources and free-text hints', () => {
  let loc = addToLocation('', 'samples.wanderbricks');
  loc = addToLocation(loc, 'main.sales');
  loc = addToLocation(loc, 'MAIN.SALES');
  loc = addToLocation(loc, 'the orders table, maybe');
  assert.deepEqual(locationEntries(loc), ['samples.wanderbricks', 'main.sales', 'the orders table  maybe']);
  assert.deepEqual(sourcesIn(loc), ['samples.wanderbricks', 'main.sales']);
  assert.deepEqual(locationEntries(removeFromLocation(loc, 'main.sales')), ['samples.wanderbricks', 'the orders table  maybe']);
  assert.equal(isSourceId(' main.sales '), true);
  assert.equal(isSourceId('main.sales.orders'), false);
});

test('source helpers', () => {
  assert.deepEqual(sourcesIn('samples.wanderbricks, main.sales  just_a_table, a.b.c'), ['samples.wanderbricks', 'main.sales']);
  assert.equal(sourceKey(['b.y', 'a.x', 'b.y']), 'a.x,b.y');
  const s = { id: 'samples.wanderbricks', catalog: 'samples', schema: 'wanderbricks', label: '', note: '', readable: true, tableCount: 3, metricViews: 0, error: '',
    tables: [{ name: 'bookings', comment: '' }, { name: 'payments', comment: 'Payments for bookings' }, { name: 'clickstream', comment: '' }] };
  assert.deepEqual(matchTables(s, 'What was booking revenue by payment method?').sort(), ['bookings', 'payments']);
  assert.deepEqual(matchTables(s, ''), []);
});

type ScopeModule = typeof import('../../src/components/insights/sources/certifiedScope.ts');
const { certifiedHint, scopeLabel } = await load<ScopeModule>('src/components/insights/sources/certifiedScope.ts');

const briefOf = (includeUncertified?: boolean) => composeBrief({
  name: 'Delay risk', industryLabel: 'Airlines', questions: ['Delays by hub?'],
  dataSource: 'existing', dataLocation: 'cat.airlines', source: { ...source, sources: ['cat.airlines'] }, includeUncertified,
});

test('existing data defaults to certified assets only, and the choice round-trips', () => {
  assert.match(briefOf(), /^Table scope: certified assets only \(tables tagged system\.certification_status = certified\)\.$/m);
  assert.equal(parseBrief(briefOf()).includeUncertified, false);
  assert.match(briefOf(true), /^Table scope: all tables, including uncertified ones\.$/m);
  assert.equal(parseBrief(briefOf(true)).includeUncertified, true);
  // Briefs written before the setting existed read as certified only.
  assert.equal(parseBrief(briefOf().replace(/^Table scope:.*$/m, '')).includeUncertified, false);
  const sample = composeBrief({ name: 'x', industryLabel: '', questions: ['q?'], dataSource: 'sample', dataLocation: '' });
  assert.doesNotMatch(sample, /Table scope:/);
});

test('the data step word match can stick to certified tables', () => {
  const s = {
    id: 'c.s', catalog: 'c', schema: 's', label: 's', note: '', readable: true, tableCount: 2, metricViews: 0, error: '',
    tables: [{ name: 'flight_delays', comment: '', certified: false }, { name: 'flights', comment: '', certified: true }],
  };
  assert.deepEqual(matchTables(s, 'flight delays').sort(), ['flight_delays', 'flights']);
  assert.deepEqual(matchTables(s, 'flight delays', 4, true), ['flights']);
});

const scope = (scanned: number, total: number, certifiedOnly = true) => ({
  certifiedOnly, scanned, certified: scanned, total,
  perSource: [{ id: 'cat.airlines', certified: scanned, total }, { id: 'cat.raw', certified: 0, total: total ? 3 : 0 }],
});

test('the certified-only hint shows when the scan left tables out and the match is thin', () => {
  const settled = { answered: 3, total: 5, level: 'low' as const, refining: false };
  const hint = certifiedHint(scope(205, 208), settled);
  assert.equal(hint?.skipped, 3);
  assert.deepEqual(hint?.uncertifiedSources, ['cat.raw']);
  assert.equal(certifiedHint(scope(205, 208), { ...settled, refining: true }), null, 'waits for the match to settle');
  assert.equal(certifiedHint(scope(205, 208), { answered: 5, total: 5, level: 'ok', refining: false }), null, 'nothing missing');
  assert.equal(certifiedHint(scope(208, 208), settled), null, 'nothing was skipped');
  assert.equal(certifiedHint(scope(200, 208, false), settled), null, 'all tables were scanned');
  assert.equal(certifiedHint(scope(0, 12), null)?.empty, true, 'nothing certified at all');
});

test('the scope label says what was scanned', () => {
  assert.equal(scopeLabel(scope(205, 208)), 'Certified tables only · 205 of 208');
  assert.equal(scopeLabel(scope(205, 208, false)), 'All tables · 208, 205 certified');
  assert.equal(scopeLabel(undefined), '');
});
