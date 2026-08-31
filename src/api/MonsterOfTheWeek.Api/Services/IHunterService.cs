using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IHunterService
{
    Task<IReadOnlyList<HunterListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
}
