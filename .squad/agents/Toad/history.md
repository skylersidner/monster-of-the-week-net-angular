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
