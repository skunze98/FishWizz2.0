# Expert-consultation workflow (gate 7)

**Schema is frozen this pass** (per instruction). Everything below is a design/tracking layer
built OUTSIDE `schemas/*.json` and `migration.sql` -- tracked separately in
`pilot/consultation-status.json` and this document, not as new fields on `tactic` or `claim`.
Formalizing this as real schema columns (`workflow_state`, an `expert_contribution` table, etc.)
is a real, logged next step requiring its own schema-change approval -- not done here.

## Why a separate axis from `readiness`

`readiness` (`ready_for_human_review` / `research_incomplete` / `blocked_by_conflicting_evidence`
/ `blocked_by_safety_gap` / `blocked_by_regulation_gap`) measures **evidence completeness**:
are the A/B/C obligations satisfied. It says nothing about whether a qualified person has actually
looked at the record. The workflow states below measure **review process state** -- a tactic can
be `research_incomplete` AND `awaiting_expert_consultation` at the same time (that's every tactic
in this pilot right now), and reaching `readiness: ready_for_human_review` does not, by itself,
change the workflow state.

## The four workflow states

1. **`awaiting_expert_consultation`** -- default state. No practitioner has reviewed this tactic
   yet. All 15 tactics start here (see `pilot/consultation-status.json`).
2. **`expert_consultation_received`** -- at least one expert contribution has been recorded for
   this tactic (see the contribution template below). This does NOT mean the tactic is approved,
   corroborated, or even that the contribution was positive -- it only means input exists and is
   captured. A tactic can receive contributions from multiple experts, and their contributions can
   disagree with each other and with the existing sources.
3. **`ready_for_human_review`** -- the union of: `readiness == ready_for_human_review` (all A/B/C
   obligations satisfied, no safety/legality gap, valid next_try/alternative) AND workflow state is
   at least `expert_consultation_received` for every field where expert judgment was solicited AND
   no expert contribution flagged an unresolved conflict. This is a COMPUTED gate, not something
   set by hand -- see instruction 7's entry criteria, restated in section 4 below.
4. **`human_review_completed`** -- an actual qualified human reviewer (not an AI, not this
   pipeline) has completed a formal review pass and recorded a disposition. This is the terminal
   state before any publish decision, which remains entirely out of scope for this pilot.

**Expert consultation is never, by itself, sufficient to advance a tactic to
`ready_for_human_review`.** A single practitioner's input is testimony to be weighed alongside the
existing sources, not a new independent corroborating source, and never converts an
`external_evidence_required` gap into "supported" on its own (see the contribution template's
`corroborates_or_conflicts` field, and gate-6's confidence rules, which this pass does not alter).

## Expert-contribution capture template

Every real future expert contribution should be recorded with ALL of the following (this is
the template/shape referenced by the reviewer packages; not yet real data since no external
expert has reviewed anything this pass):

```js
{
  reviewer_name: string,
  credentials_and_experience: string,      // e.g. "MN-licensed fishing guide, 15 seasons on Mille Lacs/Winnibigoshish"
  geographic_experience: string,           // which specific MN/WI waters -- generic "years of experience" is not enough
  date: 'YYYY-MM-DD',
  tactic_id: uuid,                         // the exact tactic reviewed
  field_paths_reviewed: string[],          // exact fields, e.g. ["applies_when.depth_ft", "retrieve.pause_seconds"]
  recommendation_or_correction: string,    // the exact substance -- a number, a range, a qualitative correction
  rationale: string,                       // WHY, not just what
  confidence: 'high' | 'moderate' | 'low', // the EXPERT's own stated confidence in their own input
  conflicts_of_interest: string | null,    // manufacturer affiliation, sponsorship, guide-service promotion, etc. -- null only if explicitly asked and denied
  permission_to_use: boolean,              // explicit, not assumed
  corroborates_or_conflicts: 'corroborates_existing_source' | 'conflicts_with_existing_source' | 'fills_a_gap_no_existing_source' | 'mixed',
}
```

A contribution missing `permission_to_use: true` must not be incorporated into any published
material. A contribution that conflicts with an existing real source does not overrule it --
both are recorded, and the conflict is itself a decision point for `human_review_completed`, not
something this pipeline resolves automatically.

## Current state

Every one of the 15 tactics is `awaiting_expert_consultation` as of this pass (see
`pilot/consultation-status.json`). No expert has been contacted or has responded. This document
and `pilot/consultation-packets.md` are what would be SENT to reviewers -- nothing here represents
a received consultation.
