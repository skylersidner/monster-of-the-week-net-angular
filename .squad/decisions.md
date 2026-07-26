# Decisions

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

