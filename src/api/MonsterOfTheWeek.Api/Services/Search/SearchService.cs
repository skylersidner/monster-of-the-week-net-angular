namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Fans out to every registered <see cref="ISearchProvider"/>, dedupes to the highest-scoring match
/// per entity, and ranks the combined results — see docs/search/architecture.md Section 4.
/// </summary>
public sealed class SearchService(IEnumerable<ISearchProvider> providers) : ISearchService
{
    private const int QuickResultCount = 4;

    public async Task<IReadOnlyList<SearchMatchCandidate>> QuickSearchAsync(string query, CancellationToken cancellationToken)
    {
        var ranked = await RankAsync(query, cancellationToken);
        return ranked.Take(QuickResultCount).ToList();
    }

    public async Task<(IReadOnlyList<SearchMatchCandidate> Items, int TotalCount)> SearchAsync(
        string query, int page, int pageSize, CancellationToken cancellationToken)
    {
        var ranked = await RankAsync(query, cancellationToken);

        var safePage = page < 1 ? 1 : page;
        var safePageSize = pageSize < 1 ? 1 : pageSize;

        var items = ranked
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToList();

        return (items, ranked.Count);
    }

    private async Task<IReadOnlyList<SearchMatchCandidate>> RankAsync(string query, CancellationToken cancellationToken)
    {
        // The 3-character minimum is a frontend-only gate on HeaderSearchComponent's debounce
        // (Phase 2) — the backend never rejects a query based on length, so `?q=an` typed directly
        // into the results-page URL keeps working. Only "nothing to search for" (empty/whitespace/
        // dash-only, which tokenizes to zero tokens) short-circuits here.
        var tokens = SearchTokenizer.Tokenize(query);
        if (tokens.Count == 0)
        {
            return [];
        }

        var rawQuery = query.Trim();

        // Providers share a single scoped MotwDbContext (registered AddDbContext), and EF Core's
        // DbContext is not thread-safe for concurrent operations — fan out sequentially, not via
        // Task.WhenAll, or concurrent provider queries throw ConcurrencyDetector exceptions.
        var providerResults = new List<IReadOnlyList<SearchMatchCandidate>>();
        foreach (var provider in providers)
        {
            providerResults.Add(await provider.SearchAsync(tokens, rawQuery, cancellationToken));
        }

        return providerResults
            .SelectMany(results => results)
            .GroupBy(candidate => (candidate.EntityType, candidate.EntityId))
            .Select(group => group.OrderByDescending(candidate => candidate.Score).First())
            .OrderByDescending(candidate => candidate.Score)
            .ThenBy(candidate => candidate.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(candidate => candidate.EntityType, StringComparer.Ordinal)
            .ThenBy(candidate => candidate.EntityId)
            .ToList();
    }
}
