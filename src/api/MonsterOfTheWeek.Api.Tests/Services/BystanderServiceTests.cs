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

        public Task LinkBystanderToMysteryAsync(MysteryBystander link, CancellationToken cancellationToken)
        {
            LinkBystanderToMysteryCalls += 1;
            return Task.CompletedTask;
        }

        public Task<int> UnlinkBystanderFromMysteryAsync(Guid mysteryId, Guid bystanderId, CancellationToken cancellationToken) => Task.FromResult(1);

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
