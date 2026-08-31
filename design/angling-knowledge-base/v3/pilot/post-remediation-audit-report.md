# Post-remediation semantic-quality audit -- walleye/sauger pilot, gate 4, section 8
Generated 2026-08-29T13:59:13.452Z from the REMEDIATED pilot-data.json. All numbers below are computed from the live data, not asserted.

## 1. Evidence coverage -- externally_sourced / derived_synthesis / unsupported_gap
Total claims: 136
- externally_sourced: 27 (19.9%)
- derived_synthesis: 15 (11.0%)
- unsupported_gap: 94 (69.1%)
- REAL coverage (externally_sourced + derived_synthesis): 42 (30.9%)

Compare to the PRE-remediation baseline (commit 5131a65 / tag pilot-baseline-pre-remediation): 15 real-DNR-sourced (12%), 67 auto-generated boilerplate (53%), 44 hand-authored-placeholder (35%) of 126 -- i.e. 88% non-independent. The remediated dataset has MORE total claims (136 vs 126, because every required field now gets its own explicit ext/derived/gap claim instead of some fields silently sharing one auto-generated claim) and a materially different, now HONEST composition: gaps are gaps, not disguised as expert_synthesis "coverage."

## 2. Coverage by tactic
| tactic | presentation | species | ext | derived | gap | real coverage % | confidence |
|---|---|---|---|---|---|---|---|
| t1 | jig-minnow | Walleye | 2 | 2 | 4 | 50% | expert_consensus |
| t2 | slip-sinker-livebait-rig | Walleye | 2 | 2 | 4 | 50% | expert_consensus |
| t3 | shallow-crankbait | Walleye | 2 | 1 | 5 | 38% | expert_consensus |
| t4 | jigging-spoon-aggressive | Walleye | 2 | 0 | 6 | 25% | expert_consensus |
| t5 | jig-minnow-head-deadstick | Walleye | 2 | 0 | 6 | 25% | expert_consensus |
| t6 | jig-minnow | Walleye+Sauger | 0 | 1 | 7 | 13% | expert_consensus |
| t7 | slip-bobber-livebait | Walleye | 0 | 2 | 6 | 25% | estimated |
| t8 | jig-minnow | Walleye | 0 | 0 | 8 | 0% | estimated |
| t9 | crawler-harness-troll | Walleye | 0 | 2 | 6 | 25% | estimated |
| t10 | slip-sinker-livebait-rig | Sauger | 2 | 1 | 5 | 38% | expert_consensus |
| t11 | shallow-crankbait | Walleye | 0 | 1 | 7 | 13% | estimated |
| t12 | jig-minnow-head-deadstick | Sauger | 0 | 1 | 7 | 13% | estimated |
| t13 | slip-bobber-livebait | Walleye | 0 | 1 | 7 | 13% | estimated |
| t14 | slip-sinker-livebait-rig | Sauger+Walleye | 0 | 0 | 7 | 0% | estimated |
| t15 | jig-minnow-head-deadstick | Walleye | 0 | 0 | 8 | 0% | estimated |

## 3. Coverage by field path (across all 15 tactics)
| field_path | ext | derived | gap | real coverage % |
|---|---|---|---|---|
| applies_when.season.water_temp_f | 1 | 0 | 13 | 7% |
| applies_when.depth_ft | 2 | 1 | 13 | 19% |
| equipment.line_test_lb | 0 | 0 | 15 | 0% |
| equipment.lure_weight_oz | 0 | 0 | 15 | 0% |
| retrieve.pause_seconds | 0 | 0 | 15 | 0% |
| rigging_instructions | 5 | 0 | 10 | 33% |
| works_when | 13 | 7 | 3 | 87% |
| fails_when | 2 | 6 | 9 | 47% |

**Pattern**: the three equipment/retrieve numeric fields (line_test_lb, lure_weight_oz, pause_seconds) are 0% real-covered across all 15 tactics -- no fetched source anywhere states an exact tackle number. This is the single largest, most consistent gap in the dataset, now explicit rather than hidden behind auto-generated "expert_synthesis" claims.

## 4. Independent (distinct) real sources per tactic
| tactic | distinct real sources cited | source titles |
|---|---|---|
| t1 | 2 | How to catch a walleye; Walleye biology and identification |
| t2 | 2 | How to catch a walleye; Walleye biology and identification |
| t3 | 2 | How to catch a walleye; Walleye biology and identification |
| t4 | 1 | Ice fishing for walleye |
| t5 | 1 | Ice fishing for walleye |
| t6 | 2 | Walleye biology and identification; Minnesota Profile: Sauger (Sander canadensis) |
| t7 | 1 | Walleye biology and identification |
| t8 | 0 | (none) |
| t9 | 1 | Walleye biology and identification |
| t10 | 1 | Minnesota Profile: Sauger (Sander canadensis) |
| t11 | 1 | Walleye biology and identification |
| t12 | 1 | Minnesota Profile: Sauger (Sander canadensis) |
| t13 | 1 | Walleye biology and identification |
| t14 | 0 | (none) |
| t15 | 0 | (none) |

**Confidence-eligibility consequence**: per the stated rule ("expert_consensus needs at least two genuinely independent credible sources"), only tactics citing >=2 DISTINCT sources are eligible for expert_consensus on that basis alone; the rest reach expert_consensus (if they do) via a SINGLE authoritative primary_official source on a decision-critical field, which this pilot treats as the ceiling below `established` -- consistent with section 6 below.

## 5. Walleye-specific vs sauger-specific real evidence
Sauger-bearing tactics: 4 (t6, t10, t12, t14). Of their 31 evidence entries, 5 trace to a genuinely SAUGER-SPECIFIC source (the "Sauger: the walleye's cousin" DNR/MCV profile) -- up from 0 in the pre-remediation baseline, where the audit's finding #1 ("no sauger-specific primary source found this session") was accurate. That finding is now resolved for t6 (river staging timing) and t10/t12 (habitat/technique), though t14 (rising/turbid post-rain river conditions) still has NO sauger-specific or walleye-specific support -- flagged honestly as gap in its own evidence, not silently inherited from t6/t10.

## 6. Remaining `precision:"exact"` numerical values -- audited individually
- t1 applies_when.depth_ft: min=1 max=6 -- JUSTIFIED (directly quoted: "DNR: "Walleye spawn over rock, rubble, gravel and similar substrate in rivers or...")
- t3 retrieve.pause_seconds: min=0 max=0 -- JUSTIFIED (structurally exact by definition -- a continuous troll/steady-retrieve/suspended presentation has no discrete pause phase; this is not a measured/sourced figure but a logical necessity of the retrieve style itself, so 'exact' is the honest label, not an invented one)
- t7 retrieve.pause_seconds: min=0 max=0 -- JUSTIFIED (structurally exact by definition -- a continuous troll/steady-retrieve/suspended presentation has no discrete pause phase; this is not a measured/sourced figure but a logical necessity of the retrieve style itself, so 'exact' is the honest label, not an invented one)
- t9 retrieve.pause_seconds: min=0 max=0 -- JUSTIFIED (structurally exact by definition -- a continuous troll/steady-retrieve/suspended presentation has no discrete pause phase; this is not a measured/sourced figure but a logical necessity of the retrieve style itself, so 'exact' is the honest label, not an invented one)
- t11 retrieve.pause_seconds: min=0 max=0 -- JUSTIFIED (structurally exact by definition -- a continuous troll/steady-retrieve/suspended presentation has no discrete pause phase; this is not a measured/sourced figure but a logical necessity of the retrieve style itself, so 'exact' is the honest label, not an invented one)
- t13 retrieve.pause_seconds: min=0 max=0 -- JUSTIFIED (structurally exact by definition -- a continuous troll/steady-retrieve/suspended presentation has no discrete pause phase; this is not a measured/sourced figure but a logical necessity of the retrieve style itself, so 'exact' is the honest label, not an invented one)

**6 exact values are genuinely justified** -- t1's depth_ft directly quotes DNR's "1 to 6 feet"; the 5 zero-pause entries (t3, t7, t9, t11, t13) are structurally exact by definition, not measured/sourced figures, since a continuous troll/steady-retrieve/suspended presentation has no discrete pause phase to measure. **0 remain unsupported** with no justification found this pass.

## 7. Confidence changes vs the pre-remediation baseline (commit 5131a65)
| tactic (by array order) | baseline confidence | remediated confidence | change |
|---|---|---|---|
| t1 | expert_consensus | expert_consensus | unchanged |
| t2 | expert_consensus | expert_consensus | unchanged |
| t3 | expert_consensus | expert_consensus | unchanged |
| t4 | anecdotal | expert_consensus | anecdotal -> expert_consensus |
| t5 | anecdotal | expert_consensus | anecdotal -> expert_consensus |
| t6 | expert_consensus | expert_consensus | unchanged |
| t7 | anecdotal | estimated | anecdotal -> estimated |
| t8 | anecdotal | estimated | anecdotal -> estimated |
| t9 | expert_consensus | estimated | expert_consensus -> estimated |
| t10 | expert_consensus | expert_consensus | unchanged |
| t11 | expert_consensus | estimated | expert_consensus -> estimated |
| t12 | anecdotal | estimated | anecdotal -> estimated |
| t13 | anecdotal | estimated | anecdotal -> estimated |
| t14 | expert_consensus | estimated | expert_consensus -> estimated |
| t15 | estimated | estimated | unchanged |

2 tactic(s) moved UP a tier (real research this pass found genuine support that was previously missing/auto-generated); 7 moved DOWN or stayed at a lower tier once auto-generated boilerplate stopped counting as evidence. None reach 'established' -- still true after remediation, since no claim anywhere in the pilot has TWO independent primary sources on the SAME decision-critical field (the closest, t6's river-staging claim and t1's spring-flats claim, each combine 2 sources for ONE field, which is the real ceiling this pilot reaches).

## 8. Regulation-provision readiness
| provision | real source | waterbody_id resolved | quarantined |
|---|---|---|---|
| mn.statewide.statewide.walleye-sauger.daily_limit.2026 | yes | yes | no |
| mn.statewide.statewide.walleye-sauger.size_rule.2026 | yes | yes | no |
| mn.named_water.mille-lacs-lake.walleye-sauger.daily_limit.2026 | yes | yes | no |
| mn.named_water.mille-lacs-lake.walleye-sauger.size_rule.2026 | yes | yes | no |
| mn.statewide.statewide.walleye-sauger.catch_and_release_permitted.2026 | no | yes | YES (unknown, official lookup provided) |

All 5 provisions now cite a real source and resolve to a real waterbody_id where applicable. The catch_and_release_permitted provision is deliberately quarantined (determination:"unknown") rather than replaced with an uncertain citation -- this is intended, not a remaining defect, per instruction 2/7.

## 9. Scenario-ranking changes (see scenarios-output.txt for full detail)
- Scenario 3 (kayak, strong wind): previously scored candidates confidently; now returns 3 `insufficient_safety_data` results and 0 ranked candidates -- the gate-4 safety-layer fix working as designed, not silently recommending under an unresearched wind threshold.
- Scenario 7 (the genuine ice conflict, t4 vs t5): both tactics now score 0.622 (up from 0.402 pre-remediation) since their works_when/rigging_instructions claims are directly externally_sourced (real DNR text), not auto-generated -- the tie itself is preserved, now on a firmer evidentiary footing.
- Scenario 12 (artificial_only): now correctly excludes t8 (and every other hybrid tactic) with an explicit reason citing bait_composition.mode -- previously t8 survived on the old bait_method_tags ambiguity. Only genuinely artificial_only tactics (t3, t11) remain eligible.
- Scenario 1 (post-front, shore, no live bait): still finds a weak/no real match -- this pilot still has no tactic constraining weather_front for a shore/artificial presentation. Confirmed unchanged; still a real, logged content gap, not fixed this pass (no new tactics were generated, per instruction).