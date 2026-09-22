### 2026-08-06: Required-Field Validation — Bystander (Phase 5, Final Domain)
**By:** Yoshi (Architect)

**What:** Applied the initiative's established two-layer validation mechanism (DataAnnotations for presence/shape, `ServiceResult<T>`+`XxxExistsAsync` for FK existence) to Bystander, the fifth and final domain. Live-verified against the running dev API (`docker compose` + `dotnet run`, both already up): blank/whitespace `Name` passes today (`201`, persists `""`); a 300-char `Name` 500s (DB `HasMaxLength(255)`); `BystanderTypeId` FK-existence checks (`MysteryExistsAsync`, `BystanderTypeExistsAsync`) are already fully correct on all three write paths, never 500; the shared `UpsertCustomMoveRequest` fix from Phase 2 already protects Bystander's custom-move endpoints for free. Net backend scope: one attribute — `[Required, MaxLength(255)]` on `UpsertBystanderRequest.Name` — no service/repository/controller changes, no cleanup step, no `[Range]` question (no numeric fields), no client-side FK-validator fix needed.

**Why:** Bystander's shape matches Location's in every dimension (M:N-to-Mystery, no sub-resources, no numeric fields, no hand-rolled service check) — independently re-verified rather than assumed from the resemblance, per Location's own closing-note instruction. Confirmed live: `bystanderTypeId` already carries `Validators.required` in both `BystanderFormComponent` and the wizard's `addBystanderForm` — the second domain (after Location) of five where the missing-FK-validator bug class (found in Monster and Minion) does not recur, traced to the same extraction-fidelity cause Location's phase found (the pre-existing detail-page form already had the validator; the standalone-creation extraction preserved it rather than harmonizing toward Monster's/Minion's buggy precedent).

**Open questions for Skyler (2):** (1) bundle `[MaxLength(255)]`+`maxlength="255"` HTML with the `[Required]` fix — 5th time asking, 4/4 "yes" so far, my lean yes; (2) adopt the asterisk required-field convention on `bystander-form.html` — 4th time asking, 3/3 "yes" so far, my lean yes.

**Closes the initiative.** Cross-domain result, all five phases: blank/whitespace-`Name` and oversized-`Name`-500 gaps recurred in every domain (always fixed the same way); FK-existence was already correct in 4/5 domains pre-initiative (only Mystery needed a `ServiceResult<T>` retrofit); only Minion had a hand-rolled service-layer check to remove; missing client-side FK validator recurred in exactly 2/5 domains (Monster, Minion — not Mystery [no separate form], Location, or Bystander); numeric fields and interactive sub-resources existed in exactly 2/5 domains (Monster, Minion). Every variance has a traced, non-arbitrary cause — see the doc's closing table and 7-point future-domain-audit checklist.

**Docs:** `docs/updates/bystander-required-fields-validation.md`.

---

## Revision — Skyler's 2 Answers Resolved (2026-08-06)

**By:** Yoshi (Architect)
**Date:** 2026-08-06

Both answered **yes** (5/5 and 4/4 on precedent) — no scope changes. Implementation split two ways: **Bowser** (one DataAnnotations attribute on `UpsertBystanderRequest.Name`, plus test coverage — no service/repository/controller changes) and **Luigi** (`maxlength="255"` + asterisk convention on `bystander-form.html` only — no validator changes needed). This is the final implementation step of the five-phase initiative.
