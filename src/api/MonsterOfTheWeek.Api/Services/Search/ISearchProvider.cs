namespace MonsterOfTheWeek.Api.Services.Search;

/// <summary>
/// Relative weight of the field a search match was found on. Phase 1 only ever produces
/// <see cref="Primary"/> matches (an entity's own Name); Secondary/Tertiary are reserved for
/// Phase 4+ (sub-resource Name fields and long free text respectively) so the ranking formula
/// does not need to change when those land.
/// </summary>
public enum SearchFieldWeight
{
    Primary = 100,
    Secondary = 50,
    Tertiary = 25
}

/// <summary>
/// One highlightable occurrence within a <see cref="SearchMatchCandidate.Snippet"/>, expressed as an
/// offset/length pair local to the <c>Snippet</c> string itself (including any leading "…").
/// </summary>
public sealed record SearchMatchSpan(int Start, int Length);

/// <summary>
/// A single entity's best match for a search query, as produced by one <see cref="ISearchProvider"/>.
/// </summary>
/// <param name="EntityType">"Mystery" | "Monster" | "Minion" | "Location" | "Bystander".</param>
/// <param name="EntityId">The matched entity's own id.</param>
/// <param name="Name">The entity's display name (always the entity's own Name, even for Phase 4+ sub-resource matches).</param>
/// <param name="MatchedField">
/// The field that matched: a bare field name for entity-level fields ("Name", "Description", "Concept",
/// "Hook", "Overview", "Notes"), or "{Kind}.{Field}" for sub-resource fields (Phase 4b, not yet produced
/// by any provider in Phase 4a).
/// </param>
/// <param name="MatchedSubResourceName">
/// The matched sub-resource instance's own Name (e.g. "Fire Breath"), when <paramref name="MatchedField"/>
/// is a sub-resource field. Always null in Phase 4a — populated starting Phase 4b.
/// </param>
/// <param name="MatchStrength">1 (substring) .. 4 (exact) — see <see cref="SearchTokenizer"/>.</param>
/// <param name="Weight">The weight tag of the matched field.</param>
/// <param name="ExcerptSource">
/// Raw (untruncated) per-domain excerpt source text, e.g. a Mystery's Hook/Concept/Overview/Notes fallback
/// chain or a Monster/Minion/Location/Bystander's Description. Not part of the public API contract — used
/// internally to build <c>SearchResultDetailResponse.Excerpt</c> for the paginated `/api/search` endpoint
/// only; `/api/search/quick` never reads it.
/// </param>
/// <param name="Snippet">
/// Windowed, highlight-span-annotated text taken from the matched field's own content — null whenever
/// <paramref name="MatchedField"/> is "Name" (the title already shows that match; see
/// docs/search/architecture.md Section 7).
/// </param>
/// <param name="MatchSpans">Offsets into <paramref name="Snippet"/> — empty when Snippet is null.</param>
public sealed record SearchMatchCandidate(
    string EntityType,
    Guid EntityId,
    string Name,
    string MatchedField,
    string? MatchedSubResourceName,
    int MatchStrength,
    SearchFieldWeight Weight,
    string? ExcerptSource,
    string? Snippet,
    IReadOnlyList<SearchMatchSpan> MatchSpans)
{
    public int Score => MatchStrength * (int)Weight;
}

/// <summary>
/// One implementation per searchable domain (Mystery/Monster/Minion/Location/Bystander). Each queries
/// <c>MotwDbContext</c> directly for that domain's Name field (Phase 1) and, in future phases, additional
/// fields/sub-resources — see docs/search/architecture.md Section 3.
/// </summary>
public interface ISearchProvider
{
    string EntityType { get; }

    Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
        IReadOnlyList<string> tokens, string rawQuery, CancellationToken cancellationToken);
}
