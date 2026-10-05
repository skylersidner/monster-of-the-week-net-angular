using Microsoft.EntityFrameworkCore.Storage;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IBystanderRepository
{
    Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<bool> BystanderTypeExistsAsync(Guid bystanderTypeId, CancellationToken cancellationToken);

    /// <summary>
    /// A real SQL projection straight to the response DTO (phases.md Phase 4) — replaces the
    /// former entity-returning <c>GetAllBystandersAsync</c>, which this was the only caller of.
    /// Needed as a SQL projection, not an in-memory one, so the derived-primary correlated
    /// subquery (see the implementation) can run server-side instead of per-row after the fact.
    /// </summary>
    Task<IReadOnlyList<BystanderListItemResponse>> GetAllAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<Bystander>> GetBystandersByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task AddBystanderAsync(Bystander bystander, CancellationToken cancellationToken);
    Task LinkBystanderToMysteryAsync(MysteryBystander link, CancellationToken cancellationToken);

    /// <summary>
    /// Inserts one bridge row and saves it in one step, succeeding if a concurrent insert of the
    /// same membership won the race and throwing for any other failure. See the implementation.
    /// </summary>
    Task LinkBystanderToMysteryAndSaveAsync(MysteryBystander link, CancellationToken cancellationToken);

    Task<int> UnlinkBystanderFromMysteryAsync(Guid mysteryId, Guid bystanderId, CancellationToken cancellationToken);
    Task<bool> BystanderLinkedToMysteryAsync(Guid mysteryId, Guid bystanderId, CancellationToken cancellationToken);
    Task<Bystander?> GetBystanderDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken);
    Task<Bystander?> GetBystanderForUpdateAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> BystanderExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<BystanderCustomMove>> GetBystanderCustomMovesAsync(Guid id, CancellationToken cancellationToken);
    Task AddBystanderCustomMoveAsync(BystanderCustomMove move, CancellationToken cancellationToken);
    Task<BystanderCustomMove?> GetBystanderCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
    Task<int> DeleteBystanderCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
    Task<int> DeleteBystanderAsync(Guid id, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>See <see cref="IMonsterRepository.BeginTransactionAsync"/> for the full reasoning —
    /// same shape, used by <see cref="MonsterOfTheWeek.Api.Services.BystanderService.DeleteAsync"/> to
    /// cover its own owner-delete image cleanup.</summary>
    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
}
