using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IPlaybookService
{
    Task<IReadOnlyList<PlaybookListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<PlaybookDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<PlaybookDetailResponse>> CreateAsync(UpsertPlaybookRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<PlaybookDetailResponse>> UpdateAsync(Guid id, UpsertPlaybookRequest request, CancellationToken cancellationToken);
    /// <summary>
    /// <c>false</c> means "no such playbook"; a <c>Conflict</c> error means "in use by Hunters".
    /// The bool alone could not tell those apart, which is why this returns a result rather than
    /// the plain <c>bool</c> it did before Phase 9 (see the implementation for the reasoning).
    /// </summary>
    Task<ServiceResult<bool>> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
