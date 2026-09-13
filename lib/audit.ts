/** Pure numerical tools. No model output is used as a score. */
export type Counts = {
  roads: [number, number];
  buildings: [number, number];
  fire: [number, number];
  ems: [number, number];
  schools: [number, number];
  establishments: [number, number];
};
export type Component = 'score' | 'roads' | 'buildings' | 'places';
export type Metrics = Record<Component, number | null> & {
  facilities: number | null;
  establishments: number | null;
  defined: number;
};
export type Tract = {
  geoid: string;
  name: string;
  county: string;
  path: string;
  counts: Counts;
  svi: number | null;
  rural: boolean | null;
  population: number | null;
  metrics: Metrics;
};
export type Dataset = {
  meta: {
    region: string;
    release: string;
    generated: string;
    method: string;
    sources: { url: string; sha256: string; bytes: number }[];
    bbox: number[];
    notes: string[];
  };
  tracts: Tract[];
  sampleIds: string[];
};
export type Group = 'all' | 'rural' | 'urban' | 'high-svi' | 'low-svi';
export const groups: Record<Group, string> = {
  all: 'All tracts',
  rural: 'Rural',
  urban: 'Urban',
  'high-svi': 'High vulnerability (SVI ≥ 0.75)',
  'low-svi': 'Lower vulnerability (SVI < 0.75)',
};
export const metricLabels: Record<Component, string> = {
  score: 'Composite gap',
  roads: 'Road gap',
  buildings: 'Building gap',
  places: 'Places gap',
};
export function mean(values: (number | null)[]): number | null {
  const defined = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  return defined.length
    ? defined.reduce((a, b) => a + b, 0) / defined.length
    : null;
}
export function gap(pair: [number, number]): number | null {
  const [observed, reference] = pair;
  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(reference) ||
    observed < 0 ||
    reference < 0
  )
    throw new Error('Counts and lengths must be finite and non-negative.');
  return reference === 0 ? null : 1 - Math.min(1, observed / reference);
}
export function calculate(counts: Counts): Metrics {
  const roads = gap(counts.roads),
    buildings = gap(counts.buildings);
  const facilities = mean([
    gap(counts.fire),
    gap(counts.ems),
    gap(counts.schools),
  ]);
  const establishments = gap(counts.establishments);
  const places = mean([facilities, establishments]);
  return {
    roads,
    buildings,
    places,
    facilities,
    establishments,
    score: mean([roads, buildings, places]),
    defined: [roads, buildings, places].filter((v) => v !== null).length,
  };
}
export function inGroup(t: Tract, group: Group) {
  if (group === 'rural') return t.rural === true;
  if (group === 'urban') return t.rural === false;
  if (group === 'high-svi') return t.svi !== null && t.svi >= 0.75;
  if (group === 'low-svi') return t.svi !== null && t.svi < 0.75;
  return true;
}
export function rankTracts(
  data: Dataset,
  metric: Component = 'score',
  group: Group = 'all',
  limit = 10,
) {
  return data.tracts
    .filter((t) => inGroup(t, group) && t.metrics[metric] !== null)
    .sort(
      (a, b) =>
        (b.metrics[metric] ?? 0) - (a.metrics[metric] ?? 0) ||
        a.geoid.localeCompare(b.geoid),
    )
    .slice(0, Math.max(1, Math.min(50, limit)));
}
export function compareGroups(
  data: Dataset,
  dimension: 'rural' | 'svi',
  metric: Component = 'score',
) {
  const a: Group = dimension === 'rural' ? 'rural' : 'high-svi',
    b: Group = dimension === 'rural' ? 'urban' : 'low-svi';
  const aggregate = (group: Group) => {
    const rows = data.tracts.filter((t) => inGroup(t, group));
    const defined = rows.filter((t) => t.metrics[metric] !== null);
    return {
      group,
      label: groups[group],
      n: rows.length,
      defined: defined.length,
      mean: mean(defined.map((t) => t.metrics[metric])),
    };
  };
  const left = aggregate(a),
    right = aggregate(b);
  return {
    metric,
    left,
    right,
    ratio:
      left.mean === null || right.mean === null || right.mean === 0
        ? null
        : left.mean / right.mean,
    unknown: data.tracts.filter((t) =>
      dimension === 'rural' ? t.rural === null : t.svi === null,
    ).length,
    smallGroup: left.defined < 10 || right.defined < 10,
  };
}
export type Validation = { name: string; pass: boolean; detail: string };
export function validateDataset(data: Dataset): Validation[] {
  const ids = data.tracts.map((t) => t.geoid),
    expected = new Set(data.sampleIds);
  const validNumbers = data.tracts.every((t) =>
    Object.values(t.counts).every(
      (p) => p.length === 2 && p.every((n) => Number.isFinite(n) && n >= 0),
    ),
  );
  const finiteScores = data.tracts.every(
    (t) =>
      Object.values(t.metrics).every(
        (n) => n === null || (Number.isFinite(n) && n >= 0),
      ) &&
      (['score', 'roads', 'buildings', 'places'] as const).every(
        (k) => t.metrics[k] === null || t.metrics[k]! <= 1,
      ),
  );
  const matched =
    validNumbers &&
    data.tracts.every((t) => {
      const m = calculate(t.counts);
      return (Object.keys(m) as (keyof Metrics)[]).every((k) =>
        m[k] === null
          ? t.metrics[k] === null
          : t.metrics[k] !== null && Math.abs(m[k]! - t.metrics[k]!) < 1e-9,
      );
    });
  return [
    {
      name: 'Tract identity',
      pass:
        ids.every((id) => /^\d{11}$/.test(id)) &&
        new Set(ids).size === ids.length,
      detail: `${ids.length} unique 11-digit text IDs expected.`,
    },
    {
      name: 'Submission membership',
      pass:
        expected.size === data.sampleIds.length &&
        ids.length === expected.size &&
        ids.every((id) => expected.has(id)),
      detail: 'Every authoritative regional sample ID is present exactly once.',
    },
    {
      name: 'Valid observations',
      pass: validNumbers,
      detail: 'Counts and road lengths are finite and non-negative.',
    },
    {
      name: 'Score bounds',
      pass: finiteScores && data.tracts.every((t) => t.metrics.score !== null),
      detail:
        'Defined gaps are between 0 and 1; every scored tract has a composite.',
    },
    {
      name: 'Independent recomputation',
      pass: matched,
      detail:
        'Browser/TypeScript calculations match the Python snapshot within 1e-9.',
    },
    {
      name: 'Missing reference handling',
      pass:
        validNumbers &&
        data.tracts.every(
          (t) =>
            (t.counts.roads[1] === 0) === (t.metrics.roads === null) &&
            (t.counts.buildings[1] === 0) === (t.metrics.buildings === null),
        ),
      detail:
        'Missing references remain undefined and are excluded from the composite.',
    },
  ];
}
export function regionalCSV(data: Dataset): string {
  const checks = validateDataset(data);
  if (checks.some((c) => !c.pass))
    throw new Error('Export blocked: dataset validation failed.');
  const byId = new Map(data.tracts.map((t) => [t.geoid, t]));
  return (
    'GEOID,coverage_gap_score\n' +
    data.sampleIds
      .map((id) => `${id},${byId.get(id)!.metrics.score}`)
      .join('\n') +
    '\n'
  );
}
export const pct = (v: number | null) =>
  v === null ? 'Undefined' : `${(v * 100).toFixed(1)}%`;
