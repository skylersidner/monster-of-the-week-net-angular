using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public sealed class BystanderRepository(MotwDbContext dbContext) : IBystanderRepository
{
    public Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken) =>
        dbContext.Mysteries.AnyAsync(x => x.Id == mysteryId, cancellationToken);

    public Task<bool> BystanderTypeExistsAsync(Guid bystanderTypeId, CancellationToken cancellationToken) =>
        dbContext.BystanderTypes.AnyAsync(x => x.Id == bystanderTypeId, cancellationToken);

    public async Task<IReadOnlyList<Bystander>> GetBystandersByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken) =>
        await dbContext.Bystanders
            .AsNoTracking()
            .Include(x => x.BystanderType)
            .Where(x => x.MysteryId == mysteryId)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task AddBystanderAsync(Bystander bystander, CancellationToken cancellationToken)
    {
        dbContext.Bystanders.Add(bystander);
        return Task.CompletedTask;
    }

    public Task<Bystander?> GetBystanderDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken)
    {
        var query = dbContext.Bystanders
            .Include(x => x.BystanderType)
            .Include(x => x.CustomMoves)
            .Where(x => x.Id == id);
        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        return query.FirstOrDefaultAsync(cancellationToken);
    }

    public Task<Bystander?> GetBystanderForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Bystanders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<int> DeleteBystanderAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Bystanders.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);

    public Task<bool> BystanderExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Bystanders.AnyAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<BystanderCustomMove>> GetBystanderCustomMovesAsync(Guid id, CancellationToken cancellationToken) =>
        await dbContext.BystanderCustomMoves
            .AsNoTracking()
            .Where(x => x.BystanderId == id)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task AddBystanderCustomMoveAsync(BystanderCustomMove move, CancellationToken cancellationToken)
    {
        dbContext.BystanderCustomMoves.Add(move);
        return Task.CompletedTask;
    }

    public Task<BystanderCustomMove?> GetBystanderCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        dbContext.BystanderCustomMoves.FirstOrDefaultAsync(x => x.Id == moveId && x.BystanderId == id, cancellationToken);

    public Task<int> DeleteBystanderCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        dbContext.BystanderCustomMoves.Where(x => x.Id == moveId && x.BystanderId == id).ExecuteDeleteAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
