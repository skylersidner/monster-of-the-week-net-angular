namespace MonsterOfTheWeek.Api.Contracts;

// No DataAnnotations by design: [ApiController] already infers required for non-nullable
// reference-type parameters, so a missing email or password returns 400 for free. This pass
// adds no input validation — in particular no [EmailAddress]; a malformed address simply
// fails to match a row, which is the same outcome by a shorter path.
public sealed record LoginRequest(string Email, string Password);
public sealed record CurrentUserResponse(Guid Id, string Email);
