### 2026-09-19: Partial-Failure Copy on the Entity Create/Detail Pages — Match the Shipped `monster-create` Pattern, and the Copy Ships With Its Behaviour

**By:** Rosalina (Designer)

**What:** Ruled on the two error strings Luigi introduced (and flagged) in Phase 2 of mystery entity linking. **Both rejected as written.** Adopted:

- Create pages — **"Location created, but some of its mysteries may not have saved. Review them on the location page."** (bystander twin identical).
- Detail pages — **"Location saved, but some of its mysteries may not have saved. Review them below and save again."** (bystander twin identical).

Neither string may be landed as a text-only edit. Each carries a behaviour requirement, specified in `docs/updates/mystery-entity-linking-ux.md` §9.5 and owned by Luigi:

1. **Create pages:** catch the membership-batch failure (`catchError`) instead of routing it to `error:`; navigate to the detail page anyway; deliver the caveat as a toast; leave `errorMessage` null; do not also fire the success toast; and on the partial branch route to the flat `/locations/{id}`, never the mystery-scoped URL.
2. **Detail pages:** refetch the entity (`switchMap(() => getById(id))`) on completion of both branches instead of the optimistic `map(() => ({ ...location, mysteryIds: desired }))` merge; deliver the caveat as a toast only, leaving `errorMessage` null.

Four spec files assert the old strings verbatim and will need updating with the change (`location-create.spec.ts:294-310` and its three twins). No code was edited by me.

**Why:**

- **The app already shipped this pattern.** `monster-create.ts:286-292` and `minion-create.ts:333-339` are the identical problem shape — entity created, then a non-atomic second round of writes that can fail — and read *"{Entity} created, but some details may not have saved. Review them on the {entity} page."*, caught with `catchError` so it never reaches the `error:` handler. Their own comment states the rule: *"A failure past this point must not look like a total failure."* The new strings invented a second voice for a solved problem.
- **"failed" / "could not be updated" assert something the client cannot know.** The second half is a `forkJoin` fan-out; an errored `forkJoin` proves one call failed, never that all did. With three mysteries selected and one `PUT` failing, two *are* attached while the copy says none are. The hedge is accuracy, not softness.
- **The copy was a symptom of two unaddressed failure states, not the defect itself.** On the create page, routing the partial case into `error:` leaves the user on a populated form whose only control is a Create button that produces a **duplicate entity**. On the detail page, `@else if (errorMessage())` precedes `@else if (location())` in the template, so setting `errorMessage` **unmounts the form** — the user's edits and selections are gone and there is no retry.
- **The refetch is the only fix for a live bug.** After a partial membership failure the page keeps the pre-save baseline, so a second Save recomputes `removed` and re-issues an already-applied unlink `DELETE`, which returns **404 on repeat** (Boo's correction, architecture §4.1) — failing again, permanently. Yoshi's §7.3 "treat 404 as success" rule was scoped to the wizard's `pendingRemovals` and nobody scoped it to this surface because this surface's unlink is new. Refetching resets the baseline and dissolves the loop by construction. **This is why "…and save again" cannot ship before the refetch does.**
- **"Which mysteries failed?" is answered by the control, not by a sentence.** Refetching makes the membership picker re-render with server truth, which beats enumerating failed mystery names (no name lookup, no list formatting, no plural handling) and leaves the retry action where the user already is.

**Not adopted:** a warning severity for the caveat. `NotificationKind` is `'success' | 'error'` only (`core/notifications.ts:3`) and `monster-create` already spends `.error()` on a success-with-caveat. Keep that; do not add a third kind for this.

**Follow-ups, deliberately out of this change set** (both recorded in §9.5.3): the `@else if (errorMessage())` page-wipe affects all four `*-detail.html` pages and needs its own scoped sweep alongside the §8 a11y work; and the create pages render a working-looking form with an empty type dropdown when reference data fails to load, since there is no `isLoading` guard around `<app-location-form>`.

**Docs:** `docs/updates/mystery-entity-linking-ux.md` §9.5 (new: 9.5.1 create copy, 9.5.2 detail copy + refetch, 9.5.3 full failure-state table), header status line.
