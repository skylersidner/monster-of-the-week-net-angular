using Microsoft.EntityFrameworkCore.Storage;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// Stands in for the real transaction <c>IMonsterRepository.BeginTransactionAsync</c> (and its
/// <b>four</b> siblings — <c>IMysteryRepository</c> gained one in Phase 2 of
/// domain-custom-moves, §3.5) returns, for the fake-repository unit tests that don't exercise a
/// real database.
///
/// <para>
/// For the tests that exercise a real one instead, see
/// <see cref="MonsterImageCleanupTests"/> and <see cref="CustomMoves.OwnerDeleteCleanupTests"/>.
/// <b>This pointer said <c>ResourceImageOwnerDeleteCleanupTests</c>, which has never existed</b>
/// (architecture.md B10) — a cross-reference to a plausible-sounding file name is worse than
/// none, because it reads as checked.
/// </para>
/// </summary>
internal sealed class NoOpDbContextTransaction : IDbContextTransaction
{
    public Guid TransactionId { get; } = Guid.NewGuid();

    public void Commit()
    {
    }

    public void Rollback()
    {
    }

    public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task RollbackAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

    public void Dispose()
    {
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
