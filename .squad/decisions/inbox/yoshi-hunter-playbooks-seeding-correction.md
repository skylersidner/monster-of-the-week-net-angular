# Hunter Playbooks — Seeding/Deployment Recommendation Corrected

**By:** Yoshi (Architect)
**Date:** 2026-08-25 (same day as `yoshi-hunter-playbooks-phase1-plan-v2.md`)

## What

Rewrote `docs/hunter-playbooks/architecture.md` Section 4 after Skyler flagged a real misconception in the first version. Corrected recommendation, split into two paths:

- **Path A (primary, code-based, automatic-everywhere)**: the canonical 28-playbook set is authored once via the Phase 3 Admin UI (against a local/dev DB, validating the Phase 2 data model), exported into a checked-in `Data/Seed/hunter-playbooks.json`, and seeded into every environment automatically by extending `MotwDbInitializer` — the same mechanism already used for `AdventureType`/`MonsterArchetype`/`MonsterType`/`WeaponTag` etc., re-confirmed by reading `Program.cs` (runs unconditionally on every startup including the Railway production deploy). One deliberate deviation from the existing per-table `AnyAsync()` seeding guard: Playbooks need a **per-playbook** idempotency check, since (unlike every other seeded table) this dataset is expected to grow across Phase 4 → Phase 7 → beyond.
- **Path B (Admin-UI-authored one-offs)**: templates Skyler creates directly via the Admin UI after the canonical set exists are ordinary CRUD rows in whichever database is running — not expected to auto-propagate, matching how every other reference-data addition in this app already behaves.

Updated `phases.md` (Phase 3's purpose note, Phase 4 fully rewritten around the author→export→commit→seed workflow, Phase 7 confirmed as "same mechanism, more data"), `README.md` (status note + Phase 3/4/7 summary lines), and `open-questions.md` (Q1 reframed from "does the Admin UI need bulk-paste" to the export-tooling-shape and remaining-authoring-effort questions; new Q8 on whether Path B content should ever be promotable to Path A).

## Why

The first version reasoned from "Phase 3 adds an Admin UI for Playbooks" directly to "therefore the Admin UI is how playbook data reaches every environment" — without separately checking whether a UI can satisfy an "automatic in every environment" requirement at all (it can't: every environment's DB is independent, so UI-entered data stays wherever it was entered). Skyler's own words: "I prefer not to manually enter every playbook in... These templates are standard and I will want them in every environment, just like the static tables." The corrected design re-adopts the shape of the prior (deleted) pass's JSON-seed-file idea, but justified specifically by the distribution requirement rather than by data volume alone — a different, better-grounded reason for a similar-looking mechanism, not a reflexive revert.

Full detail: `docs/hunter-playbooks/architecture.md` Section 4.
