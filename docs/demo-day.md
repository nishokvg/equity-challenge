# Demo day walkthrough

1. Run Ollama and `npm run dev`. Open localhost:3000. Select Presentation view and Local model. Use Reset demo to start with the rural/urban comparison.
2. Run the comparison. Point to required retrieval and validation, then the model-selected comparison. Explain 12.1% versus 4.6% as unweighted tract averages, not causal evidence.
3. Ask “Rank the highest gaps and inspect the top tract”. Let the model choose its calls. If it stops early, show the missing requirement, bounded completion retry, and Partial status. Do not describe Partial as task success.
4. Inspect the selected top tract’s “2 of 3 components available” label and “Unknown reference” road component. Scores are a real-data regional baseline, not official Zindi scores.
5. Open Architecture. Follow required preflight → model tool loop → completion check → human review. Explain the two feedback paths: invalid arguments and missing requested evidence.
6. Open Agent evaluations. Distinguish controlled tests from the dated live batch. Expand the controlled recovery example and explicitly call it a scripted adapter test. Report failed live requests honestly.
7. Export the audit. Its status, model, timestamp, completion requirements and replay label travel with the evidence.

If live inference fails, use Load recorded replay. State that this is a recorded local run, not a model currently executing. The replay’s successful tool results were independently recomputed against the saved snapshot. The video link is another fallback. Hosted preview offers guided execution and the recorded replay; laptop Ollama is accessible only to the local application.

Completion checking is scoped to supported intents; it is not a universal verifier of every English instruction. The existing public competition-code sharing issue is unchanged by these demo enhancements.
