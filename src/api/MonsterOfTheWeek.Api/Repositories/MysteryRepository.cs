using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public sealed class MysteryRepository(MotwDbContext dbContext) : IMysteryRepository
{
    public async Task<IReadOnlyList<Mystery>> GetMysteriesForListAsync(CancellationToken cancellationToken) =>
        await dbContext.Mysteries
            .AsNoTracking()
            .Include(x => x.AdventureType)
            .Include(x => x.MysteryMonsters)
            .Include(x => x.MysteryLocations)
            .Include(x => x.MysteryBystanders)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<Mystery?> GetMysteryDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken)
    {
        var query = dbContext.Mysteries
            .Include(x => x.AdventureType)
            .Include(x => x.Countdown)
            .Include(x => x.CustomMoves)
            .Include(x => x.MysteryMonsters)
            .Include(x => x.MysteryLocations)
            .Include(x => x.MysteryBystanders)
            .Where(x => x.Id == id);

        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public Task AddMysteryAsync(Mystery mystery, CancellationToken cancellationToken)
    {
        dbContext.Mysteries.Add(mystery);
        return Task.CompletedTask;
    }

    public Task<int> DeleteMysteryAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Mysteries
            .Where(x => x.Id == id)
            .ExecuteDeleteAsync(cancellationToken);

    public Task<bool> MysteryExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Mysteries.AnyAsync(x => x.Id == id, cancellationToken);

    public Task<bool> AdventureTypeExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.AdventureTypes.AnyAsync(x => x.Id == id, cancellationToken);

    public Task<Countdown?> GetCountdownByMysteryIdAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken)
    {
        var query = dbContext.Countdowns.Where(x => x.MysteryId == id);
        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        return query.FirstOrDefaultAsync(cancellationToken);
    }

    public Task AddCountdownAsync(Countdown countdown, CancellationToken cancellationToken)
    {
        dbContext.Countdowns.Add(countdown);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
