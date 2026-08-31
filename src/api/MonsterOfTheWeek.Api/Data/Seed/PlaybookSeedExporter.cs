using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Data.Seed;

/// <summary>
/// Rewrites <see cref="PlaybookSeed.RelativePath"/> from whatever is currently in the
/// connected database. Re-runnable by design (Skyler, 2026-08-31): correcting a playbook
/// through the admin UI or the API and re-exporting is the supported way to update what
/// ships, replacing architecture.md Section 4's original "run this once and never again".
///
/// <code>
///   dotnet run --project src/api/MonsterOfTheWeek.Api -- export-playbook-seed
/// </code>
///
/// <para>
/// It reads through <see cref="IPlaybookService"/> rather than querying tables directly, so
/// the exported JSON is by construction the same thing <c>GET /api/playbooks/{id}</c>
/// returns. That is what keeps the format from drifting away from the contract when a field
/// is added — there is no separate export DTO to forget to update.
/// </para>
/// </summary>
public static class PlaybookSeedExporter
{
    public const string CommandName = "export-playbook-seed";

    /// <summary>Writes the seed file and returns a short human-readable summary.</summary>
    public static async Task<string> ExportAsync(
        IPlaybookService service,
        string contentRootPath,
        CancellationToken cancellationToken = default)
    {
        var summaries = await service.GetAllAsync(cancellationToken);

        var playbooks = new List<PlaybookDetailResponse>();
        // Ordered by name so the committed file has a stable, reviewable diff: without this
        // the row order is whatever the database returns and every export churns the whole
        // file. Ordinal, not culture-aware, so the order does not depend on the machine.
        foreach (var summary in summaries.OrderBy(p => p.Name, StringComparer.Ordinal))
        {
            var detail = await service.GetByIdAsync(summary.Id, cancellationToken)
                ?? throw new InvalidOperationException($"Playbook {summary.Id} vanished mid-export.");
            playbooks.Add(detail);
        }

        var path = Path.Combine(contentRootPath, PlaybookSeed.RelativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllTextAsync(path, PlaybookSeed.Serialize(playbooks) + Environment.NewLine, cancellationToken);

        var moves = playbooks.Sum(p => p.Moves.Count);
        var sections = playbooks.Sum(p => p.BespokeSections.Count + p.Moves.Sum(m => m.BespokeSections.Count));
        return $"Wrote {playbooks.Count} playbooks ({moves} moves, {sections} bespoke sections) to {path}";
    }

    /// <summary>Convenience overload for the CLI path, which has a DbContext but no service.</summary>
    public static Task<string> ExportAsync(
        MotwDbContext dbContext,
        string contentRootPath,
        CancellationToken cancellationToken = default) =>
        ExportAsync(new PlaybookService(new PlaybookRepository(dbContext)), contentRootPath, cancellationToken);
}
