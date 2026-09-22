# Hunter Playbooks — Moves `Required` Field (Rename, Not New) + Zero-Bespoke Catalogue Convention

**By:** Yoshi (Architect)
**Date:** 2026-08-27

## What

Two decisions from processing The Celebrity (5th playbook in Skyler's one-at-a-time bespoke-ruleset walkthrough):

1. **`PlaybookMove.IsAutoGranted` renamed to `Required`** (`architecture.md` Moves section + Section 3 schema, `phases.md` Phase 2). Celebrity's always-granted "Fakelore" move (alongside a separate pick-2-of-7 pool) was flagged as a possible new Moves-schema gap needing a "required" concept. Checked first: the schema already had this exact capability under a different name, originally built and validated against Chosen's identical shape (2 pre-granted moves + pick-1-of-5 pool). **Net change is a rename only, not new schema or new modeling work.**
2. **New standing catalogue rule**: a playbook confirmed to have zero bespoke ruleset content (The Celebrity is the first case) gets an explicit `## The [Playbook]` heading stating "No bespoke ruleset found — confirmed by reading both pages in full," not a silent omission. Written into `bespoke-ruleset-catalogue.md`'s own convention section so it applies to every future zero-bespoke playbook in the walkthrough, not just this one.

**Explicitly not done, per Skyler's instruction**: no `Required`-equivalent added to the bespoke `BespokeSection`/`BespokeOption` model. Flagged in `phase5-bespoke-ideation.md` as something to watch for if a future bespoke ruleset demonstrates the need — not designed preemptively.

## Why

Checking the existing schema before treating a stakeholder's request as new work avoided duplicating an already-solved concept under a second name. The zero-bespoke convention rule exists because a checked-negative result and an unprocessed playbook need to be distinguishable by anyone scanning the catalogue, not just inferable from the progress-tracker line — with 24 more playbooks still to come, worth settling once rather than letting it drift.

Full detail: `docs/hunter-playbooks/architecture.md`, `docs/hunter-playbooks/phases.md` Phase 2, `docs/hunter-playbooks/phase5-bespoke-ideation.md`, `docs/hunter-playbooks/bespoke-ruleset-catalogue.md`.
