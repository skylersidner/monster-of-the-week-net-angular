using System.ComponentModel.DataAnnotations;
using System.Reflection;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

public sealed class MysteryServiceTests
{
    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenAdventureTypeDoesNotExist()
    {
        var repository = new FakeMysteryRepository { AdventureTypeExists = false };
        var service = new MysteryService(repository);
        var missingAdventureTypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            new UpsertMysteryRequest("The Vanishing", "concept", null, null, null, missingAdventureTypeId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingAdventureTypeId.ToString(), result.Error.Message);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task CreateAsync_ReturnsSuccess_WhenValid_AndMysteryIsRetrievable()
    {
        var repository = new FakeMysteryRepository();
        var service = new MysteryService(repository);
        var adventureTypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            new UpsertMysteryRequest("The Vanishing", "concept", "hook", "overview", null, adventureTypeId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("The Vanishing", result.Value!.Name);
        Assert.Equal(1, repository.SaveChangesCalls);

        var fetched = await service.GetByIdAsync(result.Value.Id, CancellationToken.None);
        Assert.NotNull(fetched);
        Assert.Equal("The Vanishing", fetched!.Name);

        var all = await service.GetAllAsync(CancellationToken.None);
        Assert.Contains(all, x => x.Id == result.Value.Id);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNotFound_WhenMysteryDoesNotExist()
    {
        var repository = new FakeMysteryRepository();
        var service = new MysteryService(repository);

        var result = await service.UpdateAsync(
            Guid.NewGuid(),
            new UpsertMysteryRequest("Renamed", null, null, null, null, Guid.NewGuid()),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.NotFound, result.Error.Type);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsValidation_WhenAdventureTypeDoesNotExist()
    {
        var repository = new FakeMysteryRepository();
        var service = new MysteryService(repository);
        var created = await service.CreateAsync(
            new UpsertMysteryRequest("The Vanishing", null, null, null, null, Guid.NewGuid()),
            CancellationToken.None);
        Assert.True(created.IsSuccess);

        repository.AdventureTypeExists = false;
        var missingAdventureTypeId = Guid.NewGuid();

        var result = await service.UpdateAsync(
            created.Value!.Id,
            new UpsertMysteryRequest("Renamed", null, null, null, null, missingAdventureTypeId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingAdventureTypeId.ToString(), result.Error.Message);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsSuccess_WhenValid()
    {
        var repository = new FakeMysteryRepository();
        var service = new MysteryService(repository);
        var created = await service.CreateAsync(
            new UpsertMysteryRequest("The Vanishing", null, null, null, null, Guid.NewGuid()),
            CancellationToken.None);
        Assert.True(created.IsSuccess);

        var result = await service.UpdateAsync(
            created.Value!.Id,
            new UpsertMysteryRequest("The Vanishing, Revised", "new concept", null, null, null, Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("The Vanishing, Revised", result.Value!.Name);
        Assert.Equal("new concept", result.Value.Concept);
    }

    // UpsertMysteryRequest carries its DataAnnotations on the primary constructor's parameters
    // ([param: Required]/[param: MaxLength], matching CreateAdventureTypeRequest's existing
    // precedent in ApiContracts.cs), not on the generated properties — so these attributes are
    // read via ParameterInfo, not PropertyInfo/Validator.TryValidateObject.
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Name_RequiredAttribute_RejectsNullOrBlankValues(string? name)
    {
        var attribute = GetParameterAttribute<RequiredAttribute>("Name");
        Assert.False(attribute.IsValid(name));
    }

    [Fact]
    public void Name_RequiredAttribute_AcceptsNonBlankValue()
    {
        var attribute = GetParameterAttribute<RequiredAttribute>("Name");
        Assert.True(attribute.IsValid("The Vanishing"));
    }

    [Fact]
    public void Concept_HasMaxLength500Attribute()
    {
        var attribute = GetParameterAttribute<MaxLengthAttribute>("Concept");
        Assert.Equal(500, attribute.Length);
    }

    private static TAttribute GetParameterAttribute<TAttribute>(string parameterName)
        where TAttribute : Attribute
    {
        var ctor = typeof(UpsertMysteryRequest).GetConstructors().Single();
        var parameter = ctor.GetParameters().Single(p => p.Name == parameterName);
        return parameter.GetCustomAttribute<TAttribute>()
            ?? throw new InvalidOperationException($"{parameterName} is missing {typeof(TAttribute).Name}.");
    }

    private sealed class FakeMysteryRepository : IMysteryRepository
    {
        public bool MysteryExists { get; init; }
        public bool AdventureTypeExists { get; set; } = true;
        public int SaveChangesCalls { get; private set; }

        private readonly List<Mystery> _mysteries = [];

        public Task<IReadOnlyList<Mystery>> GetMysteriesForListAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Mystery>>(_mysteries.ToList());

        public Task<Mystery?> GetMysteryDetailAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken) =>
            Task.FromResult(_mysteries.FirstOrDefault(x => x.Id == id));

        public Task AddMysteryAsync(Mystery mystery, CancellationToken cancellationToken)
        {
            mystery.AdventureType = new AdventureType { Id = mystery.AdventureTypeId, Name = "Type", Description = "Desc" };
            _mysteries.Add(mystery);
            return Task.CompletedTask;
        }

        public Task<int> DeleteMysteryAsync(Guid id, CancellationToken cancellationToken)
        {
            var removed = _mysteries.RemoveAll(x => x.Id == id);
            return Task.FromResult(removed);
        }

        public Task<bool> MysteryExistsAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(MysteryExists || _mysteries.Any(x => x.Id == id));

        public Task<bool> AdventureTypeExistsAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(AdventureTypeExists);

        public Task<Countdown?> GetCountdownByMysteryIdAsync(Guid id, bool asNoTracking, CancellationToken cancellationToken) =>
            Task.FromResult(_mysteries.FirstOrDefault(x => x.Id == id)?.Countdown);

        public Task AddCountdownAsync(Countdown countdown, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls += 1;
            return Task.CompletedTask;
        }
    }
}
