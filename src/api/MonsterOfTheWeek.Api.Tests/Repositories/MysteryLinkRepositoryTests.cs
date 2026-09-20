using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Tests.Repositories;

/// <summary>
/// The membership predicates behind the Phase 1 link verb, against the real repositories and a
/// real (SQLite) database rather than a fake.
///
/// <para>
/// <b>Why this file exists.</b> The three service test suites exercise
/// <c>…LinkedToMysteryAsync</c> only through a hand-written fake whose predicate was copied from
/// the implementation, so a predicate that named the wrong column — or compared the two ids the
/// wrong way round — would agree with itself and pass. <c>MonsterLinkedToMysteryAsync</c> is the
/// sharp case: it shipped in Phase 7 with no production call site at all and until this change was
/// only ever reached through a test fake that hardcoded <c>false</c>.
/// </para>
/// </summary>
public sealed class MysteryLinkRepositoryTests
{
    // ---------- Monster ----------

    [Fact]
    public async Task MonsterLinkedToMysteryAsync_IsTrue_ForTheLinkedPairOnly()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new MonsterRepository(fixture.Context);

        await repository.LinkMonsterToMysteryAsync(
            new MysteryMonster { MysteryId = fixture.MysteryId, MonsterId = fixture.MonsterId },
            CancellationToken.None);
        await repository.SaveChangesAsync(CancellationToken.None);

        Assert.True(await repository.MonsterLinkedToMysteryAsync(fixture.MysteryId, fixture.MonsterId, CancellationToken.None));
        // Same monster, a different mystery.
        Assert.False(await repository.MonsterLinkedToMysteryAsync(fixture.OtherMysteryId, fixture.MonsterId, CancellationToken.None));
        // Same mystery, a different monster.
        Assert.False(await repository.MonsterLinkedToMysteryAsync(fixture.MysteryId, fixture.OtherMonsterId, CancellationToken.None));
        // The ids the wrong way round. Catches a transposed predicate, which every fake-backed
        // test in the service suites would agree with.
        Assert.False(await repository.MonsterLinkedToMysteryAsync(fixture.MonsterId, fixture.MysteryId, CancellationToken.None));
    }

    [Fact]
    public async Task MonsterLinkedToMysteryAsync_IsFalse_WhenNothingIsLinked()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new MonsterRepository(fixture.Context);

        Assert.False(await repository.MonsterLinkedToMysteryAsync(fixture.MysteryId, fixture.MonsterId, CancellationToken.None));
    }

    [Fact]
    public async Task MonsterLink_RoundTrips_AndUnlinkReportsRowsRemoved()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new MonsterRepository(fixture.Context);

        await repository.LinkMonsterToMysteryAsync(
            new MysteryMonster { MysteryId = fixture.MysteryId, MonsterId = fixture.MonsterId },
            CancellationToken.None);
        await repository.SaveChangesAsync(CancellationToken.None);

        Assert.Equal(1, await repository.UnlinkMonsterFromMysteryAsync(fixture.MysteryId, fixture.MonsterId, CancellationToken.None));
        Assert.False(await repository.MonsterLinkedToMysteryAsync(fixture.MysteryId, fixture.MonsterId, CancellationToken.None));
        // Unlinking what is not linked removes nothing, which is what makes the service's
        // `deleted > 0` translation meaningful.
        Assert.Equal(0, await repository.UnlinkMonsterFromMysteryAsync(fixture.MysteryId, fixture.MonsterId, CancellationToken.None));
    }

    // ---------- Location ----------

    [Fact]
    public async Task LocationLinkedToMysteryAsync_IsTrue_ForTheLinkedPairOnly()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        await repository.LinkLocationToMysteryAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);
        await repository.SaveChangesAsync(CancellationToken.None);

        Assert.True(await repository.LocationLinkedToMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));
        Assert.False(await repository.LocationLinkedToMysteryAsync(fixture.OtherMysteryId, fixture.LocationId, CancellationToken.None));
        Assert.False(await repository.LocationLinkedToMysteryAsync(fixture.MysteryId, fixture.OtherLocationId, CancellationToken.None));
        Assert.False(await repository.LocationLinkedToMysteryAsync(fixture.LocationId, fixture.MysteryId, CancellationToken.None));
    }

    [Fact]
    public async Task LocationLinkedToMysteryAsync_IsFalse_WhenNothingIsLinked()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        Assert.False(await repository.LocationLinkedToMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));
    }

    [Fact]
    public async Task LocationLink_RoundTrips_AndUnlinkReportsRowsRemoved()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        await repository.LinkLocationToMysteryAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);
        await repository.SaveChangesAsync(CancellationToken.None);

        Assert.Equal(1, await repository.UnlinkLocationFromMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));
        Assert.False(await repository.LocationLinkedToMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));
        Assert.Equal(0, await repository.UnlinkLocationFromMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));
    }

    // ---------- Bystander ----------

    [Fact]
    public async Task BystanderLinkedToMysteryAsync_IsTrue_ForTheLinkedPairOnly()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new BystanderRepository(fixture.Context);

        await repository.LinkBystanderToMysteryAsync(
            new MysteryBystander { MysteryId = fixture.MysteryId, BystanderId = fixture.BystanderId },
            CancellationToken.None);
        await repository.SaveChangesAsync(CancellationToken.None);

        Assert.True(await repository.BystanderLinkedToMysteryAsync(fixture.MysteryId, fixture.BystanderId, CancellationToken.None));
        Assert.False(await repository.BystanderLinkedToMysteryAsync(fixture.OtherMysteryId, fixture.BystanderId, CancellationToken.None));
        Assert.False(await repository.BystanderLinkedToMysteryAsync(fixture.MysteryId, fixture.OtherBystanderId, CancellationToken.None));
        Assert.False(await repository.BystanderLinkedToMysteryAsync(fixture.BystanderId, fixture.MysteryId, CancellationToken.None));
    }

    [Fact]
    public async Task BystanderLinkedToMysteryAsync_IsFalse_WhenNothingIsLinked()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new BystanderRepository(fixture.Context);

        Assert.False(await repository.BystanderLinkedToMysteryAsync(fixture.MysteryId, fixture.BystanderId, CancellationToken.None));
    }

    [Fact]
    public async Task BystanderLink_RoundTrips_AndUnlinkReportsRowsRemoved()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new BystanderRepository(fixture.Context);

        await repository.LinkBystanderToMysteryAsync(
            new MysteryBystander { MysteryId = fixture.MysteryId, BystanderId = fixture.BystanderId },
            CancellationToken.None);
        await repository.SaveChangesAsync(CancellationToken.None);

        Assert.Equal(1, await repository.UnlinkBystanderFromMysteryAsync(fixture.MysteryId, fixture.BystanderId, CancellationToken.None));
        Assert.False(await repository.BystanderLinkedToMysteryAsync(fixture.MysteryId, fixture.BystanderId, CancellationToken.None));
        Assert.Equal(0, await repository.UnlinkBystanderFromMysteryAsync(fixture.MysteryId, fixture.BystanderId, CancellationToken.None));
    }

    // ---------- Shared-reuse and lifecycle properties the three services rely on ----------

    [Fact]
    public async Task OneEntity_CanBeLinkedToTwoMysteries_AndUnlinkingOneLeavesTheOther()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        await repository.LinkLocationToMysteryAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);
        await repository.LinkLocationToMysteryAsync(
            new MysteryLocation { MysteryId = fixture.OtherMysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);
        await repository.SaveChangesAsync(CancellationToken.None);

        Assert.Equal(1, await repository.UnlinkLocationFromMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));

        Assert.False(await repository.LocationLinkedToMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));
        Assert.True(await repository.LocationLinkedToMysteryAsync(fixture.OtherMysteryId, fixture.LocationId, CancellationToken.None));
    }

    /// <summary>
    /// Characterises the race Bowser recorded as deliberately unguarded in
    /// <c>.squad/decisions/inbox/bowser-mystery-entity-linking-phase1-link-verb.md</c>: two
    /// concurrent PUTs for the same pair both pass <c>AnyAsync</c>, both insert, and the second
    /// <c>SaveChangesAsync</c> throws on the composite primary key, which the API surfaces as 500
    /// rather than 204. This test asserts today's behaviour, not the desired behaviour — if it
    /// ever starts failing, someone has made the insert idempotent at the database and the trade
    /// recorded in that decision note has changed.
    /// </summary>
    [Fact]
    public async Task DuplicateBridgeRow_ThrowsOnTheCompositeKey_RaceIsUnguarded()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        await repository.LinkLocationToMysteryAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);
        await repository.SaveChangesAsync(CancellationToken.None);

        // A second context, standing in for the second concurrent request: it has its own change
        // tracker, so the duplicate is caught by the database rather than by EF's identity map.
        await using var second = fixture.NewContext();
        var secondRepository = new LocationRepository(second);
        await secondRepository.LinkLocationToMysteryAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);

        await Assert.ThrowsAsync<DbUpdateException>(() => secondRepository.SaveChangesAsync(CancellationToken.None));
    }

    /// <summary>
    /// The <i>other</i> race in the same method, named in
    /// <c>.squad/decisions/inbox/boo-mystery-entity-linking-phase1-security-review.md</c>: the
    /// existence checks pass, the mystery is deleted concurrently, and the insert then fails on the
    /// <b>foreign key</b> rather than on the primary key. It reaches the caller as the same
    /// <c>DbUpdateException</c> as the duplicate above, which is why a blanket catch that returns
    /// success would answer 204 for a membership that does not exist.
    ///
    /// <para>
    /// Characterisation, like the duplicate test: this asserts today's behaviour. Its value is that
    /// the two races are pinned separately, so whoever implements the re-check-inside-the-catch
    /// guard has a case that must still throw sitting next to the case that must not.
    /// </para>
    /// </summary>
    [Fact]
    public async Task InsertingABridgeRowForADeletedMystery_ThrowsOnTheForeignKey()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        // Stage the insert the way the service does, after its existence checks have passed.
        await repository.LinkLocationToMysteryAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);

        // The concurrent request: the mystery goes away before this one saves.
        await using (var other = fixture.NewContext())
        {
            other.Mysteries.Remove(await other.Mysteries.SingleAsync(x => x.Id == fixture.MysteryId));
            await other.SaveChangesAsync();
        }

        await Assert.ThrowsAsync<DbUpdateException>(() => repository.SaveChangesAsync(CancellationToken.None));
    }

    /// <summary>
    /// Why the "stale bridge row" ordering test lives in the service suites and not here: in a
    /// real database the row cannot outlive its mystery, because deleting the mystery cascades it.
    /// The service's check order is defence against that invariant being wrong, so it has to be
    /// asserted where a bridge row can be staged independently of the rows it names.
    /// </summary>
    [Fact]
    public async Task DeletingAMystery_CascadesItsBridgeRows()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        await repository.LinkLocationToMysteryAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);
        await repository.SaveChangesAsync(CancellationToken.None);

        var mystery = await fixture.Context.Mysteries
            .Include(x => x.MysteryLocations)
            .SingleAsync(x => x.Id == fixture.MysteryId);
        fixture.Context.Mysteries.Remove(mystery);
        await fixture.Context.SaveChangesAsync();

        Assert.False(await repository.LocationLinkedToMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));
        // The location itself survives, per the Phase 7 cascade contract.
        Assert.True(await repository.LocationExistsAsync(fixture.LocationId, CancellationToken.None));
    }

    /// <summary>
    /// One in-memory SQLite database holding a mystery, a second mystery, and one of each linkable
    /// entity plus a spare, so a test can tell "this pair" from "a pair sharing one id."
    /// </summary>
    private sealed class LinkFixture : IAsyncDisposable
    {
        private SqliteConnection connection = null!;
        private DbContextOptions<MotwDbContext> options = null!;

        public MotwDbContext Context { get; private set; } = null!;

        public Guid MysteryId { get; } = Guid.NewGuid();
        public Guid OtherMysteryId { get; } = Guid.NewGuid();
        public Guid MonsterId { get; } = Guid.NewGuid();
        public Guid OtherMonsterId { get; } = Guid.NewGuid();
        public Guid LocationId { get; } = Guid.NewGuid();
        public Guid OtherLocationId { get; } = Guid.NewGuid();
        public Guid BystanderId { get; } = Guid.NewGuid();
        public Guid OtherBystanderId { get; } = Guid.NewGuid();

        public static async Task<LinkFixture> CreateAsync()
        {
            var fixture = new LinkFixture();
            fixture.connection = new SqliteConnection("DataSource=:memory:");
            await fixture.connection.OpenAsync();
            fixture.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(fixture.connection).Options;

            fixture.Context = fixture.NewContext();
            await fixture.Context.Database.EnsureCreatedAsync();

            var adventureTypeId = Guid.NewGuid();
            var monsterTypeId = Guid.NewGuid();
            var monsterArchetypeId = Guid.NewGuid();
            var locationTypeId = Guid.NewGuid();
            var bystanderTypeId = Guid.NewGuid();

            fixture.Context.AdventureTypes.Add(new AdventureType { Id = adventureTypeId, Name = "Thwart", Description = "Hunters vs bad guy." });
            fixture.Context.MonsterTypes.Add(new MonsterType { Id = monsterTypeId, Name = "Devourer", Motivation = "To consume." });
            fixture.Context.MonsterArchetypes.Add(new MonsterArchetype { Id = monsterArchetypeId, Name = "Heavy Hitter", Description = "It is the threat" });
            fixture.Context.LocationTypes.Add(new LocationType { Id = locationTypeId, Name = "Crossroads", Motivation = "To divide." });
            fixture.Context.BystanderTypes.Add(new BystanderType { Id = bystanderTypeId, Name = "Witness", Motivation = "To reveal." });
            await fixture.Context.SaveChangesAsync();

            fixture.Context.Mysteries.Add(new Mystery { Id = fixture.MysteryId, Name = "The Quiet", AdventureTypeId = adventureTypeId });
            fixture.Context.Mysteries.Add(new Mystery { Id = fixture.OtherMysteryId, Name = "Dead Air", AdventureTypeId = adventureTypeId });
            fixture.Context.Monsters.AddRange(
                new Monster { Id = fixture.MonsterId, Name = "Gravewalker", HarmCapacity = 4, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId },
                new Monster { Id = fixture.OtherMonsterId, Name = "Other Monster", HarmCapacity = 4, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId });
            fixture.Context.Locations.AddRange(
                new Location { Id = fixture.LocationId, Name = "The Diner", LocationTypeId = locationTypeId },
                new Location { Id = fixture.OtherLocationId, Name = "Other Location", LocationTypeId = locationTypeId });
            fixture.Context.Bystanders.AddRange(
                new Bystander { Id = fixture.BystanderId, Name = "Nosy Neighbor", BystanderTypeId = bystanderTypeId },
                new Bystander { Id = fixture.OtherBystanderId, Name = "Other Bystander", BystanderTypeId = bystanderTypeId });
            await fixture.Context.SaveChangesAsync();
            fixture.Context.ChangeTracker.Clear();

            return fixture;
        }

        public MotwDbContext NewContext() => new(options);

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
