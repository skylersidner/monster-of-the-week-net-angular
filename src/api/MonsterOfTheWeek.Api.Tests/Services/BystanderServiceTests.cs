using System.ComponentModel.DataAnnotations;
using System.Reflection;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

public sealed class BystanderServiceTests
{
    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenBystanderTypeDoesNotExist()
    {
        var repository = new FakeBystanderRepository
        {
            MysteryExists = true,
            BystanderTypeExists = false
        };
        var service = new BystanderService(repository);
        var missingBystanderTypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            Guid.NewGuid(),
            new UpsertBystanderRequest("Nosy Neighbor", "desc", missingBystanderTypeId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingBystanderTypeId.ToString(), result.Error.Message);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_CreatesStandaloneBystander_WithEmptyMysteryIds()
    {
        var repository = new FakeBystanderRepository();
        var service = new BystanderService(repository);

        var result = await service.CreateAsync(
            new UpsertBystanderRequest("Standalone Witness", "desc", Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Empty(result.Value!.MysteryIds);
        Assert.Equal(0, repository.LinkBystanderToMysteryCalls);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_ReturnsValidation_WhenBystanderTypeDoesNotExist()
    {
        var repository = new FakeBystanderRepository
        {
            BystanderTypeExists = false
        };
        var service = new BystanderService(repository);
        var missingBystanderTypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            new UpsertBystanderRequest("Nosy Neighbor", "desc", missingBystanderTypeId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingBystanderTypeId.ToString(), result.Error.Message);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_BystanderIsRetrievableViaGetByIdAsync_AndAppearsInGetAllAsync()
    {
        var repository = new FakeBystanderRepository();
        var service = new BystanderService(repository);

        var createResult = await service.CreateAsync(
            new UpsertBystanderRequest("Standalone Witness", "desc", Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(createResult.IsSuccess);
        var createdId = createResult.Value!.Id;

        var fetched = await service.GetByIdAsync(createdId, CancellationToken.None);
        Assert.NotNull(fetched);
        Assert.Equal("Standalone Witness", fetched!.Name);
        Assert.Empty(fetched.MysteryIds);

        var all = await service.GetAllAsync(CancellationToken.None);
        Assert.Contains(all, x => x.Id == createdId);
    }

    [Fact]
    public async Task LinkToMysteryAsync_AddsBridgeRow_WhenMysteryAndBystanderExist()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = true };
        var service = new BystanderService(repository);

        var linked = await service.LinkToMysteryAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.True(linked);
        Assert.Equal(1, repository.LinkBystanderToMysteryCalls);
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_IsIdempotent_WhenAlreadyLinked()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = true };
        var service = new BystanderService(repository);
        var mysteryId = Guid.NewGuid();
        var bystanderId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, bystanderId, CancellationToken.None));
        Assert.True(await service.LinkToMysteryAsync(mysteryId, bystanderId, CancellationToken.None));

        Assert.Equal(1, repository.LinkBystanderToMysteryCalls);
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_ReturnsFalse_WhenMysteryDoesNotExist()
    {
        var repository = new FakeBystanderRepository { MysteryExists = false, BystanderExists = true };
        var service = new BystanderService(repository);

        var linked = await service.LinkToMysteryAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.False(linked);
        Assert.Equal(0, repository.LinkBystanderToMysteryCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_ReturnsFalse_WhenBystanderDoesNotExist()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = false };
        var service = new BystanderService(repository);

        var linked = await service.LinkToMysteryAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.False(linked);
        Assert.Equal(0, repository.LinkBystanderToMysteryCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_ThenUnlink_RoundTrips()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = true };
        var service = new BystanderService(repository);
        var mysteryId = Guid.NewGuid();
        var bystanderId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, bystanderId, CancellationToken.None));
        Assert.True(await service.UnlinkFromMysteryAsync(mysteryId, bystanderId, CancellationToken.None));
    }

    // Unlink's "true" only means something if it can be false. Without this the round-trip above
    // passes against a repository that reports a deletion it never performed.
    [Fact]
    public async Task UnlinkFromMysteryAsync_ReturnsFalse_WhenNotLinked()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = true };
        var service = new BystanderService(repository);

        var unlinked = await service.UnlinkFromMysteryAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.False(unlinked);
    }

    // The idempotency test proves a second link writes nothing. This proves the suppression is
    // driven by the bridge row and not by a latch: once the row is gone, linking must write again.
    [Fact]
    public async Task LinkToMysteryAsync_WritesAgain_AfterUnlink()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = true };
        var service = new BystanderService(repository);
        var mysteryId = Guid.NewGuid();
        var bystanderId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, bystanderId, CancellationToken.None));
        Assert.True(await service.UnlinkFromMysteryAsync(mysteryId, bystanderId, CancellationToken.None));
        Assert.True(await service.LinkToMysteryAsync(mysteryId, bystanderId, CancellationToken.None));

        Assert.Equal(2, repository.LinkBystanderToMysteryCalls);
        Assert.Equal(2, repository.SaveChangesCalls);
        Assert.Equal(1, repository.LinkCount);
    }

    // Pins the ordering choice recorded in .squad/decisions/inbox/bowser-mystery-entity-linking-phase1-link-verb.md:
    // existence checks run before the already-linked check, so a PUT naming a mystery that no
    // longer exists is a 404 even when a bridge row still names it. Cheapest-first ordering
    // (already-linked first) would return 204 here.
    [Fact]
    public async Task LinkToMysteryAsync_ReturnsFalse_WhenMysteryIsGone_EvenWithStaleBridgeRow()
    {
        var repository = new FakeBystanderRepository { MysteryExists = false, BystanderExists = true };
        var mysteryId = Guid.NewGuid();
        var bystanderId = Guid.NewGuid();
        repository.SeedLink(mysteryId, bystanderId);
        var service = new BystanderService(repository);

        var linked = await service.LinkToMysteryAsync(mysteryId, bystanderId, CancellationToken.None);

        Assert.False(linked);
        Assert.Equal(0, repository.LinkBystanderToMysteryCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_ReturnsFalse_WhenBystanderIsGone_EvenWithStaleBridgeRow()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = false };
        var mysteryId = Guid.NewGuid();
        var bystanderId = Guid.NewGuid();
        repository.SeedLink(mysteryId, bystanderId);
        var service = new BystanderService(repository);

        var linked = await service.LinkToMysteryAsync(mysteryId, bystanderId, CancellationToken.None);

        Assert.False(linked);
        Assert.Equal(0, repository.LinkBystanderToMysteryCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    // Decision 1: shared M:N reuse. One bystander in two mysteries is the point of the feature,
    // and the already-linked short-circuit must key on the pair, not on the bystander.
    [Fact]
    public async Task LinkToMysteryAsync_LinksOneBystanderToTwoMysteries()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = true };
        var service = new BystanderService(repository);
        var firstMysteryId = Guid.NewGuid();
        var secondMysteryId = Guid.NewGuid();
        var bystanderId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(firstMysteryId, bystanderId, CancellationToken.None));
        Assert.True(await service.LinkToMysteryAsync(secondMysteryId, bystanderId, CancellationToken.None));

        Assert.Equal(2, repository.LinkBystanderToMysteryCalls);
        Assert.Equal(2, repository.LinkCount);

        // Unlinking one membership leaves the other standing.
        Assert.True(await service.UnlinkFromMysteryAsync(firstMysteryId, bystanderId, CancellationToken.None));
        Assert.True(await repository.BystanderLinkedToMysteryAsync(secondMysteryId, bystanderId, CancellationToken.None));
        Assert.False(await repository.BystanderLinkedToMysteryAsync(firstMysteryId, bystanderId, CancellationToken.None));
    }

    // The mirror of the above on the other axis: two bystanders in one mystery.
    [Fact]
    public async Task LinkToMysteryAsync_LinksTwoBystandersToOneMystery()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = true };
        var service = new BystanderService(repository);
        var mysteryId = Guid.NewGuid();
        var firstBystanderId = Guid.NewGuid();
        var secondBystanderId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, firstBystanderId, CancellationToken.None));
        Assert.True(await service.LinkToMysteryAsync(mysteryId, secondBystanderId, CancellationToken.None));

        Assert.Equal(2, repository.LinkBystanderToMysteryCalls);
        Assert.Equal(2, repository.LinkCount);
    }

    // The bridge row the service writes must carry the ids it was handed, in that order. A
    // transposed assignment is invisible to every call-count assertion above.
    [Fact]
    public async Task LinkToMysteryAsync_WritesTheGivenIdsIntoTheBridgeRow()
    {
        var repository = new FakeBystanderRepository { MysteryExists = true, BystanderExists = true };
        var service = new BystanderService(repository);
        var mysteryId = Guid.NewGuid();
        var bystanderId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, bystanderId, CancellationToken.None));

        var link = Assert.Single(repository.WrittenLinks);
        Assert.Equal(mysteryId, link.MysteryId);
        Assert.Equal(bystanderId, link.BystanderId);
    }

    // UpsertBystanderRequest.Name is the only field this phase adds DataAnnotations to (per
    // docs/updates/bystander-required-fields-validation.md's Revision section) - it gates all
    // three write paths (mystery-scoped CreateAsync, standalone CreateAsync, UpdateAsync) since
    // they all bind the same request type via [ApiController]'s model-validation pipeline, same
    // reasoning as Monster's/Minion's/Location's phases for why one reflection-based check per
    // record suffices rather than one test per service method.
    [Fact]
    public void Name_RequiredAttribute_RejectsNullOrBlankValues()
    {
        var attribute = GetParameterAttribute<RequiredAttribute>(typeof(UpsertBystanderRequest), "Name");

        Assert.False(attribute.IsValid(null));
        Assert.False(attribute.IsValid(""));
        Assert.False(attribute.IsValid("   "));
    }

    [Fact]
    public void Name_RequiredAttribute_AcceptsNonBlankValue()
    {
        var attribute = GetParameterAttribute<RequiredAttribute>(typeof(UpsertBystanderRequest), "Name");

        Assert.True(attribute.IsValid("Valid Name"));
    }

    [Fact]
    public void Name_MaxLengthAttribute_Is255_AndRejectsOversizedValue()
    {
        var attribute = GetParameterAttribute<MaxLengthAttribute>(typeof(UpsertBystanderRequest), "Name");

        Assert.Equal(255, attribute.Length);
        Assert.True(attribute.IsValid(new string('a', 255)));
        Assert.False(attribute.IsValid(new string('a', 256)));
    }

    private static TAttribute GetParameterAttribute<TAttribute>(Type requestType, string parameterName)
        where TAttribute : Attribute
    {
        var ctor = requestType.GetConstructors().Single();
        var parameter = ctor.GetParameters().Single(p => p.Name == parameterName);
        return parameter.GetCustomAttribute<TAttribute>()
            ?? throw new InvalidOperationException($"{requestType.Name}.{parameterName} is missing {typeof(TAttribute).Name}.");
    }

    private sealed class FakeBystanderRepository : IBystanderRepository
    {
        public bool MysteryExists { get; init; }
        public bool BystanderTypeExists { get; init; } = true;
        public bool BystanderExists { get; init; } = true;

        public int SaveChangesCalls { get; private set; }
        public int LinkBystanderToMysteryCalls { get; private set; }

        private readonly List<Bystander> _bystanders = [];
        private readonly List<MysteryBystander> _mysteryBystanders = [];

        public Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken) => Task.FromResult(MysteryExists);
        public Task<bool> BystanderTypeExistsAsync(Guid bystanderTypeId, CancellationToken cancellationToken) => Task.FromResult(BystanderTypeExists);
        public Task<bool> BystanderExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(BystanderExists);

        public Task<IReadOnlyList<Bystander>> GetAllBystandersAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Bystander>>(_bystanders.ToList());

        public Task<IReadOnlyList<Bystander>> GetBystandersByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Bystander>>([]);

        public Task AddBystanderAsync(Bystander bystander, CancellationToken cancellationToken)
        {
            bystander.BystanderType = new BystanderType { Id = bystander.BystanderTypeId, Name = "Type", Motivation = "Mot" };
            _bystanders.Add(bystander);
            return Task.CompletedTask;
        }

        /// <summary>The bridge rows the service handed to the repository, in order.</summary>
        public List<MysteryBystander> WrittenLinks { get; } = [];

        public Task LinkBystanderToMysteryAsync(MysteryBystander link, CancellationToken cancellationToken)
        {
            LinkBystanderToMysteryCalls += 1;
            WrittenLinks.Add(link);
            _mysteryBystanders.Add(link);
            return Task.CompletedTask;
        }

        // The insert-and-save pair the link verb goes through. Deliberately delegates to the two
        // methods above rather than reimplementing them, so the counters keep meaning "the service
        // wrote a bridge row and committed it" and the duplicate-race guard stays a repository
        // concern — it is characterised against a real database in MysteryLinkRepositoryTests.
        public async Task LinkBystanderToMysteryAndSaveAsync(MysteryBystander link, CancellationToken cancellationToken)
        {
            await LinkBystanderToMysteryAsync(link, cancellationToken);
            await SaveChangesAsync(cancellationToken);
        }

        // Mirrors the real repository's ExecuteDeleteAsync: returns the number of bridge rows
        // actually removed, which is 0 when the pair was never linked. A hardcoded 1 here would
        // make UnlinkFromMysteryAsync unconditionally true and every round-trip assertion vacuous.
        public Task<int> UnlinkBystanderFromMysteryAsync(Guid mysteryId, Guid bystanderId, CancellationToken cancellationToken) =>
            Task.FromResult(_mysteryBystanders.RemoveAll(x => x.MysteryId == mysteryId && x.BystanderId == bystanderId));

        public Task<bool> BystanderLinkedToMysteryAsync(Guid mysteryId, Guid bystanderId, CancellationToken cancellationToken) =>
            Task.FromResult(_mysteryBystanders.Any(x => x.MysteryId == mysteryId && x.BystanderId == bystanderId));

        /// <summary>
        /// Puts a bridge row in place without going through the service, so a test can stage a
        /// row that outlives the mystery or the bystander it names.
        /// </summary>
        public void SeedLink(Guid mysteryId, Guid bystanderId) =>
            _mysteryBystanders.Add(new MysteryBystander { MysteryId = mysteryId, BystanderId = bystanderId });

        public int LinkCount => _mysteryBystanders.Count;

        public Task<Bystander?> GetBystanderDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken) =>
            Task.FromResult<Bystander?>(_bystanders.FirstOrDefault(x => x.Id == id)
                ?? new Bystander { Name = "Bystander", BystanderType = new BystanderType { Name = "Type", Motivation = "Mot" } });

        public Task<Bystander?> GetBystanderForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<Bystander?>(_bystanders.FirstOrDefault(x => x.Id == id) ?? new Bystander { Name = "Bystander" });

        public Task<IReadOnlyList<BystanderCustomMove>> GetBystanderCustomMovesAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<BystanderCustomMove>>([]);

        public Task AddBystanderCustomMoveAsync(BystanderCustomMove move, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<BystanderCustomMove?> GetBystanderCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) =>
            Task.FromResult<BystanderCustomMove?>(null);

        public Task<int> DeleteBystanderCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task<int> DeleteBystanderAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls += 1;
            return Task.CompletedTask;
        }
    }
}
