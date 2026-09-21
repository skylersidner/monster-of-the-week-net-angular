# Mystery Create — Frontend Decomposition Architecture Decision

**Date:** 2026-07-21  
**Author:** Luigi (Frontend Developer)  
**Status:** Recommendation (pending implementation)

---

## Context

The `MysteryCreateComponent` is a ~680-line TypeScript component with a ~550-line template and ~210-line SCSS file. It implements a 4-phase, 8-step wizard for creating a mystery. The entire feature lives in a single component: navigation logic, all forms, API submission, accumulated sub-item signals, step titles/blurbs, and the live dossier preview.

The team wants to refactor this into a decomposed, signals-friendly architecture that:
1. Preserves all current behavior
2. Enables browser-state persistence (sessionStorage/localStorage) at a later phase
3. Reduces cognitive load per file

---

## Decision: Decompose by Phase, Not by Step

**Steps within a phase are NOT component boundaries.** Each phase component owns all of its steps' forms in memory and uses `@if (currentStep() === N)` to show the active step's fields — exactly as the template does today. The phase component submits all step data as a unit at phase transition.

**Rationale:**
- Phase 0 has 4 steps (concept, hook, overview, countdown) but submits as one API call: `POST /api/mysteries` → `PUT /api/mysteries/{id}/countdown`. Splitting by step would require lifting draft form values into the store before they're ready to submit.
- Phase 1 has 2 steps (monster + minion) that share submission context (`monsterId` from the first POST needed before sub-item calls).
- Steps within a phase are a UX concern (progressive disclosure), not an architectural boundary.

---

## Proposed Component Inventory

### 1. `MysteryCreateStore` — Injectable Signal Service

**Provided at the route component level** (`providers: [MysteryCreateStore]` on `MysteryCreateComponent`). Scoped to wizard lifetime; destroyed on navigation away.

**Owns:**
- Navigation state: `currentPhase`, `currentStep`, `phaseComplete`, `mysteryId`
- Submission state: `isSubmitting`, `submitError`
- All accumulated draft arrays: `monsterAttacks`, `monsterPowers`, `monsterWeaknesses`, `minionAttacks`, `minionPowers`, `minionWeaknesses`, `locations`, `bystanders`
- Reference data: `monsterTypes`, `minionTypes`, `locationTypes`, `bystanderTypes`
- Navigation methods: `next()`, `back()`, `jumpToPhase(phase)`
- Phase submission methods: `submitPhase0(draft)`, `submitPhase1(draft)`, `submitPhase2()`, `submitPhase3()`
- Mutation methods: `addMonsterAttack(item)`, `removeMonsterAttack(index)`, ... (all 12 add/remove pairs)

**Does NOT own:** ReactiveForm instances — those stay in their respective phase components.

**Why a service, not NgRx:** The project has zero NgRx footprint and uses vanilla Angular signals throughout. A plain `@Injectable` service with `signal()` fields is idiomatic and sufficient.

**Browser-persistence hook (for later):**
- Add `persist()` called after every mutation, serializing all signal state to `sessionStorage` under key `mystery-create-draft`
- Add `restore()` called in the constructor, hydrating signals from stored state
- The store also persists `mysteryId` so a resumed session can continue posting to the correct mystery entity
- Clear storage on successful completion (after `router.navigate(['/mysteries', mysteryId])`)
- Forms are transient entry mechanisms — only the committed arrays and nav state need persisting

---

### 2. `MysteryCreateComponent` (parent page — orchestrator)

Route-level component. Its responsibility shrinks dramatically.

**Retains:**
- `providers: [MysteryCreateStore]` to scope the store
- `ngOnInit` reference data loading (delegates to `store.loadReferenceData()` or calls ref data service and sets store)
- Template shell: renders tracker, active phase component, dossier panel
- Nav buttons (Back / Next / Finish) wired to `store.back()`, `store.next()`
- Phase-conditional rendering: `@switch (store.currentPhase()) { ... }`

**Loses:** All forms, all signal arrays, all submission logic, step titles/blurbs, preview computed signals — these move to their respective components and the store.

---

### 3. `WizardTrackerComponent` — Presentational

The "pizza tracker" header.

**Inputs (all `input()` signals):**
- `phases: PhaseConfig[]`
- `currentPhase: number`
- `currentStep: number`
- `phaseComplete: boolean[]`

**Output:** `phaseClicked = output<number>()` — parent decides if navigation is allowed.

This is ~32 lines of template with zero business logic. Pure presentational.

---

### 4. `DossierPanelComponent` — Smart Read Display

The accumulating right-panel preview.

**Recommendation:** Inject `MysteryCreateStore` directly (smart component pattern) rather than receiving 15+ inputs. It reads many signals across all phases but never writes.

- Derives its own `previewName`, `previewConcept`, etc. from store signals using `computed()`
- The `toSignal(form.valueChanges)` calls for live preview (concept, hook, overview, etc.) move INTO the corresponding phase components, which expose computed read-only signals. The store doesn't need to know about live form state — it only receives submitted values at phase transitions. The dossier reads from: (a) submitted-and-stored values for completed phases, (b) the phase component's live-preview signals via `@Input` for the current phase.

**Caveat:** For the current active phase's live preview to work in the dossier, the parent page must bridge live signals from the active phase component to the dossier. The cleanest approach: the active phase component exposes `previewData = computed(...)` that the parent reads via `viewChild()` and passes as an `@Input` to the dossier. This keeps forms encapsulated while allowing live preview to flow through.

---

### 5. `MysteryConceptStepComponent` — Phase 0

**Owns:**
- `conceptForm`, `hookForm`, `overviewForm`, `countdownForm`
- Internal step navigation display (uses `store.currentStep()`)
- Live preview signals: `toSignal(conceptForm.valueChanges.pipe(startWith(...)))`, etc.
- Step titles and blurbs (via `computed()` keyed on `store.currentStep()`)

**Exposes:**
- `previewData = computed(...)` — live preview snapshot for dossier bridging
- Emits phase draft to store at submit time (parent calls `store.submitPhase0(draft)` with extracted values)

---

### 6. `MonsterStepComponent` — Phase 1

**Owns:**
- `monsterForm`, `minionForm`
- **Separate** add-item form instances for monster vs minion (see Shared Form Caveat below)
- Internal step navigation display (uses `store.currentStep()`)
- Live preview signals for monster and minion

**Reads from store:**
- `store.monsterAttacks()`, `store.monsterPowers()`, `store.monsterWeaknesses()`
- `store.minionAttacks()`, `store.minionPowers()`, `store.minionWeaknesses()`
- `store.monsterTypes()`, `store.minionTypes()`

**Calls store:**
- `store.addMonsterAttack(item)`, `store.removeMonsterAttack(index)`, ... (all 12)

---

### 7. `LocationsStepComponent` — Phase 2

**Owns:** `addLocationForm`

**Reads from store:** `store.locations()`, `store.locationTypes()`

**Calls store:** `store.addLocation(item)`, `store.removeLocation(index)`

---

### 8. `BystandersStepComponent` — Phase 3

**Owns:** `addBystanderForm`

**Reads from store:** `store.bystanders()`, `store.bystanderTypes()`

**Calls store:** `store.addBystander(item)`, `store.removeBystander(index)`

---

## Shared Add-Item Form Caveat (CRITICAL)

The current code has a **shared form instance problem.** `addAttackForm`, `addPowerForm`, and `addWeaknessForm` are single `FormGroup` instances bound in BOTH the monster step template (phase 1, step 0) AND the minion step template (phase 1, step 1). The parent resets them manually on step transition (`addAttackForm.reset(...)` in `next()`).

In the refactored version, `MonsterStepComponent` must own **two separate sets** of add-item forms:

```
addMonsterAttackForm   addMinionAttackForm
addMonsterPowerForm    addMinionPowerForm
addMonsterWeaknessForm addMinionWeaknessForm
```

**Better still:** Extract a generic `AddSubItemFormComponent`:
- Inputs: `label: string`, `withHarm: boolean`
- Output: `(itemAdded)` with the draft value
- Manages its own internal `FormGroup`, resets on emit

Two **separate instances** of this component replace the current shared-form coupling. The monster step and minion step each get their own instance, so form state is completely isolated. This is DRY without sharing mutable state.

---

## File Structure After Refactor

```
features/mysteries/pages/mystery-create/
  mystery-create.ts               (orchestrator, shrinks to ~80 lines)
  mystery-create.html
  mystery-create.scss
  mystery-create.store.ts         (signal service, ~200 lines)
  components/
    wizard-tracker/
      wizard-tracker.ts
      wizard-tracker.html
      wizard-tracker.scss
    dossier-panel/
      dossier-panel.ts
      dossier-panel.html
      dossier-panel.scss
    mystery-concept-step/
      mystery-concept-step.ts
      mystery-concept-step.html
    monster-step/
      monster-step.ts
      monster-step.html
    locations-step/
      locations-step.ts
      locations-step.html
    bystanders-step/
      bystanders-step.ts
      bystanders-step.html
    add-sub-item-form/             (optional, recommended)
      add-sub-item-form.ts
      add-sub-item-form.html
```

---

## What Stays in the Parent Page

- Route shell and `providers: [MysteryCreateStore]`
- Reference data loading on init
- Phase-conditional `@switch` rendering of phase components
- Nav button row (Back / Next / Finish) + error display
- Bridge: reading live preview from active phase component → dossier panel

---

## What Belongs in the Store

- All accumulated signal arrays (committed items: attacks, powers, weaknesses, locations, bystanders)
- `mysteryId` (must survive phase transitions)
- Navigation signals (`currentPhase`, `currentStep`, `phaseComplete`)
- `isSubmitting`, `submitError`
- Reference data (monster/minion/location/bystander types)
- API submission orchestration (all 4 `submitPhase*` methods)
- Future: `persist()` / `restore()` for sessionStorage

## What Does NOT Belong in the Store

- Reactive form instances
- Live (uncommitted) form values — these remain in the phase component until the user clicks Next on the last step
- `toSignal()` wrappers around `form.valueChanges` — these are component-level concerns

---

## Browser-State Persistence Path

When the team is ready:
1. Add `persist()` to the store: serialize `JSON.stringify({ phase: ..., step: ..., mysteryId: ..., attacks: ..., ... })` to `sessionStorage['mystery-create-draft']`
2. Add `restore()` in the store constructor: parse and hydrate signals
3. Call `persist()` after every mutation (add*, remove*, `advancePhase()`)
4. Call `clearDraft()` after successful navigation to detail page
5. **Forms are not persisted** — on restore, the user returns to the correct phase/step and the form is empty; only accumulated items are restored
6. Caveat: If `mysteryId` is present in storage, the user is resuming a partially-created mystery — the store should resume from the correct phase rather than re-POSTing phase 0

---

## Summary

| What | Decision |
|---|---|
| Decompose by phase or step? | **Phase.** Steps are display/UX, not architectural boundaries. |
| Store type? | Vanilla `@Injectable` signal service, scoped to the wizard route. |
| Forms live where? | In their phase components, NOT the store. |
| Shared add-item forms (monster/minion)? | **Break apart.** Two separate form instances. Consider `AddSubItemFormComponent`. |
| Live preview in dossier? | Phase component exposes `previewData` computed signal; parent bridges via `viewChild()` input to dossier. |
| Browser persistence? | Store owns `persist()`/`restore()` over sessionStorage; forms are not persisted. |
