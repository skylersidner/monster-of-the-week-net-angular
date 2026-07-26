## Learnings

- Phase 8d: wrote vitest specs for `MinionsListComponent` and `MinionDetailComponent`
- `pendingDelete` signal pattern (`requestDeleteAttack` / `onDeleteConfirmed` / `onDeleteCancelled`) replaces the old `window.confirm` approach; the existing `monster-detail.spec.ts` also had to be updated because `MonsterDetailComponent` had already migrated to this pattern but the spec had not
- Mock pattern: provide services with `useValue` returning synchronous `of(...)` observables; `forkJoin` in `ngOnInit` resolves synchronously in tests, so form is patched after first `fixture.detectChanges()`
- `MinionDetailComponent` param key is `minionId` (not `monsterId`); `ReferenceDataService` mock needs `getMinionTypes` + `getWeaponTags`
