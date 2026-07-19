using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IReferenceService
{
    Task<IReadOnlyList<TypeRefResponse>> GetMonsterTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<TypeRefResponse>> GetMinionTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<TypeRefResponse>> GetLocationTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<TypeRefResponse>> GetBystanderTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<WeaponTagRefResponse>> GetWeaponTagsAsync(CancellationToken cancellationToken);
}
