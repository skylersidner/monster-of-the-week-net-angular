using Microsoft.AspNetCore.Http;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services.ResourceImages;
using MonsterOfTheWeek.Api.Services.Search;

namespace MonsterOfTheWeek.Api.Contracts;

public static class ApiMappers
{
    private const int SearchExcerptMaxLength = 160;

    public static SearchResultItemResponse ToItemResponse(this SearchMatchCandidate value) =>
        new(value.EntityType, value.EntityId, value.Name, value.MatchedField);

    // Resource images — docs/resource-images/design.md §1.1/§3, phases.md Phase 3.
    //
    // isPrimary isn't a property of the row itself (design.md §1.2 — it's derived from the
    // owner's PrimaryImageId, or the lowest SortOrder when that's null), so the caller passes it
    // in rather than this mapper re-deriving it per image.
    public static ResourceImageResponse ToResponse(this ResourceImage value, bool isPrimary) =>
        new(value.Id, value.FileName, value.ContentType, value.SizeBytes, value.Width, value.Height, value.SortOrder, isPrimary, value.CreatedAt);

    public static RejectedResourceImageResponse ToResponse(this RejectedResourceImage value) =>
        new(value.FileName, value.Reason.ToString());

    /// <summary>
    /// Reads every file's bytes into memory up front. Safe at this feature's size — the
    /// multipart body is already capped at 24 MiB by `[RequestSizeLimit]`/`[RequestFormLimits]`
    /// on the action (phases.md Phase 3) before this ever runs.
    /// </summary>
    public static async Task<IReadOnlyList<ResourceImageUploadFile>> ToUploadFilesAsync(
        this IFormFileCollection files, CancellationToken cancellationToken)
    {
        var result = new List<ResourceImageUploadFile>(files.Count);
        foreach (var file in files)
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream, cancellationToken);
            result.Add(new ResourceImageUploadFile(file.FileName, stream.ToArray()));
        }

        return result;
    }

    public static SearchResultDetailResponse ToDetailResponse(this SearchMatchCandidate value) =>
        new(
            value.EntityType,
            value.EntityId,
            value.Name,
            value.MatchedField,
            value.MatchedSubResourceName,
            TruncateExcerpt(value.ExcerptSource),
            value.Snippet,
            value.MatchSpans.Select(span => new SearchMatchSpanResponse(span.Start, span.Length)).ToList());

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

    // Domain custom moves — docs/domain-custom-moves/architecture.md §3.1, Phase 1. The one
    // overload that survives Phase 3; the five per-domain ones below and above it go with their
    // entities (§9). Identical body to all five, because CustomMoveResponse never changed —
    // §2.1 budgets zero contract change for this whole rework.
    public static CustomMoveResponse ToResponse(this CustomMove value) =>
        new(value.Id, value.Name, value.Description);

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
