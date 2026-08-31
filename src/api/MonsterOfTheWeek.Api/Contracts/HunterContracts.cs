namespace MonsterOfTheWeek.Api.Contracts;

/*
 * Hunter API contracts — Phase 9 of docs/hunter-playbooks/.
 *
 * List shape only. UpsertHunterRequest/HunterDetailResponse are Phase 10's delivery, along with
 * the child collections in architecture.md Section 3.
 */

/// <summary>
/// One row of <c>GET /api/hunters</c>.
///
/// <para>
/// <c>PlaybookName</c> is denormalised into the row for the same reason
/// <see cref="BystanderListItemResponse"/> carries <c>BystanderTypeName</c> — the list renders
/// it directly, and making the client resolve it would mean a second request purely to label
/// rows it already has.
/// </para>
/// </summary>
public sealed record HunterListItemResponse(
    Guid Id,
    string Name,
    Guid PlaybookId,
    string PlaybookName,
    DateTimeOffset CreatedAt);
