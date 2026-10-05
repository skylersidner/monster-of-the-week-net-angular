using Microsoft.EntityFrameworkCore.Storage;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// Stands in for the real transaction <c>IMonsterRepository.BeginTransactionAsync</c> (and its
/// three siblings) returns, for the fake-repository unit tests that don't exercise a real
/// database — see <c>ResourceImageOwnerDeleteCleanupTests</c> for the test that exercises a real
/// one instead.
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
