# Gate-5 report: confidence semantics fix, decision-critical research, readiness
Generated 2026-08-29T14:52:25.325Z. All numbers computed from the live pilot-data.json.

## 1. Externally-sourced coverage -- decision-critical fields
33/208 (16%) -- 15 externally_sourced, 18 derived_synthesis, 175 unsupported_gap.

## 2. Externally-sourced coverage -- descriptive fields
0/0 (0%). This pilot's claim model does not currently track evidence for descriptive fields at all (bite_detection/hookset_fight/diagnostic_signals/casting_access_required/environment_applicability have zero claim entries) -- 0/0 is an honest reflection of that scope decision, not a hidden gap. Per instruction 6, descriptive-field gaps are explicitly allowed to remain visible and are excluded from ranking/confidence impact (the scorer and confidence computation only ever look at DECISION_CRITICAL_FIELDS).

## 3. Readiness status per tactic
| tactic | presentation | confidence | readiness | reason (truncated) |
|---|---|---|---|---|
| t1 | jig-minnow | official_guidance | **research_incomplete** | 10 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t2 | slip-sinker-livebait-rig | official_guidance | **research_incomplete** | 9 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water_... |
| t3 | shallow-crankbait | peer_review_supported | **research_incomplete** | 11 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t4 | jigging-spoon-aggressive | official_guidance | **research_incomplete** | 12 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t5 | jig-minnow-head-deadstick | official_guidance | **research_incomplete** | 12 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t6 | jig-minnow | peer_review_supported | **research_incomplete** | 13 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t7 | slip-bobber-livebait | expert_synthesis | **research_incomplete** | 13 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t8 | jig-minnow | unsupported | **blocked_by_safety_gap** | Kayak/canoe is a primary platform for this tactic, and no safety_advisory data exists yet to confirm... |
| t9 | crawler-harness-troll | peer_review_supported | **research_incomplete** | 10 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t10 | slip-sinker-livebait-rig | peer_review_supported | **research_incomplete** | 10 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t11 | shallow-crankbait | expert_synthesis | **research_incomplete** | 12 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t12 | jig-minnow-head-deadstick | peer_review_supported | **research_incomplete** | 12 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t13 | slip-bobber-livebait | expert_synthesis | **research_incomplete** | 12 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t14 | slip-sinker-livebait-rig | unsupported | **research_incomplete** | 12 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |
| t15 | jig-minnow-head-deadstick | unsupported | **research_incomplete** | 14 decision-critical field(s) still unsupported this pass: applies_when.platform, applies_when.water... |

Distribution: {"research_incomplete":14,"blocked_by_safety_gap":1}. 0 of 15 are ready_for_human_review this pass -- expected and honest: DECISION_CRITICAL_FIELDS now includes platform/water_environment/season.biological_stage/structure/cover/current/bait_composition/conservation_notes (not just the narrower 6-8 fields tracked before gate 5), and this research pass targeted specific high-value gaps (turbidity/lure-color, sauger/walleye river coexistence, barotrauma) rather than exhaustively covering all ~16 decision-critical fields x 15 tactics. t8 is blocked_by_safety_gap (kayak/canoe primary platform, no safety_advisory layer exists yet) independent of its research completeness.

## 4. Source-independence report
Sources and their organizations:
- **How to catch a walleye** -- organization: "Minnesota DNR" (official_guidance)
- **Ice fishing for walleye** -- organization: "Minnesota DNR" (official_guidance)
- **DNR keeps three-walleye limit for 2026 open water season on Mille Lacs Lake** -- organization: "Minnesota DNR" (official_guidance)
- **Walleye biology and identification** -- organization: "Minnesota DNR" (official_guidance)
- **Minnesota Profile: Sauger (Sander canadensis)** -- organization: "Minnesota DNR" (official_guidance)
- **Barotrauma** -- organization: "Minnesota DNR" (official_guidance)
- **Walleye (Sander vitreus)** -- organization: "U.S. Fish and Wildlife Service" (official_guidance)
- **Interaction of sauger Sander canadensis and walleye Sander vitreus in a large, shallow northern river** -- organization: "Journal of Fish Biology (Wiley)" (peer_review_supported)
- **You can't just use gold: Elevated turbidity alters successful lure color for recreational Walleye fishing** -- organization: "Journal of Great Lakes Research (Elsevier)" (peer_review_supported)
- **Lake turbidity mitigates impact of warming on walleyes in upper Midwest lakes (Penn State research summary)** -- organization: "Pennsylvania State University" (peer_review_supported)

Independent organization pairs actually exploited in this pilot's claims (verified via areSourcesIndependent(), not asserted -- checked two ways: ancestors of a derived_synthesis claim, AND separate ext() claims covering the same field_path within one tactic):
- Minnesota DNR <-> Journal of Fish Biology (Wiley) (via derived_synthesis ancestry)
- Minnesota DNR <-> Journal of Great Lakes Research (Elsevier) (co-cited on rigging_instructions)

**Important caveat, stated plainly**: 6 of the 10 sources in this pilot (How to catch a walleye, Ice fishing for walleye, DNR keeps three-walleye limit release, Walleye biology and identification, Minnesota Profile: Sauger, Barotrauma) are ALL organization="Minnesota DNR" -- none of these corroborate each other under the new rule, regardless of how many different pages are cited. Only 4 sources are genuinely independent of MN DNR and of each other: U.S. Fish and Wildlife Service, Journal of Fish Biology (Haxton et al.), Journal of Great Lakes Research (lure-color paper), and Pennsylvania State University (Massie & Wagner -- fetched but not yet wired into any claim this pass). This is why only 5 of 15 tactics (t3, t6, t9, t10, t12) reach independently_corroborated/peer_review_supported tier, and why the OTHER "independent" claims from gate 4 (t1's two-DNR-page claim, t6's original two-DNR-page claim) have been explicitly corrected in their derivation_explanation text to say they are NOT independent, per instruction 1.

**Secondary caveat**: the lure-color paper (Journal of Great Lakes Research) could not be directly fetched this session (ScienceDirect, NOAA repository, and a news summary all returned HTTP 403) -- its findings are cited via convergent WebSearch-index synthesis across 3 independent search results, not a directly-read excerpt. This is disclosed in the claim's own paraphrased_claim/source_location text, not hidden.

## 5. Confidence changes vs the gate-4 (pre-gate-5) state
| tactic | gate-4 confidence (BUGGY semantics) | gate-5 confidence (fixed semantics) | change |
|---|---|---|---|
| t1 | expert_consensus | official_guidance | expert_consensus -> official_guidance |
| t2 | expert_consensus | official_guidance | expert_consensus -> official_guidance |
| t3 | expert_consensus | peer_review_supported | expert_consensus -> peer_review_supported |
| t4 | expert_consensus | official_guidance | expert_consensus -> official_guidance |
| t5 | expert_consensus | official_guidance | expert_consensus -> official_guidance |
| t6 | expert_consensus | peer_review_supported | expert_consensus -> peer_review_supported |
| t7 | estimated | expert_synthesis | estimated -> expert_synthesis |
| t8 | estimated | unsupported | estimated -> unsupported |
| t9 | estimated | peer_review_supported | estimated -> peer_review_supported |
| t10 | expert_consensus | peer_review_supported | expert_consensus -> peer_review_supported |
| t11 | estimated | expert_synthesis | estimated -> expert_synthesis |
| t12 | estimated | peer_review_supported | estimated -> peer_review_supported |
| t13 | estimated | expert_synthesis | estimated -> expert_synthesis |
| t14 | estimated | unsupported | estimated -> unsupported |
| t15 | estimated | unsupported | estimated -> unsupported |

The headline correction: t4 and t5 (the genuine ice conflict) were WRONGLY labeled 'expert_consensus' in gate 4 -- their confidence computation there treated "has at least one externally_sourced claim" as sufficient for the top corroboration tier. Under the fixed semantics they correctly show 'official_guidance' (one DNR page, real evidence, but not consensus). Conversely t3/t6/t9/t10/t12 gained REAL new corroboration this pass (genuinely independent sources newly cited) and now correctly show 'peer_review_supported', which gate 4 could not have shown even by accident since no non-DNR source existed in the pilot before this pass.

## 6. Remaining unsupported decision-critical fields (by field_path, across all 15 tactics)
| field_path | tactics still unsupported | / 15 |
|---|---|---|
| applies_when.platform | 15 | /15 (of tactics where this field applies) |
| applies_when.water_environment | 15 | /15 (of tactics where this field applies) |
| applies_when.season.biological_stage | 14 | /15 (of tactics where this field applies) |
| applies_when.season.water_temp_f | 13 | /15 (of tactics where this field applies) |
| applies_when.depth_ft | 13 | /15 (of tactics where this field applies) |
| applies_when.structure | 13 | /15 (of tactics where this field applies) |
| applies_when.cover | 3 | /15 (of tactics where this field applies) |
| applies_when.current | 10 | /15 (of tactics where this field applies) |
| rigging_instructions | 9 | /15 (of tactics where this field applies) |
| bait_composition | 12 | /15 (of tactics where this field applies) |
| retrieve.pause_seconds | 15 | /15 (of tactics where this field applies) |
| equipment.line_test_lb | 15 | /15 (of tactics where this field applies) |
| equipment.lure_weight_oz | 15 | /15 (of tactics where this field applies) |
| works_when | 3 | /15 (of tactics where this field applies) |
| fails_when | 9 | /15 (of tactics where this field applies) |
| conservation_notes | 1 | /15 (of tactics where this field applies) |

Worst gaps, unchanged from before this pass: equipment.line_test_lb, equipment.lure_weight_oz, retrieve.pause_seconds are 0% sourced on every tactic that has them -- no fetched source in this pilot's research (this pass or gate 4) states an exact tackle number. applies_when.platform, applies_when.water_environment, applies_when.structure, applies_when.cover, applies_when.current, bait_composition, and conservation_notes are NEWLY tracked as decision-critical this pass and were not researched for most tactics (t2's conservation_notes and several tactics' bait_composition are the exceptions actually researched this pass).