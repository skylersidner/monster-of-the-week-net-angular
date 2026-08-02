using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Phase 4a: matches Monster.Name (Primary, all four tiers) and Monster.Description (Tertiary, tiers
/// 2-4 only — docs/search/architecture.md Section 2) via <see cref="SearchTokenizer.PickBestMatch"/>.
/// Excerpt source is Description. Sub-resource (Attack/Power/Armor/Weakness) fields land in Phase 4b.
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
            var candidateFields = new List<SearchTokenizer.CandidateField>
            {
                new("Name", monster.Name, SearchFieldWeight.Primary, AllowSubstringTier: true),
                new("Description", monster.Description, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
            };

            var match = SearchTokenizer.PickBestMatch(candidateFields, tokens, rawQuery);
            if (match is null)
            {
                continue;
            }

            string? snippet = null;
            IReadOnlyList<SearchMatchSpan> spans = [];
            if (match.Value.FieldName != "Name")
            {
                (snippet, spans) = SearchSnippetBuilder.Build(match.Value.Text!, tokens, match.Value.MatchStrength);
            }

            results.Add(new SearchMatchCandidate(
                EntityType,
                monster.Id,
                monster.Name,
                match.Value.FieldName,
                match.Value.SubResourceName,
                match.Value.MatchStrength,
                match.Value.Weight,
                monster.Description,
                snippet,
                spans));
        }

        return results;
    }
}
