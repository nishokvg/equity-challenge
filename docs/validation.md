# Prototype validation

Checked September 12, 2026 PT.

- 591/591 authoritative Northern California sample IDs are present exactly once.
- Independent TypeScript recomputation agrees with Python for all component and composite scores within 1e-9.
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
