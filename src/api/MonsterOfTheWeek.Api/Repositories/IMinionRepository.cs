using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IMinionRepository
{
    Task<bool> MonsterExistsAsync(Guid monsterId, CancellationToken cancellationToken);
    Task<bool> MinionExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> MinionTypeExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> WeaponTagExistsAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<MinionListItemResponse>> GetByMonsterIdAsync(Guid monsterId, CancellationToken cancellationToken);
    Task<Minion?> GetDetailAsync(Guid id, CancellationToken cancellationToken);
    Task<Minion?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);
    Task AddAsync(Minion minion, CancellationToken cancellationToken);

    Task<IReadOnlyList<MinionAttack>> GetAttacksAsync(Guid minionId, CancellationToken cancellationToken);
    Task<MinionAttack?> GetAttackAsync(Guid minionId, Guid attackId, bool includeTags, CancellationToken cancellationToken);
    Task AddAttackAsync(MinionAttack attack, CancellationToken cancellationToken);
    Task<int> DeleteAttackAsync(Guid minionId, Guid attackId, CancellationToken cancellationToken);
    Task<bool> AttackWeaponTagAssignedAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken);
    Task AssignAttackWeaponTagAsync(MinionAttackWeaponTag value, CancellationToken cancellationToken);
    Task<int> RemoveAttackWeaponTagAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MinionPower>> GetPowersAsync(Guid minionId, CancellationToken cancellationToken);
    Task<MinionPower?> GetPowerAsync(Guid minionId, Guid powerId, CancellationToken cancellationToken);
    Task AddPowerAsync(MinionPower power, CancellationToken cancellationToken);
    Task<int> DeletePowerAsync(Guid minionId, Guid powerId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MinionArmor>> GetArmorsAsync(Guid minionId, CancellationToken cancellationToken);
    Task<MinionArmor?> GetArmorAsync(Guid minionId, Guid armorId, CancellationToken cancellationToken);
    Task AddArmorAsync(MinionArmor armor, CancellationToken cancellationToken);
    Task<int> DeleteArmorAsync(Guid minionId, Guid armorId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MinionWeakness>> GetWeaknessesAsync(Guid minionId, CancellationToken cancellationToken);
    Task<MinionWeakness?> GetWeaknessAsync(Guid minionId, Guid weaknessId, CancellationToken cancellationToken);
    Task AddWeaknessAsync(MinionWeakness weakness, CancellationToken cancellationToken);
    Task<int> DeleteWeaknessAsync(Guid minionId, Guid weaknessId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MinionCustomMove>> GetCustomMovesAsync(Guid minionId, CancellationToken cancellationToken);
    Task<MinionCustomMove?> GetCustomMoveAsync(Guid minionId, Guid moveId, CancellationToken cancellationToken);
    Task AddCustomMoveAsync(MinionCustomMove move, CancellationToken cancellationToken);
    Task<int> DeleteCustomMoveAsync(Guid minionId, Guid moveId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
