using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IPlaybookService
{
    Task<IReadOnlyList<PlaybookListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<PlaybookDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<PlaybookDetailResponse>> CreateAsync(UpsertPlaybookRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<PlaybookDetailResponse>> UpdateAsync(Guid id, UpsertPlaybookRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
