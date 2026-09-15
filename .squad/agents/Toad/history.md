## Learnings

- Phase 8d: wrote vitest specs for `MinionsListComponent` and `MinionDetailComponent`
- `pendingDelete` signal pattern (`requestDeleteAttack` / `onDeleteConfirmed` / `onDeleteCancelled`) replaces the old `window.confirm` approach; the existing `monster-detail.spec.ts` also had to be updated because `MonsterDetailComponent` had already migrated to this pattern but the spec had not
- Mock pattern: provide services with `useValue` returning synchronous `of(...)` observables; `forkJoin` in `ngOnInit` resolves synchronously in tests, so form is patched after first `fixture.detectChanges()`
- `MinionDetailComponent` param key is `minionId` (not `monsterId`); `ReferenceDataService` mock needs `getMinionTypes` + `getWeaponTags`

## 2026-09-11 — Hunter bespoke: move-level repeatable section gap (failing test for Bowser)

- `HunterServiceTests` is NOT mocked: real in-memory SQLite `Harness`, one shared `SeedPlaybook()` fixture with fixed Guids; runs without Postgres. Scope: `dotnet test <Api.Tests.csproj> --filter "FullyQualifiedName~...HunterServiceTests"`
- Adding a section to `SeedPlaybook()` can break exact-list `Outstanding` asserts: tests take `PickableMoveId`, so put new move-level sections on `OtherMoveId` (completeness skips sections of untaken moves)
- `ValidateBespoke`'s move-ownership check lives only in `ValidateSelectionScope` (per selection). An instance with `Selections: []` for a move-owned repeatable section skips it. Real form sends exactly that when a free-text instance's "Details" box is blank (`collectSelections` omits empty text); name goes in `instance.Name`
- Seed: Searcher "Network" (0..5) and Spell-Slinger "Arcane Reputation" (3..3) are both non-required, non-advanced moves; sections have `options: []` AND `freeTextLabel` set
- Added `Entries_for_a_moves_repeatable_section_are_refused_unless_the_move_is_taken` (fails today: saved) + `..._accepted_once_the_move_is_taken` (control)

## 2026-09-14 — Hunter wizard Phase 3: Mystery wizard visual pass (shared tracker/layout)

- Browser driving works with nothing installed: `node_modules/playwright` 1.61.1 in the web app + cached Chromium 1228 in `%LOCALAPPDATA%\ms-playwright`. Scripts in scratchpad use `createRequire(<web>/package.json)` to import it
- Sign-in: `test@local.dev` in `app_users` (plaintext password). Read it into an env var via `docker exec motw-postgres psql -tA`, never echo it
- Before/after reference: `git -c core.longpaths=true worktree add --detach <scratch> HEAD` (plain add fails: Filename too long), junction `node_modules` in with `mklink /J`, `ng serve --port 4201`. Same API/cookie serves both ports. Cleanup: `rmdir` the junction BEFORE `worktree remove --force`
- Theme: `emulateMedia({ colorScheme })` drives ThemeService's 'system' preference, so mid-session theme switching needs no localStorage
- Canvas pixel diff in a blank page (data-URL images) needs no image package; element screenshots of `header.tracker` diff to 0 px when unchanged
- Scroll container is the column `main section.overflow-y-auto`; also watch `main.scrollTop` and `window.scrollY`. At 1280x600 the document is 65px scrollable in both builds (sidebar nav), so viewport resizes in a harness can shift `window.scrollY`: not a user-reachable bug
- Measure bubble colours >=350ms after a step change (0.2s background transition), or you read mid-fade rgba
- Edit mode: `phaseComplete` starts all-true, then recomputes from data, so a Mystery with no locations/bystanders gives plain clickable bubbles. Locations/Bystanders phases save with zero items. Blocked-minion error band ("Finish or clear the minion...") is a no-request way to show the error band
- Pre-existing, not Phase 3: composer attack rows overflow their card (Harm `width: 80px`) at column widths <= ~343px (identical at 768 on HEAD); light error band text 3.91:1
- Test fixture left in local DB: Mystery "Toad Phase 3 check" `6093f6b2-616c-429c-a2d7-75e1c7e89983` (monster "Toad Phase 3 monster", 2 attacks, countdown day/shadows, no minions/locations/bystanders)

## 2026-09-14 — Hunter wizard Phase 4: "before" half of the Y10 GET diff (HEAD efd5309)

- Fixtures in local DB (created via POST, form-shaped payloads): Hex `288bc75a-4460-4693-9e7c-e0a4ce3a6e46`, Curse-Eater `eacfae8a-60f0-4ace-b0ac-504bd86b2fca`, Forged `869e6136-ca7a-4996-a4e1-52649ada2e58`. All `outstanding: []`
- Scripts + raw captures: session scratchpad `phase4-diff/` (`create-hunters.mjs` once; `capture.mjs --base <url> --out <dir>` re-runnable; `compare.mjs a b` strict + order-insensitive)
- HEAD unchanged edit-page re-save: create == pre == PUT response == post-save GET, strict, all three. PUT echoes instance/journal ids; no row recreated
- API login from Node: `context.request.post('/api/auth/login', { data: { email, password } })`, no antiforgery; the cookie is host-scoped, so it works via 5225 or the 4201 proxy. DataProtection keys live in the DB, so the API runs fine from a worktree
- `GetHunterDetailAsync` has no ORDER BY on child collections: GET array order is not insertion order (stable across reads so far, not guaranteed). Instances and journal entries are ordered by SortOrder
- The form's PUT groups `bespokeSelections` by section order (playbook sections, then move sections), so the PUT order differs from the GET order. Compare PUT bodies order-insensitively, or strictly against the same build's GET
- None of Hex/Curse-Eater/Forged has a numeric bespoke option or a freeTextLabel section. Only the Forged has an in-move section (Partner, required). The numeric coverage is the Curse-Eater Corruption track
- The `hunters.updated_at` column exists in the DB but isn't in the GET, so there's no volatile field in the GET body. `ApplyTimestamps` stamps only Added/Modified rows, and HEAD's unchanged save left it at its create-time value on all three. If it moves after the after-pass save, a scalar changed

## 2026-09-14 — Hunter wizard Phase 4: "after" half of the Y10 GET diff (uncommitted HunterDraft, main tree)

- After vs before: PUT body, PUT response and post-save GET all 0 diffs strict AND order-insensitive, all three; GET == create == pre; `updated_at` still create-time. No reordering showed up at all
- Hunter specs: `npx ng test --no-watch --include "src/app/features/hunters/**/*.spec.ts"` (3 files, 43 tests, ~1.4s)
- Browser checks: `phase4-diff/checks.mjs` + `refill.mjs`. Rating hint hides on pick and returns on playbook switch (create), hides on pick (edit); picker locked; untick Network with 2 entries saves; refill; edit open = 2 playbook GETs, first `net::ERR_ABORTED`
- Harness gotcha: Angular `[value]` on a `formControlName` radio is a property, not an attribute. `getAttribute('value')` is null; read `el.checked` by index and map to `playbook.statArrayOptions` order
- Scope `section` locators to `app-hunter-form form > section`: the page's outer `<section>` also contains every h3
- Refill proof that can't pass by accident: pad the name with spaces (builder trims, input shows trimmed only if repopulated), and add a repeatable entry then save twice. Save 2 must echo save 1's server instance id
- Every playbook has 5 stat arrays with its own ids, so any create-page playbook switch clears the rating
- Fixture added: "Toad Phase 4 Searcher" `3c4a77c8-d3e9-41f6-bd36-96480fe2cd2f`. Created via the UI with no rating and Network + 2 entries; the POST omitted First Encounter and the server added it. Final state: rating index 3, Network ticked, one entry "Toad contact C" (`3c23b24e-1c5b-40a3-9252-564f4c5a79f3`)
