# Hunter Playbooks — Extraction Pipeline Formalized + Catalogue Purpose Reconciled

**By:** Yoshi (Architect)
**Date:** 2026-08-26

## What

Two settled decisions, following Skyler's approval of Bowser's pdf.js-based formatting-extraction pipeline (both the Crooked/`<b>` and Covenant/`<i>`+`<ul>` validation passes passed):

1. **The extraction pipeline is now a permanent part of Phase 4's process, not a spike.** `docs/hunter-playbooks/pdf-extraction-pipeline.md` and `tools/pdf-extract/` (`extract-runs.mjs`/`splice-formatting.mjs` for flat description text with inline emphasis; `extract-moves.mjs` for list-containing Moves content) are the standing mechanism for every playbook going forward, named explicitly in `phases.md` Phase 4 rather than referenced as an open concern.
2. **`bespoke-ruleset-catalogue.md`'s purpose, previously genuinely ambiguous, is resolved as (a): the actual source of truth content gets authored from later — not (b) a structural-shape-only reference.** Skyler flagged the ambiguity themselves (their own request said "for the actual implementation"; my own status line had said "reference data," pointing the other way). Direct consequence: every catalogue entry needs real, pipeline-verified markup where the source has formatting, not plain/tagless text as a placeholder. Acted on this immediately for Crooked (all 7 Background options now carry real `<b>` markup pulled directly from Bowser's already-produced `crooked-background-review.json`; Heat/Underworld confirmed via the same review to have no bold/italic in source, so their plain text is correct and final). Flagged, not silently assumed: Chosen's Fate and Divine's Mission haven't been run through the pipeline at all yet — their entries are marked pending in the catalogue.

**Separately, not part of this decision**: a data-loss incident was discovered and flagged in `.squad/agents/Yoshi/history.md` (this same date) — several rounds of this task's history-file learnings were silently reverted by what appears to be a concurrent agent's git operation on this shared working tree. Untracked files (all the `docs/hunter-playbooks/*.md` files and every `.squad/decisions/inbox/*.md` entry, including this one) were unaffected. Recovery/consolidation done in the history file itself; flagged to the coordinator as an operational risk for the squad, not something resolved here.

## Why

Skyler's own words settle the catalogue-purpose question directly ("catalogue the definition within this framework here for the actual implementation"); the pipeline's two passed validation tests remove the remaining uncertainty about whether formatting fidelity could actually be captured at all. Full reasoning: `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` (new intro), `docs/hunter-playbooks/phase5-bespoke-ideation.md`, `docs/hunter-playbooks/phases.md` Phase 4, `docs/hunter-playbooks/pdf-extraction-pipeline.md`.

## Addendum, 2026-08-26 — backfill complete, all 3 pilots finalized

Bowser finished extraction on the two remaining pilot rulesets (`tools/pdf-extract/divine-mission-review.json`, `chosen-fate-review.json`). Backfilled into `bespoke-ruleset-catalogue.md`: Divine's Mission option 5 gets real `<i>` markup ("...protect them at `<i>`any`</i>` cost"), options 1-4 confirmed plain; all 33 of Chosen's Fate tags confirmed plain (two-way verification — manual + programmatic diff, 0 collisions).

**One judgment call made, reasoning stated in the catalogue itself**: Bowser found a bold Luck-related aside ("Whenever you mark off a point of Luck...") positioned near the Fate column and flagged it for a decision rather than including/excluding it unilaterally. Ruled it **out of scope for the Fate bespoke-ruleset entry** — it's the same kind of content as the "[Playbook] special:" Luck-spend-trigger callouts already excluded everywhere else in this catalogue (those are `Playbook.LuckSpecialText`, a standard field, not bespoke-ruleset content), regardless of which column of the PDF it happens to be printed near. Flagged, not resolved here: this aside's wording is a second, differently-phrased rendering of the same Luck-trigger concept already captured elsewhere as Chosen's `LuckSpecialText` — a small source-fidelity question for whoever finalizes that field during real Phase 4 authoring, not a Fate-scope question.

All 3 pilot playbooks (Crooked, Chosen, Divine) are now fully formatting-verified and finalized under the catalogue's (a) source-of-truth purpose. Nothing pending. Skyler can start the one-playbook-at-a-time walkthrough of the remaining 25.
