-- nearby_water_catalog() filters and orders by
-- coalesce(geometry::geography, centroid) -- a computed expression, not a
-- bare column. The existing waterbodies_geometry_gix (on geometry) and
-- waterbodies_centroid_gix (on centroid) indexes cannot satisfy a query
-- against that expression: Postgres needs an index built on the exact
-- expression a WHERE/ORDER BY uses, and neither of those matches.
--
-- This went unnoticed while waterbodies held ~1,325 sparse rows (only 22
-- with real geometry): a sequential scan computing distance for every row
-- was fast enough regardless. It broke the moment the water-body catalog
-- import (phase 2 of the full-accuracy mapping project, 2026-08-26) took
-- the table to 16,325 rows with 15,038 of them carrying real, often
-- complex shoreline polygons -- nearby_water_catalog started timing out
-- (57014 "canceling statement due to statement timeout") on every call,
-- confirmed live while linking phase 1's access points against the new
-- catalog. This is the Postgres-side fallback atlas-nearby-waters calls
-- whenever a live DNR fetch fails or times out, so this wasn't just
-- breaking a maintenance script -- any real user's map tap that fell back
-- to this path would have hit the same timeout.
--
-- Fix: a real GiST index on the exact expression the function already
-- uses, so the planner can actually pick it up for both the st_dwithin
-- bounding filter and the <-> nearest-neighbor ordering.

create index if not exists waterbodies_geog_expr_gix
  on public.waterbodies
  using gist ((coalesce(geometry::geography, centroid)));
