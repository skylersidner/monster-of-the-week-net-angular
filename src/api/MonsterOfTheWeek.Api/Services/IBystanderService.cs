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
    Task<bool> LinkToMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken);
    Task<bool> UnlinkFromMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken);
}
