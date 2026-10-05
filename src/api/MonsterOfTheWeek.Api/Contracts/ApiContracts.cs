using System.ComponentModel.DataAnnotations;

namespace MonsterOfTheWeek.Api.Contracts;

public sealed record TypeRefResponse(Guid Id, string Name, string Motivation);
public sealed record CreateTypeRefRequest(
    [param: Required, MinLength(3)] string Name,
    [param: Required, MinLength(10)] string Motivation);
public sealed record WeaponTagRefResponse(Guid Id, string Name, string? Description);
public sealed record CreateWeaponTagRefRequest(
    [param: Required, MinLength(3)] string Name,
    [param: Required, MinLength(10)] string Description);
public sealed record AdventureTypeResponse(Guid Id, string Name, string Description);
public sealed record CreateAdventureTypeRequest(
    [param: Required, MinLength(3)] string Name,
    [param: Required, MinLength(5)] string Description);
public sealed record MonsterArchetypeResponse(Guid Id, string Name, string Description);
public sealed record CreateMonsterArchetypeRequest(
    [param: Required, MinLength(3)] string Name,
    [param: Required, MinLength(5)] string Description);
public sealed record CustomMoveResponse(Guid Id, string Name, string? Description);

// Resource images — docs/resource-images/design.md §1.1/§3, phases.md Phase 3.
public sealed record ResourceImageResponse(
    Guid Id,
    string FileName,
    string ContentType,
    int SizeBytes,
    int Width,
    int Height,
    int SortOrder,
    bool IsPrimary,
    DateTimeOffset CreatedAt);

/// <summary>`reason` is the rejection enum's name as a string (e.g. `"UnsupportedType"`) — this
/// codebase has no `JsonStringEnumConverter` configured anywhere, so serializing the enum
/// itself would come out as a number; the mapper converts explicitly instead.</summary>
public sealed record RejectedResourceImageResponse(string FileName, string Reason);

/// <summary>
/// `design.md` §3's deliberately exact, not hedged, per-file upload result: every file in the
/// batch lands in exactly one of these two lists. `uploaded` can be non-empty alongside a
/// non-empty `rejected` — a batch that's 3-for-5 is a 201 with detail, not an error.
/// </summary>
public sealed record ResourceImageUploadResponse(
    IReadOnlyList<ResourceImageResponse> Uploaded,
    IReadOnlyList<RejectedResourceImageResponse> Rejected);

public sealed record MysteryListItemResponse(
    Guid Id,
    string Name,
    string? Concept,
    string? Hook,
    AdventureTypeResponse AdventureType,
    int MonsterCount,
    int LocationCount,
    int BystanderCount,
    DateTimeOffset CreatedAt);

public sealed record CountdownResponse(
    Guid Id,
    string? Day,
    string? Shadows,
    string? Sunset,
    string? Dusk,
    string? Nightfall,
    string? Midnight);

public sealed record MysteryDetailResponse(
    Guid Id,
    string Name,
    string? Concept,
    string? Hook,
    string? Overview,
    string? Notes,
    AdventureTypeResponse AdventureType,
    CountdownResponse? Countdown,
    int MonsterCount,
    int LocationCount,
    int BystanderCount,
    IReadOnlyList<CustomMoveResponse> CustomMoves,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record UpsertMysteryRequest(
    [param: Required] string Name,
    [param: MaxLength(500)] string? Concept,
    string? Hook,
    string? Overview,
    string? Notes,
    Guid AdventureTypeId);

public sealed record UpsertCountdownRequest(
    string? Day,
    string? Shadows,
    string? Sunset,
    string? Dusk,
    string? Nightfall,
    string? Midnight);

// PrimaryImageId defaults to null, not just for "no images" — the by-mystery sites that share
// this record (GetMonstersByMysteryIdAsync) are out of scope for Phase 4's derivation (phases.md
// Phase 4, Skyler's scope cut) and are deliberately left untouched; the default is what lets
// them keep compiling unchanged while the shared response shape still carries the field.
public sealed record MonsterListItemResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    int HarmCapacity,
    TypeRefResponse MonsterType,
    MonsterArchetypeResponse MonsterArchetype,
    int AttackCount,
    int PowerCount,
    int ArmorCount,
    int WeaknessCount,
    int MinionCount,
    DateTimeOffset CreatedAt,
    Guid? PrimaryImageId = null);

public sealed record MonsterAttackResponse(
    Guid Id,
    string Name,
    string? Description,
    int Harm,
    IReadOnlyList<WeaponTagRefResponse> WeaponTags);

public sealed record MonsterPowerResponse(Guid Id, string Name, string? Description);
public sealed record MonsterArmorResponse(Guid Id, string Name, string? Description, int HarmSoak, bool IsSpecial, string? SpecialDescription);
public sealed record MonsterWeaknessResponse(Guid Id, string Name, string? Description);

public sealed record MonsterDetailResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    int HarmCapacity,
    Guid MonsterTypeId,
    string? MonsterTypeName,
    MonsterArchetypeResponse MonsterArchetype,
    IReadOnlyList<MonsterAttackResponse> Attacks,
    IReadOnlyList<MonsterPowerResponse> Powers,
    IReadOnlyList<MonsterArmorResponse> Armors,
    IReadOnlyList<MonsterWeaknessResponse> Weaknesses,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertMonsterRequest(
    [param: Required, MaxLength(255)] string Name,
    string? Description,
    [param: Range(0, int.MaxValue)] int HarmCapacity,
    Guid MonsterTypeId,
    Guid MonsterArchetypeId);

public sealed record UpsertMonsterAttackRequest(
    [param: Required, MaxLength(255)] string Name,
    string? Description,
    [param: Range(0, int.MaxValue)] int Harm);
public sealed record AssignWeaponTagRequest(Guid WeaponTagId);
public sealed record UpsertMonsterPowerRequest([param: Required, MaxLength(255)] string Name, string? Description);
public sealed record UpsertMonsterArmorRequest(
    [param: Required, MaxLength(255)] string Name,
    string? Description,
    [param: Range(0, int.MaxValue)] int HarmSoak,
    bool IsSpecial,
    string? SpecialDescription);
public sealed record UpsertMonsterWeaknessRequest([param: Required, MaxLength(255)] string Name, string? Description);
public sealed record UpsertCustomMoveRequest([param: Required, MaxLength(255)] string Name, string? Description);

// See MonsterListItemResponse's note on PrimaryImageId's default — GetByMonsterIdAsync (the
// nested-under-a-monster list) is out of scope for Phase 4 and stays untouched.
public sealed record MinionListItemResponse(
    Guid Id,
    Guid MonsterId,
    string MonsterName,
    string Name,
    string? Description,
    int HarmCapacity,
    TypeRefResponse MinionType,
    int AttackCount,
    int PowerCount,
    int ArmorCount,
    int WeaknessCount,
    DateTimeOffset CreatedAt,
    Guid? PrimaryImageId = null);

public sealed record MinionAttackResponse(
    Guid Id,
    string Name,
    string? Description,
    int Harm,
    IReadOnlyList<WeaponTagRefResponse> WeaponTags);

public sealed record MinionPowerResponse(Guid Id, string Name, string? Description);
public sealed record MinionArmorResponse(Guid Id, string Name, string? Description, int HarmSoak, bool IsSpecial, string? SpecialDescription);
public sealed record MinionWeaknessResponse(Guid Id, string Name, string? Description);

public sealed record MinionDetailResponse(
    Guid Id,
    Guid MonsterId,
    string MonsterName,
    string Name,
    string? Description,
    int HarmCapacity,
    TypeRefResponse MinionType,
    IReadOnlyList<MinionAttackResponse> Attacks,
    IReadOnlyList<MinionPowerResponse> Powers,
    IReadOnlyList<MinionArmorResponse> Armors,
    IReadOnlyList<MinionWeaknessResponse> Weaknesses,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertMinionRequest(
    [param: Required, MaxLength(255)] string Name,
    string? Description,
    [param: Range(0, int.MaxValue)] int HarmCapacity,
    Guid MinionTypeId);

public sealed record UpsertMinionAttackRequest(
    [param: Required, MaxLength(255)] string Name,
    string? Description,
    [param: Range(0, int.MaxValue)] int Harm);
public sealed record UpsertMinionPowerRequest([param: Required, MaxLength(255)] string Name, string? Description);
public sealed record UpsertMinionArmorRequest(
    [param: Required, MaxLength(255)] string Name,
    string? Description,
    [param: Range(0, int.MaxValue)] int HarmSoak,
    bool IsSpecial,
    string? SpecialDescription);
public sealed record UpsertMinionWeaknessRequest([param: Required, MaxLength(255)] string Name, string? Description);

// See MonsterListItemResponse's note on PrimaryImageId's default — the by-mystery site
// (GetByMysteryAsync/GetLocationsByMysteryIdAsync) is out of scope for Phase 4 and stays untouched.
public sealed record LocationListItemResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    Guid LocationTypeId,
    string LocationTypeName,
    string LocationTypeMotivation,
    DateTimeOffset CreatedAt,
    Guid? PrimaryImageId = null);

public sealed record LocationDetailResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    Guid LocationTypeId,
    string LocationTypeName,
    string LocationTypeMotivation,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertLocationRequest([param: Required, MaxLength(255)] string Name, string? Description, Guid LocationTypeId);

// See MonsterListItemResponse's note on PrimaryImageId's default — the by-mystery site
// (GetByMysteryAsync) is out of scope for Phase 4 and stays untouched.
public sealed record BystanderListItemResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    Guid BystanderTypeId,
    string BystanderTypeName,
    string BystanderTypeMotivation,
    DateTimeOffset CreatedAt,
    Guid? PrimaryImageId = null);

public sealed record BystanderDetailResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    Guid BystanderTypeId,
    string BystanderTypeName,
    string BystanderTypeMotivation,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertBystanderRequest([param: Required, MaxLength(255)] string Name, string? Description, Guid BystanderTypeId);

public sealed record SearchResultItemResponse(
    string EntityType,
    Guid Id,
    string Name,
    string MatchedField);

public sealed record SearchMatchSpanResponse(int Start, int Length);

public sealed record SearchResultDetailResponse(
    string EntityType,
    Guid Id,
    string Name,
    string MatchedField,
    string? MatchedSubResourceName,
    string Excerpt,
    string? Snippet,
    IReadOnlyList<SearchMatchSpanResponse> MatchSpans);

public sealed record PagedSearchResultResponse(
    IReadOnlyList<SearchResultDetailResponse> Items,
    int Page,
    int PageSize,
    int TotalCount);
