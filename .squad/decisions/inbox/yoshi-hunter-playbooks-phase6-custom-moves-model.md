# Hunter Playbooks — Phase 6 Custom Moves: Settled Modeling Approach

**By:** Yoshi (Architect)
**Date:** 2026-08-30
**Status:** Resolved. All four open questions answered by Skyler the same day. Schema recorded in `architecture.md` Section 6.8.

## What

Phase 6 (custom-move modeling) opened for real. A full census of **all 28 playbooks' Moves sections** was run — every one read in full, cross-checked with two systematic greps — to find the variety of structure in use and propose a model.

**Census result**: **14 creation-time in-move picks across 11 playbooks** (the phase's actual worklist), plus ~35 in-play menus, 10 free-text authoring cases, and 5 computed-option-set cases. **7 of the 14 were not previously flagged anywhere** — the pre-existing list scattered through `bespoke-ruleset-catalogue.md` was about half complete.

### The model (settled)

**One nullable FK: `BespokeSection.PlaybookMoveId`.** `null` = a playbook-level bespoke ruleset (every existing Phase 5 row); populated = this Section's pick-structure lives inside that Move. Zero changes to `BespokeOption`, zero new tables, zero instance-side changes. A Move's internal structure reuses the entire Section 6 apparatus unchanged.

### Skyler's four answers

| Q | Question | Answer |
|---|---|---|
| Q1 | Are in-play menus in scope? (~35 moves) | **Prose only** — as recommended. Phase 6 stays at 14 moves. |
| Q2 | Computed option sets? (5 moves) | **Prose only** — as recommended. |
| Q3 | Bounded-repeatable free text? (2 moves) | **Model them** — as recommended, via `FreeTextLabel` + `MinInstances`/`MaxInstances`. |
| Q4 | Spell-Slinger's inverted "Cross off one" pick | **Ordinary pick, reworded** to "Pick 3 of the 4" (`MinSelect=MaxSelect=3`) — a modification of my recommendation. |

## Why

**Why the Section level, not the Option level** — this reverses my own pre-census framing, which had named the fork as "nullable `PlaybookMoveId` on `BespokeOption`" vs. "a parallel `PlaybookMoveOption` table." Reading the real content showed both are the wrong attachment point: The Forged's Partner and The Professional's Mobility are each *two named categories under one Move, each with its own independent pick count*. At the Option level, "how many of my direct categories are mandatory" has nowhere to live — that's `BespokeSection.MinSelect`, one level up. The Option-level design would have needed a new field invented immediately to express something the schema already handles. Attaching at the Section level reuses all of Section 6 rather than half of it, which is also the literal reading of Skyler's own framing ("the same kind of modeling we're doing for the bespoke rulesets").

**Trade-off accepted**: `BespokeSection` becomes polymorphic in its owner, so any query for a playbook's top-level rulesets must filter `PlaybookMoveId IS NULL` — a real, small, permanent cost at every read site, taken in exchange for not duplicating a validated four-table apparatus.

**Why in-play menus stay prose**: nothing in this design models live-play state at all (no holds, no roll outcomes, no forward/ongoing bonuses). Modeling them would be the first such machinery, and would need a genuinely new "roll-result-gated pick count" concept to be useful. Framed to Skyler explicitly as a **product-intent** call, not an architecture one — the answer flips if a play-session view is ever in the vision.

**Why the two Q3 cases are modeled despite the same "prose" option existing**: an asymmetry that only became visible while writing the plain-language explanation. For in-play menus, "prose" loses nothing storable — there's no per-Hunter answer. For these two, the player authors permanent character content at creation, so "prose" means the answer has **nowhere on the sheet to live**. Same nominal cheap answer, materially different cost.

**Q4's rewrite is corroborated, not just equivalent**: verified 4 items (cross off 1 → keep 3), then found that the same playbook's Advanced Arcane Training already says "your **three** Tools and Techniques" — the source already thinks in kept-items, so the positive framing is *more* internally consistent than the printed instruction. Recorded as an explicitly Skyler-directed, non-source-literal rewording.

## Consequences worth acting on

- **The Crooked is a Phase 4 pilot playbook and carries two of the newly-found in-move picks** (Artifact, Deal with the Devil). If Phase 4 authors it before Phase 6's schema ships, that content must be deferred or re-authored. Invisible until this census ran.
- ~~**`tools/pdf-extract/extract-moves.mjs` needs an inline-list path before authoring starts.**~~ **Built 2026-08-30 by Bowser** (`bowser-hunter-playbooks-phase6-inmove-option-extraction.md`), along with a second gap this record didn't anticipate: the *bulleted* path was also broken for in-move content — a capital-`B` Required-move glyph matched no bullet rule (silently swallowing all 7 Required moves' bodies) and in-move option bullets share the top-level glyph, separable only by x-indent.
- ~~**No font-derived `Title` boundary exists in this content class at all.**~~ **Corrected 2026-08-30 — this was overgeneralized from two samples and is wrong as stated.** The Searcher's First Encounter has genuinely bold option names (verified against the raw item stream; Bowser's tally: 81 regular / 7 bold, the 7 being First Encounter's). Regular weight is a sound *default*, not a guarantee. Tooling now measures it per option (`titleStyle`, `titleFontCorroborated`) rather than assuming; authoring should read the measured value. Delimiter-derived splitting remains correct either way — font signal corroborates a split rather than replacing it. Had the original blanket claim been followed, it would have wrongly downgraded the provenance of the one playbook where the source does corroborate the title.
- **New standing authoring rule**: `titleProvenance: delimiter:paren` must never be auto-accepted. Real counterexample pair — Gumshoe's "Criminals (organised)" (parenthetical is part of the name) vs. Crooked's "Protective amulet (1-armour magic recharge)" (parenthetical is the description). Colon-derived splits are safe by default; parenthesis-derived ones need a content read every time.
- **Adjacent scope gap, flagged not acted on**: The Monstrous's "Pure Drive" — an already-authored *Phase 5 bespoke option* — contains its own creation-time inline pick ("Pick from: hunger, hate, anger…"), recorded as structured data nowhere. This phase scopes picks inside **Moves**; picks inside **bespoke options** are a separate question raised with Skyler.

## Process note

Two of the four questions came back as "I have no idea what this refers to" — both the ones where I named a category I'd coined during analysis ("in-play menu," "bounded-repeatable free text") and described it by its properties rather than quoting the playbook text it came from. Both were answered immediately once a verbatim same-playbook example was supplied (The Visitor's Something Strange vs. Taste of Home made the Q1 distinction self-evident). **Second consecutive round with this failure** (the first was the Expatriation derived-vs-stored explanation). Standing correction: lead with the real quoted source, let the coined category name come second or not at all.

Full detail: `docs/hunter-playbooks/custom-moves-ideation.md`. Schema: `docs/hunter-playbooks/architecture.md` Section 6.8.
