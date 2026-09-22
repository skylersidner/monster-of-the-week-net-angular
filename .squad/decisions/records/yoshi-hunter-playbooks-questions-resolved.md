# Hunter Playbooks — All 8 Open Questions Resolved (Second Same-Day Correction)

**By:** Yoshi (Architect)
**Date:** 2026-08-25 (same day as `yoshi-hunter-playbooks-seeding-correction.md`)

## What

Skyler answered all 8 open questions from `open-questions.md`. Recorded each as resolved with its answer, and propagated consequences into `architecture.md`/`phases.md`/`README.md` — several changed concrete decisions, not just closed a question mark:

- **1a/1b (authoring workflow) — the biggest change.** The canonical 28 are authored by an AI agent calling the real `PlaybooksController` API, one bounded task per playbook, not a human typing into the Phase 3 Admin UI form (which is now explicitly a testing/manual-tweak surface only). The production-seed conversion is a one-off script, run once when the full 28-playbook effort (standard + bespoke) is essentially done — not incrementally per phase. This had a real second-order effect: the "per-playbook idempotency guard" I'd designed in the prior correction (to handle the canonical set growing across separately-seeded phases) is no longer needed or correct, since seeding is now a single one-time event — reverted to the same blanket per-table `AnyAsync()` guard every other lookup table already uses.
- **2 (`BasicMove`)**: real DB reference table, not a frontend constant — Skyler wants to tweak its content over time.
- **3 (sub-resource endpoints)**: none at all — one upsert-the-graph endpoint per playbook, full stop. Simplified Phase 3's frontend materially (no batching/partial-failure handling needed, unlike Monster's equivalent page).
- **4 (template/instance linkage)**: Hunters stay live-linked to their Playbook via FK (`Hunter.PlaybookStatArrayOptionId`), not snapshotted — Skyler doesn't expect playbooks to change much, and wants propagation to existing Hunters when they do.
- **5 (bespoke rulesets)**: acknowledged, no doc change — Skyler has their own Phase 5 plan.
- **6 (Hunter–Mystery)**: confirmed eventually M:N, Hunter instances only, never Playbooks — no schema change now, no conflict anticipated.
- **7 (bespoke content in create form)**: confirmed as anticipated — first pass is standard fields + placeholder text only.
- **8 (Path B promotion)**: confirmed — no auto-propagation beyond the 28 for now, no mechanism built.

**One new open question raised, genuinely unresolved**: what verification/review happens between an agent authoring one canonical playbook and moving to the next. Skyler's own reasoning for preferring one-by-one authoring implies a checkpoint is wanted, but nothing specifies what it is yet (human diff vs. PDF, agent self-verification against a known-artifact checklist, spot-checking, etc.) — worth settling before Phase 4's first agent-driven authoring pass runs.

## Why

Full reasoning for each resolution and its propagated consequences: `docs/hunter-playbooks/open-questions.md` (resolution log), `docs/hunter-playbooks/architecture.md` Sections 2/3/4/6, `docs/hunter-playbooks/phases.md` Phases 2/3/4/6/7/8/9.
