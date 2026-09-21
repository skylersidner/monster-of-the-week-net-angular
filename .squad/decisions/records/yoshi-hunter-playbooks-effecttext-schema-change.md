# Hunter Playbooks — `BespokeSection.EffectText` Added (Real Schema Change)

**By:** Yoshi (Architect)
**Date:** 2026-08-27

## What

Added `EffectText` (nullable) to `BespokeSection`, alongside the existing `Description`. Skyler's placeholder name was "Description2"; chosen `EffectText` instead based on the actual semantic role found across both known cases, checked rather than assumed:

- **`Description`**: the intro/framing that tells you what you're about to pick and why — read once, at character creation.
- **`EffectText`**: what having made these picks means going forward, during ongoing play — a consequence/follow-through role, not a second framing statement.

**Confirmed the split does not hold by source position**, only by role — Fate's second source-position block also contains its literal pick-instruction sentences, which are neither `Description` nor `EffectText`; they're dropped from free text entirely as fully redundant with the already-modeled `MinSelect`/`MaxSelect` fields (matching how no other Section restates its own pick-count in prose).

**Split criterion stated explicitly** (so future playbooks apply it consistently): `EffectText` applies only when the source presents follow-through/consequence content as a distinctly, separately-positioned block — not merely a forward-looking clause inside one otherwise-continuous `Description` paragraph (Underworld's "Keep this in mind when you select your moves..." stays in `Description`, unchanged, on this basis).

**Reworked**: Chosen's Fate (Description = early blurb only; EffectText = the closing "pulling you both ways" sentence; pick-instructions dropped — explicitly only *partially* resolves Fate's known source-layout messiness, which remains a manual-review case per Skyler's own earlier acceptance) and Changeling's Unknown Heritage (clean split — Description = intro+instruction, EffectText = the Keeper-obstacles/mark-experience paragraph, the case the field was designed around).

**Retroactive review, full pass, not just the 2 known cases**: Crooked's Background/Heat/Underworld, Divine's Mission, and Action Scientist's Area of Study all checked against the split criterion — none need rework (each has one continuous `Description` block, nothing separately positioned after the options). The Celebrity has no bespoke ruleset to check. Documented in the catalogue's own summary note so this doesn't need re-auditing later.

**Not yet applied**: The Envoy's "Overseers," flagged by Skyler as a likely future case — deliberately not analyzed this round, per instruction; the field is designed to be ready for it, not pre-judged against unread content.

## Why

Skyler was right to name this after two occurrences rather than let a third case get resolved via another one-off precedent extension — "worked case-by-case" and "should be schema" are different questions. The position-vs-role distinction is the load-bearing finding: a naive "second block = second field" read would have produced a wrong result for Fate specifically (forcing redundant pick-instruction text into a field meant for consequences).

Full detail: `docs/hunter-playbooks/phase5-bespoke-ideation.md` Section 3, `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` (Chosen/Fate, Changeling/Unknown Heritage entries, retroactive-review summary note).
