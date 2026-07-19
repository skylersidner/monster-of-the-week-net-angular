using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IBystanderRepository
{
    Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<bool> BystanderTypeExistsAsync(Guid bystanderTypeId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Bystander>> GetBystandersByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task AddBystanderAsync(Bystander bystander, CancellationToken cancellationToken);
    Task<Bystander?> GetBystanderDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken);
    Task<Bystander?> GetBystanderForUpdateAsync(Guid id, CancellationToken cancellationToken);
    Task<int> DeleteBystanderAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> BystanderExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<BystanderCustomMove>> GetBystanderCustomMovesAsync(Guid id, CancellationToken cancellationToken);
    Task AddBystanderCustomMoveAsync(BystanderCustomMove move, CancellationToken cancellationToken);
    Task<BystanderCustomMove?> GetBystanderCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
    Task<int> DeleteBystanderCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
