import { modelAudit, type AuditResult } from './agent.ts';
import { type Dataset, rankTracts } from './audit.ts';
export type EvalRow = {
  name: string;
  expected: string;
  observed: string;
  pass: boolean;
  question: string;
  result: AuditResult;
};
type Call = [string, Record<string, unknown> | string];
export function scriptedModel(sequence: Call[][]): typeof fetch {
  let turn = 0;
  return async () =>
    Response.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: (sequence[turn++] ?? []).map(([name, args], i) => ({
              id: `t${turn}-${i}`,
              type: 'function',
              function: {
                name,
                arguments:
                  typeof args === 'string' ? args : JSON.stringify(args),
              },
            })),
          },
        },
      ],
    });
}
export async function evaluateAdapter(data: Dataset): Promise<EvalRow[]> {
  const top = rankTracts(data, 'score', 'all', 5)[0].geoid;
  const missing = data.tracts.find((t) => t.metrics.defined < 3)!.geoid;
  const rank: Call = [
    'rank_tracts',
    { metric: 'score', group: 'all', limit: 5 },
  ];
  const inspect: Call = ['inspect_tract', { geoid: top }];
  const comparison: Call = [
    'compare_groups',
    { dimension: 'rural', metric: 'score' },
  ];
  const cases: {
    name: string;
    question: string;
    expected: string;
    sequence: Call[][];
    check: (r: AuditResult) => boolean;
  }[] = [
    {
      name: 'Group comparison',
      question: 'Compare rural and urban tracts',
      expected: 'Complete only after the requested group comparison.',
      sequence: [[comparison], []],
      check: (r) => r.status === 'complete',
    },
    {
      name: 'Ranking and inspection',
      question: 'Rank the highest gaps and inspect the top tract',
      expected:
        'A premature stop triggers one retry; the top tract is then inspected.',
      sequence: [[rank], [], [inspect], []],
      check: (r) =>
        r.status === 'complete' &&
        r.completionRetries === 1 &&
        r.completion?.checks.length === 2,
    },
    {
      name: 'Missing references',
      question: 'Explain missing reference data',
      expected:
        'Inspect an actual undefined component without replacing it with zero.',
      sequence: [[['inspect_tract', { geoid: missing }]], []],
      check: (r) =>
        r.status === 'complete' &&
        r.summary.some((s) => s.includes('excluded')),
    },
    {
      name: 'Invalid parameter recovery',
      question: 'Compare rural and urban tracts',
      expected:
        'Reject an invalid enum, retain the rejection, accept the corrected call.',
      sequence: [
        [['compare_groups', { dimension: 'rural_vs_urban', metric: 'score' }]],
        [comparison],
        [],
      ],
      check: (r) =>
        r.status === 'complete' &&
        r.trace.filter((t) => t.error).length === 1 &&
        r.summary.filter((s) => s.includes('Ratio:')).length === 1,
    },
    {
      name: 'Malformed JSON recovery',
      question: 'Compare rural and urban tracts',
      expected:
        'Preserve malformed argument text exactly, reject it, and accept a corrected call.',
      sequence: [
        [
          [
            'compare_groups',
            '{\n  "dimension": "rural", "metric": <invalid>\n}',
          ],
        ],
        [comparison],
        [],
      ],
      check: (r) =>
        r.status === 'complete' &&
        r.trace.some(
          (t) =>
            !!t.error &&
            t.rawArguments ===
              '{\n  "dimension": "rural", "metric": <invalid>\n}',
        ) &&
        r.summary.filter((s) => s.includes('Ratio:')).length === 1,
    },
    {
      name: 'Unsupported request',
      question: 'Write a song',
      expected: 'Decline without invoking the model or analytical tools.',
      sequence: [],
      check: (r) => r.status === 'unsupported' && r.trace.length === 0,
    },
    {
      name: 'Unfinished follow-up',
      question: 'Rank the highest gaps and inspect the top tract',
      expected:
        'Preserve the ranking as Partial after one unsuccessful completion retry.',
      sequence: [[rank], [], []],
      check: (r) =>
        r.status === 'partial' &&
        r.completionRetries === 1 &&
        r.selectedIds.length > 0 &&
        r.completion?.checks.some((c) => !c.pass) === true,
    },
    {
      name: 'Wrong tract inspection',
      question: 'Rank the highest gaps and inspect the top tract',
      expected:
        'Inspecting a different tract does not satisfy the top-tract requirement.',
      sequence: [
        [
          rank,
          [
            'inspect_tract',
            { geoid: data.tracts.find((t) => t.geoid !== top)!.geoid },
          ],
        ],
        [],
        [],
      ],
      check: (r) =>
        r.status === 'partial' &&
        r.completion?.checks.find((c) => c.id === 'inspect-top')?.pass ===
          false,
    },
    {
      name: 'Wrong comparison metric',
      question: 'Compare rural and urban road gaps',
      expected: 'A composite comparison cannot satisfy a road-gap question.',
      sequence: [[comparison], [], []],
      check: (r) => r.status === 'partial',
    },
  ];
  const rows: EvalRow[] = [];
  for (const c of cases) {
    const r = await modelAudit(
      data,
      c.question,
      { baseURL: 'http://controlled.invalid/v1', model: 'controlled fixture' },
      scriptedModel(c.sequence),
    );
    rows.push({
      name: c.name,
      question: c.question,
      expected: c.expected,
      observed: `${r.status}; ${r.completion?.checks.filter((x) => x.pass).length ?? 0}/${r.completion?.checks.length ?? 0} evidence requirements; ${r.completionRetries ?? 0} completion retries; ${r.trace.filter((t) => t.error).length} rejected calls.`,
      pass: c.check(r),
      result: r,
    });
  }
  return rows;
}
