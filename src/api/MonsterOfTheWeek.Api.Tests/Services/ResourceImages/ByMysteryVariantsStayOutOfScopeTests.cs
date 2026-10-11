using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.CustomMoves;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Services.ResourceImages;

/// <summary>
/// Skyler's scope cut (phases.md Phase 4, 2026-10-04): the <b>by-mystery</b> list variants get no
/// derivation work. These sites are literally untouched — the shared response records'
/// <c>PrimaryImageId</c> parameter has a <c>= null</c> default precisely so that holds (see
/// <c>ApiContracts.cs</c>'s comment on <c>MonsterListItemResponse</c>). This is the one thing
/// worth a test: that an owner with real images still reports <c>null</c> through the by-mystery
/// path, proving the field isn't accidentally derived there too.
///
/// <para>
/// <b>The by-monster minion list used to be asserted here too, and no longer is</b> (2026-10-07):
/// Skyler reversed that half of the cut — "I would like Luigi to add thumbnail support to the
/// minions on the monster detail page" — so <c>GetByMonsterIdAsync</c> now derives the primary
/// like any in-scope projection. Its positive coverage lives in
/// <see cref="ListProjectionPrimaryImageAgreementTests"/> instead. Left as a note rather than a
/// silent deletion because an assertion of absence is exactly the thing that keeps being true
/// in a test file long after it stops being true in the product.
/// </para>
/// </summary>
public sealed class ByMysteryVariantsStayOutOfScopeTests
{
    /// <summary>
    /// Two factories rather than one, because this is the only file in the sweep that constructs
    /// two different services (architecture.md §16.3 B1). Same purpose: a new constructor
    /// dependency is one edit per service here, not one per call site.
    /// </summary>
    private static LocationService CreateLocationService(
        ILocationRepository locationRepository,
        IResourceImageService resourceImageService,
        ICustomMoveService customMoveService) =>
        new(locationRepository, resourceImageService, customMoveService);

    /// <inheritdoc cref="CreateLocationService"/>
    private static BystanderService CreateBystanderService(
        IBystanderRepository bystanderRepository,
        IResourceImageService resourceImageService,
        ICustomMoveService customMoveService) =>
        new(bystanderRepository, resourceImageService, customMoveService);

    private static async Task<MotwDbContext> CreateContextAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;
        var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();
        return context;
    }

    [Fact]
    public async Task GetMonstersByMysteryIdAsync_ReturnsNullPrimaryImageId_EvenWhenTheMonsterHasImages()
    {
        await using var context = await CreateContextAsync();

        var adventureType = new AdventureType { Name = "Thwart", Description = "Hunters vs bad guy." };
        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." };
        context.AdventureTypes.Add(adventureType);
        context.MonsterTypes.Add(monsterType);
        context.MonsterArchetypes.Add(archetype);
        var mystery = new Mystery { Name = "Test Mystery", AdventureType = adventureType };
        context.Mysteries.Add(mystery);
        var monster = new Monster { Name = "Test Monster", HarmCapacity = 1, MonsterType = monsterType, MonsterArchetype = archetype };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();
        context.MysteryMonsters.Add(new MysteryMonster { MysteryId = mystery.Id, MonsterId = monster.Id });
        await context.SaveChangesAsync();

        var imageService = new ResourceImageService(context);
        await imageService.UploadAsync(
            ResourceOwnerType.Monster, monster.Id,
            [new ResourceImageUploadFile("a.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);

        var repository = new MonsterRepository(context);
        var byMystery = await repository.GetMonstersByMysteryIdAsync(mystery.Id, CancellationToken.None);

        Assert.Null(Assert.Single(byMystery).PrimaryImageId);
    }

    [Fact]
    public async Task GetLocationsByMysteryIdAsync_ReturnsNullPrimaryImageId_EvenWhenTheLocationHasImages()
    {
        await using var context = await CreateContextAsync();

        var adventureType = new AdventureType { Name = "Thwart", Description = "Hunters vs bad guy." };
        var locationType = new LocationType { Name = "Deathtrap", Motivation = "To trap and destroy." };
        context.AdventureTypes.Add(adventureType);
        context.LocationTypes.Add(locationType);
        var mystery = new Mystery { Name = "Test Mystery", AdventureType = adventureType };
        context.Mysteries.Add(mystery);
        var location = new Location { Name = "Test Location", LocationType = locationType };
        context.Locations.Add(location);
        await context.SaveChangesAsync();
        context.MysteryLocations.Add(new MysteryLocation { MysteryId = mystery.Id, LocationId = location.Id });
        await context.SaveChangesAsync();

        var imageService = new ResourceImageService(context);
        await imageService.UploadAsync(
            ResourceOwnerType.Location, location.Id,
            [new ResourceImageUploadFile("a.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);

        var repository = new LocationRepository(context);
        var locationService = CreateLocationService(repository, imageService, new CustomMoveService(context));
        var result = await locationService.GetByMysteryAsync(mystery.Id, CancellationToken.None);

        // LocationService.GetByMysteryAsync is untouched — it still maps in memory, with the
        // same positional constructor call it always had, relying on the record's new
        // PrimaryImageId parameter defaulting to null rather than deriving anything.
        Assert.True(result.IsSuccess);
        Assert.Null(Assert.Single(result.Value!).PrimaryImageId);
    }

    [Fact]
    public async Task GetBystandersByMysteryIdAsync_ReturnsNullPrimaryImageId_EvenWhenTheBystanderHasImages()
    {
        await using var context = await CreateContextAsync();

        var adventureType = new AdventureType { Name = "Thwart", Description = "Hunters vs bad guy." };
        var bystanderType = new BystanderType { Name = "Victim", Motivation = "To survive." };
        context.AdventureTypes.Add(adventureType);
        context.BystanderTypes.Add(bystanderType);
        var mystery = new Mystery { Name = "Test Mystery", AdventureType = adventureType };
        context.Mysteries.Add(mystery);
        var bystander = new Bystander { Name = "Test Bystander", BystanderType = bystanderType };
        context.Bystanders.Add(bystander);
        await context.SaveChangesAsync();
        context.MysteryBystanders.Add(new MysteryBystander { MysteryId = mystery.Id, BystanderId = bystander.Id });
        await context.SaveChangesAsync();

        var imageService = new ResourceImageService(context);
        await imageService.UploadAsync(
            ResourceOwnerType.Bystander, bystander.Id,
            [new ResourceImageUploadFile("a.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);

        var repository = new BystanderRepository(context);
        var bystanderService = CreateBystanderService(repository, imageService, new CustomMoveService(context));
        var result = await bystanderService.GetByMysteryAsync(mystery.Id, CancellationToken.None);

        // Same point as the Location case above — BystanderService.GetByMysteryAsync is untouched.
        Assert.True(result.IsSuccess);
        Assert.Null(Assert.Single(result.Value!).PrimaryImageId);
    }
}
