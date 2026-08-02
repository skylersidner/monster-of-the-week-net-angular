using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Phase 4a: matches Mystery.Name (Primary, all four tiers) and Concept/Hook/Overview/Notes (Tertiary,
/// tiers 2-4 only — long text never gets the substring tier, docs/search/architecture.md Section 2) via
/// <see cref="SearchTokenizer.PickBestMatch"/>. Excerpt source falls back through
/// Hook -&gt; Concept -&gt; Overview -&gt; Notes (first non-empty wins).
/// </summary>
public sealed class MysterySearchProvider(MotwDbContext dbContext) : ISearchProvider
{
    public string EntityType => "Mystery";

    public async Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
        IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken)
    {
        var mysteries = await dbContext.Mysteries
            .AsNoTracking()
            .Select(x => new { x.Id, x.Name, x.Concept, x.Hook, x.Overview, x.Notes })
            .ToListAsync(cancellationToken);

        var results = new List<SearchMatchCandidate>();
        foreach (var mystery in mysteries)
        {
            var candidateFields = new List<SearchTokenizer.CandidateField>
            {
                new("Name", mystery.Name, SearchFieldWeight.Primary, AllowSubstringTier: true),
                new("Concept", mystery.Concept, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
                new("Hook", mystery.Hook, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
                new("Overview", mystery.Overview, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
                new("Notes", mystery.Notes, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
            };

            var match = SearchTokenizer.PickBestMatch(candidateFields, tokens, rawQuery);
            if (match is null)
            {
                continue;
            }

            var excerptSource = mystery.Hook;
            if (string.IsNullOrWhiteSpace(excerptSource))
            {
                excerptSource = mystery.Concept;
            }

            if (string.IsNullOrWhiteSpace(excerptSource))
            {
                excerptSource = mystery.Overview;
            }

            if (string.IsNullOrWhiteSpace(excerptSource))
            {
                excerptSource = mystery.Notes;
            }

            string? snippet = null;
            IReadOnlyList<SearchMatchSpan> spans = [];
            if (match.Value.FieldName != "Name")
            {
                (snippet, spans) = SearchSnippetBuilder.Build(match.Value.Text!, tokens, match.Value.MatchStrength);
            }

            results.Add(new SearchMatchCandidate(
                EntityType,
                mystery.Id,
                mystery.Name,
                match.Value.FieldName,
                match.Value.SubResourceName,
                match.Value.MatchStrength,
                match.Value.Weight,
                excerptSource,
                snippet,
                spans));
        }

        return results;
    }
}
