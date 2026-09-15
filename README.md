# EquityMap

A working mapping-equity audit prototype for Gen Academy and the Zindi Bias Bounty Mapping Equity Challenge. Explore an independently computed Northern California baseline, inspect raw counts, compare communities, and export an evidence-backed audit.

## What works

- **Real data:** all 591 scored Northern California tracts; pinned Overture release `2026-08-19.0`.
- **Interactive map:** four gap layers, group filters, tract search, ranked evidence, and undefined-reference indicators.
- **Audits:** retrieval, validation, ranking, group comparison, and tract inspection with a visible tool trace.
- **Two honest execution modes:** guided deterministic workflows work without a model; an optional OpenAI-compatible local model chooses tools in a bounded loop. No paid API is required.
- **Exports:** Markdown audit with evidence/provenance and a regional baseline CSV. Nothing is submitted automatically.
- **Presentation:** architecture and methodology tabs, plus [demo script](docs/demo-script.md) and [handout draft](docs/gen-academy-handout.md).

This is an independent baseline, not an organizer reference score or a complete competition entry. No leaderboard RMSE has been measured. Group thresholds and feature assignment choices are documented in [methodology](docs/methodology.md).

## Demo disclosure and submission artifacts

The app uses real, precomputed challenge observations for 591 Northern California tracts. The component scores are an independent baseline, not fabricated sample values or organizer reference scores. Scope is partial: one of four regions, with undefined components excluded and no official leaderboard RMSE. Test fixtures and mocked model responses are synthetic and are not the live demo data.

Use the GitHub source and a narrated recording as the Academy deliverables. The hosted preview is a convenience and runs guided mode; record localhost with **Local model** selected to demonstrate autonomous tool selection.

**Sharing boundary is unresolved:** the initial public commit includes the scoring pipeline and score recomputation. This repository has not yet been separated into an Academy-only application. Deleting those files in a later commit would not remove them from history. Zindi limits teams to four and requires shared competition code to be available to all participants through its platform. Do not assume a seven-person Academy group is an authorized competition team. No competition submission has been made.

## Run the demo

Requires Node 22.13+ and npm. The committed snapshot means Python and raw downloads are **not** needed to run the UI.

```bash
npm ci
npm run dev
```

Open the Local URL printed by the server (normally `http://localhost:3000`). Try “Compare rural and urban tracts,” then “Explain missing reference data.”

### Enable live local tool selection

Use an installed Ollama model with tool-calling support. For example:

```bash
ollama serve
# In another terminal, only if the model is not already installed:
ollama pull llama3.1:8b
cp .dev.vars.example .dev.vars
npm run dev
```

`.dev.vars` configures the local Cloudflare Worker runtime. Restart after editing it. `.env.example` lists the same keys for other runtime adapters. Select **Local model** in the audit panel when the endpoint is configured. The endpoint must implement OpenAI-compatible `/chat/completions` tool calls. The model URL and API key are operator configuration, never supplied by a browser request.

The model may refuse, call an invalid tool, exceed a budget, or fail to collect analytical evidence. Such runs report an error rather than claim success. Its freeform numerical claims are not used: findings are rendered from actual tool outputs. The current limits are 8 calls, 6 model turns, and 60 seconds overall. Guided mode remains available explicitly.

A hosted private preview uses guided mode unless its own model endpoint is configured. A hosted worker cannot reach the Ollama server on your laptop at `127.0.0.1`.

## Rebuild the baseline

Python 3.11+ and DuckDB are sufficient; no API credentials required. Allow approximately 400 MB for raw inputs and up to 2 GB for DuckDB working memory.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm run data:build
```

The script downloads only official challenge layers, caches them under ignored `data/raw/`, calculates tract aggregates, and writes `data/northern-ca.json`. Download integrity uses Content-Length for fresh downloads; the snapshot includes SHA-256 hashes for every input. `data/raw/` and `.venv/` are never committed. See [DATA_LICENSES.md](DATA_LICENSES.md) for source-specific attribution and reuse terms.

To reproduce a particular snapshot exactly, retain inputs matching its hashes. If the upstream repository reissues files, compare the new manifest with the committed one before accepting changed results. Geometry simplification affects only map display.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Tests cover denominator handling, overcoverage, invalid observations, real-data membership, cross-language score recomputation, unknown groups, export blocking, retrieval, unsupported requests, tool allowlisting, model-response grounding, and the browser-tool contract. Tests using mocked model responses verify integration contracts; the demo's real model is checked separately.

Vendored starter files under `components/ui/` and `hooks/use-mobile.ts` are excluded from lint because they arrive with upstream lint violations. Application code remains checked; TypeScript checks the whole project.

## Layout

```text
app/                    Page and /api/audit endpoint
components/workspace.tsx Map, evidence, audit and presentation views
lib/audit.ts            Pure calculations, comparisons and CSV validation
lib/agent.ts            Guided workflow + bounded model tool loop
lib/knowledge.ts        Curated source-linked retrieval corpus
lib/webmcp.ts           Optional structured browser tools
scripts/build_snapshot.py Independent geospatial baseline computation
data/northern-ca.json   Reproducible application snapshot
```

## What is still outside this prototype

- Maricopa, Eastern Oklahoma, and South-Central Texas computation and a validated full challenge submission.
- Official leaderboard evaluation and reconciliation of boundary-assignment assumptions with organizer scoring.
- Statistical uncertainty estimates, multivariate analysis, and a novel Best Bias Discovery investigation.
- A production multiuser model gateway with authentication, rate limiting, concurrency limits, and operational monitoring. Keep the current deployment owner-private.
- A recorded presentation and populated team roster. The application does not claim these are complete.

Before sharing competition code, follow Zindi's team size and code-sharing rules and confirm Gen Academy's reuse policy. This repository does not submit to either organization.

The orchestrator always runs methodology retrieval and validation before model selection. These calls are labeled required in the trace; the model then chooses analytical and follow-up tools. This keeps mandatory checks reliable even if a model omits them.

## Demo day controls and evidence checks

Use **Presentation view** for a larger question and side-by-side evidence on wide screens. Select **Local model** explicitly for live Ollama tool selection. **Reset demo** clears the result, replay, question and map filters while preserving the chosen execution mode. **Load recorded replay** displays a dated, verified local-model result without calling a model; the header, result and exported report label it as a replay. The recorded video remains linked alongside it.

The application recognizes a bounded set of supported requests: ranking up to ten tracts by one metric, rural/urban or SVI comparison, explicit tract inspection, missing-reference inspection, and methodology retrieval. Deterministic requirements check the tool, metric, group, rank limit and target tract. This is a conservative intent matcher, not a general natural-language completeness judge. Requests outside this scope are declined. A model that stops early gets one completion reminder within the original six-turn, eight-tool, 60-second budget. Missing evidence or model errors yield **Partial**, preserving collected evidence. Numeric formulas are unchanged.

**Agent evaluations** separates scripted adapter tests from actual local requests, with expected and observed behavior and dated results. The scripted recovery demonstration intentionally supplies a bad enum; it is not a live model claim. `npm run eval:live` warms local Ollama, runs the controlled cases and four local requests, and saves a verified successful replay. `npm run eval` runs controlled cases only and replaces the live batch with an empty batch; use `eval:live` for the complete demo artifacts. Neither command computes an official competition score. Snapshot and evaluator hashes, replay output recomputation, and automated tests guard against stale evidence.
