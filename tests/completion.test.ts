import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateAdapter, scriptedModel } from '../lib/evaluations.ts';
import { modelAudit, executeTool, guidedAudit } from '../lib/agent.ts';
import { assessCompletion, requestRequirements } from '../lib/completion.ts';
import type { Dataset } from '../lib/audit.ts';
const data = JSON.parse(
  readFileSync(new URL('../data/northern-ca.json', import.meta.url), 'utf8'),
) as Dataset;
void test('controlled completion and recovery regression cases', async () => {
  for (const row of await evaluateAdapter(data))
    assert.ok(row.pass, `${row.name}: ${row.observed}`);
});
void test('transport failure preserves already collected evidence as partial', async () => {
  let calls = 0;
  const first = scriptedModel([
    [['rank_tracts', { metric: 'score', group: 'all', limit: 5 }]],
  ]);
  const fetcher: typeof fetch = async (...args) => {
    if (calls++) throw new Error('Connection lost');
    return first(...args);
  };
  const r = await modelAudit(
    data,
    'Rank the highest gaps and inspect the top tract',
    { baseURL: 'http://test', model: 'fixture' },
    fetcher,
  );
  assert.equal(r.status, 'partial');
  assert.ok(r.selectedIds.length);
  assert.match(r.stopReason!, /Connection lost/);
});
void test('wrong rank group and quantity do not satisfy evidence contract', () => {
  const input = { metric: 'score', group: 'urban', limit: 3 };
  const c = assessCompletion('Rank the top 5 rural tracts', [
    {
      tool: 'rank_tracts',
      input,
      output: executeTool(data, 'rank_tracts', input),
      elapsedMs: 0,
    },
  ]);
  assert.equal(c.checks[0].pass, false);
});
void test('unsupported model questions never call model endpoint', async () => {
  const r = await modelAudit(
    data,
    'Write a song',
    { baseURL: 'http://test', model: 'fixture' },
    async () => {
      throw new Error('Must not call model');
    },
  );
  assert.equal(r.status, 'unsupported');
  assert.equal(r.trace.length, 0);
});
void test('completion retry stays within two requests when model repeatedly stops', async () => {
  let n = 0;
  const r = await modelAudit(
    data,
    'Rank gaps',
    { baseURL: 'http://test', model: 'fixture' },
    async () => {
      n++;
      return Response.json({
        choices: [{ message: { role: 'assistant', content: 'done' } }],
      });
    },
  );
  assert.equal(n, 2);
  assert.equal(r.status, 'partial');
  assert.equal(r.completionRetries, 1);
});

void test('biggest ranks buildings in both execution modes', async () => {
  const question = 'Biggest building gaps';
  const args = { metric: 'buildings', group: 'all', limit: 5 };
  const results = [
    guidedAudit(data, question),
    await modelAudit(
      data,
      question,
      { baseURL: 'http://test', model: 'fixture' },
      scriptedModel([[['rank_tracts', args]], []]),
    ),
  ];
  for (const r of results) {
    assert.equal(r.status, 'complete');
    const ranking = r.trace.find((t) => t.tool === 'rank_tracts')!;
    assert.deepEqual(ranking.input, args);
    assert.deepEqual(ranking.output, executeTool(data, 'rank_tracts', args));
    assert.match(r.summary.join(' '), /largest building gap/);
  }
});
void test('biggest preserves count, group and required follow-up', () => {
  const r = guidedAudit(
    data,
    'Show the biggest 3 rural building gaps and inspect the top tract',
  );
  assert.equal(r.status, 'complete');
  assert.deepEqual(r.trace.find((t) => t.tool === 'rank_tracts')?.input, {
    metric: 'buildings',
    group: 'rural',
    limit: 3,
  });
  assert.equal(r.completion?.checks.length, 2);
  assert.ok(r.completion?.checks.every((c) => c.pass));
  assert.deepEqual(requestRequirements('Biggest 11 building gaps'), []);
  assert.deepEqual(requestRequirements('Biggest road and building gaps'), []);
});
void test('unavailable explicit IDs decline before model or tools in both modes', async () => {
  const available = data.tracts[0].geoid;
  for (const question of [
    'Inspect tract 36061000100',
    'Inspect tract 06999999999',
    `Inspect ${available} and 36061000100`,
    'Biggest building gaps and inspect 36061000100',
  ]) {
    const results = [
      guidedAudit(data, question),
      await modelAudit(
        data,
        question,
        { baseURL: 'http://test', model: 'fixture' },
        async () => {
          assert.fail('Out-of-scope request must not invoke the model');
        },
      ),
    ];
    for (const r of results) {
      assert.equal(r.status, 'unsupported');
      assert.equal(r.completion?.supported, false);
      assert.deepEqual(r.completion?.checks, []);
      assert.deepEqual(r.trace, []);
      assert.deepEqual(r.selectedIds, []);
      assert.match(
        r.summary.join(' '),
        /Out of scope:.*Northern California snapshot/,
      );
      assert.match(r.summary.join(' '), /not available in this snapshot/);
    }
  }
});
void test('available explicit tract still completes inspection', async () => {
  const geoid = data.tracts[0].geoid;
  const question = `Inspect tract ${geoid}`;
  for (const r of [
    guidedAudit(data, question),
    await modelAudit(
      data,
      question,
      { baseURL: 'http://test', model: 'fixture' },
      scriptedModel([[['inspect_tract', { geoid }]], []]),
    ),
  ]) {
    assert.equal(r.status, 'complete');
    assert.deepEqual(r.selectedIds, [geoid]);
  }
});
void test('model-generated unavailable ID still receives tool feedback and can recover', async () => {
  const geoid = data.tracts[0].geoid;
  const r = await modelAudit(
    data,
    `Inspect tract ${geoid}`,
    { baseURL: 'http://test', model: 'fixture' },
    scriptedModel([
      [['inspect_tract', { geoid: '36061000100' }]],
      [['inspect_tract', { geoid }]],
      [],
    ]),
  );
  assert.equal(r.status, 'complete');
  assert.equal(r.trace.filter((t) => t.error).length, 1);
  assert.deepEqual(r.selectedIds, [geoid]);
});
