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

## Explicit statement

**The migration in this directory has not been applied to any FishWizz database.** No table in this design exists in the live Supabase project. No production code path reads from or writes to any table named here. This manifest and the pilot data described in `pilot/` are draft-status design artifacts for review only.
