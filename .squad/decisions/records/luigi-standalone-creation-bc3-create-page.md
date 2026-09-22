### 2026-08-06: Standalone Creation Phase 4 BC-3 — `/bystanders/new` Create Page, Route, Entry Point (INITIATIVE COMPLETE)
**By:** Luigi (Frontend Developer)

**What:** Built `features/bystanders/pages/bystander-create/` (`bystander-create.ts` + `.html` + `.spec.ts`, no `.scss`) per `docs/updates/standalone-creation-phase4-bystanders.md` Resolved Decisions 3, 6-9, 13. Depends on BC-1 (`BystanderService.createStandalone()`, already in tree from Bowser) and BC-2 (`BystanderFormComponent`, my own prior entry), neither modified. `bystanders.routes.ts` gains `{ path: 'new', ... }` ahead of `{ path: ':bystanderId', ... }`. `bystanders-list.html` gains a "+ Add Bystander" entry point next to the `<h2>Bystanders</h2>` header.

**This is the fourth and final sub-phase of the entire four-domain standalone-creation initiative.** Monster (Phase 1), Minion (Phase 2), Location (Phase 3), and now Bystander (Phase 4) all have a working create path reachable outside the mystery-creation wizard.

**Why / judgment calls:**

1. **No new judgment calls arose.** This page is a field-for-field mirror of `location-create.ts` (LC-3), substituting Bystander's service/types/form/routes for Location's — exactly what the plan doc predicted when it said every dimension of this phase already matched a decided prior phase. `onCreate` is a single service call: read `mysteryControl`, call `bystanderService.create(mysteryId, payload)` or `createStandalone(payload)`, navigate on success, inline+toast error on failure. No draft arrays, no batch step, matching Resolved Decision 2 (Bystander has no interactive sub-resources).
2. **Error/success notification strings** (`Unable to create bystander.` / `Bystander created.`) copied from the established per-domain pattern (`location-create.ts`'s wording, `bystander-detail.ts`'s existing `save()` error shape) rather than invented fresh.
3. **Spec again splits the create-failure case into two tests** (mystery-selected failure mocks `create`; blank-picker failure mocks `createStandalone`) — reusing the LC-3 lesson about not mocking a branch that's unreachable given the picker's current value.
4. **"+ Add Bystander" button reuses `locations-list.html`'s CTA classes verbatim** (`bg-accent hover:bg-accent-hover ... text-on-accent`), the most recent example of the app's single list-page-header CTA treatment. `bystanders-list.ts` already imported `RouterLink`, so only the template changed.
5. **No `.scss`**, consistent with every other file in `features/bystanders/`.
6. Route-ordering unit test added (`bystanders route ordering` describe block), same convention as SC-3/MC-2/LC-3.

**Verification:** `npm run build` clean (same 2 pre-existing component-style budget warnings: `mystery-create.scss`, `custom-select.component.scss`). `npm run test -- --watch=false`: 37 files / 256 tests passed, 0 skipped (245 → 256: 11 new — 10 in `bystander-create.spec.ts` plus the route-ordering test). `bystanders.routes.ts` re-read after editing to confirm `new` precedes `:bystanderId`. `git status` confirms the diff is exactly `bystanders.routes.ts`, `bystanders-list.html`, and the new `pages/bystander-create/` folder — nothing under `features/monsters/`, `features/minions/`, `features/locations/`, `mystery-create.store.ts`, or `docs/updates/multi-minion-support.md` touched.

**This closes out `docs/updates/standalone-creation-phase4-bystanders.md` and the entire standalone-creation initiative.** All four domain objects (Monster, Minion, Location, Bystander) now have a create page reachable outside the mystery-creation wizard, satisfying the initiative's stated goal end to end.
