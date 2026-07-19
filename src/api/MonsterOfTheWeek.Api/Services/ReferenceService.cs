using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class ReferenceService(IReferenceRepository referenceRepository) : IReferenceService
{
    public async Task<IReadOnlyList<TypeRefResponse>> GetMonsterTypesAsync(CancellationToken cancellationToken) =>
        (await referenceRepository.GetMonsterTypesAsync(cancellationToken))
        .Select(x => new TypeRefResponse(x.Id, x.Name, x.Motivation))
        .ToList();

    public async Task<IReadOnlyList<TypeRefResponse>> GetMinionTypesAsync(CancellationToken cancellationToken) =>
        (await referenceRepository.GetMinionTypesAsync(cancellationToken))
        .Select(x => new TypeRefResponse(x.Id, x.Name, x.Motivation))
        .ToList();

    public async Task<IReadOnlyList<TypeRefResponse>> GetLocationTypesAsync(CancellationToken cancellationToken) =>
        (await referenceRepository.GetLocationTypesAsync(cancellationToken))
        .Select(x => new TypeRefResponse(x.Id, x.Name, x.Motivation))
        .ToList();

    public async Task<IReadOnlyList<TypeRefResponse>> GetBystanderTypesAsync(CancellationToken cancellationToken) =>
        (await referenceRepository.GetBystanderTypesAsync(cancellationToken))
        .Select(x => new TypeRefResponse(x.Id, x.Name, x.Motivation))
        .ToList();

    public async Task<IReadOnlyList<WeaponTagRefResponse>> GetWeaponTagsAsync(CancellationToken cancellationToken) =>
        (await referenceRepository.GetWeaponTagsAsync(cancellationToken))
        .Select(x => new WeaponTagRefResponse(x.Id, x.Name, x.Description))
        .ToList();
}
