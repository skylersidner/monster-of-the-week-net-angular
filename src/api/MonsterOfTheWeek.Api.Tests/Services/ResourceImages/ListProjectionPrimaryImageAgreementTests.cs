using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using ApiResourceImageService = MonsterOfTheWeek.Api.Services.ResourceImages.ResourceImageService;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Services.ResourceImages;

/// <summary>
/// Phase 4's guard against the two implementations drifting (phases.md Phase 4,
/// thumbnail-and-primary-workflow.md §2.2): the derivation rule is stated once in
/// <see cref="IResourceImageService.GetPrimaryImageIdAsync"/>, and the four list projections
/// (Monster/Minion SQL correlated subquery, Location/Bystander SQL projection) restate the same
/// rule in SQL. Run against <see cref="IResourceImageService"/> directly, not over HTTP, per
/// phases.md's corrected Phase 4 dependency — this only needs Phase 2's service, not Phase 3's
/// controllers. Covers the four cases from thumbnail-and-primary-workflow.md §2.2 for every one
/// of the four owner types: no images, derived (lowest SortOrder), explicit, and
/// delete-the-explicit-primary falls through to the next derived value.
/// </summary>
public sealed class ListProjectionPrimaryImageAgreementTests
{
    private static async Task<(MotwDbContext Context, ApiResourceImageService ImageService)> CreateContextAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;
        var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();
        return (context, new ApiResourceImageService(context));
    }

    [Fact]
    public async Task Monster_ListProjection_AgreesWithTheServiceDerivation_AcrossAllFourCases()
    {
        var (context, imageService) = await CreateContextAsync();
        await using var _1 = context;

        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." };
        var monster = new Monster { Name = "Test Monster", HarmCapacity = 1, MonsterType = monsterType, MonsterArchetype = archetype };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var repository = new MonsterRepository(context);

        // Case 1: no images -> null.
        await AssertAgreementAsync(ResourceOwnerType.Monster, monster.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == monster.Id).PrimaryImageId);

        // Case 2: derived (lowest SortOrder).
        var upload = await imageService.UploadAsync(
            ResourceOwnerType.Monster, monster.Id,
            [new ResourceImageUploadFile("a.jpg", ResourceImageTestFixtures.TinyJpeg()), new ResourceImageUploadFile("b.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);
        var images = upload.Value!.Uploaded;
        await AssertAgreementAsync(ResourceOwnerType.Monster, monster.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == monster.Id).PrimaryImageId);

        // Case 3: explicit.
        monster.PrimaryImageId = images[1].Id;
        await context.SaveChangesAsync();
        await AssertAgreementAsync(ResourceOwnerType.Monster, monster.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == monster.Id).PrimaryImageId);

        // Case 4: delete the explicit primary -> falls through to derivation.
        await context.ResourceImages.Where(i => i.Id == images[1].Id).ExecuteDeleteAsync();
        await AssertAgreementAsync(ResourceOwnerType.Monster, monster.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == monster.Id).PrimaryImageId);
    }

    [Fact]
    public async Task Minion_ListProjection_AgreesWithTheServiceDerivation_AcrossAllFourCases()
    {
        var (context, imageService) = await CreateContextAsync();
        await using var _1 = context;

        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." };
        var minionType = new MinionType { Name = "Thug", Motivation = "To hurt." };
        var monster = new Monster { Name = "Test Monster", HarmCapacity = 1, MonsterType = monsterType, MonsterArchetype = archetype };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();
        var minion = new Minion { Name = "Grunt", MonsterId = monster.Id, MinionType = minionType, HarmCapacity = 1 };
        context.Minions.Add(minion);
        await context.SaveChangesAsync();

        var repository = new MinionRepository(context);

        await AssertAgreementAsync(ResourceOwnerType.Minion, minion.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == minion.Id).PrimaryImageId);

        var upload = await imageService.UploadAsync(
            ResourceOwnerType.Minion, minion.Id,
            [new ResourceImageUploadFile("a.jpg", ResourceImageTestFixtures.TinyJpeg()), new ResourceImageUploadFile("b.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);
        var images = upload.Value!.Uploaded;
        await AssertAgreementAsync(ResourceOwnerType.Minion, minion.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == minion.Id).PrimaryImageId);

        minion.PrimaryImageId = images[1].Id;
        await context.SaveChangesAsync();
        await AssertAgreementAsync(ResourceOwnerType.Minion, minion.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == minion.Id).PrimaryImageId);

        await context.ResourceImages.Where(i => i.Id == images[1].Id).ExecuteDeleteAsync();
        await AssertAgreementAsync(ResourceOwnerType.Minion, minion.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == minion.Id).PrimaryImageId);
    }

    [Fact]
    public async Task Location_ListProjection_AgreesWithTheServiceDerivation_AcrossAllFourCases()
    {
        var (context, imageService) = await CreateContextAsync();
        await using var _1 = context;

        var locationType = new LocationType { Name = "Deathtrap", Motivation = "To trap and destroy." };
        var location = new Location { Name = "Test Location", LocationType = locationType };
        context.Locations.Add(location);
        await context.SaveChangesAsync();

        var repository = new LocationRepository(context);

        await AssertAgreementAsync(ResourceOwnerType.Location, location.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == location.Id).PrimaryImageId);

        var upload = await imageService.UploadAsync(
            ResourceOwnerType.Location, location.Id,
            [new ResourceImageUploadFile("a.jpg", ResourceImageTestFixtures.TinyJpeg()), new ResourceImageUploadFile("b.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);
        var images = upload.Value!.Uploaded;
        await AssertAgreementAsync(ResourceOwnerType.Location, location.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == location.Id).PrimaryImageId);

        location.PrimaryImageId = images[1].Id;
        await context.SaveChangesAsync();
        await AssertAgreementAsync(ResourceOwnerType.Location, location.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == location.Id).PrimaryImageId);

        await context.ResourceImages.Where(i => i.Id == images[1].Id).ExecuteDeleteAsync();
        await AssertAgreementAsync(ResourceOwnerType.Location, location.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == location.Id).PrimaryImageId);
    }

    [Fact]
    public async Task Bystander_ListProjection_AgreesWithTheServiceDerivation_AcrossAllFourCases()
    {
        var (context, imageService) = await CreateContextAsync();
        await using var _1 = context;

        var bystanderType = new BystanderType { Name = "Victim", Motivation = "To survive." };
        var bystander = new Bystander { Name = "Test Bystander", BystanderType = bystanderType };
        context.Bystanders.Add(bystander);
        await context.SaveChangesAsync();

        var repository = new BystanderRepository(context);

        await AssertAgreementAsync(ResourceOwnerType.Bystander, bystander.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == bystander.Id).PrimaryImageId);

        var upload = await imageService.UploadAsync(
            ResourceOwnerType.Bystander, bystander.Id,
            [new ResourceImageUploadFile("a.jpg", ResourceImageTestFixtures.TinyJpeg()), new ResourceImageUploadFile("b.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);
        var images = upload.Value!.Uploaded;
        await AssertAgreementAsync(ResourceOwnerType.Bystander, bystander.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == bystander.Id).PrimaryImageId);

        bystander.PrimaryImageId = images[1].Id;
        await context.SaveChangesAsync();
        await AssertAgreementAsync(ResourceOwnerType.Bystander, bystander.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == bystander.Id).PrimaryImageId);

        await context.ResourceImages.Where(i => i.Id == images[1].Id).ExecuteDeleteAsync();
        await AssertAgreementAsync(ResourceOwnerType.Bystander, bystander.Id, imageService,
            async () => (await repository.GetAllAsync(CancellationToken.None)).Single(x => x.Id == bystander.Id).PrimaryImageId);
    }

    private static async Task AssertAgreementAsync(
        ResourceOwnerType ownerType,
        Guid ownerId,
        ApiResourceImageService imageService,
        Func<Task<Guid?>> getListPrimaryImageId)
    {
        var fromService = await imageService.GetPrimaryImageIdAsync(ownerType, ownerId, CancellationToken.None);
        var fromList = await getListPrimaryImageId();
        Assert.Equal(fromService, fromList);
    }
}
