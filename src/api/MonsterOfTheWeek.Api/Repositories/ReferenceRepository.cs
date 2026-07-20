using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public sealed class ReferenceRepository(MotwDbContext dbContext) : IReferenceRepository
{
    public async Task<IReadOnlyList<MonsterType>> GetMonsterTypesAsync(CancellationToken cancellationToken) =>
        await dbContext.MonsterTypes.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<MinionType>> GetMinionTypesAsync(CancellationToken cancellationToken) =>
        await dbContext.MinionTypes.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<LocationType>> GetLocationTypesAsync(CancellationToken cancellationToken) =>
        await dbContext.LocationTypes.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<BystanderType>> GetBystanderTypesAsync(CancellationToken cancellationToken) =>
        await dbContext.BystanderTypes.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<WeaponTag>> GetWeaponTagsAsync(CancellationToken cancellationToken) =>
        await dbContext.WeaponTags.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public Task AddMonsterTypeAsync(MonsterType monsterType, CancellationToken cancellationToken) =>
        dbContext.MonsterTypes.AddAsync(monsterType, cancellationToken).AsTask();

    public Task AddMinionTypeAsync(MinionType minionType, CancellationToken cancellationToken) =>
        dbContext.MinionTypes.AddAsync(minionType, cancellationToken).AsTask();

    public Task AddLocationTypeAsync(LocationType locationType, CancellationToken cancellationToken) =>
        dbContext.LocationTypes.AddAsync(locationType, cancellationToken).AsTask();

    public Task AddBystanderTypeAsync(BystanderType bystanderType, CancellationToken cancellationToken) =>
        dbContext.BystanderTypes.AddAsync(bystanderType, cancellationToken).AsTask();

    public Task AddWeaponTagAsync(WeaponTag weaponTag, CancellationToken cancellationToken) =>
        dbContext.WeaponTags.AddAsync(weaponTag, cancellationToken).AsTask();

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
