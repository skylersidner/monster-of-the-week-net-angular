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

    // Bespoke fixture. Shapes chosen to match the four that real data actually exercises:
    // a nested category tree, a free-text section, a repeatable section, and one owned by a move.
    private static readonly Guid NestedSectionId = Guid.Parse("10000000-0000-4000-8000-000000000001");
    private static readonly Guid CategoryAId = Guid.Parse("10000000-0000-4000-8000-00000000000a");
    private static readonly Guid LeafA1Id = Guid.Parse("10000000-0000-4000-8000-0000000000a1");
    private static readonly Guid LeafA2Id = Guid.Parse("10000000-0000-4000-8000-0000000000a2");
    private static readonly Guid CategoryBId = Guid.Parse("10000000-0000-4000-8000-00000000000b");
    private static readonly Guid LeafB1Id = Guid.Parse("10000000-0000-4000-8000-0000000000b1");
    private static readonly Guid FreeTextSectionId = Guid.Parse("20000000-0000-4000-8000-000000000002");
    private static readonly Guid RepeatableSectionId = Guid.Parse("30000000-0000-4000-8000-000000000003");
    private static readonly Guid RoteOptionAId = Guid.Parse("30000000-0000-4000-8000-0000000000a0");
    private static readonly Guid RoteOptionBId = Guid.Parse("30000000-0000-4000-8000-0000000000b0");
    private static readonly Guid MoveSectionId = Guid.Parse("40000000-0000-4000-8000-000000000004");
    private static readonly Guid MoveOptionId = Guid.Parse("40000000-0000-4000-8000-0000000000a4");
    private static readonly Guid JournalId = Guid.Parse("50000000-0000-4000-8000-000000000005");
    private static readonly Guid JournalFieldId = Guid.Parse("50000000-0000-4000-8000-0000000000a5");

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
            new UpsertHunterRequest("Half A Hunter", null, PlaybookId, null, 0, 0, 0, null, [], [], [], [], [], [], []),
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
            new UpsertHunterRequest("Half A Hunter", null, PlaybookId, null, 0, 0, 0, null, [], [], [], [], [], [], []),
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
                "Fate: 0 of 1 picked.",
                "Gumshoe Code: not filled in.",
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
                // Bespoke answers count towards "finished" too: the nested section, the free-text
                // one, and the section that belongs to the move this hunter just took.
                BespokeSelections =
                [
                    new HunterBespokeSelectionModel(NestedSectionId, LeafA1Id, null, null, null),
                    new HunterBespokeSelectionModel(FreeTextSectionId, null, null, "my code", null),
                    new HunterBespokeSelectionModel(MoveSectionId, MoveOptionId, "Sword", "old and cold", null),
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
                // Bespoke answers count towards "finished" too: the nested section, the free-text
                // one, and the section that belongs to the move this hunter just took.
                BespokeSelections =
                [
                    new HunterBespokeSelectionModel(NestedSectionId, LeafA1Id, null, null, null),
                    new HunterBespokeSelectionModel(FreeTextSectionId, null, null, "my code", null),
                    new HunterBespokeSelectionModel(MoveSectionId, MoveOptionId, "Sword", "old and cold", null),
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
                // Bespoke answers count towards "finished" too: the nested section, the free-text
                // one, and the section that belongs to the move this hunter just took.
                BespokeSelections =
                [
                    new HunterBespokeSelectionModel(NestedSectionId, LeafA1Id, null, null, null),
                    new HunterBespokeSelectionModel(FreeTextSectionId, null, null, "my code", null),
                    new HunterBespokeSelectionModel(MoveSectionId, MoveOptionId, "Sword", "old and cold", null),
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
    // Bespoke rulesets (Follow-on 10b)
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task A_categorys_pick_count_is_met_by_engagement_not_by_selection_rows()
    {
        await using var harness = await Harness.StartAsync();

        /*
         * The rule that is easy to get wrong, and did get written wrong first: "Fate" allows 2
         * picks over its TOP-LEVEL options, and its top-level options are two category dividers
         * that are never themselves selected. Counting selection rows with a null parent would
         * read this as zero picks no matter how much is filled in; counting *engaged* categories
         * is the rule (architecture.md 6.4).
         */
        var result = await harness.Service.CreateAsync(
            Request() with
            {
                BespokeSelections =
                [
                    new HunterBespokeSelectionModel(NestedSectionId, LeafA1Id, null, null, null),
                    new HunterBespokeSelectionModel(NestedSectionId, LeafB1Id, null, null, 2),
                ],
            },
            default);

        Assert.True(result.IsSuccess, result.Error?.Message);
        Assert.Equal(2, result.Value!.BespokeSelections.Count);

        // A third category would exceed MaxSelect=2 — but there are only two, so the ceiling is
        // instead proven by over-picking WITHIN a category, whose own MaxSelect is 1.
        var overPicked = await harness.Service.CreateAsync(
            Request() with
            {
                BespokeSelections =
                [
                    new HunterBespokeSelectionModel(NestedSectionId, LeafA1Id, null, null, null),
                    new HunterBespokeSelectionModel(NestedSectionId, LeafA2Id, null, null, null),
                ],
            },
            default);

        Assert.False(overPicked.IsSuccess);
        Assert.Contains("\"Doom\" allows 1 pick", overPicked.Error!.Message);
    }

    [Fact]
    public async Task An_unfinished_bespoke_section_is_reported_never_refused()
    {
        await using var harness = await Harness.StartAsync();

        // Nothing bespoke answered at all: saves cleanly, and says what is missing.
        var result = await harness.Service.CreateAsync(Request(), default);

        Assert.True(result.IsSuccess, result.Error?.Message);
        Assert.Contains("Fate: 0 of 1 picked.", result.Value!.Outstanding);
        Assert.Contains("Gumshoe Code: not filled in.", result.Value.Outstanding);

        // A category that is engaged but short reports separately from the section itself.
        var partial = await harness.Service.CreateAsync(
            Request() with
            {
                BespokeSelections = [new HunterBespokeSelectionModel(NestedSectionId, LeafA1Id, null, null, null)],
            },
            default);
        Assert.DoesNotContain(partial.Value!.Outstanding, x => x.StartsWith("Fate: 0 of"));
    }

    [Fact]
    public async Task A_free_text_section_round_trips_and_rejects_an_option_it_has_no_room_for()
    {
        await using var harness = await Harness.StartAsync();

        var created = await harness.Service.CreateAsync(
            Request() with
            {
                BespokeSelections = [new HunterBespokeSelectionModel(FreeTextSectionId, null, null, "Never leave a client hanging.", null)],
            },
            default);

        Assert.True(created.IsSuccess, created.Error?.Message);
        var answer = Assert.Single(created.Value!.BespokeSelections);
        Assert.Null(answer.BespokeOptionId);
        Assert.Equal("Never leave a client hanging.", answer.FreeformText);

        // The mirror case: a null option against a section that does have options is not the
        // documented exception, it is a malformed answer.
        var wrong = await harness.Service.CreateAsync(
            Request() with { BespokeSelections = [new HunterBespokeSelectionModel(NestedSectionId, null, null, "freehand", null)] },
            default);
        Assert.False(wrong.IsSuccess);
        Assert.Contains("answered by picking an option", wrong.Error!.Message);
    }

    [Fact]
    public async Task Two_entries_of_a_repeatable_section_keep_their_answers_apart()
    {
        await using var harness = await Harness.StartAsync();

        var created = await harness.Service.CreateAsync(
            Request() with
            {
                BespokeInstances =
                [
                    new HunterBespokeInstanceModel(null, RepeatableSectionId, "Fire", 0,
                        [new HunterBespokeSelectionModel(RepeatableSectionId, RoteOptionAId, null, null, null)]),
                    new HunterBespokeInstanceModel(null, RepeatableSectionId, "Ice", 1,
                        [new HunterBespokeSelectionModel(RepeatableSectionId, RoteOptionBId, null, null, null)]),
                ],
            },
            default);

        Assert.True(created.IsSuccess, created.Error?.Message);
        Assert.Equal(2, created.Value!.BespokeInstances.Count);
        // Each entry keeps its own pick rather than both collapsing onto the section.
        Assert.Equal(["Fire", "Ice"], created.Value.BespokeInstances.Select(i => i.Name));
        Assert.Equal([RoteOptionAId, RoteOptionBId],
            created.Value.BespokeInstances.SelectMany(i => i.Selections).Select(s => s.BespokeOptionId!.Value));
        Assert.Empty(created.Value.BespokeSelections);

        // Dropping an entry must take its answers with it, not orphan them onto the hunter.
        var kept = created.Value.BespokeInstances.First(i => i.Name == "Ice");
        var updated = await harness.Service.UpdateAsync(
            created.Value.Id,
            Request() with
            {
                BespokeInstances = [new HunterBespokeInstanceModel(kept.Id, RepeatableSectionId, "Ice", 0, kept.Selections)],
            },
            default);

        Assert.True(updated.IsSuccess, updated.Error?.Message);
        await using var verify = harness.NewContext();
        Assert.Equal(1, await verify.HunterBespokeSectionInstances.CountAsync(x => x.HunterId == created.Value.Id));
        Assert.Equal(1, await verify.HunterBespokeSelections.CountAsync(x => x.HunterId == created.Value.Id));
    }

    [Fact]
    public async Task A_moves_own_section_cannot_be_answered_unless_the_move_is_taken()
    {
        await using var harness = await Harness.StartAsync();

        var refused = await harness.Service.CreateAsync(
            Request() with
            {
                PlaybookMoveIds = [],
                BespokeSelections = [new HunterBespokeSelectionModel(MoveSectionId, MoveOptionId, "Sword", "old and cold", null)],
            },
            default);

        Assert.False(refused.IsSuccess);
        Assert.Contains("which this hunter has not taken", refused.Error!.Message);

        // With the move taken it is accepted — and both blank fills survive, which is the whole
        // reason FreeformTitle exists alongside FreeformText.
        var accepted = await harness.Service.CreateAsync(
            Request() with
            {
                PlaybookMoveIds = [PickableMoveId],
                BespokeSelections = [new HunterBespokeSelectionModel(MoveSectionId, MoveOptionId, "Sword", "old and cold", null)],
            },
            default);

        Assert.True(accepted.IsSuccess, accepted.Error?.Message);
        var answer = Assert.Single(accepted.Value!.BespokeSelections);
        Assert.Equal("Sword", answer.FreeformTitle);
        Assert.Equal("old and cold", answer.FreeformText);
    }

    [Fact]
    public async Task A_numeric_leaf_is_bounded_and_a_blank_fill_needs_a_blank_to_fill()
    {
        await using var harness = await Harness.StartAsync();

        var outOfRange = await harness.Service.CreateAsync(
            Request() with { BespokeSelections = [new HunterBespokeSelectionModel(NestedSectionId, LeafB1Id, null, null, 9)] },
            default);
        Assert.False(outOfRange.IsSuccess);
        Assert.Contains("accepts 0–3", outOfRange.Error!.Message);

        // "Betrayed" prints no {{blank}}, so text against it would be stored with nowhere to show.
        var strayText = await harness.Service.CreateAsync(
            Request() with { BespokeSelections = [new HunterBespokeSelectionModel(NestedSectionId, LeafA1Id, null, "extra", null)] },
            default);
        Assert.False(strayText.IsSuccess);
        Assert.Contains("no blank to fill in", strayText.Error!.Message);
    }

    [Fact]
    public async Task Journal_entries_round_trip_and_are_replaced_wholesale()
    {
        await using var harness = await Harness.StartAsync();

        var created = await harness.Service.CreateAsync(
            Request() with
            {
                JournalEntries =
                [
                    new HunterJournalEntryModel(null, JournalId, 0, [new HunterJournalFieldValueModel(JournalFieldId, "Fly")]),
                    new HunterJournalEntryModel(null, JournalId, 1, [new HunterJournalFieldValueModel(JournalFieldId, "Burn")]),
                ],
            },
            default);

        Assert.True(created.IsSuccess, created.Error?.Message);
        Assert.Equal(2, created.Value!.JournalEntries.Count);

        var updated = await harness.Service.UpdateAsync(
            created.Value.Id,
            Request() with { JournalEntries = [] },
            default);

        Assert.True(updated.IsSuccess, updated.Error?.Message);
        await using var verify = harness.NewContext();
        Assert.Equal(0, await verify.HunterJournalEntries.CountAsync(x => x.HunterId == created.Value.Id));
        // The field values go too — a stale one would be an orphan the next read would trip over.
        Assert.Equal(0, await verify.HunterJournalEntryFieldValues.CountAsync());
    }

    [Fact]
    public async Task Editing_a_playbook_cannot_remove_a_bespoke_option_or_a_free_text_section_in_use()
    {
        await using var harness = await Harness.StartAsync();
        await harness.Service.CreateAsync(
            Request() with
            {
                BespokeSelections =
                [
                    new HunterBespokeSelectionModel(NestedSectionId, LeafA1Id, null, null, null),
                    new HunterBespokeSelectionModel(FreeTextSectionId, null, null, "my code", null),
                ],
            },
            default);

        await using var context = harness.NewContext();
        var playbookService = new PlaybookService(new PlaybookRepository(context));
        var stored = await playbookService.GetByIdAsync(PlaybookId, default);

        // Dropping the whole free-text section: it is referenced with no option id at all, the
        // same shape that made look *categories* need their own guard query.
        var withoutFreeText = ToUpsert(stored!) with
        {
            BespokeSections = [.. ToUpsert(stored!).BespokeSections!.Where(s => s.Id != FreeTextSectionId)],
        };
        var refusedSection = await playbookService.UpdateAsync(PlaybookId, withoutFreeText, default);
        Assert.False(refusedSection.IsSuccess);
        Assert.Equal(ServiceErrorType.Conflict, refusedSection.Error!.Type);
        Assert.Contains("Gumshoe Code", refusedSection.Error.Message);
    }

    // ---------------------------------------------------------------------------------
    // Fixtures
    // ---------------------------------------------------------------------------------

    private static UpsertHunterRequest Request() => new(
        "Test Hunter", null, PlaybookId, StatArrayId, 0, 0, 0, null, [], [], [], [], [], [], []);

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
        // A move's own bespoke sections must be echoed back, or the Id-based diff reads them as
        // removed on every save and the in-use guard refuses the whole update.
        [.. playbook.Moves.Select(x => new UpsertPlaybookMoveRequest(x.Id, x.Name, x.DescriptionText, x.Required, x.IsAdvanced, x.SortOrder,
            [.. x.BespokeSections.Select(ToUpsertSection)]))],
        [.. playbook.GearCategories.Select(c => new UpsertPlaybookGearCategoryRequest(c.Id, c.Label, c.PickCount, c.IsOptional, c.SortOrder,
            [.. c.Options.Select(o => new UpsertPlaybookGearOptionRequest(o.Id, o.Name, o.MechanicalText, o.SortOrder))]))],
        [.. playbook.LookCategories.Select(c => new UpsertPlaybookLookCategoryRequest(c.Id, c.AllowsFreeform, c.GroupLabel, c.SortOrder,
            [.. c.Options.Select(o => new UpsertPlaybookLookOptionRequest(o.Id, o.Text, o.SortOrder))]))],
        [],
        [.. playbook.BespokeSections.Select(ToUpsertSection)],
        [.. playbook.BespokeJournals.Select(j => new UpsertBespokeJournalRequest(j.Id, j.Title, j.Description, j.EffectText, j.SortOrder,
            [.. j.Fields.Select(f => new UpsertBespokeJournalFieldRequest(f.Id, f.Label, f.SortOrder))]))],
        [.. playbook.ExtraTracks.Select(t => new UpsertPlaybookExtraTrackRequest(t.Id, t.Name, t.Description, t.EffectText, t.BoxCount, t.StartLabel, t.EndLabel, t.SortOrder))]);

    private static UpsertBespokeSectionRequest ToUpsertSection(BespokeSectionResponse section) => new(
        section.Id, section.Title, section.Description, section.EffectText, section.FreeTextLabel,
        section.MinSelect, section.MaxSelect, section.MinInstances, section.MaxInstances, section.SortOrder,
        [.. section.Options.Select(ToUpsertOption)]);

    private static UpsertBespokeOptionRequest ToUpsertOption(BespokeOptionResponse option) => new(
        option.Id, option.Title, option.DescriptionText, option.MinSelect, option.MaxSelect,
        option.NumericMin, option.NumericMax, option.SortOrder,
        [.. option.Children.Select(ToUpsertOption)]);

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
        BespokeSections =
        [
            // Options are stored FLAT with ParentOptionId, at every depth — that is the storage
            // shape (BespokeOption.SectionId is populated on descendants); only the wire format
            // nests them.
            new BespokeSection
            {
                Id = NestedSectionId, Title = "Fate", MinSelect = 1, MaxSelect = 2, SortOrder = 0,
                Options =
                [
                    new BespokeOption { Id = CategoryAId, SectionId = NestedSectionId, Title = "Doom", MinSelect = 1, MaxSelect = 1, SortOrder = 0 },
                    new BespokeOption { Id = LeafA1Id, SectionId = NestedSectionId, ParentOptionId = CategoryAId, Title = "Betrayed", SortOrder = 0 },
                    new BespokeOption { Id = LeafA2Id, SectionId = NestedSectionId, ParentOptionId = CategoryAId, Title = "Forgotten", SortOrder = 1 },
                    new BespokeOption { Id = CategoryBId, SectionId = NestedSectionId, Title = "Destiny", MinSelect = 1, MaxSelect = 1, SortOrder = 1 },
                    new BespokeOption { Id = LeafB1Id, SectionId = NestedSectionId, ParentOptionId = CategoryBId, Title = "Favour", NumericMin = 0, NumericMax = 3, SortOrder = 0 },
                ],
            },
            new BespokeSection { Id = FreeTextSectionId, Title = "Gumshoe Code", FreeTextLabel = "Your Code", SortOrder = 1 },
            new BespokeSection
            {
                Id = RepeatableSectionId, Title = "Rotes", MinInstances = 0, MinSelect = 1, MaxSelect = 1, SortOrder = 2,
                Options =
                [
                    new BespokeOption { Id = RoteOptionAId, SectionId = RepeatableSectionId, Title = "Words", SortOrder = 0 },
                    new BespokeOption { Id = RoteOptionBId, SectionId = RepeatableSectionId, Title = "Gestures", SortOrder = 1 },
                ],
            },
            new BespokeSection
            {
                Id = MoveSectionId, PlaybookMoveId = PickableMoveId, Title = "Artifact", MinSelect = 1, MaxSelect = 1, SortOrder = 0,
                Options =
                [
                    new BespokeOption { Id = MoveOptionId, SectionId = MoveSectionId, Title = "{{blank}}", DescriptionText = "It is {{blank}}.", SortOrder = 0 },
                ],
            },
        ],
        BespokeJournals =
        [
            new BespokeJournal
            {
                Id = JournalId, Title = "Consumed Magic", SortOrder = 0,
                Fields = [new BespokeJournalField { Id = JournalFieldId, Label = "Power", SortOrder = 0 }],
            },
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
