using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IHunterService
{
    Task<IReadOnlyList<HunterListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<HunterDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<HunterDetailResponse>> CreateAsync(UpsertHunterRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<HunterDetailResponse>> UpdateAsync(Guid id, UpsertHunterRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
