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
            new UpsertMonsterRequest("The Horror", "desc", 7, missingMonsterTypeId, null),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(ServiceErrorType.Validation, result.Error.Type);
        Assert.Contains(missingMonsterTypeId.ToString(), result.Error.Message);
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

    private sealed class FakeMonsterRepository : IMonsterRepository
    {
        public bool MysteryExists { get; init; }
        public bool MonsterExists { get; init; } = true;
        public bool MonsterTypeExists { get; init; } = true;
        public bool MinionTypeExists { get; init; } = true;
        public bool WeaponTagExists { get; init; }
        public bool AttackExists { get; init; }
        public bool AttackWeaponTagAssigned { get; init; }
        public int AssignAttackWeaponTagCalls { get; private set; }
        public int SaveChangesCalls { get; private set; }

        public Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken) => Task.FromResult(MysteryExists);
        public Task<bool> MonsterExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(MonsterExists);
        public Task<bool> MonsterTypeExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(MonsterTypeExists);
        public Task<bool> MinionTypeExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(MinionTypeExists);
        public Task<bool> WeaponTagExistsAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(WeaponTagExists);
        public Task<IReadOnlyList<Monster>> GetMonstersByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<Monster>>([]);
        public Task<Monster?> GetMonsterDetailAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult<Monster?>(new Monster { MysteryId = Guid.NewGuid(), Name = "Monster" });
        public Task<Monster?> GetMonsterForUpdateAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult<Monster?>(new Monster { MysteryId = Guid.NewGuid(), Name = "Monster" });
        public Task AddMonsterAsync(Monster monster, CancellationToken cancellationToken) => Task.CompletedTask;
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
