-- FishWizz: delete 2 rows from the phase-4 streams import that incorrectly
-- merged many unrelated, genuinely different MN creek/ditch segments
-- (statewide) into one nonsensical combined shape, because they share the
-- literal placeholder name "Unnamed Creek" / "Unnamed Ditch" in MN DNR's
-- own data and this import grouped by name (no better per-river id exists
-- for MN the way WBIC does for WI). Fixed going forward in
-- scripts/import-waterbodies-streams.mjs (excludes /^unnamed\b/i names
-- from MN's grouping now). These 2 rows predate that fix.
--
-- Verified 2026-08-26: zero dependent rows in any user-data table
-- (water_spots, catches, fishing_reports, fishing_sessions,
-- mission_feedback, stream_gauges, public_access_points, water_visits,
-- waterbody_species, personal_fishing_locations). Safe to delete.
--
-- Low real-world impact even before this cleanup -- nobody searches
-- "Unnamed Creek" by name, and the live per-tap path already correctly
-- catalogs individual unnamed segments one at a time with a real
-- per-segment id -- but wrong is wrong, so cleaning it up rather than
-- leaving it.

delete from public.waterbodies
where id in (
  '49c37fc1-c507-46c3-9ea3-4d56c8b3cb11',  -- "Unnamed Ditch" (merged)
  '562e190c-3d8d-43c5-8729-77799ca60300'   -- "Unnamed Creek" (merged)
);
