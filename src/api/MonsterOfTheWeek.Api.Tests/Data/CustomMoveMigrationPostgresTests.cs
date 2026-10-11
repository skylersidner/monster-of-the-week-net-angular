using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Tests.Data;

/// <summary>
/// Phase 1's real-Postgres gate for domain custom moves
/// (<c>docs/domain-custom-moves/architecture.md</c> §5 Phase 1, §23 item 1, B5). Nothing else in
/// this suite runs a migration — every other test builds its schema from the EF model with
/// SQLite's <c>EnsureCreatedAsync</c>, which would never notice a bad migration — so this is the
/// only thing that proves <c>_AddCustomMoves</c> applies to a brand-new database on the real
/// provider.
///
/// <para>
/// <b>A sibling of <see cref="ResourceImageMigrationPostgresTests"/>, not an extension of it</b>
/// (B5): that class's tests are about the image feature, and its first assertion names
/// <c>_AddResourceImages</c>. Bolting a custom-move assertion into it would make one class the
/// home of every future migration gate.
/// </para>
///
/// <para>
/// <b><see cref="PostgresCollection"/> is not optional.</b> Every Postgres-gated class drops and
/// recreates the one database <c>MOTW_TEST_POSTGRES</c> names, and xunit runs classes in parallel
/// by default; two such classes racing was caught for real once already — see that collection's
/// own comment. Phase 3 adds one more test here (the five old tables are gone), and it inherits
/// the attribute by living in this class.
/// </para>
///
/// <para>
/// Skipped unless <see cref="PostgresFactAttribute.ConnectionStringEnvironmentVariable"/> is set,
/// so a plain <c>dotnet test</c> reports this gate as <c>Skipped</c> and never as a false pass.
/// Run it deliberately, and never against the dev <c>motw</c> database.
/// </para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class CustomMoveMigrationPostgresTests
{
    private static string ConnectionString =>
        Environment.GetEnvironmentVariable(PostgresFactAttribute.ConnectionStringEnvironmentVariable)!;

    [PostgresFact]
    [Trait("Category", "Postgres")]
    public async Task Migrating_a_fresh_database_applies_the_full_history_including_AddCustomMoves()
    {
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseNpgsql(ConnectionString).Options;

        await using var context = new MotwDbContext(options);

        // Fresh, not "already migrated": drop whatever the connection string names and let
        // MigrateAsync() build it from nothing, the same way a brand-new deploy would — and the
        // same way the dev server does on every boot, since MotwDbInitializer calls MigrateAsync
        // at startup (B6).
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var pending = await context.Database.GetPendingMigrationsAsync();
        Assert.Empty(pending);

        var applied = await context.Database.GetAppliedMigrationsAsync();
        Assert.Contains(applied, name => name.EndsWith("_AddCustomMoves", StringComparison.Ordinal));
    }

    [PostgresFact]
    [Trait("Category", "Postgres")]
    public async Task The_migrated_custom_moves_table_is_actually_queryable_through_the_real_model()
    {
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseNpgsql(ConnectionString).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        // Through the model, not as a raw table count: this is what catches a column the config
        // named differently from the migration, or a type the provider maps differently than the
        // model expects. Nothing in the model is configured by convention here — every column
        // name is explicit — so a mismatch is a real possibility, not a theoretical one.
        Assert.Equal(0, await context.CustomMoves.CountAsync());

        // owner_type is the string-converted enum column (§22, the model's second HasConversion).
        // A filter on it has to translate to a varchar comparison against the stored member name;
        // if the migration had emitted an integer column this would fail at the server.
        Assert.Equal(0, await context.CustomMoves.CountAsync(x => x.OwnerType == CustomMoveOwnerType.Mystery));

        // And the round trip, because a Mystery-owned move is the one case no per-domain table
        // ever stored through this shape — mystery_custom_moves had a real FK, custom_moves has
        // the discriminator pair instead (§2.3).
        var adventureType = new AdventureType { Name = "Thwart", Description = "Hunters vs bad guy." };
        var mystery = new Mystery { Name = "The Quiet", AdventureType = adventureType };
        context.Mysteries.Add(mystery);
        await context.SaveChangesAsync();

        context.CustomMoves.Add(new CustomMove
        {
            OwnerType = CustomMoveOwnerType.Mystery,
            OwnerId = mystery.Id,
            Name = "Close In",
            Description = null,
        });
        await context.SaveChangesAsync();

        await using var verifyContext = new MotwDbContext(options);
        var stored = await verifyContext.CustomMoves.AsNoTracking().SingleAsync();

        Assert.Equal(CustomMoveOwnerType.Mystery, stored.OwnerType);
        Assert.Equal(mystery.Id, stored.OwnerId);
        Assert.Equal("Close In", stored.Name);
        Assert.Null(stored.Description);
    }
}
