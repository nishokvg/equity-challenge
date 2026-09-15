import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { executeTool } from '../lib/agent.ts';
import { assessCompletion } from '../lib/completion.ts';
void test('saved model replay matches its snapshot and every successful tool output', () => {
  const raw = readFileSync(
    new URL('../data/northern-ca.json', import.meta.url),
    'utf8',
  );
  const data = JSON.parse(raw);
  const replay = JSON.parse(
    readFileSync(new URL('../data/demo-replay.json', import.meta.url), 'utf8'),
  );
  assert.equal(
    replay.snapshotHash,
    createHash('sha256').update(raw).digest('hex'),
  );
  assert.equal(replay.result.mode, 'model');
  assert.equal(replay.result.status, 'complete');
  assert.equal(replay.model, replay.result.model);
  assert.ok(Number.isFinite(Date.parse(replay.recordedAt)));
  assert.ok(
    assessCompletion(replay.result.question, replay.result.trace).checks.every(
      (c) => c.pass,
    ),
  );
  for (const t of replay.result.trace)
    if (!t.error)
      assert.deepEqual(executeTool(data, t.tool, t.input), t.output);
});
void test('evaluation artifact and replay record the current evaluator source', () => {
  const hash = createHash('sha256')
    .update(
      [
        'agent.ts',
        'audit.ts',
        'knowledge.ts',
        'completion.ts',
        'evaluations.ts',
      ]
        .map((f) =>
          readFileSync(new URL('../lib/' + f, import.meta.url), 'utf8'),
        )
        .join('\n'),
    )
    .digest('hex');
  for (const f of ['agent-evaluations.json', 'demo-replay.json'])
    assert.equal(
      JSON.parse(readFileSync(new URL('../data/' + f, import.meta.url), 'utf8'))
        .sourceHash,
      hash,
    );
});
