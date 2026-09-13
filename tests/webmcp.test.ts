import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerAuditTools, type ToolRegistration } from '../lib/webmcp.ts';
import type { AuditResult } from '../lib/agent.ts';
void test('browser tools share audit state, validate input, and unregister', async () => {
  const registry = new Map<string, ToolRegistration>();
  let current: AuditResult | null = null;
  const unregister = registerAuditTools(
    {
      registerTool(tool, options) {
        registry.set(tool.name, tool);
        options?.signal?.addEventListener('abort', () =>
          registry.delete(tool.name),
        );
      },
    },
    async (question) => {
      current = {
        mode: 'guided',
        status: 'complete',
        question,
        summary: ['Verified result'],
        trace: [],
        citations: [],
        selectedIds: [],
      };
      return current;
    },
    () => current,
  );
  assert.deepEqual(
    [...registry.keys()],
    ['run_equity_audit', 'get_equity_audit'],
  );
  await registry
    .get('run_equity_audit')!
    .execute({ question: 'Compare rural tracts' });
  assert.deepEqual(registry.get('get_equity_audit')!.execute({}), {
    mode: 'guided',
    status: 'complete',
    summary: ['Verified result'],
    tools: [],
  });
  await assert.rejects(async () =>
    registry.get('run_equity_audit')!.execute({ question: '', extra: 'bad' }),
  );
  assert.equal(
    (current as AuditResult | null)?.question,
    'Compare rural tracts',
  );
  unregister();
  assert.equal(registry.size, 0);
});
