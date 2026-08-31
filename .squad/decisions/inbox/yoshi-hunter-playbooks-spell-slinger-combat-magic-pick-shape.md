# Hunter Playbooks — The Spell-Slinger: Combat Magic's Shared-Budget-With-a-Floor Pick Shape

**By:** Yoshi (Architect)
**Date:** 2026-08-29 (opened), resolved same day
**Status:** Resolved. Reflected in the catalogue and the progress tracker (24 of 28).

## What

The Spell-Slinger's "Combat Magic" bespoke ruleset (PDF page 49) reads: "Combat magic, pick three (with at least one base):" followed by two labeled sub-groups — **Bases** (4 named options: Blast, Ball, Missile, Wall) and **Effects** (6 named options: Fire, Force or Wind, Lightning or Entropy, Frost or Ice, Earth, Necromantic) — from which exactly 3 total are picked, with a floor requiring at least 1 of the 3 to come from Bases.

This is a **shared budget across two sub-groups with a floor constraint on one of them** — a shape not covered by either existing nested-category precedent:

- **Fate/Friendship's mandatory-multi-category shape** (`Select N of M categories`, each with its own independent `MinSelect`/`MaxSelect`) has no mechanism for a budget shared *across* categories — each category's count is independent.
- **Natural Attacks' "leave the real rule in prose, accept the schema gap" precedent** (Base `MinSelect=1/MaxSelect=2` + Extra `MinSelect=0/MaxSelect=1`) is the closest analogue, but porting the same technique here produces a materially bigger gap: a naive Bases-1-to-3/Effects-0-to-3 reading would allow up to **6** total picks against a true cap of **3**, versus Natural Attacks' worst case of 1-over (2 Bases + 1 Extra = 3 vs. a true max of 2).

## My recommendation (not chosen)

Model Combat Magic as a single flat `BespokeSection` with all 10 options in one list — `MinSelect=3`, `MaxSelect=3` (this correctly caps the real total, which the nested-category alternative cannot) — preserving Bases-then-Effects as pure display order, no schema field distinguishing the two sub-groups. Keep "Combat magic, pick three (with at least one base):" verbatim in `Description` as the only place the floor constraint is stated (same "state the real unenforceable rule in prose, don't invent schema for it" resolution already made for Natural Attacks).

**Trade-off this would have accepted**: a future Hunter-creation UI loses the source's own visual Bases/Effects grouping unless it re-derives it from option order or `Description` text.

## Skyler's decision

**Nested Bases/Effects categories** — the alternative I'd presented, not my recommendation. No additional rationale given beyond selecting that option; recorded as Skyler's direct structural call rather than re-derived or second-guessed.

**Modeled as**: top-level `Select = 2 of 2` (both categories mandatory, same top-level shape as Natural Attacks' Base/Extra). Bases: `MinSelect=1`, `MaxSelect=3`, 4 title+description options (Blast, Ball, Missile, Wall). Effects: `MinSelect=0`, `MaxSelect=3`, 6 title+description options (Fire, Force or Wind, Lightning or Entropy, Frost or Ice, Earth, Necromantic). Category `Title`s ("Bases"/"Effects") drawn from the source's own bold sub-headers, per convention stripped of markup in the stored string.

**Enforcement gap, documented explicitly per Skyler's instruction — same treatment as Natural Attacks' own either/or gap.** The real rule ("pick 3 total, at least 1 from Bases") is not fully representable by independent per-category `MinSelect`/`MaxSelect` bounds: a naive consumer of just those bounds could permit up to **6** total picks (3 Bases + 3 Effects) against the true cap of **3** — a materially larger gap than Natural Attacks' own accepted version (whose worst case was 1-over, not 3-over). The real rule stays faithfully written in the Section's own `Description`, not mechanically validated. Whoever builds the Hunter-creation UI/validation layer needs to enforce the total-and-floor constraint explicitly from `Description`/business logic — `MinSelect`/`MaxSelect` alone are not sufficient here, more so than for any prior "accepted gap" case in this catalogue.

## Why

Recognized this as a case that superficially resembles an already-answered question (Natural Attacks' unenforced either/or) but isn't the same size of trade-off — reused the *framing* (real rule stated in prose, no new schema) without assuming the *conclusion* (that the resulting gap is small enough not to need asking) carries over. The two options represented a genuine design trade-off (total-cap fidelity vs. sub-grouping fidelity for UI), not a case where an existing decision already settled the answer — worth Skyler's call rather than a unilateral pick. Skyler chose to preserve the grouping and accept the larger gap; recorded verbatim, not second-guessed, and the gap's size is called out explicitly in the catalogue entry so it doesn't read as a smaller, Natural-Attacks-sized gap to a future reader.

Full detail, including the verified option content (all 10 Bases/Effects options with confirmed bold titles, plain description bodies) and both Move-internal-pick-trap findings on this same playbook (Tools and Techniques, Could've Been Worse — both out of catalogue scope, unaffected by this question): `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` `## The Spell-Slinger`.
