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
/// A real Kestrel host on a loopback port, with the real hunter controller, model binding,
/// validation, service, repository and an in-memory SQLite database holding one playbook. For
/// tests whose subject lives in the request pipeline rather than in <c>HunterService</c>: a 400
/// from model binding, or the exact JSON a client receives.
///
/// <para>
/// <b>Not <c>Program.cs</c> itself.</b> It needs Postgres, migrates and seeds on startup, and
/// this project has no <c>Mvc.Testing</c> package. The host below repeats the
/// <c>Program.cs</c> calls that shape a response (<c>AddProblemDetails</c>,
/// <c>AddControllers</c> with its default JSON options, <c>UseExceptionHandler</c>) and leaves
/// out cookie auth. The fallback policy runs before model binding and does not change the body
/// of a request it lets through.
/// </para>
/// </summary>
internal sealed class HunterApiHarness : IAsyncDisposable
{
    private SqliteConnection connection = null!;
    private DbContextOptions<MotwDbContext> options = null!;
    private WebApplication app = null!;

    public HttpClient Client { get; private set; } = null!;

    public static async Task<HunterApiHarness> StartAsync(Playbook playbook)
    {
        var harness = new HunterApiHarness();
        harness.connection = new SqliteConnection("DataSource=:memory:");
        await harness.connection.OpenAsync();
        harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(harness.connection).Options;

        await using (var setup = harness.NewContext())
        {
            await setup.Database.EnsureCreatedAsync();
            setup.Playbooks.Add(playbook);
            await setup.SaveChangesAsync();
        }

        // Not "Development": WebApplication adds the developer exception page there, which
        // would change what a 500 looks like.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        builder.Services.AddProblemDetails();
        builder.Services.AddControllers().AddApplicationPart(typeof(HuntersController).Assembly);
        builder.Services.AddDbContext<MotwDbContext>(o => o.UseSqlite(harness.connection));
        builder.Services.AddScoped<IHunterRepository, HunterRepository>();
        builder.Services.AddScoped<IHunterService, HunterService>();

        harness.app = builder.Build();
        harness.app.Urls.Add("http://127.0.0.1:0");
        harness.app.UseExceptionHandler();
        harness.app.UseRouting();
        harness.app.MapControllers();
        await harness.app.StartAsync();

        // Port 0 asks the OS for a free port; after start, Urls holds the one Kestrel bound.
        harness.Client = new HttpClient { BaseAddress = new Uri(harness.app.Urls.Single()) };
        return harness;
    }

    public MotwDbContext NewContext() => new(options);

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();
        await connection.DisposeAsync();
    }
}
