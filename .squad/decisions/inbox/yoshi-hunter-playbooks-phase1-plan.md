**SUPERSEDED 2026-08-25** — the doc this entry describes (`docs/hunter-playbooks/hunter-playbooks-plan.md`) was deleted by Skyler; more consideration was needed before committing to an approach. A fresh, narrower-scoped pass replaced it: see `.squad/decisions/inbox/yoshi-hunter-playbooks-phase1-plan-v2.md` and `docs/hunter-playbooks/`. Left in place (not deleted) for history; do not treat the "What"/"Why" below as current.

---

# Hunter Playbooks — Phase 1 Plan

**By:** Yoshi (Architect)
**Date:** 2026-08-24

## What

Wrote `docs/hunter-playbooks/hunter-playbooks-plan.md`: a Phase 1 architecture plan for a new "Hunters" domain (MOTW player-character playbooks), sized to the same tier as the existing Monster feature (not the Mystery wizard). Key calls:

- **Confirmed the actual playbook set from the source PDF is 28**, not the 13 the task brief guessed (several real playbooks — Chosen, Crooked, Curse-eater, Forged, Interface, Mundane, etc. — were either missing from the brief's list or nearly missed by a naive extraction grep due to PDF column-layout artifacts).
- **Data model: a `Playbook` reference/lookup entity with normalized child tables** (`PlaybookStatArrayOption`, `PlaybookMove`, `PlaybookGearCategory`→`PlaybookGearOption`) extending the existing `MonsterArchetype`/`WeaponTag`+bridge-table precedent, **not** a JSON blob (zero precedent anywhere in this API project) and **not** one table per playbook (28+ tables, no shared query surface). `Hunter` links to its `Playbook` and to the specific moves/gear it picked via `HunterMove`/`HunterGearSelection` bridge tables.
- **Two deliberate, stated exceptions to full normalization**: gear option mechanical detail (harm/range/tags) stays free text rather than decomposed columns (no uniform taxonomy across playbooks' gear, and no play-state consumer yet); the 5 playbooks with genuinely bespoke mechanics (Envoy's Task+hold, Divine's Mission, Monstrous's Breed, Wronged's Who-You-Lost, Haven references) get a single free-text `UniqueMechanicText` field on `Playbook` rather than five one-off mini-schemas.
- **Scoped out MOTW's own "History" step** (per-other-hunter relationship prompts) as a `Background` free-text field, since it's structurally a cross-hunter binding the brief explicitly excludes from Phase 1.
- **Seed data**: recommended breaking the existing `MotwDbInitializer` inline-C#-+-hand-mirrored-SQL convention for this domain specifically — volume (~1,000+ rows across nested tables) doesn't fit inline object literals; recommended a JSON seed file inside the API project as sole source of truth, no SQL mirror, flagged as an explicit precedent break for Skyler to confirm.
- Full nav/routing/service/controller naming given concretely (`PlaybooksController`, `HuntersController`, `core/hunter.ts`, `core/playbook.ts`, `HunterFormComponent` shared between create/edit, exact `page-layout.ts`/`domain-icon.component.ts`/`icon-sprite.component.ts` edit points).

## Why

Per the task's explicit ask for a concrete recommendation (not an undifferentiated options list) among "one Hunter + JSON," "one table per playbook," or "lookup table + child tables" — resolved by grepping the codebase for actual precedent (no JSON columns exist anywhere; a smaller-scale version of the lookup+children shape already exists and works) rather than abstract preference. The two exceptions were added because the PDF's actual content isn't uniform enough to force 100% normalization without inventing schema the source material doesn't have — evidenced directly from reading multiple playbooks in full, not assumed.

Full detail, open questions (7, incl. live play-state tracking, PUT-in-Phase-1, playbook admin-authorship, seed SQL mirror), and sequencing: `docs/hunter-playbooks/hunter-playbooks-plan.md`.
