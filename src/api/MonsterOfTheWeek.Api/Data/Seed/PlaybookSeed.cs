using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Data.Seed;

/// <summary>
/// The canonical 28 hunter playbooks, shipped as data rather than as a migration.
///
/// <para>
/// <b>The seed file is exactly <c>PlaybookDetailResponse[]</c></b> — the same shape
/// <c>GET /api/playbooks/{id}</c> already returns. That is the design's load-bearing choice,
/// and it is what makes the export repeatable rather than a one-off transcription: exporting
/// is "call the read endpoint for every playbook and write the array down", so there is no
/// second serialisation format to keep in step with the contract. Add a field to the
/// contract and it appears in the export automatically; the only thing that then needs
/// updating is <see cref="ToEntity"/>, and the tests in
/// <c>PlaybookSeedTests</c> fail until it is.
/// </para>
///
/// <para>
/// <b>Ids are preserved from the export, not regenerated.</b> Every other seeded table in
/// <see cref="MotwDbInitializer"/> uses hardcoded stable Guids, and playbooks need the same
/// property for a stronger reason: Hunter instances live-link to specific
/// <c>PlaybookMove</c>/<c>PlaybookGearOption</c>/<c>BespokeOption</c> rows (architecture.md
/// Section 3), and a future data migration that wants to correct one canonical row has to be
/// able to name it. Random per-environment ids would make that impossible to write.
/// </para>
///
/// <para>
/// <b>Revised 2026-08-31, superseding architecture.md Section 4 item 2.</b> That section
/// specified "a one-off script, not a reusable in-app tool — built to run once, not
/// maintained as ongoing tooling." Skyler reversed this: the export must stay re-runnable so
/// that corrections and later schema changes can be recaptured, and it must be covered by
/// tests that fail when something drifts. Item 5's "further changes go through normal EF Core
/// migrations, not by re-running the conversion" is correspondingly relaxed — re-running the
/// export is now the expected way to refresh this file. The blanket <c>AnyAsync()</c> guard
/// on seeding is unchanged and still correct: re-exporting updates what *ships*, while an
/// environment that already has playbook rows is never silently rewritten underneath itself.
/// </para>
/// </summary>
public static class PlaybookSeed
{
    /// <summary>Path relative to the API project's content root.</summary>
    public const string RelativePath = "Data/Seed/hunter-playbooks.json";

    /// <summary>
    /// Indented and camel-cased so the committed file diffs meaningfully in review — this is
    /// the artifact a human reads to see what changed between two exports.
    /// </summary>
    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static IReadOnlyList<PlaybookDetailResponse> Deserialize(string json) =>
        JsonSerializer.Deserialize<List<PlaybookDetailResponse>>(json, JsonOptions)
            ?? throw new InvalidOperationException("Playbook seed file deserialized to null.");

    public static string Serialize(IEnumerable<PlaybookDetailResponse> playbooks) =>
        JsonSerializer.Serialize(playbooks, JsonOptions);

    /// <summary>
    /// Inserts the seed file's playbooks if — and only if — the database has none. Returns
    /// how many were added, so a caller can log or assert on it.
    ///
    /// <para>
    /// The all-or-nothing guard is deliberate and matches every other seeded table. An
    /// environment that already has playbook rows may have had them edited through the admin
    /// UI, or have Hunter instances pointing at specific child rows, so this must never
    /// overwrite or merge. Refreshing what <em>ships</em> is
    /// <see cref="PlaybookSeedExporter"/>'s job; this only ever populates an empty table.
    /// </para>
    ///
    /// <para>
    /// A missing file is not an error — there is simply nothing to seed. A malformed one is,
    /// and is allowed to throw: startup failing loudly beats an environment quietly coming up
    /// with no playbooks at all.
    /// </para>
    ///
    /// <para>
    /// Lives here rather than inside <see cref="MotwDbInitializer"/> so it is reachable from
    /// tests without going through <c>MigrateAsync</c>, which needs the real Postgres provider.
    /// </para>
    /// </summary>
    public static async Task<int> ApplyAsync(
        MotwDbContext dbContext,
        string contentRootPath,
        CancellationToken cancellationToken = default)
    {
        if (await dbContext.Playbooks.AnyAsync(cancellationToken))
        {
            return 0;
        }

        var path = Path.Combine(contentRootPath, RelativePath);
        if (!File.Exists(path))
        {
            return 0;
        }

        var playbooks = Deserialize(await File.ReadAllTextAsync(path, cancellationToken));
        dbContext.Playbooks.AddRange(playbooks.Select(ToEntity));
        await dbContext.SaveChangesAsync(cancellationToken);
        return playbooks.Count;
    }

    /// <summary>
    /// Rebuilds the entity graph a seed entry describes, ids and all.
    ///
    /// <para>
    /// This is the one place the seed shape is translated, and therefore the one place a new
    /// field can be forgotten. <c>PlaybookSeedTests.Seed_round_trips_through_the_real_read_path</c>
    /// exists to catch exactly that: it maps a fully-populated fixture through here, saves
    /// it, reads it back through the real repository and service, and compares the JSON. A
    /// field added to the contract but not copied here shows up as a diff.
    /// </para>
    /// </summary>
    public static Playbook ToEntity(PlaybookDetailResponse source) => new()
    {
        Id = source.Id,
        Name = source.Name,
        Description = source.Description,
        LuckBoxCount = source.LuckBoxCount,
        LuckSpecialText = source.LuckSpecialText,
        HarmUnstableThreshold = source.HarmUnstableThreshold,
        HarmBoxCount = source.HarmBoxCount,
        ExperienceBoxCount = source.ExperienceBoxCount,
        MoveGrantCount = source.MoveGrantCount,
        GettingStartedText = source.GettingStartedText,
        IntroductionsText = source.IntroductionsText,
        LevelingUpText = source.LevelingUpText,
        HistoryPromptsText = source.HistoryPromptsText,

        StatArrayOptions = [.. source.StatArrayOptions.Select(x => new PlaybookStatArrayOption
        {
            Id = x.Id,
            Charm = x.Charm,
            Cool = x.Cool,
            Sharp = x.Sharp,
            Tough = x.Tough,
            Weird = x.Weird,
            SortOrder = x.SortOrder,
        })],

        Moves = [.. source.Moves.Select(x => new PlaybookMove
        {
            Id = x.Id,
            Name = x.Name,
            DescriptionText = x.DescriptionText,
            Required = x.Required,
            IsAdvanced = x.IsAdvanced,
            SortOrder = x.SortOrder,
        })],

        GearCategories = [.. source.GearCategories.Select(x => new PlaybookGearCategory
        {
            Id = x.Id,
            Label = x.Label,
            PickCount = x.PickCount,
            IsOptional = x.IsOptional,
            SortOrder = x.SortOrder,
            Options = [.. x.Options.Select(o => new PlaybookGearOption
            {
                Id = o.Id,
                Name = o.Name,
                MechanicalText = o.MechanicalText,
                SortOrder = o.SortOrder,
            })],
        })],

        LookCategories = [.. source.LookCategories.Select(x => new PlaybookLookCategory
        {
            Id = x.Id,
            AllowsFreeform = x.AllowsFreeform,
            GroupLabel = x.GroupLabel,
            SortOrder = x.SortOrder,
            Options = [.. x.Options.Select(o => new PlaybookLookOption
            {
                Id = o.Id,
                Text = o.Text,
                SortOrder = o.SortOrder,
            })],
        })],

        Improvements = [.. source.Improvements.Select(x => new PlaybookImprovement
        {
            Id = x.Id,
            Text = x.Text,
            IsAdvanced = x.IsAdvanced,
            SortOrder = x.SortOrder,
        })],

        // Playbook-level sections carry PlaybookMoveId null; a move's own sections carry its
        // id. Both live in the same table and the same navigation collection — the nesting in
        // the response is what separates them (architecture.md Section 6.8), so both are
        // flattened back into Playbook.BespokeSections here.
        BespokeSections =
        [
            .. source.BespokeSections.Select(s => ToSectionEntity(s, null)),
            .. source.Moves.SelectMany(m => m.BespokeSections.Select(s => ToSectionEntity(s, m.Id))),
        ],

        BespokeJournals = [.. source.BespokeJournals.Select(j => new BespokeJournal
        {
            Id = j.Id,
            Title = j.Title,
            Description = j.Description,
            EffectText = j.EffectText,
            SortOrder = j.SortOrder,
            Fields = [.. j.Fields.Select(f => new BespokeJournalField
            {
                Id = f.Id,
                Label = f.Label,
                SortOrder = f.SortOrder,
            })],
        })],

        ExtraTracks = [.. source.ExtraTracks.Select(t => new PlaybookExtraTrack
        {
            Id = t.Id,
            Name = t.Name,
            Description = t.Description,
            EffectText = t.EffectText,
            BoxCount = t.BoxCount,
            StartLabel = t.StartLabel,
            EndLabel = t.EndLabel,
            SortOrder = t.SortOrder,
        })],
    };

    private static BespokeSection ToSectionEntity(BespokeSectionResponse source, Guid? playbookMoveId) => new()
    {
        Id = source.Id,
        PlaybookMoveId = playbookMoveId,
        Title = source.Title,
        Description = source.Description,
        EffectText = source.EffectText,
        FreeTextLabel = source.FreeTextLabel,
        MinSelect = source.MinSelect,
        MaxSelect = source.MaxSelect,
        MinInstances = source.MinInstances,
        MaxInstances = source.MaxInstances,
        SortOrder = source.SortOrder,
        // The wire format nests options; the table stores a self-referencing adjacency list.
        // Flattened here, with ParentOptionId threaded through the recursion.
        Options = [.. Flatten(source.Options, source.Id, null)],
    };

    private static IEnumerable<BespokeOption> Flatten(
        IEnumerable<BespokeOptionResponse> options,
        Guid sectionId,
        Guid? parentOptionId)
    {
        foreach (var option in options)
        {
            yield return new BespokeOption
            {
                Id = option.Id,
                SectionId = sectionId,
                ParentOptionId = parentOptionId,
                Title = option.Title,
                DescriptionText = option.DescriptionText,
                MinSelect = option.MinSelect,
                MaxSelect = option.MaxSelect,
                NumericMin = option.NumericMin,
                NumericMax = option.NumericMax,
                SortOrder = option.SortOrder,
            };

            foreach (var child in Flatten(option.Children, sectionId, option.Id))
            {
                yield return child;
            }
        }
    }
}
