'use client';
import { AlertTriangle, Check, BookOpen, ArrowUpRight } from 'lucide-react';
import type { AuditResult } from '@/lib/agent';
export function AuditResults({
  audit,
  replay,
  controlled = false,
}: {
  audit: AuditResult;
  replay: boolean;
  controlled?: boolean;
}) {
  return (
    <section
      className="audit-result"
      aria-live="polite"
      aria-label="Investigation result"
    >
      <div className="result-heading">
        <span
          className={
            audit.status === 'complete' ? 'result-badge' : 'warning-badge'
          }
        >
          {audit.status === 'complete' ? (
            <Check size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          {audit.status === 'complete'
            ? 'Audit complete'
            : audit.status === 'partial'
              ? 'Partial investigation'
              : 'Question outside scope'}
        </span>
        <span>
          {audit.trace.length} tool calls ·{' '}
          {controlled
            ? 'Controlled test — no live model'
            : replay
              ? 'Recorded replay'
              : audit.mode === 'model'
                ? 'Live local model'
                : 'Guided workflow'}
        </span>
      </div>
      {audit.model && (
        <p className="run-provenance">
          {audit.model} ·{' '}
          {audit.recordedAt
            ? new Date(audit.recordedAt).toLocaleString()
            : 'Timestamp unavailable'}
        </p>
      )}
      {replay && (
        <p className="notice warning">
          Recorded run. No model is running now. Tool outputs were re-executed
          and matched against the same snapshot before this replay was saved.
        </p>
      )}
      {audit.stopReason && (
        <p className="notice warning">
          {audit.stopReason} Collected evidence remains below.
        </p>
      )}
      {audit.completion?.supported && (
        <div className="completion-checks">
          <h3>Did we answer the question?</h3>
          <ul>
            {audit.completion.checks.map((c) => (
              <li
                key={c.id}
                className={c.pass ? 'check-pass' : 'check-missing'}
              >
                {c.pass ? <Check size={17} /> : <AlertTriangle size={17} />}
                <span>
                  <strong>{c.pass ? 'Done' : 'Missing'}</strong> — {c.label}
                  {!c.pass && <small>{c.detail}</small>}
                </span>
              </li>
            ))}
          </ul>
          {!!audit.completionRetries && (
            <p>Completion check requested one follow-up from the model.</p>
          )}
          <details>
            <summary>What this check covers</summary>
            <p>{audit.completion.scope}</p>
          </details>
        </div>
      )}
      {audit.summary.map((s, i) => (
        <p key={i}>{s}</p>
      ))}
      {!!audit.trace.length && (
        <div className="trace">
          <h3>Tool decisions and evidence</h3>
          {audit.trace.map((t, i) => {
            const previousRejection = !t.error
              ? audit.trace
                  .slice(0, i)
                  .findLastIndex((p) => p.tool === t.tool && !!p.error)
              : -1;
            const correctedAt = t.error
              ? audit.trace.findIndex(
                  (p, j) => j > i && p.tool === t.tool && !p.error,
                )
              : -1;
            return (
              <details
                key={`${audit.recordedAt}-${i}`}
                open={!t.automatic}
                className={t.error ? 'trace-rejected' : ''}
              >
                <summary>
                  <span className="trace-number">{i + 1}</span>
                  <code>{t.tool}</code>
                  <span className="trace-origin">
                    {t.automatic
                      ? 'Required check'
                      : controlled
                        ? 'Scripted test call'
                        : audit.mode === 'model'
                          ? 'Model selected'
                          : 'Guided step'}
                  </span>
                </summary>
                <div className="trace-detail">
                  <p>
                    {t.error
                      ? `Rejected: ${t.error}`
                      : previousRejection >= 0
                        ? `Succeeded after rejected call ${previousRejection + 1}.`
                        : 'Succeeded.'}{' '}
                    {correctedAt >= 0 &&
                      `Corrected in call ${correctedAt + 1}.`}{' '}
                    <span>{t.elapsedMs} ms tool execution</span>
                  </p>
                  <code className="trace-input">{JSON.stringify(t.input)}</code>
                  {t.error && correctedAt >= 0 && (
                    <div className="recovery-pair">
                      <span>Rejected input</span>
                      <code>{JSON.stringify(t.input)}</code>
                      <span>Corrected input</span>
                      <code>
                        {JSON.stringify(audit.trace[correctedAt].input)}
                      </code>
                    </div>
                  )}
                  <details>
                    <summary>View returned evidence</summary>
                    <pre>{JSON.stringify(t.output, null, 2)}</pre>
                  </details>
                </div>
              </details>
            );
          })}
        </div>
      )}
      {!!audit.citations.length && (
        <div className="citations">
          <h3>Retrieved methodology</h3>
          {audit.citations.map((c) => (
            <a key={c.id} href={c.url} target="_blank" rel="noreferrer">
              <BookOpen size={16} />
              {c.title}
              <ArrowUpRight size={16} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
