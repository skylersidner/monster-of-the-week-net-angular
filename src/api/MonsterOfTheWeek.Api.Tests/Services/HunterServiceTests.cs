using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// Covers the invariants Phase 10 introduces that have no visible symptom until play data
/// exists — the ones a reviewer would have to reason about rather than see.
///
/// <para>
/// Uses a real SQLite database rather than a mocked repository, unlike the other
/// <c>*ServiceTests</c> in this folder. That is deliberate and specific to what is under test:
/// three of these cases are about what the *database* ends up holding after a save (stale
/// bridge rows deleted, a required move present, a referenced row protected), and a mocked
/// repository would assert only that the service asked for something, not that the something
/// happened. The broader mocked CRUD suite is still the cross-cutting testing step's job.
/// </para>
/// </summary>
public sealed class HunterServiceTests
{
    private static readonly Guid PlaybookId = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid StatArrayId = Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static readonly Guid RequiredMoveId = Guid.Parse("33333333-3333-4333-8333-333333333333");
    private static readonly Guid PickableMoveId = Guid.Parse("44444444-4444-4444-8444-444444444444");
    private static readonly Guid OtherMoveId = Guid.Parse("55555555-5555-4555-8555-555555555555");
    private static readonly Guid AdvancedMoveId = Guid.Parse("66666666-6666-4666-8666-666666666666");
    private static readonly Guid GearOptionId = Guid.Parse("77777777-7777-4777-8777-777777777777");
    private static readonly Guid SecondGearOptionId = Guid.Parse("7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a");
    private static readonly Guid LookCategoryId = Guid.Parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    private static readonly Guid LookOptionId = Guid.Parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    private static readonly Guid OtherLookCategoryId = Guid.Parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    private static readonly Guid OtherLookOptionId = Guid.Parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    private static readonly Guid ExtraTrackId = Guid.Parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");

    [Fact]
    public async Task Create_adds_required_moves_the_caller_left_out()
    {
        await using var harness = await Harness.StartAsync();

        var created = await harness.Service.CreateAsync(Request() with { PlaybookMoveIds = [PickableMoveId] }, default);

        Assert.True(created.IsSuccess, created.Error?.Message);
        // The playbook grants RequiredMoveId outright, so a hunter built from it always has it —
        // whether or not the client remembered to say so.
        Assert.Contains(RequiredMoveId, created.Value!.PlaybookMoveIds);
        Assert.Contains(PickableMoveId, created.Value.PlaybookMoveIds);
    }

    [Fact]
    public async Task Update_deletes_the_bridge_rows_that_dropped_out_of_the_set()
    {
        await using var harness = await Harness.StartAsync();
        var created = await harness.Service.CreateAsync(
            Request() with { PlaybookMoveIds = [PickableMoveId], PlaybookGearOptionIds = [GearOptionId] },
            default);
        var hunterId = created.Value!.Id;

        // Swap one move for another and drop the gear pick entirely.
        var updated = await harness.Service.UpdateAsync(
            hunterId,
            Request() with { PlaybookMoveIds = [OtherMoveId], PlaybookGearOptionIds = [] },
            default);

        Assert.True(updated.IsSuccess, updated.Error?.Message);
        Assert.Equal([RequiredMoveId, OtherMoveId], updated.Value!.PlaybookMoveIds.Order());
        Assert.Empty(updated.Value.PlaybookGearOptionIds);

        // Asserted against the tables, not just the response: a stale row that is still in the
        // database but absent from a freshly-projected response is exactly the bug this guards.
        await using var verify = harness.NewContext();
        Assert.Equal(2, await verify.HunterMoves.CountAsync(x => x.HunterId == hunterId));
        Assert.Equal(0, await verify.HunterGearSelections.CountAsync(x => x.HunterId == hunterId));
    }

    [Fact]
    public async Task Advanced_moves_are_refused_even_though_the_form_never_offers_them()
    {
        await using var harness = await Harness.StartAsync();

        var result = await harness.Service.CreateAsync(Request() with { PlaybookMoveIds = [AdvancedMoveId] }, default);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);
        Assert.Contains("advanced move", result.Error.Message);
    }

    [Fact]
    public async Task Picking_more_moves_than_the_playbook_grants_is_refused()
    {
        await using var harness = await Harness.StartAsync();

        // MoveGrantCount is 1; the required move must not count against it, so two *pickable*
        // moves is the failure and one pickable plus the required one is not.
        var overLimit = await harness.Service.CreateAsync(
            Request() with { PlaybookMoveIds = [PickableMoveId, OtherMoveId] }, default);
        Assert.False(overLimit.IsSuccess);
        Assert.Contains("allows 1 move pick", overLimit.Error!.Message);

        var atLimit = await harness.Service.CreateAsync(
            Request() with { PlaybookMoveIds = [PickableMoveId, RequiredMoveId] }, default);
        Assert.True(atLimit.IsSuccess, atLimit.Error?.Message);
    }

    [Fact]
    public async Task Picks_belonging_to_another_playbook_are_refused()
    {
        await using var harness = await Harness.StartAsync();

        var result = await harness.Service.CreateAsync(
            Request() with { PlaybookGearOptionIds = [Guid.Parse("99999999-9999-4999-8999-999999999999")] },
            default);

        Assert.False(result.IsSuccess);
        Assert.Contains("does not belong to playbook", result.Error!.Message);
    }

    [Fact]
    public async Task A_track_value_beyond_the_playbooks_own_boxes_is_refused()
    {
        await using var harness = await Harness.StartAsync();

        var result = await harness.Service.CreateAsync(Request() with { Luck = 8 }, default);

        Assert.False(result.IsSuccess);
        Assert.Contains("only has 7 luck boxes", result.Error!.Message);
    }

    // ---------------------------------------------------------------------------------
    // Looks and extra tracks. Unlike moves and gear these rows carry a *value*, so a
    // surviving row has to be updated in place rather than left alone — a case the pure
    // id-set sync cannot express.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task A_look_answer_can_switch_between_freeform_and_a_printed_option()
    {
        await using var harness = await Harness.StartAsync();

        var created = await harness.Service.CreateAsync(
            Request() with { Looks = [new HunterLookSelectionModel(LookCategoryId, null, "sunburnt and squinting")] },
            default);
        Assert.True(created.IsSuccess, created.Error?.Message);
        Assert.Equal("sunburnt and squinting", Assert.Single(created.Value!.Looks).FreeformText);

        // Same line, now answered with a printed option: the row must be updated, not duplicated.
        var updated = await harness.Service.UpdateAsync(
            created.Value.Id,
            Request() with { Looks = [new HunterLookSelectionModel(LookCategoryId, LookOptionId, null)] },
            default);

        Assert.True(updated.IsSuccess, updated.Error?.Message);
        var answer = Assert.Single(updated.Value!.Looks);
        Assert.Equal(LookOptionId, answer.LookOptionId);
        Assert.Null(answer.FreeformText);

        await using var verify = harness.NewContext();
        Assert.Equal(1, await verify.HunterLookSelections.CountAsync(x => x.HunterId == created.Value.Id));
    }

    [Fact]
    public async Task A_look_line_answered_with_both_or_neither_is_refused()
    {
        await using var harness = await Harness.StartAsync();

        // No database constraint expresses "exactly one of these two columns", so both
        // directions are checked explicitly.
        var both = await harness.Service.CreateAsync(
            Request() with { Looks = [new HunterLookSelectionModel(LookCategoryId, LookOptionId, "and also this")] },
            default);
        Assert.False(both.IsSuccess);
        Assert.Contains("pick one", both.Error!.Message);

        var neither = await harness.Service.CreateAsync(
            Request() with { Looks = [new HunterLookSelectionModel(LookCategoryId, null, "   ")] },
            default);
        Assert.False(neither.IsSuccess);
        Assert.Contains("neither an option nor any text", neither.Error!.Message);
    }

    [Fact]
    public async Task A_look_option_from_a_different_line_is_refused()
    {
        await using var harness = await Harness.StartAsync();

        var result = await harness.Service.CreateAsync(
            Request() with { Looks = [new HunterLookSelectionModel(LookCategoryId, OtherLookOptionId, null)] },
            default);

        Assert.False(result.IsSuccess);
        Assert.Contains("does not belong to that look line", result.Error!.Message);
    }

    [Fact]
    public async Task An_extra_track_value_round_trips_and_is_bounded_by_its_own_box_count()
    {
        await using var harness = await Harness.StartAsync();

        var ok = await harness.Service.CreateAsync(
            Request() with { ExtraTracks = [new HunterExtraTrackValueModel(ExtraTrackId, 3)] }, default);
        Assert.True(ok.IsSuccess, ok.Error?.Message);
        Assert.Equal(3, Assert.Single(ok.Value!.ExtraTracks).CurrentValue);

        // The track's own BoxCount is the ceiling, not the playbook's harm/luck counts.
        var tooHigh = await harness.Service.CreateAsync(
            Request() with { ExtraTracks = [new HunterExtraTrackValueModel(ExtraTrackId, 9)] }, default);
        Assert.False(tooHigh.IsSuccess);
        Assert.Contains("only has 7 boxes", tooHigh.Error!.Message);
    }

    // ---------------------------------------------------------------------------------
    // Partial saves and derived completeness (architecture.md Section 9, 2026-08-31).
    //
    // The split under test: falling *short* of a stated count is reported and saved;
    // exceeding one is refused. These are the cases that pin the boundary in place, since
    // both directions run through the same PickCount / MoveGrantCount numbers.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task A_hunter_with_nothing_answered_still_saves()
    {
        await using var harness = await Harness.StartAsync();

        // Name and playbook only: no rating array, no move picks, no gear, no looks. This is
        // the state a hunter is in thirty seconds into being made, and it must persist.
        var result = await harness.Service.CreateAsync(
            new UpsertHunterRequest("Half A Hunter", null, PlaybookId, null, 0, 0, 0, null, [], [], [], []),
            default);

        Assert.True(result.IsSuccess, result.Error?.Message);
        Assert.Null(result.Value!.PlaybookStatArrayOptionId);

        await using var verify = harness.NewContext();
        Assert.Equal(1, await verify.Hunters.CountAsync(x => x.Id == result.Value.Id));
    }

    [Fact]
    public async Task An_unfinished_hunter_reports_exactly_what_it_still_owes()
    {
        await using var harness = await Harness.StartAsync();

        var result = await harness.Service.CreateAsync(
            new UpsertHunterRequest("Half A Hunter", null, PlaybookId, null, 0, 0, 0, null, [], [], [], []),
            default);

        // Sheet order, and only the things that are genuinely unanswered. Extra tracks are
        // absent on purpose — a missing value is indistinguishable from 0, which is a real
        // starting position, so there is no answer being withheld (see HunterCompleteness).
        Assert.Equal(
            [
                "Choose a rating array.",
                "Moves: 0 of 1 picked.",
                "Gear — Weapons: 0 of 1 picked.",
                "Look: 2 of 2 lines are unanswered.",
            ],
            result.Value!.Outstanding);
    }

    [Fact]
    public async Task A_fully_answered_hunter_reports_nothing_outstanding()
    {
        await using var harness = await Harness.StartAsync();

        var result = await harness.Service.CreateAsync(
            Request() with
            {
                PlaybookMoveIds = [PickableMoveId],
                PlaybookGearOptionIds = [GearOptionId],
                Looks =
                [
                    new HunterLookSelectionModel(LookCategoryId, LookOptionId, null),
                    new HunterLookSelectionModel(OtherLookCategoryId, null, "in a borrowed coat"),
                ],
            },
            default);

        Assert.True(result.IsSuccess, result.Error?.Message);
        Assert.Empty(result.Value!.Outstanding);
    }

    [Fact]
    public async Task Completeness_is_recomputed_on_read_not_stored()
    {
        await using var harness = await Harness.StartAsync();
        var created = await harness.Service.CreateAsync(
            Request() with
            {
                PlaybookMoveIds = [PickableMoveId],
                PlaybookGearOptionIds = [GearOptionId],
                Looks =
                [
                    new HunterLookSelectionModel(LookCategoryId, LookOptionId, null),
                    new HunterLookSelectionModel(OtherLookCategoryId, null, "in a borrowed coat"),
                ],
            },
            default);
        Assert.Empty(created.Value!.Outstanding);

        // The playbook grows a requirement the hunter cannot possibly have met, without the
        // hunter being touched. This is the case a stored "complete" flag would get wrong and
        // strict save-time enforcement would turn into a lockout: the hunter simply reports
        // more outstanding, and remains editable.
        await using var context = harness.NewContext();
        var playbook = await context.Playbooks.FirstAsync(x => x.Id == PlaybookId);
        playbook.MoveGrantCount = 2;
        await context.SaveChangesAsync();

        var reread = await harness.Service.GetByIdAsync(created.Value.Id, default);
        Assert.Equal("Moves: 1 of 2 picked.", Assert.Single(reread!.Outstanding));

        // And it can still be saved — an unrelated edit is not blocked by the new shortfall.
        var renamed = await harness.Service.UpdateAsync(
            created.Value.Id,
            Request() with
            {
                Name = "Renamed Mid-Campaign",
                PlaybookMoveIds = [PickableMoveId],
                PlaybookGearOptionIds = [GearOptionId],
                Looks =
                [
                    new HunterLookSelectionModel(LookCategoryId, LookOptionId, null),
                    new HunterLookSelectionModel(OtherLookCategoryId, null, "in a borrowed coat"),
                ],
            },
            default);
        Assert.True(renamed.IsSuccess, renamed.Error?.Message);
        Assert.Equal("Renamed Mid-Campaign", renamed.Value!.Name);
    }

    [Fact]
    public async Task Picking_more_gear_than_a_category_allows_is_refused_but_fewer_is_not()
    {
        await using var harness = await Harness.StartAsync();

        // The "Weapons" category has PickCount 1 over two options. Until 2026-08-31 nothing on
        // the server checked this at all — only the Angular form disabling further checkboxes.
        var overLimit = await harness.Service.CreateAsync(
            Request() with { PlaybookGearOptionIds = [GearOptionId, SecondGearOptionId] },
            default);
        Assert.False(overLimit.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, overLimit.Error!.Type);
        Assert.Contains("allows 1 pick, but 2 were made", overLimit.Error.Message);

        // The other direction is the whole point of the split: short is unfinished, not invalid.
        var underLimit = await harness.Service.CreateAsync(
            Request() with { PlaybookGearOptionIds = [] }, default);
        Assert.True(underLimit.IsSuccess, underLimit.Error?.Message);
        Assert.Contains("Gear — Weapons: 0 of 1 picked.", underLimit.Value!.Outstanding);
    }

    // ---------------------------------------------------------------------------------
    // The other half of the live-link contract: the template cannot delete rows out from
    // under a hunter. Lives here rather than in a PlaybookService suite because the hunter
    // is what makes the case exist at all.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task Editing_a_playbook_cannot_remove_a_look_line_answered_in_the_hunters_own_words()
    {
        await using var harness = await Harness.StartAsync();
        await harness.Service.CreateAsync(
            Request() with { Looks = [new HunterLookSelectionModel(LookCategoryId, null, "sunburnt")] },
            default);

        await using var context = harness.NewContext();
        var playbookService = new PlaybookService(new PlaybookRepository(context));
        var stored = await playbookService.GetByIdAsync(PlaybookId, default);

        // The subtle case: a freeform answer references only the *category*, with no option id
        // at all, so a guard that only watched look options would let this line be deleted.
        var request = ToUpsert(stored!) with
        {
            LookCategories = [.. stored!.LookCategories.Where(c => c.Id != LookCategoryId)
                .Select(c => new UpsertPlaybookLookCategoryRequest(c.Id, c.AllowsFreeform, c.GroupLabel, c.SortOrder,
                    [.. c.Options.Select(o => new UpsertPlaybookLookOptionRequest(o.Id, o.Text, o.SortOrder))]))],
        };

        var result = await playbookService.UpdateAsync(PlaybookId, request, default);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Conflict, result.Error!.Type);
        Assert.Contains("look line #1", result.Error.Message);
    }

    [Fact]
    public async Task Editing_a_playbook_cannot_remove_a_move_a_hunter_picked()
    {
        await using var harness = await Harness.StartAsync();
        await harness.Service.CreateAsync(Request() with { PlaybookMoveIds = [PickableMoveId] }, default);

        await using var context = harness.NewContext();
        var playbookService = new PlaybookService(new PlaybookRepository(context));
        var stored = await playbookService.GetByIdAsync(PlaybookId, default);

        // Send the playbook back with the picked move omitted — the Id-based diff would
        // otherwise delete it, taking the hunter's selection with it.
        var request = ToUpsert(stored!) with
        {
            Moves = [.. stored!.Moves.Where(m => m.Id != PickableMoveId)
                .Select(m => new UpsertPlaybookMoveRequest(m.Id, m.Name, m.DescriptionText, m.Required, m.IsAdvanced, m.SortOrder, []))],
        };

        var result = await playbookService.UpdateAsync(PlaybookId, request, default);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Conflict, result.Error!.Type);
        Assert.Contains("Pickable Move", result.Error.Message);

        // And the rejection left the stored graph alone rather than half-applying it.
        await using var verify = harness.NewContext();
        Assert.Equal(4, await verify.PlaybookMoves.CountAsync(x => x.PlaybookId == PlaybookId));
    }

    [Fact]
    public async Task Editing_a_playbook_can_still_remove_a_move_no_hunter_picked()
    {
        await using var harness = await Harness.StartAsync();
        await harness.Service.CreateAsync(Request() with { PlaybookMoveIds = [PickableMoveId] }, default);

        await using var context = harness.NewContext();
        var playbookService = new PlaybookService(new PlaybookRepository(context));
        var stored = await playbookService.GetByIdAsync(PlaybookId, default);

        var request = ToUpsert(stored!) with
        {
            Moves = [.. stored!.Moves.Where(m => m.Id != OtherMoveId)
                .Select(m => new UpsertPlaybookMoveRequest(m.Id, m.Name, m.DescriptionText, m.Required, m.IsAdvanced, m.SortOrder, []))],
        };

        var result = await playbookService.UpdateAsync(PlaybookId, request, default);

        Assert.True(result.IsSuccess, result.Error?.Message);
        await using var verify = harness.NewContext();
        Assert.Equal(3, await verify.PlaybookMoves.CountAsync(x => x.PlaybookId == PlaybookId));
    }

    // ---------------------------------------------------------------------------------
    // Fixtures
    // ---------------------------------------------------------------------------------

    private static UpsertHunterRequest Request() => new(
        "Test Hunter", null, PlaybookId, StatArrayId, 0, 0, 0, null, [], [], [], []);

    private static UpsertPlaybookRequest ToUpsert(PlaybookDetailResponse playbook) => new(
        playbook.Name,
        playbook.Description,
        playbook.LuckBoxCount,
        playbook.LuckSpecialText,
        playbook.HarmUnstableThreshold,
        playbook.HarmBoxCount,
        playbook.ExperienceBoxCount,
        playbook.MoveGrantCount,
        playbook.GettingStartedText,
        playbook.IntroductionsText,
        playbook.LevelingUpText,
        playbook.HistoryPromptsText,
        [.. playbook.StatArrayOptions.Select(x => new UpsertPlaybookStatArrayOptionRequest(x.Id, x.Charm, x.Cool, x.Sharp, x.Tough, x.Weird, x.SortOrder))],
        [.. playbook.Moves.Select(x => new UpsertPlaybookMoveRequest(x.Id, x.Name, x.DescriptionText, x.Required, x.IsAdvanced, x.SortOrder, []))],
        [.. playbook.GearCategories.Select(c => new UpsertPlaybookGearCategoryRequest(c.Id, c.Label, c.PickCount, c.IsOptional, c.SortOrder,
            [.. c.Options.Select(o => new UpsertPlaybookGearOptionRequest(o.Id, o.Name, o.MechanicalText, o.SortOrder))]))],
        [.. playbook.LookCategories.Select(c => new UpsertPlaybookLookCategoryRequest(c.Id, c.AllowsFreeform, c.GroupLabel, c.SortOrder,
            [.. c.Options.Select(o => new UpsertPlaybookLookOptionRequest(o.Id, o.Text, o.SortOrder))]))],
        [],
        [],
        [],
        [.. playbook.ExtraTracks.Select(t => new UpsertPlaybookExtraTrackRequest(t.Id, t.Name, t.Description, t.EffectText, t.BoxCount, t.StartLabel, t.EndLabel, t.SortOrder))]);

    private static Playbook SeedPlaybook() => new()
    {
        Id = PlaybookId,
        Name = "The Test Subject",
        LuckBoxCount = 7,
        HarmBoxCount = 7,
        HarmUnstableThreshold = 5,
        ExperienceBoxCount = 5,
        MoveGrantCount = 1,
        StatArrayOptions = [new PlaybookStatArrayOption { Id = StatArrayId, Charm = 1, Cool = 0, Sharp = 2, Tough = -1, Weird = 1, SortOrder = 0 }],
        Moves =
        [
            new PlaybookMove { Id = RequiredMoveId, Name = "Granted Move", Required = true, SortOrder = 0 },
            new PlaybookMove { Id = PickableMoveId, Name = "Pickable Move", SortOrder = 1 },
            new PlaybookMove { Id = OtherMoveId, Name = "Other Move", SortOrder = 2 },
            new PlaybookMove { Id = AdvancedMoveId, Name = "Advanced Move", IsAdvanced = true, SortOrder = 0 },
        ],
        GearCategories =
        [
            new PlaybookGearCategory
            {
                Id = Guid.Parse("88888888-8888-4888-8888-888888888888"),
                Label = "Weapons",
                // PickCount must not exceed the number of options — PlaybookService.ValidateGraph
                // rejects that, and an invalid fixture would make the playbook-edit cases below
                // fail on the wrong error.
                PickCount = 1,
                SortOrder = 0,
                Options =
                [
                    new PlaybookGearOption { Id = GearOptionId, Name = "Shotgun", SortOrder = 0 },
                    new PlaybookGearOption { Id = SecondGearOptionId, Name = "Machete", SortOrder = 1 },
                ],
            },
        ],
        LookCategories =
        [
            new PlaybookLookCategory
            {
                Id = LookCategoryId,
                AllowsFreeform = true,
                SortOrder = 0,
                Options = [new PlaybookLookOption { Id = LookOptionId, Text = "haggard face", SortOrder = 0 }],
            },
            new PlaybookLookCategory
            {
                Id = OtherLookCategoryId,
                AllowsFreeform = true,
                SortOrder = 1,
                Options = [new PlaybookLookOption { Id = OtherLookOptionId, Text = "neat clothes", SortOrder = 0 }],
            },
        ],
        ExtraTracks =
        [
            new PlaybookExtraTrack { Id = ExtraTrackId, Name = "Corruption", BoxCount = 7, EndLabel = "Lost", SortOrder = 0 },
        ],
    };

    private sealed class Harness : IAsyncDisposable
    {
        private SqliteConnection connection = null!;
        private DbContextOptions<MotwDbContext> options = null!;

        public HunterService Service { get; private set; } = null!;

        public static async Task<Harness> StartAsync()
        {
            var harness = new Harness();
            harness.connection = new SqliteConnection("DataSource=:memory:");
            await harness.connection.OpenAsync();
            harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(harness.connection).Options;

            await using var setup = new MotwDbContext(harness.options);
            await setup.Database.EnsureCreatedAsync();
            setup.Playbooks.Add(SeedPlaybook());
            await setup.SaveChangesAsync();

            harness.Service = new HunterService(new HunterRepository(harness.NewContext()));
            return harness;
        }

        public MotwDbContext NewContext() => new(options);

        public async ValueTask DisposeAsync() => await connection.DisposeAsync();
    }
}
