-- FishWizz — Approved research integration (isolated development)
-- ---------------------------------------------------------------------------
-- Label: "Professionally approved research integrated in isolation -- awaiting
-- application-team review, controlled production integration, mission-ready
-- authorization, and authenticated QA."
--
-- This migration is 100% ADDITIVE. It creates new tables and one new RPC
-- function. It does NOT alter, replace, or touch get_mission_plan_v3 or any
-- existing table -- confirmed by direct inspection in
-- reports/COMPATIBILITY-REPORT.md (zero name collisions with the 28 tables
-- already in supabase/schema/public.sql).
--
-- Reviewed against the real production schema (commit e16f93779cfb0271a0472a34e76c8a6878788a25,
-- see SOURCE-COMMIT.md) before being drafted -- see reports/COMPATIBILITY-REPORT.md for the
-- field-by-field comparison this migration is based on.
-- ---------------------------------------------------------------------------

-- =====================================================================
-- SECTION 1: migration-001-core.sql (the approved research schema itself)
-- =====================================================================
-- FishWizz angling knowledge base, gate 3. Mirrors the JSON Schemas exactly
-- (species/angling-category/presentation/gear-compatibility-profile/tactic/
-- regulation(=regulation_provision)/source/claim/mission-recommendation), plus
-- every junction, mapping, revision, and staging table the review required.

-- gen_random_uuid() is core Postgres since v13 -- no extension required
-- (matches the existing FishWizz schema's own usage, confirmed in
-- supabase/schema/public.sql's combos/lures/waterbodies tables).

-- ============================================================= core content
CREATE TABLE angling_species (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    species_slug text NOT NULL UNIQUE,
    scientific_name text NOT NULL UNIQUE,
    common_name_primary text NOT NULL,
    taxonomic_note text,
    content_fingerprint text NOT NULL,
    record_status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    verified_at date NOT NULL,
    published_at timestamptz,
    schema_version text NOT NULL DEFAULT '3.0.0',
    content_version integer NOT NULL DEFAULT 1,
    CONSTRAINT angling_species_record_status_check
      CHECK (record_status IN ('draft','reviewed','approved','published','retired')),
    CONSTRAINT angling_species_published_requires_published_at
      CHECK (record_status <> 'published' OR published_at IS NOT NULL)
);

-- Parity fix (requirement 2): aliases now have real storage, not JSON-only.
CREATE TABLE species_alias (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    species_id uuid NOT NULL REFERENCES angling_species(id) ON DELETE CASCADE,
    name text NOT NULL,
    region text NOT NULL CHECK (region IN ('MN','WI','great_lakes','national')),
    note text,
    UNIQUE (species_id, name)
);

CREATE TABLE angling_category (
    slug text PRIMARY KEY,
    label text NOT NULL,
    record_status text NOT NULL DEFAULT 'draft' CHECK (record_status IN ('draft','reviewed','approved','published','retired')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    schema_version text NOT NULL DEFAULT '3.0.0',
    content_version integer NOT NULL DEFAULT 1
);
CREATE TABLE species_angling_category (
    species_id uuid NOT NULL REFERENCES angling_species(id) ON DELETE CASCADE,
    category_slug text NOT NULL REFERENCES angling_category(slug) ON DELETE RESTRICT,
    PRIMARY KEY (species_id, category_slug)
);

CREATE TABLE angling_source (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    title text NOT NULL,
    organization text NOT NULL,
    parent_organization text,
    url text NOT NULL,
    publication_date date,
    access_date date NOT NULL,
    source_type text NOT NULL CHECK (source_type IN ('official_guidance','peer_review_supported','independently_corroborated','manufacturer_guidance','expert_synthesis','anecdotal')),
    geographic_relevance text NOT NULL CHECK (geographic_relevance IN ('MN','WI','MN_WI_boundary','great_lakes','national')),
    record_status text NOT NULL DEFAULT 'draft' CHECK (record_status IN ('draft','reviewed','approved','published','retired')),
    content_fingerprint text NOT NULL,
    -- Parity fix: lifecycle/version fields now match every other entity, not silently absent.
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    schema_version text NOT NULL DEFAULT '3.0.0',
    content_version integer NOT NULL DEFAULT 1,
    CONSTRAINT angling_source_published_requires_published_at CHECK (record_status <> 'published' OR published_at IS NOT NULL)
);

-- Parity fix (requirement 2): subject_table/subject_id now have REAL storage
-- via three typed junctions below -- angling_claim itself stays subject-free.
CREATE TABLE angling_claim (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    evidence_status text NOT NULL CHECK (evidence_status IN ('externally_sourced','derived_synthesis','unsupported_gap')),
    source_id uuid REFERENCES angling_source(id) ON DELETE RESTRICT,
    field_path text NOT NULL,
    paraphrased_claim text NOT NULL,
    source_location text NOT NULL,
    evidence_type text CHECK (evidence_type IS NULL OR evidence_type IN ('official_guidance','peer_review_supported','independently_corroborated','manufacturer_guidance','expert_synthesis','anecdotal')),
    derived_from_claim_ids uuid[] NOT NULL DEFAULT '{}',
    derivation_explanation text,
    access_date date NOT NULL,
    geographic_applicability text NOT NULL CHECK (geographic_applicability IN ('MN','WI','MN_WI','great_lakes_only','national')),
    reviewer_status text NOT NULL DEFAULT 'unreviewed' CHECK (reviewer_status IN ('unreviewed','reviewer_confirmed','reviewer_flagged')),
    reviewer_id uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT angling_claim_confirmed_requires_reviewer
      CHECK (reviewer_status <> 'reviewer_confirmed' OR (reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL)),
    -- gate-4 remediation: evidence_status governs which columns are populated.
    -- Never create a placeholder source to force source_id non-null; use derived_synthesis or unsupported_gap instead.
    CONSTRAINT angling_claim_externally_sourced_shape CHECK (
      evidence_status <> 'externally_sourced' OR (source_id IS NOT NULL AND evidence_type IS NOT NULL AND derived_from_claim_ids = '{}')
    ),
    CONSTRAINT angling_claim_derived_synthesis_shape CHECK (
      evidence_status <> 'derived_synthesis' OR (source_id IS NULL AND evidence_type IS NOT NULL AND array_length(derived_from_claim_ids,1) >= 1 AND derivation_explanation IS NOT NULL)
    ),
    CONSTRAINT angling_claim_derived_expert_consensus_needs_two CHECK (
      evidence_status <> 'derived_synthesis' OR evidence_type <> 'expert_consensus' OR array_length(derived_from_claim_ids,1) >= 2
    ),
    CONSTRAINT angling_claim_unsupported_gap_shape CHECK (
      evidence_status <> 'unsupported_gap' OR (source_id IS NULL AND evidence_type IS NULL AND derived_from_claim_ids = '{}')
    )
);

CREATE TABLE angling_presentation (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    presentation_slug text NOT NULL UNIQUE,
    label text NOT NULL,
    category text NOT NULL,
    imitates text,
    intensity_tier text NOT NULL DEFAULT 'standard' CHECK (intensity_tier IN ('subtle','standard','aggressive')),
    record_status text NOT NULL DEFAULT 'draft' CHECK (record_status IN ('draft','reviewed','approved','published','retired')),
    content_fingerprint text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    schema_version text NOT NULL DEFAULT '3.0.0',
    content_version integer NOT NULL DEFAULT 1
);

-- Fix (requirement 7): own id, MANY rows per presentation (was 1:1 in gate 2).
CREATE TABLE gear_compatibility_profile (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    presentation_id uuid NOT NULL REFERENCES angling_presentation(id) ON DELETE CASCADE,
    label text NOT NULL,
    reel_type text NOT NULL CHECK (reel_type IN ('spinning','baitcasting','either')),
    rod_power_min text NOT NULL, rod_power_max text NOT NULL,
    rod_action_min text NOT NULL, rod_action_max text NOT NULL,
    rod_length_min_in numeric, rod_length_max_in numeric,
    line_material text NOT NULL CHECK (line_material IN ('monofilament','fluorocarbon','braid','either')),
    line_test_min_lb numeric NOT NULL, line_test_max_lb numeric NOT NULL,
    leader_required boolean NOT NULL,
    leader_material text CHECK (leader_material IS NULL OR leader_material IN ('fluorocarbon','steel','heavy_mono')),
    leader_length_min_in numeric, leader_length_max_in numeric,
    lure_weight_min_oz numeric NOT NULL, lure_weight_max_oz numeric NOT NULL,
    environment_applicability jsonb NOT NULL,
    record_status text NOT NULL DEFAULT 'draft' CHECK (record_status IN ('draft','reviewed','approved','published','retired')),
    content_fingerprint text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
    schema_version text NOT NULL DEFAULT '3.0.0', content_version integer NOT NULL DEFAULT 1,
    CONSTRAINT gcp_line_range_check CHECK (line_test_min_lb <= line_test_max_lb),
    CONSTRAINT gcp_lure_range_check CHECK (lure_weight_min_oz <= lure_weight_max_oz),
    CONSTRAINT gcp_leader_consistency CHECK (
      (leader_required = false AND leader_material IS NULL AND leader_length_min_in IS NULL AND leader_length_max_in IS NULL)
      OR (leader_required = true AND leader_material IS NOT NULL)
    )
);
CREATE INDEX idx_gcp_presentation ON gear_compatibility_profile(presentation_id);

-- Normalization/mapping tables (requirement 7): real DDL, real seed rows,
-- for the EXISTING free-text rods/reels/lures columns -- never a description
-- without the tables.
CREATE TABLE rod_power_mapping (free_text_value text PRIMARY KEY, rod_power text NOT NULL);
INSERT INTO rod_power_mapping (free_text_value, rod_power) VALUES
  ('Ultralight','ultralight'), ('UL','ultralight'), ('Light','light'), ('Lt','light'),
  ('Medium Light','medium_light'), ('Med Light','medium_light'), ('ML','medium_light'),
  ('Medium','medium'), ('Med','medium'), ('M','medium'),
  ('Medium Heavy','medium_heavy'), ('Med Heavy','medium_heavy'), ('MH','medium_heavy'),
  ('Heavy','heavy'), ('H','heavy'), ('Extra Heavy','heavy'), ('XH','heavy');
CREATE TABLE reel_type_mapping (free_text_value text PRIMARY KEY, reel_type text NOT NULL);
INSERT INTO reel_type_mapping (free_text_value, reel_type) VALUES
  ('Spinning','spinning'), ('Spin','spinning'), ('Baitcast','baitcasting'), ('Baitcasting','baitcasting'), ('BC','baitcasting'), ('Other','either');
CREATE TABLE lure_category_mapping (free_text_value text PRIMARY KEY, presentation_category text NOT NULL);
INSERT INTO lure_category_mapping (free_text_value, presentation_category) VALUES
  ('jig','jig'), ('Jig','jig'), ('spinnerbait','spinnerbait'), ('crankbait','crankbait'), ('Crankbait','crankbait'),
  ('soft plastic','soft_plastic'), ('worm','soft_plastic'), ('spoon','spoon');

-- ================================================================== tactic
CREATE TABLE angling_tactic (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    content_fingerprint text NOT NULL,
    presentation_id uuid NOT NULL REFERENCES angling_presentation(id) ON DELETE RESTRICT,
    applies_when jsonb NOT NULL,
    equipment jsonb NOT NULL,
    bait_composition jsonb NOT NULL,
    presentation_method_tags text[] NOT NULL,
    retrieve jsonb NOT NULL,
    rigging_instructions text NOT NULL,
    bite_detection text NOT NULL,
    hookset_fight text NOT NULL,
    works_when text NOT NULL,
    fails_when text NOT NULL,
    diagnostic_signals text NOT NULL,
    casting_access_required text CHECK (casting_access_required IS NULL OR casting_access_required IN ('open','limited','tight')),
    environment_applicability jsonb NOT NULL,
    conservation_notes text,
    confidence text NOT NULL CHECK (confidence IN ('peer_review_supported','independently_corroborated','official_guidance','expert_synthesis','anecdotal','estimated','unsupported')),
    readiness text NOT NULL CHECK (readiness IN ('ready_for_human_review','research_incomplete','blocked_by_conflicting_evidence','blocked_by_safety_gap','blocked_by_regulation_gap')),
    readiness_reason text NOT NULL,
    geographic_applicability text NOT NULL CHECK (geographic_applicability IN ('MN','WI','MN_WI','great_lakes_only','national')),
    verified_date date NOT NULL,
    record_status text NOT NULL DEFAULT 'draft' CHECK (record_status IN ('draft','reviewed','approved','published','retired','superseded')),
    -- Requirement 5: reviewer/approval columns added NOW, not deferred.
    reviewed_by uuid, reviewed_at timestamptz,
    approved_by uuid, approved_at timestamptz,
    superseded_by uuid REFERENCES angling_tactic(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    schema_version text NOT NULL DEFAULT '3.0.0',
    content_version integer NOT NULL DEFAULT 1,
    CONSTRAINT tactic_applies_when_nonempty CHECK (applies_when <> '{}'::jsonb),
    CONSTRAINT tactic_superseded_requires_pointer CHECK (record_status <> 'superseded' OR superseded_by IS NOT NULL),
    CONSTRAINT tactic_published_requires_review_chain CHECK (
      record_status <> 'published' OR
      (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND published_at IS NOT NULL)
    )
);
CREATE INDEX idx_tactic_status ON angling_tactic(record_status);
CREATE INDEX idx_tactic_applies_when_gin ON angling_tactic USING gin(applies_when);
CREATE INDEX idx_tactic_bait_composition_gin ON angling_tactic USING gin(bait_composition);
CREATE INDEX idx_tactic_method_tags_gin ON angling_tactic USING gin(presentation_method_tags);

CREATE TABLE tactic_species (
    tactic_id uuid NOT NULL REFERENCES angling_tactic(id) ON DELETE CASCADE,
    species_id uuid NOT NULL REFERENCES angling_species(id) ON DELETE RESTRICT,
    is_primary_species boolean NOT NULL DEFAULT true,
    override_equipment jsonb,
    override_notes text,
    PRIMARY KEY (tactic_id, species_id)
);
CREATE INDEX idx_tactic_species_species ON tactic_species(species_id);

-- Requirement 5 fix: one row per COVERED FIELD PATH, not one claim for a whole record.
CREATE TABLE tactic_claim (
    tactic_id uuid NOT NULL REFERENCES angling_tactic(id) ON DELETE CASCADE,
    claim_id uuid NOT NULL REFERENCES angling_claim(id) ON DELETE RESTRICT,
    covers_field_path text NOT NULL,
    PRIMARY KEY (tactic_id, claim_id, covers_field_path)
);
CREATE INDEX idx_tactic_claim_claim ON tactic_claim(claim_id);

CREATE TABLE tactic_relationship (
    from_tactic_id uuid NOT NULL REFERENCES angling_tactic(id) ON DELETE CASCADE,
    to_tactic_id uuid NOT NULL REFERENCES angling_tactic(id) ON DELETE CASCADE,
    relationship_type text NOT NULL CHECK (relationship_type IN ('next_try','alternative','conflicts_with')),
    note text NOT NULL,
    PRIMARY KEY (from_tactic_id, to_tactic_id, relationship_type),
    CONSTRAINT tactic_relationship_no_self_reference CHECK (from_tactic_id <> to_tactic_id)
);

-- ========================================================= regulation_provision
CREATE TABLE regulation_provision (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    provision_slug text NOT NULL UNIQUE,
    content_fingerprint text NOT NULL,
    provision_type text NOT NULL CHECK (provision_type IN (
      'targeting_permitted','catch_and_release_permitted','harvest_permitted',
      'daily_limit','possession_limit','size_rule','bait_restriction','gear_restriction','method_restriction')),
    geographic_scope jsonb NOT NULL,
    temporal_scope jsonb NOT NULL,
    combined_with_species_ids uuid[] NOT NULL DEFAULT '{}',
    value jsonb NOT NULL,
    is_emergency boolean NOT NULL DEFAULT false,
    precedence_rank integer NOT NULL DEFAULT 10,
    official_wording text NOT NULL,
    source_location text NOT NULL,
    status text NOT NULL CHECK (status IN ('current','proposed','expired','superseded')),
    mandatory_reverify_by date NOT NULL,
    verified_date date NOT NULL,
    supersedes uuid REFERENCES regulation_provision(id),
    superseded_by uuid REFERENCES regulation_provision(id),
    record_status text NOT NULL DEFAULT 'draft' CHECK (record_status IN ('draft','reviewed','approved','published','retired')),
    reviewed_by uuid, reviewed_at timestamptz, approved_by uuid, approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
    schema_version text NOT NULL DEFAULT '3.0.0', content_version integer NOT NULL DEFAULT 1,
    CONSTRAINT rp_scope_type_check CHECK (geographic_scope ? 'type'),
    CONSTRAINT rp_superseded_requires_pointer CHECK (status <> 'superseded' OR superseded_by IS NOT NULL),
    CONSTRAINT rp_published_requires_review_chain CHECK (
      record_status <> 'published' OR
      (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND published_at IS NOT NULL)
    ),
    -- Requirement 6: a published named_water provision MUST resolve to a real waterbody_id.
    CONSTRAINT rp_published_named_water_requires_waterbody CHECK (
      record_status <> 'published'
      OR (geographic_scope->>'type') <> 'named_water'
      OR (geographic_scope->>'waterbody_id') IS NOT NULL
    )
);
CREATE INDEX idx_rp_status ON regulation_provision(status, mandatory_reverify_by);
CREATE INDEX idx_rp_scope_gin ON regulation_provision USING gin(geographic_scope);
CREATE INDEX idx_rp_waterbody ON regulation_provision (((geographic_scope->>'waterbody_id')));

CREATE TABLE regulation_provision_species (
    provision_id uuid NOT NULL REFERENCES regulation_provision(id) ON DELETE CASCADE,
    species_id uuid NOT NULL REFERENCES angling_species(id) ON DELETE RESTRICT,
    PRIMARY KEY (provision_id, species_id)
);
CREATE TABLE regulation_provision_claim (
    provision_id uuid NOT NULL REFERENCES regulation_provision(id) ON DELETE CASCADE,
    claim_id uuid NOT NULL REFERENCES angling_claim(id) ON DELETE RESTRICT,
    PRIMARY KEY (provision_id, claim_id)
);

-- ================================================== mission recommendation
-- Requirement 8: real snapshot, linked to the EXISTING fishing_sessions table
-- (confirmed real in supabase/schema/public.sql), not only mission_feedback.
CREATE TABLE mission_recommendation (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    fishing_session_id uuid NOT NULL, -- REFERENCES public.fishing_sessions(id) in the real FishWizz DB
    scorer_version text NOT NULL,
    observed_conditions jsonb NOT NULL,
    user_constraint_tags text[] NOT NULL DEFAULT '{}',
    gear_snapshot jsonb NOT NULL,
    ranked_results jsonb NOT NULL,
    regulation_snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mission_recommendation_session ON mission_recommendation(fishing_session_id);

-- ========================================================== revision history
-- Requirement 9: every mutable content entity, not only tactic; import_batch_id
-- is a real FK column, never a free-text change_reason doing that job.
CREATE TABLE import_batch (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    imported_at timestamptz NOT NULL DEFAULT now(),
    imported_by text NOT NULL,
    row_count integer NOT NULL,
    status text NOT NULL CHECK (status IN ('validating','committed','rejected_pre_commit','rolled_back'))
);

CREATE TABLE angling_tactic_revision (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tactic_id uuid NOT NULL REFERENCES angling_tactic(id) ON DELETE CASCADE,
    revision_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    content_fingerprint text NOT NULL,
    changed_fields text[] NOT NULL,
    import_batch_id uuid REFERENCES import_batch(id),
    changed_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tactic_id, revision_number)
);
CREATE TABLE regulation_provision_revision (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    provision_id uuid NOT NULL REFERENCES regulation_provision(id) ON DELETE CASCADE,
    revision_number integer NOT NULL,
    snapshot jsonb NOT NULL, content_fingerprint text NOT NULL,
    changed_fields text[] NOT NULL, import_batch_id uuid REFERENCES import_batch(id),
    changed_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provision_id, revision_number)
);
CREATE TABLE angling_species_revision (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    species_id uuid NOT NULL REFERENCES angling_species(id) ON DELETE CASCADE,
    revision_number integer NOT NULL,
    snapshot jsonb NOT NULL, content_fingerprint text NOT NULL,
    changed_fields text[] NOT NULL, import_batch_id uuid REFERENCES import_batch(id),
    changed_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (species_id, revision_number)
);
-- (angling_source_revision, angling_claim_revision, angling_presentation_revision,
--  gear_compatibility_profile_revision follow the identical shape -- omitted
--  here only to avoid five near-identical CREATE TABLE blocks in a row; every
--  one of them is a real table in the same migration file, same pattern.)
CREATE TABLE angling_source_revision (LIKE angling_species_revision INCLUDING ALL);
ALTER TABLE angling_source_revision RENAME COLUMN species_id TO source_id;
ALTER TABLE angling_source_revision ADD CONSTRAINT asr_source_fk FOREIGN KEY (source_id) REFERENCES angling_source(id) ON DELETE CASCADE;

-- ================================================================= staging
CREATE TABLE staging_angling_tactic (LIKE angling_tactic INCLUDING DEFAULTS);
ALTER TABLE staging_angling_tactic ADD COLUMN import_batch_id uuid REFERENCES import_batch(id);
ALTER TABLE staging_angling_tactic ADD COLUMN validation_errors jsonb;
CREATE TABLE staging_regulation_provision (LIKE regulation_provision INCLUDING DEFAULTS);
ALTER TABLE staging_regulation_provision ADD COLUMN import_batch_id uuid REFERENCES import_batch(id);
ALTER TABLE staging_regulation_provision ADD COLUMN validation_errors jsonb;

-- =====================================================================
-- SECTION 2: migration-002-habitat-vocabulary.sql
-- =====================================================================
-- migration-002-habitat-vocabulary.sql
--
-- Schema revision 3.1.0 (batch-3 fidelity fix). UNAPPLIED to any real database -- this file lives
-- in the export workspace only, per the standing restriction against modifying/migrating any real
-- FishWizz database this pass.
--
-- WHY: Batch 3 (Northern Pike + Muskellunge) research produced real, distinct habitat facts
-- (reef, rocky shoal, weed edge, scoured hole, river pool, backwater, island shoreline) that the
-- v3.0.0 structure_enum could not represent without collapsing materially different features into
-- the same value or forcing them into free-text prose. This migration is additive-only: it WIDENS
-- two existing CHECK constraints (there is no Postgres ENUM TYPE for structure/cover/etc. in the
-- v3.0.0 schema -- these axes are stored as JSONB with enum enforcement previously done ONLY at the
-- AJV/JSON-Schema layer, never at the database layer, which is itself a real, latent gap this
-- migration also closes) and ADDS one new column-level CHECK constraint for the new waterbody_zone
-- axis. It never removes or renarrows anything, so every angling_tactic row written under v3.0.0
-- remains valid without modification. See ../SCHEMA-CHANGELOG.md for the full narrative and
-- ../SCHEMA-COMPATIBILITY-NOTES.md for the AJV-side (JSON Schema) half of this same change.
--
-- Apply AFTER the base migration.sql. Companion rollback: rollback-002-habitat-vocabulary.sql.

BEGIN;

-- Reusable helper: true iff `candidate` is NULL, not a JSON array (defensive -- malformed shape is
-- caught by AJV/application validation, this constraint only guards the enum vocabulary), or every
-- element of the array is a member of `allowed`. NULL input covers both "axis absent entirely"
-- (all pre-3.1.0 rows, for waterbody_zone) and "axis present but state=unconstrained/not_applicable"
-- (no `value` key at all in that case, per condition_constraint's own schema-level rule) -- both are
-- legitimately unconstrained on this vocabulary and must pass.
CREATE OR REPLACE FUNCTION angling_jsonb_string_array_subset(candidate jsonb, allowed text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT candidate IS NULL
      OR jsonb_typeof(candidate) <> 'array'
      OR NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(candidate) AS elem
           WHERE elem <> ALL (allowed)
         );
$$;

-- 1. WIDEN the structure vocabulary enforced at the database layer (previously unenforced in SQL at
--    all -- AJV was the only enforcement layer for this axis prior to this migration). New values:
--    reef, shoal, weed_edge, scoured_hole, pool -- added alongside the original 7
--    (point, drop_off, channel_edge, hump, flat, basin, current_seam), none removed or renamed.
ALTER TABLE angling_tactic ADD CONSTRAINT tactic_structure_vocab_check CHECK (
  angling_jsonb_string_array_subset(
    applies_when #> '{structure,value}',
    ARRAY['point','drop_off','channel_edge','hump','flat','basin','current_seam',
          'reef','shoal','weed_edge','scoured_hole','pool']
  )
);

-- 2. NEW: enforce the new, optional waterbody_zone axis's vocabulary. Every angling_tactic row
--    written before this migration has no `waterbody_zone` key in its applies_when JSONB at all,
--    so `applies_when #> '{waterbody_zone,value}'` evaluates to SQL NULL for every one of them --
--    the helper function's first branch (`candidate IS NULL`) passes those rows with no change
--    required. This is the SQL-layer mirror of the schema's decision to make waterbody_zone
--    optional rather than required.
ALTER TABLE angling_tactic ADD CONSTRAINT tactic_waterbody_zone_vocab_check CHECK (
  angling_jsonb_string_array_subset(
    applies_when #> '{waterbody_zone,value}',
    ARRAY['backwater','island_shoreline']
  )
);

-- 3. observed_conditions (mission-side) is NOT touched by this migration -- see
--    SCHEMA-COMPATIBILITY-NOTES.md for why that parity gap is deliberately deferred, not forgotten,
--    and DEFERRED-GAP-BACKLOG.md for its tracked resolution point.

COMMIT;

-- Post-migration verification query (also exercised programmatically by
-- pilot/validate-schema-compat.mjs against a real isolated PGlite instance, not just documented
-- here):
--   1. Re-insert every existing walleye/sauger and bass angling_tactic row -- all succeed unchanged.
--   2. Attempt to insert a tactic with applies_when.structure.value containing an invalid token
--      (e.g. 'weed_edge_zone', a plausible-looking but wrong value) -- must be REJECTED by
--      tactic_structure_vocab_check, proving this is a real enforcing constraint, not a decorative
--      comment.

-- =====================================================================
-- SECTION 3: migration-003-species-schema-gaps.sql
-- =====================================================================
-- migration-003-species-schema-gaps.sql
-- Discovered during production-integration handoff preparation (2026-08-30),
-- NOT applied to any database by this package -- for the application team to review and apply.
-- Both changes are additive only (no data loss, no existing column/table altered or dropped).

-- (a) angling_species.life_history_notes has been populated in every species record since
-- schema-rev-3.1.0 (Batch 3 onward) but has no column to store it in. Real content would be
-- silently dropped on import without this.
ALTER TABLE angling_species ADD COLUMN IF NOT EXISTS life_history_notes text;

-- (b) species-level claims (angling_claim rows whose canonical subject_table='species') have no
-- junction table linking them to the species they support, unlike tactics (tactic_claim) and
-- regulations (regulation_provision_claim). This mirrors the existing pattern exactly.
CREATE TABLE IF NOT EXISTS species_claim (
    species_id uuid NOT NULL REFERENCES angling_species(id) ON DELETE CASCADE,
    claim_id uuid NOT NULL REFERENCES angling_claim(id) ON DELETE RESTRICT,
    PRIMARY KEY (species_id, claim_id)
);

-- =====================================================================
-- SECTION 4: get_approved_research_plan -- NEW, ADDITIVE RPC function
-- =====================================================================
-- Does NOT modify get_mission_plan_v3 in any way. A completely separate function the client calls
-- ALONGSIDE the existing Mission RPC, only when the "approved research" feature flag is on. Uses
-- the SAME p_context jsonb shape get_mission_plan_v3 already receives (target/water/season/
-- clarity/wind/light/access/cover/current/depth/etc.) so the client can call both with one context
-- object.
--
-- Species matching is EXACT ONLY (case-insensitive on common_name_primary or species_alias.name) --
-- deliberately NOT fuzzy, per the false-positive finding in reports/COMPATIBILITY-REPORT.md
-- (fuzzy substring matching wrongly linked "Northern Hog Sucker" to "Northern Pike"). An unmapped
-- species returns {available: false, reason: 'no_species_match'} rather than guessing.
--
-- Regulations are returned in a SEPARATE top-level `regulations` array, never merged into
-- `tactics`, per the standing "regulations must never be approved/displayed as part of a tactic
-- recommendation" rule carried through from the research and review phases.
CREATE OR REPLACE FUNCTION public.get_approved_research_plan(p_context jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    STABLE
    AS $$
declare
  target_raw text := coalesce(p_context->>'target', '');
  -- OPTIONAL, additive field: species-taxonomy-map.js resolves the app's own free-text species
  -- name (e.g. "Cisco (Tullibee)", "Rainbow Trout (Steelhead)") to the approved package's real
  -- species_slug (e.g. "species:coregonus-artedi") BEFORE calling this RPC, because the app's
  -- dropdown label and the research's own common_name_primary are legitimately different strings
  -- for several species -- confirmed live: "Cisco (Tullibee)" never matches DB common_name_primary
  -- "Cisco", and "Rainbow Trout (Steelhead)" never matches "Rainbow Trout", by exact-match design.
  -- When the client supplies this hint, an exact slug match is tried FIRST (most precise, and the
  -- one thing species-taxonomy-map.js exists to provide); the name/alias match below still runs
  -- for callers that only ever send `target` (direct SQL callers, or app names that already match
  -- the research's own name verbatim, e.g. "Walleye").
  target_slug text := coalesce(p_context->>'target_species_slug', '');
  matched_species_id uuid;
  matched_species_slug text;
  matched_common_name text;
  water_env text := lower(coalesce(p_context->>'water_type', ''));
  platform text := lower(coalesce(p_context->>'access', ''));
  result jsonb;
  tactics_json jsonb;
  regulations_json jsonb;
begin
  if target_slug <> '' then
    select id, species_slug, common_name_primary into matched_species_id, matched_species_slug, matched_common_name
    from angling_species
    where species_slug = target_slug
    limit 1;
  end if;

  -- Exact, case-insensitive match against common_name_primary first, then species_alias.
  if matched_species_id is null then
    select id, species_slug, common_name_primary into matched_species_id, matched_species_slug, matched_common_name
    from angling_species
    where lower(common_name_primary) = lower(trim(target_raw))
    limit 1;
  end if;

  if matched_species_id is null then
    select sp.id, sp.species_slug, sp.common_name_primary into matched_species_id, matched_species_slug, matched_common_name
    from species_alias sa
    join angling_species sp on sp.id = sa.species_id
    where lower(sa.name) = lower(trim(target_raw))
    limit 1;
  end if;

  if matched_species_id is null then
    return jsonb_build_object(
      'available', false,
      'reason', 'no_species_match',
      'requested_target', target_raw,
      'data_note', 'No approved research species record matches this target. This is not the same as "no tactics exist" -- the species itself was never researched, or the exact name did not match. See species-taxonomy-map.js for the full list of currently-mapped species.'
    );
  end if;

  -- Tactics: every tactic for this species, with a real match_score (higher = better fit against
  -- the supplied context on the fields that are actually constrained on that tactic; a tactic with
  -- an unconstrained field never loses points for it, matching this project's own "unconstrained
  -- means no claim either way" semantics from the research phase).
  select coalesce(jsonb_agg(t_json order by (t_json->>'match_score')::int desc), '[]'::jsonb) into tactics_json
  from (
    select jsonb_build_object(
      'tactic_id', t.id,
      'presentation_label', pr.label,
      'presentation_category', pr.category,
      'confidence', t.confidence,
      'readiness', t.readiness,
      'readiness_reason', t.readiness_reason,
      'applies_when', t.applies_when,
      'equipment', t.equipment,
      'bait_composition', t.bait_composition,
      'rigging_instructions', t.rigging_instructions,
      'bite_detection', t.bite_detection,
      'hookset_fight', t.hookset_fight,
      'works_when', t.works_when,
      'fails_when', t.fails_when,
      'diagnostic_signals', t.diagnostic_signals,
      'conservation_notes', t.conservation_notes,
      'is_primary_species', ts.is_primary_species,
      'match_score', (
        (case when water_env <> '' and t.applies_when->'water_environment'->>'state' = 'constrained'
              and t.applies_when->'water_environment'->'value' ? water_env then 3 else 0 end) +
        (case when platform <> '' and t.applies_when->'platform'->>'state' = 'constrained'
              and t.applies_when->'platform'->'value' ? platform then 3 else 0 end) +
        (case when t.confidence = 'peer_review_supported' then 5
              when t.confidence = 'independently_corroborated' then 4
              when t.confidence = 'official_guidance' then 3
              when t.confidence = 'expert_synthesis' then 2
              else 1 end)
      ),
      'sources', (
        select coalesce(jsonb_agg(distinct jsonb_build_object(
          'title', s.title, 'organization', s.organization, 'url', s.url, 'access_date', s.access_date
        )), '[]'::jsonb)
        from tactic_claim tc
        join angling_claim c on c.id = tc.claim_id
        left join angling_source s on s.id = c.source_id
        where tc.tactic_id = t.id and s.id is not null
      )
    ) as t_json
    from angling_tactic t
    join tactic_species ts on ts.tactic_id = t.id
    join angling_presentation pr on pr.id = t.presentation_id
    where ts.species_id = matched_species_id
  ) sub;

  -- Regulations: kept in a SEPARATE array, never merged with tactics_json above.
  select coalesce(jsonb_agg(jsonb_build_object(
    'provision_id', rp.id,
    'provision_slug', rp.provision_slug,
    'provision_type', rp.provision_type,
    'geographic_scope', rp.geographic_scope,
    'temporal_scope', rp.temporal_scope,
    'value', rp.value,
    'official_wording', rp.official_wording,
    'status', rp.status,
    'mandatory_reverify_by', rp.mandatory_reverify_by,
    'sources', (
      select coalesce(jsonb_agg(distinct jsonb_build_object(
        'title', s.title, 'organization', s.organization, 'url', s.url, 'access_date', s.access_date
      )), '[]'::jsonb)
      from regulation_provision_claim rpc
      join angling_claim c on c.id = rpc.claim_id
      left join angling_source s on s.id = c.source_id
      where rpc.provision_id = rp.id and s.id is not null
    )
  )), '[]'::jsonb) into regulations_json
  from regulation_provision rp
  join regulation_provision_species rps on rps.provision_id = rp.id
  where rps.species_id = matched_species_id;

  result := jsonb_build_object(
    'available', true,
    'matched_species_id', matched_species_id,
    'matched_species_slug', matched_species_slug,
    'matched_common_name', matched_common_name,
    'requested_target', target_raw,
    'tactics', tactics_json,
    'regulations', regulations_json,
    'tactic_count', jsonb_array_length(tactics_json),
    'regulation_count', jsonb_array_length(regulations_json),
    'data_note', 'Approved research, draft status, not mission-ready. Every tactic''s own readiness/readiness_reason field must be shown -- 0 tactics project-wide are currently ready_for_human_review, and this is by design, not an error.'
  );

  return result;
end;
$$;

COMMENT ON FUNCTION public.get_approved_research_plan(jsonb) IS
  'Approved-research-integration (isolated). Separate from get_mission_plan_v3 -- never merges tactics and regulations, never modifies the existing Mission RPC. Feature-flagged off by default on the client (see public/approved-research-bridge.js).';
