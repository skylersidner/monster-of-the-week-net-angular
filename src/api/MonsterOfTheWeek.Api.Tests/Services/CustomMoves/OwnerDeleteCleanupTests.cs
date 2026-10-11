using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.CustomMoves;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Services.CustomMoves;

/// <summary>
/// Phase 2's owner-delete cleanup, for all five owners
/// (<c>docs/domain-custom-moves/architecture.md</c> §19, §2.4). <c>custom_moves</c> has no FK to
/// its owner (§2.3), so nothing in the database removes these rows when their owner goes —
/// application code has to, and this is what proves it does.
///
/// <para>
/// <b><see cref="MonsterImageCleanupTests"/> is the template and these are the same three cases
/// it has</b>: the owner's own rows (and its cascaded children's) go; the no-rows case still
/// commits; an unknown owner returns <c>false</c> and commits an empty transaction. The third is
/// the one people skip and the one that catches a cleanup that throws on a missing owner, which
/// would turn an ordinary delete into a 500.
/// </para>
///
/// <para>
/// <b>Every case seeds a second owner whose moves must survive</b> (B-R11). A count-to-zero on a
/// single-owner fixture cannot tell "cleaned up this owner" from "cleaned up everything", and
/// <c>DeleteAllForOwnerAsync</c> is precisely the method where a mis-wired predicate does the
/// latter. <c>MonsterImageCleanupTests</c> gets away without one; this file should not copy that
/// part.
/// </para>
///
/// <para>
/// Built against a real SQLite <see cref="MotwDbContext"/> with the real repositories and the
/// real services, as that file does and for the reason its own doc gives: a fake would be
/// asserting the implementation against itself. <b>Every service here is handed the <i>same</i>
/// context instance</b> — B10's construction requirement, without which
/// <c>BeginTransactionAsync</c> opens a transaction on a different connection and the cleanup
/// runs outside it, silently and green.
/// </para>
/// </summary>
public sealed class OwnerDeleteCleanupTests
{
    private static async Task<MotwDbContext> CreateContextAsync(SqliteConnection connection)
    {
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;
        var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();
        return context;
    }

    private static CustomMove Move(CustomMoveOwnerType ownerType, Guid ownerId, string name) =>
        new() { OwnerType = ownerType, OwnerId = ownerId, Name = name };

    /// <summary>
    /// The surviving owner every case needs. A Bystander, because no flow under test deletes one
    /// except the Bystander case, which uses a second Bystander instead.
    /// </summary>
    private static async Task<Guid> SeedSurvivingOwnerAsync(MotwDbContext context)
    {
        var bystander = new Bystander
        {
            Name = "Innocent Passer-By",
            BystanderType = new BystanderType { Name = "Victim", Motivation = "To survive." },
        };
        context.Bystanders.Add(bystander);
        await context.SaveChangesAsync();

        context.CustomMoves.Add(Move(CustomMoveOwnerType.Bystander, bystander.Id, "Must Survive"));
        await context.SaveChangesAsync();
        return bystander.Id;
    }

    private static async Task AssertOnlyTheSurvivorsMoveRemainsAsync(MotwDbContext context, Guid survivingBystanderId)
    {
        var remaining = await context.CustomMoves.AsNoTracking().ToListAsync();
        var survivor = Assert.Single(remaining);
        Assert.Equal("Must Survive", survivor.Name);
        Assert.Equal(CustomMoveOwnerType.Bystander, survivor.OwnerType);
        Assert.Equal(survivingBystanderId, survivor.OwnerId);
    }

    // --- Monster: the one with a cascaded child (§2.4) ---

    [Fact]
    public async Task DeletingAMonster_AlsoDeletesItsOwnCustomMoves_AndItsMinionsCustomMoves()
    {
        // The case §2.4 is about. Deleting a Monster cascades its Minions at the database level,
        // which runs no application code — so a cleanup that handles only the Monster's own rows
        // leaves every Minion's moves orphaned, and a monster-only seed would pass.
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var monster = new Monster
        {
            Name = "Gravewalker",
            HarmCapacity = 4,
            MonsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." },
            MonsterArchetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." },
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var minion = new Minion
        {
            Name = "Grunt",
            MonsterId = monster.Id,
            MinionType = new MinionType { Name = "Thug", Motivation = "To hurt." },
            HarmCapacity = 1,
        };
        context.Minions.Add(minion);
        await context.SaveChangesAsync();

        var survivingBystanderId = await SeedSurvivingOwnerAsync(context);
        context.CustomMoves.AddRange(
            Move(CustomMoveOwnerType.Monster, monster.Id, "Rise Again"),
            Move(CustomMoveOwnerType.Minion, minion.Id, "Swarm"));
        await context.SaveChangesAsync();

        // The premise, asserted — three rows, not "some rows".
        Assert.Equal(3, await context.CustomMoves.CountAsync());

        var monsterService = new MonsterService(
            new MonsterRepository(context),
            new MinionRepository(context),
            new ResourceImageService(context),
            new CustomMoveService(context));

        Assert.True(await monsterService.DeleteAsync(monster.Id, CancellationToken.None));

        Assert.Equal(0, await context.Monsters.CountAsync());
        // The Minion went too, by the database cascade — which is what makes its moves having
        // been cleaned up meaningful rather than incidental.
        Assert.Equal(0, await context.Minions.CountAsync());
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, survivingBystanderId);
    }

    [Fact]
    public async Task DeletingAMonsterWithNoCustomMoves_StillDeletesTheMonster_AndCommitsTheTransaction()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var monster = new Monster
        {
            Name = "Gravewalker",
            HarmCapacity = 4,
            MonsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." },
            MonsterArchetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." },
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var survivingBystanderId = await SeedSurvivingOwnerAsync(context);

        var monsterService = new MonsterService(
            new MonsterRepository(context),
            new MinionRepository(context),
            new ResourceImageService(context),
            new CustomMoveService(context));

        Assert.True(await monsterService.DeleteAsync(monster.Id, CancellationToken.None));

        Assert.Equal(0, await context.Monsters.CountAsync());
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, survivingBystanderId);
    }

    [Fact]
    public async Task DeletingAnUnknownMonster_ReturnsFalse_AndCommitsAnEmptyTransaction()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var survivingBystanderId = await SeedSurvivingOwnerAsync(context);

        var monsterService = new MonsterService(
            new MonsterRepository(context),
            new MinionRepository(context),
            new ResourceImageService(context),
            new CustomMoveService(context));

        Assert.False(await monsterService.DeleteAsync(Guid.NewGuid(), CancellationToken.None));
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, survivingBystanderId);
    }

    // --- Minion ---

    [Fact]
    public async Task DeletingAMinion_DeletesItsOwnCustomMoves_AndLeavesItsMonstersAlone()
    {
        // The complement of the Monster case: deleting a Minion must not reach up to its Monster.
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var monster = new Monster
        {
            Name = "Gravewalker",
            HarmCapacity = 4,
            MonsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." },
            MonsterArchetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." },
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var minion = new Minion
        {
            Name = "Grunt",
            MonsterId = monster.Id,
            MinionType = new MinionType { Name = "Thug", Motivation = "To hurt." },
            HarmCapacity = 1,
        };
        context.Minions.Add(minion);
        await context.SaveChangesAsync();

        context.CustomMoves.AddRange(
            Move(CustomMoveOwnerType.Minion, minion.Id, "Swarm"),
            Move(CustomMoveOwnerType.Monster, monster.Id, "Rise Again"));
        await context.SaveChangesAsync();

        var minionService = new MinionService(
            new MinionRepository(context),
            new ResourceImageService(context),
            new CustomMoveService(context));

        Assert.True(await minionService.DeleteAsync(minion.Id, CancellationToken.None));

        Assert.Equal(1, await context.Monsters.CountAsync());
        var survivor = Assert.Single(await context.CustomMoves.AsNoTracking().ToListAsync());
        Assert.Equal("Rise Again", survivor.Name);
        Assert.Equal(CustomMoveOwnerType.Monster, survivor.OwnerType);
    }

    [Fact]
    public async Task DeletingAnUnknownMinion_ReturnsFalse_AndCommitsAnEmptyTransaction()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var survivingBystanderId = await SeedSurvivingOwnerAsync(context);

        var minionService = new MinionService(
            new MinionRepository(context),
            new ResourceImageService(context),
            new CustomMoveService(context));

        Assert.False(await minionService.DeleteAsync(Guid.NewGuid(), CancellationToken.None));
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, survivingBystanderId);
    }

    // --- Location ---

    [Fact]
    public async Task DeletingALocation_DeletesItsOwnCustomMoves_AndNoOthers()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var location = new Location
        {
            Name = "The Diner",
            LocationType = new LocationType { Name = "Den", Motivation = "To hide things." },
        };
        context.Locations.Add(location);
        await context.SaveChangesAsync();

        var survivingBystanderId = await SeedSurvivingOwnerAsync(context);
        context.CustomMoves.Add(Move(CustomMoveOwnerType.Location, location.Id, "Shift"));
        await context.SaveChangesAsync();

        Assert.Equal(2, await context.CustomMoves.CountAsync());

        var locationService = new LocationService(
            new LocationRepository(context),
            new ResourceImageService(context),
            new CustomMoveService(context));

        Assert.True(await locationService.DeleteAsync(location.Id, CancellationToken.None));

        Assert.Equal(0, await context.Locations.CountAsync());
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, survivingBystanderId);
    }

    [Fact]
    public async Task DeletingAnUnknownLocation_ReturnsFalse_AndCommitsAnEmptyTransaction()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var survivingBystanderId = await SeedSurvivingOwnerAsync(context);

        var locationService = new LocationService(
            new LocationRepository(context),
            new ResourceImageService(context),
            new CustomMoveService(context));

        Assert.False(await locationService.DeleteAsync(Guid.NewGuid(), CancellationToken.None));
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, survivingBystanderId);
    }

    // --- Bystander ---

    [Fact]
    public async Task DeletingABystander_DeletesItsOwnCustomMoves_AndNotAnotherBystandersOfTheSameType()
    {
        // The same-owner-type case, which the shared survivor cannot cover for this domain: a
        // predicate that filtered on OwnerType alone and forgot OwnerId would pass every other
        // test in this file and delete both of these.
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var bystanderType = new BystanderType { Name = "Witness", Motivation = "To be believed." };
        var doomed = new Bystander { Name = "Nosy Neighbor", BystanderType = bystanderType };
        var spared = new Bystander { Name = "Quiet Neighbor", BystanderType = bystanderType };
        context.Bystanders.AddRange(doomed, spared);
        await context.SaveChangesAsync();

        context.CustomMoves.AddRange(
            Move(CustomMoveOwnerType.Bystander, doomed.Id, "Blurt It Out"),
            Move(CustomMoveOwnerType.Bystander, spared.Id, "Must Survive"));
        await context.SaveChangesAsync();

        var bystanderService = new BystanderService(
            new BystanderRepository(context),
            new ResourceImageService(context),
            new CustomMoveService(context));

        Assert.True(await bystanderService.DeleteAsync(doomed.Id, CancellationToken.None));

        Assert.Equal(1, await context.Bystanders.CountAsync());
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, spared.Id);
    }

    [Fact]
    public async Task DeletingAnUnknownBystander_ReturnsFalse_AndCommitsAnEmptyTransaction()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var survivingBystanderId = await SeedSurvivingOwnerAsync(context);

        var bystanderService = new BystanderService(
            new BystanderRepository(context),
            new ResourceImageService(context),
            new CustomMoveService(context));

        Assert.False(await bystanderService.DeleteAsync(Guid.NewGuid(), CancellationToken.None));
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, survivingBystanderId);
    }

    // --- Mystery: the flow that had no transaction at all before Phase 2 (§3.5, B10) ---

    [Fact]
    public async Task DeletingAMystery_DeletesItsOwnCustomMoves_AndLeavesItsLinkedMonstersAlone()
    {
        // The M:N half, which is why Mystery has no nested-owner trap: a linked Monster survives
        // the Mystery and so must its moves — it cleans up its own on its own delete.
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var mystery = new Mystery
        {
            Name = "The Quiet",
            AdventureType = new AdventureType { Name = "Thwart", Description = "Hunters vs bad guy." },
        };
        var monster = new Monster
        {
            Name = "Gravewalker",
            HarmCapacity = 4,
            MonsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." },
            MonsterArchetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." },
        };
        context.Mysteries.Add(mystery);
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        context.MysteryMonsters.Add(new MysteryMonster { MysteryId = mystery.Id, MonsterId = monster.Id });
        context.CustomMoves.AddRange(
            Move(CustomMoveOwnerType.Mystery, mystery.Id, "Close In"),
            Move(CustomMoveOwnerType.Monster, monster.Id, "Rise Again"));
        await context.SaveChangesAsync();

        var mysteryService = new MysteryService(new MysteryRepository(context), new CustomMoveService(context));

        Assert.True(await mysteryService.DeleteAsync(mystery.Id, CancellationToken.None));

        Assert.Equal(0, await context.Mysteries.CountAsync());
        Assert.Equal(1, await context.Monsters.CountAsync());
        var survivor = Assert.Single(await context.CustomMoves.AsNoTracking().ToListAsync());
        Assert.Equal("Rise Again", survivor.Name);
        Assert.Equal(CustomMoveOwnerType.Monster, survivor.OwnerType);
    }

    [Fact]
    public async Task DeletingAMysteryWithNoCustomMoves_StillDeletesTheMystery_AndCommitsTheTransaction()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var mystery = new Mystery
        {
            Name = "The Quiet",
            AdventureType = new AdventureType { Name = "Thwart", Description = "Hunters vs bad guy." },
        };
        context.Mysteries.Add(mystery);
        await context.SaveChangesAsync();

        var survivingBystanderId = await SeedSurvivingOwnerAsync(context);

        var mysteryService = new MysteryService(new MysteryRepository(context), new CustomMoveService(context));

        Assert.True(await mysteryService.DeleteAsync(mystery.Id, CancellationToken.None));

        Assert.Equal(0, await context.Mysteries.CountAsync());
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, survivingBystanderId);
    }

    [Fact]
    public async Task DeletingAnUnknownMystery_ReturnsFalse_AndCommitsAnEmptyTransaction()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await using var context = await CreateContextAsync(connection);

        var survivingBystanderId = await SeedSurvivingOwnerAsync(context);

        var mysteryService = new MysteryService(new MysteryRepository(context), new CustomMoveService(context));

        Assert.False(await mysteryService.DeleteAsync(Guid.NewGuid(), CancellationToken.None));
        await AssertOnlyTheSurvivorsMoveRemainsAsync(context, survivingBystanderId);
    }
}
