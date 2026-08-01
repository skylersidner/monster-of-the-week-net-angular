using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Services;

public interface IReferenceService
{
    Task<IReadOnlyList<AdventureTypeResponse>> GetAdventureTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<MonsterArchetypeResponse>> GetMonsterArchetypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<TypeRefResponse>> GetMonsterTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<TypeRefResponse>> GetMinionTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<TypeRefResponse>> GetLocationTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<TypeRefResponse>> GetBystanderTypesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<WeaponTagRefResponse>> GetWeaponTagsAsync(CancellationToken cancellationToken);
    Task<AdventureTypeResponse> CreateAdventureTypeAsync(CreateAdventureTypeRequest request, CancellationToken cancellationToken);
    Task<MonsterArchetypeResponse> CreateMonsterArchetypeAsync(CreateMonsterArchetypeRequest request, CancellationToken cancellationToken);
    Task<TypeRefResponse> CreateMonsterTypeAsync(CreateTypeRefRequest request, CancellationToken cancellationToken);
    Task<TypeRefResponse> CreateMinionTypeAsync(CreateTypeRefRequest request, CancellationToken cancellationToken);
    Task<TypeRefResponse> CreateLocationTypeAsync(CreateTypeRefRequest request, CancellationToken cancellationToken);
    Task<TypeRefResponse> CreateBystanderTypeAsync(CreateTypeRefRequest request, CancellationToken cancellationToken);
    Task<WeaponTagRefResponse> CreateWeaponTagAsync(CreateWeaponTagRefRequest request, CancellationToken cancellationToken);
}
