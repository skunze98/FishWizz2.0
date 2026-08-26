-- FishWizz — persist real water geometry, and restore the missing
-- atlas_water_quality() function
-- ---------------------------------------------------------------------------
-- Investigating "the map doesn't pick the true nearest water" (user report,
-- 2026-08-26) found two real bugs, not one:
--
-- BUG 1: waterbodies.geometry (a real PostGIS Geometry column, GIST-indexed
-- for exactly this purpose) has been NULL for all 1311 rows, always. The
-- only insert/update path into waterbodies, upsert_catalog_waterbody(), has
-- never accepted a geometry parameter -- it only ever writes a single
-- centroid point. atlas_map_context() (the Mission page's "Exact-position
-- intelligence" panel) already does real ST_ClosestPoint/ST_Distance math
-- against coalesce(w.geometry, w.centroid) -- correct code with nothing to
-- run it against, so it has always silently degraded to plain
-- centroid-distance, same rough accuracy as everything else, even though it
-- was built to be exact.
--
-- BUG 2 (more severe): atlas_map_context() calls
-- public.atlas_water_quality(v_water_id) whenever it finds a match. That
-- function does not exist in this database at all (confirmed directly:
-- `select * from pg_proc where proname ilike '%water_quality%'` returns zero
-- rows). Calling a nonexistent function from inside a plpgsql body is a hard
-- runtime error -- so atlas_map_context() has been throwing, not just
-- returning worse data, every single time it actually finds a nearby water.
-- It could only ever appear to "work" when nothing matched. The schema dump
-- this repo captured was reloaded with `check_function_bodies = false`
-- (dump header), which is why CREATE FUNCTION never caught this at
-- create-time -- it only fails when actually called.
-- atlas-water-profile also calls the same missing function, but degrades
-- quietly instead of erroring (its caller reads `.data?.[0]` without
-- checking `.error`), so the water-detail page has been silently showing
-- data_quality:null / confidence:'limited' for every water regardless of
-- how much real evidence actually exists for it.
--
-- FIX, in order:
--   1. Recreate atlas_water_quality(uuid) for real, matching the exact
--      column-name contract both existing callers already expect
--      (quality_score, quality_grade, has_geometry, species_count,
--      access_count, gauge_count, fresh_observation_count,
--      recent_report_count, missing_layers -- see
--      supabase/functions/atlas-water-profile/index.ts's destructuring of
--      the RPC result, which is the only surviving record of the intended
--      shape). Scored as an evidence-completeness index across the 5 data
--      layers this app actually populates, not a guess at "real" water
--      quality.
--   2. Extend upsert_catalog_waterbody() to accept an optional GeoJSON
--      geometry parameter and persist it to waterbodies.geometry, deriving
--      centroid from that geometry when supplied (more accurate than a
--      single feature-center point) and falling back to the existing
--      lon/lat point behavior when it is not. This is a genuine signature
--      change (new parameter), so the old 10-arg overload is dropped first
--      -- CREATE OR REPLACE does not replace a function when the parameter
--      list changes, it silently adds a second overload, which would leave
--      PostgREST unable to pick one deterministically.
--   3. Rebuild nearby_water_catalog() (the Postgres-side fallback
--      atlas-nearby-waters already calls when a live DNR query fails or
--      times out) to prefer geometry distance over centroid distance when
--      geometry is available, and to compute the same match_type labels
--      (on_water / very_close / nearby) the live JS path already computes --
--      so a geometry-backed cached row is exactly as trustworthy to
--      public/map.js's existing bestWater()/rankWater() logic as a live
--      result, without any client-side changes. This is also a return-type
--      change (new match_type/has_geometry columns), so it is dropped and
--      recreated rather than CREATE OR REPLACE'd.
--
-- atlas_map_context() itself needs no SQL change -- its distance math was
-- already correct; it only ever needed (1) and (2) above to have something
-- real to compute against.
--
-- Verification performed before writing this file: prototyped the
-- coalesce(w.geometry, w.centroid) distance pattern directly against the
-- live database via `supabase db query --linked` (a real 3-row nearest
-- query against a live coordinate) to confirm the geometry/geography type
-- mixing PostGIS actually accepts, since check_function_bodies=false meant
-- this had never been confirmed to type-check at all.
-- To verify after applying: see the edge function changes in the same
-- commit (atlas-nearby-waters, atlas-water-catalog) that start actually
-- passing geometry through, and DEPLOYMENT.md's verification notes for this
-- change.
-- ---------------------------------------------------------------------------

-- 1. atlas_water_quality(uuid) -- did not exist; both callers assumed it did.
CREATE OR REPLACE FUNCTION public.atlas_water_quality(p_waterbody_id uuid)
RETURNS TABLE(
  quality_score numeric,
  quality_grade text,
  has_geometry boolean,
  species_count integer,
  access_count integer,
  gauge_count integer,
  fresh_observation_count integer,
  recent_report_count integer,
  missing_layers text[]
)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  with w as (
    select geometry is not null as has_geom
    from public.waterbodies where id = p_waterbody_id
  ),
  sp as (select count(*)::int n from public.waterbody_species where waterbody_id = p_waterbody_id),
  ac as (select count(*)::int n from public.public_access_points where waterbody_id = p_waterbody_id),
  ga as (select count(*)::int n from public.stream_gauges where waterbody_id = p_waterbody_id and active = true),
  fresh as (
    select count(*)::int n from public.live_water_observations o
    join public.stream_gauges g on g.id = o.gauge_id
    where g.waterbody_id = p_waterbody_id and o.observed_at >= now() - interval '24 hours'
  ),
  rp as (
    select count(*)::int n from public.fishing_reports
    where waterbody_id = p_waterbody_id and published_at >= now() - interval '45 days'
  ),
  scored as (
    select
      coalesce((select has_geom from w), false) as has_geom,
      coalesce((select n from sp), 0) as species_n,
      coalesce((select n from ac), 0) as access_n,
      coalesce((select n from ga), 0) as gauge_n,
      coalesce((select n from fresh), 0) as fresh_n,
      coalesce((select n from rp), 0) as report_n
  )
  select
    -- Evidence-completeness index across the 5 layers this app populates,
    -- 0-100. Not a claim about actual water quality -- a claim about how
    -- much real, sourced data FishWizz has for this water.
    round((
      (case when has_geom then 20 else 0 end) +
      (least(species_n, 5) * 4)::numeric +
      (least(access_n, 3) * (20.0/3)) +
      (least(gauge_n, 2) * 7.5) +
      (case when fresh_n > 0 then 10 else 0 end) +
      (least(report_n, 3) * 5)::numeric
    ), 0) as quality_score,
    case
      when (
        (case when has_geom then 20 else 0 end) +
        (least(species_n, 5) * 4) +
        (least(access_n, 3) * (20.0/3)) +
        (least(gauge_n, 2) * 7.5) +
        (case when fresh_n > 0 then 10 else 0 end) +
        (least(report_n, 3) * 5)
      ) >= 70 then 'high'
      when (
        (case when has_geom then 20 else 0 end) +
        (least(species_n, 5) * 4) +
        (least(access_n, 3) * (20.0/3)) +
        (least(gauge_n, 2) * 7.5) +
        (case when fresh_n > 0 then 10 else 0 end) +
        (least(report_n, 3) * 5)
      ) >= 40 then 'moderate'
      else 'limited'
    end as quality_grade,
    has_geom as has_geometry,
    species_n as species_count,
    access_n as access_count,
    gauge_n as gauge_count,
    fresh_n as fresh_observation_count,
    report_n as recent_report_count,
    array_remove(array[
      case when not has_geom then 'geometry' end,
      case when species_n = 0 then 'species' end,
      case when access_n = 0 then 'access_points' end,
      case when gauge_n = 0 then 'gauges' end,
      case when report_n = 0 then 'fishing_reports' end
    ], null) as missing_layers
  from scored;
$$;

COMMENT ON FUNCTION public.atlas_water_quality(uuid) IS
  'Evidence-completeness score for a waterbody across the 5 data layers FishWizz populates. Was referenced by atlas_map_context() and atlas-water-profile but did not exist until 2026-08-26.';

-- 2. upsert_catalog_waterbody -- add optional geometry, drop+recreate
-- (adding a parameter is a new overload under CREATE OR REPLACE, not a
-- replacement -- see header comment).
DROP FUNCTION IF EXISTS public.upsert_catalog_waterbody(text, text, text, text, text, text, double precision, double precision, text, timestamp with time zone);

CREATE FUNCTION public.upsert_catalog_waterbody(
  p_source_system text,
  p_source_id text,
  p_source_label text,
  p_name text,
  p_state_code text,
  p_water_type text,
  p_lon double precision,
  p_lat double precision,
  p_official_url text,
  p_source_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_geometry_geojson text DEFAULT NULL::text
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_geom geometry;
  v_centroid geography;
begin
  if p_state_code not in ('MN','WI') then raise exception 'Unsupported state'; end if;

  if p_geometry_geojson is not null then
    -- Best-effort: a malformed shape from a live DNR fetch should not break
    -- the whole catalog write, just fall back to point-centroid behavior.
    begin
      v_geom := st_setsrid(st_geomfromgeojson(p_geometry_geojson), 4326);
      v_centroid := st_centroid(v_geom)::geography;
    exception when others then
      v_geom := null;
      v_centroid := null;
    end;
  end if;

  if v_centroid is null and p_lon is not null and p_lat is not null then
    v_centroid := st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;
  end if;

  insert into public.waterbodies(
    atlas_id, source_system, source_id, source_label, name, state_code, water_type,
    centroid, geometry, official_url, source_updated_at, catalog_fetched_at, intelligence_level
  ) values (
    upper(p_state_code)||'-'||upper(substr(md5(p_source_system||':'||p_source_id),1,12)),
    p_source_system, p_source_id, p_source_label, nullif(trim(p_name),''), p_state_code,
    lower(coalesce(nullif(trim(p_water_type),''),'water')),
    v_centroid, v_geom,
    p_official_url, p_source_updated_at, now(), 1
  )
  on conflict (source_system, source_id) do update set
    source_label=excluded.source_label,
    name=coalesce(excluded.name, public.waterbodies.name),
    state_code=excluded.state_code,
    water_type=excluded.water_type,
    centroid=coalesce(excluded.centroid, public.waterbodies.centroid),
    geometry=coalesce(excluded.geometry, public.waterbodies.geometry),
    official_url=coalesce(excluded.official_url, public.waterbodies.official_url),
    source_updated_at=coalesce(excluded.source_updated_at, public.waterbodies.source_updated_at),
    catalog_fetched_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

COMMENT ON FUNCTION public.upsert_catalog_waterbody(text, text, text, text, text, text, double precision, double precision, text, timestamp with time zone, text) IS
  'p_geometry_geojson added 2026-08-26 so real shoreline/stream geometry can be persisted instead of only a single centroid point. NULL-safe: omitting it preserves the original point-only behavior.';

-- 3. nearby_water_catalog -- prefer geometry distance, add match_type/
-- has_geometry so a cached row is exactly as trustworthy to
-- public/map.js's existing bestWater()/rankWater() as a live DNR result.
-- Return-type change, so drop+recreate rather than CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.nearby_water_catalog(double precision, double precision, double precision, integer);

CREATE FUNCTION public.nearby_water_catalog(p_lat double precision, p_lon double precision, p_radius_miles double precision DEFAULT 15, p_limit integer DEFAULT 40)
RETURNS TABLE(
  id uuid, name text, state_code text, water_type text, source_label text, source_system text,
  official_url text, latitude double precision, longitude double precision, distance_miles double precision,
  match_type text, has_geometry boolean
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with pt as (
    select st_setsrid(st_makepoint(p_lon,p_lat),4326)::geography as p
  )
  select
    w.id, w.name, w.state_code, w.water_type, w.source_label, w.source_system, w.official_url,
    st_y(coalesce(st_closestpoint(w.geometry, st_setsrid(st_makepoint(p_lon,p_lat),4326)), w.centroid::geometry)) as latitude,
    st_x(coalesce(st_closestpoint(w.geometry, st_setsrid(st_makepoint(p_lon,p_lat),4326)), w.centroid::geometry)) as longitude,
    coalesce(st_distance(w.geometry::geography, pt.p), st_distance(w.centroid, pt.p)) / 1609.344 as distance_miles,
    case
      when w.geometry is not null and st_distance(w.geometry::geography, pt.p) <= 0.03 * 1609.344 then 'on_water'
      when w.geometry is not null and st_distance(w.geometry::geography, pt.p) <= 0.25 * 1609.344 then 'very_close'
      when w.geometry is null then 'centroid_estimate'
      else 'nearby'
    end as match_type,
    (w.geometry is not null) as has_geometry
  from public.waterbodies w cross join pt
  where coalesce(w.geometry::geography, w.centroid) is not null
    and st_dwithin(coalesce(w.geometry::geography, w.centroid), pt.p, greatest(1,p_radius_miles)*1609.344)
  order by coalesce(w.geometry::geography, w.centroid) <-> pt.p
  limit least(greatest(p_limit,1),100)
$$;

COMMENT ON FUNCTION public.nearby_water_catalog(double precision, double precision, double precision, integer) IS
  'match_type/has_geometry added 2026-08-26 so a cached (geometry-backed) row is exactly as trustworthy as a live DNR match to the client''s existing confidence ranking, once upsert_catalog_waterbody has actually persisted geometry for that row.';
