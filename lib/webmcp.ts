import type { AuditResult } from './agent';
export type ToolRegistration = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export type ModelContext = {
  registerTool: (
    tool: ToolRegistration,
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};
export function registerAuditTools(
  context: ModelContext,
  run: (question: string) => Promise<AuditResult | null>,
  read: () => AuditResult | null,
) {
  const lifecycle = new AbortController();
  const tools: ToolRegistration[] = [
    {
      name: 'run_equity_audit',
      title: 'Run mapping equity audit',
      description:
        'Run an investigation on the Northern California snapshot and display evidence and tool results. Does not submit or publish anything.',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string', minLength: 1, maxLength: 800 },
        },
        required: ['question'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input) => {
        if (
          !input ||
          typeof input !== 'object' ||
          Array.isArray(input) ||
          Object.keys(input).some((k) => k !== 'question')
        )
          throw new Error('Expected only a question.');
        const q = (input as { question?: unknown }).question;
        if (typeof q !== 'string' || !q.trim() || q.length > 800)
          throw new Error('Question must have 1–800 characters.');
        const result = await run(q);
        if (!result)
          throw new Error(
            'Audit did not complete. Inspect the visible error or wait for the current audit.',
          );
        return {
          mode: result.mode,
          status: result.status,
          summary: result.summary,
          selectedIds: result.selectedIds,
          tools: result.trace.map((t) => t.tool),
        };
      },
    },
    {
      name: 'get_equity_audit',
      title: 'Read current mapping audit',
      description:
        'Read the evidence-backed audit currently shown in the workspace.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        if (
          !input ||
          typeof input !== 'object' ||
          Array.isArray(input) ||
          Object.keys(input).length
        )
          throw new Error('No arguments expected.');
        const r = read();
        return r
          ? {
              mode: r.mode,
              status: r.status,
              summary: r.summary,
              tools: r.trace.map((t) => t.tool),
            }
          : { status: 'not_run' };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional browser API; normal UI remains available. */
    }
  }
  return () => lifecycle.abort();
}
