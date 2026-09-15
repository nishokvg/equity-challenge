# Prototype validation

Checked September 12, 2026 PT.

- 591/591 authoritative Northern California sample IDs are present exactly once.
- Formula consistency: TypeScript agrees with Python for all component and composite scores within 1e-9 using the same aggregated counts; this does not validate geographic counting.
- 218 tracts have undefined road gaps because their named-highway reference is zero.
- Baseline regional mean composite gap: 0.06554476793861636 (about 6.6%).
- The documented RUCA grouping yields 156 rural and 435 urban tracts, no unknown memberships. Mean composite gaps are about 12.1% versus 4.6%, respectively (ratio about 2.64).
- Numerical/agent/browser-contract automated tests pass. See `npm test` for the current count and cases.
- TypeScript and application lint checks pass. Vendored UI primitives retain their upstream lint exclusions.
- The production build succeeds. The runtime dependency audit reported zero known vulnerabilities after compatible upgrades.
- The real local `/api/audit` endpoint completed a `llama3.1:8b` comparison run through Ollama. Its trace included required retrieval, required validation, and model-selected group comparison. Cold model loading exceeded a 20-second per-call limit during initial setup; warm the model before recording.
- Browser WebMCP tools registered as `run_equity_audit` and `get_equity_audit`. A missing-reference investigation completed and was read back from UI state. Both tools rejected invalid input; the prior successful audit remained unchanged.

These are internal and integration checks, not an official Zindi score or a complete browser accessibility/visual audit. The recorded demo and team roster remain manual deliverables.

A second live model run ranked the largest gaps and inspected the top tract. It initially supplied an invalid tract ID, received schema feedback, then corrected the call and completed the investigation. Rejected calls remain visible in the trace and do not enter the numerical findings.

## Subsequent browser dry run (September 12, about 8:45–8:55 pm PT)

Ollama was warmed and the browser explicitly selected Local model at localhost. The rural/urban comparison succeeded with model-selected `compare_groups`. A compound ranking-and-inspection request returned a ranking but omitted the requested inspection while reporting complete. The missing-reference prompt stopped without an analytical tool and surfaced an error. No rejected-call recovery occurred in this dry run; the earlier successful recovery is historical evidence, not a promised recording outcome. Architecture and methodology views rendered; six data checks passed. Export downloaded, but after the failed audit it contained selected-tract evidence only and incorrectly said no investigation had been run. The export wording has been corrected to identify the failed execution mode and error; task-completion evaluation remains an outstanding limitation. No narrated recording or upload was performed.

## Demo day enhancements verified September 15 2026

The completion verifier checks supported request requirements against successful tool results, including metric, group, ranking limit, and the inspected tract’s relationship to the ranking. Missing evidence gets one completion reminder and then a Partial result. Transport errors preserve prior evidence. The checker is a bounded intent matcher, not a general semantic verifier.

The dated evaluation batch records 8/8 controlled adapter cases passing and 3/4 local request expectations met. Of the three requests that invoked Ollama, comparison and missing-reference investigation completed; ranking plus inspection remained partial after a rejected tract ID and one completion reminder. The fourth request was unsupported and correctly declined before inference. These results are recorded in data/agent-evaluations.json. A separate browser run reproduced the partial compound result with the correct missing tract identified.

Twenty-four automated tests pass, including replay output recomputation and source/snapshot consistency. Type checking, lint, and production build pass. The browser verified presentation mode, replay labeling, model/required tool labels, partial score labels, the controlled recovery trace, and corrected architecture feedback paths. The replay is an actual dated local-model comparison, independently re-executed against the same snapshot before saving. No scoring formulas or raw source data changed.

## Council recommendations verified September 15, 2026

Raw model argument strings are retained before JSON parsing and included in the trace, rejected/corrected call comparison, and audit export. A controlled malformed JSON case preserves the exact string and line breaks while rejecting it, then accepts the corrected call. The UI explicitly labels this as a test fixture.

The architecture and handout state eight total calls: two mandatory checks and up to six model-selected calls. The numerical validation is named Formula consistency and explicitly limits its claim to shared aggregated counts. Dedicated missing-reference checks now cover facilities, establishments, and combined places as well as roads and buildings. Scoring formulas and source observations are unchanged.

Twenty-nine automated tests pass, including five new regression tests. All nine controlled agent cases pass. In the refreshed local llama3.1:8b batch, three of four expectations passed: comparison and missing-reference investigation completed, and the unsupported request was declined before inference. Ranking plus inspection remained Partial after two rejected calls and one completion reminder; the missing inspection is not represented as complete. The saved comparison replay and evaluation provenance were refreshed for the current agent, numerical tools, retrieval, completion checker, and evaluation source.

Type checking and lint pass. A production build passed under a macOS sandbox denying outbound networking, using the already installed dependencies. Geist Sans and Mono variable WOFF2 fonts are bundled with their upstream OFL license and pinned source/hash provenance; application builds and font rendering no longer fetch Google Fonts. Browser checks verified malformed/corrected argument visibility, validation scope, tool budget wording, and typography.

The existing GitHub repository remains public. These code fixes do not undo prior scoring-code exposure or change repository visibility.
