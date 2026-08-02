using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Matches Monster.Name (Primary, all four tiers), Monster.Description (Tertiary, tiers 2-4 only —
/// docs/search/architecture.md Section 2), and, as of Phase 4b, every Attack/Power/Armor/Weakness's
/// Name (Secondary, all four tiers) and Description (Tertiary, tiers 2-4 only) via
/// <see cref="SearchTokenizer.PickBestMatch"/>. Excerpt source is the Monster's own Description.
/// <c>MonsterCustomMove</c> is deliberately excluded — docs/search/architecture.md Section 3
/// ("Excluded from Phase 4 scope: CustomMove sub-resources").
/// </summary>
public sealed class MonsterSearchProvider(MotwDbContext dbContext) : ISearchProvider
{
    public string EntityType => "Monster";

    public async Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
        IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken)
    {
        var monsters = await dbContext.Monsters
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
        foreach (var monster in monsters)
        {
            var candidateFields = new List<SearchTokenizer.CandidateField>
            {
                new("Name", monster.Name, SearchFieldWeight.Primary, AllowSubstringTier: true),
                new("Description", monster.Description, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
            };

            AddSubResourceFields(candidateFields, "Attack", monster.Attacks);
            AddSubResourceFields(candidateFields, "Power", monster.Powers);
            AddSubResourceFields(candidateFields, "Armor", monster.Armors);
            AddSubResourceFields(candidateFields, "Weakness", monster.Weaknesses);

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
