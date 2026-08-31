using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Repositories;

public sealed class PlaybookRepository(MotwDbContext dbContext) : IPlaybookRepository
{
    public async Task<IReadOnlyList<PlaybookListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        await dbContext.Playbooks
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new PlaybookListItemResponse(
                x.Id,
                x.Name,
                x.StatArrayOptions.Count,
                x.Moves.Count,
                x.BespokeSections.Count))
            .ToListAsync(cancellationToken);

    /*
     * AsSplitQuery, unlike the Monster equivalents: this graph has five sibling collections
     * plus two grandchild collections, and a single joined query would multiply their rows
     * together (5 stat arrays x 10 improvements x N looks ... ) into a needlessly large
     * result set. Split queries are safe here because everything is loaded inside one
     * request against immutable-in-practice reference data.
     */
    public Task<Playbook?> GetDetailAsync(Guid id, CancellationToken cancellationToken) =>
        BuildFullGraph(dbContext.Playbooks.AsNoTracking())
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Playbook?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
        BuildFullGraph(dbContext.Playbooks)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<bool> NameExistsAsync(string name, Guid? excludingId, CancellationToken cancellationToken) =>
        dbContext.Playbooks.AnyAsync(
            x => x.Name.ToLower() == name.ToLower() && (excludingId == null || x.Id != excludingId),
            cancellationToken);

    public async Task AddAsync(Playbook playbook, CancellationToken cancellationToken) =>
        await dbContext.Playbooks.AddAsync(playbook, cancellationToken);

    public Task<int> CountHuntersAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Hunters.CountAsync(x => x.PlaybookId == id, cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetHunterReferencedChildIdsAsync(
        IReadOnlyCollection<Guid> candidateIds,
        CancellationToken cancellationToken)
    {
        if (candidateIds.Count == 0)
        {
            return [];
        }

        var statArrays = dbContext.Hunters
            .Where(h => h.PlaybookStatArrayOptionId != null && candidateIds.Contains(h.PlaybookStatArrayOptionId!.Value))
            .Select(h => h.PlaybookStatArrayOptionId!.Value);

        var moves = dbContext.HunterMoves
            .Where(m => candidateIds.Contains(m.PlaybookMoveId))
            .Select(m => m.PlaybookMoveId);

        var gear = dbContext.HunterGearSelections
            .Where(g => candidateIds.Contains(g.PlaybookGearOptionId))
            .Select(g => g.PlaybookGearOptionId);

        // Two queries for looks, not one: a freeform answer references only the category, and a
        // picked answer references both. Missing the category case would let a look line be
        // deleted out from under everyone who wrote their own text for it.
        var lookCategories = dbContext.HunterLookSelections
            .Where(l => candidateIds.Contains(l.LookCategoryId))
            .Select(l => l.LookCategoryId);

        var lookOptions = dbContext.HunterLookSelections
            .Where(l => l.LookOptionId != null && candidateIds.Contains(l.LookOptionId!.Value))
            .Select(l => l.LookOptionId!.Value);

        var tracks = dbContext.HunterExtraTrackValues
            .Where(t => candidateIds.Contains(t.ExtraTrackId))
            .Select(t => t.ExtraTrackId);

        return await statArrays
            .Union(moves)
            .Union(gear)
            .Union(lookCategories)
            .Union(lookOptions)
            .Union(tracks)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public Task<int> DeleteAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Playbooks
            .Where(x => x.Id == id)
            .ExecuteDeleteAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);

    private static IQueryable<Playbook> BuildFullGraph(IQueryable<Playbook> source) =>
        source
            .Include(x => x.StatArrayOptions)
            .Include(x => x.Moves)
            .Include(x => x.GearCategories).ThenInclude(x => x.Options)
            .Include(x => x.LookCategories).ThenInclude(x => x.Options)
            .Include(x => x.Improvements)
            // Every option in a section is loaded by this one Include regardless of depth:
            // BespokeOption.SectionId is populated on descendants too, so the whole tree
            // comes back flat and EF fixes up ParentOption/ChildOptions in the change
            // tracker. A ThenInclude chain per level would cap the supported depth.
            .Include(x => x.BespokeSections).ThenInclude(x => x.Options)
            .Include(x => x.BespokeJournals).ThenInclude(x => x.Fields)
            .Include(x => x.ExtraTracks)
            .AsSplitQuery();
}
