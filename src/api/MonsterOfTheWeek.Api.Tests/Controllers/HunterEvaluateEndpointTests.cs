using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// <c>POST /api/hunters/evaluate</c> through the real request pipeline (hunter-creation-wizard.md
/// 12.8). Over HTTP for two things a service-level test cannot show: which requests model binding
/// refuses with a 400 before the check runs, and the exact JSON the wizard will type against
/// (camelCase, <c>area</c> as a string, nulls present).
/// </summary>
public sealed class HunterEvaluateEndpointTests
{
    private static readonly Guid PlaybookId = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid StatArrayId = Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static readonly Guid RequiredMoveId = Guid.Parse("33333333-3333-4333-8333-333333333333");
    private static readonly Guid PickableMoveId = Guid.Parse("44444444-4444-4444-8444-444444444444");
    private static readonly Guid WeaponsId = Guid.Parse("88888888-8888-4888-8888-888888888888");
    private static readonly Guid ShotgunId = Guid.Parse("77777777-7777-4777-8777-777777777777");
    private static readonly Guid MacheteId = Guid.Parse("7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a");
    private static readonly Guid LookCategoryId = Guid.Parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    private static readonly Guid HeatSectionId = Guid.Parse("10000000-0000-4000-8000-000000000001");
    private static readonly Guid RotesSectionId = Guid.Parse("30000000-0000-4000-8000-000000000003");
    private static readonly Guid ArtifactSectionId = Guid.Parse("40000000-0000-4000-8000-000000000004");

    private static readonly string TooLong = new('a', 256);

    [Fact]
    public async Task A_well_formed_request_is_a_200_with_tagged_items_as_camelCase_JSON_and_saves_nothing()
    {
        await using var harness = await HunterApiHarness.StartAsync(SeedPlaybook());

        var response = await harness.Client.PostAsJsonAsync("/api/hunters/evaluate", Request());
        var raw = await response.Content.ReadAsStringAsync();

        Assert.True(response.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)response.StatusCode}: {raw}");

        // The wire shape itself: area as a string, both ids present even when null.
        using (var body = JsonDocument.Parse(raw))
        {
            Assert.Equal(JsonValueKind.Null, body.RootElement.GetProperty("refusal").ValueKind);
            var first = body.RootElement.GetProperty("outstanding")[0];
            Assert.Equal(JsonValueKind.String, first.GetProperty("area").ValueKind);
            Assert.Equal("ratings", first.GetProperty("area").GetString());
            Assert.Equal(JsonValueKind.Null, first.GetProperty("sectionId").ValueKind);
            Assert.Equal(JsonValueKind.Null, first.GetProperty("gearCategoryId").ValueKind);
            Assert.Equal("Choose a rating array.", first.GetProperty("message").GetString());
        }

        var evaluation = JsonSerializer.Deserialize<HunterEvaluationResponse>(raw, JsonSerializerOptions.Web)!;
        Assert.Equal(
            [
                new HunterOutstandingItem("ratings", null, null, "Choose a rating array."),
                new HunterOutstandingItem("gear", null, WeaponsId, "Gear — Weapons: 0 of 1 picked."),
                new HunterOutstandingItem("look", null, null, "Look: 1 of 1 line is unanswered."),
                new HunterOutstandingItem("rules", HeatSectionId, null, "Heat: 0 of 1 picked."),
                new HunterOutstandingItem("rules", RotesSectionId, null, "Rotes (Fire): 0 of 1 picked."),
                new HunterOutstandingItem("moves", ArtifactSectionId, null, "Artifact: 0 of 1 picked."),
            ],
            evaluation.Outstanding);

        await using var verify = harness.NewContext();
        Assert.Equal(0, await verify.Hunters.CountAsync());
        Assert.Equal(0, await verify.HunterMoves.CountAsync());
        Assert.Equal(0, await verify.HunterBespokeSectionInstances.CountAsync());
    }

    [Fact]
    public async Task A_draft_that_breaks_a_rule_is_a_200_refusal_with_an_empty_list()
    {
        await using var harness = await HunterApiHarness.StartAsync(SeedPlaybook());

        var response = await harness.Client.PostAsJsonAsync(
            "/api/hunters/evaluate", Request() with { PlaybookGearOptionIds = [ShotgunId, MacheteId] });
        var raw = await response.Content.ReadAsStringAsync();

        Assert.True(response.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)response.StatusCode}: {raw}");
        using var body = JsonDocument.Parse(raw);
        Assert.Equal("\"Weapons\" allows 1 pick, but 2 were made.", body.RootElement.GetProperty("refusal").GetString());
        Assert.Equal(0, body.RootElement.GetProperty("outstanding").GetArrayLength());
    }

    [Fact]
    public async Task A_missing_playbook_is_a_refusal_worded_exactly_as_Create_refuses_it()
    {
        await using var harness = await HunterApiHarness.StartAsync(SeedPlaybook());
        var missing = Request() with { PlaybookId = Guid.Parse("99999999-9999-4999-8999-999999999999") };

        var evaluated = await harness.Client.PostAsJsonAsync("/api/hunters/evaluate", missing);
        var created = await harness.Client.PostAsJsonAsync("/api/hunters", missing);

        Assert.Equal(HttpStatusCode.OK, evaluated.StatusCode);
        var evaluation = (await evaluated.Content.ReadFromJsonAsync<HunterEvaluationResponse>())!;
        Assert.Equal("Playbook 99999999-9999-4999-8999-999999999999 does not exist.", evaluation.Refusal);
        Assert.Empty(evaluation.Outstanding);

        Assert.Equal(HttpStatusCode.BadRequest, created.StatusCode);
        using var createBody = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        Assert.Equal(evaluation.Refusal, createBody.RootElement.GetProperty("message").GetString());
    }

    public static TheoryData<string, string, string> MalformedBodies => new()
    {
        { "a blank name", Json(Request() with { Name = "" }), "Name" },
        { "a whitespace name", Json(Request() with { Name = "   " }), "Name" },
        { "a 256-character name", Json(Request() with { Name = TooLong }), "Name" },
        { "a 256-character entry name", Json(Request() with { BespokeInstances = [new HunterBespokeInstanceModel(null, RotesSectionId, TooLong, 0, [])] }), "BespokeInstances[0].Name" },
        { "a playbook id that is not a GUID", WithPlaybookId(Request(), "not-a-guid"), "playbookId" },
    };

    [Theory]
    [MemberData(nameof(MalformedBodies))]
    public async Task A_malformed_request_is_a_400_from_model_binding_not_a_refusal(string because, string json, string expectedErrorKey)
    {
        await using var harness = await HunterApiHarness.StartAsync(SeedPlaybook());

        var response = await harness.Client.PostAsync(
            "/api/hunters/evaluate", new StringContent(json, Encoding.UTF8, "application/json"));
        var raw = await response.Content.ReadAsStringAsync();

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"{because}: expected 400, got {(int)response.StatusCode}: {raw}");
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(raw);
        Assert.False(body.RootElement.TryGetProperty("refusal", out _), raw);
        Assert.Contains(
            body.RootElement.GetProperty("errors").EnumerateObject(),
            e => e.Name.Contains(expectedErrorKey, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Over_HTTP_the_check_lists_the_same_messages_Create_then_returns()
    {
        await using var harness = await HunterApiHarness.StartAsync(SeedPlaybook());

        var evaluated = await harness.Client.PostAsJsonAsync("/api/hunters/evaluate", Request());
        var created = await harness.Client.PostAsJsonAsync("/api/hunters", Request());

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var evaluation = (await evaluated.Content.ReadFromJsonAsync<HunterEvaluationResponse>())!;
        var detail = (await created.Content.ReadFromJsonAsync<HunterDetailResponse>())!;
        Assert.Equal(evaluation.Outstanding.Select(i => i.Message), detail.Outstanding);
    }

    private static string Json(UpsertHunterRequest request) => JsonSerializer.Serialize(request, JsonSerializerOptions.Web);

    private static string WithPlaybookId(UpsertHunterRequest request, string playbookId)
    {
        var node = JsonNode.Parse(Json(request))!;
        node["playbookId"] = playbookId;
        return node.ToJsonString();
    }

    /// <summary>
    /// Takes the move that owns Artifact, and adds one Rotes entry with nothing picked, so a single
    /// response carries every kind of tag: none, a gear category, a rules section, a repeatable
    /// entry's section, and a move's section.
    /// </summary>
    private static UpsertHunterRequest Request() => new(
        "Draft Hunter", null, PlaybookId, null, 0, 0, 0, null,
        [PickableMoveId], [], [], [], [],
        [new HunterBespokeInstanceModel(null, RotesSectionId, "Fire", 0, [])],
        []);

    private static Playbook SeedPlaybook() => new()
    {
        Id = PlaybookId,
        Name = "The Test Subject",
        LuckBoxCount = 7,
        HarmBoxCount = 7,
        HarmUnstableThreshold = 5,
        ExperienceBoxCount = 5,
        // A total of two with one granted, so a budget of one pick.
        MoveGrantCount = 2,
        StatArrayOptions = [new PlaybookStatArrayOption { Id = StatArrayId, Charm = 1, Cool = 0, Sharp = 2, Tough = -1, Weird = 1, SortOrder = 0 }],
        Moves =
        [
            new PlaybookMove { Id = RequiredMoveId, Name = "Granted Move", Required = true, SortOrder = 0 },
            new PlaybookMove { Id = PickableMoveId, Name = "Pickable Move", SortOrder = 1 },
        ],
        GearCategories =
        [
            new PlaybookGearCategory
            {
                Id = WeaponsId, Label = "Weapons", PickCount = 1, SortOrder = 0,
                Options =
                [
                    new PlaybookGearOption { Id = ShotgunId, Name = "Shotgun", SortOrder = 0 },
                    new PlaybookGearOption { Id = MacheteId, Name = "Machete", SortOrder = 1 },
                ],
            },
        ],
        LookCategories =
        [
            new PlaybookLookCategory
            {
                Id = LookCategoryId, AllowsFreeform = true, SortOrder = 0,
                Options = [new PlaybookLookOption { Id = Guid.Parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), Text = "haggard face", SortOrder = 0 }],
            },
        ],
        BespokeSections =
        [
            new BespokeSection
            {
                Id = HeatSectionId, Title = "Heat", MinSelect = 1, MaxSelect = 1, SortOrder = 0,
                Options = [new BespokeOption { Id = Guid.Parse("10000000-0000-4000-8000-0000000000a1"), SectionId = HeatSectionId, Title = "A rival", SortOrder = 0 }],
            },
            new BespokeSection
            {
                Id = RotesSectionId, Title = "Rotes", MinInstances = 0, MaxInstances = 3, MinSelect = 1, MaxSelect = 1, SortOrder = 1,
                Options = [new BespokeOption { Id = Guid.Parse("30000000-0000-4000-8000-0000000000a0"), SectionId = RotesSectionId, Title = "Words", SortOrder = 0 }],
            },
            new BespokeSection
            {
                Id = ArtifactSectionId, PlaybookMoveId = PickableMoveId, Title = "Artifact", MinSelect = 1, MaxSelect = 1, SortOrder = 0,
                Options = [new BespokeOption { Id = Guid.Parse("40000000-0000-4000-8000-0000000000a4"), SectionId = ArtifactSectionId, Title = "A sword", SortOrder = 0 }],
            },
        ],
    };
}
