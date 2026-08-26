-- Phase 3b/3c of the full-accuracy mapping project: persist a depth and
-- water-clarity summary directly on waterbodies instead of only ever
-- computing them live on a tap. All columns nullable and additive -- no
-- existing reader is broken by their absence, this is pure backfill.
--
-- Depth: MN's real values come from the same DNR bathymetric contour
-- survey atlas-water-depth already queries live (max of all contour
-- depths per dowlknum); WI's from WDNR's Register of Waterbodies reported
-- max depth (same source atlas-water-depth's WI branch already uses).
-- depth_kind distinguishes "a full contour survey exists" from "one
-- reported number, not a shape" -- same distinction the live endpoint
-- already surfaces, now also true of the persisted value so nothing here
-- claims more precision than the source actually has.
--
-- Clarity: MN's Citizen Lake Monitoring Program (services.pca.state.mn.us/
-- api/v1/cmp/loc-data) publishes real, volunteer-collected Secchi
-- transparency summaries per station -- verified live against the human-
-- facing report page for a real station (webapp.pca.state.mn.us/vmp/
-- stations/.../print) before writing this, confirming the API's secchi
-- values are in FEET for lake stations (the API's own field docs on a
-- different endpoint say meters, which is wrong for this one -- trust the
-- cross-checked value, not the label). This is periodic, dated data
-- (clarity_year), not live -- never presented as anything else.
-- Wisconsin's equivalent (DNR satellite-derived Secchi) ships only as
-- raster imagery, not a per-lake queryable value, so WI clarity stays
-- unfilled here rather than approximated from a raster this pass doesn't
-- sample.

alter table public.waterbodies
  add column if not exists max_depth_ft numeric,
  add column if not exists depth_kind text,        -- 'contour_survey' | 'reported_max'
  add column if not exists depth_source text,
  add column if not exists depth_updated_at timestamptz,
  add column if not exists clarity_secchi_ft numeric,
  add column if not exists clarity_year integer,
  add column if not exists clarity_sample_count integer,
  add column if not exists clarity_source text,
  add column if not exists clarity_updated_at timestamptz;

comment on column public.waterbodies.max_depth_ft is
  'Backfilled from the same DNR sources atlas-water-depth queries live -- MN: max of the bathymetric contour survey; WI: WDNR''s single reported max depth. Null means no survey/report is on file, not zero depth.';
comment on column public.waterbodies.depth_kind is
  'contour_survey (MN, a real shoreline-to-shoreline survey) or reported_max (WI, one number, not a shape) -- mirrors atlas-water-depth''s own distinction so a persisted value never claims more precision than its source.';
comment on column public.waterbodies.clarity_secchi_ft is
  'Mean Secchi transparency in feet from MN''s Citizen Lake Monitoring Program for the most recent monitoring year on file. Periodic volunteer-collected data, not live -- see clarity_year. Minnesota lakes only; Wisconsin''s equivalent is raster-only satellite data this pass does not sample.';
