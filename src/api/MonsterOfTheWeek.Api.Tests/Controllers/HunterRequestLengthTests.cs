using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Controllers;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// B4 (hunter-creation-wizard.md 12.2, 12.6). A hunter's name and pronouns, and a repeatable
/// entry's name, are <c>varchar(255)</c>. Before <c>[MaxLength(255)]</c> was on the request,
/// anything longer reached Postgres, failed there as a 22001, and came back as a 500.
///
/// <para>
/// <b>Why this goes over HTTP when the rest of the hunter suite calls the service directly.</b>
/// The fix lives in model binding: <c>[ApiController]</c> refuses the request before
/// <c>HunterService</c> runs. A service-level test would happily save the long name, because
/// SQLite does not enforce <c>varchar</c> lengths, and the reflection checks the 2026-08-06
/// validation passes used cannot show that an attribute on a record nested inside a list is
/// actually validated. So each test starts a real Kestrel host on a loopback port, with the real
/// controller, model binding, validation, service, repository and an in-memory SQLite database,
/// and sends JSON the way the Angular client does.
/// </para>
///
/// <para>
/// <b>Not <c>Program.cs</c> itself.</b> It needs Postgres, migrates and seeds on startup, and
/// this project has no <c>Mvc.Testing</c> package. The host below repeats the
/// <c>Program.cs</c> calls that shape an error response (<c>AddProblemDetails</c>,
/// <c>AddControllers</c>, <c>UseExceptionHandler</c>) and leaves out cookie auth. The
/// fallback policy runs before model binding and does not change the body of a request it lets
/// through.
/// </para>
/// </summary>
public sealed class HunterRequestLengthTests
{
    private static readonly Guid PlaybookId = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid RepeatableSectionId = Guid.Parse("30000000-0000-4000-8000-000000000003");

    private static readonly string Longest = new('a', 255);
    private static readonly string TooLong = new('a', 256);

    [Fact]
    public async Task A_256_character_name_is_a_400_not_a_500()
    {
        await using var harness = await Harness.StartAsync();

        var response = await harness.Client.PostAsJsonAsync("/api/hunters", Request() with { Name = TooLong });

        await AssertRefusedForLengthAsync(response, "Name");
        await using var verify = harness.NewContext();
        Assert.Equal(0, await verify.Hunters.CountAsync());
    }

    [Fact]
    public async Task A_256_character_pronouns_is_a_400_not_a_500()
    {
        await using var harness = await Harness.StartAsync();

        var response = await harness.Client.PostAsJsonAsync("/api/hunters", Request() with { Pronouns = TooLong });

        await AssertRefusedForLengthAsync(response, "Pronouns");
        await using var verify = harness.NewContext();
        Assert.Equal(0, await verify.Hunters.CountAsync());
    }

    [Fact]
    public async Task A_256_character_repeatable_entry_name_is_a_400_not_a_500()
    {
        await using var harness = await Harness.StartAsync();

        var response = await harness.Client.PostAsJsonAsync("/api/hunters", Request() with { BespokeInstances = [Entry(TooLong)] });

        await AssertRefusedForLengthAsync(response, "BespokeInstances[0].Name");
        await using var verify = harness.NewContext();
        Assert.Equal(0, await verify.Hunters.CountAsync());
    }

    [Fact]
    public async Task An_update_with_a_256_character_name_is_refused_the_same_way_and_changes_nothing()
    {
        await using var harness = await Harness.StartAsync();
        var created = await harness.Client.PostAsJsonAsync("/api/hunters", Request());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var hunterId = (await created.Content.ReadFromJsonAsync<HunterDetailResponse>())!.Id;

        var response = await harness.Client.PutAsJsonAsync($"/api/hunters/{hunterId}", Request() with { Name = TooLong });

        await AssertRefusedForLengthAsync(response, "Name");
        await using var verify = harness.NewContext();
        Assert.Equal("Test Hunter", (await verify.Hunters.SingleAsync()).Name);
    }

    [Fact]
    public async Task Name_pronouns_and_entry_name_at_255_characters_still_save()
    {
        await using var harness = await Harness.StartAsync();

        var response = await harness.Client.PostAsJsonAsync(
            "/api/hunters",
            Request() with { Name = Longest, Pronouns = Longest, BespokeInstances = [Entry(Longest)] });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = (await response.Content.ReadFromJsonAsync<HunterDetailResponse>())!;
        Assert.Equal(Longest, created.Name);
        Assert.Equal(Longest, created.Pronouns);
        Assert.Equal(Longest, Assert.Single(created.BespokeInstances).Name);
    }

    /// <summary>
    /// The refusal is ASP.NET's automatic ProblemDetails, not the controller's
    /// <c>{ message }</c> shape. It has no <c>message</c> field, so a client showing
    /// <c>message</c> needs its fallback copy for this case (B5).
    /// </summary>
    private static async Task AssertRefusedForLengthAsync(HttpResponseMessage response, string expectedErrorKey)
    {
        var raw = await response.Content.ReadAsStringAsync();

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"Expected 400, got {(int)response.StatusCode}: {raw}");
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var body = JsonDocument.Parse(raw);
        Assert.False(body.RootElement.TryGetProperty("message", out _), raw);

        var errors = body.RootElement.GetProperty("errors");
        var error = Assert.Single(errors.EnumerateObject());
        Assert.True(error.Name == expectedErrorKey, $"Expected the error under \"{expectedErrorKey}\": {raw}");
        Assert.Contains("255", Assert.Single(error.Value.EnumerateArray()).GetString());
    }

    private static UpsertHunterRequest Request() => new(
        "Test Hunter", null, PlaybookId, null, 0, 0, 0, null, [], [], [], [], [], [], []);

    private static HunterBespokeInstanceModel Entry(string name) => new(null, RepeatableSectionId, name, 0, []);

    /// <summary>
    /// The smallest playbook that accepts a named entry: one repeatable, free-text section with
    /// no options and no owning move, the same shape as the Searcher's Network minus the move.
    /// </summary>
    private static Playbook SeedPlaybook() => new()
    {
        Id = PlaybookId,
        Name = "The Test Subject",
        LuckBoxCount = 7,
        HarmBoxCount = 7,
        HarmUnstableThreshold = 5,
        ExperienceBoxCount = 5,
        BespokeSections =
        [
            new BespokeSection
            {
                Id = RepeatableSectionId, Title = "Contacts", FreeTextLabel = "Details",
                MinInstances = 0, MaxInstances = 3, SortOrder = 0,
            },
        ],
    };

    private sealed class Harness : IAsyncDisposable
    {
        private SqliteConnection connection = null!;
        private DbContextOptions<MotwDbContext> options = null!;
        private WebApplication app = null!;

        public HttpClient Client { get; private set; } = null!;

        public static async Task<Harness> StartAsync()
        {
            var harness = new Harness();
            harness.connection = new SqliteConnection("DataSource=:memory:");
            await harness.connection.OpenAsync();
            harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(harness.connection).Options;

            await using (var setup = harness.NewContext())
            {
                await setup.Database.EnsureCreatedAsync();
                setup.Playbooks.Add(SeedPlaybook());
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
}
