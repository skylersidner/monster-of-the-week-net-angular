using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class AuthService(IUserRepository userRepository) : IAuthService
{
    // One message for every failure mode. The controller maps this to the single
    // "invalid_credentials" code, so "no such account" and "wrong password" are
    // indistinguishable to the caller. Do not make this more specific.
    private const string InvalidCredentialsMessage = "Invalid email address or password.";

    public async Task<ServiceResult<CurrentUserResponse>> VerifyCredentialsAsync(
        string email,
        string password,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return ServiceResult<CurrentUserResponse>.Validation(InvalidCredentialsMessage);
        }

        var user = await userRepository.FindByEmailAsync(email, cancellationToken);
        if (user is null)
        {
            return ServiceResult<CurrentUserResponse>.Validation(InvalidCredentialsMessage);
        }

        // Ordinal comparison on the plaintext, deliberately. A constant-time comparison would
        // defend nothing that is not already lost with the password at rest in plaintext, and
        // would imply more safety than exists. architecture.md section 6.
        if (!string.Equals(user.Password, password, StringComparison.Ordinal))
        {
            return ServiceResult<CurrentUserResponse>.Validation(InvalidCredentialsMessage);
        }

        return ServiceResult<CurrentUserResponse>.Success(new CurrentUserResponse(user.Id, user.Email));
    }
}
