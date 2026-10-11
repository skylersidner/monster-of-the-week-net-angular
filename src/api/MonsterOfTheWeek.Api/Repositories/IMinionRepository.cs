using Microsoft.EntityFrameworkCore.Storage;
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

    /// <summary>Bare ids, not the full list DTO — <see cref="MonsterOfTheWeek.Api.Services.MonsterService.DeleteAsync"/>
    /// needs these only to clean up each Minion's images before the Monster delete cascades them away
    /// at the DB level (phases.md Phase 3, resource-images).</summary>
    Task<IReadOnlyList<Guid>> GetIdsByMonsterIdAsync(Guid monsterId, CancellationToken cancellationToken);
    Task<IReadOnlyList<MinionListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<Minion?> GetDetailAsync(Guid id, CancellationToken cancellationToken);
    Task<Minion?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);
    Task AddAsync(Minion minion, CancellationToken cancellationToken);
    Task<int> DeleteMinionAsync(Guid id, CancellationToken cancellationToken);

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

    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>See <see cref="IMonsterRepository.BeginTransactionAsync"/> for the full reasoning —
    /// same shape, used by <see cref="MonsterOfTheWeek.Api.Services.MinionService.DeleteAsync"/> to
    /// cover its own owner-delete image cleanup.</summary>
    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
}
