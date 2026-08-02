namespace MonsterOfTheWeek.Api.Services.Search;

public interface ISearchService
{
    /// <summary>Top 4 results, combined and ranked across all domains. Used by the header dropdown.</summary>
    Task<IReadOnlyList<SearchMatchCandidate>> QuickSearchAsync(string query, CancellationToken cancellationToken);

    /// <summary>Paginated results across all domains, plus the total match count. Used by the results page.</summary>
    Task<(IReadOnlyList<SearchMatchCandidate> Items, int TotalCount)> SearchAsync(
        string query, int page, int pageSize, CancellationToken cancellationToken);
}
