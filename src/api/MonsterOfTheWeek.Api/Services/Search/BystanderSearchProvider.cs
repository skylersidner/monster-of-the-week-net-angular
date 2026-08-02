using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Phase 4a: matches Bystander.Name (Primary, all four tiers) and Bystander.Description (Tertiary,
/// tiers 2-4 only — docs/search/architecture.md Section 2) via <see cref="SearchTokenizer.PickBestMatch"/>.
/// Excerpt source is Description.
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
            var candidateFields = new List<SearchTokenizer.CandidateField>
            {
                new("Name", bystander.Name, SearchFieldWeight.Primary, AllowSubstringTier: true),
                new("Description", bystander.Description, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
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
                bystander.Id,
                bystander.Name,
                match.Value.FieldName,
                match.Value.SubResourceName,
                match.Value.MatchStrength,
                match.Value.Weight,
                bystander.Description,
                snippet,
                spans));
        }

        return results;
    }
}
