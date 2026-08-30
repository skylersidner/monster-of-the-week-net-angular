# Hunter Playbooks — The Changeling: `{{blank}}` on Semantic Grounds + Description Concatenation Precedent Reused

**By:** Yoshi (Architect)
**Date:** 2026-08-27

## What

Two decisions made resolving The Changeling's "Unknown Heritage" bespoke ruleset, both from precedent/principle rather than escalated to Skyler (Bowser explicitly left them to my call, invited escalation only if genuinely undecidable):

1. **`{{blank}}` recorded in 4 of Unknown Heritage's 10 tags ("Allergy to", "Repulsion from", "Attraction to", "Obsession with") despite Bowser confirming, directly against the PDF item stream, that no printed marker (no underscore run, no glyph) follows any of them** — a different provenance than Heat's literal inline `________`. Resolved by returning to the token's actual purpose (marking where the UI needs to render an input) rather than treating "did the source print a glyph" as the deciding test: these 4 tags are grammatically incomplete without something filling them in, and a Hunter creation form has no way to capture that content without an input regardless of source typesetting. Flagged explicitly as a new provenance category for the token (semantic/functional inference vs. transcribed source marker), not silently treated the same as Heat's case.
2. **The Section's two separate prose blocks (a short select-instruction, a longer trailing explanation with two real `<b>` cross-references) concatenated into one `BespokeSection.Description`**, not split into a new field. First checked whether the trailing paragraph matched the already-excluded "special:"-callout pattern (Luck-spend triggers physically near a bespoke ruleset but about a different standard mechanic) — it doesn't; it's explicitly about Unknown Heritage's own tags. Given that, concatenation directly reuses the precedent already set for Chosen's Fate (also built from prose scattered across two source positions), not a new schema decision.

## Why

Both resolved from already-established reasoning rather than needing a fresh stakeholder call: the `{{blank}}` token's original design intent was always functional (does the UI need an input here), not purely transcriptional, so extending it to a semantically-obvious-but-typographically-unmarked case is consistent with that intent, not a scope creep; and the Description-concatenation precedent from Fate directly covers this shape once the "different standard mechanic" exclusion was ruled out by actually reading what the paragraph is about.

Full detail, both resolutions stated in-doc with reasoning: `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` (`## The Changeling`), `docs/hunter-playbooks/phase5-bespoke-ideation.md` (dated note).
