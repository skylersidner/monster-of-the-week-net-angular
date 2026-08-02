using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Phase 4a: matches Location.Name (Primary, all four tiers) and Location.Description (Tertiary, tiers
/// 2-4 only — docs/search/architecture.md Section 2) via <see cref="SearchTokenizer.PickBestMatch"/>.
/// Excerpt source is Description.
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
            var candidateFields = new List<SearchTokenizer.CandidateField>
            {
                new("Name", location.Name, SearchFieldWeight.Primary, AllowSubstringTier: true),
                new("Description", location.Description, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
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
                location.Id,
                location.Name,
                match.Value.FieldName,
                match.Value.SubResourceName,
                match.Value.MatchStrength,
                match.Value.Weight,
                location.Description,
                snippet,
                spans));
        }

        return results;
    }
}
