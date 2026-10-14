# Domain Custom Moves — One Full-Width Card on Five Pages, Hand-Written Panels in the Wizard

**By:** Rosalina (Designer)
**Date:** 2026-10-10
**Status:** Design direction, appended as §§13–15 of `docs/domain-custom-moves/architecture.md`. Yoshi's
§§0–12 unchanged. No production code written.

## What

**One shared, presentational `app-custom-moves-card`** wearing
`<article class="bg-surface border border-default rounded-lg p-3">`, laid out **full width and outside any
grid**, on all five detail pages and on the two create pages that get a card — with **row-level edit**,
which no sibling sub-resource panel in this app has.

1. **The treatment** is the Monster/Minion card shell, chosen over §6.1's other two referents because it is
   the only one already proven page-independent: `app-resource-images-card` wears that exact shell and
   already ships on all four entity detail pages, including the two §6.1 describes as having only a bare
   `<h3>` + `<ul>`. A fifth cell in the `grid-cols-4` panel grid is rejected — orphan row at two
   breakpoints, a rules paragraph in a ~230px column at `grid-cols-5`, and **no referent at all on
   Location, Bystander or Mystery**, which have no such grid. A design whose shape is "grid cell" cannot be
   one treatment across five pages.
2. **No `mode` input.** The card is presentational and emits intents; immediate-versus-staged is what the
   *host* does with the events — the `app-resource-images-card` contract exactly. One component, nine call
   sites, nothing for two modes to drift apart on.
3. **Row edit, and the shipped focus contract that comes with it.** Pencil loads the row into the same
   form (`Editing "…"` heading, `Save Changes` + `Cancel`, `bg-accent-subtle border-accent` row,
   `EDITING` micro-label) — the wizard composer's pattern at a different density. Focus moves to the form
   heading on edit and restores to the row's pencil on save/cancel, which **requires stable keys, not
   `track $index`**: under index tracking the restore target is still `isConnected` while belonging to a
   different row, so focus lands on the wrong move with no error.
4. **`description` renders `whitespace-pre-wrap`, inline, in full** — no clamp, no disclosure. A custom
   move's body is mechanics with roll outcomes on their own lines; without pre-wrap they collapse. A
   truncated body with no expander is a lie about the content, and this card is the authoring surface.
5. **The wizard does not get the card.** Its composers get a hand-written fifth panel matching their four
   neighbours (bordered in the monster composer, `bg-surface-sunken` in the minion one — match the local
   neighbour, not the other composer), add/remove only, no row edit. Rule: **share across pages of the same
   density; copy across densities.** Precedent is unambiguous — attacks/powers/armors/weaknesses exist on
   detail pages, create pages *and* the wizard composers, hand-written in all three.
6. **The mystery's own moves are wizard step `0-4`**, after Countdown, written in `submitPhase0`'s existing
   post-id stage beside `upsertCountdown` — which is already a sub-resource upserted against `mystery.id`
   in a second call. The tracker dot means **"has content"** (`drafts().length > 0`), uniformly with all
   eight existing dots.
7. **The four create pages converge on one partial-failure string**, verbatim as shipped:
   *"{Entity} created, but some details may not have saved. Review them on the {entity} page."* The four
   detail-page strings do **not** change.
8. **`core/custom-moves.ts` sets `SUPPRESS_ERROR_TOAST` on all four methods**, mirroring
   `core/resource-images.ts`'s `inlineErrorContext()`.

## Why

**The copy change is a correctness fix, not a tidy-up — and §6.3 miscounted the strings.** There are *two*
shipped create strings, not one: Monster/Minion say *"some details"*, Location/Bystander say
*"some of its mysteries"* (`location-create.ts:106`, `bystander-create.ts:106`). Under §2.10 a custom-move
`POST` joins the same post-create `forkJoin` and the same combined failure flag, so *"some of its
mysteries"* becomes **false by omission** — a user whose custom move failed and whose memberships landed is
told to check their mysteries. The surviving string is **not reworded**: the hedge exists because `forkJoin`
reports that one call failed, never that all did, and that information gap is unchanged by this work.
*"Details"* is deliberately a category word; an enumeration grows with every sub-resource and goes stale
silently.

**The recovery path is the control, not a sentence** — the same ruling as the membership case, and cheaper
here. `customMoves` is embedded in the detail response (decision 2), so the card's **first paint is server
truth** with no refetch and no spinner. Nothing is carried over from the create page: no draft hand-off, no
"re-add the 3 that failed" banner. Two lists to reconcile is worse than one correct list whose add-form is
already the retry control. What makes *"review them on the monster page"* an instruction rather than a
riddle is that the create page and the detail page are **the same card in the same position with the same
controls**.

**Row edit is forced by the data, not by taste.** `PUT` exists, §6.2 requires all four verbs, and a custom
move is the one sub-resource whose body is a paragraph of rules text — the content you most want to fix
rather than re-enter. It is also what makes the recovery path work: a card that can only add and delete
cannot repair a move that saved with a truncated description.

**Disagreement with §2.12 item 2 / R11, stated in §13.8 rather than edited into Yoshi's text.** They say
two-step *"makes the mystery wizard harder than inlining would have"*. For the wizard the opposite holds,
because **the wizard has no one-shot path to begin with**: every entity in it is create-or-update followed
by a per-collection `applySubResourceDiff` against a hydrated per-row baseline, at a phase transition.
`sub-resource-diff.ts` is a generic owner-keyed upsert engine already shipped and tested, and
`CustomMoveResponse`/`UpsertCustomMoveRequest` drop into it with **no adaptation** — `monsterPowerService`
is already the adapter for a record of exactly that shape. Because §2.9's client service is parameterised by
owner type, this is the first adapter in the codebase needing **no per-owner twin**. Inlining into
`UpsertMonsterRequest` would instead have given the wizard a *second* write path for one of five sibling
collections, and on an edit-mode re-save that body would carry whole-collection semantics — deleting and
recreating every move on every phase transition, the exact churn Phase 5a existed to remove. §2.10 is
*better* for 5e than the alternative.

**But the real wizard cost is not where §6.3 puts it, and the risk register should be re-pointed.** Monster
and minion are nearly free (one draft array, one baseline, one `toNamedDraft` call reused unchanged, one
diff entry, one `rekeyDrafts` line, one panel, one dossier block — no new stage). The expensive domains are
the ones §6 treats as easy:

- `submitPhase2`/`submitPhase3` are **flat single-stage `forkJoin`s** with no per-row baseline, backfilling
  ids by position. A wizard-authored location's moves need the second stage phase 1 already has, and with a
  per-row baseline comes the H2 hazard (refresh ids without baselines → every later submit deletes and
  recreates the lot).
- **`attachLocation` stops being request-free.** It builds a complete draft from the catalogue list item
  with zero HTTP calls, because `LocationListItemResponse` carries everything `LocationDraft` needs.
  `CustomMoves` is on `LocationDetailResponse` and **not** on the list item, and §6.5 rules out widening
  list projections — so attach becomes a `getById`, and the location/bystander attach strips must grow the
  monster strip's spinner/disabled/error treatment plus `Next` disabled while in flight.

Both are costs of *those phases never having had a sub-resource*, not of the two-step decision; they would
exist identically under inlining. Hence the recommended split: **5e-0** restructures phases 2/3 to phase 1's
shape as a provable no-op (empty diffs short-circuit, so the existing exact-call-ledger specs are the gate),
then 5e-1 mystery, 5e-2 monster/minion, 5e-3 locations/bystanders + attach strips.

**Scope cut considered and rejected:** wizard locations/bystanders without moves. A Keeper who builds a
location *inside* the mystery would silently lose an affordance they have on `/locations/create`, and the
wizard is the primary authoring path for those two domains. Two surfaces for one entity with different
capabilities generates "why doesn't it work here?" forever.

**Two smaller corrections to §6.** `pendingRemovals` is **not** in custom moves' blast radius — it is for
roster *entities* with a Detach/Delete disposition; a sub-resource row removed in a composer is already
deferred by construction through the diff's delete bucket. And §2.10's *"one more `runBatch` arm inside an
existing `forkJoin`"* is true for Monster and Minion only: `location-create.ts:12-20` states in its own
words that the page has no draft arrays and no batched sub-resource submit, so there the draft list, panel,
batch arm and combined failure flag are all first-of-kind.

## Consequences

- **`mystery-detail` gains its first page-local write surface.** It has no form, no mutation state, no
  inline error surface and no `<app-confirm-delete-modal>` today; its only control is *Continue in wizard*.
  Raised as an open question with a recommendation to **make it editable** — the wizard is the authoring
  surface and the detail page is the table surface, and a custom move is precisely what a Keeper improvises
  mid-session. Countdown is the honest counter-example, which is why it is a question.
- **The generic interceptor toast would otherwise undercut the hedged copy.** `httpErrorInterceptor` fires
  *"Request failed (500) for POST /api/monsters/{guid}/custom-moves"* — the carefully vague caveat and the
  brutally precise one, in one toast stack. `SUPPRESS_ERROR_TOAST` on the new service closes it; the four
  existing create-batch sub-resource types have the defect today and are flagged, not swept.
- **`monster-create.html:32-35`'s explanatory line must grow a fifth noun** — *"Attacks, powers, armors and
  weaknesses added below are saved together with the monster…"* is the only place the staged-write model is
  explained to the user, and Location/Bystander create need the sentence introduced.
- **The dossier is an unlisted consumer.** Three new blocks (Mystery section, monster and minion composer
  previews). A collection missing from the dossier reads to the user as a collection that did not save.
- **Phase 6's parity spec gets cheaper for the nine card sites** (one component — assert `ownerType`,
  `emptyText`, event wiring) and **no cheaper for the wizard**, whose panels are hand-written per composer.
  It should also assert the card is **not** a child of the four-panel grid, and assert the converged copy.
- Card placement is **last** on monster/minion and **mid-page** on mystery. Not drift: each page's own
  existing roster-versus-sub-resource order already disagrees, and `location-detail.html:11-16` /
  `bystander-detail.html:11-16` already record *"Custom Moves stays below the form as an owned
  sub-resource"*. Written down so nobody "fixes" one page into inconsistency with itself.
- Pre-existing defects flagged, not swept: the eight sibling description lines have no
  `whitespace-pre-wrap`, so a multi-line power description already collapses; and
  *"review them on the {entity} page"* points below the fold, which a fragment cannot fix today because
  `app.config.ts` has no `withInMemoryScrolling`, so `anchorScrolling` is off.
- Row edit is withheld from the wizard composers **so custom moves is not the odd one out**, with a
  follow-up to bring it to all five wizard collections together if anyone asks.
