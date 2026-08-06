using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class MysteryService(IMysteryRepository mysteryRepository) : IMysteryService
{
    public async Task<IReadOnlyList<MysteryListItemResponse>> GetAllAsync(CancellationToken cancellationToken)
    {
        var mysteries = await mysteryRepository.GetMysteriesForListAsync(cancellationToken);
        return mysteries
            .Select(x => new MysteryListItemResponse(
                x.Id,
                x.Name,
                x.Concept,
                x.Hook,
                x.AdventureType.ToResponse(),
                x.MysteryMonsters.Count,
                x.MysteryLocations.Count,
                x.MysteryBystanders.Count,
                x.CreatedAt))
            .ToList();
    }

    public async Task<MysteryDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var mystery = await mysteryRepository.GetMysteryDetailAsync(id, asNoTracking: true, cancellationToken);
        return mystery is null ? null : ToDetailResponse(mystery);
    }

    public async Task<ServiceResult<MysteryDetailResponse>> CreateAsync(UpsertMysteryRequest request, CancellationToken cancellationToken)
    {
        if (!await mysteryRepository.AdventureTypeExistsAsync(request.AdventureTypeId, cancellationToken))
        {
            return ServiceResult<MysteryDetailResponse>.Validation($"AdventureType {request.AdventureTypeId} does not exist.");
        }

        var mystery = new Mystery
        {
            Name = request.Name.Trim(),
            Concept = request.Concept?.Trim(),
            Hook = request.Hook?.Trim(),
            Overview = request.Overview?.Trim(),
            Notes = request.Notes?.Trim(),
            AdventureTypeId = request.AdventureTypeId
        };

        mystery.Countdown = new Countdown { MysteryId = mystery.Id };

        await mysteryRepository.AddMysteryAsync(mystery, cancellationToken);
        await mysteryRepository.SaveChangesAsync(cancellationToken);

        var saved = await mysteryRepository.GetMysteryDetailAsync(mystery.Id, asNoTracking: true, cancellationToken);
        return ServiceResult<MysteryDetailResponse>.Success(ToDetailResponse(saved!));
    }

    public async Task<ServiceResult<MysteryDetailResponse>> UpdateAsync(Guid id, UpsertMysteryRequest request, CancellationToken cancellationToken)
    {
        var mystery = await mysteryRepository.GetMysteryDetailAsync(id, asNoTracking: false, cancellationToken);
        if (mystery is null)
        {
            return ServiceResult<MysteryDetailResponse>.NotFound($"Mystery {id} was not found.");
        }

        if (!await mysteryRepository.AdventureTypeExistsAsync(request.AdventureTypeId, cancellationToken))
        {
            return ServiceResult<MysteryDetailResponse>.Validation($"AdventureType {request.AdventureTypeId} does not exist.");
        }

        mystery.Name = request.Name.Trim();
        mystery.Concept = request.Concept?.Trim();
        mystery.Hook = request.Hook?.Trim();
        mystery.Overview = request.Overview?.Trim();
        mystery.Notes = request.Notes?.Trim();
        mystery.AdventureTypeId = request.AdventureTypeId;

        await mysteryRepository.SaveChangesAsync(cancellationToken);

        var updated = await mysteryRepository.GetMysteryDetailAsync(id, asNoTracking: true, cancellationToken);
        return ServiceResult<MysteryDetailResponse>.Success(ToDetailResponse(updated!));
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await mysteryRepository.DeleteMysteryAsync(id, cancellationToken);
        return deleted > 0;
    }

    public async Task<CountdownResponse?> GetCountdownAsync(Guid id, CancellationToken cancellationToken)
    {
        var countdown = await mysteryRepository.GetCountdownByMysteryIdAsync(id, asNoTracking: true, cancellationToken);
        return countdown?.ToResponse();
    }

    public async Task<ServiceResult<CountdownResponse>> UpsertCountdownAsync(
        Guid id,
        UpsertCountdownRequest request,
        CancellationToken cancellationToken)
    {
        if (!await mysteryRepository.MysteryExistsAsync(id, cancellationToken))
        {
            return ServiceResult<CountdownResponse>.NotFound($"Mystery {id} was not found.");
        }

        var countdown = await mysteryRepository.GetCountdownByMysteryIdAsync(id, asNoTracking: false, cancellationToken);

        if (countdown is null)
        {
            countdown = new Countdown { MysteryId = id };
            await mysteryRepository.AddCountdownAsync(countdown, cancellationToken);
        }

        countdown.Day = request.Day?.Trim();
        countdown.Shadows = request.Shadows?.Trim();
        countdown.Sunset = request.Sunset?.Trim();
        countdown.Dusk = request.Dusk?.Trim();
        countdown.Nightfall = request.Nightfall?.Trim();
        countdown.Midnight = request.Midnight?.Trim();

        await mysteryRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<CountdownResponse>.Success(countdown.ToResponse());
    }

    private static MysteryDetailResponse ToDetailResponse(Mystery mystery) =>
        new(
            mystery.Id,
            mystery.Name,
            mystery.Concept,
            mystery.Hook,
            mystery.Overview,
            mystery.Notes,
            mystery.AdventureType.ToResponse(),
            mystery.Countdown is null ? null : mystery.Countdown.ToResponse(),
            mystery.MysteryMonsters.Count,
            mystery.MysteryLocations.Count,
            mystery.MysteryBystanders.Count,
            mystery.CustomMoves.Select(x => x.ToResponse()).ToList(),
            mystery.CreatedAt,
            mystery.UpdatedAt);
}
