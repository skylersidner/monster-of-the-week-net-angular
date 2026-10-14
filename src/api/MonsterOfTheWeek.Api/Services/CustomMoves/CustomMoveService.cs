using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Services.CustomMoves;

/// <summary>
/// See <see cref="ICustomMoveService"/> for scope and for what Phase 1 deliberately leaves
/// uncalled. Talks to <see cref="MotwDbContext"/> directly rather than through a per-domain
/// repository, the same way <c>ResourceImageService</c> does and for the same reason
/// (architecture.md §2.11): no single repository owns Mysteries, Monsters, Minions, Locations
/// <i>and</i> Bystanders, and routing this through five of them would reintroduce the per-domain
/// duplication this service exists to remove.
/// </summary>
public sealed class CustomMoveService(MotwDbContext dbContext) : ICustomMoveService
{
    public async Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> ListAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        if (!await OwnerExistsAsync(ownerType, ownerId, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<CustomMoveResponse>>.NotFound($"{ownerType} {ownerId} was not found.");
        }

        return ServiceResult<IReadOnlyList<CustomMoveResponse>>.Success(
            await ListForProjectionAsync(ownerType, ownerId, cancellationToken));
    }

    public async Task<ServiceResult<CustomMoveResponse>> CreateAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        if (!await OwnerExistsAsync(ownerType, ownerId, cancellationToken))
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"{ownerType} {ownerId} was not found.");
        }

        var value = new CustomMove
        {
            OwnerType = ownerType,
            OwnerId = ownerId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
        };

        dbContext.CustomMoves.Add(value);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(value.ToResponse());
    }

    public async Task<ServiceResult<CustomMoveResponse>> UpdateAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid moveId,
        UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        // Tracked fetch, mutate, save — the shape all five existing implementations use, and the
        // one that can return the updated row. ExecuteUpdateAsync returns a count and would need
        // a second read to produce the response body.
        var value = await dbContext.CustomMoves
            .FirstOrDefaultAsync(
                x => x.Id == moveId && x.OwnerType == ownerType && x.OwnerId == ownerId,
                cancellationToken);

        if (value is null)
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"Custom move {moveId} was not found.");
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(value.ToResponse());
    }

    public async Task<bool> DeleteAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid moveId,
        CancellationToken cancellationToken) =>
        await dbContext.CustomMoves
            .Where(x => x.Id == moveId && x.OwnerType == ownerType && x.OwnerId == ownerId)
            .ExecuteDeleteAsync(cancellationToken) > 0;

    public async Task<IReadOnlyList<CustomMoveResponse>> ListForProjectionAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        var values = await dbContext.CustomMoves
            .AsNoTracking()
            .Where(x => x.OwnerType == ownerType && x.OwnerId == ownerId)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return values.Select(x => x.ToResponse()).ToList();
    }

    public async Task DeleteAllForOwnerAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        await dbContext.CustomMoves
            .Where(x => x.OwnerType == ownerType && x.OwnerId == ownerId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <summary>
    /// Five <c>AnyAsync</c> arms on a primary key, one index lookup each — the shape
    /// <c>ResourceImageService.OwnerExistsAsync</c> already uses, with a fifth arm for Mystery
    /// (architecture.md §18). Nothing cheaper exists at five arms.
    /// <para>
    /// <b>Keep the throwing default arm.</b> It is unreachable through MVC today only because
    /// MVC's model binder rejects an out-of-range enum value; a minimal-API host on .NET 10 binds
    /// <c>7</c> to a five-member enum successfully (§17.1). The arm is guarded by a drift test
    /// over every enum member rather than by the type system (B12).
    /// </para>
    /// </summary>
    private Task<bool> OwnerExistsAsync(DomainOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken) =>
        ownerType switch
        {
            DomainOwnerType.Mystery => dbContext.Mysteries.AnyAsync(m => m.Id == ownerId, cancellationToken),
            DomainOwnerType.Monster => dbContext.Monsters.AnyAsync(m => m.Id == ownerId, cancellationToken),
            DomainOwnerType.Minion => dbContext.Minions.AnyAsync(m => m.Id == ownerId, cancellationToken),
            DomainOwnerType.Location => dbContext.Locations.AnyAsync(l => l.Id == ownerId, cancellationToken),
            DomainOwnerType.Bystander => dbContext.Bystanders.AnyAsync(b => b.Id == ownerId, cancellationToken),
            _ => throw new ArgumentOutOfRangeException(nameof(ownerType), ownerType, "Unknown owner type."),
        };
}
