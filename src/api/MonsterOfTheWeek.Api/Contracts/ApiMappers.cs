using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services.Search;

namespace MonsterOfTheWeek.Api.Contracts;

public static class ApiMappers
{
    private const int SearchExcerptMaxLength = 160;

    public static SearchResultItemResponse ToItemResponse(this SearchMatchCandidate value) =>
        new(value.EntityType, value.EntityId, value.Name, value.MatchedField);

    public static SearchResultDetailResponse ToDetailResponse(this SearchMatchCandidate value) =>
        new(
            value.EntityType,
            value.EntityId,
            value.Name,
            value.MatchedField,
            TruncateExcerpt(value.ExcerptSource),
            null);

    private static string TruncateExcerpt(string? source)
    {
        if (string.IsNullOrWhiteSpace(source))
        {
            return string.Empty;
        }

        var trimmed = source.Trim();
        if (trimmed.Length <= SearchExcerptMaxLength)
        {
            return trimmed;
        }

        // Reserve one character for the trailing "…" so the final string never exceeds the max length.
        var contentLimit = SearchExcerptMaxLength - 1;
        var truncated = trimmed[..contentLimit];
        var lastSpace = truncated.LastIndexOf(' ');
        if (lastSpace > 0)
        {
            truncated = truncated[..lastSpace];
        }

        return truncated.TrimEnd() + "…";
    }

    public static AdventureTypeResponse ToResponse(this AdventureType value) =>
        new(value.Id, value.Name, value.Description);

    public static MonsterArchetypeResponse ToResponse(this MonsterArchetype value) =>
        new(value.Id, value.Name, value.Description);

    public static CountdownResponse ToResponse(this Countdown value) =>
        new(
            value.Id,
            value.Day,
            value.Shadows,
            value.Sunset,
            value.Dusk,
            value.Nightfall,
            value.Midnight);

    public static CustomMoveResponse ToResponse(this MysteryCustomMove value) =>
        new(value.Id, value.Name, value.Description);

    public static CustomMoveResponse ToResponse(this MonsterCustomMove value) =>
        new(value.Id, value.Name, value.Description);

    public static CustomMoveResponse ToResponse(this LocationCustomMove value) =>
        new(value.Id, value.Name, value.Description);

    public static CustomMoveResponse ToResponse(this BystanderCustomMove value) =>
        new(value.Id, value.Name, value.Description);

    public static WeaponTagRefResponse ToResponse(this WeaponTag value) =>
        new(value.Id, value.Name, value.Description);

    public static MonsterAttackResponse ToResponse(this MonsterAttack value) =>
        new(
            value.Id,
            value.Name,
            value.Description,
            value.Harm,
            value.MonsterAttackWeaponTags
                .Select(x => x.WeaponTag.ToResponse())
                .ToList());

    public static MonsterPowerResponse ToResponse(this MonsterPower value) =>
        new(value.Id, value.Name, value.Description);

    public static MonsterArmorResponse ToResponse(this MonsterArmor value) =>
        new(value.Id, value.Name, value.Description, value.HarmSoak, value.IsSpecial, value.SpecialDescription);

    public static MonsterWeaknessResponse ToResponse(this MonsterWeakness value) =>
        new(value.Id, value.Name, value.Description);

    public static MinionAttackResponse ToResponse(this MinionAttack value) =>
        new(
            value.Id,
            value.Name,
            value.Description,
            value.Harm,
            value.MinionAttackWeaponTags
                .Select(x => x.WeaponTag.ToResponse())
                .ToList());

    public static MinionPowerResponse ToResponse(this MinionPower value) =>
        new(value.Id, value.Name, value.Description);

    public static MinionArmorResponse ToResponse(this MinionArmor value) =>
        new(value.Id, value.Name, value.Description, value.HarmSoak, value.IsSpecial, value.SpecialDescription);

    public static MinionWeaknessResponse ToResponse(this MinionWeakness value) =>
        new(value.Id, value.Name, value.Description);

    public static CustomMoveResponse ToResponse(this MinionCustomMove value) =>
        new(value.Id, value.Name, value.Description);
}
