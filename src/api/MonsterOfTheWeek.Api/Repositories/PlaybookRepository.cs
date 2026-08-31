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
                x.Tagline,
                x.StatArrayOptions.Count,
                x.Moves.Count))
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
            .AsSplitQuery();
}
