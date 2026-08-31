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
}
