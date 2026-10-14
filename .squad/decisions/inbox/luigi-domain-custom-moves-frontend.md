# Domain Custom Moves — Write Failures Never Touch `errorMessage`, and the Card Contract Loses an Output

**By:** Luigi (Frontend Developer)
**Date:** 2026-10-11
**Status:** Implementation direction, appended as §§26–34 of `docs/domain-custom-moves/architecture.md`.
Yoshi's §§0–12, Rosalina's §§13–15 and Bowser's §§16–25 unchanged. No production code written.
**Skyler answered all four of my open questions on 2026-10-11** — recorded as §33.1 L-D1–L-D4 and
folded into the sections they govern. The one that changed the plan is L-D4: the unmount fix became
**Phase A**, ahead of Phase 1.

## What

Four decisions and one correction of scope, all inside §8.1's fourteen settled decisions rather than
around them.

1. **A custom-move write failure sets a toast and never `errorMessage`, on all five detail pages.**
   R14 scopes that hazard to `mystery-detail`. It is a property of the whole page family: all five
   templates order `@else if (errorMessage())` **ahead** of the content branch, and
   `monster-detail.ts`'s `runAndRefresh` sets `errorMessage` on every sub-resource failure — so the bug
   R14 names as a risk for Mystery is **already live** on Monster and Minion, where a failed "Delete
   power" replaces the monster with a red line. The same two pages state the correct rule three times
   (`monster-detail.ts:460-464`, `monster-detail.spec.ts:236-247`, `location-detail.ts:135-137`) while
   `runAndRefresh` breaks it. **The pre-existing defect is fixed first, as Phase A** (L-D4; Skyler:
   *"I do think we should fix this now; do it first as a pre-step to the first documented phase… The
   behavior change is not a big deal, and I would rather it be resolved for the upcoming work."*) —
   eight deleted lines across **two** methods on each of two pages, ahead of Phase 1 and independent of
   it. Two methods, not one: `createAttack` has its own `subscribe` because an attack chains weapon-tag
   assignments, so a fix touching only `runAndRefresh` would leave the busiest collection still
   unmounting the page. Consequence worth having: by the time 5a arrives the whole page family already
   routes write failures to the toast, so the custom-move pipeline is the **normal** case rather than a
   divergence needing a comment to justify it.

2. **`app-custom-moves-card` takes five inputs and emits three outputs**, not Rosalina's five-and-four.
   `(editRequested)` and `(editCancelled)` collapse into a two-way `[(editingKey)]`, which is exactly how
   `app-image-carousel`'s `[(activeImageId)]` already works on four pages — so every one of the nine call
   sites loses two handlers and gains nothing. The card takes a card-local `CustomMoveRow`
   (`{ key, name, description }`) rather than `CustomMoveResponse[]`, so a create page never fabricates an
   id inside an object named `…Response`. And `ownerType`, which the design otherwise leaves unused, is
   **rendered** as `[attr.data-owner-type]` so the Phase 6 parity guard can assert it *before*
   normalising the owner token away — the exact hole a negative control found in the images guard.

3. **The owner-segment typo guard is derived, not transcribed.** Bowser hands over "a typo in
   `OWNER_SEGMENT` is a bodiless 404, `SUPPRESS_ERROR_TOAST` hides it, and the spec asserting five
   segments by string is the only guard." Five human-typed strings checked against five human-typed
   strings is the shape `confirm-delete-modal.call-sites.spec.ts` already documents as rotten. Instead:
   derive the four shared segments from `resourceImagesPath` — a shipped, live-proven map — and the fifth
   from `MysteryService`'s own URL through `HttpTestingController`. Zero transcribed segments, every one
   anchored to a string the running app already depends on. Plus a one-off five-segment live probe with
   **real** owner ids in the Phase 4 gate, because `200` versus `404` with a real id is the only thing
   that distinguishes a wrong segment from a missing owner.

4. **5f-0 is a provable no-op under two conditions that have to be written down.** It holds only because
   both ledger specs **sort** their call lists (`phase4-ledger:99`, `phase5a-ledger:63`) — the
   restructure genuinely reorders `update`/`link` from all-then-all to per-draft pairs. And it holds only
   if 5f-0 does **not** extend the diff to the entity level: phases 1, 2 and 3 all write unconditionally
   today, and `phase4-ledger:404` (S4) and `:206` (A6) are the tests that catch the temptation.

5. **Correction of scope on two "cheap" claims.** `resource-images-four-domain-parity.spec.ts` is a
   **fourth** cross-cutting census guard — R12 lists three — and R13's `pendingDelete` migration makes it
   fail by construction, with a message that reads like an images regression. And 5c/5d carry **two**
   state migrations: `pendingDelete`, plus `isSaving` → `activeMutation`/`isMutating`, without which the
   parity guard cannot observe the `busy` binding at all and adding a custom move prints
   *"Saving location..."*.

## Why

- **Generalising §4.1 item 4 from one page to five is what makes the five hosts identical**, and identical
  hosts are the precondition for a parity guard having anything to compare. A rule that is right on one
  page and absent on four is also the asymmetry that reads as an oversight forever.
- **A contract change that removes an output is the cheap kind.** Two handlers × nine call sites is the
  whole saving, and the idiom already ships, so there is no new vocabulary to review.
- **A relative invariant beats a recorded one** — the lesson the images drift guard produced — and it
  applies to a *map* as readily as to markup. The thing that rots is the written-down copy; the thing that
  cannot is a derivation from something the application depends on.
- **"Provable no-op" is a strong claim and it was one condition away from false.** Naming both conditions
  costs two sentences and protects the single best idea in the plan.
- **The type system protects two of twelve 5f-2 sites per owner.** `MonsterDraft` is an interface, so the
  two object-literal construction sites will not compile without the new fields; five others —
  `monsterComposerPreview`, `monsterComposerDirty`, `editMonsterDraft`, `resetMonsterComposer`,
  `writeBackMonsterDrafts` — are expressions, and omission compiles clean. `monsterComposerDirty` is the
  one with teeth: omit custom moves and attaching an existing monster silently discards a composer
  holding only a move.

## Answered by Skyler, 2026-10-11 (architecture.md §33.1, L-D1–L-D4)

- **L-D1 — the card contract is three outputs.** *"Yes, Luigi's three outputs. Overall, I prefer the
  two-way binding as a more straightforward pattern."* The second sentence is recorded in §28.1 as a
  **general preference**, not a ruling on this component: the next shared component with a
  request-plus-cancel output pair should reach for `[(x)]` first and justify a pair rather than the
  reverse. In-repo citation: `app-image-carousel`'s `[(activeImageId)]`.
- **L-D2 — plain `<h3>`, no section icon on `mystery-detail`.** *"I agree that the h3 makes the most sense
  here. I can easily circle back and figure out an icon solution if it bothers me, but for now, the h3 is
  good."* §26.2 L14 records the three things that make "circle back" a design pass rather than an
  attribute — no custom-moves glyph exists in any of the three icon vocabularies, the mystery-section
  icon component lives inside the mysteries feature, and the other four detail pages have no icon on any
  section heading — so the door stays genuinely open rather than nominally open.
- **L-D3 — `list()` ships in Phase 4, validated in 5f-3.** *"…this is not expected to function fully
  until 5f-3. Tests obviously won't be useful until then… We just need a note to be sure to validate the
  functionality in 5f-3 and ensure tests have the correct coverage."* Written as **two gates**, not a code
  comment, because nine sub-phases separate the method from its caller and deferred *coverage* is
  invisible in a green suite: §27.3 (Phase 4 — builder-level assertions only, and why inventing more
  would be worse than the gap) and §30.5 (5f-3 does not close until the real caller exercises it against
  the dev server, with at least one non-empty stub).
- **L-D4 — fix the unmount defect now, as Phase A.** See item 1 above and §34. *"The behavior change is
  not a big deal"* is a scope ruling, not a waiver: Phase A has its own gate, including a negative control,
  because the whole phase is a deletion and a deletion's test can pass for the wrong reason.

## Still not decided here

- Whether Rosalina accepts §26.2 L13's `<div [formGroup]>` in place of her "panels between `</form>` and
  the button row" for the wizard's location/bystander composer. Hers to call; the alternative is a
  structural edit to shipped markup in the riskiest phase.
- Rosalina's F-R3 (`whitespace-pre-wrap` on the eight sibling description lines) overlaps Phase A's two
  pages and eight panels exactly, and is deliberately **not** absorbed into it (§34.3).
