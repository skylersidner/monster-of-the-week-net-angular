using Microsoft.EntityFrameworkCore;
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
            .Where(x => x.MysteryId == mysteryId)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task AddLocationAsync(Location location, CancellationToken cancellationToken)
    {
        dbContext.Locations.Add(location);
        return Task.CompletedTask;
    }

    public Task<Location?> GetLocationDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken)
    {
        var query = dbContext.Locations
            .Include(x => x.LocationType)
            .Include(x => x.CustomMoves)
            .Where(x => x.Id == id);

        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        return query.FirstOrDefaultAsync(cancellationToken);
    }

    public Task<Location?> GetLocationForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Locations.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<int> DeleteLocationAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Locations.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);

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

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
