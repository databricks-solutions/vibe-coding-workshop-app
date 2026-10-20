// Source filter for collections that mix native and contributed use cases.
//
// Run: node --experimental-strip-types --test tests/frontend/provenanceFilter.node.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterBySource, hasContributions } from '../../src/components/provenance/provenance.ts';

const cert = { by: { id: 'c', type: 'company', display_name: 'C', website: null, avatar_url: null }, version: '1.0.0', date: '2026-10-01', notes: 'ok', evidence_url: null };
const contribution = (certified: boolean) => ({ certifications: certified ? [cert] : [] });

const items = [
  { value: '', label: 'Select...' },
  { value: 'native_plain', label: 'Native' },
  { value: 'native_cert', label: 'Native certified', is_certified: true },
  { value: 'contrib__p__a', label: 'Partner', provenance: 'partner', contribution: contribution(true) },
  { value: 'contrib__t__b', label: 'Third', provenance: 'third_party', contribution: contribution(false) },
] as never[];

const values = (filter: Parameters<typeof filterBySource>[1]) =>
  filterBySource(items, filter).map((i: { value: string }) => i.value).filter(Boolean);

test('detects contributions only when a non-native entry is present', () => {
  assert.equal(hasContributions(items), true);
  assert.equal(hasContributions([{}, { provenance: 'native' }]), false);
});

test('filters by source and keeps the placeholder option', () => {
  assert.deepEqual(values('all'), ['native_plain', 'native_cert', 'contrib__p__a', 'contrib__t__b']);
  assert.deepEqual(values('native'), ['native_plain', 'native_cert']);
  assert.deepEqual(values('partner'), ['contrib__p__a']);
  assert.deepEqual(values('third_party'), ['contrib__t__b']);
  assert.equal(filterBySource(items, 'partner')[0].value, '');
});

test('certified covers admin certification and contributor certification', () => {
  assert.deepEqual(values('certified'), ['native_cert', 'contrib__p__a']);
});
