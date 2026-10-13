using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.CustomMoves;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Services.CustomMoves;

/// <summary>
/// Phase 2's five-domain drift guard, modelled on
/// <c>ListProjectionPrimaryImageAgreementTests</c> and written for the same class of bug
/// (<c>docs/domain-custom-moves/architecture.md</c> §23 item 6, B-R9).
///
/// <para>
/// <b>The hazard.</b> Five services each call <c>ListForProjectionAsync</c> with their own
/// <see cref="DomainOwnerType"/> literal, in a method nothing else cross-checks. A monster
/// service passing <c>DomainOwnerType.Minion</c> <b>compiles</b>, passes every monster test
/// that does not seed a custom move, and returns another owner's rows. Before Phase 2 that bug
/// did not exist — the nav property could only ever yield the right rows — so this is a guard the
/// switchover creates the need for, not one it inherits.
/// </para>
///
/// <para>
/// <b>Why it is one test and not five.</b> Five seeds, one context, all five
/// <c>GetByIdAsync</c> implementations called in turn: the assertion is that each detail response
/// carries <i>its own</i> move and not another's, and that is only visible when all five owners
/// exist at once with distinguishable moves. Five separate tests, each with one owner, would
/// every one of them pass with every literal wrong in the same direction.
/// </para>
///
/// <para>
/// Run against the services directly rather than over HTTP: this guards the projection, which
/// has no route of its own, and <c>CustomMoveEndpointTests</c> already covers the route.
/// </para>
/// </summary>
public sealed class DetailProjectionOwnerAgreementTests
{
    [Fact]
    public async Task EachDomainsDetailProjection_CarriesItsOwnCustomMoves_AndNoOtherOwners()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;
        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

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
        var location = new Location
        {
            Name = "The Diner",
            LocationType = new LocationType { Name = "Den", Motivation = "To hide things." },
        };
        var bystander = new Bystander
        {
            Name = "Nosy Neighbor",
            BystanderType = new BystanderType { Name = "Victim", Motivation = "To survive." },
        };
        context.AddRange(mystery, monster, location, bystander);
        await context.SaveChangesAsync();

        var minion = new Minion
        {
            Name = "Grave Hand",
            MonsterId = monster.Id,
            MinionType = new MinionType { Name = "Thug", Motivation = "To hurt." },
            HarmCapacity = 1,
        };
        context.Minions.Add(minion);
        await context.SaveChangesAsync();

        // One move per owner type, each named for its owner — so a wrong literal shows up as the
        // wrong *name*, which says which arm is wrong, rather than as a count mismatch, which
        // only says something is.
        context.CustomMoves.AddRange(
            new CustomMove { OwnerType = DomainOwnerType.Mystery, OwnerId = mystery.Id, Name = "Mystery Move" },
            new CustomMove { OwnerType = DomainOwnerType.Monster, OwnerId = monster.Id, Name = "Monster Move" },
            new CustomMove { OwnerType = DomainOwnerType.Minion, OwnerId = minion.Id, Name = "Minion Move" },
            new CustomMove { OwnerType = DomainOwnerType.Location, OwnerId = location.Id, Name = "Location Move" },
            new CustomMove { OwnerType = DomainOwnerType.Bystander, OwnerId = bystander.Id, Name = "Bystander Move" });
        await context.SaveChangesAsync();

        // Every owner id is distinct, so a service with the right OwnerId and the wrong OwnerType
        // returns nothing — and one with both wrong returns someone else's row. Both are caught.
        var customMoveService = new CustomMoveService(context);
        var imageService = new ResourceImageService(context);

        var mysteryService = new MysteryService(new MysteryRepository(context), customMoveService);
        var monsterService = new MonsterService(
            new MonsterRepository(context), new MinionRepository(context), imageService, customMoveService);
        var minionService = new MinionService(new MinionRepository(context), imageService, customMoveService);
        var locationService = new LocationService(new LocationRepository(context), imageService, customMoveService);
        var bystanderService = new BystanderService(new BystanderRepository(context), imageService, customMoveService);

        Assert.Equal(
            "Mystery Move",
            Assert.Single((await mysteryService.GetByIdAsync(mystery.Id, CancellationToken.None))!.CustomMoves).Name);
        Assert.Equal(
            "Monster Move",
            Assert.Single((await monsterService.GetByIdAsync(monster.Id, CancellationToken.None))!.CustomMoves).Name);
        Assert.Equal(
            "Minion Move",
            Assert.Single((await minionService.GetByIdAsync(minion.Id, CancellationToken.None))!.CustomMoves).Name);
        Assert.Equal(
            "Location Move",
            Assert.Single((await locationService.GetByIdAsync(location.Id, CancellationToken.None))!.CustomMoves).Name);
        Assert.Equal(
            "Bystander Move",
            Assert.Single((await bystanderService.GetByIdAsync(bystander.Id, CancellationToken.None))!.CustomMoves).Name);
    }

    /// <summary>
    /// Mystery's <c>CreateAsync</c> passes <c>[]</c> rather than querying, because a Mystery
    /// created three lines earlier cannot own a move (B3). Asserted so the shortcut stays a
    /// shortcut: if <c>CreateAsync</c> ever stopped being the last step, <c>[]</c> would become a
    /// lie and nothing else would notice.
    /// </summary>
    [Fact]
    public async Task MysteryCreate_ReturnsNoCustomMoves_AndMysteryUpdateReadsThemBack()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;
        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var adventureType = new AdventureType { Name = "Thwart", Description = "Hunters vs bad guy." };
        context.AdventureTypes.Add(adventureType);
        await context.SaveChangesAsync();

        var customMoveService = new CustomMoveService(context);
        var mysteryService = new MysteryService(new MysteryRepository(context), customMoveService);

        var created = await mysteryService.CreateAsync(
            new UpsertMysteryRequest("The Quiet", null, null, null, null, adventureType.Id), CancellationToken.None);

        Assert.True(created.IsSuccess);
        Assert.Empty(created.Value!.CustomMoves);

        Assert.True((await customMoveService.CreateAsync(
            DomainOwnerType.Mystery, created.Value.Id, new UpsertCustomMoveRequest("Close In", null),
            CancellationToken.None)).IsSuccess);

        // Update is the third of Mystery's three projection sites, and the one that does query.
        var updated = await mysteryService.UpdateAsync(
            created.Value.Id,
            new UpsertMysteryRequest("The Quiet, Renamed", null, null, null, null, adventureType.Id),
            CancellationToken.None);

        Assert.True(updated.IsSuccess);
        Assert.Equal("Close In", Assert.Single(updated.Value!.CustomMoves).Name);
    }
}
