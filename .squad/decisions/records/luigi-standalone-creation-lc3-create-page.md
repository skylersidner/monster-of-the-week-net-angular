### 2026-08-06: Standalone Creation Phase 3 LC-3 — `/locations/new` Create Page, Route, Entry Point
**By:** Luigi (Frontend Developer)

**What:** Built `features/locations/pages/location-create/` (`location-create.ts` + `.html` + `.spec.ts`, no `.scss`) per `docs/updates/standalone-creation-phase3-locations.md` Resolved Decisions 3, 6-9, 13. Depends on LC-1 (`LocationService.createStandalone()`) and LC-2 (`LocationFormComponent`), neither modified. `locations.routes.ts` gains `{ path: 'new', ... }` ahead of `{ path: ':locationId', ... }`. `locations-list.html` gains a "+ Add Location" entry point next to the `<h2>Locations</h2>` header.

**Why / judgment calls:**

1. **This is genuinely the simplest create page across all three domains so far — no draft arrays, no batch step, no `runBatch`/`forkJoin`-per-child-type machinery**, per the plan doc's Resolved Decision 2 (Location has no interactive sub-resources at all). `onCreate` is a single service call: read `mysteryControl`, call `locationService.create(mysteryId, payload)` or `createStandalone(payload)`, navigate on success, inline+toast error on failure. No `switchMap` chain past the create call — closer in shape to `location-detail.ts`'s own `save()` than to `monster-create.ts`'s/`minion-create.ts`'s `onCreate`, exactly as the plan doc predicted.

2. **Error wording and success/error notification pattern copied verbatim from `location-detail.ts`'s existing `save()`** (`Unable to create location.` / `Location created.`), not invented fresh — same discipline as SC-3/MC-2 reusing their own detail pages' error strings.

3. **Page structure (mystery picker + `<app-location-form>`) copied from `monster-create.html`'s equivalent block**, since `LocationFormComponent` already has `MonsterFormComponent`'s exact same `@Input`/`@Output` shape (`location: null` = create, `submitLabel`, `isSaving`, `(save)`) — no adaptation needed beyond field renames.

4. **No `.scss`** — same rule as every other file in `features/locations/`: inline Tailwind token utilities only, no compound-state selector Tailwind can't express.

5. **"+ Add Location" button reuses `monsters-list.html`'s/`minions-list.html`'s CTA classes verbatim** (`bg-accent hover:bg-accent-hover ... text-on-accent`), matching the app's single list-page-header CTA treatment. `locations-list.ts` already imported `RouterLink`, so no import change needed there — only the template changed.

6. **Added a route-ordering unit test** (`locations route ordering` describe block), mirroring SC-3/MC-2's identical convention, asserting `indexOf('new') < indexOf(':locationId')`.

7. **Spec covers two separate create-failure cases** (mystery selected vs. blank) rather than one, since which service method (`create` vs `createStandalone`) gets mocked to fail depends on the mystery picker's value at call time — an easy mistake to make once (I initially wrote a test that set the picker to a mystery id but mocked `createStandalone` to fail, which would never be reached; caught and split into two correctly-targeted tests).

**Verification:** `npm run build` clean (same 2 pre-existing component-style budget warnings: `mystery-create.scss`, `custom-select.component.scss`). `npm run test -- --watch=false`: 35 files / 228 tests passed, 0 skipped (217 → 228: 11 new in `location-create.spec.ts`, plus the pre-existing `locations route ordering` describe). `locations.routes.ts` re-read after editing to confirm `new` precedes `:locationId`. `git status` confirms my diff is exactly `locations.routes.ts`, `locations-list.html`, and the new `pages/location-create/` folder — nothing under `features/monsters/`, `features/minions/`, `mystery-create.store.ts`, or `docs/updates/multi-minion-support.md` touched. This closes out LC-3; only LC-4 (already landed per the prior `luigi-location-form-component.md` entry — this doc's numbering has LC-4 listed after LC-3, but it shipped earlier in the same working tree) remains fully complete for this phase.
