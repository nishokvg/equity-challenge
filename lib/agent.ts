import {
  type Dataset,
  type Group,
  type Component,
  rankTracts,
  compareGroups,
  validateDataset,
  calculate,
  pct,
  groups,
  metricLabels,
} from './audit.ts';
import { retrieve } from './knowledge.ts';
export type Trace = {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  elapsedMs: number;
  error?: string;
  automatic?: boolean;
};
export type AuditResult = {
  mode: 'guided' | 'model';
  status: 'complete' | 'unsupported';
  question: string;
  summary: string[];
  trace: Trace[];
  citations: ReturnType<typeof retrieve>;
  selectedIds: string[];
  model?: string;
};
const metricEnum = ['score', 'roads', 'buildings', 'places'];
const groupEnum = ['all', 'rural', 'urban', 'high-svi', 'low-svi'];
export const toolDefinitions = [
  {
    name: 'search_methodology',
    description:
      'Retrieve documentation explaining scoring, source limits or group comparisons.',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  {
    name: 'rank_tracts',
    description:
      'Rank tracts with defined gaps from largest to smallest. Use high-svi to investigate socially vulnerable tracts.',
    properties: {
      metric: { type: 'string', enum: metricEnum },
      group: { type: 'string', enum: groupEnum },
      limit: { type: 'integer', minimum: 1, maximum: 10 },
    },
    required: ['metric', 'group', 'limit'],
  },
  {
    name: 'compare_groups',
    description:
      'Compare unweighted mean coverage gaps. dimension must be exactly rural (rural versus urban) or svi (high versus lower vulnerability). metric must be score, roads, buildings, or places. Unknowns are excluded and counted.',
    properties: {
      dimension: { type: 'string', enum: ['rural', 'svi'] },
      metric: { type: 'string', enum: metricEnum },
    },
    required: ['dimension', 'metric'],
  },
  {
    name: 'inspect_tract',
    description:
      'Inspect one tract: observations, recomputed gaps, and undefined components.',
    properties: { geoid: { type: 'string', pattern: '^\\d{11}$' } },
    required: ['geoid'],
  },
  {
    name: 'validate_dataset',
    description:
      'Run numerical and membership checks and list example tracts with missing reference components.',
    properties: {},
    required: [],
  },
] as const;
export function executeTool(
  data: Dataset,
  name: string,
  args: Record<string, unknown>,
): unknown {
  const definition = toolDefinitions.find((t) => t.name === name);
  if (!definition || !args || typeof args !== 'object' || Array.isArray(args))
    throw new Error('Unknown tool or invalid arguments.');
  const allowed = Object.keys(definition.properties);
  if (
    Object.keys(args).some((k) => !allowed.includes(k)) ||
    definition.required.some((k) => !(k in args))
  )
    throw new Error('Tool arguments do not match its schema.');
  const metric = args.metric as Component,
    group = args.group as Group;
  if ('metric' in args && !metricEnum.includes(metric))
    throw new Error('Unsupported metric.');
  if ('group' in args && !groupEnum.includes(group))
    throw new Error('Unsupported group.');
  if (name === 'search_methodology') {
    if (typeof args.query !== 'string' || args.query.length > 800)
      throw new Error('Invalid retrieval query.');
    return retrieve(args.query);
  }
  if (name === 'rank_tracts') {
    if (
      !Number.isInteger(args.limit) ||
      Number(args.limit) < 1 ||
      Number(args.limit) > 10
    )
      throw new Error('Limit must be between 1 and 10.');
    return {
      metric,
      group,
      rows: rankTracts(data, metric, group, Number(args.limit)).map((t) => ({
        geoid: t.geoid,
        name: t.name,
        gap: t.metrics[metric],
        svi: t.svi,
        defined: t.metrics.defined,
      })),
    };
  }
  if (name === 'compare_groups') {
    if (args.dimension !== 'rural' && args.dimension !== 'svi')
      throw new Error('Unsupported comparison.');
    return compareGroups(data, args.dimension, metric);
  }
  if (name === 'inspect_tract') {
    if (typeof args.geoid !== 'string' || !/^\d{11}$/.test(args.geoid))
      throw new Error('Invalid tract ID.');
    const t = data.tracts.find((t) => t.geoid === args.geoid);
    if (!t)
      throw new Error(
        'Tract is outside the loaded Northern California region.',
      );
    return {
      geoid: t.geoid,
      name: t.name,
      counts: t.counts,
      metrics: calculate(t.counts),
      svi: t.svi,
      rural: t.rural,
    };
  }
  return {
    checks: validateDataset(data),
    missingRoadReference: data.tracts.filter((t) => t.metrics.roads === null)
      .length,
    examples: data.tracts
      .filter((t) => t.metrics.defined < 3)
      .slice(0, 3)
      .map((t) => t.geoid),
  };
}
type Ranked = {
  metric: Component;
  group: Group;
  rows: {
    geoid: string;
    name: string;
    gap: number | null;
    svi: number | null;
    defined: number;
  }[];
};
type Inspected = {
  geoid: string;
  name: string;
  counts: Dataset['tracts'][number]['counts'];
  metrics: ReturnType<typeof calculate>;
  svi: number | null;
  rural: boolean | null;
};
type Validated = {
  checks: ReturnType<typeof validateDataset>;
  missingRoadReference: number;
  examples: string[];
};
type ModelCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};
type ModelMessage = {
  role: string;
  content: string | null;
  tool_calls?: ModelCall[];
  tool_call_id?: string;
};
function finalize(
  data: Dataset,
  question: string,
  mode: 'guided' | 'model',
  trace: Trace[],
  model?: string,
): AuditResult {
  const summary: string[] = [];
  const selectedIds: string[] = [];
  const citations: ReturnType<typeof retrieve> = [];
  for (const t of trace) {
    if (t.error) continue;
    if (t.tool === 'search_methodology')
      for (const doc of t.output as ReturnType<typeof retrieve>)
        if (!citations.some((d) => d.id === doc.id)) citations.push(doc);
    if (t.tool === 'rank_tracts') {
      const out = t.output as Ranked;
      if (!out.rows.length)
        summary.push(
          `No defined ${metricLabels[out.metric as Component].toLowerCase()} values in ${groups[out.group as Group]}.`,
        );
      else {
        const first = out.rows[0];
        summary.push(
          `${first.geoid} has the largest ${metricLabels[out.metric as Component].toLowerCase()} in ${groups[out.group as Group]}: ${pct(first.gap)}. This is a mapping-review candidate, not a confirmed missing service.`,
        );
        selectedIds.push(...out.rows.map((r) => r.geoid));
      }
    }
    if (t.tool === 'compare_groups') {
      const out = t.output as ReturnType<typeof compareGroups>;
      summary.push(
        `${out.left.label}: ${pct(out.left.mean)} mean gap (${out.left.defined} defined tracts). ${out.right.label}: ${pct(out.right.mean)} (${out.right.defined} defined tracts). ${out.ratio === null ? 'The disparity ratio is undefined.' : `Ratio: ${out.ratio.toFixed(2)}×.`} ${out.unknown} tracts have unknown group membership.`,
      );
      if (out.smallGroup)
        summary.push(
          'At least one comparison group has fewer than 10 defined tracts; interpret this comparison cautiously.',
        );
    }
    if (t.tool === 'inspect_tract') {
      const out = t.output as Inspected;
      summary.push(
        `${out.geoid}: composite ${pct(out.metrics.score)}, averaged across ${out.metrics.defined} defined components. Roads ${pct(out.metrics.roads)}; buildings ${pct(out.metrics.buildings)}; places ${pct(out.metrics.places)}.`,
      );
      if (out.metrics.defined < 3)
        summary.push(
          'A missing reference component is excluded from the average. Treating it as zero would understate the measured gap.',
        );
      selectedIds.push(out.geoid);
    }
    if (t.tool === 'validate_dataset') {
      const out = t.output as Validated;
      summary.push(
        `${out.checks.filter((c) => c.pass).length}/${out.checks.length} validation checks pass. ${out.missingRoadReference} tracts have no named-highway reference.`,
      );
    }
  }
  if (!summary.length)
    summary.push(
      'Relevant methodology is listed below. Ask to rank coverage gaps, compare rural/urban or vulnerability groups, or inspect a tract.',
    );
  return {
    mode,
    status: 'complete',
    question,
    summary,
    trace,
    citations,
    selectedIds: [...new Set(selectedIds)],
    model,
  };
}
export function guidedAudit(data: Dataset, question: string): AuditResult {
  const q = question.toLowerCase();
  const trace: Trace[] = [];
  const call = (tool: string, input: Record<string, unknown>) => {
    const start = performance.now();
    const output = executeTool(data, tool, input);
    trace.push({
      tool,
      input,
      output,
      elapsedMs: Math.round(performance.now() - start),
    });
    return output;
  };
  const geoid = q.match(/\b\d{11}\b/)?.[0];
  const supported =
    /gap|coverage|mapping|rural|urban|vulnerab|svi|missing|reference|audit|tract|road|building|place|method|score/.test(
      q,
    );
  if (!supported)
    return {
      mode: 'guided',
      status: 'unsupported',
      question,
      summary: [
        'This guided audit supports mapping gaps, rural/urban or vulnerability comparisons, missing-reference checks, and tract inspection. Choose a suggested investigation or ask about one of these.',
      ],
      trace: [],
      citations: [],
      selectedIds: [],
    };
  call('search_methodology', { query: question + ' coverage gap reference' });
  call('validate_dataset', {});
  const metric: Component = /road/.test(q)
    ? 'roads'
    : /building/.test(q)
      ? 'buildings'
      : /place|poi|facilit/.test(q)
        ? 'places'
        : 'score';
  if (geoid) call('inspect_tract', { geoid });
  else if (/missing|undefined|zero reference/.test(q)) {
    const t = data.tracts.find((t) => t.metrics.defined < 3);
    if (t) call('inspect_tract', { geoid: t.geoid });
  } else if (/compar|rural|urban|disparit/.test(q))
    call('compare_groups', {
      dimension: /svi|vulnerab/.test(q) ? 'svi' : 'rural',
      metric,
    });
  else {
    const out = call('rank_tracts', {
      metric,
      group: /vulnerab|svi/.test(q) ? 'high-svi' : 'all',
      limit: 5,
    }) as Ranked;
    if (out.rows[0]) call('inspect_tract', { geoid: out.rows[0].geoid });
  }
  return finalize(data, question, 'guided', trace);
}
export type ModelConfig = { baseURL: string; model: string; apiKey?: string };
/** OpenAI-compatible tool-calling endpoint, e.g. a local Ollama server. Never chosen by user input. */
export async function modelAudit(
  data: Dataset,
  question: string,
  config: ModelConfig,
  fetcher: typeof fetch = fetch,
): Promise<AuditResult> {
  const trace: Trace[] = [];
  for (const [tool, input] of [
    ['search_methodology', { query: question + ' coverage gap reference' }],
    ['validate_dataset', {}],
  ] as [string, Record<string, unknown>][]) {
    const started = performance.now();
    const output = executeTool(data, tool, input);
    trace.push({
      tool,
      input,
      output,
      elapsedMs: Math.round(performance.now() - started),
      automatic: true,
    });
  }
  const tools = toolDefinitions.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: t.properties,
        required: t.required,
        additionalProperties: false,
      },
    },
  }));
  const messages: ModelMessage[] = [
    {
      role: 'system',
      content:
        'You investigate Northern California mapping coverage. Use only the supplied read-only tools. Required methodology retrieval and validation are already supplied below. Do not repeat these checks unless more context is needed. Choose analytical tools to answer the question and inspect follow-up evidence as needed. Do not invent observations, modify data, call other tools, or submit anything. Stop when the question is answered. You have at most 6 further tool calls. Use exactly the enum values in each tool schema. Do not write a long final answer; stop after enough evidence is collected. Final prose will be generated from verified tool results.',
    },
    {
      role: 'system',
      content:
        'Completed required preflight: ' +
        JSON.stringify(trace.map((t) => ({ tool: t.tool, result: t.output }))),
    },
    { role: 'user', content: question },
  ];
  let stopped = false;
  const deadline = Date.now() + 60000;
  for (let turn = 0; turn < 6 && trace.length < 8; turn++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new Error(
        'The model audit exceeded its time budget. Try the guided audit.',
      );
    const response = await fetcher(
      config.baseURL.replace(/\/$/, '') + '/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(Math.min(20000, remaining)),
      },
    );
    if (!response.ok)
      throw new Error(`Model endpoint returned HTTP ${response.status}.`);
    const body = (await response.json()) as {
      choices?: { message?: ModelMessage }[];
    };
    const message = body.choices?.[0]?.message;
    if (!message)
      throw new Error('The model endpoint returned no assistant message.');
    const calls = message.tool_calls ?? [];
    if (!Array.isArray(calls)) throw new Error('Invalid tool-call response.');
    if (!calls.length) {
      stopped = true;
      break;
    }
    if (calls.length + trace.length > 8)
      throw new Error('The model exceeded the 8-tool budget.');
    messages.push(message);
    for (const c of calls) {
      if (
        c.type !== 'function' ||
        typeof c.function?.arguments !== 'string' ||
        c.function.arguments.length > 4000
      )
        throw new Error('Invalid model tool request.');
      const definition = toolDefinitions.find(
        (t) => t.name === c.function.name,
      );
      if (!definition) throw new Error('Unknown tool requested by model.');
      const start = performance.now();
      let input: Record<string, unknown> = {};
      let output: unknown;
      let error: string | undefined;
      try {
        input = JSON.parse(c.function.arguments);
        output = executeTool(data, c.function.name, input);
      } catch (e) {
        error = e instanceof Error ? e.message : 'Invalid arguments';
        output = {
          error,
          validParameters: definition.properties,
          instruction:
            'Correct the parameters using only the schema values and retry.',
        };
      }
      trace.push({
        tool: c.function.name,
        input,
        output,
        elapsedMs: Math.round(performance.now() - start),
        ...(error ? { error } : {}),
      });
      messages.push({
        role: 'tool',
        tool_call_id: c.id,
        content: JSON.stringify(output),
      });
    }
  }
  if (!stopped)
    throw new Error(
      'The model reached its turn or tool budget before finishing. Try a narrower question.',
    );
  if (!trace.some((t) => !t.automatic && !t.error))
    throw new Error(
      'The model did not run any tools. No evidence-backed answer was produced.',
    );
  if (
    !trace.some((t) => t.tool === 'search_methodology' && !t.error) ||
    !trace.some((t) => t.tool === 'validate_dataset' && !t.error)
  )
    throw new Error(
      'The model skipped required retrieval or validation. Try the guided audit.',
    );
  if (
    !trace.some(
      (t) =>
        !t.error &&
        ['rank_tracts', 'inspect_tract', 'compare_groups'].includes(t.tool),
    )
  )
    throw new Error('The model stopped before running an analytical tool.');
  return finalize(data, question, 'model', trace, config.model);
}
