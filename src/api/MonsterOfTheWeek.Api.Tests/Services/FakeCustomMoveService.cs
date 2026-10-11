using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.CustomMoves;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// A non-database <see cref="ICustomMoveService"/> for the five domain services'
/// fake-repository unit tests — none of them exercise custom-move behaviour, they just need the
/// new constructor dependency satisfied without reaching for a real <c>MotwDbContext</c>. The
/// real behaviour is covered against SQLite in <c>CustomMoves/CustomMoveServiceTests</c>, and the
/// owner-delete cleanup against SQLite in the per-domain cleanup tests, for the reason
/// <c>MonsterImageCleanupTests</c>' own XML doc gives: a fake cleanup asserted against a fake
/// repository is the implementation agreeing with itself.
///
/// <para>
/// <b>List-backed, not hardcoded-success</b> — the standing rule that a fake must mirror the real
/// one's return semantics, since a hardcoded success makes every round-trip assertion vacuous
/// (<c>toad-fake-repositories-must-mirror-real-return-semantics.md</c>; architecture.md §23
/// item 5 names this file). So:
/// <list type="bullet">
///   <item><see cref="ListAsync"/> and <see cref="CreateAsync"/> return <c>NotFound</c> unless
///   <see cref="OwnerExists"/> is set, because the real service checks the owner on exactly those
///   two methods and in a fake-repository test no owner exists anywhere. Opt-in, matching the
///   <c>FakeMonsterRepository { MysteryExists = true }</c> idiom this suite already uses.</item>
///   <item><see cref="UpdateAsync"/> and <see cref="DeleteAsync"/> run the real
///   <c>(OwnerType, OwnerId, Id)</c> predicate against <see cref="Moves"/> rather than an owner
///   check — including rejecting a move id that belongs to a <i>different</i> owner, which is the
///   guarantee that predicate exists to produce (architecture.md §2.5, §18).</item>
///   <item><see cref="DeleteAllForOwnerAsync"/> both deletes and records, so a test can assert
///   "cleanup happened, for this owner and not another" without a real database.</item>
/// </list>
/// </para>
/// </summary>
internal sealed class FakeCustomMoveService : ICustomMoveService
{
    /// <summary>
    /// Whether the owner the caller names exists. <c>false</c> by default, mirroring an empty
    /// store; the real service answers this with five <c>AnyAsync</c> arms.
    /// </summary>
    public bool OwnerExists { get; init; }

    /// <summary>The store. Seedable, so a test can arrange moves it expects to read back.</summary>
    public List<CustomMove> Moves { get; } = [];

    /// <summary>
    /// What the owner-delete cleanup actually calls, in call order — the one thing worth
    /// recording beyond the store itself.
    /// </summary>
    public List<(CustomMoveOwnerType OwnerType, Guid OwnerId)> DeleteAllForOwnerCalls { get; } = [];

    public async Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> ListAsync(
        CustomMoveOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken)
    {
        if (!OwnerExists)
        {
            return ServiceResult<IReadOnlyList<CustomMoveResponse>>.NotFound($"{ownerType} {ownerId} was not found.");
        }

        return ServiceResult<IReadOnlyList<CustomMoveResponse>>.Success(
            await ListForProjectionAsync(ownerType, ownerId, cancellationToken));
    }

    public Task<ServiceResult<CustomMoveResponse>> CreateAsync(
        CustomMoveOwnerType ownerType, Guid ownerId, UpsertCustomMoveRequest request, CancellationToken cancellationToken)
    {
        if (!OwnerExists)
        {
            return Task.FromResult(ServiceResult<CustomMoveResponse>.NotFound($"{ownerType} {ownerId} was not found."));
        }

        var value = new CustomMove
        {
            OwnerType = ownerType,
            OwnerId = ownerId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
        };

        Moves.Add(value);
        return Task.FromResult(ServiceResult<CustomMoveResponse>.Success(value.ToResponse()));
    }

    public Task<ServiceResult<CustomMoveResponse>> UpdateAsync(
        CustomMoveOwnerType ownerType, Guid ownerId, Guid moveId, UpsertCustomMoveRequest request, CancellationToken cancellationToken)
    {
        var value = Find(ownerType, ownerId, moveId);
        if (value is null)
        {
            return Task.FromResult(ServiceResult<CustomMoveResponse>.NotFound($"Custom move {moveId} was not found."));
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        return Task.FromResult(ServiceResult<CustomMoveResponse>.Success(value.ToResponse()));
    }

    public Task<bool> DeleteAsync(
        CustomMoveOwnerType ownerType, Guid ownerId, Guid moveId, CancellationToken cancellationToken)
    {
        var value = Find(ownerType, ownerId, moveId);
        return Task.FromResult(value is not null && Moves.Remove(value));
    }

    public Task<IReadOnlyList<CustomMoveResponse>> ListForProjectionAsync(
        CustomMoveOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CustomMoveResponse>>(
            Moves
                .Where(x => x.OwnerType == ownerType && x.OwnerId == ownerId)
                .OrderBy(x => x.Name, StringComparer.Ordinal)
                .Select(x => x.ToResponse())
                .ToList());

    public Task DeleteAllForOwnerAsync(
        CustomMoveOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken)
    {
        DeleteAllForOwnerCalls.Add((ownerType, ownerId));
        Moves.RemoveAll(x => x.OwnerType == ownerType && x.OwnerId == ownerId);
        return Task.CompletedTask;
    }

    private CustomMove? Find(CustomMoveOwnerType ownerType, Guid ownerId, Guid moveId) =>
        Moves.FirstOrDefault(x => x.Id == moveId && x.OwnerType == ownerType && x.OwnerId == ownerId);
}
