using Microsoft.EntityFrameworkCore.Storage;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IMonsterRepository
{
    Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<bool> MonsterExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> MonsterTypeExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> MonsterArchetypeExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> WeaponTagExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<MonsterListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<MonsterListItemResponse>> GetMonstersByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<Monster?> GetMonsterDetailAsync(Guid id, CancellationToken cancellationToken);
    Task<Monster?> GetMonsterForUpdateAsync(Guid id, CancellationToken cancellationToken);
    Task AddMonsterAsync(Monster monster, CancellationToken cancellationToken);
    Task LinkMonsterToMysteryAsync(MysteryMonster link, CancellationToken cancellationToken);

    /// <summary>
    /// Inserts one bridge row and saves it in one step, succeeding if a concurrent insert of the
    /// same membership won the race and throwing for any other failure. See the implementation.
    /// </summary>
    Task LinkMonsterToMysteryAndSaveAsync(MysteryMonster link, CancellationToken cancellationToken);

    Task<int> UnlinkMonsterFromMysteryAsync(Guid mysteryId, Guid monsterId, CancellationToken cancellationToken);
    Task<bool> MonsterLinkedToMysteryAsync(Guid mysteryId, Guid monsterId, CancellationToken cancellationToken);
    Task<int> DeleteMonsterAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<MonsterAttack>> GetAttacksAsync(Guid monsterId, CancellationToken cancellationToken);
    Task<MonsterAttack?> GetAttackAsync(Guid monsterId, Guid attackId, bool includeTags, CancellationToken cancellationToken);
    Task AddAttackAsync(MonsterAttack attack, CancellationToken cancellationToken);
    Task<int> DeleteAttackAsync(Guid monsterId, Guid attackId, CancellationToken cancellationToken);

    Task<bool> AttackWeaponTagAssignedAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken);
    Task AssignAttackWeaponTagAsync(MonsterAttackWeaponTag value, CancellationToken cancellationToken);
    Task<int> RemoveAttackWeaponTagAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MonsterPower>> GetPowersAsync(Guid monsterId, CancellationToken cancellationToken);
    Task<MonsterPower?> GetPowerAsync(Guid monsterId, Guid powerId, CancellationToken cancellationToken);
    Task AddPowerAsync(MonsterPower value, CancellationToken cancellationToken);
    Task<int> DeletePowerAsync(Guid monsterId, Guid powerId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MonsterArmor>> GetArmorsAsync(Guid monsterId, CancellationToken cancellationToken);
    Task<MonsterArmor?> GetArmorAsync(Guid monsterId, Guid armorId, CancellationToken cancellationToken);
    Task AddArmorAsync(MonsterArmor value, CancellationToken cancellationToken);
    Task<int> DeleteArmorAsync(Guid monsterId, Guid armorId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MonsterWeakness>> GetWeaknessesAsync(Guid monsterId, CancellationToken cancellationToken);
    Task<MonsterWeakness?> GetWeaknessAsync(Guid monsterId, Guid weaknessId, CancellationToken cancellationToken);
    Task AddWeaknessAsync(MonsterWeakness value, CancellationToken cancellationToken);
    Task<int> DeleteWeaknessAsync(Guid monsterId, Guid weaknessId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MonsterCustomMove>> GetCustomMovesAsync(Guid monsterId, CancellationToken cancellationToken);
    Task<MonsterCustomMove?> GetCustomMoveAsync(Guid monsterId, Guid moveId, CancellationToken cancellationToken);
    Task AddCustomMoveAsync(MonsterCustomMove value, CancellationToken cancellationToken);
    Task<int> DeleteCustomMoveAsync(Guid monsterId, Guid moveId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// The first explicit transaction in this codebase (phases.md Phase 3, resource-images):
    /// <see cref="MonsterOfTheWeek.Api.Services.MonsterService.DeleteAsync"/> needs the Monster's
    /// own image cleanup, its Minions' image cleanup, and the Monster row delete to land
    /// together or not at all. Delegates straight to <c>Database.BeginTransactionAsync</c>, so
    /// work done against the same <c>MotwDbContext</c> instance through any other
    /// repository/service in the same DI scope — <c>IResourceImageService</c>
    /// included — participates in it.
    /// </summary>
    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
}
