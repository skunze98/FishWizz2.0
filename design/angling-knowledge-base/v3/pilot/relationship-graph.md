# Relationship graph -- all 15 tactics (gate-7 instruction 4)
Generated 2026-08-29T16:59:27.894Z. No relationship added to pilot-data.json by this script -- candidates below are SUGGESTIONS for a future, separately-approved pass, not applied changes.

## Full graph (outgoing edges)
| tactic | -> | relationship | note (truncated) |
|---|---|---|---|
| t1 (jig-minnow) | -- | **NONE** | (no outgoing relationship) |
| t2 (slip-sinker-livebait-rig) | -- | **NONE** | (no outgoing relationship) |
| t3 (shallow-crankbait) | t2 (slip-sinker-livebait-rig) | alternative | Genuinely different seasonal pattern (fall shallow vs. summer deep); not a same-conditions... |
| t4 (jigging-spoon-aggressive) | t5 (jig-minnow-head-deadstick) | conflicts_with | DNR's own ice-fishing-walleye page explicitly frames aggressive jigging-spoon action and a... |
| t5 (jig-minnow-head-deadstick) | t4 (jigging-spoon-aggressive) | conflicts_with | Same genuine disagreement, other direction -- see t4's note.... |
| t6 (jig-minnow) | -- | **NONE** | (no outgoing relationship) |
| t7 (slip-bobber-livebait) | -- | **NONE** | (no outgoing relationship) |
| t8 (jig-minnow) | -- | **NONE** | (no outgoing relationship) |
| t9 (crawler-harness-troll) | t2 (slip-sinker-livebait-rig) | next_try | FAILURE HYPOTHESIS: this tactic fails when clarity shifts from turbid to clear because its... |
| t10 (slip-sinker-livebait-rig) | t2 (slip-sinker-livebait-rig) | alternative | Same presentation family (slip-sinker) adapted for current/turbidity and sauger rather tha... |
| t11 (shallow-crankbait) | -- | **NONE** | (no outgoing relationship) |
| t12 (jig-minnow-head-deadstick) | t5 (jig-minnow-head-deadstick) | alternative | Same presentation family as the walleye deadstick tactic, adapted to sauger and an early-i... |
| t13 (slip-bobber-livebait) | t7 (slip-bobber-livebait) | alternative | Same platform/presentation family as the clear-water dock tactic, varied by clarity condit... |
| t14 (slip-sinker-livebait-rig) | t6 (jig-minnow) | alternative | Same species pairing and river environment as t6, scaled up specifically for high-water/he... |
| t14 (slip-sinker-livebait-rig) | t10 (slip-sinker-livebait-rig) | alternative | Related sauger river tactic at normal flow; this is the elevated-water variant.... |
| t15 (jig-minnow-head-deadstick) | t5 (jig-minnow-head-deadstick) | alternative | Same deadstick presentation family as t5, taken further (even less movement, smaller profi... |

## Coverage summary
- Has a validated next_try: 1/15 (t9 only)
- Has an alternative/conflicts_with but no next_try: 8/15
- Has NO outgoing relationship at all: 6/15

## Gap analysis for tactics with NO outgoing relationship -- real candidate search, not invention

### t1 (jig-minnow) -- fails_when: "Once water warms past the spring window and fish disperse to deeper structure -- see the summer slip-sinker tactic instead."
2 structural candidate(s) found (still need a human-authored failure-hypothesis note before formalizing as next_try, per instruction 4's "do not create relationships solely to satisfy a count"):
- t3 (shallow-crankbait) -- structurally compatible; a next_try relationship would still need: what characteristic of t1 is believed to be failing, and why t3 specifically responds to that (not just "closest match").
- t11 (shallow-crankbait) -- structurally compatible; a next_try relationship would still need: what characteristic of t1 is believed to be failing, and why t11 specifically responds to that (not just "closest match").

### t2 (slip-sinker-livebait-rig) -- fails_when: "Cold water or real current -- too subtle/slow to hold position or register a bite."
1 structural candidate(s) found (still need a human-authored failure-hypothesis note before formalizing as next_try, per instruction 4's "do not create relationships solely to satisfy a count"):
- t9 (crawler-harness-troll) -- structurally compatible; a next_try relationship would still need: what characteristic of t2 is believed to be failing, and why t9 specifically responds to that (not just "closest match").

### t6 (jig-minnow) -- fails_when: "Once fish move onto true spawning gravel (different, more localized behavior) or in dead-still water with no seam to define."
1 structural candidate(s) found (still need a human-authored failure-hypothesis note before formalizing as next_try, per instruction 4's "do not create relationships solely to satisfy a count"):
- t14 (slip-sinker-livebait-rig) -- structurally compatible; a next_try relationship would still need: what characteristic of t6 is believed to be failing, and why t14 specifically responds to that (not just "closest match").

### t7 (slip-bobber-livebait) -- fails_when: "Bright midday light with fish holding deeper off the drop-off, out of easy dock-casting range."
1 structural candidate(s) found (still need a human-authored failure-hypothesis note before formalizing as next_try, per instruction 4's "do not create relationships solely to satisfy a count"):
- t11 (shallow-crankbait) -- structurally compatible; a next_try relationship would still need: what characteristic of t7 is believed to be failing, and why t11 specifically responds to that (not just "closest match").

### t8 (jig-minnow) -- fails_when: "Windy/chop conditions where a kayak/canoe becomes difficult to control and hold position on structure -- see the standalone safety-layer note: this tactic record does NOT itself set a wind safety threshold (see design/angling-knowledge-base/v3/safety/README.md)."
**no_valid_alternative** -- no other tactic in this 15-tactic pilot passes the structural criteria (species/platform/water_environment/depth/temp compatibility + a genuinely different presentation). A real substitute may not exist in this pilot's current scope; adding one would require a NEW tactic, which this pass does not authorize.

### t11 (shallow-crankbait) -- fails_when: "Bright midday light or very clear water where a shallow crank is too visible for a wary post-spawn fish."
2 structural candidate(s) found (still need a human-authored failure-hypothesis note before formalizing as next_try, per instruction 4's "do not create relationships solely to satisfy a count"):
- t1 (jig-minnow) -- structurally compatible; a next_try relationship would still need: what characteristic of t11 is believed to be failing, and why t1 specifically responds to that (not just "closest match").
- t7 (slip-bobber-livebait) -- structurally compatible; a next_try relationship would still need: what characteristic of t11 is believed to be failing, and why t7 specifically responds to that (not just "closest match").

## Incoming-edge check (is every tactic reachable as SOMEONE's alternative, even if it has no outgoing edge?)
- t1: NOT referenced by any other tactic -- fully isolated in the relationship graph
- t2: referenced BY t3, t9, t10
- t6: referenced BY t14
- t7: referenced BY t13
- t8: NOT referenced by any other tactic -- fully isolated in the relationship graph
- t11: NOT referenced by any other tactic -- fully isolated in the relationship graph