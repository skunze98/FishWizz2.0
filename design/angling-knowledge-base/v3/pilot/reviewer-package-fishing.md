# Reviewer Package A -- Fishing / Technique Review

**Intended reviewer:** an experienced MN/WI walleye-and-sauger guide, a state or tribal fisheries
professional, or an angler with substantial, specific multi-season experience on the relevant
water types (not general fishing experience -- MN/WI walleye/sauger specifically).

**What this is NOT:** approval. Nothing in this pilot is published or will be published based on
your input alone. Every tactic is `record_status: draft`; every claim is `reviewer_status:
unreviewed`. Your input is captured as expert testimony (see `expert-consultation-workflow.md`)
and weighed alongside the existing cited sources -- it does not automatically become an
independent corroborating source, and it does not by itself make a tactic ready for publication.

**What we're asking you to review:** all 15 tactics in `pilot/consultation-packets.md`, EXCEPT the
kayak/canoe-specific wind-safety question on t8 (that's Package B -- a qualified boating/paddle-
sport safety reviewer's job, not a fishing-technique question). You are welcome to comment on t8's
FISHING technique (the jig presentation itself); please leave the "is this safe in wind" question
to that reviewer.

## How to use `consultation-packets.md`

Each of the 15 sections is self-contained: species, platform/environment, season/temp/depth,
structure/cover/current, full equipment and retrieve, works_when/fails_when/diagnostic signals,
existing alternatives, confidence, every SUPPORTED fact with its source, every DERIVED fact with
its reasoning, and -- listed plainly, not buried -- every field that currently has **no** real
support. The "Questions requiring expert judgment" list at the end of each tactic is what we most
need your read on, but you're not limited to those -- if something else looks off, say so.

## Response template -- please mark EVERY field path you have an opinion on

For each field (e.g. `applies_when.depth_ft`, `retrieve.pause_seconds`, `fails_when`, or the
tactic overall), respond with:

```
tactic: t<N> (<presentation_slug>)
field_path: <exact field, or "overall">
response: accept | revise | reject | uncertain | outside_my_expertise
if revise: your corrected value/range/description, and why
if reject: why the current claim is wrong, not just imprecise
if uncertain: what would resolve your uncertainty (a source, a season you haven't fished it, etc.)
your_confidence: high | moderate | low
your_geographic_experience: which specific waters this opinion is based on
```

Plus, once at the end (not per-field), please fill in the full expert-contribution record
described in `expert-consultation-workflow.md` (name, credentials, geographic experience, date,
conflicts of interest, permission to use your input).

## Specific things we most need judgment on (compiled from all 15 tactics)

- **retrieve.pause_seconds** is unsupported almost everywhere except standard lift-hop jigging
  (t1, t6). Per instruction 3, if you can't give us an exact number for a presentation style,
  a QUALITATIVE description (e.g. "very short, barely a beat" vs. "long enough to count to
  ten-plus") is exactly what we want -- please don't feel obligated to invent seconds.
- **fails_when** remains practitioner-inference (not directly sourced) on t4, t5, t6, t11, t12,
  t13 -- what actually makes these fail on the water, in your experience?
- **Seasonal sub-stage** (early/mid/late summer, early/mid/late ice) is unresolved on several
  tactics -- does the stated window match when you'd actually fish this?
- **Platform-specific practicality**: several platform/casting-access values are DERIVED from
  access logic (e.g. "a dock inherently limits casting angles"), not from direct research --
  do these hold up in practice?
- **Equipment realism**: line-test/lure-weight ranges are derived from a generic tackle-industry
  rod-power chart, not species/situation-specific research -- is anything unrealistic on the
  water for walleye/sauger specifically?
- **The relationship graph** (`pilot/relationship-graph.md`): 6 of 15 tactics have no
  alternative/next_try relationship at all. For t1, t2, t6, t7, t11, we found STRUCTURAL
  candidates among the other 14 tactics but did not write a next_try relationship (per
  instruction, we don't invent relationships just to fill a count). If you think one of the
  identified candidates is a genuine "try this next" substitute, or a different one is, please
  say so and why (what characteristic changes, and why that responds to the likely failure).
