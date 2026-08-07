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
}
