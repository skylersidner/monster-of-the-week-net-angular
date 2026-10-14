using Microsoft.EntityFrameworkCore.Storage;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface ILocationRepository
{
    Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<bool> LocationTypeExistsAsync(Guid locationTypeId, CancellationToken cancellationToken);

    /// <summary>
    /// A real SQL projection straight to the response DTO (phases.md Phase 4) — replaces the
    /// former entity-returning <c>GetAllLocationsAsync</c>, which this was the only caller of.
    /// Needed as a SQL projection, not an in-memory one, so the derived-primary correlated
    /// subquery (see the implementation) can run server-side instead of per-row after the fact.
    /// </summary>
    Task<IReadOnlyList<LocationListItemResponse>> GetAllAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<Location>> GetLocationsByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task AddLocationAsync(Location location, CancellationToken cancellationToken);
    Task LinkLocationToMysteryAsync(MysteryLocation link, CancellationToken cancellationToken);

    /// <summary>
    /// Inserts one bridge row and saves it in one step, succeeding if a concurrent insert of the
    /// same membership won the race and throwing for any other failure. See the implementation.
    /// </summary>
    Task LinkLocationToMysteryAndSaveAsync(MysteryLocation link, CancellationToken cancellationToken);

    Task<int> UnlinkLocationFromMysteryAsync(Guid mysteryId, Guid locationId, CancellationToken cancellationToken);
    Task<bool> LocationLinkedToMysteryAsync(Guid mysteryId, Guid locationId, CancellationToken cancellationToken);
    Task<Location?> GetLocationDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken);
    Task<Location?> GetLocationForUpdateAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> LocationExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<int> DeleteLocationAsync(Guid id, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>See <see cref="IMonsterRepository.BeginTransactionAsync"/> for the full reasoning —
    /// same shape, used by <see cref="MonsterOfTheWeek.Api.Services.LocationService.DeleteAsync"/> to
    /// cover its own owner-delete image cleanup.</summary>
    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
}
