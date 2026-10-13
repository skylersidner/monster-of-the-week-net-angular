using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services.CustomMoves;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Services;

public sealed class LocationService(
    ILocationRepository locationRepository,
    IResourceImageService resourceImageService,
    ICustomMoveService customMoveService) : ILocationService
{
    public Task<IReadOnlyList<LocationListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        locationRepository.GetAllAsync(cancellationToken);

    public async Task<ServiceResult<IReadOnlyList<LocationListItemResponse>>> GetByMysteryAsync(Guid mysteryId, CancellationToken cancellationToken)
    {
        if (!await locationRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<LocationListItemResponse>>.NotFound($"Mystery {mysteryId} was not found.");
        }

        var locations = await locationRepository.GetLocationsByMysteryIdAsync(mysteryId, cancellationToken);
        var items = locations
            .Select(x => new LocationListItemResponse(
                x.Id,
                x.Mysteries.Select(ml => ml.MysteryId).ToList(),
                x.Name,
                x.Description,
                x.LocationTypeId,
                x.LocationType.Name,
                x.LocationType.Motivation,
                x.CreatedAt))
            .ToList();

        return ServiceResult<IReadOnlyList<LocationListItemResponse>>.Success(items);
    }

    public async Task<ServiceResult<LocationDetailResponse>> CreateAsync(
        Guid mysteryId,
        UpsertLocationRequest request,
        CancellationToken cancellationToken)
    {
        if (!await locationRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return ServiceResult<LocationDetailResponse>.NotFound($"Mystery {mysteryId} was not found.");
        }

        if (!await locationRepository.LocationTypeExistsAsync(request.LocationTypeId, cancellationToken))
        {
            return ServiceResult<LocationDetailResponse>.Validation($"LocationType {request.LocationTypeId} does not exist.");
        }

        var location = new Location
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            LocationTypeId = request.LocationTypeId
        };

        await locationRepository.AddLocationAsync(location, cancellationToken);
        await locationRepository.LinkLocationToMysteryAsync(
            new MysteryLocation { MysteryId = mysteryId, LocationId = location.Id },
            cancellationToken);
        await locationRepository.SaveChangesAsync(cancellationToken);

        var response = await GetByIdAsync(location.Id, cancellationToken);
        return ServiceResult<LocationDetailResponse>.Success(response!);
    }

    public async Task<ServiceResult<LocationDetailResponse>> CreateAsync(
        UpsertLocationRequest request,
        CancellationToken cancellationToken)
    {
        if (!await locationRepository.LocationTypeExistsAsync(request.LocationTypeId, cancellationToken))
        {
            return ServiceResult<LocationDetailResponse>.Validation($"LocationType {request.LocationTypeId} does not exist.");
        }

        var location = new Location
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            LocationTypeId = request.LocationTypeId
        };

        await locationRepository.AddLocationAsync(location, cancellationToken);
        await locationRepository.SaveChangesAsync(cancellationToken);

        var response = await GetByIdAsync(location.Id, cancellationToken);
        return ServiceResult<LocationDetailResponse>.Success(response!);
    }

    /// <summary>
    /// Custom moves come from a second query as of Phase 2 of domain-custom-moves (§3.4) — see
    /// <see cref="MonsterService.GetByIdAsync"/> for the cost accounting, which applies here too
    /// because Create and Update funnel their responses through this method.
    /// </summary>
    public async Task<LocationDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var location = await locationRepository.GetLocationDetailAsync(id, asNoTracking: true, cancellationToken);
        if (location is null)
        {
            return null;
        }

        var customMoves = await customMoveService.ListForProjectionAsync(
            DomainOwnerType.Location, id, cancellationToken);
        return ToDetailResponse(location, customMoves);
    }

    public async Task<ServiceResult<LocationDetailResponse>> UpdateAsync(
        Guid id,
        UpsertLocationRequest request,
        CancellationToken cancellationToken)
    {
        var location = await locationRepository.GetLocationForUpdateAsync(id, cancellationToken);
        if (location is null)
        {
            return ServiceResult<LocationDetailResponse>.NotFound($"Location {id} was not found.");
        }

        if (!await locationRepository.LocationTypeExistsAsync(request.LocationTypeId, cancellationToken))
        {
            return ServiceResult<LocationDetailResponse>.Validation($"LocationType {request.LocationTypeId} does not exist.");
        }

        location.Name = request.Name.Trim();
        location.Description = request.Description?.Trim();
        location.LocationTypeId = request.LocationTypeId;

        await locationRepository.SaveChangesAsync(cancellationToken);
        var response = await GetByIdAsync(id, cancellationToken);
        return ServiceResult<LocationDetailResponse>.Success(response!);
    }

    /// <summary>
    /// Deletes the Location and, in the same transaction, every image and custom move it owns. Same
    /// reasoning as
    /// <see cref="MonsterService.DeleteAsync"/>.
    /// </summary>
    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await locationRepository.BeginTransactionAsync(cancellationToken);

        await resourceImageService.DeleteAllForOwnerAsync(DomainOwnerType.Location, id, cancellationToken);
        await customMoveService.DeleteAllForOwnerAsync(DomainOwnerType.Location, id, cancellationToken);
        var deleted = await locationRepository.DeleteLocationAsync(id, cancellationToken) > 0;

        await transaction.CommitAsync(cancellationToken);
        return deleted;
    }

    /// <summary>
    /// Asserts that the membership row exists. Idempotent: re-linking an already-linked location
    /// is a successful no-op, never a conflict, because the wizard fires this unconditionally for
    /// every draft that carries an id. Returns false only when the mystery or the location does
    /// not exist, which the controller surfaces as 404.
    /// </summary>
    public async Task<bool> LinkToMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken)
    {
        if (!await locationRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return false;
        }

        if (!await locationRepository.LocationExistsAsync(id, cancellationToken))
        {
            return false;
        }

        if (await locationRepository.LocationLinkedToMysteryAsync(mysteryId, id, cancellationToken))
        {
            return true;
        }

        // Insert and save behind one repository call: the check above and this write are not
        // atomic, and the repository is where the duplicate-membership race is absorbed.
        await locationRepository.LinkLocationToMysteryAndSaveAsync(
            new MysteryLocation { MysteryId = mysteryId, LocationId = id },
            cancellationToken);
        return true;
    }

    public async Task<bool> UnlinkFromMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken)
    {
        var deleted = await locationRepository.UnlinkLocationFromMysteryAsync(mysteryId, id, cancellationToken);
        return deleted > 0;
    }

    private static LocationDetailResponse ToDetailResponse(
        Location location,
        IReadOnlyList<CustomMoveResponse> customMoves) =>
        new(
            location.Id,
            location.Mysteries.Select(ml => ml.MysteryId).ToList(),
            location.Name,
            location.Description,
            location.LocationTypeId,
            location.LocationType.Name,
            location.LocationType.Motivation,
            customMoves);
}
