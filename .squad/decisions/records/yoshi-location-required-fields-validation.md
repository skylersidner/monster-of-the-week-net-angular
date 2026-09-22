# Location Required-Field Validation — Phase 4 of the Cross-Domain Initiative

**What:** Applied the established two-layer validation mechanism (DataAnnotations for presence/shape, `ServiceResult<T>`+`XxxExistsAsync` for FK existence — decided Phase 1, applied Phase 2/Monster and Phase 3/Minion) to Location. Full write-up: `docs/updates/location-required-fields-validation.md`.

**Findings, live-verified against the running dev API:**
- `Location.Name` has the same blank/whitespace-passes-through gap (`201` on `""`/`"   "`) and the same 300-char-name-500 every prior domain had. `[Required, MaxLength(255)]` on `UpsertLocationRequest.Name` closes both — the only DTO change this phase needs.
- Both of Location's FKs (`MysteryId` on the mystery-scoped create overload, `LocationTypeId` on all three write paths) are already correctly existence-checked and `ServiceResult<T>`-wrapped — third domain in a row (after Monster, Minion) with nothing to fix on the FK-existence half.
- `LocationService` has **no** hand-rolled blank-check anywhere (unlike Minion) — no cleanup step needed this phase.
- Location has **zero numeric fields** — no `[Range]` question this phase, structurally absent, not overlooked.
- Location has **no sub-resources beyond the already-fixed shared `UpsertCustomMoveRequest`** — live-reconfirmed that custom-move `Name` already 400s cleanly on blank/whitespace today, zero new work.
- **The one genuine divergence from Monster's/Minion's pattern:** `LocationFormComponent.locationTypeId` already carries `Validators.required` — Location does NOT have the "missing required validator on a required FK" bug both those phases found and fixed. Traced to why: `location-detail.ts`'s pre-existing form already had it before Standalone Creation Phase 3's extraction, and that phase's plan doc explicitly preserved the shape rather than harmonizing it toward Monster's/Minion's (then-buggy) precedent. Not evidence of more careful original engineering — an artifact of extraction fidelity for an unrelated reason. Flagged explicitly for whoever picks up Bystander (Phase 5) not to assume either way without checking.

**Net implementation scope — smallest of the four phases so far:** one DataAnnotations attribute (`[Required]`, `[MaxLength(255)]` pending Skyler's answer) on `UpsertLocationRequest.Name`. No repository/controller/service changes, no client-side validator fix, no `[Range]` work, no cleanup step.

**Open questions for Skyler (2, both leaning yes per 3-for-3 precedent):**
1. Bundle `[MaxLength(255)]` + `maxlength="255"` HTML with the `[Required]` fix?
2. Adopt the asterisk required-field convention on `location-form.html` (shared create/detail component) for `Name` and `Location Type`?

No `[Range]` question (no numeric fields exist) and no conditional-required-field question (no `SpecialDescription`-shaped sub-resource exists) — both structurally absent, stated explicitly rather than silently dropped.

---

## Revision — Skyler's 2 Answers Resolved (2026-08-06)

**By:** Yoshi (Architect)
**Date:** 2026-08-06

Both answered **yes**, matching the recommended lean and the 3-for-3 precedent. Implementation split two ways: **Bowser** (one DataAnnotations attribute on `UpsertLocationRequest.Name`, plus test coverage — no service/repository/controller changes, smallest backend diff of the four phases) and **Luigi** (`maxlength="255"` + asterisk convention on `location-form.html` only — no validator changes needed, the one domain where the client-side FK-validator bug never existed). Full scope in `docs/updates/location-required-fields-validation.md`'s revision section.
