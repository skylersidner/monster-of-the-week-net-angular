### 2026-09-19: Mystery Entity Linking Phase 2 — OQ9 answered (shared components where the contract is a control, agreed copies where it is a layout)
**By:** Luigi (Frontend Developer)

**What:** Rosalina's OQ9 (`mystery-entity-linking-ux.md` §12, q9) asks whether the repeated pieces of this feature become literal shared Angular components or agreed copies of one template, and scopes it as mine to settle at build time. Settled as a split, on one rule:

> **Share it when the repetition has a single data contract and no per-instance slots. Copy it when the repetition is a layout whose variation is structural.**

Applied:

- **`MysterySelectComponent` is a literal shared component** — `shared/mystery-select.component.{ts,html}`, one `ControlValueAccessor` over `string[]`, used by `LocationFormComponent` and `BystanderFormComponent` today and by the monster form in Phase 5. Its per-entity variation is exactly zero: same options type, same chip token, same sub-label, same removal mechanism. There is nothing to slot.
- **`LocationFormSubmit` / `BystanderFormSubmit` stay as two agreed copies**, not one generic `FormSubmit<T>`. They differ in the *name* of their payload key (`location` / `bystander`), which is the only thing making the emitted object readable at the call site, and a generic would buy nothing but an import.
- **The roster card and composer shell — OQ9's actual subject — should be four agreed copies, not shared components.** Phase 2 does not build them, so this half is a recommendation to whoever takes Phases 3–5, recorded now because the phase plan asked for the call to be made once.

**Why / judgment calls:**

1. **OQ9's own framing supplies the deciding evidence.** §2.5 lists four differing slots for the roster card and composer shell — badge token, secondary `<small>` line, extra composer control, sub-panels — plus a fifth in the composer core fields (the monster's archetype) and a sixth in the removal-modal variant. A shared component with six content slots is a template with extra indirection: every reader has to hold both the shell and the four call sites in their head to know what renders, which is *worse* for the consistency the design is trying to protect, not better. `MysterySelectComponent` has none of these, which is precisely why it goes the other way.

2. **The app's own precedent splits the same way.** `WeaponTagSelectComponent` and `CustomSelectComponent` are shared because they are controls with one contract. `mystery-create-*-phase.html` are copies because they are layouts. This feature does not need a third category.

3. **The consistency guarantee is real but is bought elsewhere.** §4 lists eight things that must stay identical across the four rosters. Seven of them are copy and markup, which a test can assert across four templates as cheaply as across one component — and Phase 3's stable-key and accessibility work is going to touch all four templates anyway, which is a better forcing function than a shared shell that can silently grow a fifth `@Input`.

4. **The debt is acknowledged, and §12.1 of the UX doc is already its home.** Rosalina wrote "if it goes the four-copies way, this is where the consistency debt gets logged." It has gone that way; the entry stands as written, and nothing needs adding to it.

5. **The one piece this decision deliberately does not cover** is the `runBatch` helper, which is now copied a fourth and fifth time (`location-create`, `location-detail`, `bystander-create`, `bystander-detail`, on top of `minion-create`, `monster-create` and the wizard store). It is six lines and copying it is the shipped convention, so Phase 2 copied it rather than unilaterally promoting it to `core/`. If anyone wants it promoted, that is a separate, trivially reversible call.

**Verification:** `npx ng build --configuration production` clean, with the two pre-existing component-style budget warnings (`wizard-tracker.scss`, `custom-select.component.scss`). `npm test`: 74 files / 816 tests passed, against a 74 / 799 baseline after Toad's pass. Backend untouched and still 533 passed. 25 negative controls applied and reverted, all caught.
