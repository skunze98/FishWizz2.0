--
-- PostgreSQL database dump
--

\restrict IlJEt7egi1Mt2tWousPHz8478FjaAtfTGSKBHSXg6LQbKmv5l2To9IEGb2kMNGe

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: angler_learning_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.angler_learning_summary() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$ with c as (select * from public.catches where owner_id=(select auth.uid())), s as (select * from public.fishing_sessions where owner_id=(select auth.uid())), top_species as (select species,count(*) n from c where species is not null group by species order by n desc limit 5), top_water as (select water,count(*) n from c where water is not null group by water order by n desc limit 5), top_lure as (select lure_bait,count(*) n from c where lure_bait is not null group by lure_bait order by n desc limit 8) select jsonb_build_object('total_catches',(select count(*) from c),'total_sessions',(select count(*) from s),'total_bites',(select coalesce(sum(bites),0) from s),'total_moves',(select coalesce(sum(moves),0) from s),'hours_fished',(select round(coalesce(sum(extract(epoch from (coalesce(ended_at,now())-started_at))/3600),0)::numeric,1) from s),'top_species',coalesce((select jsonb_agg(to_jsonb(top_species)) from top_species),'[]'::jsonb),'top_waters',coalesce((select jsonb_agg(to_jsonb(top_water)) from top_water),'[]'::jsonb),'top_lures',coalesce((select jsonb_agg(to_jsonb(top_lure)) from top_lure),'[]'::jsonb),'recent_lessons',coalesce((select jsonb_agg(jsonb_build_object('learned',learned,'why_worked',why_worked,'try_next',try_next,'species',species,'water',water,'caught_at',caught_at)) from (select * from c where learned is not null or why_worked is not null or try_next is not null order by caught_at desc limit 8) z),'[]'::jsonb)); $$;


--
-- Name: atlas_map_context(double precision, double precision, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_map_context(p_lat double precision, p_lon double precision, p_radius_miles double precision DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_point geography := st_setsrid(st_makepoint(p_lon,p_lat),4326)::geography;
  v_radius double precision := least(greatest(coalesce(p_radius_miles,10),1),40)*1609.344;
  v_water jsonb;
  v_water_id uuid;
  v_water_name text;
  v_quality jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select to_jsonb(x),x.id,x.name into v_water,v_water_id,v_water_name
  from (
    select w.id,w.name,w.state_code,w.water_type,w.source_label,
      st_y(coalesce(st_closestpoint(w.geometry::geometry,v_point::geometry),w.centroid::geometry)) latitude,
      st_x(coalesce(st_closestpoint(w.geometry::geometry,v_point::geometry),w.centroid::geometry)) longitude,
      st_distance(coalesce(w.geometry,w.centroid),v_point)/1609.344 distance_miles
    from public.waterbodies w
    where coalesce(w.geometry,w.centroid) is not null
      and st_dwithin(coalesce(w.geometry,w.centroid),v_point,v_radius)
    order by st_distance(coalesce(w.geometry,w.centroid),v_point)
    limit 1
  ) x;

  if v_water_id is not null then
    select to_jsonb(q) into v_quality from public.atlas_water_quality(v_water_id) q;
  end if;

  return jsonb_build_object(
    'center',jsonb_build_object('lat',p_lat,'lon',p_lon,'radius_miles',p_radius_miles),
    'selected_water',v_water,
    'data_quality',v_quality,
    'access_points',coalesce((
      select jsonb_agg(to_jsonb(a) order by a.distance_miles)
      from (
        select p.id,p.waterbody_id,p.name,p.access_type,p.public_status,p.source_system,p.source_url,
          st_y(p.location::geometry) latitude,st_x(p.location::geometry) longitude,
          st_distance(p.location,v_point)/1609.344 distance_miles
        from public.public_access_points p
        where p.location is not null and st_dwithin(p.location,v_point,v_radius)
        order by st_distance(p.location,v_point) limit 50
      ) a
    ),'[]'::jsonb),
    'gauges',coalesce((
      select jsonb_agg(to_jsonb(g) order by g.distance_miles)
      from (
        select s.id,s.waterbody_id,s.agency,s.site_id,s.site_name,s.parameters,
          st_y(s.location::geometry) latitude,st_x(s.location::geometry) longitude,
          st_distance(s.location,v_point)/1609.344 distance_miles,
          (select jsonb_agg(to_jsonb(o) order by o.observed_at desc)
           from (select parameter_code,parameter_name,value,unit,observed_at,source_url
                 from public.live_water_observations o
                 where o.gauge_id=s.id order by observed_at desc limit 8) o) latest_observations
        from public.stream_gauges s
        where s.active=true and s.location is not null and st_dwithin(s.location,v_point,v_radius)
        order by st_distance(s.location,v_point) limit 25
      ) g
    ),'[]'::jsonb),
    'saved_spots',coalesce((
      select jsonb_agg(to_jsonb(s) order by s.distance_miles)
      from (
        select ws.id,ws.waterbody_id,ws.name,ws.spot_type,ws.structure,ws.access_type,ws.notes,
          ws.latitude,ws.longitude,
          st_distance(st_setsrid(st_makepoint(ws.longitude,ws.latitude),4326)::geography,v_point)/1609.344 distance_miles
        from public.water_spots ws
        where ws.user_id=v_user and ws.latitude is not null and ws.longitude is not null
          and st_dwithin(st_setsrid(st_makepoint(ws.longitude,ws.latitude),4326)::geography,v_point,v_radius)
        order by distance_miles limit 50
      ) s
    ),'[]'::jsonb),
    'recent_catches',coalesce((
      select jsonb_agg(to_jsonb(c) order by c.caught_at desc)
      from (
        select id,caught_at,water,spot,species,length_in,weight_lb,combo_name,lure_bait,color,learned,try_next
        from public.catches
        where owner_id=v_user and (v_water_name is null or water ilike '%'||v_water_name||'%')
        order by caught_at desc limit 20
      ) c
    ),'[]'::jsonb),
    'generated_at',now()
  );
end;
$$;


--
-- Name: bootstrap_atlas_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bootstrap_atlas_account() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  insert into public.profiles(id, display_name)
  values(uid, 'Angler')
  on conflict(id) do nothing;
  return jsonb_build_object('success',true,'profile_initialized',true,'gear_seeded',false);
end;
$$;


--
-- Name: get_coaching_card(text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_coaching_card(p_lake text, p_target text, p_season text, p_water_clarity text, p_wind text, p_light text) RETURNS TABLE(combo_name text, lure_color text, why_text text, how_text text, watch_for text, next_step text, lesson text, matched_atlas_id text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select s.combo_name,s.lure_color,s.why_text,s.how_text,s.watch_for,s.next_step,s.lesson,s.atlas_id
  from public.coaching_scenarios s
  where s.owner_id=auth.uid() and s.active
    and (s.lake=p_lake or s.lake='Any Water')
    and s.target=p_target
    and (s.season=p_season or s.season='Any')
    and (s.water_clarity=p_water_clarity or s.water_clarity='Any')
    and (s.wind=p_wind or s.wind='Any')
    and (s.light=p_light or s.light='Any')
  order by
    (s.lake=p_lake)::int desc,
    (s.season=p_season)::int desc,
    (s.water_clarity=p_water_clarity)::int desc,
    (s.wind=p_wind)::int desc,
    (s.light=p_light)::int desc,
    s.priority asc
  limit 1;
$$;


--
-- Name: get_mission_plan_v2(text, text, text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mission_plan_v2(p_water text, p_target text, p_season text, p_clarity text, p_wind text, p_light text, p_access text DEFAULT 'Shore'::text, p_cover text DEFAULT 'Mixed'::text, p_current text DEFAULT 'None'::text, p_depth text DEFAULT 'Shallow'::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  u uuid := auth.uid();
  primary_combo text; primary_lure text; primary_color text; primary_how text; primary_why text; primary_watch text;
  backup_combo text; backup_lure text; backup_color text; backup_how text; backup_why text;
  finesse_combo text := 'PhysYX + Regal LT'; finesse_lure text := 'Ned rig'; finesse_color text := 'Green Pumpkin'; finesse_how text;
  lesson_text text;
begin
  if u is null then raise exception 'Authentication required'; end if;

  if lower(p_target) like '%walleye%' then
    if lower(p_current) in ('moderate','strong') or lower(p_cover) like '%current%' then
      primary_combo := 'BPS TSR + Nexave'; primary_lure := 'Three-way or slip-sinker rig'; primary_color := 'Natural nightcrawler or minnow';
      primary_how := 'Cast slightly upstream of the seam, let the sinker hold bottom, and keep the line tight enough to detect taps without dragging the bait.';
      primary_why := 'Current concentrates food and walleye often hold on the slower edge where a natural bait can stay in place.';
      primary_watch := 'Two or three taps followed by steady weight, or the line moving sideways.';
      backup_combo := 'PhysYX + Regal LT'; backup_lure := 'X-Rap XR10'; backup_color := case when lower(p_clarity)='clear' then 'Natural silver or perch' else 'Bluegill flash or chartreuse accent' end;
      backup_how := 'Cast across or slightly downstream and use pull-pause retrieves through the current seam.';
      backup_why := 'The jerkbait covers active fish without sacrificing control in current.';
    else
      primary_combo := 'PhysYX + Regal LT'; primary_lure := 'X-Rap XR10'; primary_color := case when lower(p_clarity)='clear' then 'Natural silver / perch' else 'Bluegill flash / chartreuse accent' end;
      primary_how := 'Use two short snaps, then pause. Lengthen the pause in cold or calm water and shorten it when fish are active.';
      primary_why := 'The spinning setup casts and controls jerkbaits well, while the pause gives walleye time to commit.';
      -- P3-16 ("an X-Rap is not described with live-bait wording"): "a tick"
      -- is bait-fishing terminology (feeling a fish mouth a live bait) --
      -- confirmed wrong for a suspending jerkbait, which a fish inhales
      -- while it's paused, motionless, in the water. Matches this file's
      -- own wording for every other hard bait's watch-for line (ChatterBait/
      -- spinnerbait above use "feels heavy"/"sudden heaviness", not a tick).
      primary_watch := 'The bait stops moving, feels heavy, or the line jumps or slides sideways before the next snap.';
      backup_combo := 'BPS TSR + Nexave'; backup_lure := 'Slip-sinker rig'; backup_color := 'Nightcrawler'; backup_how := 'Set it on bottom near a break, point, or inlet and let the fish load the rod.'; backup_why := 'Live bait slows the presentation when active lures are ignored.';
    end if;
    finesse_lure := '1/8 oz jig and minnow-style plastic'; finesse_color := case when lower(p_clarity)='clear' then 'Natural shad' else 'Chartreuse / white' end;
    finesse_how := 'Cast, count it down, and swim it just above bottom with occasional lifts.';
  elsif lower(p_target) like '%panfish%' or lower(p_target) like '%crappie%' then
    primary_combo := 'Ebisu Z + Monarch'; primary_lure := 'Crappie jig'; primary_color := case when lower(p_clarity)='clear' then 'Blue Thunder' else 'Chartreuse / white' end;
    primary_how := 'Cast beside docks, brush, or weed edges; count it down and retrieve slowly with tiny twitches.';
    primary_why := 'The utility spinning setup protects light line and presents small jigs naturally.';
    primary_watch := 'The line stops sinking, jumps, or drifts sideways.';
    backup_combo := 'Ebisu Z + Monarch'; backup_lure := 'Bobber and small jig'; backup_color := primary_color; backup_how := 'Set depth just above the fish and use minimal movement.'; backup_why := 'A suspended presentation stays in the strike zone longer.';
    finesse_combo := 'Ebisu Z + Monarch'; finesse_lure := '1/32 oz plain jig'; finesse_color := 'Natural'; finesse_how := 'Fish vertically or under a fixed float with almost no action.';
  else
    if lower(p_light)='low' and lower(p_clarity) in ('stained','dirty') then
      primary_combo := 'Legend + AIRD 80'; primary_lure := 'Z-Man Mini Max'; primary_color := 'Black/Blue';
      primary_how := 'Cast parallel to grass, shade, or shoreline cover. Reel just fast enough to feel the blade and rip it free when it touches grass.';
      primary_why := 'Low light and stained water favor vibration and a strong dark silhouette.';
      primary_watch := 'The vibration stops, the bait feels heavy, or the line jumps.';
      backup_combo := 'Curado + Revo MGX'; backup_lure := '3/8 oz spinnerbait'; backup_color := 'Chartreuse/White'; backup_how := 'Slow-roll it past wood, rock, and weed edges with occasional speed changes.'; backup_why := 'The spinnerbait comes through cover well and adds flash when fish are roaming.';
    elsif lower(p_wind) in ('moderate','high') then
      primary_combo := 'Curado + Revo MGX'; primary_lure := '3/8 oz spinnerbait'; primary_color := case when lower(p_clarity)='clear' then 'White / silver' else 'Chartreuse/White' end;
      primary_how := 'Cast across wind-blown points and banks, keep the blades working, and bump cover whenever possible.';
      primary_why := 'Wind activates baitfish and gives reaction baits cover from fish seeing them too clearly.';
      primary_watch := 'A hard thump, sudden heaviness, or the blades stopping.';
      backup_combo := 'Legend + AIRD 80'; backup_lure := 'ChatterBait'; backup_color := case when lower(p_clarity)='clear' then 'Bluegill / green pumpkin' else 'Black/Blue' end; backup_how := 'Use a steady retrieve with brief stalls around cover.'; backup_why := 'It gives a different vibration profile if fish follow the spinnerbait without committing.';
    elsif lower(p_cover) in ('wood','docks','heavy grass') or lower(p_light)='bright' then
      primary_combo := 'Abu MAX Combo'; primary_lure := 'Texas rig'; primary_color := 'Green Pumpkin';
      primary_how := 'Pitch to the darkest side of cover, let it fall on semi-slack line, then drag or hop it once or twice before recasting.';
      primary_why := 'Bright light and tight cover often position bass where a controlled bottom bait can reach them.';
      primary_watch := 'A tick, mushy weight, line movement, or the bait failing to reach bottom.';
      backup_combo := 'Legend + AIRD 80'; backup_lure := 'Compact jig'; backup_color := 'Black/Blue or Green Pumpkin'; backup_how := 'Work it slowly through the same high-percentage targets.'; backup_why := 'The jig offers a bulkier profile for better fish.';
    else
      primary_combo := 'PhysYX + Regal LT'; primary_lure := 'X-Rap XR10'; primary_color := case when lower(p_clarity)='clear' then 'Natural silver / perch' else 'Bluegill flash' end;
      primary_how := 'Fan-cast points and edges using two snaps and a pause, changing pause length until fish respond.';
      primary_why := 'In calmer or clearer conditions, the jerkbait searches water while still looking natural.';
      primary_watch := 'Weight during the pause or a fish appearing behind the lure.';
      backup_combo := 'Curado + Revo MGX'; backup_lure := 'Whopper Plopper or Torpedo'; backup_color := 'Perch / frog'; backup_how := 'Use around shallow edges during low light or surface activity.'; backup_why := 'Topwater confirms whether fish are willing to feed upward.';
    end if;
    finesse_how := 'Cast to the same productive cover, let it reach bottom, then use tiny drags and long pauses.';
  end if;

  lesson_text := case
    when lower(p_current) in ('moderate','strong') then 'Learn to identify the seam between fast and slow water; most casts should cross or finish in that transition.'
    when lower(p_cover) in ('grass','heavy grass') then 'Learn the difference between grass loading the lure and a fish stopping it. When unsure, reel down and set the hook.'
    when lower(p_light)='bright' then 'Focus on shade and precise casts rather than covering empty water.'
    else 'Change only one variable at a time—retrieve speed, depth, or color—so you learn what caused the response.' end;

  return jsonb_build_object(
    'inputs',jsonb_build_object('water',p_water,'target',p_target,'season',p_season,'clarity',p_clarity,'wind',p_wind,'light',p_light,'access',p_access,'cover',p_cover,'current',p_current,'depth',p_depth),
    'primary',jsonb_build_object('combo',primary_combo,'lure',primary_lure,'color',primary_color,'why',primary_why,'how',primary_how,'watch_for',primary_watch,'time_limit','Fish this for 20–30 focused minutes or until you identify a pattern.'),
    'backup',jsonb_build_object('combo',backup_combo,'lure',backup_lure,'color',backup_color,'why',backup_why,'how',backup_how,'switch_when','Switch when the primary gets no follows, bites, or signs after covering good water.'),
    'finesse',jsonb_build_object('combo',finesse_combo,'lure',finesse_lure,'color',finesse_color,'how',finesse_how,'switch_when','Use when fish follow, nip, or refuse the faster options.'),
    'lesson',lesson_text,
    'confidence',case when p_water is not null and p_water<>'' then 78 else 65 end
  );
end $$;


--
-- Name: get_mission_plan_v3(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mission_plan_v3(p_context jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$

declare

  u uuid:=auth.uid();

  w text:=coalesce(p_context->>'water','Unknown water');

  target text:=lower(coalesce(p_context->>'target','largemouth bass'));

  clarity text:=lower(coalesce(p_context->>'clarity','stained'));

  wind text:=lower(coalesce(p_context->>'wind','moderate'));

  light text:=lower(coalesce(p_context->>'light','low'));

  cover text:=lower(coalesce(p_context->>'cover','mixed'));

  current_strength text:=lower(coalesce(p_context->>'current','none'));

  depth_zone text:=lower(coalesce(p_context->>'depth','unknown'));

  pressure text:=lower(coalesce(p_context->>'pressure_trend','steady'));

  level_trend text:=lower(coalesce(p_context->>'water_level_trend','stable'));

  season text:=lower(coalesce(p_context->>'season','summer'));

  activity text:=lower(coalesce(p_context->>'fish_activity','unknown'));

  water_type text:=lower(coalesce(p_context->>'water_type','lake'));

  primary_combo text; primary_lure text; primary_color text; primary_how text; primary_why text; primary_watch text;

  backup_combo text; backup_lure text; backup_color text; backup_how text;

  finesse_combo text; finesse_lure text; finesse_color text; finesse_how text;

  start_zone text; adjustment text; data_note text;

  confidence int:=68;

begin

  if u is null then raise exception 'Authentication required'; end if;



  -- Never expose one angler's named equipment to another. These are role descriptions;

  -- the client-side inventory matcher chooses the actual owned combo for the signed-in user.

  primary_combo:='Medium spinning setup';

  backup_combo:='Medium spinning setup';

  finesse_combo:='Medium-light spinning setup';

  primary_color:=case when clarity='clear' then 'Natural / forage-matching' when clarity='dirty' then 'High contrast / dark or bright' else 'Natural with some contrast' end;

  backup_color:=primary_color; finesse_color:=case when clarity='clear' then 'Natural' else 'Green pumpkin, white, or subtle contrast' end;



  if water_type ~ 'river|stream' or current_strength not in ('none','') then

    start_zone:='Start on a current break: the slow side of a seam, eddy, downstream side of rock or wood, bridge piling, outside bend, or tailwater transition.';

  elsif wind in ('moderate','high') then

    start_zone:='Start on a wind-blown point, bank, weed edge, or inlet where forage may be concentrated.';

  elsif light='bright' then

    start_zone:='Start with shade, docks, deeper weed edges, or the first break outside shallow cover.';

  else

    start_zone:='Start around points, vegetation edges, docks, wood, rock, or an inlet, then work outward.';

  end if;



  -- Walleye / sauger family. MN DNR guidance supports jig/minnow, slip-sinker/live bait,

  -- slip bobber, and small hard baits; use enough jig weight to maintain bottom contact.

  if target ~ 'walleye|sauger|saugeye' then

    primary_combo:='Medium-light or medium spinning setup';

    backup_combo:='Medium-light or medium spinning setup';

    finesse_combo:='Medium-light spinning setup';

    if water_type ~ 'river|stream' or current_strength in ('moderate','strong') then

      primary_lure:='1/8–3/8 oz jig with minnow or minnow-style plastic';

      primary_why:='Jigs let you maintain bottom contact while working current seams, eddies, rock, and channel edges where walleyes and sauger feed.';

      primary_how:='Use the lightest jig that consistently reaches bottom. Cast slightly upstream or across current, let it sink, then lift or swim it just off bottom while following the drift.';

      primary_watch:='A tap, sudden slack, extra weight, or the line moving differently from the current.';

      backup_lure:='Three-way or slip-sinker live-bait rig';

      backup_how:='Hold or drift the bait along the slower edge of current while maintaining occasional bottom contact.';

    elsif depth_zone='deep' or season='summer' then

      primary_lure:='Slip-sinker (Lindy-style) live-bait rig';

      primary_why:='A sliding live-bait rig presents a crawler, leech, or minnow naturally near bottom and is a proven warm-season walleye method.';

      primary_how:='Use the lightest sinker that maintains bottom contact. Move slowly; when a light bite develops, follow the hook style and bait method you are using rather than jerking immediately.';

      primary_watch:='Light taps, steady pressure, or line moving away from the presentation.';

      backup_lure:='Slip bobber with live bait or small jig';

      backup_how:='Set the bait just above the fish-holding depth around reefs, humps, weed edges, or points.';

    else

      primary_lure:='1/8–1/4 oz jig with minnow or minnow-style plastic';

      primary_why:='Jigging is a dependable walleye presentation in shallow to mid-depth water, especially around points, rock, and weed edges.';

      primary_how:='Let the jig reach bottom, then use short lifts or a slow swim-and-pause retrieve while keeping contact with the lower part of the water column.';

      primary_watch:='A tap, sudden heaviness, or the line stopping or moving sideways.';

      backup_lure:='Small minnow-shaped crankbait or suspending jerkbait';

      backup_how:='Cast or troll slowly enough for the lure to work properly, focusing on weedlines, gravel bars, and points.';

    end if;

    primary_color:=case when clarity='clear' then 'Natural shad, perch, silver, or subdued' else 'Chartreuse accent, white, gold, or added contrast' end;

    backup_color:=primary_color;

    finesse_lure:='Slip bobber with live bait or 1/8 oz jig';

    finesse_how:='Hold the presentation just above bottom or the known fish depth with minimal movement.';

    data_note:='Walleye-family guidance uses proven jig, live-bait, bobber, and hard-bait patterns. Exact legal seasons and water-specific rules must still be checked.';



  -- Crappie, sunfish, perch, and common panfish.

  elsif target ~ 'crappie|bluegill|pumpkinseed|sunfish|yellow perch|rock bass|warmouth' then

    primary_combo:='Light or ultralight spinning setup'; backup_combo:=primary_combo; finesse_combo:=primary_combo;

    primary_lure:='1/32–1/16 oz jig with 1–2 in plastic or live bait';

    primary_color:=case when clarity='clear' then 'Natural, white, or subtle' else 'Chartreuse, white, pink, or other visible contrast' end;

    primary_why:='Small jigs and live bait match panfish forage and can be held precisely near docks, brush, vegetation, rock, or suspended fish.';

    primary_how:='Count it down and retrieve slowly with tiny twitches, or suspend it under a float at the fish-holding depth.';

    primary_watch:='The line stops sinking, jumps, drifts sideways, or the float moves unnaturally.';

    backup_lure:='Slip float with small jig, hook, and live bait'; backup_color:=primary_color;

    backup_how:='Set the bait slightly above the fish and adjust depth before changing color.';

    finesse_lure:='1/64–1/32 oz jig or small hook with live bait'; finesse_color:='Natural';

    finesse_how:='Use minimal movement and keep the bait in the strike zone.';

    data_note:='Panfish guidance emphasizes small jigs, floats, and live bait with depth control.';



  -- Northern pike and pickerel. MN DNR emphasizes weedbeds/points, spoons/plugs, and bite-resistant leaders.

  elsif target ~ 'northern pike|pickerel' then

    primary_combo:='Medium-heavy spinning or casting setup'; backup_combo:=primary_combo; finesse_combo:='Medium spinning setup';

    primary_lure:=case when cover ~ 'grass|lily|mixed' then '3/8–3/4 oz spinnerbait, inline spinner, or weed-friendly spoon' else 'Spoon, spinner, or 4–6 in minnow/swimbait' end;

    primary_color:=case when clarity='clear' then 'Natural silver, perch, or white' else 'Gold, chartreuse, white, or high contrast' end;

    primary_why:='Pike are ambush predators commonly found around vegetation, rocky points, wood, backwaters, and other structure.';

    primary_how:='Cast along weed edges and structure with a steady to moderately fast retrieve. Add brief speed changes or pauses when the lure clears cover.';

    primary_watch:='A hard strike, sudden weight, or the lure stopping abruptly.';

    backup_lure='4–6 in paddletail swimbait or minnow-style plug'; backup_color:=primary_color;

    backup_how='Work it parallel to vegetation or over the top of submerged weeds at a controlled speed.';

    finesse_lure='Live minnow under a float where legal and appropriate'; finesse_color='Natural';

    finesse_how='Suspend the bait near vegetation edges or other ambush cover.';

    data_note='Use a bite-resistant steel or appropriately heavy fluorocarbon leader for pike. Check current regulations and bait rules for the water being fished.';



  -- Muskellunge / tiger muskie. MN DNR supports large bucktails, crankbaits, topwaters, soft plastics, heavy braid and leaders.

  elsif target ~ 'muskellunge|muskie|tiger musk' then

    primary_combo:='Heavy muskie casting setup'; backup_combo:=primary_combo; finesse_combo:=primary_combo;

    primary_lure='Large bucktail / inline spinner (roughly 5–10 in class)';

    primary_color:=case when clarity='clear' then 'Natural forage, black/nickel, or subdued contrast' else 'Black, orange, chartreuse, or high-contrast blade combinations' end;

    primary_why='Muskellunge are typically searched with large artificial lures around weed edges, points, reefs, humps, and shallow feeding areas.';

    primary_how='Make long controlled casts and retrieve with enough speed to keep the blades working. Watch the lure all the way to the boat or bank and finish close follows with a safe direction change or figure-eight when practical.';

    primary_watch='A visible follow, sudden load, or violent strike near the end of the retrieve.';

    backup_lure='Large diving crankbait or soft-plastic swimbait'; backup_color:=primary_color;

    backup_how='Work weedlines, points, reefs, and open-water edges with a steady retrieve or trolling presentation where legal and practical.';

    finesse_lure='Smaller-profile muskie bucktail or glide/minnow bait'; finesse_color:=primary_color;

    finesse_how='Downsize within muskie-capable tackle; do not substitute undersized bass tackle.';

    data_note='Muskie require stout tackle, heavy braid, a bite-resistant leader, large landing tools, and careful release equipment. Check current size/season regulations before targeting.';



  -- Channel/flathead catfish and bullheads.

  elsif target ~ 'catfish|bullhead|stonecat|madtom' then

    if target ~ 'flathead' then

      primary_combo:='Heavy bottom-fishing setup with 30 lb+ line'; backup_combo:=primary_combo; finesse_combo:=primary_combo;

      primary_lure:='Bottom rig with a large legal live baitfish or a large gob of nightcrawlers';

      primary_why:='Flathead catfish are fish predators that commonly hold near deep pools, submerged timber, rootwads, and lower-current cover; Minnesota DNR notes they usually favor large live bait over dead or stink bait.';

    elsif target ~ 'channel catfish' then

      primary_combo:='Medium-heavy bottom-fishing setup with roughly 15–20 lb line'; backup_combo:=primary_combo; finesse_combo:='Medium bottom-fishing setup';

      primary_lure:='Sliding egg/no-roll sinker rig with about a 2 ft leader and 4/0–6/0 circle or bait hook';

      primary_why:='This is a standard channel-catfish bottom rig; cut bait, nightcrawlers, chicken liver, and legal prepared baits can all be effective.';

    elsif target ~ 'bullhead' then

      primary_combo:='Medium bottom-fishing setup'; backup_combo:=primary_combo; finesse_combo:=primary_combo;

      primary_lure:='Simple bottom rig with worm or other legal bait';

      primary_why:='Bullheads readily feed on natural bait near bottom and generally do not require oversized catfish tackle.';

    else

      primary_combo:='Medium-heavy bottom-fishing setup'; backup_combo:=primary_combo; finesse_combo:='Medium bottom-fishing setup';

      primary_lure:='Slip-sinker or no-roll bottom rig with species-appropriate legal bait';

      primary_why:='Bottom-oriented catfish presentations keep bait in productive zones while allowing useful bite detection.';

    end if;

    primary_color='Natural bait';

    primary_how='Place the bait near a channel edge, hole, current seam, wood, or other travel route. In current, use enough weight to hold without grossly over-weighting the rig.';

    primary_watch='Steady rod loading, repeated taps that become pressure, or line moving away.';

    backup_lure='Three-way river rig or float rig when current/cover makes the primary awkward'; backup_color='Natural bait';

    backup_how='Change placement and current angle before simply adding more weight.';

    finesse_lure='Lighter slip-sinker rig'; finesse_color='Natural bait';

    finesse_how='Use the lightest weight that still maintains useful bottom contact.';

    data_note='Use only bait legal for the water and species. Circle-hook technique differs from a traditional hard hook-set; let pressure load the rod and reel into the fish.';



  -- Stream trout. Minnesota DNR supports small spinners/jigs/minnow imitators and natural drift bait on light tackle.

  elsif target ~ 'brook trout|brown trout|rainbow trout' and water_type ~ 'river|stream' then

    primary_combo='Ultralight or light spinning setup'; backup_combo:=primary_combo; finesse_combo:=primary_combo;

    primary_lure='Small inline spinner, small jig/minnow imitator, or legal drift bait';

    primary_color:=case when target ~ 'brown' then 'Gold / natural' when target ~ 'rainbow' then 'Silver / natural' else 'Copper / natural' end;

    primary_why='Stream trout commonly hold in pools, riffle edges, undercut banks, and current breaks where small prey drifts or swims past.';

    primary_how='Approach quietly. Cast upstream or across the holding water and retrieve or drift naturally with the current while keeping excess slack controlled.';

    primary_watch='A flash, stop, tap, or line movement that differs from the current.';

    backup_lure='Half nightcrawler or other legal natural bait on a small hook with minimal split shot'; backup_color='Natural';

    backup_how='Drift the bait naturally through the pool or seam; use only enough weight to reach the target depth.';

    finesse_lure='Small jig or spinner'; finesse_color:=primary_color;

    finesse_how='Downsize and make quieter, more accurate presentations.';

    data_note='Stream-trout regulations, seasons, bait restrictions, and trout-stamp requirements can vary by water. Check current rules before fishing.';



  -- Lake trout / salmon / whitefish: keep the recommendation conservative because depth and waterbody matter greatly.

  elsif target ~ 'lake trout|salmon|whitefish|cisco|tullibee|splake' then

    primary_combo='Medium to medium-heavy spinning or trolling setup appropriate to the lure and depth'; backup_combo:=primary_combo; finesse_combo='Medium spinning setup';

    primary_lure=case when season='winter' then 'Jigging spoon or minnow-style jig' else 'Spoon, minnow bait, or jig matched to the depth where fish are marked' end;

    primary_color=case when clarity='clear' then 'Natural silver, white, or forage pattern' else 'Glow, chartreuse accent, or higher contrast' end;

    primary_why='These cold-water species are strongly depth- and waterbody-dependent, so the first job is presenting at the depth where fish or forage are actually located.';

    primary_how='Keep the lure at the fish-marked depth rather than assuming bottom. Jig, cast, or troll according to the water and season.';

    primary_watch='A strike, sudden weight, or fish following the lure on electronics.';

    backup_lure='Smaller spoon or jig'; backup_color:=primary_color; backup_how='Downsize and slow the presentation while staying at the same productive depth.';

    finesse_lure='Small jigging spoon or minnow imitator'; finesse_color:=primary_color; finesse_how='Use controlled vertical movement at the known fish depth.';

    data_note='Great Lakes and cold-water fisheries often have highly specific seasons, depths, gear, and regulations. Treat this as general presentation guidance and confirm local rules.';



  -- White bass and yellow bass are temperate basses, not black bass -- open-water

  -- schooling fish, not cover fish. They do not belong in the largemouth/smallmouth

  -- branch below (a bare 'bass' match used to route them there by accident).

  elsif target ~ 'white bass|yellow bass' then

    primary_combo:='Medium-light or medium spinning setup'; backup_combo:=primary_combo; finesse_combo:='Light spinning setup';

    primary_lure:=case when activity='active' then 'Small jigging spoon or 1/4-3/8 oz swimbait' else '1/8-1/4 oz curly-tail jig or small crankbait' end;

    primary_color:=case when clarity='clear' then 'Natural shad or silver' else 'Chartreuse or white with added flash' end;

    primary_why:='White and yellow bass school and feed on baitfish in open water, often near current breaks, river mouths, humps, or points rather than holding tight to cover the way largemouth or smallmouth do.';

    primary_how:='Look for gulls, surface activity, or bait on electronics before committing to a spot. Cast past visible schools and retrieve steadily through the school; if fish are not surface-feeding, work the same areas at the depth marked on electronics.';

    primary_watch:='A hard, fast strike, often several in a row while a school is actively feeding.';

    backup_lure:='Small inline spinner or spoon'; backup_color:=primary_color;

    backup_how:='Cover more water at the same depth to relocate the school once the first pass goes quiet.';

    finesse_lure:='Small tube or curly-tail grub on a light jig head'; finesse_color:='Natural / white';

    finesse_how:='Slow down and fish just under a scattered or sounding school rather than chasing surface activity.';

    confidence:=65;

    data_note:='White and yellow bass move in schools and can go quiet quickly once a school sounds; relocating is usually more productive than staying put.';



  -- Black bass (largemouth/smallmouth). Distinguish largemouth cover from smallmouth rock/current when possible.

  elsif target ~ 'largemouth bass|smallmouth bass|bass' then

    if target ~ 'smallmouth' and (cover ~ 'rock|riprap' or water_type ~ 'river|stream' or current_strength not in ('none','')) then

      primary_combo='Medium-light or medium spinning setup'; backup_combo='Medium spinning or casting setup'; finesse_combo='Medium-light spinning setup';

      primary_lure=case when depth_zone='deep' then '1/4–3/8 oz jig with craw/minnow plastic' else 'Ned rig or small craw/minnow jig' end;

      primary_color=case when clarity='clear' then 'Green pumpkin, goby, brown, or natural minnow' else 'Green pumpkin with contrast or chartreuse accent' end;

      primary_why='Smallmouth commonly relate to rock, points, current breaks, riffles, pools, and crayfish/minnow forage.';

      primary_how='Maintain bottom contact with short drags or hops, pausing beside rock and current breaks.';

      primary_watch='A tick, sudden weight, line movement, or the bait feeling stuck where it should not be.';

      backup_lure='Small hard minnow bait, spinnerbait, or paddletail swimbait'; backup_color:=primary_color;

      backup_how='Cover the same rock/current edge at a slightly faster pace.';

      finesse_lure='Ned rig or drop shot'; finesse_color='Green pumpkin / natural';

      finesse_how='Use small movements and longer pauses around rock and transitions.';

    elsif cover in ('wood','docks','heavy grass') or light='bright' or pressure='rising' then

      primary_combo='Medium-heavy fast casting setup'; backup_combo='Medium-heavy casting setup'; finesse_combo='Medium spinning setup';

      primary_lure='Texas-rigged worm, craw, or creature bait'; primary_color:=case when clarity='dirty' then 'Black/blue or other dark contrast' else 'Green pumpkin or natural' end;

      primary_why='Largemouth commonly use vegetation, wood, docks, shade, and other cover; a weedless Texas rig can reach those places with fewer snags.';

      primary_how='Pitch or cast tight to cover, watch the fall, then use short hops or drags before making another high-percentage cast.';

      primary_watch='A tick, mushy weight, line movement, or the bait stopping before expected bottom.';

      backup_lure='Compact jig or weed-friendly bladed/spinner bait'; backup_color:=primary_color;

      backup_how='Work the outside edge or a slightly different depth/speed after probing the cover.';

      finesse_lure='Weightless or lightly weighted wacky rig'; finesse_color='Green pumpkin / natural';

      finesse_how='Let it fall on semi-slack line beside shade, docks, or vegetation edges and watch the line closely.';

    elsif wind in ('moderate','high') or pressure='falling' then

      primary_combo='Medium or medium-heavy casting setup'; backup_combo='Medium spinning or casting setup'; finesse_combo='Medium-light spinning setup';

      primary_lure='3/8 oz spinnerbait or compact bladed jig'; primary_color:=case when clarity='clear' then 'White/silver or natural baitfish' else 'Chartreuse/white, black/blue, or stronger contrast' end;

      primary_why='Wind and lower light often make moving presentations efficient for covering water around banks, points, weeds, and wood.';

      primary_how='Retrieve just fast enough for the lure to work correctly, making contact with or passing close to cover when practical.';

      primary_watch='A hard thump, sudden heaviness, or loss/change of blade vibration.';

      backup_lure='Paddletail swimbait or shallow crankbait'; backup_color:=primary_color;

      backup_how='Cover the same high-percentage water with a different vibration profile.';

      finesse_lure='Ned rig or wacky rig'; finesse_color='Green pumpkin / natural'; finesse_how='Slow down on the best cover or transition after the moving-bait pass.';

    else

      primary_combo='Medium spinning or casting setup'; backup_combo:=primary_combo; finesse_combo='Medium-light spinning setup';

      primary_lure=case when light='low' then 'Topwater, small swimbait, or shallow search bait' else 'Natural minnow bait, swimbait, or finesse worm' end;

      primary_color:=case when clarity='clear' then 'Natural forage pattern' else 'Natural with added contrast' end;

      primary_why='A natural search presentation covers points, weed edges, rock, and transitions without assuming fish are buried in heavy cover.';

      primary_how='Fan-cast the highest-percentage edge, changing retrieve speed or pause length before changing lures.';

      primary_watch='A strike, follow, sudden heaviness, or change in lure vibration.';

      backup_lure='Spinnerbait, jig, or Texas rig matched to the visible cover'; backup_color:=primary_color;

      backup_how='Use the backup to probe cover or a different depth after the search pass.';

      finesse_lure='Ned rig, wacky rig, or drop shot'; finesse_color='Green pumpkin / natural'; finesse_how='Slow down around the best structure and use longer pauses.';

    end if;

    data_note='Bass guidance distinguishes cover-oriented largemouth patterns from rock/current-oriented smallmouth patterns when the supplied context supports it.';



  -- Carp, buffalo, suckers, redhorse, drum and similar bottom-oriented non-game species.

  elsif target ~ 'carp|buffalo|sucker|redhorse|carpsucker|quillback|freshwater drum|goldeye|mooneye' then

    primary_combo='Medium to medium-heavy spinning or bottom-fishing setup'; backup_combo:=primary_combo; finesse_combo='Medium spinning setup';

    primary_lure='Simple bottom rig with species-appropriate legal bait'; primary_color='Natural bait';

    primary_why='These species are commonly caught while presenting natural bait near bottom, current seams, flats, channel edges, or feeding areas.';

    primary_how='Use enough weight to keep the bait in the target area, but keep the rig sensitive enough to detect pressure or movement.';

    primary_watch='Steady pressure, taps, or line movement.';

    backup_lure='Lighter bottom rig or float presentation where appropriate'; backup_color='Natural bait'; backup_how='Adjust depth, current position, and bait before adding unnecessary weight.';

    finesse_lure='Small hook and lighter sinker with legal natural bait'; finesse_color='Natural'; finesse_how='Scale the hook and bait to the species size and current.';

    data_note='Bait legality and species-specific rules vary. Confirm current regulations, especially when using live bait.';



  -- Lake sturgeon. Minnesota DNR provides a specific heavy slip-sinker rig, so use it rather than a generic fallback.

  elsif target ~ 'lake sturgeon' then

    primary_combo='Stout muskie/heavy bottom-fishing setup with 80–100 lb braid'; backup_combo:=primary_combo; finesse_combo:=primary_combo;

    primary_lure='Heavy slip/no-roll sinker rig with 12–18 in leader and about a 5/0 circle hook'; primary_color='Natural bait';

    primary_why='Minnesota DNR describes a heavy slip-sinker rig with strong braid, a short leader, and a circle hook as a typical lake-sturgeon setup.';

    primary_how='Use only enough 1–5 oz sinker weight to hold bottom. Bait with legal nightcrawlers and/or minnows as allowed. When a bite develops, tighten slack and raise the rod so the circle hook can load rather than making a violent hook-set.';

    primary_watch='Light taps that become steady pressure or a slow, deliberate pull.';

    backup_lure='Same slip-sinker rig with adjusted sinker weight or bait'; backup_color='Natural bait'; backup_how='Change only enough weight to maintain bottom contact and reposition before changing the basic rig.';

    finesse_lure='No lighter-tackle substitute'; finesse_color='—'; finesse_how='Do not downsize below tackle capable of landing the fish efficiently.';

    confidence:=75;

    data_note='Lake-sturgeon seasons, harvest rules, and water-specific regulations are highly specific. Confirm current regulations before targeting.';



  -- Other specialized/nontraditional targets: stay conservative instead of inventing generic bass advice.

  elsif target ~ 'sturgeon|paddlefish|gar|bowfin|burbot|eel' then

    primary_combo='Species-appropriate heavy or medium-heavy setup'; backup_combo:=primary_combo; finesse_combo:=primary_combo;

    primary_lure='Species-specific bait or presentation — verify local regulations first'; primary_color='Natural / species appropriate';

    primary_why='This species requires more specialized tactics and can be subject to highly specific seasons, gear, bait, or harvest rules.';

    primary_how='Confirm that targeting method, bait, season, and location are legal for this water before selecting a rig. Favor locally proven species-specific techniques rather than a generic bass presentation.';

    primary_watch='Follow the bite behavior expected for the legal method you selected.';

    backup_lure='Alternate legal species-specific presentation'; backup_color='Natural'; backup_how='Change location, depth, or bait only within current regulations.';

    finesse_lure='No generic finesse recommendation'; finesse_color='—'; finesse_how='FishWizz intentionally avoids guessing for specialized regulated species.';

    confidence:=52;

    data_note='Specialized species mode: FishWizz is intentionally conservative because methods and regulations can vary substantially by water.';



  else

    primary_combo='Light or medium spinning setup matched to species size'; backup_combo:=primary_combo; finesse_combo:=primary_combo;

    primary_lure='Species-appropriate small lure or legal natural bait'; primary_color='Natural';

    primary_why='FishWizz does not yet have a high-confidence species-specific rig model for this target.';

    primary_how='Use the smallest practical presentation that matches the species size and known diet, and prioritize verified local guidance over generic advice.';

    primary_watch='Any unnatural line movement, pressure, or visible take.';

    backup_lure='Alternate species-appropriate legal presentation'; backup_color='Natural'; backup_how='Change depth or location before making a large presentation change.';

    finesse_lure='Small legal bait or lure'; finesse_color='Natural'; finesse_how='Keep the presentation simple and scaled to the fish.';

    confidence:=48;

    data_note='Low-confidence target: FishWizz will not substitute bass advice for an unsupported species. Verify local species guidance and regulations.';

  end if;



  if pressure='falling' then

    confidence:=confidence+3;

    adjustment:='If fish are active, cover water first; if they are not, reduce speed before changing lure category.';

  elsif pressure='rising' then

    adjustment:='Expect a potentially tighter strike zone: slow down, make more precise casts, and prioritize cover or structure.';

  else

    adjustment:='Change one variable at a time: location/depth first, then retrieve speed, then presentation or color.';

  end if;

  if level_trend='rising' then adjustment:=adjustment||' Rising water can move fish toward newly flooded cover or fresh current breaks.';

  elsif level_trend='falling' then adjustment:=adjustment||' Falling water can pull fish toward channel edges, deeper water, or outside cover.'; end if;

  if activity='active' then confidence:=confidence+4; elsif activity='inactive' then confidence:=confidence-5; end if;



  return jsonb_build_object(

    'inputs',p_context,'start_zone',start_zone,

    'primary',jsonb_build_object('combo',primary_combo,'lure',primary_lure,'color',primary_color,'why',primary_why,'how',primary_how,'watch_for',primary_watch,'time_limit','Give productive water 15–25 deliberate minutes before changing location or presentation.'),

    'backup',jsonb_build_object('combo',backup_combo,'lure',backup_lure,'color',backup_color,'why','Use a contrasting but species-appropriate presentation when the primary produces no signs.','how',backup_how,'switch_when','Switch after good water produces no follows, bites, or useful contact.'),

    'finesse',jsonb_build_object('combo',finesse_combo,'lure',finesse_lure,'color',finesse_color,'how',finesse_how,'switch_when','Use the slower/smaller option when fish follow, nip, refuse, or conditions call for a subtler presentation.'),

    'adjustment_plan',adjustment,

    'confidence',greatest(40,least(confidence,90)),

    'data_note',data_note||'General fishing guidance only; confirm current state, season, bait, and water-specific regulations.'

  );

end $$;


--
-- Name: get_personal_fishing_insights(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_personal_fishing_insights(p_waterbody_id uuid DEFAULT NULL::uuid, p_species text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$ with c as (select * from public.catches where owner_id=auth.uid() and (p_waterbody_id is null or waterbody_id=p_waterbody_id) and (p_species is null or lower(species)=lower(p_species))), top_lures as (select coalesce(lure_bait,'Unknown') lure,count(*) n from c group by 1 order by n desc limit 5), top_colors as (select coalesce(color,'Unknown') color,count(*) n from c group by 1 order by n desc limit 5), top_combos as (select coalesce(combo_name,'Unknown') combo,count(*) n from c group by 1 order by n desc limit 5) select jsonb_build_object('catch_count',(select count(*) from c),'top_lures',coalesce((select jsonb_agg(to_jsonb(top_lures)) from top_lures),'[]'::jsonb),'top_colors',coalesce((select jsonb_agg(to_jsonb(top_colors)) from top_colors),'[]'::jsonb),'top_combos',coalesce((select jsonb_agg(to_jsonb(top_combos)) from top_combos),'[]'::jsonb),'recent_lessons',coalesce((select jsonb_agg(jsonb_build_object('caught_at',caught_at,'learned',learned,'try_next',try_next,'why_worked',why_worked) order by caught_at desc) from (select caught_at,learned,try_next,why_worked from c where learned is not null or try_next is not null or why_worked is not null order by caught_at desc limit 8) x),'[]'::jsonb)); $$;


--
-- Name: get_recent_water_intelligence(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recent_water_intelligence(p_waterbody uuid, p_days integer DEFAULT 14) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'auth'
    AS $$
select jsonb_build_object(
 'reports', coalesce((select jsonb_agg(jsonb_build_object('source',rs.name,'title',fr.title,'summary',fr.summary,'url',fr.report_url,'published_at',fr.published_at,'species',fr.species,'lures',fr.lure_mentions,'colors',fr.color_mentions,'confidence',fr.confidence_score) order by fr.published_at desc) from public.fishing_reports fr join public.report_sources rs on rs.id=fr.source_id where fr.waterbody_id=p_waterbody and coalesce(fr.published_at,fr.fetched_at)>=now()-make_interval(days=>greatest(1,least(p_days,90)))), '[]'::jsonb),
 'live_observations', coalesce((select jsonb_agg(jsonb_build_object('site',sg.site_name,'parameter',lwo.parameter_name,'value',lwo.value,'unit',lwo.unit,'observed_at',lwo.observed_at,'approval',lwo.approval_status) order by lwo.observed_at desc) from public.stream_gauges sg join lateral (select * from public.live_water_observations o where o.gauge_id=sg.id order by observed_at desc limit 12) lwo on true where sg.waterbody_id=p_waterbody), '[]'::jsonb),
 'generated_at', now()
);
$$;


--
-- Name: get_water_data_quality(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_water_data_quality(p_waterbody_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
with w as (
  select * from public.waterbodies where id = p_waterbody_id
), counts as (
  select
    (select count(*) from public.waterbody_species s where s.waterbody_id = p_waterbody_id) as species_count,
    (select count(*) from public.public_access_points a where a.waterbody_id = p_waterbody_id) as access_count,
    (select count(*) from public.stream_gauges g where g.waterbody_id = p_waterbody_id and g.active) as gauge_count,
    (select count(*) from public.fishing_reports r where r.waterbody_id = p_waterbody_id and r.published_at >= now() - interval '30 days') as recent_report_count,
    (select max(o.observed_at) from public.live_water_observations o join public.stream_gauges g on g.id=o.gauge_id where g.waterbody_id=p_waterbody_id) as latest_observation,
    (select max(r.published_at) from public.fishing_reports r where r.waterbody_id=p_waterbody_id) as latest_report
), scored as (
  select w.*, counts.*,
    (case when w.geometry is not null then 20 else 0 end +
     case when counts.species_count > 0 then 20 else 0 end +
     case when counts.access_count > 0 then 15 else 0 end +
     case when counts.gauge_count > 0 then 15 else 0 end +
     case when counts.latest_observation >= now() - interval '6 hours' then 15 when counts.latest_observation is not null then 7 else 0 end +
     case when counts.recent_report_count > 0 then 15 when counts.latest_report is not null then 5 else 0 end)::int as quality_score
  from w cross join counts
)
select coalesce(jsonb_build_object(
  'waterbody_id', id,
  'name', name,
  'state_code', state_code,
  'water_type', water_type,
  'score', quality_score,
  'grade', case when quality_score >= 85 then 'A' when quality_score >= 70 then 'B' when quality_score >= 50 then 'C' when quality_score >= 30 then 'D' else 'F' end,
  'coverage', jsonb_build_object('official_geometry', geometry is not null,'species_records', species_count,'access_records', access_count,'linked_gauges', gauge_count,'recent_reports_30d', recent_report_count),
  'freshness', jsonb_build_object('catalog_fetched_at', catalog_fetched_at,'latest_live_observation', latest_observation,'latest_report', latest_report),
  'missing', to_jsonb(array_remove(array[
    case when geometry is null then 'official geometry' end,
    case when species_count = 0 then 'species evidence' end,
    case when access_count = 0 then 'public access' end,
    case when gauge_count = 0 and lower(water_type) in ('river','stream') then 'linked gauge' end,
    case when recent_report_count = 0 then 'recent reports' end
  ], null))
), jsonb_build_object('error','waterbody not found')) from scored;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: nearby_water_catalog(double precision, double precision, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nearby_water_catalog(p_lat double precision, p_lon double precision, p_radius_miles double precision DEFAULT 15, p_limit integer DEFAULT 40) RETURNS TABLE(id uuid, name text, state_code text, water_type text, source_label text, source_system text, official_url text, latitude double precision, longitude double precision, distance_miles double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select w.id,w.name,w.state_code,w.water_type,w.source_label,w.source_system,w.official_url,
    st_y(w.centroid::geometry) as latitude,st_x(w.centroid::geometry) as longitude,
    st_distance(w.centroid,st_setsrid(st_makepoint(p_lon,p_lat),4326)::geography)/1609.344 as distance_miles
  from public.waterbodies w
  where w.centroid is not null
    and st_dwithin(w.centroid,st_setsrid(st_makepoint(p_lon,p_lat),4326)::geography,greatest(1,p_radius_miles)*1609.344)
  order by w.centroid <-> st_setsrid(st_makepoint(p_lon,p_lat),4326)::geography
  limit least(greatest(p_limit,1),100)
$$;


--
-- Name: owns_row(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_row(row_owner uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'auth'
    AS $$ select auth.uid() = row_owner $$;


--
-- Name: record_lure_outcome(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_lure_outcome(p_lure_id uuid, p_outcome text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$ begin update public.lures set last_used_at=now(), catches_count=catches_count+case when lower(p_outcome)='caught' then 1 else 0 end, bites_count=bites_count+case when lower(p_outcome) in ('caught','bite') then 1 else 0 end, quantity=greatest(quantity,0) where id=p_lure_id and owner_id=(select auth.uid()); end $$;


--
-- Name: search_water_catalog(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_water_catalog(p_query text, p_state text DEFAULT NULL::text, p_type text DEFAULT 'all'::text, p_limit integer DEFAULT 12) RETURNS TABLE(id uuid, name text, state_code text, water_type text, source_label text, source_system text, county_name text, official_url text, match_rank integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with q as (select lower(trim(coalesce(p_query,''))) v)
  select w.id,w.name,w.state_code,w.water_type,w.source_label,w.source_system,w.county_name,w.official_url,
    case
      when lower(w.name)=q.v then 0
      when lower(w.name) like q.v||'%' then 1
      when exists(select 1 from unnest(w.aliases) a where lower(a)=q.v) then 2
      when exists(select 1 from unnest(w.aliases) a where lower(a) like q.v||'%') then 3
      when lower(w.name) like '%'||q.v||'%' then 4
      else 5 end as match_rank
  from public.waterbodies w cross join q
  where q.v<>''
    and (p_state is null or p_state='' or w.state_code=p_state)
    and (coalesce(p_type,'all')='all' or w.water_type=p_type or (p_type='stream' and w.water_type='river') or (p_type='river' and w.water_type in ('river','stream')) or (p_type='reservoir' and w.water_type in ('lake','reservoir','flowage')))
    and (lower(w.name) like '%'||q.v||'%' or exists(select 1 from unnest(w.aliases) a where lower(a) like '%'||q.v||'%'))
  order by match_rank,w.name,w.state_code
  limit greatest(1,least(coalesce(p_limit,12),50));
$$;


--
-- Name: search_waterbodies(text, text, text[], double precision, double precision, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_waterbodies(p_query text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_types text[] DEFAULT NULL::text[], p_lat double precision DEFAULT NULL::double precision, p_lon double precision DEFAULT NULL::double precision, p_radius_m integer DEFAULT 50000, p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, name text, state_code text, county_name text, water_type text, latitude double precision, longitude double precision, distance_m double precision, intelligence_level smallint, official_url text, source_label text)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'auth'
    AS $$
  select w.id,w.name,w.state_code,w.county_name,w.water_type,
    case when w.centroid is null then null else st_y(w.centroid::geometry) end,
    case when w.centroid is null then null else st_x(w.centroid::geometry) end,
    case when p_lat is null or p_lon is null or w.centroid is null then null else st_distance(w.centroid, st_setsrid(st_makepoint(p_lon,p_lat),4326)::geography) end,
    w.intelligence_level,w.official_url,w.source_label
  from public.waterbodies w
  where (p_query is null or w.name % p_query or w.name ilike '%'||p_query||'%' or exists(select 1 from unnest(w.aliases) a where a ilike '%'||p_query||'%'))
    and (p_state is null or w.state_code=p_state)
    and (p_types is null or w.water_type=any(p_types))
    and (p_lat is null or p_lon is null or w.centroid is null or st_dwithin(w.centroid, st_setsrid(st_makepoint(p_lon,p_lat),4326)::geography,p_radius_m))
  order by case when p_query is null then 0 else similarity(coalesce(w.name,''),p_query) end desc,
           case when p_lat is null or p_lon is null or w.centroid is null then null else st_distance(w.centroid, st_setsrid(st_makepoint(p_lon,p_lat),4326)::geography) end nulls last,
           w.name
  limit greatest(1,least(p_limit,200));
$$;


--
-- Name: seed_atlas_tackle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_atlas_tackle() RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  return jsonb_build_object(
    'tackle_records', 0,
    'disabled', true,
    'message', 'The private angler gear import has already been completed.'
  );
end;
$$;


--
-- Name: FUNCTION seed_atlas_tackle(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.seed_atlas_tackle() IS 'Disabled after the one-time private angler inventory import.';


--
-- Name: upsert_catalog_waterbody(text, text, text, text, text, text, double precision, double precision, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_catalog_waterbody(p_source_system text, p_source_id text, p_source_label text, p_name text, p_state_code text, p_water_type text, p_lon double precision, p_lat double precision, p_official_url text, p_source_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if p_state_code not in ('MN','WI') then raise exception 'Unsupported state'; end if;
  insert into public.waterbodies(
    atlas_id, source_system, source_id, source_label, name, state_code, water_type,
    centroid, official_url, source_updated_at, catalog_fetched_at, intelligence_level
  ) values (
    upper(p_state_code)||'-'||upper(substr(md5(p_source_system||':'||p_source_id),1,12)),
    p_source_system, p_source_id, p_source_label, nullif(trim(p_name),''), p_state_code,
    lower(coalesce(nullif(trim(p_water_type),''),'water')),
    case when p_lon is not null and p_lat is not null then st_setsrid(st_makepoint(p_lon,p_lat),4326)::geography else null end,
    p_official_url, p_source_updated_at, now(), 1
  )
  on conflict (source_system, source_id) do update set
    source_label=excluded.source_label,
    name=coalesce(excluded.name, public.waterbodies.name),
    state_code=excluded.state_code,
    water_type=excluded.water_type,
    centroid=coalesce(excluded.centroid, public.waterbodies.centroid),
    official_url=coalesce(excluded.official_url, public.waterbodies.official_url),
    source_updated_at=coalesce(excluded.source_updated_at, public.waterbodies.source_updated_at),
    catalog_fetched_at=now()
  returning id into v_id;
  return v_id;
end;
$$;


--
-- Name: water_intelligence_brief(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.water_intelligence_brief(p_waterbody_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$ with w as (select * from public.waterbodies where id=p_waterbody_id), sp as (select species_name,source_name,observed_on,confidence from public.waterbody_species where waterbody_id=p_waterbody_id order by confidence desc nulls last, observed_on desc nulls last limit 20), rp as (select title,summary,report_url,published_at,species,lure_mentions,color_mentions,technique_mentions,conditions,confidence_score from public.fishing_reports where waterbody_id=p_waterbody_id and published_at>=now()-interval '45 days' order by published_at desc nulls last,relevance_score desc nulls last limit 12), ac as (select name,access_type,public_status,source_url,source_updated_at from public.public_access_points where waterbody_id=p_waterbody_id order by source_updated_at desc nulls last limit 20), ga as (select agency,site_id,site_name,parameters,active from public.stream_gauges where waterbody_id=p_waterbody_id and active=true limit 10) select jsonb_build_object('water',(select to_jsonb(w) - 'geometry' - 'centroid' from w),'species',coalesce((select jsonb_agg(to_jsonb(sp)) from sp),'[]'::jsonb),'recent_reports',coalesce((select jsonb_agg(to_jsonb(rp)) from rp),'[]'::jsonb),'access',coalesce((select jsonb_agg(to_jsonb(ac)) from ac),'[]'::jsonb),'gauges',coalesce((select jsonb_agg(to_jsonb(ga)) from ga),'[]'::jsonb),'report_count_45d',(select count(*) from public.fishing_reports where waterbody_id=p_waterbody_id and published_at>=now()-interval '45 days'),'freshest_report_at',(select max(published_at) from public.fishing_reports where waterbody_id=p_waterbody_id)); $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_release_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_release_status (
    id integer DEFAULT 1 NOT NULL,
    version text NOT NULL,
    channel text DEFAULT 'beta'::text NOT NULL,
    released_at timestamp with time zone DEFAULT now() NOT NULL,
    minimum_shell integer DEFAULT 1 NOT NULL,
    notes text,
    CONSTRAINT app_release_status_id_check CHECK ((id = 1))
);


--
-- Name: beta_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beta_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid(),
    category text NOT NULL,
    rating integer,
    message text NOT NULL,
    page text,
    app_version text,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT beta_feedback_category_check CHECK ((category = ANY (ARRAY['bug'::text, 'confusing'::text, 'bad_plan'::text, 'missing_data'::text, 'idea'::text, 'other'::text]))),
    CONSTRAINT beta_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: catches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    trip_id uuid,
    caught_at timestamp with time zone DEFAULT now() NOT NULL,
    water text NOT NULL,
    spot text,
    species text NOT NULL,
    length_in numeric(6,2),
    weight_lb numeric(6,2),
    combo_name text,
    lure_bait text,
    color text,
    released boolean,
    why_worked text,
    learned text,
    try_next text,
    confidence smallint,
    photo_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    waterbody_id uuid,
    latitude double precision,
    longitude double precision,
    position_method text,
    position_accuracy_m double precision,
    weather_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    water_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    session_id uuid,
    CONSTRAINT catches_confidence_check CHECK (((confidence >= 1) AND (confidence <= 5)))
);


--
-- Name: coaching_scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coaching_scenarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    atlas_id text NOT NULL,
    lake text NOT NULL,
    target text NOT NULL,
    season text NOT NULL,
    water_clarity text NOT NULL,
    wind text NOT NULL,
    light text NOT NULL,
    combo_name text NOT NULL,
    lure_color text NOT NULL,
    why_text text NOT NULL,
    how_text text NOT NULL,
    watch_for text NOT NULL,
    next_step text NOT NULL,
    lesson text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    access_type text DEFAULT 'Any'::text,
    cover_type text DEFAULT 'Any'::text,
    current_strength text DEFAULT 'Any'::text,
    depth_zone text DEFAULT 'Any'::text
);


--
-- Name: combos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.combos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    atlas_id text DEFAULT ('COMBO-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12))) NOT NULL,
    rod_id uuid,
    reel_id uuid,
    name text NOT NULL,
    role text,
    primary_lure text,
    alternatives text[],
    status text DEFAULT 'ready'::text,
    confidence smallint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT combos_confidence_check CHECK (((confidence >= 1) AND (confidence <= 5)))
);


--
-- Name: data_source_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_source_runs (
    id bigint NOT NULL,
    source_key text NOT NULL,
    source_label text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    records_read integer DEFAULT 0 NOT NULL,
    records_written integer DEFAULT 0 NOT NULL,
    duration_ms integer,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT data_source_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text, 'failed'::text])))
);


--
-- Name: data_source_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.data_source_runs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.data_source_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fishing_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fishing_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    external_id text,
    waterbody_id uuid,
    waterbody_text text,
    title text,
    summary text NOT NULL,
    report_url text,
    author_name text,
    published_at timestamp with time zone,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    species text[] DEFAULT '{}'::text[] NOT NULL,
    lure_mentions text[] DEFAULT '{}'::text[] NOT NULL,
    color_mentions text[] DEFAULT '{}'::text[] NOT NULL,
    technique_mentions text[] DEFAULT '{}'::text[] NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    sentiment text,
    relevance_score numeric(5,4) DEFAULT 0 NOT NULL,
    confidence_score numeric(5,4) DEFAULT 0.25 NOT NULL,
    raw_payload jsonb
);


--
-- Name: fishing_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fishing_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    waterbody_id uuid,
    water_name text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    latitude double precision,
    longitude double precision,
    target_species text,
    access_type text,
    mission_context jsonb DEFAULT '{}'::jsonb NOT NULL,
    weather_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    water_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    casts_estimate integer DEFAULT 0 NOT NULL,
    bites integer DEFAULT 0 NOT NULL,
    catches integer DEFAULT 0 NOT NULL,
    moves integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_photo_intake; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_photo_intake (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    equipment_type text NOT NULL,
    photo_path text,
    original_filename text,
    recognition_status text DEFAULT 'pending'::text NOT NULL,
    recognition jsonb DEFAULT '{}'::jsonb NOT NULL,
    confirmed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_photo_intake_equipment_type_check CHECK ((equipment_type = ANY (ARRAY['rod'::text, 'reel'::text, 'tackle'::text, 'combo'::text, 'unknown'::text])))
);


--
-- Name: lakes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lakes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    atlas_id text NOT NULL,
    name text NOT NULL,
    common_clarity text,
    primary_species text[],
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: live_water_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_water_observations (
    id bigint NOT NULL,
    gauge_id uuid NOT NULL,
    parameter_code text NOT NULL,
    parameter_name text,
    value numeric,
    unit text,
    observed_at timestamp with time zone NOT NULL,
    approval_status text,
    source_url text,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: live_water_observations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.live_water_observations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.live_water_observations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    atlas_id text DEFAULT ('LURE-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12))) NOT NULL,
    category text NOT NULL,
    brand text,
    model text NOT NULL,
    size_weight text,
    color text,
    quantity integer DEFAULT 1 NOT NULL,
    species text[],
    clarity text[],
    conditions text[],
    cover text[],
    assigned_combo_id uuid,
    trailer_pairing text,
    confidence smallint,
    storage_location text,
    photo_path text,
    restock boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    catches_count integer DEFAULT 0 NOT NULL,
    bites_count integer DEFAULT 0 NOT NULL,
    notes text,
    diving_depth text,
    buoyancy text,
    hook_size text,
    upc text,
    CONSTRAINT lures_confidence_check CHECK (((confidence >= 1) AND (confidence <= 5)))
);


--
-- Name: COLUMN lures.diving_depth; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lures.diving_depth IS 'Manufacturer-rated or angler-entered running depth.';


--
-- Name: maintenance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    item_name text NOT NULL,
    task text NOT NULL,
    completed_on date,
    next_due date,
    status text,
    cost numeric(10,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mission_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    waterbody_id uuid,
    spot_id uuid,
    mission_context jsonb DEFAULT '{}'::jsonb NOT NULL,
    recommendation jsonb DEFAULT '{}'::jsonb NOT NULL,
    feedback_type text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mission_feedback_feedback_type_check CHECK ((feedback_type = ANY (ARRAY['caught'::text, 'bite'::text, 'nothing'::text, 'moved'::text, 'conditions_changed'::text])))
);


--
-- Name: personal_fishing_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_fishing_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    waterbody_id uuid,
    name text NOT NULL,
    location public.geography(Point,4326),
    spot_type text,
    notes text,
    private boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    experience_level text,
    home_region text,
    preferred_species text[] DEFAULT '{}'::text[] NOT NULL,
    access_style text,
    gear_status text,
    onboarding_completed boolean DEFAULT false NOT NULL,
    onboarding_version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fishing_goal text,
    learning_focus text,
    coaching_style text DEFAULT 'guided'::text,
    skill_focus text,
    CONSTRAINT profiles_access_style_check CHECK (((access_style IS NULL) OR (access_style = ANY (ARRAY['shore'::text, 'boat'::text, 'both'::text])))),
    CONSTRAINT profiles_coaching_style_check CHECK (((coaching_style IS NULL) OR (coaching_style = ANY (ARRAY['simple'::text, 'guided'::text, 'concise'::text])))),
    CONSTRAINT profiles_experience_level_check CHECK (((experience_level IS NULL) OR (experience_level = ANY (ARRAY['new'::text, 'casual'::text, 'intermediate'::text, 'advanced'::text])))),
    CONSTRAINT profiles_gear_status_check CHECK (((gear_status IS NULL) OR (gear_status = ANY (ARRAY['none'::text, 'some'::text, 'ready'::text]))))
);


--
-- Name: public_access_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_access_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    waterbody_id uuid,
    source_system text NOT NULL,
    source_id text NOT NULL,
    name text,
    access_type text,
    location public.geography(Point,4326) NOT NULL,
    public_status text,
    source_url text,
    source_updated_at timestamp with time zone
);


--
-- Name: reels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    atlas_id text DEFAULT ('REEL-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12))) NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    reel_type text DEFAULT 'Other'::text NOT NULL,
    line_type text,
    line_test text,
    line_color text,
    role text,
    replacement_value numeric(10,2),
    photo_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    gear_ratio text,
    reel_size text,
    retrieve_side text,
    line_capacity text,
    upc text,
    notes text
);


--
-- Name: COLUMN reels.gear_ratio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reels.gear_ratio IS 'Displayed reel gear ratio, for example 7.5:1.';


--
-- Name: COLUMN reels.retrieve_side; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reels.retrieve_side IS 'Right, Left, or Interchangeable.';


--
-- Name: report_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    source_type text NOT NULL,
    base_url text,
    api_or_feed_url text,
    state_scope text[] DEFAULT '{MN,WI}'::text[] NOT NULL,
    requires_approval boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    trust_weight numeric(4,3) DEFAULT 0.5 NOT NULL,
    terms_notes text,
    last_checked_at timestamp with time zone,
    CONSTRAINT report_sources_trust_weight_check CHECK (((trust_weight >= (0)::numeric) AND (trust_weight <= (1)::numeric)))
);


--
-- Name: rods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    atlas_id text DEFAULT ('ROD-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12))) NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    rod_type text DEFAULT 'Other'::text NOT NULL,
    length text,
    power text,
    action text,
    lure_rating text,
    line_rating text,
    role text,
    replacement_value numeric(10,2),
    status text DEFAULT 'active'::text,
    photo_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    piece_count smallint,
    upc text,
    notes text,
    CONSTRAINT rods_piece_count_positive CHECK (((piece_count IS NULL) OR (piece_count > 0)))
);


--
-- Name: COLUMN rods.upc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rods.upc IS 'Optional manufacturer barcode entered or scanned by the angler.';


--
-- Name: stream_gauges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_gauges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    waterbody_id uuid,
    agency text DEFAULT 'USGS'::text NOT NULL,
    site_id text NOT NULL,
    site_name text,
    location public.geography(Point,4326),
    parameters text[] DEFAULT '{}'::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    trip_date date DEFAULT CURRENT_DATE NOT NULL,
    water text NOT NULL,
    spot text,
    weather text,
    water_clarity text,
    wind text,
    light text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_fishing_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_fishing_profiles (
    user_id uuid DEFAULT auth.uid() NOT NULL,
    experience_level text DEFAULT 'beginner'::text NOT NULL,
    preferred_access text[] DEFAULT ARRAY['shore'::text] NOT NULL,
    target_species text[] DEFAULT '{}'::text[] NOT NULL,
    home_state text,
    units text DEFAULT 'imperial'::text NOT NULL,
    onboarding_complete boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: water_spots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.water_spots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    waterbody_id uuid NOT NULL,
    name text NOT NULL,
    spot_type text,
    latitude double precision,
    longitude double precision,
    structure text[],
    access_type text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: water_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.water_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    waterbody_id uuid NOT NULL,
    spot_id uuid,
    visited_at timestamp with time zone DEFAULT now() NOT NULL,
    target_species text,
    access_type text,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    outcome jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: waterbodies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waterbodies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    atlas_id text,
    source_system text NOT NULL,
    source_id text NOT NULL,
    name text,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    state_code text NOT NULL,
    county_name text,
    water_type text NOT NULL,
    named boolean DEFAULT true NOT NULL,
    centroid public.geography(Point,4326),
    geometry public.geometry(Geometry,4326),
    watershed_name text,
    official_url text,
    source_updated_at timestamp with time zone,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    intelligence_level smallint DEFAULT 1 NOT NULL,
    source_label text,
    catalog_fetched_at timestamp with time zone,
    CONSTRAINT waterbodies_intelligence_level_check CHECK (((intelligence_level >= 1) AND (intelligence_level <= 3))),
    CONSTRAINT waterbodies_state_code_check CHECK ((state_code = ANY (ARRAY['MN'::text, 'WI'::text])))
);


--
-- Name: waterbody_species; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waterbody_species (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    waterbody_id uuid NOT NULL,
    species_name text NOT NULL,
    source_name text NOT NULL,
    observed_on date,
    confidence numeric(4,3) DEFAULT 0.7 NOT NULL,
    source_url text,
    CONSTRAINT waterbody_species_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))
);


--
-- Name: app_release_status app_release_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_release_status
    ADD CONSTRAINT app_release_status_pkey PRIMARY KEY (id);


--
-- Name: beta_feedback beta_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_feedback
    ADD CONSTRAINT beta_feedback_pkey PRIMARY KEY (id);


--
-- Name: catches catches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catches
    ADD CONSTRAINT catches_pkey PRIMARY KEY (id);


--
-- Name: coaching_scenarios coaching_scenarios_owner_id_atlas_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_scenarios
    ADD CONSTRAINT coaching_scenarios_owner_id_atlas_id_key UNIQUE (owner_id, atlas_id);


--
-- Name: coaching_scenarios coaching_scenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_scenarios
    ADD CONSTRAINT coaching_scenarios_pkey PRIMARY KEY (id);


--
-- Name: combos combos_owner_id_atlas_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_owner_id_atlas_id_key UNIQUE (owner_id, atlas_id);


--
-- Name: combos combos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_pkey PRIMARY KEY (id);


--
-- Name: data_source_runs data_source_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_source_runs
    ADD CONSTRAINT data_source_runs_pkey PRIMARY KEY (id);


--
-- Name: fishing_reports fishing_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fishing_reports
    ADD CONSTRAINT fishing_reports_pkey PRIMARY KEY (id);


--
-- Name: fishing_reports fishing_reports_source_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fishing_reports
    ADD CONSTRAINT fishing_reports_source_id_external_id_key UNIQUE (source_id, external_id);


--
-- Name: fishing_sessions fishing_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fishing_sessions
    ADD CONSTRAINT fishing_sessions_pkey PRIMARY KEY (id);


--
-- Name: inventory_photo_intake inventory_photo_intake_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_photo_intake
    ADD CONSTRAINT inventory_photo_intake_pkey PRIMARY KEY (id);


--
-- Name: lakes lakes_owner_id_atlas_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lakes
    ADD CONSTRAINT lakes_owner_id_atlas_id_key UNIQUE (owner_id, atlas_id);


--
-- Name: lakes lakes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lakes
    ADD CONSTRAINT lakes_pkey PRIMARY KEY (id);


--
-- Name: live_water_observations live_water_observations_gauge_id_parameter_code_observed_at_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_water_observations
    ADD CONSTRAINT live_water_observations_gauge_id_parameter_code_observed_at_key UNIQUE (gauge_id, parameter_code, observed_at);


--
-- Name: live_water_observations live_water_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_water_observations
    ADD CONSTRAINT live_water_observations_pkey PRIMARY KEY (id);


--
-- Name: lures lures_owner_id_atlas_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lures
    ADD CONSTRAINT lures_owner_id_atlas_id_key UNIQUE (owner_id, atlas_id);


--
-- Name: lures lures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lures
    ADD CONSTRAINT lures_pkey PRIMARY KEY (id);


--
-- Name: maintenance_records maintenance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_records
    ADD CONSTRAINT maintenance_records_pkey PRIMARY KEY (id);


--
-- Name: mission_feedback mission_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_feedback
    ADD CONSTRAINT mission_feedback_pkey PRIMARY KEY (id);


--
-- Name: personal_fishing_locations personal_fishing_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_fishing_locations
    ADD CONSTRAINT personal_fishing_locations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: public_access_points public_access_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_access_points
    ADD CONSTRAINT public_access_points_pkey PRIMARY KEY (id);


--
-- Name: public_access_points public_access_points_source_system_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_access_points
    ADD CONSTRAINT public_access_points_source_system_source_id_key UNIQUE (source_system, source_id);


--
-- Name: reels reels_owner_id_atlas_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_owner_id_atlas_id_key UNIQUE (owner_id, atlas_id);


--
-- Name: reels reels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_pkey PRIMARY KEY (id);


--
-- Name: report_sources report_sources_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_sources
    ADD CONSTRAINT report_sources_name_key UNIQUE (name);


--
-- Name: report_sources report_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_sources
    ADD CONSTRAINT report_sources_pkey PRIMARY KEY (id);


--
-- Name: rods rods_owner_id_atlas_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rods
    ADD CONSTRAINT rods_owner_id_atlas_id_key UNIQUE (owner_id, atlas_id);


--
-- Name: rods rods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rods
    ADD CONSTRAINT rods_pkey PRIMARY KEY (id);


--
-- Name: stream_gauges stream_gauges_agency_site_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_gauges
    ADD CONSTRAINT stream_gauges_agency_site_id_key UNIQUE (agency, site_id);


--
-- Name: stream_gauges stream_gauges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_gauges
    ADD CONSTRAINT stream_gauges_pkey PRIMARY KEY (id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: user_fishing_profiles user_fishing_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fishing_profiles
    ADD CONSTRAINT user_fishing_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: water_spots water_spots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_spots
    ADD CONSTRAINT water_spots_pkey PRIMARY KEY (id);


--
-- Name: water_visits water_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_visits
    ADD CONSTRAINT water_visits_pkey PRIMARY KEY (id);


--
-- Name: waterbodies waterbodies_atlas_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waterbodies
    ADD CONSTRAINT waterbodies_atlas_id_key UNIQUE (atlas_id);


--
-- Name: waterbodies waterbodies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waterbodies
    ADD CONSTRAINT waterbodies_pkey PRIMARY KEY (id);


--
-- Name: waterbodies waterbodies_source_system_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waterbodies
    ADD CONSTRAINT waterbodies_source_system_source_id_key UNIQUE (source_system, source_id);


--
-- Name: waterbody_species waterbody_species_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waterbody_species
    ADD CONSTRAINT waterbody_species_pkey PRIMARY KEY (id);


--
-- Name: waterbody_species waterbody_species_waterbody_id_species_name_source_name_obs_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waterbody_species
    ADD CONSTRAINT waterbody_species_waterbody_id_species_name_source_name_obs_key UNIQUE (waterbody_id, species_name, source_name, observed_on);


--
-- Name: beta_feedback_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX beta_feedback_created_idx ON public.beta_feedback USING btree (created_at DESC);


--
-- Name: beta_feedback_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX beta_feedback_user_id_idx ON public.beta_feedback USING btree (user_id);


--
-- Name: catches_owner_coords_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catches_owner_coords_idx ON public.catches USING btree (owner_id, latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));


--
-- Name: catches_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catches_owner_id_idx ON public.catches USING btree (owner_id);


--
-- Name: catches_owner_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catches_owner_time_idx ON public.catches USING btree (owner_id, caught_at DESC);


--
-- Name: catches_owner_water_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catches_owner_water_time_idx ON public.catches USING btree (owner_id, waterbody_id, caught_at DESC);


--
-- Name: catches_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catches_session_idx ON public.catches USING btree (session_id);


--
-- Name: catches_trip_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catches_trip_id_idx ON public.catches USING btree (trip_id);


--
-- Name: catches_waterbody_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catches_waterbody_time_idx ON public.catches USING btree (waterbody_id, caught_at DESC);


--
-- Name: combos_reel_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX combos_reel_id_idx ON public.combos USING btree (reel_id);


--
-- Name: combos_rod_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX combos_rod_id_idx ON public.combos USING btree (rod_id);


--
-- Name: data_source_runs_source_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_source_runs_source_time_idx ON public.data_source_runs USING btree (source_key, started_at DESC);


--
-- Name: fishing_reports_text_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fishing_reports_text_search_idx ON public.fishing_reports USING gin (to_tsvector('english'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || summary)));


--
-- Name: fishing_reports_waterbody_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fishing_reports_waterbody_recent_idx ON public.fishing_reports USING btree (waterbody_id, published_at DESC);


--
-- Name: fishing_sessions_owner_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fishing_sessions_owner_started_idx ON public.fishing_sessions USING btree (owner_id, started_at DESC);


--
-- Name: fishing_sessions_water_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fishing_sessions_water_idx ON public.fishing_sessions USING btree (waterbody_id, started_at DESC);


--
-- Name: inventory_photo_intake_owner_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_photo_intake_owner_created_idx ON public.inventory_photo_intake USING btree (owner_id, created_at DESC);


--
-- Name: live_water_observations_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX live_water_observations_recent_idx ON public.live_water_observations USING btree (gauge_id, observed_at DESC);


--
-- Name: lures_assigned_combo_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lures_assigned_combo_id_idx ON public.lures USING btree (assigned_combo_id);


--
-- Name: lures_owner_restock_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lures_owner_restock_idx ON public.lures USING btree (owner_id, restock) WHERE (restock = true);


--
-- Name: lures_owner_usage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lures_owner_usage_idx ON public.lures USING btree (owner_id, last_used_at DESC);


--
-- Name: maintenance_records_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_records_owner_id_idx ON public.maintenance_records USING btree (owner_id);


--
-- Name: mission_feedback_spot_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_feedback_spot_id_idx ON public.mission_feedback USING btree (spot_id);


--
-- Name: mission_feedback_user_water_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_feedback_user_water_time_idx ON public.mission_feedback USING btree (user_id, waterbody_id, created_at DESC);


--
-- Name: mission_feedback_waterbody_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_feedback_waterbody_id_idx ON public.mission_feedback USING btree (waterbody_id);


--
-- Name: personal_fishing_locations_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_fishing_locations_gix ON public.personal_fishing_locations USING gist (location);


--
-- Name: personal_fishing_locations_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_fishing_locations_owner_id_idx ON public.personal_fishing_locations USING btree (owner_id);


--
-- Name: personal_fishing_locations_waterbody_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_fishing_locations_waterbody_id_idx ON public.personal_fishing_locations USING btree (waterbody_id);


--
-- Name: public_access_points_location_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX public_access_points_location_gix ON public.public_access_points USING gist (location);


--
-- Name: public_access_points_waterbody_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX public_access_points_waterbody_id_idx ON public.public_access_points USING btree (waterbody_id);


--
-- Name: reports_text_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_text_time_idx ON public.fishing_reports USING btree (lower(waterbody_text), published_at DESC);


--
-- Name: stream_gauges_location_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stream_gauges_location_gix ON public.stream_gauges USING gist (location);


--
-- Name: stream_gauges_waterbody_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stream_gauges_waterbody_idx ON public.stream_gauges USING btree (waterbody_id) WHERE active;


--
-- Name: trips_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trips_owner_id_idx ON public.trips USING btree (owner_id);


--
-- Name: water_spots_user_water_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX water_spots_user_water_idx ON public.water_spots USING btree (user_id, waterbody_id);


--
-- Name: water_spots_waterbody_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX water_spots_waterbody_id_idx ON public.water_spots USING btree (waterbody_id);


--
-- Name: water_visits_spot_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX water_visits_spot_id_idx ON public.water_visits USING btree (spot_id);


--
-- Name: water_visits_user_water_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX water_visits_user_water_time_idx ON public.water_visits USING btree (user_id, waterbody_id, visited_at DESC);


--
-- Name: water_visits_waterbody_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX water_visits_waterbody_id_idx ON public.water_visits USING btree (waterbody_id);


--
-- Name: waterbodies_centroid_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waterbodies_centroid_gix ON public.waterbodies USING gist (centroid);


--
-- Name: waterbodies_geometry_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waterbodies_geometry_gix ON public.waterbodies USING gist (geometry);


--
-- Name: waterbodies_name_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waterbodies_name_trgm_idx ON public.waterbodies USING gin (name public.gin_trgm_ops);


--
-- Name: waterbodies_state_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waterbodies_state_name_idx ON public.waterbodies USING btree (state_code, lower(name));


--
-- Name: waterbodies_state_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waterbodies_state_type_idx ON public.waterbodies USING btree (state_code, water_type);


--
-- Name: waterbodies_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waterbodies_type_idx ON public.waterbodies USING btree (water_type);


--
-- Name: beta_feedback beta_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_feedback
    ADD CONSTRAINT beta_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: catches catches_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catches
    ADD CONSTRAINT catches_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: catches catches_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catches
    ADD CONSTRAINT catches_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.fishing_sessions(id) ON DELETE SET NULL;


--
-- Name: catches catches_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catches
    ADD CONSTRAINT catches_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;


--
-- Name: catches catches_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catches
    ADD CONSTRAINT catches_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE SET NULL;


--
-- Name: coaching_scenarios coaching_scenarios_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_scenarios
    ADD CONSTRAINT coaching_scenarios_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: combos combos_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: combos combos_reel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id);


--
-- Name: combos combos_rod_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_rod_id_fkey FOREIGN KEY (rod_id) REFERENCES public.rods(id);


--
-- Name: fishing_reports fishing_reports_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fishing_reports
    ADD CONSTRAINT fishing_reports_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.report_sources(id) ON DELETE CASCADE;


--
-- Name: fishing_reports fishing_reports_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fishing_reports
    ADD CONSTRAINT fishing_reports_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE SET NULL;


--
-- Name: fishing_sessions fishing_sessions_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fishing_sessions
    ADD CONSTRAINT fishing_sessions_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE SET NULL;


--
-- Name: inventory_photo_intake inventory_photo_intake_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_photo_intake
    ADD CONSTRAINT inventory_photo_intake_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: lakes lakes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lakes
    ADD CONSTRAINT lakes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: live_water_observations live_water_observations_gauge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_water_observations
    ADD CONSTRAINT live_water_observations_gauge_id_fkey FOREIGN KEY (gauge_id) REFERENCES public.stream_gauges(id) ON DELETE CASCADE;


--
-- Name: lures lures_assigned_combo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lures
    ADD CONSTRAINT lures_assigned_combo_id_fkey FOREIGN KEY (assigned_combo_id) REFERENCES public.combos(id);


--
-- Name: lures lures_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lures
    ADD CONSTRAINT lures_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: maintenance_records maintenance_records_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_records
    ADD CONSTRAINT maintenance_records_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mission_feedback mission_feedback_spot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_feedback
    ADD CONSTRAINT mission_feedback_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES public.water_spots(id) ON DELETE SET NULL;


--
-- Name: mission_feedback mission_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_feedback
    ADD CONSTRAINT mission_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mission_feedback mission_feedback_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_feedback
    ADD CONSTRAINT mission_feedback_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE SET NULL;


--
-- Name: personal_fishing_locations personal_fishing_locations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_fishing_locations
    ADD CONSTRAINT personal_fishing_locations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: personal_fishing_locations personal_fishing_locations_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_fishing_locations
    ADD CONSTRAINT personal_fishing_locations_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: public_access_points public_access_points_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_access_points
    ADD CONSTRAINT public_access_points_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE CASCADE;


--
-- Name: reels reels_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rods rods_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rods
    ADD CONSTRAINT rods_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stream_gauges stream_gauges_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_gauges
    ADD CONSTRAINT stream_gauges_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE SET NULL;


--
-- Name: trips trips_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_fishing_profiles user_fishing_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fishing_profiles
    ADD CONSTRAINT user_fishing_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: water_spots water_spots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_spots
    ADD CONSTRAINT water_spots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: water_spots water_spots_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_spots
    ADD CONSTRAINT water_spots_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE CASCADE;


--
-- Name: water_visits water_visits_spot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_visits
    ADD CONSTRAINT water_visits_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES public.water_spots(id) ON DELETE SET NULL;


--
-- Name: water_visits water_visits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_visits
    ADD CONSTRAINT water_visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: water_visits water_visits_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_visits
    ADD CONSTRAINT water_visits_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE CASCADE;


--
-- Name: waterbody_species waterbody_species_waterbody_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waterbody_species
    ADD CONSTRAINT waterbody_species_waterbody_id_fkey FOREIGN KEY (waterbody_id) REFERENCES public.waterbodies(id) ON DELETE CASCADE;


--
-- Name: app_release_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_release_status ENABLE ROW LEVEL SECURITY;

--
-- Name: app_release_status app_release_status_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_release_status_read ON public.app_release_status FOR SELECT TO authenticated, anon USING (true);


--
-- Name: public_access_points authenticated read access points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read access points" ON public.public_access_points FOR SELECT TO authenticated USING (true);


--
-- Name: fishing_reports authenticated read fishing reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read fishing reports" ON public.fishing_reports FOR SELECT TO authenticated USING (true);


--
-- Name: stream_gauges authenticated read gauges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read gauges" ON public.stream_gauges FOR SELECT TO authenticated USING (true);


--
-- Name: live_water_observations authenticated read live observations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read live observations" ON public.live_water_observations FOR SELECT TO authenticated USING (true);


--
-- Name: report_sources authenticated read report sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read report sources" ON public.report_sources FOR SELECT TO authenticated USING (true);


--
-- Name: waterbodies authenticated read waterbodies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read waterbodies" ON public.waterbodies FOR SELECT TO authenticated USING (true);


--
-- Name: waterbody_species authenticated read waterbody species; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read waterbody species" ON public.waterbody_species FOR SELECT TO authenticated USING (true);


--
-- Name: beta_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: beta_feedback beta_feedback_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY beta_feedback_insert_own ON public.beta_feedback FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: beta_feedback beta_feedback_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY beta_feedback_read_own ON public.beta_feedback FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: catches catch owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catch owner access" ON public.catches TO authenticated USING (public.owns_row(owner_id)) WITH CHECK (public.owns_row(owner_id));


--
-- Name: catches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.catches ENABLE ROW LEVEL SECURITY;

--
-- Name: coaching_scenarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coaching_scenarios ENABLE ROW LEVEL SECURITY;

--
-- Name: combos combo owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "combo owner access" ON public.combos TO authenticated USING (public.owns_row(owner_id)) WITH CHECK (public.owns_row(owner_id));


--
-- Name: combos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

--
-- Name: data_source_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_source_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: data_source_runs data_source_runs_no_client_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_source_runs_no_client_access ON public.data_source_runs TO authenticated USING (false) WITH CHECK (false);


--
-- Name: fishing_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fishing_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: fishing_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fishing_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: fishing_sessions fishing_sessions_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fishing_sessions_owner ON public.fishing_sessions TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: inventory_photo_intake; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_photo_intake ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_photo_intake inventory_photo_intake_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_photo_intake_owner ON public.inventory_photo_intake TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: lakes lake owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lake owner access" ON public.lakes TO authenticated USING (public.owns_row(owner_id)) WITH CHECK (public.owns_row(owner_id));


--
-- Name: lakes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lakes ENABLE ROW LEVEL SECURITY;

--
-- Name: live_water_observations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_water_observations ENABLE ROW LEVEL SECURITY;

--
-- Name: lures lure owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lure owner access" ON public.lures TO authenticated USING (public.owns_row(owner_id)) WITH CHECK (public.owns_row(owner_id));


--
-- Name: lures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lures ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_records maintenance owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "maintenance owner access" ON public.maintenance_records TO authenticated USING (public.owns_row(owner_id)) WITH CHECK (public.owns_row(owner_id));


--
-- Name: maintenance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_feedback mission_feedback_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_feedback_owner ON public.mission_feedback TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: personal_fishing_locations owner personal locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner personal locations" ON public.personal_fishing_locations TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: personal_fishing_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personal_fishing_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profile owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profile owner access" ON public.profiles TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: public_access_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.public_access_points ENABLE ROW LEVEL SECURITY;

--
-- Name: reels reel owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reel owner access" ON public.reels TO authenticated USING (public.owns_row(owner_id)) WITH CHECK (public.owns_row(owner_id));


--
-- Name: reels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

--
-- Name: report_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: rods rod owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rod owner access" ON public.rods TO authenticated USING (public.owns_row(owner_id)) WITH CHECK (public.owns_row(owner_id));


--
-- Name: rods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rods ENABLE ROW LEVEL SECURITY;

--
-- Name: coaching_scenarios scenario owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "scenario owner access" ON public.coaching_scenarios TO authenticated USING (public.owns_row(owner_id)) WITH CHECK (public.owns_row(owner_id));


--
-- Name: stream_gauges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stream_gauges ENABLE ROW LEVEL SECURITY;

--
-- Name: trips trip owner access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip owner access" ON public.trips TO authenticated USING (public.owns_row(owner_id)) WITH CHECK (public.owns_row(owner_id));


--
-- Name: trips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

--
-- Name: user_fishing_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_fishing_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_fishing_profiles user_fishing_profiles_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_fishing_profiles_owner ON public.user_fishing_profiles TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: water_spots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.water_spots ENABLE ROW LEVEL SECURITY;

--
-- Name: water_spots water_spots_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY water_spots_owner ON public.water_spots TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: water_visits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.water_visits ENABLE ROW LEVEL SECURITY;

--
-- Name: water_visits water_visits_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY water_visits_owner ON public.water_visits TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: waterbodies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waterbodies ENABLE ROW LEVEL SECURITY;

--
-- Name: waterbody_species; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waterbody_species ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict IlJEt7egi1Mt2tWousPHz8478FjaAtfTGSKBHSXg6LQbKmv5l2To9IEGb2kMNGe

