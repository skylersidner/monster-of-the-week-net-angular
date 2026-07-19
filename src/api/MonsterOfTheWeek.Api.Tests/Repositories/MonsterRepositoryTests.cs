using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Tests.Repositories;

public sealed class MonsterRepositoryTests
{
    [Fact]
    public async Task GetMonstersByMysteryIdAsync_ReturnsNameOrderedValues()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>()
            .UseSqlite(connection)
            .Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var mysteryId = Guid.NewGuid();
        context.Mysteries.Add(new Mystery { Id = mysteryId, Name = "Mystery" });
        context.Monsters.AddRange(
            new Monster { MysteryId = mysteryId, Name = "Zulu", HarmCapacity = 1 },
            new Monster { MysteryId = mysteryId, Name = "Alpha", HarmCapacity = 2 });
        await context.SaveChangesAsync();

        var repository = new MonsterRepository(context);
        var results = await repository.GetMonstersByMysteryIdAsync(mysteryId, CancellationToken.None);

        Assert.Equal(2, results.Count);
        Assert.Equal("Alpha", results[0].Name);
        Assert.Equal("Zulu", results[1].Name);
    }

    [Fact]
    public async Task GetAttackAsync_WithIncludeTags_LoadsWeaponTagNavigation()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>()
            .UseSqlite(connection)
            .Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var mystery = new Mystery { Name = "Mystery" };
        var monster = new Monster { MysteryId = mystery.Id, Name = "Monster", HarmCapacity = 7 };
        var attack = new MonsterAttack { MonsterId = monster.Id, Name = "Claw", Harm = 3 };
        var tag = new WeaponTag { Name = "messy", Description = "Messy attack" };

        context.Mysteries.Add(mystery);
        context.Monsters.Add(monster);
        context.MonsterAttacks.Add(attack);
        context.WeaponTags.Add(tag);
        context.MonsterAttackWeaponTags.Add(new MonsterAttackWeaponTag { MonsterAttackId = attack.Id, WeaponTagId = tag.Id });
        await context.SaveChangesAsync();

        var repository = new MonsterRepository(context);
        var loaded = await repository.GetAttackAsync(monster.Id, attack.Id, includeTags: true, CancellationToken.None);

        Assert.NotNull(loaded);
        Assert.Single(loaded.MonsterAttackWeaponTags);
        Assert.Equal("messy", loaded.MonsterAttackWeaponTags.First().WeaponTag.Name);
    }
}
