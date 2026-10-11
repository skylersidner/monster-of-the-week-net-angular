using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Tests.Data;

/// <summary>
/// Phase 1's real-Postgres gate (<c>docs/resource-images/phases.md</c> Phase 1 verification):
/// nothing in the rest of this suite ever runs a migration — every other test builds its schema
/// with SQLite's <c>EnsureCreatedAsync</c>, generated straight from the EF model — so this is the
/// only thing that proves the actual migration history (through <c>AddResourceImages</c>) applies
/// cleanly to a brand-new database, on the real provider.
///
/// <para>
/// Skipped unless <see cref="PostgresFactAttribute.ConnectionStringEnvironmentVariable"/> is set;
/// see that attribute for why skip (not a silent pass) is the right default. Each test drops and
/// recreates the database the connection string names, so never point it at the dev <c>motw</c>
/// database.
/// </para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class ResourceImageMigrationPostgresTests
{
    private static string ConnectionString =>
        Environment.GetEnvironmentVariable(PostgresFactAttribute.ConnectionStringEnvironmentVariable)!;

    [PostgresFact]
    [Trait("Category", "Postgres")]
    public async Task Migrating_a_fresh_database_applies_the_full_history_including_AddResourceImages()
    {
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseNpgsql(ConnectionString).Options;

        await using var context = new MotwDbContext(options);

        // Fresh, not "already migrated": drop whatever the connection string names and let
        // MigrateAsync() build it from nothing, the same way a brand-new deploy would.
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var pending = await context.Database.GetPendingMigrationsAsync();
        Assert.Empty(pending);

        var applied = await context.Database.GetAppliedMigrationsAsync();
        Assert.Contains(applied, name => name.EndsWith("_AddResourceImages", StringComparison.Ordinal));
    }

    [PostgresFact]
    [Trait("Category", "Postgres")]
    public async Task The_migrated_schema_is_actually_queryable_through_the_real_model()
    {
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseNpgsql(ConnectionString).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        // resource_images exists with the shape the model expects.
        Assert.Equal(0, await context.ResourceImages.CountAsync());

        // Every owner's primary_image_id column exists and is the right type — a query that
        // filters on it would fail to translate (or fail at the server) if the column were
        // missing or mistyped, which a plain row-count on the table would not catch.
        Assert.Equal(0, await context.Monsters.CountAsync(m => m.PrimaryImageId != null));
        Assert.Equal(0, await context.Minions.CountAsync(m => m.PrimaryImageId != null));
        Assert.Equal(0, await context.Locations.CountAsync(l => l.PrimaryImageId != null));
        Assert.Equal(0, await context.Bystanders.CountAsync(b => b.PrimaryImageId != null));
    }

    [PostgresFact]
    [Trait("Category", "Postgres")]
    public async Task Deleting_the_primary_image_clears_the_owners_pointer_via_the_database_SetNull_FK()
    {
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseNpgsql(ConnectionString).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." };
        var monster = new Monster
        {
            Name = "Test Monster",
            HarmCapacity = 1,
            MonsterType = monsterType,
            MonsterArchetype = archetype,
        };
        var image = new ResourceImage
        {
            OwnerType = ResourceOwnerType.Monster,
            OwnerId = monster.Id,
            FileName = "test.webp",
            ContentType = "image/webp",
            SizeBytes = 1,
            Width = 1,
            Height = 1,
            ImageBytes = [0x01],
            SortOrder = 1,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        context.Monsters.Add(monster);
        context.ResourceImages.Add(image);
        await context.SaveChangesAsync();

        monster.PrimaryImageId = image.Id;
        await context.SaveChangesAsync();

        // Delete the image through a fresh, untracked context — the point is to prove the
        // database's own ON DELETE SET NULL clears the pointer, not EF's in-memory change
        // tracker doing it for us because the Monster happens to still be loaded.
        await using (var deleteContext = new MotwDbContext(options))
        {
            await deleteContext.ResourceImages.Where(i => i.Id == image.Id).ExecuteDeleteAsync();
        }

        await using var verifyContext = new MotwDbContext(options);
        var reloaded = await verifyContext.Monsters.SingleAsync(m => m.Id == monster.Id);
        Assert.Null(reloaded.PrimaryImageId);
    }
}
