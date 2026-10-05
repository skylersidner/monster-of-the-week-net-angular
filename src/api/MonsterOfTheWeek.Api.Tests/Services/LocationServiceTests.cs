using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Microsoft.EntityFrameworkCore.Storage;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

public sealed class LocationServiceTests
{
    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenLocationTypeDoesNotExist()
    {
        var repository = new FakeLocationRepository
        {
            MysteryExists = true,
            LocationTypeExists = false
        };
        var service = new LocationService(repository, new FakeResourceImageService());
        var missingLocationTypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            Guid.NewGuid(),
            new UpsertLocationRequest("The Old Mill", "desc", missingLocationTypeId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingLocationTypeId.ToString(), result.Error.Message);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_CreatesStandaloneLocation_WithEmptyMysteryIds()
    {
        var repository = new FakeLocationRepository();
        var service = new LocationService(repository, new FakeResourceImageService());

        var result = await service.CreateAsync(
            new UpsertLocationRequest("Standalone Hideout", "desc", Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Empty(result.Value!.MysteryIds);
        Assert.Equal(0, repository.LinkLocationToMysteryCalls);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_ReturnsValidation_WhenLocationTypeDoesNotExist()
    {
        var repository = new FakeLocationRepository
        {
            LocationTypeExists = false
        };
        var service = new LocationService(repository, new FakeResourceImageService());
        var missingLocationTypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            new UpsertLocationRequest("The Old Mill", "desc", missingLocationTypeId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingLocationTypeId.ToString(), result.Error.Message);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_LocationIsRetrievableViaGetByIdAsync_AndAppearsInGetAllAsync()
    {
        var repository = new FakeLocationRepository();
        var service = new LocationService(repository, new FakeResourceImageService());

        var createResult = await service.CreateAsync(
            new UpsertLocationRequest("Standalone Hideout", "desc", Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(createResult.IsSuccess);
        var createdId = createResult.Value!.Id;

        var fetched = await service.GetByIdAsync(createdId, CancellationToken.None);
        Assert.NotNull(fetched);
        Assert.Equal("Standalone Hideout", fetched!.Name);
        Assert.Empty(fetched.MysteryIds);

        var all = await service.GetAllAsync(CancellationToken.None);
        Assert.Contains(all, x => x.Id == createdId);
    }

    [Fact]
    public async Task LinkToMysteryAsync_AddsBridgeRow_WhenMysteryAndLocationExist()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = true };
        var service = new LocationService(repository, new FakeResourceImageService());

        var linked = await service.LinkToMysteryAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.True(linked);
        Assert.Equal(1, repository.LinkLocationToMysteryCalls);
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_IsIdempotent_WhenAlreadyLinked()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = true };
        var service = new LocationService(repository, new FakeResourceImageService());
        var mysteryId = Guid.NewGuid();
        var locationId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, locationId, CancellationToken.None));
        Assert.True(await service.LinkToMysteryAsync(mysteryId, locationId, CancellationToken.None));

        Assert.Equal(1, repository.LinkLocationToMysteryCalls);
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_ReturnsFalse_WhenMysteryDoesNotExist()
    {
        var repository = new FakeLocationRepository { MysteryExists = false, LocationExists = true };
        var service = new LocationService(repository, new FakeResourceImageService());

        var linked = await service.LinkToMysteryAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.False(linked);
        Assert.Equal(0, repository.LinkLocationToMysteryCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_ReturnsFalse_WhenLocationDoesNotExist()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = false };
        var service = new LocationService(repository, new FakeResourceImageService());

        var linked = await service.LinkToMysteryAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.False(linked);
        Assert.Equal(0, repository.LinkLocationToMysteryCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_ThenUnlink_RoundTrips()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = true };
        var service = new LocationService(repository, new FakeResourceImageService());
        var mysteryId = Guid.NewGuid();
        var locationId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, locationId, CancellationToken.None));
        Assert.True(await service.UnlinkFromMysteryAsync(mysteryId, locationId, CancellationToken.None));
    }

    // Unlink's "true" only means something if it can be false. Without this the round-trip above
    // passes against a repository that reports a deletion it never performed.
    [Fact]
    public async Task UnlinkFromMysteryAsync_ReturnsFalse_WhenNotLinked()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = true };
        var service = new LocationService(repository, new FakeResourceImageService());

        var unlinked = await service.UnlinkFromMysteryAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.False(unlinked);
    }

    // The idempotency test proves a second link writes nothing. This proves the suppression is
    // driven by the bridge row and not by a latch: once the row is gone, linking must write again.
    [Fact]
    public async Task LinkToMysteryAsync_WritesAgain_AfterUnlink()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = true };
        var service = new LocationService(repository, new FakeResourceImageService());
        var mysteryId = Guid.NewGuid();
        var locationId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, locationId, CancellationToken.None));
        Assert.True(await service.UnlinkFromMysteryAsync(mysteryId, locationId, CancellationToken.None));
        Assert.True(await service.LinkToMysteryAsync(mysteryId, locationId, CancellationToken.None));

        Assert.Equal(2, repository.LinkLocationToMysteryCalls);
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
        var repository = new FakeLocationRepository { MysteryExists = false, LocationExists = true };
        var mysteryId = Guid.NewGuid();
        var locationId = Guid.NewGuid();
        repository.SeedLink(mysteryId, locationId);
        var service = new LocationService(repository, new FakeResourceImageService());

        var linked = await service.LinkToMysteryAsync(mysteryId, locationId, CancellationToken.None);

        Assert.False(linked);
        Assert.Equal(0, repository.LinkLocationToMysteryCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task LinkToMysteryAsync_ReturnsFalse_WhenLocationIsGone_EvenWithStaleBridgeRow()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = false };
        var mysteryId = Guid.NewGuid();
        var locationId = Guid.NewGuid();
        repository.SeedLink(mysteryId, locationId);
        var service = new LocationService(repository, new FakeResourceImageService());

        var linked = await service.LinkToMysteryAsync(mysteryId, locationId, CancellationToken.None);

        Assert.False(linked);
        Assert.Equal(0, repository.LinkLocationToMysteryCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    // Decision 1: shared M:N reuse. One location in two mysteries is the point of the feature,
    // and the already-linked short-circuit must key on the pair, not on the location.
    [Fact]
    public async Task LinkToMysteryAsync_LinksOneLocationToTwoMysteries()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = true };
        var service = new LocationService(repository, new FakeResourceImageService());
        var firstMysteryId = Guid.NewGuid();
        var secondMysteryId = Guid.NewGuid();
        var locationId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(firstMysteryId, locationId, CancellationToken.None));
        Assert.True(await service.LinkToMysteryAsync(secondMysteryId, locationId, CancellationToken.None));

        Assert.Equal(2, repository.LinkLocationToMysteryCalls);
        Assert.Equal(2, repository.LinkCount);

        // Unlinking one membership leaves the other standing.
        Assert.True(await service.UnlinkFromMysteryAsync(firstMysteryId, locationId, CancellationToken.None));
        Assert.True(await repository.LocationLinkedToMysteryAsync(secondMysteryId, locationId, CancellationToken.None));
        Assert.False(await repository.LocationLinkedToMysteryAsync(firstMysteryId, locationId, CancellationToken.None));
    }

    // The mirror of the above on the other axis: two locations in one mystery.
    [Fact]
    public async Task LinkToMysteryAsync_LinksTwoLocationsToOneMystery()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = true };
        var service = new LocationService(repository, new FakeResourceImageService());
        var mysteryId = Guid.NewGuid();
        var firstLocationId = Guid.NewGuid();
        var secondLocationId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, firstLocationId, CancellationToken.None));
        Assert.True(await service.LinkToMysteryAsync(mysteryId, secondLocationId, CancellationToken.None));

        Assert.Equal(2, repository.LinkLocationToMysteryCalls);
        Assert.Equal(2, repository.LinkCount);
    }

    // The bridge row the service writes must carry the ids it was handed, in that order. A
    // transposed assignment is invisible to every call-count assertion above.
    [Fact]
    public async Task LinkToMysteryAsync_WritesTheGivenIdsIntoTheBridgeRow()
    {
        var repository = new FakeLocationRepository { MysteryExists = true, LocationExists = true };
        var service = new LocationService(repository, new FakeResourceImageService());
        var mysteryId = Guid.NewGuid();
        var locationId = Guid.NewGuid();

        Assert.True(await service.LinkToMysteryAsync(mysteryId, locationId, CancellationToken.None));

        var link = Assert.Single(repository.WrittenLinks);
        Assert.Equal(mysteryId, link.MysteryId);
        Assert.Equal(locationId, link.LocationId);
    }


    // UpsertLocationRequest.Name is the only field this phase adds DataAnnotations to (per
    // docs/updates/location-required-fields-validation.md's Revision section) - it gates all
    // three write paths (mystery-scoped CreateAsync, standalone CreateAsync, UpdateAsync) since
    // they all bind the same request type via [ApiController]'s model-validation pipeline, same
    // reasoning as Monster's/Minion's phases for why one reflection-based check per record
    // suffices rather than one test per service method.
    [Fact]
    public void Name_RequiredAttribute_RejectsNullOrBlankValues()
    {
        var attribute = GetParameterAttribute<RequiredAttribute>(typeof(UpsertLocationRequest), "Name");

        Assert.False(attribute.IsValid(null));
        Assert.False(attribute.IsValid(""));
        Assert.False(attribute.IsValid("   "));
    }

    [Fact]
    public void Name_RequiredAttribute_AcceptsNonBlankValue()
    {
        var attribute = GetParameterAttribute<RequiredAttribute>(typeof(UpsertLocationRequest), "Name");

        Assert.True(attribute.IsValid("Valid Name"));
    }

    [Fact]
    public void Name_MaxLengthAttribute_Is255_AndRejectsOversizedValue()
    {
        var attribute = GetParameterAttribute<MaxLengthAttribute>(typeof(UpsertLocationRequest), "Name");

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

    private sealed class FakeLocationRepository : ILocationRepository
    {
        public bool MysteryExists { get; init; }
        public bool LocationTypeExists { get; init; } = true;
        public bool LocationExists { get; init; } = true;

        public int SaveChangesCalls { get; private set; }
        public int LinkLocationToMysteryCalls { get; private set; }

        private readonly List<Location> _locations = [];
        private readonly List<MysteryLocation> _mysteryLocations = [];

        public Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken) => Task.FromResult(MysteryExists);
        public Task<bool> LocationTypeExistsAsync(Guid locationTypeId, CancellationToken cancellationToken) => Task.FromResult(LocationTypeExists);
        public Task<bool> LocationExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(LocationExists);

        public Task<IReadOnlyList<Location>> GetAllLocationsAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Location>>(_locations.ToList());

        public Task<IReadOnlyList<Location>> GetLocationsByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Location>>([]);

        public Task AddLocationAsync(Location location, CancellationToken cancellationToken)
        {
            location.LocationType = new LocationType { Id = location.LocationTypeId, Name = "Type", Motivation = "Mot" };
            _locations.Add(location);
            return Task.CompletedTask;
        }

        /// <summary>The bridge rows the service handed to the repository, in order.</summary>
        public List<MysteryLocation> WrittenLinks { get; } = [];

        public Task LinkLocationToMysteryAsync(MysteryLocation link, CancellationToken cancellationToken)
        {
            LinkLocationToMysteryCalls += 1;
            WrittenLinks.Add(link);
            _mysteryLocations.Add(link);
            return Task.CompletedTask;
        }

        // The insert-and-save pair the link verb goes through. Deliberately delegates to the two
        // methods above rather than reimplementing them, so the counters keep meaning "the service
        // wrote a bridge row and committed it" and the duplicate-race guard stays a repository
        // concern — it is characterised against a real database in MysteryLinkRepositoryTests.
        public async Task LinkLocationToMysteryAndSaveAsync(MysteryLocation link, CancellationToken cancellationToken)
        {
            await LinkLocationToMysteryAsync(link, cancellationToken);
            await SaveChangesAsync(cancellationToken);
        }

        // Mirrors the real repository's ExecuteDeleteAsync: returns the number of bridge rows
        // actually removed, which is 0 when the pair was never linked. A hardcoded 1 here would
        // make UnlinkFromMysteryAsync unconditionally true and every round-trip assertion vacuous.
        public Task<int> UnlinkLocationFromMysteryAsync(Guid mysteryId, Guid locationId, CancellationToken cancellationToken) =>
            Task.FromResult(_mysteryLocations.RemoveAll(x => x.MysteryId == mysteryId && x.LocationId == locationId));

        public Task<bool> LocationLinkedToMysteryAsync(Guid mysteryId, Guid locationId, CancellationToken cancellationToken) =>
            Task.FromResult(_mysteryLocations.Any(x => x.MysteryId == mysteryId && x.LocationId == locationId));

        /// <summary>
        /// Puts a bridge row in place without going through the service, so a test can stage a
        /// row that outlives the mystery or the location it names.
        /// </summary>
        public void SeedLink(Guid mysteryId, Guid locationId) =>
            _mysteryLocations.Add(new MysteryLocation { MysteryId = mysteryId, LocationId = locationId });

        public int LinkCount => _mysteryLocations.Count;

        public Task<Location?> GetLocationDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken) =>
            Task.FromResult<Location?>(_locations.FirstOrDefault(x => x.Id == id)
                ?? new Location { Name = "Location", LocationType = new LocationType { Name = "Type", Motivation = "Mot" } });

        public Task<Location?> GetLocationForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<Location?>(_locations.FirstOrDefault(x => x.Id == id) ?? new Location { Name = "Location" });

        public Task<IReadOnlyList<LocationCustomMove>> GetLocationCustomMovesAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<LocationCustomMove>>([]);

        public Task AddLocationCustomMoveAsync(LocationCustomMove move, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<LocationCustomMove?> GetLocationCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) =>
            Task.FromResult<LocationCustomMove?>(null);

        public Task<int> DeleteLocationCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task<int> DeleteLocationAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls += 1;
            return Task.CompletedTask;
        }

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IDbContextTransaction>(new NoOpDbContextTransaction());
    }
}
