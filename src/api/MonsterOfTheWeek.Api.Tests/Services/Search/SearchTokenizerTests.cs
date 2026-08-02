using MonsterOfTheWeek.Api.Services.Search;

namespace MonsterOfTheWeek.Api.Tests.Services.Search;

public sealed class SearchTokenizerTests
{
    [Fact]
    public void Tokenize_SplitsOnDashes()
    {
        var tokens = SearchTokenizer.Tokenize("self-aware");

        Assert.Equal(["self", "aware"], tokens);
    }

    [Fact]
    public void Tokenize_CollapsesMultipleSpaces()
    {
        var tokens = SearchTokenizer.Tokenize("sto    ann");

        Assert.Equal(["sto", "ann"], tokens);
    }

    [Fact]
    public void Tokenize_MixesSpacesAndDashes()
    {
        var tokens = SearchTokenizer.Tokenize("grave-stone circle");

        Assert.Equal(["grave", "stone", "circle"], tokens);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Tokenize_ReturnsEmpty_ForEmptyOrWhitespaceInput(string? query)
    {
        var tokens = SearchTokenizer.Tokenize(query);

        Assert.Empty(tokens);
    }

    [Fact]
    public void Tokenize_ReturnsEmpty_ForDashOnlyInput()
    {
        var tokens = SearchTokenizer.Tokenize("---");

        Assert.Empty(tokens);
    }

    [Fact]
    public void Tokenize_Lowercases_MixedCaseInput()
    {
        var tokens = SearchTokenizer.Tokenize("StOnE CiRcLe");

        Assert.Equal(["stone", "circle"], tokens);
    }

    [Fact]
    public void ComputeMatchStrength_StoneCircle_MatchesAtStartsWithOrBoundaryPrefixTier()
    {
        var tokens = SearchTokenizer.Tokenize("sto");

        var strength = SearchTokenizer.ComputeMatchStrength("Stone Circle", tokens, "sto");

        Assert.NotNull(strength);
        Assert.True(strength >= SearchMatchTier.BoundaryPrefix);
    }

    [Fact]
    public void ComputeMatchStrength_Ancestor_MatchesAtSubstringTierOnly()
    {
        var tokens = SearchTokenizer.Tokenize("sto");

        var strength = SearchTokenizer.ComputeMatchStrength("Ancestor", tokens, "sto");

        Assert.Equal(SearchMatchTier.Substring, strength);
    }

    [Fact]
    public void ComputeMatchStrength_SubstringMatch_ScoresLowerThanBoundaryPrefixMatch()
    {
        var tokens = SearchTokenizer.Tokenize("sto");

        var ancestorStrength = SearchTokenizer.ComputeMatchStrength("Ancestor", tokens, "sto")!.Value;
        var stoneCircleStrength = SearchTokenizer.ComputeMatchStrength("Stone Circle", tokens, "sto")!.Value;

        Assert.True(ancestorStrength < stoneCircleStrength);
    }

    [Fact]
    public void ComputeMatchStrength_ExactMatch_ReturnsTier4()
    {
        var tokens = SearchTokenizer.Tokenize("sto");

        var strength = SearchTokenizer.ComputeMatchStrength("Sto", tokens, "sto");

        Assert.Equal(SearchMatchTier.Exact, strength);
    }

    [Fact]
    public void ComputeMatchStrength_StartsWithFullField_ReturnsTier3()
    {
        var tokens = SearchTokenizer.Tokenize("sto");

        var strength = SearchTokenizer.ComputeMatchStrength("Stonefall Ridge", tokens, "sto");

        Assert.Equal(SearchMatchTier.StartsWith, strength);
    }

    [Fact]
    public void ComputeMatchStrength_MultiToken_UsesWeakestTierAnyTokenClears()
    {
        // "sto ann" against "Annette's Ancestor": "ann" is boundary-prefix on "Annette",
        // but "sto" is only a mid-word substring of "Ancestor" -> whole field is tier 1.
        var tokens = SearchTokenizer.Tokenize("sto ann");

        var strength = SearchTokenizer.ComputeMatchStrength("Annette's Ancestor", tokens, "sto ann");

        Assert.Equal(SearchMatchTier.Substring, strength);
    }

    [Fact]
    public void ComputeMatchStrength_MultiToken_BothBoundaryPrefix_ReturnsTier2()
    {
        // "sto ann" against "Stone Anne": both tokens hit boundary-prefix on different words.
        var tokens = SearchTokenizer.Tokenize("sto ann");

        var strength = SearchTokenizer.ComputeMatchStrength("Stone Anne", tokens, "sto ann");

        Assert.Equal(SearchMatchTier.BoundaryPrefix, strength);
    }

    [Fact]
    public void ComputeMatchStrength_MultiToken_AndSemantics_RequiresAllTokensToMatch()
    {
        // "sto zzz" - "zzz" never matches "Stone Circle" at any tier, so the whole query fails to match.
        var tokens = SearchTokenizer.Tokenize("sto zzz");

        var strength = SearchTokenizer.ComputeMatchStrength("Stone Circle", tokens, "sto zzz");

        Assert.Null(strength);
    }

    [Fact]
    public void ComputeMatchStrength_ReturnsNull_WhenNoTokensMatch()
    {
        var tokens = SearchTokenizer.Tokenize("xyz");

        var strength = SearchTokenizer.ComputeMatchStrength("Stone Circle", tokens, "xyz");

        Assert.Null(strength);
    }

    [Fact]
    public void ComputeMatchStrength_IgnoresSubstringTier_WhenDisabled()
    {
        var tokens = SearchTokenizer.Tokenize("sto");

        var strength = SearchTokenizer.ComputeMatchStrength("Ancestor", tokens, "sto", includeSubstringTier: false);

        Assert.Null(strength);
    }

    // --- PickBestMatch (Phase 4a) ---

    [Fact]
    public void PickBestMatch_ReturnsNull_WhenNoFieldMatches()
    {
        var tokens = SearchTokenizer.Tokenize("xyz");
        var fields = new[]
        {
            new SearchTokenizer.CandidateField("Name", "Grimtooth", SearchFieldWeight.Primary, AllowSubstringTier: true),
            new SearchTokenizer.CandidateField("Description", "A lurking horror.", SearchFieldWeight.Tertiary, AllowSubstringTier: false),
        };

        var match = SearchTokenizer.PickBestMatch(fields, tokens, "xyz");

        Assert.Null(match);
    }

    [Fact]
    public void PickBestMatch_SkipsNullOrEmptyFields()
    {
        var tokens = SearchTokenizer.Tokenize("sto");
        var fields = new[]
        {
            new SearchTokenizer.CandidateField("Description", null, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
            new SearchTokenizer.CandidateField("Concept", string.Empty, SearchFieldWeight.Tertiary, AllowSubstringTier: false),
            new SearchTokenizer.CandidateField("Name", "Stonefall Ridge", SearchFieldWeight.Primary, AllowSubstringTier: true),
        };

        var match = SearchTokenizer.PickBestMatch(fields, tokens, "sto");

        Assert.NotNull(match);
        Assert.Equal("Name", match.Value.FieldName);
    }

    [Fact]
    public void PickBestMatch_WeakNameMatch_OutscoresStrongDescriptionMatch()
    {
        // Name (Primary=100) at boundary-prefix tier (2) scores 200; Description (Tertiary=25) at the
        // strongest possible tier, exact (4), only scores 100. Primary's weight advantage means even a
        // comparatively weak Name match beats a maximally strong Description match on the same query.
        var tokens = SearchTokenizer.Tokenize("sto");
        var fields = new[]
        {
            new SearchTokenizer.CandidateField("Name", "The Stonefall Ridge", SearchFieldWeight.Primary, AllowSubstringTier: true),
            new SearchTokenizer.CandidateField("Description", "Sto", SearchFieldWeight.Tertiary, AllowSubstringTier: false),
        };

        var match = SearchTokenizer.PickBestMatch(fields, tokens, "sto");

        Assert.NotNull(match);
        Assert.Equal("Name", match.Value.FieldName);
        Assert.Equal(SearchMatchTier.BoundaryPrefix, match.Value.MatchStrength);
        Assert.Equal(SearchFieldWeight.Primary, match.Value.Weight);
    }

    [Fact]
    public void PickBestMatch_SubstringTierNeverFires_ForFieldsWithAllowSubstringTierFalse()
    {
        // "sto" only matches "Ancestor" mid-word (substring tier) - disallowed for long-text fields.
        var tokens = SearchTokenizer.Tokenize("sto");
        var fields = new[]
        {
            new SearchTokenizer.CandidateField("Description", "An ancestor's tale.", SearchFieldWeight.Tertiary, AllowSubstringTier: false),
        };

        var match = SearchTokenizer.PickBestMatch(fields, tokens, "sto");

        Assert.Null(match);
    }

    [Fact]
    public void PickBestMatch_SubstringTierStillFires_WhenAllowed()
    {
        var tokens = SearchTokenizer.Tokenize("sto");
        var fields = new[]
        {
            new SearchTokenizer.CandidateField("Name", "Ancestor", SearchFieldWeight.Primary, AllowSubstringTier: true),
        };

        var match = SearchTokenizer.PickBestMatch(fields, tokens, "sto");

        Assert.NotNull(match);
        Assert.Equal(SearchMatchTier.Substring, match.Value.MatchStrength);
    }

    [Fact]
    public void PickBestMatch_ReturnsHighestScoringLongTextField_WhenMultipleMatch()
    {
        var tokens = SearchTokenizer.Tokenize("obsidian");
        var fields = new[]
        {
            new SearchTokenizer.CandidateField("Concept", "Involves an obsidian relic, distantly mentioned.", SearchFieldWeight.Tertiary, AllowSubstringTier: false), // boundary-prefix
            new SearchTokenizer.CandidateField("Hook", "Obsidian", SearchFieldWeight.Tertiary, AllowSubstringTier: false), // exact
        };

        var match = SearchTokenizer.PickBestMatch(fields, tokens, "obsidian");

        Assert.NotNull(match);
        Assert.Equal("Hook", match.Value.FieldName);
        Assert.Equal(SearchMatchTier.Exact, match.Value.MatchStrength);
    }

    [Fact]
    public void PickBestMatch_TiesBrokenByFieldOrder_FirstListedWins()
    {
        // Both fields match at the same tier/weight (equal score) - the field listed first wins,
        // deterministically, since PickBestMatch only replaces the current best on a strictly higher score.
        var tokens = SearchTokenizer.Tokenize("obsidian");
        var fields = new[]
        {
            new SearchTokenizer.CandidateField("Concept", "Obsidian", SearchFieldWeight.Tertiary, AllowSubstringTier: false),
            new SearchTokenizer.CandidateField("Hook", "Obsidian", SearchFieldWeight.Tertiary, AllowSubstringTier: false),
        };

        var match = SearchTokenizer.PickBestMatch(fields, tokens, "obsidian");

        Assert.NotNull(match);
        Assert.Equal("Concept", match.Value.FieldName);
    }
}
