using Microsoft.EntityFrameworkCore.Diagnostics;

namespace MonsterOfTheWeek.Api.Tests.Services.ResourceImages;

/// <summary>
/// Counts real <c>SaveChangesAsync</c> calls against the database, the only way to prove "one
/// call for the whole batch, not one per file" (phases.md Phase 2) against a real
/// <see cref="Microsoft.EntityFrameworkCore.DbContext"/> rather than a fake repository with its
/// own counter.
/// </summary>
internal sealed class SaveChangesCountInterceptor : SaveChangesInterceptor
{
    public int Count { get; private set; }

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Count++;
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Count++;
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }
}
