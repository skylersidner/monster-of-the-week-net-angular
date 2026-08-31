using System.Collections;
using System.Reflection;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Seed;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Data;

/// <summary>
/// Guards the playbook seed pipeline against silent drift.
///
/// <para>
/// The failure this suite exists to prevent is specific and quiet: someone adds a field to
/// the playbook schema, forgets <see cref="PlaybookSeed.ToEntity"/>, and every future export
/// still writes the field while every future seed drops it. Nothing throws; a deployed
/// environment just comes up with subtly incomplete playbooks. Two tests close that gap
/// together, and neither works alone:
/// </para>
/// <list type="number">
/// <item><b>Round-trip</b> proves every field <em>in the fixture</em> survives seed → database → read.</item>
/// <item><b>Coverage</b> proves the fixture actually populates every field the contract has,
/// so a newly-added property cannot pass the round-trip by simply not being exercised.</item>
/// </list>
/// </summary>
public sealed class PlaybookSeedTests
{
    // ---------------------------------------------------------------------------------
    // 1. The round trip: seed JSON -> entity graph -> database -> real read path -> JSON.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task Seed_round_trips_through_the_real_read_path()
    {
        var original = FullyPopulatedPlaybook();

        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;

        await using var write = new MotwDbContext(options);
        await write.Database.EnsureCreatedAsync();
        write.Playbooks.Add(PlaybookSeed.ToEntity(original));
        await write.SaveChangesAsync();

        // Read back through the same repository and service a real GET uses, so this covers
        // ToEntity and the service's own projection together rather than either in isolation.
        await using var read = new MotwDbContext(options);
        var roundTripped = await new PlaybookService(new PlaybookRepository(read))
            .GetByIdAsync(original.Id, CancellationToken.None);

        Assert.NotNull(roundTripped);
        Assert.Equal(PlaybookSeed.Serialize([original]), PlaybookSeed.Serialize([roundTripped!]));
    }

    [Fact]
    public void Seed_file_survives_a_serialize_deserialize_cycle()
    {
        var original = FullyPopulatedPlaybook();
        var json = PlaybookSeed.Serialize([original]);

        Assert.Equal(json, PlaybookSeed.Serialize(PlaybookSeed.Deserialize(json)));
    }

    // ---------------------------------------------------------------------------------
    // 2. Coverage: the fixture must exercise every property the contract exposes.
    //
    // This is the test that actually fires when the schema grows. Adding a property to any
    // response record without giving the fixture a non-default value for it fails here,
    // naming the exact property — which then forces the round-trip above to cover it too.
    // ---------------------------------------------------------------------------------

    [Fact]
    public void Fixture_populates_every_field_of_the_playbook_contract()
    {
        var seen = new HashSet<string>();
        var populated = new HashSet<string>();
        Inspect(FullyPopulatedPlaybook(), seen, populated, depth: 0);

        var uncovered = seen.Except(populated).OrderBy(x => x, StringComparer.Ordinal).ToList();

        Assert.True(
            uncovered.Count == 0,
            "The seed fixture never gives these contract properties a non-default value, so the "
            + "round-trip test cannot prove they survive seeding. Give each one a distinctive "
            + "value in FullyPopulatedPlaybook(), and make sure PlaybookSeed.ToEntity copies "
            + "it:\n  " + string.Join("\n  ", uncovered));
    }

    /// <summary>
    /// Walks a contract instance recording, per <c>Type.Property</c>, whether any instance
    /// anywhere in the graph gave it a non-default value.
    ///
    /// <para>
    /// Coverage is tracked by type rather than by path deliberately. A recursive shape like
    /// <c>BespokeOptionResponse.Children</c> is necessarily empty at the deepest leaf, and a
    /// path-based walk would report that empty list as a gap forever. What actually matters
    /// is that <em>some</em> instance exercises the property, which is what proves the
    /// round-trip covers it.
    /// </para>
    /// </summary>
    private static void Inspect(object? value, HashSet<string> seen, HashSet<string> populated, int depth)
    {
        // Deep enough for the corpus's deepest real structure (Section -> category -> Line ->
        // tag) with room to spare; a guard against runaway recursion, not a real limit.
        if (value is null || depth > 12)
        {
            return;
        }

        var owner = value.GetType();
        foreach (var property in owner.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            var child = property.GetValue(value);
            var key = $"{owner.Name}.{property.Name}";
            seen.Add(key);

            switch (child)
            {
                case string text:
                    if (!string.IsNullOrWhiteSpace(text)) populated.Add(key);
                    break;

                case IEnumerable items:
                    var elements = items.Cast<object?>().ToList();
                    if (elements.Count > 0)
                    {
                        populated.Add(key);
                        // One element is enough: siblings share a type, so a single fully
                        // populated entry covers the shape. Inspecting all of them would
                        // wrongly demand that every entry populate every field, which real
                        // data never does — a title-only tag sits beside a titled option.
                        Inspect(elements[0], seen, populated, depth + 1);
                    }
                    break;

                case null:
                    break;

                default:
                    var type = child.GetType();
                    if (type.IsPrimitive || type == typeof(Guid) || type.IsEnum)
                    {
                        // Guid.Empty / 0 / false all read as "nobody set this".
                        if (!child.Equals(Activator.CreateInstance(type))) populated.Add(key);
                    }
                    else
                    {
                        populated.Add(key);
                        Inspect(child, seen, populated, depth + 1);
                    }
                    break;
            }
        }
    }

    // ---------------------------------------------------------------------------------
    // 3. The committed seed file itself.
    // ---------------------------------------------------------------------------------

    [Fact]
    public void Committed_seed_file_is_present_and_coherent()
    {
        var path = Path.Combine(ApiProjectRoot(), PlaybookSeed.RelativePath);
        Assert.True(File.Exists(path), $"Playbook seed file missing at {path}. Regenerate it with: dotnet run --project src/api/MonsterOfTheWeek.Api -- {PlaybookSeedExporter.CommandName}");

        var playbooks = PlaybookSeed.Deserialize(File.ReadAllText(path));

        Assert.Equal(28, playbooks.Count);
        Assert.Equal(playbooks.Count, playbooks.Select(p => p.Id).Distinct().Count());
        Assert.Equal(playbooks.Count, playbooks.Select(p => p.Name).Distinct().Count());
        Assert.All(playbooks, p => Assert.False(string.IsNullOrWhiteSpace(p.Name)));

        // Ordered by name, which is what keeps a re-export from churning the whole file.
        Assert.Equal(playbooks.Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal), playbooks.Select(p => p.Name));
    }

    [Fact]
    public async Task Committed_seed_file_loads_into_a_database()
    {
        var playbooks = PlaybookSeed.Deserialize(
            File.ReadAllText(Path.Combine(ApiProjectRoot(), PlaybookSeed.RelativePath)));

        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;

        await using var write = new MotwDbContext(options);
        await write.Database.EnsureCreatedAsync();
        write.Playbooks.AddRange(playbooks.Select(PlaybookSeed.ToEntity));
        await write.SaveChangesAsync();

        // Re-reading through the service and re-serialising must reproduce the file exactly.
        // This is the strongest statement available: it proves the committed data is not just
        // loadable but fully recoverable, so a re-export would be a no-op diff.
        await using var read = new MotwDbContext(options);
        var service = new PlaybookService(new PlaybookRepository(read));

        var reread = new List<PlaybookDetailResponse>();
        foreach (var playbook in playbooks)
        {
            reread.Add((await service.GetByIdAsync(playbook.Id, CancellationToken.None))!);
        }

        Assert.Equal(PlaybookSeed.Serialize(playbooks), PlaybookSeed.Serialize(reread));
    }

    // ---------------------------------------------------------------------------------
    // 4. The seeding step's own behaviour: populate an empty database, never touch a
    //    populated one.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task Apply_seeds_an_empty_database_and_then_leaves_it_alone()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var seeded = await PlaybookSeed.ApplyAsync(context, ApiProjectRoot(), CancellationToken.None);
        Assert.Equal(28, seeded);
        Assert.Equal(28, await context.Playbooks.CountAsync());

        // The guard is what protects an environment whose playbooks have been edited, or that
        // has Hunter rows pointing at specific children. A second run must be a no-op, not a
        // merge and not a duplicate insert.
        var seededAgain = await PlaybookSeed.ApplyAsync(context, ApiProjectRoot(), CancellationToken.None);
        Assert.Equal(0, seededAgain);
        Assert.Equal(28, await context.Playbooks.CountAsync());
    }

    [Fact]
    public async Task Apply_is_a_no_op_when_no_seed_file_is_present()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

        // A missing file means "nothing to seed", not a startup failure — a developer working
        // against a branch without the seed committed should still get a running app.
        var seeded = await PlaybookSeed.ApplyAsync(
            context, Path.Combine(Path.GetTempPath(), "motw-no-seed-here"), CancellationToken.None);

        Assert.Equal(0, seeded);
        Assert.Equal(0, await context.Playbooks.CountAsync());
    }

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

    // ---------------------------------------------------------------------------------
    // The fixture. Every value is deliberately distinct and non-default — see the coverage
    // test above for why that matters.
    // ---------------------------------------------------------------------------------

    private static PlaybookDetailResponse FullyPopulatedPlaybook()
    {
        var moveId = Guid.Parse("22222222-2222-4222-8222-222222222222");

        return new PlaybookDetailResponse(
            Id: Guid.Parse("11111111-1111-4111-8111-111111111111"),
            Name: "The Fixture",
            Description: "A playbook that exists only to exercise every field.",
            LuckBoxCount: 7,
            LuckSpecialText: "When you spend Luck, this test notices.",
            HarmUnstableThreshold: 4,
            HarmBoxCount: 7,
            ExperienceBoxCount: 5,
            MoveGrantCount: 3,
            GettingStartedText: "Getting started text.",
            IntroductionsText: "Introductions text.",
            LevelingUpText: "Leveling up text.",
            HistoryPromptsText: "History prompts text.",
            StatArrayOptions:
            [
                new PlaybookStatArrayOptionResponse(
                    Guid.Parse("33333333-3333-4333-8333-333333333333"),
                    Charm: 2, Cool: -1, Sharp: 1, Tough: 3, Weird: -2, SortOrder: 1),
            ],
            Moves:
            [
                new PlaybookMoveResponse(
                    moveId,
                    Name: "Fixture Move",
                    DescriptionText: "Carries <b>markup</b> and a <i>trigger</i>.",
                    Required: true,
                    IsAdvanced: true,
                    SortOrder: 1,
                    // A move-internal section, which is what proves PlaybookMoveId survives.
                    BespokeSections:
                    [
                        Section(
                            Guid.Parse("44444444-4444-4444-8444-444444444444"),
                            "Move-internal Section",
                            Guid.Parse("55555555-5555-4555-8555-555555555555"),
                            Guid.Parse("66666666-6666-4666-8666-666666666666")),
                    ]),
            ],
            GearCategories:
            [
                new PlaybookGearCategoryResponse(
                    Guid.Parse("77777777-7777-4777-8777-777777777777"),
                    Label: "Fixture gear (pick one)",
                    PickCount: 1,
                    IsOptional: true,
                    SortOrder: 1,
                    Options:
                    [
                        new PlaybookGearOptionResponse(
                            Guid.Parse("88888888-8888-4888-8888-888888888888"),
                            Name: "Fixture weapon",
                            MechanicalText: "2-harm close loud",
                            SortOrder: 1),
                    ]),
            ],
            LookCategories:
            [
                new PlaybookLookCategoryResponse(
                    Guid.Parse("99999999-9999-4999-8999-999999999999"),
                    AllowsFreeform: true,
                    GroupLabel: "Fixture look",
                    SortOrder: 1,
                    Options:
                    [
                        new PlaybookLookOptionResponse(
                            Guid.Parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
                            Text: "Fixture eyes",
                            SortOrder: 1),
                    ]),
            ],
            Improvements:
            [
                new PlaybookImprovementResponse(
                    Guid.Parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
                    Text: "Get +1 Fixture, max +3",
                    IsAdvanced: true,
                    SortOrder: 1),
            ],
            BespokeSections:
            [
                Section(
                    Guid.Parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
                    "Playbook-level Section",
                    Guid.Parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
                    Guid.Parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")),
            ],
            BespokeJournals:
            [
                new BespokeJournalResponse(
                    Guid.Parse("ffffffff-ffff-4fff-8fff-ffffffffffff"),
                    Title: "Fixture Journal",
                    Description: "Journal description.",
                    EffectText: "Journal effect text.",
                    SortOrder: 1,
                    Fields:
                    [
                        new BespokeJournalFieldResponse(
                            Guid.Parse("10101010-1010-4010-8010-101010101010"),
                            Label: "Power",
                            SortOrder: 1),
                    ]),
            ],
            ExtraTracks:
            [
                new PlaybookExtraTrackResponse(
                    Guid.Parse("20202020-2020-4020-8020-202020202020"),
                    Name: "Fixture Track",
                    Description: "Track description.",
                    EffectText: "Track effect text.",
                    BoxCount: 7,
                    StartLabel: "Start",
                    EndLabel: "End",
                    SortOrder: 1),
            ]);
    }

    /// <summary>
    /// A section with a nested option tree, so the recursive flatten/rebuild in
    /// <see cref="PlaybookSeed.ToEntity"/> is exercised rather than just the flat case.
    /// </summary>
    private static BespokeSectionResponse Section(Guid sectionId, string title, Guid parentOptionId, Guid childOptionId) =>
        new(
            sectionId,
            Title: title,
            Description: "Section description.",
            EffectText: "Section effect text.",
            FreeTextLabel: "Section free-text label",
            MinSelect: 1,
            MaxSelect: 2,
            MinInstances: 1,
            MaxInstances: 3,
            SortOrder: 1,
            Options:
            [
                new BespokeOptionResponse(
                    parentOptionId,
                    Title: "Parent option",
                    DescriptionText: "Parent description.",
                    MinSelect: 1,
                    MaxSelect: 2,
                    NumericMin: 1,
                    NumericMax: 3,
                    SortOrder: 1,
                    Children:
                    [
                        new BespokeOptionResponse(
                            childOptionId,
                            Title: "Child option",
                            DescriptionText: "Child description.",
                            MinSelect: 1,
                            MaxSelect: 2,
                            NumericMin: 1,
                            NumericMax: 3,
                            SortOrder: 1,
                            Children: []),
                    ]),
            ]);
}
