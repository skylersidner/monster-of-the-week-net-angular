# Mystery Required-Field Validation — Architecture Decision

**By:** Yoshi (Architect)
**Date:** 2026-08-05

**What:**
- Field decisions: `Name` and `AdventureTypeId` should be treated as genuinely required (both are already implicitly assumed required elsewhere in the app — unguarded template interpolation of `mystery.name`, a DB-required FK — just not actually enforced end-to-end today). `Concept`, `Hook`, `Overview`, `Notes`, and all six `Countdown` stage fields stay optional, matching their existing nullable-everywhere shape and the wizard's own progressive-disclosure design.
- Recommended a two-layer validation mechanism, neither layer new to this codebase: (1) DataAnnotations (`[Required]`, optionally `[MaxLength]`) on `UpsertMysteryRequest`'s string fields, evaluated automatically by `[ApiController]`'s existing model-validation pipeline with zero `Program.cs` changes; (2) an `AdventureTypeExistsAsync` check in `MysteryService.CreateAsync`/`UpdateAsync` returning `ServiceResult<T>.Validation(...)` on failure, mirroring `MonsterService`'s existing `MonsterTypeExistsAsync`/`MonsterArchetypeExistsAsync` precedent. The second half requires widening `IMysteryService.CreateAsync`/`UpdateAsync` from raw `MysteryDetailResponse` returns to `ServiceResult<MysteryDetailResponse>`, and giving `MysteriesController` its own private `ToErrorResult`/`ToActionResult` pair (matching `MonstersController`'s/`MinionsController`'s existing per-controller, non-shared-base-class convention).
- Explicitly declined FluentValidation (unused anywhere in this codebase; would add a new dependency and a second validation idiom to solve a problem `[Required]`'s existing default behavior already solves) and a hand-rolled manual blank-check inside the service (duplicates work ASP.NET's pipeline already does one layer earlier, and blurs the existing implicit split in this codebase between syntax validation (model-binding layer) and semantic/FK validation (`ServiceResult<T>` in the service layer)).

**Why:**
- Verified empirically against the running dev API (not just read the code) that `[ApiController]`'s implicit-required inference for non-nullable reference types is *already* active and firing today with zero explicit attributes — but only catches null/missing, not blank/whitespace. Also verified live that the *existing* explicit `[Required]` precedent in this same file (`CreateAdventureTypeRequest`) already correctly rejects whitespace-only strings via `RequiredAttribute`'s default `AllowEmptyStrings=false` behavior — this is the exact, already-proven, zero-new-infrastructure mechanism the fix needs.
- Also verified live that a bad `AdventureTypeId` (a value type, so immune to the implicit-required inference that protects strings) currently produces an unhandled 500, not a clean validation error — `MysteryService` is the one domain whose top-level `CreateAsync`/`UpdateAsync` never adopted its own file's own `ServiceResult<T>` convention (`UpsertCountdownAsync`, same file, already uses it correctly).
- "Required" split into two categories that generalize to the other four domains: presence/shape of a scalar (DataAnnotations, model-binding layer) vs. existence/validity of a referenced entity (`ServiceResult<T>`, service layer, needs a DB round-trip DataAnnotations can't express). Confirmed by spot-checking `MonsterService`/`LocationService` in full and grepping `[ApiController]` across every controller that all the plumbing this pattern needs already exists and is already exercised elsewhere — no new infrastructure needed for Monster/Minion/Location/Bystander's own follow-up passes, only the same per-domain audit-and-attribute work repeated.

**Open questions left to Skyler:** bundle the `Concept` 500-char `[MaxLength]` fix into the same change as the `Name`/`AdventureTypeId` fix, or keep it separate (my lean: bundle — same file, same mechanism, cheap); should `Notes` get a real UI surface or stay deliberately unreachable (my lean: no strong opinion, reads as a product backlog item); should a Mystery be blockable from "completeness" with all six Countdown stages blank (my lean: no, leave fully optional — matches the wizard's existing progressive-disclosure design); should the `AdventureTypeId`/`ServiceResult<T>` retrofit ship in the same PR as the `Name` fix or separately (my lean: same PR — found together, the FK gap is a small, well-precedented change).

**Docs:** `docs/updates/mystery-required-fields-validation.md`.

---

## Revision — Skyler's 4 Answers Resolved (2026-08-06)

**By:** Yoshi (Architect)
**Date:** 2026-08-06

All 4 open questions resolved, all matching the original recommended lean: bundle the `Concept` `[MaxLength(500)]` fix into the same change; leave `Notes` without a UI surface (backlog item); leave Countdown stages fully optional (no completeness gate); ship the `AdventureTypeId`/`ServiceResult<T>` retrofit in the same PR as the `Name` fix. No scope changes — implementation scope is now unconditional (see revision section in `docs/updates/mystery-required-fields-validation.md`). Backend-only change; hand off to Bowser.
