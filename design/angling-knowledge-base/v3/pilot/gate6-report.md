# Gate-6 report: fishing-research pass across all 15 tactics (obligation-aware A/B/C)
Generated 2026-08-29T16:44:36.978Z. Schema frozen at commit 3c60444 -- no schema files changed this pass. All numbers computed from the live pilot-data.json.

> **Gate-7 correction (2026-08-29):** the word "permanently" below, describing t8's
> `blocked_by_safety_gap` status, was imprecise and is retracted. The block is pending a real
> paddle-sport/cold-water safety review (see `reviewer-package-safety.md`), not a permanent or
> unresolvable state. This note is a correction, not a rewrite -- the rest of this file is left
> as originally generated.

## 1. Readiness matrix -- all 15 tactics
| tactic | presentation | confidence | readiness | remaining blocker(s) |
|---|---|---|---|---|
| t1 | jig-minnow | independently_corroborated | **research_incomplete** | 1 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.current. |
| t2 | slip-sinker-livebait-rig | official_guidance | **research_incomplete** | 2 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.water_temp_f, retrieve.pause_seconds. |
| t3 | shallow-crankbait | peer_review_supported | **research_incomplete** | 3 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.water_temp_f, applies_when.depth_ft, retrieve.pause_seconds. |
| t4 | jigging-spoon-aggressive | official_guidance | **research_incomplete** | 4 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.biological_stage, applies_when.depth_ft, retrieve.pause_seconds, fails_when. |
| t5 | jig-minnow-head-deadstick | official_guidance | **research_incomplete** | 4 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.biological_stage, applies_when.depth_ft, retrieve.pause_seconds, fails_when. |
| t6 | jig-minnow | peer_review_supported | **research_incomplete** | 2 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.depth_ft, fails_when. |
| t7 | slip-bobber-livebait | expert_synthesis | **research_incomplete** | 6 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.biological_stage, applies_when.season.water_temp_f, applies_when.depth_ft, applies_when.structure, applies_when.cover, retrieve.pause_seconds. |
| t8 | jig-minnow | expert_synthesis | **blocked_by_safety_gap** | Kayak/canoe is a primary platform for this tactic, and no safety_advisory data exists yet to confirm or rule out conditions where it is unsafe (see safety/README.md) -- blocked regardless of technique-evidence completeness. |
| t9 | crawler-harness-troll | peer_review_supported | **research_incomplete** | 4 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.biological_stage, applies_when.season.water_temp_f, applies_when.depth_ft, retrieve.pause_seconds. |
| t10 | slip-sinker-livebait-rig | peer_review_supported | **research_incomplete** | 3 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.water_temp_f, applies_when.depth_ft, retrieve.pause_seconds. |
| t11 | shallow-crankbait | expert_synthesis | **research_incomplete** | 5 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.biological_stage, applies_when.season.water_temp_f, applies_when.depth_ft, retrieve.pause_seconds, fails_when. |
| t12 | jig-minnow-head-deadstick | peer_review_supported | **research_incomplete** | 5 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.biological_stage, applies_when.depth_ft, applies_when.structure, retrieve.pause_seconds, fails_when. |
| t13 | slip-bobber-livebait | expert_synthesis | **research_incomplete** | 6 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.biological_stage, applies_when.season.water_temp_f, applies_when.depth_ft, applies_when.cover, retrieve.pause_seconds, fails_when. |
| t14 | slip-sinker-livebait-rig | expert_synthesis | **research_incomplete** | 2 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.depth_ft, retrieve.pause_seconds. |
| t15 | jig-minnow-head-deadstick | official_guidance | **research_incomplete** | 2 external_evidence_required/traceable_derivation_allowed field(s) still unsupported: applies_when.season.biological_stage, retrieve.pause_seconds. |

Distribution: {"research_incomplete":14,"blocked_by_safety_gap":1}. 0/15 ready_for_human_review -- t8 is permanently blocked_by_safety_gap (kayak/canoe, no safety_advisory layer exists); the other 14 have real, specific, individually-listed remaining gaps (mostly exact water-temperature/depth numbers and retrieve.pause_seconds, the hardest-to-source fields in the whole pilot).

## 2. Coverage by evidence-obligation category
- A (external_evidence_required): 72/116 (62%) -- up from 19% at the start of this pass.
- B (traceable_derivation_allowed): 49/63 (78%) -- up from 0% at the start of this pass (the equipmentDerivation() mechanism alone resolved line_test_lb/lure_weight_oz for all 15 tactics).
- C (intrinsic_definition): 15/15 tactics pass consistency validation (100%) -- a pass/fail check, never a citation count.

**Never blended into one overall percentage**, per instruction 1.

## 3. Source-independence matrix
| source | organization | type |
|---|---|---|
| How to catch a walleye | Minnesota DNR | official_guidance |
| Ice fishing for walleye | Minnesota DNR | official_guidance |
| DNR keeps three-walleye limit for 2026 open water season on  | Minnesota DNR | official_guidance |
| Walleye biology and identification | Minnesota DNR | official_guidance |
| Minnesota Profile: Sauger (Sander canadensis) | Minnesota DNR | official_guidance |
| Barotrauma | Minnesota DNR | official_guidance |
| Walleye (Sander vitreus) | U.S. Fish and Wildlife Service | official_guidance |
| Interaction of sauger Sander canadensis and walleye Sander v | Journal of Fish Biology (Wiley) | peer_review_supported |
| You can't just use gold: Elevated turbidity alters successfu | Journal of Great Lakes Research (Elsevier) | peer_review_supported |
| Lake turbidity mitigates impact of warming on walleyes in up | Pennsylvania State University | peer_review_supported |
| Fishing Rod Lure Weight and Line Test Chart | Norrik | manufacturer_guidance |
| Cross-publication convergent finding on jig lift-and-pause c | FishUSA | anecdotal |
| Walleye | Fishes of Wisconsin | Wisconsin DNR | official_guidance |
| A Look Under the Ice: Winter Lake Ecology | Ausable River Association / Adirondack Watershed Institute | expert_synthesis |
| How to Fish for Walleye in the Rain: Tactics and Gear | WindRider | anecdotal |
| Fish kills | Minnesota DNR | Minnesota DNR | official_guidance |

Distinct organizations represented: 10 (Minnesota DNR, U.S. Fish and Wildlife Service, Journal of Fish Biology (Wiley), Journal of Great Lakes Research (Elsevier), Pennsylvania State University, Norrik, FishUSA, Wisconsin DNR, Ausable River Association / Adirondack Watershed Institute, WindRider).

Genuinely independent pairs actually exploited in claims this pass:
- Minnesota DNR <-> Wisconsin DNR
- Minnesota DNR <-> Journal of Great Lakes Research (Elsevier)
- Minnesota DNR <-> Journal of Fish Biology (Wiley)

3 distinct independent-organization pairs actually used (up from 2 at the start of this pass) -- MN DNR + WI DNR is now the most-used pair (spawn temperature, turbidity behavior), plus MN DNR + Haxton (J. Fish Biology), MN DNR + the lure-color paper (J. Great Lakes Research).

## 4. Exact-value audit
- t1 applies_when.depth_ft: 1-6 -- JUSTIFIED (real covering claim)

**1/1 precision="exact" values are justified; 0 unsupported.** Zero unsupported exact values remain (all "structural zero" retrieve.pause_seconds entries from earlier passes were already corrected to precision="general" before this pass began).

## 5. next_try audit -- every relationship, real re-verification
- crawler-harness-troll -> slip-sinker-livebait-rig: **PASS** all 12 criteria: {"sameSpecies":true,"compatiblePlatform":true,"compatibleWaterEnv":true,"depthOverlap":true,"tempOverlap":true,"presentationDiffers":true,"intensityTierDiffers":true,"environmentApplicabilityOverlap":true,"hasFailureHypothesis":true,"hasResponseRationale":true,"notJustClosestMatch":true,"noteIsSubstantive":true}

Only 1 next_try relationship exists in this 15-tactic pilot (t9->t2); it passes all 12 real structural/textual criteria (species, platform, water_environment, depth/temp overlap, presentation genuinely differs, environment overlap, failure hypothesis stated, response rationale stated, not just "closest match," substantive). No other tactic's `alternatives` array uses relationship_type=next_try (the rest are `alternative`/`conflicts_with`, reviewed in earlier gates, unaffected by this instruction).

## 6. Remaining blockers (honest, not softened)
- **t8 (kayak/canoe finesse)**: permanently blocked_by_safety_gap until a real safety_advisory layer is researched (see safety/README.md) -- no amount of technique research resolves this.
- **fails_when**: unresolved on t4, t5 (DNR frames the conflict but not a specific spoon/deadstick failure trigger beyond "sometimes...sometimes"), t6, t11, t12, t13 -- the WHY of failure remains practitioner inference on these 6 tactics even though works_when is now real-sourced.
- **retrieve.pause_seconds**: still unsupported on most tactics -- the jig_cadence_convergence source only covers STANDARD lift-hop cadence (t1, t6); aggressive (t4), deadstick (t5/t12/t15), dragged (t2/t10/t14), and stillwater-suspended (t7/t13) cadences remain genuinely unresearched.
- **Exact water-temperature/depth numbers**: DNR sources consistently give qualitative ("deep, cool water") rather than exact numeric ranges outside of spawning; most tactics' non-spawning temp/depth ranges remain general estimates, honestly gapped.
- **applies_when.season.biological_stage**: resolved for spawning-related tactics (t1, t6) via direct DNR citations, but NOT resolved for several summer/fall/ice sub-stage tactics (t4, t5, t7, t9, t11-t13, t15) where no fetched source distinguishes early/mid/late sub-stages specifically.
- **Descriptive fields** (bite_detection, hookset_fight, diagnostic_signals, environment_applicability): still 0 claims tracked at all -- explicitly out of scope for readiness/confidence per the taxonomy, but a real, visible gap in the claim MODEL's own coverage, not the content.