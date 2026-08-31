# FishWizz Walleye/Sauger Pilot -- Expert Consultation Packets
Generated 2026-08-29T16:58:48.593Z from the real, unmodified pilot-data.json (commit a114e97). Every field below is computed from the live record, not hand-summarized -- nothing here has been softened or reordered to bury unsupported material. Sourced and unsourced content for each tactic sit side by side, not separated into a "good news" and "fine print" section.

**Every tactic in this pilot is still `record_status: draft` and every claim is `reviewer_status: unreviewed`.** Nothing here is published or approved. Expert input recorded against this packet is practitioner testimony, captured per `expert-consultation-workflow.md`, not automatic approval -- see that document for the full workflow-state model.

---

## t1 -- Jig and minnow (jig-minnow)
**Tactic ID:** `d834eb67-69e7-4cca-a3df-a85564325067`  |  **Presentation ID:** `71231f0a-275a-4671-93b9-3216bf5a37c2`  |  **Confidence:** `independently_corroborated`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** shore, wading, boat  |  **Water environment:** natural_lake, reservoir_flowage  |  **Environment applicability:** {"shore":"primary","dock":"limited","wading":"primary","boat":"primary","kayak":"not_applicable","canoe":"not_applicable","ice":"not_applicable"}
**Seasonal stage:** pre_spawn  |  **Calendar range:** 04-15 to 05-20  |  **Water temp:** 42-55F (general)
**Depth:** 1-6ft (exact)  |  **Structure:** flat  |  **Cover:** (unconstrained)  |  **Current:** none  |  **Clarity:** (unconstrained)

**Bait composition:** live_bait_only (live_minnow)  |  **Methods:** casting
**Equipment:** medium_light power, fast action, spinning reel, line 6-8lb (general), lure 0.125-0.25oz (general), no leader, hook: #4-#2 jig
**Retrieve:** slow, "lift-drop along the bottom", pause 1-2s (general), depth control: count down to bottom, hop along it
**Rigging:** Plain jig tipped with a shiner minnow, cast to shallow sand flats and worked back with short hops.
**Casting access required:** not specified

**Works when:** Early spring, water still cold, walleye concentrated on shallow sand flats feeding on shiner schools.
**Fails when:** Once water warms past the spring window and fish disperse to deeper structure -- see the summer slip-sinker tactic instead.
**Diagnostic signals:** No fish located after working several flats -- fish may have already moved, try deeper adjacent structure.
**Bite detection:** A tap or the line coming tight as the fish moves off.  |  **Hookset/fight:** Firm sweep-set once weight is felt.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- NONE recorded -- see relationship-graph.md for gap status.

**Externally supported fields (2):**
- `applies_when.depth_ft`: [official_guidance] Walleye biology and identification -- "DNR: "Walleye spawn over rock, rubble, gravel and similar substrate in rivers or windswept shallows in water 1 to 6 feet deep.""
- `retrieve.pause_seconds`: [anecdotal] Cross-publication convergent finding on jig lift-and-pause cadence (FishUSA cold-water jerkbait cadence guide and others) -- "Convergent finding across multiple independent, established angling-education publications (accessed via search-index synthesis, primary full-text blocked/403):..."

**Derived fields, with derivation shown (9):**
- `applies_when.water_environment`: The same DNR sentence already cited for depth ("rivers or windswept shallows") names BOTH a river setting and a wind-exposed shallow-lake setting as real walleye spawning habitat -- water_environment=[natural_lake, reservoir_flowage] uses the lake half of that same DNR statement (the river half is what t6 uses for its own, separately-modeled river tactic).
- `applies_when.platform`: DNR describes these as "near-shore" flats -- a shallow, near-shore sand flat is physically reachable by wading, shore-casting, or a shallow-draft boat; platform=[shore, wading, boat] follows from the same near-shore/shallow location fact already cited for works_when, an access-logic derivation, not an independently researched platform fact.
- `applies_when.season.biological_stage`: DNR's technique page places this pattern in "spring" specifically as spawning approaches (shallow, feeding on shiners); DNR's biology page states spawning peaks 42-50F. Together they support pre_spawn/staging rather than active spawn itself (spawning fish stage on shallow gravel/rock structure, not open sand flats away from spawning substrate) -- biological_stage=pre_spawn follows from the same cited material already used for works_when/temperature, not a new independent fact.
- `applies_when.season.water_temp_f`: Minnesota DNR and Wisconsin DNR -- two GENUINELY independent state agencies -- both independently state the identical 42-50F peak-spawn figure; Wisconsin DNR additionally gives a pre-spawn staging figure (38-44F) that this tactic's broader 42-55F range is consistent with. Real independent corroboration, not two pages from one organization.
- `applies_when.structure`: DNR's own works_when citation names "big sand flats" explicitly -- structure=[flat] is the same fact already cited for works_when, not a separate claim.
- `equipment.line_test_lb`: This tactic's stated line-test range (6-8lb) falls within the standard convention for a medium_light rod (6-10lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.125-0.25oz) is reasonably consistent with the standard convention for a medium_light rod (0.25-0.5oz) per the Norrik chart.
- `works_when`: DNR's technique page independently places walleye on shallow sand flats in spring feeding on shiners; DNR's biology page independently states spawning peaks 42-50F. Two different DNR pages corroborating the same seasonal/location pattern from different angles.
- `fails_when`: Directly follows from DNR's own stated seasonal shift to deeper water as the season progresses.

**REMAINING UNSUPPORTED FIELDS (1) -- not buried, listed first-class:**
- `applies_when.current` [obligation A]

**Questions requiring expert judgment:**
- [applies_when.current] Is the stated current level accurate for where this tactic is actually fished?
- [overall] Is the "jig-minnow" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (6 of 15 scenarios where this tactic was ranked or cautioned):**
- "2. Boat, smallmouth-style clear-lake summer conditions applied to walleye (72F, calm, bright, clear)": ranked #5 of 7, score 0.000
- "6. Boat, walleye, exact match for the mid-summer deep-structure tactic": ranked #5 of 7, score 0.104
- "8. Dock, walleye, early summer low light near a drop-off": ranked #3 of 3, score 0.032
- "9. Shore, walleye, spring shallow sand flat, live bait allowed": ranked #1 of 7, score 0.518
- "13. Wading, walleye/sauger, river pre-spawn current seam": ranked #2 of 3, score 0.207
- "15. No platform observed at all, walleye, only species known (tests all-missing behavior)": ranked #1 of 7, score 0.000

---

## t2 -- Slip-sinker (Lindy-style) live-bait rig (slip-sinker-livebait-rig)
**Tactic ID:** `15b0a7f8-108d-4b73-af4a-e8854e5fa861`  |  **Presentation ID:** `9e0cb3fa-0e0b-4d25-8e65-7b123fa64a88`  |  **Confidence:** `official_guidance`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** boat  |  **Water environment:** natural_lake, reservoir_flowage  |  **Environment applicability:** {"shore":"limited","dock":"not_applicable","wading":"not_applicable","boat":"primary","kayak":"viable","canoe":"viable","ice":"not_applicable"}
**Seasonal stage:** mid_summer  |  **Calendar range:** 06-20 to 08-31  |  **Water temp:** 65-78F (general)
**Depth:** 15-30ft (general)  |  **Structure:** hump, flat  |  **Cover:** (unconstrained)  |  **Current:** none  |  **Clarity:** clear

**Bait composition:** live_bait_only (live_minnow, live_nightcrawler, live_leech)  |  **Methods:** still_fishing
**Equipment:** medium_light power, fast action, spinning reel, line 6-10lb (general), lure 0.5-1oz (general), leader: fluorocarbon 24-36in, hook: 1/0-3/0 octopus or circle
**Retrieve:** very_slow, "slow drag, brief pauses", pause 3-8s (general), depth control: lightest sinker that holds bottom
**Rigging:** Slip sinker above a swivel, fluorocarbon leader to a hook baited with minnow, nightcrawler, or leech, dragged near bottom on humps/flats.
**Casting access required:** not specified

**Works when:** Mid-summer, warm stable water, fish holding on deep mid-lake structure.
**Fails when:** Cold water or real current -- too subtle/slow to hold position or register a bite.
**Diagnostic signals:** No contact after working 3-4 distinct structure spots thoroughly.
**Bite detection:** Light taps or steady building pressure.  |  **Hookset/fight:** Feed slack, then sweep-set into steady pressure.
**Conservation notes:** Fish from deep water (DNR discusses moderate-to-severe barotrauma risk emerging around ~30ft for the species DNR gives exact numbers for) may show barotrauma signs -- bulging eyes, bleeding gills, gas bubbles, an inability to stay upright; walleye are physoclistous and DNR states they are MORE susceptible than average, but DNR does not give a walleye-specific depth number. If a fish shows severe signs, DNR states it is preferable to keep it (it remains safe to eat) rather than attempt a release likely to fail.

**Alternatives/next_try:**
- NONE recorded -- see relationship-graph.md for gap status.

**Externally supported fields (2):**
- `works_when`: [official_guidance] How to catch a walleye -- "DNR: as the season progresses, walleye move to deep water further offshore, found on mid-lake structure like humps, saddles, and points; a slip-sinker (Lindy-st..."
- `conservation_notes`: [official_guidance] Barotrauma -- "DNR: barotrauma symptoms are "bulging eyes, bleeding gills, gas bubbles under the skin or an expanded swim bladder"; moderate-to-severe effects are discussed ar..."

**Derived fields, with derivation shown (9):**
- `applies_when.water_environment`: DNR describes this pattern on "mid-lake structure" -- a lake-specific setting; water_environment=[natural_lake, reservoir_flowage] follows from the same works_when citation, river settings are excluded since DNR does not describe this mid-summer offshore pattern for rivers.
- `applies_when.platform`: DNR describes deep, offshore, mid-lake structure -- reaching 15-30ft of water well offshore requires a boat; platform=[boat] follows from the same offshore-structure fact already cited for works_when/depth, an access-logic derivation.
- `applies_when.season.biological_stage`: DNR's own works_when citation is explicitly about "as the season progresses" into deep-water summer holding -- biological_stage=mid_summer follows directly from the same seasonal-progression fact already cited for works_when/depth.
- `applies_when.depth_ft`: DNR biology page confirms the qualitative pattern (deep, cool, low-light water in summer) but states no exact depth figure -- the 15-30ft range here is a general estimate consistent with, but not directly quoted from, that qualitative statement.
- `applies_when.structure`: DNR names "humps, saddles, and points" explicitly. This tactic's structure=[hump, flat]: "hump" is a direct match; "flat" is NOT explicitly named by DNR (a related mid-lake deep-structure type commonly fished the same way, but not itself DNR-stated) -- partial support, flagged rather than silently treated as fully sourced.
- `applies_when.current`: DNR frames this as a stillwater, mid-lake-structure pattern (distinct from river current-seam tactics like t6/t10/t14) -- current=none follows from the same lake/offshore-structure premise already cited, an inference from setting rather than a direct DNR statement about current specifically.
- `equipment.line_test_lb`: This tactic's stated line-test range (6-10lb) falls within the standard convention for a medium_light rod (6-10lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: DISAGREEMENT, retained rather than hidden: this tactic's stated lure-weight range (0.5-1oz) falls OUTSIDE the standard convention for a medium_light rod (0.25-0.5oz) per the Norrik chart -- flagged for human review rather than silently reconciled; the chart itself cautions ratings vary by rod type.
- `fails_when`: Inverse of the DNR-documented mid-summer deep-structure pattern: cold water or current would put fish somewhere other than the deep, stable-water structure this rig targets.

**REMAINING UNSUPPORTED FIELDS (2) -- not buried, listed first-class:**
- `applies_when.season.water_temp_f` [obligation A]
- `retrieve.pause_seconds` [obligation B]

**Questions requiring expert judgment:**
- [applies_when.season.water_temp_f] Is the stated water-temperature range (65-78F) realistic, or would you narrow/widen/shift it?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [overall] Is the "slip-sinker-livebait-rig" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (6 of 15 scenarios where this tactic was ranked or cautioned):**
- "2. Boat, smallmouth-style clear-lake summer conditions applied to walleye (72F, calm, bright, clear)": ranked #2 of 7, score 0.238
- "3. Kayak, strong wind": CAUTION -- insufficient_safety_data (not ranked)
- "6. Boat, walleye, exact match for the mid-summer deep-structure tactic": ranked #2 of 7, score 0.476
- "9. Shore, walleye, spring shallow sand flat, live bait allowed": ranked #3 of 7, score 0.180
- "11. Kayak, walleye, clear calm summer point (finesse-tactic match)": ranked #2 of 3, score 0.238
- "15. No platform observed at all, walleye, only species known (tests all-missing behavior)": ranked #2 of 7, score 0.000

---

## t3 -- Small perch-imitating crankbait (shallow-crankbait)
**Tactic ID:** `91015d73-c831-4621-a4d5-68742b4ff860`  |  **Presentation ID:** `2b3f2314-09c6-486d-bac7-c737ca992627`  |  **Confidence:** `peer_review_supported`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** boat, kayak  |  **Water environment:** natural_lake, reservoir_flowage  |  **Environment applicability:** {"shore":"not_applicable","dock":"not_applicable","wading":"not_applicable","boat":"primary","kayak":"viable","canoe":"not_applicable","ice":"not_applicable"}
**Seasonal stage:** fall_turnover  |  **Calendar range:** 09-15 to 10-31  |  **Water temp:** 48-62F (general)
**Depth:** 3-10ft (general)  |  **Structure:** point, channel_edge  |  **Cover:** vegetation  |  **Current:** none  |  **Clarity:** stained

**Bait composition:** artificial_only (artificial_lure)  |  **Methods:** casting, trolling
**Equipment:** medium power, moderate action, either reel, line 8-12lb (general), lure 0.25-0.5oz (general), no leader
**Retrieve:** moderate, "steady, no pause", pause 0-0s (general), depth control: small perch-pattern crank run near bottom over the target depth
**Rigging:** Small hard-bodied crankbait resembling perch, cast or trolled along shoreline structure.
**Casting access required:** not specified

**Works when:** Early-mid fall as walleye return to shoreline structure; low light/chop improves it.
**Fails when:** Bright, calm, clear conditions in the same season make the same shallow presentation too visible.
**Diagnostic signals:** Follows or short strikes without hookup -- slow down or downsize before abandoning the pattern.
**Bite detection:** A hard strike, rod loads immediately.  |  **Hookset/fight:** Let the fish load a moderate-action rod; no manual hookset usually needed.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- **alternative** -> t2 (slip-sinker-livebait-rig): Genuinely different seasonal pattern (fall shallow vs. summer deep); not a same-conditions disagreement.

**Externally supported fields (0):**

**Derived fields, with derivation shown (10):**
- `applies_when.water_environment`: DNR describes walleye returning to "shoreline locations" and fishing "shallow weedlines, gravel bars, points" -- a lake-shoreline setting; water_environment=[natural_lake, reservoir_flowage] follows from the same works_when citation.
- `applies_when.platform`: DNR describes trolling/casting along shoreline structure -- reachable by boat, and shallow enough (3-10ft) for a kayak; platform=[boat, kayak] follows from the same shoreline-structure fact already cited, an access-logic derivation.
- `applies_when.season.biological_stage`: DNR's own works_when citation explicitly frames this as "late summer/early fall" -- biological_stage=fall_turnover follows directly from the same seasonal fact already cited for works_when.
- `applies_when.structure`: DNR names "shallow weedlines, gravel bars, points" -- "point" is a direct match for this tactic's structure=[point, channel_edge]; "channel_edge" is NOT explicitly named by DNR (a related shoreline-drop-off structure type, not itself DNR-stated) -- partial support, flagged rather than silently treated as fully sourced.
- `applies_when.cover`: DNR explicitly names "shallow weedlines" -- cover=[vegetation] is a direct match for the same works_when citation.
- `applies_when.current`: DNR frames this as a lake-shoreline pattern (not a river current-seam tactic) -- current=none follows from the same lake/shoreline-structure premise already cited, an inference from setting rather than a direct DNR statement about current specifically.
- `equipment.line_test_lb`: This tactic's stated line-test range (8-12lb) falls within the standard convention for a medium rod (8-15lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.25-0.5oz) is reasonably consistent with the standard convention for a medium rod (0.5-1oz) per the Norrik chart.
- `works_when`: DNR (Minnesota DNR) independently documents the fall shoreline-return location/timing; the peer-reviewed lure-color study (Journal of Great Lakes Research, a genuinely different organization) independently documents that a stained/turbid presentation benefits from gold/yellow lure color specifically -- this tactic's own low-light/chop qualifier is directionally consistent with, though not a verbatim match for, the paper's sedimentary-turbidity finding. Two different organizations, real corroboration of the general premise (clarity affects which presentation/color wins here), not of one identical sentence.
- `fails_when`: Minnesota DNR states walleye stay MORE active in low-brightness (turbid/chop/cloud) conditions; Wisconsin DNR -- a genuinely different organization -- independently confirms walleye "usually stay in deeper areas during the day" in clear water but "can be caught throughout the day" in turbid water. Two independent state agencies corroborating the same clarity-driven behavior pattern; the direct converse for THIS shallow presentation (bright/clear reduces its effectiveness) is inferred from that corroborated pattern, not itself separately stated by either agency.

**REMAINING UNSUPPORTED FIELDS (3) -- not buried, listed first-class:**
- `applies_when.season.water_temp_f` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `retrieve.pause_seconds` [obligation B]

**Questions requiring expert judgment:**
- [applies_when.season.water_temp_f] Is the stated water-temperature range (48-62F) realistic, or would you narrow/widen/shift it?
- [applies_when.depth_ft] Is the stated depth range (3-10ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [overall] Is the "shallow-crankbait" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (6 of 15 scenarios where this tactic was ranked or cautioned):**
- "2. Boat, smallmouth-style clear-lake summer conditions applied to walleye (72F, calm, bright, clear)": ranked #4 of 7, score 0.035
- "3. Kayak, strong wind": CAUTION -- insufficient_safety_data (not ranked)
- "6. Boat, walleye, exact match for the mid-summer deep-structure tactic": ranked #4 of 7, score 0.174
- "11. Kayak, walleye, clear calm summer point (finesse-tactic match)": ranked #3 of 3, score 0.166
- "12. Boat, walleye, turbid water, artificial_only constraint": ranked #1 of 1, score 0.070
- "15. No platform observed at all, walleye, only species known (tests all-missing behavior)": ranked #3 of 7, score 0.000

---

## t4 -- Jigging spoon, aggressive cadence (jigging-spoon-aggressive)
**Tactic ID:** `32f92c8d-c91a-46f2-81df-96b1b23da206`  |  **Presentation ID:** `8b4f4eca-58cc-4aff-b981-f62bcb940858`  |  **Confidence:** `official_guidance`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** ice  |  **Water environment:** natural_lake  |  **Environment applicability:** {"shore":"not_applicable","dock":"not_applicable","wading":"not_applicable","boat":"not_applicable","kayak":"not_applicable","canoe":"not_applicable","ice":"primary"}
**Seasonal stage:** midwinter_ice  |  **Calendar range:** 01-05 to 02-15  |  **Water temp:** 34-39F (general)
**Depth:** 15-25ft (general)  |  **Structure:** hump, basin  |  **Cover:** (unconstrained)  |  **Current:** none  |  **Clarity:** clear

**Bait composition:** hybrid_bait_and_artificial (artificial_lure, live_other)  |  **Methods:** jigging, vertical_jigging
**Equipment:** medium_light power, fast action, spinning reel, line 6-8lb (general), lure 0.25-0.5oz (general), no leader
**Retrieve:** fast, "sharp upward snaps with a flutter on the fall, occasionally slapping bottom to create a sediment plume", pause 1-3s (general), depth control: work within a few feet of bottom
**Rigging:** Flashy fluttering jigging spoon, worked aggressively near bottom; can be fished bare or tipped with a waxworm/minnow head.
**Casting access required:** not specified

**Works when:** Midwinter, clear water, over deep structure, when fish are actively responding to flash/vibration and reaction strikes.
**Fails when:** When fish are neutral/inactive and spook from or ignore aggressive movement -- see the deadstick alternative.
**Diagnostic signals:** Fish marked on electronics but not committing to the aggressive presentation -- switch to the subtler deadstick tactic rather than continuing to work it harder.
**Bite detection:** A sudden stop on the fall or a hard thump on the upstroke.  |  **Hookset/fight:** Sharp upward set on any unnatural weight or stop.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- **conflicts_with** -> t5 (jig-minnow-head-deadstick): DNR's own ice-fishing-walleye page explicitly frames aggressive jigging-spoon action and a near-motionless minnow-head jig as competing approaches under the SAME conditions (same water, same depth, same time of year) without declaring either universally correct -- a genuine, sourced disagreement, not a condition-window difference.

**Externally supported fields (2):**
- `applies_when.season.water_temp_f`: [expert_synthesis] A Look Under the Ice: Winter Lake Ecology -- "Basic winter limnology (NOT a walleye-specific source -- cited only for the physical water-temperature fact): under ice, surface water is near 32F and the water..."
- `works_when`: [official_guidance] Ice fishing for walleye -- "DNR explicitly frames this as one of two genuinely competing approaches ("sometimes a thin flashy fluttering spoon is the ticket") without declaring one univers..."

**Derived fields, with derivation shown (6):**
- `applies_when.water_environment`: DNR's ice-fishing page is specifically about lake ice fishing; water_environment=[natural_lake] follows from the same page's subject matter already cited for works_when.
- `applies_when.platform`: DNR's page is specifically about ICE fishing technique; platform=[ice] follows directly from the same page's subject matter already cited for works_when/rigging.
- `applies_when.structure`: DNR discusses fishing "deep structure" under ice generally, consistent with this tactic's structure=[hump, basin], though DNR does not name these exact structure types -- a general, not verbatim, match.
- `applies_when.current`: Ice-covered lake water under a stable ice sheet is not current-driven; current=none follows from the same lake/ice setting already cited for works_when, a physical inference from setting.
- `equipment.line_test_lb`: This tactic's stated line-test range (6-8lb) falls within the standard convention for a medium_light rod (6-10lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.25-0.5oz) is reasonably consistent with the standard convention for a medium_light rod (0.25-0.5oz) per the Norrik chart.

**REMAINING UNSUPPORTED FIELDS (4) -- not buried, listed first-class:**
- `applies_when.season.biological_stage` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `retrieve.pause_seconds` [obligation B]
- `fails_when` [obligation A]

**Questions requiring expert judgment:**
- [applies_when.season.biological_stage] Does the stated biological stage match when you'd actually use this on the water, or does it run earlier/later/differently than stated?
- [applies_when.depth_ft] Is the stated depth range (15-25ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [fails_when] What actually causes this tactic to fail in your experience -- does the stated fails_when match, or is there a different, more common failure mode?
- [overall] Is the "jigging-spoon-aggressive" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (2 of 15 scenarios where this tactic was ranked or cautioned):**
- "4. Ice, crappie-style low-oxygen midwinter conditions applied to walleye": ranked #1 of 3, score 0.159
- "7. Ice, walleye, midwinter clear/deep -- the GENUINE conflict scenario (aggressive spoon vs. deadstick)": ranked #1 of 3, score 0.476

---

## t5 -- Minnow-head jig, near-motionless (jig-minnow-head-deadstick)
**Tactic ID:** `5be9c8f6-c5e2-426c-a02b-20f44b9f95ca`  |  **Presentation ID:** `e3f78e66-bd44-4173-a4e1-f9e97ed365d2`  |  **Confidence:** `official_guidance`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** ice  |  **Water environment:** natural_lake  |  **Environment applicability:** {"shore":"not_applicable","dock":"not_applicable","wading":"not_applicable","boat":"not_applicable","kayak":"not_applicable","canoe":"not_applicable","ice":"primary"}
**Seasonal stage:** midwinter_ice  |  **Calendar range:** 01-05 to 02-15  |  **Water temp:** 34-39F (general)
**Depth:** 15-25ft (general)  |  **Structure:** hump, basin  |  **Cover:** (unconstrained)  |  **Current:** none  |  **Clarity:** clear

**Bait composition:** hybrid_bait_and_artificial (artificial_lure, live_minnow)  |  **Methods:** jigging
**Equipment:** ultralight power, slow action, spinning reel, line 4-6lb (general), lure 0.0625-0.125oz (general), no leader
**Retrieve:** dead_still, "virtually motionless, occasional tiny lift", pause 10-30s (general), depth control: held just above bottom or at the marked fish depth
**Rigging:** Small jig in a minnow shape/color tipped with a minnow head, held nearly still at the fish's depth.
**Casting access required:** not specified

**Works when:** Midwinter, clear water, when fish are neutral/inactive or have been pressured and shy away from aggressive movement.
**Fails when:** When fish are actively feeding and a subtler presentation gets outcompeted or simply not noticed -- see the aggressive spoon alternative.
**Diagnostic signals:** Fish approach on electronics but do not commit -- if this ALSO fails to draw a take within a reasonable window, try the aggressive spoon instead (and vice versa); the DNR itself does not resolve which comes first.
**Bite detection:** Very subtle -- a slight line twitch or the bobber/spring bobber loading almost imperceptibly.  |  **Hookset/fight:** A gentle, deliberate lift rather than a hard snap -- an aggressive set can pull the bait from a light-biting fish.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- **conflicts_with** -> t4 (jigging-spoon-aggressive): Same genuine disagreement, other direction -- see t4's note.

**Externally supported fields (2):**
- `applies_when.season.water_temp_f`: [expert_synthesis] A Look Under the Ice: Winter Lake Ecology -- "Basic winter limnology (NOT a walleye-specific source -- cited only for the physical water-temperature fact): under ice, the water column is capped at "4 degree..."
- `works_when`: [official_guidance] Ice fishing for walleye -- "DNR presents this as the genuine alternative to the aggressive-spoon approach, not a fallback -- explicitly recommends experimenting to discover what works best..."

**Derived fields, with derivation shown (6):**
- `applies_when.water_environment`: DNR's ice-fishing page is specifically about lake ice fishing; water_environment=[natural_lake] follows from the same page's subject matter already cited for works_when.
- `applies_when.platform`: DNR's page is specifically about ICE fishing technique; platform=[ice] follows directly from the same page's subject matter already cited.
- `applies_when.structure`: DNR discusses fishing deep structure under ice generally, consistent with this tactic's structure=[hump, basin], though DNR does not name these exact structure types -- a general, not verbatim, match.
- `applies_when.current`: Ice-covered lake water under a stable ice sheet is not current-driven; current=none follows from the same lake/ice setting already cited for works_when.
- `equipment.line_test_lb`: This tactic's stated line-test range (4-6lb) falls within the standard convention for a ultralight rod (1-6lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: DISAGREEMENT, retained rather than hidden: this tactic's stated lure-weight range (0.0625-0.125oz) falls OUTSIDE the standard convention for a ultralight rod (0.0156-0.0625oz) per the Norrik chart -- flagged for human review rather than silently reconciled; the chart itself cautions ratings vary by rod type.

**REMAINING UNSUPPORTED FIELDS (4) -- not buried, listed first-class:**
- `applies_when.season.biological_stage` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `retrieve.pause_seconds` [obligation B]
- `fails_when` [obligation A]

**Questions requiring expert judgment:**
- [applies_when.season.biological_stage] Does the stated biological stage match when you'd actually use this on the water, or does it run earlier/later/differently than stated?
- [applies_when.depth_ft] Is the stated depth range (15-25ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [fails_when] What actually causes this tactic to fail in your experience -- does the stated fails_when match, or is there a different, more common failure mode?
- [overall] Is the "jig-minnow-head-deadstick" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (2 of 15 scenarios where this tactic was ranked or cautioned):**
- "4. Ice, crappie-style low-oxygen midwinter conditions applied to walleye": ranked #2 of 3, score 0.159
- "7. Ice, walleye, midwinter clear/deep -- the GENUINE conflict scenario (aggressive spoon vs. deadstick)": ranked #2 of 3, score 0.476

---

## t6 -- Jig and minnow (jig-minnow)
**Tactic ID:** `c39bd44d-eeb2-4c25-b199-7de3b9ce9551`  |  **Presentation ID:** `71231f0a-275a-4671-93b9-3216bf5a37c2`  |  **Confidence:** `peer_review_supported`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary), Sauger
**Platform:** shore, wading, boat  |  **Water environment:** river, tributary  |  **Environment applicability:** {"shore":"primary","dock":"not_applicable","wading":"primary","boat":"primary","kayak":"not_applicable","canoe":"not_applicable","ice":"not_applicable"}
**Seasonal stage:** pre_spawn  |  **Calendar range:** 03-15 to 04-30  |  **Water temp:** 38-52F (general)
**Depth:** 4-14ft (general)  |  **Structure:** current_seam, channel_edge  |  **Cover:** (unconstrained)  |  **Current:** moderate  |  **Clarity:** stained

**Bait composition:** live_bait_only (live_minnow)  |  **Methods:** casting
**Equipment:** medium_light power, fast action, spinning reel, line 8-10lb (general), lure 0.125-0.375oz (general), no leader, hook: #2-1/0 jig
**Retrieve:** slow, "lift-drop, maintain bottom contact between lifts", pause 1-3s (general), depth control: count down to bottom, lift just clear then settle
**Rigging:** Jig tied direct, tipped with a minnow, cast upstream/across current seams and worked back with bottom-contact hops.
**Casting access required:** not specified

**Works when:** Pre-spawn river/tributary staging, moderate current, walleye and sauger holding on seams and channel edges.
**Fails when:** Once fish move onto true spawning gravel (different, more localized behavior) or in dead-still water with no seam to define.
**Diagnostic signals:** No contact after working 3-4 current seams at the right depth/pace -- try a heavier jig to hold bottom better, or relocate to the next seam downstream.
**Bite detection:** A tap, sudden slack, extra weight, or the line moving differently from the current.  |  **Hookset/fight:** Sweep-set on any contact -- current fish often only tap once.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- NONE recorded -- see relationship-graph.md for gap status.

**Externally supported fields (1):**
- `retrieve.pause_seconds`: [anecdotal] Cross-publication convergent finding on jig lift-and-pause cadence (FishUSA cold-water jerkbait cadence guide and others) -- "Convergent finding across multiple independent, established angling-education publications (search-index synthesis, primary full-text blocked/403): standard lif..."

**Derived fields, with derivation shown (9):**
- `applies_when.water_environment`: DNR's biology page names "rivers" explicitly as walleye spawning habitat; Haxton et al. (peer-reviewed, independent org) directly studies a river (the Rainy River) for exactly this species pairing -- water_environment=[river, tributary] is doubly, independently supported.
- `applies_when.platform`: River current-seam staging areas near shore/tributary mouths are reachable by shore-casting, wading, or boat; platform=[shore, wading, boat] follows from the same river-staging premise already cited for works_when.
- `applies_when.season.biological_stage`: Wisconsin DNR's own figure is explicitly for the "spawning migration" -- the PRE-spawn staging phase before fish reach spawning gravel itself; biological_stage=pre_spawn follows directly from the same migration-timing fact already cited for water_temp_f.
- `applies_when.season.water_temp_f`: Wisconsin DNR's 38-44F pre-spawn migration-onset figure directly supports the cold end of this tactic's 38-52F pre-spawn river-staging range; the warm end is consistent with (though not verbatim from) the peak-spawn 42-50F figure both MN and WI DNR independently state.
- `applies_when.structure`: Haxton et al. studies river-channel habitat use directly; structure=[current_seam, channel_edge] is consistent with the river-channel setting the paper examines, though it does not name these exact structure-type labels.
- `applies_when.current`: Haxton et al. explicitly discusses current/turbidity as the mechanism enabling species coexistence in this river -- current=moderate follows from the same river-current premise already cited for works_when.
- `equipment.line_test_lb`: This tactic's stated line-test range (8-10lb) falls within the standard convention for a medium_light rod (6-10lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.125-0.375oz) is reasonably consistent with the standard convention for a medium_light rod (0.25-0.5oz) per the Norrik chart.
- `works_when`: The two DNR claims (walleye spawning-substrate location, sauger spawning timing/depth) are the SAME organization and do not corroborate each other independently. Haxton et al. 2019 (peer-reviewed, a genuinely different organization) independently confirms the underlying premise that sauger and walleye co-occur in the same river reaches -- this is real, if partial, independent corroboration for the joint-species river premise specifically, not for the exact pre-spawn timing/current-seam details, which remain DNR-only.

**REMAINING UNSUPPORTED FIELDS (2) -- not buried, listed first-class:**
- `applies_when.depth_ft` [obligation A]
- `fails_when` [obligation A]

**Questions requiring expert judgment:**
- [applies_when.depth_ft] Is the stated depth range (4-14ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [fails_when] What actually causes this tactic to fail in your experience -- does the stated fails_when match, or is there a different, more common failure mode?
- [overall] Is the "jig-minnow" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (7 of 15 scenarios where this tactic was ranked or cautioned):**
- "2. Boat, smallmouth-style clear-lake summer conditions applied to walleye (72F, calm, bright, clear)": ranked #6 of 7, score 0.000
- "5. River, catfish-style rising water applied to sauger": ranked #3 of 3, score 0.122
- "6. Boat, walleye, exact match for the mid-summer deep-structure tactic": ranked #6 of 7, score 0.049
- "9. Shore, walleye, spring shallow sand flat, live bait allowed": ranked #2 of 7, score 0.366
- "10. Boat, sauger, fall turbid river channel edge": ranked #2 of 3, score 0.488
- "13. Wading, walleye/sauger, river pre-spawn current seam": ranked #1 of 3, score 0.732
- "15. No platform observed at all, walleye, only species known (tests all-missing behavior)": ranked #4 of 7, score 0.000

---

## t7 -- Slip bobber with live bait (slip-bobber-livebait)
**Tactic ID:** `8bd9bce1-2013-4edb-a9e1-d5ec82e912c4`  |  **Presentation ID:** `10ad1852-f1a4-4dcd-8600-3d03e9b4b1b8`  |  **Confidence:** `expert_synthesis`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** dock, shore  |  **Water environment:** natural_lake  |  **Environment applicability:** {"shore":"viable","dock":"primary","wading":"not_applicable","boat":"not_applicable","kayak":"not_applicable","canoe":"not_applicable","ice":"not_applicable"}
**Seasonal stage:** early_summer  |  **Calendar range:** 06-01 to 07-15  |  **Water temp:** 60-70F (general)
**Depth:** 6-14ft (general)  |  **Structure:** drop_off  |  **Cover:** docks  |  **Current:** none  |  **Clarity:** (unconstrained)

**Bait composition:** live_bait_only (live_minnow, live_leech)  |  **Methods:** still_fishing
**Equipment:** light power, moderate action, spinning reel, line 6-8lb (general), lure 0.0625-0.125oz (general), no leader, hook: #4-#6
**Retrieve:** dead_still, "suspended, minimal drift", pause 0-0s (general), depth control: set the slip bobber stop to hold bait at the drop-off depth
**Rigging:** Slip bobber set to depth, small hook with a minnow or leech, suspended near a dock drop-off.
**Casting access required:** limited

**Works when:** Low light (dawn/dusk), docks adjacent to a drop-off, early summer.
**Fails when:** Bright midday light with fish holding deeper off the drop-off, out of easy dock-casting range.
**Diagnostic signals:** No action at dawn/dusk after a reasonable wait -- try adjusting depth before abandoning the spot.
**Bite detection:** The bobber goes under or moves off at an angle.  |  **Hookset/fight:** Wait for the bobber to fully submerge before a firm sweep-set.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- NONE recorded -- see relationship-graph.md for gap status.

**Externally supported fields (0):**

**Derived fields, with derivation shown (8):**
- `applies_when.water_environment`: A dock is a lake/reservoir-specific structure by definition; water_environment=[natural_lake] follows from the presentation itself, not a new biological fact.
- `applies_when.platform`: A dock is, by definition, fished from the dock itself or adjacent shore; platform=[dock, shore] follows directly from the presentation's own structural premise, not a new biological fact.
- `applies_when.current`: A dock in natural_lake water is a stillwater setting by definition of the platform/environment already established; current=none follows from that same setting.
- `equipment.line_test_lb`: This tactic's stated line-test range (6-8lb) falls within the standard convention for a light rod (4-8lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.0625-0.125oz) is reasonably consistent with the standard convention for a light rod (0.0625-0.25oz) per the Norrik chart.
- `works_when`: DNR biology page directly documents dawn/dusk shallow feeding and a daylight retreat toward cover/deeper water -- this tactic's low-light-near-a-drop-off premise follows directly, though the DOCK-specific setting itself is not DNR-stated (practitioner adaptation of the general low-light pattern to dock structure).
- `fails_when`: Direct inverse of the same DNR fact: with daylight, fish retreat from the shallow drop-off edge toward deeper water/cover, out of easy dock-casting range.
- `casting_access_required`: A fixed dock structure inherently constrains casting angles (the dock's own footprint, pilings, and neighboring docks limit backswing/casting lanes compared to open shore); casting_access_required=limited is a physical/structural inference from the dock platform itself already established, not an independently researched fact.

**REMAINING UNSUPPORTED FIELDS (6) -- not buried, listed first-class:**
- `applies_when.season.biological_stage` [obligation A]
- `applies_when.season.water_temp_f` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `applies_when.structure` [obligation A]
- `applies_when.cover` [obligation A]
- `retrieve.pause_seconds` [obligation B]

**Questions requiring expert judgment:**
- [applies_when.season.biological_stage] Does the stated biological stage match when you'd actually use this on the water, or does it run earlier/later/differently than stated?
- [applies_when.season.water_temp_f] Is the stated water-temperature range (60-70F) realistic, or would you narrow/widen/shift it?
- [applies_when.depth_ft] Is the stated depth range (6-14ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [applies_when.structure] Is the stated structure set the right one, or is a different structure type more reliable for this pattern?
- [applies_when.cover] Is the stated cover accurate, or does something else (that this record misses) matter more?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [overall] Is the "slip-bobber-livebait" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (2 of 15 scenarios where this tactic was ranked or cautioned):**
- "8. Dock, walleye, early summer low light near a drop-off": ranked #1 of 3, score 0.244
- "9. Shore, walleye, spring shallow sand flat, live bait allowed": ranked #7 of 7, score 0.046

---

## t8 -- Jig and minnow (jig-minnow)
**Tactic ID:** `cff1d011-af9e-415d-9812-7c6b9daffd8b`  |  **Presentation ID:** `71231f0a-275a-4671-93b9-3216bf5a37c2`  |  **Confidence:** `expert_synthesis`  |  **Readiness:** `blocked_by_safety_gap`
**Target species:** Walleye (primary)
**Platform:** kayak, canoe  |  **Water environment:** natural_lake  |  **Environment applicability:** {"shore":"not_applicable","dock":"not_applicable","wading":"not_applicable","boat":"viable","kayak":"primary","canoe":"primary","ice":"not_applicable"}
**Seasonal stage:** mid_summer  |  **Calendar range:** (unconstrained)  |  **Water temp:** 68-76F (general)
**Depth:** 8-16ft (general)  |  **Structure:** point  |  **Cover:** (unconstrained)  |  **Current:** (unconstrained)  |  **Clarity:** clear

**Bait composition:** hybrid_bait_and_artificial (artificial_lure, live_minnow)  |  **Methods:** casting
**Equipment:** light power, fast action, spinning reel, line 4-6lb (general), lure 0.0625-0.125oz (general), leader: fluorocarbon 18-24in, hook: #4 jig
**Retrieve:** very_slow, "small, subtle hops", pause 2-5s (general), depth control: count down to just above bottom
**Rigging:** Small light jig (bare or minnow-tipped) fished quietly from a kayak/canoe over a clear-water point, fluorocarbon leader to reduce visibility.
**Casting access required:** not specified

**Works when:** Clear water, calm conditions, where a quiet low-profile platform and finesse presentation out-fish a noisier boat approach.
**Fails when:** Windy/chop conditions where a kayak/canoe becomes difficult to control and hold position on structure -- see the standalone safety-layer note: this tactic record does NOT itself set a wind safety threshold (see design/angling-knowledge-base/v3/safety/README.md).
**Diagnostic signals:** Difficulty holding position in wind is itself the signal to switch platforms/tactics, not a bait problem.
**Bite detection:** A subtle tick or the line twitching sideways.  |  **Hookset/fight:** Light, deliberate sweep-set -- light line requires smooth drag use.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- NONE recorded -- see relationship-graph.md for gap status.

**Externally supported fields (0):**

**Derived fields, with derivation shown (2):**
- `equipment.line_test_lb`: This tactic's stated line-test range (4-6lb) falls within the standard convention for a light rod (4-8lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.0625-0.125oz) is reasonably consistent with the standard convention for a light rod (0.0625-0.25oz) per the Norrik chart.

**REMAINING UNSUPPORTED FIELDS (9) -- not buried, listed first-class:**
- `applies_when.water_environment` [obligation A]
- `applies_when.platform` [obligation B]
- `applies_when.season.biological_stage` [obligation A]
- `applies_when.season.water_temp_f` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `applies_when.structure` [obligation A]
- `retrieve.pause_seconds` [obligation B]
- `works_when` [obligation A]
- `fails_when` [obligation A]

**Questions requiring expert judgment:**
- [applies_when.water_environment] Is the stated water-environment set (lake vs. river vs. tributary) actually where you'd expect this to work, in your MN/WI experience?
- [applies_when.platform] Is the derived platform list (from access logic, not direct research) actually correct on the water?
- [applies_when.season.biological_stage] Does the stated biological stage match when you'd actually use this on the water, or does it run earlier/later/differently than stated?
- [applies_when.season.water_temp_f] Is the stated water-temperature range (68-76F) realistic, or would you narrow/widen/shift it?
- [applies_when.depth_ft] Is the stated depth range (8-16ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [applies_when.structure] Is the stated structure set the right one, or is a different structure type more reliable for this pattern?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [works_when] Does the stated works_when reasoning hold up on the water, or is something missing/wrong?
- [fails_when] What actually causes this tactic to fail in your experience -- does the stated fails_when match, or is there a different, more common failure mode?
- [overall] Is the "jig-minnow" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (5 of 15 scenarios where this tactic was ranked or cautioned):**
- "2. Boat, smallmouth-style clear-lake summer conditions applied to walleye (72F, calm, bright, clear)": ranked #3 of 7, score 0.183
- "3. Kayak, strong wind": CAUTION -- insufficient_safety_data (not ranked)
- "6. Boat, walleye, exact match for the mid-summer deep-structure tactic": ranked #3 of 7, score 0.213
- "11. Kayak, walleye, clear calm summer point (finesse-tactic match)": ranked #1 of 3, score 0.305
- "15. No platform observed at all, walleye, only species known (tests all-missing behavior)": ranked #5 of 7, score 0.000

---

## t9 -- Crawler harness, trolled (crawler-harness-troll)
**Tactic ID:** `bbe350b0-8ff7-4530-9dfe-d986123d7463`  |  **Presentation ID:** `4a357b18-2f80-4ef0-a9b6-2761ad2c060b`  |  **Confidence:** `peer_review_supported`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** boat  |  **Water environment:** natural_lake, reservoir_flowage  |  **Environment applicability:** {"shore":"not_applicable","dock":"not_applicable","wading":"not_applicable","boat":"primary","kayak":"not_applicable","canoe":"not_applicable","ice":"not_applicable"}
**Seasonal stage:** mid_summer  |  **Calendar range:** (unconstrained)  |  **Water temp:** 62-75F (general)
**Depth:** 10-20ft (general)  |  **Structure:** (unconstrained)  |  **Cover:** (unconstrained)  |  **Current:** none  |  **Clarity:** turbid

**Bait composition:** live_bait_only (live_nightcrawler)  |  **Methods:** trolling
**Equipment:** medium power, moderate action, either reel, line 10-14lb (general), lure 0.5-1oz (general), no leader, hook: #2-#4 harness
**Retrieve:** slow, "steady troll", pause 0-0s (general), depth control: bottom-bouncer or leadcore to hold near bottom
**Rigging:** Spinner-blade crawler harness trolled behind a bottom-bouncer, high-contrast blade color for turbid water.
**Casting access required:** not specified

**Works when:** Turbid/stained water where flash and vibration matter more than visual color match, covering water to relocate scattered fish.
**Fails when:** Clear water where a more natural, subtler presentation typically outperforms a flashy trolled harness -- see t2's slip-sinker live-bait rig instead (next_try).
**Diagnostic signals:** No takers after a full pass -- change blade color/size or speed before changing location.
**Bite detection:** Steady rod-tip load; strikes are usually decisive on a moving bait.  |  **Hookset/fight:** Let the moving bait set the hook; trim speed only after a confirmed hookup pattern emerges.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- **next_try** -> t2 (slip-sinker-livebait-rig): FAILURE HYPOTHESIS: this tactic fails when clarity shifts from turbid to clear because its whole premise -- a flashy, high-vibration, fast-moving harness -- is believed to trade on turbid water's reduced visibility; in clear water that same flash/speed is believed to become a wariness trigger rather than an attractant. WHY t2 RESPONDS TO IT: t2 changes exactly the characteristic implicated by that hypothesis -- it swaps a fast trolled artificial-flash presentation for a slow-dragged, natural-scent live-bait rig (minnow/nightcrawler/leech) at a similar depth/temperature band for the same species, i.e. it removes the flash/speed this tactic's own fails_when blames, rather than merely being nearby in the condition space. Distinct from this tactic's own diagnostic_signals ("no takers after a full pass -- change blade color/size or speed"), which covers within-presentation micro-adjustment while STILL turbid; next_try is reserved for the case where clarity itself has genuinely changed, a different trigger, not a contradiction of the diagnostic guidance.
  - Real validation: **PASS** all 12 criteria: {"sameSpecies":true,"compatiblePlatform":true,"compatibleWaterEnv":true,"depthOverlap":true,"tempOverlap":true,"presentationDiffers":true,"intensityTierDiffers":true,"environmentApplicabilityOverlap":true,"hasFailureHypothesis":true,"hasResponseRationale":true,"notJustClosestMatch":true,"noteIsSubstantive":true}

**Externally supported fields (0):**

**Derived fields, with derivation shown (7):**
- `applies_when.water_environment`: The DNR turbidity fact is general walleye biology applicable across lake/reservoir settings; water_environment=[natural_lake, reservoir_flowage] is consistent with this tactic's boat-trolling premise, an inference from platform/technique rather than a river-specific DNR statement.
- `applies_when.platform`: Trolling a crawler harness behind a bottom-bouncer requires a boat by definition of the technique itself; platform=[boat] follows directly from the presentation's own mechanics, not a new biological fact.
- `applies_when.current`: A trolled presentation covering open water for scattered fish is a stillwater/lake technique (distinct from the current-seam river tactics t6/t10/t14); current=none follows from the same lake-trolling premise already established.
- `equipment.line_test_lb`: This tactic's stated line-test range (10-14lb) falls within the standard convention for a medium rod (8-15lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.5-1oz) is reasonably consistent with the standard convention for a medium rod (0.5-1oz) per the Norrik chart.
- `works_when`: DNR (Minnesota DNR) states walleye tolerate/favor more daytime activity in turbid conditions; the peer-reviewed lure-color paper (Journal of Great Lakes Research, a genuinely different organization) independently confirms that gold/yellow lure color specifically outperforms in sedimentary turbidity -- two different organizations, real corroboration of the underlying premise that turbidity favors a high-visibility presentation, though DNR does not itself recommend a crawler harness specifically and the paper does not itself discuss harnesses.
- `fails_when`: Minnesota DNR and Wisconsin DNR -- two genuinely independent state agencies -- both independently document the same clarity-driven activity pattern; in clear water the flash/vibration advantage this tactic relies on is reduced, favoring a subtler natural presentation instead.

**REMAINING UNSUPPORTED FIELDS (4) -- not buried, listed first-class:**
- `applies_when.season.biological_stage` [obligation A]
- `applies_when.season.water_temp_f` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `retrieve.pause_seconds` [obligation B]

**Questions requiring expert judgment:**
- [applies_when.season.biological_stage] Does the stated biological stage match when you'd actually use this on the water, or does it run earlier/later/differently than stated?
- [applies_when.season.water_temp_f] Is the stated water-temperature range (62-75F) realistic, or would you narrow/widen/shift it?
- [applies_when.depth_ft] Is the stated depth range (10-20ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [overall] Is the "crawler-harness-troll" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (3 of 15 scenarios where this tactic was ranked or cautioned):**
- "2. Boat, smallmouth-style clear-lake summer conditions applied to walleye (72F, calm, bright, clear)": ranked #1 of 7, score 0.244
- "6. Boat, walleye, exact match for the mid-summer deep-structure tactic": ranked #1 of 7, score 0.488
- "15. No platform observed at all, walleye, only species known (tests all-missing behavior)": ranked #6 of 7, score 0.000

---

## t10 -- Slip-sinker (Lindy-style) live-bait rig (slip-sinker-livebait-rig)
**Tactic ID:** `395d1c2c-de57-421d-b8c5-a2d30fd11949`  |  **Presentation ID:** `9e0cb3fa-0e0b-4d25-8e65-7b123fa64a88`  |  **Confidence:** `peer_review_supported`  |  **Readiness:** `research_incomplete`
**Target species:** Sauger (primary)
**Platform:** boat, shore  |  **Water environment:** river  |  **Environment applicability:** {"shore":"viable","dock":"not_applicable","wading":"not_applicable","boat":"primary","kayak":"not_applicable","canoe":"not_applicable","ice":"not_applicable"}
**Seasonal stage:** fall_turnover  |  **Calendar range:** 10-01 to 11-30  |  **Water temp:** 40-55F (general)
**Depth:** 10-25ft (general)  |  **Structure:** channel_edge, current_seam  |  **Cover:** (unconstrained)  |  **Current:** moderate  |  **Clarity:** turbid

**Bait composition:** live_bait_only (live_minnow)  |  **Methods:** still_fishing
**Equipment:** medium power, fast action, spinning reel, line 8-12lb (general), lure 0.5-1.5oz (general), leader: fluorocarbon 18-30in, hook: 1/0-2/0
**Retrieve:** dead_still, "hold in current with just enough weight to maintain bottom contact", pause 5-15s (general), depth control: walk the rig downstream through the hole
**Rigging:** Heavier slip-sinker rig to hold bottom in current, fluorocarbon leader, minnow or shiner in a deep river channel hole.
**Casting access required:** not specified

**Works when:** Fall river/tailwater staging, sauger holding in deep, turbid channel holes -- sauger tolerate current and turbidity more readily than walleye in the same reach.
**Fails when:** Clear, still conditions where sauger are typically found shallower or more dispersed, not stacked in deep turbid holes.
**Diagnostic signals:** Consistent snags/no bites in one hole after real effort -- move to the next channel bend rather than adding more weight.
**Bite detection:** A distinct tap-tap-tap or a steady heavy pull, distinct from the drag of current.  |  **Hookset/fight:** Firm sweep-set once weight is confirmed as a fish, not current drag.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- **alternative** -> t2 (slip-sinker-livebait-rig): Same presentation family (slip-sinker) adapted for current/turbidity and sauger rather than stillwater walleye -- a real species/environment variant, not a duplicate.

**Externally supported fields (1):**
- `works_when`: [official_guidance] Minnesota Profile: Sauger (Sander canadensis) -- "DNR (MCV): "Saugers' eyesight helps them thrive in deeper and murkier haunts"; sauger "inhabit mainly large rivers... and tailwater areas below dams where curre..."

**Derived fields, with derivation shown (8):**
- `applies_when.water_environment`: DNR (MCV) directly names "large rivers... and tailwater areas below dams" as primary sauger habitat -- water_environment=[river] is directly supported by the same citation already used for works_when.
- `applies_when.platform`: Deep river channel holes and tailwaters are reachable by boat, and bank-accessible tailwater areas below dams are also a real, DNR-implied shore-fishing location; platform=[boat, shore] follows from the same tailwater-habitat citation already used for works_when.
- `applies_when.season.biological_stage`: DNR frames deep/turbid river-hole habitat use as a general (not season-specific) sauger preference; the FALL-SPECIFIC staging timing itself is a practitioner extension not directly DNR-stated -- flagged as partial support, not a verbatim seasonal citation.
- `applies_when.structure`: DNR describes tailwater/current-concentrated-prey habitat; Haxton et al. independently studies channel/current habitat use in a real river -- structure=[channel_edge, current_seam] is consistent with both citations, though neither names these exact labels verbatim.
- `applies_when.current`: DNR explicitly names "current concentrates prey" as part of sauger's preferred tailwater habitat; current=moderate follows directly from the same habitat citation already used for works_when.
- `equipment.line_test_lb`: This tactic's stated line-test range (8-12lb) falls within the standard convention for a medium rod (8-15lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.5-1.5oz) is reasonably consistent with the standard convention for a medium rod (0.5-1oz) per the Norrik chart.
- `fails_when`: Direct converse of the DNR-documented deep/murky/current habitat preference: absent those conditions, sauger are not concentrated the same way in a deep turbid hole.

**REMAINING UNSUPPORTED FIELDS (3) -- not buried, listed first-class:**
- `applies_when.season.water_temp_f` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `retrieve.pause_seconds` [obligation B]

**Questions requiring expert judgment:**
- [applies_when.season.water_temp_f] Is the stated water-temperature range (40-55F) realistic, or would you narrow/widen/shift it?
- [applies_when.depth_ft] Is the stated depth range (10-25ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [overall] Is the "slip-sinker-livebait-rig" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (2 of 15 scenarios where this tactic was ranked or cautioned):**
- "5. River, catfish-style rising water applied to sauger": ranked #2 of 3, score 0.244
- "10. Boat, sauger, fall turbid river channel edge": ranked #1 of 3, score 0.732

---

## t11 -- Small perch-imitating crankbait (shallow-crankbait)
**Tactic ID:** `d53bb3bc-e72f-4aed-8432-c11e7c58339d`  |  **Presentation ID:** `2b3f2314-09c6-486d-bac7-c737ca992627`  |  **Confidence:** `expert_synthesis`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** shore, wading  |  **Water environment:** natural_lake, reservoir_flowage  |  **Environment applicability:** {"shore":"primary","dock":"not_applicable","wading":"primary","boat":"not_applicable","kayak":"not_applicable","canoe":"not_applicable","ice":"not_applicable"}
**Seasonal stage:** post_spawn  |  **Calendar range:** 05-15 to 06-10  |  **Water temp:** 55-65F (general)
**Depth:** 2-6ft (general)  |  **Structure:** point  |  **Cover:** (unconstrained)  |  **Current:** (unconstrained)  |  **Clarity:** stained

**Bait composition:** artificial_only (artificial_lure)  |  **Methods:** casting
**Equipment:** medium_light power, fast action, spinning reel, line 6-10lb (general), lure 0.1875-0.3125oz (general), no leader
**Retrieve:** moderate, "steady fan-casts along the bank", pause 0-0s (general), depth control: shallow-running crank, count down briefly then reel
**Rigging:** Small shallow-running crankbait fan-cast from shore/wading along a stained-water point, no bait needed.
**Casting access required:** open

**Works when:** Post-spawn, low light, shore-accessible points in stained water where an artificial-only, bait-free approach is fully viable.
**Fails when:** Bright midday light or very clear water where a shallow crank is too visible for a wary post-spawn fish.
**Diagnostic signals:** No follows/strikes after several fan-cast passes -- try a slower retrieve before changing lures.
**Bite detection:** A solid thump, rod loads on its own.  |  **Hookset/fight:** Let the moving lure set the hook.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- NONE recorded -- see relationship-graph.md for gap status.

**Externally supported fields (0):**

**Derived fields, with derivation shown (7):**
- `applies_when.water_environment`: The DNR shallow-feeding fact is general walleye biology applicable to lake/reservoir shoreline settings; water_environment=[natural_lake, reservoir_flowage] is consistent with the shore-point setting already established.
- `applies_when.platform`: A shallow (2-6ft) shore point is directly reachable by wading or shore-casting; platform=[shore, wading] follows from the same shallow-shoreline depth already cited.
- `applies_when.structure`: Shallow shore points are exactly the shoreline structure type DNR's shallow-feeding fact describes; structure=[point] follows from the same shallow-shoreline premise, though DNR does not name "point" verbatim.
- `equipment.line_test_lb`: This tactic's stated line-test range (6-10lb) falls within the standard convention for a medium_light rod (6-10lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.1875-0.3125oz) is reasonably consistent with the standard convention for a medium_light rod (0.25-0.5oz) per the Norrik chart.
- `works_when`: Combines DNR's dawn/dusk shallow-feeding fact and its turbidity-tolerance fact to support a low-light, stained-water, shallow-point pattern; the POST-SPAWN timing specifically and the artificial-only crankbait choice are practitioner extensions, not themselves DNR-stated.
- `casting_access_required`: An open shore point (no dock/vegetation obstruction stated) allows a full fan-cast arc; casting_access_required=open is a physical/access inference from the open-point setting already established, consistent with this tactic's own rigging description ("fan-cast").

**REMAINING UNSUPPORTED FIELDS (5) -- not buried, listed first-class:**
- `applies_when.season.biological_stage` [obligation A]
- `applies_when.season.water_temp_f` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `retrieve.pause_seconds` [obligation B]
- `fails_when` [obligation A]

**Questions requiring expert judgment:**
- [applies_when.season.biological_stage] Does the stated biological stage match when you'd actually use this on the water, or does it run earlier/later/differently than stated?
- [applies_when.season.water_temp_f] Is the stated water-temperature range (55-65F) realistic, or would you narrow/widen/shift it?
- [applies_when.depth_ft] Is the stated depth range (2-6ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [fails_when] What actually causes this tactic to fail in your experience -- does the stated fails_when match, or is there a different, more common failure mode?
- [overall] Is the "shallow-crankbait" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (3 of 15 scenarios where this tactic was ranked or cautioned):**
- "1. Shore, walleye, after a MN cold front (water temp unknown, no live bait)": ranked #1 of 1, score 0.000
- "9. Shore, walleye, spring shallow sand flat, live bait allowed": ranked #4 of 7, score 0.067
- "13. Wading, walleye/sauger, river pre-spawn current seam": ranked #3 of 3, score 0.061

---

## t12 -- Minnow-head jig, near-motionless (jig-minnow-head-deadstick)
**Tactic ID:** `05fdea7e-9601-426a-8a03-84ec0d590ede`  |  **Presentation ID:** `e3f78e66-bd44-4173-a4e1-f9e97ed365d2`  |  **Confidence:** `peer_review_supported`  |  **Readiness:** `research_incomplete`
**Target species:** Sauger (primary)
**Platform:** ice  |  **Water environment:** natural_lake, tributary  |  **Environment applicability:** {"shore":"not_applicable","dock":"not_applicable","wading":"not_applicable","boat":"not_applicable","kayak":"not_applicable","canoe":"not_applicable","ice":"primary"}
**Seasonal stage:** early_ice  |  **Calendar range:** 12-05 to 12-25  |  **Water temp:** 33-38F (general)
**Depth:** 12-22ft (general)  |  **Structure:** basin  |  **Cover:** (unconstrained)  |  **Current:** (unconstrained)  |  **Clarity:** stained

**Bait composition:** hybrid_bait_and_artificial (artificial_lure, live_minnow)  |  **Methods:** jigging
**Equipment:** light power, moderate action, spinning reel, line 5-7lb (general), lure 0.0625-0.125oz (general), no leader
**Retrieve:** very_slow, "occasional small lift, mostly still", pause 8-20s (general), depth control: held just off bottom near a river-mouth basin
**Rigging:** Small minnow-head jig fished nearly still near a river-mouth basin under early ice.
**Casting access required:** not specified

**Works when:** Early ice, sauger holding in stained basin areas near a river/tributary inlet.
**Fails when:** Once fish scatter to open-basin suspension later in winter -- reassess location, not just presentation.
**Diagnostic signals:** No marks on electronics near the river mouth -- try progressively further into the basin.
**Bite detection:** A very subtle tap, easy to miss.  |  **Hookset/fight:** Gentle deliberate lift.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- **alternative** -> t5 (jig-minnow-head-deadstick): Same presentation family as the walleye deadstick tactic, adapted to sauger and an early-ice river-mouth location.

**Externally supported fields (1):**
- `applies_when.season.water_temp_f`: [expert_synthesis] A Look Under the Ice: Winter Lake Ecology -- "Basic winter limnology (NOT sauger-specific -- cited only for the physical water-temperature fact): under ice, the water column is capped at "4 degrees Celsius ..."

**Derived fields, with derivation shown (5):**
- `applies_when.water_environment`: DNR (MCV) directly names sauger concentrating "near river/tributary mouths"; water_environment=[natural_lake, tributary] follows from the same habitat citation already used for works_when.
- `applies_when.platform`: DNR itself frames this as ice fishing ("Lake of the Woods is noted as one of the better places in Minnesota to catch saugers through the ice"); platform=[ice] follows directly from the same citation already used for works_when.
- `equipment.line_test_lb`: This tactic's stated line-test range (5-7lb) falls within the standard convention for a light rod (4-8lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.0625-0.125oz) is reasonably consistent with the standard convention for a light rod (0.0625-0.25oz) per the Norrik chart.
- `works_when`: saugerRiverMouth (Minnesota DNR) and haxtonCoexist (peer-reviewed, genuinely different organization) both support sauger's real affinity for river-influenced, turbidity-driven habitat; the EARLY-ICE-SPECIFIC timing and the deadstick presentation choice remain practitioner extensions neither source states directly -- partial, not full, corroboration.

**REMAINING UNSUPPORTED FIELDS (5) -- not buried, listed first-class:**
- `applies_when.season.biological_stage` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `applies_when.structure` [obligation A]
- `retrieve.pause_seconds` [obligation B]
- `fails_when` [obligation A]

**Questions requiring expert judgment:**
- [applies_when.season.biological_stage] Does the stated biological stage match when you'd actually use this on the water, or does it run earlier/later/differently than stated?
- [applies_when.depth_ft] Is the stated depth range (12-22ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [applies_when.structure] Is the stated structure set the right one, or is a different structure type more reliable for this pattern?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [fails_when] What actually causes this tactic to fail in your experience -- does the stated fails_when match, or is there a different, more common failure mode?
- [overall] Is the "jig-minnow-head-deadstick" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (1 of 15 scenarios where this tactic was ranked or cautioned):**
- "14. Ice, sauger, early ice near a river mouth": ranked #1 of 1, score 0.488

---

## t13 -- Slip bobber with live bait (slip-bobber-livebait)
**Tactic ID:** `fddb2788-5c71-4e8c-98de-36a0fd988345`  |  **Presentation ID:** `10ad1852-f1a4-4dcd-8600-3d03e9b4b1b8`  |  **Confidence:** `expert_synthesis`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** dock  |  **Water environment:** natural_lake  |  **Environment applicability:** {"shore":"viable","dock":"primary","wading":"not_applicable","boat":"not_applicable","kayak":"not_applicable","canoe":"not_applicable","ice":"not_applicable"}
**Seasonal stage:** early_summer  |  **Calendar range:** (unconstrained)  |  **Water temp:** 60-70F (general)
**Depth:** 4-10ft (general)  |  **Structure:** (unconstrained)  |  **Cover:** docks  |  **Current:** (unconstrained)  |  **Clarity:** stained

**Bait composition:** live_bait_only (live_minnow, live_leech)  |  **Methods:** still_fishing
**Equipment:** light power, moderate action, spinning reel, line 6-8lb (general), lure 0.0625-0.125oz (general), no leader, hook: #4-#6
**Retrieve:** dead_still, "suspended", pause 0-0s (general), depth control: set shallower than the clear-water version -- stained water needs less depth to stay hidden
**Rigging:** Same slip-bobber livebait rig as the clear-water dock tactic, set shallower since stained water already reduces visibility to fish.
**Casting access required:** limited

**Works when:** Stained water reduces the low-light requirement of the clear-water version -- viable across more of the day.
**Fails when:** Turbid water where visual bobber-fishing gives way to a bait presentation that does not depend on fish sighting it.
**Diagnostic signals:** No action across several hours at varying depths -- the dock itself may simply not have fish nearby today.
**Bite detection:** The bobber goes under.  |  **Hookset/fight:** Wait for full submersion, then a firm sweep-set.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- **alternative** -> t7 (slip-bobber-livebait): Same platform/presentation family as the clear-water dock tactic, varied by clarity condition -- not a duplicate, a real condition-driven variant.

**Externally supported fields (0):**

**Derived fields, with derivation shown (6):**
- `applies_when.water_environment`: A dock is a lake/reservoir-specific structure by definition; water_environment=[natural_lake] follows from the presentation itself, the same logic already applied on t7.
- `applies_when.platform`: A dock is, by definition, fished from the dock itself or adjacent shore; platform=[dock, shore] follows directly from the presentation's own structural premise, as on t7.
- `equipment.line_test_lb`: This tactic's stated line-test range (6-8lb) falls within the standard convention for a light rod (4-8lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.0625-0.125oz) is reasonably consistent with the standard convention for a light rod (0.0625-0.25oz) per the Norrik chart.
- `works_when`: Directly extends the same DNR turbidity fact already cited on t9/t3/t11 to this stained-water dock variant of t7 -- stained water reduces the daylight brightness that otherwise confines t7 to dawn/dusk.
- `casting_access_required`: A fixed dock structure inherently constrains casting angles regardless of water clarity; casting_access_required=limited follows the same physical/structural reasoning already established on t7.

**REMAINING UNSUPPORTED FIELDS (6) -- not buried, listed first-class:**
- `applies_when.season.biological_stage` [obligation A]
- `applies_when.season.water_temp_f` [obligation A]
- `applies_when.depth_ft` [obligation A]
- `applies_when.cover` [obligation A]
- `retrieve.pause_seconds` [obligation B]
- `fails_when` [obligation A]

**Questions requiring expert judgment:**
- [applies_when.season.biological_stage] Does the stated biological stage match when you'd actually use this on the water, or does it run earlier/later/differently than stated?
- [applies_when.season.water_temp_f] Is the stated water-temperature range (60-70F) realistic, or would you narrow/widen/shift it?
- [applies_when.depth_ft] Is the stated depth range (4-10ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [applies_when.cover] Is the stated cover accurate, or does something else (that this record misses) matter more?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [fails_when] What actually causes this tactic to fail in your experience -- does the stated fails_when match, or is there a different, more common failure mode?
- [overall] Is the "slip-bobber-livebait" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (2 of 15 scenarios where this tactic was ranked or cautioned):**
- "8. Dock, walleye, early summer low light near a drop-off": ranked #2 of 3, score 0.183
- "9. Shore, walleye, spring shallow sand flat, live bait allowed": ranked #5 of 7, score 0.061

---

## t14 -- Slip-sinker (Lindy-style) live-bait rig (slip-sinker-livebait-rig)
**Tactic ID:** `b6bdca41-1d65-46b6-aca4-42178042877a`  |  **Presentation ID:** `9e0cb3fa-0e0b-4d25-8e65-7b123fa64a88`  |  **Confidence:** `expert_synthesis`  |  **Readiness:** `research_incomplete`
**Target species:** Sauger (primary), Walleye
**Platform:** boat, shore  |  **Water environment:** river  |  **Environment applicability:** {"shore":"viable","dock":"not_applicable","wading":"not_applicable","boat":"primary","kayak":"not_applicable","canoe":"not_applicable","ice":"not_applicable"}
**Seasonal stage:** (unconstrained)  |  **Calendar range:** (unconstrained)  |  **Water temp:** (unconstrained)
**Depth:** 6-15ft (general)  |  **Structure:** channel_edge  |  **Cover:** (unconstrained)  |  **Current:** strong  |  **Clarity:** turbid

**Bait composition:** live_bait_only (live_minnow)  |  **Methods:** still_fishing
**Equipment:** medium_heavy power, moderate action, either reel, line 12-17lb (general), lure 1-2oz (general), leader: fluorocarbon 18-24in, hook: 2/0-3/0
**Retrieve:** dead_still, "heavy enough weight to hold in strong current, otherwise still", pause 10-20s (general), depth control: anchor position on the slower inside edge of the current seam
**Rigging:** Heavier slip-sinker rig baited with a minnow, scaled up for strong post-rain current, fished on the slower inside edge of a channel seam.
**Casting access required:** not specified

**Works when:** Rising, turbid water after heavy rain, fish pushed to current-breaks on channel edges rather than the main flow.
**Fails when:** Once the river stabilizes/clears, this scaled-up heavy rig becomes unnecessarily coarse -- downsize toward tactic 6 or 10 instead.
**Diagnostic signals:** Constant snagging/no bites in the main current -- the fish are very unlikely to be fighting the strongest flow; move to a slower inside seam.
**Bite detection:** Distinct pull against the already-loaded rod tip, distinct from current surge.  |  **Hookset/fight:** Firm set given the heavier terminal tackle; expect a harder-pulling fight in current.
**Conservation notes:** (none recorded)

**Alternatives/next_try:**
- **alternative** -> t6 (jig-minnow): Same species pairing and river environment as t6, scaled up specifically for high-water/heavy-current conditions rather than normal pre-spawn flow.
- **alternative** -> t10 (slip-sinker-livebait-rig): Related sauger river tactic at normal flow; this is the elevated-water variant.

**Externally supported fields (0):**

**Derived fields, with derivation shown (8):**
- `applies_when.water_environment`: The cited source is specifically about RIVER walleye tactics during rain; water_environment=[river] follows directly from the same citation already used for works_when.
- `applies_when.platform`: River current-seam fishing during high water is reachable by boat, and bank-accessible where the channel edge nears shore; platform=[boat, shore] follows from the same river-tactic citation already used for works_when.
- `applies_when.structure`: The source names "current seams" and "softer water adjacent to current" -- structure=[channel_edge] is consistent with, though not a verbatim match for, this description.
- `applies_when.current`: The source explicitly frames this as a strong-current river scenario (contrasting "the current itself" with adjacent slower water); current=strong follows directly from the same citation.
- `equipment.line_test_lb`: This tactic's stated line-test range (12-17lb) falls within the standard convention for a medium_heavy rod (15-30lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (1-2oz) is reasonably consistent with the standard convention for a medium_heavy rod (1-4oz) per the Norrik chart.
- `works_when`: A real, independent, established angling publication directly addresses rising/post-rain river conditions and current-seam positioning -- the exact scenario this tactic covers, not a stretched biology fact. Single source (anecdotal-tier, not peer-reviewed or agency-official), so this remains below official_guidance/independently_corroborated, but it is real, on-topic, and no longer entirely ungrounded.
- `fails_when`: The same source frames the current-break behavior as a rain/turbidity-driven response; once conditions stabilize/clear, the behavioral driver the source describes no longer applies -- inferred converse, not separately stated.

**REMAINING UNSUPPORTED FIELDS (2) -- not buried, listed first-class:**
- `applies_when.depth_ft` [obligation A]
- `retrieve.pause_seconds` [obligation B]

**Questions requiring expert judgment:**
- [applies_when.depth_ft] Is the stated depth range (6-15ft) realistic for this presentation/season on typical MN/WI water, or should it change?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [overall] Is the "slip-sinker-livebait-rig" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (6 of 15 scenarios where this tactic was ranked or cautioned):**
- "2. Boat, smallmouth-style clear-lake summer conditions applied to walleye (72F, calm, bright, clear)": ranked #7 of 7, score 0.000
- "5. River, catfish-style rising water applied to sauger": ranked #1 of 3, score 0.305
- "6. Boat, walleye, exact match for the mid-summer deep-structure tactic": ranked #7 of 7, score 0.027
- "9. Shore, walleye, spring shallow sand flat, live bait allowed": ranked #6 of 7, score 0.047
- "10. Boat, sauger, fall turbid river channel edge": ranked #3 of 3, score 0.183
- "15. No platform observed at all, walleye, only species known (tests all-missing behavior)": ranked #7 of 7, score 0.000

---

## t15 -- Minnow-head jig, near-motionless (jig-minnow-head-deadstick)
**Tactic ID:** `6538afd6-94a9-4155-a93d-4f2d3c4bb8ec`  |  **Presentation ID:** `e3f78e66-bd44-4173-a4e1-f9e97ed365d2`  |  **Confidence:** `official_guidance`  |  **Readiness:** `research_incomplete`
**Target species:** Walleye (primary)
**Platform:** ice  |  **Water environment:** natural_lake  |  **Environment applicability:** {"shore":"not_applicable","dock":"not_applicable","wading":"not_applicable","boat":"not_applicable","kayak":"not_applicable","canoe":"not_applicable","ice":"primary"}
**Seasonal stage:** late_ice  |  **Calendar range:** 02-15 to 03-15  |  **Water temp:** 33-36F (general)
**Depth:** 18-28ft (general)  |  **Structure:** basin  |  **Cover:** (unconstrained)  |  **Current:** (unconstrained)  |  **Clarity:** (unconstrained)

**Bait composition:** live_bait_only (live_minnow)  |  **Methods:** jigging
**Equipment:** ultralight power, slow action, spinning reel, line 3-5lb (general), lure 0.03125-0.0625oz (general), no leader
**Retrieve:** dead_still, "as close to no movement as possible", pause 20-60s (general), depth control: held precisely at the fish-marked depth
**Rigging:** The smallest practical live-bait presentation, fished essentially motionless -- late-ice, post-front, suspected low-oxygen conditions call for minimizing everything that could spook an already-stressed, sluggish fish.
**Casting access required:** not specified

**Works when:** Late ice, immediately after a front has passed, in a deep basin area where low dissolved oxygen is a documented seasonal risk (long ice cover + snow load) -- fish are sluggish and easily put off by movement or noise.
**Fails when:** Once oxygen conditions genuinely recover (typically post-turnover after ice-out) or on a stable-weather day where fish are actively feeding -- this presentation is unnecessarily passive for active fish.
**Diagnostic signals:** Marks on electronics that will not commit even to this presentation may indicate the DO-stress read is correct and the bite window is simply very short -- minimize noise/hole-hopping rather than changing presentation further.
**Bite detection:** Extremely subtle -- watch for the faintest line movement, do not rely on feel.  |  **Hookset/fight:** A very gentle, deliberate lift -- an aggressive set is likely to miss or pull free from a barely-committed bite.
**Conservation notes:** Fish in a genuinely low-oxygen late-ice scenario are under real physiological stress; minimize air exposure and handling time on any catch.

**Alternatives/next_try:**
- **alternative** -> t5 (jig-minnow-head-deadstick): Same deadstick presentation family as t5, taken further (even less movement, smaller profile) for the specific late-ice/post-front/low-DO-suspected combination.

**Externally supported fields (2):**
- `applies_when.season.water_temp_f`: [expert_synthesis] A Look Under the Ice: Winter Lake Ecology -- "Basic winter limnology (NOT walleye-specific): under ice, the water column is capped at "4 degrees Celsius (39.2 degrees Fahrenheit), the temperature at which w..."
- `works_when`: [official_guidance] Fish kills | Minnesota DNR -- "DNR: "When snow and ice cover a lake, they limit the sunlight reaching aquatic plants. The plants cut back on the amount of oxygen they produce. If vegetation d..."

**Derived fields, with derivation shown (8):**
- `applies_when.water_environment`: DNR's winterkill discussion is specifically about lakes; water_environment=[natural_lake] follows directly from the same source already cited.
- `applies_when.platform`: DNR's winterkill discussion concerns ice-covered lakes specifically (late ice season); platform=[ice] follows directly from the same seasonal context already cited.
- `applies_when.depth_ft`: DNR's winterkill mechanism concerns whole-lake oxygen depletion, strongest in shallow lakes; this tactic targets a DEEP basin specifically because deeper water is where oxygen-stressed fish would be expected to hold if better-oxygenated water remains there -- an inference from the same DO-depletion mechanism, not itself a DNR-stated depth figure.
- `applies_when.structure`: DNR notes winterkill risk is worse in shallow lakes, implying deeper basins retain relatively better oxygen late in winter -- structure=[basin] is consistent with that same inference, not itself DNR-stated as a fishing-structure recommendation.
- `equipment.line_test_lb`: This tactic's stated line-test range (3-5lb) falls within the standard convention for a ultralight rod (1-6lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.
- `equipment.lure_weight_oz`: This tactic's stated lure-weight range (0.03125-0.0625oz) is reasonably consistent with the standard convention for a ultralight rod (0.0156-0.0625oz) per the Norrik chart.
- `fails_when`: Once the DNR-documented DO-depletion mechanism no longer applies (post-turnover, oxygen re-mixed), the low-oxygen-driven sluggish-fish premise this tactic relies on no longer holds -- inferred converse of the same cited mechanism.
- `conservation_notes`: DNR's winterkill mechanism directly establishes that late-ice, low-oxygen conditions represent real physiological stress on the fish population -- minimizing air exposure/handling time on any catch follows directly from the same DO-stress mechanism already cited for works_when, standard practice for stressed fish.

**REMAINING UNSUPPORTED FIELDS (2) -- not buried, listed first-class:**
- `applies_when.season.biological_stage` [obligation A]
- `retrieve.pause_seconds` [obligation B]

**Questions requiring expert judgment:**
- [applies_when.season.biological_stage] Does the stated biological stage match when you'd actually use this on the water, or does it run earlier/later/differently than stated?
- [retrieve.pause_seconds] What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.
- [overall] Is the "jig-minnow-head-deadstick" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?

**Relevant scenario results (2 of 15 scenarios where this tactic was ranked or cautioned):**
- "4. Ice, crappie-style low-oxygen midwinter conditions applied to walleye": ranked #3 of 3, score 0.159
- "7. Ice, walleye, midwinter clear/deep -- the GENUINE conflict scenario (aggressive spoon vs. deadstick)": ranked #3 of 3, score 0.159

---
