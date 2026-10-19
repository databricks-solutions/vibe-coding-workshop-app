import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withinLeadingSchema } from '../../src/components/insights/blueprint/leadingSchema.ts';
import type { BlueprintDigest } from '../../src/components/insights/blueprint/types.ts';

const digest = {
  areas: [
    { name: 'flight_ops', division: 'c.airlines' },
    { name: 'network', division: 'c.airlines' },
    { name: 'hotel_loyalty', division: 'c.travel' },
    { name: 'bookings', division: 'c.travel' },
  ],
} as unknown as BlueprintDigest;

test('keeps the leading schema and only near-top areas from others', () => {
  const scored = [
    { name: 'flight_ops', score: 10 },
    { name: 'bookings', score: 9 },
    { name: 'network', score: 6 },
    { name: 'hotel_loyalty', score: 5 },
  ];
  assert.deepEqual(withinLeadingSchema(scored, digest).map(s => s.name), ['flight_ops', 'bookings', 'network']);
});

test('one schema is left alone', () => {
  const one = { areas: [{ name: 'a', division: '' }, { name: 'b', division: '' }] } as unknown as BlueprintDigest;
  const scored = [{ name: 'a', score: 3 }, { name: 'b', score: 0.1 }];
  assert.deepEqual(withinLeadingSchema(scored, one), scored);
});
