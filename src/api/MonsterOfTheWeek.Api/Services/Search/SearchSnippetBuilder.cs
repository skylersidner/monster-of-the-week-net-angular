namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Builds a windowed, highlight-span-annotated snippet from a single matched field's raw text — see
/// docs/search/architecture.md Section 7 for the full algorithm and rationale.
/// </summary>
public static class SearchSnippetBuilder
{
    /// <summary>Characters of context kept on each side of the matched position.</summary>
    private const int WindowRadius = 70;

    /// <summary>
    /// Builds a windowed snippet around the match in <paramref name="fieldText"/>, plus every visible
    /// query-token occurrence within that window as merged, non-overlapping spans local to the returned
    /// snippet string (offsets account for a leading "…" when present).
    /// </summary>
    /// <param name="fieldText">The full, untruncated text of the field that matched.</param>
    /// <param name="tokens">The tokenized query (see <see cref="SearchTokenizer.Tokenize"/>).</param>
    /// <param name="matchStrength">
    /// The winning field's overall match tier (1-4, <see cref="SearchMatchTier"/>) — determines anchor
    /// placement: start-of-field for StartsWith/Exact, earliest qualifying token occurrence for
    /// BoundaryPrefix/Substring.
    /// </param>
    public static (string Snippet, IReadOnlyList<SearchMatchSpan> Spans) Build(
        string fieldText, IReadOnlyList<string> tokens, int matchStrength)
    {
        if (string.IsNullOrEmpty(fieldText) || tokens.Count == 0)
        {
            return (string.Empty, []);
        }

        var (anchor, matchLength) = FindAnchor(fieldText, tokens, matchStrength);

        var rawStart = Math.Max(0, anchor - WindowRadius);
        var rawEnd = Math.Min(fieldText.Length, anchor + matchLength + WindowRadius);
        if (rawEnd < rawStart)
        {
            rawEnd = rawStart;
        }

        var (trimmedStart, trimmedEnd) = TrimToWordBoundaries(fieldText, rawStart, rawEnd);

        var hasLeadingEllipsis = trimmedStart > 0;
        var hasTrailingEllipsis = trimmedEnd < fieldText.Length;

        var snippet =
            (hasLeadingEllipsis ? "…" : string.Empty)
            + fieldText[trimmedStart..trimmedEnd]
            + (hasTrailingEllipsis ? "…" : string.Empty);

        return (snippet, FindSpans(snippet, tokens));
    }

    /// <summary>
    /// StartsWith/Exact (3/4): anchor at the field's start — the match is the field's start or the whole
    /// field. BoundaryPrefix/Substring (2/1): anchor at the earliest case-insensitive occurrence, among
    /// all tokens, of a match satisfying whichever tier won (leftmost-wins tiebreak).
    /// </summary>
    private static (int Anchor, int MatchLength) FindAnchor(
        string fieldText, IReadOnlyList<string> tokens, int matchStrength)
    {
        if (matchStrength is SearchMatchTier.StartsWith or SearchMatchTier.Exact)
        {
            // Tokens were split on whitespace/dashes, so the original separator characters between
            // them can't be reconstructed exactly from tokens alone; approximate the matched raw-query
            // span with single-space joins between tokens (exact for the common case, and close enough
            // otherwise — this only affects how much trailing context follows the match, never whether
            // the match itself is correct).
            var approxLength = tokens.Sum(token => token.Length) + Math.Max(0, tokens.Count - 1);
            return (0, Math.Min(approxLength, fieldText.Length));
        }

        var best = (Anchor: -1, Length: 0);
        foreach (var token in tokens)
        {
            var index = matchStrength == SearchMatchTier.BoundaryPrefix
                ? FindBoundaryPrefixIndex(fieldText, token)
                : fieldText.IndexOf(token, StringComparison.OrdinalIgnoreCase);

            if (index >= 0 && (best.Anchor == -1 || index < best.Anchor))
            {
                best = (index, token.Length);
            }
        }

        // Every token is guaranteed to clear whichever tier `matchStrength` reports (that's how
        // SearchTokenizer.ComputeMatchStrength derives the field's overall tier), so this should always
        // find a hit; the 0-length fallback only guards a caller passing an inconsistent matchStrength.
        return best.Anchor == -1 ? (0, 0) : best;
    }

    /// <summary>
    /// First index at or after position 0 where <paramref name="token"/> appears at a word boundary
    /// (field start, or immediately after a space/dash) — mirrors
    /// <see cref="SearchTokenizer.BoundaryPrefixMatches"/> but returns the position instead of a bool.
    /// </summary>
    private static int FindBoundaryPrefixIndex(string fieldText, string token)
    {
        var searchStart = 0;
        while (searchStart >= 0 && searchStart <= fieldText.Length)
        {
            var index = fieldText.IndexOf(token, searchStart, StringComparison.OrdinalIgnoreCase);
            if (index < 0)
            {
                return -1;
            }

            if (index == 0 || fieldText[index - 1] == ' ' || fieldText[index - 1] == '-')
            {
                return index;
            }

            searchStart = index + 1;
        }

        return -1;
    }

    /// <summary>
    /// Trims a raw [start, end) window back to the nearest word boundary on each edge that was actually
    /// cut short of the field's true start/end — mirrors the trailing-edge technique
    /// <c>ApiMappers.TruncateExcerpt</c> already uses for the fixed <c>Excerpt</c> field, applied to both
    /// edges here. Falls back to the raw (untrimmed) cut on an edge if no space is found to trim back to
    /// (e.g. one very long unbroken "word").
    /// </summary>
    private static (int Start, int End) TrimToWordBoundaries(string fieldText, int rawStart, int rawEnd)
    {
        var start = rawStart;
        if (rawStart > 0 && rawEnd > rawStart)
        {
            var nextSpace = fieldText.IndexOf(' ', rawStart, rawEnd - rawStart);
            if (nextSpace >= 0)
            {
                start = nextSpace + 1;
            }
        }

        var end = rawEnd;
        if (rawEnd < fieldText.Length && rawEnd > start)
        {
            var lastSpace = fieldText.LastIndexOf(' ', rawEnd - 1, rawEnd - start);
            if (lastSpace >= start)
            {
                end = lastSpace;
            }
        }

        // If trimming collapsed the window (e.g. the whole window is a single very long word), fall
        // back to the untrimmed raw cut rather than returning an empty/inverted window.
        if (end <= start)
        {
            return (rawStart, rawEnd);
        }

        return (start, end);
    }

    /// <summary>
    /// Case-insensitive <c>IndexOf</c> per query token within the final snippet text — every literal
    /// occurrence, not gated by which tier "won" the overall field match — with overlapping/adjacent
    /// spans merged into single contiguous spans, sorted, non-overlapping.
    /// </summary>
    private static IReadOnlyList<SearchMatchSpan> FindSpans(string snippet, IReadOnlyList<string> tokens)
    {
        var rawSpans = new List<SearchMatchSpan>();
        foreach (var token in tokens)
        {
            if (token.Length == 0)
            {
                continue;
            }

            var searchStart = 0;
            while (searchStart <= snippet.Length)
            {
                var index = snippet.IndexOf(token, searchStart, StringComparison.OrdinalIgnoreCase);
                if (index < 0)
                {
                    break;
                }

                rawSpans.Add(new SearchMatchSpan(index, token.Length));
                searchStart = index + 1;
            }
        }

        if (rawSpans.Count == 0)
        {
            return [];
        }

        var merged = new List<SearchMatchSpan>();
        foreach (var span in rawSpans.OrderBy(s => s.Start).ThenByDescending(s => s.Length))
        {
            if (merged.Count > 0)
            {
                var last = merged[^1];
                var lastEnd = last.Start + last.Length;
                if (span.Start <= lastEnd)
                {
                    var newEnd = Math.Max(lastEnd, span.Start + span.Length);
                    merged[^1] = last with { Length = newEnd - last.Start };
                    continue;
                }
            }

            merged.Add(span);
        }

        return merged;
    }
}
