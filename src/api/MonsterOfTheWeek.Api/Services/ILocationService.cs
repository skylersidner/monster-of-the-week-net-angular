using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface ILocationService
{
    Task<IReadOnlyList<LocationListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<ServiceResult<IReadOnlyList<LocationListItemResponse>>> GetByMysteryAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<ServiceResult<LocationDetailResponse>> CreateAsync(Guid mysteryId, UpsertLocationRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<LocationDetailResponse>> CreateAsync(UpsertLocationRequest request, CancellationToken cancellationToken);
    Task<LocationDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<LocationDetailResponse>> UpdateAsync(Guid id, UpsertLocationRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> LinkToMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken);
    Task<bool> UnlinkFromMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken);
}
