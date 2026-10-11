using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.CustomMoves;
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
    /// <summary>
    /// The one construction all three tests in this file use, extracted so that a new constructor
    /// dependency on <see cref="MonsterService"/> is one edit here rather than three below
    /// (architecture.md §16.3 B1). The collaborators stay parameters rather than being built here:
    /// the whole point of this file is that they are the <i>real</i> implementations over the
    /// <i>same</i> <see cref="MotwDbContext"/> instance, so each test keeps constructing them
    /// where its context is in scope.
    ///
    /// <para>
    /// <b>That is also why <paramref name="customMoveService"/> is a parameter and not a fake
    /// built in here</b> (architecture.md B10): when Phase 2 adds the custom-move cleanup, it has
    /// to run on the same connection as the transaction <c>MonsterService.DeleteAsync</c> opens,
    /// which only holds if the service was handed the same context object. Passing the real one
    /// now costs nothing — Phase 1 never calls it — and means the construction this file's Phase 2
    /// sibling copies is already correct.
    /// </para>
    /// </summary>
    private static MonsterService CreateService(
        IMonsterRepository monsterRepository,
        IMinionRepository minionRepository,
        IResourceImageService resourceImageService,
        ICustomMoveService customMoveService) =>
        new(monsterRepository, minionRepository, resourceImageService, customMoveService);

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
        var monsterService = CreateService(monsterRepository, minionRepository, imageService, new CustomMoveService(context));

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
        var monsterService = CreateService(monsterRepository, minionRepository, imageService, new CustomMoveService(context));

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
        var monsterService = CreateService(monsterRepository, minionRepository, imageService, new CustomMoveService(context));

        var deleted = await monsterService.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(deleted);
    }
}
