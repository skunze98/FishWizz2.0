-- FishWizz — fix White/Yellow Bass species matching in get_mission_plan_v3
-- ---------------------------------------------------------------------------
-- BUG: get_mission_plan_v3's species dispatch used
--   elsif target ~ 'largemouth bass|smallmouth bass|bass' then
-- as the black-bass (largemouth/smallmouth) branch. Because '~' is a plain
-- substring/regex match and the trailing 'bass' alternative matches ANY
-- string containing the word "bass", selecting "White Bass" or "Yellow Bass"
-- as the Mission target (both real, selectable species in the live app's
-- Target dropdown) fell into this branch and received largemouth/smallmouth
-- advice: fish tight cover (docks, wood, weeds), Texas rigs, jigs worked on
-- bottom contact near structure.
--
-- That advice is wrong for these species. White bass and yellow bass are
-- temperate basses (Morone), not black bass (Micropterus) -- they are
-- open-water schooling fish that chase baitfish near the surface, current
-- breaks, humps, and river mouths, not cover-oriented ambush fish. An angler
-- who followed the largemouth/smallmouth guidance for White Bass would be
-- told to pitch a Texas rig at docks and shoreline wood, which is not how
-- these fish are caught.
--
-- FIX: add a dedicated `target ~ 'white bass|yellow bass'` branch, placed
-- BEFORE the largemouth/smallmouth branch in the elsif chain, with correct
-- open-water/schooling-specific gear, lures, and technique. The existing
-- largemouth/smallmouth branch is unchanged other than now being unreachable
-- by white/yellow bass (checked first, so it wins).
--
-- This is a CREATE OR REPLACE of the full function body -- Postgres has no
-- ALTER FUNCTION for changing a plpgsql body, and the function is long enough
-- that a partial patch would be error-prone to hand-apply. The only
-- functional change from the previous version is the new elsif branch below
-- (search for "White bass and yellow bass are temperate basses"); everything
-- else is byte-for-byte the same logic that is already live.
--
-- Verification performed locally: re-read the edited function source and
-- confirmed the new branch sits before the black-bass branch in the elsif
-- chain, so a target of "white bass" or "yellow bass" now matches the new
-- branch first and never reaches the old bare 'bass' match.
-- To verify after applying: build a Mission with Target = "White Bass" (or
-- "Yellow Bass") and confirm the response describes open-water/schooling
-- tactics (jigging spoon, swimbait, watching for surface activity/bait) --
-- not Texas rigs, docks, or "largemouth" language.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_mission_plan_v3(p_context jsonb) RETURNS jsonb
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
