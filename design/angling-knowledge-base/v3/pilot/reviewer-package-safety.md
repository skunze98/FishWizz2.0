# Reviewer Package B -- Paddle-Sport / Cold-Water Safety Review

**Intended reviewer:** a qualified boating safety professional, certified paddle-sport instructor,
or cold-water safety specialist -- NOT a fishing-technique reviewer. This package is deliberately
separated from Package A because fishing skill and paddle-craft safety are different expertises,
and conflating them is exactly how an unqualified confident answer ends up in a "safety" field.

**What this is NOT:** approval, and NOT a request to validate the fishing technique on t8. The
jig-and-minnow presentation itself is Package A's concern. This package is narrowly about: is it
safe to be in a kayak or canoe under the conditions this pilot's data describes, and if so, under
what limits.

## The specific gap

`t8` (kayak/canoe finesse jig, clear water, calm conditions) is the only tactic in this 15-tactic
pilot with `kayak`/`canoe` as a `primary` platform. Per `safety/README.md`, no real safety_advisory
research has been done -- craft type, hull/stability class, waterbody size/fetch, water
temperature (cold-water immersion risk), wave height (a different axis than the `wind` enum this
schema currently has), paddler experience, and exposure (distance from shore, PFD use, solo vs.
group) all plausibly matter and none are modeled. **We have NOT invented a wind-speed threshold**,
and are not asking you to rubber-stamp one -- we're asking whether a real one exists and what it
should depend on.

The reference scorer already returns `insufficient_safety_data` (a caution, not a ranked
recommendation) for any kayak/canoe-primary tactic under `wind: high` conditions -- see
`pilot/scorer.mjs`'s `isSmallCraftSafetyUnresolved()`. **This status is retained, not resolved by
this pilot, until real safety guidance exists.** Please do not treat the presence of this package
as pressure to produce a number quickly -- an honest "it depends on X, Y, Z and can't be reduced
to one threshold" is a completely acceptable and expected answer.

## What we're asking

1. Is `wind` (the only condition axis this schema currently tracks: `calm`/`light`/`moderate`/
   `high`) even the right variable, or does real risk hinge more on wave height, fetch (open-water
   distance the wind can build waves across), water temperature, or something else entirely?
2. Under what conditions (if any) would you consider kayak/canoe walleye fishing on a MN/WI natural
   lake genuinely unsafe for a reasonably experienced recreational paddler? Under what conditions
   would you consider it unsafe REGARDLESS of experience?
3. Should MN/WI kayak/canoe fishing guidance differ by season (cold-water immersion risk in
   spring/fall/winter vs. summer)? This pilot's t8 is set in `mid_summer` specifically -- does that
   materially change your answer?
4. Is there authoritative guidance we should be citing directly (US Coast Guard recreational
   boating safety, state boating-safety authorities, American Canoe Association, National Center
   for Cold Water Safety, or similar) rather than synthesizing our own threshold?
5. Given the current uncertainty, do you agree that kayak/canoe should be marked conditional or
   unavailable for confident recommendation in any production system until real guidance exists
   (per instruction 5), or is there a safe, defensible interim default you'd recommend instead?

## Response template

```
question: <which of the 5 above, or your own>
response: accept_current_approach | revise | reject | uncertain | outside_my_expertise
your_answer: <the substance>
rationale: <why>
your_confidence: high | moderate | low
citable_source: <a real, named authoritative source we should fetch and cite, if you know one>
```

Plus the full expert-contribution record from `expert-consultation-workflow.md` (name,
credentials -- specifically paddle-sport/boating-safety credentials, not general angling
experience, geographic experience, date, conflicts of interest, permission to use).

## What happens with your input

Per instruction 5, until this review is complete: `t8` retains `insufficient_safety_data` in
scoring, we will never present a confident high-wind kayak/canoe recommendation, and we will not
invent a universal wind threshold on our own. Your input, once received, becomes real research
input to a future pass -- it does not retroactively change anything in this pilot by itself.
