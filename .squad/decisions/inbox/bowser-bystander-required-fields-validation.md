# Bystander Required-Field Validation, Phase 5 (Final Domain) — Implementation Log

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-08-06
**Per:** `docs/updates/bystander-required-fields-validation.md` (Revision — Skyler's 2 Answers Resolved) + `.squad/decisions/inbox/yoshi-bystander-required-fields-validation.md`

**What:**
- `Contracts/ApiContracts.cs` (`UpsertBystanderRequest`, was line 238): added `[param: Required, MaxLength(255)]` to `Name`. This is the entire DTO change — no other field on the record needed an attribute (`Description` has no DB length cap; `BystanderTypeId` was already fully validated at the service layer, and Bystander has no numeric fields for a `[Range]` question).
- No repository/controller/entity/migration changes — per the doc, both FKs (`MysteryId` on the mystery-scoped `CreateAsync` overload, `BystanderTypeId` on all three write paths) were already `ServiceResult<T>`-wrapped and correct, live-verified by Yoshi. Didn't need to re-derive this — the doc's live verification was thorough enough to trust directly, same as Location's phase trusted its own doc.
- No `BystanderService.cs` cleanup step needed — it never had a hand-rolled blank-check to remove (unlike Minion's phase).
- `BystanderServiceTests.cs` (already existed, from Standalone Creation Phase 4's BC-1 — extended, not recreated): added the same reflection-based `GetParameterAttribute<TAttribute>(Type, string)` helper Location's phase used, with 3 `[Fact]`s (not `[Theory]`/`[MemberData]`, since Bystander has only one Name-bearing record needing this fix — `UpsertCustomMoveRequest` is shared infra already covered in `MonsterServiceTests.cs`) — `Name_RequiredAttribute_RejectsNullOrBlankValues`, `_AcceptsNonBlankValue`, `Name_MaxLengthAttribute_Is255_AndRejectsOversizedValue`. One reflection check against `UpsertBystanderRequest` covers all three write paths (mystery-scoped `CreateAsync`, standalone `CreateAsync`, `UpdateAsync`) since `[ApiController]`'s model-validation pipeline gates all three identically before the service method runs — same reasoning as every prior phase for not adding a service-layer `CreateAsync(blank name)` test.

**Confirmed this was the smallest phase of the five, tied with Location's, matching the doc's own prediction:**
- One DTO attribute, zero service/repository/controller/migration changes, zero cleanup step. No `[Range]` question (Bystander has no numeric fields). No sub-resource `Upsert*Request` types beyond the already-fixed shared `UpsertCustomMoveRequest`.

**Build/test:**
- A `dotnet run` instance (`MonsterOfTheWeek.Api.exe`, PID 29340) was live at the start of this pass — used the `-o <scratch-dir>` redirect workaround (not killing it) for both `dotnet build` and `dotnet test`, per the established gotcha from prior phases.
- Build clean (1 warning — `NETSDK1194`, an artifact of the `-o` workaround itself, not a code warning, same as every prior phase).
- 160/160 tests green (157 pre-existing + 3 new).

**This closes the backend side of the five-phase required-field-validation initiative** (Mystery, Monster, Minion, Location, Bystander). All five domains now have `[Required]`/`[MaxLength]`/`[Range]` DataAnnotations on their `Upsert*Request` DTOs where applicable, and every FK-existence check across all five services is `ServiceResult<T>`-wrapped. Luigi's frontend half (maxlength attribute + asterisk convention on `bystander-form.html`) is separate and out of scope here.

**Docs:** `docs/updates/bystander-required-fields-validation.md`, `.squad/decisions/inbox/yoshi-bystander-required-fields-validation.md`.
