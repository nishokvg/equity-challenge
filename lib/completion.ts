import type { Component, Group } from './audit.ts';
import type { Trace } from './agent.ts';

export type Requirement = {
  id: string;
  label: string;
  tool: string;
  args?: Record<string, unknown>;
  target?: 'top-ranked' | 'missing-reference';
};
export type Completion = {
  supported: boolean;
  scope: string;
  checks: { id: string; label: string; pass: boolean; detail: string }[];
};
const scope =
  'Checks cover ranking, rural/urban or SVI comparisons, explicit tract inspection, missing references, and methodology. They do not establish causal explanations.';

/** A conservative contract for supported analytical intents, not a general language judge. */
export function requestRequirements(question: string): Requirement[] {
  const q = question.toLowerCase();
  if (
    /\b(email|send|submit|publish|delete|write a song|forecast|predict|cause|caused|causes|causal|lowest|smallest|bottom)\b/.test(
      q,
    )
  )
    return [];
  const metric: Component = /road/.test(q)
    ? 'roads'
    : /building/.test(q)
      ? 'buildings'
      : /place|poi|facilit/.test(q)
        ? 'places'
        : 'score';
  // Multiple metrics require a richer contract. Decline rather than silently omit one.
  if (
    [/road/.test(q), /building/.test(q), /place|poi|facilit/.test(q)].filter(
      Boolean,
    ).length > 1
  )
    return [];
  const req: Requirement[] = [];
  const ranking = /rank|largest|highest|\btop\b/.test(q);
  const compare =
    /compar|versus|\bvs\b|disparit/.test(q) ||
    (/rural/.test(q) && /urban/.test(q));
  if (compare) {
    const dimensions = [
      ...(/rural|urban/.test(q) ? ['rural'] : []),
      ...(/svi|vulnerab/.test(q) ? ['svi'] : []),
    ];
    if (!dimensions.length) return [];
    for (const dimension of dimensions)
      req.push({
        id: 'compare-' + dimension,
        label: `Compare ${dimension === 'rural' ? 'rural and urban' : 'SVI'} groups using ${metric}`,
        tool: 'compare_groups',
        args: { dimension, metric },
      });
  }
  if (ranking) {
    const group: Group = compare
      ? 'all'
      : /low.*(?:svi|vulnerab)/.test(q)
        ? 'low-svi'
        : /svi|vulnerab/.test(q)
          ? 'high-svi'
          : /rural/.test(q)
            ? 'rural'
            : /urban/.test(q)
              ? 'urban'
              : 'all';
    const limit = Number(
      q.match(/(?:top|rank|highest|largest)\s+(\d+)\b/)?.[1] ?? 5,
    );
    if (limit < 1 || limit > 10) return [];
    req.push({
      id: 'rank',
      label: `Rank the top ${limit} ${group} tracts by ${metric}`,
      tool: 'rank_tracts',
      args: { metric, group, limit },
    });
  }
  const ids = [...new Set(q.match(/\b\d{11}\b/g) ?? [])];
  for (const geoid of ids)
    req.push({
      id: 'inspect-' + geoid,
      label: `Inspect tract ${geoid}`,
      tool: 'inspect_tract',
      args: { geoid },
    });
  if (
    ranking &&
    /inspect|explain|examine|detail|investigate/.test(q) &&
    !ids.length
  ) {
    req.push({
      id: 'inspect-top',
      label: 'Inspect the first tract from the requested ranking',
      tool: 'inspect_tract',
      target: 'top-ranked',
    });
  }
  if (/missing|undefined|zero reference/.test(q))
    req.push({
      id: 'missing-reference',
      label: 'Inspect evidence with an undefined reference component',
      tool: 'inspect_tract',
      target: 'missing-reference',
    });
  if (!req.length && /method|formula|definition/.test(q))
    req.push({
      id: 'methodology',
      label: 'Retrieve source-linked methodology',
      tool: 'search_methodology',
    });
  return req;
}

function matches(t: Trace, r: Requirement) {
  return (
    !t.error &&
    t.tool === r.tool &&
    Object.entries(r.args ?? {}).every(([key, value]) => t.input[key] === value)
  );
}
export function assessCompletion(question: string, trace: Trace[]): Completion {
  const requirements = requestRequirements(question);
  const rankRequirement = requirements.find((r) => r.id === 'rank');
  const ranking =
    rankRequirement && trace.find((t) => matches(t, rankRequirement));
  const topId = (ranking?.output as { rows?: { geoid: string }[] } | undefined)
    ?.rows?.[0]?.geoid;
  return {
    supported: requirements.length > 0,
    scope,
    checks: requirements.map((r) => {
      const passed = trace.some((t) => {
        if (!matches(t, r)) return false;
        if (r.target === 'top-ranked')
          return !!topId && t.input.geoid === topId;
        if (r.target === 'missing-reference') {
          const n = (t.output as { metrics?: { defined: number } })?.metrics
            ?.defined;
          return typeof n === 'number' && n < 3;
        }
        if (r.tool === 'search_methodology')
          return Array.isArray(t.output) && t.output.length > 0;
        return true;
      });
      return {
        id: r.id,
        label: r.label,
        pass: passed,
        detail: passed
          ? 'Supported by a successful tool result.'
          : r.target === 'top-ranked' && topId
            ? `Missing inspection of ${topId}.`
            : 'Required evidence has not been collected.',
      };
    }),
  };
}
