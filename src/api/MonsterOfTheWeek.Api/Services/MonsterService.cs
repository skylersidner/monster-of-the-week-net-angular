using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class MonsterService(IMonsterRepository monsterRepository) : IMonsterService
{
    public async Task<ServiceResult<IReadOnlyList<MonsterListItemResponse>>> GetByMysteryAsync(Guid mysteryId, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MonsterListItemResponse>>.NotFound($"Mystery {mysteryId} was not found.");
        }

        var monsters = await monsterRepository.GetMonstersByMysteryIdAsync(mysteryId, cancellationToken);
        var responses = monsters
            .Select(x => new MonsterListItemResponse(
                x.Id,
                x.MysteryId,
                x.Name,
                x.Description,
                x.HarmCapacity,
                x.MonsterTypeId,
                x.MonsterType?.Name,
                x.MinionTypeId,
                x.MinionType?.Name))
            .ToList();

        return ServiceResult<IReadOnlyList<MonsterListItemResponse>>.Success(responses);
    }

    public async Task<ServiceResult<MonsterDetailResponse>> CreateAsync(
        Guid mysteryId,
        UpsertMonsterRequest request,
        CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return ServiceResult<MonsterDetailResponse>.NotFound($"Mystery {mysteryId} was not found.");
        }

        var validation = await ValidateTypesAsync(request.MonsterTypeId, request.MinionTypeId, cancellationToken);
        if (validation is not null)
        {
            return ServiceResult<MonsterDetailResponse>.Validation(validation);
        }

        var monster = new Monster
        {
            MysteryId = mysteryId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            HarmCapacity = request.HarmCapacity,
            MonsterTypeId = request.MonsterTypeId,
            MinionTypeId = request.MinionTypeId
        };

        await monsterRepository.AddMonsterAsync(monster, cancellationToken);
        await monsterRepository.SaveChangesAsync(cancellationToken);

        var detail = await GetByIdAsync(monster.Id, cancellationToken);
        return ServiceResult<MonsterDetailResponse>.Success(detail!);
    }

    public async Task<MonsterDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var monster = await monsterRepository.GetMonsterDetailAsync(id, cancellationToken);
        return monster is null ? null : ToDetailResponse(monster);
    }

    public async Task<ServiceResult<MonsterDetailResponse>> UpdateAsync(
        Guid id,
        UpsertMonsterRequest request,
        CancellationToken cancellationToken)
    {
        var monster = await monsterRepository.GetMonsterForUpdateAsync(id, cancellationToken);
        if (monster is null)
        {
            return ServiceResult<MonsterDetailResponse>.NotFound($"Monster {id} was not found.");
        }

        var validation = await ValidateTypesAsync(request.MonsterTypeId, request.MinionTypeId, cancellationToken);
        if (validation is not null)
        {
            return ServiceResult<MonsterDetailResponse>.Validation(validation);
        }

        monster.Name = request.Name.Trim();
        monster.Description = request.Description?.Trim();
        monster.HarmCapacity = request.HarmCapacity;
        monster.MonsterTypeId = request.MonsterTypeId;
        monster.MinionTypeId = request.MinionTypeId;
        await monsterRepository.SaveChangesAsync(cancellationToken);

        var detail = await GetByIdAsync(id, cancellationToken);
        return ServiceResult<MonsterDetailResponse>.Success(detail!);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken) =>
        await monsterRepository.DeleteMonsterAsync(id, cancellationToken) > 0;

    public async Task<ServiceResult<IReadOnlyList<MonsterAttackResponse>>> GetAttacksAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MonsterAttackResponse>>.NotFound($"Monster {id} was not found.");
        }

        var attacks = await monsterRepository.GetAttacksAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<MonsterAttackResponse>>.Success(attacks.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<MonsterAttackResponse>> CreateAttackAsync(
        Guid id,
        UpsertMonsterAttackRequest request,
        CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<MonsterAttackResponse>.NotFound($"Monster {id} was not found.");
        }

        var attack = new MonsterAttack
        {
            MonsterId = id,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Harm = request.Harm
        };

        await monsterRepository.AddAttackAsync(attack, cancellationToken);
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MonsterAttackResponse>.Success(attack.ToResponse());
    }

    public async Task<ServiceResult<MonsterAttackResponse>> UpdateAttackAsync(
        Guid id,
        Guid attackId,
        UpsertMonsterAttackRequest request,
        CancellationToken cancellationToken)
    {
        var attack = await monsterRepository.GetAttackAsync(id, attackId, includeTags: true, cancellationToken);
        if (attack is null)
        {
            return ServiceResult<MonsterAttackResponse>.NotFound($"Attack {attackId} was not found.");
        }

        attack.Name = request.Name.Trim();
        attack.Description = request.Description?.Trim();
        attack.Harm = request.Harm;
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MonsterAttackResponse>.Success(attack.ToResponse());
    }

    public async Task<bool> DeleteAttackAsync(Guid id, Guid attackId, CancellationToken cancellationToken) =>
        await monsterRepository.DeleteAttackAsync(id, attackId, cancellationToken) > 0;

    public async Task<ServiceResult<IReadOnlyList<WeaponTagRefResponse>>> GetAttackWeaponTagsAsync(
        Guid id,
        Guid attackId,
        CancellationToken cancellationToken)
    {
        var attack = await monsterRepository.GetAttackAsync(id, attackId, includeTags: true, cancellationToken);
        if (attack is null)
        {
            return ServiceResult<IReadOnlyList<WeaponTagRefResponse>>.NotFound($"Attack {attackId} was not found.");
        }

        return ServiceResult<IReadOnlyList<WeaponTagRefResponse>>.Success(
            attack.MonsterAttackWeaponTags.Select(x => x.WeaponTag.ToResponse()).ToList());
    }

    public async Task<ServiceResult<bool>> AssignAttackWeaponTagAsync(
        Guid id,
        Guid attackId,
        AssignWeaponTagRequest request,
        CancellationToken cancellationToken)
    {
        if (await monsterRepository.GetAttackAsync(id, attackId, includeTags: false, cancellationToken) is null)
        {
            return ServiceResult<bool>.NotFound($"Attack {attackId} was not found.");
        }

        if (!await monsterRepository.WeaponTagExistsAsync(request.WeaponTagId, cancellationToken))
        {
            return ServiceResult<bool>.Validation($"WeaponTag {request.WeaponTagId} does not exist.");
        }

        var assigned = await monsterRepository.AttackWeaponTagAssignedAsync(attackId, request.WeaponTagId, cancellationToken);
        if (!assigned)
        {
            await monsterRepository.AssignAttackWeaponTagAsync(
                new MonsterAttackWeaponTag { MonsterAttackId = attackId, WeaponTagId = request.WeaponTagId },
                cancellationToken);
            await monsterRepository.SaveChangesAsync(cancellationToken);
        }

        return ServiceResult<bool>.Success(true);
    }

    public async Task<ServiceResult<bool>> RemoveAttackWeaponTagAsync(
        Guid id,
        Guid attackId,
        Guid tagId,
        CancellationToken cancellationToken)
    {
        if (await monsterRepository.GetAttackAsync(id, attackId, includeTags: false, cancellationToken) is null)
        {
            return ServiceResult<bool>.NotFound($"Attack {attackId} was not found.");
        }

        await monsterRepository.RemoveAttackWeaponTagAsync(attackId, tagId, cancellationToken);
        return ServiceResult<bool>.Success(true);
    }

    public async Task<ServiceResult<IReadOnlyList<MonsterPowerResponse>>> GetPowersAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MonsterPowerResponse>>.NotFound($"Monster {id} was not found.");
        }

        var values = await monsterRepository.GetPowersAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<MonsterPowerResponse>>.Success(values.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<MonsterPowerResponse>> CreatePowerAsync(Guid id, UpsertMonsterPowerRequest request, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<MonsterPowerResponse>.NotFound($"Monster {id} was not found.");
        }

        var value = new MonsterPower { MonsterId = id, Name = request.Name.Trim(), Description = request.Description?.Trim() };
        await monsterRepository.AddPowerAsync(value, cancellationToken);
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MonsterPowerResponse>.Success(value.ToResponse());
    }

    public async Task<ServiceResult<MonsterPowerResponse>> UpdatePowerAsync(
        Guid id,
        Guid powerId,
        UpsertMonsterPowerRequest request,
        CancellationToken cancellationToken)
    {
        var value = await monsterRepository.GetPowerAsync(id, powerId, cancellationToken);
        if (value is null)
        {
            return ServiceResult<MonsterPowerResponse>.NotFound($"Power {powerId} was not found.");
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MonsterPowerResponse>.Success(value.ToResponse());
    }

    public async Task<bool> DeletePowerAsync(Guid id, Guid powerId, CancellationToken cancellationToken) =>
        await monsterRepository.DeletePowerAsync(id, powerId, cancellationToken) > 0;

    public async Task<ServiceResult<IReadOnlyList<MonsterArmorResponse>>> GetArmorsAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MonsterArmorResponse>>.NotFound($"Monster {id} was not found.");
        }

        var values = await monsterRepository.GetArmorsAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<MonsterArmorResponse>>.Success(values.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<MonsterArmorResponse>> CreateArmorAsync(Guid id, UpsertMonsterArmorRequest request, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<MonsterArmorResponse>.NotFound($"Monster {id} was not found.");
        }

        var value = new MonsterArmor
        {
            MonsterId = id,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            HarmSoak = request.HarmSoak,
            IsMagical = request.IsMagical
        };

        await monsterRepository.AddArmorAsync(value, cancellationToken);
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MonsterArmorResponse>.Success(value.ToResponse());
    }

    public async Task<ServiceResult<MonsterArmorResponse>> UpdateArmorAsync(
        Guid id,
        Guid armorId,
        UpsertMonsterArmorRequest request,
        CancellationToken cancellationToken)
    {
        var value = await monsterRepository.GetArmorAsync(id, armorId, cancellationToken);
        if (value is null)
        {
            return ServiceResult<MonsterArmorResponse>.NotFound($"Armor {armorId} was not found.");
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        value.HarmSoak = request.HarmSoak;
        value.IsMagical = request.IsMagical;
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MonsterArmorResponse>.Success(value.ToResponse());
    }

    public async Task<bool> DeleteArmorAsync(Guid id, Guid armorId, CancellationToken cancellationToken) =>
        await monsterRepository.DeleteArmorAsync(id, armorId, cancellationToken) > 0;

    public async Task<ServiceResult<IReadOnlyList<MonsterWeaknessResponse>>> GetWeaknessesAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MonsterWeaknessResponse>>.NotFound($"Monster {id} was not found.");
        }

        var values = await monsterRepository.GetWeaknessesAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<MonsterWeaknessResponse>>.Success(values.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<MonsterWeaknessResponse>> CreateWeaknessAsync(Guid id, UpsertMonsterWeaknessRequest request, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<MonsterWeaknessResponse>.NotFound($"Monster {id} was not found.");
        }

        var value = new MonsterWeakness { MonsterId = id, Name = request.Name.Trim(), Description = request.Description?.Trim() };
        await monsterRepository.AddWeaknessAsync(value, cancellationToken);
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MonsterWeaknessResponse>.Success(value.ToResponse());
    }

    public async Task<ServiceResult<MonsterWeaknessResponse>> UpdateWeaknessAsync(
        Guid id,
        Guid weaknessId,
        UpsertMonsterWeaknessRequest request,
        CancellationToken cancellationToken)
    {
        var value = await monsterRepository.GetWeaknessAsync(id, weaknessId, cancellationToken);
        if (value is null)
        {
            return ServiceResult<MonsterWeaknessResponse>.NotFound($"Weakness {weaknessId} was not found.");
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MonsterWeaknessResponse>.Success(value.ToResponse());
    }

    public async Task<bool> DeleteWeaknessAsync(Guid id, Guid weaknessId, CancellationToken cancellationToken) =>
        await monsterRepository.DeleteWeaknessAsync(id, weaknessId, cancellationToken) > 0;

    public async Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMovesAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<CustomMoveResponse>>.NotFound($"Monster {id} was not found.");
        }

        var values = await monsterRepository.GetCustomMovesAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<CustomMoveResponse>>.Success(values.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<CustomMoveResponse>> CreateCustomMoveAsync(Guid id, UpsertCustomMoveRequest request, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"Monster {id} was not found.");
        }

        var value = new MonsterCustomMove { MonsterId = id, Name = request.Name.Trim(), Description = request.Description?.Trim() };
        await monsterRepository.AddCustomMoveAsync(value, cancellationToken);
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(value.ToResponse());
    }

    public async Task<ServiceResult<CustomMoveResponse>> UpdateCustomMoveAsync(
        Guid id,
        Guid moveId,
        UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        var value = await monsterRepository.GetCustomMoveAsync(id, moveId, cancellationToken);
        if (value is null)
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"Custom move {moveId} was not found.");
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        await monsterRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(value.ToResponse());
    }

    public async Task<bool> DeleteCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        await monsterRepository.DeleteCustomMoveAsync(id, moveId, cancellationToken) > 0;

    private async Task<string?> ValidateTypesAsync(Guid? monsterTypeId, Guid? minionTypeId, CancellationToken cancellationToken)
    {
        if (monsterTypeId.HasValue && !await monsterRepository.MonsterTypeExistsAsync(monsterTypeId.Value, cancellationToken))
        {
            return $"MonsterType {monsterTypeId.Value} does not exist.";
        }

        if (minionTypeId.HasValue && !await monsterRepository.MinionTypeExistsAsync(minionTypeId.Value, cancellationToken))
        {
            return $"MinionType {minionTypeId.Value} does not exist.";
        }

        return null;
    }

    private static MonsterDetailResponse ToDetailResponse(Monster monster) =>
        new(
            monster.Id,
            monster.MysteryId,
            monster.Name,
            monster.Description,
            monster.HarmCapacity,
            monster.MonsterTypeId,
            monster.MonsterType?.Name,
            monster.MinionTypeId,
            monster.MinionType?.Name,
            monster.Attacks.Select(x => x.ToResponse()).ToList(),
            monster.Powers.Select(x => x.ToResponse()).ToList(),
            monster.Armors.Select(x => x.ToResponse()).ToList(),
            monster.Weaknesses.Select(x => x.ToResponse()).ToList(),
            monster.CustomMoves.Select(x => x.ToResponse()).ToList());
}
