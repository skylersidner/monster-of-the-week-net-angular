using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services.CustomMoves;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Services;

public sealed class BystanderService(
    IBystanderRepository bystanderRepository,
    IResourceImageService resourceImageService,
    ICustomMoveService customMoveService) : IBystanderService
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

    /// <summary>
    /// Custom moves come from a second query as of Phase 2 of domain-custom-moves (§3.4) — see
    /// <see cref="MonsterService.GetByIdAsync"/> for the cost accounting, which applies here too
    /// because Create and Update funnel their responses through this method.
    /// <para>
    /// This is the one of the five that maps inline rather than through a private
    /// <c>ToDetailResponse</c>. Left that way: extracting one would be a second change in the
    /// same diff, and §9's teardown inventory counts five mapping sites, not four.
    /// </para>
    /// </summary>
    public async Task<BystanderDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var bystander = await bystanderRepository.GetBystanderDetailAsync(id, asNoTracking: true, cancellationToken);
        if (bystander is null)
        {
            return null;
        }

        var customMoves = await customMoveService.ListForProjectionAsync(
            CustomMoveOwnerType.Bystander, id, cancellationToken);

        return new BystanderDetailResponse(
            bystander.Id,
            bystander.Mysteries.Select(mb => mb.MysteryId).ToList(),
            bystander.Name,
            bystander.Description,
            bystander.BystanderTypeId,
            bystander.BystanderType.Name,
            bystander.BystanderType.Motivation,
            customMoves);
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
    /// Deletes the Bystander and, in the same transaction, every image and custom move it owns. Same
    /// reasoning as
    /// <see cref="MonsterService.DeleteAsync"/>.
    /// </summary>
    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await bystanderRepository.BeginTransactionAsync(cancellationToken);

        await resourceImageService.DeleteAllForOwnerAsync(ResourceOwnerType.Bystander, id, cancellationToken);
        await customMoveService.DeleteAllForOwnerAsync(CustomMoveOwnerType.Bystander, id, cancellationToken);
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
}
