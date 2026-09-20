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

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// The Phase 1 membership routes behind a real Kestrel host: real routing and route constraints,
/// the real controllers, services, repositories and an in-memory SQLite database seeded with one
/// mystery and one of each linkable entity.
///
/// <para>
/// Built for the half of the link verb that the service tests cannot see — the status code a
/// client receives, whether <c>{mysteryId:guid}</c> turns a malformed id into a 404 rather than a
/// 500, and whether the new <c>PUT</c> collides with any route that already shipped on the same
/// URI. Same construction and the same caveats as <see cref="HunterApiHarness"/>: it is not
/// <c>Program.cs</c>, it repeats only the calls that shape a response, and it leaves out cookie
/// auth, so it says nothing about the fallback authorization policy (that is Boo's item).
/// </para>
/// </summary>
internal sealed class MysteryLinkApiHarness : IAsyncDisposable
{
    private SqliteConnection connection = null!;
    private DbContextOptions<MotwDbContext> options = null!;
    private WebApplication app = null!;

    public HttpClient Client { get; private set; } = null!;

    public Guid MysteryId { get; } = Guid.NewGuid();
    public Guid OtherMysteryId { get; } = Guid.NewGuid();
    public Guid MonsterId { get; } = Guid.NewGuid();
    public Guid LocationId { get; } = Guid.NewGuid();
    public Guid BystanderId { get; } = Guid.NewGuid();

    public static async Task<MysteryLinkApiHarness> StartAsync()
    {
        var harness = new MysteryLinkApiHarness();
        harness.connection = new SqliteConnection("DataSource=:memory:");
        await harness.connection.OpenAsync();
        harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(harness.connection).Options;

        await using (var setup = harness.NewContext())
        {
            await setup.Database.EnsureCreatedAsync();

            var adventureTypeId = Guid.NewGuid();
            var monsterTypeId = Guid.NewGuid();
            var monsterArchetypeId = Guid.NewGuid();
            var locationTypeId = Guid.NewGuid();
            var bystanderTypeId = Guid.NewGuid();

            setup.AdventureTypes.Add(new AdventureType { Id = adventureTypeId, Name = "Thwart", Description = "Hunters vs bad guy." });
            setup.MonsterTypes.Add(new MonsterType { Id = monsterTypeId, Name = "Devourer", Motivation = "To consume." });
            setup.MonsterArchetypes.Add(new MonsterArchetype { Id = monsterArchetypeId, Name = "Heavy Hitter", Description = "It is the threat" });
            setup.LocationTypes.Add(new LocationType { Id = locationTypeId, Name = "Crossroads", Motivation = "To divide." });
            setup.BystanderTypes.Add(new BystanderType { Id = bystanderTypeId, Name = "Witness", Motivation = "To reveal." });
            await setup.SaveChangesAsync();

            setup.Mysteries.Add(new Mystery { Id = harness.MysteryId, Name = "The Quiet", AdventureTypeId = adventureTypeId });
            setup.Mysteries.Add(new Mystery { Id = harness.OtherMysteryId, Name = "Dead Air", AdventureTypeId = adventureTypeId });
            setup.Monsters.Add(new Monster { Id = harness.MonsterId, Name = "Gravewalker", HarmCapacity = 4, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId });
            setup.Locations.Add(new Location { Id = harness.LocationId, Name = "The Diner", LocationTypeId = locationTypeId });
            setup.Bystanders.Add(new Bystander { Id = harness.BystanderId, Name = "Nosy Neighbor", BystanderTypeId = bystanderTypeId });
            await setup.SaveChangesAsync();
        }

        // Not "Development": WebApplication adds the developer exception page there, which
        // would change what a 500 looks like.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        builder.Services.AddProblemDetails();
        builder.Services.AddControllers().AddApplicationPart(typeof(MonstersController).Assembly);
        builder.Services.AddDbContext<MotwDbContext>(o => o.UseSqlite(harness.connection));
        builder.Services.AddScoped<IMonsterRepository, MonsterRepository>();
        builder.Services.AddScoped<ILocationRepository, LocationRepository>();
        builder.Services.AddScoped<IBystanderRepository, BystanderRepository>();
        builder.Services.AddScoped<IMonsterService, MonsterService>();
        builder.Services.AddScoped<ILocationService, LocationService>();
        builder.Services.AddScoped<IBystanderService, BystanderService>();

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

    /// <summary>A body-less PUT, which is how the membership verb is called.</summary>
    public Task<HttpResponseMessage> PutAsync(string path) =>
        Client.SendAsync(new HttpRequestMessage(HttpMethod.Put, path));

    public Task<HttpResponseMessage> DeleteAsync(string path) => Client.DeleteAsync(path);

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();
        await connection.DisposeAsync();
    }
}
