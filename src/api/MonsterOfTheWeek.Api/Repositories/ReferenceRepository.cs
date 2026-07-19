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
}
