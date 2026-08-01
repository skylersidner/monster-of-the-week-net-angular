using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Phase 1: matches Monster.Name only (Weight = Primary, all four tiers). Excerpt source is Description.
/// </summary>
public sealed class MonsterSearchProvider(MotwDbContext dbContext) : ISearchProvider
{
    public string EntityType => "Monster";

    public async Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
        IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken)
    {
        var monsters = await dbContext.Monsters
            .AsNoTracking()
            .Select(x => new { x.Id, x.Name, x.Description })
            .ToListAsync(cancellationToken);

        var results = new List<SearchMatchCandidate>();
        foreach (var monster in monsters)
        {
            var matchStrength = SearchTokenizer.ComputeMatchStrength(monster.Name, tokens, rawQuery);
            if (matchStrength is null)
            {
                continue;
            }

            results.Add(new SearchMatchCandidate(
                EntityType,
                monster.Id,
                monster.Name,
                "Name",
                matchStrength.Value,
                SearchFieldWeight.Primary,
                monster.Description));
        }

        return results;
    }
}
