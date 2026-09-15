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
