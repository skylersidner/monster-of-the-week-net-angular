# Location Required-Field Validation, Phase 4 — Implementation Log

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-08-06
**Per:** `docs/updates/location-required-fields-validation.md` (Revision — Skyler's 2 Answers Resolved) + `.squad/decisions/inbox/yoshi-location-required-fields-validation.md`

**What:**
- `Contracts/ApiContracts.cs` (`UpsertLocationRequest`, was line 216): added `[param: Required, MaxLength(255)]` to `Name`. This is the entire DTO change — no other field on the record needed an attribute (`Description` has no DB length cap; `LocationTypeId` was already fully validated at the service layer).
- No repository/controller/entity/migration changes — confirmed by reading `LocationService.cs`/`LocationsController.cs` in full before touching anything: both FKs (`MysteryId` on the mystery-scoped `CreateAsync` overload, `LocationTypeId` on all three write paths) are already `ServiceResult<T>`-wrapped and correct, matching Yoshi's live-verified audit exactly.
- No `LocationService.cs` cleanup step needed — unlike Minion, it never had a hand-rolled `IsNullOrWhiteSpace` blank-check to remove. Confirmed by reading all three write methods (`CreateAsync` x2, `UpdateAsync`) in full: nothing beyond `.Trim()` on `Name` before persisting.
- `LocationServiceTests.cs` (already existed, from Standalone Creation Phase 3's LC-1 — extended, not recreated): added the same reflection-based `GetParameterAttribute<TAttribute>(Type, string)` helper Monster's/Minion's phases established, with 3 `[Fact]`s (not `[Theory]`/`[MemberData]`, since Location has only one Name-bearing record needing this fix — `UpsertCustomMoveRequest` is shared infra already covered in `MonsterServiceTests.cs`) — `Name_RequiredAttribute_RejectsNullOrBlankValues`, `_AcceptsNonBlankValue`, `Name_MaxLengthAttribute_Is255_AndRejectsOversizedValue`. Per the doc's own framing, one reflection check against `UpsertLocationRequest` genuinely covers all three write paths (mystery-scoped `CreateAsync`, standalone `CreateAsync`, `UpdateAsync`) since `[ApiController]`'s model-validation pipeline gates all three identically before the service method runs — same reasoning Monster's Phase 2 used for deliberately not adding a service-layer `CreateAsync(blank name)` test (would incorrectly succeed against a fake repository and misrepresent where the fix actually lives).

**Confirmed this was the smallest phase of the four, matching the doc's own prediction:**
- One DTO attribute, zero service/repository/controller/migration changes, zero cleanup step. No `[Range]` question (Location has no numeric fields). No sub-resource `Upsert*Request` types beyond the already-fixed shared `UpsertCustomMoveRequest`.

**Build/test:**
- A `dotnet run` instance (`MonsterOfTheWeek.Api.exe`, PID 29340) was live at the start of this pass — used the `-o <scratch-dir>` redirect workaround (not killing it) for both `dotnet build` and `dotnet test`, per the established gotcha from prior phases.
- Build clean (1 warning — `NETSDK1194`, an artifact of the `-o` workaround itself, not a code warning, same as every prior phase).
- 157/157 tests green (154 pre-existing + 3 new).

**Docs:** `docs/updates/location-required-fields-validation.md`, `.squad/decisions/inbox/yoshi-location-required-fields-validation.md`.
