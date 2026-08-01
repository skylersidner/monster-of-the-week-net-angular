using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Phase 1: matches Mystery.Name only (Weight = Primary, all four tiers). Excerpt source is
/// Hook, falling back to Concept when Hook is empty — see docs/search/architecture.md Section 5.
/// </summary>
public sealed class MysterySearchProvider(MotwDbContext dbContext) : ISearchProvider
{
    public string EntityType => "Mystery";

    public async Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
        IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken)
    {
        var mysteries = await dbContext.Mysteries
            .AsNoTracking()
            .Select(x => new { x.Id, x.Name, x.Hook, x.Concept })
            .ToListAsync(cancellationToken);

        var results = new List<SearchMatchCandidate>();
        foreach (var mystery in mysteries)
        {
            var matchStrength = SearchTokenizer.ComputeMatchStrength(mystery.Name, tokens, rawQuery);
            if (matchStrength is null)
            {
                continue;
            }

            var excerptSource = string.IsNullOrWhiteSpace(mystery.Hook) ? mystery.Concept : mystery.Hook;
            results.Add(new SearchMatchCandidate(
                EntityType,
                mystery.Id,
                mystery.Name,
                "Name",
                matchStrength.Value,
                SearchFieldWeight.Primary,
                excerptSource));
        }

        return results;
    }
}
