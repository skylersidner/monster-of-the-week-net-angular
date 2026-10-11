using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services.CustomMoves;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Services;

public sealed class MonsterService(
    IMonsterRepository monsterRepository,
    IMinionRepository minionRepository,
    IResourceImageService resourceImageService,
    ICustomMoveService customMoveService) : IMonsterService
{
    public async Task<IReadOnlyList<MonsterListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        await monsterRepository.GetAllAsync(cancellationToken);

    public async Task<ServiceResult<IReadOnlyList<MonsterListItemResponse>>> GetByMysteryAsync(Guid mysteryId, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<MonsterListItemResponse>>.NotFound($"Mystery {mysteryId} was not found.");
        }

        var monsters = await monsterRepository.GetMonstersByMysteryIdAsync(mysteryId, cancellationToken);
        return ServiceResult<IReadOnlyList<MonsterListItemResponse>>.Success(monsters);
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

        if (!await monsterRepository.MonsterTypeExistsAsync(request.MonsterTypeId, cancellationToken))
        {
            return ServiceResult<MonsterDetailResponse>.Validation($"MonsterType {request.MonsterTypeId} does not exist.");
        }

        if (!await monsterRepository.MonsterArchetypeExistsAsync(request.MonsterArchetypeId, cancellationToken))
        {
            return ServiceResult<MonsterDetailResponse>.Validation($"MonsterArchetype {request.MonsterArchetypeId} does not exist.");
        }

        var monster = new Monster
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            HarmCapacity = request.HarmCapacity,
            MonsterTypeId = request.MonsterTypeId,
            MonsterArchetypeId = request.MonsterArchetypeId,
        };

        await monsterRepository.AddMonsterAsync(monster, cancellationToken);
        await monsterRepository.LinkMonsterToMysteryAsync(
            new MysteryMonster { MysteryId = mysteryId, MonsterId = monster.Id },
            cancellationToken);
        await monsterRepository.SaveChangesAsync(cancellationToken);

        var detail = await GetByIdAsync(monster.Id, cancellationToken);
        return ServiceResult<MonsterDetailResponse>.Success(detail!);
    }

    public async Task<ServiceResult<MonsterDetailResponse>> CreateAsync(
        UpsertMonsterRequest request,
        CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MonsterTypeExistsAsync(request.MonsterTypeId, cancellationToken))
        {
            return ServiceResult<MonsterDetailResponse>.Validation($"MonsterType {request.MonsterTypeId} does not exist.");
        }

        if (!await monsterRepository.MonsterArchetypeExistsAsync(request.MonsterArchetypeId, cancellationToken))
        {
            return ServiceResult<MonsterDetailResponse>.Validation($"MonsterArchetype {request.MonsterArchetypeId} does not exist.");
        }

        var monster = new Monster
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            HarmCapacity = request.HarmCapacity,
            MonsterTypeId = request.MonsterTypeId,
            MonsterArchetypeId = request.MonsterArchetypeId,
        };

        await monsterRepository.AddMonsterAsync(monster, cancellationToken);
        await monsterRepository.SaveChangesAsync(cancellationToken);

        var detail = await GetByIdAsync(monster.Id, cancellationToken);
        return ServiceResult<MonsterDetailResponse>.Success(detail!);
    }

    /// <summary>
    /// <b>The custom moves come from a second query now</b>
    /// (domain-custom-moves/architecture.md §3.4, B3). Create and Update both funnel their
    /// response through here, so this extra round trip lands on sixteen responses across the four
    /// domains, not five detail loads — and on a create the answer is provably empty. Not split
    /// into a detail-only variant: the duplication would cost more than one index seek returning
    /// nothing, and §2.6's budget is honest about this rather than quiet about it.
    /// <para>
    /// Partly offset, which §2.6 does not claim: <c>GetMonsterDetailAsync</c> was a single query
    /// with <b>six</b> collection <c>Include</c>s and no <c>AsSplitQuery</c>, so dropping one
    /// strictly reduces the cartesian row count. +1 round trip, −1 collection join.
    /// </para>
    /// </summary>
    public async Task<MonsterDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var monster = await monsterRepository.GetMonsterDetailAsync(id, cancellationToken);
        if (monster is null)
        {
            return null;
        }

        var customMoves = await customMoveService.ListForProjectionAsync(
            CustomMoveOwnerType.Monster, id, cancellationToken);
        return ToDetailResponse(monster, customMoves);
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

        if (!await monsterRepository.MonsterTypeExistsAsync(request.MonsterTypeId, cancellationToken))
        {
            return ServiceResult<MonsterDetailResponse>.Validation($"MonsterType {request.MonsterTypeId} does not exist.");
        }

        if (!await monsterRepository.MonsterArchetypeExistsAsync(request.MonsterArchetypeId, cancellationToken))
        {
            return ServiceResult<MonsterDetailResponse>.Validation($"MonsterArchetype {request.MonsterArchetypeId} does not exist.");
        }

        monster.Name = request.Name.Trim();
        monster.Description = request.Description?.Trim();
        monster.HarmCapacity = request.HarmCapacity;
        monster.MonsterTypeId = request.MonsterTypeId;
        monster.MonsterArchetypeId = request.MonsterArchetypeId;
        await monsterRepository.SaveChangesAsync(cancellationToken);

        var detail = await GetByIdAsync(id, cancellationToken);
        return ServiceResult<MonsterDetailResponse>.Success(detail!);
    }

    /// <summary>
    /// Asserts that the membership row exists. Idempotent: re-linking an already-linked monster
    /// is a successful no-op, never a conflict, because the wizard fires this unconditionally for
    /// every draft that carries an id. Returns false only when the mystery or the monster does
    /// not exist, which the controller surfaces as 404.
    /// </summary>
    public async Task<bool> LinkToMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken)
    {
        if (!await monsterRepository.MysteryExistsAsync(mysteryId, cancellationToken))
        {
            return false;
        }

        if (!await monsterRepository.MonsterExistsAsync(id, cancellationToken))
        {
            return false;
        }

        if (await monsterRepository.MonsterLinkedToMysteryAsync(mysteryId, id, cancellationToken))
        {
            return true;
        }

        // Insert and save behind one repository call: the check above and this write are not
        // atomic, and the repository is where the duplicate-membership race is absorbed.
        await monsterRepository.LinkMonsterToMysteryAndSaveAsync(
            new MysteryMonster { MysteryId = mysteryId, MonsterId = id },
            cancellationToken);
        return true;
    }

    public async Task<bool> UnlinkFromMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken) =>
        await monsterRepository.UnlinkMonsterFromMysteryAsync(mysteryId, id, cancellationToken) > 0;

    /// <summary>
    /// Deletes the Monster and, in the same transaction, every image and custom move it or its
    /// Minions own.
    ///
    /// <para>
    /// <b>The first explicit transaction in this codebase</b> (phases.md Phase 3, resource-images;
    /// <c>BeginTransactionAsync</c>/<c>IDbContextTransaction</c>, grepped, nothing else uses it).
    /// `ResourceImage` has no FK to its owner (design.md §1.3's accepted tradeoff), so the plain
    /// `DeleteMonsterAsync` below does nothing to the Monster's own `resource_images` rows, and —
    /// worse — deleting a Monster already cascades to its Minions <b>at the database level</b>
    /// (`Minion.MonsterId` is `OnDelete(Cascade)`), which runs no application code at all and
    /// would silently orphan the Minions' images too. So Minion ids are read <i>before</i> the
    /// Monster delete (not after — the cascade would have already removed the rows that name
    /// them), both sets of images are cleaned up via `IResourceImageService`, and only then is
    /// the Monster row deleted — all under one transaction, so a failure partway through leaves
    /// neither a Monster with orphaned images nor a half-cleaned set of `resource_images` rows.
    /// </para>
    /// </summary>
    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await monsterRepository.BeginTransactionAsync(cancellationToken);

        var minionIds = await minionRepository.GetIdsByMonsterIdAsync(id, cancellationToken);

        await resourceImageService.DeleteAllForOwnerAsync(ResourceOwnerType.Monster, id, cancellationToken);
        await customMoveService.DeleteAllForOwnerAsync(CustomMoveOwnerType.Monster, id, cancellationToken);
        foreach (var minionId in minionIds)
        {
            // Both owned sub-resource families, in one loop over the ids rather than two loops
            // over the same ids — so this reads as "clean up everything this minion owns"
            // (domain-custom-moves/architecture.md §19). The custom-move half is the one the
            // database cannot do for us either: `custom_moves` has no FK, so the minion cascade
            // below would orphan these rows exactly as it would the images.
            await resourceImageService.DeleteAllForOwnerAsync(ResourceOwnerType.Minion, minionId, cancellationToken);
            await customMoveService.DeleteAllForOwnerAsync(CustomMoveOwnerType.Minion, minionId, cancellationToken);
        }

        var deleted = await monsterRepository.DeleteMonsterAsync(id, cancellationToken) > 0;

        await transaction.CommitAsync(cancellationToken);
        return deleted;
    }

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
            IsSpecial = request.IsSpecial,
            SpecialDescription = request.SpecialDescription?.Trim()
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
        value.IsSpecial = request.IsSpecial;
        value.SpecialDescription = request.SpecialDescription?.Trim();
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

    private static MonsterDetailResponse ToDetailResponse(
        Monster monster,
        IReadOnlyList<CustomMoveResponse> customMoves) =>
        new(
            monster.Id,
            monster.Mysteries.Select(mm => mm.MysteryId).ToList(),
            monster.Name,
            monster.Description,
            monster.HarmCapacity,
            monster.MonsterTypeId,
            monster.MonsterType?.Name,
            monster.MonsterArchetype.ToResponse(),
            monster.Attacks.Select(x => x.ToResponse()).ToList(),
            monster.Powers.Select(x => x.ToResponse()).ToList(),
            monster.Armors.Select(x => x.ToResponse()).ToList(),
            monster.Weaknesses.Select(x => x.ToResponse()).ToList(),
            customMoves);
}
