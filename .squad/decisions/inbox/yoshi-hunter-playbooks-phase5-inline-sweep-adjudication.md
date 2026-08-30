# Hunter Playbooks — Phase 5 Inline-Pick Sweep: Adjudication of All 14 Candidates

**By:** Yoshi (Architect)
**Date:** 2026-08-30
**Status:** Resolved. One correction applied to `bespoke-ruleset-catalogue.md`; 13 candidates rejected with reasons recorded.

## What

Phase 6's tooling work gave the extraction pipeline inline comma/semicolon option-run detection, which it previously lacked entirely. Because every Phase 5 catalogue entry was authored with the older (bulleted-only) tooling, Skyler sanctioned reopening the completed catalogue and re-sweeping all 28 playbooks. Bowser's sweep (detection only — it deliberately never read the catalogue) produced **123 raw hits → 14 in Phase 5 bespoke scope, 10 high-confidence.**

**Adjudicated result: exactly 1 genuine gap.**

| Candidate | Adjudication |
|---|---|
| **Monstrous / Curses / Pure Drive** (p37, 11 options) | **GENUINE GAP — corrected.** Remodeled from prose to a nested `MinSelect=1/MaxSelect=1` child pick with 11 title-only options. No new schema. |
| Crooked / Underworld ×4 (p12) | Already modeled — all four nested pick-1-of-4 sub-choices are structured sub-options. |
| Visitor / Expatriation lines ×3 (p56, 20 descriptors) | Already modeled — all 20 tags are title-only children under Line 1/2/3. |
| Snoop / Crew jobs (p48, 9) | Deliberate stakeholder decision — Skyler's explicit "instructions-only" call. Left unchanged; re-raised, not overridden. |
| Chosen / Special Weapon "Material" (p7, 9) | Out of bespoke scope — Special Weapon is **Gear**, already modeled as three `PlaybookGearCategory` rows in `architecture.md` §2. |
| Crooked / Burglar, Fixer (p11) | Correctly prose — roll-outcome-gated in-play menus, which Phase 6 Q1 settled as prose. |
| Gumshoe / Code sentence (p25) | Not a pick — commas separate adjectives in one clause, not options. |
| Professional / Agency goal question (p44) | Not remodeled — an instance of the known "Description asks a worldbuilding question with no home for the answer" pattern Skyler explicitly declined to retrofit broadly. |

Also checked per the brief: **"Look, pick one from each list:"** (all 28 playbooks) is correctly binned as standard sheet furniture — **Look is already modeled** in the Phase 2 standard-sections model (`PlaybookLookCategory` → `PlaybookLookOption`, `architecture.md` §2/§3). No gap.

## Why

**The detection step and the adjudication step do genuinely different work, and conflating them would have caused real damage here.** Bowser's sweep detects *structure present in the source* and — correctly, by design — never read the catalogue, so it cannot distinguish "this is a real pick in the PDF" from "this is missing from our model." Seven of the ten high-confidence hits are real picks in the source that are **already fully modeled**. Acting on the hit list without adjudication would have meant re-modeling content that was already correct, and in Snoop's case overriding an explicit stakeholder decision.

**Each rejection has a distinct reason, and they aren't interchangeable**: already-modeled (7), deliberate stakeholder call (1), out-of-scope-for-this-catalogue (1), correctly-prose-per-a-settled-decision (2), not-actually-a-pick (1), known-pattern-Skyler-declined-to-retrofit (1). Recording them in the catalogue itself rather than only here, so the same candidates aren't re-raised by a future sweep and so the sweep's own output stays auditable rather than being taken on trust.

**Pure Drive needed no new schema** — a top-level option with its own nested pick-1-of-N children is exactly Crooked's Underworld shape, validated since the first pilot pass. It was missed originally for a purely mechanical reason: its option list is an inline comma run inside a sentence, and the tooling of the time could only see bulleted lists, so it read as ordinary description prose.

**The catalogue's COMPLETE status was amended rather than quietly patched.** The status block now states that the file was reopened, why, under whose sanction, what the sweep found, and the full adjudication — a doc marked COMPLETE that silently changes is worse than one that records its own correction.

## Consequences and flags

- **The Crooked now carries a second, independent sequencing risk.** It's a Phase 4 pilot playbook; the Phase 6 census already found two in-move picks on it, and this sweep found four Underworld sub-picks (already modeled, but the point stands that Crooked is unusually structure-dense). Nothing here changes the Phase 4 sequencing flag already raised — it reinforces it.
- **Two items re-raised for Skyler, deliberately not acted on**: Snoop's Crew job list (previously decided "instructions-only"; the sweep is new information if Skyler wants to revisit) and Professional's Agency goal question (the known unanswered-worldbuilding-question pattern). Both are consistent with standing decisions as they are; neither is a defect.
- **No schema change of any kind resulted from this sweep.**

Detail: `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` (status block + `## The Monstrous`). Sweep source: `.squad/decisions/inbox/bowser-hunter-playbooks-phase5-inline-pick-sweep.md`.
