# Standalone Creation SC-3 — `/monsters/new` Create Page with Local Sub-Resource Drafts

**By:** Luigi (Frontend Developer)
**Date:** 2026-08-05

## What

Implemented SC-3 from `docs/updates/standalone-creation-phase1-monsters.md` (decisions 5-14) — the last of three sub-phases. Builds on Bowser's SC-1 (`createStandalone()`) and my own SC-2/SC-4 (`MonsterFormComponent`); neither was modified.

- New `features/monsters/pages/monster-create/{monster-create.ts, monster-create.html, monster-create.spec.ts}`. The page renders `<app-monster-form [monster]="null" submitLabel="Create Monster">` for the core 5 fields, an optional `CustomSelectComponent` mystery picker bound to `MysteryService.getMysteries()`, and 4 sub-resource draft panels.
- The 4 panels hold `signal<AttackDraft[] | PowerDraft[] | ArmorDraft[] | WeaknessDraft[]>` arrays. Adding or removing a draft is purely local — zero API calls until the single page-level submit (the shared form's own button).
- `onCreate(payload)` reads the mystery picker, calls `monsterService.create(mysteryId, payload)` or `createStandalone(payload)`, `switchMap`s into a private `saveSubResourceDrafts(monsterId)` (`forkJoin` per type, `runBatch` short-circuiting to `of([])` on an empty array, weapon-tag assignment chained per created attack), then navigates to `/mysteries/:mysteryId/monsters/:newId` or `/monsters/:newId`.
- `monsters.routes.ts`: `{ path: 'new', ... }` inserted between `''` and `':monsterId/minions/:minionId'`/`':monsterId'`, with a comment recording *why* the order matters.
- `monsters-list.html`: `+ Add Monster` anchor next to the `<h2>Monsters</h2>` header.

## Judgment calls

1. **Draft interfaces mirror the `UpsertMonster*Request` contracts exactly, including `description: string | null`** — not the wizard's `description: string`. The wizard keeps the raw form string and applies `toNullable()` at submit time; here `toNullable()` is applied at *add* time, so the draft that sits in the array is already payload-shaped and `saveSubResourceDrafts` is a straight field copy with no normalization step. Decision 10 said "field-for-field mirror the `UpsertMonster*Request` contracts," and this is the reading that makes that literally true. `AttackDraft` carries one extra field the contract doesn't (`weaponTagIds: string[]`), because weapon tags are assigned through a separate call after the attack exists. No `id` field on any of the four, per decision 10.

2. **The sub-resource batch failure is caught inside the `switchMap`, not in the outer `error:` handler.** `saveSubResourceDrafts(...).pipe(map(() => ({ monsterId, draftsFailed: false })), catchError(() => of({ monsterId, draftsFailed: true })))`. This is what makes decisions 12 and 5 coexist cleanly: the outer `error:` handler is now reachable *only* by a failure of the initial create call, so it can unconditionally do the "stay on the page, keep the drafts, show an inline error" thing without needing to ask how far the flow got. Anything past the create emits `next:` and navigates either way.

3. **Error wording.** Initial-create failure: inline `Unable to create monster.` plus the same string as an error toast — byte-identical in shape to `monster-detail.saveMonster()`'s existing error path. Partial-failure toast: `Monster created, but some details may not have saved. Review them on the monster page.` — deliberately leads with the success so it doesn't read as a total failure (decision 12's explicit requirement), and points at the destination the user is about to land on.

4. **No `monster-create.scss`, despite the plan listing one.** Same call and same reasoning as SC-2's `monster-form.scss`: on this codebase a `.scss` is only earned by a compound-state selector Tailwind utilities can't express. Everything here is inline token utilities. The one place the detail page needs SCSS (`.action-btn:hover:not(:disabled)` on its trash buttons) is sidestepped by using the wizard's `×` draft-remove button instead — which is also the more honest affordance, since these rows aren't persisted yet and "delete" would overstate what's happening.

5. **Panel markup follows `monster-detail.html`, remove-button follows the wizard.** The 4-column `<article>` grid, the labelled add-forms, and the `Add Attack`/`Add Power`/... buttons are copied from the detail page so the two pages read as siblings; only the per-row remove control comes from `mystery-create-monster-phase.html`. This is literal duplication, accepted per decision 11 — the two sides' submission models genuinely differ.

6. **Button placement puts the "Create Monster" submit visually above the 4 draft panels**, because it lives inside `MonsterFormComponent` and the page otherwise mirrors `monster-detail.html`'s layout. Added a one-line hint between the form and the panels ("Attacks, powers, armors and weaknesses added below are saved together with the monster when you press Create Monster.") rather than inventing a second submit button, which decision 3/9 rules out.

7. **`+ Add Monster` reuses `mysteries-list.html`'s create-button classes verbatim** (`bg-accent hover:bg-accent-hover ... text-on-accent`) — the app already has exactly one list-page-header CTA treatment, so no new classes.

8. **Added a route-ordering unit test** (`monsters route ordering` describe block in `monster-create.spec.ts`) asserting `indexOf('new') < indexOf(':monsterId')`. Not in the plan's verification list, but the plan flags this ordering as the single thing that silently makes the page unreachable, and a comment alone doesn't survive a future reorder.

## Verification

`npm run build` clean (same 2 pre-existing component-style budget warnings: `custom-select.component.scss`, `mystery-create.scss`). `npm run test -- --watch=false`: 31 files / 160 passed, 0 skipped (30/142 → 31/160, 18 new). Route ordering re-read after the edit and confirmed. Not verified live against the API this round. `git status` confirms my diff is exactly `monsters.routes.ts`, `monsters-list.html`, and the new `pages/monster-create/` folder — `mystery-create.store.ts` and everything under `features/mysteries/` untouched.
