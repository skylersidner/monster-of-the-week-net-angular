using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Services;

public sealed class BystanderService(IBystanderRepository bystanderRepository, IResourceImageService resourceImageService) : IBystanderService
{
    public Task<IReadOnlyList<BystanderListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        bystanderRepository.GetAllAsync(cancellationToken);

    public async Task<ServiceResult<IReadOnlyList<BystanderListItemResponse>>> GetByMysteryAsync(Guid mysteryId, CancellationToken cancellationToken)
    {
        if (!await bystanderRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<BystanderListItemResponse>>.NotFound($"Mystery {mysteryId} was not found.");
        }

        var bystanders = await bystanderRepository.GetBystandersByMysteryIdAsync(mysteryId, cancellationToken);
        var items = bystanders
            .Select(x => new BystanderListItemResponse(
                x.Id,
                x.Mysteries.Select(mb => mb.MysteryId).ToList(),
                x.Name,
                x.Description,
                x.BystanderTypeId,
                x.BystanderType.Name,
                x.BystanderType.Motivation,
                x.CreatedAt))
            .ToList();
        return ServiceResult<IReadOnlyList<BystanderListItemResponse>>.Success(items);
    }

    public async Task<ServiceResult<BystanderDetailResponse>> CreateAsync(
        Guid mysteryId,
        UpsertBystanderRequest request,
        CancellationToken cancellationToken)
    {
        if (!await bystanderRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return ServiceResult<BystanderDetailResponse>.NotFound($"Mystery {mysteryId} was not found.");
        }

        if (!await bystanderRepository.BystanderTypeExistsAsync(request.BystanderTypeId, cancellationToken))
        {
            return ServiceResult<BystanderDetailResponse>.Validation($"BystanderType {request.BystanderTypeId} does not exist.");
        }

        var bystander = new Bystander
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            BystanderTypeId = request.BystanderTypeId
        };

        await bystanderRepository.AddBystanderAsync(bystander, cancellationToken);
        await bystanderRepository.LinkBystanderToMysteryAsync(
            new MysteryBystander { MysteryId = mysteryId, BystanderId = bystander.Id },
            cancellationToken);
        await bystanderRepository.SaveChangesAsync(cancellationToken);
        var response = await GetByIdAsync(bystander.Id, cancellationToken);
        return ServiceResult<BystanderDetailResponse>.Success(response!);
    }

    public async Task<ServiceResult<BystanderDetailResponse>> CreateAsync(
        UpsertBystanderRequest request,
        CancellationToken cancellationToken)
    {
        if (!await bystanderRepository.BystanderTypeExistsAsync(request.BystanderTypeId, cancellationToken))
        {
            return ServiceResult<BystanderDetailResponse>.Validation($"BystanderType {request.BystanderTypeId} does not exist.");
        }

        var bystander = new Bystander
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            BystanderTypeId = request.BystanderTypeId
        };

        await bystanderRepository.AddBystanderAsync(bystander, cancellationToken);
        await bystanderRepository.SaveChangesAsync(cancellationToken);
        var response = await GetByIdAsync(bystander.Id, cancellationToken);
        return ServiceResult<BystanderDetailResponse>.Success(response!);
    }

    public async Task<BystanderDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var bystander = await bystanderRepository.GetBystanderDetailAsync(id, asNoTracking: true, cancellationToken);
        return bystander is null
            ? null
            : new BystanderDetailResponse(
                bystander.Id,
                bystander.Mysteries.Select(mb => mb.MysteryId).ToList(),
                bystander.Name,
                bystander.Description,
                bystander.BystanderTypeId,
                bystander.BystanderType.Name,
                bystander.BystanderType.Motivation,
                bystander.CustomMoves.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<BystanderDetailResponse>> UpdateAsync(
        Guid id,
        UpsertBystanderRequest request,
        CancellationToken cancellationToken)
    {
        var bystander = await bystanderRepository.GetBystanderForUpdateAsync(id, cancellationToken);
        if (bystander is null)
        {
            return ServiceResult<BystanderDetailResponse>.NotFound($"Bystander {id} was not found.");
        }

        if (!await bystanderRepository.BystanderTypeExistsAsync(request.BystanderTypeId, cancellationToken))
        {
            return ServiceResult<BystanderDetailResponse>.Validation($"BystanderType {request.BystanderTypeId} does not exist.");
        }

        bystander.Name = request.Name.Trim();
        bystander.Description = request.Description?.Trim();
        bystander.BystanderTypeId = request.BystanderTypeId;

        await bystanderRepository.SaveChangesAsync(cancellationToken);
        var response = await GetByIdAsync(id, cancellationToken);
        return ServiceResult<BystanderDetailResponse>.Success(response!);
    }

    /// <summary>
    /// Deletes the Bystander and, in the same transaction, every image it owns. Same reasoning as
    /// <see cref="MonsterService.DeleteAsync"/>.
    /// </summary>
    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await bystanderRepository.BeginTransactionAsync(cancellationToken);

        await resourceImageService.DeleteAllForOwnerAsync(ResourceOwnerType.Bystander, id, cancellationToken);
        var deleted = await bystanderRepository.DeleteBystanderAsync(id, cancellationToken) > 0;

        await transaction.CommitAsync(cancellationToken);
        return deleted;
    }

    /// <summary>
    /// Asserts that the membership row exists. Idempotent: re-linking an already-linked bystander
    /// is a successful no-op, never a conflict, because the wizard fires this unconditionally for
    /// every draft that carries an id. Returns false only when the mystery or the bystander does
    /// not exist, which the controller surfaces as 404.
    /// </summary>
    public async Task<bool> LinkToMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken)
    {
        if (!await bystanderRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return false;
        }

        if (!await bystanderRepository.BystanderExistsAsync(id, cancellationToken))
        {
            return false;
        }

        if (await bystanderRepository.BystanderLinkedToMysteryAsync(mysteryId, id, cancellationToken))
        {
            return true;
        }

        // Insert and save behind one repository call: the check above and this write are not
        // atomic, and the repository is where the duplicate-membership race is absorbed.
        await bystanderRepository.LinkBystanderToMysteryAndSaveAsync(
            new MysteryBystander { MysteryId = mysteryId, BystanderId = id },
            cancellationToken);
        return true;
    }

    public async Task<bool> UnlinkFromMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken)
    {
        var deleted = await bystanderRepository.UnlinkBystanderFromMysteryAsync(mysteryId, id, cancellationToken);
        return deleted > 0;
    }

    public async Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMovesAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await bystanderRepository.BystanderExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<CustomMoveResponse>>.NotFound($"Bystander {id} was not found.");
        }

        var moves = await bystanderRepository.GetBystanderCustomMovesAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<CustomMoveResponse>>.Success(moves.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<CustomMoveResponse>> CreateCustomMoveAsync(
        Guid id,
        UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        if (!await bystanderRepository.BystanderExistsAsync(id, cancellationToken))
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"Bystander {id} was not found.");
        }

        var move = new BystanderCustomMove
        {
            BystanderId = id,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim()
        };

        await bystanderRepository.AddBystanderCustomMoveAsync(move, cancellationToken);
        await bystanderRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(move.ToResponse());
    }

    public async Task<ServiceResult<CustomMoveResponse>> UpdateCustomMoveAsync(
        Guid id,
        Guid moveId,
        UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        var move = await bystanderRepository.GetBystanderCustomMoveAsync(id, moveId, cancellationToken);
        if (move is null)
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"Bystander custom move {moveId} was not found.");
        }

        move.Name = request.Name.Trim();
        move.Description = request.Description?.Trim();
        await bystanderRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(move.ToResponse());
    }

    public async Task<bool> DeleteCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken)
    {
        var deleted = await bystanderRepository.DeleteBystanderCustomMoveAsync(id, moveId, cancellationToken);
        return deleted > 0;
    }
}
