# Hunter Playbooks — The Spooktacular: Infernal Favour, an Option-Conditional Track

**By:** Yoshi (Architect)
**Date:** 2026-08-29 (opened), resolved same day
**Status:** Resolved. Reflected in `phase5-bespoke-ideation.md`, the catalogue, and the progress tracker (25 of 28).

## What

The Spooktacular's "The Show" bespoke ruleset (PDF page 51) has 5 pick-1-of-5 options, one of which ("An Infernal Power") grants a real, printed 3-box track: "You signed the contract–take a three-box infernal favour track. Spend these as if they were Luck points. The Big Bad may restore these points when they wish, but first you must do something unforgivably terrible." The source literally draws the track: "Infernal Favour: b b b."

This is the same *kind* of resource that justified building `PlaybookExtraTrack` for Curse-Eater's Corruption and Pararomantic's Relationship Status (a Luck-like, spend/restore mechanic with its own box track) — but with a real structural difference: **every track modeled so far is universal to its playbook** (every Curse-Eater has Corruption, every Pararomantic has Relationship Status). Infernal Favour is **conditional on one specific `BespokeOption` pick** — only the subset of Spooktacular Hunters who chose "An Infernal Power" (1 of 5 Show specialties) have this track at all. `PlaybookExtraTrack` as currently designed has no conditionality concept.

Two bundled questions:

1. **Should Infernal Favour be modeled as real trackable state at all**, or left as descriptive prose only inside the option's `DescriptionText` (no schema, no rendered checkbox track in the app)?
2. **If tracked, how does a track conditional on one `BespokeOption` fit the schema?**

## My recommendation (not chosen)

Track it for real (same resource shape as Corruption, and the source's own literal drawn checkboxes signal it's meant to be marked during play, not just read as flavor). Extend `PlaybookExtraTrack` with a nullable `TriggeringBespokeOptionId` FK: `null` means "universal to the playbook" (today's only case — Corruption and Relationship Status unaffected, no migration needed for them), populated means "only Hunters who selected this specific option have the track." This reuses the existing table/mechanism rather than inventing a parallel "option-scoped track" concept — the reasoning being that "conditional on this playbook" (already implicit in every track's `PlaybookId` FK) and "conditional on this playbook *and* this specific pick" are the same kind of conditionality, just one level more specific, not a different kind of thing needing its own table.

## Skyler's counter-proposal, evaluated on its merits and adopted

**Exact words**: "I think this may be a case where we need to explore architecture modeling for a new type of bespoke option, which could be as simple as a numeric input value with a minimum and maximum value." On the second (conditionality) question: "In my answer to the other question, I made a suggestion that should make this question moot."

**Evaluated against the full model before adopting, per the coordinator's request — not rubber-stamped:**
- **Checked against the earlier, superficially-similar "min/max" discussion in `phase5-bespoke-ideation.md` Section 4** (Skyler's original generic-EAV proposal, which named min-select/max-select/blank as candidate generic attributes, declined in favor of typed columns). Confirmed this is a genuinely different concept — pick-count bounds vs. a numeric value-range a Hunter records and mutates during play — sharing only the word "min/max," not the underlying question. No conflict with that earlier decision.
- **Fits the schema's own "shape emerges from populated fields" philosophy directly** — `NumericMin`/`NumericMax` populated is one more combination in the same space as every other leaf kind, not a parallel mechanism.
- **No naming collision with `BespokeOption.MinSelect`/`MaxSelect`** (which govern *this option's own children*, an unrelated concept from *a value this option's own selection produces*).
- **Reuses the existing parent/child attachment mechanism rather than inventing a new one**: "An Infernal Power" gets `MinSelect=1, MaxSelect=1` with one child (`Title="Infernal Favour"`, `NumericMin=0`, `NumericMax=3`) — structurally identical to Professional's synthesized "Agency name:" single-child pattern, just a numeric-range leaf instead of a `{{blank}}` text leaf.
- **Correctly makes the conditionality question moot**, as Skyler said — the bounds live on the option that gates them, so there's no separate FK needed to express "only exists if this was picked."
- **Genuinely better than my own recommendation** on one real axis: keeps "what this option grants" co-located with the option itself, and generalizes to non-track numeric needs too, not just spend/restore resources. The trade-off it accepts: doesn't automatically inherit `PlaybookExtraTrack`'s `StartLabel`/`EndLabel` vocabulary — deliberately not added to this new leaf shape either, since Infernal Favour doesn't need them and nothing yet demonstrates the need (same "don't add a field speculatively" discipline already applied to `PlaybookExtraTrack.StartLabel` itself).

**No questions raised back to Skyler** — the proposal holds up cleanly against precedent, and the one real design detail (parent/child attachment, not new top-level fields on the parent option itself) is resolvable directly from the already-established Agency-name/Dual-Nature-Effect precedent, the same class of judgment call resolved from precedent throughout this project without escalating.

**Also resolved**: Infernal Favour has no printed start/end labels at all — not even the universal "Okay" Luck/Harm print literally. Confirmed absence, not an oversight; this new leaf shape has no `StartLabel`/`EndLabel` concept at all (see above), so nothing further needed here.

## Where this landed

`docs/hunter-playbooks/phase5-bespoke-ideation.md` (new `BespokeOption.NumericMin`/`NumericMax` leaf shape, full reasoning, alternatives declined, `HunterBespokeSelection.NumericValue` instance-side addition, initialization convention). `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` `## The Spooktacular` (finalized — The Show's full content, Infernal Favour modeled as the nested numeric child; progress tracker to 25 of 28).
