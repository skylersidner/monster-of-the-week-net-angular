### 2026-08-06: Standalone Creation Phase 3 LC-2 + LC-4 — `LocationFormComponent` Extraction and Detail Rewire
**By:** Luigi (Frontend Developer)

**What:** Extracted `location-detail.ts`'s inline core-fields form into a new shared presentational component at `features/locations/shared/location-form/` (`location-form.ts` + `.html` + `.spec.ts`), and rewired `location-detail.ts`/`.html` to consume it, per `docs/updates/standalone-creation-phase3-locations.md` decisions 4-6 and 12. Third domain after Monster (SC-2/SC-4) and Minion (MC-1/MC-3); same shape, same conventions. The read-only custom-moves list on the detail page is untouched — `git diff` on `location-detail.html` is a single hunk, the core-fields block only.

Public interface, locked for LC-3's create page to consume:

```
@Input() locationTypes: TypeRefResponse[] = []
@Input() location: LocationDetailResponse | null = null   // null = create mode
@Input() isSaving = false
@Input() submitLabel = 'Save Location'
@Output() readonly save = new EventEmitter<UpsertLocationRequest>()
```

Selector `app-location-form`. Public field `locationForm` (the internal `FormGroup`) and public method `onSubmit()` are exposed for spec use; callers should not drive them. The component never calls `LocationService`, and never sees `mysteryId` (decision 6 — the mystery picker is a create-page sibling control, and `UpsertLocationRequest` has no `mysteryId` field).

**Why / judgment calls:**

1. **`locationTypeId` keeps its `Validators.required`** — carried over field-for-field from `location-detail.ts`, per decision 5 and the plan's explicit "preserve, don't fix" wording. This is a real behavioural difference from `MonsterFormComponent`/`MinionFormComponent`, whose type controls have no required validator. Documented in the component's own doc comment so a future reader doesn't "harmonise" it away, and pinned by a dedicated spec (`treats a blank locationTypeId as invalid, unlike the monster and minion forms`). Practical consequence for LC-3: the create page's submit is blocked until a Location Type is picked, unlike Monster's/Minion's create pages.

2. **Template markup taken verbatim from `location-detail.html`, not from `minion-form.html`.** Location's block is a single-column `max-w-[30rem]` stack (no `grid-cols-[2fr_1fr_1fr]` row, no harm-capacity field) and the field order is Name / Description / Location Type — Description sits *between* the two, where Monster's and Minion's put it last. Copying either sibling's markup would have been a silent visual restyle of a page this task isn't meant to touch. `max-w-[30rem]` moved onto the component's own `<form>`, so the width constraint travels with the component rather than staying behind on the page.

3. **No `.scss` file**, same rule as both prior extractions: the block is inline Tailwind token utilities only, and `features/locations/` has no `.scss` for the detail page at all. `host: { class: 'block' }` in metadata so the custom element doesn't default to `display: inline` and break the `my-4` margins / `max-w-[30rem]`.

4. **Dropped both `ReactiveFormsModule` and `CustomSelectComponent` from `location-detail.ts`'s `imports`.** Unlike Minion (which kept `ReactiveFormsModule` for its 4 sub-resource forms), Location's detail page has *no* other form after the extraction — the custom-moves list is read-only markup. Both imports became genuinely unused, so both went, along with `FormBuilder`/`Validators` and the page's `toNullable()` helper (Location's page has no other payload to build, so unlike the Monster/Minion extractions there is no duplicated copy left behind — the helper now lives only in the component).

5. **Guard split along the ownership line, same as both priors.** `if (this.form.invalid || !this.location())` → form validity moved into the component (`markAllAsTouched()` + early return, no emit); `!this.location()` stayed on the page, since it would wrongly block create mode.

6. **Both `form.reset(...)` call sites deleted, not re-plumbed** — initial load and post-save. The page already does `this.location.set(location)` in both; the new object reference flows down `[location]` and `ngOnChanges` repopulates.

7. **`location: null` actively clears the form** rather than skipping population, so LC-3 can bind `[location]="null"` and a reused instance can never leak stale values.

**Verification:** `npm run build` clean (same 2 pre-existing component-style budget warnings: `mystery-create.scss`, `custom-select.component.scss`). `npm run test -- --watch=false`: 34 files / 217 tests passed, 0 skipped (200 → 217: 12 new in `location-form.spec.ts`, 5 net new in `location-detail.spec.ts`). LC-3 deliberately not started. Not verified live against the API this round.
