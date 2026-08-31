using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IHunterRepository
{
    Task<IReadOnlyList<Hunter>> GetAllHuntersAsync(CancellationToken cancellationToken);
}
