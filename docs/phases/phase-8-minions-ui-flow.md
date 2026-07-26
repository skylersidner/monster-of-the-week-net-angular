# Phase 8 — Minions UI Flow

## Decisions

Resolved before implementation begins.

| # | Question | Decision |
|---|----------|----------|
| 1 | **Navigation context** | **Option A** — Top-level `/minions` flat list with its own nav entry. Requires new `GET /api/minions` endpoint and extending `MinionListItemResponse` with monster ownership fields. |
| 2 | **Minion detail route shape** | **Standalone** — `/minions/:minionId`. Reachable from anywhere; back-link resolved via route state or service lookup. |
| 3 | **Custom moves** | **Skipped for Phase 8.** No custom moves section on minion detail. The `customMoves` field in the response is ignored in the UI until API endpoints ship. |
| 4 | **Monster detail inline section** | **Not needed** — Option A gives minions their own list page. Monster detail continues to show `minionCount`. |

---

## Summary

Add a complete Minions UI feature — list view and detail view — mirroring the Monsters feature in structure, component patterns, and styling. Minions are always children of a Monster at the data layer, which creates one meaningful architectural choice (see below) but otherwise follows the established pattern exactly.

---

## Architectural Decision: Navigation Context

### Option A — Top-Level `/minions` Route (Flat List)

Minions get their own top-level nav entry and a flat list page at `/minions`, exactly mirroring `/monsters`.

**Pros:** Consistent nav experience. Users can browse all minions regardless of which monster owns them.

**Cons:** Requires a new `GET /api/minions` API endpoint (no such endpoint exists today). The flat list must surface "which monster" each minion belongs to — this requires either joining against the monster table on the API side or a separate lookup.

**Requires:**
- New endpoint: `GET /api/minions` in `MinionsController.cs`
- New service method: `getAll()` in `MinionService`
- `MinionListItemResponse` extended (or a new variant) to include `monsterId` and `monsterName`

### Option B — Monster-Contextual (No New API Endpoint)

Minions are always shown within their parent monster. The monster detail page gets an inline Minions section (list + add). Clicking a minion opens a shared detail route at `/minions/:minionId`.

**Pros:** No API changes. Architecturally honest — minions have no meaning outside a monster. Simpler implementation.

**Cons:** No standalone "all minions" view. Nav does not include Minions as a top-level entry.

**Requires:**
- Add minions inline section to `monster-detail.html` / `monster-detail.ts`
- Shared `/minions/:minionId` detail route (reachable via deep link from monster detail)

**Recommendation:** Option B is lower risk and API-honest. Option A is the better UX if a "browse all minions" workflow is valued. Flag for Skyler to decide.

---

## Scope

### What is NOT changing

- Minion API endpoints (attacks, powers, armors, weaknesses) — already complete
- Angular models in `models.ts` — all interfaces already defined
- `MinionService` read/create/delete methods — already implemented
- Minion EF entities and migrations — complete since Phase 2

### What IS changing

- `MinionService`: add missing update methods for all sub-resources
- New `features/minions/` Angular feature module with list + detail components
- Route registration in `app.routes.ts`
- Nav link in layout component
- Conditionally: `MinionsController.cs` (Option A only), `monster-detail` component (Option B or Option A inline enhancement)

---

## Sub-Phases

### Phase 8a — Service Layer Completeness

**Goal:** Close the gap between what the API supports and what `MinionService` exposes. This phase is required regardless of which navigation option is chosen.

**Work:**

Add the following methods to `src/web/.../app/core/minion.ts`:

```typescript
updateAttack(minionId: string, attackId: string, request: UpsertMinionAttackRequest): Observable<MinionAttackResponse>
removeAttackWeaponTag(minionId: string, attackId: string, tagId: string): Observable<void>
updatePower(minionId: string, powerId: string, request: UpsertMinionPowerRequest): Observable<MinionPowerResponse>
updateArmor(minionId: string, armorId: string, request: UpsertMinionArmorRequest): Observable<MinionArmorResponse>
updateWeakness(minionId: string, weaknessId: string, request: UpsertMinionWeaknessRequest): Observable<MinionWeaknessResponse>
```

Map each to the corresponding `PUT` endpoint already present in `MinionsController`.

**If Option A selected — also add:**
```typescript
getAll(): Observable<MinionListItemResponse[]>
```
Backed by `GET /api/minions` (new endpoint, see below).

**If Option A selected — also add to `MinionsController.cs`:**
```csharp
[HttpGet("/api/minions")]
public async Task<IActionResult> GetAll(CancellationToken ct)
```
Implementation: query all minions via `IMinionRepository`. `MinionListItemResponse` will need `MonsterId: Guid` and `MonsterName: string` fields added (API contract change + mapper update).

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/core/minion.ts`
- *(Option A only)* `src/api/MonsterOfTheWeek.Api/Controllers/MinionsController.cs`
- *(Option A only)* `src/api/MonsterOfTheWeek.Api/Contracts/ApiContracts.cs`
- *(Option A only)* `src/api/MonsterOfTheWeek.Api/Contracts/ApiMappers.cs`
- *(Option A only)* `src/api/MonsterOfTheWeek.Api/Repositories/IMinionRepository.cs` + `MinionRepository.cs`

**Verification:**
- `dotnet build MonsterOfTheWeek.slnx` passes
- `npm run build` passes
- *(Option A)* `GET /api/minions` returns 200 with correct payload shape

---

### Phase 8b — Minion List View

**Goal:** Create the `features/minions/` feature module and the list component. Register the route and add the nav link.

**Work:**

Create feature module structure:

```
src/web/.../features/minions/
  minions.routes.ts
  pages/
    minions-list/
      minions-list.ts
      minions-list.html
      minions-list.scss
```

**`minions.routes.ts`:**
```typescript
export const MINIONS_ROUTES: Routes = [
  { path: '', component: MinionsListComponent },
  { path: ':minionId', loadComponent: () =>
      import('./pages/minion-detail/minion-detail').then((m) => m.MinionDetailComponent) }
];
```

**`minions-list.ts` (Option A — flat list):**
- `OnInit`: call `minionService.getAll()`, store in signal
- Display cards with: Name, MinionType badge, HarmCapacity, attack/power/armor/weakness counts, monster name ("Belongs to: {MonsterName}"), link to detail

**`minions-list.ts` (Option B — inline in monster detail):**
- No standalone list component
- Instead: update `monster-detail.ts` to call `minionService.getByMonster(monsterId)` and render an inline Minions section
- Inline section: list items with name, type badge, link to `/minions/:minionId`
- Add minion form (name, description, harmCapacity, minionType) inline — calls `minionService.create(monsterId, request)`

**Register route in `app.routes.ts`:**
```typescript
// Option A:
{ path: 'minions', loadChildren: () =>
    import('./features/minions/minions.routes').then((m) => m.MINIONS_ROUTES) }

// Option B: route still needed for the detail view even without a list
{ path: 'minions', loadChildren: () =>
    import('./features/minions/minions.routes').then((m) => m.MINIONS_ROUTES) }
```

**Add nav link** to layout nav component:
- *(Option A)* Add "Minions" entry in the primary nav alongside Monsters, Locations, etc.
- *(Option B)* Omit from primary nav; minions are accessed from Monster detail only

**Files created:**
- `src/web/monster-of-the-week-web/src/app/features/minions/minions.routes.ts`
- `src/web/monster-of-the-week-web/src/app/features/minions/pages/minions-list/minions-list.ts`
- `src/web/monster-of-the-week-web/src/app/features/minions/pages/minions-list/minions-list.html`
- `src/web/monster-of-the-week-web/src/app/features/minions/pages/minions-list/minions-list.scss`

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/app.routes.ts`
- `src/web/monster-of-the-week-web/src/app/layout/` *(nav component — exact filename TBD from codebase)*
- *(Option B)* `src/web/monster-of-the-week-web/src/app/features/monsters/pages/monster-detail/monster-detail.ts`
- *(Option B)* `src/web/monster-of-the-week-web/src/app/features/monsters/pages/monster-detail/monster-detail.html`

**Verification:**
- `npm run build` passes
- Navigating to `/minions` (Option A) or opening a Monster detail (Option B) shows minion list
- Each minion card links to `/minions/:minionId`

---

### Phase 8c — Minion Detail View

**Goal:** Create the `minion-detail` component with reactive forms and all sub-resource panels. Mirror `monster-detail` exactly, adjusted for minion-specific fields.

**Work:**

Create:
```
src/web/.../features/minions/pages/minion-detail/
  minion-detail.ts
  minion-detail.html
  minion-detail.scss
  minion-detail.spec.ts
```

**`minion-detail.ts`:**
- Load minion detail + reference data in `forkJoin` on `OnInit` (mirrors monster-detail pattern):
  ```typescript
  forkJoin({
    minion: this.minionService.getById(minionId),
    minionTypes: this.referenceService.getMinionTypes(),
    weaponTags: this.referenceService.getWeaponTags()
  })
  ```
- Reactive form: `name`, `description`, `harmCapacity`, `minionTypeId`
- Signal-based loading and mutation state
- Sub-resource panels — one each for: **Attacks** (with weapon tags), **Powers**, **Armors**, **Weaknesses**
- Custom moves: render read-only list from `customMoves` in response; add a visible note that create/edit is not yet supported (no API endpoints). Do not add create/edit UI until API endpoints exist.
- Back-link: "← Back to {MonsterName}" — requires knowing the parent monster. Source this from either the route state (if navigated from monster detail) or a `getById` call that returns the monsterId + resolves the name. Provide a fallback "← Back to Monsters" if parent context is unavailable.

**Sub-resource panel pattern (identical to monster-detail):**
- Each panel: add form + list of existing items
- Attack panel: add form includes name, description, harmValue, weaponTag multi-select; list items show all fields + weapon tags; delete button per item; edit supported via `updateAttack`
- Powers / Armors / Weaknesses panels: add form with name + description; list + delete + edit per item

**Key difference from `monster-detail`:** No mysteries section. Minions have `harmCapacity` (integer field) instead of the monster's harm and armor fields. Adjust the form layout accordingly.

**Files created:**
- `src/web/monster-of-the-week-web/src/app/features/minions/pages/minion-detail/minion-detail.ts`
- `src/web/monster-of-the-week-web/src/app/features/minions/pages/minion-detail/minion-detail.html`
- `src/web/monster-of-the-week-web/src/app/features/minions/pages/minion-detail/minion-detail.scss`
- `src/web/monster-of-the-week-web/src/app/features/minions/pages/minion-detail/minion-detail.spec.ts`

**Verification:**
- Clicking a minion from the list opens its detail page
- Edit form saves name/description/harmCapacity/minionType via PUT
- Each sub-resource panel: add creates, delete removes, edit updates
- Back-link returns to the appropriate parent view
- Custom moves list renders; no create/edit UI present

---

### Phase 8d — Tests, Polish, and Edge Cases

**Goal:** Close coverage gaps, add UX polish consistent with the rest of the app (established in Phase 6).

**Work:**

**Vitest unit tests (`minion-detail.spec.ts`):**
- Component mounts with mocked `MinionService` and `ReferenceDataService`
- `forkJoin` loading state: spinner visible before data, hidden after
- Form patch: correct initial values from `MinionDetailResponse`
- Save: `minionService.update()` called with correct payload; toast fires on success
- Attack add: `minionService.createAttack()` called; list updates
- Attack delete: confirm dialog appears; `minionService.deleteAttack()` called on confirm; skipped on cancel
- Weapon tag assign/remove: `assignAttackWeaponTag` / `removeAttackWeaponTag` called correctly
- Custom moves: read-only section renders items; no create/edit controls visible

**Vitest unit tests (`minions-list.spec.ts` — Option A only):**
- List renders correct number of cards from mocked `getAll()` response
- "Belongs to" monster name visible per card
- Delete (if added to list) triggers confirm dialog

**UX polish (mirrors Phase 6 patterns):**
- Loading spinner on initial data fetch
- Mutation loading state on save buttons (disabled + spinner while in-flight)
- Success toast on: minion save, attack/power/armor/weakness add/delete
- Confirm dialog on: attack delete, power delete, armor delete, weakness delete
- Error state: if detail load fails, show error message with retry link

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/features/minions/pages/minion-detail/minion-detail.spec.ts` *(filled in)*
- `src/web/monster-of-the-week-web/src/app/features/minions/pages/minions-list/minions-list.ts` *(loading + error states added)*

**Verification:**
- `npm run test -- --watch=false` passes (all new specs green)
- Confirm dialog appears on sub-resource delete; cancel preserves item
- Toast fires on every successful mutation
- Loading indicator visible on slow network (can verify with throttling in DevTools)

---

## Files Affected Summary

| File | Status | Phase | Notes |
|------|--------|-------|-------|
| `src/web/.../core/minion.ts` | Modified | 8a | Add 5 update methods; `getAll()` if Option A |
| `src/api/.../Controllers/MinionsController.cs` | Modified | 8a | Option A only: add `GET /api/minions` |
| `src/api/.../Contracts/ApiContracts.cs` | Modified | 8a | Option A only: extend `MinionListItemResponse` |
| `src/api/.../Contracts/ApiMappers.cs` | Modified | 8a | Option A only: update mapper |
| `src/api/.../Repositories/IMinionRepository.cs` | Modified | 8a | Option A only: add `GetAllAsync` |
| `src/api/.../Repositories/MinionRepository.cs` | Modified | 8a | Option A only: implement `GetAllAsync` |
| `src/web/.../features/minions/minions.routes.ts` | **New** | 8b | Route definitions |
| `src/web/.../features/minions/pages/minions-list/minions-list.ts` | **New** | 8b | Option A only (standalone list) |
| `src/web/.../features/minions/pages/minions-list/minions-list.html` | **New** | 8b | Option A only |
| `src/web/.../features/minions/pages/minions-list/minions-list.scss` | **New** | 8b | Option A only |
| `src/web/.../app/app.routes.ts` | Modified | 8b | Register minions lazy route |
| `src/web/.../layout/` *(nav component)* | Modified | 8b | Option A: add nav link; Option B: omit |
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.ts` | Modified | 8b | Option B: add inline minions section |
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.html` | Modified | 8b | Option B: add inline minions section |
| `src/web/.../features/minions/pages/minion-detail/minion-detail.ts` | **New** | 8c | Detail component logic |
| `src/web/.../features/minions/pages/minion-detail/minion-detail.html` | **New** | 8c | Detail template |
| `src/web/.../features/minions/pages/minion-detail/minion-detail.scss` | **New** | 8c | Detail styles |
| `src/web/.../features/minions/pages/minion-detail/minion-detail.spec.ts` | **New** | 8c/8d | Tests |

> All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|-----|-------|--------------------|
| No `GET /api/minions` endpoint | Only `GET /api/monsters/{monsterId}/minions` exists | Required for Option A; not needed for Option B |
| `MinionService` missing 5 update methods | PUT endpoints exist on controller; service never wired them | Fix in Phase 8a (required regardless of option) |
| Custom moves in `MinionDetailResponse` | Field exists in contract; no API endpoints to create/edit them | Render read-only in 8c; add create/edit only when API endpoints ship |
| `MinionListItemResponse` lacks `monsterId`/`monsterName` | Required if Option A is chosen for the "belongs to" indicator | Add in 8a if Option A |
| Back-link parent context | Detail route is standalone; parent monsterId may not always be in route params | Use route state or resolve via service; fallback to "← Monsters" |

---

## Verification Checklist

- [ ] `dotnet build MonsterOfTheWeek.slnx` passes with no warnings
- [ ] `dotnet test MonsterOfTheWeek.slnx` passes (if Phase 8a adds API code, add corresponding xUnit tests)
- [ ] `npm run build` passes with no errors
- [ ] `npm run test -- --watch=false` passes (all new vitest specs green)
- [ ] *(Option A)* `GET /api/minions` returns 200 with `monsterId` and `monsterName` on each item
- [ ] *(Option A)* `/minions` route renders list; cards show monster ownership
- [ ] *(Option B)* Monster detail page shows Minions section; add form creates new minion
- [ ] `/minions/:minionId` route renders detail for any minion
- [ ] Edit form saves correctly; success toast fires
- [ ] All sub-resource panels (attacks, powers, armors, weaknesses) support add + edit + delete
- [ ] Weapon tag assignment works on attack create (and update if applicable)
- [ ] Custom moves section renders read-only with no create/edit UI
- [ ] Confirm dialog fires on every sub-resource delete; cancel preserves item
- [ ] Back-link on minion detail navigates to parent monster
- [ ] Loading spinner visible during data fetch; mutation buttons disabled during in-flight requests
- [ ] `docker compose up -d postgres && dotnet run` workflow unaffected
