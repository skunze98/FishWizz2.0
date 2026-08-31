# Walleye/Sauger Pilot — draft-only, conditionally approved

**Gate 6 (2026-08-29): fishing-research pass, schema frozen at commit 3c60444.** No schema files changed this pass -- the user's instruction was "stop adding infrastructure and perform the fishing research." Fields were reclassified into three evidence obligations (`pilot/decision-critical-fields.mjs`): **A** external_evidence_required (biology/behavior/season/temp/depth/structure/works_when/fails_when/conservation), **B** traceable_derivation_allowed (equipment sizing, platform, casting access, next_try -- a real derivation suffices, no independent citation required), **C** intrinsic_definition (bait_composition, rigging_instructions -- consistency-validated, never citation-required, ending the "pointless claim inflation" the user flagged). A shared `equipmentDerivation()` (real Norrik rod-power/line/lure-weight chart) resolved line_test_lb/lure_weight_oz for all 15 tactics at once. 6 real, fetched, mostly genuinely-independent sources were added: Wisconsin DNR (independent of Minnesota DNR -- corroborates spawn temperature and turbidity behavior on 4 tactics), a winter-limnology source (under-ice thermal stratification), an independent angling publication on rain/rising-water river tactics (closed a previously totally-unsupported tactic, t14), and MN DNR's winterkill page (grounds t15's dissolved-oxygen proxy). Coverage: **A 62%** (up from 19%), **B 78%** (up from 0%), **C 100%** consistency-pass. Readiness: still 0/15 `ready_for_human_review` (t8 `blocked_by_safety_gap` pending a real paddle-sport safety review -- see gate 7's `reviewer-package-safety.md`, not a permanent block; the other 14 have real, individually-listed remaining gaps, mostly exact temp/depth numbers and retrieve cadence). Full numbers in `pilot/gate6-report.md`.

**Gate 5 (2026-08-29): confidence-semantics fix + decision-critical research pass.** Gate 4's confidence computation had a real bug: it treated "at least one externally_sourced claim" as sufficient for the top corroboration tier, which meant a single MN DNR page could get labeled the same as genuine independent consensus. Fixed: `confidence_enum` and `evidence_type_enum` are now 7-tier (`peer_review_supported` > `independently_corroborated` > `official_guidance` > `expert_synthesis` > `anecdotal` > `estimated` > `unsupported`), with a real `areSourcesIndependent()` check (`pilot/independence.mjs`) enforcing that two DIFFERENT DNR pages do NOT count as independent corroboration — only genuinely different organizations do. 4 new genuinely independent sources were fetched this pass (USFWS, a peer-reviewed Journal of Fish Biology paper on the Rainy River, a peer-reviewed Journal of Great Lakes Research lure-color/turbidity paper, Penn State/CJFAS), lifting 5 tactics to real `peer_review_supported`/`independently_corroborated` status. Every tactic also now has a `readiness` field (`ready_for_human_review`/`research_incomplete`/`blocked_by_conflicting_evidence`/`blocked_by_safety_gap`/`blocked_by_regulation_gap`), computed against an expanded, explicit decision-critical field list (`pilot/decision-critical-fields.mjs`) — 14 of 15 tactics are honestly `research_incomplete` and 1 (`t8`, kayak/canoe) is `blocked_by_safety_gap`; **0 are ready_for_human_review this pass**, which is the correct, expected outcome given the expanded field list, not a failure. See `pilot/gate5-report.md` for full numbers.

**Gate 4 (2026-08-29): evidence-remediation pass applied.** The semantic-quality audit (`semantic-audit-report.md`, `semantic-audit-part2.md`) found 88% of the gate-3 pilot's "100% evidence coverage" was auto-generated boilerplate or a non-independent placeholder source. This has been remediated: every claim is now explicitly `externally_sourced`, `derived_synthesis`, or an honest `unsupported_gap` (see `../MANIFEST.md`'s gate-4 addendum and `post-remediation-audit-report.md` for the full before/after numbers). The pre-remediation state is preserved at git tag `pilot-baseline-pre-remediation` (commit `5131a65`). Real coverage is now 31% (up from 12%), honestly — most equipment tackle numbers remain unsupported by any fetched source and are marked as such, not hidden.


**Status: draft, not reviewed, not approved, not published, not in production.** Every record in `pilot-data.json` has `record_status: "draft"`; every claim is `reviewer_status: "unreviewed"`. Confirmed by real query against a live Postgres instance in `db-test-pilot.mjs`.

## Contents
2 species (walleye, sauger) · 4 sources (3 real MN DNR pages fetched this session + 1 explicitly-labeled `expert_consensus` placeholder for general, non-DNR-sourced technique framing) · 126 claims (one per covered fact-bearing field, per the gate-3 evidence model) · 7 presentations · **15 tactics** · 5 regulation provisions.

Coverage: shore/dock/wading/boat/kayak/canoe/ice all represented · spring/summer/fall/winter(ice) all represented · live-bait and artificial-only tactics both present · clear/stained/turbid clarity all represented · **one genuine sourced conflict** (t4 vs t5 — MN DNR's own ice-fishing-walleye page frames an aggressive jigging-spoon and a near-motionless deadstick jig as competing approaches under identical conditions without declaring a winner).

## Run it
```bash
cd design/angling-knowledge-base/v3        # npm install already done here (ajv, ajv-formats, pglite)
node pilot/generate-pilot.mjs              # regenerates pilot-data.json
node pilot/validate-pilot.mjs              # real AJV + parity + evidence-coverage + safety-language checks: 178/178 pass
node pilot/db-test-pilot.mjs               # real Postgres load + draft confirmation + revision/rollback: 18/18 pass
node pilot/run-scenarios.mjs               # 15 scenarios through the real reference scorer -> scenarios-output.txt
```

## Key findings from running the pilot through 15 scenarios

- **The genuine conflict resolves exactly as designed, not as a bug**: under identical ice conditions (scenario 7), the aggressive-spoon and deadstick tactics score *identically* (0.402 each, same confidence). This is correct — a real disagreement about technique, not about measurable conditions, cannot and should not be broken by the condition-scorer. Both surface; neither silently wins; the `conflicts_with` note explains why.
- **A real coverage gap, not a bug**: scenario 1 (shore, walleye, post-cold-front, no live bait) finds only one surviving candidate, and it scores 0.000 — the pilot has no tactic that actually constrains `weather_front`, `barometric_pressure_trend` for a shore/artificial presentation. This is an honest gap in a 15-tactic pilot, not a scorer defect; a full species buildout would need a dedicated post-frontal pattern.
- **Sparse-tactic inflation did not reproduce**: tactics with fewer stated constraints did not out-rank better-specified ones in any of the 15 runs — the pool-density normalization from the gate-3 scorer design held up under real data.
- **Hard filters worked correctly** in every constrained scenario (`no_live_bait`, `artificial_only`, `no_boat`, species mismatch) — verified by inspecting the `excluded` list in `scenarios-output.txt` for scenarios 1, 5, 10, 12.
- The reference scorer (`scorer.mjs`, version `pilot-reference-0.1.0`) is explicitly a **pilot-validation tool, not the production scorer/ranking implementation** — that remains a listed production prerequisite.

## What this pilot does NOT demonstrate (by design, per the approval scope)
- Review/approval workflow (no claim was reviewer_confirmed; no tactic was approved) — correctly left in draft throughout.
- RLS policies, PostGIS, or the real Supabase dev schema (still PGlite, per the approval's own listed prerequisites).
- Production scorer/ranking implementation (the reference scorer above is pilot-only).
- Any write to a production or staging FishWizz database.

Stopping here per the approval scope. Additional species require a new approval.
