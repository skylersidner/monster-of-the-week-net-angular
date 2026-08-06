# Standalone Creation — Phase 1: Monsters

**Prepared by:** Yoshi (Architect)
**Status:** Decisions locked — Skyler answered all 4 originally-open product-scope questions (2026-08-05); this revision folds them into Resolved Decisions and reworks the sub-resource design that decision 3's answer required. Ready for implementation planning.
**Date:** 2026-08-04 (revised 2026-08-05)

> Filed under `docs/updates/` per the same convention established by `docs/updates/multi-minion-support.md`. Structure otherwise follows `docs/updates/multi-minion-support.md` and `docs/phases/phase-8-minions-ui-flow.md`.

This is **Phase 1 of a four-part "standalone creation" initiative**: the ability to create a new Monster, Minion, Location, or Bystander outside the mystery-creation wizard's normal flow. Each domain object gets its own phase document, done one at a time. **This document designs Monster creation only.** Minion, Location, and Bystander standalone creation are explicitly **not designed here** — each will get its own follow-up doc that can reference this one's precedent (the `MonsterFormComponent` extraction pattern, the mysteryless-create endpoint shape, the route-ordering note, the local-draft-then-batch-submit sub-resource pattern) but should not assume it applies unmodified. In particular, Minion already has a *different* unambiguous-parent shape (1:N to Monster) that was designed separately in the now-parked `docs/updates/multi-minion-support.md`; Location and Bystander are M:N to Mystery like Monster, so this doc's mystery-scoping discussion is likely to transfer, but that's a call for whoever picks up those phases, not assumed here.

The multi-minion plan (`docs/updates/multi-minion-support.md`) remains parked, untouched, not superseded — Skyler's pivot is to build this prerequisite first.

---

## Background — Confirmed From Current Source

- **No standalone "create X outside the wizard" pattern exists anywhere in this app today**, for any of the five domains. This is a first-of-its-kind pattern, not an extension of an existing one — confirmed by grep (`'new'`/`CreateComponent` route patterns turn up nothing outside spec files).
- `monsters.routes.ts` has exactly two routes: `''` (list, `MonstersListComponent`) and `':monsterId'` (detail/edit, `MonsterDetailComponent`), plus a sibling `':monsterId/minions/:minionId'` route. **No `new`/`create` route exists.** Angular matches routes top-down; a literal `'new'` segment must be registered *before* the `':monsterId'` catch-all or it will be swallowed as a `monsterId` value.
- `monster-detail.ts`/`.html` (`features/monsters/pages/monster-detail/`) is a large, working, already-busy component: a `monsterForm` (name, description, harmCapacity, monsterTypeId, monsterArchetypeId via `FormBuilder`, `Validators.required` on name/harmCapacity/archetype), a `saveMonster()` method calling `monsterService.update(id, payload)`, `populateMonsterForm()`/`toNullable()` helpers, and 4 full sub-resource panels (attacks w/ weapon tags, powers, armors, weaknesses) each with its own inline add-form and `runAndRefresh`-style mutation helper that calls the corresponding `MonsterService.create*`/`delete*` method **immediately, per action**, because the monster already exists by the time this page is reachable. The core-fields block (`monsterForm` definition, `saveMonster()`, `populateMonsterForm()`, template lines 44-77) is cleanly separable from the sub-resource logic — it shares no state or methods with the 4 panels beyond the `monster`/`isMutating`/`activeMutation` signals, which a wrapper can still own.
- `monsters-list.ts`/`.html` (`features/monsters/pages/monsters-list/`) already renders a **flat, mystery-agnostic list of every monster in the system** via `MonsterService.getAll()` → `GET /api/monsters` (confirmed live endpoint, `MonstersController.cs:10-12`, already wired and already the only page consuming it before this phase). It shows no mystery info per row at all — just type/archetype badges, sub-resource/minion counts, and a delete button. This is the one page in the app today that is genuinely mystery-agnostic for monsters.
- **The mystery-scoping asymmetry is real and confirmed at every layer:**
  - `MonsterService.create(mysteryId, request)` (Angular, `core/monster.ts:37-42`) posts to `/api/mysteries/${mysteryId}/monsters`. `MonstersController.Create` (`api/.../Controllers/MonstersController.cs:18-28`) → `MonsterService.CreateAsync(mysteryId, ...)` (`api/.../Services/MonsterService.cs:23-60`) does two required things before returning: `MysteryExistsAsync` validation (404 if not found) and `LinkMonsterToMysteryAsync` (writes a `MysteryMonster` bridge row). **There is no mysteryless create path today.**
  - `MonsterService.update(monsterId, request)` (Angular) puts to `/api/monsters/${monsterId}` with no mystery scoping at all — confirms Update and Create are asymmetric today by design, not oversight (Update mutates the Monster row only; mystery *membership* is a separate concern handled by `LinkMonsterToMysteryAsync`/`UnlinkFromMysteryAsync`).
  - **The schema itself does not require a monster to belong to any mystery.** `Monster` (`Data/Entities/DomainEntities.cs:79-99`) has no `MysteryId` foreign key — its only relationship to `Mystery` is via the `MysteryMonster` bridge table (`Monster.Mysteries: ICollection<MysteryMonster>`), genuinely M:N, confirmed in `DomainEntities.cs:251-258`. A monster with zero `MysteryMonster` rows is a completely valid, already-representable state — it isn't a schema hack, it's the model working as designed.
  - `MonsterListItemResponse`/`MonsterDetailResponse` (`Contracts/ApiContracts.cs:75-114`) both carry `MysteryIds: IReadOnlyList<Guid>`, which is already nullable-in-practice (can be `[]`). `GetAllAsync` (the endpoint `monsters-list.ts` already uses) does not filter or require any mystery link. **An unattached monster would already render correctly in the existing monsters-list page today, with zero frontend changes** — this was verified by reading `monsters-list.html`, which renders no mystery-dependent field.
  - `MysteryService.getMysteries()` (Angular, `core/mystery.ts:18-20`) already hits `GET /api/mysteries` and returns a flat list (`MysteryListItemResponse`, has `id`/`name`) — the exact reference data an "attach to mystery" picker would need, with zero new backend work.
  - `DELETE /api/monsters/{id}` (top-level, unconditional hard delete) already exists and is already used by `monsters-list.ts`'s delete button — an unattached monster is already fully deletable today with no gap.
- **No precedent for the minion "inline stub-create → navigate to existing detail page" pattern transfers unmodified.** That pattern (parked multi-minion doc, decision #5) specifically worked because a minion has exactly one unambiguous parent (`MonsterId`, required 1:N FK). Monster's relationship to Mystery is M:N via the bridge table above — there is no single "obvious" parent to scope creation under, which is why the mystery-scoping decision below required its own analysis rather than a mechanical copy of the minion precedent.
- `CustomSelectComponent` (`shared/custom-select.component.ts`) is a generic `ControlValueAccessor` — it resolves `id`/`name`/`motivation`-or-`description` off of any object via duck typing, so it works unmodified against `MysteryListItemResponse`, `TypeRefResponse`, and `MonsterArchetypeResponse` alike. No new shared widget needed for a mystery picker.
- `features/mysteries/shared/` (`mystery-countdown-stage.ts`, `mystery-section-icon.ts`) is existing, precedented convention for **domain-specific-but-reusable-within-the-domain** pieces living in a `shared/` subfolder inside a feature — distinct from the app-wide generic `shared/` used by `CustomSelectComponent` et al. This is the right home for a new `MonsterFormComponent` (domain-specific, but reused across two pages in the same feature).
- **The parked wizard already has a proven, working precedent for "collect a monster's sub-resources as local drafts before the monster exists, then batch-create them once it does"** — `mystery-create.store.ts` (`AttackDraft`/`PowerDraft`/`WeaknessDraft`/`ArmorDraft` interfaces, lines 37-60; `monsterAttacks`/`monsterPowers`/`monsterWeaknesses`/`monsterArmors` signal arrays, lines 227-230; `submitPhase1`'s `monsterService.create(...)` → `switchMap` → `saveThreatCollections(monster.id, ...)`, lines 980-1020; `saveThreatCollections`/`runBatch`, lines 1256-1318, using `forkJoin` per sub-resource type). This is read for precedent only — nothing in `mystery-create.store.ts` is imported or modified by this phase; it stays untouched, consistent with the parked-plan instruction. See Resolved Decision 9/10 below for how this phase adapts it.
- `docs/theming/theming-plan.md`'s tokens (`bg-accent`, `text-on-accent`, `border-strong`, `text-danger`, `bg-badge-*`, etc.) are already in use throughout `monster-detail.html`/`monsters-list.html` — any new template should reuse these, not introduce new literal colors.

---

## Resolved Decisions

All of the following are now locked — either architecture calls that were always mine to make, or product-scope calls Skyler has now answered (marked accordingly). There is no remaining "Open Questions" section in this revision; see the note at the end of this table.

| # | Question | Decision |
|---|----------|----------|
| 1 | **Build a shared `MonsterFormComponent`?** | **Yes.** Unlike the multi-minion doc's decision #8 (which declined to share a form between the wizard's *batch-submit* model and monster-detail's *immediate-mutation* model), `MonsterFormComponent`'s own contract — validate 5 fields, emit one `save` event, let the caller decide what happens next — is identical whether the caller is the create page or `monster-detail.ts`. Note this claim is now deliberately scoped to **the component's own save contract**, not to "the whole create page is immediate-mutation" — decision 9 below means the create page as a whole *does* now have a batch step downstream of that emission. That doesn't weaken this decision: the component itself never becomes batchy: it always does exactly one thing (validate, emit) regardless of what its caller does afterward. See "The 'share only when submission models match' principle" in Architecture Discussion for how this reasoning is applied consistently across decisions 1, 11, and 15. |
| 2 | **Extract from `monster-detail.ts`'s existing form, or build fresh?** | **Extract from the existing form.** Skyler flagged this as a real option but not a constraint; it isn't a close call. The existing `monsterForm`/`saveMonster()`/`populateMonsterForm()`/template block (lines 56-62, 138-171, 357-365, 44-77) is already correct, already styled with the app's token classes, already validated, and is cleanly separable from the sub-resource panels it sits next to (no shared state beyond signals a wrapper can still own). Building fresh would mean re-deriving the same 5 fields, the same validators, and the same Tailwind markup from scratch for zero benefit, with real risk of drifting from the established look (the `custom-select`/`border-strong`/`focus-accent` pattern). |
| 3 | **`MonsterFormComponent` shape** | A presentational component owning its own internal `FormGroup` (matches this codebase's convention — no `ControlValueAccessor` is used for whole-form components anywhere; `ControlValueAccessor` here is reserved for single-value leaf controls like `CustomSelectComponent`). Inputs: `monsterTypes: TypeRefResponse[]`, `monsterArchetypes: MonsterArchetypeResponse[]` (reference data, fetched by the parent page exactly as today — no double-fetching), `monster: MonsterDetailResponse \| null` (`null` = create mode, populates the form via `ngOnChanges`), `isSaving: boolean` (disables the submit button, mirrors `isMutating()`), `submitLabel: string` (`"Create Monster"` vs `"Save Monster"`). Output: `save = new EventEmitter<UpsertMonsterRequest>()`, emitted only after internal `Validators.required` passes (`markAllAsTouched()` + early return otherwise, matching `saveMonster()`'s existing guard). The component does **not** call `MonsterService` itself — the parent page owns the actual `create`/`update` call, matching this codebase's smart-page/dumb-widget split. **On the create page, this component's own submit button doubles as the whole page's master submit action** — see decision 9; no second/separate submit button is added. |
| 4 | **Mystery-picker field: inside or outside `MonsterFormComponent`?** | **Outside.** It only applies to create, never to edit (monster-detail has no "attach to another mystery" affordance today, and adding one is out of scope here — see Known Gaps). Baking a create-only field into a component that's also used for edit would leak a create-mode concern into a shared component whose whole value is being identical between the two modes. It lives as a separate, simple control in the new create page's own template, outside `<app-monster-form>`; the create page's `(save)` handler reads both the emitted payload and its own mystery-selection state together when deciding which service method to call. |
| 5 | **Mystery scoping at creation — Skyler's decision, locked** | **Option C**, Skyler confirmed the recommendation: an optional "Attach to Mystery" dropdown on the create page, defaulting blank. Pick a mystery → the existing `monsterService.create(mysteryId, request)` (unchanged, already validates/links). Leave it blank → the new `monsterService.createStandalone(request)` (decision 6). One page, one form, no forced fork between "the user who already knows the mystery" and "the user who's pre-authoring a catalog entry." |
| 6 | **Mysteryless create endpoint — now unconditionally in scope** | Since decision 5 is locked (not "always mystery-scoped"), this endpoint is required, no longer conditional. `IMonsterService`/`MonsterService`: add an overload `CreateAsync(UpsertMonsterRequest request, CancellationToken)` (no `mysteryId` — legal C# overload alongside the existing `CreateAsync(Guid mysteryId, UpsertMonsterRequest request, CancellationToken)`) that does everything the existing one does *except* the `MysteryExistsAsync` check and `LinkMonsterToMysteryAsync` call. `MonstersController`: add `[HttpPost("api/monsters")]` — no route collision with the existing `[HttpGet("api/monsters")]` (different verb, same path is fine in ASP.NET routing). `MonsterService.ts` (Angular): add `createStandalone(request): Observable<MonsterDetailResponse>` posting to `/api/monsters`. Thin, low-risk addition — no repository changes needed, no migration needed (schema already supports zero-mystery monsters, per Background). |
| 7 | **"Add Monster" entry point location — Skyler's decision, locked** | **Top-level `/monsters` list page** — Skyler confirmed the recommendation. A "+ Add Monster" button next to the existing `<h2>Monsters</h2>` header in `monsters-list.html`, `routerLink="/monsters/new"`. A `mystery-detail.html`-scoped entry point (pre-filling the same optional mystery field from decision 5) remains a deferred, additive follow-up — not built in this phase (see Known Gaps). |
| 8 | **Bare-bones MVP scope — Skyler's decision, locked, diverges from my original recommendation** | **The 4 sub-resource panels (attacks/powers/armors/weaknesses) are included on the create page itself**, not deferred to a second navigation via `monster-detail.ts`. I had recommended core-5-fields-only with sub-resources added after via the existing detail page (mirroring the minion plan's decision #5); Skyler explicitly rejected that shape — the requirement is that sub-resources are addable as part of the create flow itself, with no navigation required before they're reachable. This is a real, substantive scope change from the original doc and is what decisions 9-12 below exist to resolve. |
| 9 | **Sub-resource authoring model on the create page — the core architecture call this revision had to make** | **Local draft arrays (`signal<T[]>`), matching this codebase's established "signal arrays, not FormArrays" convention (`.squad/decisions.md`, 2026-07-21), with a single batched submit triggered by `MonsterFormComponent`'s existing submit button.** The monster doesn't exist yet while the user is filling in attacks/powers/armors/weaknesses, so `monster-detail.ts`'s immediate-per-action pattern (`createAttack(monsterId, payload)` called the instant a sub-form is submitted) cannot work unmodified — there is no `monsterId` yet. Instead: each of the 4 sub-resource types gets its own small add-form (field-for-field identical to `monster-detail.ts`'s `attackForm`/`powerForm`/`armorForm`/`weaknessForm`) that, on submit, pushes a draft object into a local signal array and resets — **no API call at add-time.** The single "Create Monster" click (`MonsterFormComponent`'s own submit, per decision 3) is the only trigger that talks to the API: it creates the monster first, then batch-creates every drafted sub-resource against the real monster ID, then navigates. See "Choosing the sub-resource authoring model" in Architecture Discussion for the full comparison against the alternative (create-then-reveal) and why this one was chosen. |
| 10 | **Draft interfaces (`AttackDraft`/`PowerDraft`/`ArmorDraft`/`WeaknessDraft`)** | New, page-scoped interfaces defined directly in `monster-create.ts` (exported for spec-file testability) — **not imported from `mystery-create.store.ts`**, even though the field shapes are intentionally identical (both are driven by the same `UpsertMonster*Request` contracts underneath). Deliberately not shared/imported to avoid coupling this new, unrelated page to the parked wizard file — matches the top-of-doc instruction to leave `docs/updates/multi-minion-support.md` and its implementation untouched. Unlike the wizard's drafts, **no `id: string \| null` field is needed** — a fresh create page always starts with zero existing sub-resources, so there's no baseline to diff against on resubmit the way the wizard's edit-an-existing-mystery case needs; this is strictly simpler than the wizard's shape, not a blind copy of it. |
| 11 | **No shared sub-resource panel components between `monster-create.ts` and `monster-detail.ts`** | The 4 sub-resource add-forms are **not** extracted into shared components, even though they're visually near-identical to `monster-detail.ts`'s panels. This is the same reasoning multi-minion's decision #8 already applied, restated correctly here: `monster-create.ts`'s panels are local-draft-then-batch (decision 9); `monster-detail.ts`'s panels are immediate-per-action and stay that way (decision 15 doesn't change this — only the *core 5 fields* get shared, not the sub-resource panels). Different submission models on the two sides is a real, load-bearing reason not to share, exactly the shape decision #8 already established — this is the "share only when submission models match" principle applied a second time in this doc, this time correctly ruling *against* sharing rather than for it. A small amount of literal duplication (two near-identical sets of 4 sub-resource add-forms) is accepted in exchange for not coupling two components with genuinely different lifecycles. |
| 12 | **Partial-failure handling: monster creation succeeds, but a sub-resource in the batch fails** | Once the monster is successfully created, it is a real, persisted, addressable entity — treating the page as still "in progress" past that point and stranding the user on the create page would hide that fact. On any error occurring *after* the monster is created (i.e., during the batched sub-resource `forkJoin`), the page still navigates to the new monster's detail page (per decision 14) and shows an error notification (`NotificationService.error(...)`, matching the existing pattern) noting that some details may not have saved and should be reviewed — rather than a generic failure message that implies nothing was saved. An error occurring *before* the monster exists (the initial `create`/`createStandalone` call itself failing) keeps the user on the create page with their drafts intact, mirroring `saveMonster()`'s existing error-handling shape. This is not a rollback/transactional guarantee (see Known Gaps) — it's the same accepted, pre-existing risk shape as the parked wizard's own `saveThreatCollections`/`forkJoin` batch, not a new risk this phase introduces. |
| 13 | **New create page location and route** | `features/monsters/pages/monster-create/` (sibling to `monsters-list`/`monster-detail`, same convention), registered at `monsters.routes.ts` as `{ path: 'new', ... }`, inserted **before** `{ path: ':monsterId', ... }` (route-ordering requirement noted in Background). |
| 14 | **Post-create navigation target** | If created attached to a mystery (decision 5), navigate to `/mysteries/:mysteryId/monsters/:newId` (matches `monster-detail.ts`'s existing `backLink()`/`mysteryId` route-param handling — the mystery-aware detail route already exists at `mysteries.routes.ts:12-15`). If created unattached, navigate to `/monsters/:newId` (top-level route). Applies identically whether the batch sub-resource step fully succeeds or partially fails (decision 12) — the destination is determined once the monster exists, not once every sub-resource has saved. No new detail-page logic needed either way — `monster-detail.ts` already branches on the presence of a `mysteryId` route param. |
| 15 | **Detail rewire (`monster-detail.ts` consumes `MonsterFormComponent`) — Skyler's decision, locked, no longer conditional** | **In scope, this same phase** — Skyler confirmed the recommendation. `monster-detail.ts`/`.html` are updated to render `<app-monster-form>` for the core 5 fields instead of their own inline `FormGroup`/template block, eliminating the duplication that would otherwise persist indefinitely. This only touches the core-fields block — the 4 sub-resource panels on `monster-detail.ts` are untouched, still immediate-per-action, still not shared with `monster-create.ts`'s draft panels (decision 11). |

---

## Architecture Discussion

### Choosing the sub-resource authoring model: local drafts + batched submit vs. create-then-reveal

Two shapes were weighed for decision 9, given decision 8 locked in "sub-resources on the create page itself, no navigation required to reach them":

**Option A — Local draft arrays + single batched submit (chosen).** Sub-resource forms push to local `signal<T[]>` arrays; nothing hits the API until the single "Create Monster" submit, which creates the monster, then batch-creates every draft against the real ID (`forkJoin`, mirroring `mystery-create.store.ts`'s `saveThreatCollections`/`runBatch`), then navigates.

**Option B — Create-then-reveal.** The first "Create Monster" click (core 5 fields only) creates the bare monster immediately; the page then transitions into an edit-like state — either staying conceptually on `/monsters/new` while internally holding the new ID, or silently swapping the URL to `/monsters/:newId` — and reveals the 4 sub-resource panels using `monster-detail.ts`'s existing immediate-per-action pattern. At that point the create page is, functionally, rendering (or delegating to) `monster-detail.ts` for everything past the core fields.

**Chosen: Option A.** Two reasons, in order of weight:

1. **Skyler's own wording rules out Option B's central mechanic.** "The 4 sub-resource panels included on the create page itself, not deferred to a second navigation via monster-detail" reads as ruling out *any* navigation gating access to the sub-resource panels — including an automatic one the user doesn't have to click through. Option B's core move (revealing the panels only *after* an initial create-the-bare-monster step, even if silent/automatic) is exactly a second, gated step of the shape being rejected — the panels aren't reachable at all until that first step completes. Option A has the panels visible and fillable from the moment the page loads, before any API call has happened.
2. **Option A isn't a new pattern for this codebase — it's the exact "signal arrays, not FormArrays" convention (`.squad/decisions.md`, 2026-07-21) applied outside the wizard for the first time**, not new machinery invented for this phase. The sequencing (`create monster` → `switchMap` → `forkJoin` the sub-resources against the real ID) is a direct, working precedent already proven in `mystery-create.store.ts`'s `submitPhase1`/`saveThreatCollections`. Option B, by contrast, would have required a *second* shared-extraction decision beyond `MonsterFormComponent` (extracting `monster-detail.ts`'s sub-resource panels into something the create page could also render/delegate to) — a real increase in this phase's surface area for a shape Skyler's wording already rules out anyway.

Option A costs real complexity Option B would have avoided (a second async phase to sequence, a partial-failure case to handle explicitly — decision 12) but that complexity is bounded, precedented, and page-local (lives entirely in `monster-create.ts`, doesn't leak into `MonsterFormComponent` or `monster-detail.ts`). Option B's apparent simplicity was actually deferred complexity (a second shared-extraction decision) plus a UX shape Skyler had already rejected.

### The "share only when submission models match" principle

This doc makes three separate share/don't-share calls, and stating the throughline explicitly keeps them consistent rather than looking like three unrelated judgment calls:

- **Decision 1 (share `MonsterFormComponent`): share.** Both call sites use the component identically — validate, emit one `save` event, let the caller do exactly one thing with it. The component's own contract is never batchy on either side.
- **Decision 11 (don't share the 4 sub-resource panels): don't share.** `monster-create.ts`'s panels are local-draft-then-batch; `monster-detail.ts`'s panels are immediate-per-action. These are genuinely different submission models, not just different visual contexts — exactly the condition multi-minion's decision #8 already identified as disqualifying for sharing.
- **Decision 15 (wire `MonsterFormComponent` into `monster-detail.ts`): share (this was always true, decision 1 already covers it).** Restated here only to confirm it isn't destabilized by decision 9's sub-resource redesign — `monster-detail.ts`'s own save flow for its core 5 fields stays a single immediate `update()` call, identical in shape to before.

The rule isn't "share forms" or "don't share forms" as a blanket policy — it's "share exactly the piece whose submission model is identical on both sides, and no more." `MonsterFormComponent` qualifies because its *entire* responsibility (5 fields, one emit) has an identical submission model everywhere it's used. The sub-resource panels don't qualify because, despite looking similar, one side batches and the other doesn't.

### Why mysteryless creation is cheap, not risky

The instinct might be that "a monster with no mystery" is a weird, unsupported state requiring careful handling. It isn't — it's already a state the schema, the DTOs, and the existing `/monsters` list page all support today, just one that's never been *reachable* because every existing creation path (the wizard) always links a mystery. This phase doesn't introduce a new kind of data; it introduces the first UI path capable of producing a state the backend already tolerates. That's why decision 6's new endpoint is a thin, additive change (one service overload, one controller action, one Angular method) rather than a schema or contract change.

### Why the mystery-picker field stays outside `MonsterFormComponent`

`MonsterFormComponent`'s entire value is being byte-for-byte identical between create and edit. A mystery-selection field has no meaning in edit mode (monster-detail has no "attach to another mystery" UI, and building one is explicitly out of scope — see Known Gaps). Putting a create-only field inside a component whose contract is "used identically in both modes" would immediately break that contract and force the edit-mode caller to either hide the field or ignore its value — both are worse than just keeping it as a sibling control the create page owns directly.

---

## Sub-Phases

Ordering: SC-2 has no dependency on the others and can land first. SC-1 is unconditionally in scope (decision 5/6 are locked). SC-3 depends on SC-2 (needs `MonsterFormComponent`) and SC-1 (needs `createStandalone()` for the blank-picker path). SC-4 depends on SC-2 and is unconditionally in scope (decision 15).

### SC-1 — Backend: Mysteryless Monster Create Endpoint

**Goal:** Close the one real API gap (decision 6). No longer conditional — required.

**Work:**
- `IMonsterService`: add `Task<ServiceResult<MonsterDetailResponse>> CreateAsync(UpsertMonsterRequest request, CancellationToken cancellationToken);` overload.
- `MonsterService.cs`: implement it — same body as the existing `CreateAsync(Guid mysteryId, ...)` (`MonsterService.cs:23-60`) minus the `MysteryExistsAsync` check and the `LinkMonsterToMysteryAsync` call. Still validates `MonsterTypeExistsAsync`/`MonsterArchetypeExistsAsync`.
- `MonstersController.cs`: add
  ```csharp
  [HttpPost("api/monsters")]
  public async Task<ActionResult<MonsterDetailResponse>> Create([FromBody] UpsertMonsterRequest request, CancellationToken cancellationToken)
  {
      var result = await monsterService.CreateAsync(request, cancellationToken);
      if (!result.IsSuccess)
      {
          return ToErrorResult(result.Error!);
      }

      return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
  }
  ```
  No collision with the existing `[HttpGet("api/monsters")]` (different HTTP verb).
- `src/web/monster-of-the-week-web/src/app/core/monster.ts`: add `createStandalone(request: UpsertMonsterRequest): Observable<MonsterDetailResponse>` posting to `/api/monsters`.

**Files modified:**
| File | Notes |
|---|---|
| `src/api/MonsterOfTheWeek.Api/Services/IMonsterService.cs` | Add `CreateAsync` overload |
| `src/api/MonsterOfTheWeek.Api/Services/MonsterService.cs` | Implement overload |
| `src/api/MonsterOfTheWeek.Api/Controllers/MonstersController.cs` | Add `POST api/monsters` |
| `src/web/monster-of-the-week-web/src/app/core/monster.ts` | Add `createStandalone()` |
| `src/api/MonsterOfTheWeek.Api.Tests/Services/MonsterServiceTests.cs` | New coverage |

**Verification:**
- `dotnet build MonsterOfTheWeek.slnx` passes.
- New xUnit test: `CreateAsync(request)` (no mysteryId) creates a monster with `MysteryIds: []`; validation failures (bad `MonsterTypeId`/`MonsterArchetypeId`) behave identically to the mystery-scoped overload; the created monster is retrievable via `GetByIdAsync` and appears in `GetAllAsync`.

---

### SC-2 — Frontend: Extract `MonsterFormComponent`

**Goal:** Decisions 1-4. `monster-detail.ts` is wired to consume it in this same phase (SC-4, decision 15 — no longer conditional), but SC-2 itself only needs to land the component; sequencing SC-2 before SC-3/SC-4 (or combining SC-2+SC-4 in one PR) is an implementation-time call.

**Work:**
- New `features/monsters/shared/monster-form/monster-form.ts` (+ `.html`, `.scss`), following the `features/mysteries/shared/` precedent for domain-scoped-but-reusable pieces.
- Move `monsterForm` definition, `Validators.required` rules, `populateMonsterForm()`-equivalent (`ngOnChanges` on the `monster` input), and the submit-guard logic (`markAllAsTouched()` + early return, matching `saveMonster()`'s existing pattern) from `monster-detail.ts` into the new component.
- Move the template block (`monster-detail.html:44-77`) into `monster-form.html`, reusing the same Tailwind token classes verbatim (`border-strong`, `focus-accent`, `bg-accent`/`text-on-accent`, `app-custom-select`).
- `@Input() monsterTypes`, `@Input() monsterArchetypes`, `@Input() monster: MonsterDetailResponse | null`, `@Input() isSaving`, `@Input() submitLabel`, `@Output() save`.

**Files added:**
| File | Notes |
|---|---|
| `src/web/.../features/monsters/shared/monster-form/monster-form.ts` | New component |
| `src/web/.../features/monsters/shared/monster-form/monster-form.html` | Extracted template |
| `src/web/.../features/monsters/shared/monster-form/monster-form.scss` | If any component-scoped styles are needed beyond Tailwind utilities (verify at implementation time — `monster-detail.scss` should be checked for anything the extracted block currently relies on) |
| `src/web/.../features/monsters/shared/monster-form/monster-form.spec.ts` | New: validation guard, `save` emission shape, `ngOnChanges` repopulation on `monster` input change |

**Verification:**
- `npm run build` passes.
- `npm run test -- --watch=false`: new spec covers invalid-submit (no `save` emitted, `markAllAsTouched` called), valid-submit (`save` emits correct `UpsertMonsterRequest` shape), and `monster` input changes repopulating the form.

---

### SC-3 — Frontend: `/monsters/new` Create Page, Route, Entry Point, Sub-Resource Drafts

**Goal:** Decisions 5-14. Depends on SC-2 (needs `MonsterFormComponent`) and SC-1 (needs `createStandalone()`).

**Work:**
- New `features/monsters/pages/monster-create/monster-create.ts` (+ `.html`, `.scss`):
  - `ngOnInit` does the same reference-data `forkJoin` `monster-detail.ts` already does (`monsterTypes`, `monsterArchetypes`, `weaponTags` via `ReferenceDataService`), plus `MysteryService.getMysteries()` for the optional picker (decision 5).
  - Defines `AttackDraft`/`PowerDraft`/`ArmorDraft`/`WeaknessDraft` locally (decision 10) and four `signal<T[]>` draft arrays, plus four small add-forms (`attackDraftForm`/`powerDraftForm`/`armorDraftForm`/`weaknessDraftForm`) field-for-field identical to `monster-detail.ts`'s own `attackForm`/`powerForm`/`armorForm`/`weaknessForm`, including `WeaponTagSelectComponent` on the attack form.
  - `addAttackDraft()`/`removeAttackDraft(index)` (and the power/armor/weakness equivalents): validate the mini-form, push/splice the local array, reset the mini-form. **No API calls** — this is the one behavioral difference from `monster-detail.ts`'s equivalent methods.
  - Template renders `<app-monster-form [monsterTypes]="..." [monsterArchetypes]="..." [monster]="null" submitLabel="Create Monster" [isSaving]="isSaving()" (save)="onCreate($event)" />`, the optional mystery-picker control (decision 4, a plain `CustomSelectComponent` against `mysteries()`, no validation), and the 4 draft panels (each: a list of current drafts with a remove button, plus its own small add-form — no submit button of its own; `MonsterFormComponent`'s "Create Monster" button is the only page-level submit action, per decision 3/9).
  - `onCreate(payload: UpsertMonsterRequest)`: sets `isSaving`, reads the mystery-picker signal, calls `monsterService.create(mysteryId, payload)` or `monsterService.createStandalone(payload)` accordingly, then `switchMap`s into `saveSubResourceDrafts(monster.id)` (a private method mirroring `mystery-create.store.ts`'s `saveThreatCollections`/`runBatch` — `forkJoin` per sub-resource type, `runBatch` short-circuits to `of([])` for an empty draft array, weapon-tag assignment chained per created attack exactly as `saveThreatCollections` does). On full success: navigate per decision 14. On failure during the initial create call: `isSaving.set(false)`, show an inline error, drafts and core-field values stay intact (mirrors `saveMonster()`'s existing error path). On failure during `saveSubResourceDrafts`: still navigate per decision 14 (the monster exists), plus `notificationService.error(...)` noting some details may not have saved (decision 12).
- `monsters.routes.ts`: add `{ path: 'new', loadComponent: () => import('./pages/monster-create/monster-create').then((m) => m.MonsterCreateComponent) }`, inserted **before** `{ path: ':monsterId', ... }`.
- `monsters-list.html`/`.ts`: add a "+ Add Monster" button/`routerLink="/monsters/new"` next to the `<h2>Monsters</h2>` header (decision 7).

**Files added/modified:**
| File | Status | Notes |
|---|---|---|
| `src/web/.../features/monsters/pages/monster-create/monster-create.ts` | Added | New page; also defines the 4 local draft interfaces (decision 10) |
| `src/web/.../features/monsters/pages/monster-create/monster-create.html` | Added | New page template — `<app-monster-form>`, mystery picker, 4 draft panels |
| `src/web/.../features/monsters/pages/monster-create/monster-create.scss` | Added | New page styles |
| `src/web/.../features/monsters/pages/monster-create/monster-create.spec.ts` | Added | New coverage |
| `src/web/.../features/monsters/monsters.routes.ts` | Modified | Add `new` route before `:monsterId` |
| `src/web/.../features/monsters/pages/monsters-list/monsters-list.html` | Modified | Add entry-point button |
| `src/web/.../features/monsters/pages/monsters-list/monsters-list.ts` | Modified (if wiring needed) | Verify at implementation time — likely template-only |

**Verification:**
- Manual: from `/monsters`, click "Add Monster," fill core 5 fields, add 2 attacks (one with a weapon tag), 1 power, 1 armor, 1 weakness as drafts (no network calls yet — confirm via devtools), submit — one create call plus a batch of sub-resource creates fire, new monster appears in the flat list with all drafted sub-resources present; if a mystery was picked, it also appears on that mystery's detail page.
- Manual: leave the mystery picker blank — monster is created, appears in `/monsters`, `mysteryIds` is empty, no crash anywhere that reads it.
- Manual: remove a draft before submitting — confirm it never reaches the API (not present on the created monster).
- Manual: invalid core-field submit (blank Name) shows validation errors, no API call made, drafts remain in place.
- Manual (if feasible to simulate, e.g. via a temporary network-fault or a unit-level spec on `onCreate`): a sub-resource batch failure after successful monster creation still navigates to the new monster's detail page and shows an error notification, per decision 12.
- `npm run build` passes; `npm run test -- --watch=false` passes.

---

### SC-4 — Frontend: Wire `MonsterFormComponent` Into `monster-detail.ts`

**Goal:** Decision 15 — eliminate the duplication SC-2 would otherwise leave in place. No longer conditional.

**Work:**
- `monster-detail.ts`: remove `monsterForm`, `saveMonster()`'s form-building logic, `populateMonsterForm()`; replace with `<app-monster-form [monster]="monster()" [monsterTypes]="monsterTypes()" [monsterArchetypes]="monsterArchetypes()" [isSaving]="isMutating()" submitLabel="Save Monster" (save)="saveMonster($event)" />`, where `saveMonster(payload)` keeps its existing `monsterService.update(...)` call but now receives the payload as an argument instead of reading it off `this.monsterForm`.
- `monster-detail.html`: remove the extracted template block (lines 44-77), replace with the component tag.
- `monster-detail.spec.ts`: update to reflect the new component boundary (form interaction now goes through `MonsterFormComponent`, not `monster-detail`'s own `FormGroup`).

**Files modified:**
| File | Notes |
|---|---|
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.ts` | Remove inline form, wire component, adjust `saveMonster()` signature |
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.html` | Replace inline form markup with `<app-monster-form>` |
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.spec.ts` | Update for new component boundary |

**Verification:**
- Manual: edit an existing monster's core fields via the now-shared component, save, confirm the sub-resource panels (untouched, still immediate-per-action, per decision 11) still work identically.
- `npm run build` passes; `npm run test -- --watch=false` passes, including updated `monster-detail.spec.ts`.

---

## Files Affected Summary

| File | Status | Sub-Phase | Notes |
|---|---|---|---|
| `src/api/.../Services/IMonsterService.cs` | Modified | SC-1 | Add `CreateAsync` overload |
| `src/api/.../Services/MonsterService.cs` | Modified | SC-1 | Implement overload |
| `src/api/.../Controllers/MonstersController.cs` | Modified | SC-1 | Add `POST api/monsters` |
| `src/api/.../MonsterOfTheWeek.Api.Tests/Services/MonsterServiceTests.cs` | Modified | SC-1 | New coverage |
| `src/web/.../core/monster.ts` | Modified | SC-1 | Add `createStandalone()` |
| `src/web/.../features/monsters/shared/monster-form/monster-form.ts` | Added | SC-2 | New shared component |
| `src/web/.../features/monsters/shared/monster-form/monster-form.html` | Added | SC-2 | Extracted template |
| `src/web/.../features/monsters/shared/monster-form/monster-form.scss` | Added | SC-2 | If needed |
| `src/web/.../features/monsters/shared/monster-form/monster-form.spec.ts` | Added | SC-2 | New coverage |
| `src/web/.../features/monsters/pages/monster-create/monster-create.ts` | Added | SC-3 | New page; local draft interfaces + batch-submit orchestration |
| `src/web/.../features/monsters/pages/monster-create/monster-create.html` | Added | SC-3 | New page template — core form, mystery picker, 4 draft panels |
| `src/web/.../features/monsters/pages/monster-create/monster-create.scss` | Added | SC-3 | New page styles |
| `src/web/.../features/monsters/pages/monster-create/monster-create.spec.ts` | Added | SC-3 | New coverage, including batch-submit and partial-failure paths |
| `src/web/.../features/monsters/monsters.routes.ts` | Modified | SC-3 | Add `new` route before `:monsterId` |
| `src/web/.../features/monsters/pages/monsters-list/monsters-list.html` | Modified | SC-3 | Add "Add Monster" entry point |
| `src/web/.../features/monsters/pages/monsters-list/monsters-list.ts` | Modified (if needed) | SC-3 | Verify at implementation time |
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.ts` | Modified | SC-4 | Wire shared component |
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.html` | Modified | SC-4 | Wire shared component |
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.spec.ts` | Modified | SC-4 | Update for new boundary |

> All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`; all `src/api/...` paths expand to `src/api/MonsterOfTheWeek.Api/` (tests under `src/api/MonsterOfTheWeek.Api.Tests/`).

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|---|---|---|
| No "attach an existing unattached monster to a mystery" UI | Monsters created via the blank-picker path (decision 5) have zero mystery links, and there is no UI anywhere to attach one after the fact — only at creation time via this phase's picker. `UnlinkMonsterFromMysteryAsync`/the mystery-scoped `Create` endpoint exist, but no "link an existing monster" endpoint or UI does. | Real, known gap — out of scope for this bare-bones phase. Flag for a future phase if it turns out to matter in practice. |
| `mystery-detail.html` entry point for "Add Monster" | Per decision 7 — only the top-level `/monsters` list gets an entry point in this phase. | Additive follow-up, not designed here. |
| No transactional guarantee on the sub-resource batch (decision 12) | If the batch partially fails after the monster is created, whichever sub-resources succeeded before the failure remain persisted; there's no rollback of the monster or the partial sub-resources. Same accepted risk shape as the parked wizard's own `saveThreatCollections`/`forkJoin`, not a new risk introduced by this phase. | Accepted for this bare-bones phase. The mitigation in place (navigate to the real, now-existing monster's detail page + error toast, decision 12) lets the user finish manually via `monster-detail.ts`'s existing immediate-per-action panels rather than being stranded. Revisit only if partial failures turn out to be common in practice. |
| No edit-in-place for a draft on the create page | Sub-resource drafts are add/remove only (matching the wizard's own pre-Bug-2-fix-era pattern for monster-level sub-items, which was never revisited for edit-in-place even after the fix — only minion-level drafts got that treatment, and only in the now-parked multi-minion plan). To edit a drafted sub-resource before submit, remove it and re-add it. | Acceptable for bare-bones; a small, real, same-shape gap as the ones already flagged in the multi-minion doc for locations/bystanders. Revisit only if it proves annoying in practice. |
| Minion/Location/Bystander standalone creation | Explicitly out of scope for this document (see top-of-doc scope note). | Each gets its own follow-up phase doc. |

---

## Verification Checklist

- [ ] `dotnet build MonsterOfTheWeek.slnx` passes with no warnings
- [ ] `dotnet test MonsterOfTheWeek.slnx` passes, including new `CreateAsync(request)` (no-mystery overload) coverage
- [ ] `npm run build` passes with no errors
- [ ] `npm run test -- --watch=false` passes, including new `monster-form.spec.ts` and `monster-create.spec.ts`, plus updated `monster-detail.spec.ts`
- [ ] `/monsters` list page shows a working "Add Monster" entry point
- [ ] Creating a monster attached to a mystery (via the picker) succeeds and the monster appears on that mystery's detail page
- [ ] Creating a monster with the mystery picker left blank succeeds, the monster appears in the flat `/monsters` list with no mystery badge/crash, and is independently deletable via the existing delete flow
- [ ] Adding attack/power/armor/weakness drafts on the create page makes no network calls until the single "Create Monster" submit
- [ ] Submitting with 2+ drafts across all 4 sub-resource types results in all of them existing on the newly created monster, visible immediately on `monster-detail.ts` after navigation
- [ ] Removing a draft before submit means it never reaches the API
- [ ] Weapon tags selected on a drafted attack are correctly assigned after the batch submit
- [ ] Invalid core-field submission (blank Name) shows validation state, makes no API call, and preserves any drafts already added
- [ ] A sub-resource batch failure after successful monster creation still navigates to the new monster's detail page and surfaces an error notification (decision 12)
- [ ] Post-create navigation lands on the correct detail route (mystery-scoped vs. top-level) per decision 14
- [ ] `MonsterFormComponent` correctly repopulates when its `monster` input changes (exercised by `monster-detail.ts` after SC-4)
- [ ] Editing an existing monster's core fields via the now-shared component still saves correctly and the 4 sub-resource panels (immediate-per-action, unchanged) are unaffected
- [ ] `docker compose up -d postgres && dotnet run` workflow unaffected
