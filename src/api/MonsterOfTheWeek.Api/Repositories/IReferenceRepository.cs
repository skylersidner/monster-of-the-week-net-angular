using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IReferenceRepository
{
    Task<IReadOnlyList<MonsterType>> GetMonsterTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<MinionType>> GetMinionTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<LocationType>> GetLocationTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<BystanderType>> GetBystanderTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<WeaponTag>> GetWeaponTagsAsync(CancellationToken cancellationToken);
}
