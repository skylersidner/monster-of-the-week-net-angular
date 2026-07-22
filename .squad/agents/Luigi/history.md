
---

## 2026-07-21 — Mystery Creation Wizard Implementation

### Task
Implement the 'Concept A — Accumulating Dossier' multi-step mystery creation wizard as a production-quality Angular component.

### Files Created
- `src/app/features/mysteries/pages/mystery-create/mystery-create.ts` (TypeScript component, 680 lines)
- `src/app/features/mysteries/pages/mystery-create/mystery-create.html` (template, 550 lines)
- `src/app/features/mysteries/pages/mystery-create/mystery-create.scss` (styles, 210 lines)

### Files Modified
- `src/app/core/mystery.ts` — Added `create()` and `upsertCountdown()` methods
- `src/app/core/monster.ts` — Added `create()` method for creating monsters under a mystery
- `src/app/features/mysteries/mysteries.routes.ts` — Added `/create` route (placed before `:id` to avoid route matching issues)
- `src/app/features/mysteries/pages/mysteries-list/mysteries-list.html` — Added 'Create something new…' button in header
- `src/app/features/mysteries/pages/mysteries-list/mysteries-list.scss` — Added styles for list header and create button

### Key Technical Decisions

1. **Phase-Based Submission**  
   Data is submitted at phase transitions, not all at the end. Phase 0 creates the mystery and countdown, giving us an ID for child entities. This enables progressive persistence and matches the 'accumulating dossier' mental model.

2. **Signal Arrays Instead of FormArrays**  
   Sub-items (attacks, powers, weaknesses, locations, bystanders) are managed as signal arrays (`signal<AttackDraft[]>([])`) rather than FormArrays. Each has an inline 'add item' form that validates, pushes to the signal, and resets. Simpler to reason about and aligns with Angular's signals-first model.

3. **Optional Minion Step**  
   The minion form is always visible but the name field is optional. If left blank, no minion is created (`if (!minionName) return of(null)`). This avoids branching UI logic while keeping the flow consistent.

4. **Reactive Preview with toSignal + computed**  
   The right-panel dossier uses `toSignal(form.valueChanges.pipe(startWith(form.value)))` to track changes, then `computed()` signals to extract and transform preview data. Updates in real time as the user types.

5. **Pizza Tracker Navigation**  
   The header tracker shows phase bubbles (numbered 1–4 when pending, checkmark when complete), connecting lines, and step dots (for phases with multiple steps). Completed phases are clickable for navigation; future phases are disabled.

### Angular Patterns Used
- **Signals**: `signal()`, `computed()`, `toSignal()` for reactive state
- **Reactive Forms**: `FormBuilder`, `fb.nonNullable.control()`, typed form groups
- **inject()**: DI without constructor parameters
- **takeUntilDestroyed(this.destroyRef)**: Automatic subscription cleanup
- **Angular 17+ control flow**: `@if`, `@for`, `@switch` in templates (no structural directives)
- **Standalone components**: `imports: [ReactiveFormsModule]`, no NgModules
- **RxJS operators**: `switchMap`, `forkJoin`, `of`, `startWith` for async orchestration

### API Submission Flow

**Phase 0 → 1:** POST /api/mysteries → PUT /api/mysteries/{id}/countdown → advance  
**Phase 1 → 2:** POST monster → forkJoin(attacks/powers/weaknesses) → if minion: POST minion → forkJoin(sub-items) → advance  
**Phase 2 → 3:** forkJoin(POST locations) → advance  
**Phase 3 → finish:** forkJoin(POST bystanders) → success toast → navigate to mystery detail

### UI/UX Notes
- Step titles and blurbs are computed signals with contextual help text for each step
- Only mystery name (Phase 0 Step 0) and monster name (Phase 1 Step 0) are required fields
- Live preview in right panel updates in real time as user types
- Dossier sections fade in with CSS animation when data becomes available
- Error handling shows dismissible alert; isSubmitting disables Next button during API calls

---

## 2026-07-21 — TypeScript Build Error Fixes

### Task
Fix TypeScript compilation errors in the mystery creation component that prevented `npm run start` from succeeding.

### Problem
The mystery-create component had type inference issues with ternary expressions that created union types from `forkJoin()` and `of(null)`. TypeScript couldn't properly resolve the observable type when used directly with `takeUntilDestroyed()` and `subscribe()`.

Errors:
- `TS2554: Expected 0 arguments, but got 1` on `takeUntilDestroyed(this.destroyRef)`
- `TS2349: This expression is not callable` on `.subscribe()`

### Solution
1. **Added explicit type annotation** for observables created from ternary expressions
2. **Imported `Observable` type** from RxJS to enable type annotations

Changed from:
```typescript
(locationObs.length > 0 ? forkJoin(locationObs) : of(null))
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe({...});
```

To:
```typescript
const obs$: Observable<unknown[] | null> = locationObs.length > 0 ? forkJoin(locationObs) : of(null);
obs$
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe({...});
```

### Files Modified
- `src/app/features/mysteries/pages/mystery-create/mystery-create.ts`
  - Added `Observable` import from `rxjs`
  - Added explicit type annotation to `submitPhase2()` method
  - Added explicit type annotation to `submitPhase3()` method

### Verification
Ran `npm run start` and confirmed successful build with no TypeScript errors. Application bundle generated successfully and dev server started on http://localhost:4200/.

---

## 2026-07-21 — Mystery Create Frontend Decomposition Architecture Review

### Task
Reviewed the `MysteryCreateComponent` monolith (~680 TS / ~550 HTML lines) and produced a concrete frontend architecture recommendation for decomposing it into child components with a shared signal store.

### Architecture Decision Summary

**Decompose by phase, not by step.** Steps within a phase are UX-only (progressive disclosure), not architectural boundaries. Each phase component owns all of its steps' forms and submits as a unit.

**Components proposed:**
| Component | Role |
|---|---|
| `MysteryCreateStore` | Injectable signal service scoped to the wizard route. Owns navigation state, accumulated arrays, API submission, `mysteryId`. |
| `MysteryCreateComponent` | Shrunk orchestrator: provides store, renders tracker+phase+dossier, wires nav buttons. |
| `WizardTrackerComponent` | Pure presentational "pizza tracker" header. |
| `DossierPanelComponent` | Smart read-only panel; injects store directly. |
| `MysteryConceptStepComponent` | Owns conceptForm, hookForm, overviewForm, countdownForm. |
| `MonsterStepComponent` | Owns monsterForm, minionForm, separate add-item form instances per entity. |
| `LocationsStepComponent` | Owns addLocationForm. |
| `BystandersStepComponent` | Owns addBystanderForm. |
| `AddSubItemFormComponent` | Optional generic inline-add component to eliminate shared-form coupling. |

### Key Pattern: Shared Form Instance Caveat
The current `addAttackForm`, `addPowerForm`, `addWeaknessForm` are SHARED between the monster step and minion step — a known coupling point. Refactored version must use separate form instances per context, or extract `AddSubItemFormComponent` and instantiate it twice.

### Browser-State Persistence Path
Store owns `persist()` / `restore()` over sessionStorage. Only committed arrays + nav state + `mysteryId` are persisted. Forms are NOT persisted — transient only. `clearDraft()` called on successful completion.

### Files Created
- `.squad/decisions/inbox/Luigi-mystery-create-frontend-decomposition.md` — full architecture decision record
- `.squad/skills/angular-wizard-decomposition/SKILL.md` — reusable patterns extracted

### Key Paths
- Current monolith: `src/app/features/mysteries/pages/mystery-create/mystery-create.ts`
- Template: `src/app/features/mysteries/pages/mystery-create/mystery-create.html`
- Styles: `src/app/features/mysteries/pages/mystery-create/mystery-create.scss`

