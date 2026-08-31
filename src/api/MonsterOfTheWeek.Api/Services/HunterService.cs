using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

/// <summary>
/// Hunter instances — docs/hunter-playbooks/ Phase 10.
///
/// <para>
/// Everything a hunter is arrives in one <see cref="UpsertHunterRequest"/> and is persisted in
/// one transaction, the same single-endpoint shape Playbook uses. The difference is what the
/// child collections are: Playbook owns its children and reconciles them by Id, whereas a
/// hunter's picks are pure FK bridges into the *Playbook's* rows. There is nothing to update in
/// place, so the sets are replaced wholesale — the ids are the entire state.
/// </para>
///
/// <para>
/// <b>Partial hunters are savable by design</b> (architecture.md Section 9, 2026-08-31).
/// <c>Validate</c> below refuses only rules-violating payloads; what a hunter still owes its
/// playbook is computed by <see cref="HunterCompleteness"/> and returned on the response.
/// </para>
/// </summary>
public sealed class HunterService(IHunterRepository hunterRepository) : IHunterService
{
    public async Task<IReadOnlyList<HunterListItemResponse>> GetAllAsync(CancellationToken cancellationToken)
    {
        var hunters = await hunterRepository.GetAllHuntersAsync(cancellationToken);
        return hunters
            .Select(x => new HunterListItemResponse(
                x.Id,
                x.Name,
                x.PlaybookId,
                x.Playbook.Name,
                x.CreatedAt))
            .ToList();
    }

    /// <summary>
    /// Two round trips, deliberately. The response carries the hunter's outstanding items
    /// (<see cref="HunterCompleteness"/>), which needs the playbook's own option graph — and
    /// fetching it through the repository's existing validation query reuses the exact graph
    /// <see cref="Validate"/> already checks against, rather than widening the hunter query's
    /// includes into a second, separately-maintained shape that could drift from it.
    /// </summary>
    public async Task<HunterDetailResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var hunter = await hunterRepository.GetHunterDetailAsync(id, cancellationToken);
        if (hunter is null)
        {
            return null;
        }

        var playbook = await hunterRepository.GetPlaybookForValidationAsync(hunter.PlaybookId, cancellationToken);
        return ToDetailResponse(hunter, playbook);
    }

    public async Task<ServiceResult<HunterDetailResponse>> CreateAsync(
        UpsertHunterRequest request,
        CancellationToken cancellationToken)
    {
        var playbook = await hunterRepository.GetPlaybookForValidationAsync(request.PlaybookId, cancellationToken);
        if (playbook is null)
        {
            return ServiceResult<HunterDetailResponse>.Validation($"Playbook {request.PlaybookId} does not exist.");
        }

        var validationError = Validate(request, playbook);
        if (validationError is not null)
        {
            return ServiceResult<HunterDetailResponse>.Validation(validationError);
        }

        var hunter = new Hunter { Name = request.Name.Trim(), PlaybookId = playbook.Id };
        ApplyScalars(hunter, request);
        ApplyPicks(hunter, request, playbook);

        await hunterRepository.AddHunterAsync(hunter, cancellationToken);
        await hunterRepository.SaveChangesAsync(cancellationToken);

        // Re-read rather than mapping the tracked graph: the entity's Playbook navigation was
        // never populated on this path, and the response carries PlaybookName.
        var response = await GetByIdAsync(hunter.Id, cancellationToken);
        return ServiceResult<HunterDetailResponse>.Success(response!);
    }

    public async Task<ServiceResult<HunterDetailResponse>> UpdateAsync(
        Guid id,
        UpsertHunterRequest request,
        CancellationToken cancellationToken)
    {
        var hunter = await hunterRepository.GetHunterForUpdateAsync(id, cancellationToken);
        if (hunter is null)
        {
            return ServiceResult<HunterDetailResponse>.NotFound($"Hunter {id} was not found.");
        }

        var playbook = await hunterRepository.GetPlaybookForValidationAsync(request.PlaybookId, cancellationToken);
        if (playbook is null)
        {
            return ServiceResult<HunterDetailResponse>.Validation($"Playbook {request.PlaybookId} does not exist.");
        }

        var validationError = Validate(request, playbook);
        if (validationError is not null)
        {
            return ServiceResult<HunterDetailResponse>.Validation(validationError);
        }

        hunter.Name = request.Name.Trim();
        hunter.PlaybookId = playbook.Id;
        ApplyScalars(hunter, request);
        ApplyPicks(hunter, request, playbook);

        await hunterRepository.SaveChangesAsync(cancellationToken);

        var response = await GetByIdAsync(id, cancellationToken);
        return ServiceResult<HunterDetailResponse>.Success(response!);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken) =>
        await hunterRepository.DeleteHunterAsync(id, cancellationToken) > 0;

    // -----------------------------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------------------------

    /*
     * Everything here is a cross-entity rule that DataAnnotations cannot express, because every
     * one of them depends on the *selected playbook* rather than on the payload alone. Anything
     * single-field (required name, non-negative counters) is already rejected by model binding
     * before this runs.
     *
     * This method is one half of a deliberate split (architecture.md Section 9, decided
     * 2026-08-31). It holds only the rules whose violation would make the stored row assert
     * something *false* about the playbook: a pick that is not the playbook's, a duplicate, an
     * advanced move, more picks than a stated ceiling allows, a track value past its last box.
     * Every one of those is fixable by *removing* something, so no edit can be locked out by it.
     *
     * Minimums are not here, on purpose. An unanswered section asserts nothing false — it is
     * merely unfinished — and a hunter is live-linked to its playbook, so refusing to save an
     * incomplete one would make an existing hunter unsavable the instant its playbook gained a
     * requirement, with no way to fix an unrelated typo without first finishing rules work.
     * Minimums live in HunterCompleteness and are reported on the response instead.
     */
    private static string? Validate(UpsertHunterRequest request, Playbook playbook)
    {
        if (request.PlaybookStatArrayOptionId is { } statArrayId
            && playbook.StatArrayOptions.All(x => x.Id != statArrayId))
        {
            return $"Rating array {statArrayId} does not belong to playbook \"{playbook.Name}\".";
        }

        var moveIds = request.PlaybookMoveIds ?? [];
        if (moveIds.Distinct().Count() != moveIds.Count)
        {
            return "The same move was picked more than once.";
        }

        var movesById = playbook.Moves.ToDictionary(x => x.Id);
        foreach (var moveId in moveIds)
        {
            if (!movesById.TryGetValue(moveId, out var move))
            {
                return $"Move {moveId} does not belong to playbook \"{playbook.Name}\".";
            }

            // An advanced move is reachable only through an advanced improvement, never at
            // creation (architecture.md Section 3, PlaybookMove.IsAdvanced). Rejecting it here
            // is what stops a hand-made request doing what the form will not offer.
            if (move.IsAdvanced)
            {
                return $"\"{move.Name}\" is an advanced move and cannot be taken at creation.";
            }
        }

        /*
         * MoveGrantCount is how many moves a hunter picks beyond the ones the playbook grants
         * outright, so Required moves are excluded from the count rather than consuming a pick.
         *
         * Only enforced when the count is greater than zero. architecture.md Section 3 is
         * explicit that 0 is indistinguishable from "this playbook grants no moves" and must not
         * be branched on as authored data — true of any playbook created through the admin UI
         * whose Moves section has not been filled in. Treating 0 as "no ceiling stated" keeps
         * those playbooks usable instead of making them impossible to build a hunter from.
         */
        if (playbook.MoveGrantCount > 0)
        {
            var chosenCount = moveIds.Count(id => !movesById[id].Required);
            if (chosenCount > playbook.MoveGrantCount)
            {
                return $"Playbook \"{playbook.Name}\" allows {playbook.MoveGrantCount} move "
                    + $"{(playbook.MoveGrantCount == 1 ? "pick" : "picks")}, but {chosenCount} were made.";
            }
        }

        var gearIds = request.PlaybookGearOptionIds ?? [];
        if (gearIds.Distinct().Count() != gearIds.Count)
        {
            return "The same gear option was picked more than once.";
        }

        var gearOptionIds = playbook.GearCategories.SelectMany(c => c.Options).Select(o => o.Id).ToHashSet();
        foreach (var gearId in gearIds)
        {
            if (!gearOptionIds.Contains(gearId))
            {
                return $"Gear option {gearId} does not belong to playbook \"{playbook.Name}\".";
            }
        }

        /*
         * PickCount as a ceiling, matching how MoveGrantCount is treated directly above — and
         * for the same reason (Section 9): a category holding more picks than the sheet allows
         * is a hunter that owns gear the rules never gave it, which is a false statement about
         * the playbook rather than merely an unfinished one. Falling *short* of PickCount is
         * the unfinished case and is reported by HunterCompleteness instead of refused here.
         *
         * A null PickCount is not a ceiling of zero — it means every option in the category is
         * granted outright (PlaybookGearCategory.PickCount), so there is nothing to exceed.
         * Until 2026-08-31 this was enforced only by the Angular form disabling further
         * checkboxes, which is not enforcement at all.
         */
        var chosenGear = gearIds.ToHashSet();
        foreach (var category in playbook.GearCategories)
        {
            if (category.PickCount is not { } pickCount)
            {
                continue;
            }

            var picked = category.Options.Count(o => chosenGear.Contains(o.Id));
            if (picked > pickCount)
            {
                return $"\"{category.Label}\" allows {pickCount} "
                    + $"{(pickCount == 1 ? "pick" : "picks")}, but {picked} were made.";
            }
        }

        var lookError = ValidateLooks(request.Looks ?? [], playbook);
        if (lookError is not null)
        {
            return lookError;
        }

        var extraTrackError = ValidateExtraTracks(request.ExtraTracks ?? [], playbook);
        if (extraTrackError is not null)
        {
            return extraTrackError;
        }

        // The playbook's own track lengths are the real ceiling; the attribute ranges on the
        // request are only a sanity bound. A hunter whose playbook is later edited *shorter*
        // will fail here on its next save rather than silently storing an impossible value —
        // a direct, accepted consequence of the live-link design (architecture.md Section 3).
        return CheckTrack("Luck", request.Luck, playbook.LuckBoxCount)
            ?? CheckTrack("Harm", request.Harm, playbook.HarmBoxCount)
            ?? CheckTrack("Experience", request.Experience, playbook.ExperienceBoxCount);
    }

    private static string? ValidateLooks(IReadOnlyList<HunterLookSelectionModel> looks, Playbook playbook)
    {
        if (looks.Select(x => x.LookCategoryId).Distinct().Count() != looks.Count)
        {
            return "The same look line was answered more than once.";
        }

        var categoriesById = playbook.LookCategories.ToDictionary(x => x.Id);
        foreach (var look in looks)
        {
            if (!categoriesById.TryGetValue(look.LookCategoryId, out var category))
            {
                return $"Look line {look.LookCategoryId} does not belong to playbook \"{playbook.Name}\".";
            }

            var hasFreeform = !string.IsNullOrWhiteSpace(look.FreeformText);

            // "Exactly one of" is a rule no database constraint here expresses, so it is checked
            // rather than assumed. An unanswered line is represented by having no entry at all.
            if (look.LookOptionId is null && !hasFreeform)
            {
                return "A look line was submitted with neither an option nor any text.";
            }

            if (look.LookOptionId is not null && hasFreeform)
            {
                return "A look line was submitted with both an option and custom text; pick one.";
            }

            if (hasFreeform && !category.AllowsFreeform)
            {
                return "That look line does not accept custom text.";
            }

            if (look.LookOptionId is { } optionId && category.Options.All(o => o.Id != optionId))
            {
                return $"Look option {optionId} does not belong to that look line.";
            }
        }

        return null;
    }

    private static string? ValidateExtraTracks(IReadOnlyList<HunterExtraTrackValueModel> values, Playbook playbook)
    {
        if (values.Select(x => x.ExtraTrackId).Distinct().Count() != values.Count)
        {
            return "The same extra track was given a value more than once.";
        }

        var tracksById = playbook.ExtraTracks.ToDictionary(x => x.Id);
        foreach (var value in values)
        {
            if (!tracksById.TryGetValue(value.ExtraTrackId, out var track))
            {
                return $"Extra track {value.ExtraTrackId} does not belong to playbook \"{playbook.Name}\".";
            }

            if (value.CurrentValue < 0 || value.CurrentValue > track.BoxCount)
            {
                return $"{track.Name} is {value.CurrentValue}, but that track only has {track.BoxCount} boxes.";
            }
        }

        return null;
    }

    private static string? CheckTrack(string label, int value, int boxCount) =>
        value > boxCount
            ? $"{label} is {value}, but this playbook only has {boxCount} {label.ToLowerInvariant()} boxes."
            : null;

    // -----------------------------------------------------------------------------------
    // Mapping
    // -----------------------------------------------------------------------------------

    private static void ApplyScalars(Hunter hunter, UpsertHunterRequest request)
    {
        hunter.Pronouns = Normalize(request.Pronouns);
        hunter.PlaybookStatArrayOptionId = request.PlaybookStatArrayOptionId;
        hunter.Luck = request.Luck;
        hunter.Harm = request.Harm;
        hunter.Experience = request.Experience;
        hunter.Background = Normalize(request.Background);
    }

    /// <summary>
    /// Replaces both pick sets outright.
    ///
    /// <para>
    /// <b>Required moves are added whether or not the client sent them.</b> A playbook that
    /// grants a move outright grants it to every hunter built from it, so leaving that to the
    /// caller would let a hunter exist without a move the rules say it always has. The result is
    /// visible in the response, and the form renders those checked and disabled — this enforces
    /// the invariant rather than quietly overriding a choice, because there is no choice to make.
    /// </para>
    /// </summary>
    private void ApplyPicks(Hunter hunter, UpsertHunterRequest request, Playbook playbook)
    {
        var moveIds = (request.PlaybookMoveIds ?? []).ToHashSet();
        foreach (var required in playbook.Moves.Where(m => m.Required))
        {
            moveIds.Add(required.Id);
        }

        SyncBridge(hunter.Moves, moveIds, x => x.PlaybookMoveId,
            id => new HunterMove { HunterId = hunter.Id, PlaybookMoveId = id },
            hunterRepository.RemoveMovePicks);

        SyncBridge(hunter.GearSelections, (request.PlaybookGearOptionIds ?? []).ToHashSet(),
            x => x.PlaybookGearOptionId,
            id => new HunterGearSelection { HunterId = hunter.Id, PlaybookGearOptionId = id },
            hunterRepository.RemoveGearPicks);

        /*
         * Looks and extra tracks carry a value as well as a key, so they cannot use SyncBridge —
         * a row whose key survives may still need updating in place. Same three-way shape as
         * Playbook's own Id-based diff: update the ones that stayed, insert the new ones, and
         * explicitly delete the ones that dropped out (same fixup trap as above).
         */
        SyncKeyed(
            hunter.LookSelections,
            request.Looks ?? [],
            x => x.LookCategoryId,
            r => r.LookCategoryId,
            r => new HunterLookSelection { HunterId = hunter.Id, LookCategoryId = r.LookCategoryId },
            (r, e) =>
            {
                e.LookOptionId = r.LookOptionId;
                e.FreeformText = Normalize(r.FreeformText);
            },
            hunterRepository.RemoveLookPicks);

        SyncKeyed(
            hunter.ExtraTrackValues,
            request.ExtraTracks ?? [],
            x => x.ExtraTrackId,
            r => r.ExtraTrackId,
            r => new HunterExtraTrackValue { HunterId = hunter.Id, ExtraTrackId = r.ExtraTrackId },
            (r, e) => e.CurrentValue = r.CurrentValue,
            hunterRepository.RemoveExtraTrackValues);
    }

    /// <summary>
    /// <see cref="SyncBridge{T}"/>'s twin for collections whose rows carry data beyond their key:
    /// surviving rows are mutated in place rather than left alone.
    /// </summary>
    private static void SyncKeyed<TEntity, TRequest>(
        ICollection<TEntity> existing,
        IReadOnlyList<TRequest> requested,
        Func<TEntity, Guid> entityKey,
        Func<TRequest, Guid> requestKey,
        Func<TRequest, TEntity> create,
        Action<TRequest, TEntity> apply,
        Action<IEnumerable<TEntity>> remove)
    {
        var desired = requested.ToDictionary(requestKey);

        var stale = existing.Where(x => !desired.ContainsKey(entityKey(x))).ToList();
        foreach (var row in stale)
        {
            existing.Remove(row);
        }

        remove(stale);

        var byKey = existing.ToDictionary(entityKey);
        foreach (var item in requested)
        {
            if (byKey.TryGetValue(requestKey(item), out var entity))
            {
                apply(item, entity);
            }
            else
            {
                var created = create(item);
                apply(item, created);
                existing.Add(created);
            }
        }
    }

    /*
     * Brings a pick set to exactly `desiredIds`, touching nothing that is already correct.
     *
     * Two things happen to a dropped row, and both are needed. It leaves the in-memory
     * collection, so the graph matches what was asked for; and it is handed to `remove`, which
     * marks it Deleted outright. Relying on the severed navigation alone is not enough — see the
     * comment on IHunterRepository.RemoveMovePicks for the fixup that silently undoes it.
     */
    private static void SyncBridge<T>(
        ICollection<T> existing,
        HashSet<Guid> desiredIds,
        Func<T, Guid> keyOf,
        Func<Guid, T> create,
        Action<IEnumerable<T>> remove)
    {
        var stale = existing.Where(x => !desiredIds.Contains(keyOf(x))).ToList();
        foreach (var row in stale)
        {
            existing.Remove(row);
        }

        remove(stale);

        var present = existing.Select(keyOf).ToHashSet();
        foreach (var id in desiredIds.Where(id => !present.Contains(id)))
        {
            existing.Add(create(id));
        }
    }

    private static HunterDetailResponse ToDetailResponse(Hunter hunter, Playbook? playbook) => new(
        hunter.Id,
        hunter.Name,
        hunter.Pronouns,
        hunter.PlaybookId,
        hunter.Playbook.Name,
        hunter.PlaybookStatArrayOptionId,
        hunter.Luck,
        hunter.Harm,
        hunter.Experience,
        hunter.Background,
        [.. hunter.Moves.Select(x => x.PlaybookMoveId)],
        [.. hunter.GearSelections.Select(x => x.PlaybookGearOptionId)],
        [.. hunter.LookSelections.Select(x => new HunterLookSelectionModel(x.LookCategoryId, x.LookOptionId, x.FreeformText))],
        [.. hunter.ExtraTrackValues.Select(x => new HunterExtraTrackValueModel(x.ExtraTrackId, x.CurrentValue))],
        // A null playbook is unreachable in practice — the FK is Restrict and a hunter cannot
        // outlive its template — so an empty list is the honest answer rather than a fallback
        // worth a code path: nothing is known to be outstanding.
        playbook is null ? [] : HunterCompleteness.Evaluate(hunter, playbook),
        hunter.CreatedAt);

    private static string? Normalize(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
