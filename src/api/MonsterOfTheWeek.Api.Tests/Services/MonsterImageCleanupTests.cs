using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// Phase 3's highest-priority correction (phases.md §3.6/§1 item 9): deleting a Monster must
/// also delete its own images and every one of its Minions' images, in one transaction — Minion
/// deletion cascades at the database level and runs no application code, so without this fix
/// those images are silently orphaned. Exercised against a real SQLite <c>MotwDbContext</c>, with
/// the real <see cref="MonsterRepository"/>, <see cref="MinionRepository"/>, and
/// <see cref="ResourceImageService"/> — a fake repository would prove nothing here, since the
/// point is that a real transaction spans real EF Core calls against one real connection.
/// </summary>
public sealed class MonsterImageCleanupTests
{
    [Fact]
    public async Task DeletingAMonster_AlsoDeletesItsOwnImages_AndItsImagedMinionsImages()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." };
        var minionType = new MinionType { Name = "Thug", Motivation = "To hurt." };
        var monster = new Monster { Name = "Test Monster", HarmCapacity = 1, MonsterType = monsterType, MonsterArchetype = archetype };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var minion = new Minion { Name = "Grunt", MonsterId = monster.Id, MinionType = minionType, HarmCapacity = 1 };
        context.Minions.Add(minion);
        await context.SaveChangesAsync();

        var imageService = new ResourceImageService(context);
        await imageService.UploadAsync(
            ResourceOwnerType.Monster, monster.Id,
            [new ResourceImageUploadFile("monster.jpg", ResourceImages.ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);
        await imageService.UploadAsync(
            ResourceOwnerType.Minion, minion.Id,
            [new ResourceImageUploadFile("minion.jpg", ResourceImages.ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);

        Assert.Equal(2, await context.ResourceImages.CountAsync());

        var monsterRepository = new MonsterRepository(context);
        var minionRepository = new MinionRepository(context);
        var monsterService = new MonsterService(monsterRepository, minionRepository, imageService);

        var deleted = await monsterService.DeleteAsync(monster.Id, CancellationToken.None);

        Assert.True(deleted);
        Assert.Equal(0, await context.ResourceImages.CountAsync());
        Assert.Equal(0, await context.Monsters.CountAsync());
        // The Minion itself is gone too (DB-level cascade), confirming the images were cleaned up
        // *before* the cascade could have removed the rows that would have named them.
        Assert.Equal(0, await context.Minions.CountAsync());
    }

    [Fact]
    public async Task DeletingAMonsterWithNoImages_StillDeletesTheMonster_AndCommitsTheTransaction()
    {
        // The no-op case: no images to clean up, but the transaction must still commit rather
        // than leave the delete hanging.
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." };
        var monster = new Monster { Name = "Test Monster", HarmCapacity = 1, MonsterType = monsterType, MonsterArchetype = archetype };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var monsterRepository = new MonsterRepository(context);
        var minionRepository = new MinionRepository(context);
        var imageService = new ResourceImageService(context);
        var monsterService = new MonsterService(monsterRepository, minionRepository, imageService);

        var deleted = await monsterService.DeleteAsync(monster.Id, CancellationToken.None);

        Assert.True(deleted);
        Assert.Equal(0, await context.Monsters.CountAsync());
    }

    [Fact]
    public async Task DeletingAnUnknownMonster_ReturnsFalse_AndCommitsAnEmptyTransaction()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var monsterRepository = new MonsterRepository(context);
        var minionRepository = new MinionRepository(context);
        var imageService = new ResourceImageService(context);
        var monsterService = new MonsterService(monsterRepository, minionRepository, imageService);

        var deleted = await monsterService.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(deleted);
    }
}
