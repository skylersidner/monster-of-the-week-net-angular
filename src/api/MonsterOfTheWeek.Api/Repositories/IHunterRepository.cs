using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public interface IHunterRepository
{
    Task<IReadOnlyList<Hunter>> GetAllHuntersAsync(CancellationToken cancellationToken);

    /// <summary>Read-only, with both pick bridges loaded. For GET.</summary>
    Task<Hunter?> GetHunterDetailAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Change-tracked, with both pick bridges loaded — the service replaces those collections
    /// wholesale, so they must be materialised or the old rows would survive the save.
    /// </summary>
    Task<Hunter?> GetHunterForUpdateAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// The template graph a hunter is validated against: stat arrays, moves, and gear options.
    /// Returned as the <see cref="Playbook"/> itself so the service can check ownership,
    /// <c>IsAdvanced</c>, and the box-count ceilings from one round trip.
    /// </summary>
    Task<Playbook?> GetPlaybookForValidationAsync(Guid playbookId, CancellationToken cancellationToken);

    /*
     * Explicit deletion of pick rows, rather than letting EF infer it from a severed navigation.
     *
     * Removing a HunterMove from Hunter.Moves marks it Deleted, but only until the *next*
     * DetectChanges pass re-runs navigation fixup — and assigning any FK on the Hunter (which
     * HunterService.UpdateAsync does, since a hunter's playbook is allowed to change) triggers
     * exactly that. Fixup sees a tracked HunterMove whose HunterId still points at this hunter,
     * puts it back into the collection, and the pending orphan-delete quietly evaporates. The
     * row survives with no error anywhere.
     *
     * This was caught by HunterServiceTests.Update_deletes_the_bridge_rows_that_dropped_out_of_the_set
     * and is very easy to reintroduce, because the naive version *works* right up until an
     * unrelated line assigns an FK. An explicit RemoveRange sets the state outright, which fixup
     * does not undo.
     */
    void RemoveMovePicks(IEnumerable<HunterMove> picks);
    void RemoveGearPicks(IEnumerable<HunterGearSelection> picks);
    void RemoveLookPicks(IEnumerable<HunterLookSelection> picks);
    void RemoveExtraTrackValues(IEnumerable<HunterExtraTrackValue> values);
    void RemoveBespokeSelections(IEnumerable<HunterBespokeSelection> selections);
    void RemoveBespokeInstances(IEnumerable<HunterBespokeSectionInstance> instances);
    void RemoveJournalEntries(IEnumerable<HunterJournalEntry> entries);
    void RemoveJournalFieldValues(IEnumerable<HunterJournalEntryFieldValue> values);

    Task AddHunterAsync(Hunter hunter, CancellationToken cancellationToken);
    Task<int> DeleteHunterAsync(Guid id, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
