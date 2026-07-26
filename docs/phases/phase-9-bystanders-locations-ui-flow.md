# Phase 9 — Bystanders & Locations UI Flow

## Decisions

Resolved before implementation begins.

| # | Question | Decision |
|---|----------|----------|
| 1 | **Navigation context** | **Top-level flat lists** at `/bystanders` and `/locations`. Each gets its own primary nav entry, mirroring Monsters and Minions. Requires new `GET /api/bystanders` and `GET /api/locations` flat-list endpoints. |
| 2 | **Route shape** | **Standalone** — `/bystanders/:bystanderId` and `/locations/:locationId`. The existing detail components must be **refactored** to remove the `mysteryId` route param entirely. They should fetch by their own `id` only. |
| 3 | **Custom Moves** | **Included** — both detail views display a Custom Moves section as a read-only list. No create/edit UI until API endpoints for custom move management exist. |
| 4 | **Mystery associations** | **Skipped** — `MysteryIds` is present in all response contracts but is ignored in the UI for this phase. Do not display linked mysteries. |

---

## Summary

Add complete Bystanders and Locations UI features — list view and detail view for each — mirroring the Monsters and Minions pattern established in prior phases. Both entities share an identical structural shape (type reference, motivation, custom moves), so they can be developed in parallel after the API layer is in place. The primary work in this phase is: adding two flat-list API endpoints, creating two core services, refactoring two existing detail components to be standalone-routed, and creating two new list components.

---

## What Already Exists

### API Layer

| Item | Status |
|------|--------|
| `GET /api/bystanders/{id}` | ✅ Exists — used by detail component today |
| `PUT /api/bystanders/{id}` | ✅ Exists |
| `GET /api/mysteries/{mysteryId}/bystanders` | ✅ Exists — mystery-scoped list |
| `POST /api/mysteries/{mysteryId}/bystanders` | ✅ Exists |
| `DELETE /api/mysteries/{mysteryId}/bystanders/{id}` | ✅ Exists |
| `GET /api/bystanders` | ❌ **Missing — must be added** |
| `GET /api/locations/{id}` | ✅ Exists — used by detail component today |
| `PUT /api/locations/{id}` | ✅ Exists |
| `GET /api/mysteries/{mysteryId}/locations` | ✅ Exists — mystery-scoped list |
| `POST /api/mysteries/{mysteryId}/locations` | ✅ Exists |
| `DELETE /api/mysteries/{mysteryId}/locations/{id}` | ✅ Exists |
| `GET /api/locations` | ❌ **Missing — must be added** |
| `BystanderListItemResponse` contract | ✅ Exists in `ApiContracts.cs` |
| `BystanderDetailResponse` contract (including `CustomMoves`) | ✅ Exists in `ApiContracts.cs` |
| `LocationListItemResponse` contract | ✅ Exists in `ApiContracts.cs` |
| `LocationDetailResponse` contract (including `CustomMoves`) | ✅ Exists in `ApiContracts.cs` |

### Angular Frontend

| Item | Status |
|------|--------|
| `features/bystanders/pages/bystander-detail/` (4 files) | ✅ Exists — mystery-scoped; **must be refactored** |
| `features/locations/pages/location-detail/` (4 files) | ✅ Exists — mystery-scoped; **must be refactored** |
| `features/bystanders/pages/bystanders-list/` | ❌ Missing |
| `features/locations/pages/locations-list/` | ❌ Missing |
| `features/bystanders/bystanders.routes.ts` | ❌ Missing |
| `features/locations/locations.routes.ts` | ❌ Missing |
| `core/bystander.ts` service | ❌ Missing |
| `core/location.ts` service | ❌ Missing |
| `app.routes.ts` — bystanders route | ❌ Missing |
| `app.routes.ts` — locations route | ❌ Missing |
| `page-layout.ts` — Bystanders nav entry | ⚠️ Stub exists (`route: null`) — needs route assigned |
| `page-layout.ts` — Locations nav entry | ⚠️ Stub exists (`route: null`) — needs route assigned |

**Current routing situation:** Both detail components are registered inside `mysteries.routes.ts` at paths like `:mysteryId/bystanders/:bystanderId` and `:mysteryId/locations/:locationId`. Those registrations are what must be replaced (or supplemented — see note below).

> **Note on `mysteries.routes.ts`:** The existing mystery-scoped routes in `mysteries.routes.ts` may remain for now, since `mystery-detail` currently links to bystanders and locations using those paths. Removing them would break mystery detail links. In this phase, we add the new standalone routes. Removing the mystery-scoped versions is deferred.

---

## API Changes Needed

### 9a — Flat-List Endpoints

Both entities need a new `GET /api/{entity}` endpoint that returns all records regardless of mystery association. The existing `BystanderListItemResponse` and `LocationListItemResponse` contracts are already correct and require no modification.

#### Bystanders

**`IBystanderRepository.cs`** — add:
```csharp
Task<IReadOnlyList<Bystander>> GetAllAsync(CancellationToken ct);
```

**`BystanderRepository.cs`** — implement:
```csharp
public async Task<IReadOnlyList<Bystander>> GetAllAsync(CancellationToken ct) =>
    await _db.Bystanders
        .Include(b => b.BystanderType)
        .Include(b => b.MysteryBystanders)
        .OrderBy(b => b.Name)
        .ToListAsync(ct);
```

**`BystandersController.cs`** — add:
```csharp
[HttpGet("/api/bystanders")]
public async Task<IActionResult> GetAll(CancellationToken ct)
{
    var bystanders = await _bystanderRepository.GetAllAsync(ct);
    return Ok(bystanders.Select(ApiMappers.ToListItemResponse));
}
```

#### Locations

**`ILocationRepository.cs`** — add:
```csharp
Task<IReadOnlyList<Location>> GetAllAsync(CancellationToken ct);
```

**`LocationRepository.cs`** — implement:
```csharp
public async Task<IReadOnlyList<Location>> GetAllAsync(CancellationToken ct) =>
    await _db.Locations
        .Include(l => l.LocationType)
        .Include(l => l.MysteryLocations)
        .OrderBy(l => l.Name)
        .ToListAsync(ct);
```

**`LocationsController.cs`** — add:
```csharp
[HttpGet("/api/locations")]
public async Task<IActionResult> GetAll(CancellationToken ct)
{
    var locations = await _locationRepository.GetAllAsync(ct);
    return Ok(locations.Select(ApiMappers.ToListItemResponse));
}
```

**Files modified:**
- `src/api/MonsterOfTheWeek.Api/Repositories/IBystanderRepository.cs`
- `src/api/MonsterOfTheWeek.Api/Repositories/BystanderRepository.cs`
- `src/api/MonsterOfTheWeek.Api/Controllers/BystandersController.cs`
- `src/api/MonsterOfTheWeek.Api/Repositories/ILocationRepository.cs`
- `src/api/MonsterOfTheWeek.Api/Repositories/LocationRepository.cs`
- `src/api/MonsterOfTheWeek.Api/Controllers/LocationsController.cs`

**Verification:**
- `dotnet build MonsterOfTheWeek.slnx` passes
- `GET /api/bystanders` returns 200 with an array of `BystanderListItemResponse`
- `GET /api/locations` returns 200 with an array of `LocationListItemResponse`

---

## Frontend: Bystanders

### 9b — Core Service (`core/bystander.ts`)

Create `src/web/monster-of-the-week-web/src/app/core/bystander.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { BystanderListItemResponse, BystanderDetailResponse, UpsertBystanderRequest } from './models';

@Injectable({ providedIn: 'root' })
export class BystanderService {
  private readonly apiService = inject(ApiService);

  getAll(): Observable<BystanderListItemResponse[]> {
    return this.apiService.get<BystanderListItemResponse[]>('/api/bystanders');
  }

  getById(id: string): Observable<BystanderDetailResponse> {
    return this.apiService.get<BystanderDetailResponse>(`/api/bystanders/${id}`);
  }

  update(id: string, request: UpsertBystanderRequest): Observable<BystanderDetailResponse> {
    return this.apiService.put<UpsertBystanderRequest, BystanderDetailResponse>(
      `/api/bystanders/${id}`,
      request
    );
  }
}
```

**Files created:**
- `src/web/monster-of-the-week-web/src/app/core/bystander.ts`

---

### 9c — Refactor `bystander-detail` Component

The existing component reads `mysteryId` from route params and computes a back-link to `/mysteries`. Both behaviors must change.

**Changes to `bystander-detail.ts`:**
- Remove `mysteryId` signal and the `params.get('mysteryId')` extraction
- Remove the guard that throws when `mysteryId` is absent
- Replace `ApiService` injection with `BystanderService` (use `BystanderService.getById()`)
- Update `backLink` computed to always return `['/bystanders']`
- Route param key changes from `bystanderId` (already correct in this component) to `bystanderId` — no change needed there

**Before (key sections):**
```typescript
readonly mysteryId = signal<string | null>(null);

readonly backLink = computed(() => {
  const id = this.mysteryId();
  return id ? ['/mysteries', id] : ['/mysteries'];
});

// in ngOnInit:
const mysteryId = params.get('mysteryId');
const bystanderId = params.get('bystanderId');
if (!mysteryId || !bystanderId) {
  throw new Error('Mystery id and bystander id are required.');
}
this.mysteryId.set(mysteryId);
```

**After:**
```typescript
// Remove mysteryId signal entirely

readonly backLink = ['/bystanders'];

// in ngOnInit:
const bystanderId = params.get('bystanderId');
if (!bystanderId) {
  throw new Error('Bystander id is required.');
}
// Remove mysteryId.set() call
```

- Replace `ApiService` with `BystanderService` in constructor/inject; call `this.bystanderService.getById(bystanderId)` instead of `this.apiService.get<BystanderDetailResponse>(...)` directly.
- Remove `ApiService` import if no longer needed elsewhere in the component.

**Custom Moves:** The `BystanderDetailResponse` already includes `customMoves: IReadOnlyList<CustomMoveResponse>`. Add a read-only custom moves section to the template (see Custom Moves Display section below).

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/features/bystanders/pages/bystander-detail/bystander-detail.ts`
- `src/web/monster-of-the-week-web/src/app/features/bystanders/pages/bystander-detail/bystander-detail.html`
- `src/web/monster-of-the-week-web/src/app/features/bystanders/pages/bystander-detail/bystander-detail.spec.ts`

---

### 9d — New `bystanders-list` Page Component

Create:
```
src/web/.../features/bystanders/pages/bystanders-list/
  bystanders-list.ts
  bystanders-list.html
  bystanders-list.scss
```

**`bystanders-list.ts`:**
- `OnInit`: call `bystanderService.getAll()`, store result in a signal
- Display: loading state, error state, and a card grid when loaded
- Each card: Name, BystanderType badge, optional Description (truncated), link to `/bystanders/:id`

**`bystanders-list.ts` outline:**
```typescript
@Component({
  selector: 'app-bystanders-list',
  imports: [RouterLink],
  templateUrl: './bystanders-list.html',
  styleUrl: './bystanders-list.scss',
})
export class BystandersListComponent implements OnInit {
  private readonly bystanderService = inject(BystanderService);

  readonly bystanders = signal<BystanderListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.bystanderService.getAll().subscribe({
      next: (items) => {
        this.bystanders.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load bystanders.');
        this.isLoading.set(false);
      },
    });
  }
}
```

**Files created:**
- `src/web/monster-of-the-week-web/src/app/features/bystanders/pages/bystanders-list/bystanders-list.ts`
- `src/web/monster-of-the-week-web/src/app/features/bystanders/pages/bystanders-list/bystanders-list.html`
- `src/web/monster-of-the-week-web/src/app/features/bystanders/pages/bystanders-list/bystanders-list.scss`

---

### 9e — `bystanders.routes.ts`

Create `src/web/.../features/bystanders/bystanders.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const BYSTANDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/bystanders-list/bystanders-list').then((m) => m.BystandersListComponent),
  },
  {
    path: ':bystanderId',
    loadComponent: () =>
      import('./pages/bystander-detail/bystander-detail').then((m) => m.BystanderDetailComponent),
  },
];
```

**Files created:**
- `src/web/monster-of-the-week-web/src/app/features/bystanders/bystanders.routes.ts`

---

### 9f — Register Bystanders in `app.routes.ts` and `page-layout.ts`

**`app.routes.ts`** — add alongside monsters and minions:
```typescript
{
  path: 'bystanders',
  loadChildren: () =>
    import('./features/bystanders/bystanders.routes').then((m) => m.BYSTANDERS_ROUTES),
},
```

**`page-layout.ts`** — change `route: null` to `route: '/bystanders'` on the Bystanders nav item:
```typescript
{ label: 'Bystanders', route: '/bystanders', icon: 'bystanders', exactMatch: false },
```

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/app.routes.ts`
- `src/web/monster-of-the-week-web/src/app/layout/page-layout/page-layout.ts`

---

## Frontend: Locations

Locations are structurally identical to Bystanders. The same sub-phases apply in parallel.

### 9g — Core Service (`core/location.ts`)

Create `src/web/monster-of-the-week-web/src/app/core/location.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { LocationListItemResponse, LocationDetailResponse, UpsertLocationRequest } from './models';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly apiService = inject(ApiService);

  getAll(): Observable<LocationListItemResponse[]> {
    return this.apiService.get<LocationListItemResponse[]>('/api/locations');
  }

  getById(id: string): Observable<LocationDetailResponse> {
    return this.apiService.get<LocationDetailResponse>(`/api/locations/${id}`);
  }

  update(id: string, request: UpsertLocationRequest): Observable<LocationDetailResponse> {
    return this.apiService.put<UpsertLocationRequest, LocationDetailResponse>(
      `/api/locations/${id}`,
      request
    );
  }
}
```

**Files created:**
- `src/web/monster-of-the-week-web/src/app/core/location.ts`

---

### 9h — Refactor `location-detail` Component

Identical refactor to `bystander-detail`. Same changes, different entity names.

**Changes to `location-detail.ts`:**
- Remove `mysteryId` signal and extraction from route params
- Remove guard for missing `mysteryId`
- Replace `ApiService` injection with `LocationService`
- Update `backLink` to always return `['/locations']`
- Route param key `locationId` is already correct — no change

**Custom Moves:** `LocationDetailResponse` includes `customMoves`. Add the same read-only Custom Moves section to the template.

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/features/locations/pages/location-detail/location-detail.ts`
- `src/web/monster-of-the-week-web/src/app/features/locations/pages/location-detail/location-detail.html`
- `src/web/monster-of-the-week-web/src/app/features/locations/pages/location-detail/location-detail.spec.ts`

---

### 9i — New `locations-list` Page Component

Create:
```
src/web/.../features/locations/pages/locations-list/
  locations-list.ts
  locations-list.html
  locations-list.scss
```

Mirrors `bystanders-list` exactly. Each card: Name, LocationType badge, optional Description, link to `/locations/:id`.

**Files created:**
- `src/web/monster-of-the-week-web/src/app/features/locations/pages/locations-list/locations-list.ts`
- `src/web/monster-of-the-week-web/src/app/features/locations/pages/locations-list/locations-list.html`
- `src/web/monster-of-the-week-web/src/app/features/locations/pages/locations-list/locations-list.scss`

---

### 9j — `locations.routes.ts`

Create `src/web/.../features/locations/locations.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const LOCATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/locations-list/locations-list').then((m) => m.LocationsListComponent),
  },
  {
    path: ':locationId',
    loadComponent: () =>
      import('./pages/location-detail/location-detail').then((m) => m.LocationDetailComponent),
  },
];
```

**Files created:**
- `src/web/monster-of-the-week-web/src/app/features/locations/locations.routes.ts`

---

### 9k — Register Locations in `app.routes.ts` and `page-layout.ts`

**`app.routes.ts`** — add:
```typescript
{
  path: 'locations',
  loadChildren: () =>
    import('./features/locations/locations.routes').then((m) => m.LOCATIONS_ROUTES),
},
```

**`page-layout.ts`** — change `route: null` to `route: '/locations'` on the Locations nav item:
```typescript
{ label: 'Locations', route: '/locations', icon: 'locations', exactMatch: false },
```

Note: Both nav entry changes (Bystanders and Locations) can be made in the same `page-layout.ts` edit pass.

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/app.routes.ts`
- `src/web/monster-of-the-week-web/src/app/layout/page-layout/page-layout.ts`

---

## Custom Moves Display

Both `BystanderDetailResponse` and `LocationDetailResponse` include:
```typescript
customMoves: CustomMoveResponse[]  // { id, name, description }
```

### Pattern (read-only list, same as Monster/Minion detail would use)

In both detail templates, add a Custom Moves section below the main form:

```html
@if (entity().customMoves.length > 0) {
  <section>
    <h3>Custom Moves</h3>
    <ul>
      @for (move of entity().customMoves; track move.id) {
        <li>
          <strong>{{ move.name }}</strong>
          @if (move.description) {
            <p>{{ move.description }}</p>
          }
        </li>
      }
    </ul>
  </section>
} @else {
  <p>No custom moves defined for this entity.</p>
}
```

No create/edit controls. This section is display-only in Phase 9. A note in the component file (comment, not rendered UI) can mark it as "pending API endpoints for custom move management."

---

## Phase Breakdown and Execution Order

```
Phase 9a  ─── API: Add GET /api/bystanders and GET /api/locations
               (both can be done together — same pattern)

Phase 9b  ─── Create core/bystander.ts
Phase 9g  ─── Create core/location.ts
               (parallel — independent files)

Phase 9c  ─── Refactor bystander-detail (remove mysteryId, update back-link, add custom moves)
Phase 9h  ─── Refactor location-detail (same refactor)
               (parallel — independent components)

Phase 9d  ─── Create bystanders-list component
Phase 9i  ─── Create locations-list component
               (parallel — independent components)

Phase 9e  ─── Create bystanders.routes.ts
Phase 9j  ─── Create locations.routes.ts
               (parallel — independent files)

Phase 9f  ─── Register bystanders route in app.routes.ts + activate nav entry
Phase 9k  ─── Register locations route in app.routes.ts + activate nav entry
               (same file edits — do in one pass)
```

Bystanders and Locations are structurally identical and have no dependency on each other. After Phase 9a (API) is complete, all remaining sub-phases can be executed in parallel across the two entities. Within each entity, the service must exist before the list or refactored detail component references it.

---

## Files Affected Summary

| File | Status | Sub-Phase | Notes |
|------|--------|-----------|-------|
| `src/api/.../Repositories/IBystanderRepository.cs` | Modified | 9a | Add `GetAllAsync` |
| `src/api/.../Repositories/BystanderRepository.cs` | Modified | 9a | Implement `GetAllAsync` |
| `src/api/.../Controllers/BystandersController.cs` | Modified | 9a | Add `GET /api/bystanders` |
| `src/api/.../Repositories/ILocationRepository.cs` | Modified | 9a | Add `GetAllAsync` |
| `src/api/.../Repositories/LocationRepository.cs` | Modified | 9a | Implement `GetAllAsync` |
| `src/api/.../Controllers/LocationsController.cs` | Modified | 9a | Add `GET /api/locations` |
| `src/web/.../core/bystander.ts` | **New** | 9b | `getAll()`, `getById()`, `update()` |
| `src/web/.../core/location.ts` | **New** | 9g | `getAll()`, `getById()`, `update()` |
| `src/web/.../features/bystanders/pages/bystander-detail/bystander-detail.ts` | Modified | 9c | Remove `mysteryId`, update back-link, use `BystanderService` |
| `src/web/.../features/bystanders/pages/bystander-detail/bystander-detail.html` | Modified | 9c | Add custom moves section |
| `src/web/.../features/bystanders/pages/bystander-detail/bystander-detail.spec.ts` | Modified | 9c | Update tests for standalone route |
| `src/web/.../features/locations/pages/location-detail/location-detail.ts` | Modified | 9h | Remove `mysteryId`, update back-link, use `LocationService` |
| `src/web/.../features/locations/pages/location-detail/location-detail.html` | Modified | 9h | Add custom moves section |
| `src/web/.../features/locations/pages/location-detail/location-detail.spec.ts` | Modified | 9h | Update tests for standalone route |
| `src/web/.../features/bystanders/pages/bystanders-list/bystanders-list.ts` | **New** | 9d | Flat list component |
| `src/web/.../features/bystanders/pages/bystanders-list/bystanders-list.html` | **New** | 9d | Card grid template |
| `src/web/.../features/bystanders/pages/bystanders-list/bystanders-list.scss` | **New** | 9d | List styles |
| `src/web/.../features/locations/pages/locations-list/locations-list.ts` | **New** | 9i | Flat list component |
| `src/web/.../features/locations/pages/locations-list/locations-list.html` | **New** | 9i | Card grid template |
| `src/web/.../features/locations/pages/locations-list/locations-list.scss` | **New** | 9i | List styles |
| `src/web/.../features/bystanders/bystanders.routes.ts` | **New** | 9e | Route definitions |
| `src/web/.../features/locations/locations.routes.ts` | **New** | 9j | Route definitions |
| `src/web/.../app/app.routes.ts` | Modified | 9f/9k | Register both lazy routes |
| `src/web/.../layout/page-layout/page-layout.ts` | Modified | 9f/9k | Activate both nav entries |

> All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`.

---

## What This Phase Explicitly Excludes

| Excluded Item | Reason / Deferral Note |
|---------------|------------------------|
| Mystery association display on Bystander/Location detail | `MysteryIds` is ignored in the UI per Decision 4. Deferred to a future phase if cross-linking is needed. |
| Create Bystander / Create Location from the list view | The existing create flow is mystery-scoped (through the Mystery wizard). A standalone create form is a separate concern, deferred. |
| Delete from the list view | No bulk delete or single-item delete from the list page. Delete remains available only through mystery management flows. |
| Removing mystery-scoped detail routes from `mysteries.routes.ts` | Those routes are still referenced by `mystery-detail` for linking. Removing them would break existing navigation. Deferred until mystery detail is updated to use the new standalone routes. |
| Custom Move create/edit UI | No API endpoints exist for managing custom moves at the bystander/location level. Render read-only only. |
| Pagination or filtering on list views | Flat list only. Pagination deferred until dataset size warrants it. |
| xUnit API tests for new endpoints | Recommended but not blocking. Add during or after 9a if test coverage policy requires it. |

---

## Verification Checklist

- [ ] `dotnet build MonsterOfTheWeek.slnx` passes with no warnings
- [ ] `GET /api/bystanders` returns 200 with a valid array of `BystanderListItemResponse`
- [ ] `GET /api/locations` returns 200 with a valid array of `LocationListItemResponse`
- [ ] `npm run build` passes with no errors
- [ ] `npm run test -- --watch=false` passes (updated specs green)
- [ ] `/bystanders` route renders the list page; all cards link to `/bystanders/:id`
- [ ] `/bystanders/:bystanderId` route renders without `mysteryId` in the URL
- [ ] Back-link on bystander detail navigates to `/bystanders` (not `/mysteries`)
- [ ] Custom moves section renders read-only on bystander detail; no create/edit controls present
- [ ] Edit form on bystander detail saves via PUT; success toast fires
- [ ] `/locations` route renders the list page; all cards link to `/locations/:id`
- [ ] `/locations/:locationId` route renders without `mysteryId` in the URL
- [ ] Back-link on location detail navigates to `/locations` (not `/mysteries`)
- [ ] Custom moves section renders read-only on location detail; no create/edit controls present
- [ ] Edit form on location detail saves via PUT; success toast fires
- [ ] "Bystanders" nav entry is active and links to `/bystanders`
- [ ] "Locations" nav entry is active and links to `/locations`
- [ ] Mystery detail page bystander/location links still work (mystery-scoped routes in `mysteries.routes.ts` unchanged)
- [ ] Loading spinner visible during data fetch on both list and detail pages
- [ ] Error state renders on both list and detail pages when API is unavailable
