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
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// The minion re-parent route behind a real Kestrel host: real routing and route constraints, the
/// real controller, service and repository, and an in-memory SQLite database seeded with
/// <b>two</b> monsters and one minion that starts on the first of them.
///
/// <para>
/// Built rather than folded into <see cref="MysteryLinkApiHarness"/> for two reasons. That harness
/// seeds one monster and this verb needs two — a move has to have somewhere to leave. And its
/// tests are Toad's; growing its seed would churn every one of them for a route they do not
/// exercise. Same construction, same shared-cache-by-connection-string reasoning and the same
/// caveats as that harness and <see cref="HunterApiHarness"/>: it is not <c>Program.cs</c>, it
/// repeats only the calls that shape a response, and it leaves out cookie auth, so it says nothing
/// about the fallback authorization policy.
/// </para>
/// </summary>
internal sealed class MinionReparentApiHarness : IAsyncDisposable
{
    private SqliteConnection keepAlive = null!;
    private string connectionString = null!;
    private DbContextOptions<MotwDbContext> options = null!;
    private WebApplication app = null!;

    public HttpClient Client { get; private set; } = null!;

    /// <summary>The monster the seeded minion starts on.</summary>
    public Guid OriginMonsterId { get; } = Guid.NewGuid();

    /// <summary>The monster the move tests send it to.</summary>
    public Guid TargetMonsterId { get; } = Guid.NewGuid();

    public Guid MinionId { get; } = Guid.NewGuid();
    public Guid AttackId { get; } = Guid.NewGuid();
    public Guid PowerId { get; } = Guid.NewGuid();
    public Guid ArmorId { get; } = Guid.NewGuid();
    public Guid WeaknessId { get; } = Guid.NewGuid();
    public Guid CustomMoveId { get; } = Guid.NewGuid();

    public static async Task<MinionReparentApiHarness> StartAsync()
    {
        var harness = new MinionReparentApiHarness();
        var databaseName = $"motw-minion-reparent-{Guid.NewGuid():N}";
        harness.connectionString = $"DataSource=file:{databaseName}?mode=memory&cache=shared";
        harness.keepAlive = new SqliteConnection(harness.connectionString);
        await harness.keepAlive.OpenAsync();
        harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(harness.connectionString).Options;

        await using (var setup = harness.NewContext())
        {
            await setup.Database.EnsureCreatedAsync();

            var monsterTypeId = Guid.NewGuid();
            var monsterArchetypeId = Guid.NewGuid();
            var minionTypeId = Guid.NewGuid();

            setup.MonsterTypes.Add(new MonsterType { Id = monsterTypeId, Name = "Devourer", Motivation = "To consume." });
            setup.MonsterArchetypes.Add(new MonsterArchetype { Id = monsterArchetypeId, Name = "Heavy Hitter", Description = "It is the threat" });
            setup.MinionTypes.Add(new MinionType { Id = minionTypeId, Name = "Thug", Motivation = "To hurt." });

            setup.Monsters.Add(new Monster { Id = harness.OriginMonsterId, Name = "Gravewalker", HarmCapacity = 4, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId });
            setup.Monsters.Add(new Monster { Id = harness.TargetMonsterId, Name = "Hollow Choir", HarmCapacity = 3, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId });

            setup.Minions.Add(new Minion
            {
                Id = harness.MinionId,
                Name = "Grave Hand",
                MonsterId = harness.OriginMonsterId,
                MinionTypeId = minionTypeId,
                HarmCapacity = 1,
            });

            // One of every sub-resource, so a move can be asserted to carry the whole subtree.
            setup.MinionAttacks.Add(new MinionAttack { Id = harness.AttackId, MinionId = harness.MinionId, Name = "Clutch", Harm = 1 });
            setup.MinionPowers.Add(new MinionPower { Id = harness.PowerId, MinionId = harness.MinionId, Name = "Burrow" });
            setup.MinionArmors.Add(new MinionArmor { Id = harness.ArmorId, MinionId = harness.MinionId, Name = "Grave Dirt", HarmSoak = 1 });
            setup.MinionWeaknesses.Add(new MinionWeakness { Id = harness.WeaknessId, MinionId = harness.MinionId, Name = "Salt" });
            setup.MinionCustomMoves.Add(new MinionCustomMove { Id = harness.CustomMoveId, MinionId = harness.MinionId, Name = "Drag Under" });

            await setup.SaveChangesAsync();
        }

        // Not "Development": WebApplication adds the developer exception page there, which would
        // change what a 500 looks like.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        builder.Services.AddProblemDetails();
        builder.Services.AddControllers().AddApplicationPart(typeof(MinionsController).Assembly);
        builder.Services.AddDbContext<MotwDbContext>(o => o.UseSqlite(harness.connectionString));
        builder.Services.AddScoped<IMinionRepository, MinionRepository>();
        builder.Services.AddScoped<IResourceImageService, ResourceImageService>();
        builder.Services.AddScoped<IMinionService, MinionService>();

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

    /// <summary>A body-less PUT, which is how the re-parent verb is called.</summary>
    public Task<HttpResponseMessage> PutAsync(string path) =>
        Client.SendAsync(new HttpRequestMessage(HttpMethod.Put, path));

    /// <summary>Reads the minion's parent straight from the database, past every projection.</summary>
    public async Task<Guid> ParentOfAsync(Guid minionId)
    {
        await using var context = NewContext();
        return await context.Minions.AsNoTracking().Where(x => x.Id == minionId).Select(x => x.MonsterId).SingleAsync();
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();

        await keepAlive.DisposeAsync();
    }
}
