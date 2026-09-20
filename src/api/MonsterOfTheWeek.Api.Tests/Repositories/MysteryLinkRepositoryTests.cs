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
    /// The race the Phase 2 gate in <c>docs/updates/mystery-entity-linking.md</c> §9 closes: two
    /// concurrent PUTs for the same pair both pass <c>AnyAsync</c>, both insert, and the loser's
    /// <c>SaveChangesAsync</c> violates the composite primary key.
    ///
    /// <para>
    /// This replaces the characterisation test that asserted the loser's <c>DbUpdateException</c>
    /// reaching the caller (surfaced as a 500). The repository's insert-and-save method now
    /// re-checks membership after the failure: the row is there, so the concurrent insert won and
    /// 204 is truthful. The <i>rethrow</i> half of that guard is pinned separately, by the
    /// deleted-mystery tests below — read the two together.
    /// </para>
    /// </summary>
    [Fact]
    public async Task ConcurrentDuplicateInsert_ReportsSuccess_AndLeavesExactlyOneRow()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        await repository.LinkLocationToMysteryAndSaveAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);

        // A second context, standing in for the second concurrent request: it has its own change
        // tracker, so the duplicate is caught by the database rather than by EF's identity map.
        await using var second = fixture.NewContext();
        var secondRepository = new LocationRepository(second);

        // The loser of the race. It must not throw — that is the whole change.
        await secondRepository.LinkLocationToMysteryAndSaveAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None);

        Assert.True(await secondRepository.LocationLinkedToMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));
        Assert.Equal(1, await second.MysteryLocations.CountAsync(x => x.MysteryId == fixture.MysteryId && x.LocationId == fixture.LocationId));

        // The abandoned insert was detached, not left Added, so a later SaveChanges in the same
        // request cannot resurrect it. Asserted twice: on the tracker, and by actually saving.
        Assert.DoesNotContain(second.ChangeTracker.Entries<MysteryLocation>(), x => x.State == EntityState.Added);
        await second.SaveChangesAsync();
        Assert.Equal(1, await second.MysteryLocations.CountAsync(x => x.MysteryId == fixture.MysteryId && x.LocationId == fixture.LocationId));
    }

    /// <summary>Same property as the Location case above, for the monster bridge.</summary>
    [Fact]
    public async Task ConcurrentDuplicateInsert_ReportsSuccess_AndLeavesExactlyOneRow_ForMonsters()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new MonsterRepository(fixture.Context);

        await repository.LinkMonsterToMysteryAndSaveAsync(
            new MysteryMonster { MysteryId = fixture.MysteryId, MonsterId = fixture.MonsterId },
            CancellationToken.None);

        await using var second = fixture.NewContext();
        var secondRepository = new MonsterRepository(second);
        await secondRepository.LinkMonsterToMysteryAndSaveAsync(
            new MysteryMonster { MysteryId = fixture.MysteryId, MonsterId = fixture.MonsterId },
            CancellationToken.None);

        Assert.True(await secondRepository.MonsterLinkedToMysteryAsync(fixture.MysteryId, fixture.MonsterId, CancellationToken.None));
        Assert.Equal(1, await second.MysteryMonsters.CountAsync(x => x.MysteryId == fixture.MysteryId && x.MonsterId == fixture.MonsterId));
        Assert.DoesNotContain(second.ChangeTracker.Entries<MysteryMonster>(), x => x.State == EntityState.Added);
    }

    /// <summary>Same property as the Location case above, for the bystander bridge.</summary>
    [Fact]
    public async Task ConcurrentDuplicateInsert_ReportsSuccess_AndLeavesExactlyOneRow_ForBystanders()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new BystanderRepository(fixture.Context);

        await repository.LinkBystanderToMysteryAndSaveAsync(
            new MysteryBystander { MysteryId = fixture.MysteryId, BystanderId = fixture.BystanderId },
            CancellationToken.None);

        await using var second = fixture.NewContext();
        var secondRepository = new BystanderRepository(second);
        await secondRepository.LinkBystanderToMysteryAndSaveAsync(
            new MysteryBystander { MysteryId = fixture.MysteryId, BystanderId = fixture.BystanderId },
            CancellationToken.None);

        Assert.True(await secondRepository.BystanderLinkedToMysteryAsync(fixture.MysteryId, fixture.BystanderId, CancellationToken.None));
        Assert.Equal(1, await second.MysteryBystanders.CountAsync(x => x.MysteryId == fixture.MysteryId && x.BystanderId == fixture.BystanderId));
        Assert.DoesNotContain(second.ChangeTracker.Entries<MysteryBystander>(), x => x.State == EntityState.Added);
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
    /// Kept unchanged now that the guard exists, and deliberately still on the raw
    /// add-then-<c>SaveChangesAsync</c> path: it pins the premise everything below depends on —
    /// that this fixture's SQLite really does enforce the foreign key, so a bridge row naming a
    /// deleted mystery cannot be written. <c>LinkAndSave_ForAMysteryDeletedConcurrently_Rethrows</c>
    /// is the same case through the guarded method.
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
    /// The guard on the guard. Same foreign-key race as the test above, but driven through the
    /// insert-and-save method that swallows the duplicate — and it must <b>still throw</b>.
    ///
    /// <para>
    /// This is what separates the shipped fix from a blanket
    /// <c>catch (DbUpdateException) { return true; }</c>. Both failures arrive as the same
    /// exception type; only the re-check tells them apart. Here the membership genuinely does not
    /// exist afterwards, so reporting success would mean answering 204 for a link the database
    /// refused — and §5.1 has the wizard trusting that answer. If this test ever goes green,
    /// the guard has been widened into a lie.
    /// </para>
    /// </summary>
    [Fact]
    public async Task LinkAndSave_ForAMysteryDeletedConcurrently_Rethrows()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        // The concurrent request: the mystery goes away after the service's existence checks pass
        // and before this request inserts.
        await using (var other = fixture.NewContext())
        {
            other.Mysteries.Remove(await other.Mysteries.SingleAsync(x => x.Id == fixture.MysteryId));
            await other.SaveChangesAsync();
        }

        await Assert.ThrowsAsync<DbUpdateException>(() => repository.LinkLocationToMysteryAndSaveAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None));

        Assert.False(await repository.LocationLinkedToMysteryAsync(fixture.MysteryId, fixture.LocationId, CancellationToken.None));
        // Detached on the rethrow path too, so the failed insert cannot be retried by a later save.
        Assert.DoesNotContain(fixture.Context.ChangeTracker.Entries<MysteryLocation>(), x => x.State == EntityState.Added);
    }

    /// <summary>
    /// The other half of the same foreign-key race: it is the <i>entity</i>, not the mystery, that
    /// is deleted concurrently. Named separately because the two ids fail against different
    /// constraints, and a guard could plausibly get one right and the other wrong.
    /// </summary>
    [Fact]
    public async Task LinkAndSave_ForALocationDeletedConcurrently_Rethrows()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new LocationRepository(fixture.Context);

        await using (var other = fixture.NewContext())
        {
            other.Locations.Remove(await other.Locations.SingleAsync(x => x.Id == fixture.LocationId));
            await other.SaveChangesAsync();
        }

        await Assert.ThrowsAsync<DbUpdateException>(() => repository.LinkLocationToMysteryAndSaveAsync(
            new MysteryLocation { MysteryId = fixture.MysteryId, LocationId = fixture.LocationId },
            CancellationToken.None));
    }

    /// <summary>Same rethrow property as above, for the monster bridge.</summary>
    [Fact]
    public async Task LinkAndSave_ForAMysteryDeletedConcurrently_Rethrows_ForMonsters()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new MonsterRepository(fixture.Context);

        await using (var other = fixture.NewContext())
        {
            other.Mysteries.Remove(await other.Mysteries.SingleAsync(x => x.Id == fixture.MysteryId));
            await other.SaveChangesAsync();
        }

        await Assert.ThrowsAsync<DbUpdateException>(() => repository.LinkMonsterToMysteryAndSaveAsync(
            new MysteryMonster { MysteryId = fixture.MysteryId, MonsterId = fixture.MonsterId },
            CancellationToken.None));

        Assert.False(await repository.MonsterLinkedToMysteryAsync(fixture.MysteryId, fixture.MonsterId, CancellationToken.None));
    }

    /// <summary>Same rethrow property as above, for the bystander bridge.</summary>
    [Fact]
    public async Task LinkAndSave_ForAMysteryDeletedConcurrently_Rethrows_ForBystanders()
    {
        await using var fixture = await LinkFixture.CreateAsync();
        var repository = new BystanderRepository(fixture.Context);

        await using (var other = fixture.NewContext())
        {
            other.Mysteries.Remove(await other.Mysteries.SingleAsync(x => x.Id == fixture.MysteryId));
            await other.SaveChangesAsync();
        }

        await Assert.ThrowsAsync<DbUpdateException>(() => repository.LinkBystanderToMysteryAndSaveAsync(
            new MysteryBystander { MysteryId = fixture.MysteryId, BystanderId = fixture.BystanderId },
            CancellationToken.None));

        Assert.False(await repository.BystanderLinkedToMysteryAsync(fixture.MysteryId, fixture.BystanderId, CancellationToken.None));
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
