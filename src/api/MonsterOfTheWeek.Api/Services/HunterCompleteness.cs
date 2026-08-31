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
/// <b>This is the extension point for Follow-on 10b.</b> All 39 pick-bearing bespoke sections
/// carry <c>MinSelect &gt; 0</c>; every one of them becomes another line added here, not another
/// save-time guard.
/// </para>
/// </summary>
public static class HunterCompleteness
{
    /// <summary>
    /// Outstanding items in the order the sheet prints them, so the list reads as a walk down
    /// the page. Empty means the hunter is ready to play.
    /// </summary>
    public static IReadOnlyList<string> Evaluate(Hunter hunter, Playbook playbook)
    {
        var outstanding = new List<string>();

        // A playbook whose rating arrays have not been authored yet (Section 4, Path B) asks
        // nothing here — which is also why Hunter.PlaybookStatArrayOptionId is nullable.
        if (playbook.StatArrayOptions.Count > 0 && hunter.PlaybookStatArrayOptionId is null)
        {
            outstanding.Add("Choose a rating array.");
        }

        /*
         * Same MoveGrantCount == 0 caveat the ceiling check uses, and for the same reason:
         * Section 3 is explicit that 0 is indistinguishable from an unauthored Moves section,
         * so it cannot be read as "this playbook grants zero picks". All 28 canonical playbooks
         * author 2, 3 or 4; only an admin-created playbook mid-authoring sits at 0.
         */
        if (playbook.MoveGrantCount > 0)
        {
            var pickedIds = hunter.Moves.Select(x => x.PlaybookMoveId).ToHashSet();
            var required = playbook.Moves.Where(m => m.Required).Select(m => m.Id).ToHashSet();
            var chosen = pickedIds.Count(id => !required.Contains(id));
            if (chosen < playbook.MoveGrantCount)
            {
                outstanding.Add($"Moves: {chosen} of {playbook.MoveGrantCount} picked.");
            }
        }

        var selectedGear = hunter.GearSelections.Select(x => x.PlaybookGearOptionId).ToHashSet();
        foreach (var category in playbook.GearCategories.OrderBy(c => c.SortOrder))
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

            var picked = category.Options.Count(o => selectedGear.Contains(o.Id));
            if (picked < pickCount)
            {
                outstanding.Add($"Gear \u2014 {category.Label}: {picked} of {pickCount} picked.");
            }
        }

        // One circled answer per printed line, matching the sheet. An answered line is one with
        // a row at all — the "exactly one of option/freeform" rule is Validate's job, not this.
        var answered = hunter.LookSelections.Select(x => x.LookCategoryId).ToHashSet();
        var unanswered = playbook.LookCategories.Count(c => !answered.Contains(c.Id));
        if (unanswered > 0)
        {
            outstanding.Add($"Look: {unanswered} of {playbook.LookCategories.Count} {(unanswered == 1 ? "line is" : "lines are")} unanswered.");
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
    /// </summary>
    private static IEnumerable<string> EvaluateBespoke(Hunter hunter, Playbook playbook)
    {
        var takenMoveIds = hunter.Moves.Select(m => m.PlaybookMoveId).ToHashSet();
        var optionsById = playbook.BespokeSections.SelectMany(s => s.Options).ToDictionary(o => o.Id);

        foreach (var section in playbook.BespokeSections.OrderBy(s => s.PlaybookMoveId is null ? 0 : 1).ThenBy(s => s.SortOrder))
        {
            // A move's own pick-structure asks nothing until the hunter takes the move.
            if (section.PlaybookMoveId is { } moveId && !takenMoveIds.Contains(moveId))
            {
                continue;
            }

            var instances = hunter.BespokeSectionInstances.Where(i => i.SectionId == section.Id).ToList();
            var isRepeatable = section.MinInstances is not null || section.MaxInstances is not null;

            if (isRepeatable)
            {
                if (section.MinInstances is { } minInstances && instances.Count < minInstances)
                {
                    yield return $"{section.Title}: {instances.Count} of {minInstances} added.";
                }

                // Each instance is its own independent copy of the tree, so each is checked
                // separately rather than against a total across all of them.
                foreach (var instance in instances)
                {
                    foreach (var line in Shortfalls(section, hunter.BespokeSelections.Where(s => s.SectionInstanceId == instance.Id), optionsById))
                    {
                        yield return $"{section.Title} ({instance.Name ?? "entry"}): {line}";
                    }
                }

                continue;
            }

            var sectionSelections = hunter.BespokeSelections.Where(s => s.SectionId == section.Id && s.SectionInstanceId == null).ToList();

            if (section.FreeTextLabel is not null)
            {
                if (sectionSelections.Count == 0)
                {
                    yield return $"{section.Title}: not filled in.";
                }

                continue;
            }

            foreach (var line in Shortfalls(section, sectionSelections, optionsById))
            {
                yield return $"{section.Title}: {line}";
            }
        }
    }

    /// <summary>
    /// Unmet minimums for one scope — a whole Section, or one instance of a repeatable one.
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

        if (section.MinSelect is { } minSelect)
        {
            var count = BespokeEngagement.CountUnder(null, section.Id, engaged, optionsById);
            if (count < minSelect)
            {
                yield return $"{count} of {minSelect} picked.";
            }
        }

        // Only an *engaged* category can be short of its own minimum — an untouched one is not
        // half-answered, it simply was not chosen.
        foreach (var parentId in engaged)
        {
            var parent = optionsById[parentId];
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
