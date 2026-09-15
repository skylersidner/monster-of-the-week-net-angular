using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Seed;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// Pins the move pick budget, <c>MoveGrantCount − (Required moves)</c>, against the committed
/// seed for every playbook that has Required moves (hunter-creation-wizard.md 12.3, Q1).
///
/// <para>
/// This is the test that stops the bug coming back. <c>HunterServiceTests</c>' hand-built fixture
/// stayed green for as long as it encoded the wrong reading of <c>MoveGrantCount</c>. The real
/// playbooks, whose printed totals were checked against the PDF, can't be quietly re-read. The
/// other 14 playbooks have no Required moves, so both readings give the same number and they
/// are left out.
/// </para>
/// </summary>
public sealed class HunterMoveBudgetSeedTests
{
    /// <summary>
    /// 12.3's table: the printed total and the Required count, audited against the PDF on
    /// 2026-09-13. The <see cref="The_table_names_every_seed_playbook_with_required_moves"/> fact
    /// keeps it in step with the seed.
    /// </summary>
    private static readonly (string Name, int Grant, int Required)[] Table =
    [
        ("The Celebrity", 3, 1),
        ("The Changeling", 3, 1),
        ("The Chosen", 3, 2),
        ("The Curse-Eater", 4, 2),
        ("The Forged", 2, 1),
        ("The Gumshoe", 3, 2),
        ("The Hex", 3, 1),
        ("The Host", 3, 1),
        ("The Initiate", 4, 1),
        ("The Pararomantic", 3, 1),
        ("The Professional", 4, 1),
        ("The Searcher", 3, 1),
        ("The Spell-Slinger", 4, 1),
        ("The Wronged", 3, 1),
    ];

    public static IEnumerable<object[]> PlaybooksWithRequiredMoves =>
        Table.Select(row => new object[] { row.Name, row.Grant, row.Required });

    private static readonly Lazy<IReadOnlyList<PlaybookDetailResponse>> Seed = new(() =>
        PlaybookSeed.Deserialize(File.ReadAllText(Path.Combine(ApiProjectRoot(), PlaybookSeed.RelativePath))));

    [Fact]
    public void The_table_names_every_seed_playbook_with_required_moves()
    {
        var expected = Table.Select(row => row.Name).Order(StringComparer.Ordinal);
        var actual = Seed.Value.Where(p => p.Moves.Any(m => m.Required)).Select(p => p.Name).Order(StringComparer.Ordinal);

        Assert.Equal(expected, actual);
    }

    [Theory]
    [MemberData(nameof(PlaybooksWithRequiredMoves))]
    public async Task Exactly_the_pick_budget_is_finished_and_one_more_pick_is_refused(string name, int grant, int required)
    {
        var playbook = Seed.Value.Single(p => p.Name == name);
        var requiredIds = playbook.Moves.Where(m => m.Required).Select(m => m.Id).ToList();

        // The seed still says what the page prints: the total, with the Required moves inside it.
        Assert.Equal(grant, playbook.MoveGrantCount);
        Assert.Equal(required, requiredIds.Count);

        var budget = grant - required;
        var pool = playbook.Moves
            .Where(m => !m.Required && !m.IsAdvanced)
            .OrderBy(m => m.SortOrder)
            .Select(m => m.Id)
            .ToList();
        Assert.True(pool.Count > budget, $"{name} lists {pool.Count} pickable moves, too few to over-pick a budget of {budget}.");

        await using var harness = await Harness.StartAsync(playbook);

        // Exactly the printed total: every Required move plus the budget's worth of picks.
        var atBudget = await harness.Service.CreateAsync(Request(playbook.Id, [.. requiredIds, .. pool.Take(budget)]), default);
        Assert.True(atBudget.IsSuccess, atBudget.Error?.Message);
        Assert.Equal(grant, atBudget.Value!.PlaybookMoveIds.Count);
        Assert.DoesNotContain(atBudget.Value.Outstanding, line => line.StartsWith("Moves:", StringComparison.Ordinal));

        // One short is reported against the budget, not against the total.
        var oneShort = await harness.Service.CreateAsync(Request(playbook.Id, [.. pool.Take(budget - 1)]), default);
        Assert.True(oneShort.IsSuccess, oneShort.Error?.Message);
        Assert.Contains($"Moves: {budget - 1} of {budget} picked.", oneShort.Value!.Outstanding);

        // One pick past the budget is refused, even though it's still within MoveGrantCount.
        var overBudget = await harness.Service.CreateAsync(Request(playbook.Id, [.. pool.Take(budget + 1)]), default);
        Assert.False(overBudget.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, overBudget.Error!.Type);
        Assert.Contains($"allows {budget} move {(budget == 1 ? "pick" : "picks")}", overBudget.Error.Message);
    }

    private static UpsertHunterRequest Request(Guid playbookId, IReadOnlyList<Guid> moveIds) => new(
        "Budget Hunter", null, playbookId, null, 0, 0, 0, null, moveIds, [], [], [], [], [], []);

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

            harness.Service = new HunterService(new HunterRepository(new MotwDbContext(harness.options)));
            return harness;
        }

        public async ValueTask DisposeAsync() => await connection.DisposeAsync();
    }
}
