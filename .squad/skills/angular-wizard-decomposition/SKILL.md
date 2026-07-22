# Skill: Angular Wizard Decomposition

**Domain:** Angular / Frontend Architecture  
**Applies to:** Multi-step wizards with accumulated state, phase-based submission, live preview

---

## Pattern: Decompose by Phase, Not by Step

When refactoring a large Angular wizard component, decompose by **submission phase**, not by individual visible step. Steps within a phase share forms and state; they are a UX concern (progressive disclosure), not an architectural boundary.

**Key signal:** If multiple steps submit together as one API call, they belong in the same component.

---

## Pattern: Scoped Signal Store for Wizard State

Create an `@Injectable` service provided at the route-component level (`providers: [MyWizardStore]` on the page component). This scopes it to the wizard lifetime without polluting root.

**Store owns:**
- Navigation signals: `currentPhase`, `currentStep`, `phaseComplete`
- Accumulated draft arrays (committed items)
- IDs obtained from early API calls (e.g., `mysteryId` after phase 0)
- `isSubmitting`, `submitError`
- Reference data
- All `submitPhase*()` and add/remove mutation methods
- (Later) `persist()` / `restore()` for sessionStorage

**Store does NOT own:** Reactive form instances, `toSignal(form.valueChanges)` wrappers, uncommitted live form values.

---

## Pattern: Separate Add-Item Form Instances for Sibling Contexts

Never share a single `FormGroup` instance between two sibling contexts (e.g., a "monster" step and a "minion" step). Instead:

1. Create separate named form instances per context (`addMonsterAttackForm`, `addMinionAttackForm`)
2. Or extract a generic `AddSubItemFormComponent` that manages its own internal form and resets on emit — instantiate two separate component instances

**Risk of sharing:** Form state (typed text, validation errors, touched state) bleeds across the step transition unless manually reset on every navigation event.

---

## Pattern: Phase Component Live Preview Bridge

For a live dossier/preview panel that reflects uncommitted form values from the active phase:

1. Phase component exposes `previewData = computed(...)` using `toSignal(form.valueChanges.pipe(startWith(...)))`
2. Parent page reads via `viewChild()` reference
3. Parent passes preview signal value as `@Input()` to the dossier component

This keeps reactive forms encapsulated inside their phase component while letting the dossier update in real time.

---

## Pattern: Browser-State Persistence in the Store

Add `persist()` and `restore()` methods to the wizard store:

```typescript
private persist(): void {
  const state = {
    currentPhase: this.currentPhase(),
    currentStep: this.currentStep(),
    phaseComplete: this.phaseComplete(),
    mysteryId: this.mysteryId(),
    monsterAttacks: this.monsterAttacks(),
    // ... all arrays
  };
  sessionStorage.setItem('wizard-draft', JSON.stringify(state));
}

restore(): void {
  const raw = sessionStorage.getItem('wizard-draft');
  if (!raw) return;
  const state = JSON.parse(raw);
  this.currentPhase.set(state.currentPhase);
  // ... hydrate all signals
}
```

- Call `persist()` after every mutation
- Call `clearDraft()` (removes sessionStorage key) after successful completion
- **Do not persist form instances** — only committed/accumulated arrays and navigation state

---

## File Structure Recommendation

```
features/my-feature/pages/wizard/
  wizard.ts                     (orchestrator, ~80 lines)
  wizard.html
  wizard.scss
  wizard.store.ts               (signal service, ~200 lines)
  components/
    wizard-tracker/             (presentational, phase bubbles)
    dossier-panel/              (smart, reads store signals)
    phase-0-step/               (owns all step 0-N forms for phase 0)
    phase-1-step/               (owns all step 0-N forms for phase 1)
    ...
    add-sub-item-form/          (reusable inline add form, generic)
```

---

## Project Reference

First applied in: `mystery-create` wizard  
Files: `src/app/features/mysteries/pages/mystery-create/`  
Decision doc: `.squad/decisions/inbox/Luigi-mystery-create-frontend-decomposition.md`
