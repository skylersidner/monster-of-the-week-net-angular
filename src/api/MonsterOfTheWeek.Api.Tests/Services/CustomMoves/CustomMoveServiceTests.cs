using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.CustomMoves;

namespace MonsterOfTheWeek.Api.Tests.Services.CustomMoves;

/// <summary>
/// Phase 1's behaviour gate for <see cref="CustomMoveService"/>
/// (<c>docs/domain-custom-moves/architecture.md</c> §5 Phase 1, §23 item 5). Run against a real
/// SQLite <see cref="MotwDbContext"/> and the real service, like
/// <c>ResourceImageServiceTests</c> — the whole subject here is a predicate over
/// <c>(OwnerType, OwnerId, Id)</c> and a five-arm owner check, and a fake would be asserting the
/// implementation against itself.
///
/// <para>
/// Scoped to what is <i>behaviour</i> rather than plumbing: the owner check on the two methods
/// that have one and its absence on the four that do not; the mismatched owner-type/owner-id
/// pair, which is the one failure no FK can catch because there is no FK (§2.3); cross-owner
/// isolation on update, delete and bulk delete, which is §2.5's closing guarantee and the
/// predicate is the only thing producing it; and <c>OrderBy(Name)</c>, because the Phase 2
/// switchover's whole claim to being a refactor is that the five existing orderings survive.
/// </para>
///
/// <para>
/// <b>Not here, deliberately:</b> the route↔dictionary↔enum drift guard and the five-domain
/// projection parity test (§23 items 3 and 6) are Phase 2 — they guard code Phase 2 writes.
/// </para>
/// </summary>
public sealed class CustomMoveServiceTests
{
    private static UpsertCustomMoveRequest Request(string name, string? description = null) =>
        new(name, description);

    /// <summary>
    /// One owner of every <see cref="DomainOwnerType"/>, seeded into one context, so a test
    /// can name any owner type without re-seeding and so the cross-owner cases have something to
    /// be isolated from. The connection is the caller's to dispose; SQLite in-memory keeps the
    /// schema alive exactly as long as it is open.
    /// </summary>
    private sealed record Owners(Guid Mystery, Guid Monster, Guid Minion, Guid Location, Guid Bystander)
    {
        public Guid For(DomainOwnerType ownerType) => ownerType switch
        {
            DomainOwnerType.Mystery => Mystery,
            DomainOwnerType.Monster => Monster,
            DomainOwnerType.Minion => Minion,
            DomainOwnerType.Location => Location,
            DomainOwnerType.Bystander => Bystander,
            _ => throw new ArgumentOutOfRangeException(nameof(ownerType), ownerType, "Unknown owner type."),
        };
    }

    private static async Task<(MotwDbContext Context, SqliteConnection Connection)> CreateContextAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;
        var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();
        return (context, connection);
    }

    private static async Task<Owners> SeedOneOwnerOfEachTypeAsync(MotwDbContext context)
    {
        var adventureType = new AdventureType { Name = "Thwart", Description = "Hunters vs bad guy." };
        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." };
        var minionType = new MinionType { Name = "Thug", Motivation = "To hurt." };
        var locationType = new LocationType { Name = "Den", Motivation = "To hide things." };
        var bystanderType = new BystanderType { Name = "Victim", Motivation = "To survive." };

        var mystery = new Mystery { Name = "The Quiet", AdventureType = adventureType };
        var monster = new Monster
        {
            Name = "Gravewalker",
            HarmCapacity = 4,
            MonsterType = monsterType,
            MonsterArchetype = archetype,
        };
        var location = new Location { Name = "The Diner", LocationType = locationType };
        var bystander = new Bystander { Name = "Nosy Neighbor", BystanderType = bystanderType };

        context.Mysteries.Add(mystery);
        context.Monsters.Add(monster);
        context.Locations.Add(location);
        context.Bystanders.Add(bystander);
        await context.SaveChangesAsync();

        var minion = new Minion { Name = "Grunt", MonsterId = monster.Id, MinionType = minionType, HarmCapacity = 1 };
        context.Minions.Add(minion);
        await context.SaveChangesAsync();

        return new Owners(mystery.Id, monster.Id, minion.Id, location.Id, bystander.Id);
    }

    [Theory]
    [InlineData(DomainOwnerType.Mystery)]
    [InlineData(DomainOwnerType.Monster)]
    [InlineData(DomainOwnerType.Minion)]
    [InlineData(DomainOwnerType.Location)]
    [InlineData(DomainOwnerType.Bystander)]
    public async Task CreateAsync_ThenListAsync_RoundTrips_ForEveryOwnerType(DomainOwnerType ownerType)
    {
        // One case per enum member, not one case for Monster: OwnerExistsAsync is a five-arm
        // switch whose wrong arm compiles, and its `_ =>` arm throws. A member added without an
        // arm fails here rather than as a 500 from a route that looks complete (B12).
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        var created = await service.CreateAsync(ownerType, owners.For(ownerType), Request("Read a Bad Situation"), CancellationToken.None);

        Assert.True(created.IsSuccess);
        Assert.Equal("Read a Bad Situation", created.Value!.Name);

        var listed = await service.ListAsync(ownerType, owners.For(ownerType), CancellationToken.None);

        Assert.True(listed.IsSuccess);
        Assert.Equal(created.Value.Id, Assert.Single(listed.Value!).Id);
    }

    [Fact]
    public async Task ListAsync_ReturnsNotFound_WhenTheOwnerDoesNotExist()
    {
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var service = new CustomMoveService(context);

        var result = await service.ListAsync(DomainOwnerType.Monster, Guid.NewGuid(), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.NotFound, result.Error!.Type);
    }

    [Fact]
    public async Task ListAsync_ReturnsEmptySuccess_WhenTheOwnerExistsWithNoMoves()
    {
        // The pair that makes the owner check on ListAsync worth its round trip: "owner missing"
        // and "owner has no moves" are a 404 and a 200 [] on the shipped endpoints today, and the
        // Phase 2 gate is that they stay distinguishable (§16.2, §18).
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        var result = await service.ListAsync(DomainOwnerType.Monster, owners.Monster, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value!);
    }

    [Fact]
    public async Task CreateAsync_ReturnsNotFound_AndInsertsNothing_WhenTheOwnerDoesNotExist()
    {
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var service = new CustomMoveService(context);

        var result = await service.CreateAsync(
            DomainOwnerType.Monster, Guid.NewGuid(), Request("Vanish"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.NotFound, result.Error!.Type);
        Assert.Equal(0, await context.CustomMoves.CountAsync());
    }

    [Fact]
    public async Task CreateAsync_ReturnsNotFound_AndInsertsNothing_WhenTheOwnerIdBelongsToADifferentOwnerType()
    {
        // The failure no FK can catch, because §2.3 trades the FK away: a real Bystander id
        // presented as a Monster. The owner-type arm, not just the id, has to be part of the
        // check — and the row must not land, or a move would exist that no owner's URL can reach.
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        var result = await service.CreateAsync(
            DomainOwnerType.Monster, owners.Bystander, Request("Vanish"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.NotFound, result.Error!.Type);
        Assert.Equal(0, await context.CustomMoves.CountAsync());
    }

    [Fact]
    public async Task CreateAsync_TrimsNameAndDescription_AndStoresANullDescriptionAsNull()
    {
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        var trimmed = await service.CreateAsync(
            DomainOwnerType.Monster, owners.Monster, Request("  Vanish  ", "  into the dark  "), CancellationToken.None);
        var nullDescription = await service.CreateAsync(
            DomainOwnerType.Monster, owners.Monster, Request("Linger"), CancellationToken.None);

        Assert.Equal("Vanish", trimmed.Value!.Name);
        Assert.Equal("into the dark", trimmed.Value.Description);
        Assert.Null(nullDescription.Value!.Description);
    }

    [Fact]
    public async Task ListAsync_OrdersByName()
    {
        // The ordering all five per-domain repositories already have. Asserted because it is the
        // oracle the Phase 2 switchover's "this is a refactor" claim rests on.
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        foreach (var name in new[] { "Vanish", "Act Under Pressure", "Manipulate" })
        {
            Assert.True((await service.CreateAsync(
                DomainOwnerType.Monster, owners.Monster, Request(name), CancellationToken.None)).IsSuccess);
        }

        var result = await service.ListAsync(DomainOwnerType.Monster, owners.Monster, CancellationToken.None);

        Assert.Equal(
            ["Act Under Pressure", "Manipulate", "Vanish"],
            result.Value!.Select(x => x.Name));
    }

    [Fact]
    public async Task ListAsync_ReturnsOnlyThisOwnersMoves_EvenWhenAnotherOwnerSharesTheName()
    {
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        var mine = await service.CreateAsync(
            DomainOwnerType.Monster, owners.Monster, Request("Vanish"), CancellationToken.None);
        Assert.True((await service.CreateAsync(
            DomainOwnerType.Bystander, owners.Bystander, Request("Vanish"), CancellationToken.None)).IsSuccess);
        Assert.True((await service.CreateAsync(
            DomainOwnerType.Minion, owners.Minion, Request("Vanish"), CancellationToken.None)).IsSuccess);

        var result = await service.ListAsync(DomainOwnerType.Monster, owners.Monster, CancellationToken.None);

        Assert.Equal(mine.Value!.Id, Assert.Single(result.Value!).Id);
    }

    [Fact]
    public async Task ListForProjectionAsync_ReturnsTheOwnersMoves_WithNoOwnerCheck()
    {
        // No ServiceResult, so there is no NotFound to return: an unknown owner is an empty list,
        // which is correct for the five detail projections because they have just loaded the
        // owner (§3.2). Asserted so nobody "hardens" it into a check Phase 2 would pay for on
        // every detail load and every create and update response (B3).
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        Assert.True((await service.CreateAsync(
            DomainOwnerType.Location, owners.Location, Request("Shift"), CancellationToken.None)).IsSuccess);

        Assert.Equal("Shift", Assert.Single(
            await service.ListForProjectionAsync(DomainOwnerType.Location, owners.Location, CancellationToken.None)).Name);
        Assert.Empty(
            await service.ListForProjectionAsync(DomainOwnerType.Location, Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNotFound_AndChangesNothing_WhenTheMoveBelongsToAnotherOwner()
    {
        // §2.5's closing guarantee: a move id belonging to one owner can never be read, updated
        // or deleted through another owner's URL. There is no owner-existence check on this path
        // (§18, B8) — the (OwnerType, OwnerId, Id) predicate is the only thing producing it, so
        // this is the test that would catch it being weakened to (Id) alone.
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        var created = await service.CreateAsync(
            DomainOwnerType.Monster, owners.Monster, Request("Vanish"), CancellationToken.None);

        // Through a different owner type...
        var crossType = await service.UpdateAsync(
            DomainOwnerType.Bystander, owners.Bystander, created.Value!.Id, Request("Stolen"), CancellationToken.None);
        // ...and through a different owner of the same type.
        var sameTypeOtherOwner = await service.UpdateAsync(
            DomainOwnerType.Monster, Guid.NewGuid(), created.Value.Id, Request("Stolen"), CancellationToken.None);

        Assert.Equal(ServiceErrorType.NotFound, crossType.Error!.Type);
        Assert.Equal(ServiceErrorType.NotFound, sameTypeOtherOwner.Error!.Type);
        Assert.Equal("Vanish", (await context.CustomMoves.AsNoTracking().SingleAsync()).Name);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesTheMove_AndReturnsIt_ThroughItsOwnOwner()
    {
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        var created = await service.CreateAsync(
            DomainOwnerType.Monster, owners.Monster, Request("Vanish", "old"), CancellationToken.None);

        var updated = await service.UpdateAsync(
            DomainOwnerType.Monster, owners.Monster, created.Value!.Id, Request("  Linger  ", null), CancellationToken.None);

        Assert.True(updated.IsSuccess);
        Assert.Equal(created.Value.Id, updated.Value!.Id);
        Assert.Equal("Linger", updated.Value.Name);
        Assert.Null(updated.Value.Description);
        Assert.Equal("Linger", (await context.CustomMoves.AsNoTracking().SingleAsync()).Name);
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalse_AndDeletesNothing_WhenTheMoveBelongsToAnotherOwner()
    {
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        var created = await service.CreateAsync(
            DomainOwnerType.Monster, owners.Monster, Request("Vanish"), CancellationToken.None);

        Assert.False(await service.DeleteAsync(
            DomainOwnerType.Bystander, owners.Bystander, created.Value!.Id, CancellationToken.None));
        Assert.False(await service.DeleteAsync(
            DomainOwnerType.Monster, Guid.NewGuid(), created.Value.Id, CancellationToken.None));
        Assert.Equal(1, await context.CustomMoves.CountAsync());
    }

    [Fact]
    public async Task DeleteAsync_DeletesTheMove_ThroughItsOwnOwner_AndIsNotIdempotent()
    {
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        var created = await service.CreateAsync(
            DomainOwnerType.Monster, owners.Monster, Request("Vanish"), CancellationToken.None);

        Assert.True(await service.DeleteAsync(
            DomainOwnerType.Monster, owners.Monster, created.Value!.Id, CancellationToken.None));
        // A second delete is a 404, not a 204 — derived from `deleted > 0`, matching every
        // shipped sub-resource delete (B9).
        Assert.False(await service.DeleteAsync(
            DomainOwnerType.Monster, owners.Monster, created.Value.Id, CancellationToken.None));
        Assert.Equal(0, await context.CustomMoves.CountAsync());
    }

    [Fact]
    public async Task DeleteAllForOwnerAsync_DeletesOnlyThatOwnersMoves()
    {
        // The count-to-zero assertion on a single-owner fixture cannot tell "cleaned up this
        // owner" from "cleaned up everything", and DeleteAllForOwnerAsync is exactly where a
        // mis-wired predicate does the latter (B-R11). So: three owners seeded, one cleaned.
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var owners = await SeedOneOwnerOfEachTypeAsync(context);
        var service = new CustomMoveService(context);

        Assert.True((await service.CreateAsync(
            DomainOwnerType.Monster, owners.Monster, Request("Vanish"), CancellationToken.None)).IsSuccess);
        Assert.True((await service.CreateAsync(
            DomainOwnerType.Monster, owners.Monster, Request("Linger"), CancellationToken.None)).IsSuccess);
        Assert.True((await service.CreateAsync(
            DomainOwnerType.Minion, owners.Minion, Request("Swarm"), CancellationToken.None)).IsSuccess);
        Assert.True((await service.CreateAsync(
            DomainOwnerType.Mystery, owners.Mystery, Request("Close In"), CancellationToken.None)).IsSuccess);

        await service.DeleteAllForOwnerAsync(DomainOwnerType.Monster, owners.Monster, CancellationToken.None);

        Assert.Empty(await service.ListForProjectionAsync(
            DomainOwnerType.Monster, owners.Monster, CancellationToken.None));
        Assert.Equal(
            ["Close In", "Swarm"],
            await context.CustomMoves.AsNoTracking().OrderBy(x => x.Name).Select(x => x.Name).ToListAsync());
    }

    [Fact]
    public async Task DeleteAllForOwnerAsync_IsANoOp_ForAnOwnerWithNoMoves()
    {
        // The case people skip, and the one that catches a cleanup that throws on a missing
        // owner — which in Phase 2 would turn an ordinary delete into a 500
        // (MonsterImageCleanupTests has the same case for the same reason).
        var (context, connection) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;

        var service = new CustomMoveService(context);

        await service.DeleteAllForOwnerAsync(DomainOwnerType.Mystery, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(0, await context.CustomMoves.CountAsync());
    }
}
