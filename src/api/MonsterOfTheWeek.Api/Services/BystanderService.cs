using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class BystanderService(IBystanderRepository bystanderRepository) : IBystanderService
{
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
                x.MysteryId,
                x.Name,
                x.Description,
                x.BystanderTypeId,
                x.BystanderType.Name))
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
            MysteryId = mysteryId,
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
                bystander.MysteryId,
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

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await bystanderRepository.DeleteBystanderAsync(id, cancellationToken);
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
