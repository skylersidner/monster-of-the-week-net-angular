### 2026-08-06: Standalone Creation Phase 4 BC-2 + BC-4 — `BystanderFormComponent` Extraction and Detail Rewire
**By:** Luigi (Frontend Developer)

**What:** Extracted `bystander-detail.ts`'s inline core-fields form into a new shared presentational component at `features/bystanders/shared/bystander-form/` (`bystander-form.ts` + `.html` + `.spec.ts`), and rewired `bystander-detail.ts`/`.html` to consume it, per `docs/updates/standalone-creation-phase4-bystanders.md` decisions 4-6 and 12. Fourth and last domain after Monster (SC-2/SC-4), Minion (MC-1/MC-3), and Location (LC-2/LC-4); same shape, same conventions. The read-only custom-moves list on the detail page is untouched — `git diff` on `bystander-detail.html` is a single hunk, the core-fields block only.

Public interface, locked for BC-3's create page to consume:

```
@Input() bystanderTypes: TypeRefResponse[] = []
@Input() bystander: BystanderDetailResponse | null = null   // null = create mode
@Input() isSaving = false
@Input() submitLabel = 'Save Bystander'
@Output() readonly save = new EventEmitter<UpsertBystanderRequest>()
```

Selector `app-bystander-form`. Public field `bystanderForm` (the internal `FormGroup`) and public method `onSubmit()` are exposed for spec use; callers should not drive them. The component never calls `BystanderService`, and never sees `mysteryId` (decision 6 — the mystery picker is a create-page sibling control, and `UpsertBystanderRequest` has no `mysteryId` field).

**Why / judgment calls:**

1. **`bystanderTypeId` keeps its `Validators.required`** — carried over field-for-field from `bystander-detail.ts`, per decision 5 and the plan's explicit "preserve, don't fix" wording. Matches `LocationFormComponent`; differs from `MonsterFormComponent`/`MinionFormComponent`, whose type controls have no required validator. Documented in the component's doc comment and pinned by a dedicated spec (`treats a blank bystanderTypeId as invalid, unlike the monster and minion forms`). Practical consequence for BC-3: the create page's submit is blocked until a Bystander Type is picked.

2. **Template markup taken verbatim from `bystander-detail.html`, not from a sibling form component.** Same rule that held for the three priors. Bystander's block turned out to be identical in structure to Location's (single-column `max-w-[30rem]` stack, Description between Name and Type, same token classes), but that was confirmed by reading the page's own markup rather than assumed — the diff would have been a silent restyle otherwise. `max-w-[30rem]` moved onto the component's own `<form>` so the width constraint travels into BC-3.

3. **No `.scss` file**, same rule as all three prior extractions; `host: { class: 'block' }` in metadata so the custom element doesn't default to `display: inline` and break the `my-4` margins / `max-w-[30rem]`.

4. **Dropped `ReactiveFormsModule` and `CustomSelectComponent` from `bystander-detail.ts`'s `imports`**, plus `FormBuilder`/`Validators` and the page's `toNullable()` helper — same call as Location's, for the same reason: after the extraction the page's only remaining content is the read-only custom-moves markup, so all of them are genuinely unused. No duplicated `toNullable()` left behind; it lives only in the component.

5. **Guard split along the ownership line, same as all three priors.** `if (this.form.invalid || !this.bystander())` → form validity moved into the component (`markAllAsTouched()` + early return, no emit); `!this.bystander()` stayed on the page, since it would wrongly block create mode.

6. **Both `form.reset(...)` call sites deleted, not re-plumbed** — initial load and post-save. The page already does `this.bystander.set(bystander)` in both; the new object reference flows down `[bystander]` and `ngOnChanges` repopulates.

7. **`bystander: null` actively clears the form** rather than skipping population, so BC-3 can bind `[bystander]="null"` and a reused instance can never leak stale values.

**Verification:** `npm run build` clean (same 2 pre-existing component-style budget warnings: `custom-select.component.scss`, `mystery-create.scss`). `npm run test -- --watch=false`: 36 files / 245 tests passed, 0 skipped (228 → 245: 12 new in `bystander-form.spec.ts`, 5 net new in `bystander-detail.spec.ts`). BC-3 deliberately not started. Not verified live against the API this round.
