using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Services;

/// <summary>
/// Answers "what does this hunter still owe its playbook?" — the completeness half of the
/// two-tier rule split decided 2026-08-31 (docs/hunter-playbooks/architecture.md Section 9).
///
/// <para>
/// <b>Nothing in here ever rejects a save.</b> <see cref="HunterService"/>'s own
/// <c>Validate</c> owns the other tier: rules whose violation would make the stored row assert
/// something <i>false</i> about the playbook (a pick that isn't the playbook's, an advanced
/// move, more picks than the ceiling allows, a track past its last box). Those are refused.
/// Minimums are a different kind of statement — an unanswered section asserts nothing false,
/// it is just unfinished — so they are computed here and reported, never enforced.
/// </para>
///
/// <para>
/// <b>Derived on every read, never stored.</b> A hunter is live-linked to its playbook
/// (Section 3), so any stored "complete" flag would be falsified the moment the playbook gained
/// a requirement, with nothing touching the hunter to notice. That is the same reasoning
/// Section 6.4 already applied to bespoke category engagement, reused rather than reinvented.
/// </para>
///
/// <para>
/// <b>Two callers, one answer</b> (hunter-creation-wizard.md 12.8, 2026-09-14). The detail
/// response lists the items' messages as <c>Outstanding</c>. <c>POST /api/hunters/evaluate</c>
/// runs the same code over an unsaved hunter built by the same step Create uses, and returns the
/// items themselves, tagged with a sheet area and the section or gear category they belong to.
/// </para>
///
/// <para>
/// <b>The order is total and never depends on collection order</b> (Y8). The same hunter gives
/// the same list whether its rows came from a request, the database, or picks sent in any order.
/// That is what lets Evaluate and Create return identical lists, and keeps the wizard's card from
/// reshuffling between checks.
/// </para>
/// </summary>
public static class HunterCompleteness
{
    /// <summary>
    /// Outstanding items in the order the sheet prints them, so the list reads as a walk down
    /// the page. Empty means the hunter is ready to play.
    /// </summary>
    public static IReadOnlyList<HunterOutstandingItem> Evaluate(Hunter hunter, Playbook playbook)
    {
        var outstanding = new List<HunterOutstandingItem>();

        // A playbook whose rating arrays have not been authored yet (Section 4, Path B) asks
        // nothing here — which is also why Hunter.PlaybookStatArrayOptionId is nullable.
        if (playbook.StatArrayOptions.Count > 0 && hunter.PlaybookStatArrayOptionId is null)
        {
            outstanding.Add(new(HunterOutstandingArea.Ratings, null, null, "Choose a rating array."));
        }

        /*
         * The minimum is the pick budget, not MoveGrantCount itself: the grant is the printed
         * total and already includes the Required moves a hunter holds without picking them
         * (MovePicks). A budget of 0 therefore reports nothing.
         *
         * Same MoveGrantCount == 0 caveat the ceiling check uses, and for the same reason:
         * Section 3 is explicit that 0 is indistinguishable from an unauthored Moves section,
         * so it cannot be read as "this playbook grants zero picks". All 28 canonical playbooks
         * author 2, 3 or 4; only an admin-created playbook mid-authoring sits at 0.
         */
        if (playbook.MoveGrantCount > 0)
        {
            var budget = MovePicks.Budget(playbook);
            var pickedIds = hunter.Moves.Select(x => x.PlaybookMoveId).ToHashSet();
            var required = playbook.Moves.Where(m => m.Required).Select(m => m.Id).ToHashSet();
            var chosen = pickedIds.Count(id => !required.Contains(id));
            if (chosen < budget)
            {
                outstanding.Add(new(HunterOutstandingArea.Moves, null, null, $"Moves: {chosen} of {budget} picked."));
            }
        }

        var selectedGear = hunter.GearSelections.Select(x => x.PlaybookGearOptionId).ToHashSet();
        foreach (var category in playbook.GearCategories.OrderBy(c => c.SortOrder).ThenBy(c => c.Id))
        {
            /*
             * Two categories ask nothing. A null PickCount means every listed option is granted
             * outright rather than picked (PlaybookGearCategory.PickCount) — there is no choice
             * to leave unmade. IsOptional means the hunter may skip the whole category.
             */
            if (category.PickCount is not { } pickCount || category.IsOptional)
            {
                continue;
            }

            // Phase 6 seam (12.9 step 4): a category governed by a pick rule reports against its
            // effective minimum here instead, in this same position.
            var picked = category.Options.Count(o => selectedGear.Contains(o.Id));
            if (picked < pickCount)
            {
                outstanding.Add(new(
                    HunterOutstandingArea.Gear, null, category.Id,
                    $"Gear — {category.Label}: {picked} of {pickCount} picked."));
            }
        }

        // One circled answer per printed line, matching the sheet. An answered line is one with
        // a row at all — the "exactly one of option/freeform" rule is Validate's job, not this.
        var answered = hunter.LookSelections.Select(x => x.LookCategoryId).ToHashSet();
        var unanswered = playbook.LookCategories.Count(c => !answered.Contains(c.Id));
        if (unanswered > 0)
        {
            outstanding.Add(new(
                HunterOutstandingArea.Look, null, null,
                $"Look: {unanswered} of {playbook.LookCategories.Count} {(unanswered == 1 ? "line is" : "lines are")} unanswered."));
        }

        outstanding.AddRange(EvaluateBespoke(hunter, playbook));

        /*
         * Extra tracks are deliberately absent, and that is a decision rather than an omission.
         * PlaybookExtraTrack has a BoxCount but no starting value, so a missing
         * HunterExtraTrackValue row is indistinguishable from one holding 0 — and 0 is a
         * perfectly ordinary starting position for the tracks that exist (the Curse-Eater's
         * Corruption starts empty). There is no answer being withheld, so there is nothing to
         * report. Luck/Harm/Experience are columns with the same property.
         */

        return outstanding;
    }

    /// <summary>
    /// Every bespoke minimum, in sheet order. All 39 pick-bearing sections across the 28
    /// playbooks carry <c>MinSelect &gt; 0</c>, so this is the bulk of what a half-built hunter
    /// still owes — which is exactly why refusing on it would have been so costly.
    ///
    /// <para>
    /// Every line carries its section's id. A section that belongs to a move is area
    /// <c>moves</c>; a playbook-level one is <c>rules</c>.
    /// </para>
    /// </summary>
    private static IEnumerable<HunterOutstandingItem> EvaluateBespoke(Hunter hunter, Playbook playbook)
    {
        var takenMoveIds = hunter.Moves.Select(m => m.PlaybookMoveId).ToHashSet();
        var optionsById = playbook.BespokeSections.SelectMany(s => s.Options).ToDictionary(o => o.Id);
        var movesById = playbook.Moves.ToDictionary(m => m.Id);

        PlaybookMove? MoveOf(BespokeSection section) =>
            section.PlaybookMoveId is { } id && movesById.TryGetValue(id, out var move) ? move : null;

        /*
         * Y8's total order. Playbook-level sections first, by SortOrder then id. Then a move's
         * own sections, in the order the playbook lists its moves (IsAdvanced, then SortOrder,
         * as PlaybookService.ToDetailResponse does), then section SortOrder, then id. The move's
         * id sits between the two so one move's sections stay together if two moves ever tie.
         *
         * SortOrder alone is not enough: the seed puts every move-owned section at 0, so The
         * Crooked, The Searcher and The Spell-Slinger each have two or three sections that
         * would otherwise come out in whatever order the database returned them.
         */
        var sections = playbook.BespokeSections
            .OrderBy(s => s.PlaybookMoveId is null ? 0 : 1)
            .ThenBy(s => MoveOf(s)?.IsAdvanced ?? false)
            .ThenBy(s => MoveOf(s)?.SortOrder ?? 0)
            .ThenBy(s => s.PlaybookMoveId ?? Guid.Empty)
            .ThenBy(s => s.SortOrder)
            .ThenBy(s => s.Id);

        foreach (var section in sections)
        {
            // A move's own pick-structure asks nothing until the hunter takes the move.
            if (section.PlaybookMoveId is { } moveId && !takenMoveIds.Contains(moveId))
            {
                continue;
            }

            var area = section.PlaybookMoveId is null ? HunterOutstandingArea.Rules : HunterOutstandingArea.Moves;
            HunterOutstandingItem Line(string message) => new(area, section.Id, null, message);

            // By SortOrder then id, never collection order: an unsaved draft holds its entries in
            // request order, and a saved hunter in whatever order the database returned (O2).
            var instances = hunter.BespokeSectionInstances
                .Where(i => i.SectionId == section.Id)
                .OrderBy(i => i.SortOrder)
                .ThenBy(i => i.Id)
                .ToList();
            var isRepeatable = section.MinInstances is not null || section.MaxInstances is not null;

            if (isRepeatable)
            {
                if (section.MinInstances is { } minInstances && instances.Count < minInstances)
                {
                    yield return Line($"{section.Title}: {instances.Count} of {minInstances} added.");
                }

                // Each instance is its own independent copy of the tree, so each is checked
                // separately rather than against a total across all of them.
                foreach (var instance in instances)
                {
                    foreach (var line in Shortfalls(section, hunter.BespokeSelections.Where(s => s.SectionInstanceId == instance.Id), optionsById))
                    {
                        yield return Line($"{section.Title} ({instance.Name ?? "entry"}): {line}");
                    }
                }

                continue;
            }

            var sectionSelections = hunter.BespokeSelections.Where(s => s.SectionId == section.Id && s.SectionInstanceId == null).ToList();

            if (section.FreeTextLabel is not null)
            {
                if (sectionSelections.Count == 0)
                {
                    yield return Line($"{section.Title}: not filled in.");
                }

                continue;
            }

            foreach (var line in Shortfalls(section, sectionSelections, optionsById))
            {
                yield return Line($"{section.Title}: {line}");
            }
        }
    }

    /// <summary>
    /// Unmet minimums for one scope — a whole Section, or one instance of a repeatable one. The
    /// section's own line comes first, then each short category in the order the sheet prints
    /// the option tree.
    /// </summary>
    private static IEnumerable<string> Shortfalls(
        BespokeSection section,
        IEnumerable<HunterBespokeSelection> selections,
        Dictionary<Guid, BespokeOption> optionsById)
    {
        var picked = selections.Where(s => s.BespokeOptionId is not null)
            .Select(s => s.BespokeOptionId!.Value)
            .ToHashSet();
        var engaged = BespokeEngagement.Engaged(picked, optionsById);

        // Phase 6 seam (12.9 step 4, S8): a section governed by a bespoke pick rule skips this
        // MinSelect line and reports the rule's own line in its place.
        if (section.MinSelect is { } minSelect)
        {
            var count = BespokeEngagement.CountUnder(null, section.Id, engaged, optionsById);
            if (count < minSelect)
            {
                yield return $"{count} of {minSelect} picked.";
            }
        }

        /*
         * Only an *engaged* category can be short of its own minimum — an untouched one is not
         * half-answered, it simply was not chosen.
         *
         * Walked in tree order (Y8: option SortOrder, then id, among siblings), never in the
         * engaged set's own order, which follows the order the picks arrived in. Tree order rather
         * than one flat sort by SortOrder, because categories nest: The Visitor's Home Culture
         * (SortOrder 0) holds Line 1 (also 0), and a flat sort would put Line 1 ahead of "Why did
         * you leave?" (SortOrder 1), splitting a category from its own parent on the list.
         */
        foreach (var parent in engaged.Select(id => optionsById[id]).OrderBy(o => TreePosition(o, optionsById), TreePositionComparer.Instance))
        {
            if (parent.MinSelect is not { } parentMin)
            {
                continue;
            }

            var children = BespokeEngagement.CountUnder(parent.Id, section.Id, engaged, optionsById);
            if (children < parentMin)
            {
                yield return $"{parent.Title} — {children} of {parentMin} picked.";
            }
        }
    }

    /// <summary>An option's (SortOrder, id) at each level from the top of its section down to itself.</summary>
    private static List<(int SortOrder, Guid Id)> TreePosition(BespokeOption option, Dictionary<Guid, BespokeOption> optionsById)
    {
        var path = new List<(int SortOrder, Guid Id)>();
        var seen = new HashSet<Guid>();
        for (BespokeOption? current = option; current is not null && seen.Add(current.Id);)
        {
            path.Add((current.SortOrder, current.Id));
            current = current.ParentOptionId is { } parentId && optionsById.TryGetValue(parentId, out var parent) ? parent : null;
        }

        path.Reverse();
        return path;
    }

    /// <summary>Depth-first order: siblings by SortOrder then id, and a parent before its children.</summary>
    private sealed class TreePositionComparer : IComparer<List<(int SortOrder, Guid Id)>>
    {
        public static readonly TreePositionComparer Instance = new();

        public int Compare(List<(int SortOrder, Guid Id)>? x, List<(int SortOrder, Guid Id)>? y)
        {
            ArgumentNullException.ThrowIfNull(x);
            ArgumentNullException.ThrowIfNull(y);

            for (var i = 0; i < Math.Min(x.Count, y.Count); i++)
            {
                var bySortOrder = x[i].SortOrder.CompareTo(y[i].SortOrder);
                if (bySortOrder != 0)
                {
                    return bySortOrder;
                }

                var byId = x[i].Id.CompareTo(y[i].Id);
                if (byId != 0)
                {
                    return byId;
                }
            }

            return x.Count.CompareTo(y.Count);
        }
    }
}

/// <summary>
/// The move pick budget, shared by <see cref="HunterCompleteness"/> (the minimum) and
/// <c>HunterService.Validate</c> (the ceiling) for the same reason <see cref="BespokeEngagement"/>
/// is: two copies of the arithmetic could call one hunter over and under at once.
///
/// <para>
/// <b><see cref="Playbook.MoveGrantCount"/> is the printed total, Required moves included</b>
/// (hunter-creation-wizard.md 12.3, decided 2026-09-13, checked against the PDF for all 28).
/// The Chosen stores 3 for "plus three Chosen moves. You get these two: … Then pick one", so
/// what a hunter picks is the grant minus its Required moves. Until 2026-09-14 the code read
/// the grant as picks <i>beyond</i> the Required moves, which let the 14 playbooks with
/// Required moves take too many picks and reported a correct hunter as unfinished.
/// </para>
///
/// <para>
/// Callers still skip everything when <c>MoveGrantCount</c> is 0 (an unauthored Moves section,
/// architecture.md Section 3). The floor of 0 only matters for a stored playbook with more
/// Required moves than its grant, which <c>PlaybookService</c> refuses to save.
/// </para>
/// </summary>
internal static class MovePicks
{
    public static int RequiredCount(Playbook playbook) => playbook.Moves.Count(m => m.Required);

    public static int Budget(Playbook playbook) => Math.Max(0, playbook.MoveGrantCount - RequiredCount(playbook));
}

/// <summary>
/// Shared by <see cref="HunterCompleteness"/> and <c>HunterService.Validate</c>, because the two
/// tiers must count the same way or a hunter could be simultaneously over a maximum and under a
/// minimum on one option set.
///
/// <para>
/// <b>A category divider is never picked; it is <i>engaged</i>.</b> architecture.md 6.4 settles
/// this: an option with children is a heading, and it counts as used exactly when at least one
/// of its own descendants has a selection row. So a Section's <c>MinSelect</c>/<c>MaxSelect</c>
/// counts engaged top-level options — a mix of directly-picked leaves and dividers reached
/// through their children — and never the raw number of selection rows. Counting rows instead
/// would read every nested Section (Fate, Friendship, Combat Magic, Expatriation) as zero picks
/// no matter how much the hunter had filled in.
/// </para>
/// </summary>
internal static class BespokeEngagement
{
    /// <summary>Picked options plus every ancestor made live by one of them.</summary>
    public static HashSet<Guid> Engaged(HashSet<Guid> pickedIds, Dictionary<Guid, BespokeOption> optionsById)
    {
        var engaged = new HashSet<Guid>(pickedIds.Where(optionsById.ContainsKey));
        foreach (var id in pickedIds.Where(optionsById.ContainsKey))
        {
            var parentId = optionsById[id].ParentOptionId;
            // Add returns false once an ancestor is already recorded, and everything above it
            // was recorded on the pass that added it — so stopping there is complete, not lazy.
            while (parentId is { } p && optionsById.ContainsKey(p) && engaged.Add(p))
            {
                parentId = optionsById[p].ParentOptionId;
            }
        }

        return engaged;
    }

    /// <summary>
    /// Engaged options directly under <paramref name="parentId"/> (null = the Section's own top
    /// level), restricted to one Section so a repeatable Section's instances cannot bleed
    /// into each other's counts.
    /// </summary>
    public static int CountUnder(
        Guid? parentId,
        Guid sectionId,
        HashSet<Guid> engaged,
        Dictionary<Guid, BespokeOption> optionsById) =>
        engaged.Count(id => optionsById[id].ParentOptionId == parentId && optionsById[id].SectionId == sectionId);
}
