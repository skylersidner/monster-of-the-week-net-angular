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
/// The six resource-images endpoints (design.md §3, phases.md Phase 3) behind a real Kestrel
/// host: real routing, route constraints and multipart binding, the real
/// <see cref="MonstersController"/>/<see cref="MinionsController"/>, service and repository
/// layers, and an in-memory SQLite database seeded with two Monsters (so ownership checks have
/// somewhere real to fail against) and one Minion.
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

    public Guid MonsterId { get; } = Guid.NewGuid();

    /// <summary>A second Monster with no images of its own — what an ownership-mismatch 404 is
    /// checked against.</summary>
    public Guid OtherMonsterId { get; } = Guid.NewGuid();

    public Guid MinionId { get; } = Guid.NewGuid();

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

            setup.MonsterTypes.Add(new MonsterType { Id = monsterTypeId, Name = "Devourer", Motivation = "To consume." });
            setup.MonsterArchetypes.Add(new MonsterArchetype { Id = monsterArchetypeId, Name = "Heavy Hitter", Description = "It is the threat" });
            setup.MinionTypes.Add(new MinionType { Id = minionTypeId, Name = "Thug", Motivation = "To hurt." });

            setup.Monsters.Add(new Monster { Id = harness.MonsterId, Name = "Gravewalker", HarmCapacity = 4, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId });
            setup.Monsters.Add(new Monster { Id = harness.OtherMonsterId, Name = "Hollow Choir", HarmCapacity = 3, MonsterTypeId = monsterTypeId, MonsterArchetypeId = monsterArchetypeId });
            setup.Minions.Add(new Minion { Id = harness.MinionId, Name = "Grunt", MonsterId = harness.MonsterId, MinionTypeId = minionTypeId, HarmCapacity = 1 });

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
        builder.Services.AddScoped<IResourceImageService, ResourceImageService>();
        builder.Services.AddScoped<IMonsterService, MonsterService>();
        builder.Services.AddScoped<IMinionService, MinionService>();

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

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();

        await keepAlive.DisposeAsync();
    }
}
