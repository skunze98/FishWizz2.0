-- FishWizz — Supabase security audit
-- ---------------------------------------------------------------------------
-- Read-only. Paste into the Supabase SQL editor and run. Send the output back
-- before applying supabase/migrations/*_harden_rls.sql, which is written
-- against these answers.
--
-- Closes the "unverified" status of gaps G1 (RLS), G4 (RPC privilege mode) and
-- G6 (storage buckets) in the production-readiness assessment. Those gaps are
-- not visible from the client code at all, which is why they were flagged as
-- unverified rather than broken.
-- ---------------------------------------------------------------------------

\echo '=== 1. RLS status per table (relrowsecurity / relforcerowsecurity) ==='
select
  c.relname                                            as table_name,
  c.relrowsecurity                                     as rls_enabled,
  c.relforcerowsecurity                                as rls_forced,
  (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
order by c.relrowsecurity asc, c.relname;   -- unprotected tables float to the top

\echo ''
\echo '=== 2. Every policy body ==='
-- Look for: policies with qual = true, policies missing with_check on INSERT or
-- UPDATE, and any policy whose qual does not mention auth.uid().
select
  tablename,
  policyname,
  cmd,
  roles,
  qual        as using_expression,
  with_check  as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

\echo ''
\echo '=== 3. Function privilege mode and search_path (G4) ==='
-- prosecdef = true means SECURITY DEFINER: the function runs as its owner, so
-- it bypasses RLS entirely and must scope to auth.uid() internally.
-- A SECURITY DEFINER function WITHOUT "SET search_path" is a privilege
-- escalation vector: a caller can create a shadowing object in a schema
-- earlier on the search path and have the definer execute it.
select
  p.proname                                        as function_name,
  pg_get_function_identity_arguments(p.oid)        as arguments,
  case when p.prosecdef then 'SECURITY DEFINER' else 'security invoker' end as privilege_mode,
  coalesce(array_to_string(p.proconfig, ', '), '(no SET clauses -- search_path NOT pinned)') as config,
  pg_get_userbyid(p.proowner)                      as owner
from pg_proc p
where p.pronamespace = 'public'::regnamespace
order by p.prosecdef desc, p.proname;

\echo ''
\echo '=== 4. Table grants held by anon and authenticated ==='
-- The app never calls PostgREST unauthenticated, so anon should hold nothing
-- in public. Reference tables should be SELECT-only for authenticated.
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by grantee, table_name;

\echo ''
\echo '=== 5. Function execute grants ==='
select
  p.proname as function_name,
  r.rolname as grantee
from pg_proc p
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
join pg_roles r on r.oid = a.grantee
where p.pronamespace = 'public'::regnamespace
  and a.privilege_type = 'EXECUTE'
  and r.rolname in ('anon', 'authenticated', 'public')
order by p.proname, r.rolname;

\echo ''
\echo '=== 6. Storage buckets (G6) ==='
-- Both buckets must be public = false. inventory-photos is read server-side by
-- the inventory-recognize edge function; catch-photos is read by the client
-- through signed URLs (catch-history-pro.js). Neither needs public read.
select id as bucket, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

\echo ''
\echo '=== 7. Storage object policies ==='
-- Object keys are "<user_id>/<timestamp>-<rand>.<ext>" in both buckets, so
-- correct policies scope on (storage.foldername(name))[1] = auth.uid()::text.
select policyname, cmd, roles, qual as using_expression, with_check as with_check_expression
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

\echo ''
\echo '=== 8. Columns available to scope ownership on ==='
-- Drives the owner-column detection in the hardening migration.
select
  c.table_name,
  string_agg(c.column_name || ' ' || c.data_type, ', ' order by c.ordinal_position)
    filter (where c.column_name in ('id','owner_id','user_id','account_id')) as identity_columns
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
where c.table_schema = 'public'
group by c.table_name
order by c.table_name;

\echo ''
\echo '=== 9. Tables reachable over PostgREST but not written by the client ==='
-- Anything here that is not reference data is attack surface for no benefit.
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
  and table_name not in (
    'profiles','catches','lures','combos','rods','reels','fishing_sessions',
    'water_spots','beta_feedback','waterbodies','user_fishing_profiles',
    'mission_feedback','inventory_photo_intake','app_release_status'
  )
order by table_name;
