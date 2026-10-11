using Microsoft.AspNetCore.Builder;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MonsterOfTheWeek.Api.Controllers;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services.CustomMoves;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// <see cref="CustomMovesController"/> behind a real Kestrel host, with <b>one owner of every
/// <see cref="CustomMoveOwnerType"/></b> seeded — which is the whole point: the controller's
/// claim is that one route serves five domains, and that is only checkable against five real
/// owners.
///
/// <para>
/// <b>It has to be a real host, not a controller instance.</b> Everything this harness exists to
/// prove happens in the route table before the action runs: the anchored regex rejecting
/// <c>xmonstersx</c>, an unknown segment 404ing at routing rather than in application code, and
/// the caller's casing surviving into the action. None of that is reachable by calling a method.
/// </para>
///
/// <para>
/// Same construction and the same caveats as the three harnesses beside it — <b>it is not
/// <c>Program.cs</c></b>, it repeats only the calls that shape a response, and it leaves out
/// cookie auth. Unlike them it registers exactly one service, because the unified controller
/// takes exactly one dependency; that is itself a small piece of evidence for §2.9's claim that
/// the controller has no per-domain code.
/// </para>
/// </summary>
internal sealed class CustomMoveApiHarness : IAsyncDisposable
{
    // Per-harness shared-cache in-memory database addressed by connection string, so every
    // request gets its own connection to one database — see MysteryLinkApiHarness for why the
    // shared-single-connection form cannot host concurrent requests.
    private SqliteConnection keepAlive = null!;
    private string connectionString = null!;
    private DbContextOptions<MotwDbContext> options = null!;
    private WebApplication app = null!;

    public HttpClient Client { get; private set; } = null!;

    public Guid MysteryId { get; } = Guid.NewGuid();
    public Guid MonsterId { get; } = Guid.NewGuid();
    public Guid MinionId { get; } = Guid.NewGuid();
    public Guid LocationId { get; } = Guid.NewGuid();
    public Guid BystanderId { get; } = Guid.NewGuid();

    /// <summary>The seeded owner id for a given owner type, so a theory can take the type alone.</summary>
    public Guid OwnerIdFor(CustomMoveOwnerType ownerType) => ownerType switch
    {
        CustomMoveOwnerType.Mystery => MysteryId,
        CustomMoveOwnerType.Monster => MonsterId,
        CustomMoveOwnerType.Minion => MinionId,
        CustomMoveOwnerType.Location => LocationId,
        CustomMoveOwnerType.Bystander => BystanderId,
        _ => throw new ArgumentOutOfRangeException(nameof(ownerType), ownerType, "Unknown owner type."),
    };

    public static async Task<CustomMoveApiHarness> StartAsync()
    {
        var harness = new CustomMoveApiHarness();
        var databaseName = $"motw-custom-moves-{Guid.NewGuid():N}";
        harness.connectionString = $"DataSource=file:{databaseName}?mode=memory&cache=shared";
        harness.keepAlive = new SqliteConnection(harness.connectionString);
        await harness.keepAlive.OpenAsync();
        harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(harness.connectionString).Options;

        await using (var setup = harness.NewContext())
        {
            await setup.Database.EnsureCreatedAsync();

            var adventureTypeId = Guid.NewGuid();
            var monsterTypeId = Guid.NewGuid();
            var monsterArchetypeId = Guid.NewGuid();
            var minionTypeId = Guid.NewGuid();
            var locationTypeId = Guid.NewGuid();
            var bystanderTypeId = Guid.NewGuid();

            setup.AdventureTypes.Add(new AdventureType { Id = adventureTypeId, Name = "Thwart", Description = "Hunters vs bad guy." });
            setup.MonsterTypes.Add(new MonsterType { Id = monsterTypeId, Name = "Devourer", Motivation = "To consume." });
            setup.MonsterArchetypes.Add(new MonsterArchetype { Id = monsterArchetypeId, Name = "Heavy Hitter", Description = "It is the threat" });
            setup.MinionTypes.Add(new MinionType { Id = minionTypeId, Name = "Thug", Motivation = "To hurt." });
            setup.LocationTypes.Add(new LocationType { Id = locationTypeId, Name = "Den", Motivation = "To hide things." });
            setup.BystanderTypes.Add(new BystanderType { Id = bystanderTypeId, Name = "Victim", Motivation = "To survive." });
            await setup.SaveChangesAsync();

            setup.Mysteries.Add(new Mystery { Id = harness.MysteryId, Name = "The Quiet", AdventureTypeId = adventureTypeId });
            setup.Monsters.Add(new Monster { Id = harness.MonsterId, Name = "Gravewalker", HarmCapacity = 4, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId });
            setup.Locations.Add(new Location { Id = harness.LocationId, Name = "The Diner", LocationTypeId = locationTypeId });
            setup.Bystanders.Add(new Bystander { Id = harness.BystanderId, Name = "Nosy Neighbor", BystanderTypeId = bystanderTypeId });
            await setup.SaveChangesAsync();

            setup.Minions.Add(new Minion { Id = harness.MinionId, Name = "Grave Hand", MonsterId = harness.MonsterId, MinionTypeId = minionTypeId, HarmCapacity = 1 });
            await setup.SaveChangesAsync();
        }

        // Not "Development": WebApplication adds the developer exception page there, which would
        // change what a 500 looks like.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        builder.Services.AddProblemDetails();
        builder.Services.AddControllers().AddApplicationPart(typeof(CustomMovesController).Assembly);
        builder.Services.AddDbContext<MotwDbContext>(o => o.UseSqlite(harness.connectionString));
        builder.Services.AddScoped<ICustomMoveService, CustomMoveService>();

        harness.app = builder.Build();
        harness.app.Urls.Add("http://127.0.0.1:0");
        harness.app.UseExceptionHandler();
        harness.app.UseRouting();
        harness.app.MapControllers();
        await harness.app.StartAsync();

        harness.Client = new HttpClient { BaseAddress = new Uri(harness.app.Urls.Single()) };
        return harness;
    }

    public MotwDbContext NewContext() => new(options);

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();

        await keepAlive.DisposeAsync();
    }
}
