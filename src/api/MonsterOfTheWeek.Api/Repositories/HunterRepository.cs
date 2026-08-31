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
            .Include(x => x.BespokeSelections)
            .Include(x => x.BespokeSectionInstances)
            .Include(x => x.JournalEntries).ThenInclude(e => e.FieldValues)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Hunter?> GetHunterForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Hunters
            .Include(x => x.Playbook)
            .Include(x => x.Moves)
            .Include(x => x.GearSelections)
            .Include(x => x.LookSelections)
            .Include(x => x.ExtraTrackValues)
            .Include(x => x.BespokeSelections)
            .Include(x => x.BespokeSectionInstances)
            .Include(x => x.JournalEntries).ThenInclude(e => e.FieldValues)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    /// <summary>
    /// Everything a hunter can reference, in one round trip, so the whole request validates
    /// without further queries. Only <c>Improvements</c> is left out of what
    /// <c>PlaybookRepository.GetDetailAsync</c> loads — there is still no hunter-side
    /// improvement table for one to point at.
    ///
    /// <para>
    /// <c>AsSplitQuery</c> for the reason <c>PlaybookRepository</c> already documents: seven
    /// sibling collections joined in one statement multiply into a needlessly large result set.
    /// </para>
    /// </summary>
    public Task<Playbook?> GetPlaybookForValidationAsync(Guid playbookId, CancellationToken cancellationToken) =>
        dbContext.Playbooks
            .AsNoTracking()
            .Include(x => x.StatArrayOptions)
            .Include(x => x.Moves)
            .Include(x => x.GearCategories).ThenInclude(c => c.Options)
            .Include(x => x.LookCategories).ThenInclude(c => c.Options)
            .Include(x => x.ExtraTracks)
            .Include(x => x.BespokeSections).ThenInclude(s => s.Options)
            .Include(x => x.BespokeJournals).ThenInclude(j => j.Fields)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == playbookId, cancellationToken);

    /// <summary>See <see cref="IHunterRepository.RemoveMovePicks"/> for why this is explicit.</summary>
    public void RemoveMovePicks(IEnumerable<HunterMove> picks) => dbContext.HunterMoves.RemoveRange(picks);

    public void RemoveGearPicks(IEnumerable<HunterGearSelection> picks) => dbContext.HunterGearSelections.RemoveRange(picks);

    public void RemoveLookPicks(IEnumerable<HunterLookSelection> picks) => dbContext.HunterLookSelections.RemoveRange(picks);

    public void RemoveExtraTrackValues(IEnumerable<HunterExtraTrackValue> values) => dbContext.HunterExtraTrackValues.RemoveRange(values);

    public void RemoveBespokeSelections(IEnumerable<HunterBespokeSelection> selections) => dbContext.HunterBespokeSelections.RemoveRange(selections);

    public void RemoveBespokeInstances(IEnumerable<HunterBespokeSectionInstance> instances) => dbContext.HunterBespokeSectionInstances.RemoveRange(instances);

    public void RemoveJournalEntries(IEnumerable<HunterJournalEntry> entries) => dbContext.HunterJournalEntries.RemoveRange(entries);

    public void RemoveJournalFieldValues(IEnumerable<HunterJournalEntryFieldValue> values) => dbContext.HunterJournalEntryFieldValues.RemoveRange(values);

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
