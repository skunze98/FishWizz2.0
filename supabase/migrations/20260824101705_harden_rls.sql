-- FishWizz — RLS hardening
-- Staging migration history: 20260824101705_harden_rls. The executable SQL
-- stored in supabase_migrations.schema_migrations was normalized and verified
-- identical to this file on 2026-08-24; only comments/whitespace differed.
-- ---------------------------------------------------------------------------
-- REWRITTEN 2026-08-10 against the real staging schema (supabase/schema/public.sql),
-- which was not available when this file was first written.
--
-- The original version was written blind and would have DAMAGED this database.
-- Recording what it got wrong, because the reasons are the reasons this file is
-- now small:
--
--   * It set `search_path = ''` on every SECURITY DEFINER function. All five
--     already pin `SET search_path TO 'public'`, and their bodies reference
--     unqualified public objects (e.g. `insert into public...` alongside bare
--     table names). Forcing '' would have broken every RPC at runtime.
--   * It added FORCE ROW LEVEL SECURITY. The five SECURITY DEFINER RPCs run as
--     the table owner and are *supposed* to bypass RLS; FORCE would have broken
--     bootstrap_atlas_account, atlas_map_context and nearby_water_catalog.
--   * It created a parallel set of fw_* policies. The existing ones are already
--     correct -- every per-user table has USING *and* WITH CHECK scoped to
--     auth.uid(), using the (SELECT auth.uid()) form that evaluates once per
--     query rather than once per row.
--   * Its final assertion excluded only waterbodies and app_release_status from
--     the "no read-all policies" check. Six more tables are intentional shared
--     reference data (stream_gauges, live_water_observations, fishing_reports,
--     report_sources, public_access_points, waterbody_species), so the
--     assertion would have aborted a correct database.
--
-- What the audit actually found: G1, G4 and G6 are already closed on staging.
-- RLS is enabled on all 27 tables, owns_row() is a correct STABLE
-- `auth.uid() = row_owner` with search_path pinned, all five SECURITY DEFINER
-- functions pin search_path, and storage policies already scope all three
-- buckets by `(storage.foldername(name))[1] = auth.uid()`.
--
-- So this file is now only the genuine deltas.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove anon's reach into public.
-- ---------------------------------------------------------------------------
-- RLS already returns zero rows to anon, so this is defence in depth rather
-- than a fix: it makes the tables unreachable instead of merely empty, which
-- removes a whole class of future mistake (a new table added without a policy
-- is exposed; a new table with no grant is not).
--
-- Verified from outside before writing this: every table answered 200 to an
-- unauthenticated PostgREST request, so the grants are there today.
--
-- Nothing in the app calls PostgREST unauthenticated -- api() in app.js
-- requires a session, and release-pro.js (the only reader of
-- app_release_status) is not loaded by anything.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- app_release_status_read grants SELECT to anon by policy. The policy is
-- harmless on its own once the grant is gone, but leave it dropped-in-place
-- rather than deleted so intent stays visible if the release banner is ever
-- wired up for signed-out users.

-- ---------------------------------------------------------------------------
-- 2. Default catches.owner_id, matching every other per-user table.
-- ---------------------------------------------------------------------------
-- catches.owner_id is NOT NULL with no default, unlike water_spots.user_id,
-- mission_feedback.user_id and fishing_sessions.owner_id which all default to
-- auth.uid(). It works today only because three client paths explicitly send
-- owner_id: session.user.id. That is fragile -- a fourth writer that forgets
-- gets a NOT NULL violation instead of the right answer.
--
-- Not a security change: the WITH CHECK already rejects a forged owner_id.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catches'
      and column_name = 'owner_id' and column_default is null
  ) then
    alter table public.catches alter column owner_id set default auth.uid();
    raise notice 'catches.owner_id now defaults to auth.uid()';
  else
    raise notice 'catches.owner_id already has a default -- nothing to do';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Assert the posture we expect, without asserting things that are fine.
-- ---------------------------------------------------------------------------
do $$
declare
  unprotected text;
  unscoped    text;
  reference   text[] := array[
    'waterbodies','app_release_status','stream_gauges','live_water_observations',
    'fishing_reports','report_sources','public_access_points','waterbody_species',
    'lakes','coaching_scenarios','data_source_runs'
  ];
begin
  -- Every table must have RLS on. A new table without it is the actual risk.
  --
  -- Extension-owned tables are excluded: PostGIS installs spatial_ref_sys into
  -- public without RLS, and we neither own it nor should touch it. It carries
  -- no user data -- it is the EPSG reference list. Without this exclusion the
  -- assertion below fails on a perfectly healthy database.
  select string_agg(c.relname, ', ' order by c.relname) into unprotected
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and not c.relrowsecurity
    and not exists (
      select 1 from pg_depend d
      where d.classid = 'pg_class'::regclass and d.objid = c.oid
        and d.deptype = 'e'                       -- owned by an extension
    );
  if unprotected is not null then
    raise exception 'RLS is disabled on: %', unprotected;
  end if;

  -- A read-all policy is only acceptable on shared reference data.
  select string_agg(format('%s.%s', tablename, policyname), ', ') into unscoped
  from pg_policies
  where schemaname = 'public'
    and cmd in ('SELECT','ALL')
    and coalesce(btrim(qual), '') = 'true'
    and not (tablename = any(reference));
  if unscoped is not null then
    raise exception 'read-all policy on non-reference table(s): %', unscoped;
  end if;

  raise notice 'OK: RLS on every public table; read-all only on reference data';
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Deliberately NOT done here, and why:
--
--   FORCE ROW LEVEL SECURITY   would break the five SECURITY DEFINER RPCs,
--                              which run as owner by design.
--   search_path = ''           all five already pin 'public', and their bodies
--                              rely on it.
--   new owner policies         the existing ones are correct.
--   storage policies           already correct for all three buckets. Note
--                              there are THREE, not two: catch-photos,
--                              inventory-photos, and gear-photos. gear-photos
--                              is referenced by no client code -- confirm it is
--                              legacy before deleting it.
--
-- Verify from outside, which is the only thing that actually proves G1:
--   node .\scripts\rls-probe.mjs
-- ---------------------------------------------------------------------------
