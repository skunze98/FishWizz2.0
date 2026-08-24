-- FishWizz — extensions required by the public schema.
--
-- `pg_dump --schema=public` does NOT emit CREATE EXTENSION for extensions
-- installed in that schema, so neither captured dump contains these. Applying
-- public.sql without them fails at the first geography column with
-- `type "public.geography" does not exist`.
--
-- Both must live in `public`, not Supabase's usual `extensions` schema,
-- because the dump references them schema-qualified:
--   public.geography(Point,4326)   -- 4 columns
--   public.geometry                -- 1 column
--   public.gin_trgm_ops            -- waterbodies_name_trgm_idx
--
-- Derived from what the schema actually references:
--   postgis  -- geography/geometry types, st_setsrid/st_makepoint/st_distance/
--              st_dwithin/st_x/st_y/st_closestpoint, and the gist indexes on
--              location, centroid and geometry
--   pg_trgm  -- similarity() in search_water_catalog, and gin_trgm_ops
--
-- gen_random_uuid() (22 uses) needs nothing: it has been core since
-- PostgreSQL 13.

create extension if not exists postgis  with schema public;
create extension if not exists pg_trgm  with schema public;
