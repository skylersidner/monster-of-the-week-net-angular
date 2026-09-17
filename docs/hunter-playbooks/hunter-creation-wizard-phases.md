# Hunter Creation Wizard — Phased Implementation Plan

See `hunter-creation-wizard.md` for the design, the reviews and every decision behind the items below. This document is the execution breakdown. Section numbers such as "12.9", "13.5" and "14.6" point into that doc, which stays the source for detail. The format follows `docs/search/phases.md` and `docs/simple-authentication-update/phases.md`.

**Status: Phases 0–7 implemented and verified as of 2026-09-15** (Toad's F9 browser pass, including the legal-build pass over all 28 playbooks, plus re-checks of the dark-theme and narrow-width fixes it prompted). Planned 2026-09-14. Written by Yoshi (Architect) at Skyler's request:

> In reviewing the hunter creation wizard document, I confess that I was not expecting 2000 lines.  Can we have Yoshi put together a phased approach (like most of the work done on this project) to implement this plan?  Put that into a new markdown document that will summarize the work going into the phases, and this document can be used for detailed specifics.

Everything outside that quote, and outside the stakeholder quote in Phase 0, is mine.

---

## How the phases are cut

- **One phase per release.** The web app and the API ship as one image, and migrations run at startup (14.2). So a phase is what goes live together, not who writes it. Phase 0 is the wipe that comes first; Phases 1–7 are releases R1–R7 (14.6).
- **Order:** 0 → 1 → 2 → 4 → 5 → 6 → 7. Phase 3 has no dependencies and can ship at any point before Phase 7; earlier is better.
- **Risk sets the model:** Opus for Medium- or High-risk phases, Sonnet for Low-risk ones.
- **Estimates** are Luigi's frontend working days, specs included (13.16), about 18.5 in total. The detailed doc doesn't estimate backend work.
- **Tests ship inside each phase.** The implementing agent writes them, from 13.15 and the backend test lists in Section 12. Toad owns the manual and browser verification passes named below. The 2026-08-30 decision in `phases.md` to test after implementation covered Hunter Playbooks Phases 1–10 and was delivered on 2026-08-31. This plan doesn't follow it, because Phase 4's safety-net spec has to exist before Phase 4 changes any code.
- **Doc and record updates ship with the phase that makes them true** (14.8).
- **Not in scope:** the hunter advancement / hunter sheet design withdrawn on 2026-09-12. Nothing here reintroduces it.

## At a glance

| Phase | Release | Goal | Detailed ids | Owners | Risk | Est. |
|---|---|---|---|---|---|---|
| **0** | before R1 | Wipe test hunters (**confirm with Skyler first**) | B2 | Bowser | Low | — |
| **1** | R1 | Move limits count the moves a playbook grants | B1, B3, F0 | Bowser, Luigi | Low | 0.5 |
| **2** | R2 | Live form fixes and request hardening | F1, B4, B9 | Luigi, Bowser | Low | 1 |
| **3** | R3 | Shared wizard tracker and layout, Mysteries first | F4 | Luigi; Toad | Medium | 2 |
| **4** | R4 | Extract the hunter draft | F2 | Luigi; Toad | **High** | 2 |
| **5** | R5 | Shared sections and the check endpoint | F3; 12.8 backend | Luigi, Bowser | Medium | 1.5 |
| **6** | R6 | Pick rules, end to end | 12.9 backend (S1–S12); F8a, F8b, F8c | Bowser, Luigi; Toad | **High** | 3 |
| **7** | R7 | The Hunter creation wizard | F5, F6, F7, F9 | Luigi; Toad | Medium | 8.5 |

**Where the other defaults land:**
- Y1–Y2: this plan's release grouping.
- Y3–Y7, Y9, Y12, Y15 and Y16: Phase 6.
- Y8: Phase 5.
- Y10: Phase 4.
- Y11: Phase 3.
- Decisions not to build something, so no phase: B5–B8, B10, Y13 and Y14.
- Frontend defaults L1–L33 land with the F phase that introduces them (13.17).

---

## Phase 0 — Wipe test hunters (before R1)

**Risk: Low.** It's destructive, but Skyler's stakeholder note says: "any existing hunters in the DB are just test data and should be wiped before the work begins." **Confirm with Skyler immediately before running it, on each database.** Nothing has been run.

- **Goal:** start from zero hunters, so nothing needs auditing, protecting or migrating.
- **Work:** Bowser runs B2's single transaction on each database that holds hunters: delete bespoke selections first, then hunters. Playbook data isn't touched.
- **Exit:** `SELECT COUNT(*) FROM hunters` returns 0 on each database, and the playbook row count is unchanged.
- **Later:** B2 offers an optional second wipe before Phase 6. It needs the same confirmation. No test depends on keeping hunters (see Phase 6's fixture note).
- **Detail:** stakeholder note at the top of the doc; 12.6 B2.

## Phase 1 — Move limits count the moves a playbook grants (R1)

**Risk: Low.** A code-only fix to a live bug. No migration, seed or contract change.

- **Goal:** `MoveGrantCount` means the printed total, including required moves (Q1). This fixes The Chosen, The Curse-Eater and the 12 other playbooks with required moves.
- **Work:**
  - **B1:** the pick budget becomes `MoveGrantCount − required` in `HunterService.Validate` and `HunterCompleteness`.
  - **F0:** the form's counter and limit use the same budget, in the same change.
  - **B3:** `PlaybookService` refuses a playbook with more required moves than its grant.
- **Exit:**
  - A seed-driven test over the 14 playbooks: an exact budget reports no "Moves:" line, and one extra pick is refused.
  - `PlaybookServiceTests` refuses required > grant.
  - `hunter-form.spec.ts` fixture changes from 2 to 3, plus a limit-reached case.
- **Docs:** `architecture.md` §2 and §8 item 3; `phases.md` gains its wizard entry.
- **Detail:** 8 (Gap 1), 12.3, 13.16 (F0).

## Phase 2 — Live form fixes and request hardening (R2)

**Risk: Low.** Fixes on today's hunter pages, landed before the draft is extracted.

- **Goal:** clear the live bugs on today's hunter pages before any code moves.
- **Work:**
  - **F1** (13.11, items 1–6):
    - history prompts rendered as text;
    - granted gear shown as a read-only list;
    - the History retitle;
    - one toast per refused save, including admin playbook save and delete;
    - the playbook-load race;
    - a numeric leaf starting at its maximum.
  - **B4:** `[MaxLength(255)]` on hunter name, pronouns and entry name.
  - **B9:** stale comments.
- **Depends:** Phase 1, which touches the same file.
- **Exit:**
  - Specs for each F1 item.
  - A 256-character name returns a 400, not a 500.
  - A refused hunter save or admin playbook save shows exactly one message.
- **Detail:** 13.11, 13.12 (item 14), 12.2, 12.6 (B4, B9), 13.17 (L9).

## Phase 3 — Shared wizard tracker and layout, Mysteries first (R3)

**Risk: Medium.** It changes the working Mystery wizard, with visible changes by design (Q9).

- **Goal:** one presentational tracker and one layout shell in `shared/wizard/`, with the Mystery wizard moved onto them.
- **Work:**
  - `WizardTrackerComponent`: columns generated from the step count, and the "current step always wins" fix.
  - `WizardLayoutComponent`: scroll reset, heading focus, and a single-column layout with a compact tracker below `md`, for both wizards.
- **Ships alone** (Y11), at any point before Phase 7.
- **Exit:**
  - Both Mystery specs green with no assertion changes.
  - New tracker and layout specs.
  - Toad's visual check of the Mystery wizard in both themes, create and edit, at desktop width and at 375px.
- **Docs:** `luigi-theming-phase6-mystery-wizard.md` §6 (bug fixed); `multi-minion-wizard-design.md` (narrow layout).
- **Detail:** 4, 5, 13.3, 13.4, 13.15 (item 9), 14.5.

## Phase 4 — Extract the hunter draft (R4)

**Risk: High.** The only phase that can silently damage saved hunters on the edit page.

- **Goal:** all hunter form state, and the single request builder, move into an injectable `HunterDraft`. The edit page delegates to it with no change in behaviour.
- **Work:**
  - The characterisation spec comes first.
  - Then `HunterDraft`: a `FormGroup` read through a `getRawValue` signal, the pick signals, prune, the untick clear, and `toRequest()`.
- **Depends:** Phase 2. **Ships alone** (Y10).
- **Exit:**
  - The characterisation spec passes unchanged against `toRequest()`, and the draft specs pass.
  - Toad diffs `GET /api/hunters/{id}` before and after, on three fully populated hunters created after Phase 0: a Hex with Rotes, a Curse-Eater with a journal entry, and a Forged with a freeform look.
- **Docs:** a limited supersession recorded in `.squad/decisions.md` (2026-07-21) and `angular-wizard-decomposition/SKILL.md`.
- **Detail:** 13.5, 13.15 (items 1–2), 14.5.

## Phase 5 — Shared sections and the check endpoint (R5)

**Risk: Medium.** Changes the hunter create path on the server, and recomposes the edit page.

- **Goal:** the edit page is built from shared section components. The server gains `POST /api/hunters/evaluate`, which is live but unused until Phase 7.
- **Work:**
  - **F3:** shared section components. The edit page's visible changes, the ratings grid and History retitle (L16), are called out in the release note.
  - **12.8:** one build step shared by Create and Evaluate.
  - **12.8:** `HunterCompleteness` returns structured items in a full, fixed order (O2, Y8). `Outstanding` strings are unchanged.
- **Depends:** Phase 4.
- **Exit:**
  - Section component specs.
  - Evaluate writes no rows.
  - Evaluate and Create return identical messages, including a Fate build with two short categories and a Searcher build with answers under two move sections.
  - A refusal returns no list.
  - A malformed request gets a 400.
- **Docs:** `architecture.md` §9 (check endpoint, structured items); `phases.md` "Hunter completeness"; a dated update to the 2026-08-31 completeness record.
- **Detail:** 12.8, 12.8.1, 13.6, 14.4.

## Phase 6 — Pick rules, end to end (R6)

**Risk: High.** It carries the plan's only migration, including Postgres-only data SQL that no automated test runs. It also changes save rules for three playbooks, and the server and client halves must ship together.

- **Goal:** enforce the Initiate's weapons, Natural Attacks and Combat Magic on every hunter surface.
- **Backend (Bowser):**
  - **Schema:** `AddPickRules`, which adds four tables, check constraints and two unique indexes.
  - **Data:** a guarded migration per playbook, plus the re-exported seed, in one commit.
  - **Evaluation:** one shared `PickRules` helper used by both `Validate` and `HunterCompleteness`.
  - **Playbook contract:** gains `pickRules`; omitting it leaves rules unchanged.
  - **Validation:** kept rules are checked after the playbook loads, and a conflict returns a 409; graph checks.
  - **Output:** a fixed wire order, and messages built from data.
- **Frontend (Luigi):**
  - **F8a:** the admin form lists rules read-only and omits `pickRules` on save.
  - **F8b:** the Initiate's gear limits, counters and hints.
  - **F8c:** Natural Attacks and Combat Magic locks and hints.

  F8b and F8c apply on both the edit page and the still-live single-page create.
- **Y16 is settled:** Bowser agreed on 2026-09-14. The shared condition for "This depends on your {section title} picks." is already in 12.9 step 4 and its tests (14.3.6).
- **Ships together, as one deploy:** Skyler confirmed "Ship together in R6" on 2026-09-14 (14.6, S10).
- **Depends:** Phase 5.
- **Exit:**
  - `PickRulesTests`, and the frontend lookup specs, both driven from 12.9's build tables.
  - Tests through the check against the real seed.
  - `PlaybookServiceTests`: removing a governed target or trigger with `pickRules` omitted returns a 409, and deleting each playbook cascades cleanly.
  - The L33 renamed-titles spec.
  - Bowser's manual Postgres pass: three migration paths, a byte-identical re-export, and deleting a Hex hunter with picked Rotes.
  - A post-deploy query confirms each of the three playbooks has one rule.
- **Over-limit hunter fixture (proposed default, for Phase 6 and Phase 7 testing).** 13.15 item 10 checks that an existing over-limit hunter shows L30's notice on the edit page. Once Phase 6 is live, the server refuses to save such a hunter, and Phase 0 wipes any older ones. So the fixture is inserted directly and never reaches production:
  - **API tests:** the hunter rows are added straight to the SQLite test database, bypassing `Validate`. Example: a Monstrous with two Bases and an Extra.
  - **Browser pass:** Bowser supplies a short SQL insert for the same hunter, and Toad runs it against the local test database before the pass.
  - No pre-R6 test hunter needs to be kept, so B2's optional second wipe stays available.
- **Docs:**
  - a new `architecture.md` §6 subsection holding the schema, plus §9's pick-rule and Q10 notes;
  - `bespoke-ruleset-catalogue.md` (three entries);
  - the authoring skill and `verify.mjs`;
  - the Combat Magic decision record;
  - `phases.md` Follow-on 10b.
- **Detail:** 12.9, 12.11, 12.12, 13.5 (pick rules on the client), 13.6, 13.7, 14.3.

## Phase 7 — The Hunter creation wizard (R7)

**Risk: Medium.** Replaces a live create page, but builds on everything above.

- **Goal:** `/hunters/new` becomes the eight-step wizard. Create saves once and lands on `/hunters`.
- **Work:**
  - **F5:** the wizard core. That covers the store, the steps, the step 1 gate, the Rules dots, the dossier and Create. Create mode is retired from `HunterFormComponent`.
  - **F6:** the check runs on every step change, and again after a pause in edits on step 8. It drives the tracker marks, the "Still to finish" card and the refusal band with its links.
  - **F7:** the playbook-switch confirmation, the discard guard, the unload prompt, and standing aside on sign-out.
  - **F9:** Toad's verification pass.
- **Ships together:** F5, F6 and F7.
- **Depends:** Phases 3 and 6.
- **Exit:**
  - Store, tracker-mark and guard specs (13.15 items 5–7).
  - Toad's browser pass in both themes, at desktop width and at 375px, including a legal-build pass over all 28 playbooks (13.15 item 10).
- **Docs:**
  - `architecture.md` §8: a dated note that create is now the wizard;
  - `phases.md` Phase 10 note;
  - the wizard doc's status line.
- **Detail:** 3, 4.2–4.3, 7, 13.7–13.10, 13.15, 13.16.

---

## Open items carried into the phases

None. Y16 was agreed by Bowser on 2026-09-14 (12.9). The over-limit hunter fixture is decided under Phase 6. Before Phase 0 runs, the wipe still needs Skyler's confirmation.
