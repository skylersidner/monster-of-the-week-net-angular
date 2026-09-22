### 2026-07-21 (preserved 2026-09-21): The four entries that were `.squad/decisions.md`, verbatim
**By:** Luigi (Frontend Developer) — preserved by Koopa when `decisions.md` was retired

**Provenance.** This is the entire content of `.squad/decisions.md` as it stood on 2026-09-21, kept verbatim below because that file was retired on Skyler's instruction (`docs/engineering-practice-improvements-plan.md` §8, §10 item 4). Nothing here is new; nothing was edited.

**What it actually was.** Not a decision ledger. It is the *output of a single merge* run on 2026-07-25 (`986e52d`), which compressed **three** records totalling **405 lines** into 29 lines and **deleted all three**:

- `records/luigi-mystery-create-frontend-decomposition.md` (261 lines) — recovered from git 2026-09-21
- `records/luigi-mystery-create-wizard.md` (74 lines) — recovered from git 2026-09-21
- `records/luigi-armor-support.md` (70 lines) — recovered from git 2026-09-21, **on a second pass**; the first recovery enumerated the deletion set by filename pattern and missed it (see `.squad/decisions/README.md` §9)

That merge also **dropped a decision outright**: *"Minion Step Is Optional"* is in the second record and appears nowhere in the four entries below. It stayed invisible from 2026-07-25 until 2026-09-21, through the multi-minion work and through decision 19 of the mystery-entity-linking feature ("a monster is not required to complete the wizard") — which is the identical question one step over.

**Standing status of each entry, judged 2026-09-21:**

| Entry | Status | Where the reasoning now lives |
|---|---|---|
| Phase-Level API Submission | **Standing.** Cited as "the standing 2026-07-21 phase-transition submission decision" by `mystery-entity-linking.md` decision 12, and preserved intact by decision 15. | `records/luigi-mystery-create-wizard.md` |
| Signal Arrays for Sub-Items (Not FormArrays) | **Standing.** | `records/luigi-mystery-create-wizard.md` |
| Armor Support Added | **Historical, not a decision.** An implementation log, and its source record is one too. Not promoted. | `records/luigi-armor-support.md` — recovered 2026-09-21 |
| Frontend Decomposition Architecture, + the 2026-09-14 limited supersession | **Standing, with a recorded limited supersession.** | `records/luigi-mystery-create-frontend-decomposition.md`; the supersession exists only below |

**One fragment below is the only copy that exists anywhere**: the **2026-09-14 limited supersession** appended to the decomposition entry, which post-dates all three source records. That alone is why this file is preserved rather than deleted once its sources were recovered. Until `luigi-armor-support.md` was recovered the Armor entry was a second such fragment; it is not one any more.

---

## Verbatim content of the retired `.squad/decisions.md`

---

### 2026-07-21: Mystery Create Wizard — Phase-Level API Submission
**By:** Luigi (Frontend Developer)  
**What:** Submission happens at phase transitions, not at the end of the wizard. Phase 0→1 calls `POST /api/mysteries` then `PUT /api/mysteries/{id}/countdown`. Phase 1→2 posts monster + sub-items. This ensures the Mystery entity exists before child entities are attached and enables progressive saving.  
**Why:** Need a Mystery ID before attaching attacks/powers/weaknesses. Matches the "accumulating dossier" UX mental model.

---

### 2026-07-21: Mystery Create Wizard — Signal Arrays for Sub-Items (Not FormArrays)
**By:** Luigi (Frontend Developer)  
**What:** Sub-item lists (attacks, powers, weaknesses, locations, bystanders) use `signal<T[]>([])` with inline "add item" forms — not Angular FormArrays. Each sub-item type has a dedicated `add{Type}Form`; on submit, push to signal array and reset form.  
**Why:** FormArrays create deeply nested reactive structures. Signal arrays are simpler, align with the project's signals-first model, and sub-items are only validated/submitted at phase transitions.

---

### 2026-07-21: Mystery Create Wizard — Armor Support Added
**By:** Luigi (Frontend Developer)  
**What:** Implemented full armor support in the mystery create wizard for both monsters and minions, following the same draft → form → signal → submission pattern as attacks/powers/weaknesses. Uses existing `UpsertMonsterArmorRequest` interface and `monsterService.createArmor()` endpoint.  
**Why:** Pattern consistency across all sub-item types. Armor fields (`harmSoak`, `isSpecial`, `specialDescription`) match the API contract.

---

### 2026-07-21: Mystery Create — Frontend Decomposition Architecture (Pending Implementation)
**By:** Luigi (Frontend Developer)  
**What:** Decompose `MysteryCreateComponent` (~680-line TS, ~550-line template) by **phase**, not by step. Each phase component owns all its steps' forms in memory and submits as a unit at phase transition. A `MysteryCreateStore` injectable service (provided at route component level) owns navigation, submission state, accumulated draft arrays, and reference data. ReactiveForm instances stay in phase components. No NgRx — use `signal()` fields.  
**Why:** Steps within a phase are a UX concern (progressive disclosure), not an architectural boundary. Phase 0 has 4 steps but submits as one API call. Splitting by step would require premature state lifting.  
**Limited supersession (2026-09-14, Luigi, Hunter wizard Phase 4):** a draft that is submitted once may own its form. `HunterDraft` (`features/hunters/shared/hunter-draft.ts`) holds the hunter `FormGroup`, read through a `getRawValue` signal. One surface's sections share it and submit it as one request, so there are no sibling steps for form state to leak into, which is what this rule guards against. The rule still stands for anything that submits in separate phases. See `hunter-creation-wizard.md` 13.5 and 14.5.

