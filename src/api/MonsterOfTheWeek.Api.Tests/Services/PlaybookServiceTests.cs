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
    // Fixtures
    // ---------------------------------------------------------------------------------

    private static UpsertPlaybookRequest Request(string name = "The Test Subject") => new(
        name, null, 7, null, 5, 7, 5, 2, null, null, null, null, [], [], [], [], [], [], [], []);

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
