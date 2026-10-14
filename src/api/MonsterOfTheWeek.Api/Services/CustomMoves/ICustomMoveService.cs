using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Services.CustomMoves;

/// <summary>
/// The single service behind all five owner types' custom moves
/// (<c>docs/domain-custom-moves/architecture.md</c> §3.2). Owner existence/type validation and
/// the ordering all five of the per-domain implementations independently got right live here
/// once, not five times.
///
/// <para>
/// <b>Phase 1 scope: nothing calls this yet.</b> The five per-domain tables, their repository
/// methods and the sixteen shipped controller actions are all untouched and still serve every
/// request. Phase 2 adds <c>CustomMovesController</c>, re-points the five detail projections at
/// <see cref="ListForProjectionAsync"/>, and wires <see cref="DeleteAllForOwnerAsync"/> into the
/// five owner-delete flows; Phase 3 deletes what that orphans.
/// </para>
///
/// <para>
/// <b>Modelled on <c>IResourceImageService</c> with one deliberate difference.</b> That interface
/// returns entities and lets its controller map them, because its actions need raw bytes. This
/// one returns <see cref="CustomMoveResponse"/>, as all five domain services already do — if it
/// returned entities, each of the five detail projections would call <c>.ToResponse()</c> itself,
/// which is five copies of exactly the mapping this rework collapses to one (§18). Not an
/// oversight; do not "correct" it.
/// </para>
/// </summary>
public interface ICustomMoveService
{
    /// <summary>
    /// Every move for this owner, ordered by <c>Name</c> — the ordering all five per-domain
    /// repositories already have, preserved so the Phase 2 switchover is a refactor with a
    /// working oracle. Returns <see cref="ServiceResult{T}.NotFound"/> when the owner itself does
    /// not exist, which is the only reason this method checks the owner at all: without the check
    /// "owner missing" and "owner has no moves" would both be <c>200 []</c>, and the two are
    /// distinguishable on the shipped endpoints today (§16.2, §18).
    /// </summary>
    Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> ListAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Adds one move to this owner. <see cref="ServiceResult{T}.NotFound"/> when the owner does
    /// not exist <i>or is not the type it claims to be</i> — this is the only write path where
    /// nothing else would catch a bogus owner, since there is no FK to reject it (§2.3, §18).
    /// <c>Name</c> is trimmed and <c>Description</c> trimmed-or-null, matching every existing
    /// implementation.
    /// </summary>
    Task<ServiceResult<CustomMoveResponse>> CreateAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        UpsertCustomMoveRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates one move, if and only if it belongs to this owner.
    /// <para>
    /// <b>No separate owner-existence check, deliberately (§18, B8).</b> The
    /// <c>(OwnerType, OwnerId, Id)</c> predicate is strictly stronger than owner existence: it
    /// proves the owner exists <i>and</i> owns this move, and it also rejects a move id belonging
    /// to a different owner of the same type — which is what produces §2.5's closing guarantee.
    /// Adding <c>OwnerExistsAsync</c> in front of it is a second round trip that cannot change
    /// any status code.
    /// </para>
    /// </summary>
    Task<ServiceResult<CustomMoveResponse>> UpdateAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid moveId,
        UpsertCustomMoveRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes one move, if and only if it belongs to this owner. <c>false</c> — which the caller
    /// turns into a 404 — when it does not exist or belongs to someone else. Same predicate, same
    /// reasoning as <see cref="UpdateAsync"/>.
    /// </summary>
    Task<bool> DeleteAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid moveId,
        CancellationToken cancellationToken);

    /// <summary>
    /// The no-owner-check variant the five detail projections use (§3.2). They have demonstrably
    /// just loaded the owner, so re-checking it is a wasted round trip on every detail load, and
    /// on every entity create and update response too — four of the five services funnel those
    /// through <c>GetByIdAsync</c> (B3).
    /// </summary>
    Task<IReadOnlyList<CustomMoveResponse>> ListForProjectionAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes every move for this owner. Called from each of the five owner-delete flows
    /// (§2.4/§19) — including once per minion inside the monster flow, because minion deletion
    /// cascades at the database level and runs no application code. No owner check: the owner is
    /// being destroyed.
    /// <para>
    /// One statement, no tracking, so it participates in the ambient transaction the caller has
    /// already opened. That matters: the five flows clean up <i>before</i> deleting the owner, so
    /// a failure between the two steps without a transaction destroys user data rather than
    /// leaking a row (B10).
    /// </para>
    /// </summary>
    Task DeleteAllForOwnerAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken);
}
