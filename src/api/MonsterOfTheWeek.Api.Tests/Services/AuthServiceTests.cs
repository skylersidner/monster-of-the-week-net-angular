using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

public sealed class AuthServiceTests
{
    private const string StoredEmail = "skyler@example.com";
    private const string StoredPassword = "correct-horse-battery-staple";

    [Fact]
    public async Task VerifyCredentialsAsync_ReturnsUser_WhenCredentialsAreCorrect()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository);

        var result = await service.VerifyCredentialsAsync(StoredEmail, StoredPassword, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(repository.StoredUser.Id, result.Value!.Id);
        Assert.Equal(StoredEmail, result.Value.Email);
    }

    [Fact]
    public async Task VerifyCredentialsAsync_ReturnsValidation_WhenPasswordIsWrong()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository);

        var result = await service.VerifyCredentialsAsync(StoredEmail, "not-the-password", CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);
    }

    [Fact]
    public async Task VerifyCredentialsAsync_ReturnsValidation_WhenEmailIsUnknown()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository);

        var result = await service.VerifyCredentialsAsync("nobody@example.com", StoredPassword, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);
    }

    // The failure message must not distinguish "no such account" from "wrong password" — the
    // controller maps both to the single invalid_credentials code and nothing should leak which
    // half failed.
    [Fact]
    public async Task VerifyCredentialsAsync_ReturnsIdenticalMessage_ForUnknownEmailAndWrongPassword()
    {
        var service = new AuthService(new FakeUserRepository());

        var unknownEmail = await service.VerifyCredentialsAsync("nobody@example.com", StoredPassword, CancellationToken.None);
        var wrongPassword = await service.VerifyCredentialsAsync(StoredEmail, "not-the-password", CancellationToken.None);

        Assert.Equal(unknownEmail.Error!.Message, wrongPassword.Error!.Message);
    }

    // Exercises the case-insensitive lookup added in Phase 0: the row is typed by hand, so a
    // casing mismatch must not be a login failure.
    [Theory]
    [InlineData("SKYLER@EXAMPLE.COM")]
    [InlineData("Skyler@Example.Com")]
    [InlineData("  skyler@example.com  ")]
    public async Task VerifyCredentialsAsync_ReturnsUser_WhenEmailCaseOrWhitespaceDiffers(string suppliedEmail)
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository);

        var result = await service.VerifyCredentialsAsync(suppliedEmail, StoredPassword, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(StoredEmail, result.Value!.Email);
    }

    // The password, unlike the email, is compared ordinally and is case-sensitive.
    [Fact]
    public async Task VerifyCredentialsAsync_ReturnsValidation_WhenPasswordCaseDiffers()
    {
        var service = new AuthService(new FakeUserRepository());

        var result = await service.VerifyCredentialsAsync(StoredEmail, StoredPassword.ToUpperInvariant(), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);
    }

    [Theory]
    [InlineData("", StoredPassword)]
    [InlineData("   ", StoredPassword)]
    [InlineData(StoredEmail, "")]
    [InlineData(StoredEmail, "   ")]
    public async Task VerifyCredentialsAsync_ReturnsValidation_WhenEitherFieldIsBlank(string email, string password)
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository);

        var result = await service.VerifyCredentialsAsync(email, password, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);
        Assert.Equal(0, repository.FindByEmailCalls);
    }

    private sealed class FakeUserRepository : IUserRepository
    {
        public AppUser StoredUser { get; } = new()
        {
            Id = Guid.NewGuid(),
            Email = StoredEmail,
            Password = StoredPassword
        };

        public int FindByEmailCalls { get; private set; }

        // Mirrors UserRepository's real behaviour: trim + lowercase the input and compare against
        // the lowercased stored value.
        public Task<AppUser?> FindByEmailAsync(string email, CancellationToken cancellationToken)
        {
            FindByEmailCalls++;
            var normalized = email.Trim().ToLowerInvariant();
            return Task.FromResult(
                StoredUser.Email.ToLowerInvariant() == normalized ? StoredUser : null);
        }
    }
}
