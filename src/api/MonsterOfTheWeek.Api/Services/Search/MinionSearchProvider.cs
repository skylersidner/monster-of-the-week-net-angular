using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Matches Minion.Name (Primary, all four tiers), Minion.Description (Tertiary, tiers 2-4 only —
/// docs/search/architecture.md Section 2), and, as of Phase 4b, every Attack/Power/Armor/Weakness's
/// Name (Secondary, all four tiers) and Description (Tertiary, tiers 2-4 only) via
/// <see cref="SearchTokenizer.PickBestMatch"/>. Excerpt source is the Minion's own Description.
/// <c>MinionCustomMove</c> is deliberately excluded — docs/search/architecture.md Section 3
/// ("Excluded from Phase 4 scope: CustomMove sub-resources").
/// </summary>
public sealed class MinionSearchProvider(MotwDbContext dbContext) : ISearchProvider
{
    public string EntityType => "Minion";

    public async Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
        IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken)
    {
        var minions = await dbContext.Minions
            .AsNoTracking()
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Description,
                Attacks = x.Attacks.Select(a => new SubResourceProjection(a.Name, a.Description)).ToList(),
                Powers = x.Powers.Select(p => new SubResourceProjection(p.Name, p.Description)).ToList(),
                Armors = x.Armors.Select(a => new SubResourceProjection(a.Name, a.Description)).ToList(),
                Weaknesses = x.Weaknesses.Select(w => new SubResourceProjection(w.Name, w.Description)).ToList(),
            })
            .ToListAsync(cancellationToken);

        var results = new List<SearchMatchCandidate>();
        foreach (var minion in minions)
        {
            var candidateFields = new List<SearchTokenizer.CandidateField>
            {
                new("Name", minion.Name, SearchFieldWeight.Primary, AllowSubstringTier: true),
                new("Description", minion.Description, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
            };

            AddSubResourceFields(candidateFields, "Attack", minion.Attacks);
            AddSubResourceFields(candidateFields, "Power", minion.Powers);
            AddSubResourceFields(candidateFields, "Armor", minion.Armors);
            AddSubResourceFields(candidateFields, "Weakness", minion.Weaknesses);

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
                minion.Id,
                minion.Name,
                match.Value.FieldName,
                match.Value.SubResourceName,
                match.Value.MatchStrength,
                match.Value.Weight,
                minion.Description,
                snippet,
                spans));
        }

        return results;
    }

    /// <summary>
    /// Adds a Name (Secondary, all tiers) and Description (Tertiary, tiers 2-4 only) candidate field for
    /// every instance of one sub-resource kind (Attack/Power/Armor/Weakness), tagging both with that
    /// instance's own Name as <see cref="SearchTokenizer.CandidateField.SubResourceName"/> so the winning
    /// candidate (if either field wins) identifies which specific instance matched — see
    /// docs/search/architecture.md Section 3.
    /// </summary>
    private static void AddSubResourceFields(
        List<SearchTokenizer.CandidateField> candidateFields,
        string kind,
        IEnumerable<SubResourceProjection> subResources)
    {
        foreach (var subResource in subResources)
        {
            candidateFields.Add(new(
                $"{kind}.Name", subResource.Name, SearchFieldWeight.Secondary,
                AllowSubstringTier: true, SubResourceName: subResource.Name));
            candidateFields.Add(new(
                $"{kind}.Description", subResource.Description, SearchFieldWeight.Tertiary,
                AllowSubstringTier: false, SubResourceName: subResource.Name));
        }
    }

    /// <summary>Flat Name/Description projection shared by Attack/Power/Armor/Weakness queries.</summary>
    private sealed record SubResourceProjection(string Name, string? Description);
}
