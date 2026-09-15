import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculate,
  gap,
  compareGroups,
  regionalCSV,
  validateDataset,
  type Counts,
  type Dataset,
} from '../lib/audit.ts';
const counts: Counts = {
  roads: [0, 0],
  buildings: [40, 100],
  fire: [0, 2],
  ems: [0, 0],
  schools: [4, 4],
  establishments: [50, 100],
};
void test('missing roads are excluded rather than treated as zero gap', () => {
  const m = calculate(counts);
  assert.equal(m.roads, null);
  assert.equal(m.places, 0.5);
  assert.equal(m.score, 0.55);
  assert.equal(m.defined, 2);
});
void test('missing place half is excluded; fully undefined tract is not fabricated', () => {
  const m = calculate({ ...counts, fire: [0, 0], schools: [0, 0] });
  assert.equal(m.facilities, null);
  assert.equal(m.places, 0.5);
  assert.equal(
    calculate(
      Object.fromEntries(Object.keys(counts).map((k) => [k, [0, 0]])) as Counts,
    ).score,
    null,
  );
});
void test('overcoverage is capped; invalid observations throw', () => {
  assert.equal(gap([20, 10]), 0);
  assert.throws(() => gap([-1, 10]));
  assert.throws(() => gap([NaN, 10]));
  assert.throws(() => gap([1, Infinity]));
});
function fixture(): Dataset {
  return {
    meta: {
      region: 'test',
      release: 'test',
      generated: 'test',
      method: 'test',
      sources: [],
      bbox: [],
      notes: [],
    },
    sampleIds: ['06001000100'],
    tracts: [
      {
        geoid: '06001000100',
        name: 'test',
        county: 'test',
        path: '',
        counts,
        metrics: calculate(counts),
        svi: null,
        rural: null,
        population: null,
      },
    ],
  };
}
void test('unknown group membership remains unknown and ratio undefined', () => {
  const c = compareGroups(fixture(), 'rural');
  assert.equal(c.unknown, 1);
  assert.equal(c.ratio, null);
  assert.equal(c.left.n, 0);
});
void test('export preserves ID and rejects missing, duplicate, or invalid rows', () => {
  const d = fixture();
  assert.match(regionalCSV(d), /06001000100,0.55/);
  d.tracts.push({ ...d.tracts[0] });
  assert.throws(() => regionalCSV(d));
});
void test('inconsistent score is detected independently of valid bounds', () => {
  const d = fixture();
  d.tracts[0].metrics.score = 0.2;
  assert.equal(
    validateDataset(d).find((v) => v.name === 'Formula consistency')?.pass,
    false,
  );
  assert.throws(() => regionalCSV(d));
});
