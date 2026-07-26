using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IMinionService
{
    Task<ServiceResult<IReadOnlyList<MinionListItemResponse>>> GetByMonsterAsync(Guid monsterId, CancellationToken cancellationToken);
    Task<ServiceResult<MinionDetailResponse>> CreateAsync(Guid monsterId, UpsertMinionRequest request, CancellationToken cancellationToken);
    Task<MinionDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MinionDetailResponse>> UpdateAsync(Guid id, UpsertMinionRequest request, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<MinionAttackResponse>>> GetAttacksAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MinionAttackResponse>> CreateAttackAsync(Guid id, UpsertMinionAttackRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MinionAttackResponse>> UpdateAttackAsync(Guid id, Guid attackId, UpsertMinionAttackRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAttackAsync(Guid id, Guid attackId, CancellationToken cancellationToken);
    Task<ServiceResult<IReadOnlyList<WeaponTagRefResponse>>> GetAttackWeaponTagsAsync(Guid id, Guid attackId, CancellationToken cancellationToken);
    Task<ServiceResult<bool>> AssignAttackWeaponTagAsync(Guid id, Guid attackId, AssignWeaponTagRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<bool>> RemoveAttackWeaponTagAsync(Guid id, Guid attackId, Guid tagId, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<MinionPowerResponse>>> GetPowersAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MinionPowerResponse>> CreatePowerAsync(Guid id, UpsertMinionPowerRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MinionPowerResponse>> UpdatePowerAsync(Guid id, Guid powerId, UpsertMinionPowerRequest request, CancellationToken cancellationToken);
    Task<bool> DeletePowerAsync(Guid id, Guid powerId, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<MinionArmorResponse>>> GetArmorsAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MinionArmorResponse>> CreateArmorAsync(Guid id, UpsertMinionArmorRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MinionArmorResponse>> UpdateArmorAsync(Guid id, Guid armorId, UpsertMinionArmorRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteArmorAsync(Guid id, Guid armorId, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<MinionWeaknessResponse>>> GetWeaknessesAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MinionWeaknessResponse>> CreateWeaknessAsync(Guid id, UpsertMinionWeaknessRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MinionWeaknessResponse>> UpdateWeaknessAsync(Guid id, Guid weaknessId, UpsertMinionWeaknessRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteWeaknessAsync(Guid id, Guid weaknessId, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMovesAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<CustomMoveResponse>> CreateCustomMoveAsync(Guid id, UpsertCustomMoveRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<CustomMoveResponse>> UpdateCustomMoveAsync(Guid id, Guid moveId, UpsertCustomMoveRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
}
