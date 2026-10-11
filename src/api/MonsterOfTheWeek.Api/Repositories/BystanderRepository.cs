using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using MonsterOfTheWeek.Api.Contracts;
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
            .Include(x => x.Mysteries)
            .Where(x => x.Mysteries.Any(mb => mb.MysteryId == mysteryId))
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task AddBystanderAsync(Bystander bystander, CancellationToken cancellationToken)
    {
        dbContext.Bystanders.Add(bystander);
        return Task.CompletedTask;
    }

    public Task LinkBystanderToMysteryAsync(MysteryBystander link, CancellationToken cancellationToken)
    {
        dbContext.MysteryBystanders.Add(link);
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
    public async Task LinkBystanderToMysteryAndSaveAsync(MysteryBystander link, CancellationToken cancellationToken)
    {
        var entry = dbContext.MysteryBystanders.Add(link);

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
            // else — notably the foreign-key violation raised when the mystery or the bystander is
            // deleted between the service's existence checks and this insert — leaves the
            // membership non-existent, and reporting 204 for it would be a lie the caller builds
            // on. Rethrow.
            if (!await BystanderLinkedToMysteryAsync(link.MysteryId, link.BystanderId, cancellationToken))
            {
                throw;
            }
        }
    }

    public Task<int> UnlinkBystanderFromMysteryAsync(Guid mysteryId, Guid bystanderId, CancellationToken cancellationToken) =>
        dbContext.MysteryBystanders
            .Where(x => x.MysteryId == mysteryId && x.BystanderId == bystanderId)
            .ExecuteDeleteAsync(cancellationToken);

    public Task<bool> BystanderLinkedToMysteryAsync(Guid mysteryId, Guid bystanderId, CancellationToken cancellationToken) =>
        dbContext.MysteryBystanders.AnyAsync(x => x.MysteryId == mysteryId && x.BystanderId == bystanderId, cancellationToken);

    public Task<Bystander?> GetBystanderDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken)
    {
        var query = dbContext.Bystanders
            .Include(x => x.BystanderType)
            .Include(x => x.Mysteries)
            .Where(x => x.Id == id);
        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        return query.FirstOrDefaultAsync(cancellationToken);
    }

    public Task<Bystander?> GetBystanderForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Bystanders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

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

    public Task<int> DeleteBystanderAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Bystanders.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<BystanderListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        await dbContext.Bystanders
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new BystanderListItemResponse(
                x.Id,
                x.Mysteries.Select(mb => mb.MysteryId).ToList(),
                x.Name,
                x.Description,
                x.BystanderTypeId,
                x.BystanderType.Name,
                x.BystanderType.Motivation,
                x.CreatedAt,
                // The derived primary — see MonsterRepository.GetAllAsync for the full reasoning.
                x.PrimaryImageId ?? dbContext.ResourceImages
                    .Where(i => i.OwnerType == ResourceOwnerType.Bystander && i.OwnerId == x.Id)
                    .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
                    .Select(i => (Guid?)i.Id)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);

    public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken) =>
        dbContext.Database.BeginTransactionAsync(cancellationToken);
}
