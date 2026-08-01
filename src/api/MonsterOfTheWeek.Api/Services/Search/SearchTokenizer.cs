using System.Text.RegularExpressions;

namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// The four match tiers, weakest to strongest — see docs/search/architecture.md Section 2.
/// </summary>
public static class SearchMatchTier
{
    public const int Substring = 1;
    public const int BoundaryPrefix = 2;
    public const int StartsWith = 3;
    public const int Exact = 4;
}

/// <summary>
/// Query tokenization plus the shared four-tier field-matching logic used by every
/// <see cref="ISearchProvider"/>, so each provider stays a thin query rather than
/// re-implementing tier logic five times.
/// </summary>
public static partial class SearchTokenizer
{
    /// <summary>
    /// Splits a raw query on one-or-more whitespace/dash characters, trims, lowercases, and drops
    /// empty tokens. <c>"sto ann"</c> -&gt; <c>["sto", "ann"]</c>. <c>"self-aware"</c> -&gt; <c>["self", "aware"]</c>.
    /// </summary>
    public static IReadOnlyList<string> Tokenize(string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return [];
        }

        return TokenSplitRegex()
            .Split(query.Trim())
            .Select(token => token.Trim().ToLowerInvariant())
            .Where(token => token.Length > 0)
            .ToList();
    }

    /// <summary>Tier 1 (weakest): token appears anywhere in the field, case-insensitive.</summary>
    public static bool SubstringMatches(string field, string token) =>
        field.Contains(token, StringComparison.OrdinalIgnoreCase);

    /// <summary>Tier 2: token matches at the start of the field, or immediately after a space or dash.</summary>
    public static bool BoundaryPrefixMatches(string field, string token) =>
        field.StartsWith(token, StringComparison.OrdinalIgnoreCase)
        || field.Contains(" " + token, StringComparison.OrdinalIgnoreCase)
        || field.Contains("-" + token, StringComparison.OrdinalIgnoreCase);

    /// <summary>Tier 3: the field starts with the full raw (untokenized) query string.</summary>
    public static bool StartsWithMatches(string field, string rawQuery) =>
        field.StartsWith(rawQuery, StringComparison.OrdinalIgnoreCase);

    /// <summary>Tier 4 (strongest): the field case-insensitively equals the full raw query string.</summary>
    public static bool ExactMatches(string field, string rawQuery) =>
        string.Equals(field, rawQuery, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Resolves a field's overall match strength (1-4) for a multi-token query, or <c>null</c> if the
    /// field does not match. Every token must clear at least the substring tier (AND across tokens);
    /// the field's tier is the <em>weakest</em> tier that every token clears — see
    /// docs/search/architecture.md Section 2 for the worked "sto ann" example.
    /// </summary>
    /// <param name="includeSubstringTier">
    /// Substring matching only applies to Name-style fields (Primary/Secondary weight) — never to long
    /// free text (Tertiary weight, Phase 4+). Defaults to true since Phase 1 only ever matches Name.
    /// </param>
    public static int? ComputeMatchStrength(
        string? field,
        IReadOnlyList<string> tokens,
        string rawQuery,
        bool includeSubstringTier = true)
    {
        if (string.IsNullOrEmpty(field) || tokens.Count == 0)
        {
            return null;
        }

        int tier;
        if (tokens.All(token => BoundaryPrefixMatches(field, token)))
        {
            tier = SearchMatchTier.BoundaryPrefix;
        }
        else if (includeSubstringTier && tokens.All(token => SubstringMatches(field, token)))
        {
            tier = SearchMatchTier.Substring;
        }
        else
        {
            return null;
        }

        if (tier == SearchMatchTier.BoundaryPrefix)
        {
            var trimmedRawQuery = rawQuery.Trim();
            if (ExactMatches(field, trimmedRawQuery))
            {
                return SearchMatchTier.Exact;
            }

            if (StartsWithMatches(field, trimmedRawQuery))
            {
                return SearchMatchTier.StartsWith;
            }
        }

        return tier;
    }

    [GeneratedRegex(@"[\s-]+")]
    private static partial Regex TokenSplitRegex();
}
