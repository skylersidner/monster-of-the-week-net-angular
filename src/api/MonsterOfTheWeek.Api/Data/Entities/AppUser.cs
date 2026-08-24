namespace MonsterOfTheWeek.Api.Data.Entities;

// Deliberately NOT ITimestamped: that interface declares a non-nullable UpdatedAt which
// MotwDbContext.ApplyTimestamps() writes unconditionally, forcing an updated_at column
// this table has no use for. Plain POCO by design.
//
// The Password column holds plaintext, deliberately, and is named for what it contains
// rather than password_hash. See docs/simple-authentication-update/architecture.md sections 1.2 and 6.
public sealed class AppUser
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Email { get; set; }
    public required string Password { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
