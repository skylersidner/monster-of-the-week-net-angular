using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Data.Seed;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using T = MonsterOfTheWeek.Api.Tests.Services.PickRuleTable;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// Pick rules through the real hunter paths, on the real seed (hunter-creation-wizard.md 12.9,
/// "Tests").
///
/// <para>
/// <b>The regression proof.</b> Each build from 12.9's tables goes through
/// <c>POST /api/hunters/evaluate</c>'s service method against a playbook loaded from the committed
/// seed, rules and all, into SQLite. So these cases also catch a seed without its rules, and a
/// validation query that stops including them (14.3.1), neither of which <c>PickRulesTests</c> can see.
/// </para>
/// </summary>
public sealed class HunterPickRuleSeedTests
{
    private const string NaturalAttacksLine = "Natural Attacks: Pick a Base and add an extra to it, or two Bases.";

    // -----------------------------------------------------------------------------------
    // The build tables, through the check
    // -----------------------------------------------------------------------------------

    [Theory]
    [MemberData(nameof(PickRulesTests.InitiateBuilds), MemberType = typeof(PickRulesTests))]
    public async Task The_Initiates_build_table_through_the_check(string sect, int oldFashioned, int modern, string outcome)
    {
        await using var harness = await Harness.StartAsync(T.Initiate);
        var evaluation = await harness.NewService().EvaluateAsync(InitiateRequest(sect, oldFashioned, modern), default);

        var gearItems = evaluation.Outstanding.Where(i => i.Area == "gear").ToList();
        AssertOutcome(evaluation, gearItems, outcome);
        if (outcome == "reported")
        {
            Assert.Contains(Assert.Single(gearItems).GearCategoryId, new Guid?[] { T.OldFashioned, T.Modern });
        }
    }

    [Theory]
    [MemberData(nameof(PickRulesTests.NaturalAttacksBuilds), MemberType = typeof(PickRulesTests))]
    public async Task Natural_Attacks_build_table_through_the_check(int bases, int extras, bool writeYourOwn, string outcome)
    {
        await using var harness = await Harness.StartAsync(T.Monstrous);
        var evaluation = await harness.NewService().EvaluateAsync(MonstrousRequest(bases, extras, writeYourOwn), default);

        var items = evaluation.Outstanding.Where(i => i.SectionId == T.NaturalAttacks).ToList();
        AssertOutcome(evaluation, items, outcome);
        if (outcome == "reported")
        {
            Assert.Equal(new HunterOutstandingItem("rules", T.NaturalAttacks, null, NaturalAttacksLine), Assert.Single(items));
        }
    }

    [Theory]
    [MemberData(nameof(PickRulesTests.CombatMagicBuilds), MemberType = typeof(PickRulesTests))]
    public async Task Combat_Magic_build_table_through_the_check(int bases, int effects, string outcome)
    {
        await using var harness = await Harness.StartAsync(T.SpellSlinger);
        var evaluation = await harness.NewService().EvaluateAsync(SpellSlingerRequest(bases, effects), default);

        var items = evaluation.Outstanding.Where(i => i.SectionId == T.CombatMagic).ToList();
        AssertOutcome(evaluation, items, outcome);
        if (outcome == "reported")
        {
            Assert.Equal(
                new HunterOutstandingItem("rules", T.CombatMagic, null, "Combat Magic: Pick three (with at least one base)."),
                Assert.Single(items));
        }
    }

    [Theory]
    // The stored category caps stay in force under a rule, and still refuse first with their own
    // messages (S8).
    [InlineData(3, 0, "\"Base\" allows 2 picks, but 3 were made.")]
    [InlineData(0, 2, "\"Extra\" allows 1 pick, but 2 were made.")]
    public async Task The_stored_category_caps_still_refuse_first(int bases, int extras, string expected)
    {
        await using var harness = await Harness.StartAsync(T.Monstrous);

        var evaluation = await harness.NewService().EvaluateAsync(MonstrousRequest(bases, extras), default);

        Assert.Equal(expected, evaluation.Refusal);
    }

    [Fact]
    public async Task Y16_the_depends_suffix_follows_whether_the_Sect_has_any_picks()
    {
        await using var harness = await Harness.StartAsync(T.Initiate);
        var service = harness.NewService();

        var unanswered = await service.EvaluateAsync(InitiateRequest("", 0, 1), default);
        Assert.Equal(
            [new HunterOutstandingItem("gear", null, T.OldFashioned, "Gear — Old-fashioned weapons (pick either two or three, as above): 0 of 2 picked. This depends on your Sect picks.")],
            unanswered.Outstanding.Where(i => i.Area == "gear"));

        // Partly answered: one Good tradition that triggers nothing. Still short, but it has picks.
        var partlyAnswered = await service.EvaluateAsync(InitiateRequest("Knowledgable", 0, 1), default);
        Assert.Equal(
            [new HunterOutstandingItem("gear", null, T.OldFashioned, "Gear — Old-fashioned weapons (pick either two or three, as above): 0 of 2 picked.")],
            partlyAnswered.Outstanding.Where(i => i.Area == "gear"));
    }

    // -----------------------------------------------------------------------------------
    // Create and Update
    // -----------------------------------------------------------------------------------

    [Fact]
    public async Task Create_refuses_a_build_that_fits_no_alternative_for_each_rule()
    {
        await using (var initiate = await Harness.StartAsync(T.Initiate))
        {
            var result = await initiate.NewService().CreateAsync(InitiateRequest("", 3, 1), default);
            Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);
            Assert.Equal(
                "\"Old-fashioned weapons (pick either two or three, as above)\" allows 2 picks, but 3 were made. Fighting arts or Obsolete gear (Sect) allow 3.",
                result.Error.Message);
        }

        await using (var monstrous = await Harness.StartAsync(T.Monstrous))
        {
            var result = await monstrous.NewService().CreateAsync(MonstrousRequest(2, 1), default);
            Assert.Equal(
                "\"Natural Attacks\" allows: Pick a Base and add an extra to it, or two Bases. 2 Base and 1 Extra were picked.",
                result.Error!.Message);
        }

        await using (var slinger = await Harness.StartAsync(T.SpellSlinger))
        {
            var result = await slinger.NewService().CreateAsync(SpellSlingerRequest(3, 1), default);
            Assert.Equal(
                "\"Combat Magic\" allows: Pick three (with at least one base). 3 Bases and 1 Effects were picked.",
                result.Error!.Message);
        }
    }

    [Fact]
    public async Task An_update_that_changes_the_Sect_and_strands_the_weapons_is_refused()
    {
        await using var harness = await Harness.StartAsync(T.Initiate);
        var created = await harness.NewService().CreateAsync(InitiateRequest("Modernised,Knowledgable,Poor", 2, 2), default);
        Assert.True(created.IsSuccess, created.Error?.Message);
        Assert.DoesNotContain(created.Value!.Outstanding, line => line.StartsWith("Gear", StringComparison.Ordinal));

        // Modernised swapped for another Good tradition, weapons untouched: the second modern weapon
        // no longer fits. Nothing is cleared for the player; the save is refused (S5).
        var updated = await harness.NewService().UpdateAsync(created.Value.Id, InitiateRequest("AncientLore,Knowledgable,Poor", 2, 2), default);

        Assert.False(updated.IsSuccess);
        Assert.Equal(
            "\"Modern weapons (pick either one or two, as above)\" allows 1 pick, but 2 were made. Modernised or Nifty gadgets (Sect) allow 2.",
            updated.Error!.Message);
    }

    [Fact]
    public async Task An_untouched_Monstrous_with_two_Bases_re_reads_as_finished()
    {
        await using var harness = await Harness.StartAsync(T.Monstrous);
        var request = MonstrousRequest(2, 0);

        var created = await harness.NewService().CreateAsync(request, default);
        Assert.True(created.IsSuccess, created.Error?.Message);

        var reread = await harness.NewService().GetByIdAsync(created.Value!.Id, default);
        Assert.DoesNotContain(reread!.Outstanding, line => line.StartsWith("Natural Attacks", StringComparison.Ordinal));

        var saved = await harness.NewService().UpdateAsync(created.Value.Id, request, default);
        Assert.True(saved.IsSuccess, saved.Error?.Message);
        Assert.DoesNotContain(saved.Value!.Outstanding, line => line.StartsWith("Natural Attacks", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Q10_a_level_up_pick_over_the_starting_limit_is_refused()
    {
        // "Take a natural attacks pick": a finished 1 + 1 Monstrous records a second Base.
        await using (var monstrous = await Harness.StartAsync(T.Monstrous))
        {
            var created = await monstrous.NewService().CreateAsync(MonstrousRequest(1, 1), default);
            Assert.True(created.IsSuccess, created.Error?.Message);

            var levelled = await monstrous.NewService().UpdateAsync(created.Value!.Id, MonstrousRequest(2, 1), default);
            Assert.False(levelled.IsSuccess);
            Assert.StartsWith("\"Natural Attacks\" allows:", levelled.Error!.Message);
        }

        // "Take another Combat Magic pick": a finished 2 + 1 Spell-Slinger records a fourth spell.
        await using (var slinger = await Harness.StartAsync(T.SpellSlinger))
        {
            var created = await slinger.NewService().CreateAsync(SpellSlingerRequest(2, 1), default);
            Assert.True(created.IsSuccess, created.Error?.Message);

            var levelled = await slinger.NewService().UpdateAsync(created.Value!.Id, SpellSlingerRequest(2, 2), default);
            Assert.False(levelled.IsSuccess);
            Assert.StartsWith("\"Combat Magic\" allows:", levelled.Error!.Message);
        }
    }

    [Fact]
    public async Task An_over_limit_hunter_inserted_directly_reads_back_with_the_rule_and_cannot_be_saved_unchanged()
    {
        // hunter-creation-wizard-phases.md, Phase 6's over-limit fixture: rows added straight to the
        // database, bypassing Validate. A Monstrous with two Bases and an Extra.
        await using var harness = await Harness.StartAsync(T.Monstrous);
        var request = MonstrousRequest(2, 1);
        var hunter = new Hunter { Name = request.Name, PlaybookId = T.Monstrous };
        foreach (var selection in request.BespokeSelections!)
        {
            hunter.BespokeSelections.Add(new HunterBespokeSelection
            {
                HunterId = hunter.Id,
                SectionId = selection.SectionId,
                BespokeOptionId = selection.BespokeOptionId,
            });
        }

        await using (var db = harness.NewContext())
        {
            db.Hunters.Add(hunter);
            await db.SaveChangesAsync();
        }

        var detail = await harness.NewService().GetByIdAsync(hunter.Id, default);
        Assert.Contains(NaturalAttacksLine, detail!.Outstanding);
        Assert.Equal(3, detail.BespokeSelections.Count);

        var saved = await harness.NewService().UpdateAsync(hunter.Id, request, default);
        Assert.False(saved.IsSuccess);
        Assert.StartsWith("\"Natural Attacks\" allows:", saved.Error!.Message);
    }

    // -----------------------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------------------

    private static void AssertOutcome(HunterEvaluationResponse evaluation, List<HunterOutstandingItem> areaItems, string outcome)
    {
        switch (outcome)
        {
            case "refused":
                Assert.NotNull(evaluation.Refusal);
                Assert.Empty(evaluation.Outstanding);
                break;
            case "finished":
                Assert.True(evaluation.Refusal is null, evaluation.Refusal);
                Assert.Empty(areaItems);
                break;
            default:
                Assert.True(evaluation.Refusal is null, evaluation.Refusal);
                Assert.Single(areaItems);
                break;
        }
    }

    private static UpsertHunterRequest InitiateRequest(string sect, int oldFashioned, int modern)
    {
        var initiate = T.SeedPlaybook(T.Initiate);
        return Request(T.Initiate) with
        {
            PlaybookGearOptionIds = [.. T.GearOptions(initiate, T.OldFashioned, oldFashioned), .. T.GearOptions(initiate, T.Modern, modern)],
            BespokeSelections = [.. T.Traditions(sect).Select(id => new HunterBespokeSelectionModel(T.Sect, id, null, null, null))],
        };
    }

    private static UpsertHunterRequest MonstrousRequest(int bases, int extras, bool writeYourOwn = false)
    {
        var monstrous = T.SeedPlaybook(T.Monstrous);
        return Request(T.Monstrous) with
        {
            BespokeSelections =
            [
                .. T.Children(monstrous, T.NaturalAttacks, T.Base, bases, skip: writeYourOwn ? 4 : 0)
                    .Concat(T.Children(monstrous, T.NaturalAttacks, T.Extra, extras))
                    .Select(id => new HunterBespokeSelectionModel(T.NaturalAttacks, id, null, null, null)),
            ],
        };
    }

    private static UpsertHunterRequest SpellSlingerRequest(int bases, int effects)
    {
        var slinger = T.SeedPlaybook(T.SpellSlinger);
        return Request(T.SpellSlinger) with
        {
            BespokeSelections =
            [
                .. T.Children(slinger, T.CombatMagic, T.Bases, bases)
                    .Concat(T.Children(slinger, T.CombatMagic, T.Effects, effects))
                    .Select(id => new HunterBespokeSelectionModel(T.CombatMagic, id, null, null, null)),
            ],
        };
    }

    private static UpsertHunterRequest Request(Guid playbookId) => new(
        "Pick Rule Hunter", null, playbookId, null, 0, 0, 0, null, [], [], [], [], [], [], []);

    /// <summary>One in-memory SQLite database per case, holding one playbook from the committed seed.</summary>
    private sealed class Harness : IAsyncDisposable
    {
        private SqliteConnection connection = null!;
        private DbContextOptions<MotwDbContext> options = null!;

        public static async Task<Harness> StartAsync(Guid playbookId)
        {
            var harness = new Harness();
            harness.connection = new SqliteConnection("DataSource=:memory:");
            await harness.connection.OpenAsync();
            harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(harness.connection).Options;

            await using var setup = harness.NewContext();
            await setup.Database.EnsureCreatedAsync();
            setup.Playbooks.Add(PlaybookSeed.ToEntity(T.SeedPlaybook(playbookId)));
            await setup.SaveChangesAsync();
            return harness;
        }

        /// <summary>A fresh context per call, the lifetime a request gets.</summary>
        public HunterService NewService() => new(new HunterRepository(NewContext()));

        public MotwDbContext NewContext() => new(options);

        public async ValueTask DisposeAsync() => await connection.DisposeAsync();
    }
}
