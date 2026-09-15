import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evaluateAdapter } from '../lib/evaluations.ts';
import { executeTool, modelAudit, type AuditResult } from '../lib/agent.ts';
import type { Dataset } from '../lib/audit.ts';
import { isDeepStrictEqual } from 'node:util';
const raw = readFileSync(
  new URL('../data/northern-ca.json', import.meta.url),
  'utf8',
);
const data = JSON.parse(raw) as Dataset;
const snapshotHash = createHash('sha256').update(raw).digest('hex');
const sourceHash = createHash('sha256')
  .update(
    ['agent.ts', 'completion.ts', 'evaluations.ts']
      .map((f) => readFileSync(new URL('../lib/' + f, import.meta.url), 'utf8'))
      .join('\n'),
  )
  .digest('hex');
const path = new URL('../data/agent-evaluations.json', import.meta.url);
const report: {
  recordedAt: string;
  snapshotHash: string;
  sourceHash: string;
  controlled: Awaited<ReturnType<typeof evaluateAdapter>>;
  live: {
    name: string;
    question: string;
    expected: string;
    observed: string;
    pass: boolean;
    model: string;
    recordedAt: string;
    elapsedMs: number;
  }[];
} = {
  recordedAt: new Date().toISOString(),
  snapshotHash,
  sourceHash,
  controlled: await evaluateAdapter(data),
  live: [],
};
writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
if (report.controlled.some((r) => !r.pass))
  throw new Error('Controlled evaluations failed');
if (process.argv.includes('--live')) {
  const config = {
    baseURL: process.env.EQUITY_MODEL_BASE_URL ?? 'http://localhost:11434/v1',
    model: process.env.EQUITY_MODEL_NAME ?? 'llama3.1:8b',
  };
  await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt: 'Ready',
      stream: false,
      keep_alive: '2h',
      options: { num_predict: 1 },
    }),
    signal: AbortSignal.timeout(120000),
  });
  let captured = false;
  for (const question of [
    'Compare rural and urban tracts',
    'Rank the highest gaps and inspect the top tract',
    'Explain missing reference data',
    'Write a song',
  ]) {
    const start = Date.now();
    const result = await modelAudit(data, question, config);
    const pass =
      question === 'Write a song'
        ? result.status === 'unsupported'
        : result.status === 'complete';
    report.live.push({
      name: question,
      question,
      expected:
        question === 'Write a song'
          ? 'Decline without analytical tools.'
          : 'Collect all evidence requirements.',
      observed: `${result.status}; ${result.completion?.checks.filter((c) => c.pass).length ?? 0}/${result.completion?.checks.length ?? 0} evidence requirements; ${result.completionRetries ?? 0} completion retries; ${result.trace.filter((t) => t.error).length} rejected calls.${result.stopReason ? ' ' + result.stopReason : ''}`,
      pass,
      model: config.model,
      recordedAt: result.recordedAt!,
      elapsedMs: Date.now() - start,
    });
    console.log(report.live.at(-1));
    if (
      !captured &&
      result.status === 'complete' &&
      result.mode === 'model' &&
      result.trace.some((t) => !t.automatic && !t.error)
    ) {
      verifyReplay(result);
      writeFileSync(
        new URL('../data/demo-replay.json', import.meta.url),
        JSON.stringify(
          {
            label: 'Recorded local model run',
            recordedAt: result.recordedAt,
            model: config.model,
            snapshotHash,
            sourceHash,
            verification:
              'Every successful tool output was independently re-executed against this snapshot and matched.',
            result,
          },
          null,
          2,
        ) + '\n',
      );
      captured = true;
    }
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  }
  if (!captured)
    throw new Error('No successful live run; no new replay captured.');
}
function verifyReplay(result: AuditResult) {
  for (const t of result.trace)
    if (
      !t.error &&
      !isDeepStrictEqual(executeTool(data, t.tool, t.input), t.output)
    )
      throw new Error('Replay verification failed for ' + t.tool);
}
console.log(
  `${report.controlled.filter((r) => r.pass).length}/${report.controlled.length} controlled cases passed; ${report.live.filter((r) => r.pass).length}/${report.live.length} live cases passed.`,
);
