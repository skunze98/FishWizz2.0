# Gate 7 -- Expert Consultation Packets (index)

**No schema, migration, species, or tactic-count changes this pass.** `pilot-data.json` is
byte-identical to commit `a114e97`. This pass produced consultation/tracking artifacts only.

| File | What it is |
|---|---|
| `consultation-packets.md` | One review sheet per tactic (15), computed from the live data -- everything sourced/derived/unsupported for that tactic, side by side. |
| `relationship-graph.md` | Full outgoing/incoming next_try/alternative graph for all 15 tactics, plus a real structural-candidate search (not invention) for the 6 tactics with no relationship. |
| `expert-consultation-workflow.md` | The 4 workflow states (`awaiting_expert_consultation` / `expert_consultation_received` / `ready_for_human_review` / `human_review_completed`), tracked OUTSIDE the frozen schema, plus the expert-contribution capture template. |
| `consultation-status.json` | Current workflow state per tactic (all 15 = `awaiting_expert_consultation`; `expert_contributions: []` on every one -- no expert has responded yet). |
| `reviewer-package-fishing.md` | Package A -- for an MN/WI walleye/sauger guide or fisheries professional. Covers all 15 tactics' technique content. |
| `reviewer-package-safety.md` | Package B -- for a paddle-sport/cold-water safety reviewer. Covers t8's kayak/canoe safety question ONLY, kept separate from fishing-technique review per instruction 5. |

## What was explicitly NOT done this pass (per instruction)

- No expert questions were self-answered.
- No new tactic or species was generated, including to fill relationship-graph gaps.
- No schema field was added for `workflow_state` or expert contributions -- tracked in
  `consultation-status.json` instead, with the schema-change path logged as a future step in
  `expert-consultation-workflow.md`.
- t8's safety gap is described as pending review, not permanent (gate-6's report text has been
  corrected, not silently rewritten -- see the errata note at the top of `gate6-report.md`).

## Stop condition

Per instruction: stopping after these packets and the relationship-gap report. The next real step
is external -- sending Package A and Package B to actual qualified reviewers -- which is outside
what this pipeline can do on its own.
