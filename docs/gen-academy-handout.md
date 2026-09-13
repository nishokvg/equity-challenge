# Team Breakout Handout — EquityMap

**Team number:** [Add team number]
**Point person:** [Add full name]
**Deadline supplied:** September 12, 11:59 p.m. PT

| #   | Full name | Email |
| --- | --------- | ----- |
| 1   |           |       |
| 2   |           |       |
| 3   |           |       |
| 4   |           |       |
| 5   |           |       |
| 6   |           |       |
| 7   |           |       |

The Academy template has seven spaces. Zindi permits up to four competition team members. Reconcile team membership and private code sharing before treating the two teams as the same project team.

## Q1. Use case

Mapping analysts need to compare sources, locate coverage gaps and determine whether differences affect communities unevenly. That work involves repetitive joins, calculations, documentation lookup and checks. EquityMap helps an analyst investigate a region, inspect evidence for a gap, compare communities and export a reproducible audit for human review.

Our working prototype uses all 591 scored Northern California tracts from the Bias Bounty challenge. It measures mapped road, building and place coverage. It does not make dispatch decisions or claim that a missing mapped feature proves the real-world service is absent.

## Q2. Knowledge and tools

**Knowledge:** scoring definitions, dataset vintages, source limitations, geography and group definitions. Retrieval searches a small curated collection of source-linked methodology passages. This is lexical RAG; an embedding database is unnecessary for this small corpus.

**Actions:** query the computed snapshot; calculate and rank gaps; compare rural/urban or vulnerability groups; inspect raw observations for a tract; validate the data; and generate an audit or regional CSV.

**Architecture:** challenge GeoParquet → offline Python/DuckDB aggregation → versioned snapshot → agent and retrieval/tool loop → validation → map, evidence and report → human review.

An optional local model uses an OpenAI-compatible tool-calling endpoint. Guided mode provides an explicitly labeled deterministic workflow without an LLM. Numerical findings are rendered from actual tool results in both modes.

## Q3. Autonomy and evals

Fixed steps own data preparation, formulas, validation and export integrity. The local model can choose among approved read-only tools and request follow-up evidence within eight tool calls and one minute. It cannot execute arbitrary code, change map data, send messages or submit to the competition.

We evaluate numerical correctness, source grounding, and failure handling. The application checks sample membership, text GEOIDs, finite observations, bounds, independent Python/TypeScript recomputation and undefined references. Tests also reject unknown tools and invalid arguments, handle unknown group membership and unsupported questions, and prevent model prose from becoming fabricated numeric claims.

A good result answers the question with traceable observations, clear group definitions and explicit limitations. A bad result invents data, mistakes unknown references for zero gap, misstates the comparison population, or claims causation from association. Our demo includes a real missing-reference case to illustrate the distinction.

## Current scope and ownership

This is an independent Northern California baseline. Full-region challenge coverage, official leaderboard evaluation and statistical follow-up remain future work. No official RMSE or automatic Bias Score result is claimed. The Gen Academy reuse policy has not been confirmed by the supplied handout/form; disclose the competition connection and attribute each member's work.

**Repository:** https://github.com/nishokvg/equity-challenge
**Demo recording:** [Add Drive link after recording]
**Member contributions:** [Add actual contributions]

The orchestrator always runs methodology retrieval and validation before model selection. These calls are labeled required in the trace; the model then chooses analytical and follow-up tools. This keeps mandatory checks reliable even if a model omits them.
