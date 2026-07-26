using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class MinionService(IMinionRepository minionRepository) : IMinionService
{
    public Task<IReadOnlyList<MinionListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        minionRepository.GetAllAsync(cancellationToken);

    public async Task<ServiceResult<IReadOnlyList<MinionListItemResponse>>> GetByMonsterAsync(Guid monsterId, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MonsterExistsAsync(monsterId, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MinionListItemResponse>>.NotFound($"Monster {monsterId} was not found.");
        }

        var minions = await minionRepository.GetByMonsterIdAsync(monsterId, cancellationToken);
        return ServiceResult<IReadOnlyList<MinionListItemResponse>>.Success(minions);
    }

    public async Task<ServiceResult<MinionDetailResponse>> CreateAsync(Guid monsterId, UpsertMinionRequest request, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MonsterExistsAsync(monsterId, cancellationToken))
        {
            return ServiceResult<MinionDetailResponse>.NotFound($"Monster {monsterId} was not found.");
        }

        if (!await minionRepository.MinionTypeExistsAsync(request.MinionTypeId, cancellationToken))
        {
            return ServiceResult<MinionDetailResponse>.Validation($"MinionType {request.MinionTypeId} does not exist.");
        }

        var minion = new Minion
        {
            MonsterId = monsterId,
            MinionTypeId = request.MinionTypeId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            HarmCapacity = request.HarmCapacity,
        };

        await minionRepository.AddAsync(minion, cancellationToken);
        await minionRepository.SaveChangesAsync(cancellationToken);

        var detail = await GetByIdAsync(minion.Id, cancellationToken);
        return ServiceResult<MinionDetailResponse>.Success(detail!);
    }

    public async Task<MinionDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var minion = await minionRepository.GetDetailAsync(id, cancellationToken);
        return minion is null ? null : ToDetailResponse(minion);
    }

    public async Task<ServiceResult<MinionDetailResponse>> UpdateAsync(Guid id, UpsertMinionRequest request, CancellationToken cancellationToken)
    {
        var minion = await minionRepository.GetForUpdateAsync(id, cancellationToken);
        if (minion is null)
        {
            return ServiceResult<MinionDetailResponse>.NotFound($"Minion {id} was not found.");
        }

        if (!await minionRepository.MinionTypeExistsAsync(request.MinionTypeId, cancellationToken))
        {
            return ServiceResult<MinionDetailResponse>.Validation($"MinionType {request.MinionTypeId} does not exist.");
        }

        minion.Name = request.Name.Trim();
        minion.Description = request.Description?.Trim();
        minion.HarmCapacity = request.HarmCapacity;
        minion.MinionTypeId = request.MinionTypeId;
        await minionRepository.SaveChangesAsync(cancellationToken);

        var detail = await GetByIdAsync(id, cancellationToken);
        return ServiceResult<MinionDetailResponse>.Success(detail!);
    }

    public async Task<ServiceResult<IReadOnlyList<MinionAttackResponse>>> GetAttacksAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MinionAttackResponse>>.NotFound($"Minion {id} was not found.");
        }

        var attacks = await minionRepository.GetAttacksAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<MinionAttackResponse>>.Success(attacks.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<MinionAttackResponse>> CreateAttackAsync(Guid id, UpsertMinionAttackRequest request, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<MinionAttackResponse>.NotFound($"Minion {id} was not found.");
        }

        var attack = new MinionAttack { MinionId = id, Name = request.Name.Trim(), Description = request.Description?.Trim(), Harm = request.Harm };
        await minionRepository.AddAttackAsync(attack, cancellationToken);
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MinionAttackResponse>.Success(attack.ToResponse());
    }

    public async Task<ServiceResult<MinionAttackResponse>> UpdateAttackAsync(Guid id, Guid attackId, UpsertMinionAttackRequest request, CancellationToken cancellationToken)
    {
        var attack = await minionRepository.GetAttackAsync(id, attackId, includeTags: true, cancellationToken);
        if (attack is null)
        {
            return ServiceResult<MinionAttackResponse>.NotFound($"Attack {attackId} was not found.");
        }

        attack.Name = request.Name.Trim();
        attack.Description = request.Description?.Trim();
        attack.Harm = request.Harm;
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MinionAttackResponse>.Success(attack.ToResponse());
    }

    public async Task<bool> DeleteAttackAsync(Guid id, Guid attackId, CancellationToken cancellationToken) =>
        await minionRepository.DeleteAttackAsync(id, attackId, cancellationToken) > 0;

    public async Task<ServiceResult<IReadOnlyList<WeaponTagRefResponse>>> GetAttackWeaponTagsAsync(Guid id, Guid attackId, CancellationToken cancellationToken)
    {
        var attack = await minionRepository.GetAttackAsync(id, attackId, includeTags: true, cancellationToken);
        if (attack is null)
        {
            return ServiceResult<IReadOnlyList<WeaponTagRefResponse>>.NotFound($"Attack {attackId} was not found.");
        }

        return ServiceResult<IReadOnlyList<WeaponTagRefResponse>>.Success(
            attack.MinionAttackWeaponTags.Select(x => x.WeaponTag.ToResponse()).ToList());
    }

    public async Task<ServiceResult<bool>> AssignAttackWeaponTagAsync(Guid id, Guid attackId, AssignWeaponTagRequest request, CancellationToken cancellationToken)
    {
        if (await minionRepository.GetAttackAsync(id, attackId, includeTags: false, cancellationToken) is null)
        {
            return ServiceResult<bool>.NotFound($"Attack {attackId} was not found.");
        }

        if (!await minionRepository.WeaponTagExistsAsync(request.WeaponTagId, cancellationToken))
        {
            return ServiceResult<bool>.Validation($"WeaponTag {request.WeaponTagId} does not exist.");
        }

        if (!await minionRepository.AttackWeaponTagAssignedAsync(attackId, request.WeaponTagId, cancellationToken))
        {
            await minionRepository.AssignAttackWeaponTagAsync(
                new MinionAttackWeaponTag { MinionAttackId = attackId, WeaponTagId = request.WeaponTagId },
                cancellationToken);
            await minionRepository.SaveChangesAsync(cancellationToken);
        }

        return ServiceResult<bool>.Success(true);
    }

    public async Task<ServiceResult<bool>> RemoveAttackWeaponTagAsync(Guid id, Guid attackId, Guid tagId, CancellationToken cancellationToken)
    {
        if (await minionRepository.GetAttackAsync(id, attackId, includeTags: false, cancellationToken) is null)
        {
            return ServiceResult<bool>.NotFound($"Attack {attackId} was not found.");
        }

        await minionRepository.RemoveAttackWeaponTagAsync(attackId, tagId, cancellationToken);
        return ServiceResult<bool>.Success(true);
    }

    public async Task<ServiceResult<IReadOnlyList<MinionPowerResponse>>> GetPowersAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MinionPowerResponse>>.NotFound($"Minion {id} was not found.");
        }

        var values = await minionRepository.GetPowersAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<MinionPowerResponse>>.Success(values.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<MinionPowerResponse>> CreatePowerAsync(Guid id, UpsertMinionPowerRequest request, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<MinionPowerResponse>.NotFound($"Minion {id} was not found.");
        }

        var value = new MinionPower { MinionId = id, Name = request.Name.Trim(), Description = request.Description?.Trim() };
        await minionRepository.AddPowerAsync(value, cancellationToken);
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MinionPowerResponse>.Success(value.ToResponse());
    }

    public async Task<ServiceResult<MinionPowerResponse>> UpdatePowerAsync(Guid id, Guid powerId, UpsertMinionPowerRequest request, CancellationToken cancellationToken)
    {
        var value = await minionRepository.GetPowerAsync(id, powerId, cancellationToken);
        if (value is null)
        {
            return ServiceResult<MinionPowerResponse>.NotFound($"Power {powerId} was not found.");
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MinionPowerResponse>.Success(value.ToResponse());
    }

    public async Task<bool> DeletePowerAsync(Guid id, Guid powerId, CancellationToken cancellationToken) =>
        await minionRepository.DeletePowerAsync(id, powerId, cancellationToken) > 0;

    public async Task<ServiceResult<IReadOnlyList<MinionArmorResponse>>> GetArmorsAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MinionArmorResponse>>.NotFound($"Minion {id} was not found.");
        }

        var values = await minionRepository.GetArmorsAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<MinionArmorResponse>>.Success(values.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<MinionArmorResponse>> CreateArmorAsync(Guid id, UpsertMinionArmorRequest request, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<MinionArmorResponse>.NotFound($"Minion {id} was not found.");
        }

        var value = new MinionArmor
        {
            MinionId = id,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            HarmSoak = request.HarmSoak,
            IsSpecial = request.IsSpecial,
            SpecialDescription = request.SpecialDescription?.Trim()
        };

        await minionRepository.AddArmorAsync(value, cancellationToken);
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MinionArmorResponse>.Success(value.ToResponse());
    }

    public async Task<ServiceResult<MinionArmorResponse>> UpdateArmorAsync(Guid id, Guid armorId, UpsertMinionArmorRequest request, CancellationToken cancellationToken)
    {
        var value = await minionRepository.GetArmorAsync(id, armorId, cancellationToken);
        if (value is null)
        {
            return ServiceResult<MinionArmorResponse>.NotFound($"Armor {armorId} was not found.");
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        value.HarmSoak = request.HarmSoak;
        value.IsSpecial = request.IsSpecial;
        value.SpecialDescription = request.SpecialDescription?.Trim();
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MinionArmorResponse>.Success(value.ToResponse());
    }

    public async Task<bool> DeleteArmorAsync(Guid id, Guid armorId, CancellationToken cancellationToken) =>
        await minionRepository.DeleteArmorAsync(id, armorId, cancellationToken) > 0;

    public async Task<ServiceResult<IReadOnlyList<MinionWeaknessResponse>>> GetWeaknessesAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MinionWeaknessResponse>>.NotFound($"Minion {id} was not found.");
        }

        var values = await minionRepository.GetWeaknessesAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<MinionWeaknessResponse>>.Success(values.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<MinionWeaknessResponse>> CreateWeaknessAsync(Guid id, UpsertMinionWeaknessRequest request, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<MinionWeaknessResponse>.NotFound($"Minion {id} was not found.");
        }

        var value = new MinionWeakness { MinionId = id, Name = request.Name.Trim(), Description = request.Description?.Trim() };
        await minionRepository.AddWeaknessAsync(value, cancellationToken);
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MinionWeaknessResponse>.Success(value.ToResponse());
    }

    public async Task<ServiceResult<MinionWeaknessResponse>> UpdateWeaknessAsync(Guid id, Guid weaknessId, UpsertMinionWeaknessRequest request, CancellationToken cancellationToken)
    {
        var value = await minionRepository.GetWeaknessAsync(id, weaknessId, cancellationToken);
        if (value is null)
        {
            return ServiceResult<MinionWeaknessResponse>.NotFound($"Weakness {weaknessId} was not found.");
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<MinionWeaknessResponse>.Success(value.ToResponse());
    }

    public async Task<bool> DeleteWeaknessAsync(Guid id, Guid weaknessId, CancellationToken cancellationToken) =>
        await minionRepository.DeleteWeaknessAsync(id, weaknessId, cancellationToken) > 0;

    public async Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMovesAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<CustomMoveResponse>>.NotFound($"Minion {id} was not found.");
        }

        var values = await minionRepository.GetCustomMovesAsync(id, cancellationToken);
        return ServiceResult<IReadOnlyList<CustomMoveResponse>>.Success(values.Select(x => x.ToResponse()).ToList());
    }

    public async Task<ServiceResult<CustomMoveResponse>> CreateCustomMoveAsync(Guid id, UpsertCustomMoveRequest request, CancellationToken cancellationToken)
    {
        if (!await minionRepository.MinionExistsAsync(id, cancellationToken))
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"Minion {id} was not found.");
        }

        var value = new MinionCustomMove { MinionId = id, Name = request.Name.Trim(), Description = request.Description?.Trim() };
        await minionRepository.AddCustomMoveAsync(value, cancellationToken);
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(value.ToResponse());
    }

    public async Task<ServiceResult<CustomMoveResponse>> UpdateCustomMoveAsync(Guid id, Guid moveId, UpsertCustomMoveRequest request, CancellationToken cancellationToken)
    {
        var value = await minionRepository.GetCustomMoveAsync(id, moveId, cancellationToken);
        if (value is null)
        {
            return ServiceResult<CustomMoveResponse>.NotFound($"Custom move {moveId} was not found.");
        }

        value.Name = request.Name.Trim();
        value.Description = request.Description?.Trim();
        await minionRepository.SaveChangesAsync(cancellationToken);
        return ServiceResult<CustomMoveResponse>.Success(value.ToResponse());
    }

    public async Task<bool> DeleteCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        await minionRepository.DeleteCustomMoveAsync(id, moveId, cancellationToken) > 0;

    private static MinionDetailResponse ToDetailResponse(Minion minion) =>
        new(
            minion.Id,
            minion.Name,
            minion.Description,
            minion.HarmCapacity,
            minion.MinionTypeId,
            minion.MinionType.Name,
            minion.Attacks.Select(x => x.ToResponse()).ToList(),
            minion.Powers.Select(x => x.ToResponse()).ToList(),
            minion.Armors.Select(x => x.ToResponse()).ToList(),
            minion.Weaknesses.Select(x => x.ToResponse()).ToList(),
            minion.CustomMoves.Select(x => x.ToResponse()).ToList());
}
