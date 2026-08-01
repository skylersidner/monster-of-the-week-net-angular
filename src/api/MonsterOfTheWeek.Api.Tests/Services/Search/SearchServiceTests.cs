using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services.Search;

namespace MonsterOfTheWeek.Api.Tests.Services.Search;

public sealed class SearchServiceTests
{
    [Fact]
    public async Task QuickSearchAsync_ReturnsTop4_CombinedAcrossAllDomains()
    {
        var candidates = new[]
        {
            Candidate("Monster", "Alpha", strength: 4),   // 400
            Candidate("Location", "Bravo", strength: 3),  // 300
            Candidate("Bystander", "Charlie", strength: 2), // 200
            Candidate("Mystery", "Delta", strength: 1),    // 100
            Candidate("Minion", "Echo", strength: 1),      // 100 (tiebreak by name after Delta)
        };
        var service = new SearchService([new FakeSearchProvider("all", candidates)]);

        var results = await service.QuickSearchAsync("sto", CancellationToken.None);

        Assert.Equal(4, results.Count);
        Assert.Equal(["Alpha", "Bravo", "Charlie", "Delta"], results.Select(x => x.Name));
    }

    [Fact]
    public async Task SearchAsync_ReturnsCorrectPage_AndAccurateTotalCount()
    {
        var candidates = Enumerable.Range(0, 7)
            .Select(i => Candidate("Monster", $"Monster{i:D2}", strength: 4))
            .ToArray();
        var service = new SearchService([new FakeSearchProvider("all", candidates)]);

        var (items, totalCount) = await service.SearchAsync("sto", page: 2, pageSize: 3, CancellationToken.None);

        Assert.Equal(7, totalCount);
        Assert.Equal(3, items.Count);
        Assert.Equal(["Monster03", "Monster04", "Monster05"], items.Select(x => x.Name));
    }

    [Fact]
    public async Task RankAsync_DedupesToHighestScorePerEntity()
    {
        var entityId = Guid.NewGuid();
        var weakMatch = new SearchMatchCandidate("Monster", entityId, "Grimtooth", "Name", SearchMatchTier.Substring, SearchFieldWeight.Primary, null);
        var strongMatch = new SearchMatchCandidate("Monster", entityId, "Grimtooth", "Name", SearchMatchTier.Exact, SearchFieldWeight.Primary, null);
        var service = new SearchService([
            new FakeSearchProvider("providerA", [weakMatch]),
            new FakeSearchProvider("providerB", [strongMatch]),
        ]);

        var (items, totalCount) = await service.SearchAsync("sto", page: 1, pageSize: 20, CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Single(items);
        Assert.Equal(SearchMatchTier.Exact, items[0].MatchStrength);
    }

    [Fact]
    public async Task RankAsync_OrdersByScoreDesc_ThenNameAsc_ThenEntityTypeAsc_ThenIdAsc()
    {
        var lowId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var highId = Guid.Parse("00000000-0000-0000-0000-000000000002");

        var zulu = Candidate("Monster", "Zulu", strength: 4);   // 400, name tiebreak loser
        var alpha = Candidate("Monster", "Alpha", strength: 4); // 400, name tiebreak winner
        var echoBystander = new SearchMatchCandidate("Bystander", lowId, "Echo", "Name", SearchMatchTier.Exact, SearchFieldWeight.Primary, null); // 400
        var echoLocation = new SearchMatchCandidate("Location", highId, "Echo", "Name", SearchMatchTier.Exact, SearchFieldWeight.Primary, null);   // 400, same name -> EntityType tiebreak
        var weak = Candidate("Mystery", "Mike", strength: 1); // 100, lowest score

        var service = new SearchService([new FakeSearchProvider("all", [zulu, alpha, echoBystander, echoLocation, weak])]);

        var (items, _) = await service.SearchAsync("sto", page: 1, pageSize: 20, CancellationToken.None);

        Assert.Equal(
            [("Alpha", "Monster"), ("Echo", "Bystander"), ("Echo", "Location"), ("Zulu", "Monster"), ("Mike", "Mystery")],
            items.Select(x => (x.Name, x.EntityType)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("---")]
    public async Task QuickSearchAsync_ReturnsEmpty_ForEmptyOrWhitespaceOrDashOnlyQuery(string query)
    {
        var service = new SearchService([new FakeSearchProvider("all", [Candidate("Monster", "Anything", strength: 4)])]);

        var results = await service.QuickSearchAsync(query, CancellationToken.None);

        Assert.Empty(results);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("---")]
    public async Task SearchAsync_ReturnsEmptyPage_ForEmptyOrWhitespaceOrDashOnlyQuery(string query)
    {
        var service = new SearchService([new FakeSearchProvider("all", [Candidate("Monster", "Anything", strength: 4)])]);

        var (items, totalCount) = await service.SearchAsync(query, page: 1, pageSize: 20, CancellationToken.None);

        Assert.Empty(items);
        Assert.Equal(0, totalCount);
    }

    [Theory]
    [InlineData("a")]
    [InlineData("an")]
    public async Task QuickSearchAsync_DoesNotRejectShortQueries_MinLengthIsFrontendOnly(string query)
    {
        // The 3-character minimum is a HeaderSearchComponent (Phase 2) debounce gate only — the
        // backend must keep searching short queries so a manually-edited `?q=an` URL still works.
        var service = new SearchService([new FakeSearchProvider("all", [Candidate("Monster", "Anything", strength: 1)])]);

        var results = await service.QuickSearchAsync(query, CancellationToken.None);

        Assert.Single(results);
        Assert.Equal("Anything", results[0].Name);
    }

    [Theory]
    [InlineData("a")]
    [InlineData("an")]
    public async Task SearchAsync_DoesNotRejectShortQueries_MinLengthIsFrontendOnly(string query)
    {
        var service = new SearchService([new FakeSearchProvider("all", [Candidate("Monster", "Anything", strength: 1)])]);

        var (items, totalCount) = await service.SearchAsync(query, page: 1, pageSize: 20, CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Single(items);
        Assert.Equal("Anything", items[0].Name);
    }

    [Fact]
    public void ToItemResponse_MatchedFieldIsAlwaysName()
    {
        var candidate = Candidate("Monster", "Grimtooth", strength: 4);

        var response = candidate.ToItemResponse();

        Assert.Equal("Name", response.MatchedField);
    }

    [Fact]
    public void ToDetailResponse_SnippetIsAlwaysNull_AndMatchedFieldIsAlwaysName()
    {
        var candidate = Candidate("Monster", "Grimtooth", strength: 4) with { ExcerptSource = "A description." };

        var response = candidate.ToDetailResponse();

        Assert.Null(response.Snippet);
        Assert.Equal("Name", response.MatchedField);
    }

    [Fact]
    public void ToDetailResponse_TruncatesExcerpt_AtWordBoundary_WithTrailingEllipsis()
    {
        var longText = string.Join(' ', Enumerable.Repeat("word", 50)); // well over 160 chars
        var candidate = Candidate("Monster", "Grimtooth", strength: 4) with { ExcerptSource = longText };

        var response = candidate.ToDetailResponse();

        Assert.True(response.Excerpt.Length <= 160);
        Assert.EndsWith("…", response.Excerpt);
        Assert.DoesNotContain("  ", response.Excerpt); // no partial-word / double-space artifacts
    }

    [Fact]
    public void ToDetailResponse_DoesNotTruncate_WhenExcerptSourceFitsWithinLimit()
    {
        var shortText = "A short description.";
        var candidate = Candidate("Monster", "Grimtooth", strength: 4) with { ExcerptSource = shortText };

        var response = candidate.ToDetailResponse();

        Assert.Equal(shortText, response.Excerpt);
        Assert.DoesNotContain("…", response.Excerpt);
    }

    [Fact]
    public void ToDetailResponse_ExcerptIsEmptyString_WhenExcerptSourceIsNull()
    {
        var candidate = Candidate("Monster", "Grimtooth", strength: 4);

        var response = candidate.ToDetailResponse();

        Assert.Equal(string.Empty, response.Excerpt);
    }

    private static SearchMatchCandidate Candidate(string entityType, string name, int strength) =>
        new(entityType, Guid.NewGuid(), name, "Name", strength, SearchFieldWeight.Primary, null);

    private sealed class FakeSearchProvider(string entityType, IReadOnlyList<SearchMatchCandidate> results) : ISearchProvider
    {
        public string EntityType => entityType;

        public Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
            IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken) =>
            Task.FromResult(results);
    }
}
