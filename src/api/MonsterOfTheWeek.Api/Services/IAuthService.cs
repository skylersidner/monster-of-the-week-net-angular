using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IAuthService
{
    Task<ServiceResult<CurrentUserResponse>> VerifyCredentialsAsync(
        string email,
        string password,
        CancellationToken cancellationToken);
}
