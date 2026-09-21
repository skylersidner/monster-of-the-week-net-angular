# Mystery Creation Wizard — Luigi's Implementation Decisions

**Date:** 2026-07-21  
**Component:** `mystery-create` wizard  
**Author:** Luigi (Frontend Developer)

---

## Decision: Phase-Level API Submission

**Context:**  
The mystery creation wizard has four phases (Mystery, Monsters, Locations, Bystanders). We needed to decide when to save data to the backend.

**Decision:**  
Submission happens at phase transitions (when clicking "Next" on the last step of a phase), NOT at the very end.

**Rationale:**  
- Creates the Mystery entity early (after Phase 0) so we have an ID for child entities
- Allows progressive saving — if the user leaves mid-wizard, Phase 0 data is already persisted
- Monsters must exist before we can attach attacks/powers/weaknesses (need parent IDs)
- Matches the "accumulating dossier" mental model: each phase locks in and becomes part of the permanent record

**API Call Sequence:**  
- Phase 0 → 1: `POST /api/mysteries` → `PUT /api/mysteries/{id}/countdown`
- Phase 1 → 2: `POST /api/mysteries/{id}/monsters` (monster + sub-items), then minion if non-empty
- Phase 2 → 3: `POST /api/mysteries/{id}/locations` for each location
- Phase 3 → finish: `POST /api/mysteries/{id}/bystanders` for each bystander → navigate to detail page

---

## Decision: Signal Arrays for Sub-Items (Not FormArrays)

**Context:**  
Attacks, powers, weaknesses, locations, and bystanders are accumulated in lists as the user adds them. We needed to decide between FormArray or signal-based arrays.

**Decision:**  
Use signal arrays (`signal<AttackDraft[]>([])`) with inline "add item" forms, NOT FormArrays.

**Rationale:**  
- FormArrays are complex and create deeply nested reactive structures
- Signal arrays are simpler to read, update, and display in the template
- The inline "add item" form pattern is more intuitive: fill out fields, click "Add," item appears in the list
- Sub-items are only submitted at phase transitions (not validated per-step), so FormArray's per-control validation isn't needed
- Aligns with Angular's signals-first reactive programming model

**Pattern:**  
Each sub-item type has a dedicated `add{Type}Form` (e.g., `addAttackForm`). On submit, validate the form, push to the signal array, reset the form. Each listed item has a remove button that splices from the array.

---

## Decision: Minion Step Is Optional

**Context:**  
Not every mystery has minions. We needed to decide how to handle this in the wizard.

**Decision:**  
The minion form is fully visible (same as the monster form), but the Name field is optional. If the user leaves it blank and clicks "Next," the minion is skipped — no API call is made.

**Rationale:**  
- Matches the user's mental model: "I don't have minions" = leave the name blank
- Avoids conditional UI ("Show minion form?" checkbox) that adds friction
- Minion creation is wrapped in `if (!minionName) return of(null)` in `submitPhase1()`
- Keeps the wizard flow consistent (no branching paths)

---

## Related Files

- `src/app/features/mysteries/pages/mystery-create/mystery-create.ts`
- `src/app/features/mysteries/pages/mystery-create/mystery-create.html`
- `src/app/features/mysteries/pages/mystery-create/mystery-create.scss`
- `src/app/core/mystery.ts` (added `create()` and `upsertCountdown()`)
- `src/app/core/monster.ts` (added `create()`)
- `src/app/features/mysteries/mysteries.routes.ts` (added `/create` route)
