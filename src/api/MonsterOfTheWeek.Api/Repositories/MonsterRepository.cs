using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public sealed class MonsterRepository(MotwDbContext dbContext) : IMonsterRepository
{
    public Task<bool> MysteryExistsAsync(Guid mysteryId, CancellationToken cancellationToken) =>
        dbContext.Mysteries.AnyAsync(x => x.Id == mysteryId, cancellationToken);

    public Task<bool> MonsterExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Monsters.AnyAsync(x => x.Id == id, cancellationToken);

    public Task<bool> MonsterTypeExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.MonsterTypes.AnyAsync(x => x.Id == id, cancellationToken);

    public Task<bool> MonsterArchetypeExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.MonsterArchetypes.AnyAsync(x => x.Id == id, cancellationToken);

    public Task<bool> WeaponTagExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.WeaponTags.AnyAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<MonsterListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        await dbContext.Monsters
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new MonsterListItemResponse(
                x.Id,
                x.Mysteries.Select(mm => mm.MysteryId).ToList(),
                x.Name,
                x.Description,
                x.HarmCapacity,
                new TypeRefResponse(x.MonsterTypeId, x.MonsterType.Name, x.MonsterType.Motivation),
                new MonsterArchetypeResponse(x.MonsterArchetypeId, x.MonsterArchetype.Name, x.MonsterArchetype.Description),
                x.Attacks.Count,
                x.Powers.Count,
                x.Armors.Count,
                x.Weaknesses.Count,
                x.Minions.Count,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<MonsterListItemResponse>> GetMonstersByMysteryIdAsync(Guid mysteryId, CancellationToken cancellationToken) =>
        await dbContext.Monsters
            .AsNoTracking()
            .Where(x => x.Mysteries.Any(mm => mm.MysteryId == mysteryId))
            .OrderBy(x => x.Name)
            .Select(x => new MonsterListItemResponse(
                x.Id,
                x.Mysteries.Select(mm => mm.MysteryId).ToList(),
                x.Name,
                x.Description,
                x.HarmCapacity,
                new TypeRefResponse(x.MonsterTypeId, x.MonsterType.Name, x.MonsterType.Motivation),
                new MonsterArchetypeResponse(x.MonsterArchetypeId, x.MonsterArchetype.Name, x.MonsterArchetype.Description),
                x.Attacks.Count,
                x.Powers.Count,
                x.Armors.Count,
                x.Weaknesses.Count,
                x.Minions.Count,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

    public Task<Monster?> GetMonsterDetailAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Monsters
            .AsNoTracking()
            .Include(x => x.MonsterType)
            .Include(x => x.MonsterArchetype)
            .Include(x => x.Mysteries)
            .Include(x => x.Attacks)
            .ThenInclude(x => x.MonsterAttackWeaponTags)
            .ThenInclude(x => x.WeaponTag)
            .Include(x => x.Powers)
            .Include(x => x.Armors)
            .Include(x => x.Weaknesses)
            .Include(x => x.CustomMoves)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Monster?> GetMonsterForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Monsters.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task AddMonsterAsync(Monster monster, CancellationToken cancellationToken)
    {
        dbContext.Monsters.Add(monster);
        return Task.CompletedTask;
    }

    public Task LinkMonsterToMysteryAsync(MysteryMonster link, CancellationToken cancellationToken)
    {
        dbContext.MysteryMonsters.Add(link);
        return Task.CompletedTask;
    }

    public Task<int> UnlinkMonsterFromMysteryAsync(Guid mysteryId, Guid monsterId, CancellationToken cancellationToken) =>
        dbContext.MysteryMonsters
            .Where(x => x.MysteryId == mysteryId && x.MonsterId == monsterId)
            .ExecuteDeleteAsync(cancellationToken);

    public Task<int> DeleteMonsterAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Monsters
            .Where(x => x.Id == id)
            .ExecuteDeleteAsync(cancellationToken);

    public Task<bool> MonsterLinkedToMysteryAsync(Guid mysteryId, Guid monsterId, CancellationToken cancellationToken) =>
        dbContext.MysteryMonsters.AnyAsync(x => x.MysteryId == mysteryId && x.MonsterId == monsterId, cancellationToken);

    public async Task<IReadOnlyList<MonsterAttack>> GetAttacksAsync(Guid monsterId, CancellationToken cancellationToken) =>
        await dbContext.MonsterAttacks
            .AsNoTracking()
            .Where(x => x.MonsterId == monsterId)
            .Include(x => x.MonsterAttackWeaponTags)
            .ThenInclude(x => x.WeaponTag)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task<MonsterAttack?> GetAttackAsync(Guid monsterId, Guid attackId, bool includeTags, CancellationToken cancellationToken)
    {
        var query = dbContext.MonsterAttacks.Where(x => x.Id == attackId && x.MonsterId == monsterId);
        if (includeTags)
        {
            query = query
                .Include(x => x.MonsterAttackWeaponTags)
                .ThenInclude(x => x.WeaponTag);
        }

        return query.FirstOrDefaultAsync(cancellationToken);
    }

    public Task AddAttackAsync(MonsterAttack attack, CancellationToken cancellationToken)
    {
        dbContext.MonsterAttacks.Add(attack);
        return Task.CompletedTask;
    }

    public Task<int> DeleteAttackAsync(Guid monsterId, Guid attackId, CancellationToken cancellationToken) =>
        dbContext.MonsterAttacks.Where(x => x.Id == attackId && x.MonsterId == monsterId).ExecuteDeleteAsync(cancellationToken);

    public Task<bool> AttackWeaponTagAssignedAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken) =>
        dbContext.MonsterAttackWeaponTags.AnyAsync(x => x.MonsterAttackId == attackId && x.WeaponTagId == tagId, cancellationToken);

    public Task AssignAttackWeaponTagAsync(MonsterAttackWeaponTag value, CancellationToken cancellationToken)
    {
        dbContext.MonsterAttackWeaponTags.Add(value);
        return Task.CompletedTask;
    }

    public Task<int> RemoveAttackWeaponTagAsync(Guid attackId, Guid tagId, CancellationToken cancellationToken) =>
        dbContext.MonsterAttackWeaponTags.Where(x => x.MonsterAttackId == attackId && x.WeaponTagId == tagId).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<MonsterPower>> GetPowersAsync(Guid monsterId, CancellationToken cancellationToken) =>
        await dbContext.MonsterPowers.AsNoTracking().Where(x => x.MonsterId == monsterId).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public Task<MonsterPower?> GetPowerAsync(Guid monsterId, Guid powerId, CancellationToken cancellationToken) =>
        dbContext.MonsterPowers.FirstOrDefaultAsync(x => x.Id == powerId && x.MonsterId == monsterId, cancellationToken);

    public Task AddPowerAsync(MonsterPower value, CancellationToken cancellationToken)
    {
        dbContext.MonsterPowers.Add(value);
        return Task.CompletedTask;
    }

    public Task<int> DeletePowerAsync(Guid monsterId, Guid powerId, CancellationToken cancellationToken) =>
        dbContext.MonsterPowers.Where(x => x.Id == powerId && x.MonsterId == monsterId).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<MonsterArmor>> GetArmorsAsync(Guid monsterId, CancellationToken cancellationToken) =>
        await dbContext.MonsterArmors.AsNoTracking().Where(x => x.MonsterId == monsterId).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public Task<MonsterArmor?> GetArmorAsync(Guid monsterId, Guid armorId, CancellationToken cancellationToken) =>
        dbContext.MonsterArmors.FirstOrDefaultAsync(x => x.Id == armorId && x.MonsterId == monsterId, cancellationToken);

    public Task AddArmorAsync(MonsterArmor value, CancellationToken cancellationToken)
    {
        dbContext.MonsterArmors.Add(value);
        return Task.CompletedTask;
    }

    public Task<int> DeleteArmorAsync(Guid monsterId, Guid armorId, CancellationToken cancellationToken) =>
        dbContext.MonsterArmors.Where(x => x.Id == armorId && x.MonsterId == monsterId).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<MonsterWeakness>> GetWeaknessesAsync(Guid monsterId, CancellationToken cancellationToken) =>
        await dbContext.MonsterWeaknesses.AsNoTracking().Where(x => x.MonsterId == monsterId).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public Task<MonsterWeakness?> GetWeaknessAsync(Guid monsterId, Guid weaknessId, CancellationToken cancellationToken) =>
        dbContext.MonsterWeaknesses.FirstOrDefaultAsync(x => x.Id == weaknessId && x.MonsterId == monsterId, cancellationToken);

    public Task AddWeaknessAsync(MonsterWeakness value, CancellationToken cancellationToken)
    {
        dbContext.MonsterWeaknesses.Add(value);
        return Task.CompletedTask;
    }

    public Task<int> DeleteWeaknessAsync(Guid monsterId, Guid weaknessId, CancellationToken cancellationToken) =>
        dbContext.MonsterWeaknesses.Where(x => x.Id == weaknessId && x.MonsterId == monsterId).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<MonsterCustomMove>> GetCustomMovesAsync(Guid monsterId, CancellationToken cancellationToken) =>
        await dbContext.MonsterCustomMoves.AsNoTracking().Where(x => x.MonsterId == monsterId).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public Task<MonsterCustomMove?> GetCustomMoveAsync(Guid monsterId, Guid moveId, CancellationToken cancellationToken) =>
        dbContext.MonsterCustomMoves.FirstOrDefaultAsync(x => x.Id == moveId && x.MonsterId == monsterId, cancellationToken);

    public Task AddCustomMoveAsync(MonsterCustomMove value, CancellationToken cancellationToken)
    {
        dbContext.MonsterCustomMoves.Add(value);
        return Task.CompletedTask;
    }

    public Task<int> DeleteCustomMoveAsync(Guid monsterId, Guid moveId, CancellationToken cancellationToken) =>
        dbContext.MonsterCustomMoves.Where(x => x.Id == moveId && x.MonsterId == monsterId).ExecuteDeleteAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
