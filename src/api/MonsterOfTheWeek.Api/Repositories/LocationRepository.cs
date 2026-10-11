using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public sealed class LocationRepository(MotwDbContext dbContext) : ILocationRepository
{
    public Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken) =>
        dbContext.Mysteries.AnyAsync(x => x.Id == mysteryId, cancellationToken);

    public Task<bool> LocationTypeExistsAsync(Guid locationTypeId, CancellationToken cancellationToken) =>
        dbContext.LocationTypes.AnyAsync(x => x.Id == locationTypeId, cancellationToken);

    public async Task<IReadOnlyList<Location>> GetLocationsByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken) =>
        await dbContext.Locations
            .AsNoTracking()
            .Include(x => x.LocationType)
            .Include(x => x.Mysteries)
            .Where(x => x.Mysteries.Any(ml => ml.MysteryId == mysteryId))
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task AddLocationAsync(Location location, CancellationToken cancellationToken)
    {
        dbContext.Locations.Add(location);
        return Task.CompletedTask;
    }

    public Task LinkLocationToMysteryAsync(MysteryLocation link, CancellationToken cancellationToken)
    {
        dbContext.MysteryLocations.Add(link);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Inserts one bridge row and saves it, treating a concurrent insert of the <i>same</i>
    /// membership as success and every other failure as a failure.
    /// </summary>
    /// <remarks>
    /// The service's already-linked check and this insert are not one atomic step, so two
    /// concurrent PUTs for the same pair can both pass the check and both insert. The loser's
    /// <c>SaveChangesAsync</c> then violates the composite primary key. Re-checking membership
    /// after the failure discriminates on the thing that actually matters — did the row end up
    /// existing — rather than on a provider-specific error code, so it behaves the same on
    /// PostgreSQL and on the SQLite the tests run against.
    /// </remarks>
    public async Task LinkLocationToMysteryAndSaveAsync(MysteryLocation link, CancellationToken cancellationToken)
    {
        var entry = dbContext.MysteryLocations.Add(link);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Drop the failed insert first, so it cannot be retried by a later SaveChanges in the
            // same request.
            entry.State = EntityState.Detached;

            // The only failure swallowed here is "the row we wanted is already there". Anything
            // else — notably the foreign-key violation raised when the mystery or the location is
            // deleted between the service's existence checks and this insert — leaves the
            // membership non-existent, and reporting 204 for it would be a lie the caller builds
            // on. Rethrow.
            if (!await LocationLinkedToMysteryAsync(link.MysteryId, link.LocationId, cancellationToken))
            {
                throw;
            }
        }
    }

    public Task<int> UnlinkLocationFromMysteryAsync(Guid mysteryId, Guid locationId, CancellationToken cancellationToken) =>
        dbContext.MysteryLocations
            .Where(x => x.MysteryId == mysteryId && x.LocationId == locationId)
            .ExecuteDeleteAsync(cancellationToken);

    public Task<bool> LocationLinkedToMysteryAsync(Guid mysteryId, Guid locationId, CancellationToken cancellationToken) =>
        dbContext.MysteryLocations.AnyAsync(x => x.MysteryId == mysteryId && x.LocationId == locationId, cancellationToken);

    public Task<Location?> GetLocationDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken)
    {
        var query = dbContext.Locations
            .Include(x => x.LocationType)
            .Include(x => x.Mysteries)
            .Where(x => x.Id == id);

        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        return query.FirstOrDefaultAsync(cancellationToken);
    }

    public Task<Location?> GetLocationForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Locations.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<bool> LocationExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Locations.AnyAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<LocationCustomMove>> GetLocationCustomMovesAsync(Guid id, CancellationToken cancellationToken) =>
        await dbContext.LocationCustomMoves
            .AsNoTracking()
            .Where(x => x.LocationId == id)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task AddLocationCustomMoveAsync(LocationCustomMove move, CancellationToken cancellationToken)
    {
        dbContext.LocationCustomMoves.Add(move);
        return Task.CompletedTask;
    }

    public Task<LocationCustomMove?> GetLocationCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        dbContext.LocationCustomMoves.FirstOrDefaultAsync(x => x.Id == moveId && x.LocationId == id, cancellationToken);

    public Task<int> DeleteLocationCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        dbContext.LocationCustomMoves.Where(x => x.Id == moveId && x.LocationId == id).ExecuteDeleteAsync(cancellationToken);

    public Task<int> DeleteLocationAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Locations.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<LocationListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        await dbContext.Locations
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new LocationListItemResponse(
                x.Id,
                x.Mysteries.Select(ml => ml.MysteryId).ToList(),
                x.Name,
                x.Description,
                x.LocationTypeId,
                x.LocationType.Name,
                x.LocationType.Motivation,
                x.CreatedAt,
                // The derived primary — see MonsterRepository.GetAllAsync for the full reasoning.
                x.PrimaryImageId ?? dbContext.ResourceImages
                    .Where(i => i.OwnerType == ResourceOwnerType.Location && i.OwnerId == x.Id)
                    .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
                    .Select(i => (Guid?)i.Id)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);

    public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken) =>
        dbContext.Database.BeginTransactionAsync(cancellationToken);
}
