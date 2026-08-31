using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// The one full-CRUD integration test the testing step calls for: real service, real repository,
/// real database, exercised end to end including validation.
///
/// <para>
/// <b>Deliberately generic.</b> It flexes the functionality irrespective of any particular
/// playbook's content — a small synthetic graph that happens to contain one of each shape, not
/// The Chosen or any other real playbook. Exhaustively testing each of the 28 is unnecessary
/// given the unit coverage in <c>PlaybookServiceTests</c>, and the seed already round-trips all
/// 28 through the real read path in <c>PlaybookSeedTests</c>.
/// </para>
/// </summary>
public sealed class PlaybookIntegrationTests
{
    /// <summary>
    /// <b>The subtlest requirement in the whole vertical slice</b>, and the reason this file
    /// exists: <c>GET</c> → form → <c>PUT</c> must preserve child row <c>Id</c>s.
    ///
    /// <para>
    /// It has no visible symptom. A delete-and-reinsert would look identical from the API — same
    /// name, same children, same counts — while silently churning every id a Hunter live-links
    /// to (<c>HunterMove</c> → <c>PlaybookMove.Id</c>, and the rest). Nothing surfaces the loss;
    /// hunters simply lose their picks. So the assertion has to be on the ids specifically.
    /// </para>
    /// </summary>
    [Fact]
    public async Task A_get_edit_put_round_trip_preserves_every_untouched_child_id()
    {
        await using var harness = await Harness.StartAsync();

        var created = await harness.Service.CreateAsync(SeedRequest(), CancellationToken.None);
        Assert.True(created.IsSuccess, created.Error?.Message);
        var before = created.Value!;

        // Exactly what the Angular form does: read the detail response, hand every child back
        // carrying its Id, change one scalar. Anything that drops an Id reads as a delete.
        var edited = ToUpsert(before) with { Description = "Edited in place." };
        var updated = await harness.Service.UpdateAsync(before.Id, edited, CancellationToken.None);

        Assert.True(updated.IsSuccess, updated.Error?.Message);
        var after = updated.Value!;

        Assert.Equal("Edited in place.", after.Description);
        Assert.Equal(before.StatArrayOptions.Select(x => x.Id), after.StatArrayOptions.Select(x => x.Id));
        Assert.Equal(before.Moves.Select(x => x.Id), after.Moves.Select(x => x.Id));
        Assert.Equal(
            before.GearCategories.SelectMany(c => c.Options).Select(o => o.Id),
            after.GearCategories.SelectMany(c => c.Options).Select(o => o.Id));
        Assert.Equal(
            before.LookCategories.SelectMany(c => c.Options).Select(o => o.Id),
            after.LookCategories.SelectMany(c => c.Options).Select(o => o.Id));
        Assert.Equal(before.Improvements.Select(x => x.Id), after.Improvements.Select(x => x.Id));
        Assert.Equal(before.ExtraTracks.Select(x => x.Id), after.ExtraTracks.Select(x => x.Id));

        // Including the nested tree, at every depth — a recursive reconciler is exactly the kind
        // of code that gets the top level right and churns the leaves.
        Assert.Equal(FlattenIds(before.BespokeSections), FlattenIds(after.BespokeSections));
        Assert.Equal(FlattenIds(before.Moves.SelectMany(m => m.BespokeSections)), FlattenIds(after.Moves.SelectMany(m => m.BespokeSections)));

        // And the rows really are the same rows, not new ones that happen to match: the table
        // never grew.
        await using var verify = harness.NewContext();
        Assert.Equal(before.Moves.Count, await verify.PlaybookMoves.CountAsync());
        // Both owners: the table holds a Move's own options alongside the playbook-level ones,
        // which is exactly the flat storage 6.8 describes.
        var expectedOptionCount =
            FlattenIds(before.BespokeSections).Count + FlattenIds(before.Moves.SelectMany(m => m.BespokeSections)).Count;
        Assert.Equal(expectedOptionCount, await verify.BespokeOptions.CountAsync());
    }

    [Fact]
    public async Task An_edit_updates_matched_children_inserts_new_ones_and_deletes_the_rest()
    {
        await using var harness = await Harness.StartAsync();
        var before = (await harness.Service.CreateAsync(SeedRequest(), CancellationToken.None)).Value!;

        var keptMove = before.Moves[0];
        var droppedMove = before.Moves[1];

        var request = ToUpsert(before) with
        {
            Moves =
            [
                // Matched by Id -> updated in place.
                new UpsertPlaybookMoveRequest(keptMove.Id, "Renamed Move", "new text", keptMove.Required, keptMove.IsAdvanced, 0, []),
                // No Id -> inserted.
                new UpsertPlaybookMoveRequest(null, "Brand New Move", null, false, false, 1, []),
                // droppedMove simply absent -> deleted.
            ],
        };

        var after = (await harness.Service.UpdateAsync(before.Id, request, CancellationToken.None)).Value!;

        Assert.Equal(2, after.Moves.Count);
        var kept = after.Moves.Single(m => m.Id == keptMove.Id);
        Assert.Equal("Renamed Move", kept.Name);
        Assert.DoesNotContain(after.Moves, m => m.Id == droppedMove.Id);
        var inserted = after.Moves.Single(m => m.Name == "Brand New Move");
        Assert.NotEqual(Guid.Empty, inserted.Id);

        await using var verify = harness.NewContext();
        Assert.False(await verify.PlaybookMoves.AnyAsync(m => m.Id == droppedMove.Id));
    }

    [Fact]
    public async Task Validation_still_rejects_a_malformed_graph_through_the_real_path()
    {
        await using var harness = await Harness.StartAsync();
        var before = (await harness.Service.CreateAsync(SeedRequest(), CancellationToken.None)).Value!;

        var result = await harness.Service.UpdateAsync(
            before.Id,
            ToUpsert(before) with { HarmUnstableThreshold = 99 },
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);

        // A rejected update leaves the stored row exactly as it was, rather than half-applying.
        await using var verify = harness.NewContext();
        var stored = await verify.Playbooks.AsNoTracking().FirstAsync(p => p.Id == before.Id);
        Assert.Equal(before.HarmUnstableThreshold, stored.HarmUnstableThreshold);
    }

    [Fact]
    public async Task A_duplicate_name_is_rejected_case_insensitively()
    {
        await using var harness = await Harness.StartAsync();
        await harness.Service.CreateAsync(SeedRequest(), CancellationToken.None);

        var result = await harness.Service.CreateAsync(
            SeedRequest() with { Name = "the test SUBJECT" },
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("already exists", result.Error!.Message);
    }

    [Fact]
    public async Task Delete_removes_the_playbook_and_its_whole_child_graph()
    {
        await using var harness = await Harness.StartAsync();
        var before = (await harness.Service.CreateAsync(SeedRequest(), CancellationToken.None)).Value!;

        var deleted = await harness.Service.DeleteAsync(before.Id, CancellationToken.None);

        Assert.True(deleted.IsSuccess);
        Assert.True(deleted.Value);

        await using var verify = harness.NewContext();
        Assert.Equal(0, await verify.Playbooks.CountAsync());
        // Cascade, not orphans: every child table empties with it.
        Assert.Equal(0, await verify.PlaybookMoves.CountAsync());
        Assert.Equal(0, await verify.BespokeOptions.CountAsync());
        Assert.Equal(0, await verify.PlaybookGearOptions.CountAsync());
        Assert.Equal(0, await verify.BespokeJournalFields.CountAsync());
    }

    [Fact]
    public async Task The_list_endpoint_reports_child_counts_and_orders_by_name()
    {
        await using var harness = await Harness.StartAsync();
        await harness.Service.CreateAsync(SeedRequest() with { Name = "Zebra" }, CancellationToken.None);
        await harness.Service.CreateAsync(SeedRequest() with { Name = "Aardvark" }, CancellationToken.None);

        var list = await harness.Service.GetAllAsync(CancellationToken.None);

        Assert.Equal(["Aardvark", "Zebra"], list.Select(x => x.Name));
        // BespokeSectionCount counts a Move's own sections too, since they are the same rows —
        // worth pinning, because the detail response deliberately splits them apart.
        Assert.Equal(2, list[0].BespokeSectionCount);
        Assert.Equal(2, list[0].MoveCount);
    }

    // ---------------------------------------------------------------------------------
    // Fixtures
    // ---------------------------------------------------------------------------------

    /// <summary>
    /// One of every shape, none of them from a real playbook: two stat arrays, two moves (one
    /// carrying its own bespoke section), a gear category, a look category, an improvement, an
    /// extra track, a journal, and a two-level bespoke tree.
    /// </summary>
    private static UpsertPlaybookRequest SeedRequest() => new(
        "The Test Subject", "A synthetic playbook.", 7, "Spend luck to...", 5, 7, 5, 2,
        "Getting started.", "Introductions.", "Levelling up.", "History prompts.",
        [
            new UpsertPlaybookStatArrayOptionRequest(null, 1, 0, 2, -1, 1, 0),
            new UpsertPlaybookStatArrayOptionRequest(null, 0, 1, 1, 1, -1, 1),
        ],
        [
            new UpsertPlaybookMoveRequest(null, "Granted Move", "Always yours.", true, false, 0, []),
            new UpsertPlaybookMoveRequest(null, "Pickable Move", "Choose me.", false, false, 1,
                [new UpsertBespokeSectionRequest(null, "Inside The Move", null, null, null, 1, 1, null, null, 0,
                    [new UpsertBespokeOptionRequest(null, "A move-internal option", null, null, null, null, null, 0, [])])]),
        ],
        [
            new UpsertPlaybookGearCategoryRequest(null, "Weapons", 1, false, 0,
            [
                new UpsertPlaybookGearOptionRequest(null, "Shotgun", "3-harm close loud", 0),
                new UpsertPlaybookGearOptionRequest(null, "Machete", "2-harm hand", 1),
            ]),
        ],
        [
            new UpsertPlaybookLookCategoryRequest(null, true, "Human look", 0,
            [
                new UpsertPlaybookLookOptionRequest(null, "haggard face", 0),
                new UpsertPlaybookLookOptionRequest(null, "hopeful face", 1),
            ]),
        ],
        [
            new UpsertPlaybookImprovementRequest(null, "Get +1 Sharp (max +3)", false, 0),
            new UpsertPlaybookImprovementRequest(null, "Change playbooks", true, 0),
        ],
        [
            // Two levels deep, with a category divider — the shape a flat reconciler gets wrong.
            new UpsertBespokeSectionRequest(null, "Fate", "Pick your doom.", "It comes for you.", null, 1, 2, null, null, 0,
            [
                new UpsertBespokeOptionRequest(null, "Doom", null, 1, 1, null, null, 0,
                [
                    new UpsertBespokeOptionRequest(null, "Betrayed", null, null, null, null, null, 0, []),
                    new UpsertBespokeOptionRequest(null, "Forgotten", null, null, null, null, null, 1, []),
                ]),
                new UpsertBespokeOptionRequest(null, "Destiny", null, 1, 1, null, null, 1,
                    [new UpsertBespokeOptionRequest(null, "Favour", null, null, null, 0, 3, 0, [])]),
            ]),
        ],
        [
            new UpsertBespokeJournalRequest(null, "Consumed Magic", "Write them down.", null, 0,
                [new UpsertBespokeJournalFieldRequest(null, "Power", 0)]),
        ],
        [
            new UpsertPlaybookExtraTrackRequest(null, "Corruption", "It builds.", null, 7, null, "Lost", 0),
        ]);

    /// <summary>
    /// The GET → PUT mapping the Angular form performs, written out explicitly because carrying
    /// the Ids through it is precisely what the first test asserts.
    /// </summary>
    private static UpsertPlaybookRequest ToUpsert(PlaybookDetailResponse p) => new(
        p.Name, p.Description, p.LuckBoxCount, p.LuckSpecialText, p.HarmUnstableThreshold, p.HarmBoxCount,
        p.ExperienceBoxCount, p.MoveGrantCount, p.GettingStartedText, p.IntroductionsText, p.LevelingUpText,
        p.HistoryPromptsText,
        [.. p.StatArrayOptions.Select(x => new UpsertPlaybookStatArrayOptionRequest(x.Id, x.Charm, x.Cool, x.Sharp, x.Tough, x.Weird, x.SortOrder))],
        [.. p.Moves.Select(x => new UpsertPlaybookMoveRequest(x.Id, x.Name, x.DescriptionText, x.Required, x.IsAdvanced, x.SortOrder,
            [.. x.BespokeSections.Select(ToUpsertSection)]))],
        [.. p.GearCategories.Select(c => new UpsertPlaybookGearCategoryRequest(c.Id, c.Label, c.PickCount, c.IsOptional, c.SortOrder,
            [.. c.Options.Select(o => new UpsertPlaybookGearOptionRequest(o.Id, o.Name, o.MechanicalText, o.SortOrder))]))],
        [.. p.LookCategories.Select(c => new UpsertPlaybookLookCategoryRequest(c.Id, c.AllowsFreeform, c.GroupLabel, c.SortOrder,
            [.. c.Options.Select(o => new UpsertPlaybookLookOptionRequest(o.Id, o.Text, o.SortOrder))]))],
        [.. p.Improvements.Select(x => new UpsertPlaybookImprovementRequest(x.Id, x.Text, x.IsAdvanced, x.SortOrder))],
        [.. p.BespokeSections.Select(ToUpsertSection)],
        [.. p.BespokeJournals.Select(j => new UpsertBespokeJournalRequest(j.Id, j.Title, j.Description, j.EffectText, j.SortOrder,
            [.. j.Fields.Select(f => new UpsertBespokeJournalFieldRequest(f.Id, f.Label, f.SortOrder))]))],
        [.. p.ExtraTracks.Select(t => new UpsertPlaybookExtraTrackRequest(t.Id, t.Name, t.Description, t.EffectText, t.BoxCount, t.StartLabel, t.EndLabel, t.SortOrder))]);

    private static UpsertBespokeSectionRequest ToUpsertSection(BespokeSectionResponse s) => new(
        s.Id, s.Title, s.Description, s.EffectText, s.FreeTextLabel, s.MinSelect, s.MaxSelect,
        s.MinInstances, s.MaxInstances, s.SortOrder, [.. s.Options.Select(ToUpsertOption)]);

    private static UpsertBespokeOptionRequest ToUpsertOption(BespokeOptionResponse o) => new(
        o.Id, o.Title, o.DescriptionText, o.MinSelect, o.MaxSelect, o.NumericMin, o.NumericMax,
        o.SortOrder, [.. o.Children.Select(ToUpsertOption)]);

    private static List<Guid> FlattenIds(IEnumerable<BespokeSectionResponse> sections) =>
        [.. sections.SelectMany(s => FlattenIds(s.Options))];

    private static IEnumerable<Guid> FlattenIds(IEnumerable<BespokeOptionResponse> options) =>
        options.SelectMany(o => new[] { o.Id }.Concat(FlattenIds(o.Children)));

    private sealed class Harness : IAsyncDisposable
    {
        private SqliteConnection connection = null!;
        private DbContextOptions<MotwDbContext> options = null!;

        /// <summary>
        /// A fresh context per call, matching the request-scoped lifetime DI actually gives the
        /// service. Reusing one context across create-then-update hides tracking bugs that
        /// production would hit on the very next request.
        /// </summary>
        public PlaybookService Service => new(new PlaybookRepository(NewContext()));

        public static async Task<Harness> StartAsync()
        {
            var harness = new Harness();
            harness.connection = new SqliteConnection("DataSource=:memory:");
            await harness.connection.OpenAsync();
            harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(harness.connection).Options;

            await using var setup = new MotwDbContext(harness.options);
            await setup.Database.EnsureCreatedAsync();
            return harness;
        }

        public MotwDbContext NewContext() => new(options);

        public async ValueTask DisposeAsync() => await connection.DisposeAsync();
    }
}
