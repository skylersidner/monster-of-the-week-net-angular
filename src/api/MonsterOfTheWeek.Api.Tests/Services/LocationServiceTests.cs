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
        var service = new LocationService(repository);
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
        var service = new LocationService(repository);

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
        var service = new LocationService(repository);
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
        var service = new LocationService(repository);

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

    private sealed class FakeLocationRepository : ILocationRepository
    {
        public bool MysteryExists { get; init; }
        public bool LocationTypeExists { get; init; } = true;
        public bool LocationExists { get; init; } = true;

        public int SaveChangesCalls { get; private set; }
        public int LinkLocationToMysteryCalls { get; private set; }

        private readonly List<Location> _locations = [];

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

        public Task LinkLocationToMysteryAsync(MysteryLocation link, CancellationToken cancellationToken)
        {
            LinkLocationToMysteryCalls += 1;
            return Task.CompletedTask;
        }

        public Task<int> UnlinkLocationFromMysteryAsync(Guid mysteryId, Guid locationId, CancellationToken cancellationToken) => Task.FromResult(1);

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
    }
}
