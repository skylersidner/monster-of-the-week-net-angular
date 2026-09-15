using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Seed;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// Evaluate and Create return identical messages for the same request, on the real seed
/// (hunter-creation-wizard.md 12.8.1 O2, 14.4, Y8).
///
/// <para>
/// <b>Why the seed and not a hand-built fixture.</b> The ways the two could disagree are all
/// about order, and the seed is where the orders that caused trouble actually live. The Chosen's
/// Fate has three categories whose minimums can be short at once, and category lines once
/// followed the order the picks arrived in. Every move-owned section sits at <c>SortOrder</c> 0,
/// so The Searcher's and The Spell-Slinger's once came out in database order. Evaluate reads
/// entries in request order and Create re-reads them in database order, so each build below also
/// sends entries out of <c>SortOrder</c>.
/// </para>
/// </summary>
public sealed class HunterEvaluationSeedTests
{
    private static readonly Lazy<IReadOnlyList<PlaybookDetailResponse>> Seed = new(() =>
        PlaybookSeed.Deserialize(File.ReadAllText(Path.Combine(ApiProjectRoot(), PlaybookSeed.RelativePath))));

    [Fact]
    public async Task The_Chosen_with_two_short_Fate_categories_reads_the_same_from_Evaluate_and_Create()
    {
        var chosen = Playbook("The Chosen");
        var fate = chosen.BespokeSections.Single(s => s.Title == "Fate");
        var heroic = fate.Options.Single(o => o.Title == "Heroic");
        var doom = fate.Options.Single(o => o.Title == "Doom");

        // Doom's pick goes first on purpose: the sheet prints Heroic first, and that must win.
        var request = Request(chosen.Id) with
        {
            BespokeSelections =
            [
                new HunterBespokeSelectionModel(fate.Id, doom.Children.First().Id, null, null, null),
                new HunterBespokeSelectionModel(fate.Id, heroic.Children.First().Id, null, null, null),
            ],
        };

        var evaluated = await EvaluateThenCreateAsync(chosen, request);

        Assert.Equal(
            [
                new HunterOutstandingItem("rules", fate.Id, null, "Fate: 2 of 3 picked."),
                new HunterOutstandingItem("rules", fate.Id, null, "Fate: Heroic — 1 of 2 picked."),
                new HunterOutstandingItem("rules", fate.Id, null, "Fate: Doom — 1 of 2 picked."),
            ],
            evaluated.Outstanding.Where(i => i.SectionId == fate.Id));
    }

    [Fact]
    public async Task The_Searcher_with_answers_under_two_move_sections_reads_the_same_from_Evaluate_and_Create()
    {
        var searcher = Playbook("The Searcher");
        var firstEncounter = MoveSection(searcher, "First Encounter");
        var guardian = MoveSection(searcher, "Guardian");
        var network = MoveSection(searcher, "Network");

        // First Encounter (the Required move's section) is answered, and so is Network with two
        // members sent out of SortOrder. Guardian is taken and left unanswered.
        var request = Request(searcher.Id) with
        {
            PlaybookMoveIds = [MoveId(searcher, "Guardian"), MoveId(searcher, "Network")],
            BespokeSelections = [new HunterBespokeSelectionModel(firstEncounter.Id, firstEncounter.Options.First().Id, null, null, null)],
            BespokeInstances =
            [
                new HunterBespokeInstanceModel(null, network.Id, "Dr. Okafor", 1, [new HunterBespokeSelectionModel(network.Id, null, null, "Cryptozoologist", null)]),
                new HunterBespokeInstanceModel(null, network.Id, "Marge", 0, [new HunterBespokeSelectionModel(network.Id, null, null, "Runs the diner", null)]),
            ],
        };

        var evaluated = await EvaluateThenCreateAsync(searcher, request);

        Assert.Equal(
            [new HunterOutstandingItem("moves", guardian.Id, null, "Guardian: 0 of 1 picked.")],
            evaluated.Outstanding.Where(i => i.SectionId is not null && i.Area == "moves"));
    }

    [Fact]
    public async Task The_Searchers_move_sections_tied_at_SortOrder_0_come_out_in_move_order()
    {
        var searcher = Playbook("The Searcher");

        var evaluated = await EvaluateThenCreateAsync(
            searcher, Request(searcher.Id) with { PlaybookMoveIds = [MoveId(searcher, "Guardian")] });

        Assert.Equal(
            [
                new HunterOutstandingItem("moves", null, null, "Moves: 1 of 2 picked."),
                new HunterOutstandingItem("moves", MoveSection(searcher, "First Encounter").Id, null, "First Encounter: 0 of 1 picked."),
                new HunterOutstandingItem("moves", MoveSection(searcher, "Guardian").Id, null, "Guardian: 0 of 1 picked."),
            ],
            evaluated.Outstanding.Where(i => i.Area == "moves"));
    }

    [Fact]
    public async Task The_Spell_Slinger_with_short_entries_and_a_short_required_section_reads_the_same_from_Evaluate_and_Create()
    {
        var slinger = Playbook("The Spell-Slinger");
        var tools = MoveSection(slinger, "Tools and Techniques");
        var reputation = MoveSection(slinger, "Arcane Reputation");

        // Both move sections have answers and both are still short, and they tie at SortOrder 0.
        var request = Request(slinger.Id) with
        {
            PlaybookMoveIds = [MoveId(slinger, "Arcane Reputation")],
            BespokeSelections = [new HunterBespokeSelectionModel(tools.Id, tools.Options.First(o => o.Children.Count == 0).Id, null, null, null)],
            BespokeInstances =
            [
                new HunterBespokeInstanceModel(null, reputation.Id, "The Lodge", 1, [new HunterBespokeSelectionModel(reputation.Id, null, null, "Feared", null)]),
                new HunterBespokeInstanceModel(null, reputation.Id, "The Coven", 0, [new HunterBespokeSelectionModel(reputation.Id, null, null, "Owed a favour", null)]),
            ],
        };

        var evaluated = await EvaluateThenCreateAsync(slinger, request);

        Assert.Equal(
            [
                new HunterOutstandingItem("moves", null, null, "Moves: 1 of 3 picked."),
                new HunterOutstandingItem("moves", tools.Id, null, "Tools and Techniques: 1 of 3 picked."),
                new HunterOutstandingItem("moves", reputation.Id, null, "Arcane Reputation: 2 of 3 added."),
            ],
            evaluated.Outstanding.Where(i => i.Area == "moves"));
    }

    /// <summary>
    /// The shared assertions: Evaluate writes nothing, a second Evaluate gives the identical list,
    /// and Create's response then lists exactly the same messages in the same order.
    /// </summary>
    private static async Task<HunterEvaluationResponse> EvaluateThenCreateAsync(PlaybookDetailResponse playbook, UpsertHunterRequest request)
    {
        await using var harness = await Harness.StartAsync(playbook);

        var evaluated = await harness.Service.EvaluateAsync(request, default);
        Assert.True(evaluated.Refusal is null, evaluated.Refusal);
        Assert.NotEmpty(evaluated.Outstanding);

        await using (var verify = harness.NewContext())
        {
            Assert.Equal(0, await verify.Hunters.CountAsync());
            Assert.Equal(0, await verify.HunterBespokeSelections.CountAsync());
            Assert.Equal(0, await verify.HunterBespokeSectionInstances.CountAsync());
        }

        var again = await harness.Service.EvaluateAsync(request, default);
        Assert.Equal(evaluated.Outstanding, again.Outstanding);

        var created = await harness.Service.CreateAsync(request, default);
        Assert.True(created.IsSuccess, created.Error?.Message);
        Assert.Equal(evaluated.Outstanding.Select(i => i.Message), created.Value!.Outstanding);

        return evaluated;
    }

    private static PlaybookDetailResponse Playbook(string name) => Seed.Value.Single(p => p.Name == name);

    private static Guid MoveId(PlaybookDetailResponse playbook, string moveName) => playbook.Moves.Single(m => m.Name == moveName).Id;

    private static BespokeSectionResponse MoveSection(PlaybookDetailResponse playbook, string moveName) =>
        playbook.Moves.Single(m => m.Name == moveName).BespokeSections.Single();

    private static UpsertHunterRequest Request(Guid playbookId) => new(
        "Seed Hunter", null, playbookId, null, 0, 0, 0, null, [], [], [], [], [], [], []);

    /// <summary>Walks up from the test binary to the API project directory.</summary>
    private static string ApiProjectRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "MonsterOfTheWeek.slnx")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        return Path.Combine(directory!.FullName, "src", "api", "MonsterOfTheWeek.Api");
    }

    /// <summary>One in-memory SQLite database per case, holding only the playbook under test.</summary>
    private sealed class Harness : IAsyncDisposable
    {
        private SqliteConnection connection = null!;
        private DbContextOptions<MotwDbContext> options = null!;

        public HunterService Service { get; private set; } = null!;

        public static async Task<Harness> StartAsync(PlaybookDetailResponse playbook)
        {
            var harness = new Harness();
            harness.connection = new SqliteConnection("DataSource=:memory:");
            await harness.connection.OpenAsync();
            harness.options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(harness.connection).Options;

            await using var setup = new MotwDbContext(harness.options);
            await setup.Database.EnsureCreatedAsync();
            setup.Playbooks.Add(PlaybookSeed.ToEntity(playbook));
            await setup.SaveChangesAsync();

            harness.Service = new HunterService(new HunterRepository(harness.NewContext()));
            return harness;
        }

        public MotwDbContext NewContext() => new(options);

        public async ValueTask DisposeAsync() => await connection.DisposeAsync();
    }
}
