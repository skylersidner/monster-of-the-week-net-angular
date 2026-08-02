using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services.Search;

namespace MonsterOfTheWeek.Api.Tests.Services.Search;

/// <summary>
/// End-to-end (real SQLite, no fakes) coverage of Phase 4a's entity long-text-field matching, run
/// against the actual EF Core query shape each provider uses — see docs/search/phases.md Phase 4a
/// verification checklist.
/// </summary>
public sealed class SearchProvidersTests
{
    [Fact]
    public async Task MonsterSearchProvider_MatchesDescription_WhenNameDoesNotMatch()
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);

        var monster = new Monster
        {
            Name = "Grimtooth",
            Description = "A skeletal figure wreathed in cold flame that haunts the old orchard at night.",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var provider = new MonsterSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("orchard");
        var results = await provider.SearchAsync(tokens, "orchard", CancellationToken.None);

        var candidate = Assert.Single(results);
        Assert.Equal("Description", candidate.MatchedField);
        Assert.Equal(SearchFieldWeight.Tertiary, candidate.Weight);
        Assert.Null(candidate.MatchedSubResourceName);
        Assert.NotNull(candidate.Snippet);
        Assert.NotEmpty(candidate.MatchSpans);
        Assert.Contains("orchard", candidate.Snippet, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MonsterSearchProvider_PrefersNameMatch_OverDescriptionMatch_WhenBothMatch()
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);

        // Name matches at boundary-prefix (score 200); Description matches at exact (score 100) -
        // Name's Primary weight should still win despite the weaker tier (docs/search/architecture.md
        // Section 4 worked-scores table).
        var monster = new Monster
        {
            Name = "The Stonefall Ridge",
            Description = "Sto",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var provider = new MonsterSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("sto");
        var results = await provider.SearchAsync(tokens, "sto", CancellationToken.None);

        var candidate = Assert.Single(results);
        Assert.Equal("Name", candidate.MatchedField);
        Assert.Null(candidate.Snippet);
        Assert.Empty(candidate.MatchSpans);
    }

    [Fact]
    public async Task MonsterSearchProvider_SubstringTierNeverFires_ForDescription()
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);

        var monster = new Monster
        {
            Name = "Unrelated Name",
            // "chard" only appears mid-word, inside "orchard" - never at a word boundary.
            Description = "It haunts the old orchard at night.",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var provider = new MonsterSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("chard");
        var results = await provider.SearchAsync(tokens, "chard", CancellationToken.None);

        Assert.Empty(results);
    }

    [Fact]
    public async Task MysterySearchProvider_MatchesNotesOnly()
    {
        await using var context = await CreateContextAsync();
        var adventureTypeId = await SeedAdventureTypeAsync(context);

        var mystery = new Mystery
        {
            Name = "Unrelated Name",
            Notes = "The GM should reveal the Obsidian Key before Act 3.",
            AdventureTypeId = adventureTypeId,
        };
        context.Mysteries.Add(mystery);
        await context.SaveChangesAsync();

        var provider = new MysterySearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("obsidian");
        var results = await provider.SearchAsync(tokens, "obsidian", CancellationToken.None);

        var candidate = Assert.Single(results);
        Assert.Equal("Notes", candidate.MatchedField);
        Assert.Equal(SearchFieldWeight.Tertiary, candidate.Weight);
        Assert.NotNull(candidate.Snippet);
        Assert.NotEmpty(candidate.MatchSpans);
        Assert.Contains("obsidian", candidate.Snippet, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MysterySearchProvider_SubstringTierNeverFires_ForLongTextFields()
    {
        await using var context = await CreateContextAsync();
        var adventureTypeId = await SeedAdventureTypeAsync(context);

        var mystery = new Mystery
        {
            Name = "Unrelated Name",
            // "sto" only appears mid-word, inside "ancestor" - never at a word boundary.
            Hook = "An old ancestor's grudge returns.",
            AdventureTypeId = adventureTypeId,
        };
        context.Mysteries.Add(mystery);
        await context.SaveChangesAsync();

        var provider = new MysterySearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("sto");
        var results = await provider.SearchAsync(tokens, "sto", CancellationToken.None);

        Assert.Empty(results);
    }

    [Fact]
    public async Task MysterySearchProvider_ExcerptFallsBackToOverview_WhenHookAndConceptEmpty()
    {
        await using var context = await CreateContextAsync();
        var adventureTypeId = await SeedAdventureTypeAsync(context);

        var mystery = new Mystery
        {
            Name = "Vanished Orchard",
            Hook = null,
            Concept = "   ",
            Overview = "A quiet orchard where six people disappeared without a trace last autumn.",
            Notes = null,
            AdventureTypeId = adventureTypeId,
        };
        context.Mysteries.Add(mystery);
        await context.SaveChangesAsync();

        var provider = new MysterySearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("vanished");
        var results = await provider.SearchAsync(tokens, "vanished", CancellationToken.None);

        var candidate = Assert.Single(results);
        Assert.Equal("Name", candidate.MatchedField);

        var response = candidate.ToDetailResponse();
        Assert.NotEmpty(response.Excerpt);
        Assert.Contains("orchard", response.Excerpt, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<MotwDbContext> CreateContextAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>()
            .UseSqlite(connection)
            .Options;

        var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();
        return context;
    }

    private static async Task<(Guid MonsterTypeId, Guid ArchetypeId)> SeedMonsterLookupsAsync(MotwDbContext context)
    {
        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat" };
        context.MonsterTypes.Add(monsterType);
        context.MonsterArchetypes.Add(archetype);
        await context.SaveChangesAsync();
        return (monsterType.Id, archetype.Id);
    }

    private static async Task<Guid> SeedAdventureTypeAsync(MotwDbContext context)
    {
        var adventureType = new AdventureType { Name = "Thwart", Description = "Hunters vs bad guy." };
        context.AdventureTypes.Add(adventureType);
        await context.SaveChangesAsync();
        return adventureType.Id;
    }
}
