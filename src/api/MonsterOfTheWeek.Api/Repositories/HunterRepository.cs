using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public sealed class HunterRepository(MotwDbContext dbContext) : IHunterRepository
{
    /// <summary>
    /// Flat, not mystery-scoped: Hunters are not owned by a Mystery the way Monsters optionally
    /// are (architecture.md Section 7). Ordered by name to match every other list endpoint.
    /// </summary>
    public async Task<IReadOnlyList<Hunter>> GetAllHuntersAsync(CancellationToken cancellationToken) =>
        await dbContext.Hunters
            .AsNoTracking()
            .Include(x => x.Playbook)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
}
