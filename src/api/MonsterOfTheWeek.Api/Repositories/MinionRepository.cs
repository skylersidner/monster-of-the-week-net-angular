using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public sealed class MinionRepository(MotwDbContext dbContext) : IMinionRepository
{
    public Task<bool> MonsterExistsAsync(Guid monsterId, CancellationToken cancellationToken) =>
        dbContext.Monsters.AnyAsync(x => x.Id == monsterId, cancellationToken);

    public Task<bool> MinionExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Minions.AnyAsync(x => x.Id == id, cancellationToken);

    public Task<bool> MinionTypeExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.MinionTypes.AnyAsync(x => x.Id == id, cancellationToken);

    public Task<bool> WeaponTagExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.WeaponTags.AnyAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<MinionListItemResponse>> GetByMonsterIdAsync(Guid monsterId, CancellationToken cancellationToken) =>
        await dbContext.Minions
            .AsNoTracking()
            .Where(x => x.MonsterId == monsterId)
            .OrderBy(x => x.Name)
            .Select(x => new MinionListItemResponse(
                x.Id,
                x.MonsterId,
                x.Monster.Name,
                x.Name,
                x.Description,
                x.HarmCapacity,
                new TypeRefResponse(x.MinionTypeId, x.MinionType.Name, x.MinionType.Motivation),
                x.Attacks.Count,
                x.Powers.Count,
                x.Armors.Count,
                x.Weaknesses.Count,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<MinionListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        await dbContext.Minions
            .AsNoTracking()
            .OrderBy(x => x.Monster.Name)
            .ThenBy(x => x.Name)
            .Select(x => new MinionListItemResponse(
                x.Id,
                x.MonsterId,
                x.Monster.Name,
                x.Name,
                x.Description,
                x.HarmCapacity,
                new TypeRefResponse(x.MinionTypeId, x.MinionType.Name, x.MinionType.Motivation),
                x.Attacks.Count,
                x.Powers.Count,
                x.Armors.Count,
                x.Weaknesses.Count,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

    public Task<Minion?> GetDetailAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Minions
            .AsNoTracking()
            .Include(x => x.Monster)
            .Include(x => x.MinionType)
            .Include(x => x.Attacks)
            .ThenInclude(x => x.MinionAttackWeaponTags)
            .ThenInclude(x => x.WeaponTag)
            .Include(x => x.Powers)
            .Include(x => x.Armors)
            .Include(x => x.Weaknesses)
            .Include(x => x.CustomMoves)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Minion?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Minions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task AddAsync(Minion minion, CancellationToken cancellationToken)
    {
        dbContext.Minions.Add(minion);
        return Task.CompletedTask;
    }

    public Task<int> DeleteMinionAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Minions.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<MinionAttack>> GetAttacksAsync(Guid minionId, CancellationToken cancellationToken) =>
        await dbContext.MinionAttacks
            .AsNoTracking()
            .Where(x => x.MinionId == minionId)
            .Include(x => x.MinionAttackWeaponTags)
            .ThenInclude(x => x.WeaponTag)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task<MinionAttack?> GetAttackAsync(Guid minionId, Guid attackId, bool includeTags, CancellationToken cancellationToken)
    {
        var query = dbContext.MinionAttacks.Where(x => x.Id == attackId && x.MinionId == minionId);
        if (includeTags)
        {
            query = query
                .Include(x => x.MinionAttackWeaponTags)
                .ThenInclude(x => x.WeaponTag);
        }

        return query.FirstOrDefaultAsync(cancellationToken);
    }

    public Task AddAttackAsync(MinionAttack attack, CancellationToken cancellationToken)
    {
        dbContext.MinionAttacks.Add(attack);
        return Task.CompletedTask;
    }

    public Task<int> DeleteAttackAsync(Guid minionId, Guid attackId, CancellationToken cancellationToken) =>
        dbContext.MinionAttacks.Where(x => x.Id == attackId && x.MinionId == minionId).ExecuteDeleteAsync(cancellationToken);

    public Task<bool> AttackWeaponTagAssignedAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken) =>
        dbContext.MinionAttackWeaponTags.AnyAsync(x => x.MinionAttackId == attackId && x.WeaponTagId == tagId, cancellationToken);

    public Task AssignAttackWeaponTagAsync(MinionAttackWeaponTag value, CancellationToken cancellationToken)
    {
        dbContext.MinionAttackWeaponTags.Add(value);
        return Task.CompletedTask;
    }

    public Task<int> RemoveAttackWeaponTagAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken) =>
        dbContext.MinionAttackWeaponTags.Where(x => x.MinionAttackId == attackId && x.WeaponTagId == tagId).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<MinionPower>> GetPowersAsync(Guid minionId, CancellationToken cancellationToken) =>
        await dbContext.MinionPowers.AsNoTracking().Where(x => x.MinionId == minionId).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public Task<MinionPower?> GetPowerAsync(Guid minionId, Guid powerId, CancellationToken cancellationToken) =>
        dbContext.MinionPowers.FirstOrDefaultAsync(x => x.Id == powerId && x.MinionId == minionId, cancellationToken);

    public Task AddPowerAsync(MinionPower power, CancellationToken cancellationToken)
    {
        dbContext.MinionPowers.Add(power);
        return Task.CompletedTask;
    }

    public Task<int> DeletePowerAsync(Guid minionId, Guid powerId, CancellationToken cancellationToken) =>
        dbContext.MinionPowers.Where(x => x.Id == powerId && x.MinionId == minionId).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<MinionArmor>> GetArmorsAsync(Guid minionId, CancellationToken cancellationToken) =>
        await dbContext.MinionArmors.AsNoTracking().Where(x => x.MinionId == minionId).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public Task<MinionArmor?> GetArmorAsync(Guid minionId, Guid armorId, CancellationToken cancellationToken) =>
        dbContext.MinionArmors.FirstOrDefaultAsync(x => x.Id == armorId && x.MinionId == minionId, cancellationToken);

    public Task AddArmorAsync(MinionArmor armor, CancellationToken cancellationToken)
    {
        dbContext.MinionArmors.Add(armor);
        return Task.CompletedTask;
    }

    public Task<int> DeleteArmorAsync(Guid minionId, Guid armorId, CancellationToken cancellationToken) =>
        dbContext.MinionArmors.Where(x => x.Id == armorId && x.MinionId == minionId).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<MinionWeakness>> GetWeaknessesAsync(Guid minionId, CancellationToken cancellationToken) =>
        await dbContext.MinionWeaknesses.AsNoTracking().Where(x => x.MinionId == minionId).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public Task<MinionWeakness?> GetWeaknessAsync(Guid minionId, Guid weaknessId, CancellationToken cancellationToken) =>
        dbContext.MinionWeaknesses.FirstOrDefaultAsync(x => x.Id == weaknessId && x.MinionId == minionId, cancellationToken);

    public Task AddWeaknessAsync(MinionWeakness weakness, CancellationToken cancellationToken)
    {
        dbContext.MinionWeaknesses.Add(weakness);
        return Task.CompletedTask;
    }

    public Task<int> DeleteWeaknessAsync(Guid minionId, Guid weaknessId, CancellationToken cancellationToken) =>
        dbContext.MinionWeaknesses.Where(x => x.Id == weaknessId && x.MinionId == minionId).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<MinionCustomMove>> GetCustomMovesAsync(Guid minionId, CancellationToken cancellationToken) =>
        await dbContext.MinionCustomMoves.AsNoTracking().Where(x => x.MinionId == minionId).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public Task<MinionCustomMove?> GetCustomMoveAsync(Guid minionId, Guid moveId, CancellationToken cancellationToken) =>
        dbContext.MinionCustomMoves.FirstOrDefaultAsync(x => x.Id == moveId && x.MinionId == minionId, cancellationToken);

    public Task AddCustomMoveAsync(MinionCustomMove move, CancellationToken cancellationToken)
    {
        dbContext.MinionCustomMoves.Add(move);
        return Task.CompletedTask;
    }

    public Task<int> DeleteCustomMoveAsync(Guid minionId, Guid moveId, CancellationToken cancellationToken) =>
        dbContext.MinionCustomMoves.Where(x => x.Id == moveId && x.MinionId == minionId).ExecuteDeleteAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
