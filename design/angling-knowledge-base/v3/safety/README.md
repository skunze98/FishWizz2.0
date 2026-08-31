# Safety-rule layer -- design note only, NOT implemented this pass

Per gate-4 remediation instruction 4: **do not invent a universal kayak/canoe
wind threshold inside a fishing tactic.** Safety depends on craft type, hull/
stability class, waterbody size (open-water fetch on Mille Lacs is not the
same hazard as a sheltered bay), water temperature (cold-water immersion risk
changes everything), wave height (not the same axis as `wind` -- wind speed
and resulting wave height are correlated but not equivalent, and fetch/water
depth also matter), paddler experience/skill, and exposure (distance from
shore, PFD use, solo vs. group). A single tactic record has no business
asserting a number for a question this multidimensional -- doing so would
repeat exactly the kind of invented-precision defect this remediation pass
exists to remove, just relocated from a fishing fact to a safety fact (arguably
worse, since a wrong safety threshold has higher failure-mode severity than a
wrong retrieve cadence).

## What changed this pass

`t8` (the kayak/canoe clear-water finesse tactic) no longer implies a safety
answer it doesn't have. Its `fails_when` field states the qualitative fact
(wind/chop makes small-craft control difficult) without a number, and points
here. No tactic record anywhere in this schema is authorized to be the source
of truth for "is this safe."

## What a real safety layer needs (not built this pass)

1. **A separate `safety_advisory` entity**, independent of `tactic` and
   `presentation`, keyed by `platform` (at minimum kayak/canoe/wading/ice) and
   populated from real sources: US Coast Guard / state boating-safety
   authority small-craft guidance, cold-water-immersion research (e.g.
   National Center for Cold Water Safety), and MN/WI DNR boating-safety pages
   -- none of which have been fetched yet.
2. **Waterbody-size and openness as inputs**, not assumed constant -- the
   same wind speed is a very different hazard on a small sheltered pond than
   on Mille Lacs Lake's open water. This likely needs a link to the real
   `waterbodies` table (`water_type`, surface area if available) rather than
   living inside the angling knowledge base at all.
3. **Water-temperature-dependent cold-immersion guidance** as its own axis,
   separate from the fishing-relevant `season.water_temp_f` condition (a
   72F summer kayak trip and a 38F early-ice-out kayak trip are different
   safety regimes even though both might show identical fishing-relevant
   wind conditions).
4. **A scorer-level rule, not a tactic-level fact**: when a candidate tactic's
   `environment_applicability` includes kayak/canoe as `primary` or `viable`,
   and the observed conditions include `wind: high` (or an future dedicated
   wave-height axis) with no safety_advisory resolving it either way, the
   scorer should return a `caution`/`insufficient_safety_data` result rather
   than a confident ranked recommendation for that candidate. This has now
   been implemented in `scorer.mjs` (`SAFETY_INSUFFICIENT_DATA` result path,
   see its own comments) as an honest placeholder: kayak/canoe candidates
   under `wind: high` are flagged `insufficient_safety_data` and excluded
   from the normal ranked list rather than silently scored and recommended,
   pending the real safety_advisory entity described above.

## Status

Design note only. No `safety_advisory` schema, no migration table, no real
safety research performed this pass. Logged as a remaining gap in the
post-remediation report, not silently deferred.
