**CORRECTED same day, 2026-08-26**: item 1 below ("standard-section Description fields too") was narrowed by Skyler later the same day — the formatting-fidelity requirement applies to the **Moves section specifically** (`PlaybookMove.DescriptionText`), not standard Description-type fields generally. Every other standard section (ability ratings, luck/harm/experience, gear, pronouns, looks, history, improvements, advanced improvements) stays plain text. Left the original text below for history rather than rewritten; treat this note as the current statement of item 1. Also: Bowser's extraction-pipeline spike (referenced below as in-progress) is now confirmed resolved — a pdf.js-based pipeline, approved for use, no Angular/Luigi preview UI needed. See `docs/hunter-playbooks/phase5-bespoke-ideation.md` and `architecture.md`/`phases.md` for the corrected, current text.

---

# Hunter Playbooks — Formatting-Fidelity Process Gate + Chosen's Fate Structure

**By:** Yoshi (Architect)
**Date:** 2026-08-26

## What

Two concrete decisions from Skyler (distinct from the still-open Section 3 bespoke-ruleset framework in `phase5-bespoke-ideation.md`, which remains "leaning toward," not locked):

1. **Phase 2 scope gap confirmed, process change added.** The formatting-fidelity requirement (preserve bold/italic/bulleted lists as a constrained HTML subset — `<b>`/`<i>`/`<ul>`/`<li>`) applies to standard-section Description fields too, not just bespoke option descriptions — a genuine miss in the original Phase 2 pass, caught only once Phase 5 ideation surfaced the same underlying need. `PlaybookMove.DescriptionText` is the concrete flagged example (custom-move roll-result breakdowns use bulleted lists in the source). **New gate**: Phase 4 gains an explicit checkpoint — Skyler personally validates formatting fidelity is correctly captured across the 3 pilots' standard fields before Phase 5 is allowed to proceed.
2. **Chosen's Fate structure decided directly by Skyler, not re-derived.** One `BespokeSection` ("Fate"), not three independent ones. `MinSelect=3, MaxSelect=3` at the top level (all three categories mandatory). Three top-level `BespokeOption` rows act as category dividers (How You Found Out: 1-of-7 children; Heroic: 2-of-~12; Doom: 2-of-~14). Reasoning given: the source PDF's own layout for Fate is unusually messy (blurb separated from options, closing description only makes sense for the last two categories) — Skyler is explicitly fine handling that by hand later via the Admin UI during per-playbook review, not solving it perfectly in the pipeline/schema.

**Separately, not a decision captured here**: the extraction-pipeline gap (can't verify bold/italic positions from `pdftotext -layout`'s plain-text output) is now an active spike owned by Bowser, dispatched by the coordinator in parallel — with a concrete acceptance test (Crooked's "Hoodlum" Background option: `Title = "Hoodlum"`, `DescriptionText = "You can use Tough instead of Charm to <b>manipulate someone</b> with threats of violence."`). Not this role's action item; noted in the docs, not designed here.

## Why

Full reasoning: `docs/hunter-playbooks/phase5-bespoke-ideation.md` (Section 3's Fate walkthrough, Section 4's cross-cutting-consequence paragraph), `docs/hunter-playbooks/architecture.md` (Phase 2/Moves section), `docs/hunter-playbooks/phases.md` (Phase 4), `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` (Chosen/Fate entry).
