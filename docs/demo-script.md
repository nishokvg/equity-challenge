# Four-minute Gen Academy recording script

## Prepare once

- Request full names, emails, point person and Academy team number first.
- Open the actual submission form. It currently says May 2026 Cohort and asks for team number, names, one breakout document (max 10 MB), GitHub link and Drive recording link. Verify the cohort with the organizer; do not invent a team number.
- Run `npm run dev`, warm the installed Ollama model, open localhost and select **Local model**. The hosted preview uses guided mode.
- Budget 15 minutes for setup/dry run, 10 for one recording and playback, and 20 for upload and access verification. Do not repeat a take for polish.
- Keep private team contact information out of the screen recording. The public source-sharing boundary remains unresolved; see README.

## 0:00–0:30 — Problem and disclosure

“EquityMap helps a mapping analyst investigate uneven coverage and follow the evidence before acting. These are real observations from 591 Northern California tracts. The displayed scores are our independent regional baseline, not official Zindi scores. This covers one of four regions, and undefined components are excluded rather than filled with zero.”

## 0:30–1:30 — A live decision

Show localhost and the **Local model / llama3.1:8b** label. Run **Compare rural and urban tracts**. While it runs:

“Retrieval and validation are mandatory steps. The local model then chooses from approved read-only analytical tools. It cannot change source data or submit an entry.”

Expand `compare_groups` after the result appears.

“The model selected the comparison tool. Code produced these numbers: about 12.1% for rural tracts and 4.6% for urban tracts, a ratio of 2.64. These are unweighted tract averages using our stated grouping threshold; they show an association to investigate.”

If this take fails, say what the error shows. Do not switch to guided mode while describing it as autonomous. Do not force or promise invalid-parameter recovery. If recovery occurs naturally, expand both rejected and corrected calls. An earlier saved trace must be explicitly introduced as an earlier run.

## 1:30–2:15 — Evidence and missing data

Select tract **06061021043**, and expand **View observations and calculation**. Keep the successful comparison available; inspect this through the UI rather than launching another model request.

“This tract has no named-road reference, so its road gap is undefined. The composite averages only two defined components. An apparent mapping gap does not prove that a physical service is absent. Across this snapshot, 218 tracts have an undefined road component.”

## 2:15–3:15 — Architecture and evaluations

Open **Architecture**, then **Methodology & checks**.

“The offline data process produces a versioned snapshot. Curated lexical retrieval supplies source-linked definitions. The bounded model selects tools; tool results supply the findings. We check identifiers, bounds, references and numerical consistency. These six checks passing establish internal consistency, not official accuracy or reliable completion of every user instruction.”

“During the dry run, the model skipped a requested follow-up inspection and another prompt stopped without an analytical tool. That exposed a gap in our task-completion evaluation. Our next evaluation needs to measure whether every requested step was actually performed.”

## 3:15–4:00 — Output and human review

Click **Export audit** after a successful run and open the downloaded report. If the live run failed, describe the export as selected-tract evidence, not a successful agent report.

“The report preserves evidence, sources and limitations for human review. The source repository and this recording are the deliverables; the hosted preview is only a convenience. Next we will strengthen task-completion checks and expand regional coverage. Nothing is automatically submitted to the competition.”

## After the one take

Play the recording once to confirm picture and narration. Upload it to Drive, set General access to **Anyone with the link — Viewer**, and check the exact link while signed out. Do not submit the form until the roster, cohort/form confirmation, source-sharing boundary and recording link are resolved. Only one team member submits.
