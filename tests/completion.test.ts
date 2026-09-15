import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateAdapter, scriptedModel } from '../lib/evaluations.ts';
import { modelAudit, executeTool } from '../lib/agent.ts';
import { assessCompletion } from '../lib/completion.ts';
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
