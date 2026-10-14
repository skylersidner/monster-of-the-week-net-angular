using Microsoft.EntityFrameworkCore.Storage;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IMysteryRepository
{
    Task<IReadOnlyList<Mystery>> GetMysteriesForListAsync(CancellationToken cancellationToken);
    Task<Mystery?> GetMysteryDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken);
    Task AddMysteryAsync(Mystery mystery, CancellationToken cancellationToken);
    Task<int> DeleteMysteryAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> MysteryExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> AdventureTypeExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<Countdown?> GetCountdownByMysteryIdAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken);
    Task AddCountdownAsync(Countdown countdown, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// The last of the five repositories to get one (domain-custom-moves/architecture.md §3.5,
    /// B10): <see cref="MonsterOfTheWeek.Api.Services.MysteryService.DeleteAsync"/> needs the
    /// Mystery's custom-move cleanup and the Mystery row delete to land together or not at all.
    ///
    /// <para>
    /// <b>The reason is not parity with the other four — it is the direction the failure takes.</b>
    /// All five flows clean up sub-resources <i>before</i> deleting the owner, because
    /// <c>MonsterService.DeleteAsync</c> must read its minion ids before the cascade removes them
    /// and a uniform shape is worth more than a per-domain optimisation. Follow that ordering
    /// without a transaction and a failure between the two steps leaves the custom moves deleted
    /// and the Mystery alive: <b>user data destroyed, not leaked</b> — strictly worse than the
    /// orphan the cleanup exists to prevent.
    /// </para>
    ///
    /// <para>
    /// Delegates straight to <c>Database.BeginTransactionAsync</c>, so work done against the same
    /// <c>MotwDbContext</c> instance through any other repository/service in the same DI
    /// scope — <c>ICustomMoveService</c> included — participates in it.
    /// </para>
    /// </summary>
    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
}
