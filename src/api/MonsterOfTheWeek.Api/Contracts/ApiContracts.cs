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
    Guid MysteryId,
    string Name,
    string? Description,
    int HarmCapacity,
    Guid? MonsterTypeId,
    string? MonsterTypeName,
    Guid? MinionTypeId,
    string? MinionTypeName);

public sealed record MonsterAttackResponse(
    Guid Id,
    string Name,
    string? Description,
    int Harm,
    IReadOnlyList<WeaponTagRefResponse> WeaponTags);

public sealed record MonsterPowerResponse(Guid Id, string Name, string? Description);
public sealed record MonsterArmorResponse(Guid Id, string Name, string? Description, int HarmSoak, bool IsMagical);
public sealed record MonsterWeaknessResponse(Guid Id, string Name, string? Description);

public sealed record MonsterDetailResponse(
    Guid Id,
    Guid MysteryId,
    string Name,
    string? Description,
    int HarmCapacity,
    Guid? MonsterTypeId,
    string? MonsterTypeName,
    Guid? MinionTypeId,
    string? MinionTypeName,
    IReadOnlyList<MonsterAttackResponse> Attacks,
    IReadOnlyList<MonsterPowerResponse> Powers,
    IReadOnlyList<MonsterArmorResponse> Armors,
    IReadOnlyList<MonsterWeaknessResponse> Weaknesses,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertMonsterRequest(
    string Name,
    string? Description,
    int HarmCapacity,
    Guid? MonsterTypeId,
    Guid? MinionTypeId);

public sealed record UpsertMonsterAttackRequest(string Name, string? Description, int Harm);
public sealed record AssignWeaponTagRequest(Guid WeaponTagId);
public sealed record UpsertMonsterPowerRequest(string Name, string? Description);
public sealed record UpsertMonsterArmorRequest(string Name, string? Description, int HarmSoak, bool IsMagical);
public sealed record UpsertMonsterWeaknessRequest(string Name, string? Description);
public sealed record UpsertCustomMoveRequest(string Name, string? Description);

public sealed record LocationListItemResponse(
    Guid Id,
    Guid MysteryId,
    string Name,
    string? Description,
    Guid LocationTypeId,
    string LocationTypeName);

public sealed record LocationDetailResponse(
    Guid Id,
    Guid MysteryId,
    string Name,
    string? Description,
    Guid LocationTypeId,
    string LocationTypeName,
    string LocationTypeMotivation,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertLocationRequest(string Name, string? Description, Guid LocationTypeId);

public sealed record BystanderListItemResponse(
    Guid Id,
    Guid MysteryId,
    string Name,
    string? Description,
    Guid BystanderTypeId,
    string BystanderTypeName);

public sealed record BystanderDetailResponse(
    Guid Id,
    Guid MysteryId,
    string Name,
    string? Description,
    Guid BystanderTypeId,
    string BystanderTypeName,
    string BystanderTypeMotivation,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertBystanderRequest(string Name, string? Description, Guid BystanderTypeId);
