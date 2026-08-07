using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IMysteryService
{
    Task<IReadOnlyList<MysteryListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<MysteryDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MysteryDetailResponse>> CreateAsync(UpsertMysteryRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MysteryDetailResponse>> UpdateAsync(Guid id, UpsertMysteryRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task<CountdownResponse?> GetCountdownAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<CountdownResponse>> UpsertCountdownAsync(Guid id, UpsertCountdownRequest request, CancellationToken cancellationToken);
}
