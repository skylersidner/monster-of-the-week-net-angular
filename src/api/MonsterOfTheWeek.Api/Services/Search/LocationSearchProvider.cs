using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Phase 1: matches Location.Name only (Weight = Primary, all four tiers). Excerpt source is Description.
/// </summary>
public sealed class LocationSearchProvider(MotwDbContext dbContext) : ISearchProvider
{
    public string EntityType => "Location";

    public async Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
        IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken)
    {
        var locations = await dbContext.Locations
            .AsNoTracking()
            .Select(x => new { x.Id, x.Name, x.Description })
            .ToListAsync(cancellationToken);

        var results = new List<SearchMatchCandidate>();
        foreach (var location in locations)
        {
            var matchStrength = SearchTokenizer.ComputeMatchStrength(location.Name, tokens, rawQuery);
            if (matchStrength is null)
            {
                continue;
            }

            results.Add(new SearchMatchCandidate(
                EntityType,
                location.Id,
                location.Name,
                "Name",
                matchStrength.Value,
                SearchFieldWeight.Primary,
                location.Description));
        }

        return results;
    }
}
