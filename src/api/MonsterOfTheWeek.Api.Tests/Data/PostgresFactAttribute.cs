namespace MonsterOfTheWeek.Api.Tests.Data;

/// <summary>
/// A <see cref="FactAttribute"/> for tests that need a real Postgres server rather than the
/// SQLite provider the rest of this suite uses — currently, confirming a migration actually
/// applies (SQLite's <c>EnsureCreatedAsync</c> builds the schema from the model and never runs
/// a migration at all; see <c>docs/resource-images/phases.md</c> Phase 1/Phase 2).
///
/// <para>
/// <b>Visibly skipped, not silently passed.</b> Setting <see cref="FactAttribute.Skip"/> in the
/// constructor is evaluated at test discovery, so it re-reads the environment variable on every
/// run: with <c>MOTW_TEST_POSTGRES</c> unset, a plain <c>dotnet test</c> reports this test as
/// <c>Skipped</c> with a reason, never as a false <c>Passed</c>. Run deliberately with
/// <c>dotnet test --filter "Category=Postgres"</c> (also tagged via <see cref="TraitAttribute"/>
/// on each test method) once <c>MOTW_TEST_POSTGRES</c> points at a real server — for example the
/// repo's own <c>docker compose up -d postgres</c>.
/// </para>
/// </summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public const string ConnectionStringEnvironmentVariable = "MOTW_TEST_POSTGRES";

    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(ConnectionStringEnvironmentVariable)))
        {
            Skip = $"Set {ConnectionStringEnvironmentVariable} to a Postgres connection string to run this test " +
                   "(see docker-compose.yml). Never point it at the dev 'motw' database — this suite drops and " +
                   "recreates whatever database the connection string names.";
        }
    }
}
