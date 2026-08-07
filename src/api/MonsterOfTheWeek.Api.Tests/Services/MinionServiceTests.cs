using System.ComponentModel.DataAnnotations;
using System.Reflection;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

public sealed class MinionServiceTests
{
    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenMinionTypeDoesNotExist()
    {
        var repository = new FakeMinionRepository
        {
            MonsterExists = true,
            MinionTypeExists = false
        };
        var service = new MinionService(repository);
        var missingMinionTypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            Guid.NewGuid(),
            new UpsertMinionRequest("Grunt", "desc", 3, missingMinionTypeId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingMinionTypeId.ToString(), result.Error.Message);
    }

    [Fact]
    public async Task DeleteAsync_ReturnsTrue_WhenRepositoryDeletesRow()
    {
        var repository = new FakeMinionRepository { DeleteMinionResult = 1 };
        var service = new MinionService(repository);

        var result = await service.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.True(result);
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalse_WhenMinionDoesNotExist()
    {
        var repository = new FakeMinionRepository { DeleteMinionResult = 0 };
        var service = new MinionService(repository);

        var result = await service.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(result);
    }

    // Upsert*Request records carry their DataAnnotations on the primary constructor's
    // parameters ([param: Required, MaxLength]/[param: Range]), matching
    // UpsertMonsterRequest's established precedent (see MonsterServiceTests.cs) — so these
    // attributes are read via ParameterInfo, not PropertyInfo/Validator.TryValidateObject.
    // UpsertCustomMoveRequest is deliberately excluded here: it's the shared cross-domain DTO
    // already fixed and covered in MonsterServiceTests.cs during Phase 2, no new coverage needed.
    public static IEnumerable<object[]> NameRequestTypes =>
    [
        [typeof(UpsertMinionRequest)],
        [typeof(UpsertMinionAttackRequest)],
        [typeof(UpsertMinionPowerRequest)],
        [typeof(UpsertMinionArmorRequest)],
        [typeof(UpsertMinionWeaknessRequest)],
    ];

    public static IEnumerable<object[]> HarmFields =>
    [
        [typeof(UpsertMinionRequest), "HarmCapacity"],
        [typeof(UpsertMinionAttackRequest), "Harm"],
        [typeof(UpsertMinionArmorRequest), "HarmSoak"],
    ];

    [Theory]
    [MemberData(nameof(NameRequestTypes))]
    public void Name_RequiredAttribute_RejectsNullOrBlankValues(Type requestType)
    {
        var attribute = GetParameterAttribute<RequiredAttribute>(requestType, "Name");

        Assert.False(attribute.IsValid(null));
        Assert.False(attribute.IsValid(""));
        Assert.False(attribute.IsValid("   "));
    }

    [Theory]
    [MemberData(nameof(NameRequestTypes))]
    public void Name_RequiredAttribute_AcceptsNonBlankValue(Type requestType)
    {
        var attribute = GetParameterAttribute<RequiredAttribute>(requestType, "Name");

        Assert.True(attribute.IsValid("Valid Name"));
    }

    [Theory]
    [MemberData(nameof(NameRequestTypes))]
    public void Name_MaxLengthAttribute_Is255_AndRejectsOversizedValue(Type requestType)
    {
        var attribute = GetParameterAttribute<MaxLengthAttribute>(requestType, "Name");

        Assert.Equal(255, attribute.Length);
        Assert.True(attribute.IsValid(new string('a', 255)));
        Assert.False(attribute.IsValid(new string('a', 256)));
    }

    [Theory]
    [MemberData(nameof(HarmFields))]
    public void HarmField_RangeAttribute_RejectsNegativeValues(Type requestType, string parameterName)
    {
        var attribute = GetParameterAttribute<RangeAttribute>(requestType, parameterName);

        Assert.False(attribute.IsValid(-1));
        Assert.True(attribute.IsValid(0));
        Assert.True(attribute.IsValid(int.MaxValue));
    }

    private static TAttribute GetParameterAttribute<TAttribute>(Type requestType, string parameterName)
        where TAttribute : Attribute
    {
        var ctor = requestType.GetConstructors().Single();
        var parameter = ctor.GetParameters().Single(p => p.Name == parameterName);
        return parameter.GetCustomAttribute<TAttribute>()
            ?? throw new InvalidOperationException($"{requestType.Name}.{parameterName} is missing {typeof(TAttribute).Name}.");
    }

    private sealed class FakeMinionRepository : IMinionRepository
    {
        public bool MonsterExists { get; init; }
        public bool MinionExists { get; init; } = true;
        public bool MinionTypeExists { get; init; } = true;
        public bool WeaponTagExists { get; init; } = true;
        public int DeleteMinionResult { get; init; } = 1;

        public int SaveChangesCalls { get; private set; }

        private readonly List<Minion> _minions = [];

        public Task<bool> MonsterExistsAsync(Guid monsterId, CancellationToken cancellationToken) => Task.FromResult(MonsterExists);
        public Task<bool> MinionExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(MinionExists);
        public Task<bool> MinionTypeExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(MinionTypeExists);
        public Task<bool> WeaponTagExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(WeaponTagExists);

        public Task<IReadOnlyList<MinionListItemResponse>> GetByMonsterIdAsync(Guid monsterId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MinionListItemResponse>>([]);

        public Task<IReadOnlyList<MinionListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MinionListItemResponse>>([]);

        public Task<Minion?> GetDetailAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<Minion?>(_minions.FirstOrDefault(x => x.Id == id)
                ?? new Minion
                {
                    Name = "Minion",
                    Monster = new Monster { Name = "Monster" },
                    MinionType = new MinionType { Name = "Type", Motivation = "Mot" }
                });

        public Task<Minion?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<Minion?>(_minions.FirstOrDefault(x => x.Id == id) ?? new Minion { Name = "Minion" });

        public Task AddAsync(Minion minion, CancellationToken cancellationToken)
        {
            minion.Monster = new Monster { Name = "Monster" };
            minion.MinionType = new MinionType { Id = minion.MinionTypeId, Name = "Type", Motivation = "Mot" };
            _minions.Add(minion);
            return Task.CompletedTask;
        }

        public Task<int> DeleteMinionAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(DeleteMinionResult);

        public Task<IReadOnlyList<MinionAttack>> GetAttacksAsync(Guid minionId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MinionAttack>>([]);

        public Task<MinionAttack?> GetAttackAsync(Guid minionId, Guid attackId, bool includeTags, CancellationToken cancellationToken) =>
            Task.FromResult<MinionAttack?>(null);

        public Task AddAttackAsync(MinionAttack attack, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<int> DeleteAttackAsync(Guid minionId, Guid attackId, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task<bool> AttackWeaponTagAssignedAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken) => Task.FromResult(false);

        public Task AssignAttackWeaponTagAsync(MinionAttackWeaponTag value, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<int> RemoveAttackWeaponTagAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task<IReadOnlyList<MinionPower>> GetPowersAsync(Guid minionId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MinionPower>>([]);

        public Task<MinionPower?> GetPowerAsync(Guid minionId, Guid powerId, CancellationToken cancellationToken) =>
            Task.FromResult<MinionPower?>(null);

        public Task AddPowerAsync(MinionPower power, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<int> DeletePowerAsync(Guid minionId, Guid powerId, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task<IReadOnlyList<MinionArmor>> GetArmorsAsync(Guid minionId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MinionArmor>>([]);

        public Task<MinionArmor?> GetArmorAsync(Guid minionId, Guid armorId, CancellationToken cancellationToken) =>
            Task.FromResult<MinionArmor?>(null);

        public Task AddArmorAsync(MinionArmor armor, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<int> DeleteArmorAsync(Guid minionId, Guid armorId, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task<IReadOnlyList<MinionWeakness>> GetWeaknessesAsync(Guid minionId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MinionWeakness>>([]);

        public Task<MinionWeakness?> GetWeaknessAsync(Guid minionId, Guid weaknessId, CancellationToken cancellationToken) =>
            Task.FromResult<MinionWeakness?>(null);

        public Task AddWeaknessAsync(MinionWeakness weakness, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<int> DeleteWeaknessAsync(Guid minionId, Guid weaknessId, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task<IReadOnlyList<MinionCustomMove>> GetCustomMovesAsync(Guid minionId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MinionCustomMove>>([]);

        public Task<MinionCustomMove?> GetCustomMoveAsync(Guid minionId, Guid moveId, CancellationToken cancellationToken) =>
            Task.FromResult<MinionCustomMove?>(null);

        public Task AddCustomMoveAsync(MinionCustomMove move, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<int> DeleteCustomMoveAsync(Guid minionId, Guid moveId, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls += 1;
            return Task.CompletedTask;
        }
    }
}
