using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface ILocationService
{
    Task<IReadOnlyList<LocationListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<ServiceResult<IReadOnlyList<LocationListItemResponse>>> GetByMysteryAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<ServiceResult<LocationDetailResponse>> CreateAsync(Guid mysteryId, UpsertLocationRequest request, CancellationToken cancellationToken);
    Task<LocationDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<LocationDetailResponse>> UpdateAsync(Guid id, UpsertLocationRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> UnlinkFromMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMovesAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<CustomMoveResponse>> CreateCustomMoveAsync(Guid id, UpsertCustomMoveRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<CustomMoveResponse>> UpdateCustomMoveAsync(Guid id, Guid moveId, UpsertCustomMoveRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
}
