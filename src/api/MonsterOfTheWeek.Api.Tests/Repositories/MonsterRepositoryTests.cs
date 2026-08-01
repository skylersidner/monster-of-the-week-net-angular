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

        var adventureTypeId = Guid.NewGuid();
        var monsterTypeId = Guid.NewGuid();
        var monsterArchetypeId = Guid.NewGuid();
        var mysteryId = Guid.NewGuid();

        context.AdventureTypes.Add(new AdventureType { Id = adventureTypeId, Name = "Thwart", Description = "Hunters vs bad guy." });
        context.MonsterTypes.Add(new MonsterType { Id = monsterTypeId, Name = "Devourer", Motivation = "To consume." });
        context.MonsterArchetypes.Add(new MonsterArchetype { Id = monsterArchetypeId, Name = "Heavy Hitter", Description = "It is the threat" });
        context.Mysteries.Add(new Mystery { Id = mysteryId, Name = "Mystery", AdventureTypeId = adventureTypeId });
        await context.SaveChangesAsync();

        var monsterZulu = new Monster { Name = "Zulu", HarmCapacity = 1, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId };
        var monsterAlpha = new Monster { Name = "Alpha", HarmCapacity = 2, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId };
        context.Monsters.AddRange(monsterZulu, monsterAlpha);
        await context.SaveChangesAsync();

        context.MysteryMonsters.AddRange(
            new MysteryMonster { MysteryId = mysteryId, MonsterId = monsterZulu.Id },
            new MysteryMonster { MysteryId = mysteryId, MonsterId = monsterAlpha.Id });
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

        var monsterTypeId = Guid.NewGuid();
        var monsterArchetypeId = Guid.NewGuid();
        context.MonsterTypes.Add(new MonsterType { Id = monsterTypeId, Name = "Devourer", Motivation = "To consume." });
        context.MonsterArchetypes.Add(new MonsterArchetype { Id = monsterArchetypeId, Name = "Heavy Hitter", Description = "It is the threat" });
        await context.SaveChangesAsync();

        var monster = new Monster { Name = "Monster", HarmCapacity = 7, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId };
        var attack = new MonsterAttack { MonsterId = monster.Id, Name = "Claw", Harm = 3 };
        var tag = new WeaponTag { Name = "messy", Description = "Messy attack" };

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

