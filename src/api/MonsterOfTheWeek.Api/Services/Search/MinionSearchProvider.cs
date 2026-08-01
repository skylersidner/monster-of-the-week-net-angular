using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Phase 1: matches Minion.Name only (Weight = Primary, all four tiers). Excerpt source is Description.
/// </summary>
public sealed class MinionSearchProvider(MotwDbContext dbContext) : ISearchProvider
{
    public string EntityType => "Minion";

    public async Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
        IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken)
    {
        var minions = await dbContext.Minions
            .AsNoTracking()
            .Select(x => new { x.Id, x.Name, x.Description })
            .ToListAsync(cancellationToken);

        var results = new List<SearchMatchCandidate>();
        foreach (var minion in minions)
        {
            var matchStrength = SearchTokenizer.ComputeMatchStrength(minion.Name, tokens, rawQuery);
            if (matchStrength is null)
            {
                continue;
            }

            results.Add(new SearchMatchCandidate(
                EntityType,
                minion.Id,
                minion.Name,
                "Name",
                matchStrength.Value,
                SearchFieldWeight.Primary,
                minion.Description));
        }

        return results;
    }
}
