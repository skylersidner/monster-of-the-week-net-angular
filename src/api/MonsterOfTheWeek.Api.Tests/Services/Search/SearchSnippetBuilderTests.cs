using MonsterOfTheWeek.Api.Services.Search;

namespace MonsterOfTheWeek.Api.Tests.Services.Search;

public sealed class SearchSnippetBuilderTests
{
    [Fact]
    public void Build_EmptyField_ReturnsEmptySnippetAndNoSpans()
    {
        var (snippet, spans) = SearchSnippetBuilder.Build(string.Empty, ["beacon"], SearchMatchTier.Exact);

        Assert.Equal(string.Empty, snippet);
        Assert.Empty(spans);
    }

    [Fact]
    public void Build_NoTokens_ReturnsEmptySnippetAndNoSpans()
    {
        var (snippet, spans) = SearchSnippetBuilder.Build("Some field text.", [], SearchMatchTier.Exact);

        Assert.Equal(string.Empty, snippet);
        Assert.Empty(spans);
    }

    // --- Window radius: exactly 70 characters each side ---

    [Fact]
    public void Build_ExactTier_FieldExactlyFillsWindow_NoTrailingEllipsis()
    {
        // "beacon" (6 chars) + 70 filler chars = 76 = matchLength(6) + WindowRadius(70) -> the window
        // exactly reaches the field's true end, so no truncation/ellipsis should occur.
        var field = "beacon" + new string('x', 70);

        var (snippet, _) = SearchSnippetBuilder.Build(field, ["beacon"], SearchMatchTier.Exact);

        Assert.Equal(field, snippet);
        Assert.DoesNotContain("…", snippet);
    }

    [Fact]
    public void Build_ExactTier_FieldOneCharBeyondWindow_TrailingEllipsisAtExactRadius()
    {
        // One character longer than the previous case -> the window can no longer reach the field's
        // true end, so a trailing "…" must appear, and the content itself is unchanged (no spaces in
        // the filler to trim back to, so the cut lands exactly at the 70-char radius).
        var field = "beacon" + new string('x', 71);

        var (snippet, _) = SearchSnippetBuilder.Build(field, ["beacon"], SearchMatchTier.Exact);

        Assert.Equal(field[..76] + "…", snippet);
    }

    [Fact]
    public void Build_SubstringTier_LeadingContextExactlyFillsWindow_NoLeadingEllipsis()
    {
        // 70 filler chars before the match exactly fills the left window -> no leading ellipsis.
        var field = new string('x', 70) + "beacon";

        var (snippet, _) = SearchSnippetBuilder.Build(field, ["beacon"], SearchMatchTier.Substring);

        Assert.Equal(field, snippet);
        Assert.DoesNotContain("…", snippet);
    }

    [Fact]
    public void Build_SubstringTier_LeadingContextOneCharBeyondWindow_LeadingEllipsisAtExactRadius()
    {
        var field = new string('x', 71) + "beacon";

        var (snippet, _) = SearchSnippetBuilder.Build(field, ["beacon"], SearchMatchTier.Substring);

        Assert.Equal("…" + field[1..], snippet);
    }

    // --- Anchor selection: all 4 tiers ---

    [Fact]
    public void Build_ExactTier_AnchorsAtFieldStart()
    {
        var field = "Beacon";

        var (snippet, spans) = SearchSnippetBuilder.Build(field, ["beacon"], SearchMatchTier.Exact);

        Assert.Equal("Beacon", snippet);
        Assert.Equal([new SearchMatchSpan(0, 6)], spans);
    }

    [Fact]
    public void Build_StartsWithTier_AnchorsAtFieldStart_ShowsTrailingContextNoLeadingEllipsis()
    {
        var field = "Beacon Hill overlooks the harbor and has watched over sailors for three hundred years " +
                     "or more, its light never once going dark even in the worst storms anyone can recall.";

        var (snippet, spans) = SearchSnippetBuilder.Build(field, ["beacon"], SearchMatchTier.StartsWith);

        Assert.StartsWith("Beacon", snippet);
        Assert.False(snippet.StartsWith('…'));
        Assert.EndsWith("…", snippet);
        Assert.NotEmpty(spans);
        Assert.Equal("beacon", snippet.Substring(spans[0].Start, spans[0].Length), ignoreCase: true);
    }

    [Fact]
    public void Build_BoundaryPrefixTier_AnchorsAtEarliestQualifyingTokenOccurrence()
    {
        var words = Enumerable.Range(0, 60).Select(i => $"zz{i:D4}").ToList();
        words[30] = "NEEDLE";
        var field = string.Join(' ', words);

        var (snippet, spans) = SearchSnippetBuilder.Build(field, ["needle"], SearchMatchTier.BoundaryPrefix);

        AssertContentAlignsWithWordBoundaries(field, snippet);
        Assert.Contains("NEEDLE", snippet);
        Assert.StartsWith("…", snippet);
        Assert.EndsWith("…", snippet);
        Assert.Contains(spans, s => string.Equals(snippet.Substring(s.Start, s.Length), "NEEDLE", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Build_SubstringTier_AnchorsAtEarliestMidWordOccurrence()
    {
        // "sto" only appears mid-word, inside "Ancestor" - substring tier still needs a legible anchor.
        var field = new string('x', 100) + " The ancestor's tomb lies beyond the ridge, untouched for generations. " + new string('y', 100);

        var (snippet, spans) = SearchSnippetBuilder.Build(field, ["sto"], SearchMatchTier.Substring);

        Assert.Contains("sto", snippet, StringComparison.OrdinalIgnoreCase);
        Assert.StartsWith("…", snippet);
        Assert.NotEmpty(spans);
    }

    [Fact]
    public void Build_MultiToken_UsesLeftmostQualifyingOccurrenceAsAnchor()
    {
        // Two boundary-prefix tokens; "ann" occurs (as a word) before "sto" does - the anchor should be
        // the leftmost of the two, not simply the first token in the list.
        var field = new string('x', 90) + " Anne found the stone circle just past the old mill. " + new string('y', 90);

        var (snippet, _) = SearchSnippetBuilder.Build(field, ["sto", "ann"], SearchMatchTier.BoundaryPrefix);

        Assert.Contains("Anne", snippet);
    }

    // --- Word-boundary trimming + ellipsis placement ---

    [Fact]
    public void Build_TrimsBothEdgesToWordBoundaries_WhenWindowCutsMidField()
    {
        var words = Enumerable.Range(0, 80).Select(i => $"zz{i:D4}").ToList();
        words[40] = "NEEDLE";
        var field = string.Join(' ', words);

        var (snippet, _) = SearchSnippetBuilder.Build(field, ["needle"], SearchMatchTier.BoundaryPrefix);

        AssertContentAlignsWithWordBoundaries(field, snippet);
    }

    [Fact]
    public void Build_FallsBackToRawCut_WhenNoSpaceAvailableToTrimTo()
    {
        // One unbroken 301-char "word" with the match in the middle - there's nothing to trim back to
        // on either side, so both cuts land exactly at the raw window boundary rather than throwing or
        // collapsing to nothing.
        var field = new string('a', 150) + "b" + new string('a', 150);

        var (snippet, _) = SearchSnippetBuilder.Build(field, ["b"], SearchMatchTier.Substring);

        Assert.StartsWith("…", snippet);
        Assert.EndsWith("…", snippet);
        Assert.True(snippet.Length > 0);
    }

    [Fact]
    public void Build_NeverAddsEllipsis_WhenWindowAlreadyReachesFieldBoundary()
    {
        var field = "A short field with beacon right in it.";

        var (snippet, _) = SearchSnippetBuilder.Build(field, ["beacon"], SearchMatchTier.BoundaryPrefix);

        Assert.Equal(field, snippet);
        Assert.DoesNotContain("…", snippet);
    }

    // --- Span-finding + merging ---

    [Fact]
    public void Build_FindsMultipleDistinctTokenSpans_WithinOneWindow()
    {
        var field = "Anne found the stone circle just past the old mill.";

        var (snippet, spans) = SearchSnippetBuilder.Build(field, ["sto", "ann"], SearchMatchTier.BoundaryPrefix);

        Assert.Equal(2, spans.Count);
        var texts = spans.Select(s => snippet.Substring(s.Start, s.Length).ToLowerInvariant()).OrderBy(x => x).ToList();
        Assert.Equal(["ann", "sto"], texts);
        // Sorted, non-overlapping, in reading order.
        Assert.True(spans[0].Start < spans[1].Start);
        Assert.True(spans[0].Start + spans[0].Length <= spans[1].Start);
    }

    [Fact]
    public void Build_MergesOverlappingSpans()
    {
        var field = "Stonefall Ridge";

        var (snippet, spans) = SearchSnippetBuilder.Build(field, ["sto", "stone"], SearchMatchTier.BoundaryPrefix);

        // "sto" (0-3) and "stone" (0-5) both start at 0 and overlap -> merge into a single (0, 5) span.
        var single = Assert.Single(spans);
        Assert.Equal(0, single.Start);
        Assert.Equal(5, single.Length);
        Assert.Equal("stone", snippet.Substring(single.Start, single.Length), ignoreCase: true);
    }

    [Fact]
    public void Build_MergesAdjacentSpans()
    {
        var field = "Stonefall Ridge";

        var (snippet, spans) = SearchSnippetBuilder.Build(field, ["stone", "fall"], SearchMatchTier.BoundaryPrefix);

        // "stone" (0-5) and "fall" (5-9) touch exactly at index 5 -> merge into a single (0, 9) span.
        var single = Assert.Single(spans);
        Assert.Equal(0, single.Start);
        Assert.Equal(9, single.Length);
        Assert.Equal("stonefall", snippet.Substring(single.Start, single.Length), ignoreCase: true);
    }

    [Fact]
    public void Build_DoesNotMergeSpans_SeparatedByAGap()
    {
        var field = "Stonefall then a gap then Ridge";

        var (snippet, spans) = SearchSnippetBuilder.Build(field, ["stonefall", "ridge"], SearchMatchTier.BoundaryPrefix);

        Assert.Equal(2, spans.Count);
    }

    /// <summary>
    /// The snippet's un-ellipsized content must be an exact substring of the field, and — whenever an
    /// ellipsis is present on a given edge — the character immediately outside that edge in the original
    /// field must be a space (i.e. the cut landed on a real word boundary, not mid-word).
    /// </summary>
    private static void AssertContentAlignsWithWordBoundaries(string field, string snippet)
    {
        var content = snippet;
        var hasLeading = content.StartsWith('…');
        var hasTrailing = content.EndsWith('…');
        if (hasLeading)
        {
            content = content[1..];
        }

        if (hasTrailing)
        {
            content = content[..^1];
        }

        var index = field.IndexOf(content, StringComparison.Ordinal);
        Assert.True(index >= 0, "snippet content must be an exact substring of the field");

        if (hasLeading)
        {
            Assert.True(index > 0);
            Assert.Equal(' ', field[index - 1]);
        }

        if (hasTrailing)
        {
            var endIndex = index + content.Length;
            Assert.True(endIndex < field.Length);
            Assert.Equal(' ', field[endIndex]);
        }
    }
}
