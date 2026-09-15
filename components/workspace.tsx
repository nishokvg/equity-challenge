'use client';
import Link from 'next/link';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Layers3,
  MapPinned,
  ShieldCheck,
  Download,
  Play,
  Check,
  AlertTriangle,
  Search,
  GitBranch,
  BookOpen,
  Route,
  Building2,
  MapPin,
  ChevronRight,
  LoaderCircle,
  Braces,
  FileCheck2,
  ChevronLeft,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  type Dataset,
  type Component,
  type Group,
  inGroup,
  mean,
  pct,
  gap,
  groups,
  metricLabels,
  validateDataset,
  regionalCSV,
  compareGroups,
} from '@/lib/audit';
import { type AuditResult } from '@/lib/agent';
import { AuditResults } from '@/components/audit-results';
import { EvaluationPanel } from '@/components/evaluation-panel';
import replayData from '@/data/demo-replay.json';
import { documents } from '@/lib/knowledge';
import { flushSync } from 'react-dom';
import { registerAuditTools, type ModelContext } from '@/lib/webmcp';
const colors = ['#dae7fb', '#aac5ed', '#7196d7', '#3e68ba', '#163e8d'];
const color = (value: number | null) =>
  value === null
    ? 'url(#undefined-fill)'
    : colors[Math.min(4, Math.floor(value * 5))];
const count = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n);
const suggestions = [
  'Rank the highest gaps and inspect the top tract',
  'Compare rural and urban tracts',
  'Explain missing reference data',
];
function download(name: string, text: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Workspace({ data }: { data: Dataset }) {
  const [presentation, setPresentation] = useState(false);
  const [replay, setReplay] = useState(false);
  const [view, setView] = useState('explore');
  const [metric, setMetric] = useState<Component>('score');
  const [group, setGroup] = useState<Group>('all');
  const [selected, setSelected] = useState(
    data.tracts
      .slice()
      .sort((a, b) => (b.metrics.score ?? 0) - (a.metrics.score ?? 0))[0].geoid,
  );
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [question, setQuestion] = useState(suggestions[0]);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'guided' | 'model'>('guided');
  const [model, setModel] = useState<string | null>(null);
  const checks = useMemo(() => validateDataset(data), [data]);
  const selectedTract = data.tracts.find((t) => t.geoid === selected)!;
  const visible = useMemo(
    () => data.tracts.filter((t) => inGroup(t, group)),
    [data, group],
  );
  const ranked = useMemo(
    () =>
      visible
        .filter((t) =>
          (t.geoid + ' ' + t.name)
            .toLowerCase()
            .includes(query.toLowerCase().trim()),
        )
        .sort(
          (a, b) =>
            (b.metrics[metric] ?? -1) - (a.metrics[metric] ?? -1) ||
            a.geoid.localeCompare(b.geoid),
        ),
    [visible, query, metric],
  );
  const numPages = Math.max(1, Math.ceil(ranked.length / 8));
  const currentPage = Math.min(page, numPages - 1);
  const comparison = useMemo(
    () => compareGroups(data, 'rural', metric),
    [data, metric],
  );
  useEffect(() => {
    fetch('/api/audit')
      .then((r) => r.json() as Promise<{ model: string | null }>)
      .then((c) => setModel(c.model ?? null))
      .catch(() => {});
  }, []);
  const runAudit = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return null;
      setBusy(true);
      setReplay(false);
      setError('');
      setAudit(null);
      setQuestion(text);
      try {
        const response = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, mode }),
          signal: AbortSignal.timeout(65000),
        });
        const result = (await response.json()) as AuditResult & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? 'Audit could not run.');
        flushSync(() => {
          setAudit(result);
          if (result.selectedIds?.[0]) setSelected(result.selectedIds[0]);
        });
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Audit could not run.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [busy, mode],
  );
  const bridge = useRef<{ run: typeof runAudit; result: AuditResult | null }>({
    run: runAudit,
    result: null,
  });
  useEffect(() => {
    bridge.current = { run: runAudit, result: audit };
  }, [runAudit, audit]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    return registerAuditTools(
      context,
      (q) => bridge.current.run(q),
      () => bridge.current.result,
    );
  }, []);
  const exportReport = () => {
    const lines = [
      '# EquityMap — Northern California audit',
      '',
      `Data release: ${data.meta.release}`,
      `Snapshot generated: ${data.meta.generated}`,
      '',
      `Scope: ${data.tracts.length} Northern California tracts. Independent baseline; no leaderboard RMSE measured.`,
      '',
      `Mode: ${audit?.mode ?? (error ? `${mode} (failed)` : 'exploration only')}`,
      '',
      ...(audit
        ? [
            `Question: ${audit.question}`,
            `Status: ${audit.status}`,
            `Evidence source: ${replay ? 'Recorded replay — not a live run' : 'Current investigation'}`,
            `Model: ${audit.model ?? 'No model'}`,
            `Recorded at: ${audit.recordedAt ?? 'Unavailable'}`,
            ...(audit.stopReason ? [`Stop reason: ${audit.stopReason}`] : []),
            ...(audit.completion?.checks.map(
              (c) => `${c.pass ? 'DONE' : 'MISSING'}: ${c.label}`,
            ) ?? []),
            '',
            ...audit.summary.map((s) => '- ' + s),
            '',
            '## Tool trace',
            ...audit.trace.map(
              (t) =>
                `- ${t.tool}: ${JSON.stringify(t.input)} → ${JSON.stringify(t.output)}`,
            ),
          ]
        : [
            error
              ? `Investigation failed: ${error}. This report records selected-tract evidence only, not a successful agent audit.`
              : 'No agent investigation has been run. This report records the selected tract.',
          ]),
      '',
      '## Selected tract',
      `${selectedTract.geoid} — ${selectedTract.name}`,
      `Composite gap: ${pct(selectedTract.metrics.score)}; ${selectedTract.metrics.defined} of 3 components available`,
      `Observed/reference counts: ${JSON.stringify(selectedTract.counts)}`,
      '',
      '## Validation',
      ...checks.map(
        (c) => `- ${c.pass ? 'PASS' : 'FAIL'}: ${c.name}. ${c.detail}`,
      ),
      '',
      '## Limitations',
      ...data.meta.notes.map((s) => '- ' + s),
      '',
      '## Documentation',
      ...documents.map((d) => `- [${d.title}](${d.url})`),
      '',
      '## Data provenance',
      ...data.meta.sources.map((s) => `- ${s.url}\n  SHA-256: ${s.sha256}`),
      '',
      'Derived from Overture Maps and Microsoft Building Footprints (ODbL), Overture Places (CDLA Permissive 2.0), and public-domain US Census/USGS sources. See DATA_LICENSES.md.',
    ];
    download('equitymap-audit.md', lines.join('\n'));
  };
  const resetDemo = () => {
    setAudit(null);
    setError('');
    setReplay(false);
    setView('explore');
    setQuestion('Compare rural and urban tracts');
    setQuery('');
    setPage(0);
    setMetric('score');
    setGroup('all');
    setSelected(
      data.tracts
        .slice()
        .sort((a, b) => (b.metrics.score ?? 0) - (a.metrics.score ?? 0))[0]
        .geoid,
    );
  };
  const loadReplay = () => {
    const result = replayData.result as AuditResult;
    setAudit(result);
    setReplay(true);
    setError('');
    setQuestion(result.question);
    setView('explore');
    if (result.selectedIds[0]) setSelected(result.selectedIds[0]);
  };
  return (
    <main className={`workspace${presentation ? ' presentation' : ''}`}>
      <header className="masthead">
        <Link className="brand" href="/">
          <Layers3 size={25} /> equitymap<span>RESEARCH WORKSPACE</span>
        </Link>
        <div className="header-links">
          <a
            href="https://github.com/nishokvg/equity-challenge"
            target="_blank"
            rel="noreferrer"
          >
            Project <ArrowUpRight size={14} />
          </a>
          <span className="status">
            <i /> Real challenge data
          </span>
        </div>
      </header>
      <div className="demo-toolbar" aria-label="Presentation controls">
        <div className="demo-mode">
          <strong>
            {replay
              ? 'Recorded replay'
              : mode === 'model'
                ? 'Local model'
                : 'Guided mode'}
          </strong>
          <span>
            {replay
              ? replayData.model
              : mode === 'model'
                ? (model ?? 'Unavailable')
                : 'No LLM'}{' '}
            · Real data · 591 tracts
          </span>
        </div>
        <div className="demo-actions">
          <Button
            variant="outline"
            aria-pressed={presentation}
            onClick={() => setPresentation(!presentation)}
          >
            {presentation ? 'Exit presentation' : 'Presentation view'}
          </Button>
          <Button variant="outline" disabled={busy} onClick={loadReplay}>
            Load recorded replay
          </Button>
          <Button variant="outline" disabled={busy} onClick={resetDemo}>
            Reset demo
          </Button>
          {presentation && (
            <Button variant="outline" onClick={exportReport}>
              Export audit
            </Button>
          )}
          <a
            href="https://drive.google.com/file/d/16QnFW2gI44o2K6PIUqtToMDsGAymEzKK/view"
            target="_blank"
            rel="noreferrer"
          >
            Recorded video <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
      <section className="intro">
        <div>
          <p className="eyebrow">MAPPING EQUITY / NORTHERN CALIFORNIA</p>
          <h1>Put the gaps on the map.</h1>
          <p>
            Investigate coverage. Follow the evidence. Decide what needs a
            closer look.
          </p>
        </div>
        <Button
          variant="outline"
          className="export-button"
          onClick={exportReport}
        >
          <Download /> Export audit
        </Button>
      </section>
      <Tabs
        value={view}
        onValueChange={(v) => setView(String(v))}
        className="main-tabs"
      >
        <TabsList variant="line" className="view-tabs">
          <TabsTrigger value="explore">
            <MapPinned /> Explore & audit
          </TabsTrigger>
          <TabsTrigger value="architecture">
            <GitBranch /> Architecture
          </TabsTrigger>
          <TabsTrigger value="evaluations">
            <ShieldCheck /> Agent evaluations
          </TabsTrigger>
          <TabsTrigger value="methodology">
            <BookOpen /> Methodology & checks
          </TabsTrigger>
        </TabsList>
        <TabsContent value="explore">
          <section className="stats" aria-label="Regional summary">
            <div>
              <span>Tracts in view</span>
              <strong>
                {visible.length}
                <small> / {data.tracts.length}</small>
              </strong>
              <p>{groups[group]}</p>
            </div>
            <div>
              <span>Mean {metricLabels[metric].toLowerCase()}</span>
              <strong>
                {pct(mean(visible.map((t) => t.metrics[metric])))}
              </strong>
              <p>Unweighted · defined components only</p>
            </div>
            <div>
              <span>Rural / urban gap ratio</span>
              <strong>
                {comparison.ratio === null
                  ? 'Undefined'
                  : comparison.ratio.toFixed(2) + '×'}
              </strong>
              <p>
                Whole region · {comparison.left.defined} rural /{' '}
                {comparison.right.defined} urban
              </p>
            </div>
            <div>
              <span>Undefined in view</span>
              <strong>
                {visible.filter((t) => t.metrics[metric] === null).length}
                <small> tracts</small>
              </strong>
              <p>Not interpreted as zero gap</p>
            </div>
          </section>
          <div className="audit-grid">
            <div className="map-column">
              <section className="panel map-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">COVERAGE AT A GLANCE</p>
                    <h2>{metricLabels[metric]}</h2>
                  </div>
                  <Select
                    value={group}
                    onValueChange={(v) => {
                      if (v) {
                        setGroup(v as Group);
                        setPage(0);
                      }
                    }}
                  >
                    <SelectTrigger
                      className="group-select"
                      aria-label="Filter community group"
                    >
                      <SelectValue>{groups[group]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(groups).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Tabs
                  value={metric}
                  onValueChange={(v) => {
                    setMetric(v as Component);
                    setPage(0);
                  }}
                >
                  <TabsList className="metric-tabs">
                    {Object.entries(metricLabels).map(([key, label]) => (
                      <TabsTrigger key={key} value={key}>
                        {label.replace(' gap', '')}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="map-wrap">
                  <div className="map-label">
                    <span>NORTHERN CALIFORNIA</span>
                    <small>Census tract boundaries</small>
                  </div>
                  <svg
                    viewBox="0 0 800 550"
                    className="tract-map"
                    aria-label={`${metricLabels[metric]} across Northern California. Select a tract in the table below for keyboard access.`}
                  >
                    <defs>
                      <pattern
                        id="grid"
                        width="50"
                        height="50"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M50 0H0V50"
                          fill="none"
                          stroke="#d9e2ed"
                          strokeWidth=".6"
                        />
                      </pattern>
                      <pattern
                        id="undefined-fill"
                        width="6"
                        height="6"
                        patternUnits="userSpaceOnUse"
                      >
                        <rect width="6" height="6" fill="#e5e8ed" />
                        <path d="M0 6L6 0" stroke="#96a1b1" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="800" height="550" fill="url(#grid)" />
                    {data.tracts.map((t) => (
                      <path
                        key={t.geoid}
                        d={t.path}
                        fill={color(t.metrics[metric])}
                        fillRule="evenodd"
                        stroke="#fff"
                        strokeWidth=".6"
                        opacity={inGroup(t, group) ? 1 : 0.12}
                        onClick={() => setSelected(t.geoid)}
                        className="tract-path"
                      >
                        <title>{`${t.geoid} · ${t.name} · ${pct(t.metrics[metric])}`}</title>
                      </path>
                    ))}
                    <path
                      d={selectedTract.path}
                      fill="none"
                      stroke="#f0a52d"
                      strokeWidth="2.5"
                      pointerEvents="none"
                    />
                    <text
                      x="762"
                      y="44"
                      textAnchor="middle"
                      fill="#354b68"
                      fontSize="12"
                    >
                      N
                    </text>
                    <path d="M762 53L756 68H768Z" fill="#354b68" />
                  </svg>
                  <div className="map-source">
                    2020 census tracts · display geometry simplified
                  </div>
                </div>
                <div className="legend">
                  <span>Smaller gap</span>
                  {colors.map((c, i) => (
                    <span
                      className="legend-color"
                      key={c}
                      style={{ background: c }}
                      title={`${i * 20}–${(i + 1) * 20}%`}
                    />
                  ))}
                  <span>Larger gap</span>
                  <span className="undefined-key" />
                  <span>Undefined</span>
                </div>
              </section>
              <section className="panel evidence-panel" aria-live="polite">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">
                      SELECTED TRACT / {selectedTract.geoid}
                    </p>
                    <h2>{selectedTract.name}</h2>
                    <p className="small-muted">
                      {selectedTract.county} ·{' '}
                      {selectedTract.rural === null
                        ? 'RUCA unknown'
                        : selectedTract.rural
                          ? 'Rural'
                          : 'Urban'}{' '}
                      · SVI{' '}
                      {selectedTract.svi === null
                        ? 'unknown'
                        : selectedTract.svi.toFixed(3)}
                    </p>
                  </div>
                  <div className="selected-score">
                    <strong>{pct(selectedTract.metrics.score)}</strong>
                    <span>composite gap</span>
                    <span className="availability">
                      {selectedTract.metrics.defined} of 3 components available
                    </span>
                  </div>
                </div>
                <div className="component-grid">
                  {(['roads', 'buildings', 'places'] as const).map((key, i) => {
                    const Icon = [Route, Building2, MapPin][i];
                    return (
                      <div key={key}>
                        <Icon size={18} />
                        <span>{metricLabels[key]}</span>
                        <strong>
                          {selectedTract.metrics[key] === null
                            ? 'Unknown reference'
                            : pct(selectedTract.metrics[key])}
                        </strong>
                      </div>
                    );
                  })}
                </div>
                <details className="counts-detail">
                  <summary>
                    View observations and calculation <ChevronRight size={16} />
                  </summary>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Layer</TableHead>
                        <TableHead>Overture</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Gap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(selectedTract.counts).map(
                        ([key, pair]) => (
                          <TableRow key={key}>
                            <TableCell>
                              {key === 'roads' ? 'Named roads (m)' : key}
                            </TableCell>
                            <TableCell>{count(pair[0])}</TableCell>
                            <TableCell>{count(pair[1])}</TableCell>
                            <TableCell>{pct(gap(pair))}</TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                  <p>
                    Each defined gap = 1 − min(1, Overture ÷ reference).
                    Facilities are averaged by type, then combined with
                    establishments into places. The composite averages{' '}
                    {selectedTract.metrics.defined} defined components.
                  </p>
                </details>
                {selectedTract.metrics.defined < 3 && (
                  <div className="notice warning">
                    <AlertTriangle size={17} />{' '}
                    {3 - selectedTract.metrics.defined} component(s) have no
                    reference. They are excluded from the composite, not filled
                    with zero.
                  </div>
                )}
              </section>
            </div>
            <aside className="panel agent-panel">
              <div className="panel-heading">
                <div className="agent-title">
                  <span className="agent-symbol">
                    <Braces size={20} />
                  </span>
                  <div>
                    <h2>Investigate with evidence</h2>
                    <span className="small-muted">
                      {replay
                        ? `Recorded local model · ${replayData.model}`
                        : mode === 'guided'
                          ? 'Guided tools · no LLM'
                          : `Model tool selection · ${model}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="agent-body">
                <div className="investigation-controls">
                  <p className="agent-intro">
                    Ask about coverage gaps, compare communities, or inspect a
                    tract. Every result has a trace.
                  </p>
                  {model && (
                    <Select
                      disabled={busy}
                      value={mode}
                      onValueChange={(v) => {
                        if (v) setMode(v as 'guided' | 'model');
                      }}
                    >
                      <SelectTrigger aria-label="Audit execution mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guided">Guided audit</SelectItem>
                        <SelectItem value="model">Local model</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void runAudit(question);
                    }}
                  >
                    <label htmlFor="question" className="input-label">
                      Your investigation
                    </label>
                    <Textarea
                      id="question"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      maxLength={800}
                      rows={3}
                      className="question-input"
                    />
                    <Button
                      type="submit"
                      disabled={busy || !question.trim()}
                      className="run-button"
                    >
                      {busy ? <LoaderCircle className="spin" /> : <Play />}
                      {busy ? 'Running investigation…' : 'Run audit'}
                      {!busy && <ArrowRight />}
                    </Button>
                  </form>
                  <div className="suggestions">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => void runAudit(s)}
                        disabled={busy}
                      >
                        {s}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                  {error && (
                    <p className="error-box" role="alert">
                      {error}
                    </p>
                  )}
                  {!audit && !busy && !error && (
                    <div className="agent-empty">
                      <FileCheck2 size={26} />
                      <h3>Your evidence trail starts here.</h3>
                      <p>
                        Run an investigation to see findings, sources, and each
                        tool’s inputs and outputs.
                      </p>
                    </div>
                  )}
                  {busy && (
                    <output className="small-muted">
                      Querying the loaded snapshot and checking evidence…
                    </output>
                  )}
                </div>
                {audit && <AuditResults audit={audit} replay={replay} />}
                <div className="agent-footer">
                  <ShieldCheck size={16} />
                  <p>
                    Read-only analysis. Findings require human review. Regional
                    prototype; no official leaderboard score.
                  </p>
                </div>
              </div>
            </aside>
          </div>
          <section className="panel tract-table">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">FOLLOW THE NUMBERS</p>
                <h2>Tract evidence</h2>
              </div>
              <div className="search-input">
                <Search size={16} />
                <Input
                  aria-label="Search tract name or GEOID"
                  placeholder="Search name or GEOID"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tract / GEOID</TableHead>
                  <TableHead>Community</TableHead>
                  <TableHead>SVI rank</TableHead>
                  <TableHead>Roads</TableHead>
                  <TableHead>Buildings</TableHead>
                  <TableHead>Places</TableHead>
                  <TableHead>Composite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.slice(currentPage * 8, currentPage * 8 + 8).map((t) => (
                  <TableRow
                    key={t.geoid}
                    data-state={t.geoid === selected ? 'selected' : undefined}
                  >
                    <TableCell>
                      <button
                        className="tract-link"
                        onClick={() => setSelected(t.geoid)}
                      >
                        {t.geoid}
                        <ArrowUpRight size={13} />
                      </button>
                      <span className="small-muted table-name">{t.name}</span>
                    </TableCell>
                    <TableCell>
                      {t.rural === null
                        ? 'Unknown'
                        : t.rural
                          ? 'Rural'
                          : 'Urban'}
                    </TableCell>
                    <TableCell>
                      {t.svi === null ? 'Unknown' : t.svi.toFixed(3)}
                    </TableCell>
                    {(['roads', 'buildings', 'places', 'score'] as const).map(
                      (k) => (
                        <TableCell
                          key={k}
                          className={k === 'score' ? 'score-cell' : ''}
                        >
                          {t.metrics[k] === null
                            ? 'Unknown reference'
                            : pct(t.metrics[k])}
                          {k === 'score' && (
                            <small className="availability">
                              {t.metrics.defined} of 3 components available
                            </small>
                          )}
                        </TableCell>
                      ),
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!ranked.length && (
              <p className="empty-table">
                No tracts match these filters. Try another GEOID or community
                group.
              </p>
            )}
            <div className="table-footer">
              <span>
                {ranked.length} matching tracts · sorted by{' '}
                {metricLabels[metric].toLowerCase()}
              </span>
              <div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous page"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft />
                </Button>
                <span>
                  {currentPage + 1} / {numPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next page"
                  disabled={currentPage >= numPages - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="architecture">
          <Architecture />
        </TabsContent>
        <TabsContent value="evaluations">
          <EvaluationPanel />
        </TabsContent>
        <TabsContent value="methodology">
          <section className="methodology-grid">
            <div className="panel document-panel">
              <p className="eyebrow">REPRODUCIBLE BY DESIGN</p>
              <h2>What these numbers mean</h2>
              <p>
                The map shows an independently computed baseline from the
                challenge’s Northern California data. A larger gap means
                Overture contains fewer mapped features or less named-road
                length than the selected reference.
              </p>
              <div className="formula">
                gap = 1 − min(1, observed / reference)
              </div>
              <p>
                Zero reference → undefined. Composite → mean of defined road,
                building, and places components. Places → mean of defined
                facilities and establishment halves; facilities → mean of
                defined fire, EMS, and school gaps.
              </p>
              <h3>Assumptions and limits</h3>
              <ul>
                {data.meta.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <h3>Source documentation</h3>
              {documents.map((d) => (
                <a
                  className="doc-link"
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BookOpen size={16} />
                  <span>{d.title}</span>
                  <ArrowUpRight size={14} />
                </a>
              ))}
              <p className="small-muted">
                Lexical retrieval searches this small, curated documentation
                collection. It is not a web-wide search or an embedding service.
              </p>
            </div>
            <div>
              <section className="panel document-panel">
                <p className="eyebrow">DATA QUALITY</p>
                <h2>
                  {checks.filter((c) => c.pass).length} / {checks.length} checks
                  passing
                </h2>
                <div className="checks">
                  {checks.map((c) => (
                    <div key={c.name}>
                      {c.pass ? (
                        <Check size={18} />
                      ) : (
                        <AlertTriangle size={18} />
                      )}
                      <div>
                        <h3>{c.name}</h3>
                        <p>{c.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="export-button"
                  disabled={checks.some((c) => !c.pass)}
                  onClick={() =>
                    download(
                      'northern-ca-regional-baseline.csv',
                      regionalCSV(data),
                      'text/csv',
                    )
                  }
                >
                  <Download /> Export regional baseline
                </Button>
                <p className="small-muted export-note">
                  Contains Northern California only. This is not a complete
                  four-region entry. No Zindi submission is made.
                </p>
              </section>
              <section className="panel document-panel provenance">
                <p className="eyebrow">SNAPSHOT PROVENANCE</p>
                <h3>Overture {data.meta.release}</h3>
                <p className="small-muted">
                  {data.meta.sources.length} input files ·{' '}
                  {new Date(data.meta.generated).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}{' '}
                  UTC
                </p>
                <details>
                  <summary>Input URLs and checksums</summary>
                  {data.meta.sources.map((s) => (
                    <div key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.url.split('/').pop()}
                      </a>
                      <code>{s.sha256}</code>
                    </div>
                  ))}
                </details>
              </section>
            </div>
          </section>
        </TabsContent>
      </Tabs>
      <footer className="workspace-footer">
        <span>EquityMap · Gen Academy prototype</span>
        <span>
          © Overture Maps Foundation & contributors · Microsoft Building
          Footprints · US Census / USGS
        </span>
      </footer>
    </main>
  );
}
function Architecture() {
  const steps = [
    {
      icon: MapPinned,
      label: 'Question and evidence contract',
      tag: 'INPUT',
      text: 'Recognize supported requests and list the evidence each part needs. Unsupported requests are declined.',
    },
    {
      icon: BookOpen,
      label: 'Required retrieval and validation',
      tag: 'PREFLIGHT',
      text: 'Retrieve methodology and validate the snapshot before asking the model to choose an analytical tool.',
    },
    {
      icon: GitBranch,
      label: 'Model selects analytical tools',
      tag: 'DECIDE',
      text: 'The local model chooses ranking, comparison, and inspection calls within six model turns and eight total tools.',
    },
    {
      icon: Braces,
      label: 'Execute and return feedback',
      tag: 'TOOL LOOP',
      text: 'Strict schemas reject invalid arguments. Tool evidence or the error returns to the model for its next decision.',
    },
    {
      icon: ShieldCheck,
      label: 'Check requested evidence',
      tag: 'COMPLETE OR RETRY',
      text: 'Verify metric, group, and tract requirements. A premature stop receives one completion retry within the original budget; missing evidence stays Partial.',
    },
    {
      icon: FileCheck2,
      label: 'Findings and human review',
      tag: 'OUTPUT',
      text: 'Render numerical findings from tool outputs. Preserve partial results, missing references, and the trace in the report.',
    },
  ];
  return (
    <section className="architecture">
      <div className="architecture-intro">
        <p className="eyebrow">THE DEMO, UNDER THE HOOD</p>
        <h2>One agent. A small set of accountable tools.</h2>
        <p>
          Language chooses the investigation. Deterministic code owns the
          numbers.
        </p>
      </div>
      <div className="architecture-flow">
        {steps.map((s, i) => (
          <article key={s.label}>
            <div className="arch-top">
              <s.icon size={22} />
              <span>
                {String(i + 1).padStart(2, '0')} / {s.tag}
              </span>
            </div>
            <h3>{s.label}</h3>
            <p>{s.text}</p>
            {i < steps.length - 1 && (
              <ArrowRight className="arch-arrow" size={18} />
            )}
          </article>
        ))}
      </div>
      <div className="architecture-feedback">
        <strong>Feedback paths</strong>
        <p>
          Rejected arguments → schema error → model chooses a corrected call.
        </p>
        <p>
          Missing requested evidence → one completion reminder → model chooses a
          follow-up → recheck.
        </p>
        <p>
          Time, turn, or tool limit → preserve collected evidence and mark
          Partial. Guided mode executes a fixed workflow and is labeled
          separately.
        </p>
      </div>
      <div className="architecture-details">
        <section className="panel document-panel">
          <p className="eyebrow">DATA PATH</p>
          <h3>Public GeoParquet → reproducible snapshot</h3>
          <p>
            Python + DuckDB read the challenge layers, assign features to
            tracts, clip roads, and calculate a baseline. The app loads the
            resulting snapshot with source URLs and SHA-256 hashes.
          </p>
          <code className="code-line">
            build_snapshot.py → northern-ca.json → audit tools
          </code>
          <p>
            Large geospatial operations run offline. The demonstration queries a
            small, reproducible snapshot, so an audit does not download hundreds
            of megabytes.
          </p>
        </section>
        <section className="panel document-panel">
          <p className="eyebrow">AUTONOMY BOUNDARY</p>
          <h3>Decisions you can inspect</h3>
          <p>
            The optional model has at most eight read-only tool calls and a
            one-minute budget. Unknown tools and invalid arguments are rejected.
            Numerical summaries are rendered from tool outputs.
          </p>
          <p>
            There is no automatic map editing, publishing, emergency dispatch,
            or competition submission. You decide what action to take after
            reviewing the evidence.
          </p>
        </section>
      </div>
      <div className="notice">
        <ShieldCheck size={18} /> The current demo proves the analysis workflow.
        A configured local model enables autonomous tool selection; guided mode
        is explicitly labeled.
      </div>
    </section>
  );
}
