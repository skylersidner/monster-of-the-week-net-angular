using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class LocationService(ILocationRepository locationRepository) : ILocationService
{
    public async Task<IReadOnlyList<LocationListItemResponse>> GetAllAsync(CancellationToken cancellationToken)
    {
        var locations = await locationRepository.GetAllLocationsAsync(cancellationToken);
        return locations
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
    }

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

    public async Task<LocationDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var location = await locationRepository.GetLocationDetailAsync(id, asNoTracking: true, cancellationToken);
        return location is null ? null : ToDetailResponse(location);
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

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken) =>
        await locationRepository.DeleteLocationAsync(id, cancellationToken) > 0;

    public async Task<bool> UnlinkFromMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken)
    {
        var deleted = await locationRepository.UnlinkLocationFromMysteryAsync(mysteryId, id, cancellationToken);
        return deleted > 0;
    }

    public async Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMovesAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await locationRepository.LocationExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<CustomMoveResponse>>.NotFound($"Location {id} was not found.");
        }

        var moves = await locationRepository.GetLocationCustomMovesAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<CustomMoveResponse>>.Success(moves.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<CustomMoveResponse>> CreateCustomMoveAsync(
        Guid id,
        UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        if (!await locationRepository.LocationExistsAsync(id, cancellationToken))
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"Location {id} was not found.");
        }

        var move = new LocationCustomMove
        {
            LocationId = id,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim()
        };

        await locationRepository.AddLocationCustomMoveAsync(move, cancellationToken);
        await locationRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(move.ToResponse());
    }

    public async Task<ServiceResult<CustomMoveResponse>> UpdateCustomMoveAsync(
        Guid id,
        Guid moveId,
        UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        var move = await locationRepository.GetLocationCustomMoveAsync(id, moveId, cancellationToken);
        if (move is null)
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"Location custom move {moveId} was not found.");
        }

        move.Name = request.Name.Trim();
        move.Description = request.Description?.Trim();
        await locationRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(move.ToResponse());
    }

    public async Task<bool> DeleteCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken)
    {
        var deleted = await locationRepository.DeleteLocationCustomMoveAsync(id, moveId, cancellationToken);
        return deleted > 0;
    }

    private static LocationDetailResponse ToDetailResponse(Location location) =>
        new(
            location.Id,
            location.Mysteries.Select(ml => ml.MysteryId).ToList(),
            location.Name,
            location.Description,
            location.LocationTypeId,
            location.LocationType.Name,
            location.LocationType.Motivation,
            location.CustomMoves.Select(x => x.ToResponse()).ToList());
}
