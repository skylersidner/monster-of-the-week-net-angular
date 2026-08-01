using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IReferenceRepository
{
    Task<IReadOnlyList<AdventureType>> GetAdventureTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<MonsterArchetype>> GetMonsterArchetypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<MonsterType>> GetMonsterTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<MinionType>> GetMinionTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<LocationType>> GetLocationTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<BystanderType>> GetBystanderTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<WeaponTag>> GetWeaponTagsAsync(CancellationToken cancellationToken);
    Task AddAdventureTypeAsync(AdventureType adventureType, CancellationToken cancellationToken);
    Task AddMonsterArchetypeAsync(MonsterArchetype monsterArchetype, CancellationToken cancellationToken);
    Task AddMonsterTypeAsync(MonsterType monsterType, CancellationToken cancellationToken);
    Task AddMinionTypeAsync(MinionType minionType, CancellationToken cancellationToken);
    Task AddLocationTypeAsync(LocationType locationType, CancellationToken cancellationToken);
    Task AddBystanderTypeAsync(BystanderType bystanderType, CancellationToken cancellationToken);
    Task AddWeaponTagAsync(WeaponTag weaponTag, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
