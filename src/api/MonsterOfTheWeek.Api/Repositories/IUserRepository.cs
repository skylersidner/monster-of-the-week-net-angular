using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IUserRepository
{
    Task<AppUser?> FindByEmailAsync(string email, CancellationToken cancellationToken);
}
