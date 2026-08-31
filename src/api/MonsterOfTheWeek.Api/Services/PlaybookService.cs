using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class PlaybookService(IPlaybookRepository repository) : IPlaybookService
{
    public Task<IReadOnlyList<PlaybookListItemResponse>> GetAllAsync(CancellationToken cancellationToken) =>
        repository.GetAllAsync(cancellationToken);

    public async Task<PlaybookDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var playbook = await repository.GetDetailAsync(id, cancellationToken);
        return playbook is null ? null : ToDetailResponse(playbook);
    }

    public async Task<ServiceResult<PlaybookDetailResponse>> CreateAsync(
        UpsertPlaybookRequest request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();

        var validationError = ValidateGraph(request);
        if (validationError is not null)
        {
            return ServiceResult<PlaybookDetailResponse>.Validation(validationError);
        }

        if (await repository.NameExistsAsync(name, null, cancellationToken))
        {
            return ServiceResult<PlaybookDetailResponse>.Validation($"A playbook named \"{name}\" already exists.");
        }

        var playbook = new Playbook { Name = name };
        ApplyScalars(playbook, request);

        // On create every child is new, so this is the same reconciliation code path as
        // update with an all-null set of child Ids — no separate insert path to keep in sync.
        ApplyChildren(playbook, request);

        await repository.AddAsync(playbook, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return ServiceResult<PlaybookDetailResponse>.Success(ToDetailResponse(playbook));
    }

    public async Task<ServiceResult<PlaybookDetailResponse>> UpdateAsync(
        Guid id,
        UpsertPlaybookRequest request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();

        var validationError = ValidateGraph(request);
        if (validationError is not null)
        {
            return ServiceResult<PlaybookDetailResponse>.Validation(validationError);
        }

        var playbook = await repository.GetForUpdateAsync(id, cancellationToken);
        if (playbook is null)
        {
            return ServiceResult<PlaybookDetailResponse>.NotFound($"Playbook {id} was not found.");
        }

        if (await repository.NameExistsAsync(name, id, cancellationToken))
        {
            return ServiceResult<PlaybookDetailResponse>.Validation($"A playbook named \"{name}\" already exists.");
        }

        playbook.Name = name;
        ApplyScalars(playbook, request);
        ApplyChildren(playbook, request);

        await repository.SaveChangesAsync(cancellationToken);

        return ServiceResult<PlaybookDetailResponse>.Success(ToDetailResponse(playbook));
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken) =>
        await repository.DeleteAsync(id, cancellationToken) > 0;

    // -----------------------------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------------------------

    /*
     * Cross-field rules DataAnnotations cannot express on their own. Everything single-field
     * (required, min-length, numeric range) is already enforced by the attributes on
     * UpsertPlaybookRequest and rejected by model binding before reaching this service.
     */
    private static string? ValidateGraph(UpsertPlaybookRequest request)
    {
        if (request.HarmUnstableThreshold > request.HarmBoxCount)
        {
            return "Harm unstable threshold cannot exceed the harm box count.";
        }

        foreach (var category in request.GearCategories ?? [])
        {
            var optionCount = category.Options?.Count ?? 0;

            // A null PickCount means "every option is granted automatically", which is a
            // distinct state from picking zero — see PlaybookGearCategory.PickCount.
            if (category.PickCount is { } pickCount && pickCount > optionCount)
            {
                return $"Gear category \"{category.Label}\" picks {pickCount} option(s) but only lists {optionCount}.";
            }
        }

        return null;
    }

    // -----------------------------------------------------------------------------------
    // Request -> entity
    // -----------------------------------------------------------------------------------

    private static void ApplyScalars(Playbook playbook, UpsertPlaybookRequest request)
    {
        playbook.Tagline = Normalize(request.Tagline);
        playbook.Description = Normalize(request.Description);
        playbook.LuckBoxCount = request.LuckBoxCount;
        playbook.LuckSpecialText = Normalize(request.LuckSpecialText);
        playbook.HarmUnstableThreshold = request.HarmUnstableThreshold;
        playbook.HarmBoxCount = request.HarmBoxCount;
        playbook.ExperienceBoxCount = request.ExperienceBoxCount;
        playbook.MoveGrantCount = request.MoveGrantCount;
        playbook.GettingStartedText = Normalize(request.GettingStartedText);
        playbook.IntroductionsText = Normalize(request.IntroductionsText);
        playbook.LevelingUpText = Normalize(request.LevelingUpText);
        playbook.HistoryPromptsText = Normalize(request.HistoryPromptsText);
    }

    private static void ApplyChildren(Playbook playbook, UpsertPlaybookRequest request)
    {
        Reconcile(
            playbook.StatArrayOptions,
            request.StatArrayOptions,
            r => r.Id,
            e => e.Id,
            r => new PlaybookStatArrayOption(),
            (r, e) =>
            {
                e.Charm = r.Charm;
                e.Cool = r.Cool;
                e.Sharp = r.Sharp;
                e.Tough = r.Tough;
                e.Weird = r.Weird;
                e.SortOrder = r.SortOrder;
            });

        Reconcile(
            playbook.Moves,
            request.Moves,
            r => r.Id,
            e => e.Id,
            r => new PlaybookMove { Name = r.Name.Trim() },
            (r, e) =>
            {
                e.Name = r.Name.Trim();
                e.DescriptionText = Normalize(r.DescriptionText);
                e.Required = r.Required;
                e.SortOrder = r.SortOrder;
            });

        Reconcile(
            playbook.GearCategories,
            request.GearCategories,
            r => r.Id,
            e => e.Id,
            r => new PlaybookGearCategory { Label = r.Label.Trim() },
            (r, e) =>
            {
                e.Label = r.Label.Trim();
                e.PickCount = r.PickCount;
                e.IsOptional = r.IsOptional;
                e.SortOrder = r.SortOrder;

                Reconcile(
                    e.Options,
                    r.Options,
                    o => o.Id,
                    o => o.Id,
                    o => new PlaybookGearOption { Name = o.Name.Trim() },
                    (o, option) =>
                    {
                        option.Name = o.Name.Trim();
                        option.MechanicalText = Normalize(o.MechanicalText);
                        option.SortOrder = o.SortOrder;
                    });
            });

        Reconcile(
            playbook.LookCategories,
            request.LookCategories,
            r => r.Id,
            e => e.Id,
            r => new PlaybookLookCategory(),
            (r, e) =>
            {
                e.AllowsFreeform = r.AllowsFreeform;
                e.SortOrder = r.SortOrder;

                Reconcile(
                    e.Options,
                    r.Options,
                    o => o.Id,
                    o => o.Id,
                    o => new PlaybookLookOption { Text = o.Text.Trim() },
                    (o, option) =>
                    {
                        option.Text = o.Text.Trim();
                        option.SortOrder = o.SortOrder;
                    });
            });

        Reconcile(
            playbook.Improvements,
            request.Improvements,
            r => r.Id,
            e => e.Id,
            r => new PlaybookImprovement { Text = r.Text.Trim() },
            (r, e) =>
            {
                e.Text = r.Text.Trim();
                e.IsAdvanced = r.IsAdvanced;
                e.SortOrder = r.SortOrder;
            });
    }

    /*
     * The Id-based diff, in one place for every child collection.
     *
     * Matched by Id -> updated in place, so the row keeps its identity and any Hunter
     * live-linked to it (Phase 9/10) stays linked. No Id, or an Id that no longer exists
     * -> inserted. A stored row whose Id never appears in the request -> removed, which
     * EF translates to a DELETE because every one of these relationships is required with
     * cascade configured.
     *
     * Delete-all-and-reinsert was explicitly rejected for this: it would churn every child
     * Id on every save and break the live link. See architecture.md Section 3,
     * "Persistence semantics for the upsert-the-graph endpoint."
     *
     * An unrecognised Id is treated as an insert rather than an error on purpose — the row
     * it named is gone, and failing the whole request would make a concurrent delete
     * elsewhere impossible to recover from through the form.
     */
    private static void Reconcile<TEntity, TRequest>(
        ICollection<TEntity> existing,
        IReadOnlyList<TRequest>? incoming,
        Func<TRequest, Guid?> requestId,
        Func<TEntity, Guid> entityId,
        Func<TRequest, TEntity> create,
        Action<TRequest, TEntity> update)
    {
        var incomingItems = incoming ?? [];
        var existingById = existing.ToDictionary(entityId);
        var keptIds = new HashSet<Guid>();

        foreach (var item in incomingItems)
        {
            var id = requestId(item);

            if (id is { } value && existingById.TryGetValue(value, out var matched))
            {
                update(item, matched);
                keptIds.Add(value);
                continue;
            }

            var created = create(item);
            update(item, created);
            existing.Add(created);
        }

        foreach (var orphan in existingById.Values.Where(e => !keptIds.Contains(entityId(e))).ToList())
        {
            existing.Remove(orphan);
        }
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // -----------------------------------------------------------------------------------
    // Entity -> response
    // -----------------------------------------------------------------------------------

    private static PlaybookDetailResponse ToDetailResponse(Playbook playbook) => new(
        playbook.Id,
        playbook.Name,
        playbook.Tagline,
        playbook.Description,
        playbook.LuckBoxCount,
        playbook.LuckSpecialText,
        playbook.HarmUnstableThreshold,
        playbook.HarmBoxCount,
        playbook.ExperienceBoxCount,
        playbook.MoveGrantCount,
        playbook.GettingStartedText,
        playbook.IntroductionsText,
        playbook.LevelingUpText,
        playbook.HistoryPromptsText,
        [.. playbook.StatArrayOptions
            .OrderBy(x => x.SortOrder)
            .Select(x => new PlaybookStatArrayOptionResponse(x.Id, x.Charm, x.Cool, x.Sharp, x.Tough, x.Weird, x.SortOrder))],
        [.. playbook.Moves
            .OrderBy(x => x.SortOrder)
            .Select(x => new PlaybookMoveResponse(x.Id, x.Name, x.DescriptionText, x.Required, x.SortOrder))],
        [.. playbook.GearCategories
            .OrderBy(x => x.SortOrder)
            .Select(x => new PlaybookGearCategoryResponse(
                x.Id,
                x.Label,
                x.PickCount,
                x.IsOptional,
                x.SortOrder,
                [.. x.Options
                    .OrderBy(o => o.SortOrder)
                    .Select(o => new PlaybookGearOptionResponse(o.Id, o.Name, o.MechanicalText, o.SortOrder))]))],
        [.. playbook.LookCategories
            .OrderBy(x => x.SortOrder)
            .Select(x => new PlaybookLookCategoryResponse(
                x.Id,
                x.AllowsFreeform,
                x.SortOrder,
                [.. x.Options
                    .OrderBy(o => o.SortOrder)
                    .Select(o => new PlaybookLookOptionResponse(o.Id, o.Text, o.SortOrder))]))],
        [.. playbook.Improvements
            .OrderBy(x => x.IsAdvanced).ThenBy(x => x.SortOrder)
            .Select(x => new PlaybookImprovementResponse(x.Id, x.Text, x.IsAdvanced, x.SortOrder))]);
}
