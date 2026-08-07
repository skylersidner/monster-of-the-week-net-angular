# Minion Required-Field Validation, Phase 3 — Implementation Log

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-08-06
**Per:** `docs/updates/minion-required-fields-validation.md` (Revision — Skyler's 6 Answers Resolved) + `.squad/decisions/inbox/yoshi-minion-required-fields-validation.md`

**What:**
- `Contracts/ApiContracts.cs`: `[param: Required, MaxLength(255)]` on `Name` for `UpsertMinionRequest`, `UpsertMinionAttackRequest`, `UpsertMinionPowerRequest`, `UpsertMinionArmorRequest`, `UpsertMinionWeaknessRequest`. `[param: Range(0, int.MaxValue)]` on `UpsertMinionRequest.HarmCapacity`, `UpsertMinionAttackRequest.Harm`, `UpsertMinionArmorRequest.HarmSoak`. `UpsertCustomMoveRequest` untouched (already fixed in Phase 2, shared cross-domain DTO).
- `Services/MinionService.cs`: removed the hand-rolled `if (string.IsNullOrWhiteSpace(request.Name)) return ServiceResult<MinionDetailResponse>.Validation("Name is required.");` from both `CreateAsync` and `UpdateAsync`.
- No repository/controller/migration changes — both FKs (`MonsterId`, `MinionTypeId`) confirmed already correctly `ServiceResult<T>`-wrapped, matching Yoshi's live-verified audit.
- `MinionServiceTests.cs` (existed already, extended not recreated): added the same reflection-based `[Theory]`/`[MemberData]` pattern `MonsterServiceTests.cs` established — `Name_RequiredAttribute_RejectsNullOrBlankValues`/`_AcceptsNonBlankValue`/`Name_MaxLengthAttribute_Is255_AndRejectsOversizedValue` across the 5 `Name`-bearing records, `HarmField_RangeAttribute_RejectsNegativeValues` across the 3 harm-int records. Deliberately did not add `UpsertCustomMoveRequest` to the theory list here — already covered in `MonsterServiceTests.cs` during Phase 2, no reason to duplicate.

**Why removing the hand-rolled check was safe (verified, not assumed):**
- Grepped every call site of `IMinionService.CreateAsync`/`UpdateAsync` across the whole `src/api` tree. Only two callers exist: `MinionsController.Create`/`Update` (both `[FromBody] UpsertMinionRequest request` under `[ApiController]` on the controller class — model validation runs and short-circuits to 400 before the action body executes) and `MinionServiceTests.cs` itself (deliberately bypasses model binding by calling the service directly — that's a test concern, not a production code path). No internal/background/other-service call path reaches these methods. Confirmed `[ApiController]` attribute present on `MinionsController` directly (not inherited only) before relying on the implicit-model-validation behavior. This matches Yoshi's claim exactly — the hand-rolled check was genuinely dead code once `[Required]` landed on the DTO, safe to delete.

**Build/test:**
- A `dotnet run` instance (`MonsterOfTheWeek.Api.exe`, PID 32692) was live at the start of this pass — used the `-o <scratch-dir>` redirect workaround (not killing it) for both `dotnet build` and `dotnet test`, per the established gotcha from prior phases.
- Build clean (1 warning — `NETSDK1194`, an artifact of the `-o` workaround itself, not a code warning, same as Monster phase).
- 154/154 tests green (136 pre-existing + 18 new).

**Docs:** `docs/updates/minion-required-fields-validation.md`, `.squad/decisions/inbox/yoshi-minion-required-fields-validation.md`.
