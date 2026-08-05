using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IMonsterService
{
    Task<IReadOnlyList<MonsterListItemResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<ServiceResult<IReadOnlyList<MonsterListItemResponse>>> GetByMysteryAsync(Guid mysteryId, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterDetailResponse>> CreateAsync(Guid mysteryId, UpsertMonsterRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterDetailResponse>> CreateAsync(UpsertMonsterRequest request, CancellationToken cancellationToken);
    Task<MonsterDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterDetailResponse>> UpdateAsync(Guid id, UpsertMonsterRequest request, CancellationToken cancellationToken);
    Task<bool> UnlinkFromMysteryAsync(Guid mysteryId, Guid id, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<MonsterAttackResponse>>> GetAttacksAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterAttackResponse>> CreateAttackAsync(Guid id, UpsertMonsterAttackRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterAttackResponse>> UpdateAttackAsync(Guid id, Guid attackId, UpsertMonsterAttackRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAttackAsync(Guid id, Guid attackId, CancellationToken cancellationToken);
    Task<ServiceResult<IReadOnlyList<WeaponTagRefResponse>>> GetAttackWeaponTagsAsync(Guid id, Guid attackId, CancellationToken cancellationToken);
    Task<ServiceResult<bool>> AssignAttackWeaponTagAsync(Guid id, Guid attackId, AssignWeaponTagRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<bool>> RemoveAttackWeaponTagAsync(Guid id, Guid attackId, Guid tagId, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<MonsterPowerResponse>>> GetPowersAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterPowerResponse>> CreatePowerAsync(Guid id, UpsertMonsterPowerRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterPowerResponse>> UpdatePowerAsync(Guid id, Guid powerId, UpsertMonsterPowerRequest request, CancellationToken cancellationToken);
    Task<bool> DeletePowerAsync(Guid id, Guid powerId, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<MonsterArmorResponse>>> GetArmorsAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterArmorResponse>> CreateArmorAsync(Guid id, UpsertMonsterArmorRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterArmorResponse>> UpdateArmorAsync(Guid id, Guid armorId, UpsertMonsterArmorRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteArmorAsync(Guid id, Guid armorId, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<MonsterWeaknessResponse>>> GetWeaknessesAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterWeaknessResponse>> CreateWeaknessAsync(Guid id, UpsertMonsterWeaknessRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<MonsterWeaknessResponse>> UpdateWeaknessAsync(Guid id, Guid weaknessId, UpsertMonsterWeaknessRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteWeaknessAsync(Guid id, Guid weaknessId, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMovesAsync(Guid id, CancellationToken cancellationToken);
    Task<ServiceResult<CustomMoveResponse>> CreateCustomMoveAsync(Guid id, UpsertCustomMoveRequest request, CancellationToken cancellationToken);
    Task<ServiceResult<CustomMoveResponse>> UpdateCustomMoveAsync(Guid id, Guid moveId, UpsertCustomMoveRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteCustomMoveAsync(Guid id, Guid moveId, CancellationToken cancellationToken);
}
