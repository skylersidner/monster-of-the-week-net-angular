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

        var inUseError = await CheckRemovedChildrenAreUnusedAsync(playbook, request, cancellationToken);
        if (inUseError is not null)
        {
            return ServiceResult<PlaybookDetailResponse>.Conflict(inUseError);
        }

        playbook.Name = name;
        ApplyScalars(playbook, request);
        ApplyChildren(playbook, request);

        await repository.SaveChangesAsync(cancellationToken);

        return ServiceResult<PlaybookDetailResponse>.Success(ToDetailResponse(playbook));
    }

    /// <summary>
    /// Refuses to delete a Playbook any Hunter is built from.
    ///
    /// <para>
    /// architecture.md Section 3 deferred this check to "Phase 9/10, not dropped", and Phase 9
    /// is where it becomes reachable: <c>Hunter</c> is the first row that can reference a
    /// Playbook. The FK is <c>Restrict</c>, so without this guard the delete would surface as an
    /// unhandled constraint violation — a 500 with no usable message — instead of a 409 naming
    /// how many Hunters are in the way.
    /// </para>
    ///
    /// <para>
    /// <b>Scope limit worth knowing:</b> this is the whole-Playbook case only. Rejecting the
    /// removal of an individual *child row* a Hunter references (a move, a gear option, a
    /// bespoke option) is still deferred — those bridges do not exist until Phase 10, so there
    /// is nothing yet to count. The residual sharp edge documented in Section 3 stands until then.
    /// </para>
    /// </summary>
    public async Task<ServiceResult<bool>> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var hunterCount = await repository.CountHuntersAsync(id, cancellationToken);
        if (hunterCount > 0)
        {
            var plural = hunterCount == 1 ? "hunter is" : "hunters are";
            return ServiceResult<bool>.Conflict(
                $"{hunterCount} {plural} built from this playbook. Delete or reassign them first.");
        }

        return ServiceResult<bool>.Success(await repository.DeleteAsync(id, cancellationToken) > 0);
    }

    /// <summary>
    /// Refuses an edit that would remove a child row some Hunter is still pointing at.
    ///
    /// <para>
    /// This is the per-child half of architecture.md Section 3's deferred check, and Phase 10 is
    /// where it becomes implementable: <c>HunterMove</c> and <c>HunterGearSelection</c> did not
    /// exist before. Without it the Id-based diff silently deletes template rows out from under
    /// live hunters — the exact failure the diff was chosen to avoid in the first place.
    /// </para>
    ///
    /// <para>
    /// Runs <em>before</em> any mutation, so a rejected edit leaves the tracked graph untouched.
    /// Every kind a Hunter can currently point at is checked — rating arrays, moves, gear
    /// options, look lines, look options, extra tracks. Improvements, bespoke rows and journals
    /// stay freely removable because they still have no instance-side table; this method is the
    /// place to extend when they get one.
    /// </para>
    /// </summary>
    private async Task<string?> CheckRemovedChildrenAreUnusedAsync(
        Playbook stored,
        UpsertPlaybookRequest request,
        CancellationToken cancellationToken)
    {
        var keptStatArrays = (request.StatArrayOptions ?? []).Where(x => x.Id.HasValue).Select(x => x.Id!.Value).ToHashSet();
        var keptMoves = (request.Moves ?? []).Where(x => x.Id.HasValue).Select(x => x.Id!.Value).ToHashSet();
        // Options of a category dropped from the request are removed along with it, so the kept
        // set is flattened across the request's categories rather than matched category by category.
        var keptGear = (request.GearCategories ?? [])
            .SelectMany(c => c.Options ?? [])
            .Where(o => o.Id.HasValue)
            .Select(o => o.Id!.Value)
            .ToHashSet();

        // Label each candidate now, while the stored graph is in hand — the repository comes back
        // with bare ids, and a "3 rows are in use" error the user cannot act on is barely better
        // than no error at all.
        var labels = new Dictionary<Guid, string>();
        foreach (var option in stored.StatArrayOptions.Where(x => !keptStatArrays.Contains(x.Id)))
        {
            labels[option.Id] = $"rating array #{option.SortOrder + 1}";
        }

        foreach (var move in stored.Moves.Where(x => !keptMoves.Contains(x.Id)))
        {
            labels[move.Id] = $"move \"{move.Name}\"";
        }

        foreach (var option in stored.GearCategories.SelectMany(c => c.Options).Where(x => !keptGear.Contains(x.Id)))
        {
            labels[option.Id] = $"gear \"{option.Name}\"";
        }

        // Look *categories* are referenceable too, not just their options: a hunter who wrote
        // their own text for a line points at the line itself with no option id at all, so
        // removing the line would orphan that answer.
        var keptLookCategories = (request.LookCategories ?? []).Where(x => x.Id.HasValue).Select(x => x.Id!.Value).ToHashSet();
        var keptLookOptions = (request.LookCategories ?? [])
            .SelectMany(c => c.Options ?? [])
            .Where(o => o.Id.HasValue)
            .Select(o => o.Id!.Value)
            .ToHashSet();

        foreach (var category in stored.LookCategories.Where(x => !keptLookCategories.Contains(x.Id)))
        {
            labels[category.Id] = $"look line #{category.SortOrder + 1}";
        }

        foreach (var option in stored.LookCategories.SelectMany(c => c.Options).Where(x => !keptLookOptions.Contains(x.Id)))
        {
            labels[option.Id] = $"look \"{option.Text}\"";
        }

        var keptTracks = (request.ExtraTracks ?? []).Where(x => x.Id.HasValue).Select(x => x.Id!.Value).ToHashSet();
        foreach (var track in stored.ExtraTracks.Where(x => !keptTracks.Contains(x.Id)))
        {
            labels[track.Id] = $"track \"{track.Name}\"";
        }

        /*
         * Bespoke rows. A Section is referenced directly — not only through its options — by a
         * free-text answer and by a repeatable section's instances, so the Section itself is a
         * candidate, exactly as look categories are.
         *
         * A Move's own sections arrive nested under the Move rather than in the top-level list
         * (BespokeSection.PlaybookMoveId, architecture.md 6.8), so both places are gathered here
         * or every move-internal section would look removed on every save.
         */
        var keptSections = (request.BespokeSections ?? []).Where(x => x.Id.HasValue).Select(x => x.Id!.Value)
            .Concat((request.Moves ?? []).SelectMany(m => m.BespokeSections ?? []).Where(x => x.Id.HasValue).Select(x => x.Id!.Value))
            .ToHashSet();
        var keptOptions = (request.BespokeSections ?? []).SelectMany(s => FlattenOptionIds(s.Options))
            .Concat((request.Moves ?? []).SelectMany(m => m.BespokeSections ?? []).SelectMany(s => FlattenOptionIds(s.Options)))
            .ToHashSet();

        foreach (var section in stored.BespokeSections.Where(x => !keptSections.Contains(x.Id)))
        {
            labels[section.Id] = $"bespoke section \"{section.Title}\"";
        }

        foreach (var option in stored.BespokeSections.SelectMany(s => s.Options).Where(x => !keptOptions.Contains(x.Id)))
        {
            labels[option.Id] = $"bespoke option \"{option.Title ?? option.DescriptionText}\"";
        }

        var keptJournals = (request.BespokeJournals ?? []).Where(x => x.Id.HasValue).Select(x => x.Id!.Value).ToHashSet();
        var keptJournalFields = (request.BespokeJournals ?? []).SelectMany(j => j.Fields ?? [])
            .Where(f => f.Id.HasValue).Select(f => f.Id!.Value).ToHashSet();

        foreach (var journal in stored.BespokeJournals.Where(x => !keptJournals.Contains(x.Id)))
        {
            labels[journal.Id] = $"journal \"{journal.Title}\"";
        }

        foreach (var field in stored.BespokeJournals.SelectMany(j => j.Fields).Where(x => !keptJournalFields.Contains(x.Id)))
        {
            labels[field.Id] = $"journal field \"{field.Label}\"";
        }

        if (labels.Count == 0)
        {
            return null;
        }

        var inUse = await repository.GetHunterReferencedChildIdsAsync(labels.Keys, cancellationToken);
        if (inUse.Count == 0)
        {
            return null;
        }

        var named = inUse.Select(id => labels[id]).OrderBy(x => x, StringComparer.Ordinal).ToList();
        return $"Cannot remove {(named.Count == 1 ? "an entry that a hunter is" : "entries that hunters are")} "
            + $"using: {string.Join(", ", named)}. Update those hunters first.";
    }

    /// <summary>
    /// Every option id in a request's nested option tree, at any depth — the wire format nests
    /// children, so a flat "which ids did the client keep" set needs the walk.
    /// </summary>
    private static IEnumerable<Guid> FlattenOptionIds(IReadOnlyList<UpsertBespokeOptionRequest>? options)
    {
        foreach (var option in options ?? [])
        {
            if (option.Id is { } id)
            {
                yield return id;
            }

            foreach (var child in FlattenOptionIds(option.Children))
            {
                yield return child;
            }
        }
    }

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

        foreach (var section in request.BespokeSections ?? [])
        {
            var error = ValidateBespokeSection(section);
            if (error is not null)
            {
                return error;
            }
        }

        // Phase 6: a Move's embedded pick-structure gets the identical rules. It is the same
        // apparatus attached one level lower, so validating it differently would be a bug.
        foreach (var move in request.Moves ?? [])
        {
            foreach (var section in move.BespokeSections ?? [])
            {
                var error = ValidateBespokeSection(section);
                if (error is not null)
                {
                    return $"Move \"{move.Name}\": {error}";
                }
            }
        }

        return null;
    }

    /*
     * Guards the invariants architecture.md Section 6 states in prose, so a malformed
     * ruleset is rejected at authoring time rather than discovered when a Hunter form tries
     * to render it. Deliberately does NOT try to enforce the shape vocabulary from Section
     * 6.5 — shape is derived from populated fields, never validated as a closed set, and a
     * new legitimate combination should not need a code change to be storable.
     */
    private static string? ValidateBespokeSection(UpsertBespokeSectionRequest section)
    {
        var optionCount = section.Options?.Count ?? 0;

        // 6.1: both null means "no option set to pick from at all". 0/0 would wrongly read
        // as a real but empty option set, so it is rejected rather than silently accepted.
        if (section.MinSelect is 0 && section.MaxSelect is 0)
        {
            return $"Bespoke section \"{section.Title}\" uses MinSelect/MaxSelect of 0/0; leave both null to mean \"no options to pick from\".";
        }

        if (section.MinSelect is { } min && section.MaxSelect is { } max && min > max)
        {
            return $"Bespoke section \"{section.Title}\" has MinSelect {min} greater than MaxSelect {max}.";
        }

        if (section.MaxSelect is { } cap && optionCount > 0 && cap > optionCount)
        {
            return $"Bespoke section \"{section.Title}\" allows picking {cap} option(s) but only lists {optionCount}.";
        }

        // 6.1: FreeTextLabel is for a Section whose entire content is one authored value.
        if (section.FreeTextLabel is not null && optionCount > 0)
        {
            return $"Bespoke section \"{section.Title}\" sets FreeTextLabel but also lists {optionCount} option(s); a free-text section has none.";
        }

        if (section.MinInstances is { } minI && section.MaxInstances is { } maxI && minI > maxI)
        {
            return $"Bespoke section \"{section.Title}\" has MinInstances {minI} greater than MaxInstances {maxI}.";
        }

        return ValidateOptions(section.Title, section.Options);
    }

    private static string? ValidateOptions(string sectionTitle, IReadOnlyList<UpsertBespokeOptionRequest>? options)
    {
        foreach (var option in options ?? [])
        {
            var label = option.Title ?? option.DescriptionText ?? "(untitled)";
            var childCount = option.Children?.Count ?? 0;

            if (option.MaxSelect is { } cap && childCount > 0 && cap > childCount)
            {
                return $"Option \"{label}\" in \"{sectionTitle}\" allows picking {cap} child option(s) but only lists {childCount}.";
            }

            if (option.MinSelect is { } min && option.MaxSelect is { } max && min > max)
            {
                return $"Option \"{label}\" in \"{sectionTitle}\" has MinSelect {min} greater than MaxSelect {max}.";
            }

            // 6.1: a numeric leaf has no children, so its own MinSelect/MaxSelect stay null.
            if (option.NumericMin is not null && childCount > 0)
            {
                return $"Option \"{label}\" in \"{sectionTitle}\" is a numeric leaf but has {childCount} child option(s).";
            }

            if (option.NumericMin is { } nMin && option.NumericMax is { } nMax && nMin > nMax)
            {
                return $"Option \"{label}\" in \"{sectionTitle}\" has NumericMin {nMin} greater than NumericMax {nMax}.";
            }

            // Neither title nor description nor children: nothing to render or pick.
            if (option.Title is null && option.DescriptionText is null && childCount == 0)
            {
                return $"An option in \"{sectionTitle}\" has no title, no description, and no children.";
            }

            var childError = ValidateOptions(sectionTitle, option.Children);
            if (childError is not null)
            {
                return childError;
            }
        }

        return null;
    }

    // -----------------------------------------------------------------------------------
    // Request -> entity
    // -----------------------------------------------------------------------------------

    private static void ApplyScalars(Playbook playbook, UpsertPlaybookRequest request)
    {
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
                e.IsAdvanced = r.IsAdvanced;
                e.SortOrder = r.SortOrder;

                // Phase 6: this Move's own embedded pick-structure, if it has any.
                ReconcileSections(playbook, e, r.BespokeSections);
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
                e.GroupLabel = Normalize(r.GroupLabel);
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

        ApplyBespoke(playbook, request);
    }

    // -----------------------------------------------------------------------------------
    // Phase 5 — bespoke rulesets
    // -----------------------------------------------------------------------------------

    private static void ApplyBespoke(Playbook playbook, UpsertPlaybookRequest request)
    {
        // Playbook-level rulesets only. A Move's own sections are reconciled while walking
        // the Moves collection, against that Move's own subset — see ReconcileSections.
        ReconcileSections(playbook, null, request.BespokeSections);

        Reconcile(
            playbook.BespokeJournals,
            request.BespokeJournals,
            r => r.Id,
            e => e.Id,
            r => new BespokeJournal { Title = r.Title.Trim() },
            (r, e) =>
            {
                e.Title = r.Title.Trim();
                e.Description = Normalize(r.Description);
                e.EffectText = Normalize(r.EffectText);
                e.SortOrder = r.SortOrder;

                Reconcile(
                    e.Fields,
                    r.Fields,
                    f => f.Id,
                    f => f.Id,
                    f => new BespokeJournalField { Label = f.Label.Trim() },
                    (f, field) =>
                    {
                        field.Label = f.Label.Trim();
                        field.SortOrder = f.SortOrder;
                    });
            });

        Reconcile(
            playbook.ExtraTracks,
            request.ExtraTracks,
            r => r.Id,
            e => e.Id,
            r => new PlaybookExtraTrack { Name = r.Name.Trim(), EndLabel = r.EndLabel.Trim() },
            (r, e) =>
            {
                e.Name = r.Name.Trim();
                e.Description = Normalize(r.Description);
                e.EffectText = Normalize(r.EffectText);
                e.BoxCount = r.BoxCount;
                e.StartLabel = Normalize(r.StartLabel);
                e.EndLabel = r.EndLabel.Trim();
                e.SortOrder = r.SortOrder;
            });
    }

    /*
     * Reconciles the bespoke Sections belonging to one owner.
     *
     * `playbook.BespokeSections` is a single FK-backed collection holding BOTH kinds of row
     * — playbook-level (PlaybookMoveId null) and Move-attached — because both carry
     * PlaybookId. So this cannot use Reconcile directly: the "existing" set is a filtered
     * view of that collection, while additions and removals must be applied to the
     * collection itself.
     *
     * `owningMove` null reconciles the playbook-level rulesets; a Move reconciles that
     * Move's own embedded pick-structure. Getting this filter wrong in either direction
     * would silently delete the other kind, which is exactly why the API nests a Move's
     * sections under the Move rather than leaving callers to remember the rule.
     */
    private static void ReconcileSections(
        Playbook playbook,
        PlaybookMove? owningMove,
        IReadOnlyList<UpsertBespokeSectionRequest>? incoming)
    {
        var incomingItems = incoming ?? [];
        var existing = playbook.BespokeSections
            .Where(s => owningMove is null ? s.PlaybookMoveId is null : s.PlaybookMoveId == owningMove.Id)
            .ToList();
        var keptIds = new HashSet<Guid>();

        foreach (var item in incomingItems)
        {
            BespokeSection target;

            if (item.Id is { } id && existing.FirstOrDefault(s => s.Id == id) is { } matched)
            {
                target = matched;
                keptIds.Add(id);
            }
            else
            {
                target = new BespokeSection { Title = item.Title.Trim() };
                playbook.BespokeSections.Add(target);
            }

            target.PlaybookId = playbook.Id;
            target.PlaybookMove = owningMove;
            target.PlaybookMoveId = owningMove?.Id;
            target.Title = item.Title.Trim();
            target.Description = Normalize(item.Description);
            target.EffectText = Normalize(item.EffectText);
            target.FreeTextLabel = Normalize(item.FreeTextLabel);
            target.MinSelect = item.MinSelect;
            target.MaxSelect = item.MaxSelect;
            target.MinInstances = item.MinInstances;
            target.MaxInstances = item.MaxInstances;
            target.SortOrder = item.SortOrder;

            ReconcileOptions(target, null, target.Options.Where(o => o.ParentOptionId is null), item.Options);
        }

        foreach (var orphan in existing.Where(s => !keptIds.Contains(s.Id)))
        {
            playbook.BespokeSections.Remove(orphan);
        }
    }

    /*
     * The recursive twin of Reconcile, for BespokeOption's self-referencing tree.
     *
     * It cannot reuse Reconcile directly for two reasons. First, the "existing" set at each
     * level is not a stored navigation collection but a filtered view of the Section's flat
     * option list (children of one specific parent), so removals have to be applied to the
     * Section's own collection. Second, deleting an option must delete its whole subtree:
     * the self-referencing FK is NoAction by design (see MotwDbContext), so nothing in the
     * database will cascade that for us and an orphaned grandchild would violate the FK.
     *
     * `parent` is null at the top level; every option gets SectionId set at every depth,
     * which is what lets the repository load the whole tree with a single Include.
     */
    private static void ReconcileOptions(
        BespokeSection section,
        BespokeOption? parent,
        IEnumerable<BespokeOption> existingAtThisLevel,
        IReadOnlyList<UpsertBespokeOptionRequest>? incoming)
    {
        var incomingItems = incoming ?? [];
        var existing = existingAtThisLevel.ToList();
        var keptIds = new HashSet<Guid>();

        foreach (var item in incomingItems)
        {
            BespokeOption target;

            if (item.Id is { } id && existing.FirstOrDefault(o => o.Id == id) is { } matched)
            {
                target = matched;
                keptIds.Add(id);
            }
            else
            {
                target = new BespokeOption();
                section.Options.Add(target);
            }

            target.SectionId = section.Id;
            target.ParentOption = parent;
            target.ParentOptionId = parent?.Id;
            target.Title = Normalize(item.Title);
            target.DescriptionText = Normalize(item.DescriptionText);
            target.MinSelect = item.MinSelect;
            target.MaxSelect = item.MaxSelect;
            target.NumericMin = item.NumericMin;
            target.NumericMax = item.NumericMax;
            target.SortOrder = item.SortOrder;

            ReconcileOptions(
                section,
                target,
                section.Options.Where(o => o.ParentOptionId == target.Id && o.Id != target.Id),
                item.Children);
        }

        foreach (var orphan in existing.Where(o => !keptIds.Contains(o.Id)))
        {
            RemoveSubtree(section, orphan);
        }
    }

    /// <summary>
    /// Removes an option and every descendant, deepest first. Necessary because the
    /// self-referencing FK is deliberately NoAction — see the comment on ReconcileOptions.
    /// </summary>
    private static void RemoveSubtree(BespokeSection section, BespokeOption option)
    {
        foreach (var child in section.Options.Where(o => o.ParentOptionId == option.Id && o.Id != option.Id).ToList())
        {
            RemoveSubtree(section, child);
        }

        section.Options.Remove(option);
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
        // Ordered the same way improvements are: the two lists are separate sequences, each
        // restarting its own SortOrder at 0, so IsAdvanced has to lead the ordering or the
        // creation-time moves and the advanced ones interleave.
        [.. playbook.Moves
            .OrderBy(x => x.IsAdvanced).ThenBy(x => x.SortOrder)
            .Select(x => new PlaybookMoveResponse(
                x.Id,
                x.Name,
                x.DescriptionText,
                x.Required,
                x.IsAdvanced,
                x.SortOrder,
                [.. playbook.BespokeSections
                    .Where(s => s.PlaybookMoveId == x.Id)
                    .OrderBy(s => s.SortOrder)
                    .Select(ToSectionResponse)]))],
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
                x.GroupLabel,
                x.SortOrder,
                [.. x.Options
                    .OrderBy(o => o.SortOrder)
                    .Select(o => new PlaybookLookOptionResponse(o.Id, o.Text, o.SortOrder))]))],
        [.. playbook.Improvements
            .OrderBy(x => x.IsAdvanced).ThenBy(x => x.SortOrder)
            .Select(x => new PlaybookImprovementResponse(x.Id, x.Text, x.IsAdvanced, x.SortOrder))],
        // Phase 6: playbook-level rulesets only. Move-attached Sections are returned
        // nested under their own Move instead, which is what keeps this filter honest.
        [.. playbook.BespokeSections
            .Where(x => x.PlaybookMoveId is null)
            .OrderBy(x => x.SortOrder)
            .Select(ToSectionResponse)],
        [.. playbook.BespokeJournals
            .OrderBy(x => x.SortOrder)
            .Select(x => new BespokeJournalResponse(
                x.Id,
                x.Title,
                x.Description,
                x.EffectText,
                x.SortOrder,
                [.. x.Fields
                    .OrderBy(f => f.SortOrder)
                    .Select(f => new BespokeJournalFieldResponse(f.Id, f.Label, f.SortOrder))]))],
        [.. playbook.ExtraTracks
            .OrderBy(x => x.SortOrder)
            .Select(x => new PlaybookExtraTrackResponse(
                x.Id,
                x.Name,
                x.Description,
                x.EffectText,
                x.BoxCount,
                x.StartLabel,
                x.EndLabel,
                x.SortOrder))]);

    private static BespokeSectionResponse ToSectionResponse(BespokeSection section) => new(
        section.Id,
        section.Title,
        section.Description,
        section.EffectText,
        section.FreeTextLabel,
        section.MinSelect,
        section.MaxSelect,
        section.MinInstances,
        section.MaxInstances,
        section.SortOrder,
        // Rebuild the tree from the flat, fully-loaded option list.
        BuildOptionTree(section.Options, null));

    /// <summary>
    /// Rebuilds the nested response shape from the flat option list the repository loads.
    /// Recurses on <c>ParentOptionId</c>, so it supports arbitrary depth rather than the
    /// fixed number of levels a ThenInclude chain would allow.
    /// </summary>
    private static IReadOnlyList<BespokeOptionResponse> BuildOptionTree(
        IEnumerable<BespokeOption> allOptions,
        Guid? parentId)
    {
        var options = allOptions as ICollection<BespokeOption> ?? [.. allOptions];

        return
        [
            .. options
                .Where(o => o.ParentOptionId == parentId)
                .OrderBy(o => o.SortOrder)
                .Select(o => new BespokeOptionResponse(
                    o.Id,
                    o.Title,
                    o.DescriptionText,
                    o.MinSelect,
                    o.MaxSelect,
                    o.NumericMin,
                    o.NumericMax,
                    o.SortOrder,
                    BuildOptionTree(options, o.Id)))
        ];
    }
}
