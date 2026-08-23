using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public sealed class UserRepository(MotwDbContext dbContext) : IUserRepository
{
    public async Task<AppUser?> FindByEmailAsync(string email, CancellationToken cancellationToken)
    {
        // Normalisation, not validation: the credential row is typed by hand, so a casing
        // mismatch between the stored value and the typed one must not be a login failure.
        var normalizedEmail = email.Trim().ToLowerInvariant();

        return await dbContext.AppUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email.ToLower() == normalizedEmail, cancellationToken);
    }
}
