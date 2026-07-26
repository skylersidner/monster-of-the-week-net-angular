using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface ILocationRepository
{
    Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<bool> LocationTypeExistsAsync(Guid locationTypeId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Location>> GetAllLocationsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<Location>> GetLocationsByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task AddLocationAsync(Location location, CancellationToken cancellationToken);
    Task LinkLocationToMysteryAsync(MysteryLocation link, CancellationToken cancellationToken);
    Task<int> UnlinkLocationFromMysteryAsync(Guid mysteryId, Guid locationId, CancellationToken cancellationToken);
    Task<Location?> GetLocationDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken);
    Task<Location?> GetLocationForUpdateAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> LocationExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<LocationCustomMove>> GetLocationCustomMovesAsync(Guid id, CancellationToken cancellationToken);
    Task AddLocationCustomMoveAsync(LocationCustomMove move, CancellationToken cancellationToken);
    Task<LocationCustomMove?> GetLocationCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
    Task<int> DeleteLocationCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
    Task<int> DeleteLocationAsync(Guid id, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
