# Standalone Creation — Phase 4: Bystanders

**Prepared by:** Yoshi (Architect)
**Status:** Proposed — no open questions for Skyler (see below); ready for implementation planning once reviewed.
**Date:** 2026-08-05

> Filed under `docs/updates/` per the same convention as `docs/updates/standalone-creation-phase1-monsters.md`, `docs/updates/standalone-creation-phase2-minions.md`, and `docs/updates/standalone-creation-phase3-locations.md` (all three shipped/committed). Structure follows those docs, most closely Phase 3's.

This is **Phase 4 — the final phase — of the four-part "standalone creation" initiative**: the ability to create a new Monster, Minion, Location, or Bystander outside the mystery-creation wizard's normal flow. Phases 1 (Monster), 2 (Minion), and 3 (Location) have all shipped and are committed. **This document designs Bystander creation, the last of the four domains.** Once this phase lands, every domain object in the app will have a standalone creation path outside the wizard.

Phase 3's Background section closed with an explicit warning not to assume Bystander's shape from Location's just because they "look structurally identical at a glance." This document follows that instruction: every claim below about Bystander's schema, contracts, existing pages, and services was independently re-verified against current source, the same rigor Phase 3 applied to Location — not copied from Phase 3's conclusions. **The verified result is that Bystander genuinely does match Location's shape in every respect that matters for this design** — but that's a confirmed finding with its own evidence trail below, not an assumption carried over.

---

## What Shipped So Far (Re-Verified Against Current Committed Source)

- **Phase 1 (Monster):** M:N to Mystery, optional attachment. New mysteryless `POST /api/monsters` endpoint. `MonsterFormComponent` shared create/edit. 4 interactive sub-resources (attacks/powers/armors/weaknesses) via local draft arrays + a single batched submit — established as the pattern *when a domain actually has interactive sub-resources*, not an unconditional default.
- **Phase 2 (Minion):** Required, non-nullable 1:N FK to Monster — no backend gap, since the existing endpoint already required the parent. Two entry-point routes (monster-locked + top-level-with-required-dropdown), because Skyler chose "both" over a single shape once the required-vs-optional distinction was surfaced.
- **Phase 3 (Location):** M:N to Mystery like Monster, but genuinely **no interactive sub-resources** — only a read-only custom-moves list (confirmed by reading `location-detail.html`, no create/edit/delete UI exists despite full backend CRUD). Single 3-field form, one API call, no batching. New mysteryless `POST /api/locations` endpoint, mirroring Monster's gap. Entry point: top-level `/locations` list only — no second "known parent" context the way Minion had `monster-detail.ts`.

---

## Background — Bystander, Independently Re-Verified (Not Assumed From Location)

### 1. Bystander↔Mystery relationship: genuinely M:N, confirmed at every layer — matches Location and Monster

`Data/Entities/DomainEntities.cs:217-229`: `Bystander` has `BystanderTypeId`, `Name`, `Description` — **no `MysteryId` foreign key.** Its only relationship to `Mystery` is `Mysteries: ICollection<MysteryBystander>` (`DomainEntities.cs:269-276`), a plain bridge table (`MysteryId`/`BystanderId`, no extra columns) — structurally identical to `MysteryLocation`. `BystanderListItemResponse`/`BystanderDetailResponse` (`core/models.ts:352-372`) both carry `mysteryIds: string[]`, confirmed `[]`-safe (not required to be non-empty anywhere it's read).

**The backend gap is confirmed identical to Location's, not assumed.** `BystandersController.cs` has only `[HttpPost("api/mysteries/{mysteryId:guid}/bystanders")]` (line 26) — no top-level `POST /api/bystanders`. `BystanderService.CreateAsync(Guid mysteryId, UpsertBystanderRequest, ...)` (`Services/BystanderService.cs:47-76`) requires `MysteryExistsAsync` and always calls `LinkBystanderToMysteryAsync` before returning — line-for-line the same shape as `LocationService.CreateAsync` and pre-Phase-1 `MonsterService.CreateAsync`. `DELETE /api/bystanders/{id}` (unconditional hard delete) and `DELETE /api/mysteries/{mysteryId}/bystanders/{id}` (`UnlinkFromMysteryAsync`) both already exist, mirroring Location's and Monster's delete/unlink pair exactly.

### 2. Sub-resources: confirmed, not assumed — Bystander has no interactive child collections either

`Bystander` (`DomainEntities.cs:217-229`) has exactly one child collection, `CustomMoves: ICollection<BystanderCustomMove>` — no attacks/powers/armors/weaknesses-shaped children exist for Bystander at all, same as Location.

The backend has full custom-move CRUD (`GetCustomMovesAsync`/`CreateCustomMoveAsync`/`UpdateCustomMoveAsync`/`DeleteCustomMoveAsync` on `IBystanderService`/`BystandersController.cs:81-111`) — but `bystander-detail.ts`/`.html` (read in full, not assumed from Location's equivalent) render custom moves as a **plain, read-only `<ul>` of names** (`bystander-detail.html:35-44`), byte-for-byte the same markup shape as `location-detail.html`'s: no add-form, no edit, no delete button, nothing bound to `BystanderService`'s custom-move methods anywhere in the component. `UpsertBystanderRequest` (`core/models.ts:374-378`) has exactly 3 fields: `name`, `description`, `bystanderTypeId` — no sub-resource collections in the request shape at all.

**Consequence, confirmed rather than inherited: this phase's create page needs none of Phases 1/2's local-draft-array + batched-submit machinery**, for the identical reason Phase 3 found for Location — there's nothing interactive to draft.

### 3. `bystander-detail.ts`: edit-only, immediate-mutation — confirmed, matches Location's shape exactly

Read in full: `ngOnInit` throws if no `bystanderId` route param (no create mode). `save()` (`bystander-detail.ts:87-121`) calls `bystanderService.update(id, payload)` directly and immediately — one call, no batching. The "share only when submission models match" condition (Phase 1) holds here the same way it held for Location.

One field-level detail worth preserving exactly, confirmed by reading the actual form definition rather than assumed from Location's: `bystanderTypeId` **is** `Validators.required` (`bystander-detail.ts:29`) — matching Location's `locationTypeId` (also required), *not* Monster's/Minion's type fields (neither had an explicit required validator). This is a real, consistent pattern across the two M:N-to-Mystery-with-no-sub-resources domains, not a coincidence worth "fixing" to match Monster/Minion.

`bystander-detail.ts`'s `backLink()`/`backLabel()` branch on an optional `mysteryId` route param (`bystander-detail.ts:34-39`), identical to `location-detail.ts`'s pattern — confirming it's reachable at both `/bystanders/:bystanderId` (`bystanders.routes.ts`) and `/mysteries/:mysteryId/bystanders/:bystanderId` (confirmed in `mysteries.routes.ts:22`).

### 4. `bystanders-list.ts`/`.html`: already has delete, no create — confirmed, matches Location's pre-Phase-3 state

Read in full: `bystanders-list.ts` already has a complete delete flow (`ConfirmDeleteModalComponent`, `bystanderService.delete()`), same shape `locations-list.ts` had before Phase 3. **No "Add Bystander" affordance exists anywhere.** `BystanderService.ts` (Angular, `core/bystander.ts`) already has `getAll()`, `getByMystery()`, `getById()`, `create(mysteryId, request)` (mystery-scoped only), `update()`, `delete()`, `unlinkFromMystery()` — no `createStandalone()`.

### 5. No natural second entry point — confirmed, matches Location, not Minion

Bystander's only relationship is to Mystery (optional, M:N) — there is no non-Mystery parent entity the way Minion had Monster. Confirmed by reading the entity definition (§1): the only foreign-key-shaped relationship on `Bystander` besides `BystanderTypeId` (a reference-data lookup, not a parent-context relationship) is the `Mysteries` bridge collection. No genuine entry-point fork exists here, same finding as Location, for the same underlying reason (no second parent to scope an alternate entry point under).

### Summary of the verification: genuinely identical to Location, confirmed rather than assumed

Every one of the five points above was checked against Bystander's own source — entity, contracts, controller, service, both frontend pages, and the routing tables — independently of Location's conclusions. The result is a confirmed match, not an inherited assumption: same M:N-to-Mystery shape, same missing mysteryless-create endpoint, same absence of interactive sub-resources, same edit-only/immediate-mutation detail page (down to the same non-obvious `Validators.required` placement on the type field), same list-page state, same lack of a second entry-point context. This phase's design is therefore a direct structural mirror of Phase 3's, with the evidence re-established fresh rather than copied.

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | **Is any new backend work needed?** | **Yes** — confirmed identical to Location's (and, before that, Monster's) gap: optional M:N attachment, existing endpoint always requires and links a mystery. `IBystanderService`/`BystanderService`: add a `CreateAsync(UpsertBystanderRequest request, CancellationToken)` overload (no `mysteryId`) that skips `MysteryExistsAsync`/`LinkBystanderToMysteryAsync`. `BystandersController`: add `[HttpPost("api/bystanders")]` (no collision with the existing `[HttpGet("api/bystanders")]`). `BystanderService.ts`: add `createStandalone(request)`. No repository or migration changes — `AddBystanderAsync` is already unconditional. |
| 2 | **Does Bystander need the local-draft-array + batched-submit sub-resource machinery from Phases 1/2?** | **No** — confirmed, not inherited: `Bystander`'s only child collection (`CustomMoves`) is rendered fully read-only in `bystander-detail.ts` today, identical to Location's finding. The create page is a single 3-field form with exactly one API call on submit. |
| 3 | **Mystery scoping at creation — reused, not re-asked** | **Optional "Attach to Mystery" dropdown, defaulting blank** — the same shape Skyler chose for Monster (Phase 1 decision 5) and Location (Phase 3 decision 3), for the confirmed-identical M:N-to-Mystery relationship. Pick a mystery → the existing `bystanderService.create(mysteryId, request)`. Leave it blank → the new `createStandalone(request)` (decision 1). |
| 4 | **Build a shared `BystanderFormComponent`?** | **Yes**, extracted from `bystander-detail.ts`'s existing form. Justified by "share only when submission models match" (Phase 1): `bystander-detail.ts` is confirmed immediate-mutation, single-page, one `update()` call. |
| 5 | **`BystanderFormComponent` shape** | Mirrors `LocationFormComponent`: presentational, owns its own `FormGroup` (3 fields — name/description/bystanderTypeId, field-for-field identical to `bystander-detail.ts`'s current form, **including** its `Validators.required` on `bystanderTypeId`, preserved as-is). `@Input() bystanderTypes: TypeRefResponse[]`, `@Input() bystander: BystanderDetailResponse \| null` (`null` = create), `@Input() isSaving`, `@Input() submitLabel` (`"Create Bystander"` vs `"Save Bystander"`). `@Output() save = new EventEmitter<UpsertBystanderRequest>()`. Does not call `BystanderService` itself. |
| 6 | **Mystery-picker field: inside or outside `BystanderFormComponent`?** | **Outside**, same reasoning as Monster decision 4 / Location decision 6: create-only concern, no meaning in edit mode, and `UpsertBystanderRequest` has no `mysteryId` field to attach it to. Lives as a sibling control in the create page's own template. |
| 7 | **Entry point** | **Top-level `/bystanders` list only** — a "+ Add Bystander" button next to the existing `<h2>Bystanders</h2>` header, `routerLink="/bystanders/new"`. No second entry point exists to weigh (§5 of Background) — same finding as Location, for the same reason. A `mystery-detail.html`-scoped entry point is deferred (see Known Gaps), consistent with both Monster's and Location's identical deferral. |
| 8 | **Post-create navigation target** | Mirrors Monster's decision 14 / Location's decision 8: if attached to a mystery, navigate to `/mysteries/:mysteryId/bystanders/:newId` (the mystery-scoped route already exists, confirmed in `mysteries.routes.ts:22`); if unattached, navigate to `/bystanders/:newId`. |
| 9 | **Partial-failure handling** | **Not applicable** — no batch step exists. A single `create`/`createStandalone` call either succeeds or fails atomically; on failure, stay on the create page with an inline + toast error and the form values intact, the same shape `bystander-detail.ts`'s own `save()` error handling already uses. |
| 10 | **Deferring a `mystery-detail.html`-scoped entry point, consistent with Monster's and Location's precedent** | Not built in this phase, for the same reason Location deferred it (Location decision 10): Monster's Phase 1 already deferred the equivalent entry point for the identical M:N-to-Mystery shape, and Location repeated that deferral rather than introducing an asymmetry. Building it now for Bystander only, while two of the three other M:N-to-Mystery domains still lack it, would be the same kind of unjustified asymmetry both prior decisions were written to avoid. |
| 11 | **Custom moves** | Out of scope, mirroring `bystander-detail.ts`'s own current read-only scope — consistent with Monster's, Minion's, and Location's identical deferral. |
| 12 | **Wire `BystanderFormComponent` into `bystander-detail.ts` in this same phase** | **Yes, decided directly, not reopened.** This is the fourth time this exact shape of decision has come up (Phase 1 decision 15, Phase 2 decision 11, Phase 3 decision 12), and Skyler has answered it identically every time for the identical reasoning. Treating it as open again would be manufacturing a question that's been settled three times over, not genuine diligence. |
| 13 | **Route registration** | `BystanderCreateComponent` at `features/bystanders/pages/bystander-create/` (sibling to `bystander-detail`/`bystanders-list`). `bystanders.routes.ts` gets `{ path: 'new', ... }` inserted **before** `{ path: ':bystanderId', ... }` — the same top-down route-matching requirement as all three prior phases. |

---

## Open Questions for Skyler

**None.** Every fork this phase could plausibly have had is resolved by an independently re-verified fact, confirmed identical to an already-decided phase's shape:

- Mystery-scoping is dictated by the schema (M:N, optional), confirmed identical to Monster's and Location's already-decided shape.
- Sub-resource authoring is dictated by the fact that Bystander, like Location, has no interactive sub-resources today — confirmed by reading `bystander-detail.html`, not assumed from Location's finding.
- Entry point is dictated by there being exactly one structurally plausible location for it, confirmed by reading the entity definition, same as Location.
- The detail-page-rewire timing question has now been answered identically four times for the same shape of decision (this phase would make it four), so treating it as still-open would be manufacturing a question rather than surfacing a real one.

This is the same "none, and here's why" outcome Phase 3 reached, reached independently here rather than assumed — this phase's Background section exists specifically to show the verification work that makes "no open questions" a checked conclusion rather than a shortcut.

---

## Architecture Discussion

### Why re-verifying Bystander independently mattered, even though the conclusion matched

Phase 3's own closing note warned against assuming Bystander's shape from Location's resemblance "at a glance." That warning was worth honoring literally rather than treating as satisfied by the resemblance itself — the value of independent verification isn't that it might have found a difference here (it didn't), it's that "looks the same" and "is the same" are different claims, and only the second one is safe to build decisions on. Location itself was the proof this matters: it "looked" like it might need Monster's draft-batch machinery by relationship-shape resemblance, and that assumption would have been wrong. The fact that Bystander's independent check came back matching Location's shape in every respect doesn't retroactively make the check unnecessary — it makes the design safe to build on a confirmed fact rather than a second unchecked resemblance.

### Why the "structurally identical, don't re-derive" discipline still applies, now for the fourth time

Phase 3 named the principle: when a new phase's relationship shape is structurally identical (confirmed at the entity/contract/controller layer) to an already-decided phase's, re-deriving or re-asking the same question is redundant. This phase is the clearest test of that principle yet, because it's the first phase where *every* dimension of the design (mystery-scoping, sub-resource shape, entry point, detail-rewire timing) matched a prior phase's already-decided answer, not just one or two dimensions. The result is a phase document with no new judgment calls at all — every Resolved Decision above cites either a direct precedent or a piece of independently-gathered evidence, and the Open Questions section is empty for the second time in this initiative. That's a legitimate outcome of the verification discipline working as intended on the initiative's last, most structurally repetitive domain, not a sign the review was skipped.

---

## Sub-Phases

Ordering: BC-1 (backend) has no dependency on the others. BC-2 has no dependency on BC-1. BC-3 depends on BC-1 (needs `createStandalone()`) and BC-2 (needs `BystanderFormComponent`). BC-4 depends on BC-2.

### BC-1 — Backend: Mysteryless Bystander Create Endpoint

**Goal:** Resolved Decision 1. Direct mirror of Location's LC-1 / Monster's Phase 1 SC-1.

**Work:**
- `IBystanderService`: add `Task<ServiceResult<BystanderDetailResponse>> CreateAsync(UpsertBystanderRequest request, CancellationToken cancellationToken);` overload.
- `BystanderService.cs`: implement it — same body as the existing `CreateAsync(Guid mysteryId, ...)` (`BystanderService.cs:47-76`) minus `MysteryExistsAsync` and `LinkBystanderToMysteryAsync`. Still validates `BystanderTypeExistsAsync`.
- `BystandersController.cs`: add
  ```csharp
  [HttpPost("api/bystanders")]
  public async Task<ActionResult<BystanderDetailResponse>> Create([FromBody] UpsertBystanderRequest request, CancellationToken cancellationToken)
  {
      var result = await bystanderService.CreateAsync(request, cancellationToken);
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
- `src/web/monster-of-the-week-web/src/app/core/bystander.ts`: add `createStandalone(request: UpsertBystanderRequest): Observable<BystanderDetailResponse>` posting to `/api/bystanders`.

**Files modified:**
| File | Notes |
|---|---|
| `src/api/MonsterOfTheWeek.Api/Services/IBystanderService.cs` | Add `CreateAsync` overload |
| `src/api/MonsterOfTheWeek.Api/Services/BystanderService.cs` | Implement overload |
| `src/api/MonsterOfTheWeek.Api/Controllers/BystandersController.cs` | Add `POST api/bystanders` |
| `src/web/monster-of-the-week-web/src/app/core/bystander.ts` | Add `createStandalone()` |
| `src/api/MonsterOfTheWeek.Api.Tests/Services/BystanderServiceTests.cs` | **New file** — confirmed no existing `BystanderServiceTests.cs` today (unlike `LocationServiceTests.cs`, which already exists) |

**Verification:**
- `dotnet build MonsterOfTheWeek.slnx` passes.
- New xUnit test: `CreateAsync(request)` (no mysteryId) creates a bystander with `MysteryIds: []`; a bad `BystanderTypeId` fails validation identically to the mystery-scoped overload; the created bystander is retrievable via `GetByIdAsync` and appears in `GetAllAsync`.

---

### BC-2 — Frontend: Extract `BystanderFormComponent`

**Goal:** Resolved Decisions 4-6.

**Work:**
- New `features/bystanders/shared/bystander-form/bystander-form.ts` (+ `.html`), following the established `features/<domain>/shared/` precedent.
- Move `form` definition (preserving `bystanderTypeId`'s `Validators.required`), the reset-on-load logic (`ngOnChanges` on the `bystander` input), and the submit-guard logic from `bystander-detail.ts` into the new component.
- Move the template block (`bystander-detail.html:15-33`) into `bystander-form.html`.
- `@Input() bystanderTypes`, `@Input() bystander: BystanderDetailResponse | null`, `@Input() isSaving`, `@Input() submitLabel`, `@Output() save`.

**Files added:**
| File | Notes |
|---|---|
| `src/web/.../features/bystanders/shared/bystander-form/bystander-form.ts` | New component |
| `src/web/.../features/bystanders/shared/bystander-form/bystander-form.html` | Extracted template |
| `src/web/.../features/bystanders/shared/bystander-form/bystander-form.spec.ts` | New: validation guard, `save` emission shape, `ngOnChanges` repopulation |

**Verification:**
- `npm run build` passes.
- `npm run test -- --watch=false`: new spec covers invalid-submit, valid-submit (`save` emits correct `UpsertBystanderRequest` shape), and `bystander` input changes repopulating the form.

---

### BC-3 — Frontend: `/bystanders/new` Create Page, Route, Entry Point

**Goal:** Resolved Decisions 3, 6-9, 13. Depends on BC-1 and BC-2. No sub-resource drafts (Resolved Decision 2) — structurally identical in scope to Location's LC-3.

**Work:**
- New `features/bystanders/pages/bystander-create/bystander-create.ts` (+ `.html`):
  - `ngOnInit`: `forkJoin` of `ReferenceDataService.getBystanderTypes()` and `MysteryService.getMysteries()`.
  - `mysteryControl` — plain string control, no validators, blank-default, same shape as `monster-create.ts`'s/`location-create.ts`'s.
  - Template: `<app-bystander-form [bystanderTypes]="..." [bystander]="null" submitLabel="Create Bystander" [isSaving]="isSaving()" (save)="onCreate($event)" />` plus the mystery-picker dropdown.
  - `onCreate(payload: UpsertBystanderRequest)`: reads `mysteryControl`, calls `bystanderService.create(mysteryId, payload)` or `createStandalone(payload)`, navigates on success (Resolved Decision 8), inline + toast error on failure (Resolved Decision 9) — no batch step.
- `bystanders.routes.ts`: add `{ path: 'new', loadComponent: () => import('./pages/bystander-create/bystander-create').then((m) => m.BystanderCreateComponent) }`, inserted **before** `{ path: ':bystanderId', ... }`.
- `bystanders-list.html`/`.ts`: add a "+ Add Bystander" button/`routerLink="/bystanders/new"` next to the `<h2>Bystanders</h2>` header.

**Files added/modified:**
| File | Status | Notes |
|---|---|---|
| `src/web/.../features/bystanders/pages/bystander-create/bystander-create.ts` | Added | New page — no draft arrays, single API call |
| `src/web/.../features/bystanders/pages/bystander-create/bystander-create.html` | Added | `<app-bystander-form>` + mystery picker |
| `src/web/.../features/bystanders/pages/bystander-create/bystander-create.spec.ts` | Added | New coverage |
| `src/web/.../features/bystanders/bystanders.routes.ts` | Modified | Add `new` route before `:bystanderId` |
| `src/web/.../features/bystanders/pages/bystanders-list/bystanders-list.html`/`.ts` | Modified | Add "Add Bystander" entry point |

**Verification:**
- Manual: from `/bystanders`, click "Add Bystander," fill the 3 fields, submit with a mystery picked — bystander created, appears on that mystery's detail page, navigation lands on `/mysteries/:mysteryId/bystanders/:newId`.
- Manual: leave the mystery picker blank — bystander created, appears in the flat `/bystanders` list, `mysteryIds` empty, no crash.
- Manual: invalid submit (blank Name, or blank Bystander Type given its `Validators.required`) shows validation errors, no API call.
- `npm run build` passes; `npm run test -- --watch=false` passes.

---

### BC-4 — Frontend: Wire `BystanderFormComponent` Into `bystander-detail.ts`

**Goal:** Resolved Decision 12.

**Work:**
- `bystander-detail.ts`: remove `form`, its build/reset logic; replace with `<app-bystander-form [bystander]="bystander()" [bystanderTypes]="bystanderTypes()" [isSaving]="isSaving()" submitLabel="Save Bystander" (save)="save($event)" />`, `save(payload)` keeps its existing `bystanderService.update(...)` call, now receiving the payload as an argument.
- `bystander-detail.html`: remove the extracted template block, replace with the component tag.
- `bystander-detail.spec.ts`: update for the new component boundary.

**Files modified:**
| File | Notes |
|---|---|
| `src/web/.../features/bystanders/pages/bystander-detail/bystander-detail.ts` | Remove inline form, wire component |
| `src/web/.../features/bystanders/pages/bystander-detail/bystander-detail.html` | Replace inline form markup with `<app-bystander-form>` |
| `src/web/.../features/bystanders/pages/bystander-detail/bystander-detail.spec.ts` | Update for new component boundary |

**Verification:**
- Manual: edit an existing bystander's fields via the now-shared component from both reachable route shapes (`/bystanders/:id`, `/mysteries/:mysteryId/bystanders/:id`), confirm the read-only custom-moves list (untouched) still renders.
- `npm run build` passes; `npm run test -- --watch=false` passes, including updated `bystander-detail.spec.ts`.

---

## Files Affected Summary

| File | Status | Sub-Phase | Notes |
|---|---|---|---|
| `src/api/.../Services/IBystanderService.cs` | Modified | BC-1 | Add `CreateAsync` overload |
| `src/api/.../Services/BystanderService.cs` | Modified | BC-1 | Implement overload |
| `src/api/.../Controllers/BystandersController.cs` | Modified | BC-1 | Add `POST api/bystanders` |
| `src/api/.../MonsterOfTheWeek.Api.Tests/Services/BystanderServiceTests.cs` | Added | BC-1 | New file (no existing coverage today) |
| `src/web/.../core/bystander.ts` | Modified | BC-1 | Add `createStandalone()` |
| `src/web/.../features/bystanders/shared/bystander-form/bystander-form.ts` | Added | BC-2 | New shared component |
| `src/web/.../features/bystanders/shared/bystander-form/bystander-form.html` | Added | BC-2 | Extracted template |
| `src/web/.../features/bystanders/shared/bystander-form/bystander-form.spec.ts` | Added | BC-2 | New coverage |
| `src/web/.../features/bystanders/pages/bystander-create/bystander-create.ts` | Added | BC-3 | New page, no draft arrays |
| `src/web/.../features/bystanders/pages/bystander-create/bystander-create.html` | Added | BC-3 | Form + mystery picker |
| `src/web/.../features/bystanders/pages/bystander-create/bystander-create.spec.ts` | Added | BC-3 | New coverage |
| `src/web/.../features/bystanders/bystanders.routes.ts` | Modified | BC-3 | Add `new` route before `:bystanderId` |
| `src/web/.../features/bystanders/pages/bystanders-list/bystanders-list.html`/`.ts` | Modified | BC-3 | "Add Bystander" entry point |
| `src/web/.../features/bystanders/pages/bystander-detail/bystander-detail.ts` | Modified | BC-4 | Wire shared component |
| `src/web/.../features/bystanders/pages/bystander-detail/bystander-detail.html` | Modified | BC-4 | Wire shared component |
| `src/web/.../features/bystanders/pages/bystander-detail/bystander-detail.spec.ts` | Modified | BC-4 | Update for new boundary |

> All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`; all `src/api/...` paths expand to `src/api/MonsterOfTheWeek.Api/`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|---|---|---|
| No "attach an existing unattached bystander to a mystery" UI | Same gap shape as Monster's and Location's — no endpoint or UI to link an already-created bystander to a mystery after the fact, only at creation time. | Real, known gap, inherited from the identical relationship shape across all three M:N-to-Mystery domains. Flag for a future phase if it matters in practice, ideally addressed for Monster/Location/Bystander together rather than piecemeal. |
| `mystery-detail.html` entry point for "Add Bystander" | Deliberately not built (Resolved Decision 10), consistent with Monster's and Location's identical deferral. | If ever built, do it for all three M:N-to-Mystery domains together, not just one. |
| Custom moves | `bystander-detail.ts` has no custom-move UI today; this phase doesn't add one. | Out of scope, unchanged, matches Monster's, Minion's, and Location's identical deferral. |

---

## Verification Checklist

- [ ] `dotnet build MonsterOfTheWeek.slnx` passes with no warnings
- [ ] `dotnet test MonsterOfTheWeek.slnx` passes, including new `BystanderServiceTests.cs` coverage
- [ ] `npm run build` passes with no errors
- [ ] `npm run test -- --watch=false` passes, including new `bystander-form.spec.ts` and `bystander-create.spec.ts`, plus updated `bystander-detail.spec.ts`
- [ ] `/bystanders` list page shows a working "Add Bystander" entry point
- [ ] Creating a bystander attached to a mystery (via the picker) succeeds and the bystander appears on that mystery's detail page
- [ ] Creating a bystander with the mystery picker left blank succeeds, the bystander appears in the flat `/bystanders` list with no mystery badge/crash, and is independently deletable via the existing delete flow
- [ ] Invalid submission (blank Name, or blank Bystander Type) shows validation state and makes no API call
- [ ] Post-create navigation lands on the correct detail route (mystery-scoped vs. top-level)
- [ ] `BystanderFormComponent` correctly repopulates when its `bystander` input changes (exercised by `bystander-detail.ts` after BC-4)
- [ ] Editing an existing bystander's fields via the now-shared component still saves correctly from both reachable route shapes, and the read-only custom-moves list is unaffected
- [ ] `docker compose up -d postgres && dotnet run` workflow unaffected
- [ ] **Initiative-level check:** all four domains (Monster, Minion, Location, Bystander) now have a working standalone creation path outside the mystery-creation wizard, confirming the initiative's stated goal is fully met
