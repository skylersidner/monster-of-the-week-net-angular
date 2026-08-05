### 2026-08-05: Standalone Creation SC-2 + SC-4 — `MonsterFormComponent` Extraction and Detail Rewire
**By:** Luigi (Frontend Developer)

**What:** Extracted `monster-detail.ts`'s inline core-fields form into a new shared presentational component at `features/monsters/shared/monster-form/` (`monster-form.ts` + `.html` + `.spec.ts`), and rewired `monster-detail.ts`/`.html` to consume it, per `docs/updates/standalone-creation-phase1-monsters.md` decisions 1-4 and 15. The 4 sub-resource panels (attacks/powers/armors/weaknesses) on the detail page were left byte-for-byte untouched (decision 11).

Public interface, locked for SC-3's create page to consume:

```
@Input() monsterTypes: TypeRefResponse[] = []
@Input() monsterArchetypes: MonsterArchetypeResponse[] = []
@Input() monster: MonsterDetailResponse | null = null   // null = create mode
@Input() isSaving = false
@Input() submitLabel = 'Save Monster'
@Output() readonly save = new EventEmitter<UpsertMonsterRequest>()
```

Selector `app-monster-form`. Public field `monsterForm` (the internal `FormGroup`) and public method `onSubmit()` are exposed for spec use; callers should not drive them.

**Why / judgment calls:**

1. **No `.scss` file was created.** The plan listed `monster-form.scss` as conditional ("if needed"). The extracted block uses only inline Tailwind token utilities; `monster-detail.scss`'s only rules are the `.action-btn` compound-state selectors, which belong exclusively to the sub-resource delete buttons and do not reach the core-fields block. Adding an empty/near-empty `.scss` would have been dead weight and would have pushed another file toward the component-style budget warnings.

2. **Host is `class: 'block'`** (metadata, matching `WeaponTagSelectComponent`), not a `:host { display: block }` rule in a stylesheet. Without it the custom element defaults to `display: inline`, which makes the `my-4` margins on the inner `<form>` behave inconsistently. This keeps rendering identical to before with zero CSS files.

3. **`@Input()`/`@Output()` decorators, not signal inputs.** The plan specifies `ngOnChanges`-driven repopulation, and every other component-with-inputs in this codebase (`CustomSelectComponent`, `WeaponTagSelectComponent`, `ConfirmDeleteModalComponent`, `DomainIconComponent`) uses decorators. Signal `input()`/`output()` appear nowhere in the app yet — introducing them here would be a new pattern in a file whose whole point is matching existing convention.

4. **`monster: null` actively clears the form**, it doesn't just skip populating. `ngOnChanges` resets to blank defaults whenever the input changes to `null`, so a caller that reuses one instance across create/edit states never leaks stale values. The create page can simply bind `[monster]="null"`.

5. **The `!this.monster()` half of the old `saveMonster()` guard stayed on the page, not in the component.** The original guard was `if (this.monsterForm.invalid || !this.monster())`. Form validity is the component's concern (moved); "is there a monster loaded to update" is a page concern and would be wrong in create mode, so `monster-detail.saveMonster(payload)` keeps `if (!this.monster()) return;` and the component emits only on `monsterForm.valid`.

6. **`populateMonsterForm()` after a successful save was deleted, not re-plumbed.** `monster-detail`'s save handler already does `this.monster.set(monster)`; that new object flows back down through `[monster]` and `ngOnChanges` repopulates. One less call site, and it is the same mechanism the initial load uses.

7. **`toNullable()` now exists in both files.** The component needs it for `description`; the page still needs it for all four sub-resource payloads. Three lines duplicated rather than creating a shared util module for one helper — consistent with decision 11's stance that a little literal duplication beats new coupling.

**Verification:** `npm run build` clean (same 2 pre-existing component-style budget warnings). `npm run test -- --watch=false`: 30 files / 142 tests passed, 0 skipped (126 → 142: 10 new `monster-form.spec.ts`, 6 net new in `monster-detail.spec.ts`). `git diff` on `monster-detail.html` confirms the only changed hunk is the core-fields block.
