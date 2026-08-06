# Standalone Creation — Phase 3: Locations

**Prepared by:** Yoshi (Architect)
**Status:** Proposed — no open questions for Skyler (see below); ready for implementation planning once reviewed.
**Date:** 2026-08-05

> Filed under `docs/updates/` per the same convention as `docs/updates/standalone-creation-phase1-monsters.md` and `docs/updates/standalone-creation-phase2-minions.md` (both shipped/committed). Structure follows those two docs.

This is **Phase 3 of a four-part "standalone creation" initiative**: the ability to create a new Monster, Minion, Location, or Bystander outside the mystery-creation wizard's normal flow. Phases 1 (Monster) and 2 (Minion) shipped and are committed — re-read as the current reference for convention and precedent. **This document designs Location creation only.** Bystander remains out of scope, getting its own follow-up doc — see the note at the end of Background on why its shape should still be verified fresh rather than assumed from this one.

---

## What Shipped So Far (Re-Verified Against Current Committed Source)

Confirmed by reading the current code directly, not the docs' summaries:

- **Phase 1 (Monster):** `POST /api/monsters` mysteryless create endpoint alongside the existing mystery-scoped `POST /api/mysteries/{mysteryId}/monsters` (Monster↔Mystery is M:N via `MysteryMonster`, attachment optional, defaults blank). `MonsterFormComponent` shared between create/edit. `/monsters/new` with an optional "Attach to Mystery" dropdown and all 4 sub-resource panels via local draft arrays + a single batched submit (create parent, then `forkJoin` the children against the real id). Entry point: "+ Add Monster" on the top-level `/monsters` list only — a `mystery-detail.html`-scoped entry point was explicitly deferred (Phase 1's Known Gaps), not built.
- **Phase 2 (Minion):** No backend work needed — `POST /api/monsters/{monsterId}/minions` already required a real monster (Minion↔Monster is a required, non-nullable 1:N FK). `MinionFormComponent` shared between create/edit. `MinionCreateComponent` at two routes (`/monsters/:monsterId/minions/new`, monster locked from the route param; `/minions/new`, required dropdown) — Skyler chose both over a single shape, because a *required* picker over every row of a domain is a materially worse experience than an *optional* one, which is why Minion's fork looked different from Monster's. Same draft-array/batch-submit pattern for its 4 sub-resource panels.

---

## Background — What's Different About Location (Confirmed From Current Source)

### 1. Location↔Mystery relationship: genuinely M:N, structurally identical to Monster

`Data/Entities/DomainEntities.cs:184-196`: `Location` has `LocationTypeId`, `Name`, `Description` — **no `MysteryId` foreign key at all.** Its only relationship to `Mystery` is `Mysteries: ICollection<MysteryLocation>` (`DomainEntities.cs:260-267`, a plain bridge table: `MysteryId`/`LocationId`, no extra columns), exactly the same shape as `Monster.Mysteries: ICollection<MysteryMonster>`. `LocationDetailResponse`/`LocationListItemResponse` (`core/models.ts:324-344`) both carry `mysteryIds: string[]`, already `[]`-safe — a location with zero mystery links is a valid, already-representable state, same as Monster.

**The backend gap mirrors Monster's Phase 1 gap exactly, not Minion's "no gap" finding.** `LocationsController.cs` has only `[HttpPost("api/mysteries/{mysteryId:guid}/locations")]` (line 31) — no top-level `POST /api/locations`. `LocationService.CreateAsync(Guid mysteryId, UpsertLocationRequest, ...)` (`Services/LocationService.cs:48-78`) requires `MysteryExistsAsync` and always calls `LinkLocationToMysteryAsync`, same shape as `MonsterService.CreateAsync` had pre-Phase-1. `DELETE /api/locations/{id}` (unconditional hard delete) and `DELETE /api/mysteries/{mysteryId}/locations/{id}` (`UnlinkFromMysteryAsync`) both already exist, mirroring Monster's existing delete/unlink pair. This phase needs the same shape of new endpoint Phase 1 added for Monster.

### 2. Location has no interactive sub-resources — the draft-batch machinery from Phases 1/2 does not apply here

This was flagged as a real open question to check, not a formality, and it resolves cleanly: **Location has exactly one child collection, `CustomMoves`, and the current frontend renders it fully read-only.**

- `Location` (`DomainEntities.cs:184-196`) has `CustomMoves: ICollection<LocationCustomMove>` and nothing else — no attacks/powers/armors/weaknesses-shaped children exist in the schema for Location at all.
- The backend *does* have full custom-move CRUD (`GetCustomMovesAsync`/`CreateCustomMoveAsync`/`UpdateCustomMoveAsync`/`DeleteCustomMoveAsync` on `ILocationService`/`LocationsController.cs:86-116`) — but `location-detail.ts`/`.html` (read in full) render custom moves as a **plain, read-only `<ul>` of names** (`location-detail.html:35-44`): no add-form, no edit, no delete button, nothing bound to `LocationService`'s custom-move methods at all. This is the identical "backend supports it, frontend has deliberately never built UI for it" shape already established for Monster's and Minion's custom moves (Phase 8 planning history, reconfirmed independently here for Location).
- `UpsertLocationRequest` (`core/models.ts:346-350`) has exactly 3 fields: `name`, `description`, `locationTypeId`. No `harmCapacity`-equivalent, no sub-resource collections of any kind in the request shape.

**Consequence: this phase's create page needs none of Phase 1/2's local-draft-array + batched-submit design.** A Location create page is a single 3-field form with exactly one API call on submit — no children to draft, no sequencing, no partial-failure case to design for. This is a materially smaller design than either prior phase, and Resolved Decision 2 below states this plainly rather than carrying over machinery that doesn't apply just because the last two phases needed it.

### 3. `location-detail.ts` is edit-only, immediate-mutation — same shape category as `monster-detail.ts`/`minion-detail.ts` pre-their-phases

Confirmed reading the current file in full: `ngOnInit` throws if no `locationId` route param (no create mode), `save()` calls `locationService.update(id, payload)` directly and immediately — single call, no batching, no phase transitions. This is the exact submission-model shape ("share only when submission models match," established in Phase 1, reused in Phase 2) that makes extracting a shared `LocationFormComponent` correct here too.

`location-detail.ts`'s form (`location-detail.ts:26-30`) has one small, real difference from Monster's/Minion's core forms worth preserving exactly, not "fixing": `locationTypeId` **is** `Validators.required` here (`this.formBuilder.nonNullable.control('', [Validators.required])`), unlike `monsterTypeId`/`minionTypeId`, which had no explicit required validator in their respective forms. The extraction should carry this validator shape over field-for-field as it exists today, same discipline Phase 2 applied to `minionTypeId`'s missing validator.

`location-detail.ts`'s `backLink()`/`backLabel()` already branch on an optional `mysteryId` route param (mystery-scoped vs. top-level `/locations`), the same pattern `monster-detail.ts` and `minion-detail.ts` use — confirms `location-detail.ts` is reachable both at `/locations/:locationId` (`locations.routes.ts`) and `/mysteries/:mysteryId/locations/:locationId` (`mysteries.routes.ts`, confirmed).

### 4. `locations-list.ts`/`.html` already has delete, no create

Confirmed reading the current files: `locations-list.ts` already has a full working delete flow (`ConfirmDeleteModalComponent`, `locationService.delete()`) — a step ahead of where `minions-list.ts` was before Phase 2 (which had neither). **No "Add Location" affordance exists anywhere** — same gap shape `/monsters` had before Phase 1. `LocationService.ts` (Angular, `core/location.ts`) already has `getAll()`, `getByMystery()`, `getById()`, `create(mysteryId, request)` (mystery-scoped only), `update()`, `delete()`, `unlinkFromMystery()` — no `createStandalone()`.

### 5. No natural second entry point exists, unlike Minion

Minion's Phase 2 had a genuine fork because a minion has an unambiguous non-Mystery parent (its Monster) whose own detail page is a natural, already-known-context entry point. **Location has no equivalent** — its only relationship is to Mystery (optional, M:N), the same shape Monster has. There is no "Location-of-something-else" parent to scope an alternate entry point under. This phase's entry-point question is therefore structurally identical to Monster's Phase 1 question, already answered by Skyler for the identical relationship shape (see Resolved Decision 3) — not a fresh fork requiring new input.

### A note for whoever picks up Bystander next

Everything above had to be independently re-verified against Location's actual schema and existing pages rather than assumed from Monster's or Minion's shape — in particular, the sub-resource finding (§2) could easily have gone the other way. `Bystander` (`DomainEntities.cs:217-229`) looks structurally identical to `Location` at a glance (M:N to Mystery via `MysteryBystander`, a `CustomMoves` collection, no other children) — but "looks identical at a glance" is exactly the assumption this phase was told not to make about Location itself, so it shouldn't be extended to Bystander unmodified either. Whoever writes that phase doc should re-read `bystander-detail.ts`/`.html`, `BystanderService`/`BystandersController.cs`/`IBystanderService.cs`, and the `Bystander`/`MysteryBystander` entities fresh, the same way this document did for Location, rather than treating this doc's conclusions as a template to copy.

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | **Is any new backend work needed?** | **Yes** — mirrors Monster's Phase 1 gap exactly, for the identical reason (optional M:N attachment, existing endpoint always requires and links a mystery). `ILocationService`/`LocationService`: add a `CreateAsync(UpsertLocationRequest request, CancellationToken)` overload (no `mysteryId`) that skips `MysteryExistsAsync`/`LinkLocationToMysteryAsync`. `LocationsController`: add `[HttpPost("api/locations")]` (no collision with the existing `[HttpGet("api/locations")]` — different verb). `LocationService.ts`: add `createStandalone(request)`. No repository or migration changes — `AddLocationAsync` is already unconditional. |
| 2 | **Does Location need the local-draft-array + batched-submit sub-resource machinery from Phases 1/2?** | **No.** Location has exactly one child collection (`CustomMoves`), and `location-detail.ts` renders it fully read-only today — no create/edit/delete UI exists to mirror in the first place. The create page is a single 3-field form (`name`/`description`/`locationTypeId`) with exactly one API call on submit. This eliminates the entire batch-submit/partial-failure design category that dominated Phases 1 and 2 — not because it was solved differently, but because the problem it solves doesn't exist for this domain. |
| 3 | **Mystery scoping at creation — reused, not re-asked** | **Optional "Attach to Mystery" dropdown, defaulting blank** — the identical shape Skyler already chose for Monster's identical M:N-to-Mystery relationship (Phase 1 decision 5). Pick a mystery → the existing `locationService.create(mysteryId, request)`. Leave it blank → the new `createStandalone(request)` (decision 1). Re-litigating this would be re-asking a question already answered for a structurally identical relationship, the same discipline Phase 2 applied to "wire the shared form into the detail page now" (Phase 2 decision 11) rather than reopening it. |
| 4 | **Build a shared `LocationFormComponent`?** | **Yes**, extracted from `location-detail.ts`'s existing form. Justified by "share only when submission models match" (Phase 1): `location-detail.ts` is confirmed immediate-mutation, single-page, one `update()` call — the same shape that made sharing correct for Monster and Minion. |
| 5 | **`LocationFormComponent` shape** | Mirrors `MonsterFormComponent`/`MinionFormComponent`: presentational, owns its own `FormGroup` (3 fields — name/description/locationTypeId, field-for-field identical to `location-detail.ts`'s current form, **including** its existing `Validators.required` on `locationTypeId`, which is a real, deliberate difference from Monster's/Minion's type fields — preserved as-is, not "fixed" to match them). `@Input() locationTypes: TypeRefResponse[]`, `@Input() location: LocationDetailResponse \| null` (`null` = create), `@Input() isSaving`, `@Input() submitLabel` (`"Create Location"` vs `"Save Location"`). `@Output() save = new EventEmitter<UpsertLocationRequest>()`. Does not call `LocationService` itself. |
| 6 | **Mystery-picker field: inside or outside `LocationFormComponent`?** | **Outside**, same reasoning as Monster decision 4: create-only concern, no meaning in edit mode (`location-detail.ts` has no "attach to another mystery" UI, and building one is out of scope — see Known Gaps), and `UpsertLocationRequest` has no `mysteryId` field to attach it to. Lives as a sibling control in the create page's own template. |
| 7 | **Entry point** | **Top-level `/locations` list only** — a "+ Add Location" button next to the existing `<h2>Locations</h2>` header, `routerLink="/locations/new"`. No second entry point exists to weigh (§5 of Background) — this isn't a narrowed-down choice the way Monster's or Minion's was, there is structurally only one reasonable place for it. A `mystery-detail.html`-scoped entry point is deferred, same as Monster's (Known Gaps) — see Resolved Decision 10 for why it isn't introduced here either. |
| 8 | **Post-create navigation target** | Mirrors Monster's decision 14 exactly: if attached to a mystery, navigate to `/mysteries/:mysteryId/locations/:newId` (the mystery-scoped route already exists, confirmed in `mysteries.routes.ts`); if unattached, navigate to `/locations/:newId`. |
| 9 | **Partial-failure handling** | **Not applicable — there is no batch step to partially fail.** A single `create`/`createStandalone` call either succeeds or fails atomically. On failure: stay on the create page, inline + toast error, form values intact — the same shape `location-detail.ts`'s own `save()` error handling already uses today, not a new pattern. |
| 10 | **Deferring a `mystery-detail.html`-scoped entry point, matching Monster's existing precedent, not introducing a new asymmetry** | Not built in this phase. Monster's Phase 1 already deferred the equivalent entry point (its own Known Gaps table) for the identical M:N-to-Mystery relationship shape; building it now for Location but not retroactively for Monster would introduce a new, unjustified asymmetry between two domains with identical relationship shapes rather than resolve one. If Skyler wants this entry point, it reads as a "do it for both Monster and Location together" follow-up, not something this phase should invent unilaterally for one domain. |
| 11 | **Custom moves** | Out of scope, mirroring `location-detail.ts`'s own current read-only scope — consistent with Monster's and Minion's identical deferral. |
| 12 | **Wire `LocationFormComponent` into `location-detail.ts` in this same phase** | **Yes, decided directly, not reopened.** This is now the third time this exact shape of decision has come up (Phase 1 decision 15, Phase 2 decision 11) and Skyler has answered it the same way both times for the identical reasoning (the core-fields block is cleanly separable from whatever else is on the page; not swapping it now only manufactures duplication that will need fixing later anyway). Continuing to ask this per phase would be re-asking a settled question, not genuine diligence. |
| 13 | **Route registration** | `LocationCreateComponent` at `features/locations/pages/location-create/` (sibling to `location-detail`/`locations-list`). `locations.routes.ts` gets `{ path: 'new', ... }` inserted **before** `{ path: ':locationId', ... }` — the same top-down route-matching requirement as both prior phases. |

---

## Open Questions for Skyler

**None.** Every fork this phase could plausibly have had turns out to already be resolved by verified fact rather than judgment call:

- Mystery-scoping shape is dictated by the schema (M:N, optional) matching Monster's already-decided precedent exactly, not a fresh product question.
- Sub-resource authoring is dictated by the fact that Location has no interactive sub-resources today, not a design choice between alternatives.
- Entry point is dictated by there being exactly one structurally plausible location for it (no second "known parent context" page exists for Location the way `monster-detail.ts` did for Minion).
- The detail-page-rewire timing question has now been answered identically twice for the same shape of decision, so treating it as still-open a third time would be manufacturing a question rather than surfacing a real one — matching the coordinator's explicit instruction not to pad this section for symmetry with the last two docs.

If something during implementation surfaces a genuine fork this review didn't anticipate, it should be raised then — but nothing in the current source supports inventing one here.

---

## Architecture Discussion

### Why the draft-batch pattern isn't "the initiative's pattern" unconditionally

Phases 1 and 2 both needed local draft arrays + batched submit because both Monster and Minion have real, interactive, multi-item child collections (attacks/powers/armors/weaknesses) whose own create endpoints require a real parent id that doesn't exist yet during authoring. That's a structural fact about *those two domains' schemas and existing detail pages*, not a property of "standalone creation" as a pattern. Location's only child collection has never had create/edit/delete UI built for it at all — there's nothing to draft, because there's nothing the create page would need to defer to a batch step in the first place. The right generalization from Phases 1/2 isn't "every create page gets draft arrays" — it's "check whether the target domain actually has interactive sub-resources before assuming it needs the machinery that handles them." This phase is the first real test of that generalization, and it comes out negative, which is exactly the kind of finding worth stating plainly (per Resolved Decision 2) rather than building unneeded machinery to match the shape of the last two docs.

### Why mystery-scoping and the entry-point question aren't reopened

Both Phase 1 and Phase 2 established a pattern worth naming explicitly now that a third phase confirms it: **when a new phase's underlying relationship shape is structurally identical to an already-decided phase's shape, re-deriving or re-asking the same question is redundant, not more careful.** Phase 2 already did this once (declining to reopen "wire the shared form into the detail page now," Phase 2 decision 11, citing Phase 1's precedent for the identical shape of decision). This phase extends the same discipline to mystery-scoping and entry-point placement, because Location's relationship to Mystery is not merely *similar* to Monster's — it's the same bridge-table M:N shape, confirmed at the entity, contract, and controller layers. Treating it as a fresh open question a second time would imply some reason to think the answer might differ, and nothing in the verified source suggests one.

---

## Sub-Phases

Ordering: LC-1 (backend) has no dependency on the others. LC-2 has no dependency on LC-1. LC-3 depends on LC-1 (needs `createStandalone()` for the blank-picker path) and LC-2 (needs `LocationFormComponent`). LC-4 depends on LC-2.

### LC-1 — Backend: Mysteryless Location Create Endpoint

**Goal:** Resolved Decision 1. Direct mirror of Monster's Phase 1 SC-1.

**Work:**
- `ILocationService`: add `Task<ServiceResult<LocationDetailResponse>> CreateAsync(UpsertLocationRequest request, CancellationToken cancellationToken);` overload.
- `LocationService.cs`: implement it — same body as the existing `CreateAsync(Guid mysteryId, ...)` (`LocationService.cs:48-78`) minus `MysteryExistsAsync` and `LinkLocationToMysteryAsync`. Still validates `LocationTypeExistsAsync`.
- `LocationsController.cs`: add
  ```csharp
  [HttpPost("api/locations")]
  public async Task<ActionResult<LocationDetailResponse>> Create([FromBody] UpsertLocationRequest request, CancellationToken cancellationToken)
  {
      var result = await locationService.CreateAsync(request, cancellationToken);
      if (!result.IsSuccess)
      {
          return result.Error!.Type switch
          {
              ServiceErrorType.NotFound => NotFound(),
              ServiceErrorType.Validation => BadRequest(new { message = result.Error.Message }),
              _ => BadRequest()
          };
      }

      return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
  }
  ```
- `src/web/monster-of-the-week-web/src/app/core/location.ts`: add `createStandalone(request: UpsertLocationRequest): Observable<LocationDetailResponse>` posting to `/api/locations`.

**Files modified:**
| File | Notes |
|---|---|
| `src/api/MonsterOfTheWeek.Api/Services/ILocationService.cs` | Add `CreateAsync` overload |
| `src/api/MonsterOfTheWeek.Api/Services/LocationService.cs` | Implement overload |
| `src/api/MonsterOfTheWeek.Api/Controllers/LocationsController.cs` | Add `POST api/locations` |
| `src/web/monster-of-the-week-web/src/app/core/location.ts` | Add `createStandalone()` |
| `src/api/MonsterOfTheWeek.Api.Tests/Services/LocationServiceTests.cs` *(if it exists — verify at implementation time)* | New coverage |

**Verification:**
- `dotnet build MonsterOfTheWeek.slnx` passes.
- New xUnit test: `CreateAsync(request)` (no mysteryId) creates a location with `MysteryIds: []`; a bad `LocationTypeId` fails validation identically to the mystery-scoped overload; the created location is retrievable via `GetByIdAsync` and appears in `GetAllAsync`.

---

### LC-2 — Frontend: Extract `LocationFormComponent`

**Goal:** Resolved Decisions 4-6.

**Work:**
- New `features/locations/shared/location-form/location-form.ts` (+ `.html`), following the `features/monsters/shared/`/`features/minions/shared/` precedent.
- Move `form` definition (preserving its existing validator shape, including `locationTypeId`'s `Validators.required`), the reset-on-load logic (`ngOnChanges` on the `location` input), and the submit-guard logic from `location-detail.ts` into the new component.
- Move the template block (`location-detail.html:15-33`) into `location-form.html`.
- `@Input() locationTypes`, `@Input() location: LocationDetailResponse | null`, `@Input() isSaving`, `@Input() submitLabel`, `@Output() save`.

**Files added:**
| File | Notes |
|---|---|
| `src/web/.../features/locations/shared/location-form/location-form.ts` | New component |
| `src/web/.../features/locations/shared/location-form/location-form.html` | Extracted template |
| `src/web/.../features/locations/shared/location-form/location-form.spec.ts` | New: validation guard, `save` emission shape, `ngOnChanges` repopulation |

**Verification:**
- `npm run build` passes.
- `npm run test -- --watch=false`: new spec covers invalid-submit, valid-submit (`save` emits correct `UpsertLocationRequest` shape), and `location` input changes repopulating the form.

---

### LC-3 — Frontend: `/locations/new` Create Page, Route, Entry Point

**Goal:** Resolved Decisions 3, 6-9, 13. Depends on LC-1 and LC-2. No sub-resource drafts (Resolved Decision 2) — the simplest sub-phase of any create page across this initiative so far.

**Work:**
- New `features/locations/pages/location-create/location-create.ts` (+ `.html`):
  - `ngOnInit`: `forkJoin` of `ReferenceDataService.getLocationTypes()` and `MysteryService.getMysteries()` (already exists, used identically in `monster-create.ts`).
  - `mysteryControl` — plain string control, no validators, blank-default, same shape as `monster-create.ts`'s.
  - Template: `<app-location-form [locationTypes]="..." [location]="null" submitLabel="Create Location" [isSaving]="isSaving()" (save)="onCreate($event)" />` plus the mystery-picker dropdown (`CustomSelectComponent` against `mysteries()`).
  - `onCreate(payload: UpsertLocationRequest)`: reads `mysteryControl`, calls `locationService.create(mysteryId, payload)` or `createStandalone(payload)`, navigates on success (Resolved Decision 8), inline + toast error on failure (Resolved Decision 9) — no batch step, no partial-failure branch, structurally simpler than `monster-create.ts`'s/`minion-create.ts`'s `onCreate`.
- `locations.routes.ts`: add `{ path: 'new', loadComponent: () => import('./pages/location-create/location-create').then((m) => m.LocationCreateComponent) }`, inserted **before** `{ path: ':locationId', ... }`.
- `locations-list.html`/`.ts`: add a "+ Add Location" button/`routerLink="/locations/new"` next to the `<h2>Locations</h2>` header.

**Files added/modified:**
| File | Status | Notes |
|---|---|---|
| `src/web/.../features/locations/pages/location-create/location-create.ts` | Added | New page — no draft arrays, single API call |
| `src/web/.../features/locations/pages/location-create/location-create.html` | Added | `<app-location-form>` + mystery picker |
| `src/web/.../features/locations/pages/location-create/location-create.spec.ts` | Added | New coverage |
| `src/web/.../features/locations/locations.routes.ts` | Modified | Add `new` route before `:locationId` |
| `src/web/.../features/locations/pages/locations-list/locations-list.html`/`.ts` | Modified | Add "Add Location" entry point |

**Verification:**
- Manual: from `/locations`, click "Add Location," fill the 3 fields, submit with a mystery picked — location created, appears on that mystery's detail page, navigation lands on `/mysteries/:mysteryId/locations/:newId`.
- Manual: leave the mystery picker blank — location created, appears in the flat `/locations` list, `mysteryIds` empty, no crash.
- Manual: invalid submit (blank Name, or blank Location Type given its `Validators.required`) shows validation errors, no API call.
- `npm run build` passes; `npm run test -- --watch=false` passes.

---

### LC-4 — Frontend: Wire `LocationFormComponent` Into `location-detail.ts`

**Goal:** Resolved Decision 12.

**Work:**
- `location-detail.ts`: remove `form`, its build/reset logic; replace with `<app-location-form [location]="location()" [locationTypes]="locationTypes()" [isSaving]="isSaving()" submitLabel="Save Location" (save)="save($event)" />`, `save(payload)` keeps its existing `locationService.update(...)` call, now receiving the payload as an argument.
- `location-detail.html`: remove the extracted template block, replace with the component tag.
- `location-detail.spec.ts`: update for the new component boundary.

**Files modified:**
| File | Notes |
|---|---|
| `src/web/.../features/locations/pages/location-detail/location-detail.ts` | Remove inline form, wire component |
| `src/web/.../features/locations/pages/location-detail/location-detail.html` | Replace inline form markup with `<app-location-form>` |
| `src/web/.../features/locations/pages/location-detail/location-detail.spec.ts` | Update for new component boundary |

**Verification:**
- Manual: edit an existing location's fields via the now-shared component from both reachable route shapes (`/locations/:id`, `/mysteries/:mysteryId/locations/:id`), confirm the read-only custom-moves list (untouched) still renders.
- `npm run build` passes; `npm run test -- --watch=false` passes, including updated `location-detail.spec.ts`.

---

## Files Affected Summary

| File | Status | Sub-Phase | Notes |
|---|---|---|---|
| `src/api/.../Services/ILocationService.cs` | Modified | LC-1 | Add `CreateAsync` overload |
| `src/api/.../Services/LocationService.cs` | Modified | LC-1 | Implement overload |
| `src/api/.../Controllers/LocationsController.cs` | Modified | LC-1 | Add `POST api/locations` |
| `src/api/.../MonsterOfTheWeek.Api.Tests/Services/LocationServiceTests.cs` *(if exists)* | Modified | LC-1 | New coverage |
| `src/web/.../core/location.ts` | Modified | LC-1 | Add `createStandalone()` |
| `src/web/.../features/locations/shared/location-form/location-form.ts` | Added | LC-2 | New shared component |
| `src/web/.../features/locations/shared/location-form/location-form.html` | Added | LC-2 | Extracted template |
| `src/web/.../features/locations/shared/location-form/location-form.spec.ts` | Added | LC-2 | New coverage |
| `src/web/.../features/locations/pages/location-create/location-create.ts` | Added | LC-3 | New page, no draft arrays |
| `src/web/.../features/locations/pages/location-create/location-create.html` | Added | LC-3 | Form + mystery picker |
| `src/web/.../features/locations/pages/location-create/location-create.spec.ts` | Added | LC-3 | New coverage |
| `src/web/.../features/locations/locations.routes.ts` | Modified | LC-3 | Add `new` route before `:locationId` |
| `src/web/.../features/locations/pages/locations-list/locations-list.html`/`.ts` | Modified | LC-3 | "Add Location" entry point |
| `src/web/.../features/locations/pages/location-detail/location-detail.ts` | Modified | LC-4 | Wire shared component |
| `src/web/.../features/locations/pages/location-detail/location-detail.html` | Modified | LC-4 | Wire shared component |
| `src/web/.../features/locations/pages/location-detail/location-detail.spec.ts` | Modified | LC-4 | Update for new boundary |

> All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`; all `src/api/...` paths expand to `src/api/MonsterOfTheWeek.Api/`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|---|---|---|
| No "attach an existing unattached location to a mystery" UI | Same gap shape as Monster's Phase 1 (Known Gaps) — no endpoint or UI to link an already-created location to a mystery after the fact, only at creation time. | Real, known gap, inherited from Monster's identical relationship shape. Same recommendation: flag for a future phase if it matters in practice. |
| `mystery-detail.html` entry point for "Add Location" | Deliberately not built (Resolved Decision 10) — deferred consistently with Monster's identical, already-deferred entry point, to avoid a new cross-domain asymmetry. | If ever built, do it for both Monster and Location together. |
| Custom moves | `location-detail.ts` has no custom-move UI today; this phase doesn't add one. | Out of scope, unchanged, matches Monster's and Minion's identical deferral. |
| Bystander standalone creation | Explicitly out of scope for this document — and its shape should be independently re-verified, not assumed from this doc (see Background's closing note). | Its own follow-up phase doc. |

---

## Verification Checklist

- [ ] `dotnet build MonsterOfTheWeek.slnx` passes with no warnings
- [ ] `dotnet test MonsterOfTheWeek.slnx` passes, including new `CreateAsync(request)` (no-mystery overload) coverage
- [ ] `npm run build` passes with no errors
- [ ] `npm run test -- --watch=false` passes, including new `location-form.spec.ts` and `location-create.spec.ts`, plus updated `location-detail.spec.ts`
- [ ] `/locations` list page shows a working "Add Location" entry point
- [ ] Creating a location attached to a mystery (via the picker) succeeds and the location appears on that mystery's detail page
- [ ] Creating a location with the mystery picker left blank succeeds, the location appears in the flat `/locations` list with no mystery badge/crash, and is independently deletable via the existing delete flow
- [ ] Invalid submission (blank Name, or blank Location Type) shows validation state and makes no API call
- [ ] Post-create navigation lands on the correct detail route (mystery-scoped vs. top-level)
- [ ] `LocationFormComponent` correctly repopulates when its `location` input changes (exercised by `location-detail.ts` after LC-4)
- [ ] Editing an existing location's fields via the now-shared component still saves correctly from both reachable route shapes, and the read-only custom-moves list is unaffected
- [ ] `docker compose up -d postgres && dotnet run` workflow unaffected
