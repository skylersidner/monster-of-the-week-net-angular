using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// Unit coverage for <see cref="PlaybookService"/> against a hand-written fake repository,
/// matching the <c>MonsterServiceTests</c>/<c>MysteryServiceTests</c> convention in this folder
/// (this project has no mocking library — the fakes are the convention).
///
/// <para>
/// Scope is the service's own decisions: graph validation, name uniqueness, and the two
/// hunter-usage guards. What the *database* ends up holding after a save is
/// <c>PlaybookIntegrationTests</c>'s job — a fake repository can only report that the service
/// asked for something, never that it happened.
/// </para>
/// </summary>
public sealed class PlaybookServiceTests
{
    // ---------------------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenThePlaybookDoesNotExist()
    {
        var service = new PlaybookService(new FakePlaybookRepository { Detail = null });

        Assert.Null(await service.GetByIdAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task GetByIdAsync_MapsTheWholeGraph_IncludingAMovesOwnBespokeSection()
    {
        var playbookId = Guid.NewGuid();
        var moveId = Guid.NewGuid();
        var playbook = new Playbook
        {
            Id = playbookId,
            Name = "The Test Subject",
            Moves = [new PlaybookMove { Id = moveId, Name = "Artifact", SortOrder = 0 }],
            BespokeSections =
            [
                new BespokeSection { Id = Guid.NewGuid(), PlaybookId = playbookId, Title = "Top level", SortOrder = 0 },
                new BespokeSection { Id = Guid.NewGuid(), PlaybookId = playbookId, PlaybookMoveId = moveId, Title = "Inside the move", SortOrder = 0 },
            ],
        };

        var result = await new PlaybookService(new FakePlaybookRepository { Detail = playbook })
            .GetByIdAsync(playbookId, CancellationToken.None);

        Assert.NotNull(result);
        // The move's own section must appear under the move and NOT in the playbook-level list.
        // That separation is what makes architecture.md 6.8's "filter PlaybookMoveId IS NULL"
        // reading rule structural rather than a convention a client has to remember.
        Assert.Equal("Top level", Assert.Single(result!.BespokeSections).Title);
        Assert.Equal("Inside the move", Assert.Single(Assert.Single(result.Moves).BespokeSections).Title);
    }

    // ---------------------------------------------------------------------------------
    // Create — validation
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenTheNameIsAlreadyTaken()
    {
        var service = new PlaybookService(new FakePlaybookRepository { NameExists = true });

        var result = await service.CreateAsync(Request("The Chosen"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);
        Assert.Contains("The Chosen", result.Error.Message);
    }

    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenHarmThresholdExceedsHarmBoxes()
    {
        var service = new PlaybookService(new FakePlaybookRepository());

        var result = await service.CreateAsync(
            Request() with { HarmUnstableThreshold = 9, HarmBoxCount = 7 },
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("cannot exceed the harm box count", result.Error!.Message);
    }

    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenAGearCategoryPicksMoreThanItLists()
    {
        var service = new PlaybookService(new FakePlaybookRepository());

        var result = await service.CreateAsync(
            Request() with
            {
                GearCategories =
                [
                    new UpsertPlaybookGearCategoryRequest(null, "Weapons", 3, false, 0,
                        [new UpsertPlaybookGearOptionRequest(null, "Shotgun", null, 0)]),
                ],
            },
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("picks 3 option(s) but only lists 1", result.Error!.Message);
    }

    [Theory]
    // 0/0 is the trap the model is built to avoid: it reads as "a real but empty option set",
    // which is not a state architecture.md 6.1 allows — both null is how you say "nothing to pick".
    [InlineData(0, 0, 0, "leave both null")]
    [InlineData(3, 1, 3, "greater than MaxSelect")]
    [InlineData(1, 5, 2, "only lists 2")]
    public async Task CreateAsync_ReturnsValidation_ForAMalformedBespokeSection(
        int? minSelect, int? maxSelect, int optionCount, string expected)
    {
        var service = new PlaybookService(new FakePlaybookRepository());

        var result = await service.CreateAsync(
            Request() with { BespokeSections = [Section("Fate", minSelect, maxSelect, optionCount)] },
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains(expected, result.Error!.Message);
    }

    [Fact]
    public async Task CreateAndUpdate_ReturnValidation_WhenMoreMovesAreRequiredThanTheGrantCount()
    {
        var repository = new FakePlaybookRepository();
        var service = new PlaybookService(repository);

        // MoveGrantCount is the printed total, Required moves included (hunter-creation-wizard.md
        // 12.3), so two Required moves cannot fit inside a total of one. The verifier already
        // checked this for seeded data; the admin path is what this closes.
        var request = Request() with
        {
            MoveGrantCount = 1,
            Moves = [Move("Fate", required: true, 0), Move("Destiny", required: true, 1), Move("Pickable", required: false, 2)],
        };

        var created = await service.CreateAsync(request, CancellationToken.None);
        Assert.False(created.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, created.Error!.Type);
        Assert.Contains("grants 1 move(s) in total but marks 2 as required", created.Error.Message);

        var updated = await service.UpdateAsync(Guid.NewGuid(), request, CancellationToken.None);
        Assert.False(updated.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, updated.Error!.Type);

        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Theory]
    // Required moves filling the whole total is legal: nothing is left to pick, but nothing is negative.
    [InlineData(2, 2)]
    // 0 still means the Moves section has not been authored (architecture.md Section 3), so it sets no bound.
    [InlineData(0, 2)]
    public async Task CreateAsync_Saves_WhenRequiredMovesFitTheGrantCount_OrTheCountIsUnauthored(int grant, int required)
    {
        var repository = new FakePlaybookRepository();
        var service = new PlaybookService(repository);

        var result = await service.CreateAsync(
            Request() with
            {
                MoveGrantCount = grant,
                Moves = [.. Enumerable.Range(0, required).Select(i => Move($"Granted {i}", required: true, i))],
            },
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error?.Message);
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenAFreeTextSectionAlsoListsOptions()
    {
        var service = new PlaybookService(new FakePlaybookRepository());

        var result = await service.CreateAsync(
            Request() with
            {
                BespokeSections =
                [
                    new UpsertBespokeSectionRequest(null, "Gumshoe Code", null, null, "Your Code", null, null, null, null, 0,
                        [new UpsertBespokeOptionRequest(null, "An option", null, null, null, null, null, 0, [])]),
                ],
            },
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("a free-text section has none", result.Error!.Message);
    }

    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenANumericLeafHasChildren()
    {
        var service = new PlaybookService(new FakePlaybookRepository());

        var result = await service.CreateAsync(
            Request() with
            {
                BespokeSections =
                [
                    new UpsertBespokeSectionRequest(null, "Spooktacular", null, null, null, 1, 1, null, null, 0,
                    [
                        new UpsertBespokeOptionRequest(null, "Infernal Favour", null, null, null, 0, 3, 0,
                            [new UpsertBespokeOptionRequest(null, "child", null, null, null, null, null, 0, [])]),
                    ]),
                ],
            },
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("numeric leaf but has 1 child option(s)", result.Error!.Message);
    }

    [Fact]
    public async Task CreateAsync_NamesTheMove_WhenAMoveInternalSectionIsMalformed()
    {
        var service = new PlaybookService(new FakePlaybookRepository());

        var result = await service.CreateAsync(
            Request() with
            {
                Moves =
                [
                    new UpsertPlaybookMoveRequest(null, "The Naked City", null, false, false, 0,
                        [Section("Naked City", 0, 0, 0)]),
                ],
            },
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        // A Move's embedded structure gets identical rules; the prefix is what tells the author
        // *where* the malformed section is, since move sections do not appear in the top list.
        Assert.StartsWith("Move \"The Naked City\":", result.Error!.Message);
    }

    [Fact]
    public async Task CreateAsync_TrimsTheNameAndSaves_OnTheHappyPath()
    {
        var repository = new FakePlaybookRepository();
        var service = new PlaybookService(repository);

        var result = await service.CreateAsync(Request("  The Spooky  "), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error?.Message);
        Assert.Equal("The Spooky", result.Value!.Name);
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    // ---------------------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task UpdateAsync_ReturnsNotFound_WhenThePlaybookIsMissing()
    {
        var service = new PlaybookService(new FakePlaybookRepository { ForUpdate = null });

        var result = await service.UpdateAsync(Guid.NewGuid(), Request(), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.NotFound, result.Error!.Type);
    }

    [Fact]
    public async Task UpdateAsync_ChecksNameUniqueness_ExcludingThePlaybookBeingEdited()
    {
        var id = Guid.NewGuid();
        var repository = new FakePlaybookRepository { ForUpdate = new Playbook { Id = id, Name = "The Chosen" } };
        var service = new PlaybookService(repository);

        await service.UpdateAsync(id, Request("The Chosen"), CancellationToken.None);

        // Without the exclusion a playbook could never be saved under its own name.
        Assert.Equal(id, repository.NameExistsExcludingId);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsConflict_WhenTheEditWouldRemoveARowAHunterUses()
    {
        var id = Guid.NewGuid();
        var moveId = Guid.NewGuid();
        var repository = new FakePlaybookRepository
        {
            ForUpdate = new Playbook
            {
                Id = id,
                Name = "The Chosen",
                Moves = [new PlaybookMove { Id = moveId, Name = "Fate", SortOrder = 0 }],
            },
            HunterReferencedIds = [moveId],
        };
        var service = new PlaybookService(repository);

        // The move is simply absent from the request, which is how the Id-based diff expresses
        // "delete it" — the guard has to infer the removal rather than being told about it.
        var result = await service.UpdateAsync(id, Request("The Chosen") with { Moves = [] }, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Conflict, result.Error!.Type);
        Assert.Contains("move \"Fate\"", result.Error.Message);
        // Rejected before any mutation: nothing was saved.
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task UpdateAsync_Succeeds_WhenTheRemovedRowIsUnused()
    {
        var id = Guid.NewGuid();
        var repository = new FakePlaybookRepository
        {
            ForUpdate = new Playbook
            {
                Id = id,
                Name = "The Chosen",
                Moves = [new PlaybookMove { Id = Guid.NewGuid(), Name = "Fate", SortOrder = 0 }],
            },
            HunterReferencedIds = [],
        };
        var service = new PlaybookService(repository);

        var result = await service.UpdateAsync(id, Request("The Chosen") with { Moves = [] }, CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error?.Message);
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    // ---------------------------------------------------------------------------------
    // Delete — three outcomes that must stay distinguishable
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task DeleteAsync_ReturnsConflict_WhenHuntersAreBuiltFromThePlaybook()
    {
        var service = new PlaybookService(new FakePlaybookRepository { HunterCount = 2 });

        var result = await service.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Conflict, result.Error!.Type);
        Assert.Contains("2 hunters are built from this playbook", result.Error.Message);
    }

    [Fact]
    public async Task DeleteAsync_DistinguishesDeletedFromMissing()
    {
        var deleted = await new PlaybookService(new FakePlaybookRepository { DeletedRows = 1 })
            .DeleteAsync(Guid.NewGuid(), CancellationToken.None);
        Assert.True(deleted.IsSuccess);
        Assert.True(deleted.Value);

        // Success with false is "no such playbook" — the controller turns it into a 404. The
        // bool and the Conflict together are why DeleteAsync returns a result and not a bool.
        var missing = await new PlaybookService(new FakePlaybookRepository { DeletedRows = 0 })
            .DeleteAsync(Guid.NewGuid(), CancellationToken.None);
        Assert.True(missing.IsSuccess);
        Assert.False(missing.Value);
    }

    // ---------------------------------------------------------------------------------
    // Pick rules (hunter-creation-wizard.md 12.9, 14.3). Real SQLite and the committed seed from
    // here down: whether rule rows survive a refused save, and what a delete leaves behind, are
    // facts about the database that a fake repository can't show.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenTheRequestAlreadyCarriesPickRules()
    {
        var repository = new FakePlaybookRepository();

        var result = await new PlaybookService(repository).CreateAsync(
            Request() with { PickRules = [new UpsertPlaybookPickRuleRequest(null, null, 0, [])] },
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);
        Assert.Contains("already saved", result.Error.Message);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsTheInitiatesPickRule_InThePinnedWireShapeAndOrder()
    {
        await using var harness = await SeedHarness.StartAsync(PickRuleTable.Initiate);

        var detail = await harness.Service().GetByIdAsync(PickRuleTable.Initiate, CancellationToken.None);

        // hunter-creation-wizard.md 12.9's pinned shape, with Y7's order: counts by their target's
        // SortOrder (old-fashioned 1, modern 2), triggers by option SortOrder (Fighting arts 3 before
        // Obsolete gear 10; Modernised 4 before Nifty gadgets 11). ASP.NET's own web defaults.
        Assert.Equal(
            """[{"id":"c7e553b8-71fe-48ce-87ee-7ec38b129171","label":null,"sortOrder":0,"alternatives":[{"id":"d633b0d9-4b82-4101-b6d5-e201c38ee923","label":null,"sortOrder":0,"counts":[{"gearCategoryId":"4740273a-f878-4719-8c0e-2626cac2566f","bespokeOptionId":null,"minCount":2,"maxCount":2,"adjustment":{"triggerOptionIds":["ceecaf7f-c871-422b-afa1-68ce91229274","86965ce9-cbb5-479b-985a-5a7bda562de2"],"minCount":3,"maxCount":3}},{"gearCategoryId":"524d08ca-da76-4d4e-8353-2317ab30419a","bespokeOptionId":null,"minCount":1,"maxCount":1,"adjustment":{"triggerOptionIds":["ad188960-40d2-48f3-8782-3a8caded1ae2","9e5b2d72-c55b-45d0-9e91-2f89ce29e798"],"minCount":1,"maxCount":2}}]}]}]""",
            System.Text.Json.JsonSerializer.Serialize(detail!.PickRules, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)));
    }

    public static TheoryData<string> KeptRuleConflicts => new()
    {
        "Initiate: remove Old-fashioned weapons",
        "Initiate: remove Modern weapons",
        "Initiate: remove the Fighting arts trigger",
        "Initiate: lower Old-fashioned weapons to pick 2",
        "Initiate: give Fighting arts options of its own",
        "Initiate: make the Sect repeatable",
        "Monstrous: re-create Extra without its id",
        "Monstrous: lower Base to 1",
        "Monstrous: add a top-level option to Natural Attacks",
        "Spell-Slinger: re-create Effects without its id",
        "Spell-Slinger: lower Bases to 2",
    };

    [Theory]
    [MemberData(nameof(KeptRuleConflicts))]
    public async Task UpdateAsync_WithPickRulesOmitted_ReturnsConflictNamingTheRule_AndLeavesTheRuleRowsUnchanged(string edit)
    {
        var (playbookId, mutate, expectedName, expectedDetail) = KeptRuleEdits[edit];
        await using var harness = await SeedHarness.StartAsync(playbookId);
        var stored = await harness.Service().GetByIdAsync(playbookId, CancellationToken.None);
        var before = await harness.RuleRowsAsync();

        var result = await harness.Service().UpdateAsync(playbookId, mutate(ToUpsert(stored!)), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Conflict, result.Error!.Type);
        Assert.StartsWith("This edit would break a pick rule the playbook keeps.", result.Error.Message);
        Assert.Contains(expectedName, result.Error.Message);
        Assert.Contains(expectedDetail, result.Error.Message);
        Assert.Equal(before, await harness.RuleRowsAsync());
    }

    private static readonly Dictionary<string, (Guid Playbook, Func<UpsertPlaybookRequest, UpsertPlaybookRequest> Mutate, string Name, string Detail)> KeptRuleEdits = new()
    {
        ["Initiate: remove Old-fashioned weapons"] = (PickRuleTable.Initiate,
            r => r with { GearCategories = [.. r.GearCategories!.Where(c => c.Id != PickRuleTable.OldFashioned)] },
            "The pick rule on \"Old-fashioned weapons", "but the playbook would not have it after this save"),
        ["Initiate: remove Modern weapons"] = (PickRuleTable.Initiate,
            r => r with { GearCategories = [.. r.GearCategories!.Where(c => c.Id != PickRuleTable.Modern)] },
            "\"Modern weapons (pick either one or two, as above)\"", "but the playbook would not have it after this save"),
        ["Initiate: remove the Fighting arts trigger"] = (PickRuleTable.Initiate,
            r => MapOption(r, PickRuleTable.GoodTraditions, o => o with { Children = [.. o.Children!.Where(c => c.Id != PickRuleTable.FightingArts)] }),
            "The pick rule on \"Old-fashioned weapons", "uses \"Fighting arts\" as a trigger, but the playbook would not have it"),
        ["Initiate: lower Old-fashioned weapons to pick 2"] = (PickRuleTable.Initiate,
            r => r with { GearCategories = [.. r.GearCategories!.Select(c => c.Id == PickRuleTable.OldFashioned ? c with { PickCount = 2 } : c)] },
            "The pick rule on \"Old-fashioned weapons", "above that list's own limit of 2"),
        ["Initiate: give Fighting arts options of its own"] = (PickRuleTable.Initiate,
            r => MapOption(r, PickRuleTable.FightingArts, o => o with
            {
                MinSelect = 1,
                MaxSelect = 1,
                Children = [new UpsertBespokeOptionRequest(null, "Sword school", null, null, null, null, null, 0, [])],
            }),
            "The pick rule on \"Old-fashioned weapons", "has options of its own"),
        ["Initiate: make the Sect repeatable"] = (PickRuleTable.Initiate,
            r => MapSection(r, PickRuleTable.Sect, s => s with { MinInstances = 1, MaxInstances = 2 }),
            "The pick rule on \"Old-fashioned weapons", "repeatable section \"Sect\""),
        ["Monstrous: re-create Extra without its id"] = (PickRuleTable.Monstrous,
            r => MapOption(r, PickRuleTable.Extra, o => WithoutIds(o)),
            "The pick rule on \"Natural Attacks\"", "counts \"Extra\", but the playbook would not have it after this save"),
        ["Monstrous: lower Base to 1"] = (PickRuleTable.Monstrous,
            r => MapOption(r, PickRuleTable.Base, o => o with { MaxSelect = 1 }),
            "The pick rule on \"Natural Attacks\"", "above that list's own limit of 1"),
        ["Monstrous: add a top-level option to Natural Attacks"] = (PickRuleTable.Monstrous,
            r => MapSection(r, PickRuleTable.NaturalAttacks, s => s with
            {
                Options = [.. s.Options!, new UpsertBespokeOptionRequest(null, "Wings", null, null, null, null, null, 2, [])],
            }),
            "The pick rule on \"Natural Attacks\"", "doesn't count every top-level option of \"Natural Attacks\""),
        ["Spell-Slinger: re-create Effects without its id"] = (PickRuleTable.SpellSlinger,
            r => MapOption(r, PickRuleTable.Effects, o => WithoutIds(o)),
            "The pick rule on \"Combat Magic\"", "counts \"Effects\", but the playbook would not have it after this save"),
        ["Spell-Slinger: lower Bases to 2"] = (PickRuleTable.SpellSlinger,
            r => MapOption(r, PickRuleTable.Bases, o => o with { MaxSelect = 2 }),
            "The pick rule on \"Combat Magic\"", "above that list's own limit of 2"),
    };

    public static TheoryData<string> SentRuleProblems => new()
    {
        "no alternatives",
        "a count naming both kinds of target",
        "a count naming no target",
        "no targets",
        "a target twice in one alternative",
        "an alternative leaving out a target",
        "a gear target that isn't in the playbook",
        "gear and bespoke targets mixed",
        "a gear target granted outright",
        "an optional gear target",
        "a bespoke target that isn't a top-level category",
        "categories from two sections",
        "a section inside a move",
        "a repeatable section",
        "categories that don't cover the section",
        "a minimum above the maximum",
        "a negative minimum",
        "a maximum above the list's PickCount",
        "an adjusted maximum above the list's PickCount",
        "an adjustment with no triggers",
        "the same trigger twice",
        "a trigger that isn't in the playbook",
        "a trigger with options of its own",
        "a trigger inside a move",
        "a trigger in a repeatable section",
        "a trigger inside the governed section",
        "two rules on one target",
        "a target whose id the save will not keep",
    };

    [Theory]
    [MemberData(nameof(SentRuleProblems))]
    public async Task UpdateAsync_WithAProblemInTheSentPickRules_ReturnsValidation(string problem)
    {
        var (playbookId, mutate, expected) = SentRuleCases[problem];
        await using var harness = await SeedHarness.StartAsync(playbookId);
        var stored = await harness.Service().GetByIdAsync(playbookId, CancellationToken.None);
        var request = ToUpsert(stored!) with { PickRules = ToUpsertRules(stored!) };
        var before = await harness.RuleRowsAsync();

        var result = await harness.Service().UpdateAsync(playbookId, mutate(request), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.Validation, result.Error!.Type);
        Assert.Contains(expected, result.Error.Message);
        Assert.Equal(before, await harness.RuleRowsAsync());
    }

    private static readonly Guid FabricatedSection = Guid.Parse("f0000000-0000-4000-8000-000000000001");
    private static readonly Guid FabricatedDivider = Guid.Parse("f0000000-0000-4000-8000-000000000002");
    private static readonly Guid FabricatedLeaf = Guid.Parse("f0000000-0000-4000-8000-000000000003");

    private static readonly Dictionary<string, (Guid Playbook, Func<UpsertPlaybookRequest, UpsertPlaybookRequest> Mutate, string Expected)> SentRuleCases = new()
    {
        ["no alternatives"] = (PickRuleTable.Initiate,
            r => MapRule(r, rule => rule with { Alternatives = [] }), "has no alternatives"),
        ["a count naming both kinds of target"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { BespokeOptionId = PickRuleTable.FightingArts }, counts[1]]),
            "names both a gear category and a bespoke option"),
        ["a count naming no target"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { GearCategoryId = null }, counts[1]]),
            "names neither a gear category nor a bespoke option"),
        ["no targets"] = (PickRuleTable.Initiate,
            r => MapCounts(r, _ => []), "counts nothing"),
        ["a target twice in one alternative"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0], counts[1], counts[0]]), "twice in one alternative"),
        ["an alternative leaving out a target"] = (PickRuleTable.Monstrous,
            r => MapRule(r, rule => rule with
            {
                Alternatives = [rule.Alternatives![0], rule.Alternatives[1] with { Counts = [.. rule.Alternatives[1].Counts!.Where(c => c.BespokeOptionId != PickRuleTable.Extra)] }],
            }),
            "one leaves out \"Extra\""),
        ["a gear target that isn't in the playbook"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { GearCategoryId = Guid.Parse("0badbad0-0000-4000-8000-000000000000") }, counts[1]]),
            "but the playbook would not have it after this save"),
        ["gear and bespoke targets mixed"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [.. counts, new UpsertPlaybookPickRuleCountRequest(null, PickRuleTable.GoodTraditions, 2, 2, null)]),
            "counts both gear lists and bespoke categories"),
        ["a gear target granted outright"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [.. counts, new UpsertPlaybookPickRuleCountRequest(PickRuleTable.Armour, null, 0, 0, null)]),
            "granted outright"),
        ["an optional gear target"] = (PickRuleTable.Initiate,
            r => r with { GearCategories = [.. r.GearCategories!.Select(c => c.Id == PickRuleTable.Modern ? c with { IsOptional = true } : c)] },
            "which is optional"),
        ["a bespoke target that isn't a top-level category"] = (PickRuleTable.Monstrous,
            r => MapAllCounts(r, c => c.BespokeOptionId == PickRuleTable.Base ? c with { BespokeOptionId = FirstChild(r, PickRuleTable.Base) } : c),
            "which is not a top-level category"),
        ["categories from two sections"] = (PickRuleTable.Monstrous,
            r => MapAllCounts(
                r with { BespokeSections = [.. r.BespokeSections!, FabricatedSectionRequest()] },
                c => c,
                extra: new UpsertPlaybookPickRuleCountRequest(null, FabricatedDivider, 0, 1, null)),
            "counts categories from more than one section"),
        ["a section inside a move"] = (PickRuleTable.SpellSlinger,
            r => (r with
            {
                Moves = [r.Moves![0] with { BespokeSections = [.. r.Moves[0].BespokeSections!, FabricatedSectionRequest()] }, .. r.Moves.Skip(1)],
            }) with
            {
                PickRules =
                [
                    .. r.PickRules!,
                    new UpsertPlaybookPickRuleRequest(null, null, 1,
                        [new UpsertPlaybookPickRuleAlternativeRequest(null, null, 0, [new UpsertPlaybookPickRuleCountRequest(null, FabricatedDivider, 0, 1, null)])]),
                ],
            },
            "which belongs to a move"),
        ["a repeatable section"] = (PickRuleTable.Monstrous,
            r => MapSection(r, PickRuleTable.NaturalAttacks, s => s with { MinInstances = 1, MaxInstances = 1 }),
            "which is repeatable"),
        ["categories that don't cover the section"] = (PickRuleTable.Monstrous,
            r => MapRule(r, rule => rule with
            {
                Alternatives = [.. rule.Alternatives!.Select(a => a with { Counts = [.. a.Counts!.Where(c => c.BespokeOptionId != PickRuleTable.Extra)] })],
            }),
            "doesn't count every top-level option of \"Natural Attacks\""),
        ["a minimum above the maximum"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { MinCount = 3, MaxCount = 2 }, counts[1]]), "a range starts at 0"),
        ["a negative minimum"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { MinCount = -1 }, counts[1]]), "a range starts at 0"),
        ["a maximum above the list's PickCount"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { MaxCount = 4 }, counts[1]]), "in its range, above that list's own limit of 3"),
        ["an adjusted maximum above the list's PickCount"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { Adjustment = counts[0].Adjustment! with { MaxCount = 4 } }, counts[1]]),
            "in its adjusted range, above that list's own limit of 3"),
        ["an adjustment with no triggers"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { Adjustment = counts[0].Adjustment! with { TriggerOptionIds = [] } }, counts[1]]),
            "an adjusted range with no trigger options"),
        ["the same trigger twice"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { Adjustment = counts[0].Adjustment! with { TriggerOptionIds = [PickRuleTable.FightingArts, PickRuleTable.FightingArts] } }, counts[1]]),
            "names the same trigger twice"),
        ["a trigger that isn't in the playbook"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { Adjustment = counts[0].Adjustment! with { TriggerOptionIds = [Guid.Parse("0badbad0-0000-4000-8000-000000000001")] } }, counts[1]]),
            "as a trigger, but the playbook would not have it after this save"),
        ["a trigger with options of its own"] = (PickRuleTable.Initiate,
            r => MapCounts(r, counts => [counts[0] with { Adjustment = counts[0].Adjustment! with { TriggerOptionIds = [PickRuleTable.GoodTraditions] } }, counts[1]]),
            "has options of its own"),
        ["a trigger inside a move"] = (PickRuleTable.Initiate,
            r => MapCounts(
                r with
                {
                    Moves = [r.Moves![0] with { BespokeSections = [.. r.Moves[0].BespokeSections!, FabricatedSectionRequest()] }, .. r.Moves.Skip(1)],
                },
                counts => [counts[0] with { Adjustment = counts[0].Adjustment! with { TriggerOptionIds = [FabricatedLeaf] } }, counts[1]]),
            "it sits in a move's section"),
        ["a trigger in a repeatable section"] = (PickRuleTable.Initiate,
            r => MapSection(r, PickRuleTable.Sect, s => s with { MinInstances = 1, MaxInstances = 2 }),
            "repeatable section \"Sect\""),
        ["a trigger inside the governed section"] = (PickRuleTable.Monstrous,
            r => MapAllCounts(r, c => c.BespokeOptionId == PickRuleTable.Extra
                ? c with { Adjustment = new UpsertPlaybookPickRuleAdjustmentRequest([FirstChild(r, PickRuleTable.Base)], c.MinCount, c.MaxCount) }
                : c),
            "the section it governs"),
        ["two rules on one target"] = (PickRuleTable.Initiate,
            r => r with { PickRules = [.. r.PickRules!, WithoutIds(r.PickRules![0])] },
            "is counted by more than one pick rule"),
        // The request sends Extra under a fresh id, so the Id-based diff inserts it as a new row;
        // ValidateGraph can't tell, but the pass after the load can, and a sent rule is still a 400.
        ["a target whose id the save will not keep"] = (PickRuleTable.Monstrous,
            r =>
            {
                var freshExtra = Guid.Parse("0badbad0-0000-4000-8000-000000000002");
                var moved = MapOption(r, PickRuleTable.Extra, o => o with { Id = freshExtra });
                return MapAllCounts(moved, c => c.BespokeOptionId == PickRuleTable.Extra ? c with { BespokeOptionId = freshExtra } : c);
            },
            "but the playbook would not have it after this save"),
    };

    [Theory]
    [InlineData("a0c2b1dd-75e9-4c62-913a-e652e5f23df2")]
    [InlineData("2a1efd73-1c2d-4472-9ace-3c30d9ec9300")]
    [InlineData("6bd4946f-05aa-4c5b-a8d9-a634f95a1033")]
    public async Task UpdateAsync_KeepsRulesWhenOmitted_KeepsIdsWhenEchoed_AndRemovesThemForAnEmptyList(string id)
    {
        var playbookId = Guid.Parse(id);
        await using var harness = await SeedHarness.StartAsync(playbookId);
        var stored = (await harness.Service().GetByIdAsync(playbookId, CancellationToken.None))!;
        var rows = await harness.RuleRowsAsync();
        Assert.Single(stored.PickRules);

        // Omitted: unchanged (S9). This is what every existing C# construction site now means.
        var omitted = await harness.Service().UpdateAsync(playbookId, ToUpsert(stored) with { Description = "Edited." }, CancellationToken.None);
        Assert.True(omitted.IsSuccess, omitted.Error?.Message);
        Assert.Equal(Json(stored.PickRules), Json(omitted.Value!.PickRules));
        Assert.Equal(rows, await harness.RuleRowsAsync());

        // Echoed back: the Id-based diff keeps every rule and alternative id, and rewrites nothing.
        var echoed = await harness.Service().UpdateAsync(playbookId, ToUpsert(stored) with { PickRules = ToUpsertRules(stored) }, CancellationToken.None);
        Assert.True(echoed.IsSuccess, echoed.Error?.Message);
        Assert.Equal(Json(stored.PickRules), Json(echoed.Value!.PickRules));
        Assert.Equal(rows, await harness.RuleRowsAsync());

        // []: every rule removed, down to its triggers.
        var cleared = await harness.Service().UpdateAsync(playbookId, ToUpsert(stored) with { PickRules = [] }, CancellationToken.None);
        Assert.True(cleared.IsSuccess, cleared.Error?.Message);
        Assert.Empty(cleared.Value!.PickRules);
        Assert.Equal((0, 0, 0, 0), await harness.RuleRowsAsync());
    }

    [Fact]
    public async Task UpdateAsync_ReplacesASentAlternativesCounts()
    {
        await using var harness = await SeedHarness.StartAsync(PickRuleTable.SpellSlinger);
        var stored = (await harness.Service().GetByIdAsync(PickRuleTable.SpellSlinger, CancellationToken.None))!;

        // Drop the 1 + 2 alternative and turn 2 + 1 into 2 + 0.
        var rules = ToUpsertRules(stored);
        var rule = rules[0];
        var edited = rule with
        {
            Alternatives =
            [
                rule.Alternatives![0],
                rule.Alternatives[1] with { Counts = [.. rule.Alternatives[1].Counts!.Select(c => c.BespokeOptionId == PickRuleTable.Effects ? c with { MinCount = 0, MaxCount = 0 } : c)] },
            ],
        };

        var result = await harness.Service().UpdateAsync(PickRuleTable.SpellSlinger, ToUpsert(stored) with { PickRules = [edited] }, CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error?.Message);
        var alternatives = Assert.Single(result.Value!.PickRules).Alternatives;
        Assert.Equal(stored.PickRules[0].Alternatives.Take(2).Select(a => a.Id), alternatives.Select(a => a.Id));
        // Wire order: Bases, then Effects.
        Assert.Equal([2, 0], alternatives[1].Counts.Select(c => c.MaxCount));
        Assert.Equal((1, 2, 4, 0), await harness.RuleRowsAsync());
    }

    [Theory]
    [InlineData("a0c2b1dd-75e9-4c62-913a-e652e5f23df2")]
    [InlineData("2a1efd73-1c2d-4472-9ace-3c30d9ec9300")]
    [InlineData("6bd4946f-05aa-4c5b-a8d9-a634f95a1033")]
    public async Task DeleteAsync_CascadesThroughThePickRules(string id)
    {
        var playbookId = Guid.Parse(id);
        await using var harness = await SeedHarness.StartAsync(playbookId);
        Assert.NotEqual((0, 0, 0, 0), await harness.RuleRowsAsync());

        // One statement that reaches counts and triggers both through the rule and through the
        // gear categories and options they point at (14.2, 14.3.2).
        var deleted = await harness.Service().DeleteAsync(playbookId, CancellationToken.None);

        Assert.True(deleted.IsSuccess);
        Assert.True(deleted.Value);
        await using var verify = harness.NewContext();
        Assert.Equal(0, await verify.Playbooks.CountAsync());
        Assert.Equal(0, await verify.BespokeOptions.CountAsync());
        Assert.Equal((0, 0, 0, 0), await harness.RuleRowsAsync());
    }

    // ---------------------------------------------------------------------------------
    // Pick-rule fixtures
    // ---------------------------------------------------------------------------------

    private static string Json(object value) => System.Text.Json.JsonSerializer.Serialize(value);

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

    private static IReadOnlyList<UpsertPlaybookPickRuleRequest> ToUpsertRules(PlaybookDetailResponse p) =>
    [
        .. p.PickRules.Select(r => new UpsertPlaybookPickRuleRequest(r.Id, r.Label, r.SortOrder,
        [
            .. r.Alternatives.Select(a => new UpsertPlaybookPickRuleAlternativeRequest(a.Id, a.Label, a.SortOrder,
            [
                .. a.Counts.Select(c => new UpsertPlaybookPickRuleCountRequest(c.GearCategoryId, c.BespokeOptionId, c.MinCount, c.MaxCount,
                    c.Adjustment is { } adjustment
                        ? new UpsertPlaybookPickRuleAdjustmentRequest([.. adjustment.TriggerOptionIds], adjustment.MinCount, adjustment.MaxCount)
                        : null)),
            ])),
        ])),
    ];

    private static UpsertPlaybookPickRuleRequest WithoutIds(UpsertPlaybookPickRuleRequest rule) => rule with
    {
        Id = null,
        Alternatives = [.. rule.Alternatives!.Select(a => a with { Id = null })],
    };

    private static UpsertBespokeOptionRequest WithoutIds(UpsertBespokeOptionRequest option) => option with
    {
        Id = null,
        Children = [.. option.Children!.Select(WithoutIds)],
    };

    /// <summary>A section with one category divider holding one leaf, all with ids the playbook doesn't have.</summary>
    private static UpsertBespokeSectionRequest FabricatedSectionRequest() => new(
        FabricatedSection, "Fabricated", null, null, null, 1, 1, null, null, 9,
        [
            new UpsertBespokeOptionRequest(FabricatedDivider, "Fabricated category", null, 1, 1, null, null, 0,
                [new UpsertBespokeOptionRequest(FabricatedLeaf, "Fabricated leaf", null, null, null, null, null, 0, [])]),
        ]);

    private static UpsertPlaybookRequest MapRule(UpsertPlaybookRequest request, Func<UpsertPlaybookPickRuleRequest, UpsertPlaybookPickRuleRequest> map) =>
        request with { PickRules = [map(request.PickRules![0]), .. request.PickRules.Skip(1)] };

    /// <summary>Rewrites the counts of the first rule's first alternative.</summary>
    private static UpsertPlaybookRequest MapCounts(
        UpsertPlaybookRequest request,
        Func<IReadOnlyList<UpsertPlaybookPickRuleCountRequest>, IReadOnlyList<UpsertPlaybookPickRuleCountRequest>> map) =>
        MapRule(request, rule => rule with
        {
            Alternatives = [rule.Alternatives![0] with { Counts = map(rule.Alternatives[0].Counts!) }, .. rule.Alternatives.Skip(1)],
        });

    /// <summary>Rewrites every count of the first rule, optionally adding one more to each alternative.</summary>
    private static UpsertPlaybookRequest MapAllCounts(
        UpsertPlaybookRequest request,
        Func<UpsertPlaybookPickRuleCountRequest, UpsertPlaybookPickRuleCountRequest> map,
        UpsertPlaybookPickRuleCountRequest? extra = null) =>
        MapRule(request, rule => rule with
        {
            Alternatives = [.. rule.Alternatives!.Select(a => a with { Counts = [.. a.Counts!.Select(map), .. extra is null ? [] : new[] { extra }] })],
        });

    private static UpsertPlaybookRequest MapSection(UpsertPlaybookRequest request, Guid sectionId, Func<UpsertBespokeSectionRequest, UpsertBespokeSectionRequest> map) =>
        request with { BespokeSections = [.. request.BespokeSections!.Select(s => s.Id == sectionId ? map(s) : s)] };

    private static UpsertPlaybookRequest MapOption(UpsertPlaybookRequest request, Guid optionId, Func<UpsertBespokeOptionRequest, UpsertBespokeOptionRequest> map) =>
        request with { BespokeSections = [.. request.BespokeSections!.Select(s => s with { Options = [.. s.Options!.Select(o => MapOption(o, optionId, map))] })] };

    private static UpsertBespokeOptionRequest MapOption(UpsertBespokeOptionRequest option, Guid optionId, Func<UpsertBespokeOptionRequest, UpsertBespokeOptionRequest> map) =>
        option.Id == optionId ? map(option) : option with { Children = [.. option.Children!.Select(c => MapOption(c, optionId, map))] };

    private static Guid FirstChild(UpsertPlaybookRequest request, Guid dividerId) =>
        request.BespokeSections!.SelectMany(s => s.Options!).Single(o => o.Id == dividerId).Children!.OrderBy(c => c.SortOrder).First().Id!.Value;

    /// <summary>One in-memory SQLite database holding one playbook from the committed seed.</summary>
    private sealed class SeedHarness : IAsyncDisposable
    {
        private Microsoft.Data.Sqlite.SqliteConnection connection = null!;
        private Microsoft.EntityFrameworkCore.DbContextOptions<MonsterOfTheWeek.Api.Data.MotwDbContext> options = null!;

        public static async Task<SeedHarness> StartAsync(Guid playbookId)
        {
            var harness = new SeedHarness();
            harness.connection = new Microsoft.Data.Sqlite.SqliteConnection("DataSource=:memory:");
            await harness.connection.OpenAsync();
            harness.options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<MonsterOfTheWeek.Api.Data.MotwDbContext>()
                .UseSqlite(harness.connection).Options;

            await using var setup = harness.NewContext();
            await setup.Database.EnsureCreatedAsync();
            setup.Playbooks.Add(MonsterOfTheWeek.Api.Data.Seed.PlaybookSeed.ToEntity(PickRuleTable.SeedPlaybook(playbookId)));
            await setup.SaveChangesAsync();
            return harness;
        }

        /// <summary>A fresh context per call, the lifetime a request gets.</summary>
        public PlaybookService Service() => new(new PlaybookRepository(NewContext()));

        public MonsterOfTheWeek.Api.Data.MotwDbContext NewContext() => new(options);

        /// <summary>Row counts in the four pick-rule tables: rules, alternatives, counts, triggers.</summary>
        public async Task<(int Rules, int Alternatives, int Counts, int Triggers)> RuleRowsAsync()
        {
            await using var db = NewContext();
            return (
                await db.Set<PlaybookPickRule>().CountAsync(),
                await db.Set<PlaybookPickRuleAlternative>().CountAsync(),
                await db.Set<PlaybookPickRuleCount>().CountAsync(),
                await db.Set<PlaybookPickRuleCountTrigger>().CountAsync());
        }

        public async ValueTask DisposeAsync() => await connection.DisposeAsync();
    }

    // ---------------------------------------------------------------------------------
    // Fixtures
    // ---------------------------------------------------------------------------------

    private static UpsertPlaybookRequest Request(string name = "The Test Subject") => new(
        name, null, 7, null, 5, 7, 5, 2, null, null, null, null, [], [], [], [], [], [], [], []);

    private static UpsertPlaybookMoveRequest Move(string name, bool required, int sortOrder) =>
        new(null, name, null, required, false, sortOrder, []);

    private static UpsertBespokeSectionRequest Section(string title, int? min, int? max, int optionCount) => new(
        null, title, null, null, null, min, max, null, null, 0,
        [.. Enumerable.Range(0, optionCount).Select(i =>
            new UpsertBespokeOptionRequest(null, $"Option {i}", null, null, null, null, null, i, []))]);

    private sealed class FakePlaybookRepository : IPlaybookRepository
    {
        public bool NameExists { get; init; }
        public Playbook? Detail { get; init; }
        public Playbook? ForUpdate { get; init; } = new Playbook { Name = "Existing" };
        public int HunterCount { get; init; }
        public int DeletedRows { get; init; } = 1;
        public IReadOnlyList<Guid> HunterReferencedIds { get; init; } = [];

        public int SaveChangesCalls { get; private set; }
        public Guid? NameExistsExcludingId { get; private set; }

        public Task<IReadOnlyList<PlaybookListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<PlaybookListItemResponse>>([]);

        public Task<Playbook?> GetDetailAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(Detail);

        public Task<Playbook?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(ForUpdate);

        public Task<bool> NameExistsAsync(string name, Guid? excludingId, CancellationToken cancellationToken)
        {
            NameExistsExcludingId = excludingId;
            return Task.FromResult(NameExists);
        }

        public Task<int> CountHuntersAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(HunterCount);

        public Task<IReadOnlyList<Guid>> GetHunterReferencedChildIdsAsync(
            IReadOnlyCollection<Guid> candidateIds,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Guid>>([.. HunterReferencedIds.Where(candidateIds.Contains)]);

        public Task AddAsync(Playbook playbook, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<int> DeleteAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(DeletedRows);

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls++;
            return Task.CompletedTask;
        }
    }
}
