# Multi-Minion Support — Architecture Plan

**Prepared by:** Yoshi (Architect)
**Status:** Proposed — pending Skyler sign-off
**Date:** 2026-08-04

> Filed under `docs/updates/` rather than `docs/phases/` per explicit routing instruction. Content/structure otherwise follows the same convention as `docs/minion-migration-plan.md` and `docs/phases/phase-8-minions-ui-flow.md`. This work picks up immediately after Phase 9 (`docs/phases/phase-9-bystanders-locations-ui-flow.md`) in the project's actual build sequence — sub-phases below are labeled `MM-1`, `MM-2`, etc. rather than `10a`/`10b` specifically because this doc doesn't live in `docs/phases/`.

---

## Correction to the Brief — Bug 2 Is Already Fixed

The task brief describes Bug 2 (wizard duplicate-submission-on-revisit, `docs/theming/found-bugs.md`) as "not yet fixed." **That's stale.** `git log` shows commit `e83eebb` ("Fixing mystery wizard bugs;", Skyler, 2026-08-04, the current `HEAD` on `main`) already implements the fix designed in `.squad/decisions/inbox/yoshi-bug2-wizard-phase-resubmission.md` and `yoshi-bug2-wizard-resubmission-resolved.md`, in full:

- `submitPhase0` branches on `existingId` alone (the `isEditMode() &&` guard is gone) — verified at `mystery-create.store.ts:951-954`.
- `submitPhase1` sets `editingMonsterId`/`editingMinionId` immediately after every save, not just on edit-load — verified at lines 1003, 1052.
- `LocationDraft`/`BystanderDraft` carry `id: string | null` and `submitPhase2`/`submitPhase3` do a true diff (`idsToUnlink` → unlink, update, create) against `existingLocationIds`/`existingBystanderIds` — verified at lines 62-76, 1091-1176.
- Minion Name is conditionally required via `minionSectionStarted`/`minionNameRequired`/`minionNameMissing` computed signals — verified at lines 466-484.

`docs/theming/found-bugs.md`'s "Status: Neither bug has been fixed" line is now wrong for Bug 2 (Bug 1 — the missing Monster Type required-indicator — is still unfixed; confirmed no `*`/error block exists at `mystery-create-monster-phase.html:22`). That doc wasn't in this task's scope to edit, so it isn't touched here, but whoever picks this doc up next should know **Bug 2 is closed** and should update that status line.

This is good news architecturally, not just a correction: it means the exact upsert-by-diff mechanism this plan needs for multi-minion (`id: string | null` draft + baseline-ID diff) is already a proven, shipped pattern in this file for two other domains. Multi-minion support is not "bundle with Bug 2" or "defer Bug 2" — **Bug 2 is a solved prerequisite to build on**, not a decision left open by this task.

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | **Wizard minion data model** | Replace the single `minionForm` + flat `minionAttacks`/`minionPowers`/`minionWeaknesses`/`minionArmors` signals with a `minionDrafts: signal<MinionDraft[]>` list, where each `MinionDraft` carries its own `id: string \| null` and its own sub-resource collections + existing-sub-resource-ID baseline (minions have children; locations/bystanders don't, so the `LocationDraft`/`BystanderDraft` shape isn't sufficient as-is — it has to be extended, not just copied). |
| 2 | **Active-draft editing mechanism** | A single `editingDraftIndex: signal<number \| null>` plus the *existing* `minionForm`/`minionAttackForm`/etc. and *existing* `minionAttacks`/`minionPowers`/`minionWeaknesses`/`minionArmors` signals, now reinterpreted as "the draft currently being composed or edited," with explicit `editMinionDraft(index)` / `saveMinionDraftToList()` copy-in/copy-out actions. Not FormArrays — stays inside the project's existing 2026-07-21 decision ("Signal Arrays for Sub-Items, Not FormArrays," `.squad/decisions.md`). |
| 3 | **`submitPhase1` minion diffing** | Generalize the already-shipped Location/Bystander diff pattern (`idsToUnlink`/`backfillDraftIds`/`savedDraftIds`) to minions, with one substitution: minions get **hard-deleted** (`minionService.delete()`, new endpoint — see #6), not unlinked, because a minion belongs to exactly one monster (1:N, not M:N) — matching how `docs/minion-migration-plan.md` already frames the relationship. |
| 4 | **`loadEditData` minion load** | Fetch and hydrate **all** minions returned by `minionService.getByMonster(pureMonster.id)` (via `forkJoin` of `getById` per minion), not just `minions[0]`. |
| 5 | **Monster-detail "Add Minion"** | **Recommended: lightweight inline stub-create form** (Name/Description/HarmCapacity/MinionType — the same 4 fields `minion-detail.ts`'s own top form already has) that calls the already-existing `minionService.create(monsterId, request)` and then navigates to the already-existing `/monsters/:monsterId/minions/:newId` route. Sub-resources (attacks/powers/armors/weaknesses) are added on that page, which already has full add/edit/delete for all four — not re-built inline on monster-detail. Trade-off: minion creation on monster-detail becomes a two-step flow (create bare minion → navigate to fill in sub-resources) instead of one page with everything visible; accepted because it reuses 100% of `minion-detail.ts`'s already-shipped, already-tested sub-resource CRUD with zero duplication, versus embedding a second full panel-laden form inside an already-busy monster-detail page. |
| 6 | **New backend endpoint required** | **Yes** — `DELETE /api/minions/{id}` does not exist anywhere in the stack today (grepped `MinionsController.cs`, `IMinionService`/`MinionService.cs`, `IMinionRepository`/`MinionRepository.cs` — zero hits for a top-level minion delete; only sub-resource deletes exist). Required for both the wizard (removing a previously-saved minion from the draft list) and monster-detail (a "Remove Minion" action, which is added alongside "Add Minion" for symmetry — see #7). Sub-resource cleanup is free: `minion_attacks`/`minion_powers`/`minion_armors`/`minion_weaknesses`/`minion_custom_moves` are all `ON DELETE CASCADE` on `minion_id` per the original migration plan, so the service doesn't need to manually delete children first — mirrors `MonstersController`'s existing `DELETE api/monsters/{id}` shape exactly. |
| 7 | **Monster-detail "Remove Minion"** | **In scope, added alongside #5.** An "Add Minion" button with no corresponding remove would be asymmetric and incomplete. Reuses the `ConfirmDeleteModalComponent` + `pendingDelete`/`activeMutation` pattern monster-detail already uses for its own attacks/powers/armors/weaknesses. |
| 8 | **Shared component between wizard and monster-detail** | **No.** Only the `MinionService` (already shared — both call `create()`/`update()`) is common. Recommend against extracting a shared "minion core fields" form component for the 4 top-level fields, and *definitely* against sharing `saveMinionCollections`-style batch machinery. Reasoning in the discussion section below. |
| 9 | **In-place edit-without-delete-and-re-add (item 4)** | **Solved as a side effect of #1/#2, confirmed — not a separate phase.** The `editingDraftIndex` mechanism *is* true in-place edit: click "Edit" on any minion card (new or previously-saved), its fields and sub-resource collections load back into the form, "Save Minion" commits in place. No follow-up phase needed. |
| 10 | **Minion Name validation** | Change from the current conditional-required hack (`minionSectionStarted`/`minionNameRequired`/`minionNameMissing`) to a plain `Validators.required`, enforced at `saveMinionDraftToList()` time — exactly how `addLocationForm`/`addBystanderForm` already validate on add. The conditional-required machinery existed only because there was a single, always-visible, optionally-blank form slot; once minions are an explicit add/save list, "leave it out" is expressed by never saving a draft, not by leaving a field blank. Recommend deleting `minionSectionStarted`/`minionNameRequired`/`minionNameMissing` as dead code once this lands. |

---

## Background

The `minions` schema/API/service layer is complete (see `docs/minion-migration-plan.md`); this plan is UI/UX + one backend gap (#6/#10 above), not another data migration.

Confirmed by reading the current source (not just the task brief):

- `mystery-create.store.ts` (2026-08-04, post-Bug-2-fix) has exactly one `minionForm`, one `editingMinionId: signal<string | null>`, and four flat sub-resource signals (`minionAttacks`/`minionPowers`/`minionWeaknesses`/`minionArmors`) — single-minion, confirmed at lines 231-234, 283-288, 240.
- `loadEditData` (lines 665-671) fetches `minionService.getByMonster(pureMonster.id)` then does `minions[0]` via a `switchMap` — any 2nd+ minion on the monster is invisible in the wizard today, confirmed.
- `monster-detail.ts`/`.html` already load and render all minions (`minions` signal, `minionService.getByMonster`, lines 41, 117, 122-127) with a link into `/monsters/:monsterId/minions/:minionId`, but there is no create or delete affordance for minions anywhere on that page — confirmed, `minion-detail.html` renders a plain read-only `<ul>`.
- `minionService.create()` is called from exactly one place in the whole Angular app today: `mystery-create.store.ts:1048` — confirmed by grep.
- `minion-detail.ts`/`.html` (`features/minions/pages/minion-detail/`) is a complete, working, standalone edit page: top-level fields (Name/Description/HarmCapacity/MinionType) plus 4 full sub-resource panels (attacks w/ weapon tags, powers, armors, weaknesses), each with its own add-form, per-item delete via `ConfirmDeleteModalComponent`, and (per Phase 8a) full update support. It's reachable at both `/minions/:minionId` and `/monsters/:monsterId/minions/:minionId` already (`monsters.routes.ts:7-9`). It requires an existing `minionId` — no "create" mode.
- No `DELETE /api/minions/{id}` endpoint exists (confirmed by grep across controller/service/repository — only sub-resource deletes exist).

---

## Architecture Discussion

### 1. Wizard: from single-form to list-of-minions

**The core move:** `minionDrafts: signal<MinionDraft[]>` replaces the implicit "the one minion" model. Shape:

```typescript
export interface MinionDraft {
  id: string | null;             // null until first saved (mirrors LocationDraft/BystanderDraft)
  name: string;
  description: string;
  harmCapacity: number;
  minionTypeId: string;
  attacks: AttackDraft[];
  powers: PowerDraft[];
  weaknesses: WeaknessDraft[];
  armors: ArmorDraft[];
  existingAttackIds: string[];
  existingPowerIds: string[];
  existingWeaknessIds: string[];
  existingArmorIds: string[];
}
```

This is *not* a straight copy of `LocationDraft`/`BystanderDraft` — those are flat leaf entities with no children, so `id: string | null` was the whole story. Minions have their own sub-resource collections (closer in shape to the monster itself than to a location), so each draft has to carry its own collections *and* its own existing-sub-resource-ID baseline, because `submitPhase1` needs to run an independent delete-all-recreate-all cycle per minion, not one shared cycle across all minions.

**Editing mechanism — reuse, don't rebuild.** The project already has a firm decision against FormArrays for sub-items (`.squad/decisions.md`, 2026-07-21: "Sub-item lists ... use `signal<T[]>([])` with inline 'add item' forms — not Angular FormArrays"). The cleanest way to honor that while adding multiplicity at the *minion* level (not just the sub-item level) is: keep `minionForm` and the four sub-resource signals exactly as they are today, but reinterpret them as "the currently active draft," governed by a new `editingDraftIndex: signal<number | null>`:

- `editingDraftIndex() === null` → the form represents an unsaved, in-progress new minion.
- `editingDraftIndex() === i` → the form represents `minionDrafts()[i]`, loaded back in for editing.

Three new store methods do the copy-in/copy-out:
- `editMinionDraft(index)` — patches `minionForm` and replaces the 4 sub-resource signals from `minionDrafts()[index]`; sets `editingDraftIndex(index)`.
- `saveMinionDraftToList()` — validates `minionForm` (now plain `Validators.required` on Name/Type, decision #10), builds a `MinionDraft` from the current form + signal state, either replaces `minionDrafts()[editingDraftIndex()]` or appends a new one (`id: null`); resets the form/signals/`editingDraftIndex` to a blank "new draft" state.
- `removeMinionDraft(index)` — splices the draft out of `minionDrafts()` outright. Its `id` (if non-null) is *not* deleted here — that happens in the `submitPhase1` diff, exactly like locations/bystanders today.

This is a genuinely small diff relative to a full rewrite: `addMinionAttack`/`removeMinionAttack`/`addMinionPower`/etc. and their templates don't change at all — they still operate on the four flat signals. The only new surface is the outer list (cards + Edit/Remove/"Add another minion" buttons) and the three methods above.

**`submitPhase1` diffing.** Generalizes the pattern already shipped for locations/bystanders in the Bug 2 fix, applied per-minion:

1. Save/update monster (unchanged).
2. Delete-recreate monster's own sub-collections (unchanged).
3. Diff `minionDrafts()` against a new `existingMinionIds` baseline signal (parallels `existingLocationIds`):
   - IDs in the baseline but absent from `minionDrafts()` → `minionService.delete(id)` (hard delete — new endpoint, decision #6). No manual sub-resource cleanup needed; DB-level `ON DELETE CASCADE` on every `minion_*` table already handles it.
   - Drafts with `id !== null` → `minionService.update(draft.id, request)`.
   - Drafts with `id === null` → `minionService.create(monster.id, request)`.
4. For each surviving/created minion, run the *existing* `saveMinionCollections` (unchanged in logic — just called once per minion instead of assumed exactly once), using that draft's own `existingAttackIds`/etc. as the delete baseline.
5. Backfill: reuse the existing `backfillDraftIds`/`savedDraftIds` helpers (already generic over `{ id: string | null }`) to write real IDs back onto `minionDrafts()` and refresh `existingMinionIds`.

**Validation simplification (decision #10).** Once minions are add/save-gated like locations/bystanders, `validateCurrentStep()`'s `phase === 1 && step === 1` branch (currently checking `minionNameMissing()`) can be dropped entirely — an empty `minionDrafts()` array is trivially valid (minions stay optional, matching today), and a draft can't enter the array without passing `saveMinionDraftToList()`'s own `Validators.required` gate first. This also lets `minionSectionStarted`/`minionNameRequired`/`minionNameMissing` be deleted — they existed solely to fake "conditionally required" on a single always-present field, which no longer applies once "not adding a minion" means "the list has zero entries" instead of "one field is blank."

**`loadEditData`.** Replace the `minions[0]`-only `switchMap` with a `forkJoin` over every minion ID from `minionService.getByMonster(pureMonster.id)`, mapping each `MinionDetailResponse` into a `MinionDraft` (including that minion's own sub-resource IDs). Sets `minionDrafts` and `existingMinionIds` directly; the active-edit form/signals stay blank (`editingDraftIndex: null`) until the user clicks "Edit" on a card — no behavior change to what's *displayed* first, just what's available.

**A real UX risk worth flagging, not solving here:** if a user is mid-edit on draft A (added 2 attacks to the live signal, hasn't clicked "Save Minion" yet) and clicks "Edit" on draft B or "Add another minion" without saving/discarding A first, those 2 in-progress attacks are silently lost — `editMinionDraft`/blank-reset overwrite the signals unconditionally. This is a step up in risk from today (today there's no "switch to a different minion" action at all). Recommend Luigi add a simple guard (a "discard unsaved changes?" confirm, reusing `ConfirmDeleteModalComponent`) during MM-3 implementation rather than shipping silent data loss, but the exact UX (block vs. confirm vs. auto-save) is an implementation call, not an architectural one — flagged for Luigi/Rosalina, not resolved here.

### 2. Monster-detail: "Add Minion" / "Remove Minion"

Recommendation is decision #5/#7 above: inline stub-create form (4 fields) → `minionService.create()` → navigate to the existing `minion-detail` route for everything else; symmetric "Remove Minion" per card using the confirm-delete-modal pattern already on the page.

**Why not a full inline form with all sub-resource panels embedded (the alternative)?** Monster-detail already renders 4 sub-resource panels for the *monster itself* (Attacks/Powers/Armors/Weaknesses, `monster-detail.html:79-258`) plus a growing Minions list. Embedding a second full set of 4 panels per new minion would make an already-long page substantially longer and would duplicate `minion-detail.ts`'s add/edit/delete logic for attacks/powers/armors/weaknesses a third time in the codebase (monster's own, minion-detail's, and now monster-detail's inline copy) for no functional gain — `minion-detail.ts` already does this correctly and is one click away. The two-step flow costs one navigation; the inline-everything alternative costs a real, ongoing maintenance duplication. Not a close call.

**Why not navigate-to-a-separate-create-*route* instead of create-then-navigate-to-detail?** Considered and rejected: it would mean either (a) a new `/monsters/:monsterId/minions/new` route + a near-duplicate of `minion-detail.ts` that tolerates "no minion yet" (extra component, extra state-branching in an already-complete component), or (b) teaching `minion-detail.ts` itself to operate in a create-then-transition-to-edit mode (`ngOnInit` currently hard-requires a route `minionId` param and throws if absent — a bigger, riskier change to a component that already works). The inline-stub-then-navigate approach needs zero changes to `minion-detail.ts`/`minions.routes.ts`/`monsters.routes.ts` — it only adds a small form + create call to `monster-detail.ts`, then reuses the existing route as-is.

### 3. Shared component between wizard and monster-detail? (decision #8)

**No**, and the reasoning is a fork worth stating plainly rather than leaving as a list:

- **The service layer is already the shared layer.** `MinionService.create()`/`update()` are the actual reusable unit, and both call sites already use them (the wizard today, monster-detail after this plan). No duplication exists at that layer to fix.
- **The two call sites have fundamentally different submission models**, and that's a pre-existing, load-bearing architectural split in this codebase, not something to paper over: the wizard batches everything and submits once at phase transition (`.squad/decisions.md`, 2026-07-21: "Submission happens at phase transitions, not at the end of the wizard"); monster-detail (like `minion-detail.ts`) mutates immediately per action (`runAndRefresh`, `activeMutation`, toast-per-save). A shared "minion form" component would need to either abstract over that difference (adding an indirection layer for a 4-field form) or hard-code one of the two behaviors and fight the other call site.
- **This codebase doesn't extract shared form components for overlapping-but-not-identical field sets even where the overlap is much larger than 4 fields.** `monster-detail.ts`, `minion-detail.ts`, and `mystery-create-monster-phase.html`'s monster/minion steps all define their own inline `FormGroup`+template for name/description/harmCapacity/type, despite ~90% field overlap between monster and minion forms already. Introducing a shared component here — for a *smaller* overlap (4 simple fields, no sub-resources) — would be the first instance of that pattern in the codebase, not a natural extension of an existing one. `CustomSelectComponent`/`WeaponTagSelectComponent`/`ConfirmDeleteModalComponent` are the actual shared-component precedent in this app, and they're generic UI widgets, not domain forms.
- `saveMinionCollections`'s batch/delete-all-recreate-all machinery (`mystery-create.store.ts:1196-1254`) is unambiguously wizard-only — monster-detail's add-minion flow has no equivalent need (a freshly created minion has no sub-resources yet to diff against), and forcing it to share code with a batching mechanism it doesn't use would be a net-negative abstraction.

**Trade-off accepted:** a small amount of literal duplication (two ~4-field reactive form definitions: one in the wizard's per-draft form, one in monster-detail's stub-create form) in exchange for not inventing a new shared-component convention this codebase doesn't otherwise use, and not coupling two components with genuinely different lifecycles.

### 4. In-place edit (decision #9) — confirmed solved as a side effect

The task explicitly asked to check this rather than assume it. Confirmed: `editMinionDraft(index)` (§1) *is* in-place edit — it loads an existing draft's full state (top fields + all 4 sub-resource collections) back into the live form, and `saveMinionDraftToList()` commits back to the same array slot. This required no additional design beyond what multi-minion already needs; it falls out of moving from "one implicit slot" to "an explicit indexed list with an edit action," which is the same generalization needed for multiplicity in the first place. No separate phase.

One nuance worth flagging: this does *not* retroactively fix the identical friction for locations/bystanders (`addLocationForm`/`addBystanderForm` are still append+remove-only, no edit-in-place — confirmed, no `editLocation`/`editBystander` method exists in the store today). That's a real, pre-existing gap of the same shape, just not in this task's scope (locations/bystanders have no sub-resources, so it's a much smaller lift if picked up later) — noted here so it isn't rediscovered as new.

### 5. Relationship to Bug 2 — no bundling needed, already resolved (see correction above)

Nothing to bundle or defer. The multi-minion `MinionDraft`/diff design in §1 *is* the Bug-2-established pattern (ID-presence-driven upsert, baseline-diff-to-unlink-or-delete) applied to a new domain with one adaptation (delete instead of unlink, because minions are 1:N not M:N) and one extension (per-draft nested sub-collections, because minions have children and locations/bystanders don't). Building multi-minion against the pre-fix single-slot `editingMinionId` model would have re-introduced exactly the amplified-duplication risk the task worried about ("more entities per accidental resubmit"); building it against the already-shipped fix avoids that risk by construction.

---

## Sub-Phases

### MM-1 — Backend: Minion Hard-Delete Endpoint

**Goal:** Close the one real API gap. Required by both MM-3 (wizard) and MM-5 (monster-detail).

**Work:**
- `IMinionRepository`/`MinionRepository`: add `Task<int> DeleteAsync(Guid id, CancellationToken cancellationToken)`, mirroring the shape of the existing sub-resource `Delete*Async` methods (returns rows-affected count).
- `IMinionService`/`MinionService`: add `Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)`, mirroring `MonsterService.DeleteAsync` (`src/api/MonsterOfTheWeek.Api/Services/MonsterService.cs:103`) exactly.
- `MinionsController.cs`: add
  ```csharp
  [HttpDelete("api/minions/{id:guid}")]
  public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
      await minionService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();
  ```
  mirroring `MonstersController.cs:45-47` exactly.
- `src/web/monster-of-the-week-web/src/app/core/minion.ts`: add `delete(minionId: string): Observable<void>`, mirroring `MonsterService.delete()`.
- No new migration: cascade deletes on `minion_attacks`/`minion_powers`/`minion_armors`/`minion_weaknesses`/`minion_custom_moves` already exist (`ON DELETE CASCADE` on `minion_id`, per `docs/minion-migration-plan.md` §2).

**Files modified:**
| File | Notes |
|---|---|
| `src/api/MonsterOfTheWeek.Api/Repositories/IMinionRepository.cs` | Add `DeleteAsync` |
| `src/api/MonsterOfTheWeek.Api/Repositories/MinionRepository.cs` | Implement `DeleteAsync` |
| `src/api/MonsterOfTheWeek.Api/Services/IMinionService.cs` | Add `DeleteAsync` |
| `src/api/MonsterOfTheWeek.Api/Services/MinionService.cs` | Implement `DeleteAsync` |
| `src/api/MonsterOfTheWeek.Api/Controllers/MinionsController.cs` | Add `DELETE api/minions/{id:guid}` |
| `src/web/monster-of-the-week-web/src/app/core/minion.ts` | Add `delete()` |

**Verification:**
- `dotnet build MonsterOfTheWeek.slnx` passes.
- New xUnit test: `DELETE /api/minions/{id}` returns 204 and removes the row; deleting a minion with attacks/powers/armors/weaknesses cascades (no orphaned rows); deleting a nonexistent id returns 404.

---

### MM-2 — Wizard: `MinionDraft` Model + Store Logic

**Goal:** The data-model and store-logic half of §1, with no UI changes yet (existing single-slot template keeps working against `minionDrafts()[0]` conceptually broken temporarily, or land MM-2+MM-3 together — see Sequencing note below).

**Work (`mystery-create.store.ts`):**
- Add `MinionDraft` interface (per §1).
- Replace `editingMinionId: signal<string | null>` and the 4 per-minion `existingMinion*Ids` private signals with `minionDrafts: signal<MinionDraft[]>`, `existingMinionIds: signal<string[]>` (private), `editingDraftIndex: signal<number | null>`.
- Keep `minionForm`, `minionAttackForm`, `minionPowerForm`, `minionWeaknessForm`, `minionArmorForm`, `minionAttacks`, `minionPowers`, `minionWeaknesses`, `minionArmors` as-is (now "active draft" state).
- Add `editMinionDraft(index: number)`, `saveMinionDraftToList()`, `removeMinionDraft(index: number)`.
- Rewrite `submitPhase1`'s minion branch per §1 step 3-5 (diff/delete/update/create/backfill). Reuse `idsToUnlink` (rename or generalize to `idsToRemove`, parameterized by delete-vs-unlink operation) and `backfillDraftIds`/`savedDraftIds` as-is.
- Rewrite `loadEditData`'s minion `forkJoin` branch to fetch all minions, not `minions[0]`.
- Change `minionForm.controls.name`/`minionTypeId` to plain `Validators.required`; delete `minionSectionStarted`/`minionNameRequired`/`minionNameMissing`; drop the `phase === 1 && step === 1` branch from `validateCurrentStep()`.
- Update `MysteryCreateDraftState` (`forms.minion` → drop; `collections.minionAttacks`/etc. → drop; add `collections.minionDrafts` or equivalent) — check whether `draftState` is consumed anywhere beyond the spec file before deciding exact shape (grep showed no external consumer at review time, but re-verify).

**Files modified:**
| File | Notes |
|---|---|
| `src/web/monster-of-the-week-web/src/app/features/mysteries/pages/mystery-create/mystery-create.store.ts` | Core of this sub-phase |
| `src/web/monster-of-the-week-web/src/app/features/mysteries/pages/mystery-create/mystery-create.store.spec.ts` | Existing single-minion tests (lines ~138-417 per current grep) need rewriting against the list model |

**Verification:**
- `npm run build` passes.
- `npm run test -- --watch=false`: store spec covers — add 1st minion draft, add 2nd, edit an existing draft in place (fields + sub-resources round-trip correctly), remove a draft before submit (never hits the API), submit creates N minions with correct sub-resources, revisit-and-resubmit updates (not duplicates) unchanged drafts, removing a previously-saved minion on revisit calls `delete()`.

---

### MM-3 — Wizard: Template (List + Add/Edit/Remove UI)

**Goal:** The UI half of §1. Depends on MM-2 (store surface must exist first) — **sequence MM-2 and MM-3 as one PR/session**, since an intermediate state where the store has moved to `minionDrafts` but the template still binds to the old single-slot shape won't compile.

**Work (`mystery-create-monster-phase.html`, `currentStep() === 1` block, lines 148-288):**
- Add a minion-cards list above the existing form (mirrors monster-detail's minion list markup, lines 24-37 of `monster-detail.html`, for visual consistency): Name, Type badge, harm/attack/power/armor/weakness counts, "Edit" and "Remove" (×) buttons per card.
- Existing form + 4 sub-resource panels (lines 151-287) stay structurally the same, now framed as "the active draft" — retitle blurb/heading to reflect add-vs-edit state (e.g., "Editing: {name}" vs. "Add a Minion").
- Replace whatever currently submits the single minion (there is no explicit submit today — it rides along with `next()`) with an explicit "Save Minion" / "Save Changes" button calling `store.saveMinionDraftToList()`.
- Add "Add Another Minion" button (visible once at least one draft exists) calling a reset-to-blank action.
- Wire Edit/Remove buttons to `store.editMinionDraft(index)` / `store.removeMinionDraft(index)`.
- Update `store.minionForm` label logic for the now-plain-required Name field (drop the `minionNameRequired()`-conditional `*`, matching Bug 1's pattern instead — an unconditional `*` + `@if (...invalid && ...touched)` error, same as Monster Name at line 4-9).

**Files modified:**
| File | Notes |
|---|---|
| `src/web/monster-of-the-week-web/src/app/features/mysteries/pages/mystery-create/mystery-create-monster-phase.html` | Minion step template |
| `src/web/monster-of-the-week-web/src/app/features/mysteries/pages/mystery-create/mystery-create-monster-phase.ts` *(if it has TS beyond the template — verify at implementation time)* | Wiring only if needed |

**Verification:**
- Manual: add 2 minions with different sub-resources in a fresh mystery, submit, confirm both appear on monster-detail with correct sub-resources.
- Manual: edit an existing mystery with 2+ minions (created via seed/API directly, since the old wizard could never produce this state) — confirm all appear in the wizard, editing one and resubmitting doesn't touch the others.
- Manual repro of the old Bug 2 shape doesn't reappear: jump back to phase 0, forward again without changes — minion count on the monster stays the same.
- `npm run build` passes.

---

### MM-4 — Backend/Frontend Coordination Check (no dedicated work expected)

**Goal:** Confirm no other API changes are needed beyond MM-1. Based on the review in this doc, the answer is no — `create`/`update`/`getByMonster`/`getById` and all sub-resource CRUD already exist and are unchanged by this plan. This sub-phase is a checkpoint, not a work item: Bowser should sanity-check MM-1 lands cleanly and re-confirm no other gap surfaced during MM-2/MM-3 implementation (e.g., if `MinionListItemResponse` turns out to need a field it doesn't have — unlikely based on current review, but not exhaustively verified against every consumer).

---

### MM-5 — Monster-Detail: Add Minion / Remove Minion

**Goal:** §2 — inline stub-create form + delete action, independent of MM-2/MM-3 (only depends on MM-1 for delete).

**Work (`monster-detail.ts`/`.html`):**
- Add `addMinionForm` (Name, Description, HarmCapacity, MinionType — `Validators.required` on Name + Type, matching `minion-detail.ts`'s own form validators).
- Add `createMinion()`: validate, call `minionService.create(monster.id, request)`, on success `router.navigate(['/monsters', monster.id, 'minions', created.id])` (or `mysteryId`-aware equivalent if reached via `/mysteries/:mysteryId/monsters/:monsterId`, matching `backLink()`'s existing mystery-aware pattern).
- Add `requestDeleteMinion(minionId, name)`: same `pendingDelete` + `ConfirmDeleteModalComponent` pattern already used for attacks/powers/armors/weaknesses; on confirm, `minionService.delete(minionId)` then refresh `minions` signal (`minionService.getByMonster(monster.id)` again — no need to refetch the whole monster).
- Template: add the inline form below the existing minions list (`monster-detail.html:19-38`), add a delete button per `<li>` in that list matching the delete-button markup/SVG already used for the monster's own sub-resource panels (lines 98-108 etc.).

**Files modified:**
| File | Notes |
|---|---|
| `src/web/monster-of-the-week-web/src/app/features/monsters/pages/monster-detail/monster-detail.ts` | Add form, create/delete methods |
| `src/web/monster-of-the-week-web/src/app/features/monsters/pages/monster-detail/monster-detail.html` | Add form + delete button markup |
| `src/web/monster-of-the-week-web/src/app/features/monsters/pages/monster-detail/monster-detail.spec.ts` *(if it exists — verify)* | New create/delete coverage |

**Verification:**
- Manual: from monster-detail, add a minion via the inline form, confirm navigation to its detail page, confirm it now appears in the monster's minion list on return.
- Manual: delete a minion from monster-detail, confirm modal fires, confirm cancel preserves it, confirm confirm removes it and its sub-resources (verify via a direct API call or DB check that sub-resource rows are gone too, proving cascade).
- `npm run build` passes; `npm run test -- --watch=false` passes.

---

## Files Affected Summary

| File | Status | Sub-Phase | Notes |
|---|---|---|---|
| `src/api/.../Repositories/IMinionRepository.cs` | Modified | MM-1 | Add `DeleteAsync` |
| `src/api/.../Repositories/MinionRepository.cs` | Modified | MM-1 | Implement `DeleteAsync` |
| `src/api/.../Services/IMinionService.cs` | Modified | MM-1 | Add `DeleteAsync` |
| `src/api/.../Services/MinionService.cs` | Modified | MM-1 | Implement `DeleteAsync` |
| `src/api/.../Controllers/MinionsController.cs` | Modified | MM-1 | Add `DELETE api/minions/{id:guid}` |
| `src/web/.../core/minion.ts` | Modified | MM-1 | Add `delete()` |
| `src/web/.../mystery-create/mystery-create.store.ts` | Modified | MM-2 | `MinionDraft` model, list logic, `submitPhase1`/`loadEditData` rewrite, validator simplification |
| `src/web/.../mystery-create/mystery-create.store.spec.ts` | Modified | MM-2 | Rewrite single-minion tests for the list model |
| `src/web/.../mystery-create/mystery-create-monster-phase.html` | Modified | MM-3 | Minion-card list + add/edit/remove UI |
| `src/web/.../mystery-create/mystery-create-monster-phase.ts` | Modified (if applicable) | MM-3 | Wiring only, verify at implementation time |
| `src/web/.../monsters/pages/monster-detail/monster-detail.ts` | Modified | MM-5 | Add-minion form + delete-minion action |
| `src/web/.../monsters/pages/monster-detail/monster-detail.html` | Modified | MM-5 | Add-minion form markup + delete button |
| `src/web/.../monsters/pages/monster-detail/monster-detail.spec.ts` | Modified (if exists) | MM-5 | New coverage |

> All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`; all `src/api/...` paths expand to `src/api/MonsterOfTheWeek.Api/`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|---|---|---|
| `docs/theming/found-bugs.md` Bug 2 status line is stale | Says "Neither bug has been fixed" — Bug 2 is fixed as of `e83eebb` | Update the status line when this doc's work is picked up; not done here (out of this task's stated scope) |
| Bug 1 (Monster Type missing required-indicator) | Still unfixed — confirmed no `*`/error block at `mystery-create-monster-phase.html:22` | Unrelated to multi-minion; cheap, could be picked up opportunistically in MM-3 since that file is already being touched, but not required by this plan |
| Locations/bystanders have the same "no edit-in-place, only append/remove" limitation as pre-fix minions | `addLocationForm`/`addBystanderForm` have no `editLocation`/`editBystander` equivalent | Real gap, same shape as item 4, out of scope here (no sub-resources on those domains, so it's a smaller lift) — flagged so it isn't rediscovered as new |
| Mid-draft-switch data loss risk (§1) | Switching `editMinionDraft`/starting a new draft without saving the active one silently discards unsaved sub-resource additions | Recommend a discard-confirmation guard in MM-3; not architected in detail here — implementation-level UX call |
| Minion custom moves | `MinionDetailResponse.customMoves` still has no create/edit UI anywhere (Phase 8 deferred this; unaffected by this plan) | Out of scope, unchanged |

---

## Verification Checklist

- [ ] `dotnet build MonsterOfTheWeek.slnx` passes with no warnings
- [ ] `dotnet test MonsterOfTheWeek.slnx` passes, including new `DELETE /api/minions/{id}` coverage (204, cascade, 404)
- [ ] `npm run build` passes with no errors
- [ ] `npm run test -- --watch=false` passes, including rewritten `mystery-create.store.spec.ts` minion-list coverage
- [ ] Wizard: creating a new mystery with 2+ minions on the monster results in 2+ minion rows, each with correct independent sub-resources
- [ ] Wizard: editing an existing mystery whose monster already has 2+ minions (seeded outside the wizard) shows all of them, not just one
- [ ] Wizard: editing one minion draft in place and resubmitting updates that minion only — sibling minions and the monster are untouched
- [ ] Wizard: removing a previously-saved minion draft and resubmitting hard-deletes it (and its sub-resources, via cascade) via the new `DELETE` endpoint
- [ ] Wizard: revisiting phase 1 and pressing Next again without changes does not duplicate any minion (Bug 2 stays fixed under the new model)
- [ ] Wizard: minion Name/Type are plain-required on save-draft, with no minion required if the list stays empty
- [ ] Monster-detail: "Add Minion" creates a minion and navigates to its detail page
- [ ] Monster-detail: "Remove Minion" fires the confirm modal; cancel preserves it; confirm hard-deletes it and its sub-resources
- [ ] `docker compose up -d postgres && dotnet run` workflow unaffected
