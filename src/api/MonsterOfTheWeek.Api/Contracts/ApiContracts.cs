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
public sealed record CustomMoveResponse(Guid Id, string Name, string? Description);

public sealed record MysteryListItemResponse(
    Guid Id,
    string Name,
    string? Concept,
    string? Hook,
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
    CountdownResponse? Countdown,
    int MonsterCount,
    int LocationCount,
    int BystanderCount,
    IReadOnlyList<CustomMoveResponse> CustomMoves,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record UpsertMysteryRequest(
    string Name,
    string? Concept,
    string? Hook,
    string? Overview,
    string? Notes);

public sealed record UpsertCountdownRequest(
    string? Day,
    string? Shadows,
    string? Sunset,
    string? Dusk,
    string? Nightfall,
    string? Midnight);

public sealed record MonsterListItemResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    int HarmCapacity,
    TypeRefResponse MonsterType,
    int AttackCount,
    int PowerCount,
    int ArmorCount,
    int WeaknessCount,
    int MinionCount,
    DateTimeOffset CreatedAt);

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
    IReadOnlyList<MonsterAttackResponse> Attacks,
    IReadOnlyList<MonsterPowerResponse> Powers,
    IReadOnlyList<MonsterArmorResponse> Armors,
    IReadOnlyList<MonsterWeaknessResponse> Weaknesses,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertMonsterRequest(
    string Name,
    string? Description,
    int HarmCapacity,
    Guid MonsterTypeId);

public sealed record UpsertMonsterAttackRequest(string Name, string? Description, int Harm);
public sealed record AssignWeaponTagRequest(Guid WeaponTagId);
public sealed record UpsertMonsterPowerRequest(string Name, string? Description);
public sealed record UpsertMonsterArmorRequest(string Name, string? Description, int HarmSoak, bool IsSpecial, string? SpecialDescription);
public sealed record UpsertMonsterWeaknessRequest(string Name, string? Description);
public sealed record UpsertCustomMoveRequest(string Name, string? Description);

public sealed record MinionListItemResponse(
    Guid Id,
    string Name,
    string? Description,
    int HarmCapacity,
    Guid MinionTypeId,
    string MinionTypeName,
    int AttackCount,
    int PowerCount,
    int ArmorCount,
    int WeaknessCount,
    DateTimeOffset CreatedAt);

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
    string Name,
    string? Description,
    int HarmCapacity,
    Guid MinionTypeId,
    string MinionTypeName,
    IReadOnlyList<MinionAttackResponse> Attacks,
    IReadOnlyList<MinionPowerResponse> Powers,
    IReadOnlyList<MinionArmorResponse> Armors,
    IReadOnlyList<MinionWeaknessResponse> Weaknesses,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertMinionRequest(
    string Name,
    string? Description,
    int HarmCapacity,
    Guid MinionTypeId);

public sealed record UpsertMinionAttackRequest(string Name, string? Description, int Harm);
public sealed record UpsertMinionPowerRequest(string Name, string? Description);
public sealed record UpsertMinionArmorRequest(string Name, string? Description, int HarmSoak, bool IsSpecial, string? SpecialDescription);
public sealed record UpsertMinionWeaknessRequest(string Name, string? Description);

public sealed record LocationListItemResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    Guid LocationTypeId,
    string LocationTypeName);

public sealed record LocationDetailResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    Guid LocationTypeId,
    string LocationTypeName,
    string LocationTypeMotivation,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertLocationRequest(string Name, string? Description, Guid LocationTypeId);

public sealed record BystanderListItemResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    Guid BystanderTypeId,
    string BystanderTypeName);

public sealed record BystanderDetailResponse(
    Guid Id,
    IReadOnlyList<Guid> MysteryIds,
    string Name,
    string? Description,
    Guid BystanderTypeId,
    string BystanderTypeName,
    string BystanderTypeMotivation,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertBystanderRequest(string Name, string? Description, Guid BystanderTypeId);
