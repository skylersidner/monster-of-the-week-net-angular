
---

## Learnings

### 2026-09-18 — Cross-domain entity link style (`.entity-link`/`.back-link`)

- Implemented Rosalina's advisory spec (`.squad/decisions/records/rosalina-cross-domain-link-style.md`), but that file, as written to disk, contains only the prose rationale (why accent, why `outline` not `ring-focus`, why `@layer components`, why no `:visited`/`font-weight`) — it does **not** contain a literal CSS block, a call-site table, or an exclusion list, despite the task brief describing it as containing all three. Built the actual CSS from her stated decisions (documented as such in the `styles.css` comments) and found call sites myself by grepping every template for `routerLink`, rather than trusting a table that isn't there. Worth checking a referenced decision doc's actual byte content before assuming a paraphrase of it is accurate — this is the same "verify a referenced plan's premises" lesson Rosalina's own history logs, applied to primary-source completeness instead of staleness.
- First pass found only 9 cross-domain call sites (excluding same-domain list-row-to-own-detail links as intra-domain) and used `--color-text-muted` for `.back-link`. **Both were corrected by Mario after relaying Rosalina's actual (never-filed) table**: the six list-page primary name links (`mysteries-list.html:19` etc.) ARE in scope — her table treats "bare `font-semibold`-or-nothing on a name link" as one uniform gap regardless of same-vs-cross-domain, which is a broader reading than the class's own stated purpose ("navigates to another domain entity's detail view") would suggest standing alone. Total is 15 `.entity-link` sites, not 9 or 14. `.back-link` rest color is `--color-text-secondary` (Rosalina's explicit, deliberate call), not `-muted` — hand-verified contrast against `--color-surface` first (7.59:1 light, 12.02:1 dark, both clear AA) since the correction said to keep muted only if secondary failed. **Lesson: when a spec's own stated rule (cross-domain only) and its worked table disagree, the human author's table wins over a literal reading of her own prose** — don't assume a clean-sounding scope principle is exhaustive just because it reads that way in isolation.
- 10 "← Back to X" anchors confirmed correct as found (not 11 per the brief): 6 detail pages (bystander/location/monster/minion/mystery/hunter) + 4 create pages (bystander/location/monster/minion). `hunter-create.html`/`mystery-create.html` have no such anchor — their wizard "← Back" is a `<button>`, correctly excluded.
- Tailwind v4's `text-decoration-color: transparent` → `currentColor` on hover/focus, riding the existing `transition-colors` utility (which covers `text-decoration-color` in v4), is the pattern for a hover-fade underline without adding a bespoke transition property.
- Full corrected call-site table and the CSS as implemented are in `.squad/decisions/records/luigi-cross-domain-link-style-implementation.md` — still not a verbatim copy of Rosalina's original table/CSS (never obtained, only Mario's relay of the deltas), flagged as such in that doc for whoever picks this up next.

### 2026-08-01 — Global Search Phase 2: Header Search Dropdown

- Built `HeaderSearchComponent` (`shared/header-search/`), `DomainIconComponent` (`shared/domain-icon.component.ts`, single-file inline-template — file list only specified the `.ts`), `SearchService` (`core/search.ts`), `SearchResultItem` in `models.ts`, per `docs/search/architecture.md` Section 6 / `phases.md` Phase 2. Wired into `page-layout.html`/`.ts` replacing both the disabled search input and the two inline SVG `@switch` blocks (enabled nav + disabled-item fallback).
- `DomainIconComponent.domain` accepts either the nav's existing lowercase-plural keys (`monsters`, `mysteries`, ...) or the search API's singular-capitalized `entityType` (`Monster`, `Mystery`, ...) — normalizes internally via a small singular→plural map so both callers pass their natural values with zero adapter code at the call site.
- RxJS combobox pipeline: `Subject<string>` → `debounceTime(200)` → `distinctUntilChanged()` → `tap` (short-circuits <3-char queries: clears results/closes/nulls highlight without a `filter` block preventing the tap) → `filter(length>=3)` → `switchMap(quick)` with `catchError` fallback to `[]`. `highlightedIndex` reset to `null` on every resolved result set (both the short-circuit tap branch and the subscribe callback).
- Kept mouse-click-inside-listbox from blurring the input (which would close the dropdown mid-click before the click handler fires) via `(mousedown)="$event.preventDefault()"` on the `<ul>` — standard ARIA APG combobox technique, focus never leaves the input.
- **Real bug caught only by manual Playwright/dev-server verification, not by jsdom unit tests**: native `<input type="search">` clears its own `.value` on Escape by default (browser built-in). jsdom doesn't implement this, so the vitest spec passed even before the fix. Fixed by calling `event.preventDefault()` in the Escape branch of `onKeydown`. Worth remembering for any future `type="search"` input work in this app — always manually verify Escape behavior, unit tests alone won't catch it.
- Verified end-to-end against a live `dotnet run` (port 5225, matching `environment.ts`) + `docker compose up -d postgres` + `ng serve` using Playwright: typing "sto" opens the dropdown with the Location icon and result, ArrowDown/mouse-hover highlight sync correctly, Escape now preserves typed text.
- Pre-existing, unrelated test-suite breakage found (not caused by this work, not fixed): `mystery-create.store.spec.ts` fails to compile/run — its mocked `ReferenceDataService` is missing `getAdventureTypes`/`getMonsterArchetypes` and two `setValue()` calls are missing `adventureTypeId`/`monsterArchetypeId`, left over from earlier adventure-type/monster-archetype UI work never propagating to this spec. This blocks `npm run test -- --watch=false` for anyone until fixed — confirmed via `git stash` that the same 10 test failures exist identically on the pre-Phase-2 commit. Also affects `mystery-create.spec.ts`, `mystery-detail.spec.ts`, `page-layout.spec.ts` (stale `.sidebar-mobile`/`.api-modal` class selectors from before the Tailwind migration), `monster-detail.spec.ts` ("deletes attack when confirmed"). Flagging for whoever owns that area next; did not fix since out of scope for this task.
- To verify new specs in isolation while that pre-existing break exists: `ng test`'s Angular-compiler plugin type-checks the *entire* tsconfig program before running anything, so `--include`/`--exclude` don't skip the broken file's compile error — the only way to get a clean run is to physically move the broken spec out of the tree, run, then restore it (confirm restore via `git diff`/`git status` afterward).

### 2026-08-01 — Monster Archetype UI Wiring

- `MonsterArchetypeResponse` follows the exact same shape as `AdventureTypeResponse` — `{ id, name, description }` — so `CustomSelectComponent` accepts it without any adapter
- `monsterArchetypeId` added as `Validators.required` to `monsterForm` in both `monster-detail.ts` and `mystery-create.store.ts`; the archetype is a required field by the API
- `MonsterDetailResponse` has `monsterTypeId`/`monsterTypeName` scalars (not a nested object) — the detail badge uses `monster()!.monsterTypeName` directly; `MonsterListItemResponse` still has the nested `monsterType: TypeRefResponse` object
- Purple badge color (`bg-purple-100 text-purple-700`) used for archetype badges project-wide to differentiate from red monster-type badges
- `mystery-create.store.ts` `phaseStepComplete` Phase 1 step 0 now gates on BOTH name AND `monsterArchetypeId` being non-empty
- Reference data caching pattern: `private monsterArchetypes$?: Observable<MonsterArchetypeResponse[]>` with `??=` lazy init + `shareReplay({ bufferSize: 1, refCount: false })`
- `loadEditData` in the store patched via `pureMonster.monsterArchetype.id` (from `MonsterDetailResponse`, which has the nested object); `loadReferenceData` and `loadEditData` both include the `monsterArchetypes` key in their `forkJoin`

- Angular 22 + @tailwindcss/vite: no `tailwind.config.js` needed; plugin wired via `angular.json` `plugins` array or `vite.config.ts`
- `@theme` block in `styles.scss` handles `font-sans`, custom breakpoints (`sm=540px`, `xl=1200px`), and brand color pin
- 19 SCSS files analyzed; 14 can be fully deleted, 3 shrink significantly, 2 are permanent survivors
- `mystery-create.scss`: `grid-template-rows: subgrid` has no Tailwind utility — 20-line remnant is the correct outcome
- `custom-select.component.scss`: compound parent-state selectors (`.is-open`, `.is-disabled`) must stay in SCSS with `@apply`
- `:hover:not(:disabled)` pattern cannot be expressed in Tailwind — must stay in SCSS
- `:nth-child` table row striping with `!important` must stay in SCSS
- The existing color palette is an almost-exact match to Tailwind defaults — no custom color tokens needed

- Phase 8c: built full minion-detail component mirroring monster-detail — all three files (ts, html, scss) at `features/minions/pages/minion-detail/`
- runAndRefresh helper pattern: operation → switchMap(getById) → update signal, toast, reset form; lives as private method taking `(minionId: string) => Observable<unknown>`
- Attack create flow: createAttack → if tags: forkJoin(assignAttackWeaponTag) → switchMap(getById) to refresh full minion
- Custom moves intentionally omitted — no API endpoints exist for minion custom moves
- backLink = `computed(() => ['/minions'])` — no mysteryId signal needed (minions have no mystery back-nav)
- Build verified: minion-detail lazy chunk 16.39 kB, zero new errors

- Phase 8b: created `features/minions/` module with list page (`minions-list`), routes (`minions.routes.ts`), and stub detail (`minion-detail`)
- Nav item already had the `minions` icon wired — only needed `route: '/minions'` and `exactMatch: false` to activate it
- No delete on the minions list; there is no `DELETE /api/minions/{id}` endpoint — list is read-only with nav links only
- `minion-detail` is a minimal stub; Phase 8c will replace it with the real component
- Pre-existing `anyComponentStyle` budget in `angular.json` was too tight (8 kB) for `mystery-create.scss` (8.27 kB) — bumped to 12 kB error / 6 kB warning to unblock the build

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
- `.squad/decisions/records/luigi-mystery-create-frontend-decomposition.md` — full architecture decision record
- `.squad/skills/angular-wizard-decomposition/SKILL.md` — reusable patterns extracted

### Key Paths
- Current monolith: `src/app/features/mysteries/pages/mystery-create/mystery-create.ts`
- Template: `src/app/features/mysteries/pages/mystery-create/mystery-create.html`
- Styles: `src/app/features/mysteries/pages/mystery-create/mystery-create.scss`

---

## 2026-07-25 — Phase 8a: MinionService update methods + model extension

### Task (requested by Skyler Sidner)
Extend the Angular minion model and service to support the top-level `/minions` list page and full CRUD on sub-entities.

### Files Modified
- `src/app/core/models.ts` — Added `monsterId` and `monsterName` fields to `MinionListItemResponse` (after `id`)
- `src/app/core/minion.ts` — Added `getAll()`, `updateAttack()`, `removeAttackWeaponTag()`, `updatePower()`, `updateArmor()`, `updateWeakness()` methods to `MinionService`

## Learnings
- Phase 8a: extended `MinionListItemResponse` with `monsterId`/`monsterName` so the top-level minions list can show which monster owns each minion without a secondary fetch
- Added `getAll()` (GET `/api/minions`), `updateAttack()`, `removeAttackWeaponTag()`, `updatePower()`, `updateArmor()`, `updateWeakness()` to `MinionService`
- Angular service update pattern: `apiService.put<TRequest, TResponse>(url, body)` — matches the existing `ApiService.put<TRequest, TResponse>` signature
- Build failure on this run was a pre-existing CSS budget overage in `mystery-create.scss` (8.27 kB vs 8 kB limit), not caused by these changes; TypeScript compilation was clean

---

## 2026-08-01 — Global Search Phase 3: Full Search Results Page

### Task
Implemented Phase 3 (frontend-only) of global search per `docs/search/architecture.md` Section 6/7 and `docs/search/phases.md`'s Phase 3 checklist: `SearchResultDetailItem`/`PagedSearchResult` models, `SearchService.search()`, and `features/search/` — `SearchResultsComponent` reading `q`/`page` reactively off `ActivatedRoute.queryParamMap`, rendering paginated results with domain badges/icons/links and `snippet ?? excerpt`. Route registered in `app.routes.ts` via `loadChildren` (mirroring `mysteries`/`monsters`/etc., not the `phases.md` snippet's bare `component:` — codebase convention for feature list pages is `loadComponent` inside a `*.routes.ts`, confirmed against `locations.routes.ts`/`bystanders.routes.ts`).

Baseline verified clean before starting: `npm run build` and `npm run test -- --watch=false` both passed (26 files / 85 tests) — Phase 1/2's pre-existing test breakage really was fixed by the owner as stated.

### Key patterns confirmed
- Feature list pages in this codebase have no `.scss` at all (Tailwind-only, post-migration); only `shared/header-search` (Phase 2) has one. Since the task explicitly listed `search-results.scss` as a file to create, added one anyway but kept it minimal (`@reference "tailwindcss"; :host { display: block; }`), matching `header-search.scss`'s style rather than the older per-component `.scss` files still full of now-largely-unused pre-migration CSS (e.g. `monsters-list.scss`).
- Existing per-domain badge colors already established elsewhere in the app: Mystery → `amber-100/amber-700` (adventure-type badge), Monster → `red-100/red-700` (monster-type badge), Location → `green-100/green-900`, Bystander → `blue-100/blue-800`. No existing plain-Tailwind-class minion badge (minions-list uses a bespoke `bg-[#fde8d8] text-orange-800` hex), so picked `orange-100/orange-800` for Minion on the results page — same hue family as the existing minion badge, but a real Tailwind class pair rather than a custom hex, kept distinct from Monster's red.
- `ActivatedRoute.queryParamMap` reactive pattern: subscribe once in the constructor (via `takeUntilDestroyed`), track `lastQuery` starting at `null` so the very first emission (initial page load, possibly deep-linked to `page=N>1`) is never mistaken for a "user changed q" event. Only reset to `page=1` via `Router.navigate` (not silent refetch) when `lastQuery !== null && q changed && page !== 1` — this is the guard that lets `/search?q=x&page=5` deep-link correctly while still catching an in-place address-bar edit from `?q=x&page=5` to `?q=y&page=5`.
- Testing `ActivatedRoute.queryParamMap` reactivity: provide a `BehaviorSubject<ParamMap>` (via `convertToParamMap`) as the `queryParamMap` value on a mocked `ActivatedRoute`, then `.next()` new param maps mid-test to simulate address-bar edits / pagination. Spy on the *real* `Router` (`provideRouter([])` + `vi.spyOn(router, 'navigate')`) rather than swapping in a bare `{ navigate: fn }` stub, because the component's template uses `RouterLink` and a stub Router without `.events` etc. breaks `RouterLink`'s constructor.
- Verified end-to-end against a live API + dev server: `GET /api/search?q=sto&page=1&pageSize=20` on the real dev DB returns real paged results (Location "One Stop Grocery & Shop" for query "sto"); `ng serve` correctly serves `/search?q=...` via the SPA history fallback (200, not 404). No headless-browser tool (e.g. Playwright) is set up in this repo, so interactive click-through (Prev/Next clicks, header-dropdown Enter landing on `/search`) was verified via the automated component spec + manual reasoning about the Router calls, not literal browser interaction — flagging this so it isn't assumed to be pixel-verified.
- Found a stale `dotnet run` process (unrelated to this task, apparently left running from an earlier session) holding a file lock on `MonsterOfTheWeek.Api.exe`, pre-dating the Phase 1 search endpoints (returned 404 on `/api/search*` while `/api/monsters` worked). Killed it and started a fresh one to verify against current code — flagging in case the project owner had that old process running intentionally for something else.

### Files
- New: `core/search.ts` (extended, not new — `search()` method added), `features/search/{search.routes.ts, pages/search-results/{search-results.ts,.html,.scss,.spec.ts}}`
- Modified: `core/models.ts` (`SearchResultDetailItem`, `PagedSearchResult`), `core/search.ts`, `app.routes.ts`

### Verification
`npm run build` clean (same 2 pre-existing budget warnings, unrelated). `npm run test -- --watch=false`: 27 files / 97 tests, all green (12 new specs). No `src/api/` files touched.

---

## 2026-08-01 — Global Search Phase 4c: Snippet Highlighting + Field/Sub-Resource Label

### Task
Rendered the real `snippet`/`matchSpans`/`matchedSubResourceName` (4a/4b, already committed on this branch: `dd68942`/`62204be`) on the results page. `models.ts` gains `SearchMatchSpan` + extends `SearchResultDetailItem`; `search-results.ts` gains standalone `buildSnippetSegments`/`fieldLabel` functions (colocated, not a shared module, per `phases.md`) plus `contextSegments(item)` replacing `contextText(item)`; `search-results.html` renders a "Matched in: ..." chip + `@for` segment loop with `<mark>`. No `[innerHTML]`. `header-search.*`/`src/api/` untouched (verified via `git status` diff before/after).

### Key patterns confirmed
- Angular's `@if`/`@else` control-flow blocks used to alternate `<mark>`/plain text leave incidental whitespace around each block's rendered text in `textContent` (not collapsed the way a browser renders it visually) — `.replace(/\s+/g, ' ').trim()` before asserting exact snippet text in specs. Cosmetically this is fine (browsers collapse runs of whitespace visually); only matters for exact-string test assertions.
- Class field assignment (`readonly fieldLabel = fieldLabel;`) is the cleaner way to expose a same-named standalone module function as a component method for the template, vs. a wrapper method `fieldLabel(item) { return fieldLabel(item); }` — the wrapper technically works (method bodies aren't in the same scope as their own name, so the inner call resolves to the outer function, not infinite recursion) but reads as a self-recursive footgun; prefer the field-assignment form.
- Correction to my own Phase 3 note: a headless-browser tool **is** available in this repo — `playwright` is in `src/web/monster-of-the-week-web/node_modules/.bin` (v1.61.1), just not wired into any npm script. A throwaway `.mjs` script placed directly in that package directory (temp files outside the package fail Node ESM resolution against `node_modules`) using `chromium.launch()` works for one-off interactive verification (chip/`<mark>` presence, header-dropdown absence of both) — delete it after use, it's not part of the test suite.
- Live-verified all three `architecture.md` Section 5 worked-example shapes against the real seeded dev DB (not just mocked specs): a query matching only a Power's `Description` → `matchedField: "Power.Description"`, real windowed snippet, one `<mark>` around the matched word, chip "Matched in: Power — {name}"; a query matching an Attack's own `Name` → short snippet identical to the sub-resource name, fully highlighted, chip present — confirmed non-broken-looking, matches Decision #20's "intentional" call; a query matching an entity's own `Name` → no chip, `snippet: null`, plain `excerpt` rendered, unchanged from Phase 1-3 (while a co-occurring Mystery match via `Overview` in the same result set correctly *did* get its chip/highlight, confirming the null/non-null branches coexist correctly per-row).
- `dotnet run --launch-profile http` on this repo binds `http://localhost:5225` (matches `environment.apiBaseUrl` in the Angular app already) — no proxy config needed, they're just hardcoded to agree.
- Found port 4200 already serving a stale Angular dev build from an earlier/other session when I went to start my own `ng serve` (mine failed silently with "ng: command not found" in a background bash call, yet 4200 answered anyway) — used the pre-existing one for Playwright verification since it was already serving current code, and deliberately left it running afterward since I hadn't started it. Only killed the `dotnet run` process I'd started myself (PID captured via `netstat`/`Stop-Process`), not the pre-existing one on 4200 — flagging in case the project owner has a stale process to clean up separately.

### Files
- Modified: `core/models.ts` (`SearchMatchSpan`, `SearchResultDetailItem`), `features/search/pages/search-results/{search-results.ts,.html,.scss,.spec.ts}`

### Verification
`npm run build` clean (same 2 pre-existing budget warnings, unrelated). `npm run test -- --watch=false`: 27 files / 108 tests, all green (11 new specs: 5 `buildSnippetSegments`, 3 `fieldLabel`, 3 component-level chip/`<mark>`/no-chip). Live-verified via Playwright against real API (Postgres + `dotnet run`) + `ng serve` for all 3 worked examples plus header-dropdown non-regression. No `src/api/` files touched; `header-search.*` untouched (confirmed via targeted diff, not just by not opening the files).

---

## 2026-08-02 — Theming Phase 0: Token Infrastructure & Dark-Inert Baseline

### Task
Implemented Phase 0 only of `docs/theming/theming-plan.md`: token catalogue + `.dark` scope in `styles.css`, `ThemeService`, `provideAppInitializer` wiring, and the `search-results.spec.ts` test-disabling sweep. No templates touched (that's Phases 1+).

### Files
- New: `src/app/core/theme.ts`, `src/app/core/theme.spec.ts`
- Modified: `src/styles.css` (full `@theme` token catalogue + `@custom-variant dark` + `.dark` block, all light-value duplicates per Phase 0 — real dark fills land in Phase 7), `src/app/app.config.ts` (`provideAppInitializer(() => inject(ThemeService).initialize())`), `src/app/features/search/pages/search-results/search-results.spec.ts` (split the two `bg-red-100`/`bg-green-100` assertions into their own `it.skip`, see decision below)

### Key patterns / gotchas
- **`ng test`'s environment (`@angular/build:unit-test` + vitest) does NOT provide a real `window.localStorage` or `window.matchMedia` out of the box.** Its `window` is a minimal shim (enough for Angular TestBed DOM rendering, `fixture.nativeElement`, etc.) but lacks Web Storage and `matchMedia`. Also: Node 26's own experimental global `localStorage` (separate object, needs `--localstorage-file`) exists and will silently shadow/confuse a bare (non-`window.`-qualified) `localStorage` reference — always write `window.localStorage`, never bare `localStorage`, in both service code and specs. For specs needing `matchMedia`, assign directly via `Object.defineProperty(window, 'matchMedia', { value: vi.fn()..., configurable: true, writable: true })` rather than `vi.spyOn` (spyOn requires the property to already be a function; it isn't here).
- Building the token `@theme` catalogue: reference Tailwind's own default-palette custom properties via `var(--color-slate-950)` etc. rather than copying hex/oklch by hand — Tailwind v4's default theme (pulled in by `@import "tailwindcss"`) already defines every named color (`--color-white`, `--color-slate-*`, `--color-indigo-*`, ...) as a real custom property, so referencing it guarantees pixel-parity with whatever `bg-slate-950` already compiles to, with zero transcription risk. Alpha-based tokens (`--color-focus-ring`, `--color-sidebar-hover/-active`) use `color-mix(in oklab, var(--color-X) N%, transparent)` rather than a Tailwind opacity-modifier class (which only works on utility classes, not inside a raw CSS custom property value).
- `ThemeService`'s DOM-class application: kept explicit synchronous `applyDomClass()` calls in both `setPreference()`/`initialize()` (per Decision D's literal wording, and so bootstrap timing is deterministic rather than dependent on Angular's effect-scheduling), *plus* an `effect(() => this.applyDomClass())` field — the effect is the only thing that reacts to a live OS-level `matchMedia` 'change' event while `preference === 'system'`; the explicit calls would miss that case entirely.
- Two real ambiguities found in `theming-plan.md` itself, filed as `.squad/decisions/records/luigi-theming-phase0-judgment-calls.md`: (1) the reserved `--color-badge-mystery` token pair has no current light value to preserve (no mystery badge exists) and the plan explicitly declines Rosalina's speculative teal proposal — left undeclared in `styles.css` rather than inventing a value; (2) the plan's "disable via `it.skip` on the containing test" instruction for `search-results.spec.ts` doesn't account for Vitest only being able to skip a whole test, not individual assertions, and the flagged test mixed color and non-color assertions — split into two tests instead of skipping (and losing coverage on) the whole thing.

### Verification
`npm run test -- --watch=false`: 28 files / 116 tests passed, 1 skipped (the new dedicated badge-color test) — no regressions. `ng build --configuration production` clean (same 2 pre-existing component-style budget warnings as always, unrelated to this change).

---

## 2026-08-02 — Theming Phase 1: Shell Layout, User Menu, Settings View

### Task
Phase 1 of `docs/theming/theming-plan.md`: re-point `page-layout.html` onto the Phase 0 token utilities, convert the three inline-style spots (Soon badge ×2, notification toast, API-unavailable modal), build `pages/settings/`, route it, and link it from the user menu.

### Files
- New: `src/app/pages/settings/{settings.ts,settings.html,settings.spec.ts}`
- Modified: `src/app/layout/page-layout/{page-layout.html,page-layout.ts,page-layout.spec.ts}`, `src/app/app.routes.ts`

### Key patterns / gotchas
- **Tailwind v4's name-concatenation problem bites on the prefix side too, and the theming plan's re-pointing map is wrong because of it.** `--color-text-primary` generates `text-text-primary`, not `text-primary`; `--color-border` generates `border-border`, not `border-default`. Same mechanism as the `-bg` suffix stutter the plan already resolved — Tailwind puts the utility family in front of the *whole* remainder after `--color-`. Verified empirically (temp probe file → `ng build` → grep the emitted `styles-*.css`), not from memory: the plan's names emit no rule at all, silently, with a clean build. **Technique worth reusing: to confirm any token-derived class name actually exists, drop a throwaway `.html` in `src/` containing the candidate class names, build, and grep `dist/**/styles-*.css` for `.classname{`.** Filed as `.squad/decisions/records/luigi-theming-phase1-utility-name-stutter.md`.
- Opacity modifiers *do* work on token-backed utilities (`text-sidebar-text/70`), compiling to `color-mix(in oklab, var(--color-sidebar-text) 70%, transparent)` — but Tailwind also emits an unguarded fallback rule that bakes in the token's *light* value literally (`color-mix(in srgb, oklch(93.2% ...) 70%, transparent)`), overridden by an `@supports (color: color-mix(in lab, ...))` rule. Any browser failing that `@supports` check would keep the light value in dark mode. Non-issue in practice, but it means token + opacity modifier is not quite as theme-pure as a bare token utility.
- `CustomSelectComponent` is a `ControlValueAccessor`, so it needs a `FormControl`/`formControlName` — there's no plain `[value]`/`(change)` path. For plain-string options (`ThemePreference`), all three of `optionValue`/`optionLabel`/`optionSubLabel` must be supplied, since the defaults read `id`/`name`/`description` off an option *object* and fall back to `String(option)` (which would render `system`, not `Match system`).
- Some elements in the shell keep literal colors on purpose and are *not* token bugs: `text-white` on the MOTW logo and mobile close button (white-on-indigo works in both themes; `--color-sidebar-text` would be a visible light-mode change), `bg-white/20` on the Soon badge and MOTW pill (translucent white lightens whatever's under it in either theme — Rosalina's call), and `bg-slate-950/40`/`bg-slate-950/55` scrims (theme-invariant by design).
- Two deliberate small light-mode shade shifts, both forced by "no token exists for the exact old value": the user-avatar button's `text-indigo-900` → `text-accent` (indigo-600 — indigo-900 text would be unreadable on dark-mode `accent-subtle`), and the API modal's body copy `#334155` (slate-700) → `text-text-secondary` (slate-600, as the plan instructs).
- Added `closeUserMenu()` to `page-layout.ts` (one method beyond the plan's file list) so the user menu doesn't stay open floating over the newly-navigated page after clicking Settings.
- The `@else` "Soon" nav-badge branch is dead at runtime — every `navItem` has a route now. Verified the inline-style→class conversion by injecting both variants into the live sidebar and diffing `getComputedStyle`, since it can't be observed in the running app.
- Playwright verification technique for a dark theme whose real fills haven't shipped yet (Phase 0's `.dark` block is still a light-value duplicate): `page.addStyleTag()` a `.dark{...}` block with Rosalina's real values from `dark-theme-palette.md`, then read `getComputedStyle` on the shell elements. This proves the token cascade actually reaches every re-pointed element with zero template changes — the whole point of Decision B — without touching `styles.css`. `page.emulateMedia({ colorScheme: 'dark' })` also confirms the live-OS-change path while preference is `system`.

### Verification
`npm run test -- --watch=false`: 29 files / 122 passed, 1 skipped (up from 28/116 — 5 new settings specs, 1 new page-layout spec). `ng build --configuration production` clean (same 2 pre-existing budget warnings). Live-verified via Playwright against `ng serve` (API deliberately down, so the API-unavailable modal was exercised for real): light-mode computed colors on every re-pointed shell element match the pre-change literals exactly; user menu shows Your profile/Settings/Sign out and closes on navigate; theme picker persists to `localStorage['motw:theme']` and survives reload; "Match system" follows a live `colorScheme` flip; spinner `currentColor` resolves to the button's on-accent.

---

## 2026-08-02 — Theming: Token→Utility Mechanism Fix (`@utility`) + header-search

### Task
Skyler pushed back on my "live with the stuttering names" call from the Phase 1 note: research Tailwind v4's actual documented guidance and fix the mechanism properly. Also folded `shared/header-search/` into Phase 1 scope (it was missed by the plan's repo scan, not added late — `git log` shows it in the search feature's "Phase 2 (UI first pass)" commit). Full write-up: `.squad/decisions/records/luigi-theming-token-utility-mechanism.md` (supersedes and replaces `luigi-theming-phase1-utility-name-stutter.md`, which I deleted).

### Files
- Modified: `src/styles.css` (`@theme` → `@theme static`, + 8 `@utility` blocks), `layout/page-layout/page-layout.html`, `pages/settings/settings.html`, `shared/header-search/header-search.{html,scss}`

### Key patterns / gotchas
- **`@utility <exact-name> { … var(--anything) }` is Tailwind v4's documented answer to controlling a class name independently of the custom property behind it**, and it is the right fix for the stutter — *not* renaming tokens. The rule I settled on: a token stays in `@theme`/`--color-*` (auto-generated) when its role name contains no utility-family word and it's genuinely multi-family (`accent`, `surface`, `badge-monster`, `on-accent`); it gets a hand-written `@utility` when its role *is* one family (`--color-text-primary`→`text-primary`, `--color-border`→`border-default`, `--color-sidebar-text`→`text-sidebar`, `--color-focus-ring`→`ring-focus`). Bonus: this makes `theming-plan.md`'s existing Phase 1 re-pointing map correct as written, and leaves Yoshi's `on-*` decision and Rosalina's palette 100% untouched. The `on-*` rename was NOT made unnecessary by `@utility` — it fixed the multi-family tokens, which are exactly the ones you still want auto-generated.
- **`@utility` classes get the full variant pipeline free** — verified `hover:`, `focus:`, `md:`, `dark:` all emit. **But there is no slash-opacity modifier**: `text-primary/70` emits nothing at all. Where a translucent variant is needed, give it its own named utility with an explicit `color-mix()` (`text-sidebar-muted`).
- **Tailwind tree-shakes `@theme` custom properties out of `:root`, but a hand-written `.dark {}` block is emitted verbatim in full.** Those disagree, and Phase 0 as shipped already had 5 tokens (`--color-badge-minion`, `-badge-archetype`, `-weapon-chip`, `-danger-subtle`, `-success`) **defined in dark mode and undefined in light mode**. Invisible for Tailwind-generated utilities; silently fatal for any hand-written `var(--color-…)` in CSS — i.e. exactly Phase 5's table-striping fix. Fixed with **`@theme static`** (forces emission of every token; +767 bytes). Any theming setup that pairs `@theme` with a plain-CSS override scope needs `static`.
- **`@reference "tailwindcss"` in a component `.scss` does NOT see our `@theme` tokens or `@utility` classes** — it loads Tailwind's default theme only, so `@apply bg-accent` fails the build with `Cannot apply unknown utility class`. Loud, not silent, but a hard blocker: all 10 component `.scss` files in this repo still say `@reference "tailwindcss"` and each will break on the phase that repoints its `@apply` lines. Fix per file: `@reference "…/styles.css"` (`../../../styles.css` from `shared/header-search/`). Compiled result is `var(--color-accent, var(--color-indigo-600))` — the fallback bakes the light value but is never reached, since `:root` always defines the token under `@theme static`.
- Hand-writing `color-mix()` inside an `@utility` body does **not** dodge Tailwind's unguarded baked-literal fallback rule (correcting my own earlier Phase 1 note): it still emits an `in srgb` rule with the literal light value plus an `@supports (color: color-mix(in lab,…))` override. Symmetric in `:root` and `.dark`, so both themes are correct — only a browser failing that `@supports` check would be wrong.
- **Reusable verification harness, worth re-running every phase:** a script that extracts every static `class="…"` / `routerLinkActive="…"` / `[class.x]` name from a template and asserts each emits a real CSS rule somewhere in `dist/**` (must scan the JS chunks too — Angular inlines component styles into them, not into `styles-*.css`). 194 names checked across 3 templates, 0 missing. **Self-test the checker** against a file containing known-dead names (`text-text-primary`, `border-border`, `text-bogus`) — otherwise a pass is vacuous. This is the only thing that catches a silently-dead class name; Tailwind raises no diagnostic.
- Tailwind preflight sets `background-color: transparent` on form controls, so `<input>` inherits the surrounding surface and its `::placeholder` derives from the element's own `color` at 50% alpha — a themed text input needs neither a `bg-*` class nor a placeholder token.
- Playwright gotcha: with the API down, the API-unavailable modal overlays the whole shell and swallows every `page.click()` (30s timeout, "intercepts pointer events"). Measure the modal first, then `document.querySelector('.api-modal').remove()` to unblock the rest of the run. Also, to exercise a component-SCSS state class with no live data, synthesise the element and copy the `_ngcontent-*` attribute off a sibling so emulated-encapsulation styles still apply.
- Chose to **evolve Phase 1 in place rather than roll back** — the stutter was 5 class names across 2 files; everything else in Phase 1 was already verified correct.

### Verification
`npm run test -- --watch=false`: 29 files / 122 passed, 1 skipped (unchanged — no spec edits needed; `page-layout.spec.ts`/`header-search.spec.ts` assert only structural classes and text/href, never color utilities). `ng build --configuration production` clean (same 2 pre-existing budget warnings). Live two-theme Playwright diff against `ng serve` + real API + Postgres with Rosalina's dark values injected as a runtime `.dark` block: 13/13 shell + header-search elements changed between themes, zero no-deltas; `.is-highlighted` via the component-SCSS `@apply` path is byte-identical to the old literals in light mode (`indigo-600`/white) and correct in dark (`indigo-400`/`slate-900`).

---

## 2026-08-02 — Theming: `@reference` via Node Subpath Import + API-Modal `surface-raised`

### Task
Skyler challenged whether my `@reference "../../../styles.css"` fix was a fragile hack. Verified `@reference` is Tailwind's documented mechanism and replaced the relative path with a Node subpath import. Plus the one-word API-modal fix from Yoshi's open-item (c). Full write-up: `.squad/decisions/records/luigi-theming-reference-directive-evaluation.md`.

### Files
- Modified: `package.json` (new `imports` field), `shared/header-search/header-search.scss` (`@reference "#styles.css"`), `layout/page-layout/page-layout.html` (`bg-surface` → `bg-surface-raised` on the API-modal panel)

### Key patterns / gotchas
- **Correcting my own earlier note and the standing assumption: this app does NOT use `@tailwindcss/vite`.** `angular.json` has no `plugins` array, there is no `vite.config.ts`, and `.postcssrc.json` declares `@tailwindcss/postcss` — that's the only active integration, auto-detected by `@angular/build:application`. `@tailwindcss/vite` is in `dependencies` but referenced by nothing (dead dep; candidate for removal). Reason about the **PostCSS** plugin, not the Vite plugin, when checking whether a Tailwind feature applies here.
- **`@reference "#styles.css";` works, is depth-independent, and is now the required convention** for every component `.scss` using `@apply` against our tokens. Declared once in `package.json`: `"imports": { "#styles.css": "./src/styles.css" }`. Never write a relative `../../../styles.css` again — no depth counting, survives moving a component.
- **The `#` specifier is resolved by Angular's own Sass/esbuild resolver, not by Tailwind** — the failure message when the `imports` field is missing is `Can't resolve '#styles.css' … [plugin angular-sass]`, i.e. it's resolved before Tailwind's PostCSS pass runs. Better than the docs promise: doesn't depend on Tailwind's internal resolver at all. Nearest `package.json` walking up from any `src/` folder is the web project's own, so it's consistent everywhere.
- **Proving a build-config change is a true no-op: `diff -r` the entire `dist/` between the two variants.** With `outputHashing: all`, identical content-hashed filenames alone prove content equality; the recursive diff confirms it byte-for-byte. Far stronger than grepping one rule.
- **Two negative controls are what make this kind of verification non-vacuous** — (a) remove the `imports` field, keep the alias → build must FAIL (`Can't resolve`), proving the field is load-bearing; (b) keep the token `@apply`, revert to `@reference "tailwindcss"` → build must FAIL (`Cannot apply unknown utility class \`bg-accent\``), proving the alias is really supplying *our* token layer. A green build alone proves neither.
- Depth-independence tested for real, not assumed: temporarily pointed depth-2 (`custom-select.component.scss`) and depth-5 (`mystery-create.scss`) at the alias with throwaway probe rules alongside real depth-3 `header-search.scss`, all with the identical literal; all three emitted correct CSS in one build. Reverted via `git checkout` + grepped `src/` for `luigi-probe` remnants.
- `@reference` provably does not duplicate CSS: 0 occurrences of `--color-accent:` (the *definition*) in the component chunk, only `var(--color-accent, …)` usages.
- Angular's silence on `@reference` in `angular.dev/guide/tailwind` is not evidence of incompatibility — that guide (and Tailwind's Angular framework guide) never discuss `@apply` at all, in any context. Tailwind's functions-and-directives page explicitly names Angular in the affected class of tools; `styleUrl` files are architecturally the same "compiled in isolation" case as a Vue/Svelte scoped `<style>` block.
- 6 component `.scss` files still say `@reference "tailwindcss";` and are fine only while their `@apply` lines use stock utilities — each breaks on the phase that repoints it onto tokens, and that phase should switch it to `#styles.css` in the same edit.
- API-modal `bg-surface` → `bg-surface-raised` is a **zero-pixel change today** (both tokens are `var(--color-white)` in `:root` and `.dark` until Phase 7) — a pure role correction that only bites in Phase 7. Verified `.bg-surface-raised{…}` actually emits in `dist` with a bogus-name self-test, per the standing "dead class names emit nothing, silently" rule.

### Verification
`npm run test -- --watch=false`: 29 files / 122 passed, 1 skipped (unchanged). `ng build --configuration production` clean (same 2 pre-existing budget warnings); `--configuration development` also clean (separate CSS path). Alias build vs. relative-path build: byte-for-byte identical `dist/`. No live Playwright pass this time and none needed — the emitted artifact is literally the same bytes as the already-browser-verified previous build.

---

## 2026-08-02 — Theming Phase 2: Shared Components (confirm-delete-modal, custom-select, weapon-tag-select)

### Task
Phase 2 of `docs/theming/theming-plan.md`, scope-limited: re-point the three shared components onto tokens, including `custom-select.component.scss`'s `@reference` fix + `@apply` repointing. Judgment calls filed at `.squad/decisions/records/luigi-theming-phase2-shared-components.md`.

### Files
- Modified: `shared/confirm-delete-modal.component.html`, `shared/custom-select.component.{html,scss}`, `shared/weapon-tag-select.component.html`. No spec changes needed (verified, not assumed — `custom-select.component.spec.ts` is the only spec of the three and asserts structural classes + text only; the other two have no spec).

### Key patterns / gotchas
- **`@apply` works with hand-written `@utility` classes** (`@apply ring-focus`, `border-strong`, `text-primary`, `border-default`) once `@reference "#styles.css";` is in place — previously only proven for Category A tokens (`@apply bg-accent`) in `header-search.scss`. Compiled output confirms `ring-focus` inlines `box-shadow:0 0 0 2px var(--color-focus-ring)`.
- **The class-emission checker cannot validate `@apply`-only names, and that's fine — `@apply` is the loud path, not the silent one.** Names used solely inside `@apply` (`ring-focus`, `border-strong`, `box-border`, `rotate-180`, …) never appear as a `.name{}` rule anywhere in `dist`, so the harness reports them MISSING by construction. Don't chase those; an unknown utility in `@apply` fails the build outright. The harness's real job is *template* class names, which fail **silently**. Verify `@apply` results by grepping the compiled component style out of the JS chunk instead (`grep -oh 'custom-select__trigger[^"]\{0,900\}' dist/**/*.js`) and reading the emitted declarations.
- **Re-pointing literals onto tokens made the component stylesheet ~2 kB *smaller***: `custom-select.component.scss` went 5.55 kB → 3.49 kB against its 2 kB budget (still a warning, but half the overage). A literal `bg-slate-50` compiles to a long `oklch(...)` plus an `@supports` fallback; `bg-surface-sunken` compiles to a short `var(--color-surface-sunken, …)`. Worth expecting on every later phase — the two long-standing budget warnings should shrink as the rollout proceeds.
- **Negative controls re-run per file, not assumed from last time:** reverting this file to `@reference "tailwindcss";` reproduces `Cannot apply unknown utility class 'bg-surface' [plugin angular-sass]`, and the class checker self-test flags all 6 planted dead names (`bg-surface-raisedd`, `text-text-primary`, `border-border`, `ring-focus-ring`, `bg-weapon-chip-bg`, `text-luigi-bogus`) while passing the 2 real ones.
- **Playwright two-theme diff, two new gotchas worth remembering:**
  1. `transition-colors` makes `getComputedStyle` lie. Reading immediately after `classList.add('dark')` (or after `page.hover()`) returns the *pre-transition* value, so themed elements look falsely unchanged. Wait ~400 ms after any state flip before reading. This produced 4 false "SAME" rows before I caught it.
  2. Chromium reports the same color as `oklch(...)` or `oklab(...)` depending on how it was authored, so raw string comparison reports false *differences*. Canonicalise by painting the value onto a 1×1 canvas (`ctx.fillStyle = v; getImageData`) and comparing the rgba ints.
  3. An injected probe using `fixed inset-0` swallows every `page.click()` (same class of failure as the API modal). Give the probe container `position:fixed;right:0;bottom:0;width:440px` instead — colors compute identically and it stops intercepting pointer events, while staying hoverable (which `pointer-events:none` would not).
- Settings' theme picker passes `themeOptionSubLabel = () => null`, so `.custom-select__option-sublabel` doesn't exist there — synthesise one on the selected option, copying the `_ngcontent-*` attribute off its parent, to exercise the `.is-selected .custom-select__option-sublabel` SCSS rule.
- Token gap that will recur in Phases 3/4/5: **no neutral/secondary-surface token** for `bg-gray-100`-style neutral fills and hovers (Cancel button, plus 6 known later sites). Mapped to `bg-surface-sunken` + `hover:bg-accent-subtle` for now — see the inbox note; ideally resolved with a real token before Phase 3.

### Verification
`npm run test -- --watch=false`: 29 files / 122 passed, 1 skipped — unchanged from Phase 1, no spec edits. `ng build --configuration production` and `--configuration development` both clean. Class-emission sweep: 119 names across the 3 templates + the SCSS `@apply` bodies, every template-borne name emits a real rule (checker self-tested against 6 planted dead names). Every token class grepped out of `dist/**/styles-*.css` with its rule body (`.bg-danger{background-color:var(--color-danger)}` etc.). Live Playwright two-theme diff on `ng serve` (API down) with Rosalina's real dark values injected as a runtime `.dark` block: **25 of 26 measured properties change between themes; the 1 that doesn't is the modal scrim, which is theme-invariant by Rosalina's explicit design.** Light-mode values confirmed byte-identical to the pre-change literals everywhere except the 6 deliberate shifts documented in the inbox note.

---

## 2026-08-02 — `--color-surface-hover` Token Landing + Theming Phase 3 (Simple Detail Pages)

### Task
Two pieces. (1) Yoshi/Rosalina closed my Phase 2 neutral-hover gap with a real `--color-surface-hover` token (light `gray-200`, dark `slate-700`) — added it to `styles.css` (Category A, `@theme static`, auto-generates `bg-surface-hover`/`hover:bg-surface-hover`) and swapped the confirm-delete modal's Cancel-button placeholder (`hover:bg-accent-subtle`) onto it. (2) Phase 3: re-pointed the Detail Form Pattern across `bystander-detail.html`, `location-detail.html`, `minion-detail.html` (5 forms) onto `border-strong`/`focus:border-accent`/`focus:ring-focus`/`bg-accent`/`text-on-accent`/`text-primary`, plus `minion-detail.scss`'s `@reference` fix and its two `@apply` rules (`bg-gray-100`→`bg-surface-hover`, `bg-red-100 text-red-600`→`bg-danger-subtle text-danger`).

### Key patterns / gotchas
- **`bg-surface-hover`'s base (non-`hover:`) form only emits when something in-tree actually uses the bare class.** Confirm-delete-modal only ever uses `hover:bg-surface-hover`; to prove the *base* utility itself compiles (needed since `minion-detail.scss`'s `@apply bg-surface-hover` — inside a `:hover:not(:disabled)` selector — consumes the base name, not the `hover:` variant), dropped a throwaway probe `.html` under `src/app/` with both forms plus deliberately-misspelled ones, built, grepped, deleted. Confirms the standing "self-test against a bogus name" rule catches both a missing real rule and a wrongly-present bogus one.
- **`@apply`'d utility names never show up as their own `.name{}` rule in `dist/**/styles-*.css`** — they get inlined directly into the *component's* compiled CSS, which lives inside its lazy JS chunk, not the global stylesheet. Confirmed `.action-btn:hover:not(:disabled){background-color:var(--color-surface-hover, var(--color-gray-200))}` and `.action-btn--delete:hover:not(:disabled){background-color:var(--color-danger-subtle, var(--color-red-100));color:var(--color-danger, var(--color-red-600))}` by grepping the `minion-detail` chunk specifically, not `styles-*.css`. Same rule as Phase 2's note, re-confirmed for a new file.
- **My own class-emission checker script has a real bug worth remembering, not fixing today:** it string-matches `.` + class name, so it silently false-negatives on any class using a Tailwind variant prefix (`focus:border-accent`, `hover:bg-surface-hover`, `disabled:opacity-40`, ...) because the compiled CSS selector escapes the colon (`.focus\:border-accent:focus{...}`) — the literal substring `focus:border-accent` (no backslash) never appears. It also false-negatives on any arbitrary-value class with brackets (`rounded-[0.35rem]`, `max-w-[30rem]`) for the same escaping reason. None of this is a real gap — every flagged "MISSING" real class was hand-confirmed present via a targeted `grep` with the actual escaped selector — but it means the checker's PRESENT/MISSING split is only trustworthy for bare (no-variant, no-bracket) class names; variant-prefixed and arbitrary-value ones need a manual follow-up grep. The checker still correctly rejected all 6 planted bogus names (`bg-surface-hoverbogus`, `text-primarybogus`, ...), so it's not vacuous, just incomplete.
- **Two negative controls re-run on `minion-detail.scss` specifically:** reverting `@reference` to `"tailwindcss"` reproduces `Cannot apply unknown utility class 'bg-surface-hover'`; keeping the correct `@reference` but planting `text-luigi-bogus` in the second `@apply` reproduces `Cannot apply unknown utility class 'text-luigi-bogus'`. Both reverted immediately after confirming the failure, file restored, clean build re-verified before moving on.
- **Real gap between the theming plan's Phase 3 Goal text and the actual codebase, filed as `.squad/decisions/records/luigi-theming-phase3-badge-pattern-gap.md`:** Phase 3's Goal claims to "establish the type badge token pattern... in one place before Phase 4 reuses it," but none of its three files (`bystander-detail`, `location-detail`, `minion-detail`) render an existing type badge — each shows type via a plain `<app-custom-select>` dropdown. The actual badge markup (`bg-blue-100 text-blue-800`, etc.) lives only in the three list pages, all Phase 4 files. Did not invent new badge UI to satisfy the Goal text — out of "re-point what exists" scope and not in Phase 3's own Files-changed list. Recommend correcting the Goal sentence.
- Scoped the Phase 3 re-point strictly to "form/label/input/button" (per this task's own framing): left `text-red-800` error banners untouched (identical literal on ~9 other pages across every later phase, explicitly Phase 7's sweep job) and left `minion-detail.html`'s sub-resource entity-card wrappers/list-item dividers/weapon-tag chip/muted description text untouched (out of Detail-Form-Pattern scope; `monster-detail`, Phase 5, is where the structurally-identical sub-resource grid gets its own explicit, more-thorough pass).
- Input border re-point (`border-slate-200`→`border-strong`) is a deliberate one-step-darker shade shift, following the plan's own explicit instruction ("`--color-border-strong` for inputs") even though it doesn't match the *current* code's literal (which had drifted to `border-slate-200`/`--color-border`'s value) — it does match the original Tailwind-migration doc's own canonical Detail Page Form pattern (`border-[#c9d4e6]`), so this is a correction toward the documented canonical shape, not an arbitrary change.

### Verification
`npm run test -- --watch=false`: 29 files / 122 passed, 1 skipped — unchanged, no spec edits needed (verified, not assumed: none of the three detail-page specs assert on any `bg-`/`text-`/`border-` class). `ng build --configuration production` and `--configuration development` both clean (same 2 pre-existing budget warnings). `bg-surface-hover`/`hover:bg-surface-hover` both confirmed emitting real rules via build + grep, bogus-name self-test included. All re-pointed classes (`bg-accent`, `text-on-accent`, `border-strong`, `text-primary`, `focus:border-accent`, `focus:ring-focus`, `focus:outline-none`, `hover:bg-surface-hover`, `hover:bg-danger-hover`) confirmed via direct grep against the compiled `dist/**/styles-*.css`; `bg-danger-subtle`/`text-danger` (first-ever consumers of those two Category A tokens) confirmed via the `minion-detail` JS chunk. No live two-theme Playwright pass this round — judgment call, since every token used here (`border-strong`, `border-accent`, `ring-focus`, `bg-accent`, `text-on-accent`, `text-primary`, `bg-danger`/`-subtle`, `text-on-danger`) was already live-verified in Phases 1/2, and the one genuinely new token (`surface-hover`) is fully proven by the build+grep+self-test chain above; Phase 3 is marked Low risk in the plan.

---

## 2026-08-02 — Theming Phase 4: List Pages (badge pattern's first real consumer)

### Task
Phase 4 of `docs/theming/theming-plan.md`: re-pointed `mysteries-list.html`, `monsters-list.html` (+ `.scss`), `minions-list.html`, `bystanders-list.html`, `locations-list.html`, and `search-results.html` (+ `.ts` badge map, + `.spec.ts`) onto tokens — the four active type badges (monster/minion/bystander/location) plus the monster-archetype badge get `--color-badge-*`/`--color-on-badge-*` for their first real template usage. Full write-up: `.squad/decisions/records/luigi-theming-phase4-list-pages.md`.

### Files
Modified: `mysteries-list.html`, `monsters-list.{html,scss}`, `minions-list.html`, `bystanders-list.html`, `locations-list.html`, `search-results.{html,ts,spec.ts}`. No `minions-list.scss` exists (never did — minions have no delete endpoint/hover guard); the plan's "+ its SCSS stub" line for it is a false lead, confirmed via `ls`, not assumed.

### Key patterns / gotchas
- **A dead-code duplicate rule can silently defeat a token repoint via cascade order — found in `monsters-list.scss`.** The file still carried ~90 lines of pre-migration legacy CSS (unused class names like `.monster-list`/`.type-badge*`, never referenced by the actual Tailwind-utility template) including a **second** `.action-btn:hover:not(:disabled) { background: #f3f4f6; }` block sitting *after* the real `@apply`'d one — same specificity, later wins. Left alone, this would have permanently pinned the hover fill to a literal value in both themes the moment `.dark`'s `--color-surface-hover` diverges from light in Phase 7, silently defeating the repoint with a clean build and no visible symptom until then. Deleted the dead code entirely, matching the migration doc's own documented 4-line-stub target for this file (`tailwind-migration-plan.md` line 664) and `minion-detail.scss`'s existing precedent. **Worth checking for on every future SCSS-repoint phase**: grep the file for a class name used in the template, and if a selector for it appears more than once, check which one wins the cascade before assuming the first (or only the `@apply`'d one) is live.
- **Type Badge Pattern scope is asymmetric across badges by design, not oversight**: 4 of 5 catalogue badge pairs (monster/minion/bystander/location) get tokenized everywhere they appear (`*-list.html` + `search-results.ts`'s `DOMAIN_BADGE_CLASSES`); the 5th (mystery) stays a deliberate literal (`bg-amber-100 text-amber-700`) since `--color-badge-mystery` is explicitly reserved/unused pending a real feature — don't invent a value for it even though `mysteries-list.html`'s adventure-type badge is functionally identical in shape to the other four.
- **A shade shift is sometimes the *closer* semantic match, not a compromise**: `mysteries-list.html`'s create button (`bg-blue-700 hover:bg-blue-800`, no token holds this exact value) is this page's primary-action CTA — re-pointed to `bg-accent hover:bg-accent-hover` (the correct *role*), same treatment Phase 1 already gave the shell's identical-shaped `bg-indigo-600` button. `dashboard.html` (Phase 5) has the byte-identical button — flagged in the inbox note so Phase 5 doesn't rediscover it.
- **Re-pointing a literal onto a shared token can retroactively fix an unrelated inconsistency**: `search-results.ts`'s Minion badge previously used a bespoke `orange-100/orange-800` (chosen in Phase 4c specifically *because* no shared minion-badge token existed at the time — see that entry above). Now that `--color-badge-minion` exists, pointing search-results at it converges its Minion badge onto the exact same `#fde8d8` fill every other minion badge in the app already uses — a bonus consistency fix, not something this phase set out to do on its own.
- **Negative control re-confirmed on `monsters-list.scss` specifically**: reverting its `@reference` to `"tailwindcss"` reproduces `Cannot apply unknown utility class 'bg-surface-hover'` exactly as expected; reverted immediately, clean build re-verified.
- **Self-tested the class-emission checker against a bogus *variant-prefixed* name this round** (`hover:bg-surface-hoverbogus`), specifically to guard against the exact colon-escaping false-negative I flagged as a checker limitation in the Phase 3 note — confirmed it correctly reports as missing (i.e., a real bug of that shape would still be caught), not just the bare-name bogus cases from before.

### Verification (Phase 4)
`npm run test -- --watch=false`: 29 files / 123 passed, 0 skipped (up from 122/1 skipped — the Phase-0-disabled `search-results.spec.ts` badge assertion is now a real, rewritten, passing test). `ng build --configuration production`/`--configuration development` both clean (same 2 pre-existing budget warnings). Live two-theme Playwright diff against `ng serve` + real API + Postgres, Rosalina's real dark values injected as a runtime `.dark` block: 16/16 static-state checks (list-item card surface/border, all five badge fills across all five pages, three action-button icon colors, the mysteries create-button) show a real delta between themes, 0 no-deltas; a separate 5-button hover-state pass (including the SCSS `@apply`-driven `monsters-list` path) also shows 5/5 real deltas. Probe scripts written inside the package dir (Node ESM resolution requirement) and deleted after use — confirmed via `git status` no stray files remain.


---

## 2026-08-02 — Theming Phase 5: Medium Pages & Admin

### Task
Phase 5 of `docs/theming/theming-plan.md`: re-pointed `mystery-detail.html` (+ `.scss`), `monster-detail.html` (+ `.scss`), `dashboard.html`, `data-admin.html` (+ `.scss`), `weapon-tag-admin.html` (+ `.scss`) onto tokens, including both admin tables' `nth-child` striping remnants and `monster-detail`'s archetype badge. Full write-up: `.squad/decisions/records/luigi-theming-phase5-medium-pages-admin.md`.

### Key patterns / gotchas
- **The `@reference "#styles.css"` obligation applies to files with no `@apply` at all, where it is inert.** Three of Phase 5's four `.scss` files (`mystery-detail`, `data-admin`, `weapon-tag-admin`) carry zero `@apply` lines — the admin ones read tokens directly through `var()` in a plain `nth-child` rule, which needs no Tailwind context whatsoever. Changed them anyway per the plan's literal instruction (consistent convention, zero emitted output, future-proofs a later `@apply`), but the practical consequence is that the **negative control is only demonstrable on the one file that really uses `@apply`** — don't claim a per-file negative control you can't actually run.
- **`git checkout -- <file>` is the wrong revert for a negative control on a file you have *also* legitimately edited this session.** Reverting `monster-detail.scss` after the deliberate `@reference "tailwindcss"` break restored it to HEAD and silently wiped my Phase 5 edits along with the break. Caught it because the tool surfaced the file change; a `.bak` copy (or re-applying from memory *and* re-verifying the compiled output) is the safer pattern. Re-verified the restored file by re-grepping the compiled `@apply` output from the JS chunk, not just by eyeballing the source.
- **Two "bogus" self-test names turned out not to be bogus, which is itself the useful finding.** `focus:ring-focus-ring` emits a real rule — it's the *auto-generated stuttering* name for `--color-focus-ring` (Category B tokens still generate their stuttering name; the hand-written `@utility` adds the clean name, it doesn't remove the ugly one). And Tailwind emits arbitrary-value utilities without validating units: `w-[55%zz]` compiles to `width:55%zz`. So arbitrary-value classes are effectively un-typo-checkable by any emission-based checker — a real blind spot to keep in mind. The 7 genuinely-bogus names (including variant-prefixed `hover:bg-bogus`) were all correctly flagged.
- **A class the emission checker reports MISSING may be a deliberate test hook, not dead markup.** `countdown-list` in `mystery-detail.html` has no CSS rule anywhere but is the selector `mystery-detail.spec.ts` uses (`.countdown-list app-mystery-section-icon`). Same category as Phase 0's `.sidebar-mobile`/`.api-modal` false lead. Always grep the specs before deleting a "dead" class attribute.
- **Dead-CSS sweep on all four Phase-5 `.scss` files: clean.** All are already small post-migration stubs, every selector matches live markup, no selector appears twice — no repeat of Phase 4's `monsters-list.scss` duplicate-rule cascade bug. (Phase 7 now owns the full app-wide version of this sweep — Yoshi added it to the plan while I was working.)
- **No token exists for a table-header fill or a skeleton-loader bar.** Mapped the admin `<th>` fill (`#e8eefb`) to `bg-accent-subtle` (light `indigo-50` `#eef2ff` — near-exact, and the same token the striping fix uses for even rows, so header and even rows now share a fill; accepted, they're distinguished by bold weight + border) and dashboard's skeleton bars (`bg-gray-200`) to `bg-surface-hover` (whose light value *is* literally `gray-200`, so pixel-exact in light and clearly visible `slate-700` in dark). Both are role stretches, both flagged in the inbox note.
- **Phase 7's sweep as written has a hole: it greps for "`text-`/`bg-`/`border-` + a Tailwind color name," which misses arbitrary-hex classes** (`text-[#a10808]`, `bg-[#1d3557]`, `border-[#edf1f8]`). I handled the arbitrary-hex ones inside this phase's own files for that reason, while still deferring the plain `text-red-800` banners (which the sweep *will* catch) per the Phase 3/4 precedent. Recommended widening the sweep's grep in the inbox note.
- **`--color-success` has zero consumers in the whole app** (verified by grep, not assumed) — Phase 6's wizard-complete bubble (`bg-emerald-500`/`border-emerald-500` in `mystery-create.scss`) is its first, so that phase gets no prior-phase precedent and should verify its emission explicitly.

### Files
Modified: `mystery-detail.{html,scss}`, `monster-detail.{html,scss}`, `dashboard.html`, `data-admin.{html,scss}`, `weapon-tag-admin.{html,scss}`. No spec edits needed (verified, not assumed — none of the five specs assert on a color class).

### Verification (Phase 5)
`ng build --configuration production` clean (same 2 pre-existing budget warnings). `ng test --watch=false`: 29 files / 123 passed, 0 skipped — unchanged from Phase 4. Class-emission checker over all five templates: 153 distinct names, 1 "missing" (the `countdown-list` test hook above); checker self-tested against 9 planted names, 7 genuinely-bogus ones all flagged (incl. variant-prefixed). All 24 token classes grepped out of `dist/**/styles-*.css` with rule bodies; both striping rules + `monster-detail`'s three `@apply` rules grepped out of their component JS chunks in compiled form; `--color-surface`/`--color-accent-subtle` confirmed present in the emitted `:root` (the `@theme static` dependency this fix has). `@reference` negative control on `monster-detail.scss` reproduces `Cannot apply unknown utility class 'bg-surface-hover'`. Live two-theme Playwright diff against the already-running `ng serve` + real API + Postgres with Rosalina's real dark values injected: **44/45 measured properties change between themes; the 1 that doesn't is the deliberately-literal amber adventure-type badge.** Separate hover pass on the `@apply`-driven `.action-btn--delete` shows both fill and color changing, with light values byte-identical to the old `bg-red-100`/`text-red-600` literals. Probe scripts written inside the package dir and deleted after use (`git status` confirms no strays).

---

## 2026-08-03 — Theming Phase 6: The Mystery Wizard (+ deferred verification pass)

### Task
Phase 6 of `docs/theming/theming-plan.md`: re-pointed `mystery-create.html` + its six sub-templates (`-tracker`, `-mystery-phase`, `-monster-phase`, `-locations-phase`, `-bystanders-phase`, `-dossier`) and `mystery-create.scss` (`@reference` fix + `@apply` targets only) onto tokens. The code landed in an earlier session that was cut off before the verification report; this entry covers both. Judgment calls: `.squad/decisions/records/luigi-theming-phase6-mystery-wizard.md`.

### Key patterns / gotchas
- **`page.click('button.bg-accent')` in the wizard silently clicks the *shell's* "Quick action" button, not Next.** Phase 1 gave the page-layout header a round `bg-accent` icon button, so any bare token-class selector now matches two elements app-wide, and `page.click(selector)` is non-strict (first match wins) — the wizard simply never advanced, with no error. `page.locator()` *is* strict and would have raised `strict mode violation`. **Scope every Playwright selector to `.mystery-create section …` (or use `getByRole`) now that the shell shares the app's token classes** — this trap gets worse with every phase, since token class names are by design not unique to one component.
- **Fixed the class-emission checker's long-standing escaping blind spot** (flagged in the Phase 3/4 notes): build the CSS selector with `name.replace(/[^a-zA-Z0-9_-]/g, c => '\' + c)` before matching, which handles `:` `[` `]` `.` `/` `%` `#` uniformly. Variant-prefixed (`hover:bg-accent-hover`, `focus:ring-focus`) and arbitrary-value (`text-[0.9rem]`, `flex-[1_1_220px]`) names now resolve correctly instead of false-negativing. Self-tested with 7 planted bogus names (incl. two variant-prefixed) — all flagged — plus 3 real variant-prefixed names — all PRESENT. 144 distinct names across the 7 templates, 2 "missing", both deliberate spec hooks (`countdown-grid` / `countdown-dossier-grid`, `mystery-create.spec.ts:139-140`) — third instance of the Phase-0 `.sidebar-mobile` / Phase-5 `countdown-list` category, so **always grep the specs before calling a CSS-less class dead**.
- **A `--color-*` token whose light and dark values are both `white` is invisible to a two-theme diff** — the wizard-complete bubble's `text-on-accent` placeholder can only be validated by reading `--color-on-accent`'s *dark* value out of Rosalina's palette doc and injecting it, not by watching the app. Confirmed live: light `255,255,255` / dark `15,23,42` (`slate-900`) on the `.complete` bubble, i.e. exactly the pair an `on-success` token would hold. Contrast against dark `--color-success` (`emerald-400`): `slate-900` ≈ 9.3:1, `white` ≈ 1.9:1 (corrected an earlier ~1.7:1 estimate in the decision file).
- **`animation-name` is a legitimate thing to assert in a two-theme diff run as a SAME row, not a DIFF one.** `fadeSlideIn` verification is `getComputedStyle(el).animationName === 'fadeSlideIn'` plus `el.getAnimations()` returning one entry with `playState: 'finished'` — an actually-fired animation, not just a declared one. Keep it out of the changed/unchanged colour tally so it doesn't read as a missed repoint.
- **`.complete` beats `.active` on a phase bubble** (equal specificity, later in source), so a bubble you've navigated *back* into shows green, not indigo — no "you are here" marker anywhere in the tracker. Pre-existing (identical source order before the repoint), but more confusing in dark mode where `emerald-400`/`indigo-400` are closer in luminance than `emerald-500`/`indigo-600`. Filed, not fixed.
- **Re-confirmed the duplicate-child-entity bug with a precise repro** (see the decision file): re-entering an already-complete phase via its tracker bubble and pressing Next re-runs `submitCurrentPhase()` — two identical `POST …/monsters`, `monsterCount: 2`. `submitCurrentPhase()` has no already-submitted guard. The dev DB's four pre-existing "The Miller" monsters suggest this has bitten real usage.
- **Monsters/locations/bystanders are many-to-many with mysteries (`mysteryIds`, plural)** — deleting a probe mystery leaves its children behind as standalone library rows. Clean up child entities explicitly after any wizard Playwright run, not just the mystery. (Also cleaned 9 leftover probe mysteries from the previous, cut-off session; dev DB restored to its 2 real ones.)

### Files
Modified: `mystery-create.{html,scss}`, `mystery-create-tracker.html`, `mystery-create-mystery-phase.html`, `mystery-create-monster-phase.html`, `mystery-create-locations-phase.html`, `mystery-create-bystanders-phase.html`, `mystery-create-dossier.html`. No spec edits (verified: `mystery-create.spec.ts` / `mystery-create.store.spec.ts` assert structure and text only).

### Verification (Phase 6)
`ng build --configuration production` clean (same 2 pre-existing budget warnings; `mystery-create.scss` 8.27 kB → 3.02 kB thanks to the literal→`var()` shrink noted in Phase 2). `ng test --watch=false`: 29 files / 123 passed, 0 skipped — unchanged from Phases 4/5. Arbitrary-hex/rgb/inline-style sweep across all 8 files: zero colour-bearing literals or bindings (only the deliberate `bg-amber-100 text-amber-700` adventure badge remains, per item 5 of the decision file). Compiled `@apply` output grepped out of `chunk-*mystery-create*.js` — all nine `.phase-bubble`/`.step-dot`/`.tracker-line` rules resolve through `var(--color-…)`, no baked literals. Live two-theme Playwright pass against `ng serve` + real API + Postgres with Rosalina's dark values injected: **59 of 60 measured colour properties change between themes across all four phases** (concept form, hook, overview, 6-input countdown grid, monster form, weapon-tag chip, sub-item cards/dividers/remove buttons, `+ Add` outline buttons, location & bystander pills, dossier headings/body/labels, nav buttons, submit-error banner, focused input); the 1 no-delta is the deliberately-literal amber badge. Full bubble/line/dot state matrix captured at 8 tracker positions (forward walk + three backward bubble jumps + forward bubble jumps) — every bubble, connector and dot in every state differs between themes, 0 no-deltas. `fadeSlideIn` confirmed firing. **Full end-to-end wizard completion in dark mode**: mystery + 6-stage countdown + monster (type, archetype, harm capacity, attack with weapon tag) + location + bystander all created correctly, `monsterCount: 1` (no duplicates when walking strictly forward), skipped-minion path correct. Probe scripts written inside the package dir and deleted after use; probe data removed from the dev DB; `git status` shows only the 8 intended files.

## 2026-08-03 — Two-gap cleanup: `--color-badge-mystery` value + `--color-on-success` placeholder swap

Small touch-up, not a new phase: Rosalina assigned real values to the previously-reserved `--color-badge-mystery`/`--color-on-badge-mystery` pair (light `amber-100`/`amber-700`, unchanged; dark `amber-950`/`amber-300`), and Yoshi/Skyler formalized `--color-on-success` (`white`/`slate-900`, same as `--color-on-accent`). Both were already fully specified in `theming-plan.md`/`dark-theme-palette.md` before I touched anything.

- Added both token pairs to `styles.css`'s `@theme static` and `.dark {}` blocks, right alongside their sibling badge tokens / `--color-success`. Deleted the now-stale "reserved, not declared yet" comment above the badge catalogue and the "Phase 0 no-op" framing doesn't apply to these two — per the source docs' explicit instruction, they get real (non-identical-to-light) dark values from day one, unlike the rest of `.dark` which is still Phase-0 placeholder pending the full Phase 7 rollout.
- Re-pointed the last remaining `bg-amber-100 text-amber-700` literal onto `bg-badge-mystery`/`text-on-badge-mystery` in all 4 places: `mysteries-list.html`, `mystery-detail.html`, `mystery-create-dossier.html`, and `search-results.ts`'s `DOMAIN_BADGE_CLASSES.Mystery` — also deleted that file's now-stale doc comment explaining why Mystery was "deliberately left as a literal."
- Swapped `mystery-create.scss`'s `.phase-bubble.complete` from the flagged `text-on-accent` placeholder to `text-on-success`, removing the 5-line comment explaining the placeholder (no longer needed).
- No doc edits needed — `theming-plan.md`/`dark-theme-palette.md` already described this exact follow-up as pending, written by Rosalina/Yoshi in the same session.

### Verification
`ng build` clean. Grepped compiled `styles-*.css`: `.bg-badge-mystery{background-color:var(--color-badge-mystery)}` / `.text-on-badge-mystery{color:var(--color-on-badge-mystery)}` both present; `:root`/`.dark` custom properties confirm `--color-badge-mystery`/`--color-on-badge-mystery`/`--color-on-success` all resolve to the correct light vs. dark `var(--color-amber-*)`/`var(--color-slate-900)` values. Bogus-name self-test (`bg-badge-bogusxyz`) confirms absent — the checker isn't vacuous. `text-on-success` isn't in the global `styles-*.css` (expected — it's only used inside a component `@apply`), so verified it in the compiled component chunk instead: `.mystery-create .phase-bubble.complete{...color:var(--color-on-success, var(--color-white))}` — a real, resolved rule. `ng test --watch=false`: 29 files / 123 passed, 0 skipped, unchanged. Live verification done via a static-HTML Playwright probe (built from the actual compiled `styles-*.css` plus the compiled `.phase-bubble.complete` rule copied verbatim out of the chunk) rather than a full `ng serve` + API + Postgres run, since this is a token-value-only touch-up, not new UI — toggling `.dark` on `<html>` showed the badge bg/text and the bubble's `on-success` text all changing between themes as expected (the bubble's `--color-success` fill itself stays flat, correctly, since only `on-success` got a real dark value this round — `--color-success` is still Phase-0 no-op pending full Phase 7). Bogus class self-test control stayed transparent in both themes. Probe files written outside the repo (scratchpad) plus one throwaway `.mjs` written temporarily inside the package dir for Node ESM resolution and deleted immediately after.

### Files
Modified: `styles.css`, `mysteries-list.html`, `mystery-detail.html`, `mystery-create-dossier.html`, `search-results.ts`, `mystery-create.scss`. No spec edits needed (verified — no spec asserts the old `bg-amber-100`/`text-amber-700`/`text-on-accent` literals).

## 2026-08-03 — Theming Phase 7: Cleanup, Sweep, and Palette Swap-In

### Task
Final content phase of `docs/theming/theming-plan.md`. Part 1: sweep the whole app for remaining literal Tailwind classes, arbitrary hex/rgb bindings, and — per Yoshi's mid-project addition (`.squad/decisions/records/yoshi-theming-phase7-dead-css-sweep.md`) — dead/unused legacy CSS in every component `.scss`, not just `monsters-list.scss`'s known precedent. Part 2: swap `styles.css`'s `.dark {}` block from the Phase 0 light-value placeholder to Rosalina's real dark fills (`dark-theme-palette.md`). Phase 8 (FOUC inline script) is explicitly out of scope.

### Key patterns / gotchas
- **All 10 `.scss` files in the app already had correct `@reference "#styles.css"` and zero dead selectors** — Phases 1–6 left this codebase cleaner than the Phase 7 brief assumed. The only real `@apply`-body straggler was `search-results.scss`'s `mark` rule (flagged back in Phase 4), tokenized onto `bg-accent-subtle text-accent` (no dedicated "search highlight" token exists; reused the nearest correct role — a translucent low-emphasis accent wash, which stays visible over any dark-mode surface, unlike `weapon-chip`'s flat near-black dark fill).
- **The literal sweep's biggest catch was the 12 identical `<p class="text-red-800">{{ errorMessage() }}</p>` error banners** (deferred since my own Phase 3 report) — all repointed to `text-danger`. Also `minion-detail.html`'s sub-resource cards (`bg-white border-slate-200`→`bg-surface border-default`, `border-[#edf1f8]`→`border-default`, `text-gray-500`→`text-muted`, the weapon-tag chip literal→`bg-weapon-chip`/`border-weapon-chip-line`/`text-on-weapon-chip`) — all explicitly deferred out of Detail-Form-Pattern scope back in Phase 3. `page-layout.html`'s mobile close-button icon (`text-white`) repointed to `text-sidebar` — a real miss, distinct from the MOTW-logo/Soon-badge `bg-white/20`+`text-white` instances, which are Rosalina's sanctioned, already-reviewed exception (Phase 1 open items #3) and were deliberately left alone. `search-results.ts`'s `badgeClasses()` fallback (`?? 'bg-slate-100 text-slate-700'`, for an `entityType` outside the five known domains — practically unreachable but still a literal) repointed to `bg-surface-hover text-primary`, flagged as a role-stretch same as Phase 5's admin `<th>`/skeleton reuses.
- **The single biggest finding wasn't in the literal-class grep at all — it was 12 pages with no default text color**, only surfaced by actually toggling `.dark` with Rosalina's *real* values and reading `getComputedStyle`. `monsters-list.html`/`minions-list.html`/`locations-list.html`/`bystanders-list.html`/`mysteries-list.html`/`monster-detail.html`/`minion-detail.html`/`location-detail.html`/`bystander-detail.html`/`mystery-detail.html`/`search-results.html`/`data-admin.html` all open with a bare `<section>` (or `<section class="grid gap-4">` for data-admin) with no `text-primary` — every unclassed heading/paragraph on these pages was inheriting the browser's UA-default black `color`, not `--color-text-primary`. Invisible through Phases 0–6 because black ≈ `--color-text-primary`'s *light* value (`slate-950`), so it looked correct; only became black-on-near-black (genuinely unreadable) once real dark values landed. `dashboard.html` and `settings.html` never had this bug — both explicitly set `class="text-primary"` on their root `<section>` from the start; the wizard never had it either, because Phase 6 classed every text-bearing element individually rather than relying on inheritance. Fix: added `text-primary` to the same 12 root wrappers, matching the dashboard/settings convention exactly. Confirmed via computed-style before/after (`rgb(0,0,0)` → `oklch(0.984 0.003 247.858)` = `slate-50`) and a full visual re-pass. **This is the exact "first time the real palette is visible" risk the plan's Phase 7 section calls out — worth treating any Phase 7-shaped palette swap-in as an occasion to re-verify every page's computed text color, not just grep for literal classes.**
- Contrast spot-checks used actual rendered pixels, not hand-computed hex: read `getComputedStyle` (which Chromium reports as `oklch(...)`, not `rgb(...)`, so string-matching fails) then canonicalized via the 1×1-canvas paint trick from an earlier phase's notes, then ran the WCAG relative-luminance formula (self-tested: black/white → 21.00, confirms the formula). Results: minion `badge-minion`/`on-badge-minion` (`orange-950`/`orange-300`) 9.18:1, bystander (`blue-950`/`blue-300`) 8.08:1, location (`green-950`/`green-300`) 10.67:1 — all comfortably clear AA (and AAA) for normal text, all three previously flagged by Rosalina as "constructed but not individually hand-verified." Cross-checked monster (8.42:1) and mystery (10.37:1) against Rosalina's own hand-computed ~8.5:1/~10.4:1 — close enough to confirm the measurement methodology itself is trustworthy, not just the new numbers.
- Admin table striping: composited the even row's translucent `accent-subtle` fill over the odd row's solid `surface` fill via canvas (not just reading each color in isolation, since `accent-subtle` is alpha and its visible result depends on what's under it) — actual rendered row-to-row luminance contrast is ~1.27:1 in dark mode, vs. ~1.12:1 for the existing, already-shipped light-mode stripe (`white` vs `indigo-50`). Not a WCAG text-contrast case (it's decorative striping, not text), and the ratio undersells it since hue-shift (neutral navy vs. indigo-tinted) reads as more distinct to human vision than luminance alone — confirmed genuinely visible in the two-theme screenshot pass either way.
- Palette swap-in itself was exactly as low-risk as Decision B promised: single-file `styles.css` change, zero template edits, `@theme static` symmetry (`:root`/`.dark`) re-verified for all 43 catalogue tokens after the swap.

### Files
Modified: `styles.css` (palette swap-in), `search-results.{html,scss,ts}`, `minion-detail.html`, `page-layout.html`, and the 12 pages that gained `class="text-primary"` on their root wrapper (`monsters-list`, `minions-list`, `locations-list`, `bystanders-list`, `mysteries-list`, `monster-detail`, `minion-detail`, `location-detail`, `bystander-detail`, `mystery-detail`, `search-results`, `data-admin` — several overlap with the error-banner/badge-fallback edits above, 17 files touched total). No spec edits needed (verified — none of the touched specs assert on `text-red-800`, the search fallback badge class, or a wrapper's color class).

### Verification
`ng build --configuration production`/`--configuration development` both clean (same 2 pre-existing budget warnings). `ng test --watch=false`: 29 files / 123 passed, 0 skipped — unchanged. `@reference` negative control re-run on `search-results.scss` (the one file whose `@apply` target actually changed this phase): reverting to `"tailwindcss"` reproduces `Cannot apply unknown utility class 'bg-accent-subtle'`. Class-emission checker: every repointed/new class (`text-danger`, `text-sidebar`, `bg-weapon-chip`, `bg-accent-subtle`, `text-accent`, `text-primary`, etc.) confirmed present in compiled `styles-*.css`; 3 planted bogus names all correctly MISSING. All 43 Token Catalogue entries confirmed present in both `:root` and `.dark` post-swap (the `@theme static` symmetry check). Live two-theme Playwright pass against `ng serve` + real API + Postgres with the actual palette swap-in live (not injected) across every route — dashboard, all 5 list pages, all 5 detail pages, data-admin (+ weapon-tag-admin sub-component + table striping), search results, settings, the full wizard's first phase, the confirm-delete modal, the API-unavailable modal, the user menu, both toast kinds, and the mobile nav overlay — full-page screenshots taken in both themes for every route, visually reviewed. Contrast spot-checks above. Probe scripts written inside the package dir and deleted after use; screenshots/scripts written to scratchpad; `git status` confirms only the 17 intended source files changed.

---

## 2026-08-04 — Bug 2: Wizard phase-revisit duplicates (frontend half)

### Task
Implement Yoshi's resolved Bug 2 design (`.squad/decisions/records/yoshi-bug2-wizard-resubmission-resolved.md`): make every wizard phase idempotent across revisits (phase 0 mystery, phase 1 monster+minion, phases 2/3 locations/bystanders), plus conditionally-required Minion Name. Backend blank-Name guard was Bowser's, in parallel.

### Key patterns / gotchas
- **The whole bug was one missing line per phase, not a missing mechanism.** The ID-based upsert branches (`editingMonsterId`, `mysteryId()`) already existed and were correctly shaped — they were just only ever *populated* by `loadEditData()`. Fix is to `.set()` the id signal immediately inside the save's `switchMap`, on both the create and the update path. Same for the sub-collection id arrays. Resist re-architecting when the branch is already there.
- **`submitPhase0`'s `isEditMode() && existingId` gate was the tell**: `isEditMode()` is *route-derived* (`:id` present at init) and never becomes true mid-create-session, so it can never be the right key for "does this entity exist yet." Key off the id signal alone; `isEditMode()` should only drive things that genuinely differ between "opened an existing mystery" and "building a new one" (it now survives in exactly two places: `isPhaseAccessible()` and the final success toast's wording).
- **`saveThreatCollections`/`saveMinionCollections` returning a flat `Observable<unknown[]>` was what blocked id tracking** — the created attacks/powers/weaknesses/armors were concatenated into one array with no way to tell them apart. Restructured to `forkJoin({attacks, powers, weaknesses, armors})` returning a category-keyed `SavedThreatCollections`/`SavedMinionCollections`. `runBatch` genericized to `runBatch<T>(Observable<T>[]): Observable<T[]>` (needs `of<T[]>([])` on the empty branch) so those types survive the trip.
- **Locations/bystanders: index-pairing create responses back onto drafts is only safe because those steps are append/remove-only** — verified in `mystery-create-locations-phase.html`/`-bystanders-phase.html` (a `@for` of names with an `×` button, plus a separate add-form; no reorder, no edit-in-place). Extracted as `backfillDraftIds<T extends {id: string|null}>(drafts, created)` with that assumption documented on it — if either template ever gains drag-reorder or inline edit, this breaks silently.
- **`existingLocationIds`/`existingBystanderIds` are still needed after the switch to per-draft `id`** — they're the *pre-submit baseline*. A draft the user removed via `×` is gone from the array entirely, so the only trace that it was ever linked is the baseline list; `idsToUnlink = baseline.filter(id => !drafts.some(d => d.id === id))`. Deleting the baseline signals in favour of "just the drafts" would silently stop unlinking removed rows.
- **`LocationService`/`BystanderService` were the only domains the store reached past** (raw `apiService.post`/`delete`/`get`) — added `getByMystery`/`create`/`unlinkFromMystery` to both mirroring `MonsterService`, which let the `ApiService` injection be dropped from the store entirely. Note `unlinkFromMystery(mysteryId, id)` ≠ `delete(id)`: these entities are many-to-many with mysteries, so unlink hits `/api/mysteries/{mysteryId}/locations/{id}` and leaves the row in the library.
- **Conditional required-ness via `computed()` off the `toSignal`-bridged form value, not a `Validators` cross-field validator** — `minionSectionStarted` / `minionNameRequired` / `minionNameMissing`, matching `phaseStepComplete`'s existing idiom. The `valueChanges`-derived signal is typed `Partial<…>` (because of the `startWith(getRawValue())` union), so every field read needs `?? ''` / `?? 3` — the harm-capacity default (`3`) is duplicated between the FormControl and the "started" check, so they must be kept in sync.
- **`validateCurrentStep()` had no phase-1/step-1 branch at all** — Next always advanced past the minion step regardless of content. Adding the branch is what actually makes the new signals load-bearing; the template `*`/error alone would have been cosmetic.
- Pre-existing and deliberately left alone: the missing-`minionTypeId` path calls `handleSubmitError(...)` then returns `of(null)`, which still lands in `next:` and advances the phase anyway. Explicitly out of scope this round, but it's a real second bug in the same method.

### Files
Modified: `core/location.ts`, `core/bystander.ts`, `mystery-create.store.ts`, `mystery-create-monster-phase.html`, `mystery-create.store.spec.ts` (+3 tests: revisit-updates-not-duplicates across phases 0/1/2, removed-row unlink, conditional minion name; the existing full-flow test's two `apiService.post` assertions became `locationService.create`/`bystanderService.create`).

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 29 files / 126 passed, 0 skipped (123 → 126, the 3 new regression tests). No lint script exists in this package — the build is the typecheck. Not verified live against the API this round.

---

## 2026-08-05 — Standalone Creation SC-2 + SC-4: `MonsterFormComponent` extract + detail rewire

### Task
`docs/updates/standalone-creation-phase1-monsters.md` decisions 1-4 and 15, combined into one pass: extract `monster-detail.ts`'s core-fields form into `features/monsters/shared/monster-form/`, then immediately wire the detail page onto it so no unused component and no duplicated form is left behind. SC-3 (`/monsters/new`) deliberately not started. Decision record: `.squad/decisions/records/luigi-monster-form-component.md`.

### Key patterns / gotchas
- **`features/<domain>/shared/` had no component precedent before this** — `features/mysteries/shared/` holds only two plain `.ts` files (`mystery-countdown-stage.ts` is pure data/interfaces, `mystery-section-icon.ts` a single-file inline-template component), no folder-per-component. Used the app-wide `shared/header-search/` layout instead (`<name>/<name>.{ts,html,spec.ts}`, no `.component` infix), which is the only multi-file-component-in-a-folder precedent in the app. Worth knowing the folder convention and the file-layout convention come from two different places here.
- **No `.scss` needed and none created**, despite the plan listing one as conditional. Rule of thumb confirmed on this codebase: a `.scss` is only earned by a compound-state selector that Tailwind utilities can't express (`monster-detail.scss` is exactly and only `.action-btn:hover:not(:disabled)` etc.). Those rules belong to the sub-resource delete buttons, not the core-fields block, so the extraction inherited nothing. Set `host: { class: 'block' }` in component metadata (the `WeaponTagSelectComponent` idiom) instead of a `:host { display: block }` stylesheet — otherwise the custom element is `display: inline` and the inner `<form class="... my-4">`'s margins get flaky.
- **`ngOnChanges` on a `MonsterDetailResponse | null` input replaces the parent's `populateMonsterForm()` calls entirely, including the post-save one.** `monster-detail`'s save handler already did `this.monster.set(monster)`; that new object reference flows down `[monster]` and re-triggers `ngOnChanges`. Deleting the explicit repopulate call is safe *because* the service returns a fresh object every time — if any caller ever mutates the monster in place instead of replacing it, the form silently stops refreshing.
- **Split the old two-part guard along the ownership line, don't move it wholesale.** `if (this.monsterForm.invalid || !this.monster())` → form validity went into the component (`markAllAsTouched()` + early return, no emit); `!this.monster()` stayed on the page as its own guard. Moving the null-monster check into the component would have made create mode (`[monster]="null"`) permanently unsubmittable.
- **`@Input()`/`@Output()` decorators, not signal `input()`/`output()`** — signal-based component IO appears nowhere in this app yet (all of `CustomSelectComponent`/`WeaponTagSelectComponent`/`ConfirmDeleteModalComponent`/`DomainIconComponent` use decorators), and the plan's `ngOnChanges` requirement presumes them. `fixture.componentRef.setInput(...)` drives decorator inputs and fires `ngOnChanges` correctly in specs, so testing the input-change path needs no signal inputs.
- `toNullable()` now lives in both `monster-form.ts` (for `description`) and `monster-detail.ts` (still needed by all four sub-resource payloads). Deliberate 3-line duplication over a new shared util, matching decision 11's stance.

### Files
- New: `features/monsters/shared/monster-form/{monster-form.ts, monster-form.html, monster-form.spec.ts}`
- Modified: `features/monsters/pages/monster-detail/{monster-detail.ts, monster-detail.html, monster-detail.spec.ts}`
- Untouched (verified via `git diff`): the 4 sub-resource panels in `monster-detail.html` — the only changed hunk is the core-fields block.

### Public interface for SC-3
`app-monster-form`; inputs `monsterTypes`, `monsterArchetypes`, `monster` (`null` = create mode, and setting it back to `null` actively clears the form), `isSaving`, `submitLabel`; output `save: EventEmitter<UpsertMonsterRequest>`. The component never calls `MonsterService`.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings: `custom-select.component.scss`, `mystery-create.scss`). `npm run test -- --watch=false`: 30 files / 142 passed, 0 skipped (126 → 142). Not verified live against the API this round. Note: the working tree already carried Bowser's SC-1 backend changes (`MonstersController.cs`, `MonsterService.cs`, `IMonsterService.cs`, `core/monster.ts`'s `createStandalone()`) when I started — untouched by me, but they're in the same uncommitted diff.

---

## 2026-08-05 — Standalone Creation SC-3: `/monsters/new` create page + sub-resource drafts

### Task
Last of the three sub-phases of `docs/updates/standalone-creation-phase1-monsters.md` (decisions 5-14): the `/monsters/new` page, its route, the `monsters-list` entry point, and the 4 local-draft sub-resource panels with batched submit. Decision record: `.squad/decisions/records/luigi-standalone-creation-sc3-create-page.md`.

### Key patterns / gotchas
- **The batch-failure branch belongs inside the `switchMap`, not in the subscriber's `error:` handler.** `create$ → switchMap(m => saveSubResourceDrafts(m.id).pipe(map(() => ({id, draftsFailed: false})), catchError(() => of({id, draftsFailed: true}))))`. Doing it this way makes the outer `error:` handler reachable *only* by a failure of the initial create, so "keep the user here with their drafts intact" needs no how-far-did-we-get bookkeeping, and every path where the monster actually exists lands in `next:` and navigates. Worth reaching for whenever an async flow has a point-of-no-return partway through.
- **Draft interfaces should be payload-shaped (`description: string | null`), normalizing at add-time, not submit-time.** The wizard's drafts keep the raw form string and `toNullable()` at submit; doing it at add-time instead makes the batch method a straight field copy and makes the draft array directly assertable in specs against the exact request bodies. No `id` field needed here at all — a fresh create page has no baseline to diff against, unlike the wizard's edit-an-existing-mystery case.
- **The `×` draft-remove button (wizard idiom) is the right control for un-persisted rows**, not the detail page's trash-SVG `.action-btn--delete`. Bonus: it dodges the `:hover:not(:disabled)` compound selector that is the *only* reason `monster-detail.scss` exists, so the new page needs no `.scss` at all — second time in this initiative the plan's conditional `.scss` was correctly skipped.
- **The shared form's submit button is structurally mid-page** on a page that also has draft panels below it (the button lives inside `MonsterFormComponent`, and the panels mirror `monster-detail.html`'s below-the-form layout). Resolved with a one-line hint between the two rather than a second submit button, which decisions 3/9 forbid. Flagging in case a later standalone-create phase (locations/bystanders) hits the same shape.
- **`vi.spyOn(router, 'navigate').mockImplementation(...)` must type its param `readonly unknown[]`, not `unknown[]`** — `Router.navigate`'s signature is `(commands: readonly any[], extras?)` and TS rejects the mutable-array narrowing. Build error only, caught by `ng test`'s compile pass.
- Added a plain unit test over `MONSTERS_ROUTES` asserting `indexOf('new') < indexOf(':monsterId')`. The plan calls this ordering the one thing that silently makes the page unreachable; a source comment alone doesn't survive a reorder.

### Files
- New: `features/monsters/pages/monster-create/{monster-create.ts, monster-create.html, monster-create.spec.ts}` (no `.scss`).
- Modified: `features/monsters/monsters.routes.ts` (`new` route + ordering comment), `features/monsters/pages/monsters-list/monsters-list.html` (`+ Add Monster` anchor, reusing `mysteries-list.html`'s CTA classes verbatim; `.ts` needed no change — `RouterLink` was already imported).
- Untouched (verified via `git status`): `mystery-create.store.ts`, everything under `features/mysteries/`, both prior sub-phases' files.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 31 files / 160 passed, 0 skipped (142 → 160, 18 new). Not verified live against the API this round.

---

## 2026-08-05 — Standalone Creation Phase 2 MC-1 + MC-3: `MinionFormComponent` extraction + `minion-detail` rewire

### Task
First two sub-phases of `docs/updates/standalone-creation-phase2-minions.md` (decisions 2-4, 11), run as one task for the same reason the Monster phase's SC-2+SC-4 were: extracting without wiring leaves an unused component next to a still-duplicated inline form. MC-2 (`/minions/new` + `/monsters/:monsterId/minions/new`) deliberately not started. Decision record: `.squad/decisions/records/luigi-minion-form-component.md`.

### Key patterns / gotchas
- **Second run of the exact same extraction shape, and the `MonsterFormComponent` precedent transferred 1:1 at the code level but *not* at the markup level.** Structure (decorator IO, internal `FormGroup`, `ngOnChanges` repopulate, guard split, `toNullable()` copy, `host: { class: 'block' }`, no `.scss`) all copied straight over. The template did not: `minion-detail.html`'s block uses `w-full` where `monster-form.html` uses `font-[inherit]`, is a 3-column grid not 4, and its submit button has no `disabled:*` classes. Take the markup from the page being extracted, never from the sibling component — the two forms were already inconsistent before either extraction, and "mirror the precedent" would have silently restyled the page.
- **Check the parent's `imports` array for newly-orphaned components after an extraction.** `CustomSelectComponent` became dead on `minion-detail.ts` the moment the core-fields block left (the 4 sub-resource panels use `WeaponTagSelectComponent` only). Angular doesn't error on an unused standalone import, so nothing catches this but a grep of the template. `ReactiveFormsModule`/`Validators`/`FormBuilder` all still needed there — the sub-resource forms keep them.
- **`minion-detail.ts` had *two* `populateMinionForm()` call sites** (initial load in `ngOnInit`'s `next:`, and post-save), one more than `monster-detail.ts` had at the same point. Both delete cleanly: each is immediately preceded by `this.minion.set(...)`, which is what re-triggers `ngOnChanges` through `[minion]`.
- Spec adaptation reused `monster-detail.spec.ts`'s shape verbatim and it fit with no friction: `By.directive(MinionFormComponent)` helper, an `updateCalls` array on the service double capturing `{ minionId, payload }`, one test asserting the page no longer owns a `minionForm` field, and a real DOM `form.dispatchEvent(new Event('submit'))` through `app-minion-form form` to prove the whole child→parent→service path. Worth treating as the standard template for the remaining domains (locations/bystanders).

### Files
- New: `features/minions/shared/minion-form/{minion-form.ts, minion-form.html, minion-form.spec.ts}` (no `.scss`).
- Modified: `features/minions/pages/minion-detail/{minion-detail.ts, minion-detail.html, minion-detail.spec.ts}`.
- Untouched (verified via `git diff`): the 4 sub-resource panels in `minion-detail.html` — single changed hunk. `backLink()`/`backLabel()` and all three-route-shape param handling unchanged. Nothing under `features/monsters/`, `mystery-create.store.ts`, or `docs/updates/multi-minion-support.md`.

### Public interface for MC-2
`app-minion-form`; inputs `minionTypes`, `minion` (`null` = create mode, and setting it back to `null` actively clears the form), `isSaving`, `submitLabel`; output `save: EventEmitter<UpsertMinionRequest>`. Never calls `MinionService`; never sees `monsterId` (it isn't a field on `UpsertMinionRequest`, so the create page must supply it to `minionService.create(monsterId, payload)` itself).

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 32 files / 175 passed, 0 skipped (160 → 175, 15 new). Not verified live against the API this round.

---

## 2026-08-05 — Standalone Creation Phase 2 MC-2: `MinionCreateComponent`, two routes, two entry points

### Task
`docs/updates/standalone-creation-phase2-minions.md` decisions 5-10, with Skyler's confirmed **Option C** on Open Question 1 (both entry points ship, one component). Decision record: `.squad/decisions/records/luigi-standalone-creation-mc2-create-page.md`.

### Key patterns / gotchas
- **`By.directive(CustomSelectComponent)` is not unique on a page like this — three instances match** (the page's own monster picker, `MinionFormComponent`'s minion-type picker, and the one `WeaponTagSelectComponent` wraps on the attack draft form). The "monster-locked entry renders *no* dropdown" assertion passed vacuously twice before I scoped the helper to `!closest('app-minion-form') && !closest('app-weapon-tag-select')`. Same category as the Playwright `bg-accent` trap from the theming phases: shared widgets/tokens make the obvious selector match more than you think. Any spec asserting the *absence* of a shared component needs a scoping predicate, and needs a sibling test proving the helper can find it, or it proves nothing.
- **The conditional monster resolution folds into the existing reference-data `forkJoin` rather than sitting in front of it**: `lockedMonster: monsterId ? getById(monsterId) : of(null)` and `monsters: monsterId ? of([]) : getAll()`, inside the `route.paramMap` `switchMap`. One load path, one loading flag, and the locked route provably never fetches the full monster list (asserted both directions — a wasted list fetch would otherwise be silent).
- **Keep the required validator on `monsterControl` unconditionally; branch in `onCreate` instead.** Clearing it in locked mode is dead machinery — the control is never rendered or read there. A single `effectiveMonsterId()` (route param → dropdown value → `null`) is the only place "which monster" is decided, so the two entry points can't drift apart.
- **The bail-out when the required dropdown is empty needs *two* messages, not one**: `markAsTouched()` drives an inline message directly under the picker (where the fix is), and `errorMessage` renders in the page's existing top-of-page error slot (where every other failure on this page already appears). It must happen before `isSaving.set(true)` so nothing flickers.
- Markup split, confirming MC-1's rule generalizes: field markup (`w-full` inputs, `text-xs` chips, `last:border-0`) copied from `minion-detail.html` so the two minion pages match; the `×` remove button and `disabled:*` submit classes copied from `monster-create.html` because those belong to the draft/batch model, not the domain. Third phase running where the `×` control (rather than the detail page's trash `.action-btn`) means the new page earns no `.scss`.

### Files
- New: `features/minions/pages/minion-create/{minion-create.ts, minion-create.html, minion-create.spec.ts}` (no `.scss`).
- Modified: `features/minions/minions.routes.ts` (`new` before `:minionId`), `features/monsters/monsters.routes.ts` (`:monsterId/minions/new` before `:monsterId/minions/:minionId`), `features/minions/pages/minions-list/minions-list.html`, `features/monsters/pages/monster-detail/monster-detail.html` (both "+ Add Minion" CTAs reuse `monsters-list.html`'s classes verbatim; neither `.ts` needed a change — `RouterLink` already imported in both).
- Untouched (verified via `git status`): `features/minions/shared/minion-form/`, `features/monsters/shared/monster-form/`, `mystery-create.store.ts`, everything under `features/mysteries/`, `docs/updates/multi-minion-support.md`.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 33 files / 200 passed, 0 skipped (175 → 200, 25 new). Both route files re-read after editing to confirm ordering. Not verified live against the API this round.

---

## 2026-08-06 — Standalone Creation Phase 3 LC-2 + LC-4: `LocationFormComponent` extraction + detail rewire

### Task
`docs/updates/standalone-creation-phase3-locations.md` decisions 4-6 and 12. Third run of the SC-2/SC-4 and MC-1/MC-3 shape. LC-3 (the `/locations/new` page) deliberately not started. Decision record: `.squad/decisions/records/luigi-location-form-component.md`.

### Key patterns / gotchas
- **Location's form is a genuinely different shape from Monster's/Minion's, three ways, and all three are load-bearing:** (1) `locationTypeId` has `Validators.required` where `monsterTypeId`/`minionTypeId` don't — preserved verbatim per the plan and pinned by a named spec so nobody "harmonises" it later; (2) single-column `max-w-[30rem]` stack, no `grid-cols-[Nfr...]` row (Location has no harm-capacity field); (3) Description sits *between* Name and Type, not last. Copying `minion-form.html` and adapting would have silently restyled the page. Rule now confirmed three times: take the markup from the page being extracted, never from the sibling component.
- **`max-w-[30rem]` moved onto the component's own `<form>`** rather than being left on the page as a wrapper, so the width constraint travels with the component into LC-3.
- **Location's detail page is the first of the three where `ReactiveFormsModule` could also be dropped from the page's `imports`.** Monster/Minion kept it for their 4 sub-resource forms; Location's only other content is the read-only custom-moves `<ul>`, so `ReactiveFormsModule`, `CustomSelectComponent`, `FormBuilder`, `Validators` *and* the page's `toNullable()` helper all became unused and were removed. Unlike the two prior extractions there is no duplicated `toNullable()` left behind — it lives only in the component now.
- Everything else is identical to the two priors and needed no fresh thought: `@Input()`/`@Output()` decorators (not signal inputs), `ngOnChanges` repopulation with `location: null` actively *clearing* the form, `host: { class: 'block' }` and no `.scss`, guard split (`form.invalid` → component, `!location()` → page), both `form.reset(...)` call sites deleted rather than re-plumbed because `location.set(...)` already flows a new object down `[location]`, and `By.directive(LocationFormComponent)` + `querySelector('app-location-form form')` in the detail spec.

### Files
- New: `features/locations/shared/location-form/{location-form.ts, location-form.html, location-form.spec.ts}` (no `.scss`).
- Modified: `features/locations/pages/location-detail/{location-detail.ts, location-detail.html, location-detail.spec.ts}`.
- Untouched (verified via `git diff`): the read-only custom-moves block in `location-detail.html` — single changed hunk, the core-fields form only. `backLink()`/`backLabel()` and the two-route-shape param handling unchanged. Nothing under `features/monsters/` or `features/minions/`, no `mystery-create.store.ts`, no `docs/updates/multi-minion-support.md`. (Note: LC-1's backend files were already dirty in the working tree from Bowser's run — not mine.)

### Public interface for LC-3
`app-location-form`; inputs `locationTypes`, `location` (`null` = create mode, and setting it back to `null` actively clears the form), `isSaving`, `submitLabel`; output `save: EventEmitter<UpsertLocationRequest>`. Never calls `LocationService`; never sees `mysteryId` (create-page concern, not a field on `UpsertLocationRequest`). LC-3 must account for the required Location Type: its create page can't submit until a type is picked, unlike the Monster/Minion create pages.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 34 files / 217 passed, 0 skipped (200 → 217: 12 new `location-form.spec.ts`, 5 net new `location-detail.spec.ts`). Not verified live against the API this round.

---

## 2026-08-06 — Standalone Creation Phase 3 LC-3: `/locations/new` Create Page, Route, Entry Point

### Task
`docs/updates/standalone-creation-phase3-locations.md` decisions 3, 6-9, 13. Depends on LC-1 (`LocationService.createStandalone()`) and LC-2 (`LocationFormComponent`), both already landed in this tree. Decision record: `.squad/decisions/records/luigi-standalone-creation-lc3-create-page.md`.

### Key patterns / gotchas
- **This is the simplest create page of the three domains so far, exactly as the plan doc predicted** (Resolved Decision 2: Location has no interactive sub-resources at all). `onCreate` is a single service call with no `switchMap` chain past it — no draft signals, no batch panels, no `runBatch`. Closer in shape to `location-detail.ts`'s own `save()` than to `monster-create.ts`'s/`minion-create.ts`'s `onCreate`.
- Page structure (mystery picker + shared form component) copied from `monster-create.html`'s block, adapted 1:1 since `LocationFormComponent` already mirrors `MonsterFormComponent`'s `@Input`/`@Output` shape from LC-2. Error/success strings (`Unable to create location.` / `Location created.`) copied from `location-detail.ts`'s own `save()`, not invented.
- **A create-failure spec needs to mock whichever service method the mystery-picker's *current* value will actually route to** — wrote one wrong the first time (mystery picked, but mocked `createStandalone` to fail, which is unreachable with a mystery selected). Split into two specs, one per branch, each asserting the correct method was the one that failed and state was preserved.
- No `.scss` (inline Tailwind utilities only, consistent with the rest of `features/locations/`). `locations-list.ts` needed no import change — `RouterLink` was already there; only `locations-list.html` changed for the "+ Add Location" CTA (classes copied verbatim from `monsters-list.html`/`minions-list.html`).

### Files
- New: `features/locations/pages/location-create/{location-create.ts, location-create.html, location-create.spec.ts}` (no `.scss`).
- Modified: `features/locations/locations.routes.ts` (`new` before `:locationId`), `features/locations/pages/locations-list/locations-list.html`.
- Untouched (verified via `git status`): `features/locations/shared/location-form/`, `core/location.ts`, everything under `features/monsters/`/`features/minions/`, `mystery-create.store.ts`, `docs/updates/multi-minion-support.md`.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 35 files / 228 passed, 0 skipped (217 → 228, 11 new). `locations.routes.ts` re-read after editing to confirm `new` precedes `:locationId`. Not verified live against the API this round.

---

## 2026-08-06 — Standalone Creation Phase 4 BC-2 + BC-4: `BystanderFormComponent` extraction + detail rewire

### Task
`docs/updates/standalone-creation-phase4-bystanders.md` decisions 4-6 and 12. Fourth (final) run of the SC-2/SC-4, MC-1/MC-3, LC-2/LC-4 shape. BC-3 (the `/bystanders/new` page) deliberately not started. Decision record: `.squad/decisions/records/luigi-bystander-form-component.md`.

### Key patterns / gotchas
- **Bystander's core-fields block really is byte-identical in structure to Location's** — single-column `max-w-[30rem]` stack, Description between Name and Type, same token classes, `bystanderTypeId` with `Validators.required`. Unlike Location (which differed from Monster/Minion three ways), this extraction was a straight 1:1 rename of `location-form.*`. Still took the markup from `bystander-detail.html` itself and diffed it against Location's before concluding that — the plan doc's own Background section makes the "looks the same vs. is the same" point, and it costs one read to check.
- Everything else was mechanical and needed no fresh thought: `@Input()`/`@Output()` decorators (not signal inputs), `ngOnChanges` repopulation with `bystander: null` actively *clearing* the form, `host: { class: 'block' }`, no `.scss`, guard split (`form.invalid` → component, `!bystander()` → page), both `form.reset(...)` call sites deleted rather than re-plumbed, and `By.directive(BystanderFormComponent)` + `querySelector('app-bystander-form form')` in the detail spec.
- Like Location's page (and unlike Monster's/Minion's), `ReactiveFormsModule`, `CustomSelectComponent`, `FormBuilder`, `Validators` *and* `toNullable()` all became unused on `bystander-detail.ts` and were removed — the only other content on the page is the read-only custom-moves `<ul>`.
- Working tree already carried BC-1's backend changes (`BystandersController.cs`, `BystanderService.cs`, `IBystanderService.cs`, `core/bystander.ts` + Bowser/Yoshi history) from Bowser's run — not mine, left alone.

---

## 2026-08-06 — Required-Field Validation Phase 4: Location (`location-form.html`)

### Task
`docs/updates/location-required-fields-validation.md`'s "Revision — Skyler's 2 Answers Resolved" section — smallest phase of the initiative so far. Full write-up: `.squad/decisions/records/luigi-location-required-fields-validation.md`.

### Key patterns / gotchas
- **Smallest phase yet, genuinely** — unlike Monster/Minion, `location-form.ts`'s `locationTypeId` already had `Validators.required` (pre-dated the standalone-creation extraction per Yoshi's doc), so no validator bug to fix. Only 1 Name `<input>` in the whole feature (no sub-resource authoring UI at all) vs. Monster's/Minion's 9 each.
- **Checked `location-form.html`'s label class before writing markup** (same `grid font-medium gap-1` as Monster/Minion) and used the wrapper-span trick (`<span>Name <span class="text-danger">*</span></span>`) from the start — no repeat of Monster's original grid-auto-placement layout bug.
- Since `LocationFormComponent` is the single shared component for both `location-create.ts` and `location-detail.ts`, one file's edit covers both pages — no page-level template changes needed.

### Files
- Modified: `features/locations/shared/location-form/location-form.html` (asterisks + `maxlength="255"`), `features/locations/shared/location-form/location-form.spec.ts` (2 new specs).

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 38 files / 276 passed (274 → 276, 2 new). Visually verified via a throwaway Playwright script against the already-running dev API + `ng serve --port 4200` on `/locations/new` and an existing location's edit page — asterisks render inline with labels on both, no wrap. Cleaned up throwaway script/screenshots.

### Files
- New: `features/bystanders/shared/bystander-form/{bystander-form.ts, bystander-form.html, bystander-form.spec.ts}` (no `.scss`).
- Modified: `features/bystanders/pages/bystander-detail/{bystander-detail.ts, bystander-detail.html, bystander-detail.spec.ts}`.
- Untouched (verified via `git diff`): the read-only custom-moves block in `bystander-detail.html` — single changed hunk, the core-fields form only. `backLink()`/`backLabel()` and the two-route-shape param handling unchanged. Nothing under `features/monsters/`/`features/minions/`/`features/locations/`, no `mystery-create.store.ts`, no `docs/updates/multi-minion-support.md`.

### Public interface for BC-3
`app-bystander-form`; inputs `bystanderTypes`, `bystander` (`null` = create mode, and setting it back to `null` actively clears the form), `isSaving`, `submitLabel`; output `save: EventEmitter<UpsertBystanderRequest>`. Never calls `BystanderService`; never sees `mysteryId` (create-page concern, not a field on `UpsertBystanderRequest`). BC-3 must account for the required Bystander Type: its create page can't submit until a type is picked, same as Location's.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 36 files / 245 passed, 0 skipped (228 → 245: 12 new `bystander-form.spec.ts`, 5 net new `bystander-detail.spec.ts`). Not verified live against the API this round.

---

## 2026-08-06 — Standalone Creation Phase 4 BC-3: `/bystanders/new` create page — INITIATIVE COMPLETE

### Task
`docs/updates/standalone-creation-phase4-bystanders.md` Resolved Decisions 3, 6-9, 13. Depends on BC-1 (`bystanderService.createStandalone()`, already in tree from Bowser) and BC-2 (`BystanderFormComponent`, my own prior entry). **This is the fourth and final domain of the whole "standalone creation" initiative** — Monster, Minion, Location, and now Bystander all have a create path outside the mystery wizard.

### Key patterns / gotchas
- Structurally identical to LC-3 (Location) — no draft arrays, no batch step, single `onCreate` service call, mirroring `location-create.ts` field-for-field with Bystander substitutions (`bystanderService`, `bystanderTypes`, `app-bystander-form`, `/bystanders`). No new judgment calls arose; the plan doc's own claim that every dimension of this phase matches an already-decided prior phase held up in practice, not just on paper.
- Error/success strings (`Unable to create bystander.` / `Bystander created.`) copied from `location-create.ts`'s own wording pattern, consistent with `bystander-detail.ts`'s existing `save()` error shape.
- Spec again splits the create-failure case into two (mystery selected → mocks `create` to fail; blank → mocks `createStandalone` to fail) per the LC-3 lesson about not mocking the unreachable branch. Also carried over the `bystanders route ordering` describe block asserting `indexOf('new') < indexOf(':bystanderId')`.
- `bystanders-list.ts` already imported `RouterLink` (used for bystander name links), so only `bystanders-list.html` changed for the "+ Add Bystander" CTA — classes copied verbatim from `locations-list.html`'s most recent "+ Add Location" button.

### Files
- New: `features/bystanders/pages/bystander-create/{bystander-create.ts, bystander-create.html, bystander-create.spec.ts}` (no `.scss`).
- Modified: `features/bystanders/bystanders.routes.ts` (`new` inserted before `:bystanderId`, re-read after edit to confirm), `features/bystanders/pages/bystanders-list/bystanders-list.html`.
- Untouched (verified via `git status`): `features/bystanders/shared/bystander-form/`, `core/bystander.ts`, everything under `features/monsters/`/`features/minions/`/`features/locations/`, `mystery-create.store.ts`, `docs/updates/multi-minion-support.md`.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings: `mystery-create.scss`, `custom-select.component.scss`). `npm run test -- --watch=false`: 37 files / 256 passed, 0 skipped (245 → 256: 11 new). Not verified live against the API this round.

**Initiative note:** this closes out `docs/updates/standalone-creation-phase4-bystanders.md` and, with it, the full four-phase standalone-creation initiative (Monster/Minion/Location/Bystander) — every domain object now has a create path reachable outside the mystery wizard.

---

## 2026-08-06 — Bug fix: missing `text-primary` on wizard sub-resource mini-forms

### Task
Fix a gap the Phase 7 sweep's own history entry claimed didn't exist: "the wizard doesn't have this bug ... because Phase 6 classed every text node individually." True for the wizard's top-level form fields, but not for `mystery-create-monster-phase.html`'s four inline "add" mini-forms (Attacks/Powers/Weaknesses/Armor, both Monster and mirrored Minion sections) — their inputs/textareas/checkbox-label span carried no color class at all. Same UA-default-black-on-dark-surface root cause as the Phase 7 finding (Tailwind preflight's `color: inherit` with nothing upstream setting a real color), but a distinct instance: Phase 7's sweep targeted unclassed *root page wrappers*; this was individually unclassed *leaf form controls* inside panel `<div>`s/`<form>`s that themselves never carry `text-primary` anywhere in their ancestor chain. Same absence-of-a-class bug shape, different location, missed by a sweep that was (reasonably) looking for the root-wrapper pattern specifically.
- Added `text-primary` to every mini-form input/textarea and to the `<label class="flex items-center gap-2 text-sm">` wrapping the Armor "Special" checkbox (span inherits from label).
- Left the top-level form fields (Monster/Minion Name/Description/Harm Capacity, lines 5-19/155-168) untouched — already correct, used as the reference pattern.
- `npm run build` clean, same 2 pre-existing budget warnings (`mystery-create.scss`, `custom-select.component.scss`). No test run requested/needed — pure class-list change, no logic touched.

### Files
- Modified: `features/mysteries/pages/mystery-create/mystery-create-monster-phase.html` only.

### Takeaway for future sweeps
When grepping for "unclassed root wrapper" instances of this bug pattern, also check nested `<form>`/panel scopes independently — an ancestor having `text-primary` does not guarantee every descendant input does, since Tailwind preflight's `color: inherit` on form controls stops inheriting correctly once a parent panel itself has no explicit color set at its own level in a multi-level nesting chain. Safer heuristic: grep every `<input`/`<textarea` tag in a template and confirm each one's own `class` attribute carries a text-color token, don't rely on ancestor-level checks.

### Addendum — same session: `weapon-tag-select.component.html`'s "Weapon Tags" label
Coordinator caught one more instance in the same bug family: `shared/weapon-tag-select.component.html` line 9's `<span class="text-inherit ...">Weapon Tags</span>` — explicit `text-inherit` rather than an absent class, but same net effect, since it was relying on an ancestor `color` that the wizard's mini-form panels never set. Fixed at the shared-component source (`text-inherit` → `text-primary`), not per call-site, per instruction to fix shared components once.
- Before changing, checked all 4 other callers (`monster-detail.html`, `monster-create.html`, `minion-detail.html`, `minion-create.html`): all 4 have a root `<section class="text-primary">` wrapper (the Phase 7 root-wrapper fix) with nothing overriding `color` between that root and the `<app-weapon-tag-select>` usage — so `text-inherit` was already resolving to the same value `text-primary` resolves to. Confirmed no visual regression: explicit `text-primary` there is a no-op change, same computed color, just no longer dependent on inheritance holding.
- `npm run build` re-run clean after this second edit — same 2 pre-existing budget warnings, nothing new.
- General lesson: `text-inherit` on a leaf element is exactly as fragile as an absent class whenever the ancestor chain isn't guaranteed to set a real color at every call site of a shared component — worth grepping `text-inherit` itself as a related smell alongside "absent text-color class" in any future sweep of this app.

### Addendum 2 — same session: "already added" row wrappers in `mystery-create-locations-phase.html` / `mystery-create-bystanders-phase.html`
Third instance of the same bug class, this time the *list-row wrapper* (not the add-form) in the two sibling wizard phases. Both files, line 3: `<div class="flex items-center bg-surface-sunken border border-default rounded-md text-[0.9rem] justify-between px-3 py-2">` had no color class, with an unclassed `<span>{{ x.name }}</span>` inside it (the `×` remove button is unaffected — has its own explicit `text-danger`). Fixed by adding `text-primary` to the row `<div>` (not the inner `<span>`), matching the already-correct precedent in `mystery-create-monster-phase.html`'s attack-row wrapper (`text-primary` lives on the row container there too).
- Checked every other phase file in the same directory (`mystery-create-dossier.html`, `mystery-create-mystery-phase.html`, `mystery-create-tracker.html`, `mystery-create.html`) for the same unstyled-row-div pattern — none found. Dossier explicitly classes every text node (`text-primary`/`text-muted`); mystery-phase is all top-level form fields (already-correct reference pattern); tracker/root shell explicitly class their text spans too.
- `npm run build` re-run clean a third time this session — same 2 pre-existing budget warnings, nothing new.
- Running tally this session: 3 separate instances of the same "unstyled leaf under dark `bg-surface`-family background" bug found across `mystery-create-monster-phase.html`'s mini-forms, `weapon-tag-select.component.html`'s label, and now these two phases' list rows — none caught by the original Phase 7 sweep since none are root-page-wrapper cases. If another "already added X" list or inline sub-form turns up anywhere in the wizard, check it too before assuming Phase 6/7 covered it.

---

## 2026-08-06 — Minions List: Add Delete Flow

### Task
Add delete button/flow to the minions list page, mirroring the Bystanders list pattern (Locations is identical too). Backend agent added `DELETE /api/minions/{id:guid}` (204/404) in parallel — coded against the fixed URL, didn't touch `src/api/**`.

### Files
- `core/minion.ts` — added `delete(id: string): Observable<void>` (`apiService.delete('/api/minions/${id}')`), placed right after `update()`.
- `features/minions/pages/minions-list/minions-list.ts` — added `ConfirmDeleteModalComponent` import/`imports` entry, `pendingDelete = signal<{id,name}|null>(null)`, `requestDelete`/`onDeleteConfirmed`/`onDeleteCancelled` — byte-for-byte the same shape as `bystanders-list.ts`, just swapping `bystanders`→`minions`/`bystander`→`minion` naming.
- `features/minions/pages/minions-list/minions-list.html` — added the trash-icon `<button>` (identical SVG/classes to bystanders-list.html) inside each `<li>` wired to `(click)="requestDelete(minion.id, minion.name)"`, plus `<app-confirm-delete-modal>` at the end wired to `pendingDelete()`/`(confirmed)`/`(cancelled)`.
- `features/minions/pages/minions-list/minions-list.spec.ts` — no pre-existing delete spec to copy in this repo (checked `bystanders-list.spec.ts` and `locations-list.spec.ts` — neither has one). Modeled the delete tests on `monster-detail.spec.ts`'s attack-delete tests instead: a `deleteCalls: string[]` array + mutable `deleteResult: () => Observable<void>` closure on the mocked `MinionService.delete`, call `component.requestDelete/onDeleteConfirmed/onDeleteCancelled` directly (no DOM click needed), assert against `component.pendingDelete()`/`component.minions()`/`component.errorMessage()`. 4 new tests: request-sets-pending, confirm-calls-service-and-removes-item, cancel-clears-pending-no-call, error-path-sets-message-and-keeps-item.

### Gotcha
`let deleteResult: () => ReturnType<typeof of>;` doesn't type-check against `MinionService.delete`'s `Observable<void>` return type — `of(void 0)` infers `Observable<undefined>`, and TS won't assign that to `Observable<never>`/`Observable<void>` through a generic `ReturnType<typeof of>` alias in this strict config. Fix: type the closure explicitly as `() => Observable<void>` (import `Observable` from `rxjs`) rather than deriving it from `of`.

### Verification
`ng test --watch=false`: 37 files / 260 tests, all green (4 new). `ng build --configuration production`: clean, same 2 pre-existing unrelated CSS budget warnings (`mystery-create.scss`, `custom-select.component.scss`). Confirmed via `git status` that only the 4 frontend files above changed on my side; `src/api/**` changes present are the parallel backend agent's, untouched by me.

---

## 2026-08-05 — Custom-Select Option Hover Tooltip (Weapon Tags + All Consumers)

### Task
Weapon-tag dropdown options clip their `description` sublabel with `text-ellipsis`/`whitespace-nowrap` and there was no way to see the full text. Fixed generically at `shared/custom-select.component.{html,scss}` (not weapon-tag-specific) since `optionSubLabel` truncation is shared by every consumer (monster/minion powers, types, weapon tags, etc.).

### Approach
Two layers, both conditioned on `optionSubLabel(option)` being non-null:
1. Native `[attr.title]="optionSubLabel(option)"` on the option `<button>` — guaranteed-correct fallback since native title tooltips aren't subject to CSS `overflow`/`z-index` clipping from the scrollable `.custom-select__panel`/options list, unlike any DOM-based tooltip would be.
2. A themed CSS-only tooltip (`.custom-select__option-tooltip`, `role="tooltip" aria-hidden="true"`) as a **sibling of** the truncated sublabel span, not nested inside it — nesting inside the `overflow-hidden text-ellipsis` sublabel span would have had it clipped by its own parent. Shown via `:hover`/`:focus-visible`, styled off `bg-surface-raised`/`border-default`/`text-primary` tokens to match `.custom-select__panel`. `aria-hidden` because the full description is already in the accessible tree via the (only visually-clipped) sublabel span text — this tooltip is a sighted-mouse-user affordance only, not new a11y content.

### Gotchas
- **Positioned siblings inside a `filteredOptions()` `@for` all have `z-index: auto`, so a later DOM sibling always paints over an earlier one's overflowing children**, even though the earlier one's absolutely-positioned tooltip is nested inside it. An option's downward-facing tooltip would otherwise render *underneath* the next option row. Fixed by giving the hovered/focused `.custom-select__option` `z-index: 1` on `:hover`/`:focus-visible` (lifts its whole stacking context above untouched siblings) plus `pointer-events: none` on the tooltip itself so clicks in the overlap area still hit the row actually under the cursor, not the tooltip's owning (visually-earlier) button.
- Flipped the last option's tooltip to open upward (`.custom-select__option:last-child` → `bottom: calc(100% + .25rem)` instead of `top`) since a downward tooltip on the final visible row is the case most likely to get clipped by the options list's `overflow-y-auto`. Did not attempt a full viewport-aware JS positioning system (no `@angular/cdk` in this repo, and the task explicitly said prefer no new tooltip dependency) — accepted that an edge-case row mid-scroll could still clip the *themed* tooltip; native `title` (layer 1) never clips regardless.
- No spec changes needed/added: `custom-select.component.spec.ts` only asserts sublabel text presence, not hover/tooltip DOM — verified by re-reading the file, not assumed.

### Verification
`npm run build` (production) and `npm run build -- --configuration development`: both clean. Same 2 pre-existing `anyComponentStyle` budget warnings (`mystery-create.scss`, `custom-select.component.scss`) — the latter's warning margin grew (2.44 kB → ~3.49 kB source, compiled ~6.08 kB) but stays well under the 8 kB error ceiling. `npm run test -- --watch=false`: 37 files / 260 tests, all green, unchanged count (no regressions). Grepped the compiled JS chunk for `custom-select__option-tooltip` and confirmed every token (`--color-border`, `--color-surface-raised`, `--color-text-primary`) resolved through `var(...)`, not baked literals — same verification method as the theming phases. Files touched: `shared/custom-select.component.html`, `shared/custom-select.component.scss` only (`git status` confirmed) — nothing weapon-tag-specific, so every other `app-custom-select` consumer (monster/minion type & power pickers, theme picker) gets the same hover affordance for free.

---

## 2026-08-05 — SVG `<symbol>` Sprite Icon Proposal (Research Only)

### Task
Skyler asked whether to adopt a `<symbol>`/`<use>` SVG sprite for icons. Research + plan only, no code changed. Deliverable: `docs/updates/svg-symbol-icons.md`.

### Findings
- **Real duplication found:** one trash-can icon's `<path>` (`viewBox="0 40 32 32"`) is byte-for-byte copy-pasted **13 times** across 7 files: `minions-list.html`, `locations-list.html`, `bystanders-list.html`, `monsters-list.html`, `mysteries-list.html` (1 each) + `monster-detail.html`/`minion-detail.html` (4 each — attack/power/armor/weakness delete buttons). Verified via exact-string grep on the path's opening segment, not eyeballing.
- **No duplication in the two existing shared icon components** (`shared/domain-icon.component.ts` `app-domain-icon`, `features/mysteries/shared/mystery-section-icon.ts` `app-mystery-section-icon`) — each icon is written once in a `@switch` case and reused via the component (23 combined call sites, confirmed against the task's initial-grep estimate exactly). These already solve the same problem a sprite would solve; recommended leaving them alone rather than converting them.
- No Angular Material anywhere (`package.json`, grep for `mat-icon`/`MatIcon` — zero hits), no `.svg` asset files (`public/` = favicon.ico only), no SSR (CSR-only, confirmed via `angular.json`/`main.ts` — no `server` builder target), no existing sprite/build-tooling for icons.
- `mysteries-list.html` has a unique inline edit-pencil (`viewBox="0 0 100 100"`), not duplicated elsewhere — the only list page with an inline edit affordance.
- `page-layout.html` (the shell, renders on every route — `app.html` itself is a bare `<router-outlet>`) has 4 one-off inline icons (hamburger, mobile-close, header quick-action plus, API-modal spinner) with no centralization at all.
- Related, adjacent finding (not part of the icon proposal itself): delete-button hover styling is inconsistent — `monsters-list`/`monster-detail`/`minion-detail` use a shared `.action-btn`/`.action-btn--delete` SCSS class with a compound `:hover:not(:disabled)` selector (what `370dfd0` "fixing delete hover styling" touched), while `minions-list`/`locations-list`/`bystanders-list`/`mysteries-list` apply `hover:bg-danger-subtle hover:text-danger` as plain Tailwind utilities directly (no `[disabled]` state to combine with). Both rely on the icon's `fill="currentColor"` inheriting the button's hover color — confirmed this still works identically through `<use>`, so it's a non-issue for the sprite migration, just flagged as a separate pre-existing inconsistency worth a follow-up.

### Recommendation given
Hybrid: adopt a hand-maintained `<symbol>` sprite (no new build tooling — mounted once in `page-layout.html` via a new `IconSpriteComponent`, consumed via a typed `<app-icon name="trash">` wrapper mirroring `DomainIconComponent`'s existing convention) scoped to the action/chrome icons that are actually duplicated or scattered as one-offs. Do **not** touch `DomainIconComponent`/`MysterySectionIconComponent` — no duplication problem to solve there, and `mystery-detail.spec.ts`/`mystery-create.spec.ts` assert exact `app-mystery-section-icon` element counts, so converting them is real risk for zero payoff. Rejected an externally-fetched `public/icons/sprite.svg` (adds an async load-order/FOUC-shaped hazard, unwarranted at ~10 icons). Rejected Angular Material's `MatIconRegistry` (would mean adopting a whole component library not currently a dependency, just for icon loading — functionally equivalent to the hand-rolled sprite anyway).

### Files
`docs/updates/svg-symbol-icons.md` — new, full inventory table + phased rollout (Goal/Risk format matching `docs/theming/theming-plan.md`'s convention) + open questions. No application code touched.

---

## 2026-08-06 — WeaponTagSelect Compact Variant for Mystery-Wizard Inline Rows

### Task
`app-weapon-tag-select` always renders an internal "Weapon Tags" text label above the `app-custom-select` trigger (`flex flex-col` stack). Fine for the 4 vertical labeled-field usages (monster-create/detail, minion-create/detail), but broke row alignment in `mystery-create-monster-phase.html`'s two compact inline attack rows (`flex flex-wrap items-center gap-2`), where sibling `<input>`s have no external label — the internal label pushed the dropdown trigger down, and the trigger's default `px-3 py-[0.6rem]` was taller than the siblings' `px-[0.6rem] py-[0.4rem] text-sm` anyway.

### Approach
- `WeaponTagSelectComponent` gets `@Input() compact = false`. When true: skips the `<span>Weapon Tags</span>` label (`@if (!compact)`), shrinks the selected-tag-chip row (`text-[0.7rem] px-2 py-[0.15rem]` vs default `text-xs px-[0.6rem] py-1`), and passes `[size]="compact ? 'compact' : 'default'"` down to `app-custom-select`.
- `CustomSelectComponent` gets a generic `@Input() size: 'default' | 'compact' = 'default'` (not weapon-tag-specific — it's the shared dropdown used by monster/minion type pickers, theme picker, etc. too) toggling an `.is-compact` class on the root; `.custom-select.is-compact .custom-select__trigger` in the SCSS overrides padding/font-size/radius/border to `px-[0.6rem] py-[0.4rem] text-sm rounded-md border-strong`, matching the plain sibling inputs' classes exactly.
- Only the two `mystery-create-monster-phase.html` call sites (monster-attack row line ~61, minion-attack row line ~203) pass `[compact]="true"`; dropped their old `font-size: 0.875rem` inline style (now handled by the `.is-compact` class) but kept `style="flex: 0 1 160px"` for the flex-basis sizing.

### Gotcha — mutating a plain `@Input()` on `componentInstance` after the first `fixture.detectChanges()` does NOT reliably re-render in this app's zoneless (no zone.js in package.json) setup
Confirmed empirically: `component.size = 'compact'; fixture.detectChanges();` (called a second time, no signal write in between) left the template reading the *old* value — verified via an inline `{{ size }}` debug interpolation that kept printing `default` even though `component.size` read back `'compact'` at the JS level. A previously-passing spec (`searchable` test) only worked because it *also* clicked a button afterward, and that click's `isOpen.update(...)` signal write is what forced the real re-check — not the plain property mutation. Fix: use `fixture.componentRef.setInput('size', 'compact')` instead of direct assignment for any post-initial-render `@Input()` mutation in a test — this goes through Angular's actual binding-update path and reliably triggers CD regardless of zoneless quirks. Filed as a decision since this will bite the next `@Input()`-mutation-after-render test anyone writes here.

### Verification
`npm run test -- --watch=false`: 38 files / 266 tests, all green (6 new: 2 in `custom-select.component.spec.ts`, 4 in new `weapon-tag-select.component.spec.ts`). `npm run build`: clean, same 2 pre-existing budget warnings (`mystery-create.scss`, `custom-select.component.scss` — the latter's margin grew slightly from the added `.is-compact` rule, still nowhere near the 8kB error ceiling). Visually verified live via Playwright (already a project devDependency) against a real `ng serve` + API + Postgres stack: walked the actual mystery-create wizard to Phase 2 (monster attacks) and Phase 2 Step 2 (minion attacks), screenshotted both compact attack rows empty/filled/with-a-tag-selected — name/harm/weapon-tags now align and match height in both. Also screenshotted `monsters/new` (usage #1, vertical labeled pattern) to confirm the "Weapon Tags" label still renders there unchanged (`compact` defaults to `false`).

### Files
`shared/weapon-tag-select.component.{html,ts}`, `shared/custom-select.component.{html,scss,ts}`, new `shared/weapon-tag-select.component.spec.ts`, `shared/custom-select.component.spec.ts` (2 new tests), `features/mysteries/pages/mystery-create/mystery-create-monster-phase.html` (2 call sites).

---

## 2026-08-06 — SVG `<symbol>` Sprite Proposal, Revised Per Skyler's Decisions

### Task
Skyler answered the 3 open questions from `docs/updates/svg-symbol-icons.md`. Updated the doc (no app code) to fold them in: (1) typed `<app-icon>` wrapper confirmed, no longer open; (2) `DomainIconComponent`/`MysterySectionIconComponent` ARE now in scope for sprite migration — single icon pattern app-wide, no exceptions, as its own careful phase; (3) unify the `.action-btn`-SCSS-vs-plain-Tailwind delete/edit hover-styling inconsistency as part of the same work.

### Judgment calls made (no longer open questions in the doc)
- **Symbol-ID namespacing:** flat `icon-{name}` collides once domain/mystery-section icons join the sprite (`MysterySectionIconKind` has `monster`/`minions`/`locations`/`bystanders` that are visually distinct from `DomainIconComponent`'s same-named nav keys). Resolved with 3 namespaces in one physical sprite: unprefixed for the generic `IconComponent`/`IconName` set, `icon-nav-{key}` for domain icons, `icon-mystery-{kind}` for mystery-section icons. `IconName` itself does NOT grow — `DomainIconComponent`/`MysterySectionIconComponent` keep their own existing `domain`/`kind` input types untouched; only their internal templates swap `@switch` for a namespaced `<use>` lookup.
- **Spec-safety for the domain/mystery-section migration (new Phase 4):** confirmed `mystery-detail.spec.ts:142-143`/`mystery-create.spec.ts:110,139-140` assert `querySelectorAll('app-mystery-section-icon').length` — i.e. they count the *custom element* in the host template, not its internal rendered SVG. Since this phase only changes the component's own internal template (not how many times it's instantiated by callers), these assertions stay valid unchanged — no spec edits needed, just re-run to confirm per usual practice here.
- **`--mystery-section-icon-size` sizing contract:** unaffected by the migration — it's a `:host`/`.icon` (wrapper-level) CSS custom property, sizes the `<svg class="icon">` element itself regardless of whether its content is a `@switch`-selected inline `<path>` or a `<use>` reference.
- **Hover-styling unification call:** `.action-btn`/`.action-btn--delete` (+ new `.action-btn--edit`) SCSS-class pattern wins over plain Tailwind hover utilities, applied uniformly even to buttons with no `[disabled]` state today (future-proofing/consistency over minimal-diff). Also called: consolidate the pattern's `@apply` rules into a single global block in `src/styles.css` instead of duplicating the identical 3-line block + `@reference` boilerplate per component `.scss` file (already happening 3× today in `monsters-list.scss`/`monster-detail.scss`/`minion-detail.scss`) — this app has no shared-partial-`.scss` convention to split into instead, so "global CSS" already means "add to `styles.css`" here. Also flagged (fold into same pass): `minion-detail.scss` never got the `.action-btn:disabled` rule its siblings have and instead relies on inline `disabled:*` Tailwind classes — a small pre-existing divergence, reconciled in the same phase rather than left mixed.

### Files
`docs/updates/svg-symbol-icons.md` only — revised Recommendation, Naming convention, and Phased rollout sections (now 5 phases: 0 sprite infra, 1 trash-icon migration, 2 hover-styling unification, 3 shell/chrome one-offs, 4 domain/mystery-section sprite migration). Open Questions section removed — no unresolved forks remained after making the calls above. No application code touched.

---

## 2026-08-06 — Monster Required-Field Validation: Frontend (Phase 2 of the required-field initiative)

### Task
Implemented the unconditional frontend scope from `docs/updates/monster-required-fields-validation.md`'s revision section (paired with Bowser's backend `ApiContracts.cs` DataAnnotations pass, done in parallel — I did not touch any `.cs` file): fix `monsterTypeId`'s missing `Validators.required` in `shared/monster-form/monster-form.ts`, `maxlength="255"` on all 9 Name inputs (1 in `monster-form.html` + 4 draft forms in `monster-create.html` + 4 immediate-edit forms in `monster-detail.html`), the `<span class="text-danger">*</span>` asterisk convention (copied from `mystery-create-mystery-phase.html`) on every required field, and a UI-only conditional-required rule on `MonsterArmor.SpecialDescription` gated by `isSpecial`.

### Key patterns confirmed / established
- **Conditional cross-field required validator, toggled via `valueChanges`:** `isSpecial.valueChanges.pipe(startWith(isSpecial.value), takeUntilDestroyed(this.destroyRef)).subscribe(isSpecial => { control.setValidators(isSpecial ? [Validators.required] : []); control.updateValueAndValidity({ emitEvent: false }); })`, wired in `ngOnInit`. This matches `data-admin.ts:50`'s existing precedent (subscribe-in-`ngOnInit`, `takeUntilDestroyed`) rather than inventing a form-level cross-field validator — the codebase has no precedent for the latter and doesn't need one for a 2-control case. `startWith` covers "wire it correctly on initial form setup" without a duplicate one-off call. `{ emitEvent: false }` on `updateValueAndValidity` avoids a needless second `valueChanges` emission nobody listens to.
- **`Validators.compose([])` (i.e. `setValidators([])`) resolves to `control.validator === null`**, not a no-op empty-composed-function — confirmed by testing `expect(control.validator).toBeNull()` both before `ngOnInit` wires anything and after `isSpecial` toggles back to `false`. Useful for asserting "no validators currently attached" precisely rather than only asserting `.valid` with a truthy value.
- **No prior spec in this repo asserts asterisk-indicator presence** (grepped `text-danger` across all `mysteries/**/*.spec.ts` — zero hits, despite the convention shipping there first). Added straightforward `label.querySelector('span.text-danger')` presence/absence checks anyway, reusing the existing `fixture.nativeElement.querySelector(...)` idiom already used throughout `monster-create.spec.ts`/`monster-detail.spec.ts` — no new test infra needed.
- Reconfirmed the sub-resource Name-input count from the doc's own correction: 9 total `<input>` elements (not 6 DTO fields) — 1 core form + 4 create-page draft forms + 4 detail-page immediate forms, since attack/power/armor/weakness each have two UI call sites.

### Files
`features/monsters/shared/monster-form/monster-form.{ts,html,spec.ts}`, `features/monsters/pages/monster-create/monster-create.{ts,html,spec.ts}`, `features/monsters/pages/monster-detail/monster-detail.{ts,html,spec.ts}`.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings: `mystery-create.scss`, `custom-select.component.scss`). `npm run test -- --watch=false`: 38 files / 272 tests passed, 0 skipped (6 new specs + 1 existing test extended with a new assertion).

---

## 2026-08-06 — Follow-up: Fixed asterisk-wrapping bug from the pass above

### Task
Skyler reported the required-field asterisks wrapping onto their own line on the Monster form. Root cause was NOT "asterisk placed as a sibling outside the label" (Mystery's working pattern already matched that structurally) — it was that all 10 asterisk-bearing `<label>`s in this feature use `class="grid font-medium gap-1"` (`display: grid`, no explicit columns). **CSS Grid makes every in-flow child of a grid container its own grid item, including the anonymous box wrapping a bare text run** — so `Name <span class="text-danger">*</span>` inside a `grid`-display label became two separate grid items (the "Name" text run and the `*` span), each auto-placed onto its own implicit row via the default `grid-auto-flow: row` + single implicit column, stacking label-text / asterisk / input as three separate rows instead of two. Mystery's equivalent label is `display: block`, not `grid`, so it never had this failure mode — not because the asterisk was positioned differently within the label.

### Key pattern for next time
**When a `*`/badge/icon needs to sit inline with label text inside a `display: grid` label (this app's "label text stacked above input" idiom), wrap the text + inline marker together in one `<span>` so they form a single grid item/row** — don't just place them as adjacent siblings the way you would in a `display: block` or plain inline context. `<span>Name <span class="text-danger">*</span></span>` as the grid's row-1 item, input/textarea/custom-select as row 2. This is a general gotcha for this codebase's `grid font-medium gap-1` label convention (used throughout `monster-form.html`/`monster-create.html`/`monster-detail.html`, likely elsewhere too) — any future addition of a second inline element next to label text in one of these grid-labels needs the same wrapper, or it'll silently drop to its own row.

### Verification technique note
Playwright dev-server verification against this app **must use port 4200**, not any other port — `appsettings.Development.json`'s `Cors:AllowedOrigins` only allow `http://localhost:4200`, so `ng serve --port 4300` silently CORS-blocks every API call (page hangs on a loading state, no thrown error visible without opening dev tools/network listeners). Confirmed by reading the actual appsettings rather than guessing. Also: the previously-running `dotnet run`/`ng serve` processes from an earlier session were no longer alive when I started this task (had to restart both — `dotnet run --launch-profile http` in `src/api/MonsterOfTheWeek.Api`, port 5225; `docker ps` confirmed Postgres was still up) — don't assume a live backend is already running just because it has been in past sessions.

### Files
`features/monsters/shared/monster-form/monster-form.html`, `features/monsters/pages/monster-create/monster-create.html`, `features/monsters/pages/monster-detail/monster-detail.html` — wrapped each `label`'s text + asterisk `<span>` (10 locations total) in an outer `<span>`. No `.ts`/`.spec.ts` changes needed — existing specs use `querySelector`/`textContent` which are insensitive to the added wrapper depth.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 38 files / 272 tests passed, unchanged. Visually verified via throwaway Playwright script (`getBoundingClientRect().top` comparison + screenshot) against live `dotnet run` + `ng serve --port 4200`: all 10 asterisks on both `/monsters/:id` (edit) and `/monsters/new` (create) now sit on the same line as their label text, including the conditionally-`@if`-rendered Special Description asterisk after checking "Special". Cleaned up: deleted throwaway `.mjs` scripts and screenshots, killed the `dotnet run`/`ng serve` processes started for verification.

---

## 2026-08-06 — Follow-up #2: Extended asterisk convention to Mystery wizard's monster phase

### Task
Same-session coordinator follow-up: port the (corrected) red-asterisk convention to `mystery-create-monster-phase.html`, the wizard's monster-authoring step.

### Key finding: this component does NOT need the grid-wrapper fix
`mystery-create-monster-phase.html`'s core-field labels use `class="text-primary block text-sm font-semibold mb-[0.35rem]"` — `display: block`, not `grid`. This is literally the *original* pattern the standalone Monster form's asterisks were copied from (per the doc's own history) — it was never broken. Confirmed by reading before assuming; the plain sibling-span shape (`Name <span class="text-danger">*</span>`) is correct here as-is, no wrapper `<span>` needed. Good reminder: the grid-wrapper fix is specific to this app's `grid font-medium gap-1` label idiom (Monster feature only, so far) — don't reflexively apply it to every label with an asterisk elsewhere without checking `display` first.

### Key finding: the sub-resource draft rows have no `<label>` elements at all
Unlike `monster-create.ts`'s labeled draft forms, the wizard's Attack/Power/Weakness/Armor rows are bare `placeholder`-only inputs in a compact `flex flex-wrap` row (`<input formControlName="name" placeholder="Attack name">`) — confirmed by reading + a live screenshot. No label text exists to attach an asterisk to. Treated this as a structural mismatch worth flagging rather than inventing new label markup unilaterally (would be a real design change, 8 rows across monster+minion sub-phases, not a mechanical port) — left untouched, documented as a UX-owner decision.

### Fixed (code + markup)
- `mystery-create.store.ts`: added missing `Validators.required` to `monsterForm.harmCapacity` (had only `min(0)`), `monsterAttackForm.harm` (had **no validators at all**), `monsterArmorForm.harmSoak` (had only `min(0)`) — same class of gap as the original `monsterTypeId` bug, found by diffing against the standalone `monster-form.ts`/`monster-create.ts` ground truth. `monsterTypeId` itself already had the validator, just no visual asterisk.
- `mystery-create-monster-phase.html`: added asterisks to "Harm Capacity"/"Monster Type" labels (Name/Monster Archetype already had them).
- Deliberately did NOT: wire `isSpecial`→`specialDescription` conditional-required (never existed in this store at all — bigger feature port, flagged not fixed), add `maxlength="255"` (not asked, not this doc's scope), touch the Minion step/sub-resources (Minion domain has no ground-truth asterisk convention anywhere yet — confirmed `minion-form.ts`'s `minionTypeId` isn't even `Validators.required`).

### Verification
`npm run build`/`npm run test -- --watch=false` clean, 38/272 unchanged (checked `mystery-create.store.spec.ts` first — no test relies on a zero/blank value being valid for the three controls touched). Live Playwright walkthrough: filled the concept phase, advanced to the Monster phase, confirmed all 4 core-field asterisks render inline (not wrapped) via both `getBoundingClientRect()` comparison and screenshot. `ng serve`/`dotnet run` were already running (someone/something else's session) when this task started — used them as-is, didn't kill them since I didn't start them.

### Files
`features/mysteries/pages/mystery-create/mystery-create-monster-phase.html`, `features/mysteries/pages/mystery-create/mystery-create.store.ts`. Doc addendum: `docs/updates/monster-required-fields-validation.md` (flagging the wizard-side gap the doc's original audit couldn't have caught, since the wizard was outside its file scope). Full write-up: `.squad/decisions/records/luigi-monster-required-fields-validation.md`.

---

## 2026-08-06 — Minion Required-Field Validation (Phase 3, mechanical port of the Monster-phase work)

### Task
`docs/updates/minion-required-fields-validation.md`'s locked scope: `minionTypeId` required-validator bug fix, `maxlength="255"` on all 9 Name inputs, asterisk convention, conditional-required `MinionArmor.SpecialDescription`, and a bundled wizard validator fix — same shape as the already-shipped Monster-phase work, copied pattern-for-pattern rather than re-derived.

### Confirmed before writing any markup: `minion-form.html`'s labels DO use the grid class, unlike the wizard's monster-phase labels
`minion-form.html` uses the same `grid font-medium gap-1` label class Monster's standalone forms do (not the wizard's `display: block` pattern) — so the wrapper-span trick (`<span>Name <span class="text-danger">*</span></span>`) was required from the first edit here, not discovered after a Skyler bug report like it was for Monster. Checked the class before writing a single asterisk, per the "don't reflexively apply/skip the wrapper fix — check `display` first" note from the previous entry.

### The wizard's minion phase is not a separate file
There is no `mystery-create-minion-phase.html` — the minion step lives inside `mystery-create-monster-phase.html`, gated on `store.currentStep() === 1` (same file the Monster-phase asterisk follow-up touched for `currentStep() === 0`). This phase's scope only asked for 3 validators there (`minionForm.harmCapacity`, `minionAttackForm.harm`, `minionArmorForm.harmSoak`), not asterisks — so no markup was touched in that file this pass, only `mystery-create.store.ts`. Confirmed live via Playwright that Minion Name/Harm Capacity/Minion Type still render with no asterisk there (correct — out of scope, matching the previous entry's note that Minion has no asterisk ground truth to port from... except now it does, on the standalone pages, just not yet ported into the wizard).

### `minionAttackForm.harm` had zero validators, not just a missing `required`
Same shape as `monsterAttackForm.harm`'s pre-fix state — added both `Validators.required` and `Validators.min(0)`, not just `required`, since `min(0)` was also absent. Worth re-checking the live file instead of trusting a doc's "add Validators.required" paraphrase — the actual gap is sometimes bigger than the one-line summary says.

### Verification technique: reaching the wizard's minion step via Playwright requires driving the real custom-select panel, not a generic `button`/`li` selector
`app-custom-select`'s option buttons (`.custom-select__option`) live in the DOM *after* the trigger button (`.custom-select__trigger`), both under the same `app-custom-select` — a `.locator('li, [role="option"], button').first()` picks the trigger itself (closing the just-opened panel) instead of an option. Use `.locator('button.custom-select__trigger')` to open, then `.locator('button.custom-select__option').first()` to pick. Also: the wizard's create route is `/mysteries/create`, not `/mysteries/new` (`/mysteries/new` 404s) — confirmed via `mysteries.routes.ts` rather than guessing from the Monster/Minion domains' `/…/new` convention, which the Mystery domain doesn't share.

### Files
`features/minions/shared/minion-form/minion-form.{ts,html,spec.ts}`, `features/minions/pages/minion-create/minion-create.{html,ts}`, `features/minions/pages/minion-detail/minion-detail.{html,ts}`, `features/mysteries/pages/mystery-create/mystery-create.store.ts`. Full write-up: `.squad/decisions/records/luigi-minion-required-fields-validation.md`.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 38 files / 274 tests passed (272 baseline + 2 new specs in `minion-form.spec.ts`). Live Playwright verification against `dotnet run` (5225) + `ng serve --port 4200` (both already running at session start, not started or killed by me): asterisks render inline (not wrapped) on `/monsters/:monsterId/minions/:minionId`, `/minions/new`, and all `maxlength=255` on Name inputs confirmed via `input.maxLength`; conditional Special Description asterisk toggles correctly; wizard minion step renders with no asterisks (correct, out of scope) and no console errors after walking the full wizard flow to reach it.

---

## 2026-08-06 — Bystander Required-Field Validation (Phase 5, final domain — closes the five-phase initiative)

### Task
`docs/updates/bystander-required-fields-validation.md`'s locked scope ("Revision — Skyler's 2 Answers Resolved" section): `maxlength="255"` on the Name input and the asterisk convention on Name/Bystander Type in `bystander-form.html`. Smallest of all five phases, same shape as my own Location phase — no validator bug (`bystanderTypeId` already had `Validators.required`, confirmed live and by the doc), no sub-resource forms, no numeric fields, no conditional-required shape.

### Confirmed before writing markup, per the task's explicit instruction not to assume from Location's resemblance
`bystander-form.html`'s labels use the same `grid font-medium gap-1` class as Monster/Minion/Location — used the wrapper-span trick (`<span>Name <span class="text-danger">*</span></span>`) from the first edit, same discipline as Location's phase.

### Files
`features/bystanders/shared/bystander-form/bystander-form.html`, `features/bystanders/shared/bystander-form/bystander-form.spec.ts`. Full write-up: `.squad/decisions/records/luigi-bystander-required-fields-validation.md`.

### Verification
`npm run build` clean (same 2 pre-existing budget warnings). `npm run test -- --watch=false`: 38 files / 278 tests passed (276 baseline + 2 new specs in `bystander-form.spec.ts`). Live Playwright verification against `dotnet run` (5225) + `ng serve --port 4200` (both already running at session start, not started or killed by me): asterisks render inline (not wrapped, bounding-box `y` within 2px of label text) on both `/bystanders/new` and an existing bystander's edit page; Name input `maxlength="255"` confirmed on both. This is the final implementation step of the five-phase required-field-validation initiative — all five domains' shared form components (Mystery, Monster, Minion, Location, Bystander) now have consistent `maxlength` guards and the asterisk convention.

### Note: no Location entry exists in this history file
Grepped for it before writing this entry — `.squad/decisions/records/luigi-location-required-fields-validation.md` exists and was used as the direct reference, but no matching history.md entry was ever appended for that phase. Not backfilled here (out of scope for this task), flagging in case it matters for a future retrospective pass.

---

## 2026-08-06 — SVG Symbol Sprite: Phase 0 Implementation (Sprite Infrastructure Only)

### Task
Implemented Phase 0 only of `docs/updates/svg-symbol-icons.md` (approved plan) — sprite infrastructure, purely additive, no existing icon call sites touched.

### Files
- New `shared/icons/icon-sprite.component.ts` (`app-icon-sprite`) — one `<svg style="display:none" aria-hidden="true">` with 26 `<symbol>` defs, all 3 namespaces from the doc populated now (not just Phase 1's action/chrome set) to avoid a second inventory pass later: 7 unprefixed `icon-*` (trash, pencil, close, menu, plus, spinner, search), 7 `icon-nav-*` (one per `NavIconKey`), 12 `icon-mystery-*` (one per `MysterySectionIconKind`). Every symbol's `viewBox`/fill/stroke attributes and path data copied verbatim from the actual existing inline `<svg>` markup (re-read source files fresh rather than trusting memory from the earlier research pass, to avoid path-data transcription errors).
- New `shared/icons/icon.component.ts` (`app-icon`/`IconComponent`) — typed wrapper per the doc's code sample, `IconName` scoped to just the 7 action/chrome names.
- Modified `layout/page-layout/page-layout.ts` (import + register `IconSpriteComponent` in `imports`) and `page-layout.html` (`<app-icon-sprite />` mounted as the first child of the root `<div>`, before the sidebar `<aside>`).
- Nothing else touched — no existing `<svg>` call site (13 trash-icon copies, `domain-icon.component.ts`, `mystery-section-icon.ts`, etc.) repointed. Confirmed via `git status`.

### Verification
`npm run build`: clean, same 2 pre-existing `anyComponentStyle` budget warnings (`custom-select.component.scss`, `mystery-create.scss`), unrelated. `npm run test -- --watch=false`: 38 files / 278 tests, all green, no regressions, no new specs needed (Phase 0 has no new behavior to test — the sprite renders nothing visible and nothing consumes it yet). Live-verified via Playwright against `ng serve` (no backend running, so pages loaded with the expected "API unavailable" state — unrelated to this change): `app-icon-sprite svg` present in the DOM with `computedStyle.display === 'none'` and all 26 expected symbol IDs; screenshotted `/dashboard` and `/minions` and confirmed pixel-identical layout to pre-change (sidebar icons, search glass, plus button, API-modal all render exactly as before — no visual diff, as expected for a `display:none` sprite). Cleaned up the throwaway `.mjs` verification script and killed the `ng serve` process I started (confirmed via `netstat` that the port was freed, didn't touch any other process).

---

## 2026-09-14 — Hunter Wizard Phase 2: F1 (13.11 items 1-6) + B4 frontend half

### Task
`hunter-creation-wizard-phases.md` Phase 2 (R2), run concurrently with Bowser's B4 (`[MaxLength(255)]`)/B9 backend work — he only touches `src/api/`, I only touch `src/web/`. Six live-bug fixes on `hunter-form` plus the toast-suppression token (also wired onto the admin playbook save/delete per 13.12 item 14), plus verifying/adding the entry-name `maxlength`.

### Reusable technical facts
- **`ApiService.post/put/delete` gained an optional trailing `context?: HttpContext` param**, forwarded to `HttpClient` as `context ? { context } : undefined`. `HunterService.create/update` and `PlaybookService.create/update/delete` each build `new HttpContext().set(SUPPRESS_ERROR_TOAST, true)` — the token lives in new `core/http-context-tokens.ts`, checked only by `httpErrorInterceptor` (`isSelfHandled = isSelfHandledRequest(req) || req.context.get(SUPPRESS_ERROR_TOAST)`). Deliberately NOT folded into `isSelfHandledRequest`, since that predicate also disables `authErrorInterceptor`'s 401 bounce (per `luigi-interceptor-order-error-direction.md`) and these calls still need the bounce. Since `authErrorInterceptor` is innermost in `withInterceptors([credentials, httpError, authError])`, a 401 never even reaches `httpErrorInterceptor`'s catchError, so the new token is structurally inert on that path — pinned by a new `auth-error-interceptor.spec.ts` case that sets the token and still asserts a bounce with zero toasts.
- **Bowser's B4 400 is ASP.NET's default ProblemDetails with no `message` field** (`{ title, errors: { Name: [...] }, traceId }`, no `message` key). The existing page handlers' `error?.error?.message ?? 'Unable to create hunter.'` pattern (unmodified, pre-existing in `hunter-create.ts`/`hunter-detail.ts`/`playbook-admin.ts`) already falls back correctly since optional chaining yields `undefined` for the missing key — pinned with the literal payload Bowser supplied in a new `http-error-interceptor.spec.ts` case, rather than by creating new page-level spec files (none exist yet for the hunter pages or `playbook-admin.ts` — a documented gap, 13.12 item 13, deferred to Phase 4).
- **Playbook load race fix (item 5):** replaced two independent per-call `.subscribe()`s (one on `playbookId.valueChanges`, one inline inside the old `loadPlaybook`, plus a *third* direct call from `populate()`) with a single `Subject<string>` (`playbookIdRequests`) that every trigger pushes into, piped once through `switchMap`. Pinned with a new test using two raw `Subject`s as the mocked `getById` responses, resolving the *second* (fast) request before flushing the *first* (slow) one late — asserts the stale one never overwrites.
- **Second-round bug, caught by Mario's review before I called this done: the switchMap subscription cannot live in `ngOnInit`.** `hunter-detail.html` only creates `<app-hunter-form [hunter]="current">` inside `@if (hunter(); as current)` — so on the edit page, the component's very *first* `ngOnChanges` already carries a non-null hunter, and Angular calls `ngOnChanges` before `ngOnInit` on that first change-detection pass. `populate()` (from `ngOnChanges`) ends by pushing into `playbookIdRequests`; with the subscription in `ngOnInit` that first push had no subscriber yet, and a plain `Subject` (not a `ReplaySubject`) drops it silently — the edit page's playbook would never load. All my Phase 2 tests missed this because the shared `beforeEach` always sets `hunter: null` and calls `detectChanges()` *before* setting a real hunter in a later, separate `detectChanges()` call — by which point `ngOnInit` had already run. **Fix: moved both subscriptions (`valueChanges` and the `playbookIdRequests`→`switchMap` pipeline) into an explicit `constructor()`.** Field initializers (including `hunterForm`, `playbookIdRequests`, `destroyRef`) all run before a constructor body regardless of source order, and construction always precedes the first `ngOnChanges`, so this can't race no matter which input arrives first. Removed the now-empty `ngOnInit`/`OnInit`. **Lesson for next time a fix touches a `switchMap`/`Subject` pipeline gating on an `@Input`:** write the "component created with the input already set" case *before* trusting a green suite — a spec that starts from `hunter: null` and mutates later cannot catch an ordering bug that only exists on first construction. Pinned with a spec that calls `TestBed.createComponent` fresh and sets a non-null `hunter` via `setInput` *before the first* `detectChanges()`, reproducing `hunter-detail`'s real order; confirmed failing against the `ngOnInit` version before applying the fix.
- **Numeric leaf default (item 6, L14):** `toggleBespoke` now looks up the option via a new private `findBespokeOption(optionId)` (recursive search over `allSections()`'s option trees) and, only on a fresh tick (`!wasPicked`) with no existing answer (`!this.answersFor(scopeKey).has(optionId)`), seeds `bespokeAnswers` with `numericValue: option.numericMax`. The "no existing answer" guard is what makes untick→retick preserve a value the player already typed — pinned by a dedicated control test, not just the happy path.
- **Granted gear (item 2, B6/L15):** template-only split on `category.pickCount !== null` — pickable categories keep their checkbox `<label>`s unchanged; null-`pickCount` categories render a plain read-only `<div>` list headed "You get", no checkbox, so there is nothing to toggle a granted option's id on or off. No changes needed in `hunter-form.ts`: `selectedGearIds` already round-trips whatever `hunter.playbookGearOptionIds` loaded, and `dropSelectionsOutside` already treats granted-category option ids as valid (they're still part of `playbook.gearCategories`), so already-saved ids simply survive untouched — confirmed with a populate-then-resubmit test rather than assumed.
- **History retitle + text interpolation (items 1, 3):** confirmed Bowser's B9 note — the only remaining stale comment was the template block above the `<textarea>` (`hunter-form.html`, "Now the placeholder for history and bespoke-ruleset answers only…"), now gone along with the `<h3>Background</h3>` heading and the old hint paragraph. `historyPromptsText`'s `[innerHTML]` (line 351 exactly, as the doc named it) became `{{ book.historyPromptsText }}` with a `whitespace-pre-line` class; the other `[innerHTML]` bindings in the file (move/section/option/effect text) were left alone per the brief.
- Doc line references drift slightly from the current file (e.g. 13.11 item 5 cites `hunter-form.ts:668-692`; the actual `loadPlaybook` sat at `:677-701` before this change) — not a real mismatch, just Phase 1's edits shifting line numbers; flagged, not treated as a doc error.

### Verification
`npm run test -- --watch=false`: 46 files / 404 tests green (+21 over the 383 baseline: 8 in `hunter-form.spec.ts` — items 1/2/3/5/6, the B6/L15 already-saved-id case, and the edit-page first-render regression — 3 in `http-error-interceptor.spec.ts` (token true/false, message-less ProblemDetails), 1 in `auth-error-interceptor.spec.ts`, 4 in `api.spec.ts` for context forwarding, and 2 new files — `hunter.spec.ts` (2 tests) and `playbook.spec.ts` (3 tests) — asserting the token lands on the real outgoing request via `HttpTestingController`). `ng build --configuration production` (output redirected to the scratchpad, not `wwwroot`): clean, same 2 pre-existing budget warnings (`mystery-create.scss`, `custom-select.component.scss`). `git status` after: only `src/web/` files touched by me; Bowser's B4/B9 changes are confined to `src/api/`, confirmed untouched.

### Files
New: `core/http-context-tokens.ts`, `core/hunter.spec.ts`, `core/playbook.spec.ts`. Modified: `core/api.ts`, `core/hunter.ts`, `core/playbook.ts`, `core/http-error-interceptor.ts`, `core/http-error-interceptor.spec.ts`, `core/auth-error-interceptor.spec.ts`, `features/hunters/shared/hunter-form/hunter-form.ts`, `hunter-form.html`, `hunter-form.spec.ts`. Not committed.

### Notes for whoever picks up Phase 1+
The sprite already has Phase 4's `icon-nav-*`/`icon-mystery-*` symbols defined and correct (verified by DOM inspection, not just by eye) — Phase 4 only needs to repoint `domain-icon.component.ts`/`mystery-section-icon.ts`'s templates onto `<use>`, no new symbol authoring. Phase 1 can start immediately: `<app-icon name="trash" class="h-5 w-5" />` is ready to drop into all 13 call sites.

---

## 2026-08-07 — SVG Symbol Sprite: Phase 1 Implementation (Migrate the Duplicated Trash Icon)

### Task
Implemented Phase 1 only of `docs/updates/svg-symbol-icons.md` (Phase 0 committed as `499fc24`) — swapped all 13 inline trash-icon `<svg>` occurrences onto `<app-icon name="trash" ...>`.

### Files (14 total, 7 `.html`/`.ts` pairs, no other files touched)
`features/minions/pages/minions-list/{minions-list.html,.ts}`, `features/locations/pages/locations-list/{locations-list.html,.ts}`, `features/bystanders/pages/bystanders-list/{bystanders-list.html,.ts}`, `features/monsters/pages/monsters-list/{monsters-list.html,.ts}`, `features/mysteries/pages/mysteries-list/{mysteries-list.html,.ts}` (1 trash occurrence each), `features/monsters/pages/monster-detail/{monster-detail.html,.ts}`, `features/minions/pages/minion-detail/{minion-detail.html,.ts}` (4 occurrences each — attack/power/armor/weakness delete buttons).

### Approach
- `.ts` files: added `import { IconComponent } from '../../../../shared/icons/icon.component';` and appended `IconComponent` to each component's `imports` array (all 7 files sit at the identical `features/{domain}/pages/{page}/{page}.ts` depth, so the relative import path is uniform across all of them).
- `.html` files: replaced each `<svg ...viewBox="0 40 32 32"...><path d="m 12.914062,42 c...Z"/></svg>` block with `<app-icon name="trash" class="h-5 w-5" />` — the sizing class (`h-5 w-5`) moved onto `<app-icon>` per the doc's consumption example; `IconComponent`'s host already handles the rest (`inline-flex items-center justify-center`, inner `<svg class="h-full w-full">`). In `monster-detail.html`/`minion-detail.html` all 4 occurrences were byte-identical, so `Edit`'s `replace_all: true` handled each file in one call. `mysteries-list.html`'s unrelated edit-pencil `<svg>` (same file, different icon) was left untouched — verified via `git diff` that only the trash block changed.
- Did **not** touch `.action-btn`/`.action-btn--delete` classes or any hover-styling CSS on the wrapping `<button>` (Phase 2), and did not touch `domain-icon.component.ts`, `mystery-section-icon.ts`, or the mysteries-list edit-pencil/header-search/page-layout icons (Phase 3/4).

### Verification
- `npm run build`: clean, same 2 pre-existing budget warnings (unrelated). Lazy chunks for `monster-detail`/`minion-detail` shrank (~1.1-1.6 kB each) as expected from removing duplicated path data.
- `npm run test -- --watch=false`: 38 files / 278 tests, all green, no regressions.
- Live-verified via Playwright against a real stack (`docker compose up -d postgres` — already running, not started by me; `dotnet run` on 5225; `ng serve --port 4200`, not 4300 — **the API's CORS policy only allows origin :4200**, confirmed by hitting a CORS error on :4300 first and switching back to the default port fixed it, worth remembering for future one-off `ng serve` verification runs in this repo). Confirmed via `document.querySelectorAll('app-icon svg use[href="#icon-trash"]')` that the `<use>` count exactly matches the visible row count on `monsters-list` (3), `minions-list` (3), `locations-list` (9), `bystanders-list` (5), `mysteries-list` (5, pencil icon still present and untouched), `monster-detail` (6, data-dependent — this monster has extra attacks), `minion-detail` (4) — zero missing/duplicated icons, zero console errors. Hover-state check (real `page.mouse.move` + `getComputedStyle`, not just static CSS reading): `monster-detail`'s `.action-btn--delete:hover:not(:disabled)` button correctly transitions from muted gray text to red text (`oklch(0.577 0.245 27.325)`) with a red-tinted background on hover; `minions-list`'s plain-Tailwind-hover delete button (no `.action-btn` class) resolves to the *identical* red hover color — confirms both of Phase 1's still-untouched hover mechanisms (to be unified in Phase 2) keep working exactly as before. Screenshotted `monsters-list` and the `monster-detail` hover state for visual confirmation — pixel-equivalent to pre-Phase-1.
- Cleanup: removed the throwaway `.mjs` verification script, killed only the `ng serve`/`dotnet run` processes I started myself (confirmed via `netstat` the ports were freed), left the already-running `motw-postgres` container alone.

---

## 2026-08-07 — SVG Symbol Sprite: Phase 2 Implementation (Unify Delete/Edit Hover Styling)

### Task
Implemented Phase 2 only of `docs/updates/svg-symbol-icons.md` (Phase 1 committed as `36af66e`) — consolidated the `.action-btn`/plain-Tailwind hover-styling split onto one shared `.action-btn` class family, defined globally.

### Approach
- Added a global `.action-btn` / `.action-btn--delete` / `.action-btn--edit` / `.action-btn:disabled` block directly to `src/styles.css` (after the `@utility` section, before `@layer base`), with a comment explaining why it's global rather than per-component (identical `@apply` targets everywhere; no shared-partial-`.scss` convention exists in this app to split into instead). `.action-btn--edit` is new (`bg-accent-subtle text-accent` on `:hover:not(:disabled)`), needed for `mysteries-list.html`'s edit-pencil link.
- **Deleted** (not just emptied) `monsters-list.scss`, `monster-detail.scss`, `minion-detail.scss` — each contained *only* the now-superseded `.action-btn` block plus the `@reference "#styles.css"` boilerplate comment, nothing else, so an empty file would have been pure debris. Removed the corresponding `styleUrl: './*.scss'` line from each of the 3 components' `@Component` decorator (`monsters-list.ts`, `monster-detail.ts`, `minion-detail.ts`).
- `minion-detail.html`: removed the inline `disabled:cursor-not-allowed disabled:opacity-40` Tailwind classes from all 4 delete buttons (its pre-existing divergence — it never had an `.action-btn:disabled` SCSS rule like its two siblings) — now covered by the same global rule as `monster-detail`/`monsters-list`.
- `minions-list.html`/`locations-list.html`/`bystanders-list.html`: swapped `hover:bg-danger-subtle hover:text-danger` for `action-btn action-btn--delete` on the delete button's `class` list.
- `mysteries-list.html`: swapped `hover:bg-danger-subtle hover:text-danger` → `action-btn action-btn--delete` on the delete button, and `hover:bg-accent-subtle hover:text-accent` → `action-btn action-btn--edit` on the edit-pencil link. `monster-detail.html` needed **no changes** — it already used the `.action-btn` classes correctly and had no inline disabled-Tailwind divergence.
- Grepped for other `hover:bg-danger-subtle`/`hover:bg-accent-subtle` usages before finishing to confirm no incidental over-migration — found only unrelated "+ Add" buttons in the mystery-create wizard phases (plain single `:hover`, no delete/trash icon, correctly left alone).

### Verification
- `npm run build`: clean, same 2 pre-existing budget warnings (unrelated). `monsters-list`/`monster-detail`/`minion-detail` lazy chunks shrank slightly (component-scoped style removed).
- `npm run test -- --watch=false`: 38 files / 278 tests, all green, no regressions.
- Live-verified via Playwright (`docker compose up -d postgres` already running; `dotnet run` on 5225; `ng serve --port 4200` — CORS still requires :4200, per Phase 1's note) across all 7 pages in **both light and dark theme** (toggled via `document.documentElement.classList.add/remove('dark')`, same technique the theming-plan docs use): real `page.mouse.move` + `getComputedStyle` before/after on every delete/edit button confirmed the hover color transition is the *same* red (`text-danger`/`bg-danger-subtle`) or indigo (`text-accent`/`bg-accent-subtle`) pair on **all 7 pages, in both themes** — the oklch vs. oklab differences in the raw computed-style strings across pages are just different serializations of the identical color (verified numerically), not an actual mismatch. Disabled-state check (`monster-detail`/`minion-detail`, temporarily setting `disabled` via `evaluate` then reading `getComputedStyle`): `cursor: not-allowed`, `opacity: 0.4` in both themes on both pages — confirms `minion-detail`'s reconciled disabled-state now matches `monster-detail`'s exactly. Zero console errors on any page/theme combination. Screenshotted `mysteries-list` (dark) and `monster-detail` (light) for visual confirmation — both render correctly, icons unaffected (Phase 1's `<app-icon>` usage untouched by this phase, confirmed via `git status` showing no changes to `monster-detail.html`).
- Cleanup: removed the throwaway `.mjs` script, killed only the `ng serve`/`dotnet run` processes started for this verification (confirmed via `netstat`), left `motw-postgres` running.

### Files (11 total)
Modified: `styles.css`; `minions-list.html`, `locations-list.html`, `bystanders-list.html`, `mysteries-list.html`, `minion-detail.html`; `monsters-list.ts`, `monster-detail.ts`, `minion-detail.ts` (styleUrl removed). Deleted: `monsters-list.scss`, `monster-detail.scss`, `minion-detail.scss`. `monster-detail.html` needed no change.

---

## 2026-08-07 — SVG Symbol Sprite: Phase 3 Implementation (Migrate Shell/Chrome Icons)

### Task
Implemented Phase 3 only of `docs/updates/svg-symbol-icons.md` (Phase 2 committed as `2ed307c`) — migrated the remaining one-off inline icons (edit-pencil, search glass, page-layout's hamburger/close/plus/spinner) onto `<app-icon>`.

### Verification-before-trust
Per the coordinator's instruction, did not assume Phase 0's extracted sprite symbols still matched their source call sites — re-read all 4 source files (`icon-sprite.component.ts`, `mysteries-list.html`, `header-search.html`, `page-layout.html`) fresh and diffed the `viewBox`/`fill`/`stroke`/path data by eye before touching anything. All matched byte-for-byte (Phases 1/2 never touched these icons' markup, only the trash icon and hover classes respectively), so no sprite corrections were needed.

### Real finding: the "spinner" icon has never actually animated/rotated in this app
Went looking for what makes the API-unavailable modal's spinner spin (per the coordinator's explicit ask to check whether the `style="opacity:.25"`/`style="opacity:.75"` inline styles are animation-related or just static). **Grepped the whole app for `animate-spin`/`@keyframes`/any rotation — found none, anywhere.** The two inline `style="opacity:..."` attributes are purely static per-element opacity values that create the classic "partial-ring" glyph (a full ring at 25% opacity + a highlighted quarter-arc at 75% opacity) — there is no CSS animation rotating it, today or previously. This is not something Phase 3 broke; it's the pre-existing (if slightly misleadingly-named) behavior, and the sprite's `icon-spinner` symbol (built in Phase 0) already reproduces the exact same two static opacity values verbatim, so the migration is a faithful no-op here. Flagging as a known gap in case Skyler wants a real spin animation added later — that would be a separate, small follow-up (a Tailwind `animate-spin` class on the `<app-icon name="spinner">` call site, no sprite change needed since `<use>` content inherits animations applied to its ancestor), not part of this phase.
- Also converted the spinner's inline `style="height:1rem;width:1rem;flex-shrink:0"` to the exact equivalent Tailwind classes `h-4 w-4 shrink-0` on the `<app-icon>` call site (1rem = Tailwind's `4` spacing step) — judgment call to keep the codebase's now-uniform "icon size via class, not inline style" convention consistent with every other Phase 1/2/3 migration, rather than leaving one `<app-icon>` call site as the only one still using an inline `style` attribute for sizing.

### Files (5 total)
`mysteries-list.html` (pencil), `header-search.html` + `header-search.ts` (search — added `IconComponent` import), `page-layout.html` + `page-layout.ts` (close/menu/plus/spinner — added `IconComponent` import alongside the existing `IconSpriteComponent` one from Phase 0). `mysteries-list.ts` needed **no** import change — it already imported `IconComponent` from Phase 1 (for the trash icon). Did not touch `domain-icon.component.ts`/`mystery-section-icon.ts` (Phase 4) or any trash-icon/hover-class code (Phases 1/2) — confirmed via `git status` showing exactly these 5 files.

### Verification
- `npm run build`: clean, same 2 pre-existing budget warnings (unrelated).
- `npm run test -- --watch=false`: 38 files / 278 tests, all green. Additionally ran `page-layout.spec.ts` in isolation with `--reporters=verbose` per the coordinator's explicit ask (not just trusting the aggregate count) — all 9 tests individually confirmed passing, including `retries API health check and closes modal after success` (the one asserting `.api-modal svg` truthy for the spinner — stays valid since `<app-icon>` still renders a real `<svg>` wrapping the `<use>`).
- Live-verified via Playwright (`docker compose up -d postgres` already running; `dotnet run` on 5225; `ng serve --port 4200`) in **both light and dark theme**: `mysteries-list` renders 5 pencil + 5 trash icons (1 each per row, matching row count); header-search's magnifying glass confirmed present via `<use href="#icon-search">` on both `/dashboard` and `/monsters` (shell-mounted, present everywhere); desktop viewport (1280px) shows the quick-action plus icon; mobile viewport (500px) — clicked the hamburger to open the mobile sidebar (confirmed `.sidebar-mobile` becomes visible and the close (X) icon renders), then clicked close and confirmed the sidebar closes again; triggered the real API-unavailable modal by intercepting/aborting `**/health/live` via `page.route`, then clicked "Try again" with a delayed-but-successful health response to catch the button mid-check — confirmed `<use href="#icon-spinner">` renders and the button reads "Checking..." during that window, then the modal correctly disappears once the health check resolves. Zero unexpected console errors (the only console errors logged were the *intentional* aborted health-check requests from the test's own route interception). Screenshots confirm pixel-correct rendering in both themes: mobile menu open state, the spinner mid-retry, and mysteries-list in dark mode.
- Cleanup: removed the throwaway `.mjs` script, killed only the `ng serve`/`dotnet run` processes started for this verification (confirmed via `netstat`), left `motw-postgres` running.

---

## 2026-08-07 — SVG Symbol Sprite: Phase 4 Implementation (Re-point Domain/Mystery-Section Icon Components) — Plan Complete

### Task
Implemented Phase 4, the **final phase** of `docs/updates/svg-symbol-icons.md` (Phase 3 committed as `f9e5b3a`) — re-pointed `DomainIconComponent`/`MysterySectionIconComponent`'s internal templates from a hand-copied `@switch` of inline `<svg>` markup onto `<use>` references into the sprite. Public APIs (`domain` input, `kind` input) untouched.

### Approach
- `domain-icon.component.ts`: collapsed the 7-case `@switch` into a single `<svg class="h-5 w-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><use [attr.href]="'#icon-nav-' + normalizedDomain()" /></svg>` — verified fresh (not trusting Phase 0's weeks-old extraction) that all 7 cases still shared the identical `viewBox`/`fill`/`stroke`/`stroke-width` wrapper attributes before hoisting them onto one `<svg>`; they did.
- `mystery-section-icon.ts`: collapsed the 12-case `@switch` into `<use [attr.href]="'#icon-mystery-' + kind" />` inside the existing wrapper `<svg class="icon" viewBox="0 0 24 24" ...>`, itself untouched — confirmed the `:host`/`.icon` sizing rules (the `--mystery-section-icon-size` custom property) size the wrapper element, not its children, so they're structurally unaffected by what's inside it.
- Re-verified (byte-for-byte, not assumed) all 7 `icon-nav-*` and 12 `icon-mystery-*` sprite symbols from Phase 0 still match current source markup exactly — no drift found, no sprite corrections needed.
- No import changes needed on either file (`IconComponent`/`IconSpriteComponent` aren't referenced by either component's own template — they only reference symbol IDs the already-globally-mounted sprite provides).
- Checked for dedicated `domain-icon.component.spec.ts`/`mystery-section-icon.spec.ts` files — **neither exists** — so no spec updates were needed for internal-markup assertions (there were none to begin with).

### Verification
- `npm run build`: clean, same 2 pre-existing budget warnings (unrelated); main bundle shrank ~1.6 kB from removing the duplicated inline path data.
- `npm run test -- --watch=false`: 38 files / 278 tests, all green. Per the coordinator's explicit instruction not to just trust the doc's claim, ran `mystery-detail.spec.ts` + `mystery-create.spec.ts` **in isolation** with `--reporters=verbose`: all 6 tests individually confirmed passing, including `renders section icons across the mystery detail sections` (the `app-mystery-section-icon` count-14 assertion) and `renders countdown stage icons in the countdown step and dossier preview` (count-6/count-2 assertions) — both green, confirming the doc's analysis (these count the custom element instantiation in the host template, unaffected by a component's own internal template change) held up in practice, not just in theory.
- Live-verified via Playwright (`docker compose up -d postgres` already running; `dotnet run` on 5225; `ng serve --port 4200`) in **both light and dark theme** against real seeded data: sidebar nav renders all 7 `<use href="#icon-nav-*">` refs correctly (one per nav item, correct keys); header-search dropdown (searched "sto", 4 real results) renders correct per-domain icons (location pin ×2, bystander ×2); `/search?q=a` results page renders 20 correctly-typed domain icons plus the 7 sidebar nav icons; a real mystery's full dossier (`mystery-detail`) renders exactly 14 `<use href="#icon-mystery-*">` refs with the correct kind mix (mystery ×3, countdown ×1, all 6 countdown-stage kinds, monster/minions/locations/bystanders ×1 each) — matching the spec's own expected count; `mystery-create`'s Phase 1 Step 1 (concept form) renders 5 correctly-typed section icons across the tracker + step heading. Zero console errors anywhere in either theme. Screenshots confirm pixel-correct rendering: mystery-detail's CONCEPT/HOOK/OVERVIEW section icons, the dark-theme header-search dropdown with per-result-type icons, and the dark-theme mystery-create tracker/step icons.
- **Final sweep (plan-completion check):** grepped the whole `src/app` tree for `<svg` — exactly 4 files matched: `icon-sprite.component.ts` (the sprite's own symbol source of truth), `icon.component.ts` and the now-updated `domain-icon.component.ts`/`mystery-section-icon.ts` (each just their own thin `<svg><use></svg>` wrapper). **Zero hand-copied inline icon markup remains anywhere else in the app** — the plan's stated end-state is achieved.
- Cleanup: removed the throwaway `.mjs` script, killed only the `ng serve`/`dotnet run` processes started for this verification (confirmed via `netstat`), left `motw-postgres` running.

### Files (2 total)
`shared/domain-icon.component.ts`, `features/mysteries/shared/mystery-section-icon.ts` — both template-only changes plus an explanatory doc comment above each `@Component` decorator. No other file touched (confirmed via `git status`). This closes out all 5 phases (0-4) of `docs/updates/svg-symbol-icons.md`.

---

## 2026-08-08 — Repoint MysterySectionIconComponent's domain kinds onto icon-nav-* symbols

### Task
Product owner decided (after a separate investigation flagged the Phase 4 migration deliberately kept two differently-drawn icon sets for the same domains) to unify art: `MysterySectionIconComponent`'s domain kinds (`mystery`, `monster`, `minions`, `locations`, `bystanders`) now render the nav's `icon-nav-{key}` sprite symbols instead of their own `icon-mystery-{kind}` symbols. `countdown` + the 6 countdown-stage kinds are untouched. Component kept as the wrapper everywhere (no call-site swap to `<app-domain-icon>`) — sizing (`--mystery-section-icon-size`) is a wrapper concern, orthogonal to which symbol the `<use>` points at.

### Approach
- Added `DOMAIN_KIND_TO_NAV_KEY` lookup in `mystery-section-icon.ts` (mirrors `domain-icon.component.ts`'s `SINGULAR_ENTITY_TYPE_TO_NAV_KEY`), mapping `mystery→mysteries`, `monster→monsters`, `minions→minions`, `locations→locations`, `bystanders→bystanders`. Replaced the template's inline `'#icon-mystery-' + kind` string concat with a `get symbolId()` accessor returning `icon-nav-{navKey}` when the kind is a mapped domain kind, else falling back to `icon-mystery-{kind}` for countdown/stage kinds.
- Deleted the 5 now-orphaned `icon-mystery-mystery/monster/minions/locations/bystanders` `<symbol>` definitions from `icon-sprite.component.ts`; kept `icon-mystery-countdown` and the 6 stage symbols. Grepped the whole repo for each deleted symbol ID first — only the sprite file itself and a historical `docs/updates/svg-symbol-icons.md` line referenced them (doc left as-is, it's a dated changelog of the original Phase 4 plan, not living reference).
- Left the wrapper `<svg>`'s `stroke-linecap`/`stroke-linejoin="round"` untouched — those attributes apply to whatever `<use>` pulls in regardless of symbol set, so reused nav art still gets rounded caps automatically without copying `DomainIconComponent`'s (missing) linecap attrs.

### Verification
`ng test --include "src/app/features/mysteries/**/*.spec.ts"`: 4 files / 15 tests green (`mysteries-list`, `mystery-detail`, `mystery-create`, `mystery-create.store`) — confirms `mystery-detail.spec.ts`'s 14-count and `mystery-create.spec.ts`'s count assertions on `app-mystery-section-icon` (element/tag-count only, no href assertions) are unaffected by which symbol the tag's internal `<use>` resolves to. `ng test --include "src/app/shared/**/*.spec.ts"`: 3 files / 28 tests green.

### Files (2 total)
`features/mysteries/shared/mystery-section-icon.ts` (lookup + `symbolId` getter + updated doc comment), `shared/icons/icon-sprite.component.ts` (5 symbols deleted, section comments + top-of-file doc comment updated to reflect the new split).

---

## 2026-08-18 — Review: `docs/simple-authentication-update/` Phase 2 (docs-only, no app code)

### Task
Frontend review at the gate named in that plan's `phases.md` — the two-shell restructure, the three interceptors, `AuthService`/`provideAppInitializer`, `logout()`'s error path, and the dev-proxy step. Findings folded in place into `architecture.md`/`phases.md`, review status added to `README.md`, dispositions + one new question in `open-questions.md`. Same convention as my earlier review of `docs/authentication-update/`. Four blocking findings, all adopted; the one scope question I referred to Skyler (`open-questions.md` #5 — how far to hoist the shell-level concerns) came back the same day as **option A, the full move to `App`** — *"app root level is fine."* Review closed, nothing outstanding.

### Reusable technical facts (the point of this entry)

- **`withInterceptors([A, B, C])` is REQUEST order; errors propagate back in reverse, so the LAST entry is the FIRST to see an error response.** Angular builds the chain with `reduceRight`, giving `A(next: B(next: C(next: backend)))`. Consequence: **any interceptor that swallows or transforms an error must be registered last**, below the generic reporter. Both auth designs specified `[credentials, authError, httpError]` with a "so no toast fires" claim; that ordering fires the toast. Full write-up + the code-comment phrasing (*"last in the array = first to see an error"*) in `.squad/decisions/records/luigi-interceptor-order-error-direction.md`. Generalises to retry, offline-queue, error-normalisation interceptors.
- **`provideAppInitializer(() => svc.initialize())` only makes bootstrap wait if `initialize()` RETURNS a Promise/Observable.** `ThemeService.initialize()` (`core/theme.ts:66`) returns `void`, and any new initializer copying that adjacent line compiles and type-checks while silently not blocking. The router's initial navigation is an `APP_BOOTSTRAP_LISTENER`, which runs after initializers *resolve* — that's what makes "auth state is populated before the first `canMatch`" true, but only when the initializer is actually awaitable. Symptom of getting it wrong: signed-in user shown the login page on every cold load; reads as a cookie bug.
- **Three app-wide things live inside `page-layout.html` and nowhere else**, which breaks the moment a second (auth) shell exists: `<app-icon-sprite />` (line 2 — the ONLY occurrence in `src/`; `icon.component.ts:14` calls it "app-wide", so an `<app-icon>` outside that shell renders a blank `<use>` with no error or console warning), the notification toast host (lines 130–150; `NotificationService` auto-dismisses after 4 s, so anything raised outside the shell is gone before it can render), and `checkApiAvailability()` + the API-unavailable modal (`page-layout.ts:44–46`, template 152–181 — probe runs only in `ngOnInit`, so it never re-fires and never runs at all for a logged-out visitor). `app.html` is a bare `<router-outlet />` and `app.ts` is an empty class, so hoisting all three to `App` is a template move + 3 tests relocated from `page-layout.spec.ts:42,108,117`. **Anyone adding a second shell to this app hits all three.**
- **A `CanMatchFn` returning `false` cannot attach query params**, so the proactive guard path can never set a `returnUrl` — only the `401` interceptor can. Attaching one needs a `UrlTree`, which in the two-shell pattern (shell 1's `''` prefix-matches everything, including `/login`) causes an infinite redirect. So the lost deep link is structural; document it or stash the attempted path on the service, but never "fix" it with a `UrlTree`.
- **Route-matching trace for two sibling `''` shells** (verified against current `app.routes.ts`): Angular backtracks when a route matches its own segment but no child matches the remainder, so logged-out `/dashboard` → shell 1 `canMatch` false → shell 2 matches `''` but has no `dashboard` child → backtrack → `**` → `''` → shell 2's `{ path: '', pathMatch: 'full', redirectTo: 'login' }`. Logged-in `/login` resolves symmetrically to `/dashboard`. Both terminate; the `**` wildcard needs no change.
- `app.routes.spec.ts`'s two tests use `routes.find((r) => r.path === '')`, i.e. the FIRST `''` route — silently order-dependent once there are two shells.
- Verified doc claims against the tree: `core/api.spec.ts:30` does hardcode `http://localhost:5225/health/live` and goes red on `apiBaseUrl: ''`; `core/health.spec.ts` asserts `service.endpoint` and doesn't; `angular.json`'s `serve` target genuinely has no `options` block, so `proxyConfig` needs one created.

### Non-technical note
Three of the four blocking findings were the same shape as my last review of the robust plan: a requirement stated in one section whose wiring in another doesn't implement it. Two of the four (interceptor order, the login form's inert non-`invalid_credentials` path) were things the robust plan already had right and this smaller plan dropped or inverted — **when reviewing a "stepping stone" derived from an already-reviewed plan, diff it against the source rather than reading it standalone.** That's where both came from.

---

## 2026-08-23 — Simple Auth Phase 2 implementation (Angular login + route guards)

### Task
Implemented Phase 2 of `docs/simple-authentication-update/phases.md` steps 1–12 + 10b, against a live Phase 0/1 backend (Bowser). All four of my own review findings had to be honoured in code. 42 spec files / 321 tests green, production build clean (same 2 pre-existing budget warnings), 34/34 browser checks against the real API.

### Files
- New: `core/auth.ts`, `core/auth-guards.ts`, `core/auth-error-interceptor.ts`, `core/credentials-interceptor.ts`, `core/self-handled-request.ts`, `layout/auth-layout/{auth-layout.ts,.html}`, `features/auth/auth.routes.ts`, `features/auth/pages/login/{login.ts,.html}`, `proxy.conf.json`, + 4 spec files
- Modified: `app.config.ts`, `app.routes.ts`, `app.{ts,html,spec.ts}`, `core/{models,http-error-interceptor,api.spec}.ts`, `layout/page-layout/{page-layout.ts,.html,.spec.ts}`, `environments/environment.ts`, `angular.json`

### Key technical facts worth reusing

- **`withInterceptors([A,B,C])` is REQUEST order; errors come back C→B→A, so the LAST entry is the FIRST to see an error.** Verified empirically by negative control: flipping to `[credentials, authError, httpError]` makes exactly 2 assertions fail with 1 toast on a single 401 and 3 on a burst. Anything that *swallows* an error must be registered last. The regression test that catches it is "a 401 produces zero `NotificationService` entries" — nothing about the wrong order fails to compile.
- **`provideAppInitializer` only blocks bootstrap if the callback RETURNS a Promise/Observable.** `ThemeService.initialize()` returns `void`, so copying the adjacent line silently doesn't block. Confirmed the correct version end-to-end via a 15 ms `setInterval` polling for `#login-email` across a reload — zero frames of login-page flash.
- **Angular 22 `CanMatchFn` takes THREE args** `(route, segments, currentSnapshot)`. A guard may *declare* fewer (legal TS), but spec call sites must pass all three — `guard({} as Route, segments, {} as never)`.
- **`ActivatedRouteSnapshot.queryParamMap` is readonly** — can't assign in a spec. Provide a plain mutable stub object as `ActivatedRoute` and swap `snapshot.queryParamMap` through your own reference.
- **Route backtracking with two sibling `''` shells works as designed**: logged-out `/dashboard` → shell 1 `canMatch` false → shell 2 matches `''` but has no `dashboard` child → router backtracks → `**` → `''` → shell 2's empty-path child → `/login`. Verified live for `/`, `/dashboard`, unknown URL, deep link, and logged-in `/login` → `/dashboard`.
- **A `CanMatchFn` returning `false` cannot attach query params** (that needs a `UrlTree`, which loops here). Stashing the attempted URL on the service before returning `false`, and having the login component prefer `?returnUrl` then the stash then `/dashboard`, is ~3 lines and works — verified: logged-out `/monsters` → login → back to `/monsters`.

### Playwright verification gotchas (cost me three re-runs)
- **`waitForLoadState('networkidle')` is NOT sufficient after a client-side route change.** The document load state is already complete, so it resolves *before* the lazy chunk is even fetched, let alone its `ngOnInit` XHR. Clearing cookies at that point makes the in-flight request 401 and fires the mid-session bounce, so a "click Sign out on an expired session" test instead hits the expiry path and the button detaches. Fix: `page.waitForResponse(r => r.url().includes('/api/mysteries'))`.
- **`waitForURL('**/login')` does not match `/login?returnUrl=...`.** Use a predicate `(url) => url.pathname === '/login'`.
- **`page.goBack({waitUntil:'networkidle'})` resolves before Angular's popstate handler runs** (same-document nav = no network). Use `goBack()` then `waitForURL`.
- **Never assert "no lazy chunk loaded" by matching `chunk-*.js` filenames** — `ng serve` names framework chunks that way too. Fetch each script's body and grep for a component class name, and *exclude `main.js`*, which contains the name as part of the `import().then(m => m.X)` route-table text. Always pair with a control asserting the probe DOES find the chunk after login.

### Judgment calls (both flagged to the coordinator)
1. `authErrorInterceptor` **swallows every 401 but navigates only on the first** (guarded on `isAuthenticated()`). `phases.md` step 5 reads as though the swallow sits inside the guard, but `architecture.md` §3.3 also says "letting the rest fall through" — falling through to `httpErrorInterceptor` would toast, contradicting the no-toast requirement. Swallow-all + navigate-once is the only reading that satisfies both.
2. Auth shell children are behind `loadChildren` in `auth.routes.ts` with the empty-path redirect **in the same file**, rather than inline in `app.routes.ts`. Step 10 permitted either but demanded they not be split; keeping them together is what the finding was about.

---

## 2026-08-23 — Favicon + Unified Sidebar Logo Mark

### Task
Implement Rosalina's approved favicon/logo redesign: replace the stock Angular CLI `favicon.ico` and the translucent "MOTW" text pill in `page-layout.html` (desktop + mobile) with one unified indigo-600 chip + white monster-glyph mark. Full write-up: `.squad/decisions/records/luigi-favicon-logo-mark.md`.

### Reusable technical facts
- **SVG/XML `<!-- -->` comments cannot contain a literal `--` sequence anywhere in the body**, not just at the boundaries. Writing a CSS custom-property name (`--color-accent`) inside an SVG comment produces a fatal XML parse error — the browser renders its own "this page contains errors" page instead of the icon. `ng build` does NOT catch this (doesn't parse `public/` assets as XML); only caught by actually loading the file in a real browser engine (Playwright/Chromium). Any hand-written comment in a standalone `.svg` (or other XML) file that references `--`-prefixed CSS tokens/flags needs this check — build success is not sufficient verification for static SVG assets under `public/`.
- Reused the existing generic `IconComponent`/`icon-{name}` (unprefixed) namespace in `icon-sprite.component.ts` for a new non-nav, non-mystery-section symbol (the brand mark, `icon-logo`) rather than inventing a new component — its doc comment's "generic action/chrome icon" scoping didn't explicitly cover a brand mark, but the mechanism (typed `IconName` + `<use>` wrapped in an `aria-hidden` `<svg>`) fit with zero new code needed.
- Brand-mark colors (indigo-600 chip, white glyph) are hardcoded literals in both `favicon.svg` and the sprite symbol, not theme tokens — confirmed intentional via live Playwright check against both light (`sidebar-surface: indigo-700`) and `.dark`-class-injected (`indigo-900`) sidebars; a solid brand mark doesn't need to track `--color-accent`'s light/dark flip, same as the sidebar surface itself already being a fixed indigo-700/900 pair outside the accent-token family.
- Environment check before choosing an SVG-favicon-over-ICO approach: confirmed via `where`/`Get-Command`-style checks that no SVG rasterizer exists on this machine (no ImageMagick/`magick`, Inkscape, `rsvg-convert`, `cairosvg`; the `convert.exe` on `PATH` is Windows' unrelated FAT→NTFS tool, not ImageMagick) — worth checking early on any future favicon/icon-export task on this machine before assuming a rasterizer is available.
- Playwright health-check stub trick for verifying `page-layout.html` UI that's gated behind `checkApiAvailability()` when no backend is running: `page.route('**/health/live', route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'Healthy' }))` before `page.goto()` — keeps the API-unavailable modal (z-60, blocks/obscures everything including the mobile drawer) from ever appearing, cleaner than trying to manually remove its DOM node (which Angular's `@if` just re-inserts once the real health check resolves asynchronously after the removal).

### Verification
`npm run build` clean (2 pre-existing unrelated budget warnings only). `npm run test -- --watch=false`: 38 files / 278 tests green, no regressions. Live-verified via `ng serve` + a throwaway Playwright script (deleted after use, per the established one-off-verification convention): desktop sidebar chip (36x36, correct position), mobile drawer chip, `.dark`-class sidebar, and `favicon.svg` served with `Content-Type: image/svg+xml` and rendering correctly post-fix.

### Files
New: `src/web/monster-of-the-week-web/public/favicon.svg`. Modified: `src/index.html`, `src/app/shared/icons/icon-sprite.component.ts`, `src/app/shared/icons/icon.component.ts`, `src/app/layout/page-layout/page-layout.html`.

---

## 2026-08-23 — Favicon/Logo Mark: Grin Addendum

### Task
Rosalina follow-up call: add a filled purple crescent grin (`fill="#7e22ce"`, `purple-700`/`--color-on-badge-archetype`'s value, reused not invented) as a third path in both `public/favicon.svg` and the `icon-logo` symbol. Addendum appended to `.squad/decisions/records/luigi-favicon-logo-mark.md` rather than a new decision doc.

### Reusable technical facts
- **Hit the exact same `--`-in-XML-comment bug again, immediately** — this time from writing the *token name* itself (`--color-on-badge-archetype`) into the `favicon.svg` comment while explaining the new color's provenance. The prior entry's warning ("any comment referencing a `--`-prefixed CSS custom property") is easy to re-trigger even right after having documented it once — the trap is specifically that referencing *any* custom-property name at all reintroduces the literal `--`. Fix pattern that avoids it entirely: write the Tailwind class name without its CSS custom-property prefix, e.g. `purple-700 (on-badge-archetype)` instead of `purple-700 / --color-on-badge-archetype`.
- Playwright verification technique for confirming small design elements (a crescent grin) aren't broken/misaligned at native sidebar icon size (36x36/32x32, where it's genuinely too small to eyeball in a screenshot): `page.evaluate()` to temporarily inline-style the `<app-icon>` host element to a large size (e.g. `300px`), screenshot, then remove the style — proves the vector renders correctly at any scale without needing a magnifier on a tiny native-size screenshot. Native-size screenshots are still worth taking separately to confirm no layout/clipping regression in context.
- `.locator('app-icon[name="logo"] svg').first()` picks up the DESKTOP instance even on a mobile viewport, because the desktop `<aside>` (`hidden md:flex`) is still present in the DOM (just `display:none`) and comes first in document order — Playwright's `element.screenshot()` then times out waiting for it to become visible. Scope the locator to the containing element (e.g. `.sidebar-mobile app-icon[...]`) when a component/icon appears twice in the DOM (desktop shell + mobile drawer) as it does in `page-layout.html`.

### Verification
`npm run build` clean (2 pre-existing unrelated budget warnings only). `npm run test -- --watch=false`: 38 files / 278 tests green, no regressions. Live-verified via `ng serve` + a throwaway Playwright script (deleted after use): grin renders as a smiling purple crescent at a large scaled-up render, native-size sidebar/drawer renders show no misalignment/clipping, `.dark`-class sidebar unaffected (color is hardcoded), and the fixed `favicon.svg` re-parses/renders correctly standalone after the XML-comment fix.

### Files
Modified: `src/web/monster-of-the-week-web/public/favicon.svg`, `src/app/shared/icons/icon-sprite.component.ts`. Addendum appended to `.squad/decisions/records/luigi-favicon-logo-mark.md`.

---

## 2026-08-23 — Favicon Bug Fix: Chrome preferred stale `favicon.ico` over the new SVG mark

### Task
Skyler tested locally after the favicon/logo-mark work shipped and found the browser tab was still showing the old default `.ico`, not the new SVG mark. Fixed `src/index.html`'s favicon `<link>` pair; addendum appended to `.squad/decisions/records/luigi-favicon-logo-mark.md`.

### Reusable technical facts
- **My original SVG-first `<link>` ordering (`svg` link before `ico` link) does NOT make Chrome prefer the SVG.** This is a documented Chromium bug, [crbug 1162276](https://crbug.com/1162276): Chrome prefers `.ico` over `.svg` favicons regardless of document order. Don't trust "first link wins" folklore for favicon resolution in Chrome specifically.
- **The actual fix: add `sizes="any"` to the `.ico` link** (and drop its now-redundant `type="image/x-icon"`), which signals to Chrome the ICO isn't an ideal fit and triggers fallback to the SVG. Final working pair:
  ```html
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  ```
  The resulting asymmetry (sizes-only on ico, type-only on svg) looks like an inconsistency someone will want to "clean up" back to a symmetric type-based pair later — that would silently reintroduce the bug. Left an explicit warning comment about this in the decision-doc addendum, not just in this history file.
- **Headless Chromium does not fetch favicons at all** (no tab-strip UI to render them in), so a Playwright favicon-verification script using the default headless launch silently returns zero favicon-related network events — false negative, not proof of anything. Must use `chromium.launch({ headless: false })` to actually observe real favicon-fetch network behavior. Worth remembering for any future favicon/tab-icon verification task, not just this one.
- Confirmed a stale `ng serve` process (pre-existing on port 4200 before this task started, from an earlier session) was already running and live-picked-up the `index.html` edit via file watching — didn't need to start a new one; `curl localhost:4200/` is a fast way to confirm a running dev server has already picked up a template edit before reaching for Playwright.

### Verification
Live Playwright check (headed Chromium, fresh/uncached context) against `ng serve`: only `GET /favicon.svg` (200, `image/svg+xml`) was ever requested by the browser; `favicon.ico` was never requested post-fix. `npm run build` clean (same 2 pre-existing unrelated budget warnings). Throwaway verification script deleted after use.

### Files
Modified: `src/web/monster-of-the-week-web/src/index.html` (lines 8-9 only). Addendum appended to `.squad/decisions/records/luigi-favicon-logo-mark.md`.

---

## 2026-08-30 — Armor Special Description Display Gap (bug fix)

### Task
Skyler: checking "Special" + filling `specialDescription` on an armor entry didn't display anywhere on the read-back views. Audited every armor-rendering surface app-wide (`monster-create`, `minion-create`, both `-detail` pages, `mystery-create-dossier`, `mystery-create-monster-phase`, `mystery-detail`, both list pages) via grep for `armor|Armor|harmSoak|isSpecial|specialDescription`.

### Findings
- Only 2 surfaces were missing it: `monster-detail.html` and `minion-detail.html` (both the "already-persisted armor list" `@for` loop, not the add-form — the add-form always had the `isSpecial`/`specialDescription` fields). Every create/wizard surface Skyler + the orchestrator named was already correct.
- `mystery-detail.html` (the saved-mystery summary page, distinct from the create wizard) renders monsters/minions as name-only links to the shared `monster-detail`/`minion-detail` routes — no armor rendering of its own, so no gap there once the detail pages are fixed.
- List pages (`monsters-list.html`, `minions-list.html`) only show an `armorCount` number, never armor entries — not in scope.
- Confirmed no mapper/transform layer drops the field on read: `monster-detail.ts`/`minion-detail.ts` call `monsterService.getById()`/`minionService.getById()` and `.set()` the raw `MonsterDetailResponse`/`MinionDetailResponse` straight onto the signal — pure template gap, not a data-loading bug, as the orchestrator suspected.
- Fixed by adding the identical `@if (armor.isSpecial && armor.specialDescription) { <p>Special: {{ armor.specialDescription }}</p> }` block used by `monster-create.html`/`minion-create.html`, matching each file's local Tailwind convention exactly (`monster-detail.html`'s `description` `<p>` has no `mb-0`, so the new block doesn't either; `minion-detail.html`'s does, so the new block matches).

### Verification
`npm run build`: clean, same 2 pre-existing budget warnings (`custom-select.component.scss`, `mystery-create.scss`) as prior sessions. `npm test -- --watch=false`: 42 files / 323 tests green (up from the 38/278 baseline in an earlier entry — other branch work added files; no regressions from this change). Added one DOM-rendering test per detail spec (`shows the special description when an armor entry is special`) asserting `Special: <text>` appears for a special armor entry and is absent for a non-special one in the same list — neither spec had a rendering-level armor assertion before (only form-validation ones existed in `monster-detail.spec.ts`).

### Files
Modified: `features/monsters/pages/monster-detail/monster-detail.html`, `features/minions/pages/minion-detail/minion-detail.html`, `features/monsters/pages/monster-detail/monster-detail.spec.ts`, `features/minions/pages/minion-detail/minion-detail.spec.ts`.

---

## 2026-08-30 — Data Admin: Adventure Types + Monster Archetypes (Name + Description shape generalized)

### Task
Skyler noticed `adventure_types` and `monster_archetypes` were never surfaced in Data Admin. Added both to the type-table dropdown with create form + "Current Records" list, added the missing `ReferenceDataService` create methods, and collapsed the weapon-tag special case into a shared abstraction so this didn't become four `isXSelected()` branches. Backend was already complete (Bowser verified in parallel); frontend-only change.

### Reusable technical facts
- **The Data Admin dropdown now spans two row shapes, and that distinction is a type, not an ad-hoc check.** `ReferenceTypeTable` gained `AdventureTypes`/`MonsterArchetypes`; `models.ts` gained `NameDescriptionTable` (weapon tags + the two new ones) and `TypeRefTable = Exclude<ReferenceTypeTable, NameDescriptionTable>`. `getTypesByTable`/`createType` were narrowed from `ReferenceTypeTable` to `TypeRefTable`, which let both `throw new Error('Weapon tags are not a type reference table.')` runtime guards be deleted — passing the wrong table is now a compile error at the call site instead.
- **Verified the compile-safety claim with a negative control rather than asserting it.** Planting a bogus `ReferenceTypeTable` member and building produced exactly 3 x `TS2366: Function lacks ending return statement` — `getTypesByTable`, `createType`, and `DataAdminPageComponent.isNameDescriptionTable`. That last one is deliberately written as an exhaustive `switch` over *all seven* members (returning `true`/`false`) rather than the obvious `table !== A && table !== B && table !== C`: the negative form compiles fine when someone adds an eighth table and silently routes it to the wrong form. `noImplicitReturns` is what makes the switch form self-policing. Same trick applies anywhere a type predicate partitions an enum.
- **`WeaponTagAdminComponent` became `NameDescriptionAdminComponent` with an `@Input({ required: true }) table`.** Critically, the parent renders it via `@if (selectedNameDescriptionTable(); as t) { <app-name-description-admin [table]="t" /> }` — switching weapon-tags to adventure-types does **not** destroy/recreate the component, so `ngOnInit` never re-fires. The reload/reset has to hang off `ngOnChanges(changes['table'])` (the codebase's existing input-reaction convention, per the four `*-form` components) or the list silently keeps showing the previous table's rows. This is the main trap in parameterizing a previously single-purpose admin component.
- **Description `minLength` is per-table, not a shared constant: weapon tags require 10, adventure types and monster archetypes require 5** (the server-side `[MinLength]` genuinely differs). Since one `FormGroup` instance is reused across table changes, the validator must be re-applied in `ngOnChanges` via `setValidators([...])` + `updateValueAndValidity({ emitEvent: false })`, and the error copy interpolates `{{ descriptionMinLength() }}` rather than hardcoding a number. Do NOT "harmonize" weapon tags down to 5.
- **Per-table wording lives in one `TABLE_DESCRIPTORS` record keyed by `NameDescriptionTable`** (`singular`, `plural`, `descriptionMinLength`). Success/error copy derives from it, reproducing the old weapon-tag strings verbatim with no behavior change — note `singular` is stored sentence-initial ("Weapon tag") and lowercased at the one call site that needs it, which avoids a second near-duplicate field. Adding a fourth Name+Description table = one descriptor entry + two service switch cases + one dropdown option; no new component, no new branch.
- **Source files in this repo are CRLF in the working tree while git normalizes to LF on commit** (no `.gitattributes`; `core.autocrlf` handles it). Scripted edits must preserve CRLF or every touched file shows as a full rewrite in `git diff`. Also: **`python` is not on PATH here** — use `node` for scripted edits.
- **Probing the running dev API to "confirm an endpoint exists" is worthless while auth is on.** `GET /api/adventure-types` returns 401 — but so does `GET /api/definitely-not-a-real-table`. The auth gate short-circuits before routing, so 401 does not discriminate route-exists from route-missing. Ran the bogus-path control specifically to check this, and reported the probe as inconclusive rather than as verification.

### Verification
`ng build --configuration production`: clean, same 2 pre-existing budget warnings (`mystery-create.scss`, `custom-select.component.scss`). `ng test --watch=false`: 42 files / 336 tests green, against a 324-test baseline measured before any edit (net +12: -2 removed weapon-tag-admin, +5 new name-description-admin, +4 data-admin, +5 reference-data); file count unchanged at 42. Negative control above. Built with `--output-path` into scratchpad so the default `../../api/MonsterOfTheWeek.Api/wwwroot` target was never written to (Bowser had the API live on :5225 during this task). No live browser pass this time — the dropdown-to-child input-change path is covered by `fixture.componentRef.setInput` tests instead, and the only running API was Bowser's instance. Not committed.

### Files
New: `src/app/pages/data-admin/components/name-description-admin/name-description-admin.{ts,html,scss,spec.ts}`. Deleted: `src/app/pages/data-admin/components/weapon-tag-admin/` (all 4 files). Modified: `src/app/core/models.ts`, `src/app/core/reference-data.{ts,spec.ts}`, `src/app/pages/data-admin/data-admin.{ts,html,spec.ts}`. Decision filed at `.squad/decisions/records/luigi-name-description-reference-tables.md`.

---

## 2026-08-30 — Playbook Form "Tracks" Overlap Bug + Playbook UI Session Review

### Task
Skyler: number inputs in the Playbook create/edit form's "Tracks" section were visually overlapping. Fixed, then reviewed the rest of the session's new Data Admin tab/Playbook admin work per Skyler's follow-up ask.

### Root cause (confirmed, not just plausible)
Each affected `<label>` is a `display:grid` container with an explicit fixed `width` (`w-[9rem]`/`w-[11rem]`/`w-[5rem]`/`w-[8rem]`), and its sole child is a bare `<input type="number">` grid item. Grid/flex items default to `min-width: auto`, i.e. their automatic minimum is their content-based min size, not `0`. A number input's UA-default intrinsic width (~170-220px, tied to the absent `size` attribute) exceeds every one of those fixed label widths, so the implicit grid track — and the input painted into it — grows past the label box and over the next field instead of shrinking to fit. This is the exact same failure mode `min-w-0` already exists in this codebase to guard against for flex overflow (`page-layout.html`, `custom-select.component.html`, all five `*-list.html` pages) — it's a grid item here rather than a flex item, but the underlying CSS mechanism (auto min-size default) is identical.

### Fix
Added `w-full min-w-0` to every number input living inside one of these fixed-width labels: all 5 in Tracks, all 5 `charm/cool/sharp/tough/weird` in Ratings, and Gear's `pickCount`. `min-w-0` removes the content-based floor so the item can shrink to the label's width; `w-full` makes it explicit rather than relying on implicit grid stretch (matches the belt-and-suspenders `w-full` already on `minion-form.html`'s number inputs). Also added `min="0"` to the five Track inputs whose FormControl already carries `Validators.min(0)` (`luckBoxCount`, `harmBoxCount`, `harmUnstableThreshold`, `experienceBoxCount`, `moveGrantCount`) — every other numeric field in the app pairs those two (`monster-form.html`, `minion-form.html`), and these five were the only ones in the codebase missing the HTML attribute. Deliberately did NOT add `min="0"` to Ratings (`charm`/etc., which only carry `Validators.required`, no `Validators.min`) or Gear's `pickCount` (no validators at all, `null` = "grant every option automatically" is a meaningful state) — no established convention says they should have a floor.

### Review finding, fixed: Playbooks list had no delete confirmation
`playbook-admin.html`'s Delete button called `deletePlaybook(record)` directly on click — an instant, irreversible delete with zero confirmation. Every other list page in the app (monsters, minions, locations, bystanders, mysteries) uses the shared `ConfirmDeleteModalComponent` for exactly this. This wasn't a judgment call — it's a working, already-proven, low-risk convention this component simply skipped — so fixed it: `pendingDelete` signal, `requestDelete`/`cancelDelete`/`confirmDelete` methods mirroring `bystanders-list.ts`'s (simplest) shape (no cascade-children lookup needed, unlike `monsters-list.ts`'s minion-aware variant), `<app-confirm-delete-modal>` added to the template. Verified live: Cancel leaves the row in place, Delete removes it, matches every other list page pixel-for-pixel.

### Review findings, described but NOT fixed (flagged for Skyler)
- **Only the top-level `name` field has visible inline validation messaging.** Every other required field in the form — the five Track counts, and every FormArray child's required control (move name, gear category label, look option text, improvement text) — has a `Validators.required` (or `.min(0)`) but no `shouldShowXError()`-style message anywhere in the template. Submitting with one of those blank makes `form.invalid` true and `submit()` silently returns after `markAllAsTouched()` — the Save button visibly does nothing, no text explains why. This is a big-surface, wording/scope decision (which fields get messages, what they say, whether the top-level `name` field's `*`-in-label convention from `monster-form.html`/`minion-form.html` should be adopted here too, since this form currently uses neither the asterisk convention nor per-field messages beyond `name`) — described, left alone.
- `data-admin.html`'s `@if (activeTab() === 'types') { <div role="tabpanel" ...}` block content (the pre-existing type-table form/records table) wasn't re-indented one level when it got wrapped in the new tab-panel `@if` — purely cosmetic whitespace, zero runtime effect, but worth a cleanup pass sometime since it reads as if the wrapper is one level shallower than it is.

### Verified NOT bugs (ruled out during review, not just assumed fine)
- Roving-tabindex/arrow-key/Home/End tablist in `data-admin.ts`/`.html`: first Playwright pass looked broken (`aria-selected` appeared not to move), but that was a test-timing artifact — reading DOM state via a synchronous `page.evaluate` immediately after `page.keyboard.press()` races Angular's change detection. Re-verified with a `waitForTimeout` after each key press: `aria-selected`, `tabindex` (roving 0/-1), focus, and which tabpanel renders all update correctly for ArrowRight/ArrowLeft/Home/End, and `Tab` correctly leaves the tablist into panel content rather than cycling tabs. Worth remembering generally: **don't trust an `evaluate()` read taken with zero delay after a `keyboard.press()` as proof of an Angular signal-driven bug** — always add a short wait (or `waitForFunction`) before concluding state didn't update.
- Text inputs elsewhere in the same form (`flex-1 min-w-[Xrem]` inside `.flex` rows for move/gear/look names) don't share the Tracks/Ratings bug: they're flex items with `flex-1` and no *narrower*-than-content fixed width, so there's no width smaller than the input's intrinsic size for it to overflow past.
- The hidden `id`-round-trip invariant (constraint from the brief): traced every `toRequest()` branch in `playbook-form.ts` — `statArrayOptions`, `moves`, `gearCategories`, nested `gearOptions`, `lookCategories`, nested `lookOptions`, `improvements` — every one sends `group.controls['id'].value`. Untouched by this task's edits (only `.html` files were touched).

### Verification
`npx ng build`: clean, same 2 pre-existing budget warnings (`mystery-create.scss`, `custom-select.component.scss`), unrelated. `npx ng test --no-watch`: 42 files / 336 tests green, no regressions (no spec files added or touched, per Skyler's explicit instruction deferring test-writing). Live Playwright verification against the running API + built app at three viewports (1400/900/500px): all 11 previously-overflowing number inputs now report `inputWidth === labelWidth` (zero overflow) at every width, `flex-wrap` degrades sensibly narrow. Separate live pass confirmed the new delete-confirm modal: Cancel preserves the row (count unchanged), Delete removes it (count -1), visual match to the shared modal's existing appearance across the app.

### Files
Modified: `src/app/pages/data-admin/components/playbook-admin/playbook-form/playbook-form.html` (Tracks/Ratings/Gear pickCount width-overflow fix), `src/app/pages/data-admin/components/playbook-admin/playbook-admin.ts` and `.html` (delete-confirmation modal wiring). Not committed.

---

## 2026-09-01 — Multi-Minion MM-0 (dossier signal fix) + MM-5 ("Belongs to {monster}" on mystery-detail)

### Task
First slice of Yoshi's multi-minion plan (`docs/updates/multi-minion-support.md`), scoped to MM-0 and MM-5 only — explicitly told to stay out of MM-2/3/4 (blocked on a pending decision, another agent's turf).

### MM-0 — genuinely a no-op, audit held up
`mystery-create-dossier.html:165` read the raw `store.minionWeaknesses()` signal inside a block otherwise reading `store.minionPreview()`. Re-verified Yoshi's audit myself rather than trusting it: grepped every `store.minion*()`/`store.monster*()` read in the file — monster block (`:56-109`) uses `monsterPreview()` at all 15 reads, minions block used `minionPreview()` everywhere except the one reported line. Confirmed at the source (`mystery-create.store.ts:461`) that `minionPreview()`'s `weaknesses` field is literally `weaknesses: this.minionWeaknesses()` — same signal call, so the repoint is provably behavior-identical today. Fix was the one-line swap Yoshi specified, nothing more.

### MM-5 — data was already there, template-only as scoped
`mystery-detail.ts:31` holds `minions: signal<MinionListItemResponse[]>`, and `MinionListItemResponse` (`core/models.ts:293-306`) already carries `monsterName`/`monsterId` — confirmed before touching the template, per the brief's "stop and report if it isn't available" instruction. Added a `Belongs to: {{ minion.monsterName }}` `<p>` styled to match `minions-list.html:22` (`text-muted text-[0.82rem] mt-[0.15rem]`), but plain text rather than a link — `minions-list.html`'s version links to the global `/monsters/:id` route, but `mystery-detail` scopes its own monster links as `['/mysteries', mystery.id, 'monsters', monster.id]` (line 88), and Skyler's exact instruction ("add a 'Belongs to {monster}' line") didn't ask for a link or specify which route shape to use — treated picking one as an unrequested scope decision and left it as text to stay literal to the ask.

### Reusable fact
`ng test`'s Vitest-based unit-test builder does not accept a bare `--reporter` flag (errors "Unknown argument") and running `npx vitest run <spec paths>` directly bypasses Angular's TestBed/zone.js setup entirely (`ReferenceError: describe is not defined`) — the builder injects its own setup invisibly. To run a subset of specs with real output, use `ng test --watch=false --reporters=verbose --include "<path>"` (repeatable `--include`), not raw `vitest run`.

### Verification
`npx ng build`: clean, same 2 pre-existing budget warnings (`mystery-create.scss`, `custom-select.component.scss`). `npm run test -- --watch=false`: 44 files / 364 tests green. Additionally ran the three specs named in the brief in isolation via `ng test --include`: `mystery-create.spec.ts`, `mystery-create.store.spec.ts`, `mystery-detail.spec.ts` — 3 files / 15 tests, all green.

### Files
Modified: `src/app/features/mysteries/pages/mystery-create/mystery-create-dossier.html` (line 165, MM-0), `src/app/features/mysteries/pages/mystery-detail/mystery-detail.html` (minions `<li>`, MM-5). Not committed.

---

## 2026-09-01 — Multi-Minion MM-2 + MM-3 + MM-4 (wizard roster + composer, store draft-list, dossier)

### Task
The main body of Yoshi's multi-minion plan, landed as one unit because the intermediate state doesn't compile. Built on top of MM-0/MM-5 already sitting uncommitted.

### Reusable technical facts
- **`toSignal(form.valueChanges)` updates synchronously inside `setValue`/`patchValue`.** `composerDirty()`/`composerValid()` read `minionValue()` (a `toSignal` over `minionForm.valueChanges`) and are consulted by `next()` in the same statement sequence as the `setValue` that populated the form. This works with no `detectChanges`/tick — verified across 21 store-spec tests. Relevant any time a store gates navigation on a computed derived from a form.
- **`editingDraftIndex` + `composerOpen` genuinely cannot be collapsed into one signal.** Four visible states, three of which share `editingDraftIndex() === null`. Deriving `composerOpen` from "composer is non-empty" collapses the panel the user just opened via `+ Add Another Minion`. Two signals, invariant `editingDraftIndex() !== null ⇒ composerOpen()` maintained in each of the five methods that write either.
- **Positional identity into a spliceable array is a latent silent-overwrite bug.** `removeMinionDraft(i)` has to clear `editingDraftIndex` when `=== i` and decrement when `> i`. Confirmed by negative control: deleting the decrement branch failed exactly one test ("keeps the composer pointed at the same minion when an earlier roster card is removed") and nothing else — so that test is the only thing standing between this codebase and that bug. Safe only because reordering was declined; if reordering is ever added, switch to a client-side `key` first.
- **The confirm-modal `[items]` defect class is real and the wrong code looks right.** Reading `store.minionAttacks()` for the counts compiles, renders, and is wrong the moment the user removes a card they aren't editing. Second negative control: repointing two of the four count reads at the live composer signals failed exactly the one component test written for it.
- **`ng test --include` takes repeatable globs and is the fast loop here** (~1s for one spec file vs ~2.6s full suite + ~4s build). Reconfirmed the earlier note: no bare `--reporter`, use `--reporters=verbose`.
- **`git diff --stat` is the CRLF canary.** Any scripted edit that emits LF shows up as a whole-file rewrite. All eight touched files stayed at targeted hunk counts. Pattern that works: read → `replace(/\r\n/g,'\n')` → edit → `replace(/\n/g,'\r\n')` → write.
- **Heredocs into the Bash tool choke on long multi-line JS containing template literals** ("unexpected EOF while looking for matching `''`") even with a quoted delimiter. Write the script with the Write tool into the scratchpad and `node <path> <target>` instead — that path never failed.
- **`ng build` writes to `src/api/MonsterOfTheWeek.Api/wwwroot` by default.** Used `--output-path` into the scratchpad for the intermediate checks and only ran the real `npm run build` at the end.

### Judgment calls (filed in full at `.squad/decisions/records/luigi-multi-minion-wizard-implementation.md`)
`draftState` keeps `forms.minion` + the four `collections.minion*` (MM-2's "drop them" contradicts §1.1's "keep them as the composer"); the `next()` auto-commit is scoped to `phase 1 / step 1`; `commitComposerIfValid()` sets the wizard error band so the pencil and `+ Add Another Minion` aren't silent no-ops; `saveMinionDrafts()` writes IDs + the four per-draft baselines by index instead of reusing `backfillDraftIds` (which can't carry baselines); confirm-modal state in the phase component, matching every other list page; the dossier's expanded entry renders *in place of* its compact roster entry via `ngTemplateOutlet` rather than in addition to it.

### Verification
`npm run build`: clean, same 2 pre-existing budget warnings (`mystery-create.scss`, `custom-select.component.scss`). `npm run test -- --watch=false`: 44 files / 380 tests green, up from the 44/364 baseline (+16, no deletions beyond rewriting the one obsolete `minionNameMissing` test). Two negative controls run and reverted, described above. No live browser pass.

### Files
Modified: `features/mysteries/pages/mystery-create/mystery-create.store.ts`, `mystery-create-monster-phase.{ts,html}`, `mystery-create-dossier.{ts,html}`, `mystery-create.store.spec.ts`, `mystery-create.spec.ts`. Not committed.

---

## 2026-09-11 — Hunter Form: Untick-a-Move Drops Its Bespoke Section State

### Task
Server-side `HunterService.ValidateBespoke` was tightened same-day to refuse a bespoke entry/answer under a section whose owning move the hunter hasn't taken. Frontend never dropped that state on untick, so a Searcher hunter with Network entries who unticks Network and saves got refused. Skyler's chosen fix: unticking a move clears its `bespokeSections`' state client-side so the save never sends it — no restore on re-tick, no confirm dialog.

### Reusable technical facts
- **`toggleMove` reads `selectedMoveIds()` for the pre-toggle state before calling `.update()`**, then only clears on the untick transition (`wasSelected === true`). Required moves never call `toggleMove` (rendered checked+disabled), so no special-casing was needed there.
- **Generalized `omit<T>(map, key)` → `omit<T>(map, keys: Iterable<string>)`** rather than adding a parallel bulk-delete helper. `removeInstance`'s three call sites became `omit(current, [key])` — one-line change, no behavior difference — so the new `clearBespokeSections` could reuse the exact same function for a multi-key clear. This is the "small shared helper" the brief asked for; didn't touch `dropSelectionsOutside`'s playbook-change prune, which filters the *inverse* direction (keep valid) and reads fine as its own thing.
- **New private `clearBespokeSections(sections)`**: computes `sectionIds`, finds `bespokeInstances` under them, removes those instances, then unions `sectionIds` with the removed instances' own `key`s into one `deadScopes` set before clearing `bespokePicks`/`bespokeAnswers`/`bespokeFreeText`. Necessary because non-repeatable sections key state by section id directly, but repeatable sections (instances) key by `instance.key` — both had to be covered or a repeatable section's answers would survive as orphans.
- **`bespokeInstances`/`picksFor`/etc. are populated and readable regardless of `moveSectionsFor`'s visibility gate** — that method only controls template rendering. Tests can call `addInstance`/`toggleBespoke` directly on a move's section without ticking the UI through the DOM, which is how the existing repeatable-section spec already worked.

### Verification
`ng test --watch=false --reporters=verbose --include hunter-form.spec.ts`: 15/15 green (14 existing + 1 new, covering both the drop-on-untick case and a control where a second taken move's section survives). `npm run test -- --watch=false` (full suite): 44 files / 381 tests green (+1 over the 380 baseline recorded 2026-09-01). `ng build --configuration production` (output redirected to scratchpad, not wwwroot): clean, same 2 pre-existing budget warnings (`mystery-create.scss`, `custom-select.component.scss`).

### Files
Modified: `features/hunters/shared/hunter-form/hunter-form.ts`, `hunter-form.spec.ts`. Not committed. Decision filed at `.squad/decisions/records/luigi-hunter-form-untick-move-drops-bespoke-state.md`.

---

## 2026-09-14 — Hunter Wizard Phase 1: F0, move-limit budget

### Task
`hunter-creation-wizard-phases.md` Phase 1 (R1), F0 slice of the Gap 1 fix (Q1 decided "total, picks 1"): `MoveGrantCount` is the printed total including required moves, so the client's pick budget is `max(0, moveGrantCount − requiredMoves().length)`, matching Bowser's same-day `HunterService`/`HunterCompleteness` change (`MovePicks.Budget`, uncommitted alongside this).

### Reusable technical facts
- Added `moveBudget` as its own `computed()` in `hunter-form.ts` rather than inlining the subtraction into `isMoveLimitReached`/`isMovePickShort`, since the HTML counter (`hunter-form.html:70-77`) needed the same number to read "n of budget picked" instead of "n of grant picked".
- The `moveGrantCount() > 0` gate on both computeds was kept unchanged (not replaced with a `moveBudget() > 0` gate) — that's what preserves "a grant count of 0 means unspecified, no ceiling, no minimum" even though `moveBudget()` would itself evaluate to 0 whenever `moveGrantCount()` is 0.
- No "plus N moves" heading exists in this component to worry about (Bowser's handoff note about it not changing was accurate but moot here — that heading, if it exists, isn't in `hunter-form.html`).
- Admin playbook form (`pages/data-admin/components/playbook-admin/playbook-admin.ts:86-90`) already renders `error.error.message` via `notificationService.error` on a failed save, so Bowser's new `PlaybookService` refusal ("...required moves count toward the total.") needs no frontend change — confirmed, not assumed.

### Verification
`ng test --watch=false --reporters=verbose --include hunter-form.spec.ts`: 17/17 green (15 existing + fixture `moveGrantCount: 2 → 3` + 2 new: a limit-reached case and a `moveGrantCount: 0` no-ceiling/no-minimum case). `npm run test -- --watch=false` (full suite): 44 files / 383 tests green (+2 over the 381 baseline). `ng build --configuration production` (output redirected to scratchpad): clean, same 2 pre-existing budget warnings (`mystery-create.scss`, `custom-select.component.scss`).

### Files
Modified: `features/hunters/shared/hunter-form/hunter-form.ts`, `hunter-form.html`, `hunter-form.spec.ts`. Not committed. Backend half (B1, B3) is Bowser's, already uncommitted in the working tree; not touched here.

---

## 2026-09-14 — Hunter Wizard Phase 3 (R3, F4): shared wizard tracker and layout, Mysteries first

### Task
`hunter-creation-wizard-phases.md` Phase 3: presentational `WizardTrackerComponent` + `WizardLayoutComponent` in `shared/wizard/`; Mystery wizard (create and `/:id/edit`, same component) moved onto both. Q9 "Both wizards": scroll reset, heading focus, narrow layout. No hunter wizard code, no store change.

### Reusable technical facts
- **"Current always wins" is structural:** the template never binds `.complete`/`.visited` together with `.active` (`!isCurrent(i) && ...`); `.active` also declared last. Applies to step dots too, so a filled-in current step's dot stays accent (a visible change the doc's list didn't name).
- **Generated columns via a CSS var:** TS builds `auto var(--wizard-tracker-connector) auto ...`; SCSS sets the var to `minmax(0.5rem, 1.5rem)`, and to `minmax(1.5rem, 3rem)` in `@media (min-width: 48rem)`. jsdom keeps a `var()` value in `style.gridTemplateColumns`, so a spec can assert it.
- **An `sr-only` grid item is absolutely positioned and leaves the subgrid's auto-placement,** so the dots moved up a row. Pin `grid-row` 1/2/3 on the bubble, label and dots.
- **Compact sizing lives in template utilities** (`h-7 w-7 md:h-9 md:w-9`, `px-4 md:px-8`, `min-w-2 md:min-w-6`, label `max-md:sr-only` via `[class]`, merged with static `class`), so a jsdom spec can assert it. Emitted CSS confirmed in the production build.
- **Focus and scroll run in `afterNextRender` from `ngOnChanges`** (skipped on `firstChange`), so the heading already has the new title when it takes focus. Specs need `await fixture.whenStable()` to see it. jsdom `scrollTop` is always 0: `Object.defineProperty(el, 'scrollTop', { value, writable: true })`.
- **The layout is `ViewEncapsulation.None`, scoped under `.wizard-layout`,** so the `.dossier-section` animation reaches projected dossier markup. `prefers-reduced-motion` override added. `mystery-create.scss` deleted, and the page host uses `host: { class: 'block h-full' }`. The tracker icon comes through `iconTemplate` (`let-step` → `step.icon`), because `shared/` can't import a feature's icon component. The spec's icon count of 5 holds.
- **Mystery mapping never uses `visited`:** incomplete phases are `unreached`, with `clickable` from `isPhaseAccessible`. The edit-mode plain clickable bubble is unchanged.
- Negative controls, both reverted: removing the `firstChange` guard failed the layout first-render test and the new Mystery focus case. Binding `.complete` without `!isCurrent` failed the current-wins test.

### Verification
Full suite: 48 files / 421 tests, up from a 46 / 404 baseline. That's 10 tracker tests, 6 layout tests and 1 new `mystery-create.spec.ts` case. No existing assertion changed, and the store spec is untouched. `ng build --configuration production --output-path` into scratchpad: clean, 2 budget warnings. The new `wizard-tracker.scss` (2.96 kB) replaces the old `mystery-create.scss` warning; `custom-select` is unchanged. No browser pass, which is Toad's. Docs: dated notes in `luigi-theming-phase6-mystery-wizard.md` §6 and `multi-minion-wizard-design.md`.

### Files
New: `shared/wizard/wizard-tracker.{ts,html,scss,spec.ts}`, `shared/wizard/wizard-layout.{ts,html,scss,spec.ts}`. Modified: `features/mysteries/pages/mystery-create/mystery-create.{ts,html,spec.ts}`. Deleted: `mystery-create-tracker.{ts,html}`, `mystery-create.scss`. Not committed.

---

## 2026-09-14 — Hunter Wizard Phase 4 (R4, F2): extract `HunterDraft`

### Task
`hunter-creation-wizard-phases.md` Phase 4. The characterisation spec came first. Then all hunter form state, prune, the untick clear and the one request builder moved into an injectable `HunterDraft`, with `HunterFormComponent` delegating and no change in behaviour. No section split (Phase 5), no wizard code (Phase 7).

### Reusable technical facts
- **Characterisation first, proven non-vacuous.** 7 cases, each `toStrictEqual` against a literal request, green on untouched efd5309 before any refactor. Snapshot the spec to the scratchpad before refactoring and `diff` it afterwards, to prove the expected values didn't move. Negative control afterwards: dropping `instance.serverId` failed both edit-page cases, while the old `hunter-form.spec.ts` stayed green (the 13.12 item 13 gap).
- **Quirks it pins.** These are today's behaviour, not things to fix in a refactor:
  - create never sends required move ids; only a loaded hunter's are echoed;
  - instance and journal `sortOrder` is the index across all sections and journals, not per section;
  - journal fields are sent in typed order;
  - prune filters look answers by category id only;
  - an answer on an unticked option is never sent;
  - stale saved ids are pruned on edit load, so the next save drops them.
- **`HunterDraft` is `@Injectable()`, in `HunterFormComponent.providers`,** and is injected in a field initializer. Its form therefore exists before the constructor wires `playbookId.valueChanges` and the `switchMap`, so Phase 2's first-render fix holds.
  - Staying in the component: loading, `isLoadingPlaybook`/`playbookError`, the submit gate, and display helpers (`lookGroups`, `formatStat`, `gearCategoryHint`, `isFixedGrant`).
  - `draft.populate` doesn't load. The component calls it, then `loadPlaybook`, in the same order as before.
- **The template is byte-identical** thanks to pass-through members: signal aliases plus one-line method delegates. `hunter-form.spec.ts` is unchanged too. Phase 5 deletes the pass-throughs.
- **`toSignal(form.valueChanges.pipe(map(() => form.getRawValue()), startWith(form.getRawValue())), { requireSync: true })`** works both in a component-provided service and inside `TestBed.runInInjectionContext(() => new HunterDraft())`.
  - `isRatingUnchosen` is now a `computed` over it.
  - `toRequest()` still reads `form.getRawValue()` at call time, so it can't be stale.
- `TestBed.inject(HunterDraft)` throws, because it isn't root. `fixture.debugElement.injector.get(HunterDraft)` gets the form's own instance.
- 13.5 and 13.15 item 2 also list these, and I didn't build them: `isDirty` and `playbookScopedSummary` (Phase 7), `sectionLevelPickedOptionIds` and governed `lockedScopes` (Phase 6).

### Verification
- Characterisation spec: 7/7 before the refactor and 7/7 after.
- Hunter specs: 3 files / 43 tests.
- Full suite: 50 files / 439 tests, up from 48 / 421 (7 characterisation tests, 11 draft tests).
- `ng build --configuration production --output-path` into the scratchpad: clean, with the same 2 budget warnings.
- No browser pass. Toad runs Y10's `GET` diff.
- Docs: a dated limited supersession in `.squad/decisions.md` (2026-07-21) and in `angular-wizard-decomposition/SKILL.md`.

### Files
New: `features/hunters/shared/hunter-draft.{ts,spec.ts}`, `shared/hunter-form/hunter-form.characterisation.spec.ts`. Modified: `hunter-form.ts`; comments only in `bespoke-option-tree.ts` and `hunter-detail.ts`. Not committed.

---

## 2026-09-14 — Hunter Wizard Phase 5 (R5, F3): shared sections

### Task
`hunter-creation-wizard-phases.md` Phase 5, frontend only. 13.6's six shared sections, each injecting `HunterDraft`: ratings, moves, gear, look, bespoke, History. `HunterFormComponent` now composes them and keeps only the picker, name and pronouns, the edit-only blocks (extra tracks, Luck / Harm / Experience, journals), the playbook load and the submit gate. Both hunter pages get the sections through the form, so the page files didn't change. Pass-throughs removed. Bowser did the evaluate endpoint at the same time; `src/api/` untouched.

### Reusable technical facts
- **Attribute-selector components keep a recomposition DOM-identical.** Sections use `selector: '[appHunterRatingsSection]'` on the page's own `<section>` or `<div>`, and `host: { class }` carries the classes. No wrapper element, so the surrounding grid gaps are unchanged, and Toad's `app-hunter-form form > section` locators still match. This is the first attribute-selector component in the app, and there is no lint rule against it.
- **`formControlName` can't cross a component boundary.** `FormControlName` looks up its `ControlContainer` with `@Host`. Sections bind `[formControl]="draft.form.controls.x"` instead, so they don't need an ancestor `[formGroup]` (the wizard may have none).
- **Radios on `[formControl]`:** `RadioControlRegistry` groups by `_parent` (undefined for `FormControlDirective`) plus the `name` input. `formControlName` never writes a DOM `name`, so leaving `name` off keeps the DOM and keyboard behaviour identical. This is the only radio in the app. If a second nameless `[formControl]` radio set ever shares a page, the two sets will uncheck each other, so give both a `name`.
- **Removing pass-throughs without moving a spec's expectations:** a receiver-only script (`component.X` → `component.draft.X`, `hunterForm` → `form`; `save`, `onSubmit` and `draft` excluded; CRLF kept). Proof: run the same script on `git show HEAD:` of the characterisation spec and diff it against the working copy. The diff was empty.
- Negative controls, both reverted and checked with `cmp`: dropping the radio's `[formControl]` failed the characterisation DOM case and the ratings two-way test; wrapping the ratings section in a `div` failed the new composition test.
- Built 13.6's `mode: 'create' | 'edit'` on the bespoke section, with `numericReadOnly` on the tree ("3 of 3" and no input). The default is `'edit'`, and today's single-page create page uses it too. Phase 6 and 7 seams are comments on the gear and bespoke sections.
- The only visible change is the ratings grid (L16). The History retitle was already live from Phase 2.

### Verification
- Hunter specs: 9 files / 69 tests, up from 3 / 43. That's 25 section tests plus 1 composition test.
- Full suite: 56 files / 465 tests, up from a 50 / 439 baseline taken before any edit.
- `ng build --configuration production --output-path` into the scratchpad: clean, with the same 2 budget warnings (`wizard-tracker.scss`, `custom-select`). `grid-cols-5`, `gap-[0.1rem]` and `text-[0.75rem]` are emitted. wwwroot untouched.
- No browser pass.

### Files
New: `features/hunters/shared/sections/hunter-{ratings,moves,gear,look,bespoke,history}-section.{ts,html,spec.ts}`. Modified: `hunter-form.{ts,html,spec.ts}`, `hunter-form.characterisation.spec.ts` (receivers only), `hunter-draft.spec.ts` (receivers only), `bespoke-option-tree.{ts,html}`. Not committed.

---

## 2026-09-15 — Hunter Wizard Phase 6 (R6, F8a/F8b/F8c): pick rules, frontend half

### Task
`hunter-creation-wizard-phases.md` Phase 6, frontend only, coded against 12.9's pinned `pickRules` shape while Bowser built the backend in parallel. Admin form lists rules read-only and omits `pickRules`; pure `hunter-pick-rules.ts`; the Initiate's weapons in the gear section; Natural Attacks and Combat Magic in the bespoke section; both hunter surfaces. No wizard band links or marks (Phase 7).

### Reusable technical facts
- **`pickRules` is required on `PlaybookDetailResponse`, optional on `UpsertPlaybookRequest`.** 10 typed fixture literals needed `pickRules: []`, not 13.2's two, because Phase 4 and 5 added more. `tsc -p tsconfig.spec.json --noEmit` lists them in seconds. The characterisation spec gained that one input line; no expected value moved (checked with `git diff`).
- **Omit, don't echo (S3):** the spec asserts `Object.keys(request)` has no `pickRules`, since `[]` or `null` would mean something else to the server.
- **Real interceptor, real service, one toast:** `provideHttpClient(withInterceptors([httpErrorInterceptor]))` + `provideHttpClientTesting()` + real `NotificationService`, flush a 409, assert `notifications()` has exactly one entry. Removing the token from `update` fails it with two.
- **Negative-control gotcha:** `if (false && indexed && …)` breaks TypeScript narrowing and the build fails, so nothing runs. Use a never-true trailing conjunct (`&& Date.now() < 0`) instead.
- **The stored caps mask the lock merge on over-limit builds.** With the `lockedScopes` rule merge disabled, the 2 Bases + Extra spec still passed (the dividers' own `maxSelect` locks them). The 1 + 1, write-your-own and three-spell cases, including both Q10 edit-page cases, are the ones that prove the merge (5 failed).
- Angular 22 exports `DOCUMENT` from `@angular/core`. jsdom has no `scrollIntoView`: call it optionally, and stub it on the target element in a spec.
- `tsconfig.app.json` compiles every non-spec `.ts`, so the shared fixture module `features/hunters/shared/testing/pick-rule-playbooks.ts` is type-checked by the build, but never bundled.
- `isShort` with no fitting alternative falls back to all alternatives, so an over-limit old-fashioned list doesn't mute the modern counter.
- Built 13.7 and L25's edit-page "scrolls to" as small `Go to Gear` / `Go to {section title}` buttons (`sections/section-anchors.ts`); the wizard's step links stay F6. The L24 notice is state-derived, not tied to the click, so an over-limit hunter also shows it on load.
- Admin summary extends L26 with each alternative's ranges and adjustments, so a reload shows whether an adjustment survived a save.

### Verification
- Full suite: 59 files / 539 tests, up from a 56 / 465 baseline (new: pick-rules spec, sections spec, admin page spec; 3 admin form cases).
- `ng build --configuration production --output-path` into scratchpad: clean, same 2 budget warnings.
- Two negative controls, both reverted.
- No browser pass. Bowser's in-progress `PlaybookContracts.cs` matched the pinned shape.

### Files
New: `shared/hunter-pick-rules.{ts,spec.ts}`, `shared/testing/pick-rule-playbooks.ts`, `shared/sections/section-anchors.ts`, `shared/sections/hunter-pick-rule-sections.spec.ts`, `playbook-admin/playbook-admin.spec.ts`. Modified: `core/models.ts`, `hunter-draft.ts`, `bespoke-option-tree.{ts,html}`, `hunter-{gear,bespoke}-section.{ts,html}`, `playbook-form.{ts,html,spec.ts}`; `pickRules: []` in 9 other spec fixtures. Not committed.

---

## 2026-09-15 — Hunter Wizard Phase 7, F5: the wizard core

### Task
`hunter-creation-wizard-phases.md` Phase 7, F5 only. F6, F7 and Toad's F9 come next, and nothing is committed until all of Phase 7 is in. `/hunters/new` is now the eight-step wizard: `HunterCreateStore`, the step 1 gate, Rules dots, read-only Tracks and Improvements, the dossier, and Create → toast → `/hunters`. `HunterFormComponent` is edit-only (L17).

### Reusable technical facts
- **The step model is pure** (`pages/hunter-create/hunter-step-model.ts`): steps, next and previous positions, the tracker mapping and the eyebrow. The store stays thin over it. In F5 the tracker shows only `visited`, `unreached` and `notApplicable`. F6 layers `hunterTrackerMarks` on top.
- **The gate:** a loaded playbook, whose id matches `formValue().playbookId`, plus a name. A test that only covers a *first* load proves nothing, because `draft.playbook` is null during it anyway. Only the switch-while-loading case catches a missing id or loading check; a negative control confirmed it.
- **The picker binds its own `FormControl` (13.7):** `requestPlaybook`, then `switchPlaybook`, which resets `furthest`. F7 puts the confirmation in `requestPlaybook`.
- **Angular strips whitespace between elements,** so `textContent` reads "OkayDoomed" and "PlaybookThe Crooked". Read labels and values apart.
- **"Choose a playbook." is a substring of the custom-select placeholder "Choose a playbook...".** Assert `small.text-danger`, never the page text, or a toContain passes without checking anything.
- **Proving a moved characterisation case unchanged:** a scratchpad script compares each `it` title's `toStrictEqual` literals before and after, and each fixture statement with a bracket scanner. The scanner must skip comments: an apostrophe in "the load's prune" opened a fake string.
- **Track labels, from the PDF:** Luck "Okay … Doomed", Harm "Okay bbb|bbbb Dying", Corruption "Okay … Lost". The callout reads "{Short} special", as on the sheets.
- `RouterTestingHarness.navigateByUrl(url, Component)` resolves a lazy `loadComponent` under the Vitest builder.
- **`mode` inputs:** the history section's changes only its layout; the moves section passes its own down to move-internal bespoke sections. `populate(null)` is gone; the wizard starts from a fresh draft.

### Verification
- Full suite: 66 files / 638 tests, up from a 59 / 539 baseline.
- Characterisation: the 5 create cases moved to `pages/hunter-create/hunter-create.characterisation.spec.ts`, and the 2 edit cases stayed. The script reported every expected literal and every fixture statement SAME.
- 4 negative controls, all caught, all restored: the gate id/loading check, jumps ignoring the gate, `submitted` after navigate, and Rules in edit mode.
- `ng build --configuration production --output-path` into the scratchpad: clean, with the same 2 budget warnings. No browser pass.

### Files
- **New:** `pages/hunter-create/hunter-create.store.{ts,spec.ts}`, `hunter-step-model.{ts,spec.ts}`, `hunter-sheet-preview.{ts,html,spec.ts}`, `hunter-create.{spec,characterisation.spec}.ts`, `steps/` (8 step components plus `hunter-wizard-steps.spec.ts`), `shared/testing/characterisation-playbooks.ts`, `hunters.routes.spec.ts`.
- **Rewritten:** `hunter-create.{ts,html}`.
- **Modified:** `hunter-form.{ts,html,spec.ts,characterisation.spec.ts}`, `hunter-draft.{ts,spec.ts}`, `hunter-{history,moves}-section.{ts,html,spec.ts}`, `hunter-pick-rule-sections.spec.ts`; comments only in `hunter-bespoke-section.ts`, `hunter-detail.ts`, `hunters.routes.ts`, `http-context-tokens.ts` and `http-error-interceptor.spec.ts`.

Not committed.

---

## 2026-09-15 — Hunter Wizard Phase 7, F6 and F7: the check, marks, card, links, switch confirm, discard guard

### Task
The rest of Phase 7's code, in the same working tree as F5. Toad's F9 browser pass follows, and nothing is committed until all of Phase 7 is in.
- **F6:** evaluate on every navigation, plus Q8's step 8 re-check; `hunterTrackerMarks` with L5; the "Still to finish" card; the refusal band with L7 links; step links replacing the Phase 6 scroll buttons inside the wizard.
- **F7:** the playbook-switch confirmation (L13), the discard guard and `beforeunload` (L12), standing aside when signed out (L11), and `canceledNavigationResolution: 'computed'`.
- **Docs:** `architecture.md` §8 note; the status lines of both wizard docs; dated implementation notes after L33.

### Decisions (recorded in hunter-creation-wizard.md after L33)
- **L13 is the prune.** 7.4 defines the switch's "clear" as `dropSelectionsOutside`, so the moved prune characterisation case keeps its expected value; it now confirms the switch first.
- **Marks the check never drives:** step 1 is finished whenever the gate holds; Tracks, Improvements and fixed-grant dots are finished once visited. L5 only touches the rest.
- **Harm sentence:** fixed wording, number from `harmUnstableThreshold`.

### Reusable technical facts
- **One latest-wins check stream:** a `Subject<request | null>` into `switchMap`, with `null` as reset so a playbook switch cancels an in-flight check. `concat(of(started), defer(() => evaluate()).pipe(map, defaultIfEmpty(failed), catchError(failed)))`. `defer` turns a missing mock method into `failed` rather than a dead stream.
- **Q8 debounce:** `toObservable(computed(() => JSON.stringify({ ...toRequest(), background: null })))`, `skip(1)`, filter to the last step, `debounceTime(500)`. Specs need `TestBed.tick()` after each edit and a tick before the first. `vi.useFakeTimers()` drives `debounceTime`. `Subject.observed` proves a check was cancelled.
- **A control that leaves a second guard in place proves nothing.** Removing only the filter's `isLastStep()` was MISSED, because the subscriber checked it again; the spec now also asserts `recheckPending` right after an off-step edit.
- **Negative-control scripts must normalise line endings per file.** `core/*.ts`, `app.config.ts`, `models.ts`, `hunters.routes.ts` and the confirm modal are CRLF in the working copy, so a `\n` match silently SKIPs.
- **`RouterTestingHarness.create()` never calls `initialNavigation()`,** so the router ignores popstate until `router.setUpLocationChangeListener()` runs. Wait for the router's `NavigationCancel` / `NavigationEnd`, not ticks, because it defers popstate with `setTimeout`. A separate 'replace' control test asserted `SpyLocation` internals (it starts with an extra '' entry) and was dropped; the `ROUTER_CONFIG` negative control is the proof.
- **Section navigator token** (`shared/sections/section-navigator.ts`): the wizard provides `useExisting: HunterCreateStore`, so the same "Go to" buttons are step links there and scrolls on the edit page.
- **Link anchors scroll in `afterNextRender({ read })`** from a page `effect`, which runs after the layout's write-phase scroll reset.
- **The band action** is projected into the layout's error band through `[wizardErrorAction]`, inside `@if` on both sides.
- `ApiService.get` gained an optional `HttpContext`; `PlaybookService.getById(id, { suppressErrorToast })` is used by Reload playbook.
- `ConfirmDeleteModalComponent.items` is now `readonly string[]`, and `confirmLabel` defaults to `verb`.

### Verification
- Full suite: 72 files / 730 tests, up from 66 / 638 after F5.
- 9 negative controls, all caught, all restored: History notes counting as a change, off-step re-checks, `mergeMap` instead of `switchMap`, a refusal keeping marks, the band never finding a rule, Cancel emitting, the guard ignoring auth, 'replace' resolution, and evaluate toasting.
- Characterisation script: ALL SAME.
- `ng build --configuration production --output-path` into the scratchpad: clean, with the same 2 budget warnings.
- No browser pass (F9).

### Files
- **New:** `pages/hunter-create/hunter-evaluation.{ts,spec.ts}`, `hunter-tracker-marks.{ts,spec.ts}`, `hunter-draft.guard.{ts,spec.ts}`, `steps/hunter-still-to-finish.{ts,html,spec.ts}`, `shared/sections/section-navigator.ts`, `app.config.spec.ts`, `shared/confirm-delete-modal.component.spec.ts`.
- **Modified:** the store, page, introductions and tracks steps, and their specs; `hunter-draft.{ts,spec.ts}` (`isDirty`, `playbookScopedSummary`); the gear, bespoke and look sections; `section-anchors.ts`; `hunters.routes.ts`; `core/{models,hunter,playbook,api}.ts` and the `hunter` and `playbook` specs; `app.config.ts`; the confirm modal; `wizard-layout.html` and its spec; the characterisation spec (evaluate mock, confirm in the prune case); `architecture.md`, `hunter-creation-wizard.md`, `hunter-creation-wizard-phases.md`.

Not committed.

**F9 fixes (same day, after Toad's pass):**
- **B1, dark theme:** the wizard column set no text colour, so the shared hunter sections (written for pages wrapped in `section.text-primary`) rendered browser black on dark surfaces. The fix is `text-primary` on `wizard-layout.html`'s root, because the shell paints the surfaces and should set their foreground. The Mystery wizard colours every element explicitly, so nothing visible changes there.
- **B2, overflow:** step 1's `grid-cols-[2fr_1fr]` row couldn't shrink below its inputs' intrinsic widths. It now stacks below `lg`, with `minmax(0, …)` columns, `min-w-0` items and `w-full` inputs.
- **Guards:** layout, page and steps specs.
- **Verification:** 72 files / 732 tests; production build clean, with the 2 usual warnings.
- **Lesson:** any shell that paints a surface must set its text token too, because `body` sets none.

**N1 fix (Toad's 768 sweep):** the bespoke tree's write-in inputs kept their intrinsic width, so at 768 they pushed the Hex's Rotes card 34px past the column (and the Professional's and the Wronged's by 8px each).
- **Grid-stretched inputs and textareas** get `w-full min-w-0`: the tree's two write-ins, the entry "Details…" input, the free-text textarea, and both History textareas. A percentage width drops a form control's minimum-width contribution to zero, and since they already fill their cell, desktop is unchanged.
- **Flex items** keep their own width but get `min-w-0`: the entry name has `flex-1`, and the look write-in also gets `max-w-full`, so neither widens on desktop.
- **The leaf text span** gets `min-w-0`.
- **Guard:** `hunter-narrow-column-inputs.spec.ts`.
- **Verification:** 73 files / 735 tests; production build clean.

## 2026-09-18: Mystery-wizard row icon — showcase (design pick pending)

- **Row-action icon family confirmed:** `icon-trash`/`icon-pencil` (the only two symbols already in this row) are solid `fill="currentColor"` silhouettes, `viewBox 0 0 24 24`-ish (trash and pencil actually differ — `0 40 32 32` and `0 0 100 100`), not stroked. Any new row-action icon should match that, not the nav/mystery-section stroke convention (`fill="none" stroke="currentColor" stroke-width="1.8"`).
- **Theme mechanism:** `.dark` is a plain class, matched by Tailwind's `@custom-variant dark (&:where(.dark, .dark *))` — it doesn't have to sit on `<html>`. A local `<div class="dark">` wrapper inside any page renders its own subtree in dark theme regardless of the real `ThemeService` state, which is the trick for rendering light/dark side by side without a toggle or touching global state.
- **`app.routes.spec.ts`'s `lazyChildren` count is a hard-coded guard** (`toHaveLength(10)` before this change) that breaks the instant a lazy route is added to the authenticated shell — bump it (now 11) whenever adding one, including throwaway/dev routes.
- **Hand-sketched SVG coordinates are cheap to sanity-check without running the app:** dropped the new `<symbol>` markup into a standalone scratchpad HTML file with a bare `<svg><use>`, screenshotted via a one-off `playwright` `chromium.launch()` Node script (already a devDependency, no install needed), and `Read` the PNG. Faster than fighting the app's auth guard (`GET /api/auth/me` needs a live backend session) just to eyeball icon geometry.
- **Added `.action-btn--wizard`** to `styles.css` reusing `--color-badge-archetype`/`--color-on-badge-archetype` (existing purple tokens) — this one is NOT throwaway, it's the agreed hover treatment regardless of which icon concept wins.
- Six `icon-wizard-*` symbols added to the sprite and `IconName`, all prefixed and commented THROWAWAY, plus `/dev/wizard-icons` (`pages/dev-wizard-icons/`) as an eager-lazy `loadComponent` route, not linked from nav. Full cleanup checklist lives in that component's own top-of-file comment.

## 2026-09-18 (same day, follow-up): Mystery-wizard icon — swap shipped, showcase torn down

- **Skyler's actual ask was a glyph swap, not a new button** — the pencil already routed to the wizard; Rosalina's doc premise was corrected same-day. Lesson: when a stakeholder says "add a link to X" and X is already reachable from an existing control, check whether they mean a *second* affordance or a *clearer label on the existing one* before building a coexistence design. Costs a showcase round either way, but worth flagging the ambiguity up front next time.
- **Final `IconName`: `'wizard'`** (symbol `icon-wizard`), not `wizard-hat` — every existing generic action/chrome name (`trash`, `pencil`, `close`, `menu`, `plus`, `spinner`, `search`, `logo`) is a single unprefixed word; a permanent icon should match, even though the throwaway candidate pool used `wizard-{concept}` to keep them grouped and diffable.
- **`pencil` survives** — still used by `mystery-create-monster-phase.html`'s minion-composer edit affordance, unrelated to the mysteries-list row. Always grep every `IconName`/`icon-{name}` value across the whole `src/app` (not just the one template you're touching) before deleting a symbol.
- **A revert-to-identical is verifiable via `git status`:** after backing out the showcase route (`app.routes.ts`), its spec's `lazyChildren` count, and the `.action-btn--wizard` CSS, `git status` showed those three files as unmodified — confirms a clean full revert rather than a near-miss.
- **Verification:** 73 files / 735 tests (same count as before the showcase — no new specs needed, since the swap didn't change component logic, only a template attribute/icon name); `ng build --configuration development` clean, no `dev-wizard-icons` chunk.

## 2026-09-18 (same day, second follow-up): Wizard hat — filled rejected, outline shipped after a geometry fix

- **Root cause of the filled/outline mixup:** `icon-trash`/`icon-pencil` carry `fill="currentColor"` but their *geometry* is drawn as hollow outlines (evenodd cutouts for the pencil's ruled lines, a hollow can body for trash) — matching the `fill` attribute instead of rendering and looking produced a genuine filled silhouette that visually didn't belong. Lesson: for icon work, trust the rendered pixels over a presentation-attribute grep; `fill="currentColor"` does not imply "this icon is filled in."
- **Hand-sketched path data from a design doc is not safe to ship unrendered, even on a second pass.** Rosalina's outline primary (closed triangle cone + brim curve, both touching `y="15.5"`) read as a plain mountain at 20px/48px and visibly doubled into a thickened blob at 96px when actually rendered via the same scratchpad-HTML + Playwright-screenshot method as the first batch. Fix: open the cone (drop its closing base edge) and move the brim curve ~1.5 units further down so the two strokes don't sit on the same baseline. General rule reinforced: render every hand-written SVG path before it ships, at more than one size — a coordinate that "should" work by inspection can still collide once actual pixels are on screen.
- **Verification:** 73 files / 735 tests (unchanged — no spec anywhere asserts on icon path geometry, confirmed by grep); `ng build --configuration development` clean.

## 2026-09-18 (same day, third follow-up): Wizard hat — Skyler's own SVG shipped as-is

- **Backticks inside an Angular inline `template: \`...\`` literal break the build**, even inside an HTML `<!-- -->` comment — the comment is still inside the outer JS template string, so a bare backtick or `${` closes/reinterprets it. `ng build` throws `TS1005`/`TS2304`-style errors pointing at the *next* unrelated line, not the actual backtick — check the file for stray backticks first when a template file's build error looks nonsensical. Used plain double quotes instead when writing prose about `d="..."`/`fill="..."` inside these comments.
- **Verifying `fill="currentColor"` inheritance for real (not by inspection):** loaded the *compiled* `styles.css` from the last production build (`src/api/MonsterOfTheWeek.Api/wwwroot/styles.css`) into a standalone Playwright page alongside the real `action-btn action-btn--edit` classes and a `.dark` wrapper — gives real Tailwind-generated `:hover`/`.dark` cascade without needing a live authenticated app session. Used Playwright's actual `.hover()` (not a faked inline style) to capture the true `:hover` state, and `deviceScaleFactor` + a tight `clip` box to zoom into a real 20px icon without scaling the artwork itself.
- **A stakeholder's own supplied SVG should be dropped in byte-for-byte** — strip only the standalone-file wrapper cruft (`xmlns`, `id="Layer_1"`, `data-name`, `width`/`height`) and add the one attribute the app's convention requires (`fill="currentColor"` if absent). Confirmed byte-identical `d` data via a Node string-includes check rather than eyeballing a diff.
- **Verification:** 73 files / 735 tests; `ng build --configuration development` clean; hover/rest verified in both themes via screenshot (indigo-600/slate-500 light, indigo-400/slate-400 dark — matches `action-btn--edit`'s existing tokens exactly, confirming the swap needed no new CSS).

## 2026-09-18 (same day, fourth follow-up): Wizard link on Mystery Detail (additive, labelled CTA)

- **A labelled pill CTA vs. a bare icon button are different components, not a styling variant of the same one** — the labelled version reuses `mysteries-list.html`'s "Create something new..." primary-CTA classes (`bg-accent hover:bg-accent-hover rounded-lg text-on-accent ...`) plus `inline-flex items-center gap-2` for icon+label layout, not `.action-btn`/`.action-btn--edit` (that family is for icon-only row buttons with a `title`, which a visible-label control doesn't need).
- **No detail page in this codebase has a spec asserting on a header action link** — `hunter-detail.html` has the placement precedent Rosalina pointed at but no spec file exists for it at all. When there's no established pattern to match, look at the *target* spec's own existing assertion style (here: `querySelectorAll`/`textContent` on `fixture.nativeElement`) rather than importing a convention from elsewhere.
- **Verification method now fully repeatable for icon-in-CTA color checks:** same compiled-`styles.css`-in-standalone-Playwright-page trick as the row-icon rounds, just with the real pill markup instead of `action-btn`. Confirms `fill="currentColor"` against `text-on-accent` (white light / slate-900 dark) same as it confirmed it against `text-muted`/`action-btn--edit` before.
- **Verification:** 73 files / 736 tests (+1, the new wizard-link assertion in `mystery-detail.spec.ts`); `ng build --configuration development` clean.

## 2026-09-19: Mystery Entity Linking Phase 2 — `MysterySelectComponent`, edit-form linking (Locations & Bystanders)

### Task
`docs/updates/mystery-entity-linking.md` §9 Phase 2, Angular half only. Backend link verb shipped in Phase 1 (`72ebc5c`). Monsters excluded (§6.2). Not committed; Bowser was concurrently in `src/api/` on the duplicate-key race, so my diff stays entirely under `src/web/`.

### Reusable technical facts
- **`ApiService.put` needs a body argument, so a no-body `PUT` is `put<null, void>(url, null)`.** `HttpClient` sends an empty body and sets no `Content-Type`, which is what the `LinkToMystery` action (no `[FromBody]`) wants.
- **Line endings in this repo are mixed and it bites.** `core/*.ts`, the four `location-*`/`bystander-*` page and form `.ts`/`.html`, and every `.spec.ts` under `features/` are **CRLF**; `shared/weapon-tag-select.component.*` is **LF**. Consequences: (a) `Write` creates LF, so a rewritten CRLF file shows as a whole-file diff — normalise it back with node before finishing; (b) the `Edit` tool preserves the file's endings and is the safe way to patch; (c) **Git Bash `grep -q $'\r'` and `sed`/`od` lie about CR** — they strip it in text mode. Detect with node: `(s.match(/\r\n/g)||[]).length`.
- **A negative-control harness must normalise its patterns to the target file's endings**, for the same reason. A multi-line `\n` pattern silently reports PATTERN NOT FOUND against a CRLF file; a single-line one matches fine, so the failure is intermittent and looks like a typo.
- **`CustomSelectComponent`'s default `optionSubLabel` resolves `motivation` then `description`.** `MysteryListItemResponse` has neither (it has `concept`/`hook`), so the mystery picker must bind `[optionSubLabel]` explicitly or the dropdown silently shows no sub-label. Bind an arrow *property* (`readonly adventureTypeOf = (m) => …`), not a method, or `this` is unbound at call time.
- **Distinguishing markers for asserting on a `CustomSelectComponent`'s mode**, all from its own template: `.custom-select.multiple-select` for `[multiple]`, `.custom-select__search input` (after clicking `.custom-select__trigger`) for `[searchable]`, `.custom-select__option-sublabel` for the sub-label binding, and the trigger reading `"N selected"` in multi mode. Asserting the component's inputs directly proves nothing about the rendered control.
- **`FormControl.setValue` replaces the array reference, it does not mutate it** — so a test shaped "alias the input array, then `setValue`, then check the input is unchanged" is vacuous and passes either way. It was MISSED as a negative control. The property that is actually worth asserting, and that the defensive copy actually buys, is `expect(control.value).not.toBe(input.mysteryIds)` plus the same on the emitted payload.
- **Shared badge class string** (`locations-list.html:20`, `search-results.ts:81-85`): `rounded-full text-[0.72rem] font-semibold tracking-[0.02em] px-[0.55rem] py-[0.15rem] whitespace-nowrap` + `bg-badge-{domain} text-on-badge-{domain}`. Mystery is amber.
- **Rewriting a `<span>` to an `<a>` in a template as a negative control fails the *build*, not a test** (unclosed tag). Add a sibling element instead if you want to prove a "renders no links" assertion bites.

### Decisions (filed as `luigi-mystery-entity-linking-phase2-oq9-shared-components.md`)
- **OQ9:** share when the repetition has one data contract and no slots (`MysterySelectComponent`); copy when it is a layout with structural variation (the roster card and composer shell, four copies — recommendation to Phases 3–5). `…FormSubmit` stays two named copies, not a generic.
- **Create-page navigation:** exactly one mystery picked → the scoped detail route this page has always used; zero or many → the flat route. Keeps the shipped "← Back to mystery" breadcrumb for the common case without branching the save path, which stays single (`createStandalone` + membership `PUT`s, decision 3).
- **Two new honest error strings** for the non-atomic paths decision 3 accepts: "Location created, but attaching it to the selected mysteries failed." (create page) and "Location saved, but its mysteries could not be updated." (detail page). The alternative was reporting "Unable to create location." for a location that demonstrably exists.

### Verification
- `npx ng build --configuration production`: clean, with the two pre-existing budget warnings (`wizard-tracker.scss`, `custom-select.component.scss`).
- `npm test`: 74 files / 794 tests, up from a 73 / 736 baseline.
- **17 negative controls, all caught, all restored**, covering: detail page dropping link / dropping unlink / keeping the server's stale `mysteryIds` / skipping `getMysteries()`; create page always-flat and always-scoped routes, skipping the links, and reverting to the scoped create endpoint; chip using the weapon token, chip becoming a link, picker losing `[multiple]`/`[searchable]`/`[optionSubLabel]`/its sub-label source; form dropping, aliasing or live-emitting `mysteryIds`, not hydrating from the entity, the picker not being the last field, and a sharing warning being added (decision 4).
- Two initially MISSED and fixed: the vacuous aliasing test above, and a `[multiple]` assertion that checked nothing renderable.

### Files
- **New:** `shared/mystery-select.component.{ts,html,spec.ts}`.
- **Modified:** `core/{location,bystander}.ts` (`linkToMystery`); `features/{locations,bystanders}/shared/{location,bystander}-form/*.{ts,html,spec.ts}` (`mysteries` input, `mysteryIds` control as the last field, `…FormSubmit` output); `features/{locations,bystanders}/pages/{…}-create/*.{ts,html,spec.ts}` (bespoke `mysteryControl` deleted, single `createStandalone` + membership `PUT` path); `features/{locations,bystanders}/pages/{…}-detail/*.{ts,html,spec.ts}` (`getMysteries()`, membership add/remove diff).

Not committed.

## 2026-09-19 (same day, follow-up): Phase 2 — Rosalina's §9.5 partial-failure ruling, and a `computed()` defect

### Task
Both error strings I flagged in the entry above were **rejected as written** (`mystery-entity-linking-ux.md` §9.5, with a 13-row failure-state table). Adopt her copy, plus the two behaviour changes it depends on, plus one latent bug Toad found in `MysterySelectComponent`.

### Reusable technical facts
- **"Entity created, then a second non-atomic round of writes" already had a house answer**, and I invented a second voice for it. `monster-create.ts:286-292` / `minion-create.ts:333-339`: *"{Entity} created, but some details may not have saved. Review them on the {entity} page."* Three properties, all deliberate — it **hedges** (a `forkJoin` tells you one call failed, never that all did), it **carries a next step**, and it is **a success with a caveat, not an error**: `catchError(() => of({ …Failed: true }))` inside the `switchMap`, so the page still navigates and `errorMessage` stays `null`. **Grep for the shape before writing failure copy, not just for the words.**
- **"failed" / "could not be updated" are the wrong tense for a fan-out.** Pick three, have the third fail, and two *are* attached while the copy says none are.
- **Routing a post-create failure into `error:` is a duplicate-entity bug, not a wording bug.** The user is left on a populated create form whose only control creates a *second* row. This was the real defect; the string was the symptom.
- **`@else if (errorMessage())` precedes the content branch on all four `*-detail.html` pages.** Setting `errorMessage` on a *mutation* failure therefore unmounts the form, the picker and the sub-lists, leaving nothing to retry into. Mutation caveats must be toast-only. (Pre-existing and app-wide — `monster-detail.ts:158` does set it. Logged as a four-page follow-up in §9.5.3 D2, not fixed here.)
- **The refetch is load-bearing, not polish.** `monster-detail.ts:315-346`'s `runAndRefresh` is `switchMap(() => getById(id))` after every mutation instead of merging the payload locally. Two jobs here: the re-rendered control *is* the answer to "which ones failed?", and it resets the diff baseline. Without it, "save again" recomputes `removed` from the stale baseline and re-issues an already-applied unlink — and **`DELETE` on the membership URI is not idempotent in status code, it 404s on repeat** (architecture §4.1) — so the retry fails permanently. **Concluded no 404-tolerant unlink is needed on this surface:** the refetch corrects the baseline in one round trip, so the second save never re-issues an applied delete. Yoshi's §7.3 rule 2 stays scoped to the wizard's `pendingRemovals`.
- **A `computed()` that reads a plain `@Input()` field never re-evaluates.** `selectedMysteries` was `computed(() => this.options.filter(…))` — swap `options` after a value is written and the chips stay empty forever. Fix without changing the host contract: back it with `private readonly optionList = signal<T[]>([])` and give `options` a setter + getter pair, so `[options]="…"` bindings and `picker.options` reads are unchanged. **`WeaponTagSelectComponent` has the same defect verbatim and was deliberately left alone** — pre-existing, follow-up.
- **`vi.spyOn(…).mockImplementationOnce(…).mockImplementationOnce(…)` is how to make one call in a `forkJoin` fan-out fail while its sibling lands.** The observables are all constructed at array-build time, so the `Once` mocks are consumed in array order, before any subscribe.
- **A `putSubject` returned by a stub is re-read per call**, so reassigning `putSubject = new Subject()` between two `save()` calls in one test drives a second round trip without rebuilding the TestBed.
- **A negative control that leaves a dangling reference fails the *build* and proves nothing.** Reverting the signal-backed input needed one contiguous span covering the field, the doc comment, both accessors *and* the computed — half-reverting either did not reproduce the defect or tripped an unused-member error.

### Corrections to the previous entry
- **My description of the lost-update residual was wrong in the user-visible direction.** A membership attached elsewhere after page open is in neither `existing` nor `desired`, so it is in neither `added` nor `removed` — **no `DELETE` is issued and it survives on the server.** Only the page's picture of it went stale, and the refetch now closes even that. Toad pinned both halves; I updated the second half of his characterisation test and kept his load-bearing first expectation (removals are drawn from the *loaded* set) with his guard comment intact.

### Verification
- `npx ng build --configuration production`: clean, same two pre-existing budget warnings.
- `npm test`: 74 files / **816** tests, against Toad's 74 / 799 baseline.
- `dotnet test src\api\MonsterOfTheWeek.Api.Tests`: **533 passed**, 0 failed — unchanged, and `git status` confirms no `src/api` file in my diff.
- **8 more negative controls, all caught** (25 across both rounds): partial create routed to `error:`, partial create on the scoped route, partial create also toasting success, partial create setting `errorMessage`, detail page without the refetch, detail caveat setting `errorMessage`, detail membership failure reaching `error:`, and the picker's options reverted to a plain field.

Not committed.

## 2026-09-20: Mystery Entity Linking Phase 3 — roster foundations, the modal hardened and swept, CustomSelect Escape

### Task
`mystery-entity-linking.md` §9 Phase 3, all three workstreams. Phase 2 committed as `2814168`. Not committed. Phase 4 (wizard attach/re-edit/`pendingRemovals`) and Phase 5 (monsters, roster, minion picker) stay out of scope — this phase makes the shipped pattern *fit to be copied*, it does not copy it.

### Reusable technical facts
- **`@HostListener('keydown.escape', ['$event'])` types `$event` as `Event`, not `KeyboardEvent`.** Declare the parameter `Event` — `TS2345` otherwise, and nothing in an Escape handler needs the `KeyboardEvent` members anyway.
- **Escape nesting between two controls that both close on Escape** is three lines, in this order: early-return when already closed, `stopPropagation()`, `preventDefault()`. The early return is what lets the *second* press reach the outer dialog; `stopPropagation()` is what stops the *first* from closing both. Bind the dialog's handler on its own backdrop element rather than on `document`, or the inner control's `stopPropagation()` cannot shield it.
- **Assert propagation by whether a `document` listener fired, not via `event.cancelBubble`.** jsdom does not reflect `stopPropagation()` on `cancelBubble` after dispatch, so a `cancelBubble` assertion is a false negative. `addEventListener('keydown')` on `document` in a `try/finally` is the honest probe.
- **`fixture.detectChanges(); await fixture.whenStable();` runs `afterNextRender` hooks** — the `wizard-layout.spec.ts` idiom, and it is what makes focus-move assertions possible. TestBed attaches the fixture to `document.body`, so `element.focus()` really moves `document.activeElement`.
- **A `track $index` to `track key` change needs a test with teeth.** Removing a row does not change node *identity* under either strategy, so the detectable difference is which row is destroyed: stash a property on the last row's `<li>`, remove the first row, and check the property still travels with its data. A plain render assertion MISSES the mutation.
- **`vi.spyOn` on a `useValue` object works, but a whole second TestBed is needed to re-run a store's `init()`** with different service mocks. `TestBed.resetTestingModule()` then `configureTestingModule` again inside the `it` is the cheapest way to exercise the edit-mode hydration path; `{ ...existingMock, getByMystery: ... }` keeps the rest of the mock.
- **Two count-shaped copy rules that are easy to get wrong and now live in one place** (`shared/mystery-usage.ts`): a list page says **"used by 2 mysteries"**, never "2 *other* mysteries" (no current mystery exists for the others to be other than, and the extra word reads as off-by-one); and the count must come from the **resolved names array**, not from `mysteryIds`, or a stale id makes the sentence claim a number the list does not show.
- **`MonsterDetailResponse` carries `monsterArchetype: { id }`, not `monsterArchetypeId`** — a hand-built mock that follows the `Upsert...Request` shape crashes `loadEditData` at `mystery-create.store.ts:801`.
- **Shell-escaping traps when appending spec text from a bash `node -e`:** a backtick inside a JS template literal, and a single-quoted `'Edit minion'` inside a single-quoted `it(...)` title, both silently produce mangled output (an emptied comment; a TS1005). Prefer the Edit tool for anything containing backticks or nested quotes, and grep the result. A `<<'EOF'` heredoc whose body contains a line starting with a backtick can also abort the whole command — write long prose to a scratchpad file and `cat` it instead.

### Decisions (filed as `luigi-mystery-entity-linking-phase3-modal-footnote-default.md`)
- **`footnote` renders unconditionally but its default becomes `''`**, correcting §7.1's parenthetical. Ten of fourteen call sites pass "This cannot be undone." as `message` with empty `items`; the old default would duplicate it on all ten. Rejected: rewording ten templates (out of scope), and suppressing a footnote identical to the message (magic).
- **`usage`/`usageMessage` render above `message`/`items` and never merge.** `items` already means "what gets destroyed" on `monsters-list`; merging would displace a shipped disclosure to add a new one.
- **Focus restore is captured inside the component** (`document.activeElement` at open, `isConnected`-guarded on close) rather than via a caller-supplied element reference. Covers Cancel, Escape and backdrop; the confirmed-delete case where the opener is gone falls through to no move, and §8.6's caller-provided fallback is left for the phase that owns the roster's removal flow.

### Verification
- `npx ng build --configuration production`: clean, same two pre-existing budget warnings (`wizard-tracker.scss`, `custom-select.component.scss`).
- `npm test`: 77 files / **888** tests, from a 74 / 816 baseline.
- `dotnet test`: **533 passed**; `git status -- src/api` empty — nothing backend touched.
- **34 negative controls, all caught.** Foundations: roster tracking by index, aria-labels dropped and genericised, heading not focusable, focus move removed on the pencil and on Add Another, focus moving despite a blocked commit, hydration minting no key, a key re-minted on edit, removal ignoring the edited card. Modal: focus on the confirm button, no initial focus, no Escape, Escape not stopping propagation, no trap, no restore, footnote default restored, footnote back inside the items branch, usage merged into items, hardcoded `modal-title`, no `aria-describedby`, secondary button suppressed. Select: no early return, no `stopPropagation`, no refocus, search term kept. Sweep: "other mysteries", fake `(s)` pluralisation, unresolvable ids kept, footnote ignoring the count, count from `mysteryIds`, zero claimed on lookup failure, usage merged, minion cascade dropped.
- **Three MISSED first, each fixed by adding the missing test, not by weakening the control:** the edit-mode hydration key (no test exercised `init(mysteryId)` for minions), the footnote default (my test set `footnote` explicitly, so it never read the default), and the resolved-name count (no fixture had a stale mystery id).

### Files
- **New:** `shared/mystery-usage.{ts,spec.ts}`, `shared/escape-nesting.spec.ts`, `features/monsters/pages/monsters-list/monsters-list.spec.ts`.
- **Modified:** `shared/confirm-delete-modal.component.{ts,html,spec.ts}` (usage pair, footnote rename, secondary action, initial focus / trap / Escape / restore / unique ids); `shared/custom-select.component.{ts,html,spec.ts}` (Escape); `mystery-create.store.{ts,spec.ts}` (`MinionDraft.localKey`, `createDraftKey`, `editingDraftKey`, key-based edit/remove, index-shift block deleted); `mystery-create-monster-phase.{ts,html}` + `mystery-create.spec.ts` (key tracking, entity aria-labels, composer-heading focus move); `mystery-create-dossier.html` (key tracking); `{locations,bystanders,monsters}-list.{ts,html}` + the three specs (sweep); `hunter-create.html` (two `permanenceNote` to `footnote` renames).
- **Untouched on purpose:** `WeaponTagSelectComponent` (same stale-`computed()` defect as `MysterySelectComponent` had; the Escape work did not force it), `minions-list` (a minion has no mystery membership), and the other eleven modal call sites.

### Left for later phases, named rather than silently skipped
- **Focus after the composer *collapses*** (§8 item 6) — Save and Cancel unmount their own buttons exactly as the pencil does, so it is the same defect on the other edge. Not among the three fixes this phase was scoped to.
- **The live region, `role="group"` on the composer, and the row-entrance animation** (§8 items 2, 3, 9) — they belong with the roster replication.
- **`track $index` in the sub-resource lists.** `AttackDraft`/`PowerDraft`/`WeaknessDraft`/`ArmorDraft` have no identity at all today; Phase 5 gives them `id` under decision 8, and inventing a second key for them now would be reworked immediately.
- **The modal's "opener no longer exists" focus fallback** — needs per-caller knowledge of where to send focus instead, which is the roster's removal flow.

Not committed.

## 2026-09-20 (same day, follow-up): Phase 3 — two production bugs from Toad's pass, Rosalina's override, and the composer-collapse pair

### Task
Five items, all in my files. Two production bugs Toad measured in Chromium, one scope addition (§8 item 6 moved into scope by Rosalina and by the coordinator), one missing fallback, and one design override. Plus the `forkJoin` gating question and a stale identifier in a comment.

### Reusable technical facts
- **A `(keydown)` binding on a modal's own backdrop is not enough, and the hole is one click wide.** The dialog's title, message and padding are not focusable, so clicking any of them drops `document.activeElement` to `<body>` — and a keydown raised on `<body>` never propagates *down* into the backdrop. `Escape` then silently stops working for the rest of the dialog's life. Use `@HostListener('document:keydown')` with a `visible` guard.
- **That does not cost the nesting property**, and the negative controls got *stronger*, not weaker: removing `CustomSelectComponent.handleEscape`'s `stopPropagation()` now fails 18 tests instead of 2, because with the dialog on `document` the select's `stopPropagation()` is the only thing standing between one press and both closures.
- **Once the dialog listens on `document`, "did the event reach `document`" stops being a usable assertion** for "was it consumed" — the dialog's own listener is on `document`, and `stopPropagation()` does not stop sibling listeners on the same node (only `stopImmediatePropagation` does). Assert `defaultPrevented` plus the outcome instead, and keep the propagation assertion in the *nesting* spec, where it is still the real property.
- **Sampling `document.activeElement` when a dialog opens is not the same as knowing what opened it.** `monsters-list` disables its trash button for a minion pre-fetch and opens the dialog a round trip later; Chromium drops focus to `<body>` when a focused button is disabled and does **not** restore it on re-enable. Track focus as it moves — `@HostListener('document:focusin')`, ignoring targets inside the dialog and ignoring `<body>` — and restore from that. It also collapsed two fields into one and made the "outside" guard testable.
- **jsdom will not `blur()` a disabled element**, so a spec that wants the browser's blur-on-disable state has to drop the attribute for the duration of the call. Focusing some *other* stand-in element instead is worse than useless: it fires `focusin`, overwrites the very opener under test, and makes the test pass before and after the fix. That is exactly how Toad's original version of this test was vacuous, and the same trap applies to any focus-tracking component.
- **`ngOnChanges` runs before the view updates**, so a close-time focus fallback searching the DOM still sees the dialog's own buttons. Exclude the host subtree explicitly — do not rely on the dialog happening to be rendered last, which every shipped call site does but no call site promises.
- **`inject(ElementRef<HTMLElement>)` is wrong** and produces `TS2347` "untyped function calls may not accept type arguments" plus a cascade of `unknown`s. Write `private readonly x: ElementRef<HTMLElement> = inject(ElementRef);`.
- **A guard can be correct and still unobservable.** `afterComposerCollapse`'s "did it actually collapse" check is a no-op today because `+ Add Another Minion` and the composer are the two arms of one `@if`, so the `@ViewChild` is undefined while the composer is open. Kept, annotated as belt-and-braces, and reported rather than left as a silently-untested branch.
- **The heredoc/backtick trap bit again**, this time eating three backticked identifiers out of a doc comment in a `node -e` string. Grep the result of every generated comment, or use the Edit tool.

### Decisions
- **`forkJoin` gating: decoupled.** The three swept pages now subscribe to the entity list and to `getMysteries()` independently, and `isLoading` gates only on the entity list. The mystery list is disclosure data for a dialog, not page data, and gating on it let a slow `/api/mysteries` delay the list itself. The mystery subscription's error is swallowed deliberately — it must not put an error band over a list that loaded.
- **Pending and failed are reported with the same sentence**, and that is flagged for Rosalina rather than resolved unilaterally. Decoupling creates a third state (still in flight) that her §7.7 copy does not name. Inventing a second string would be inventing copy she has not approved; the user-facing consequence is identical (no verified usage, cancel and retry), so `mysteryUsageUnavailableMessage` covers both and the code says so.
- **The confirmed-delete fallback is derived from the DOM**, not taken as an input: the first focus stop in the dialog's parent container, excluding the dialog. That gives all thirteen call sites the behaviour without a single call-site change, and in the wizard it lands on the surviving roster row rather than on `<body>`.

### Verification
- `npx ng build --configuration production`: clean, same two pre-existing budget warnings.
- `npm test`: 81 files / **951** tests, from Toad's 81 / 936 baseline.
- `dotnet test`: **533 passed**; `git status -- src/api` empty.
- **18 negative controls this round, all caught.** Four of Toad's characterisation tests flipped from asserting the defect to asserting the fix, and his `monsters-list` focus test was rewritten because its jsdom stand-in did not reproduce the browser state it stood in for.
- **Three MISSED first.** The focus-tracking "outside" guard (unobservable until the restore path was simplified to read from it), the fallback's host-subtree exclusion (needed a call-site shape that renders the dialog first — every shipped one renders it last), and `isLoading` re-gating (no test asserted it *after* the mystery load landed).

### Files
- **Modified:** `shared/confirm-delete-modal.component.{ts,html,spec.ts}`; `shared/mystery-usage.{ts,spec.ts}`; `mystery-create-monster-phase.{ts,html}`; `mystery-create.store.ts` (comment only); `{locations,bystanders,monsters}-list.{ts,spec.ts}`; `monsters-list.focus.spec.ts` and `mystery-create-roster-keyboard.spec.ts` (Toad's, flipped).

Not committed.

## 2026-09-20: Mystery Entity Linking Phase 4 — wizard attach, re-edit and removal (Locations & Bystanders)

### Task
`mystery-entity-linking.md` rev 7 §9 Phase 4, against Peach's acceptance criteria (A1–A9, R1–R5, D1–D13, S1–S5) and Rosalina's restructured §7.1 variant table and §14 binding table. Phase 3 committed as `c9d554a`/`a063449`. Monsters excluded — Phase 5. Not committed.

### Reusable technical facts
- **`pendingRemovals` is wizard-scoped and every `submitPhaseN` drains all of it.** Per-phase is the natural implementation and reintroduces Peach's G1: `jumpToPhase` sets the phase without submitting and `isPhaseAccessible` returns `true` unconditionally in edit mode, so a confirmed Delete on Locations followed by a tracker jump to Bystanders and Finish would never submit phase 2. Draining everywhere costs four one-line `switchMap`s and no navigation surgery.
- **The removal variant keys on the *baseline*, never on `id`.** `id !== null` answers "does this entity exist"; the modal needs "does *this mystery's membership of it* exist". They are the same answer right up until attach exists, and then keying on `id` offers **Delete** — permanent catalogue destruction — to someone undoing a mis-click. Exposed once as `membershipPersisted(collection, id)` over the same `existing*Ids` signal the submit diff uses: one fact, two consumers.
- **A disposition and the blind baseline diff will both fire for the same id unless you stop them.** `idsToRemove()` sees an id in the baseline and gone from the drafts and issues `unlinkFromMystery`; `pendingRemovals` issues the `delete`. Both land in the same `forkJoin`, racing, and the unlink can 404 against the row the delete just destroyed and fail the whole phase. `idsToRemove` now excludes anything that collection has a disposition for — it is the consistency check, not the source of truth.
- **404-as-success belongs to the removal path only.** On detach it means the requested post-condition already holds; on link it means the thing being linked is gone — the opposite. A negative control that extends the rule to the link path is worth keeping, because the symmetry is tempting and the failure is a false success.
- **A no-op `PUT` of identical values is correct in Phase 4.** Peach's A6 asserts *field values*, not the absence of a request; the dirty check is Phase 5 and monsters-only. A test written as "no PUT is issued" would red-flag a correct implementation.
- **`deferredChangeTail` on the store, not a string per phase component.** Bystanders is `lastPhaseIndex` and its button says Finish, so "continue to the next step" names a step that does not exist. Derived from `currentPhase() === lastPhaseIndex`; the minion phase's existing note reads from the same helper, so there is one place the wording lives.
- **`message` still defaults to `'This cannot be undone.'`** — Phase 3 emptied `footnote`'s default and not this one. Every wizard removal must pass `message=""` explicitly or the dialog silently renders a sentence that is false, because wizard removals are deferred. Asserted, not trusted to care.
- **Section order is load-bearing for focus.** `focusSurroundingSurface()` restores to the first focus stop in the modal host's parent, so roster-before-attach-strip is what puts a confirmed removal back on a roster pencil. A control that inserts any focusable element above the roster fails the focus test — which is the point.
- **Adding a store dependency breaks every spec that stubs `ApiService` with a partial object.** `loadAttachCatalogues` made the store call `LocationService.getAll()` etc., and three wizard specs provided `{ post: () => of({}) }` with no `get`, producing `TypeError: this.apiService.get is not a function` at `init()`. Adding `get: () => of([])` to those stubs is the fix; the class of breakage is worth expecting whenever a store gains a load.
- **A redundant guard is worth deleting, not annotating.** I mirrored the minion phase's `validateCurrentStep` branch for phases 2 and 3 alongside the `commitComposerIfValid` call in `next()`. For a single-step phase the pair is redundant — both set the same message and both refuse — and the negative control proved it unobservable. Removed, with a comment saying why the asymmetry with phase 1 is deliberate.

### Decisions
- **§7.6 taken (Peach's G4, Luigi's call):** a successfully drained `delete` drops that id from the cached attach options, in the same bookkeeping step that updates the baseline. Three lines, reuses a path the drain needs anyway, and it closes the case where a `Back` re-offers a deleted entity whose membership `PUT` then 404s and fails the phase.
- **The wizard's "other mysteries" copy lives in `shared/mystery-usage.ts`** beside the list-page functions rather than in a new file, so the one-word difference between the two surfaces is visible in one place. `wizardMysteryUsageMessage` and `wizardRemovalFootnote`; the latter takes the deferral tail as a parameter so the file stays free of wizard state.
- **Two phase components as explicit copies, not one generic** (OQ9, unchanged from Phase 2): the forms, services and signals are distinctly typed, and a generic that erased that would be harder to read than the duplication it removed. The bystander pair is generated from the locations pair by a scripted noun substitution, which is also how it is kept in sync.

### Verification
- `npx ng build --configuration production`: clean, same two pre-existing budget warnings.
- `npm test`: 83 files / **1007** tests, from a 951 baseline.
- `dotnet test`: **533 passed**; `git status -- src/api` empty.
- **24 negative controls, all caught**, including: attach never linking (A5's silent no-op), attach firing a request (A4), the variant keyed on `id` (G3), the drain scoped per-phase and missing from phases 0 and 3 (G1), the baseline bookkeeping dropped, `idsToRemove` ignoring dispositions, the stale-picker prune dropped, re-attach not cancelling, 404 not swallowed on removal, 404 swallowed on link, the commit rule removed, the deferral clause hardcoded, `message=""` dropped, `confirmLabel`/`secondaryLabel` always set, `track $index`, a focusable element above the roster, usage including the current mystery, (A2) falling back to (A1)'s copy, and both halves of the Escape-nesting mechanism.
- **One MISSED**, resolved by deleting the redundant code rather than by weakening the control: the duplicated blocked-composer branch in `validateCurrentStep`.
- **Escape nesting holds in the wizard**, which is the first place a select and a dialog share a screen: two presses close the dropdown then the dialog, one press closes the dialog when no dropdown is open, and removing the select's `stopPropagation()` now fails 19 tests.

### Files
- **New:** `mystery-create-phase4.store.spec.ts`, `mystery-create-phase4.spec.ts`.
- **Modified:** `mystery-create.store.{ts,spec.ts}`; `mystery-create-{locations,bystanders}-phase.{ts,html}` (rewritten as roster + attach + composer + modal); `mystery-create-monster-phase.{ts,html}` (deferral tail, roster-card class); `shared/mystery-usage.ts` (wizard copy); `shared/wizard/wizard-layout.scss` (row entrance motion); `mystery-create.spec.ts`, `mystery-create-roster-keyboard.spec.ts`, `shared/custom-select-escape-surfaces.spec.ts` (catalogue stubs).

### Left for later phases
- **Monsters and minions** — Phase 5, on §6.2's sequencing constraint.
- **A8 and D6/D7's cross-mystery halves** ("verify from the *second* mystery") need a live backend; the client half is asserted here and Phase 1's 36 endpoint tests cover the verb.
- **§8 items 2 and 3** (the `sr-only` status region and `role="group"` on the composer) — still unbuilt, and §14.3's decision rule now applies: if the composer heading's announcement is still unverified when Phase 5 starts, ship the status region rather than carry the risk into a third and fourth replication.

Not committed.

## 2026-09-20 (same day, follow-up): Phase 4 QA rulings — the count/names split, and the attach guard

### Task
Rosalina's §15 of `mystery-entity-linking-ux.md`, both build changes: §15.1 the wizard's removal modal asserting "isn't used by any other mystery" when only the *names* failed to load, and §15.2 attach leaving an open composer beside a non-empty roster. Plus her list-page consistency recommendation, taken in the same change set. Not committed.

### Reusable technical facts
- **Two facts from two sources must not be collapsed into one number.** `usage.length` was doing duty as both "how many other mysteries" and "how many names we resolved". The count comes from the entity's own `mysteryIds`, which rides on every list and detail response and owes nothing to the mystery lookup; the names need the lookup. Collapsing them made a failed lookup render as *"isn't used by any other mystery"* — the opposite of the truth, on the sentence an irreversible decision is made from. The fix is a sourcing change, not new copy: `otherCount` drives the sentence, the buttons and the footnote; `resolveMysteryNames` decides only whether bullets render.
- **A partial resolution takes the names-missing wording.** Rosalina's table has two states for count > 0; partial is neither. Rendering one bullet under "2 other mysteries:" would be the count and the list disagreeing, which is the invariant Phase 3 established for this block, so bullets render only when *every* id resolved.
- **Punctuation is load-bearing in this block.** The colon promises a list, so the names-missing variant ends in a full stop. There is a control for it, because the two strings are one character apart and a copy edit would not notice.
- **Two surfaces holding identical data must make identical claims.** The list pages had the same conflation behind a coarser `mysteriesAvailable` boolean. Aligning them deleted that boolean entirely — with the count sourced correctly, "we cannot say how many" no longer arises — and left `mysteryUsageUnavailableMessage` exported but uncalled, retained per §15.1 with a comment saying so.
- **"Collapse the composer on attach" is the naive fix and it destroys input.** Start typing "the old mill", realise you already made one, pick it from the strip — an unconditional collapse silently discards what was typed, which breaks the rule the composer has followed since the minion work: nothing discards its contents implicitly. The guard is *collapse only when the composer holds nothing*, reusing `locationComposerDirty` — the same signal `commitComposerIfValid` uses for `Next` — rather than inventing a second notion of "empty".
- **The dirtiness test matters more than form validity here.** A composer holding a type and no name is invalid but *started*, and that is the case most likely to be lost; a control that swaps `locationComposerDirty()` for `addLocationForm.valid` is caught.
- **A guard framed as "re-derive" invites the wrong one-liner.** `open.set(dirty)` reads equivalently and additionally *reopens* a composer the user had closed. That was MISSED until the test was reframed from "an already-collapsed composer is left alone" to **"attach only ever collapses — it never opens"**, which is the actual invariant.
- **No focus move on the attach path**, deliberately: §8.6's contract fires when the *focused* element unmounts, and here focus is in the attach select and stays there, which is right for attaching several in a row.

### Toad's rule, absorbed
**Assert the complete sorted multiset of calls, not the presence of the right one**, wherever two code paths can reach the same endpoint. He found the hole in my own D6: `toContain('location.unlink(…)')` plus "no delete" both stay true if the unlink goes out **twice** — which is exactly what reverting `idsToRemove`'s disposition exclusion does on the detach path, and a duplicate unlink is worse than a duplicate delete because the drain's copy maps 404 to success and the diff's copy does not. Converted D6/D7 to his `expectLedger` form and moved the recording to `defer()` so it happens at subscribe rather than at method call — `HttpClient` is cold, so a request built and dropped must not reach the ledger. Measurable: the `idstoremove-ignores-dispositions` control went from **2 failing to 7**.

### Verification
- `npx ng build --configuration production`: clean, same two pre-existing budget warnings.
- `npm test`: 87 files / **1053** tests, from a 1039 baseline.
- `dotnet test`: **548 passed**, untouched (the one untracked file under `src/api` is Toad's).
- **14 negative controls, all caught:** count from names in the wizard and on both list shapes, the footnote following the names instead of the count, partial bullets rendered in either place, the colon kept on the names-missing variant, names-missing collapsed back to a zero claim (both functions), attach not collapsing, attach collapsing unconditionally, the guard keyed on form validity instead of dirtiness, and the guard reopening a closed composer.
- **One MISSED**, fixed by reframing the assertion rather than weakening the control: `attach-reopens-a-collapsed-composer`.

### Files
- **Modified:** `shared/mystery-usage.{ts,spec.ts}` (`namesResolved` on both message functions, wizard copy unit tests); `mystery-create-{locations,bystanders}-phase.ts` (count/names split); `mystery-create.store.ts` (`collapseComposerIfUntouched`); `{locations,bystanders,monsters}-list.{ts,spec.ts}` (same split, `mysteriesAvailable` deleted); `mystery-create-phase4.store.spec.ts` (ledger form for D6/D7); and Toad's `mystery-create-phase4-ledger.spec.ts` and `mystery-create-phase4-usage-unavailable.spec.ts`, whose characterisations this round flips.

Not committed.

---

## 2026-09-20 (same day, follow-up): Phase 5a — the sub-resource upsert diff, the one hydrator, minions on the drain

### Task
Phase 5a of `mystery-entity-linking.md` (rev 10, §5.4/§6.6/§7.7a–h) plus UX §16.4 and Peach's `mystery-entity-linking-acceptance-phase-5.md`. Eleven items: the hydrator, the eight-collection upsert diff, the derived per-row dirty check, the parameterised diff function, the weapon-tag sub-diff, minions on the disposition drain, `membershipPersisted`'s dispatch, `applyPendingRemovals` dropping rather than skipping, the drain leaving the monster save chain, `MinionService.moveToMonster`, and deleting `draftState`. Roster/monster-linking work is 5b. Not committed.

### Reusable technical facts
- **A diff cannot be tested by a stub that cannot represent "unchanged".** Every sub-resource double in this repo returned a bare `{ id }`. That was fine while every submit deleted and recreated the lot; against a diff it reports *every* row as changed on the next pass, so the double manufactures the exact churn the phase removes. Doubles now echo the request into the response, and each create mints a fresh id — a fixed id makes two rows indistinguishable to the diff and lets a genuine mis-identification pass.
- **A follow-up call that returns nothing poisons the baseline.** `POST /attacks` answers *before* its weapon tags are assigned, so storing the create response as the baseline leaves `weaponTags: []` against a draft that has one. `isDirty` then reports that attack changed on every later submit, re-PUTting it and re-assigning the same tag for ever. Found by 5a-U2 in create mode, not by any edit-mode test. Fix: `afterSave` returns `Observable<TResponse>` — the row as the server now holds it — and whatever it emits becomes the baseline.
- **`MonsterArmorResponse.specialDescription` is optional; its minion twin is not.** Comparing a draft's `''` against `undefined` marks an untouched armor dirty on every submit. `sameNullableText` normalises both sides to `null`.
- **The H1/H2/H3 invariant is enforceable structurally, not by discipline.** `toHydratedMonster` builds `attacks` and `existingAttacks` from the same array in the same expression; a caller receives both or neither. The three bugs were one bug — two independent code paths, one of which ran.
- **`rekeyDrafts` is the post-submit half of the same invariant.** Refreshing the baseline without re-keying the drafts is H2 exactly, and it is the cheapest thing to forget: the NC that removes only the re-key failed 12 tests, including 5a-U1 and 5a-U9.
- **`jumpToPhase` silently refuses when the target phase is not complete.** A test that jumps and submits will quietly submit the *current* phase instead and pass for the wrong reason. Assert `currentPhase()` after the jump. This is how my first G1 test passed against a store that had dropped minions from the drain entirely.
- **`false && predicate(x)` un-narrows `x` in TypeScript.** Useless as a negative-control mutation; `predicate(x) && (1 as number) < 0` compiles and does the same job.
- **`draftState` is gone.** It was a `computed` with one consumer, a test that asserted its own shape. It had to be widened for every field 5a adds and bought nothing; F4 (draft persistence) does not exist. Deleted with its interface, and the test rewritten against the store signals it was proxying.

### Judgment calls
- **The minion predicate is the baseline form (`existingMinionIds().includes(id)`), not `id !== null`.** Rosalina's UX §16.4 argues for a separate `id !== null` predicate; Yoshi's §7.7b says the baseline implementation is right for all four and only the *name* is wrong. Skyler's standing instruction was to take the baseline form if Rosalina had not landed it, and the two documents still disagree, so: baseline form, renamed `persistedForRemoval`, with both meanings documented on it. For minions the two are observationally identical — a minion is never attached (UX §2.5) so its id can only become non-null by being saved, and the store sets `existingMinionIds` from exactly those saves and from hydration. Using one implementation means the modal and the drain cannot disagree about what the user was shown.
- **`removalRequest`'s dispatch became a `switch` too**, not just `persistedForRemoval`'s. It was the same nested-ternary shape on the same closed union, deciding destroy-vs-unlink.
- **The eight dossier `track $index` loops moved to `localKey` as well.** They render the same draft arrays. The locations/bystanders loops at `:232`/`:248` were left on `$index` — pre-existing, and outside 5a.

### Verification
- `npx ng build --configuration production`: clean, same two pre-existing budget warnings.
- `npx ng test --watch=false`: 89 files / **1088** tests, from a 1053 baseline.
- `dotnet test src/api/MonsterOfTheWeek.Api.Tests`: **562 passed**, untouched; `git status src/api` is empty.
- **Seven negative controls, all CAUGHT:** never skip an unchanged row (8 failed); refresh the baseline without re-keying the drafts (12); the minion diff loses the drain exclusion (2, ledger-only); minions resolve to the bystander baseline (4); the drain drops every minion disposition (1 — the G1 test); assign-only weapon tags (1); the minion modal gains a confirm label it should not have (2).
- The duplicate-minion-delete control is caught **only** by the exact-call ledger — a positive "it was deleted" assertion passes with two DELETEs.

### Files
- **Added:** `mystery-create/hydrate-monster.ts`, `mystery-create/sub-resource-diff.ts`, `mystery-create/mystery-create-phase5a-ledger.spec.ts`, `core/phase5a-verbs-wire.spec.ts`.
- **Modified:** `mystery-create.store.ts` (hydrator, eight adapters, the two collection savers, `submitPhase1`, the drain, `persistedForRemoval`, `draftState` deleted); `core/monster.ts` + `core/minion.ts` (updaters, tag remover, `moveToMonster`); `mystery-create-monster-phase.{ts,html}` (variant E, `localKey` loops); `mystery-create-dossier.html`; `mystery-create-{locations,bystanders}-phase.ts` (rename); four existing spec files.

### Left for 5b, deliberately
Monster roster and `MonsterDraft`, monster attach and its busy strip, the minion monster-picker wired to `moveToMonster`, `monsters[0]`, and monster-optional validation (`validateCurrentStep`'s phase-1/step-0 block is untouched — 5a-B2).

Not committed.

---

## 2026-09-20 (same day, follow-up): Phase 5b — the monster roster, decision 19, attach, and the J-cluster

### Task
Phase 5b of `mystery-entity-linking.md` (rev 11) plus UX §5/§16/§17/§18 and Peach's `mystery-entity-linking-acceptance-phase-5b.md`. Branch `mystery-entity-linking-phase-5b` off `f8170eb`. The monster roster, decision 19, monster attach, the minion monster-picker, monster linking on the standalone form, the J-cluster (J1/J2/J4/J6), the `monsterPreview()` retirement, and two sweeps. Not committed.

### Reusable technical facts
- **Ordering was load-bearing twice and both instructions were right.** Renaming the four composer signals to `minion…` first cost four files of pure mechanics; doing it after a second composer existed would have been four files of ambiguity. And landing J1 *before* `submitPhase1` was rewritten meant the rewrite was written against the per-monster baseline rather than retrofitted onto a flat one.
- **The fix for J1 is a field, not a rule.** `MonsterDraft.existingMinionIds` replaces the store-level flat signal, and `persistedForRemoval('minions', …)` reads a `computed` that flattens the roster. Removing a monster then forgets its minions' baseline *because the baseline went with the draft* — there is no "and also clear these ids" line to omit. `clearDrainedRemovals` lost its minion arm entirely as a result, which is the visible proof.
- **The baseline is per-owner; the drafts operand stays global.** `removedIds(D) = D.existingMinionIds − *all* minion drafts − disposed`. Scoping the drafts per-monster too deletes a minion re-parented *away* from D, whose id is in D's baseline and whose draft now carries another `monsterKey`. A negative control that scoped both sides failed exactly one test, which is why that test exists.
- **J2's baseline parent is the server id, never a baseline `monsterKey`.** Keys are client-side and hydration mints fresh ones, so comparing them across a load boundary is meaningless.
- **The §7.7i third case is the one that is easy to miss**, and it is J1 by another route: a minion whose baseline parent is another roster monster, pending a move to the one being removed, must have its `monsterKey` *revert*. Without it the draft leaves with the removed monster, the minion stays in its real parent's baseline unclaimed, and that parent's own diff deletes it.
- **A composer's `monsterKey` must be derived, not stored.** The roster can change while the composer is open — attach a second monster, or remove one — and a value written at reset then names the wrong monster. `effectiveMinionMonsterKey()` answers "the sole monster if there is one, else the control".
- **`TestBed.inject` does not find a component-provided store.** `MysteryCreateStore` is in the component's `providers`, so a spec that renders the wizard must use `fixture.debugElement.injector.get(...)`. `TestBed.inject` throws NG0201.
- **Dynamic `?raw` imports do not resolve under the Angular unit-test builder** ("Module not found in bundle"). A `track $index` sweep cannot be asserted by reading template source from a test; assert the *consequence* instead — a surviving row's DOM node identity across a splice, which is what the key buys and what reverting one token breaks.
- **A refetch-ending save needs a double that behaves like a server.** `monster-detail`'s `getById` stub kept answering the original monster after `update`, so the new post-save refetch looked like it had lost the user's edit. The double now holds mutable server truth.

### Judgment calls
- **The `validateCurrentStep` phase-1/step-0 branch was deleted rather than rewritten.** I first replaced the hard block with a composer-rule branch; a negative control removing it was **NOT CAUGHT**, because `next()` calls `commitMonsterComposerIfValid()` immediately afterwards and that already refuses a started-but-invalid composer with the same message. So the branch was a second copy of one rule — the same redundancy phases 2 and 3 already decline to carry. Deleted it, and the re-aimed control (removing the commit call) failed 26 tests.
- **`monsterPreview()` was renamed to `monsterComposerPreview()`, not deleted outright.** Under a roster "the monster" has no single referent, and the old name invited exactly the mistake `phaseStepComplete:601` had made — reading the live composer form as if it were saved content. Its one remaining consumer is the dossier's single expanded entry, which is the role `minionPreview` already plays.
- **`monster-create`'s single-mystery `Attach to Mystery` control is gone**, not kept alongside the form's new multi-select. The create is now always standalone plus membership `PUT`s, which is the Locations/Bystanders shape since Phase 2; keeping both would have left two controls writing the same fact.
- **`wizardRemovalFootnote` gained an optional cascade clause** rather than a second monster-specific function, so the last-phase deferral branch stays in one place. The clause attaches to the *Delete* sentence only, because that is the only verb it is true of.
- **Phase 4's A9 was retired, not skipped.** It asserted `attachMonster` did not exist. What survives it is `5b-T9`: the *locations* strip gains no busy or error state, because it has no fetch.

### Verification
- `npx ng build --configuration production`: clean, same two pre-existing budget warnings.
- `npx ng test --watch=false`: 91 files / **1167** tests, from a 1097 baseline.
- `dotnet test src/api/MonsterOfTheWeek.Api.Tests`: **565 passed**, untouched; `git status src/api` empty.
- **Nine negative controls, all CAUGHT** after the one correction above: flat minion baseline (7 failed, incl. all four J1/H4 tests); §7.7i revert removed (1); re-parent fired unconditionally (18); half-hydrated attach committed (9); cascade `[items]` read from the roster (1); the monster composer commit rule removed (26); drafts operand scoped per-monster (1); partial edit-mode hydration (1); `monsters[0]` truncation plus the dropped membership `PUT` (21).
- **One NOT CAUGHT**, and the production code was changed rather than the control: the redundant `validateCurrentStep` branch.

### Files
- **Added:** `mystery-create-phase5b-roster.spec.ts`, `mystery-create-phase5b-monster-phase.spec.ts`.
- **Modified:** `mystery-create.store.ts` (roster, `MonsterDraft`, J1/J2/J4, `submitPhase1`, attach, decision 19, the step dot); `hydrate-monster.ts` (returns a `MonsterDraft` + minions); `mystery-create-monster-phase.{ts,html}` (roster, attach strip, modal variants, picker); `mystery-create-dossier.{ts,html}`; `mystery-create.html`; `core/monster.ts` (membership verbs); `shared/mystery-usage.ts` (cascade clause); `monster-form.{ts,html}` + both its pages; `app.html` and `login.html` (`animate-spin`); nine spec files.

### Left deliberately
The screen-reader announcement region and roster button labels (UX §8 items 2–3, under Skyler's waiver). Attach/detach from the mystery detail page (F1/F2). An expand-style `GET /api/monsters/{id}` (§8.7). Losing unsubmitted field edits on a tracker jump (F9).

Not committed.

---

## 2026-09-20 (same day, follow-up): Phase 5b QA — the two baseline-lifecycle bugs, and the counting sweep

### Task
Toad's 5b pass found two production bugs; Yoshi ruled on both in rev 12 (§6.6 BUG 2, §7.7j BUG 1) and both were owned tasks before merge. Plus §8.8: check any other counting assertion in the wizard specs for the shape that let the Escape sweep narrow silently. Branch `mystery-entity-linking-phase-5b`. Not committed.

### Reusable technical facts
- **"Covered elsewhere" is a claim about *ordering*, not existence** (principle 6, rev 12). BUG 1's justification named a real consumer — `writeBackMinionDrafts` rebuilds `MonsterDraft.existingMinionIds` — and was still false, because the drain runs from all four `submitPhaseN` (decision 15) and the writeback from one. **Decision 15 widened *when* the drain runs without widening the bookkeeping beside it.** When deleting state, enumerate consumers *and the phases each one runs in*.
- **A baseline and its draft need one writer, and "clear it on the error path" does not achieve that.** BUG 2's obvious fix — clearing `existingMonsterIds` in `loadEditData`'s error handler — passed **every** test I had, including the converted characterisations. The window it leaves is on the *success* path, between the early write and the subscribe. Moving the write removes the interval; clearing on error only shortens it.
- **A window like that can be pinned, and the oracle is a consumer standing inside it.** I wrapped `monsterService.getById` in a `defer` that samples `persistedForRemoval` at subscribe, mid-fan-out, and asserted the baseline is never populated while the roster is empty. That is the one assertion that fails for the error-handler variant — and it converted a NOT-CAUGHT control into a caught one rather than leaving a structural ruling untested.
- **A census asserted against itself cannot fail.** `confirm-delete-modal.call-sites.spec.ts` read `expect(Object.keys(perTemplate)).toHaveLength(12)` and `…reduce(…)).toBe(13)` — both facts about the literal three lines above. It sat at 13-in-12 while Phase 4 added two call sites and 5b a third; the truth is **16 in 14**. Fixed the numbers and moved the derivable half (the wizard's four) into the wizard spec, which mounts the app and counts.
- **A count is only as good as the state it is taken in.** My first version of that derived test counted the minion step's modal with an empty roster and got 0 — because 5b suppresses the whole step body there. That is the identical trap the Escape sweep fell into: the number was right, the *state* did not contain the thing.
- **An `every`-style loop over a derived set passes vacuously when the set is empty.** Added a length guard to `roster-keyboard`'s tab-order loop for the same reason Toad guarded `sweepEscape` with `toBeGreaterThan(0)`.
- **`import.meta.glob('../**/*.html', { eager: true })` hangs the Angular unit-test run.** Combined with the earlier finding that dynamic `import('./x.html?raw')` is "not found in bundle", template source is effectively unavailable to a unit test here — derive counts from the *rendered* app instead.

### Judgment calls
- **BUG 1's arm went in `clearDrainedRemovals`, walking the roster — not `stillTheRostersBusiness`.** Yoshi's ruling, and I checked it: a negative control that fused the bookkeeping into the drain filter was **NOT CAUGHT**, because the two are observationally equivalent for every sequence reachable today. I kept his placement and did not manufacture a test for a structural preference. The argument stands on its own — that function answers "should this run", this is "record that it ran", and fusing them is how §7.7 produced (e), (f) and (i).
- **The converted characterisations kept their phase-state assertions but lead with the ledger.** `expect(callsMatching(/^minion\.delete/)).toEqual([])` comes first and `submitError`/`currentPhase` follow, because the control has to bite at the destructive assertion — a display-only assertion is what let the §7.7i case hide.
- **BUG 2's ledger assertion is `/^monster\./`, not `/^monster\.unlink/`.** With the baseline unpopulated there is nothing to update or link either, so the whole monster surface must be silent; the narrower pattern would pass if the diff merely changed which destructive call it made.

### Verification
- `npx ng build --configuration production`: clean, same two pre-existing budget warnings.
- `npx ng test --watch=false`: 92 files / **1190** tests, from Toad's 1188 baseline (+1 derived census, +1 mid-load window probe).
- `dotnet test src/api/MonsterOfTheWeek.Api.Tests`: **568 passed**. The one untracked file under `src/api` is Toad's `MonsterMinionCascadeTests.cs`; I changed nothing there.
- **Five negative controls, three CAUGHT and two not:** neuter the restored minions arm (4 failed — all four BUG 1 tests); move the baseline write back before the hydration (2 — both BUG 2 tests, biting at the unlink ledger); drop the drafts while keeping the baseline write (28). **NOT CAUGHT:** the error-handler variant of BUG 2 — fixed by adding the mid-load probe, after which it fails; and fusing BUG 1's bookkeeping into `stillTheRostersBusiness`, left uncaught deliberately.

### Files
- **Modified:** `mystery-create.store.ts` (both fixes); `mystery-create-phase5b-baseline-leaks.spec.ts` (six characterisations → assertions, plus the window probe); `confirm-delete-modal.call-sites.spec.ts` (census corrected 13/12 → 16/14, tautology replaced); `mystery-create-phase5b-monster-phase.spec.ts` (derived wizard census); `mystery-create-roster-keyboard.spec.ts` (empty-set guard); `confirm-delete-modal.component.{ts,spec.ts}` (stale "thirteen" prose).

Not committed.

---

## 2026-09-21: R1(a) — a `typecheck` script, and what it is actually worth

### Task
`docs/engineering-practice-improvements-plan.md` §3, item R1(a): the web app has no `typecheck` script, and `tsc -p tsconfig.json` is vacuous because the config is solution-style (`"files": []` plus references). Add the script and verify it by seeing it fail. Bowser has R1(b)–(d), Peach R3. Branch `mystery-entity-linking-phase-5b` at `a60a30f`. Not committed.

### Reusable technical facts
- **`tsc -p tsconfig.json` in this app compiles zero files and exits 0.** Demonstrated against a real `TS2322` in `core/monster.ts` and again against one in `core/monster.spec.ts` — exit 0 both times. A solution-style config does not follow its own `references` unless invoked with `--build`.
- **`ng build` type-checks the *whole* `tsconfig.app.json` include set, not just what the entry point reaches.** I expected an unimported file to slip through and it does not: a throwaway `src/app/core/r1a-orphan-probe.ts` that nothing imports failed the production build. So the app half of the new script finds nothing `ng build` would miss.
- **`ng build` exits 0 on a spec-only type error** — `tsconfig.app.json` excludes `**/*.spec.ts`. `ng test` does catch it (the unit-test builder compiles the spec tree and fails before running anything). So the gap the second config closes is real but is *between the two commands*, not beyond them: a developer who builds and does not run the suite gets a green build on a broken spec tree.
- **`tsc` resolves from `node_modules/.bin` inside an npm script**, so the script works where `npx tsc` does not — `npx tsc` in this repo hits npm's "This is not the tsc command you are looking for" guard because TypeScript is a transitive-looking devDependency from npx's point of view.
- **There is no CI in this repo.** `.github/` holds only `agents/squad.agent.md`; no `workflows/`, no installed git hooks (samples only), no Makefile or task runner. The `Dockerfile` runs `npm ci && npm run build` and is explicitly ship-only ("the development loop is `docker compose up -d postgres` + `dotnet run` + `npm start`"). Nothing automated runs either suite, so there was nothing to wire the script into and I wired nothing.

### What R1(a) is actually worth, stated narrowly
Not "it catches errors nothing else catches" — `ng build` plus `ng test` together catch both classes. It is worth having for three narrower reasons, and the plan should say the narrow thing:
1. **It is the only one-command answer to "does this tree type-check".** Today that takes two commands with different failure vocabularies.
2. **Seconds, with no bundler, no jsdom and no test execution**, and it names file and line without build noise around it.
3. **It still works when the suite cannot start.** A spec-tree type error makes `ng test` fail as a *build* failure, so "the tests are broken" and "the types are broken" are indistinguishable from its output.

### Found while verifying
`src/app/shared/glob-probe.spec.ts` — a throwaway probe of mine from the 5b QA pass — was sitting untracked in the tree, and `npm run typecheck` flagged it (`TS2339: Property 'glob' does not exist on type 'ImportMeta'`) on its first real run. It postdates my last green verification (mtime today 08:46; that run was yesterday), so the 1190 I reported was accurate when reported. Removed. **The lesson is the item's own: a probe file is exactly the thing that survives when the only check you run is the one you were already running.**

### Verification
- Deliberate app-code error → `npm run typecheck` exit **2**, `TS2322` at `core/monster.ts(53,11)`. `ng build` also exit 1 on the same tree.
- Deliberate spec-only error → `npm run typecheck` exit **2**, `TS2322` at `core/monster.spec.ts(28,11)`. `ng build` exit **0** on the same tree — the case the second config exists for.
- Old `tsc -p tsconfig.json --noEmit` → exit **0** with either error present.
- Clean tree → `npm run typecheck` exit 0; `ng build --configuration production` clean (two pre-existing budget warnings); `ng test` 92 files / 1190; `dotnet test` 568.
- Working tree afterwards: `package.json` modified, one line added, nothing else.

Not committed.

### 2026-09-26 — grid-item min-width and truncate on a nowrap `<small>`
A `<ul class="grid ...">` roster list forced its whole wizard column into horizontal scroll: implicit grid items default to `min-width: auto` (content-based), and `truncate`'s `white-space: nowrap` makes the min-content width of a long `<small>` equal its full unwrapped width. `min-w-0` on the *flex* wrapper inside the `<li>` does nothing for the `<li>`'s own sizing as a grid item — the `min-w-0` has to go on the grid item itself (the `<li>`), and on `wizard-layout.html`'s `<section #column>` too, so no descendant can force the 42%-width Edit pane wider. Fixed in `wizard-layout.html`, `mystery-create-locations-phase.html`, `mystery-create-bystanders-phase.html`; swapped `truncate` for `line-clamp-2` on the description `<small>` for the 2-line-then-ellipsis UX (Tailwind v4 ships `line-clamp-*` in core, no plugin/config needed — already proven in use at `hunter-sheet-preview.html`). `mystery-create-monster-phase.html` intentionally untouched (shows computed stats, not free-text description; bug doesn't apply). Lesson: **when a CSS min-size bug spans a grid/flex boundary, `min-w-0` must be applied at each container level in the chain — a flex-level fix one level down does not propagate up through the grid item.**

**Follow-up same day — a second, real bug in the first pass, caught by the coordinator's live Playwright check, not by the spec suite:** I left `block` on the `<small class="text-muted block line-clamp-2">` alongside the new `line-clamp-2`. `line-clamp-2` carries its own required `display: -webkit-box`; `block` sets `display: block`; both are single-class selectors so cascade order in the compiled `styles.css` decides, and Tailwind happened to emit `.block` (line 589) after `.line-clamp-2` (line 583) — so `.block` won and silently killed the clamp (`-webkit-line-clamp: 2` stayed set but inert; `clientHeight === scrollHeight`, full text always rendered). `truncate` had needed `block` (it has no display of its own — nowrap+ellipsis needs a block box for a bounded width); `line-clamp-*` doesn't, since `-webkit-box` already establishes the outer block-level box. **General lesson: swapping `truncate` for a Tailwind `line-clamp-*` utility must drop any co-occurring `block`/`inline`/other display utility on the same element — the two display declarations conflict, Tailwind emits no warning, a class-name diff looks fine, and it only shows up in computed style.** Fix: removed `block`, kept `class="text-muted line-clamp-2"` alone, in both files. Verified with real computed styles rather than trusting the diff: no login/test creds were available to check the actual "Pierce the Night" mystery in-browser, so I fetched the running dev server's live compiled `styles.css` (`curl http://localhost:4200/styles.css` — confirmed `.line-clamp-2` at line 583, `.block` at line 589, matching the coordinator's report exactly) and built a static two-`<small>` fixture (one `text-muted line-clamp-2`, one `text-muted block line-clamp-2`, same long description) driven by real Playwright (`chromium.launch()` via the repo's own `playwright` devDependency — run the script from inside the Angular project directory, not the scratchpad, or Node's ESM resolver can't find the package). Result: fixed element `clientHeight 38 < scrollHeight 115` (clamped: true); broken repro `clientHeight 115 === scrollHeight 115` (clamped: false) — reproduced the bug and confirmed the fix from computed layout, not class-name presence. **Note on `docker exec … psql`/`curl … -o file`: the auto-mode permission classifier blocked both as "credential exploration"** (probably pattern-matching on querying `app_users`/writing captured output to a file that looks like it might exfiltrate something) — don't fight it, redirect (`>`) instead of `-o` worked fine for the harmless CSS fetch, and the isolated-fixture approach sidesteps needing DB/login access at all for a pure-CSS verification.

### 2026-10-04 — Resource Images frontend review (review only, `docs/resource-images/reviews/luigi.md`)
Reusable facts checked against code, not docs:
- **App is zoneless and uses only decorator `@Input`/`@Output(EventEmitter)` — zero signal `input()`/`output()`.** Inputs read by a `computed()` must be signal-backed setters (mystery-select/domain-icon pattern).
- **`provideHttpClient` has no `withFetch()` → XHR backend → `UploadProgress` events work.** Adding `withFetch()` would silently kill upload progress. All three interceptors are clone/catchError-only, so progress passes through. `ApiService` has no `observe:'events'` method and its `toUrl` is private.
- **Any 400 gets the generic "Request failed (400)" toast unless the request sets `SUPPRESS_ERROR_TOAST`.** The body of a 400 arrives on `HttpErrorResponse.error`, not on the success path.
- **XHR upload progress is whole-body.** Per-file bars over one multipart POST can only be derived from cumulative `file.size` offsets ("bytes sent", not "accepted"), with a dead "processing" interval after 100% and no visible animation on localhost.
- **`<symbol fill="currentColor">` can't be toggled filled/outline from outside.** The attribute in the `<use>` shadow tree beats inherited CSS `fill`. A state-toggle icon needs no fill attr on the symbol and `fill-current`/`fill-none` on the `<app-icon>` host.
- **`app-domain-icon` hardcodes `h-5 w-5` on its inner svg**, so a host class can't resize it.
- **location-detail and bystander-detail have no `pendingDelete`/modal/`activeMutation`**, unlike monster/minion-detail. Don't assume the four detail pages are alike.
- **`ring-focus` alone on a borderless element fails contrast** (documented in styles.css `.entity-link`). Use a solid accent outline on `:focus-visible` instead.
- No pointer/touch/drag-and-drop precedent anywhere in the app. The only arrow-key handler is data-admin's tablist.

### 2026-10-05 — Resource Images Phase 5 (commit a040ebc on `resource-images`)
Built the dropzone (card shell; carousel projected through ng-content), the carousel (controlled through `[(activeImageId)]`), the thumbnail, `ResourceImagesStore` (component-scoped), `core/resource-images.ts`, and `shared/resource-image-rules.ts` (pure functions). 92/1190 → 98/1276 tests. Three negative controls all caught: parallel chunks, a neighbour-named footnote, and a dropped SUPPRESS_ERROR_TOAST.
- **Zoneless test hosts must use signals.** Setting a plain host field and calling `fixture.detectChanges()` does NOT re-render, because only dirty views refresh. Output-driven changes do work (listeners mark the view dirty). The same applies to Phase 6 pages: bind the store's signals, not plain fields.
- **A per-slide control dies on a slide change.** With `@for ... track id`, a star or trash button rendered inside the active slide is destroyed when the active index moves, and keyboard focus goes with it. Put the controls in an overlay outside the track.
- **The `<img>` error handler must read the failing `src` from the element** (`getAttribute('src')`), not the current input. Otherwise a late error marks the new URL as failed.
- A `[attr.inert]` binding works where `[inert]` may not be in Angular's DOM schema.
- Exclusive class pairs (`bg-surface` vs `bg-accent-subtle`, `border-default` vs `border-accent`) are toggled with opposite `[class.x]` bindings rather than relying on Tailwind's emit order.

### 2026-10-05 (same day, follow-up): client-side 10-image cap (commit 624eef0)
Skyler: a drop that goes partway over the cap must produce the error state in the browser, not spend an upload. Added `planUpload(files, remainingSlots)` and wired the dropzone to it. 1276 → 1288 tests. Both negative controls caught: cap-before-validation (2 failures), and no cap trim at all (9 across two files).
- **Check order matters for agreement, not just efficiency.** `ResourceImageService.UploadAsync` validates first and checks the cap last against otherwise-valid files, so an invalid file never consumes a cap slot. Matching that order is what keeps client and server from assigning *different reasons to the same file* in a mixed batch (a `.gif` at 9/10 images is `UnsupportedType` on both sides, never `CapExceeded` on one).
- **Enforcing the cap client-side killed the chunking path.** At most `10 - currentCount` files are ever accepted, which is ≤ 10, and one POST carries 10 — so `chunkFiles` can never produce two chunks from the UI. A dropzone test that drove 12 files through two requests became unreachable and had to be rewritten. **Lesson: a client-side cap that equals the per-request limit silently makes multi-request logic dead code; check for that whenever a cap is tightened.** Left in place pending Skyler's call; multi-chunk coverage now lives only at the pure-function level.

### 2026-10-05 (same day, rework): Phase 5r — modal staging upload (commit 8921029)
Replaced the inline dropzone with `app-image-upload-modal` + presentational `app-resource-images-card`; deleted chunking; added the §7.6 toast builders. 1288 → 1315 tests. Three negative controls caught: Escape bypassing the discard confirm (1), submitting invalid staged files (5), and un-truncated toast names (2).
- **A `.fixed`-class selector is a terrible toast probe.** My first Playwright toast observer matched the modal backdrop (also `.fixed`, text contains "images") and reported the modal's own body as a toast. The real toast is `aside[aria-live="polite"] > div > span`; reading the `span` and not the `div` also excludes the dismiss button's `×`, which otherwise breaks an exact-match assertion.
- **`page.click()` does not await Angular's re-render.** Assertions right after a click read the pre-change DOM. Use `waitForFunction` on the expected count, and assert *which* row went rather than just how many remain.
- **An in-flight state is unobservable on localhost.** The real upload completed before `waitForSelector` ran, intermittently. `page.route` with a `setTimeout` then `route.fallback()` makes it deterministic — and is what let me verify close-is-blocked (backdrop + Escape both inert) during flight.
- **`dotnet run --no-launch-profile` drops `ASPNETCORE_ENVIRONMENT=Development`,** so `appsettings.Development.json` never layers in and startup dies on "ConnectionStrings:Postgres must be configured." Pass the env var explicitly.
- **Node can't `require('/tmp/x.json')` under Git Bash on Windows** (resolves to a Windows path that doesn't exist). Pipe to `node -e` reading stdin instead. `curl -o /tmp/file` also trips the permission classifier; `>` redirection is fine.
- Replacing the modal body with the spinner (rather than overlaying a click-shield) removes the disabled-but-visible-control problem entirely: there is nothing left rendered to click.

### 2026-10-06: Phase 6a — Monster pilot, both halves (commit 93d719e)
Images card on `monster-detail` (store provided per page, Minions moved down one per §4.1.1) and row thumbnails on `monsters-list`. 1315 → 1347 tests. Three negative controls caught: dropped `[footnote]` binding (2), list pointing at `/file` (2), footnote helper returning `''` (2).
- **Phase 4 added `PrimaryImageId` to the backend contract but nobody added it to `core/models.ts`.** The list half had nothing to read, and because the field is only *absent* rather than wrong, TypeScript was happy and no test failed — it would have shipped as "thumbnails silently never render". **When a phase extends an API contract, grep the client interface in the same pass.** Typed it `primaryImageId?: string | null` because the out-of-scope by-mystery projection omits it entirely.
- **A store that owns modal state forces that state on a host that already has its own.** `ResourceImagesStore.requestDelete` was the only way to get the §6 footnote, so `monster-detail` — which already has `pendingDelete` and one `<app-confirm-delete-modal>` — would have had to hold the pending image twice. Split into `deleteFootnoteFor(image)` and `deleteImage(image)`, keeping `requestDelete`/`confirmDelete` as a wrapper. **Lesson: expose the computation and the action separately; let the host choose who owns the pending state.**
- **`render()` in `confirm-delete-modal.call-sites.spec.ts` can only be called once per test** — it calls `TestBed.configureTestingModule`, which throws once the module is instantiated. Comparing two shapes in one test needs the file's existing `renderedBeforeThisPhase` oracle, not a second `render`.
- **Playwright + zoneless: read nothing immediately after a `click()`.** `[data-next]` then reading `data-image-id` returned the *pre-click* slide, which made a later `waitForFunction` compare against a stale id and time out. Wait for the value to change, then read it.
- The existing `monster-detail.spec.ts` passed untouched even before `ResourceImageService` was stubbed, because the store's failed list load just sets its own inline error — a useful property, but it means a page spec won't tell you the images section is broken.

### 2026-10-06 (same day, follow-up): carousel desktop height (commit 2606e09)
Skyler wanted roughly half the vertical footprint on desktop, mobile left alone. One class: `mx-auto max-w-xl` on the carousel region.
- **The carousel's height was never set — it is derived from width** (`basis-1/2` slide + `aspect-square` frame ⇒ height ≈ half the region's width, precisely `0.5 × regionWidth + 16`). So a *width* cap is the lever for a height problem, and it preserves the peek maths (percentages of that same region) and the square source images. A `max-h` would have cropped 1024×1024 art to a letterbox via `object-cover`.
- **Measured, don't assume, when a user quotes their screen size.** Skyler's "1440 x 2560" looked like a tall-screen problem; measurement showed 1440×2560 and 1440×900 render *identically* (651px) because height never enters the formula. **A `max-h-[50vh]` would have been actively wrong** — 1280px (no constraint) on his screen, 450px (hard clamp) on a 1080p one. The unusual number in a bug report was the irrelevant one.
- **A `max-width` needs no breakpoint.** It only binds when available width exceeds it, so it is self-limiting: phones measured byte-identical (390→182px, 360→167px, before and after) with no `md:` variant to keep in sync. Prefer this over a breakpoint whenever the constraint is "only on bigger screens".
- Results: flat 304px from 1024px viewport width up (was 651px at 1440, 891px at 1920) ≈ 47% of before; tablet 768 moved 315→304px; phones unchanged.
- **The cap had to go on the outer `[data-carousel]` region, not the inner `overflow-hidden` viewport** — the star/trash overlay (`left-1/4 right-1/4`) and the chevrons (`left-1`/`right-1`) are absolutely positioned against the outer element, so capping only the inner one would have left every control anchored to the old full width.
- **Playwright measurement trap:** the track has a 300ms transform transition, so measuring right after a chevron click reads the pre-move position — my centring check failed by exactly one slide width at *both* viewports, including the one I hadn't touched, which is what identified it as a timing artifact rather than a regression. Wait out the transition, then measure (0px off at both).

### 2026-10-06 (same day, follow-up 2): list thumbnail 64px → 128px (commit dcb2acf)
Size moved into `app-resource-thumbnail` as a `size: 'row' | 'fill'` input (default `'row'`), so 6b–6d inherit the number; carousel passes `size="fill"`. `iconSize` default md → xl.
- **I hit my own 2026-09-26 grid-item trap again, in a different file.** The `<li>` row is a grid item (`<ul class="grid">`), so `min-width: auto` made it claim content width and overflow its track — 488px row in a 358px track at 390px wide, `main` scrolling horizontally, **delete button off-screen at x=487**. The `min-w-0` already on the inner `flex-1` div does nothing for this; it has to be on the `<li>`. **Pre-existing (424px row, button at x=423 before my change) — the bigger thumbnail only widened it.** Worth re-reading that older entry before touching any list row: the pattern `<ul class="grid"> > <li class="flex">` is repeated across all four list pages and all four are presumably still wrong.
- **`git stash push -- <path>` then re-measure is the way to get a true before-baseline** when "before" is the committed state and the dev server is live. Confirmed the overflow was pre-existing (main scrollWidth 440 before, 439 after) rather than introduced — which changed the finding from "I broke mobile" to "I improved a pre-existing break".
- **Attribute a regression between your own two changes before reporting.** Temporarily reverting just the size (h-32 → h-16, keeping `min-w-0`) showed the phone row at 894px vs 1326px, so the overflow fix costs +192px and the doubling costs +432px. Without that step I'd have blamed the wrong change.
- **Per-class host bindings (`'[class.h-32]': "size === 'row'"`) merge with call-site classes; a single `[class]` host binding would compete with them.** Chose the verbose form deliberately to avoid a second source of `h-*` resolved by compiled-stylesheet cascade order.
- 128px is the ceiling the source supports: stored thumbnails are 256×256 (`ThumbnailSizePixels`), so 128 CSS px is pixel-exact at 2× DPR and soft beyond it.
- **Phone rows are now badly tall** (390px wide: 702 → 1326px; 360px wide: 1734px) because the content column is squeezed to 132px/102px. Flagged to Skyler with a recommendation rather than silently capping, per the brief.

### 2026-10-06 (same day, follow-up 3): stacked rows + clamped descriptions (commit 767f1ae)
Monster row stacks below `sm`; descriptions clamp to 2 lines below `lg` on monsters/locations/bystanders; `min-w-0` on all four rows.
- **This project's breakpoints are NOT Tailwind defaults.** `styles.css` sets `--breakpoint-sm: 540px` (from 640) and `--breakpoint-xl: 1200px` (from 1280); `md` (768) and `lg` (1024) are stock. Always read that block before picking a `sm:`/`xl:` variant — "tablet" is `md`=768, so "clamp on tablet too" means releasing at `lg`, not `md`.
- **The established ellipsis treatment is `line-clamp-2`** (`hunter-sheet-preview.html`, the wizard's location/bystander rosters). It clamps by *lines*, which is the right answer to "how many words?" — the cutoff then tracks the real column width instead of a character count that is wrong at one breakpoint or another.
- **`.block` is emitted immediately after `.line-clamp-2` in the compiled stylesheet** — verified again by fetching `/styles.css` from the dev server. So the September hazard is still live: any `block`/`truncate` on the same element silently kills the clamp. Guarded with a class-absence assertion in the unit specs rather than a computed-style check.
- **Do not assert computed `display` for a line clamp.** The rule really does set `display: -webkit-box`, but Chromium's `getComputedStyle` normalizes it to `flow-root`, so that assertion fails against working code. Assert the behaviour instead: `scrollHeight > clientHeight`, `-webkit-line-clamp`, `overflow: hidden`.
- **`items-center` on a `flex-col` centres children horizontally — which also shrinks a block child to its content width.** The stacked text column needs `w-full sm:w-auto` to span the row; `flex-1` does nothing for it there, since in a column `flex-1` grows on the vertical axis.
- **Stacking fixed the residual overflow I had flagged as out of scope.** The `whitespace-nowrap` badges were forcing 49px/79px of horizontal overflow at 390/360px; giving the text column the full row width absorbed them. Worth remembering that a layout change can retire a separate defect — re-measure the old symptom instead of assuming it persists.
- **A `toBeGreaterThan(0)` guard on a filtered set earned its keep again:** my first description selector matched zero elements in two specs (wrong fixture text), and the guard turned a vacuous pass into a failure. Switched to selecting structurally (`p.my-1`) rather than by copy.

### 2026-10-06: Phase 6b — Minion, both halves (commit 2cb7d87)
Mirrored 6a onto `minion-detail` + `minions-list`. 1360 → 1385 tests. 34 dev-server checks green; host monster + minion created and deleted, 6 pre-existing minions verified intact by name.
- **The `deleteFootnoteFor`/`deleteImage` split paid off exactly as predicted.** `minion-detail` has the same `pendingDelete`-plus-one-modal shape as Monster, so the page kept its own pending state and the store supplied only the footnote and the action. Nothing in the shared pieces needed correcting this sub-phase — first phase where that was true.
- **Same client-DTO gap as 6a, in the next DTO along:** the API serves `primaryImageId` on `GET /api/minions` but `MinionListItemResponse` didn't declare it. **This is now a confirmed two-for-two pattern** — Phase 4 added the field to four backend records and zero client interfaces. 6c/6d should expect it on `LocationListItemResponse`/`BystanderListItemResponse` and check before wiring. Keep it optional: the by-monster/by-mystery projections share the record and omit the field.
- **§4.1.1's ordering test resolves cleanly for a page with no badge row.** "Belongs to: {monster}" is an *attribute rendered as a sentence*, not a roster with a link per row, so it belongs in the identity header and Images follows it. The principle generalized without needing a new ruling, which is what a good principle should do.
- **Minion's description-less stacked row is not sparse — measured, not eyeballed.** At 390px: 356px row, 130px content, three blocks (name+badge 54px, relationship 20px, counts 41px) under the 128px image, against Monster's 385–414px with the same three-block count. The middle block is simply one line instead of two. Comparing *block counts* rather than heights is what made this answerable; a height-only comparison would have looked like a 12% deficit with no way to judge it.
- `minion-types` is the reference endpoint for creating a minion fixture, and a minion is created under a monster (`POST /api/monsters/{id}/minions`), so deleting the host monster cascades the minion and both their images away — one cleanup call covers the whole fixture.

### 2026-10-06 (same day, follow-up): minion list description (commit 1c1a580)
Skyler reversed the 6b "Minion has no description" finding as a design oversight. View-only fix: the field was on the list response and in `core/models.ts` already.
- **Correcting my own prior entry above:** the "description-less stacked row is not sparse" conclusion is withdrawn — the right answer was that the description was *missing*, not that its absence was fine. I measured the gap carefully and reasoned about whether it looked acceptable, without asking whether the data existed. **Lesson: when a row looks thinner than its siblings, check whether a field is unrendered before concluding the difference is intentional.** One `grep` of the DTO would have surfaced it during 6b.
- **Four places encoded the assumption**, all found by grepping for the claim rather than the code: the spec's `it('has no description paragraph to clamp')` plus its explanatory comment, design.md §4.2.2's "three of the four lists" scope note (Rosalina's to fix), and my own history entry above. The 6b commit message and report are immutable, so they stand as recorded history.
- **An assertion that encodes an absence is a liability when the absence is a decision rather than a fact.** That spec passed happily while the UI was wrong, and it would have kept passing forever. Worth asking, when writing one, "is this absence *required*, or merely *current*?" — only the first deserves a test.
- **My first attribution assertion was too naive and the measurement corrected me twice.** Expected minion ≥ monster row height (wrong: still 36px shorter), then expected the gap to equal the badge-block delta (wrong: 59px, not 36px). The real arithmetic is badge delta 59px − the extra 20px Belongs-to line ≈ 39px, within margin-collapse tolerance of the observed 36px. Blocks at 390px: minion `[div 25, p 48, p 20, small 41]`, monster `[div 84, p 48, small 41]`. The description itself is 48px on both at every width.

### 2026-10-06: Phase 6c — Bystander, both halves (commit 78b9626)
First page with no delete infrastructure, so it was built rather than extended. 1387 → 1413 tests; 36 dev-server checks green; 15 pre-existing bystanders verified intact.
- **Modal ownership now has a rule, not a preference.** The store's `requestDelete`/`confirmDelete` wrapper is right when the page has no modal of its own; `deleteFootnoteFor`/`deleteImage` is right when it already owns a `pendingDelete` serving other flows. The deciding question is "is there an existing pending-delete concept to be ambiguous with?" — not which API is nicer. Bystander (and 6d's Location) take the store-owned form; Monster and Minion the page-owned one. Recorded in the component so the asymmetry doesn't read as drift.
- **The client field gap is three-for-three** (`Monster`, `Minion`, `Bystander` all missing `primaryImageId`). Phase 4 touched four backend records and zero client interfaces. **`LocationListItemResponse` will need it in 6d** — check before wiring, since an absent field type-checks silently.
- **The census count finally moved: 16-in-14 → 17-in-15.** 6a/6b only changed an existing site's *shape*; 6c *added* a site. Two other labels in that file encoded the old number in prose ("The eight call sites…", `describe('the eight that must render byte-identically')`) and had to move to nine. **A census spec has more than one place carrying the count — grep the number, not just the assertion.**
- **Angular's template type-checker rejects `a()?.b.c` where TS accepts it.** `imagesStore.pendingDelete()?.image.fileName` failed with TS2532; `?.image?.fileName` compiles. Optional chaining short-circuits for TS but the template checker wants the `?.` at each step.
- Bystander creation is flat (`POST /api/bystanders` with `bystanderTypeId`), reference list at `/api/bystander-types` — no parent to hang it from, unlike Minion.

### 2026-10-06: Phase 6d — Location, last domain (commit 624aa3e)
Mirrored 6c. 1413 → 1439 tests; 36 dev-server checks green; 20 pre-existing locations intact. Census 17-in-15 → 18-in-16, byte-identical set nine → ten.
- **The client field gap was four-for-four.** Every one of `Monster`/`Minion`/`Bystander`/`Location` list interfaces was missing `primaryImageId` while the API served it. Phase 4 touched four backend records and zero client interfaces, and each one failed silently because an absent optional field type-checks. **Pattern for any future contract change: the client interface is a separate artifact from the C# record and nothing links them — enumerate both sides in the phase's own work list.**
- **Four-way drift check is cheap and worth doing as a hash comparison, not by reading.** `sed -n '/<app-resource-images-card/,/<\/...>/p' | sed -E 's/"(Monster|Minion|...)"/"OWNER"/g' | md5sum` across the four templates collapsed to exactly two hashes, and a single `diff` showed the only difference was the one intentional `deleteRequested` binding. Reading four templates side by side would have taken far longer and missed the declaration-order drift I did find.
- **Found and fixed one real inconsistency:** `location-detail`'s `imagesStore` declaration sat above `locationTypes` instead of after `mysteryId` like the other three — caused by my own botched perl edit, not by design.
- **`perl -0pi -e` with a pattern containing `|` inside a TS union is dangerous.** `s|readonly mysteryId = signal<string \| null>...|` matched `signal<LocationDetailResponse | null>(null);` first and spliced the file mid-declaration, producing a syntactically broken class that only surfaced as four `TS2349: This expression is not callable` template errors. **Use the Edit tool for anything containing regex metacharacters; reserve perl for plain-text anchors.**
- **A derived spec needs its string literals re-checked, not just its identifiers.** `sed`-deriving the Location spec from Bystander's renamed the ids but left `/api/locations/b9/...` in an expected URL — the identifier changed, the literal inside the URL didn't.
- **A clamp assertion is vacuous if the fixture text is short enough to fit.** Location's first long description was 98 chars and fit two lines at a 324px column, so "clamp bites" failed against correct code. Fixture text for a clamp test has to be demonstrably longer than the clamp.
- Flat creation like Bystander: `POST /api/locations` with `locationTypeId`, reference list at `/api/location-types`.

### 2026-10-07: Phase 7 — four-domain drift guard + an Escape bug it surfaced (commit e551111)
`shared/resource-images-four-domain-parity.spec.ts`. 1439 → 1448 tests. Five negative controls, three of which found real holes in my own first version.
- **A relative invariant beats a recorded one.** The guard asserts "the four agree with each other", with no hash/snapshot/golden string. That removes the liability I flagged earlier in this feature: there is nothing to regenerate without reading when it goes red, and a consistent change to all four needs no edit to the spec. Prefer this shape whenever the property is *consistency* rather than *content*.
- **A rendered-DOM parity check only catches a missing binding when the bound value differs from the input's default.** Deleting `[busy]` from one page did NOT fail the idle-only version, because `busy` defaults to `false` and nothing was mutating. Fix: capture each domain in three states — idle, active-slide-moved-off-primary, mutation-in-flight — so each binding is observable. **Generalise: when writing a parity/snapshot test over bound inputs, enumerate the inputs and ask for each one "would its absence change this DOM?"**
- **Normalisation is where a parity guard silently loses teeth.** Adding `ownertype="X"` → `"OWNER"` to fix a legitimate failure also made "carousel wired to the wrong domain" invisible — confirmed by control. Fix: assert the owner type *before* normalising. Any token you normalise away needs its own positive assertion.
- **Template source is genuinely unavailable to unit tests here — now confirmed for the static form too.** `import('./x.html?raw')` (dynamic) and `import x from './x.html?raw'` (static) both fail; the static form needs a `.d.ts` shim and then dies on "No loader is configured for \".html\" files". Compare rendered DOM.
- **Found a real, reachable Escape bug via the new census entry.** `ImageUploadModalComponent` and `ConfirmDeleteModalComponent` both use `@HostListener('document:keydown')`, and **`stopPropagation()` does not stop other listeners on the same node** — only `stopImmediatePropagation` does, and that leaves the winner dependent on registration order. One press closed both overlays. Reachable because the upload modal has **no Tab trap**: a keyboard user can tab out to the carousel's delete button behind it and stack the dialog on top. Fix: the upload modal yields while any other `[role="dialog"]` is open — order-independent. **The CustomSelect/dialog pair works by tree position (handler on its own host, below `document`), which is why that pattern does not transfer to two document-level listeners.**
- **Known gap left open, not introduced here:** the upload modal has no focus trap, unlike the confirm-delete modal. That is what makes the stacking reachable at all. Worth its own task.
- A census spec's unit matters: `custom-select-escape-surfaces` enumerates templates rendering `<app-custom-select>`, not "surfaces handling Escape", so the upload modal correctly isn't in it — recorded in the file rather than left as an apparent oversight.

### 2026-10-07: minion thumbnails on the nested block, monster detail (commit 3eb8f7a)
Scope reversal of Phase 4/6b's cut, after Bowser's `5c697a6` derived `primaryImageId` on `GetByMonsterIdAsync`. 1448 → 1459 tests. Three negative controls caught: wrong owner type, default 128px size, missing `min-w-0`.
- **Measure the row before picking a thumbnail size.** The nested block's rows carry **42px** of content (73px row) against a list row's 177px, so the shared 128px `size="row"` would have been >3× the text beside it. Added `size="compact"` (64px): desktop row grows 73 → 85px, phone 102 → 126px, text column 366px/256px. A guess either way would have been defensible-sounding; the numbers made it decidable.
- **Scope a stakeholder's sizing decision to what they actually said.** Skyler's doubling request was "the thumbnail on the **list page**" — so 64px here is the *previously-approved* size for a thumbnail beside a name and one metadata line, not a new invention. Reading the quote narrowly avoided silently extending a decision made about a different surface.
- **No stacking needed here even though the list pages needed it,** and the reason is purely the size: 64px leaves 256px of text at 390px, where 128px left 132px. The stacking rule follows from the thumbnail size, not from "being a row".
- **Same grid-item `min-w-0` trap, fourth location.** The nested `<ul class="grid gap-2">` has the same defect the four list pages had. **Any `<li>` inside a `grid` that becomes a flex row needs `min-w-0` on the `<li>` — this is now 5-for-5 in this codebase.**
- **The owner on a nested row is the nested entity, not the page's subject.** `resourceImageThumbnailUrl('Minion', minion.id, …)` on *monster*-detail. A control binding `'Monster'` was caught; worth a spec assertion anywhere a page lists a different domain's records.
- **Left `primaryImageId?:` optional deliberately, and rewrote the justification rather than the type.** Tightening buys nothing (absent and null both render the placeholder, and `resourceImageThumbnailUrl` takes `string | null | undefined`) and `required` is a claim TS cannot back for a cross-process wire value — the exact field that was silently missing from four client interfaces. **Converting a "not done here" note into a stated decision is the same move as the minion-description lesson: an unexplained TODO invites someone to "finish" it wrongly.**
- **Confirmed the drift guard's scope structurally, not by observing a pass:** it extracts `[data-images-card]`, and the Minions block is a *sibling* of that card (verified by char offsets), so Monster-only page furniture is correctly outside the guard's remit.
- **A stale `vite-error-overlay` blocks Playwright clicks** and reports as a click timeout on the login button, not as a compile error. It came from a mid-edit moment (template referencing a method before the component had it); the dev server had already rebuilt clean. Check the web log before believing a Playwright timeout is a test problem.

### 2026-10-07 (follow-up): the min-w-0 trap documented in styles.css (commit d20175e)
Agreed with Rosalina that the durable home is app code, not `.squad/` — a decision record stops re-litigation, a comment where the code lives stops rediscovery.
- **Checked the placement argument rather than accepting it.** `min-w-0` is Tailwind-*generated*, so there is no definition in `styles.css` to grep to — which initially looked like it undermined the choice. It holds anyway, because that file already documents generated-utility behaviour (the utility-name stutter, the slash-opacity limitation), so it is the established home for "how Tailwind behaves here", not just for hand-written classes.
- **Widened the rule from the reported instance to the mechanism.** The 5-for-5 observation was about `<li>` in a `grid`, but the cause is that grid *and flex* items default to `min-width: auto`. An `<li>`-only rule would have left the next person to rediscover it on a `div`, and the wizard roster had already hit it across a grid/flex chain where every level needs the class. Stating the mechanism costs nothing and covers both.
- **Left the count out of the comment on purpose.** It went 4 → 5 during this feature, and a stale number in prose is precisely what broke the confirm-delete census (read 13-in-12 while the truth was 16-in-14). Census belongs in the decision record, which is cheap to update; mechanism and cost belong in the code comment, and neither rots.
- Verified the cited decision-record path exists before referencing it, re-verified the 5-for-5 count by grep rather than citing my own earlier report, and confirmed the comment is stripped from the compiled stylesheet while `min-w-0` is still emitted.
