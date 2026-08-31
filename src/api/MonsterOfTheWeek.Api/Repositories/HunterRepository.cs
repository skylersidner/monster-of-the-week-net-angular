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

    public Task<Hunter?> GetHunterDetailAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Hunters
            .AsNoTracking()
            .Include(x => x.Playbook)
            .Include(x => x.Moves)
            .Include(x => x.GearSelections)
            .Include(x => x.LookSelections)
            .Include(x => x.ExtraTrackValues)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Hunter?> GetHunterForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Hunters
            .Include(x => x.Playbook)
            .Include(x => x.Moves)
            .Include(x => x.GearSelections)
            .Include(x => x.LookSelections)
            .Include(x => x.ExtraTrackValues)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    /// <summary>
    /// Deliberately narrower than <c>PlaybookRepository.GetDetailAsync</c>'s full graph:
    /// improvements, bespoke sections and journals have nothing a hunter can point at yet, so
    /// loading them here would be a materially larger query for no validation value. Everything
    /// a hunter *can* reference is loaded, which is what makes one round trip enough to validate
    /// the whole request.
    /// </summary>
    public Task<Playbook?> GetPlaybookForValidationAsync(Guid playbookId, CancellationToken cancellationToken) =>
        dbContext.Playbooks
            .AsNoTracking()
            .Include(x => x.StatArrayOptions)
            .Include(x => x.Moves)
            .Include(x => x.GearCategories).ThenInclude(c => c.Options)
            .Include(x => x.LookCategories).ThenInclude(c => c.Options)
            .Include(x => x.ExtraTracks)
            .FirstOrDefaultAsync(x => x.Id == playbookId, cancellationToken);

    /// <summary>See <see cref="IHunterRepository.RemoveMovePicks"/> for why this is explicit.</summary>
    public void RemoveMovePicks(IEnumerable<HunterMove> picks) => dbContext.HunterMoves.RemoveRange(picks);

    public void RemoveGearPicks(IEnumerable<HunterGearSelection> picks) => dbContext.HunterGearSelections.RemoveRange(picks);

    public void RemoveLookPicks(IEnumerable<HunterLookSelection> picks) => dbContext.HunterLookSelections.RemoveRange(picks);

    public void RemoveExtraTrackValues(IEnumerable<HunterExtraTrackValue> values) => dbContext.HunterExtraTrackValues.RemoveRange(values);

    public Task AddHunterAsync(Hunter hunter, CancellationToken cancellationToken)
    {
        dbContext.Hunters.Add(hunter);
        return Task.CompletedTask;
    }

    public Task<int> DeleteHunterAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Hunters.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
