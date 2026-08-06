using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IBystanderService
{
    Task<IReadOnlyList<BystanderListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<ServiceResult<IReadOnlyList<BystanderListItemResponse>>> GetByMysteryAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<ServiceResult<BystanderDetailResponse>> CreateAsync(Guid mysteryId, UpsertBystanderRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<BystanderDetailResponse>> CreateAsync(UpsertBystanderRequest request, CancellationToken cancellationToken);
    Task<BystanderDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<BystanderDetailResponse>> UpdateAsync(Guid id, UpsertBystanderRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> UnlinkFromMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMovesAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<CustomMoveResponse>> CreateCustomMoveAsync(Guid id, UpsertCustomMoveRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<CustomMoveResponse>> UpdateCustomMoveAsync(Guid id, Guid moveId, UpsertCustomMoveRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
}
