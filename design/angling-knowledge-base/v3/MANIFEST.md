# FishWizz Angling Knowledge Base — Design v3 Manifest

**Schema version:** `3.0.0`
**Created:** 2026-08-28
**Status:** Design-time artifacts only. **The migration in this directory has NOT been applied to any FishWizz database — local, staging, or production.** Nothing in this directory is imported or referenced by the running application (`src/`, `public/`, `supabase/schema/public.sql`) as of this commit.

This is the sole canonical schema for this project as of gate 3. An earlier "gate 2" design (embedded inline in the readable research artifact) is superseded and archived there for history only — it must never be implemented.

## Files and checksums (SHA-256)

| File | SHA-256 | Bytes |
|---|---|---|
| `schemas/shared-definitions.schema.json` | `ec03198415acced384e527bfd24cbf91962e3f8040bf4b5ea5ad19f66940154d` | 16868 |
| `schemas/species.schema.json` | `3b4414f5da79065061f08a72597c24af952264d4290d541d5f5248622373f49d` | 2127 |
| `schemas/angling-category.schema.json` | `2fa9d024d909b6212dbfbda57003da9e80697d96b457e783a66889c1fcc27c2c` | 807 |
| `schemas/presentation.schema.json` | `e549ae613427e59fc6dcbbda5d21a8e1a7de2ff34f03fe4e5abcafd03f298c0f` | 1669 |
| `schemas/gear-compatibility-profile.schema.json` | `5de93ee3da05975555aaaeb46246990ccc356c009b2056d47268e64409a2b040` | 3795 |
| `schemas/tactic.schema.json` | `3297eb6a455a936e93de5527ca28b2e0997570588618f9966ed424e9ddb2016d` | 8597 |
| `schemas/regulation.schema.json` | `4da5a69a568e51c647b1869adc73382c032cfe14731400a9f47a4a3bef244a6f` | 9663 |
| `schemas/source.schema.json` | `e8b6f0980b86e68329e97b95941a4ef692d59821ac207abc10063eca0737c89e` | 1761 |
| `schemas/claim.schema.json` | `559f360cf39e21792ad46b8621e320077a7478114a7de3516ec12c783c4d833b` | 2373 |
| `schemas/mission-recommendation.schema.json` | `8ae38bd4eef1f32e8066d9c74b00fd531e534d13288a44bb277edaf7fd4b6426` | 4056 |
| `migration.sql` | `573a0c826b51ddef3314edf67bbb891ca3bed9b708924a5403cf388fc0205483` | 19777 |
| `ajv-check.mjs` | `22e1844d824f87679e159e00b59234692213ad227afc7273eee2ca01fbd6194c` | 1378 |
| `build-and-validate.mjs` | `d387f4126b94248818ebe0f977b38c0f07a94a6c2ce04cf732d915c32030ab6f` | 24910 |
| `db-test.mjs` | `2e880713e338c4fe74538b2c823627ef785338e120454a4fddba5a321964b383` | 12363 |

Verify with (from this directory):
```bash
node -e "const fs=require('fs'),c=require('crypto');for(const f of process.argv.slice(1)){console.log(c.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),f)}" schemas/*.schema.json migration.sql *.mjs
```

## Test commands and expected results

```bash
npm install                 # ajv, ajv-formats, @electric-sql/pglite (devDependencies)
npm run test:ajv            # -> "PASSED: 0 schema compilation failure(s)." (10/10 schemas)
npm run test:records        # -> "58 checks run, 0 failed. RESULT: PASS"
npm run test:db             # -> "45 checks run, 0 failed. RESULT: PASS -- real Postgres migration + constraints verified against a live (PGlite/WASM) database."
```

All three were run and passed at the time of this manifest, against a real AJV Draft 2020-12 validator (with `ajv-formats` and `$data` enabled) and a real, isolated Postgres instance (PGlite — Postgres compiled to WASM). Full transcripts are in this session's own record; re-running the three commands above reproduces them.

## Known production prerequisites (not yet done — tracked, not implied complete)

- Complete revision tables for **all** mutable entities (currently: `angling_tactic_revision`, `regulation_provision_revision`, `angling_species_revision`, `angling_source_revision` exist in the migration; `angling_claim_revision`, `angling_presentation_revision`, `gear_compatibility_profile_revision` follow the identical pattern but are not yet written).
- Tested Row-Level Security policies (specified in prose only so far).
- A working scorer/ranking implementation (the pilot in `pilot/` runs a real, but not production-grade, reference scorer — see that directory's own README).
- Testing against FishWizz's complete development Supabase schema, including PostGIS, not only PGlite (PGlite does not include PostGIS; `geography(Point,4326)` columns and the real `waterbodies`/`fishing_sessions` FKs referenced in comments throughout the migration have not been tested against the actual schema).
- Human review/approval workflow (the `reviewed_by`/`approved_by` columns and CHECK constraints exist and are DB-tested; the actual review UI/process does not exist).
- Persistent `mission_recommendation` integration into the real Mission-build flow (`mission-v3.js` / `get_mission_plan_v3`).
- Resolution of the FishWizz mission/gear persistence defects already found and fixed earlier this session (P0 mentor-pro.js loop, P1 gear/tackle `luresLoaded` race) — those fixes are already live in production and unrelated to this schema, listed here only because they were named as a standing prerequisite.

## Gate 4 addendum — evidence-remediation pass (2026-08-29)

Following the semantic-quality audit (`pilot/semantic-audit-report.md`, `pilot/semantic-audit-part2.md`, commit `5131a65`, tagged `pilot-baseline-pre-remediation`), the schema and pilot data were revised to separate real evidence from gaps. Superseded checksums below (files changed this pass); all other rows in the table above are unchanged.

| File | SHA-256 | Bytes |
|---|---|---|
| `schemas/shared-definitions.schema.json` | `cb9ff8c481bcfea207cd3b5d375563c00614ec2e924dbdae305e45bdcf772836` | 20838 |
| `schemas/claim.schema.json` | `6e853d9021cdb34a42a40e190bf91957a975e7a8186ae82559456313e52bef34` | 5069 |
| `schemas/tactic.schema.json` | `8c26fdd9f038eb7d4c88b281f2529e4ad3c173b5f656aad7d94069bedc950438` | 9066 |
| `schemas/regulation.schema.json` | `94c2d93fed4867365576ee819adb1728174b4e1d1a6d184d6c7f8e332f8fd58e` | 10548 |
| `migration.sql` | `9ff9dbc583ef3eb77ad99b979644141a9aebacb03d274196ce7b067af7d1e682` | 21219 |
| `build-and-validate.mjs` | `9e3b1667dfea47de19d18970851240a625962cd5640a7a1657faf977eb219353` | 25411 |
| `db-test.mjs` | `2ded4790f9dce310a15156a72330a33be602e034e5279daa1647e481e1c3cd1c` | 12636 |

**What changed:**
- `claim` gained `evidence_status` (externally_sourced / derived_synthesis / unsupported_gap), `derived_from_claim_ids`, `derivation_explanation`; `source_id`/`evidence_type` are now nullable (only for non-externally_sourced claims); real DB CHECK constraints enforce the shape of each status (`angling_claim_externally_sourced_shape`, `_derived_synthesis_shape`, `_derived_expert_consensus_needs_two`, `_unsupported_gap_shape`) — all four have a real negative test in `pilot/db-test-pilot.mjs`.
- `confidence_enum` gained a fifth tier, `unsupported` (weight 0 in the reference scorer).
- `tactic.bait_method_tags` (a single flat array conflating composition and method, and ambiguous when a tactic carried both `live_bait` and `artificial_only`) is replaced by `bait_composition` (single mutually-exclusive `mode` + `components`) and `presentation_method_tags`.
- `regulation_provision.value` for `targeting_permitted`/`catch_and_release_permitted`/`harvest_permitted` is now `{determination: confirmed_permitted|confirmed_prohibited|unknown, note, official_lookup_url}`, replacing a bare boolean that could not represent "not established."
- The pilot generator (`pilot/generate-pilot.mjs`) no longer auto-generates `expert_synthesis` filler claims; every one of the pilot's 136 claims (up from 126) is explicitly authored as `ext(...)`, `derived(...)`, or `gap(...)`. Real research this pass added 2 new real MN DNR sources (walleye biology/ID page, the MCV sauger profile) and the real FishWizz `waterbodies.id` for Mille Lacs Lake.
- `pilot/scorer.mjs` gained a `bait_composition`-based hard filter (replacing the old ambiguous one) and an `insufficient_safety_data` result path for kayak/canoe under high wind, per `safety/README.md`.

**Test results after remediation** (all re-run against the changed schemas/migration): `npm run test:ajv` 10/10 · `npm run test:records` 59/59 · `npm run test:db` 45/45 · `pilot/validate-pilot.mjs` 202/202 · `pilot/db-test-pilot.mjs` 24/24. Full detail in `pilot/post-remediation-audit-report.md`.

**Still not applied to production.** This addendum does not change the top statement below.

## Gate 5 addendum — confidence-semantics fix + decision-critical research pass (2026-08-29)

Fixes a real bug in the gate-4 confidence computation: it treated "at least one externally_sourced claim" as sufficient for the top corroboration tier, so a single MN DNR page could be labeled the same as genuine independent consensus. See `pilot/gate5-report.md` for the full report (coverage by decision-critical/descriptive split, readiness per tactic, source-independence report, confidence-change table, remaining gaps).

| File | SHA-256 | Bytes |
|---|---|---|
| `schemas/shared-definitions.schema.json` | `adca7f1d37fc5b34e223dae9b7ebdcfd70fddbc3181fe2b897c1333c1a33188e` | 22880 |
| `schemas/tactic.schema.json` | `ac10248af323eaecf3cf5ac6030fa49eae261b1c78753834e5f1acc425ac3c1b` | 9448 |
| `schemas/source.schema.json` | `092bdbbf176ffe542a797f8ec629ce7d6a0f1831b9fa778953da22e5cd70f21f` | 2199 |
| `migration.sql` | `291811353bce505cadf9ec56c71127b6fc894b71e864e3a3ed669f33efe6463f` | 21567 |

(`schemas/claim.schema.json` is unchanged this pass -- its evidence_status/derived_from_claim_ids machinery from gate 4 needed no structural change, only the shared enum values it references via `$ref`.)

**What changed:**
- `confidence_enum`/`evidence_type_enum` replaced with a 7-tier vocabulary (`peer_review_supported` > `independently_corroborated` > `official_guidance` > `expert_synthesis` > `anecdotal` > `estimated` > `unsupported`), separating "one authoritative agency" from "genuine multi-organization consensus" -- these were wrongly conflated in gate 4.
- New `pilot/independence.mjs`: a real `areSourcesIndependent()` check (organization, parent_organization, title-similarity for republished articles) used by BOTH the generator (to compute real confidence) and the validator (to re-verify it independently). `source.schema.json` gained `parent_organization`.
- New `pilot/decision-critical-fields.mjs`: the fixed, explicit list of decision-critical vs. descriptive tactic fields per instruction 2, expanded from the ~8 fields gate 4 tracked to 16 (adds platform, water_environment, season.biological_stage, structure, cover, current, bait_composition, conservation_notes).
- `tactic` gained `readiness`/`readiness_reason` (5-value enum: ready_for_human_review/research_incomplete/blocked_by_conflicting_evidence/blocked_by_safety_gap/blocked_by_regulation_gap), computed by the generator and independently re-verified by the validator from raw claims (0 mismatches).
- 4 new genuinely independent (non-MN-DNR) sources fetched and cited: U.S. Fish and Wildlife Service, a peer-reviewed Journal of Fish Biology paper (Haxton et al. 2019, Rainy River sauger/walleye coexistence), a peer-reviewed Journal of Great Lakes Research paper (turbidity/lure-color), and a Penn State/Canadian J. Fisheries and Aquatic Sciences paper (fetched, not yet wired into a claim). These are what make real `independently_corroborated`/`peer_review_supported` labels possible at all in this pilot.
- t9's `next_try` (→t2) was manually re-reviewed against 6 structural criteria (species, platform, water_environment, target-is-clear-water, depth overlap, temp overlap) -- all pass, verified by `pilot/validate-pilot.mjs` section 11, not just asserted.

**Test results after this pass**: `test:ajv` 10/10 · `test:records` 61/61 · `test:db` 45/45 · `pilot/validate-pilot.mjs` 309/309 · `pilot/db-test-pilot.mjs` 25/25.

**Readiness**: 0/15 tactics `ready_for_human_review`, 14 `research_incomplete`, 1 (`t8`) `blocked_by_safety_gap`. This is the expected, honest result of expanding the decision-critical field list and targeting specific high-value gaps rather than exhaustively re-researching all 15 tactics x 16 fields in one pass -- not a regression.

## Gate 6 addendum — fishing-research pass, schema frozen (2026-08-29)

Per explicit instruction, the schema was frozen at commit `3c60444` for this pass -- **no `schemas/*.json` or `migration.sql` changes**. All work is pilot-data content (new claims, new sources, obligation-aware readiness) plus three new pilot-only helper modules: `pilot/decision-critical-fields.mjs` (adds the A/B/C evidence-obligation classification and `checkIntrinsicConsistency()`), `pilot/next-try-validation.mjs` (the real `validateNextTry()` 12-criteria check), and updated `pilot/generate-pilot.mjs`/`pilot/validate-pilot.mjs` logic. Full report: `pilot/gate6-report.md`.

**Coverage**: A (external_evidence_required) 62%, up from 19%. B (traceable_derivation_allowed) 78%, up from 0%. C (intrinsic_definition) 100% consistency-pass, 15/15 tactics. Readiness: 0/15 `ready_for_human_review` (t8 permanently `blocked_by_safety_gap`; 14 others have real, specific, individually-tracked remaining gaps).

**Test results**: `test:ajv` 10/10 (unchanged, schema frozen) · `test:records` 61/61 (unchanged) · `test:db` 45/45 (unchanged) · `pilot/validate-pilot.mjs` 335/335 · `pilot/db-test-pilot.mjs` 25/25.

## Explicit statement

**The migration in this directory has not been applied to any FishWizz database.** No table in this design exists in the live Supabase project. No production code path reads from or writes to any table named here. This manifest and the pilot data described in `pilot/` are draft-status design artifacts for review only.
