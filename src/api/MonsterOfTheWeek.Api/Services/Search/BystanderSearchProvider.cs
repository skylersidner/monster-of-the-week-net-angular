using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Phase 1: matches Bystander.Name only (Weight = Primary, all four tiers). Excerpt source is Description.
/// </summary>
public sealed class BystanderSearchProvider(MotwDbContext dbContext) : ISearchProvider
{
    public string EntityType => "Bystander";

    public async Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
        IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken)
    {
        var bystanders = await dbContext.Bystanders
            .AsNoTracking()
            .Select(x => new { x.Id, x.Name, x.Description })
            .ToListAsync(cancellationToken);

        var results = new List<SearchMatchCandidate>();
        foreach (var bystander in bystanders)
        {
            var matchStrength = SearchTokenizer.ComputeMatchStrength(bystander.Name, tokens, rawQuery);
            if (matchStrength is null)
            {
                continue;
            }

            results.Add(new SearchMatchCandidate(
                EntityType,
                bystander.Id,
                bystander.Name,
                "Name",
                matchStrength.Value,
                SearchFieldWeight.Primary,
                bystander.Description));
        }

        return results;
    }
}
