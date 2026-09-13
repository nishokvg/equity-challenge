import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { type Dataset, validateDataset, regionalCSV } from '../lib/audit.ts';
import { executeTool, guidedAudit, modelAudit } from '../lib/agent.ts';
import { retrieve } from '../lib/knowledge.ts';
const data = JSON.parse(
  readFileSync(new URL('../data/northern-ca.json', import.meta.url), 'utf8'),
) as Dataset;
void test('all 591 real tracts pass independent numerical validation', () => {
  assert.equal(data.tracts.length, 591);
  assert.ok(validateDataset(data).every((c) => c.pass));
  assert.equal(regionalCSV(data).trim().split('\n').length, 592);
});
void test('retrieval returns supporting source metadata and no unrelated result', () => {
  assert.ok(retrieve('undefined reference')[0].text.includes('undefined'));
  assert.deepEqual(retrieve('zyxwvu'), []);
});
void test('guided audit executes an actual group comparison with trace', () => {
  const result = guidedAudit(data, 'Compare rural and urban tracts');
  assert.equal(result.mode, 'guided');
  assert.deepEqual(
    result.trace.map((t) => t.tool),
    ['search_methodology', 'validate_dataset', 'compare_groups'],
  );
  assert.ok(result.summary.some((s) => s.includes('156 defined tracts')));
});
void test('missing-reference audit inspects an actual undefined component', () => {
  const r = guidedAudit(data, 'Explain missing references');
  assert.ok(r.trace.some((t) => t.tool === 'inspect_tract'));
  assert.ok(r.summary.some((s) => s.includes('excluded')));
});
void test('unsupported questions do not invent an analysis', () => {
  const r = guidedAudit(data, 'Write a song');
  assert.equal(r.status, 'unsupported');
  assert.equal(r.trace.length, 0);
});
void test('tool boundary rejects unknown tools, bad enums, unexpected keys and invalid IDs', () => {
  for (const [name, args] of [
    ['exec', { command: 'rm -rf' }],
    ['rank_tracts', { metric: 'secret', group: 'all', limit: 5 }],
    ['rank_tracts', { metric: 'score', group: 'all', limit: 500 }],
    ['validate_dataset', { execute: 'anything' }],
    ['inspect_tract', { geoid: '123' }],
    ['inspect_tract', { geoid: '99999999999' }],
  ] as [string, Record<string, unknown>][])
    assert.throws(() => executeTool(data, name, args));
});
void test('model adapter executes selected tools and ignores ungrounded prose', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () =>
    Response.json({
      choices: [
        {
          message:
            calls++ === 0
              ? {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: '1',
                      type: 'function',
                      function: {
                        name: 'search_methodology',
                        arguments: '{"query":"coverage gap"}',
                      },
                    },
                    {
                      id: '2',
                      type: 'function',
                      function: { name: 'validate_dataset', arguments: '{}' },
                    },
                    {
                      id: '3',
                      type: 'function',
                      function: {
                        name: 'compare_groups',
                        arguments: '{"dimension":"rural","metric":"score"}',
                      },
                    },
                  ],
                }
              : {
                  role: 'assistant',
                  content: 'There is definitely a 99% gap everywhere.',
                },
        },
      ],
    });
  const r = await modelAudit(
    data,
    'Compare rural and urban tracts',
    { baseURL: 'http://local.test/v1', model: 'test' },
    fetcher,
  );
  assert.equal(r.mode, 'model');
  assert.equal(r.trace.length, 5);
  assert.ok(!r.summary.join(' ').includes('99%'));
});
void test('model cannot request an arbitrary tool', async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'x',
                type: 'function',
                function: { name: 'send_email', arguments: '{}' },
              },
            ],
          },
        },
      ],
    });
  await assert.rejects(
    modelAudit(
      data,
      'Email the results',
      { baseURL: 'http://local.test/v1', model: 'test' },
      fetcher,
    ),
    /Unknown tool/,
  );
});
void test('model refusal or skipped evidence is not disguised as successful autonomy', async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({
      choices: [{ message: { role: 'assistant', content: 'Trust me.' } }],
    });
  await assert.rejects(
    modelAudit(
      data,
      'Rank gaps',
      { baseURL: 'http://local.test/v1', model: 'test' },
      fetcher,
    ),
    /did not run any tools/,
  );
});
void test('model corrects a rejected parameter without turning its failed call into a finding', async () => {
  let turn = 0;
  const call = (id: string, name: string, args: unknown) => ({
    id,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  });
  const fetcher: typeof fetch = async () => {
    const sequence = [
      [
        call('1', 'search_methodology', { query: 'rural gap' }),
        call('2', 'validate_dataset', {}),
        call('3', 'compare_groups', {
          dimension: 'rural_vs_urban',
          metric: 'score',
        }),
      ],
      [call('4', 'compare_groups', { dimension: 'rural', metric: 'score' })],
      [],
    ];
    return Response.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: sequence[turn++],
          },
        },
      ],
    });
  };
  const r = await modelAudit(
    data,
    'Compare rural and urban tracts',
    { baseURL: 'http://local.test/v1', model: 'test' },
    fetcher,
  );
  assert.equal(r.trace.filter((t) => t.error).length, 1);
  assert.equal(r.summary.filter((s) => s.includes('Ratio:')).length, 1);
});
