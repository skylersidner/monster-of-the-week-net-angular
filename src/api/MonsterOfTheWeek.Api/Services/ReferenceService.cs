using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class ReferenceService(IReferenceRepository referenceRepository) : IReferenceService
{
    public async Task<IReadOnlyList<AdventureTypeResponse>> GetAdventureTypesAsync(CancellationToken cancellationToken) =>
        (await referenceRepository.GetAdventureTypesAsync(cancellationToken))
        .Select(x => new AdventureTypeResponse(x.Id, x.Name, x.Description))
        .ToList();

    public async Task<IReadOnlyList<MonsterArchetypeResponse>> GetMonsterArchetypesAsync(CancellationToken cancellationToken) =>
        (await referenceRepository.GetMonsterArchetypesAsync(cancellationToken))
        .Select(x => new MonsterArchetypeResponse(x.Id, x.Name, x.Description))
        .ToList();

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

    public async Task<AdventureTypeResponse> CreateAdventureTypeAsync(CreateAdventureTypeRequest request, CancellationToken cancellationToken)
    {
        var value = new Data.Entities.AdventureType
        {
            Name = request.Name.Trim(),
            Description = request.Description.Trim()
        };

        await referenceRepository.AddAdventureTypeAsync(value, cancellationToken);
        await referenceRepository.SaveChangesAsync(cancellationToken);
        return new AdventureTypeResponse(value.Id, value.Name, value.Description);
    }

    public async Task<MonsterArchetypeResponse> CreateMonsterArchetypeAsync(CreateMonsterArchetypeRequest request, CancellationToken cancellationToken)
    {
        var value = new Data.Entities.MonsterArchetype
        {
            Name = request.Name.Trim(),
            Description = request.Description.Trim()
        };

        await referenceRepository.AddMonsterArchetypeAsync(value, cancellationToken);
        await referenceRepository.SaveChangesAsync(cancellationToken);
        return new MonsterArchetypeResponse(value.Id, value.Name, value.Description);
    }

    public async Task<TypeRefResponse> CreateMonsterTypeAsync(CreateTypeRefRequest request, CancellationToken cancellationToken)
    {
        var value = new Data.Entities.MonsterType
        {
            Name = request.Name.Trim(),
            Motivation = request.Motivation.Trim()
        };

        await referenceRepository.AddMonsterTypeAsync(value, cancellationToken);
        await referenceRepository.SaveChangesAsync(cancellationToken);
        return new TypeRefResponse(value.Id, value.Name, value.Motivation);
    }

    public async Task<TypeRefResponse> CreateMinionTypeAsync(CreateTypeRefRequest request, CancellationToken cancellationToken)
    {
        var value = new Data.Entities.MinionType
        {
            Name = request.Name.Trim(),
            Motivation = request.Motivation.Trim()
        };

        await referenceRepository.AddMinionTypeAsync(value, cancellationToken);
        await referenceRepository.SaveChangesAsync(cancellationToken);
        return new TypeRefResponse(value.Id, value.Name, value.Motivation);
    }

    public async Task<TypeRefResponse> CreateLocationTypeAsync(CreateTypeRefRequest request, CancellationToken cancellationToken)
    {
        var value = new Data.Entities.LocationType
        {
            Name = request.Name.Trim(),
            Motivation = request.Motivation.Trim()
        };

        await referenceRepository.AddLocationTypeAsync(value, cancellationToken);
        await referenceRepository.SaveChangesAsync(cancellationToken);
        return new TypeRefResponse(value.Id, value.Name, value.Motivation);
    }

    public async Task<TypeRefResponse> CreateBystanderTypeAsync(CreateTypeRefRequest request, CancellationToken cancellationToken)
    {
        var value = new Data.Entities.BystanderType
        {
            Name = request.Name.Trim(),
            Motivation = request.Motivation.Trim()
        };

        await referenceRepository.AddBystanderTypeAsync(value, cancellationToken);
        await referenceRepository.SaveChangesAsync(cancellationToken);
        return new TypeRefResponse(value.Id, value.Name, value.Motivation);
    }

    public async Task<WeaponTagRefResponse> CreateWeaponTagAsync(CreateWeaponTagRefRequest request, CancellationToken cancellationToken)
    {
        var value = new Data.Entities.WeaponTag
        {
            Name = request.Name.Trim(),
            Description = request.Description.Trim()
        };

        await referenceRepository.AddWeaponTagAsync(value, cancellationToken);
        await referenceRepository.SaveChangesAsync(cancellationToken);
        return new WeaponTagRefResponse(value.Id, value.Name, value.Description);
    }
}
