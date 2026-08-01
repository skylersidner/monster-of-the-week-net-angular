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
}
