using System.ComponentModel.DataAnnotations;
using System.Reflection;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Tests.Services;

public sealed class MonsterServiceTests
{
    [Fact]
    public async Task CreateAsync_ReturnsValidation_WhenMonsterTypeDoesNotExist()
    {
        var repository = new FakeMonsterRepository
        {
            MysteryExists = true,
            MonsterTypeExists = false
        };
        var service = new MonsterService(repository);
        var missingMonsterTypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            Guid.NewGuid(),
            new UpsertMonsterRequest("The Horror", "desc", 7, missingMonsterTypeId, Guid.NewGuid()),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingMonsterTypeId.ToString(), result.Error.Message);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_CreatesStandaloneMonster_WithEmptyMysteryIds()
    {
        var repository = new FakeMonsterRepository();
        var service = new MonsterService(repository);

        var result = await service.CreateAsync(
            new UpsertMonsterRequest("Standalone Horror", "desc", 6, Guid.NewGuid(), Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Empty(result.Value!.MysteryIds);
        Assert.Equal(0, repository.LinkMonsterToMysteryCalls);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_ReturnsValidation_WhenMonsterTypeDoesNotExist()
    {
        var repository = new FakeMonsterRepository
        {
            MonsterTypeExists = false
        };
        var service = new MonsterService(repository);
        var missingMonsterTypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            new UpsertMonsterRequest("The Horror", "desc", 7, missingMonsterTypeId, Guid.NewGuid()),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingMonsterTypeId.ToString(), result.Error.Message);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_ReturnsValidation_WhenMonsterArchetypeDoesNotExist()
    {
        var repository = new FakeMonsterRepository
        {
            MonsterArchetypeExists = false
        };
        var service = new MonsterService(repository);
        var missingMonsterArchetypeId = Guid.NewGuid();

        var result = await service.CreateAsync(
            new UpsertMonsterRequest("The Horror", "desc", 7, Guid.NewGuid(), missingMonsterArchetypeId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingMonsterArchetypeId.ToString(), result.Error.Message);
    }

    [Fact]
    public async Task CreateAsync_NoMysteryId_MonsterIsRetrievableViaGetByIdAsync_AndAppearsInGetAllAsync()
    {
        var repository = new FakeMonsterRepository();
        var service = new MonsterService(repository);

        var createResult = await service.CreateAsync(
            new UpsertMonsterRequest("Standalone Horror", "desc", 6, Guid.NewGuid(), Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(createResult.IsSuccess);
        var createdId = createResult.Value!.Id;

        var fetched = await service.GetByIdAsync(createdId, CancellationToken.None);
        Assert.NotNull(fetched);
        Assert.Equal("Standalone Horror", fetched!.Name);
        Assert.Empty(fetched.MysteryIds);

        var all = await service.GetAllAsync(CancellationToken.None);
        Assert.Contains(all, x => x.Id == createdId);
    }

    [Fact]
    public async Task AssignAttackWeaponTagAsync_DoesNotDuplicate_WhenAlreadyAssigned()
    {
        var repository = new FakeMonsterRepository
        {
            AttackExists = true,
            WeaponTagExists = true,
            AttackWeaponTagAssigned = true
        };
        var service = new MonsterService(repository);

        var result = await service.AssignAttackWeaponTagAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            new AssignWeaponTagRequest(Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, repository.AssignAttackWeaponTagCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
    }

    // Upsert*Request records carry their DataAnnotations on the primary constructor's
    // parameters ([param: Required, MaxLength]/[param: Range], matching UpsertMysteryRequest's
    // established precedent), not on the generated properties — so these attributes are read via
    // ParameterInfo, not PropertyInfo/Validator.TryValidateObject. This covers Monster's own
    // Name field plus all five sub-resource Name fields (Attack/Power/Armor/Weakness/CustomMove),
    // each of which live-verified the identical blank/whitespace-persists-as-"" and
    // oversized-name-500s gaps this fix closes.
    public static IEnumerable<object[]> NameRequestTypes =>
    [
        [typeof(UpsertMonsterRequest)],
        [typeof(UpsertMonsterAttackRequest)],
        [typeof(UpsertMonsterPowerRequest)],
        [typeof(UpsertMonsterArmorRequest)],
        [typeof(UpsertMonsterWeaknessRequest)],
        [typeof(UpsertCustomMoveRequest)],
    ];

    public static IEnumerable<object[]> HarmFields =>
    [
        [typeof(UpsertMonsterRequest), "HarmCapacity"],
        [typeof(UpsertMonsterAttackRequest), "Harm"],
        [typeof(UpsertMonsterArmorRequest), "HarmSoak"],
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

    private sealed class FakeMonsterRepository : IMonsterRepository
    {
        public bool MysteryExists { get; init; }
        public bool MonsterExists { get; init; } = true;
        public bool MonsterTypeExists { get; init; } = true;
        public bool MonsterArchetypeExists { get; init; } = true;
        public bool MinionTypeExists { get; init; } = true;
        public bool WeaponTagExists { get; init; }
        public bool AttackExists { get; init; }
        public bool AttackWeaponTagAssigned { get; init; }
        public int AssignAttackWeaponTagCalls { get; private set; }
        public int SaveChangesCalls { get; private set; }
        public int LinkMonsterToMysteryCalls { get; private set; }

        private readonly List<Monster> _monsters = [];

        public Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken) => Task.FromResult(MysteryExists);
        public Task<bool> MonsterExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(MonsterExists);
        public Task<bool> MonsterTypeExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(MonsterTypeExists);
        public Task<bool> MonsterArchetypeExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(MonsterArchetypeExists);
        public Task<bool> MinionTypeExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(MinionTypeExists);
        public Task<bool> WeaponTagExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(WeaponTagExists);

        public Task<IReadOnlyList<MonsterListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MonsterListItemResponse>>(_monsters.Select(ToListItemResponse).ToList());

        public Task<IReadOnlyList<MonsterListItemResponse>> GetMonstersByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<MonsterListItemResponse>>([]);

        public Task<Monster?> GetMonsterDetailAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<Monster?>(_monsters.FirstOrDefault(x => x.Id == id)
                ?? new Monster { Name = "Monster", MonsterType = new MonsterType { Name = "Type", Motivation = "Mot" }, MonsterArchetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat" } });

        public Task<Monster?> GetMonsterForUpdateAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult<Monster?>(new Monster { Name = "Monster" });

        public Task AddMonsterAsync(Monster monster, CancellationToken cancellationToken)
        {
            monster.MonsterType = new MonsterType { Id = monster.MonsterTypeId, Name = "Type", Motivation = "Mot" };
            monster.MonsterArchetype = new MonsterArchetype { Id = monster.MonsterArchetypeId, Name = "Heavy Hitter", Description = "It is the threat" };
            _monsters.Add(monster);
            return Task.CompletedTask;
        }

        public Task LinkMonsterToMysteryAsync(MysteryMonster link, CancellationToken cancellationToken)
        {
            LinkMonsterToMysteryCalls += 1;
            return Task.CompletedTask;
        }

        private static MonsterListItemResponse ToListItemResponse(Monster monster) =>
            new(
                monster.Id,
                monster.Mysteries.Select(mm => mm.MysteryId).ToList(),
                monster.Name,
                monster.Description,
                monster.HarmCapacity,
                new TypeRefResponse(monster.MonsterTypeId, monster.MonsterType.Name, monster.MonsterType.Motivation),
                new MonsterArchetypeResponse(monster.MonsterArchetypeId, monster.MonsterArchetype.Name, monster.MonsterArchetype.Description),
                monster.Attacks.Count,
                monster.Powers.Count,
                monster.Armors.Count,
                monster.Weaknesses.Count,
                monster.Minions.Count,
                monster.CreatedAt);
        public Task<int> UnlinkMonsterFromMysteryAsync(Guid mysteryId, Guid monsterId, CancellationToken cancellationToken) => Task.FromResult(1);
        public Task<bool> MonsterLinkedToMysteryAsync(Guid mysteryId, Guid monsterId, CancellationToken cancellationToken) => Task.FromResult(false);
        public Task<int> DeleteMonsterAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(1);
        public Task<IReadOnlyList<MonsterAttack>> GetAttacksAsync(Guid monsterId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<MonsterAttack>>([]);
        public Task<MonsterAttack?> GetAttackAsync(Guid monsterId, Guid attackId, bool includeTags, CancellationToken cancellationToken)
            => Task.FromResult(AttackExists ? new MonsterAttack { MonsterId = monsterId, Name = "Claw", Harm = 2 } : null);
        public Task AddAttackAsync(MonsterAttack attack, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<int> DeleteAttackAsync(Guid monsterId, Guid attackId, CancellationToken cancellationToken) => Task.FromResult(1);
        public Task<bool> AttackWeaponTagAssignedAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken) => Task.FromResult(AttackWeaponTagAssigned);

        public Task AssignAttackWeaponTagAsync(MonsterAttackWeaponTag value, CancellationToken cancellationToken)
        {
            AssignAttackWeaponTagCalls += 1;
            return Task.CompletedTask;
        }

        public Task<int> RemoveAttackWeaponTagAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken) => Task.FromResult(1);
        public Task<IReadOnlyList<MonsterPower>> GetPowersAsync(Guid monsterId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<MonsterPower>>([]);
        public Task<MonsterPower?> GetPowerAsync(Guid monsterId, Guid powerId, CancellationToken cancellationToken) => Task.FromResult<MonsterPower?>(null);
        public Task AddPowerAsync(MonsterPower value, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<int> DeletePowerAsync(Guid monsterId, Guid powerId, CancellationToken cancellationToken) => Task.FromResult(1);
        public Task<IReadOnlyList<MonsterArmor>> GetArmorsAsync(Guid monsterId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<MonsterArmor>>([]);
        public Task<MonsterArmor?> GetArmorAsync(Guid monsterId, Guid armorId, CancellationToken cancellationToken) => Task.FromResult<MonsterArmor?>(null);
        public Task AddArmorAsync(MonsterArmor value, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<int> DeleteArmorAsync(Guid monsterId, Guid armorId, CancellationToken cancellationToken) => Task.FromResult(1);
        public Task<IReadOnlyList<MonsterWeakness>> GetWeaknessesAsync(Guid monsterId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<MonsterWeakness>>([]);
        public Task<MonsterWeakness?> GetWeaknessAsync(Guid monsterId, Guid weaknessId, CancellationToken cancellationToken) => Task.FromResult<MonsterWeakness?>(null);
        public Task AddWeaknessAsync(MonsterWeakness value, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<int> DeleteWeaknessAsync(Guid monsterId, Guid weaknessId, CancellationToken cancellationToken) => Task.FromResult(1);
        public Task<IReadOnlyList<MonsterCustomMove>> GetCustomMovesAsync(Guid monsterId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<MonsterCustomMove>>([]);
        public Task<MonsterCustomMove?> GetCustomMoveAsync(Guid monsterId, Guid moveId, CancellationToken cancellationToken) => Task.FromResult<MonsterCustomMove?>(null);
        public Task AddCustomMoveAsync(MonsterCustomMove value, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<int> DeleteCustomMoveAsync(Guid monsterId, Guid moveId, CancellationToken cancellationToken) => Task.FromResult(1);

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls += 1;
            return Task.CompletedTask;
        }
    }
}
