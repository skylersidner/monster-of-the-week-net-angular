using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

/*
 * Deliberately narrow compared to IMonsterRepository: that interface carries a method per
 * sub-resource operation because Monster exposes real per-child endpoints. Playbook has no
 * sub-resource endpoints at all (phases.md Phase 3), so the whole aggregate is loaded,
 * mutated, and saved as one graph — there is nothing per-child to address here.
 */
public interface IPlaybookRepository
{
    Task<IReadOnlyList<PlaybookListItemResponse>> GetAllAsync(CancellationToken cancellationToken);

    /// <summary>Read-only full graph, for GET. Not change-tracked.</summary>
    Task<Playbook?> GetDetailAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Change-tracked full graph, for PUT's Id-based diff. Every child collection must be
    /// eagerly loaded here: the service reconciles against what this returns, so a
    /// collection left unloaded would look empty and have all its rows deleted.
    /// </summary>
    Task<Playbook?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken);

    Task<bool> NameExistsAsync(string name, Guid? excludingId, CancellationToken cancellationToken);

    /// <summary>
    /// How many Hunters are built from this Playbook. Exists so the service can refuse a delete
    /// with a 409 and a count the user can act on, rather than letting the Restrict FK surface
    /// as an unhandled database error. See <c>Hunter.PlaybookId</c>.
    /// </summary>
    Task<int> CountHuntersAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Of the given child-row ids, which ones at least one Hunter still points at — across
    /// rating arrays, picked moves, and picked gear options.
    ///
    /// <para>
    /// Takes a candidate set rather than answering per row so the whole check is one round trip
    /// no matter how many rows an edit removes, and returns ids rather than a count so the
    /// service can name the offending rows in its error instead of just tallying them.
    /// </para>
    /// </summary>
    Task<IReadOnlyList<Guid>> GetHunterReferencedChildIdsAsync(
        IReadOnlyCollection<Guid> candidateIds,
        CancellationToken cancellationToken);

    Task AddAsync(Playbook playbook, CancellationToken cancellationToken);
    Task<int> DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
