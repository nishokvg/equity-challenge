import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modelAudit } from '../lib/agent.ts';
import {
  calculate,
  validateDataset,
  type Dataset,
  type Counts,
} from '../lib/audit.ts';
const data = JSON.parse(
  readFileSync(new URL('../data/northern-ca.json', import.meta.url), 'utf8'),
) as Dataset;

void test('malformed model JSON is preserved exactly through rejection and correction', async () => {
  const raw = '{\n  "dimension": "rural",\n  "metric": <invalid>\n}';
  let turn = 0;
  const result = await modelAudit(
    data,
    'Compare rural and urban tracts',
    { baseURL: 'http://fixture', model: 'fixture' },
    async () => {
      const args = [raw, '{ "dimension": "rural", "metric": "score" }'][turn++];
      return Response.json({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls:
                args === undefined
                  ? []
                  : [
                      {
                        id: String(turn),
                        type: 'function',
                        function: { name: 'compare_groups', arguments: args },
                      },
                    ],
            },
          },
        ],
      });
    },
  );
  assert.equal(result.status, 'complete');
  const rejected = result.trace.find((t) => t.error)!;
  assert.equal(
    (rejected as unknown as { rawArguments: string }).rawArguments,
    raw,
  );
  assert.equal(JSON.parse(JSON.stringify(rejected)).rawArguments, raw);
  assert.equal(result.trace.at(-1)?.input.metric, 'score');
  assert.equal(result.summary.filter((s) => s.includes('Ratio:')).length, 1);
});

function datasetWith(counts: Counts): Dataset {
  const base = structuredClone(data);
  base.tracts = [{ ...base.tracts[0], counts, metrics: calculate(counts) }];
  base.sampleIds = [base.tracts[0].geoid];
  return base;
}
const counts: Counts = {
  roads: [1, 2],
  buildings: [1, 2],
  fire: [0, 0],
  ems: [0, 0],
  schools: [0, 0],
  establishments: [0, 0],
};
const missingCheck = (d: Dataset) =>
  validateDataset(d).find((c) => c.name === 'Missing reference handling')!.pass;
void test('missing places cannot be represented as zero gap', () => {
  const d = datasetWith(counts);
  assert.equal(missingCheck(d), true);
  d.tracts[0].metrics.places = 0;
  assert.equal(missingCheck(d), false);
});
void test('available places and each available half cannot be marked missing', () => {
  for (const key of ['fire', 'ems', 'schools', 'establishments'] as const) {
    const d = datasetWith({ ...counts, [key]: [1, 2] });
    assert.equal(missingCheck(d), true, key);
    d.tracts[0].metrics.places = null;
    assert.equal(missingCheck(d), false, key);
  }
});
void test('missing facility or establishment half stays undefined', () => {
  for (const field of ['facilities', 'establishments'] as const) {
    const d = datasetWith(counts);
    d.tracts[0].metrics[field] = 0;
    assert.equal(missingCheck(d), false, field);
  }
});
void test('formula consistency explicitly limits its claim to shared counts', () => {
  const c = validateDataset(data).find((c) => c.name === 'Formula consistency');
  assert.ok(c?.pass);
  assert.match(c.detail, /same.*counts/i);
  assert.match(c.detail, /does not validate.*geographic/i);
});
