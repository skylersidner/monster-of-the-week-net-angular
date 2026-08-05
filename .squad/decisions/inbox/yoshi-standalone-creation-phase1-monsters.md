# Standalone Creation Phase 1 (Monsters) — Architecture Decisions

**By:** Yoshi (Architect)
**Date:** 2026-08-04

**What:**
- Build a shared, presentational `MonsterFormComponent` (`features/monsters/shared/monster-form/`) owning the 5 core Monster fields (name/description/harmCapacity/monsterTypeId/monsterArchetypeId), extracted from `monster-detail.ts`'s existing inline form rather than built fresh. Inputs: `monster: MonsterDetailResponse | null` (null = create), `monsterTypes`, `monsterArchetypes`, `isSaving`, `submitLabel`. Output: `save = EventEmitter<UpsertMonsterRequest>`. Parent pages own the actual `MonsterService` call.
- New bare-bones `/monsters/new` create page (core 5 fields only, no sub-resource panels — those are added afterward via the existing `monster-detail.ts` page).
- A mystery-picker (optional, create-only) stays *outside* `MonsterFormComponent` as a sibling control the create page owns directly — it has no meaning in edit mode.
- New backend overload `MonsterService.CreateAsync(UpsertMonsterRequest)` (no `mysteryId`) + `POST /api/monsters`, needed only if standalone/unattached creation is in scope (Open Question 1) — schema/DTOs already fully support a monster with zero mystery links (`Monster` has no `MysteryId` FK, only the M:N `MysteryMonster` bridge table; `MysteryIds` is already `[]`-safe in both list/detail DTOs; `GET /api/monsters` and `DELETE /api/monsters/{id}` already work unconditionally).

**Why:**
- Unlike the multi-minion plan's decision #8 (declined to share a minion form between the wizard's batch-submit model and monster-detail's immediate-mutation model), Monster create and edit are **both** immediate-mutation, both outside the wizard — a materially different, much stronger case for sharing. Not the same trade-off revisited.
- Monster's relationship to Mystery is genuinely M:N (`MysteryMonster` bridge), unlike Minion's 1:N-to-Monster — the minion plan's "inline stub-create → navigate to existing detail page" pattern's *shape* (create bare entity, do sub-resources on the existing detail page) transfers, but its "obvious single parent to scope under" reasoning does not. Mystery-scoping is a genuine, first-class open product question here, not a mechanical copy.
- Verified before designing rather than assumed: `Monster` entity has no `MysteryId` FK (bridge-table-only M:N), `GetAllAsync`/`monsters-list.html` are already mystery-agnostic and already render fine with an empty `MysteryIds`, and `MysteryService.getMysteries()` already exists — meaning both "unattached creation" and "optional attach-at-creation" are cheap (one thin backend endpoint, zero schema change, zero new list-page work), not risky. Worth checking "does the schema already tolerate the state the new UI would produce" before assuming a product question implies real backend risk.

**Open questions left to Skyler (not resolved here):** mystery-scoping at creation (always-attached vs. always-unattached vs. optional, my lean: optional); where the "Add Monster" entry point lives (my lean: top-level `/monsters` list); whether bare-bones MVP excludes sub-resource panels (my lean: yes, exclude); whether `monster-detail.ts` gets swapped to consume the shared component in this same phase or a later cleanup (my lean: same phase, to avoid manufacturing duplication on purpose).

**Docs:** `docs/updates/standalone-creation-phase1-monsters.md`.

---

## Revision — Skyler's 4 Answers Resolved (2026-08-05)

**By:** Yoshi (Architect)
**Date:** 2026-08-05

**What changed:**
- Mystery scoping → **Option C locked in** (optional picker, default blank). Confirms the recommendation.
- Entry point → **top-level `/monsters` list**. Confirms the recommendation.
- MVP scope → **diverges from my recommendation**: the 4 sub-resource panels (attacks/powers/armors/weaknesses) are required on the create page itself, not deferred to a second navigation via `monster-detail.ts`.
- Detail rewire → **in scope, same phase** (no longer conditional). Confirms the recommendation.

**The real architecture work this revision required:** the MVP-scope answer broke the doc's original assumption (sub-resources deferred to an existing-monster page). Sub-resource entities are FK'd to an existing `monsterId`, and `monster-detail.ts`'s panels work via immediate per-action API calls specifically because the monster already exists — that pattern can't work unmodified on a page where the monster doesn't exist yet.

**Decision: local draft arrays (`signal<T[]>`) + single batched submit**, not "create-then-reveal" (silently create the bare monster first, then reveal `monster-detail.ts`-style immediate-mutation panels).

**Why:**
- Skyler's own wording ("not deferred to a second navigation via monster-detail") rules out *any* navigation gating access to the sub-resource panels, including an automatic/silent one — create-then-reveal's core mechanic is exactly a gated second step of that shape.
- Local drafts + batch submit isn't new machinery — it's the codebase's existing "signal arrays, not FormArrays" convention (`.squad/decisions.md`, 2026-07-21), and the create-monster-then-`forkJoin`-the-sub-resources sequencing is a direct, already-proven precedent in the parked wizard's `mystery-create.store.ts` (`saveThreatCollections`/`runBatch`, `submitPhase1`) — read for precedent only, not imported/modified (wizard stays untouched per the parked-plan instruction).
- Create-then-reveal would have required a *second* shared-extraction decision (extracting `monster-detail.ts`'s sub-resource panels into something the create page could also render) for a UX shape Skyler's wording already rejected — strictly worse on both axes.

**Consistency check performed (explicitly requested):** Resolved Decision 1's "both immediate-mutation" justification for sharing `MonsterFormComponent` was re-scoped to apply to *the component's own save contract only*, not to "the whole create page is immediate-mutation" (no longer true — the page now has a batch step for sub-resources downstream of the component's `save` emission). Named the throughline explicitly as "share only when submission models match," and used it to also ground a *new* decision — the 4 sub-resource panels are deliberately **not** shared between `monster-create.ts` (draft/batch) and `monster-detail.ts` (immediate-per-action), same reasoning as multi-minion's decision #8, applied a second time in this doc but this time correctly ruling against sharing.

**New gap surfaced and accepted, not solved:** partial-failure mid-batch (monster created, some sub-resources fail) has no transactional guarantee — mitigated by always navigating to the real, now-existing monster's detail page with an error toast (so the user isn't stranded and can finish manually via `monster-detail.ts`'s immediate-per-action panels), not by rollback. Same accepted risk shape as the wizard's own equivalent, not a new risk this phase introduces.

**Docs:** `docs/updates/standalone-creation-phase1-monsters.md` (fully revised — Resolved Decisions table grew from 8 to 15 rows, Open Questions section removed, Sub-Phases SC-1/SC-3/SC-4 reworked, new Architecture Discussion sections).
