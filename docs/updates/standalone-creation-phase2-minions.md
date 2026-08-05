# Standalone Creation — Phase 2: Minions

**Prepared by:** Yoshi (Architect)
**Status:** Proposed — pending Skyler sign-off on the one open entry-point question below. Everything else is locked.
**Date:** 2026-08-05

> Filed under `docs/updates/` per the same convention as `docs/updates/standalone-creation-phase1-monsters.md` (now shipped/committed) and `docs/updates/multi-minion-support.md`. Structure follows Phase 1's doc.

This is **Phase 2 of a four-part "standalone creation" initiative**: the ability to create a new Monster, Minion, Location, or Bystander outside the mystery-creation wizard's normal flow. Phase 1 (Monster) shipped and is committed — re-read as the current reference for both convention and precedent; some of its content changed materially between an early pass and its final, shipped form (the sub-resource authoring model in particular). **This document designs Minion creation only.** Location and Bystander remain out of scope, each getting its own follow-up doc.

The now-parked `docs/updates/multi-minion-support.md` already explored related ground (its decision #5: inline stub-create on `monster-detail.ts` → navigate to `minion-detail.ts`) under a different framing — multi-minion support within the wizard's editing model, not this bare-bones one-at-a-time initiative. It remains parked and untouched. Its conclusions are referenced for precedent where they still hold, not assumed to carry over unmodified — in particular, it predates Skyler's Phase 1 decision that sub-resources belong on the create page itself via local drafts, which its own "stub-create then navigate to the full detail page" framing didn't anticipate.

---

## What Actually Shipped for Phase 1 (Re-Verified Against Current Source)

Confirmed by reading the current, committed code (not just the doc):

- `POST /api/monsters` (`MonstersController.cs`) — mysteryless create endpoint, alongside the existing mystery-scoped `POST /api/mysteries/{mysteryId}/monsters`. `MonsterService.CreateAsync(UpsertMonsterRequest)` overload, no repository/migration changes.
- `MonsterFormComponent` (`features/monsters/shared/monster-form/monster-form.ts`) — presentational, owns its own `FormGroup` (5 core fields), `@Input() monster: MonsterDetailResponse | null` (`null` = create), `@Output() save = EventEmitter<UpsertMonsterRequest>()`. Consumed by both `monster-create.ts` and `monster-detail.ts` (which was rewired — its own inline form is gone, confirmed reading the current file).
- `/monsters/new` (`features/monsters/pages/monster-create/monster-create.ts`) — new create page. Optional "Attach to Mystery" dropdown (`mysteryControl`, plain string control, no validators — blank is valid). All 4 sub-resource types (attacks/powers/armors/weaknesses) are **local draft arrays** (`signal<AttackDraft[]>` etc., interfaces defined directly in `monster-create.ts`, no `id` field) with their own small add-forms that push to the array and never call the API. The single "Create Monster" submit (`MonsterFormComponent`'s own button, `(save)="onCreate($event)"`) is the only thing that talks to the API: `onCreate` creates the monster (`create(mysteryId, ...)` or `createStandalone(...)` depending on whether the dropdown has a value), then `switchMap`s into `saveSubResourceDrafts(monster.id)` (`forkJoin` per sub-resource type via a private `runBatch` helper, weapon-tag assignment chained per created attack), then always navigates to the new monster's detail page — even if the sub-resource batch partially fails, in which case an error notification is shown instead of stranding the user on the create page. **This is the established, shipped, Skyler-approved pattern for this entire initiative going forward**, not a one-off for Monster.
- Entry point: "+ Add Monster" on the top-level `/monsters` list (`monsters-list.html`), `routerLink="/monsters/new"`.
- Route ordering: `{ path: 'new', ... }` registered in `monsters.routes.ts` **before** `{ path: ':monsterId', ... }` — Angular matches top-down; this is a real, repeatable gotcha, not a one-time note (see Resolved Decision 8 below, where it recurs at a different route depth).

---

## Background — What's Different About Minion (Confirmed From Current Source)

- **`Minion.MonsterId` is a required, non-nullable FK — confirmed at every layer, not just the migration doc.** `Data/Entities/DomainEntities.cs:281`: `public Guid MonsterId { get; set; }` (value type, no `?`). The original migration (`Data/Migrations/20260726000551_ExtractMinionsToOwnTable.cs:32`): `monster_id = table.Column<Guid>(type: "uuid", nullable: false)`. `MinionService.CreateAsync` (`Services/MinionService.cs:23-28`) 404s if the monster doesn't exist, before anything else. This is categorically different from Monster's optional M:N mystery attachment (Phase 1 background) — **a minion cannot exist without a monster, full stop.** There is no "unattached" state to default a picker to, unlike Monster's blank-defaulting mystery dropdown.
- **No backend gap exists for Minion creation, unlike Phase 1's Monster.** `POST /api/monsters/{monsterId}/minions` (`MinionsController.cs:18-28` → `MinionService.CreateAsync(Guid monsterId, UpsertMinionRequest, ...)`, `Services/MinionService.cs:23-54`) already requires and validates a real `monsterId` in the route, already validates `MinionTypeExistsAsync` and a non-blank `Name`, and already creates the minion correctly. Phase 1 needed a new endpoint specifically *because* Monster's mystery attachment is optional (the existing endpoint always required a mystery, and "unattached" needed a new code path). Minion's attachment is *never* optional, so the existing endpoint's "always requires a valid parent" shape is already exactly the shape a required-attachment create flow needs — there is nothing to add. Confirmed by reading `IMinionService.cs`/`MinionService.cs`/`MinionsController.cs` in full: no analog to Phase 1's `createStandalone()` is needed anywhere.
- `MinionService.ts` (Angular, `core/minion.ts`) already has `create(monsterId, request)`, `getById`, `update`, `getAll` (flat, top-level), `getByMonster`, and full CRUD for all 4 sub-resource types — including `update*` methods for attacks/powers/armors/weaknesses, which `MonsterService.ts` notably lacks (an existing, pre-Phase-2 asymmetry, not something this phase needs to touch). No `delete(minionId)` exists at any layer — confirmed by grep across `IMinionService.cs`/`MinionService.cs`/`MinionsController.cs`, only sub-resource deletes exist. **Not needed for this phase**: Phase 2 is creation only, and removing a locally-drafted sub-resource before submit needs no API call (same as Phase 1) — no whole-minion delete feature is in scope here, so this pre-existing gap (also flagged in the parked multi-minion doc) isn't blocking.
- `features/minions/pages/minion-detail/minion-detail.ts` (+ `.html`) is a complete, working, **immediate-mutation** edit page — confirmed identical shape to `monster-detail.ts`'s pre-Phase-1 state: its own `minionForm` (name/description/harmCapacity/minionTypeId, `FormBuilder`), `saveMinion()` calling `minionService.update(id, payload)` directly, and 4 full sub-resource panels (attacks w/ weapon tags, powers, armors, weaknesses) each with their own inline add-form calling the corresponding `create*` method **immediately, per action**, via a `runAndRefresh`-shaped helper — because the minion already exists by the time this page is reachable. It hard-requires an existing `minionId` route param (`ngOnInit` throws if absent) — **no create mode.** It's reachable at three route shapes today (`/minions/:minionId`, `/monsters/:monsterId/minions/:minionId`, `/mysteries/:mysteryId/minions/:minionId` — confirmed in `minions.routes.ts`, `monsters.routes.ts`, `mysteries.routes.ts` respectively), and its `backLink()`/`backLabel()` already branch on which of `mysteryId`/`monsterId` route params are present, falling back to `/minions` if neither is. This multi-route-shape, param-presence-driven pattern is existing precedent this phase reuses (see Resolved Decision 5), not new.
- `features/minions/pages/minions-list/minions-list.ts` (+ `.html`) already renders a **flat, top-level `/minions` list** (`MinionService.getAll()` → `GET /api/minions`, confirmed live) — mirrors `/monsters` structurally (Option A from the old `docs/phases/phase-8-minions-ui-flow.md` was the one actually implemented). Every row already shows which monster it belongs to (`minion.monsterId`/`minion.monsterName`, both present on `MinionListItemResponse` — confirmed in `core/models.ts:234-247`, since the FK is mandatory this is never blank, unlike Monster's optional `mysteryIds`). **It has zero create affordance** — same gap shape `/monsters` had before Phase 1, confirmed by reading the current template (`minions-list.html`).
- `monster-detail.ts`/`.html` already renders a read-only list of a monster's existing minions (`minions` signal, `minionService.getByMonster(monsterId)`, lines 41/109/119 of the current `monster-detail.ts`) with links into `/monsters/:monsterId/minions/:minionId` — **confirmed zero "Add Minion" affordance** anywhere on the page, reading the current, post-Phase-1 template in full.
- `UpsertMinionRequest` (`core/models.ts:293-298`) has no `monsterId` field at all — it's supplied purely via the route/service-method parameter on `create()`, and `update()` has no way to change it either. **There is no "reassign a minion to a different monster" feature anywhere in the app** — a minion's monster is fixed for its whole lifetime, confirmed by reading every place `UpsertMinionRequest` is constructed or consumed. This matters for Resolved Decision 4 below (where `monsterId` lives).
- `ReferenceDataService.getMinionTypes()` (`core/reference-data.ts:50`) already exists — the reference data `MinionFormComponent` needs, same shape as `getMonsterTypes()`. `MonsterService.getAll()` (`core/monster.ts`, already used by `monsters-list.ts`) already returns a flat `MonsterListItemResponse[]` — the exact reference data a "which monster" dropdown needs, zero new backend work, mirroring how `MysteryService.getMysteries()` served Monster's optional picker in Phase 1.
- `CustomSelectComponent` works unmodified against `MonsterListItemResponse` (has `id`/`name`) for a monster picker, exactly as it did against `MysteryListItemResponse` in Phase 1 — no new shared widget needed.
- `MinionDetailResponse.customMoves` exists in the contract but **`minion-detail.ts` renders no custom-move UI at all** (confirmed reading the current template — no custom-move form/list anywhere), consistent with the Phase 8 planning history noting this was deliberately deferred. This phase mirrors `minion-detail.ts`'s actual current scope, not the full contract — custom moves stay out of scope here too (see Resolved Decision 11).

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | **Is any new backend work needed?** | **No.** `POST /api/monsters/{monsterId}/minions` already requires and validates a real `monsterId`, exactly matching what a required-attachment create flow needs — unlike Monster, which needed a new endpoint because its attachment was optional. Confirmed by reading `IMinionService.cs`/`MinionService.cs`/`MinionsController.cs` in full: no gap exists. This phase is frontend-only. |
| 2 | **Build a shared `MinionFormComponent`?** | **Yes**, extracted from `minion-detail.ts`'s existing form. Justified by the exact "share only when submission models match" principle established in Phase 1: `minion-detail.ts` is confirmed immediate-mutation, single-page, no batching (`saveMinion()` → one `minionService.update()` call) — the identical submission-model shape `monster-detail.ts` had pre-Phase-1, which is what made sharing `MonsterFormComponent` correct there. The same condition holds here unmodified. |
| 3 | **`MinionFormComponent` shape** | Mirrors `MonsterFormComponent` almost exactly: a presentational component owning its own `FormGroup` (4 fields — name/description/harmCapacity/minionTypeId, field-for-field identical to `minion-detail.ts`'s current `minionForm`, including its existing validator shape, e.g. `minionTypeId` has no explicit `Validators.required` today, same as `monsterTypeId` did not in `MonsterFormComponent` — not "fixed" here, out of scope). `@Input() minionTypes: TypeRefResponse[]`, `@Input() minion: MinionDetailResponse \| null` (`null` = create mode; populates via `ngOnChanges`, reading `minion.minionType.id` exactly as `minion-detail.ts`'s current `populateMinionForm` does), `@Input() isSaving`, `@Input() submitLabel` (`"Create Minion"` vs `"Save Minion"`). `@Output() save = new EventEmitter<UpsertMinionRequest>()`. Does not call `MinionService` itself — same smart-page/dumb-widget split as `MonsterFormComponent`. |
| 4 | **Where does `monsterId` live?** | **Outside `MinionFormComponent` entirely** — not just because it's a create-only concern (the same reasoning that kept Monster's mystery picker out of `MonsterFormComponent`), but because `monsterId` **isn't part of `UpsertMinionRequest` at all** — it's supplied via the route/service-method parameter, and there is no feature anywhere to change a minion's monster after creation. `MinionFormComponent` never needs to know or reference `monsterId` in either create or edit mode; it lives entirely in whichever page hosts the component, resolved differently depending on entry point (Resolved Decision 5). |
| 5 | **Entry point / how `monsterId` is resolved — central design fork, my recommendation given below, treated as an explicit open question for Skyler** | **One `MinionCreateComponent`, registered at two routes**, reusing the exact multi-route-shape, param-presence-driven pattern `minion-detail.ts` already uses for `mysteryId`/`monsterId`/neither: `/monsters/:monsterId/minions/new` (monster locked from the route param — no dropdown shown, just a "Creating a minion for {Monster Name}" label) and `/minions/new` (no `monsterId` param — a required monster dropdown is shown, backed by `MonsterService.getAll()`). See "The Entry-Point Fork" in Architecture Discussion and **Open Questions for Skyler** below — this is the one genuinely open product-scope call in this phase. |
| 6 | **Sub-resource authoring model on the create page** | **Inherited unmodified from Phase 1: local draft arrays (`signal<T[]>`), single batched submit triggered by `MinionFormComponent`'s own submit button.** Nothing about Minion's constraints changes the calculus that decided this for Monster (the minion doesn't exist yet while attacks/powers/armors/weaknesses are being drafted, so `minion-detail.ts`'s immediate-per-action pattern can't work unmodified, for the identical reason `monster-detail.ts`'s couldn't). Per the coordinator's framing, this is now the established pattern for the whole initiative, not re-derived per phase — see `docs/updates/standalone-creation-phase1-monsters.md`'s "Choosing the sub-resource authoring model" discussion for the full comparison against create-then-reveal; it applies here unchanged. `AttackDraft`/`PowerDraft`/`ArmorDraft`/`WeaknessDraft` interfaces are defined fresh, directly in `minion-create.ts` (not imported from `monster-create.ts` or the parked wizard — same reasoning as Phase 1 decision 10: avoids coupling unrelated pages, and the field shapes are driven by `UpsertMinion*Request` contracts, not `UpsertMonster*Request` ones, so they aren't even identical shapes to import). |
| 7 | **No shared sub-resource panel components between `minion-create.ts` and `minion-detail.ts`** | Same reasoning as Phase 1 decision 11: `minion-create.ts`'s panels are local-draft-then-batch; `minion-detail.ts`'s stay immediate-per-action. Different submission models, so no sharing — a small amount of literal duplication (4 near-identical add-forms) is accepted over coupling components with genuinely different lifecycles. |
| 8 | **Route registration and ordering** | `MinionCreateComponent` lives at `features/minions/pages/minion-create/` (sibling to `minion-detail`/`minions-list`), mirroring how `minion-detail` is already mounted from three different `*.routes.ts` files. Two registrations: `minions.routes.ts` gets `{ path: 'new', ... }` inserted **before** `{ path: ':minionId', ... }`; `monsters.routes.ts` gets `{ path: ':monsterId/minions/new', ... }` inserted **before** `{ path: ':monsterId/minions/:minionId', ... }`. Same top-down route-matching gotcha as Phase 1's decision 13, recurring at a different route depth — a literal `new` segment must always precede a same-position `:paramName` segment. |
| 9 | **Post-create navigation target** | Always `/monsters/:monsterId/minions/:newId` — regardless of which entry point was used, because `monsterId` is always resolved and known by the time creation succeeds (either locked from the route param or picked from the dropdown), and that route shape gives `minion-detail.ts`'s `backLink()` its richest available context ("← Back to monster"). No mystery-scoped creation route exists in this phase (Skyler didn't ask for one, and none of the entry points under consideration pass a `mysteryId`) — deliberately out of scope, not an oversight; `minion-detail.ts`'s existing `/mysteries/:mysteryId/minions/:minionId` route shape remains reachable for *viewing/editing* an existing minion exactly as it is today, this phase just doesn't add a creation path that starts from that context. |
| 10 | **Partial-failure handling** | Inherited from Phase 1 decision 12, adapted: once the minion is successfully created, any failure in the subsequent sub-resource batch still navigates to the new minion's detail page (Resolved Decision 9) with an error notification noting some details may not have saved, rather than stranding the user on the create page. No transactional guarantee (see Known Gaps) — same accepted risk shape as Phase 1, not a new risk. |
| 11 | **Wire `MinionFormComponent` into `minion-detail.ts` in this same phase** | **Yes, decided, not reopened as a question.** Skyler's explicit Phase 1 precedent (decision 15: rewire `monster-detail.ts` in the same phase rather than leave manufactured duplication) applies with the same reasoning unchanged — `minion-detail.ts`'s core-fields block is exactly as cleanly separable from its sub-resource panels as `monster-detail.ts`'s was. Re-litigating this as a fresh open question per phase would just be re-asking a question Skyler already answered once for the identical shape of decision. |
| 12 | **Custom moves** | **Out of scope**, mirroring `minion-detail.ts`'s own current scope — it renders no custom-move UI today, so Minion creation isn't regressing anything by also omitting it. Not a new gap this phase introduces (see Known Gaps, inherited from Phase 8 planning). |

---

## Open Questions for Skyler

### 1. Entry point: top-level `/minions/new` with a required monster dropdown, monster-detail-only, or both?

Three real shapes:

- **A — Top-level `/minions/new` only, required monster dropdown.** Literally matches Skyler's own framing ("something similar to the attachment dropdown for the Monster"). Simplest single-page build. Con: unlike Monster's *optional* dropdown (which only matters when the user hasn't already decided on a mystery), a *required* dropdown over **every monster in the system** is a real, mandatory step even for the very common case of a user who is already looking at a specific monster's page and wants to add a minion to it — forcing them to leave that context, land on a flat top-level page, and re-find the same monster in a dropdown.
- **B — `monster-detail.ts`-scoped only, no top-level page/dropdown at all.** Directly mirrors the parked multi-minion doc's original instinct (creation belongs where the parent is already known) and needs no dropdown, no `MonsterService.getAll()` reference-data fetch, and no top-level route. Con: loses parity with every other domain's top-level list page in this initiative (`/monsters`, and presumably `/locations`, `/bystanders` later) having its own "+ Add X" entry point; a user who starts at `/minions` (a real, existing, flat top-level page) has no way to create one from there.
- **C — Both, sharing one `MinionCreateComponent` at two routes (my recommendation).** `/monsters/:monsterId/minions/new` (monster locked, no dropdown) for the in-context case; `/minions/new` (monster required via dropdown) for parity with `/monsters`' entry point and for users starting from the flat list. This is Resolved Decision 5 above — I've already decided the *mechanism* (one component, two routes, param-presence-driven, reusing `minion-detail.ts`'s own existing pattern) because that part is an architecture call regardless of which entry point(s) ship; what's still open is whether **both** routes actually ship in this phase's first pass, or whether one is cut.

**My recommendation: C.** The mechanism cost of supporting both is low (one component, a few lines of route-param branching, no new shared widget), and the two entry points serve genuinely different, both-real starting points (already-on-a-monster's-page vs. browsing the flat `/minions` catalog) rather than being redundant with each other. If a leaner first pass is preferred, **B alone** is the safer cut of the two to make (a required dropdown over *all* monsters is the weaker experience of the two entry points on its own, per the con above) — I would not recommend shipping **A alone**.

---

## Architecture Discussion

### The entry-point fork: why one component at two routes, not two components or a forced single shape

The mechanism decision (Resolved Decision 5) is separable from the product question (Open Question 1) — regardless of which route(s) ship, the *right way to build whichever ships* is a single `MinionCreateComponent` that branches on whether a `monsterId` route param is present, not two separate components or a single component that always shows a dropdown (even when a monster is already known from context). This isn't new machinery: `minion-detail.ts` already does exactly this today for `mysteryId`/`monsterId` — reads whichever route params are present, adjusts its own UI (`backLink()`/`backLabel()`) and behavior accordingly, falls back to a sensible default when neither is present. Extending the same param-presence-driven pattern to a create page threading the *same* param through to decide "show a dropdown vs. lock the value" is a direct reuse of a pattern this exact feature area already established, not a new one being invented for this phase. This also means Open Question 1's answer doesn't require a different architecture depending on which option Skyler picks — B and C use the identical component with one route un-registered; only A would (theoretically) let the monster-locked branch go unused, which is itself a reason not to build A alone from scratch.

### Why the sub-resource authoring model isn't re-litigated here

Phase 1's "Choosing the sub-resource authoring model" discussion weighed local-draft-arrays-plus-batch against create-then-reveal and picked the former for two reasons: Skyler's own wording ruled out any navigation gating access to sub-resources (including a silent one), and the local-draft pattern is precedented, established codebase convention rather than new machinery. Both reasons are facts about the *initiative's* UX requirement and the *codebase's* conventions — neither is Monster-specific. Minion's sub-resources (attacks/powers/armors/weaknesses) have the identical "doesn't exist yet, can't call the immediate-per-action endpoints" blocker Monster's did, for the identical reason (the FK target doesn't exist until the parent entity is created). There is no fact about Minion's required-vs-optional parent attachment that touches this reasoning at all — the parent-attachment question (Resolved Decision 5/Open Question 1) and the sub-resource-authoring question (Resolved Decision 6) are orthogonal; one is about *which entity this minion belongs to*, the other is about *when its children get persisted*. Re-deriving the same comparison a second time in this doc would be redundant, not more rigorous.

### Why `monsterId` doesn't live inside `MinionFormComponent`, and why that's an even easier call than Monster's mystery picker

Phase 1 kept the mystery picker outside `MonsterFormComponent` because it was a create-only concern with no meaning in edit mode. That reasoning holds for `monsterId` too, but there's a second, independent reason here that's stronger: `monsterId` isn't part of `UpsertMinionRequest` at all, in either direction — `create()` takes it as a separate method parameter (sourced from the route), and `update()` has no way to change it, meaning there is no code path anywhere in the app, including a hypothetical future one using the *existing* contract, that would let `MinionFormComponent` meaningfully accept or emit a `monsterId`. Baking it into the shared component wouldn't just leak a create-mode concern into a shared contract (Monster's problem) — it would have literally nothing to attach to on the request/response shapes the component already works with.

---

## Sub-Phases

No backend sub-phase exists in this phase (Resolved Decision 1) — this is frontend-only, unlike Phase 1. Ordering: MC-1 has no dependency on the others. MC-2 depends on MC-1 (needs `MinionFormComponent`) and on Open Question 1's resolution (determines which route(s) actually get built). MC-3 depends on MC-1.

### MC-1 — Frontend: Extract `MinionFormComponent`

**Goal:** Resolved Decisions 2-4.

**Work:**
- New `features/minions/shared/minion-form/minion-form.ts` (+ `.html`), following the same `features/<domain>/shared/` precedent `MonsterFormComponent` established (and `features/mysteries/shared/` before that).
- Move `minionForm` definition, its current validator shape (unchanged — see Resolved Decision 3's note on not "fixing" the missing `minionTypeId` validator here), `populateMinionForm()`-equivalent (`ngOnChanges` on the `minion` input, reading `minion.minionType.id`), and the submit-guard logic (`markAllAsTouched()` + early return) from `minion-detail.ts` into the new component.
- Move the template block (`minion-detail.html:18-43`) into `minion-form.html`, reusing the same Tailwind token classes verbatim.
- `@Input() minionTypes`, `@Input() minion: MinionDetailResponse | null`, `@Input() isSaving`, `@Input() submitLabel`, `@Output() save`.

**Files added:**
| File | Notes |
|---|---|
| `src/web/.../features/minions/shared/minion-form/minion-form.ts` | New component |
| `src/web/.../features/minions/shared/minion-form/minion-form.html` | Extracted template |
| `src/web/.../features/minions/shared/minion-form/minion-form.spec.ts` | New: validation guard, `save` emission shape, `ngOnChanges` repopulation |

**Verification:**
- `npm run build` passes.
- `npm run test -- --watch=false`: new spec covers invalid-submit, valid-submit (`save` emits correct `UpsertMinionRequest` shape), and `minion` input changes repopulating the form.

---

### MC-2 — Frontend: `MinionCreateComponent`, Routes, Entry Point(s), Sub-Resource Drafts

**Goal:** Resolved Decisions 5-10. Depends on MC-1. **Scope of "which route(s)" depends on Open Question 1's answer** — the work below assumes both ship (Option C); if Skyler picks B alone, drop the `/minions/new` route/dropdown branch and its `MonsterService.getAll()` fetch; if B alone, drop the monster-detail entry-point link and the `monsterId`-route-param branch.

**Work:**
- New `features/minions/pages/minion-create/minion-create.ts` (+ `.html`):
  - Reads `monsterId` from the route via `ActivatedRoute.paramMap` (present when reached at `/monsters/:monsterId/minions/new`, absent at `/minions/new`).
  - If `monsterId` present: `MonsterService.getById(monsterId)` for display only (a "Creating a minion for {name}" label); no dropdown rendered; the resolved `monsterId` is fixed.
  - If `monsterId` absent: `MonsterService.getAll()` populates a required `CustomSelectComponent` dropdown (`monsterControl`, `Validators.required` — unlike Monster's optional mystery picker, this one **is** validated, since there's no valid blank state).
  - `ReferenceDataService.getMinionTypes()` and `getWeaponTags()` fetched either way (mirrors `minion-detail.ts`'s own reference-data load).
  - Defines `AttackDraft`/`PowerDraft`/`ArmorDraft`/`WeaknessDraft` locally (Resolved Decision 6) and four `signal<T[]>` draft arrays plus four small add-forms, field-for-field identical to `minion-detail.ts`'s own `attackForm`/`powerForm`/`armorForm`/`weaknessForm`, including `WeaponTagSelectComponent` on the attack form. `add*Draft()`/`remove*Draft(index)` push/splice locally — no API calls.
  - Template renders `<app-minion-form [minionTypes]="..." [minion]="null" submitLabel="Create Minion" [isSaving]="isSaving()" (save)="onCreate($event)" />` (the only page-level submit action — no second button), the monster context (locked label or required dropdown), and the 4 draft panels.
  - `onCreate(payload: UpsertMinionRequest)`: resolves the effective `monsterId` (route param or dropdown value — if the dropdown is required and empty, `MinionFormComponent`'s own `save` would have already fired since it doesn't know about the dropdown, so this method validates the dropdown itself before proceeding and bails out early with an inline error if unset, mirroring the pattern of validating something the shared component can't see). Calls `minionService.create(monsterId, payload)`, then `switchMap`s into `saveSubResourceDrafts(minion.id)` (mirrors `monster-create.ts`'s `saveSubResourceDrafts`/`runBatch` 1:1, substituting `MinionService`'s create methods). On full success or partial sub-resource failure alike: navigate to `/monsters/:monsterId/minions/:newId` (Resolved Decision 9), with an error notification in the partial-failure case (Resolved Decision 10). On failure before the minion exists: stay on the page, inline error, drafts intact.
- `minions.routes.ts`: add `{ path: 'new', loadComponent: () => import('./pages/minion-create/minion-create').then((m) => m.MinionCreateComponent) }`, inserted **before** `{ path: ':minionId', ... }`.
- `monsters.routes.ts`: add `{ path: ':monsterId/minions/new', loadComponent: () => import('../minions/pages/minion-create/minion-create').then((m) => m.MinionCreateComponent) }`, inserted **before** `{ path: ':monsterId/minions/:minionId', ... }`.
- `minions-list.html`/`.ts`: add a "+ Add Minion" button/`routerLink="/minions/new"` next to the `<h2>Minions</h2>` header (Option A/C only).
- `monster-detail.html`/`.ts`: add a "+ Add Minion" button/`routerLink="['/monsters', monster()!.id, 'minions', 'new']"` in the existing Minions section (Option B/C only).

**Files added/modified:**
| File | Status | Notes |
|---|---|---|
| `src/web/.../features/minions/pages/minion-create/minion-create.ts` | Added | New page; local draft interfaces + batch-submit orchestration |
| `src/web/.../features/minions/pages/minion-create/minion-create.html` | Added | Monster context (locked label or dropdown), `<app-minion-form>`, 4 draft panels |
| `src/web/.../features/minions/pages/minion-create/minion-create.spec.ts` | Added | New coverage, both entry-point shapes |
| `src/web/.../features/minions/minions.routes.ts` | Modified | Add `new` route before `:minionId` |
| `src/web/.../features/monsters/monsters.routes.ts` | Modified | Add `:monsterId/minions/new` before `:monsterId/minions/:minionId` |
| `src/web/.../features/minions/pages/minions-list/minions-list.html`/`.ts` | Modified (Option A/C) | Add "Add Minion" entry point |
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.html`/`.ts` | Modified (Option B/C) | Add "Add Minion" entry point in the Minions section |

**Verification:**
- Manual (monster-locked entry, if in scope): from a monster's detail page, click "Add Minion," confirm the monster is shown as fixed text (no dropdown), fill core fields + drafted sub-resources, submit — new minion appears under that monster with all drafted sub-resources present, navigation lands on `/monsters/:monsterId/minions/:newId`.
- Manual (top-level entry, if in scope): from `/minions`, click "Add Minion," confirm a required monster dropdown is shown, submitting without a selection shows a validation error and makes no API call, selecting a monster and submitting succeeds.
- Manual: adding/removing drafts makes no network calls until the single "Create Minion" submit; weapon tags on a drafted attack are correctly assigned after batch submit.
- Manual: a sub-resource batch failure after successful minion creation still navigates to the new minion's detail page and surfaces an error notification.
- `npm run build` passes; `npm run test -- --watch=false` passes.

---

### MC-3 — Frontend: Wire `MinionFormComponent` Into `minion-detail.ts`

**Goal:** Resolved Decision 11 — eliminate the duplication MC-1 would otherwise leave in place.

**Work:**
- `minion-detail.ts`: remove `minionForm`, `saveMinion()`'s form-building logic, `populateMinionForm()`; replace with `<app-minion-form [minion]="minion()" [minionTypes]="minionTypes()" [isSaving]="isMutating()" submitLabel="Save Minion" (save)="saveMinion($event)" />`, `saveMinion(payload)` keeps its existing `minionService.update(...)` call, now receiving the payload as an argument.
- `minion-detail.html`: remove the extracted template block, replace with the component tag.
- `minion-detail.spec.ts`: update for the new component boundary.

**Files modified:**
| File | Notes |
|---|---|
| `src/web/.../features/minions/pages/minion-detail/minion-detail.ts` | Remove inline form, wire component |
| `src/web/.../features/minions/pages/minion-detail/minion-detail.html` | Replace inline form markup with `<app-minion-form>` |
| `src/web/.../features/minions/pages/minion-detail/minion-detail.spec.ts` | Update for new component boundary |

**Verification:**
- Manual: edit an existing minion's core fields via the now-shared component from all three reachable route shapes (`/minions/:id`, `/monsters/:monsterId/minions/:id`, `/mysteries/:mysteryId/minions/:id`), confirm the sub-resource panels (untouched, immediate-per-action) still work identically.
- `npm run build` passes; `npm run test -- --watch=false` passes, including updated `minion-detail.spec.ts`.

---

## Files Affected Summary

| File | Status | Sub-Phase | Notes |
|---|---|---|---|
| `src/web/.../features/minions/shared/minion-form/minion-form.ts` | Added | MC-1 | New shared component |
| `src/web/.../features/minions/shared/minion-form/minion-form.html` | Added | MC-1 | Extracted template |
| `src/web/.../features/minions/shared/minion-form/minion-form.spec.ts` | Added | MC-1 | New coverage |
| `src/web/.../features/minions/pages/minion-create/minion-create.ts` | Added | MC-2 | New page; local draft interfaces + batch-submit orchestration |
| `src/web/.../features/minions/pages/minion-create/minion-create.html` | Added | MC-2 | Monster context, form, draft panels |
| `src/web/.../features/minions/pages/minion-create/minion-create.spec.ts` | Added | MC-2 | New coverage |
| `src/web/.../features/minions/minions.routes.ts` | Modified | MC-2 | Add `new` route before `:minionId` |
| `src/web/.../features/monsters/monsters.routes.ts` | Modified | MC-2 | Add `:monsterId/minions/new` before `:monsterId/minions/:minionId` |
| `src/web/.../features/minions/pages/minions-list/minions-list.html`/`.ts` | Modified (Option A/C) | MC-2 | "Add Minion" entry point |
| `src/web/.../features/monsters/pages/monster-detail/monster-detail.html`/`.ts` | Modified (Option B/C) | MC-2 | "Add Minion" entry point |
| `src/web/.../features/minions/pages/minion-detail/minion-detail.ts` | Modified | MC-3 | Wire shared component |
| `src/web/.../features/minions/pages/minion-detail/minion-detail.html` | Modified | MC-3 | Wire shared component |
| `src/web/.../features/minions/pages/minion-detail/minion-detail.spec.ts` | Modified | MC-3 | Update for new boundary |

> No `src/api/...` files — this phase is frontend-only (Resolved Decision 1). All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|---|---|---|
| No "reassign a minion to a different monster" feature | `UpsertMinionRequest` has no `monsterId` field, and no endpoint sets it post-creation — a minion's monster is fixed for its lifetime, pre-existing behavior this phase doesn't change. | Real, known gap. Not needed for creation; flag for a future phase if it turns out to matter. |
| No whole-minion delete (`DELETE /api/minions/{id}`) | Confirmed absent at every layer, same finding the parked multi-minion doc already made. Not needed for a creation-only phase — removing a local draft before submit needs no API call. | Out of scope here; would be its own small backend addition if a "delete minion" feature is ever built (mirrors `DELETE /api/monsters/{id}`, which already exists). |
| No transactional guarantee on the sub-resource batch | Same accepted risk shape as Phase 1 — inherited, not new. | Same mitigation as Phase 1 (navigate to the real, now-existing minion + error toast). |
| No edit-in-place for a draft on the create page | Same shape as Phase 1's equivalent gap — add/remove only. | Acceptable for bare-bones; revisit only if it proves annoying in practice. |
| Custom moves | `minion-detail.ts` has no custom-move UI today; this phase doesn't add one either. | Out of scope, unchanged, matches Phase 8 planning's original deferral. |
| No mystery-scoped minion-creation entry point | Deliberately not built (Resolved Decision 9) — `minion-detail.ts`'s existing `/mysteries/:mysteryId/minions/:minionId` route remains view/edit-only. | Out of scope; not requested, and the monster-scoped entry point already covers the "I know the context" case. |
| Location/Bystander standalone creation | Explicitly out of scope for this document. | Each gets its own follow-up phase doc. |

---

## Verification Checklist

- [ ] `npm run build` passes with no errors
- [ ] `npm run test -- --watch=false` passes, including new `minion-form.spec.ts` and `minion-create.spec.ts`, plus updated `minion-detail.spec.ts`
- [ ] Whichever entry point(s) Skyler confirms in scope are present and working (`/minions` list and/or a monster-detail "Add Minion" affordance)
- [ ] Creating a minion from the monster-locked entry point (if in scope) succeeds with no dropdown shown, and the new minion is scoped to the correct monster
- [ ] Creating a minion from the top-level entry point (if in scope) requires a monster selection (validation error + no API call if left blank) and succeeds once one is picked
- [ ] Adding attack/power/armor/weakness drafts on the create page makes no network calls until the single "Create Minion" submit
- [ ] Submitting with 2+ drafts across all 4 sub-resource types results in all of them existing on the newly created minion, visible immediately on `minion-detail.ts` after navigation
- [ ] Removing a draft before submit means it never reaches the API
- [ ] Weapon tags selected on a drafted attack are correctly assigned after the batch submit
- [ ] A sub-resource batch failure after successful minion creation still navigates to the new minion's detail page and surfaces an error notification
- [ ] Post-create navigation always lands on `/monsters/:monsterId/minions/:newId`
- [ ] `MinionFormComponent` correctly repopulates when its `minion` input changes (exercised by `minion-detail.ts` after MC-3)
- [ ] Editing an existing minion's core fields via the now-shared component still saves correctly from all three reachable route shapes, and the 4 sub-resource panels (immediate-per-action, unchanged) are unaffected
- [ ] `docker compose up -d postgres && dotnet run` workflow unaffected (no backend changes in this phase, but confirm nothing else regressed)
