using Microsoft.AspNetCore.Builder;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MonsterOfTheWeek.Api.Controllers;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.CustomMoves;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// The six resource-images endpoints (design.md §3, phases.md Phase 3) behind a real Kestrel
/// host: real routing, route constraints and multipart binding, the real
/// <see cref="MonstersController"/>/<see cref="MinionsController"/>/<see cref="LocationsController"/>/<see cref="BystandersController"/>,
/// service and repository layers, and an in-memory SQLite database.
///
/// <para>
/// <b>Widened at U1</b> (<c>docs/resource-images/endpoint-unification.md</c> §4) from two Monsters
/// and one Minion to <b>two owners of every one of the four image-owning domains</b>. The second
/// owner of each type is what an ownership-mismatch 404 is checked against, and it has to be the
/// <i>same</i> type as the first: a 404 from asking a Location for a Monster's image proves
/// nothing, because the route would have served it from a different table anyway. Two of a kind is
/// the only pairing that isolates the <c>OwnerId</c> half of the discriminator.
/// </para>
///
/// <para>
/// Same construction and caveats as <see cref="MinionReparentApiHarness"/>: not <c>Program.cs</c>,
/// repeats only the calls that shape a response, leaves out cookie auth (so it says nothing about
/// the fallback authorization policy), and shares one in-memory SQLite database by connection
/// string across the harness and the test's own verification queries.
/// </para>
/// </summary>
internal sealed class ResourceImageApiHarness : IAsyncDisposable
{
    private SqliteConnection keepAlive = null!;
    private DbContextOptions<MotwDbContext> options = null!;
    private WebApplication app = null!;

    public HttpClient Client { get; private set; } = null!;

    /// <summary>
    /// One seeded pair per image-owning domain: the owner the test works against, and a second
    /// owner of the same type that owns nothing.
    ///
    /// <para>
    /// <b>Written out rather than built from <c>IResourceImageService.ImageOwnerTypes</c>, on
    /// purpose.</b> Deriving the seed set from the same declaration the matrix iterates would make
    /// the suite agree with any future shrinkage of that set — a member quietly dropped would stop
    /// being seeded and stop being tested, and every test would still be green. Seeding is
    /// transcribed here; U3 is where the declared set and the route table get compared, and it can
    /// only be an honest comparison if this side does not come from one of them.
    /// </para>
    /// </summary>
    private readonly Dictionary<DomainOwnerType, (Guid OwnerId, Guid OtherOwnerId)> owners = new()
    {
        [DomainOwnerType.Monster] = (Guid.NewGuid(), Guid.NewGuid()),
        [DomainOwnerType.Minion] = (Guid.NewGuid(), Guid.NewGuid()),
        [DomainOwnerType.Location] = (Guid.NewGuid(), Guid.NewGuid()),
        [DomainOwnerType.Bystander] = (Guid.NewGuid(), Guid.NewGuid()),
    };

    /// <summary>How many domains this harness seeds. Pinned by the matrix so that a pair removed
    /// from <see cref="owners"/> fails loudly instead of shrinking the matrix silently.</summary>
    public int SeededOwnerTypeCount => owners.Count;

    /// <summary>The owner a test uploads to and reads back.</summary>
    public Guid OwnerIdFor(DomainOwnerType ownerType) => Lookup(ownerType).OwnerId;

    /// <summary>A second owner of the same type, owning no images — the ownership-mismatch 404.</summary>
    public Guid OtherOwnerIdFor(DomainOwnerType ownerType) => Lookup(ownerType).OtherOwnerId;

    /// <summary>Throws rather than returning a default, so a typo in the matrix's transcribed
    /// owner/segment pairs fails at the first test instead of quietly testing nothing.</summary>
    private (Guid OwnerId, Guid OtherOwnerId) Lookup(DomainOwnerType ownerType) =>
        owners.TryGetValue(ownerType, out var ids)
            ? ids
            : throw new ArgumentOutOfRangeException(
                nameof(ownerType), ownerType, "This harness seeds no owner of that type.");

    public static async Task<ResourceImageApiHarness> StartAsync()
    {
        var harness = new ResourceImageApiHarness();
        var databaseName = $"motw-resource-image-api-{Guid.NewGuid():N}";
        var connectionString = $"DataSource=file:{databaseName}?mode=memory&cache=shared";
        harness.keepAlive = new SqliteConnection(connectionString);
        await harness.keepAlive.OpenAsync();
        harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connectionString).Options;

        await using (var setup = harness.NewContext())
        {
            await setup.Database.EnsureCreatedAsync();

            var monsterTypeId = Guid.NewGuid();
            var monsterArchetypeId = Guid.NewGuid();
            var minionTypeId = Guid.NewGuid();
            var locationTypeId = Guid.NewGuid();
            var bystanderTypeId = Guid.NewGuid();

            setup.MonsterTypes.Add(new MonsterType { Id = monsterTypeId, Name = "Devourer", Motivation = "To consume." });
            setup.MonsterArchetypes.Add(new MonsterArchetype { Id = monsterArchetypeId, Name = "Heavy Hitter", Description = "It is the threat" });
            setup.MinionTypes.Add(new MinionType { Id = minionTypeId, Name = "Thug", Motivation = "To hurt." });
            setup.LocationTypes.Add(new LocationType { Id = locationTypeId, Name = "Crossroads", Motivation = "To draw them in." });
            setup.BystanderTypes.Add(new BystanderType { Id = bystanderTypeId, Name = "Witness", Motivation = "To be believed." });

            var (monsterId, otherMonsterId) = harness.owners[DomainOwnerType.Monster];
            var (minionId, otherMinionId) = harness.owners[DomainOwnerType.Minion];
            var (locationId, otherLocationId) = harness.owners[DomainOwnerType.Location];
            var (bystanderId, otherBystanderId) = harness.owners[DomainOwnerType.Bystander];

            setup.Monsters.Add(new Monster { Id = monsterId, Name = "Gravewalker", HarmCapacity = 4, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId });
            setup.Monsters.Add(new Monster { Id = otherMonsterId, Name = "Hollow Choir", HarmCapacity = 3, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId });

            // Both Minions hang off the first Monster. A Minion's parent is irrelevant to image
            // ownership — resource_images keys on (OwnerType, OwnerId) with no FK — so sharing one
            // parent keeps the seed small without weakening the mismatch check.
            setup.Minions.Add(new Minion { Id = minionId, Name = "Grunt", MonsterId = monsterId, MinionTypeId = minionTypeId, HarmCapacity = 1 });
            setup.Minions.Add(new Minion { Id = otherMinionId, Name = "Lookout", MonsterId = monsterId, MinionTypeId = minionTypeId, HarmCapacity = 1 });

            setup.Locations.Add(new Location { Id = locationId, Name = "The Drowned Mill", LocationTypeId = locationTypeId });
            setup.Locations.Add(new Location { Id = otherLocationId, Name = "Hangman's Bridge", LocationTypeId = locationTypeId });

            setup.Bystanders.Add(new Bystander { Id = bystanderId, Name = "Anna Quillen", BystanderTypeId = bystanderTypeId });
            setup.Bystanders.Add(new Bystander { Id = otherBystanderId, Name = "Pierce Jones", BystanderTypeId = bystanderTypeId });

            await setup.SaveChangesAsync();
        }

        // Not "Development": WebApplication adds the developer exception page there, which would
        // change what a 500 (or, here, a 413) looks like.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        builder.Services.AddProblemDetails();
        builder.Services.AddControllers().AddApplicationPart(typeof(MonstersController).Assembly);
        builder.Services.AddDbContext<MotwDbContext>(o => o.UseSqlite(connectionString));
        builder.Services.AddScoped<IMonsterRepository, MonsterRepository>();
        builder.Services.AddScoped<IMinionRepository, MinionRepository>();
        builder.Services.AddScoped<ILocationRepository, LocationRepository>();
        builder.Services.AddScoped<IBystanderRepository, BystanderRepository>();
        builder.Services.AddScoped<IResourceImageService, ResourceImageService>();
        // Phase 1 of domain custom moves: registered here, not only in Program.cs, because this
        // harness builds its own WebApplication and never sees Program.cs's container. Missing
        // this registration doesn't fail the build; it fails the first request to any of the
        // controllers whose service takes it (architecture.md B1, B-R1).
        builder.Services.AddScoped<ICustomMoveService, CustomMoveService>();
        // Four domain services, because each of the four image actions lives on the controller
        // whose constructor takes one. U2 deletes those twenty-four actions, at which point the
        // unified controller's only dependency is IResourceImageService and this block collapses
        // to that single registration — which is U2's own discriminating gate (§4 U2), not
        // something to pre-empt here.
        builder.Services.AddScoped<IMonsterService, MonsterService>();
        builder.Services.AddScoped<IMinionService, MinionService>();
        builder.Services.AddScoped<ILocationService, LocationService>();
        builder.Services.AddScoped<IBystanderService, BystanderService>();

        harness.app = builder.Build();
        harness.app.Urls.Add("http://127.0.0.1:0");
        harness.app.UseExceptionHandler();
        harness.app.UseRouting();
        harness.app.MapControllers();
        await harness.app.StartAsync();

        harness.Client = new HttpClient { BaseAddress = new Uri(harness.app.Urls.Single()) };

        // Lets the oversized-body test see a clean 413 rather than a raw connection reset: with
        // Expect: 100-continue, Kestrel can reject based on Content-Length before the client ever
        // writes the (multi-megabyte) body, instead of aborting the connection mid-write once its
        // own internal limit trips during the read.
        harness.Client.DefaultRequestHeaders.ExpectContinue = true;

        return harness;
    }

    public MotwDbContext NewContext() => new(options);

    /// <summary>Posts a multipart batch of (filename, bytes) pairs to <c>.../images</c>, under
    /// the <c>files</c> form field name <c>[FromForm] IFormFileCollection files</c> binds to.</summary>
    public async Task<HttpResponseMessage> UploadImagesAsync(string path, params (string FileName, byte[] Content)[] files)
    {
        using var content = new MultipartFormDataContent();
        foreach (var (fileName, bytes) in files)
        {
            var fileContent = new ByteArrayContent(bytes);
            content.Add(fileContent, "files", fileName);
        }

        return await Client.PostAsync(path, content);
    }

    /// <summary>A request body of exactly <paramref name="totalBytes"/>, for the 413 test — one
    /// oversized file rather than many files, since the point is the request body size limit,
    /// not the per-file or per-batch count checks.</summary>
    public Task<HttpResponseMessage> UploadOversizedBodyAsync(string path, int totalBytes) =>
        UploadImagesAsync(path, ("oversized.jpg", new byte[totalBytes]));

    /// <summary>
    /// Nulls a stored row's <c>ThumbnailBytes</c>, the only way to reach design.md §2.1's fallback
    /// from a test: the service generates a thumbnail for every file it accepts, so an upload can
    /// never produce the state the four controllers branch on. Written straight through the
    /// context rather than through any service, because no service exposes it.
    /// </summary>
    public async Task ClearStoredThumbnailAsync(Guid imageId)
    {
        await using var context = NewContext();
        var image = await context.ResourceImages.SingleAsync(i => i.Id == imageId);
        image.ThumbnailBytes = null;
        await context.SaveChangesAsync();
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();

        await keepAlive.DisposeAsync();
    }
}
