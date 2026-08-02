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

    // --- Phase 4b: Monster/Minion sub-resource (Attack/Power/Armor/Weakness) field matching ---
    // See docs/search/phases.md "Phase 4b" and docs/search/architecture.md Section 3.

    [Fact]
    public async Task MonsterSearchProvider_MatchesAttackName_WhenEntityNameAndDescriptionDoNotMatch()
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

        context.MonsterAttacks.Add(new MonsterAttack
        {
            MonsterId = monster.Id,
            Name = "Fire Breath",
            Description = "Massive lungs capable of a devastating cone of flame.",
            Harm = 3,
        });
        await context.SaveChangesAsync();

        var provider = new MonsterSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("fire breath");
        var results = await provider.SearchAsync(tokens, "fire breath", CancellationToken.None);

        var candidate = Assert.Single(results);
        Assert.Equal(monster.Id, candidate.EntityId);
        Assert.Equal("Attack.Name", candidate.MatchedField);
        Assert.Equal(SearchFieldWeight.Secondary, candidate.Weight);
        Assert.Equal("Fire Breath", candidate.MatchedSubResourceName);
        Assert.NotNull(candidate.Snippet);
        Assert.Contains("fire breath", candidate.Snippet, StringComparison.OrdinalIgnoreCase);

        // End-to-end-ish confirmation of the mapped API contract shape (no WebApplicationFactory
        // integration harness exists in this repo yet - ToDetailResponse() is the mapping the
        // controller itself calls, so this exercises the same code path GET /api/search hits).
        var response = candidate.ToDetailResponse();
        Assert.Equal("Attack.Name", response.MatchedField);
        Assert.Equal("Fire Breath", response.MatchedSubResourceName);
        Assert.NotNull(response.Snippet);
    }

    [Fact]
    public async Task MonsterSearchProvider_SubResourceNameMatch_OutranksEntityDescriptionMatch()
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);

        // Monster.Description matches "phoenix" exactly (Tertiary, tier 4 -> score 100). Attack.Name
        // also matches "phoenix" exactly (Secondary, tier 4 -> score 200). Secondary beats Tertiary
        // even at the same tier - docs/search/architecture.md Section 4 worked-scores table.
        var monster = new Monster
        {
            Name = "Unrelated Name",
            Description = "phoenix",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        context.MonsterAttacks.Add(new MonsterAttack
        {
            MonsterId = monster.Id,
            Name = "phoenix",
            Description = "Unrelated attack description.",
            Harm = 2,
        });
        await context.SaveChangesAsync();

        var provider = new MonsterSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("phoenix");
        var results = await provider.SearchAsync(tokens, "phoenix", CancellationToken.None);

        var candidate = Assert.Single(results);
        Assert.Equal("Attack.Name", candidate.MatchedField);
        Assert.Equal(SearchMatchTier.Exact, candidate.MatchStrength);
        Assert.Equal(SearchFieldWeight.Secondary, candidate.Weight);
        Assert.Equal(200, candidate.Score);
    }

    [Theory]
    [InlineData("Attack", true)]
    [InlineData("Attack", false)]
    [InlineData("Power", true)]
    [InlineData("Power", false)]
    [InlineData("Armor", true)]
    [InlineData("Armor", false)]
    [InlineData("Weakness", true)]
    [InlineData("Weakness", false)]
    public async Task MonsterSearchProvider_PopulatesMatchedSubResourceName_ForEveryKindAndField(
        string kind, bool matchViaName)
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);

        var monster = new Monster
        {
            Name = "Unrelated Name",
            Description = "Unrelated description.",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        const string subResourceName = "Emberclaw Technique";
        const string subResourceDescription = "A shimmering burst of embers scorches the battlefield.";
        AddMonsterSubResource(context, kind, monster.Id, subResourceName, subResourceDescription);
        await context.SaveChangesAsync();

        var query = matchViaName ? "emberclaw" : "shimmering";
        var provider = new MonsterSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize(query);
        var results = await provider.SearchAsync(tokens, query, CancellationToken.None);

        var candidate = Assert.Single(results);
        var expectedField = matchViaName ? $"{kind}.Name" : $"{kind}.Description";
        Assert.Equal(expectedField, candidate.MatchedField);
        Assert.Equal(subResourceName, candidate.MatchedSubResourceName);
        Assert.Equal(
            matchViaName ? SearchFieldWeight.Secondary : SearchFieldWeight.Tertiary,
            candidate.Weight);
    }

    [Fact]
    public async Task MonsterSearchProvider_MultipleMatchingSubResources_StillReturnsOneCandidate_BackedByHighestScore()
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);

        var monster = new Monster
        {
            Name = "Unrelated Name",
            Description = "Unrelated description.",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        // Attack.Name exactly equals the query (tier 4 -> score 200).
        context.MonsterAttacks.Add(new MonsterAttack
        {
            MonsterId = monster.Id,
            Name = "Flare",
            Description = "Unrelated.",
            Harm = 2,
        });
        // Power.Name only boundary-prefix matches the query, not exact/starts-with (tier 2 -> score 100).
        context.MonsterPowers.Add(new MonsterPower
        {
            MonsterId = monster.Id,
            Name = "Ancient Flare Ward",
            Description = "Unrelated.",
        });
        await context.SaveChangesAsync();

        var provider = new MonsterSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("flare");
        var results = await provider.SearchAsync(tokens, "flare", CancellationToken.None);

        var candidate = Assert.Single(results);
        Assert.Equal("Attack.Name", candidate.MatchedField);
        Assert.Equal("Flare", candidate.MatchedSubResourceName);
        Assert.Equal(200, candidate.Score);
    }

    [Fact]
    public async Task MonsterSearchProvider_TermOnlyInCustomMove_ProducesNoMatch()
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);

        var monster = new Monster
        {
            Name = "Unrelated Name",
            Description = "Unrelated description.",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        context.MonsterCustomMoves.Add(new MonsterCustomMove
        {
            MonsterId = monster.Id,
            Name = "Lava Surge",
            Description = "Erupts with molten lava dealing area harm.",
        });
        await context.SaveChangesAsync();

        var provider = new MonsterSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("lava");
        var results = await provider.SearchAsync(tokens, "lava", CancellationToken.None);

        Assert.Empty(results);
    }

    [Fact]
    public async Task MinionSearchProvider_MatchesAttackName_WhenEntityNameAndDescriptionDoNotMatch()
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);
        var minionTypeId = await SeedMinionTypeAsync(context);

        var monster = new Monster
        {
            Name = "Parent Monster",
            Description = "Unrelated.",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var minion = new Minion
        {
            Name = "Grunt",
            Description = "Unrelated description.",
            MonsterId = monster.Id,
            MinionTypeId = minionTypeId,
        };
        context.Minions.Add(minion);
        await context.SaveChangesAsync();

        context.MinionAttacks.Add(new MinionAttack
        {
            MinionId = minion.Id,
            Name = "Rusty Blade",
            Description = "A crude but effective weapon.",
            Harm = 1,
        });
        await context.SaveChangesAsync();

        var provider = new MinionSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("rusty blade");
        var results = await provider.SearchAsync(tokens, "rusty blade", CancellationToken.None);

        var candidate = Assert.Single(results);
        Assert.Equal(minion.Id, candidate.EntityId);
        Assert.Equal("Attack.Name", candidate.MatchedField);
        Assert.Equal(SearchFieldWeight.Secondary, candidate.Weight);
        Assert.Equal("Rusty Blade", candidate.MatchedSubResourceName);
        Assert.NotNull(candidate.Snippet);
    }

    [Fact]
    public async Task MinionSearchProvider_MultipleMatchingSubResources_StillReturnsOneCandidate_BackedByHighestScore()
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);
        var minionTypeId = await SeedMinionTypeAsync(context);

        var monster = new Monster
        {
            Name = "Parent Monster",
            Description = "Unrelated.",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var minion = new Minion
        {
            Name = "Unrelated Name",
            Description = "Unrelated description.",
            MonsterId = monster.Id,
            MinionTypeId = minionTypeId,
        };
        context.Minions.Add(minion);
        await context.SaveChangesAsync();

        context.MinionArmors.Add(new MinionArmor
        {
            MinionId = minion.Id,
            Name = "Frost",
            Description = "Unrelated.",
        });
        context.MinionWeaknesses.Add(new MinionWeakness
        {
            MinionId = minion.Id,
            Name = "Ancient Frostbite",
            Description = "Unrelated.",
        });
        await context.SaveChangesAsync();

        var provider = new MinionSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("frost");
        var results = await provider.SearchAsync(tokens, "frost", CancellationToken.None);

        var candidate = Assert.Single(results);
        Assert.Equal("Armor.Name", candidate.MatchedField);
        Assert.Equal("Frost", candidate.MatchedSubResourceName);
        Assert.Equal(200, candidate.Score);
    }

    [Fact]
    public async Task MinionSearchProvider_TermOnlyInCustomMove_ProducesNoMatch()
    {
        await using var context = await CreateContextAsync();
        var (monsterTypeId, archetypeId) = await SeedMonsterLookupsAsync(context);
        var minionTypeId = await SeedMinionTypeAsync(context);

        var monster = new Monster
        {
            Name = "Parent Monster",
            Description = "Unrelated.",
            MonsterTypeId = monsterTypeId,
            MonsterArchetypeId = archetypeId,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var minion = new Minion
        {
            Name = "Unrelated Name",
            Description = "Unrelated description.",
            MonsterId = monster.Id,
            MinionTypeId = minionTypeId,
        };
        context.Minions.Add(minion);
        await context.SaveChangesAsync();

        context.MinionCustomMoves.Add(new MinionCustomMove
        {
            MinionId = minion.Id,
            Name = "Sludge Toss",
            Description = "Hurls corrosive sludge at a hunter.",
        });
        await context.SaveChangesAsync();

        var provider = new MinionSearchProvider(context);
        var tokens = SearchTokenizer.Tokenize("sludge");
        var results = await provider.SearchAsync(tokens, "sludge", CancellationToken.None);

        Assert.Empty(results);
    }

    private static void AddMonsterSubResource(
        MotwDbContext context, string kind, Guid monsterId, string name, string description)
    {
        switch (kind)
        {
            case "Attack":
                context.MonsterAttacks.Add(new MonsterAttack { MonsterId = monsterId, Name = name, Description = description, Harm = 1 });
                break;
            case "Power":
                context.MonsterPowers.Add(new MonsterPower { MonsterId = monsterId, Name = name, Description = description });
                break;
            case "Armor":
                context.MonsterArmors.Add(new MonsterArmor { MonsterId = monsterId, Name = name, Description = description });
                break;
            case "Weakness":
                context.MonsterWeaknesses.Add(new MonsterWeakness { MonsterId = monsterId, Name = name, Description = description });
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown sub-resource kind.");
        }
    }

    private static async Task<Guid> SeedMinionTypeAsync(MotwDbContext context)
    {
        var minionType = new MinionType { Name = "Thug", Motivation = "To serve." };
        context.MinionTypes.Add(minionType);
        await context.SaveChangesAsync();
        return minionType.Id;
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
