using System.ComponentModel.DataAnnotations;

namespace MonsterOfTheWeek.Api.Contracts;

/*
 * Hunter API contracts — docs/hunter-playbooks/ Phases 9 (list) and 10 (create/edit).
 *
 * One request carries the whole hunter, the same single-endpoint shape Playbook uses and for
 * the same reason: there is nothing here with an independent lifecycle to address separately
 * (architecture.md Section 8). Unlike Playbook, though, the child collections are pure FK
 * bridges rather than owned rows — so they are plain Guid lists, and there is no Id-based diff
 * to perform. The set of ids *is* the state; the service replaces it wholesale.
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

/// <summary>
/// <c>GET /api/hunters/{id}</c>.
///
/// <para>
/// Picks come back as bare id lists rather than expanded rows. That is not laziness about the
/// contract: the only consumer is the edit form, which must load the full
/// <c>PlaybookDetailResponse</c> anyway to render every *available* option, so expanding the
/// selected ones here would duplicate data the client already holds and give it two places to
/// disagree. A future read-only hunter sheet can join the same way the form does.
/// </para>
/// </summary>
/// <summary>
/// One answered Look line. Exactly one of <paramref name="LookOptionId"/> and
/// <paramref name="FreeformText"/> is populated; a line the hunter has not answered simply has
/// no entry rather than an entry with both null.
/// </summary>
public sealed record HunterLookSelectionModel(
    Guid LookCategoryId,
    Guid? LookOptionId,
    string? FreeformText);

/// <summary>Current value of one of the playbook's extra tracks.</summary>
public sealed record HunterExtraTrackValueModel(
    Guid ExtraTrackId,
    int CurrentValue);

/// <summary>
/// <c>Outstanding</c> is what this hunter still owes its playbook, in sheet order — an empty
/// list means ready to play. It is <b>recomputed on every read and never stored</b>: a hunter
/// is live-linked to its playbook, so a persisted flag would be silently falsified the moment
/// the playbook gained a requirement, with nothing touching the hunter to notice. See
/// <see cref="MonsterOfTheWeek.Api.Services.HunterCompleteness"/> for why these are reported
/// rather than refused.
/// </summary>
public sealed record HunterDetailResponse(
    Guid Id,
    string Name,
    string? Pronouns,
    Guid PlaybookId,
    string PlaybookName,
    Guid? PlaybookStatArrayOptionId,
    int Luck,
    int Harm,
    int Experience,
    string? Background,
    IReadOnlyList<Guid> PlaybookMoveIds,
    IReadOnlyList<Guid> PlaybookGearOptionIds,
    IReadOnlyList<HunterLookSelectionModel> Looks,
    IReadOnlyList<HunterExtraTrackValueModel> ExtraTracks,
    IReadOnlyList<string> Outstanding,
    DateTimeOffset CreatedAt);

/// <summary>
/// <c>POST /api/hunters</c> and <c>PUT /api/hunters/{id}</c>.
///
/// <para>
/// The ranges below are only a sanity ceiling — the real bound is the selected Playbook's own
/// <c>LuckBoxCount</c>/<c>HarmBoxCount</c>/<c>ExperienceBoxCount</c>, which model binding cannot
/// see and <c>HunterService</c> therefore checks itself.
/// </para>
///
/// <para>
/// <c>PlaybookId</c> is accepted on update as well as create, and validated the same way, but
/// the edit form disables the control: changing a hunter's playbook invalidates every pick it
/// has, and silently discarding those is not a thing a form should do behind a dropdown. The
/// API stays permissive so a deliberate client can still do it with a consistent payload.
/// </para>
/// </summary>
public sealed record UpsertHunterRequest(
    [param: Required, MinLength(1)] string Name,
    string? Pronouns,
    [param: Required] Guid PlaybookId,
    Guid? PlaybookStatArrayOptionId,
    [param: Range(0, 100)] int Luck,
    [param: Range(0, 100)] int Harm,
    [param: Range(0, 100)] int Experience,
    string? Background,
    IReadOnlyList<Guid>? PlaybookMoveIds,
    IReadOnlyList<Guid>? PlaybookGearOptionIds,
    IReadOnlyList<HunterLookSelectionModel>? Looks,
    IReadOnlyList<HunterExtraTrackValueModel>? ExtraTracks);
