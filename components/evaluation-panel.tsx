'use client';
import { AuditResults } from '@/components/audit-results';
import type { AuditResult } from '@/lib/agent';
import report from '@/data/agent-evaluations.json';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
export function EvaluationPanel() {
  return (
    <section className="evaluation-panel">
      <h2>Agent behavior evaluations</h2>
      <p>
        Recorded {new Date(report.recordedAt).toLocaleString()}. These results
        evaluate the application’s evidence contract and observed model
        behavior, not official Zindi accuracy.
      </p>
      <div className="eval-totals">
        <div>
          <strong>
            {report.controlled.filter((r) => r.pass).length}/
            {report.controlled.length}
          </strong>
          <span>Controlled adapter cases passed</span>
        </div>
        <div>
          <strong>
            {report.live.filter((r) => r.pass).length}/{report.live.length}
          </strong>
          <span>Live requests met expectations</span>
        </div>
      </div>
      <h3>Controlled adapter tests</h3>
      <p>
        Scripted model responses exercise the real orchestrator and numerical
        tools. The invalid-parameter case deliberately injects a bad call. These
        are regression tests, not measurements of model intelligence.
      </p>
      <EvaluationTable rows={report.controlled} />
      <details className="controlled-trace">
        <summary>Inspect the controlled invalid-parameter recovery</summary>
        <p>
          This case intentionally supplies a wrong enum, then a corrected call.
          It demonstrates the application’s handling, not a spontaneous model
          recovery.
        </p>
        <AuditResults
          audit={
            report.controlled.find(
              (r) => r.name === 'Invalid parameter recovery',
            )!.result as AuditResult
          }
          replay={false}
          controlled
        />
      </details>
      <h3>Live Ollama observations</h3>
      <p>
        Actual local requests. Each supported question was attempted once in
        this batch. Unsupported requests are rejected before inference. A pass
        means the declared requirements were met; it is not a reliability
        guarantee.
      </p>
      <EvaluationTable rows={report.live} />
      {report.live.length > 0 && (
        <p className="run-provenance">
          Model: {report.live[0].model} · Total batch time:{' '}
          {(report.live.reduce((n, r) => n + r.elapsedMs, 0) / 1000).toFixed(1)}{' '}
          seconds
        </p>
      )}
      <details className="eval-provenance">
        <summary>Snapshot and evaluation provenance</summary>
        <p>Snapshot SHA-256</p>
        <code>{report.snapshotHash}</code>
        <p>Agent, completion checker and evaluation source SHA-256</p>
        <code>{report.sourceHash}</code>
        <p>
          Saved results are a dated batch, not tests running in this browser.
          Re-run npm run eval:live after changing the agent or snapshot.
        </p>
      </details>
    </section>
  );
}
function EvaluationTable({
  rows,
}: {
  rows: { name: string; expected: string; observed: string; pass: boolean }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Expected behavior</TableHead>
          <TableHead>Observed behavior</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.name}>
            <TableCell>{r.name}</TableCell>
            <TableCell>{r.expected}</TableCell>
            <TableCell>{r.observed}</TableCell>
            <TableCell>
              <span className={r.pass ? 'result-badge' : 'warning-badge'}>
                {r.pass ? 'Pass' : 'Fail'}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
