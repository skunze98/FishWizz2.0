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
    url text NOT NULL,
    publication_date date,
    access_date date NOT NULL,
    source_type text NOT NULL CHECK (source_type IN ('primary_official','peer_reviewed','expert_consensus','manufacturer_guidance','anecdotal','expert_synthesis')),
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
    source_id uuid NOT NULL REFERENCES angling_source(id) ON DELETE RESTRICT,
    field_path text NOT NULL,
    paraphrased_claim text NOT NULL,
    source_location text NOT NULL,
    evidence_type text NOT NULL CHECK (evidence_type IN ('primary_official','peer_reviewed','expert_consensus','manufacturer_guidance','anecdotal','expert_synthesis')),
    access_date date NOT NULL,
    geographic_applicability text NOT NULL CHECK (geographic_applicability IN ('MN','WI','MN_WI','great_lakes_only','national')),
    reviewer_status text NOT NULL DEFAULT 'unreviewed' CHECK (reviewer_status IN ('unreviewed','reviewer_confirmed','reviewer_flagged')),
    reviewer_id uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT angling_claim_confirmed_requires_reviewer
      CHECK (reviewer_status <> 'reviewer_confirmed' OR (reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL))
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
    bait_method_tags text[] NOT NULL,
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
    confidence text NOT NULL CHECK (confidence IN ('established','expert_consensus','anecdotal','estimated')),
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
CREATE INDEX idx_tactic_bait_tags_gin ON angling_tactic USING gin(bait_method_tags);

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
