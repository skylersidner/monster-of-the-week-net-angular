namespace MonsterOfTheWeek.Api.Tests.Data;

/// <summary>
/// Every <see cref="PostgresFactAttribute"/>-gated test for this feature points at the same
/// externally-supplied database name (<see cref="PostgresFactAttribute.ConnectionStringEnvironmentVariable"/>
/// is one env var for the whole gate, not one per test class), and each test drops and recreates
/// that database. xunit runs different test classes in parallel by default, so without this
/// collection two Postgres-gated classes racing their own <c>EnsureDeletedAsync</c>/
/// <c>MigrateAsync</c> pairs against the same database name corrupts each other's schema —
/// caught directly: a second class's migration failed with a stray "column does not exist" from
/// a half-applied schema the first class's drop interrupted mid-run. Every class in this
/// collection shares one xunit collection, which xunit runs sequentially relative to each other.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class ResourceImagePostgresCollection
{
    public const string Name = "Resource Image Postgres tests";
}
