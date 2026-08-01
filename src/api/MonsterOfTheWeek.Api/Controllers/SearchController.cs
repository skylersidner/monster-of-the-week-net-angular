using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services.Search;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class SearchController(ISearchService searchService) : ControllerBase
{
    [HttpGet("api/search/quick")]
    public async Task<ActionResult<IReadOnlyList<SearchResultItemResponse>>> GetQuick(
        [FromQuery] string? q, CancellationToken cancellationToken)
    {
        var results = await searchService.QuickSearchAsync(q ?? string.Empty, cancellationToken);
        return Ok(results.Select(x => x.ToItemResponse()).ToList());
    }

    [HttpGet("api/search")]
    public async Task<ActionResult<PagedSearchResultResponse>> Get(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var (items, totalCount) = await searchService.SearchAsync(q ?? string.Empty, page, pageSize, cancellationToken);
        var response = new PagedSearchResultResponse(
            items.Select(x => x.ToDetailResponse()).ToList(),
            page,
            pageSize,
            totalCount);

        return Ok(response);
    }
}
