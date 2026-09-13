# Four-minute Gen Academy demo

## Before recording

1. Run `npm ci` then `npm run dev` from the repository.
2. If showing autonomous tool selection, run your installed Ollama model, configure `.dev.vars`, restart the app and select Local model. Complete one warm-up audit before recording. Guided mode is a reliable, clearly labeled fallback; do not describe it as an LLM run.
3. Keep the browser at a comfortable desktop width. Start on Explore & audit.
4. Add your actual team names and number to the handout. Record the screen and voice; upload the recording to Drive and verify the intended reviewers can access it.

## 0:00–0:30 — The problem

“Open maps support planning, but coverage can vary between communities. We built EquityMap to help an analyst investigate those differences and check the evidence before acting. This prototype uses real challenge data for 591 Northern California tracts.”

## 0:30–1:15 — Explore and ask

Point out the map and component tabs. Run “Compare rural and urban tracts.”

“In this independent baseline, the rural mean composite gap is approximately 12.1%, versus 4.6% for urban tracts—a ratio around 2.64. These are unweighted tract averages using our documented RUCA threshold. This is an association to investigate, not proof of a cause or an official leaderboard result.”

If in Local model mode: “The locally running model chooses which approved analytical tools to call. Each call is recorded.” If guided: “This deterministic guided workflow demonstrates the same tools and validations. Autonomous selection is available through the local-model adapter.”

## 1:15–2:00 — Evidence, not just an answer

Expand a tool trace. Show the retrieved methodology links. Run “Find the largest coverage gaps” and open the selected tract's observations.

“Numbers come from code, not generated text. We can trace a result back to the source counts and the formula. A high gap is a candidate for mapping review; it does not prove a service is physically absent.”

## 2:00–2:45 — Catch a bad interpretation

Run “Explain missing reference data.” Show the undefined road component and the denominator warning.

“218 tracts here have no named-highway reference. Calling those zero-gap tracts would mislead us. The engine marks that component undefined and averages only the components it can actually measure.”

## 2:45–3:30 — Architecture and evaluation

Open Architecture, then Methodology & checks.

“The data pipeline runs offline in Python and DuckDB. Retrieval provides definitions. The agent calls bounded, read-only tools. TypeScript independently recomputes the snapshot's scores, while validation checks membership and missing-data handling. A human reviews the report before taking action.”

## 3:30–4:00 — Output and next step

Click Export audit. Explain that the Markdown report contains findings, trace, limitations and provenance. Show the regional CSV button if useful.

“We have a working regional prototype. Next we would cover all challenge regions, evaluate leaderboard accuracy, and investigate disparities beyond the predefined comparisons. Nothing is automatically submitted or published.”

## Submission checklist

The provided form asks for the team number, member names, uploaded breakout document, GitHub project link, and a Drive recording link. One team member submits. The form's title says May 2026; confirm it is the intended form for the stated September 12 deadline. Team details and recording are still manual steps. Check Zindi's four-person team and code-sharing rules before reusing the code across groups.
