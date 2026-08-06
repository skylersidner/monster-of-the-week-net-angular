### 2026-08-05: Standalone Creation Phase 2 MC-1 + MC-3 — `MinionFormComponent` Extraction and Detail Rewire
**By:** Luigi (Frontend Developer)

**What:** Extracted `minion-detail.ts`'s inline core-fields form into a new shared presentational component at `features/minions/shared/minion-form/` (`minion-form.ts` + `.html` + `.spec.ts`), and rewired `minion-detail.ts`/`.html` to consume it, per `docs/updates/standalone-creation-phase2-minions.md` decisions 2-4 and 11. The 4 sub-resource panels (attacks/powers/armors/weaknesses) on the detail page were left byte-for-byte untouched (decision 7) — `git diff` on `minion-detail.html` is a single hunk, the core-fields block.

Public interface, locked for MC-2's create page to consume:

```
@Input() minionTypes: TypeRefResponse[] = []
@Input() minion: MinionDetailResponse | null = null   // null = create mode
@Input() isSaving = false
@Input() submitLabel = 'Save Minion'
@Output() readonly save = new EventEmitter<UpsertMinionRequest>()
```

Selector `app-minion-form`. Public field `minionForm` (the internal `FormGroup`) and public method `onSubmit()` are exposed for spec use; callers should not drive them. The component never calls `MinionService`, and never sees `monsterId` (decision 4 — it isn't on `UpsertMinionRequest` at all).

**Why / judgment calls:**

1. **Mirrored `MonsterFormComponent` structurally, but took the template markup verbatim from `minion-detail.html`, not from `monster-form.html`.** The two blocks are near-identical but not byte-identical: Minion's uses `w-full` on inputs where Monster's uses `font-[inherit]`, its grid is `grid-cols-[2fr_1fr_1fr]` (3 fields, no archetype) vs Monster's `[2fr_1fr_1fr_1fr]`, and its submit button lacks Monster's `disabled:cursor-not-allowed disabled:opacity-70`. Copying Monster's markup would have been a silent visual change on a page this task isn't meant to restyle; the class-level inconsistency between the two forms is pre-existing and out of scope here.

2. **No `.scss` file.** Same rule as the Monster extraction: `minion-detail.scss` exists only for the `.action-btn` compound-state selectors, which belong to the sub-resource delete buttons and don't reach the core-fields block. `host: { class: 'block' }` in component metadata instead of a `:host { display: block }` stylesheet.

3. **Dropped `CustomSelectComponent` from `minion-detail.ts`'s `imports` array.** After the extraction the core-fields block was the page's only `app-custom-select` consumer (verified by grep across the template) — the sub-resource panels use `WeaponTagSelectComponent`. Leaving it would have been an unused import. `ReactiveFormsModule` and `Validators` stay: the 4 sub-resource forms still need them.

4. **Guard split along the ownership line, same as Monster.** `if (this.minionForm.invalid || !this.minion())` → form validity moved into the component (`markAllAsTouched()` + early return, no emit); `!this.minion()` stayed on the page as its own guard, since it would wrongly block create mode.

5. **Both `populateMinionForm()` call sites deleted, not re-plumbed** — the initial-load one and the post-save one. `minion-detail` already does `this.minion.set(minion)` in both places; the new object reference flows down `[minion]` and `ngOnChanges` repopulates. Same mechanism as Monster; same latent caveat (it depends on the service returning a fresh object rather than mutating in place).

6. **`toNullable()` duplicated into the component.** The page still needs its own copy for all four sub-resource payloads. Three lines duplicated over a new shared util, consistent with decision 7's stance.

7. **`minion: null` actively clears the form** rather than just skipping population, so MC-2 can bind `[minion]="null"` and a reused instance can never leak stale values.

**Verification:** `npm run build` clean (same 2 pre-existing component-style budget warnings: `custom-select.component.scss`, `mystery-create.scss`). `npm run test -- --watch=false`: 32 files / 175 tests passed, 0 skipped (160 → 175: 11 new in `minion-form.spec.ts`, 4 net new in `minion-detail.spec.ts`). MC-2 deliberately not started. Not verified live against the API this round.
