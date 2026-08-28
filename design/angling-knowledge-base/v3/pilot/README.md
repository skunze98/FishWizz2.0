# Walleye/Sauger Pilot — draft-only, conditionally approved

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
