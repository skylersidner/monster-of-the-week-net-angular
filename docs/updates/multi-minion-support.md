# Multi-Minion Support — Architecture Plan

**Prepared by:** Yoshi (Architect)
**Status:** Corrected 2026-09-01 — aligned to shipped code and to Rosalina's accepted UX design. The one behavior change flagged for human sign-off (the widened composer dirty-check, SS1.3) was **approved by Skyler 2026-09-01**. No open questions remain. Ready for Luigi to implement in sub-phase order.
**Date:** 2026-08-04 (original) · **Correction pass:** 2026-09-01

> Filed under `docs/updates/` rather than `docs/phases/` per explicit routing instruction. Content/structure otherwise follows the same convention as `docs/minion-migration-plan.md` and `docs/phases/phase-8-minions-ui-flow.md`. Sub-phases below are labeled `MM-1`, `MM-2`, etc. rather than `10a`/`10b` specifically because this doc doesn't live in `docs/phases/`.
>
> **Read alongside:** `docs/updates/multi-minion-wizard-design.md` (Rosalina, Accepted 2026-09-01) — the UX/visual half of the same feature. This doc owns state, data flow, API and sequencing; hers owns layout, markup, copy and interaction. Where the two touched the same question, this correction pass moved *this* doc to match hers unless noted otherwise.

---

## Correction Pass — 2026-09-01

This plan was written on 2026-08-04. The codebase moved on, and Rosalina's paired UX design landed and was accepted. **Six of this document's premises were stale and are corrected below.** Superseded items are struck through and dated rather than deleted, so this reads as a corrected plan and not as though it was always right.

Everything in this section was re-verified by reading current source at `f872d5e`, not taken on report.

| # | Original claim | Status as of 2026-09-01 |
|---|---|---|
| 1 | "No `DELETE /api/minions/{id}` endpoint exists anywhere in the stack" (decision #6, MM-1) | **False — it shipped.** `MinionsController.cs:41`, `IMinionService.cs:12`, `MinionService.cs:80`, `MinionRepository.cs:86` (`ExecuteDeleteAsync`), and the Angular client at `core/minion.ts:48`. Recorded in `.squad/decisions/inbox/bowser-minion-delete-backend.md`. **MM-1 is done** — see below. |
| 2 | "Recommend against extracting a shared minion form component" (decision #8) | **Conclusion survives at the wizard boundary; one of its three supporting arguments is dead.** `MinionFormComponent` shipped at `features/minions/shared/minion-form/`, and it is one of *five* shared domain form components now in the app. See the rewritten §3. |
| 3 | "Monster-detail has no create affordance for minions; recommend an inline stub-create form" (decision #5) | **Obsolete.** A complete standalone authoring page ships at `/monsters/:monsterId/minions/new` (`features/minions/pages/minion-create/`, routed in `monsters.routes.ts`), and `monster-detail.html:22` already links to it with a `+ Add Minion` button. Decision #5 is moot; MM-5 as originally scoped is deleted. |
| 4 | "Remove Minion on monster-detail is in scope, added alongside #5" (decision #7) | **Declined by Skyler**, 2026-09-01, answering Rosalina's Open Question 6. No remove-minion affordance on `monster-detail`. The add-without-remove asymmetry on that page stays open **by decision, not oversight**. |
| 5 | "Delete `minionSectionStarted`/`minionNameRequired`/`minionNameMissing` and drop the `phase === 1 && step === 1` validation branch" (decision #10) | **Went too far** — Rosalina is right, and the correction needs to go further still than she stated. See decision #10 and §1.3. |
| 6 | "Bug 1 (Monster Type missing required-indicator) still unfixed — no `*`/error block at `mystery-create-monster-phase.html:22`" (Known Gaps) | **Half stale.** The `*` shipped: `mystery-create-monster-phase.html:22` now reads `Monster Type <span class="text-danger">*</span>`. The inline error block still does *not* exist — there is no `@if` on `monsterTypeId`, unlike `monsterArchetypeId` at lines 28-30. `docs/theming/found-bugs.md` remains stale for both bugs. |

**One premise that was checked and held.** The core state model — `minionDrafts: signal<MinionDraft[]>` with a single `editingDraftIndex` reusing the existing `minionForm` and four sub-resource signals as "the active draft" — survives intact and maps onto Rosalina's roster+composer directly (roster = `minionDrafts()`, composer = the existing form + four signals). The store's minion surface is unchanged since 2026-08-04: one `minionForm` at `mystery-create.store.ts:283-288`, one `editingMinionId` at `:240`, four flat sub-resource signals at `:231-234`, `loadEditData` still doing `minions[0]` at `:668-669`. **But the mapping is not free** — Rosalina's composer semantics need three things this model did not supply. They are added as decisions #11-#13 and specified in §1.2-§1.4.

**New decisions folded in from Skyler, 2026-09-01 (settled — not reopened here):** N minions under the wizard's one monster; the wizard's minion step keeps full inline sub-resource authoring; the step-tracker dot lights when any minion is present; always confirm on remove; add a "Belongs to {monster}" line to `mystery-detail`'s minion list; no Remove Minion on `monster-detail`; no roster reordering.

---

## Correction to the Brief (2026-08-04 pass) — Bug 2 Is Already Fixed

*Retained as originally written; still accurate.*

The task brief described Bug 2 (wizard duplicate-submission-on-revisit, `docs/theming/found-bugs.md`) as "not yet fixed." **That was stale.** Commit `e83eebb` ("Fixing mystery wizard bugs;", Skyler, 2026-08-04) already implements the fix designed in `.squad/decisions/inbox/yoshi-bug2-wizard-phase-resubmission.md` and `yoshi-bug2-wizard-resubmission-resolved.md`, in full:

- `submitPhase0` branches on `existingId` alone (the `isEditMode() &&` guard is gone).
- `submitPhase1` sets `editingMonsterId`/`editingMinionId` immediately after every save, not just on edit-load.
- `LocationDraft`/`BystanderDraft` carry `id: string | null` and `submitPhase2`/`submitPhase3` do a true diff (`idsToUnlink` → unlink, update, create) against `existingLocationIds`/`existingBystanderIds` — still present at `mystery-create.store.ts:1106-1168`, helpers at `:1179-1194`.
- Minion Name is conditionally required via `minionSectionStarted`/`minionNameRequired`/`minionNameMissing` — still present at `:466-484`.

`docs/theming/found-bugs.md`'s "Status: Neither bug has been fixed" line is wrong for Bug 2, and now half-wrong for Bug 1 too (see correction 6 above). That doc still hasn't been updated — flagged again in Known Gaps.

This is good news architecturally: the exact upsert-by-diff mechanism this plan needs for multi-minion (`id: string | null` draft + baseline-ID diff) is already a proven, shipped pattern in this file for two other domains. **Bug 2 is a solved prerequisite to build on.**

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | **Wizard minion data model** | Replace the single `minionForm` + flat `minionAttacks`/`minionPowers`/`minionWeaknesses`/`minionArmors` signals with a `minionDrafts: signal<MinionDraft[]>` list, where each `MinionDraft` carries its own `id: string \| null` and its own sub-resource collections + existing-sub-resource-ID baseline (minions have children; locations/bystanders don't, so the `LocationDraft`/`BystanderDraft` shape isn't sufficient as-is — it has to be extended, not just copied). **Confirmed 2026-09-01 — unchanged.** |
| 2 | **Active-draft editing mechanism** | A single `editingDraftIndex: signal<number \| null>` plus the *existing* `minionForm`/`minionAttackForm`/etc. and *existing* `minionAttacks`/`minionPowers`/`minionWeaknesses`/`minionArmors` signals, now reinterpreted as "the draft currently being composed or edited," with explicit `editMinionDraft(index)` / `saveMinionDraftToList()` copy-in/copy-out actions. Not FormArrays — stays inside the project's existing 2026-07-21 decision ("Signal Arrays for Sub-Items, Not FormArrays," `.squad/decisions.md`). **Confirmed 2026-09-01, with one addition — see #11:** `editingDraftIndex` alone cannot express Rosalina's collapsed composer. |
| 3 | **`submitPhase1` minion diffing** | Generalize the already-shipped Location/Bystander diff pattern (`idsToUnlink`/`backfillDraftIds`/`savedDraftIds`) to minions, with one substitution: minions get **hard-deleted** (`minionService.delete()`), not unlinked, because a minion belongs to exactly one monster (1:N, not M:N). **Confirmed 2026-09-01 — unchanged, and the endpoint it depends on now exists.** |
| 4 | **`loadEditData` minion load** | Fetch and hydrate **all** minions returned by `minionService.getByMonster(pureMonster.id)` (via `forkJoin` of `getById` per minion), not just `minions[0]`. **Confirmed 2026-09-01 — still `minions[0]` at `mystery-create.store.ts:668-669`; unchanged recommendation.** |
| 5 | **Monster-detail "Add Minion"** | ~~Recommended: lightweight inline stub-create form (4 fields) that calls `minionService.create(monsterId, request)` and then navigates to `/monsters/:monsterId/minions/:newId`.~~ **SUPERSEDED 2026-09-01 — overtaken by events.** A full standalone authoring page shipped at `/monsters/:monsterId/minions/new` (`features/minions/pages/minion-create/`), with all four sub-resource lists as local drafts and a single batched create, and `monster-detail.html:22` already renders a `+ Add Minion` link to it. Nothing to build. Worth noting the shipped answer is *better* than the one recommended here: the stub-create-then-navigate two-step this decision accepted as a cost was avoided entirely by `standalone-creation-phase2-minions.md`'s local-drafts-plus-batched-create model, which didn't exist when decision #5 was written. |
| 6 | **New backend endpoint required** | ~~**Yes** — `DELETE /api/minions/{id}` does not exist anywhere in the stack today.~~ **SUPERSEDED 2026-09-01 — it shipped.** Verified: `MinionsController.cs:41` → `MinionService.DeleteAsync` (`MinionService.cs:80`) → `MinionRepository` `dbContext.Minions.Where(x => x.Id == id).ExecuteDeleteAsync(...)` (`MinionRepository.cs:86`), Angular client `core/minion.ts:48`. Cascade was verified at the DB level by Bowser against migration `20260726000551_ExtractMinionsToOwnTable.cs` before implementing, which matters because `ExecuteDeleteAsync` bypasses EF's in-memory cascade tracking. |
| 7 | **Monster-detail "Remove Minion"** | ~~**In scope, added alongside #5.** An "Add Minion" button with no corresponding remove would be asymmetric and incomplete.~~ **SUPERSEDED 2026-09-01 — declined by Skyler** (Rosalina's Open Question 6). No remove-minion affordance on `monster-detail`. The asymmetry this decision objected to is real and stays open **by decision**. Removal remains available from `minions-list` (`minions-list.ts:47-51`, already shipped) and, after this plan, from the wizard's roster. **Do not confuse this with #12** — the wizard's always-confirm hard-delete path is a different surface and is still in scope. |
| 8 | **Shared component between wizard and monster-detail** | **Still No — for the wizard.** But the question has changed shape and one leg of the original argument is dead: `MinionFormComponent` shipped (`features/minions/shared/minion-form/`), and it is one of five shared domain form components now in the app. **Not one of the five is consumed by the mystery wizard** — verified by grep across every consumer. Recommendation stands that the wizard's composer keeps the store-owned `minionForm`, on five concrete, verified blockers rather than on the original "this codebase doesn't do that" argument. Full re-reasoning in §3. |
| 9 | **In-place edit-without-delete-and-re-add** | **Solved as a side effect of #1/#2 — not a separate phase.** The `editingDraftIndex` mechanism *is* true in-place edit. **Confirmed 2026-09-01** — and it is exactly what Rosalina's roster pencil button drives (`multi-minion-wizard-design.md` §1.3, row 2). |
| 10 | **Minion Name validation** | ~~Change to a plain `Validators.required` enforced at `saveMinionDraftToList()` time; delete `minionSectionStarted`/`minionNameRequired`/`minionNameMissing` as dead code; drop the `phase === 1 && step === 1` branch from `validateCurrentStep()`.~~ **PARTIALLY SUPERSEDED 2026-09-01 — this went too far.** Rosalina is right that the composer still needs an empty-vs-started-but-invalid distinction on `Next`, and the correction has to go further than her doc states: the surviving "is there content here" detector must be **widened**, not merely repurposed. `minionNameRequired()` dies. `minionSectionStarted()` survives as `composerDirty()`, widened to include Name *and* the four sub-resource signals. `minionNameMissing()` is replaced. The `phase === 1 && step === 1` branch of `validateCurrentStep()` stays, with new semantics. Full specification in §1.3. |
| 11 | **Composer open/collapsed state** *(new, 2026-09-01)* | **`editingDraftIndex` alone is insufficient — add `composerOpen: signal<boolean>`.** Rosalina's composer has three visible states, and `(roster-empty, editingDraftIndex)` cannot tell "roster non-empty, nothing being edited, composer collapsed" from "roster non-empty, user clicked `+ Add Another Minion`, composer open on a blank new draft." Both have `editingDraftIndex() === null` and a non-empty roster. Reasoning and the alternative considered in §1.2. |
| 12 | **Removal: confirm, and when the `DELETE` actually fires** *(new, 2026-09-01)* | **Always confirm** (Skyler, Rosalina OQ4), via `ConfirmDeleteModalComponent` with its `[items]` input populated from **the draft's own** sub-resource counts. `removeMinionDraft(index)` only splices the draft out of `minionDrafts()`; the real `DELETE /api/minions/{id}` fires later, inside `submitPhase1`'s diff — the same deferral locations/bystanders already have. Two consequences must be handled, not discovered: **index invalidation** and **abandoned-wizard non-deletion**. See §1.5. |
| 13 | **Auto-commit of a valid open composer on `Next`** *(new, 2026-09-01)* | **Adopt Rosalina's §1.4 rule**, implemented as one store primitive `commitComposerIfValid(): boolean` called from **three** sites, not one: `next()`, `editMinionDraft(index)`, and the start-a-new-draft action. All state involved is signals and synchronous, so the committed draft is visible to `submitPhase1` in the same tick. This also **replaces** the discard-confirmation modal the 2026-08-04 draft of this doc recommended to Luigi — see §1.4. |
| 14 | **Step-tracker dot** *(new, 2026-09-01)* | Skyler: light the dot when any minion is present. `phaseStepComplete()`'s hardcoded `false` at `mystery-create.store.ts:409` becomes `this.minionDrafts().length > 0`. It must read **`minionDrafts()`, not the composer** — an uncommitted composer should not light the dot, or the dot would flicker on the first keystroke and back off on `Next`. The step stays optional: an empty roster still advances. |
| 15 | **`mystery-detail` "Belongs to {monster}" line** *(new, 2026-09-01)* | Skyler: yes. `mystery-detail.ts:31` already holds `MinionListItemResponse[]`, which already carries `monsterId`/`monsterName` (`core/models.ts:295-296`), and `minions-list.html:22-24` already renders the exact line. **Zero backend work, zero new fetch** — template only. Scoped as MM-5. |
| 16 | **Dossier preview-source mismatch** *(new, 2026-09-01)* | `mystery-create-dossier.html:165` reads the raw `store.minionWeaknesses()` signal inside a block that otherwise reads `store.minionPreview()`. Harmless today; a cross-minion data leak the moment drafts become a list. **Fix it first, as its own sub-phase MM-0**, because the fix is a provable no-op today and therefore riskless in isolation, whereas bundled into MM-3 it becomes indistinguishable from the churn around it. Audit result in §4 — this is the **only** occurrence. |

---

## Background

The `minions` schema/API/service layer is complete (see `docs/minion-migration-plan.md`), and as of 2026-08-05 so is whole-minion delete. **This plan is now UI/UX and store state only — there is no remaining backend gap.**

Confirmed by reading the current source at `f872d5e` (2026-09-01 re-verification):

- `mystery-create.store.ts` still has exactly one `minionForm` (`:283-288`), one `editingMinionId: signal<string | null>` (`:240`), and four flat sub-resource signals (`:231-234`) plus four private `existingMinion*Ids` baselines (`:245-248`) — single-minion, unchanged since 2026-08-04.
- `loadEditData` (`:667-669`) still fetches `minionService.getByMonster(pureMonster.id)` then does `minions[0]` via `switchMap` — any 2nd+ minion on the monster is still invisible in the wizard.
- `submitPhase1`'s minion branch (`:1026-1079`) still reads the single form directly, and contains a submit-time `handleSubmitError('A minion type is required when adding a minion.')` guard at `:1035` that exists only because `validateCurrentStep()` doesn't catch the name-only case. That guard disappears under the draft-list model — which is precisely why §1.3's widening matters.
- `minionPreview()` (`:451-463`) is computed from `minionValue()` (a `toSignal` over `minionForm.valueChanges`, `:359`) plus the four sub-resource signals. **This is the wizard's live-preview contract and the reason the composer's `FormGroup` has to stay store-owned** — see §3.
- **`DELETE /api/minions/{id}` exists** at every layer (see decision #6). `minionService.delete()` already has one live consumer: `minions-list.ts:47-51`, using the `pendingDelete` + `ConfirmDeleteModalComponent` pattern.
- `minionService.create()` now has **two** call sites, not one: `mystery-create.store.ts:1048` and `minion-create.ts:316-317`. *(The original doc said "exactly one place in the whole Angular app.")*
- `minion-create.ts` (`/monsters/:monsterId/minions/new` and `/minions/new`) is a complete standalone authoring page: `MinionFormComponent` for core fields, all four sub-resource types as **local page-scoped draft arrays**, one batched create on submit. Its draft interfaces are declared locally with an explicit comment that they are "deliberately declared here rather than imported from `monster-create.ts` or the mystery wizard" — relevant precedent for §3.
- `monster-detail.html:19-41` renders the monster's minions with a `+ Add Minion` link to `/monsters/:id/minions/new` and **no** remove affordance (`monster-detail.ts` has no delete-minion path — confirmed, its only minion reference is the read `getByMonster` at `:119`). Per decision #7 this is now correct-by-decision.
- `mystery-detail.html:104-111` already renders all minions as a flat list of bare `routerLink`s — needs no change for multiplicity, only the decision-#15 "Belongs to" line.
- `ConfirmDeleteModalComponent` has `itemName`, `visible`, `message`, and `items: string[]` inputs (`shared/confirm-delete-modal.component.ts:9-12`); `items` is passed `[]` everywhere today.

---

## Architecture Discussion

### 1. Wizard: from single-form to list-of-minions

#### 1.1 The core move — `MinionDraft`

**Confirmed unchanged 2026-09-01.** `minionDrafts: signal<MinionDraft[]>` replaces the implicit "the one minion" model. Shape:

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

This is *not* a straight copy of `LocationDraft`/`BystanderDraft` — those are flat leaf entities with no children, so `id: string | null` was the whole story. Minions have their own sub-resource collections (closer in shape to the monster itself than to a location), so each draft carries its own collections *and* its own existing-sub-resource-ID baseline, because `submitPhase1` needs an independent delete-all-recreate-all cycle per minion, not one shared cycle across all minions.

**Editing mechanism — reuse, don't rebuild.** Keep `minionForm` and the four sub-resource signals exactly as they are today, reinterpreted as "the currently active draft." This honors the standing 2026-07-21 "signal arrays, not FormArrays" decision while adding multiplicity at the *minion* level. `addMinionAttack`/`removeMinionAttack`/`addMinionPower`/etc. and their templates don't change at all — they still operate on the four flat signals.

**This maps onto Rosalina's design directly:** her roster is `minionDrafts()`, her composer is the existing form + four signals, her "Editing" card highlight is `editingDraftIndex() === i`. That mapping was checked against her §1.1-§1.4 rather than assumed. Three gaps surfaced; they are §1.2, §1.3 and §1.4.

#### 1.2 Gap 1 — the composer has three states, and `editingDraftIndex` encodes two *(decision #11)*

Rosalina's §1.1(d) specifies:

- roster empty → composer **open** (a first-time user sees essentially today's step)
- roster non-empty, nothing being edited → composer **collapsed** to a `+ Add Another Minion` button
- editing a roster card → composer **open**, populated

The fourth state is the problem: **roster non-empty, user has clicked `+ Add Another Minion`, composer open on a blank new draft.** That state and the collapsed state both have `minionDrafts().length > 0` and `editingDraftIndex() === null`. They are not distinguishable from the state this doc originally specified.

**Recommendation: add `composerOpen: signal<boolean>`, initialized `true`.** The UI reads `(composerOpen(), editingDraftIndex())`; the store maintains the invariant `editingDraftIndex() !== null ⇒ composerOpen()`.

- `startNewMinionDraft()` — reset form + four signals, `editingDraftIndex.set(null)`, `composerOpen.set(true)`
- `editMinionDraft(i)` — copy-in, `editingDraftIndex.set(i)`, `composerOpen.set(true)`
- `saveMinionDraftToList()` — commit, reset, `editingDraftIndex.set(null)`, `composerOpen.set(minionDrafts().length === 0)` (i.e. collapse, unless the roster somehow emptied)

**Alternative considered and rejected:** replacing `editingDraftIndex: signal<number | null>` with a discriminated union `signal<{mode:'closed'} | {mode:'new'} | {mode:'edit'; index:number}>`. It's more precise and makes the invariant unrepresentable-if-violated, but the store is uniformly flat signals of primitives and arrays — there is no tagged-union state anywhere in it — and every read site would need a `switch` where today it needs a comparison. **Trade-off accepted:** two signals that can in principle disagree, in exchange for staying inside the file's existing idiom. The invariant is one line in each of the three methods above and should carry a comment.

**Do not try to derive `composerOpen` from "the composer is non-empty."** It fails immediately: right after `+ Add Another Minion`, the composer is empty and the roster is non-empty, so a derived signal would collapse the panel the user just opened.

#### 1.3 Gap 2 — the "started" detector must be widened, not just repurposed *(decision #10, corrected)*

Rosalina's §1.4 needs a three-way classification of the open composer on `Next`: **empty** → proceed; **valid** → commit and proceed; **started but invalid** → block. Her Divergence #1 says `minionSectionStarted()` "survives, repurposed." Correct, and insufficient — as written today it would produce two silent data-loss paths, both of which are exactly the failure her rule exists to prevent.

Today, at `mystery-create.store.ts:466-479`:

```typescript
/** True once the user has put anything into the minion section other than its name. */
readonly minionSectionStarted = computed(() => {
  const value = this.minionValue();
  if (!value) { return false; }
  return (
    (value.description ?? '').trim().length > 0 ||
    (value.minionTypeId ?? '').length > 0 ||
    (value.harmCapacity ?? 3) !== 3
  );
});
```

Two holes, both load-bearing under the new model:

1. **It excludes Name by design** (see its own doc comment) — because its job was "is Name required?", and a name can't make itself required. A composer with *only* a name typed therefore reports not-started. Today that case is caught late, by `submitPhase1`'s `handleSubmitError('A minion type is required when adding a minion.')` at `:1035`. **Under the draft-list model that guard does not exist** — `submitPhase1` will iterate `minionDrafts()`, the uncommitted name-only composer is not in it, and the user's typed name vanishes with no error at all.
2. **It only reads the form**, never the four sub-resource signals. Rosalina's §1.4 third row names precisely this case — *"sub-resources added … but no name"* — and it must block. Today's computed returns `false` for a composer with two attacks and no name, so `Next` would proceed and discard both attacks silently.

**Corrected specification:**

- `minionNameRequired()` — **delete.** Name gets an unconditional `*`, matching Monster Name at `mystery-create-monster-phase.html:4`.
- `minionNameMissing()` — **delete**, replaced by the block condition below.
- `minionSectionStarted()` → rename to **`composerDirty()`** and widen to: `name` non-blank **OR** `description` non-blank **OR** `minionTypeId` non-blank **OR** `harmCapacity !== 3` **OR** any of `minionAttacks()`/`minionPowers()`/`minionWeaknesses()`/`minionArmors()` non-empty.
- Add **`composerValid()`** = `name` non-blank **AND** `minionTypeId` non-blank. (These are the two fields `submitPhase1` actually requires today; `harmCapacity` already carries its own `Validators.required`/`min(0)` on the control.)
- `validateCurrentStep()`'s `phase === 1 && step === 1` branch (`:913`) **stays**, with new semantics: block iff `composerOpen() && composerDirty() && !composerValid()`. On block, `markAllAsTouched()` on `minionForm` and surface the wizard's existing error band per Rosalina's copy.

Note `harmCapacity !== 3` keeps 3 as the wizard's magic default (`:285`). That default differs from `MinionFormComponent`'s `0` — a real divergence, relevant to §3, and one more reason a composer that merely *touched* harm capacity should count as dirty rather than be silently dropped.

> **APPROVED BY SKYLER 2026-09-01.** This subsection was the one item in this plan flagged as needing a human decision, because widening the dirty-check is a user-visible tightening: with `harmCapacity` defaulting to 3, nudging that field alone marks the composer dirty and blocks `Next` until Name and Type are also supplied — stricter than today's behavior. Skyler was shown that consequence explicitly, along with the narrower alternative (exempt `harmCapacity` from the dirty check) and the do-nothing option, and chose to **widen it and accept the stricter block** — on the reasoning Yoshi gave, that the alternative silently discards work. Implement SS1.3 exactly as specified above; `harmCapacity !== 3` **is** part of `composerDirty()`.

#### 1.4 Gap 3 — auto-commit needs one primitive and three call sites *(decision #13)*

Rosalina's rule — *"an open composer is committed if it can be, and you're stopped if it can't"* — applies on `Next` (§1.4) **and** on switching drafts (§1.3, row 3: *"`+ Add Another Minion` is available while editing; it applies the same commit rule as `Next`"*). One rule, three triggers. Implement it once:

```
commitComposerIfValid(): boolean
  if (!composerOpen() || !composerDirty())  -> return true    // nothing to commit
  if (!composerValid())                     -> markAllAsTouched(); return false
  saveMinionDraftToList();                  -> return true
```

Call sites, each aborting on `false`:

| Caller | Where | On `false` |
|---|---|---|
| `next()` | after `validateCurrentStep()` passes, **before** `submitCurrentPhase()` | don't advance; error band shows |
| `editMinionDraft(index)` | first statement, before any copy-in | don't switch; the pencil click is a no-op with the error shown |
| `startNewMinionDraft()` | first statement, before the reset | don't reset; the `+ Add Another Minion` click is a no-op with the error shown |

**Why the commit must happen in `next()` and not inside `submitPhase1`'s pipe.** All the state involved is signals and the commit is synchronous, so calling it from `next()` guarantees `submitPhase1` reads a `minionDrafts()` that already contains the committed draft, in the same tick. Putting it inside the rxjs pipe instead would run it after `monsterSave$` resolves — still functional, but it buries a state mutation inside an async chain that can be re-entered, which is the exact shape of the Bug 2 class of defect this file just finished eliminating. Keep the mutation synchronous and outside the pipe.

**This supersedes the discard-confirmation guard this doc recommended on 2026-08-04.** The original §1 flagged silent data loss on draft-switch and suggested Luigi add a "discard unsaved changes?" confirm reusing `ConfirmDeleteModalComponent`. Rosalina's Divergence #2 rejects that, on the grounds that it fires on the most common interaction in the step and trains dismissal. **She is right and I accept it.** Commit-if-valid / block-if-not covers the same risk with no modal: the only path that could still lose work is the invalid composer, and that is the path we block. The 2026-08-04 recommendation is withdrawn.

#### 1.5 Removal: confirm now, delete at `Next` *(decision #12)*

`removeMinionDraft(index)` splices the draft out of `minionDrafts()`. Its `id` (if non-null) is *not* deleted here — that happens in the `submitPhase1` diff, exactly like locations/bystanders today. Skyler's "always confirm" applies to the splice.

Four things to get right, none of which either document currently states:

1. **`[items]` must come from the draft, not the live signals.** The confirm modal lists what goes with the minion (e.g. `["2 attacks", "1 power"]`). Read those counts from `minionDrafts()[index]`, never from `minionAttacks()`/etc. — those are the *composer's* collections and belong to a different minion whenever the user removes a card they aren't editing. This is the same defect class as the dossier leak in decision #16, one surface over; it is worth naming because the correct-looking code is the wrong code.
2. **Index invalidation.** `editingDraftIndex` is a positional reference into an array that removal mutates. On `removeMinionDraft(i)`: if `editingDraftIndex() === i`, clear it and reset the composer (the thing being edited no longer exists); if `editingDraftIndex() > i`, **decrement it**, or it now silently points at the wrong minion and the next `saveMinionDraftToList()` overwrites a bystanding draft. This is the single most likely bug in MM-2.
3. **Positional identity is acceptable *because* Skyler declined reordering** (OQ7). Removal is the only index-invalidating mutation, it happens in one method, and the fix is three lines. The alternative — a client-side `key: crypto.randomUUID()` on each draft with `editingDraftKey: signal<string | null>` — is more robust but adds a field with no other consumer that must be stripped before building `UpsertMinionRequest`. **Trade-off accepted:** positional identity stays fragile if reordering is ever added later; that is the escape hatch to take if it is.
4. **Abandoning the wizard after a removal does not delete anything.** Remove a previously-saved minion, then close the tab without pressing `Next`, and the minion survives on the server. That is identical to how location/bystander unlinking already behaves, so it is not a new problem and not worth new machinery — recorded so it isn't rediscovered as a bug.

#### 1.6 `submitPhase1` diffing

Generalizes the pattern already shipped for locations/bystanders (`mystery-create.store.ts:1106-1168`), applied per-minion:

1. Save/update monster (unchanged).
2. Delete-recreate the monster's own sub-collections (unchanged).
3. Diff `minionDrafts()` against a new `existingMinionIds` baseline signal (parallels `existingLocationIds`):
   - IDs in the baseline but absent from `minionDrafts()` → `minionService.delete(id)` (hard delete). No manual sub-resource cleanup needed; DB-level `ON DELETE CASCADE` on every `minion_*` table handles it, verified by Bowser against the migration.
   - Drafts with `id !== null` → `minionService.update(draft.id, request)`.
   - Drafts with `id === null` → `minionService.create(monster.id, request)`.
4. For each surviving/created minion, run the *existing* `saveMinionCollections` (`:1196-1254`, unchanged in logic — just called once per minion instead of assumed exactly once), using that draft's own `existingAttackIds`/etc. as the delete baseline.
5. Backfill: reuse the existing `backfillDraftIds`/`savedDraftIds` helpers (`:1187-1194`, already generic over `{ id: string | null }`) to write real IDs back onto `minionDrafts()` and refresh `existingMinionIds`.
6. Delete the now-dead submit-time guard at `:1035` (`'A minion type is required when adding a minion.'`) — §1.3 moves that check to `validateCurrentStep()`, where the user can still act on it.

`idsToUnlink` (`:1179`) is already generic over `{ id: string | null }[]`; rename to `idsToRemove` and let the caller supply the delete-vs-unlink operation.

#### 1.7 `loadEditData`

Replace the `minions[0]`-only `switchMap` (`:668-669`) with a `forkJoin` over every minion ID from `minionService.getByMonster(pureMonster.id)`, mapping each `MinionDetailResponse` into a `MinionDraft` (including that minion's own sub-resource IDs). Sets `minionDrafts` and `existingMinionIds` directly. The composer stays blank and — per §1.2 — **collapsed** (`editingDraftIndex: null`, `composerOpen: false`) whenever the loaded roster is non-empty, which is Rosalina's specified state for a non-empty roster with nothing being edited.

### 2. Monster-detail — no work remains

Decisions #5 and #7 are both superseded (see the corrections table). `+ Add Minion` shipped as a link to the standalone create page (`monster-detail.html:22`); Remove Minion was declined by Skyler. **The original MM-5 is deleted, not deferred.**

The 2026-08-04 reasoning against embedding a second full set of sub-resource panels inside `monster-detail` is retained as history and turned out to be right about the problem and wrong about the remedy: the correct answer was neither an inline stub form nor inline panels, but a dedicated create page with local drafts and a batched submit — the model established by `docs/updates/standalone-creation-phase1-monsters.md` and applied to minions in Phase 2. That model did not exist when decision #5 was written.

### 3. Should the wizard's composer consume `MinionFormComponent`? *(decision #8, re-reasoned)*

**Recommendation: no.** But the original argument needs correcting before the conclusion can be trusted, because one third of it is now false.

**What the 2026-08-04 argument said, and what survives:**

| Original leg | Status |
|---|---|
| "The service layer is already the shared layer — `MinionService.create()`/`update()` are the reusable unit" | **Still true.** Two call sites use it today; a third (the wizard's per-draft loop) is what this plan adds. |
| "The two call sites have fundamentally different submission models — batched-at-phase-transition vs. immediate-per-action" | **Still true, and now much better evidenced.** Five shared domain form components exist (`monster-form`, `minion-form`, `location-form`, `bystander-form`, `hunter-form`) and **not one is consumed by the mystery wizard** — verified by grepping every consumer. The convention landed on exactly the line this argument drew. That is stronger evidence than the original assertion was. |
| "This codebase doesn't extract shared form components for overlapping-but-not-identical field sets; doing so here would be the first instance of that pattern" | **Dead. Flatly false as of 2026-09-01.** It is now a five-domain convention with its own decision records (`luigi-monster-form-component.md`, `luigi-minion-form-component.md`, `luigi-location-form-component.md`, `luigi-bystander-form-component.md`). **My original call was overtaken by events on this point, and the doc should not be read as though it wasn't.** |

**Why the conclusion nevertheless holds for the wizard — five concrete, verified blockers.** Rosalina correctly flags "reuse `MinionFormComponent`" as a live question Luigi will hit, so these are stated specifically rather than as a principle:

1. **It breaks the live dossier preview.** `MinionFormComponent` owns its `FormGroup` privately. The store's `minionValue = toSignal(this.minionForm.valueChanges…)` (`:359`) feeds `minionPreview()` (`:451-463`), which the dossier panel renders as you type. Moving the `FormGroup` into a child component severs that, and restoring it means pushing every keystroke back up through an output — a strictly worse arrangement than the store owning the form. **This is the architectural blocker; the other four are mechanical.**
2. **It renders its own filled-accent submit button** (`minion-form.html`, last line: `bg-accent … text-on-accent`). Rosalina's §1.1 explicitly requires the composer's save to be **outline-accent** so `Next →` stays the only filled accent control in the 42% column. Reuse means adding a button-variant `@Input` to a component whose two current consumers don't need one.
3. **Wrong output type.** It emits `UpsertMinionRequest`. The wizard needs a `MinionDraft` — with `id`, four sub-resource collections and four ID baselines.
4. **Wrong input type.** It populates from `@Input() minion: MinionDetailResponse | null`. A wizard draft is not a `MinionDetailResponse`: no `id`, no `monsterId`, no `minionType` object, no server-shaped sub-resource arrays.
5. **Different default.** `harmCapacity` defaults to `0` in `MinionFormComponent` and `3` in the wizard (`:285`). Swapping in the component silently changes wizard behavior and invalidates the `!== 3` dirty check in §1.3.

**Precedent that this duplication is the house call, not an exception:** `minion-create.ts` declares its own `AttackDraft`/`PowerDraft`/`ArmorDraft`/`WeaknessDraft` interfaces with an explicit comment that they are *"deliberately declared here rather than imported from `monster-create.ts` or the mystery wizard: they are driven by the `UpsertMinion*Request` contracts, not the monster ones."* Per-surface duplication of draft shapes across the wizard/standalone boundary is already a deliberate, shipped decision.

**Trade-off accepted:** four core-field control definitions exist in two places (the wizard composer and `MinionFormComponent`), so adding a fifth core minion field means touching both. That is a real, ongoing cost. It is accepted in exchange for not inverting form ownership in the one component whose live-preview contract depends on owning it. **If this ever needs revisiting**, the right move is not to make the wizard consume `MinionFormComponent` but to extract the *template markup* only (a presentational fragment taking a `FormGroup` input) — a different, smaller change than the one Rosalina flagged, and not needed for this plan.

### 4. Dossier preview *(decision #16)*

Rosalina's §2 keeps one `Minions` section, renders one compact entry per minion, and expands exactly one — whichever is loaded in the composer. This model supplies both sources cleanly: the compact entries read `minionDrafts()`, the expanded one reads `minionPreview()`. Section visibility changes from `store.minionPreview().name` (`mystery-create-dossier.html:125`) to "roster non-empty **or** composer has a name."

**The bug, and the audit.** `mystery-create-dossier.html:165` iterates `store.minionWeaknesses()` — the raw live signal — inside a block that otherwise reads `store.minionPreview()`. It's invisible today because `minionPreview().weaknesses` *is* `this.minionWeaknesses()` (`:461`), so the fix is a provable no-op. Under a `minionDrafts` model it becomes a visible cross-minion leak.

**I audited the whole file rather than trusting the single reported line.** Every `store.*()` read in `mystery-create-dossier.html`, by line:

| Block | Lines | Reads | Verdict |
|---|---|---|---|
| Mystery | 1-48 | `mysteryPreview()` throughout (+ `phaseComplete()` at 32) | Clean |
| Monster | 56-109 | `monsterPreview()` at **every one of its 15 reads** | **Clean — the monster-side mismatch does not exist.** Checked explicitly, since it was the most likely place for a second instance. |
| Minions | 125-178 | `minionPreview()` at 15 reads … **`minionWeaknesses()` at 165** | **One mismatch — the reported line, and the only one in the file.** |
| Locations | 194-203 | `locations()` | Clean by construction — there is no `locationPreview()` computed; the draft array *is* the source |
| Bystanders | 210-219 | `bystanders()` | Same |

**Fix:** repoint line 165 to `store.minionPreview().weaknesses`, matching the attacks/powers/armors blocks around it. Ship it as MM-0, ahead of everything else — in isolation it is a verifiable no-op; folded into MM-3 it is one indistinguishable line inside a template rewrite.

### 5. In-place edit *(decision #9)* — confirmed solved as a side effect

`editMinionDraft(index)` *is* in-place edit — it loads an existing draft's full state (top fields + all four sub-resource collections) back into the composer, and `saveMinionDraftToList()` commits back to the same array slot. It falls out of moving from "one implicit slot" to "an explicit indexed list with an edit action." No separate phase. It is exactly what Rosalina's roster pencil button drives.

This does *not* retroactively fix the identical friction for locations/bystanders (`addLocationForm`/`addBystanderForm` are still append+remove-only; no `editLocation`/`editBystander` exists). A real, pre-existing gap of the same shape, out of scope, noted so it isn't rediscovered as new.

---

## Sub-Phases

**Sequencing:** MM-0 first and alone. MM-2 + MM-3 + MM-4 land as **one PR** — an intermediate state where the store has moved to `minionDrafts` but the template still binds the old single-slot shape won't compile. MM-5 is independent of all of them and can go any time. MM-1 is already done.

### MM-0 — Dossier Preview-Source Fix *(new, 2026-09-01)*

**Goal:** Close the cross-minion leak at `mystery-create-dossier.html:165` before drafts become a list. Prerequisite to MM-4, and deliberately isolated because it is a provable no-op today.

**Work:** change `@for (weakness of store.minionWeaknesses(); track $index)` to `@for (weakness of store.minionPreview().weaknesses; track $index)`, matching the attacks/powers/armors blocks immediately around it.

**Files modified:** `src/web/.../mystery-create/mystery-create-dossier.html`

**Verification:** `npm run build` passes; `npm run test -- --watch=false` passes. Manual: type a minion weakness in the wizard, confirm it still appears live in the dossier — behavior must be *identical*, since `minionPreview().weaknesses` is `minionWeaknesses()` today (`mystery-create.store.ts:461`). Any visible change means something else is wrong.

---

### MM-1 — Backend: Minion Hard-Delete Endpoint — **DONE 2026-08-05 (Bowser). No work remains.**

> **SUPERSEDED 2026-09-01.** This sub-phase was scoped on 2026-08-04 as the plan's one real API gap. It shipped independently on 2026-08-05, before this plan was picked up. Retained as a record of what to build against, not as a work item.

What shipped, verified 2026-09-01:

| Layer | Location | Note |
|---|---|---|
| Repository | `MinionRepository.cs:86` | `dbContext.Minions.Where(x => x.Id == id).ExecuteDeleteAsync(ct)` |
| Service | `IMinionService.cs:12` / `MinionService.cs:80` | `Task<bool> DeleteAsync(Guid id, CancellationToken ct)` |
| Controller | `MinionsController.cs:41` | `[HttpDelete("api/minions/{id:guid}")]` → 204 / 404 |
| Angular client | `core/minion.ts:48` | `delete(id: string): Observable<void>` |

No migration was needed: `ON DELETE CASCADE` on every `minion_*` child FK was verified against `20260726000551_ExtractMinionsToOwnTable.cs` *before* implementation — which mattered, because `ExecuteDeleteAsync` bypasses EF's in-memory cascade tracking and issues a raw `DELETE`. `MinionServiceTests.cs` was created (it did not previously exist) with delete-true / delete-false / validation coverage. Details in `.squad/decisions/inbox/bowser-minion-delete-backend.md`.

**One thing to confirm during MM-2 rather than assume:** `minionService.delete()` has exactly one live consumer today (`minions-list.ts:47-51`), a single subscription. The wizard will be the second, calling it inside a `forkJoin`/`runBatch`. Nothing about the endpoint suggests a problem; it just hasn't been exercised that way.

---

### MM-2 — Wizard Store: `MinionDraft` Model, Composer State Machine, Validation

**Goal:** The store half of §1. Lands with MM-3 and MM-4 as one PR.

**Work (`mystery-create.store.ts`):**

*Data model (§1.1, §1.6, §1.7)*
- Add the `MinionDraft` interface.
- Replace `editingMinionId` (`:240`) and the four private `existingMinion*Ids` (`:245-248`) with `minionDrafts: signal<MinionDraft[]>`, `existingMinionIds: signal<string[]>` (private), `editingDraftIndex: signal<number | null>`.
- Keep `minionForm` (`:283-288`), the four sub-item forms, and the four sub-resource signals (`:231-234`) exactly as-is — now "active composer" state.
- Rewrite `submitPhase1`'s minion branch (`:1026-1079`) per §1.6, including deleting the dead `:1035` type guard.
- Rewrite `loadEditData`'s minion branch (`:667-669`) to `forkJoin` all minions, and leave the composer collapsed when the loaded roster is non-empty.
- Generalize `idsToUnlink` (`:1179`) → `idsToRemove`, parameterized by the delete-vs-unlink operation. `backfillDraftIds`/`savedDraftIds` (`:1187-1194`) are reused unchanged.

*Composer state machine (§1.2, §1.4, §1.5)*
- Add `composerOpen: signal<boolean>` (init `true`), maintaining `editingDraftIndex() !== null ⇒ composerOpen()`.
- Add `editMinionDraft(index)`, `saveMinionDraftToList()`, `removeMinionDraft(index)`, `startNewMinionDraft()`, `cancelComposerEdit()`.
- Add `commitComposerIfValid(): boolean`; call it (aborting on `false`) from `next()` before `submitCurrentPhase()`, and as the first statement of `editMinionDraft` and `startNewMinionDraft`.
- `removeMinionDraft(index)` must fix up `editingDraftIndex`: clear it when `=== index`, decrement it when `> index`. **Comment the reason** — it's a silent wrong-minion overwrite otherwise.

*Validation and tracker (§1.3, decision #14)*
- `minionForm` Name and `minionTypeId` get plain `Validators.required` (`:283-288`).
- Delete `minionNameRequired()` (`:480`) and `minionNameMissing()` (`:482-484`).
- Rename `minionSectionStarted()` (`:467-479`) → `composerDirty()` and widen it to include Name **and** the four sub-resource signals.
- Add `composerValid()` = name non-blank && `minionTypeId` non-blank.
- Keep `validateCurrentStep()`'s `phase === 1 && step === 1` branch (`:913`); new condition: block iff `composerOpen() && composerDirty() && !composerValid()`.
- `phaseStepComplete()`'s hardcoded `false` (`:409`) → `this.minionDrafts().length > 0`.
- Reword `stepBlurb()['1-1']` (`:517`) per Rosalina §1.1(a) — its current tail describes a mechanism that no longer exists.

*Draft state*
- Update `MysteryCreateDraftState` (`:104-129`): drop `forms.minion` and `collections.minionAttacks`/`minionPowers`/`minionWeaknesses`/`minionArmors`; add `collections.minionDrafts` plus the composer's own state. Re-verify at implementation time whether anything outside `mystery-create.store.spec.ts` consumes it (grep showed no external consumer on both passes).

**Files modified:**
| File | Notes |
|---|---|
| `src/web/.../mystery-create/mystery-create.store.ts` | Core of this sub-phase |
| `src/web/.../mystery-create/mystery-create.store.spec.ts` | Existing single-minion tests (`:134-144`, `:183-238`, `:272-304`, `:335-357`, `:360-382`) need rewriting against the list model. Note `:335` (`'requires a minion name only once the minion section has been started'`) tests exactly the semantics §1.3 changes — rewrite it, don't delete it. |

**Verification:**
- `npm run build`; `npm run test -- --watch=false`.
- Store spec covers: add 1st draft, add 2nd; edit an existing draft in place (fields *and* sub-resources round-trip); remove a draft before submit (never hits the API); submit creates N minions with correct independent sub-resources; revisit-and-resubmit updates rather than duplicates; removing a previously-saved minion on revisit calls `delete()`.
- **Specifically cover the §1.3/§1.5 regressions**, because each is a silent-data-loss path no existing test would catch:
  - name-only composer + `Next` → blocked, not silently dropped;
  - composer with sub-resources but no name + `Next` → blocked;
  - valid unsaved composer + `Next` → auto-committed, and `submitPhase1` sees it in the same tick;
  - `removeMinionDraft(0)` while editing draft 1 → `editingDraftIndex` becomes 0 and still refers to the same minion.

---

### MM-3 — Wizard Template: Roster + Composer

**Goal:** The UI half of §1, built to `docs/updates/multi-minion-wizard-design.md` §1. Same PR as MM-2/MM-4. **Rosalina's doc is the source of truth for markup, class strings, copy and button weight** — this doc does not restate them.

**Work (`mystery-create-monster-phase.html`, `currentStep() === 1` block, lines 148-288):**
- Roster of minion summary cards above the composer, markup lifted from `minions-list.html:16-41`, bound to `store.minionDrafts()`; pencil → `store.editMinionDraft(i)`, trash → confirm → `store.removeMinionDraft(i)`.
- Composer visibility driven by `(store.composerOpen(), store.editingDraftIndex())` per §1.2 — **not** by `editingDraftIndex` alone.
- Existing form + four sub-resource panels (lines 151-287) stay structurally the same, reframed as the active draft.
- Explicit `Save Minion` / `Save Changes` → `store.saveMinionDraftToList()`, and `+ Add Another Minion` → `store.startNewMinionDraft()`. **Outline-accent, not filled** (Rosalina §1.1).
- `ConfirmDeleteModalComponent` with `[items]` populated **from `minionDrafts()[i]`**, per §1.5(1).
- Name label gets an unconditional `*` plus an `@if (invalid && touched)` error block, matching Monster Name at lines 4-9.

**Files modified:**
| File | Notes |
|---|---|
| `src/web/.../mystery-create/mystery-create-monster-phase.html` | Minion step template |
| `src/web/.../mystery-create/mystery-create-monster-phase.ts` | 19 lines today, template-only wiring — verify at implementation time whether the confirm-modal state belongs here or in the store |

**Verification:**
- Manual: add 2 minions with different sub-resources in a fresh mystery, submit, confirm both appear on monster-detail with correct sub-resources.
- Manual: edit an existing mystery with 2+ minions (seed via `/monsters/:id/minions/new`, which can now produce this state directly — the old wizard never could) — confirm all appear, and editing one and resubmitting doesn't touch the others.
- Manual: Bug 2 shape doesn't reappear — jump back to phase 0, forward again without changes; minion count stays the same.
- Manual: remove a roster card while editing a *different* card; confirm the composer still holds the minion it held before (the §1.5(2) index bug).
- `npm run build` passes.

---

### MM-4 — Dossier: Roster Entries + One Expanded

**Goal:** `docs/updates/multi-minion-wizard-design.md` §2. Same PR as MM-2/MM-3; **depends on MM-0.**

**Work (`mystery-create-dossier.html`, lines 125-192):**
- Section visibility (`:125`) changes from `store.minionPreview().name` to "roster non-empty **or** composer has a name," so the section doesn't vanish the instant a saved minion is committed and the composer resets.
- One compact entry per `store.minionDrafts()` — name, type badge, `<small>` counts line. **All counts read from the draft**, never from the live composer signals.
- Exactly one expanded: the composer's, using today's markup (lines 133-178) unchanged and reading `store.minionPreview()` throughout — which is true of every line in that block once MM-0 has landed.
- No count chrome on the section header (no other dossier section carries one).

**Files modified:** `src/web/.../mystery-create/mystery-create-dossier.html`

**Verification:** Manual — with 3 minions in the roster and one loaded in the composer, the dossier shows three compact entries and exactly one expanded block, and **the expanded block's weaknesses belong to the minion being edited** (the MM-0 regression, now observable). `npm run build` passes.

---

### ~~MM-4 — Backend/Frontend Coordination Check~~ — **DROPPED 2026-09-01**

> The original MM-4 was a no-work checkpoint to confirm no API gap remained beyond MM-1. With MM-1 shipped and verified at every layer, and `create`/`update`/`getByMonster`/`getById` plus all sub-resource CRUD confirmed present and unchanged by this plan, it has nothing to check. A sub-phase with no work item is noise in a list meant to be executed in order. The one genuinely open backend-adjacent question — the wizard being `delete()`'s first batched consumer — is folded into MM-1's closing note and MM-2's verification instead. The `MM-4` label is reused above for the dossier work.

---

### ~~MM-5 — Monster-Detail: Add Minion / Remove Minion~~ — **DELETED 2026-09-01**

> **SUPERSEDED.** Both halves are gone: **Add Minion** shipped as a link to the standalone create page (`monster-detail.html:22` → `/monsters/:monsterId/minions/new`), and **Remove Minion** was declined by Skyler on 2026-09-01 (Rosalina's Open Question 6). Decision #7's objection — that add-without-remove is asymmetric — is noted as accurate and overruled; the asymmetry stays open by decision, and removal remains available from `minions-list` and from the wizard roster. **Nothing here is deferred; there is no work.**

---

### MM-5 — `mystery-detail`: "Belongs to {monster}" Line *(new, 2026-09-01)*

**Goal:** Skyler's answer to Rosalina's Open Question 5. Independent of every other sub-phase — ship it whenever.

**Work (`mystery-detail.html`, minions `<article>`, lines 95-113):** add a "Belongs to: {monsterName}" line to each minion entry. `mystery-detail.ts:31` already holds `MinionListItemResponse[]`, which already carries `monsterId`/`monsterName` (`core/models.ts:295-296`), and `minions-list.html:22-24` already renders exactly this line. **Template only — no new fetch, no store change, no backend work.**

**Files modified:** `src/web/.../mysteries/pages/mystery-detail/mystery-detail.html`

**Verification:** Manual — a mystery with two monsters, each with minions, shows the owning monster on every minion row. `npm run build` passes.

---

## Files Affected Summary

| File | Status | Sub-Phase | Notes |
|---|---|---|---|
| `src/api/.../{IMinionRepository,MinionRepository,IMinionService,MinionService,MinionsController}.cs` | Already shipped | MM-1 | Whole-minion delete, 2026-08-05 — **no work** |
| `src/web/.../core/minion.ts` | Already shipped | MM-1 | `delete()` at `:48` — **no work** |
| `src/web/.../mystery-create/mystery-create-dossier.html` | Modified | MM-0, MM-4 | MM-0: repoint line 165. MM-4: roster entries + one-expanded |
| `src/web/.../mystery-create/mystery-create.store.ts` | Modified | MM-2 | `MinionDraft`, composer state machine, `submitPhase1`/`loadEditData` rewrite, validation, tracker dot, blurb |
| `src/web/.../mystery-create/mystery-create.store.spec.ts` | Modified | MM-2 | Rewrite single-minion tests; add the three silent-data-loss cases and the index-fixup case |
| `src/web/.../mystery-create/mystery-create-monster-phase.html` | Modified | MM-3 | Roster + composer |
| `src/web/.../mystery-create/mystery-create-monster-phase.ts` | Modified (if needed) | MM-3 | Confirm-modal wiring only; verify at implementation time |
| `src/web/.../mysteries/pages/mystery-detail/mystery-detail.html` | Modified | MM-5 | "Belongs to {monster}" line |
| ~~`src/web/.../monsters/pages/monster-detail/monster-detail.{ts,html,spec.ts}`~~ | **Not modified** | ~~MM-5~~ | Superseded 2026-09-01 — add shipped, remove declined |

> All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`; all `src/api/...` paths expand to `src/api/MonsterOfTheWeek.Api/`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|---|---|---|
| `docs/theming/found-bugs.md` status line is stale for **both** bugs | Says "Neither bug has been fixed." Bug 2 was fixed in `e83eebb`. Bug 1 is now half-fixed: the `*` shipped at `mystery-create-monster-phase.html:22`, the inline error block did not | Update the status line and Bug 1's description when this work is picked up; still out of this doc's editing scope |
| Bug 1 remainder — Monster Type has no inline error block | Confirmed: no `@if` on `monsterTypeId`, unlike `monsterArchetypeId` at `mystery-create-monster-phase.html:28-30`. The user-visible symptom in `found-bugs.md` (wizard silently refuses to advance) is *partly* still live | Cheap; that file is already being touched in MM-3. Opportunistic, not required by this plan |
| `monster-detail` can add a minion but not remove one | **Open by decision, not oversight** — Skyler declined it 2026-09-01 | None. Recorded so it isn't refiled as a bug |
| Locations/bystanders have no edit-in-place | `addLocationForm`/`addBystanderForm` are still append+remove-only; no `editLocation`/`editBystander` in the store | Real gap, same shape as decision #9, out of scope (no sub-resources on those domains, so a smaller lift) |
| Removing a saved minion draft then abandoning the wizard doesn't delete it | The `DELETE` fires in `submitPhase1`, not at splice time — identical to existing location/bystander unlink behavior | None. Recorded per §1.5(4) so it isn't rediscovered as a bug |
| Positional draft identity is fragile if reordering is ever added | `editingDraftIndex` is an array index; safe only because Skyler declined reordering (OQ7) | If reordering is ever wanted, switch to a client-side `key` per §1.5(3) *before* building it |
| Duplicate minion names | Nothing in the stack enforces uniqueness; two roster cards both reading "Cultist" are ambiguous. Same property `monster-detail`'s list has today | Noted, not solved — per Rosalina §4 |
| Four core-field controls duplicated between the wizard composer and `MinionFormComponent` | Accepted trade-off, §3 | A fifth core minion field must be added in both places |
| Minion custom moves | `MinionDetailResponse.customMoves` still has no create/edit UI anywhere, including `minion-detail` and `minion-create` | Out of scope, unchanged |

---

## Verification Checklist

- [ ] `npm run build` passes with no new errors
- [ ] `npm run test -- --watch=false` passes, including the rewritten `mystery-create.store.spec.ts` minion-list coverage
- [ ] MM-0: dossier weakness rendering is identical before and after the line-165 repoint
- [ ] Wizard: a new mystery with 2+ minions on the monster produces 2+ minion rows, each with correct independent sub-resources
- [ ] Wizard: editing a mystery whose monster already has 2+ minions shows all of them, not just one
- [ ] Wizard: editing one draft in place and resubmitting updates that minion only — siblings and the monster untouched
- [ ] Wizard: removing a previously-saved draft and resubmitting hard-deletes it and its sub-resources via cascade
- [ ] Wizard: revisiting phase 1 and pressing Next again without changes duplicates nothing (Bug 2 stays fixed under the new model)
- [ ] Wizard: an **empty** composer on Next proceeds; a **valid** one auto-commits then proceeds; a **name-only** one blocks; a **sub-resources-but-no-name** one blocks
- [ ] Wizard: removing a roster card below the one being edited leaves the composer pointing at the same minion
- [ ] Wizard: the remove-confirm modal lists the *removed* minion's sub-resource counts, not the composer's
- [ ] Wizard: the minion step-tracker dot lights when the roster is non-empty, and the step still advances when it's empty
- [ ] Dossier: with 3 roster minions and 1 in the composer, three compact entries render and exactly one expands — with its **own** weaknesses
- [ ] `mystery-detail`: every minion row names its owning monster
- [ ] `docker compose up -d postgres && dotnet run` workflow unaffected
- [ ] No backend changes were needed (if any surfaced, MM-1's "done" status needs revisiting)
