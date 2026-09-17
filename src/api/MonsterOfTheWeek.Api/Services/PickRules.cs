using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Services;

/// <summary>
/// Evaluates a playbook's pick rules against one set of hunter picks (hunter-creation-wizard.md
/// 12.9, "Evaluation"). The one copy of the rule arithmetic on the server:
/// <c>HunterService.Validate</c> asks it for ceilings, and <see cref="HunterCompleteness"/> asks it
/// for minimums, for the same reason <see cref="BespokeEngagement"/> is shared. Two copies could
/// call one hunter over a limit and under it at once.
///
/// <para>
/// <b>Everything resolves from picked option ids, with no priority rules</b> (12.8, Q12). A count's
/// effective range is its adjusted range when any of its triggers is among the hunter's
/// section-level picks, and its own range otherwise. A count has at most one adjustment, so there
/// is never a choice to make. An unanswered trigger section simply leaves the base ranges in force
/// (S1).
/// </para>
///
/// <para>
/// <b>No playbook or section name appears here</b> (Y9, S12). Every message is built from the
/// data: target labels, trigger titles, section titles and the rule's own label.
/// </para>
/// </summary>
public static class PickRules
{
    /// <param name="playbook">The whole playbook graph, pick rules included.</param>
    /// <param name="gearOptionIds">The hunter's picked gear options.</param>
    /// <param name="sectionLevelOptionIds">
    /// Options picked at section level, outside any repeatable entry. Triggers and governed
    /// sections are always playbook-level and non-repeatable, so entries never matter here.
    /// </param>
    public static PickRuleEvaluation Evaluate(
        Playbook playbook,
        IEnumerable<Guid> gearOptionIds,
        IEnumerable<Guid> sectionLevelOptionIds) =>
        new(playbook, [.. gearOptionIds], [.. sectionLevelOptionIds]);
}

/// <summary>One playbook's rules, resolved against one set of picks. See <see cref="PickRules"/>.</summary>
public sealed class PickRuleEvaluation
{
    private readonly HashSet<Guid> gearPicked;
    private readonly HashSet<Guid> sectionPicked;
    private readonly Dictionary<Guid, BespokeOption> optionsById;
    private readonly Dictionary<Guid, BespokeSection> sectionsById;
    private readonly Dictionary<Guid, PlaybookGearCategory> categoriesById;
    private readonly HashSet<Guid> engaged;
    private readonly List<PlaybookPickRule> rules;
    private readonly Dictionary<Guid, PlaybookPickRule> ruleByGearCategory = [];
    private readonly Dictionary<Guid, PlaybookPickRule> ruleBySection = [];
    private readonly HashSet<Guid> governedOptionIds = [];

    internal PickRuleEvaluation(Playbook playbook, HashSet<Guid> gearPicked, HashSet<Guid> sectionPicked)
    {
        this.gearPicked = gearPicked;
        this.sectionPicked = sectionPicked;
        optionsById = playbook.BespokeSections.SelectMany(s => s.Options).ToDictionary(o => o.Id);
        sectionsById = playbook.BespokeSections.ToDictionary(s => s.Id);
        categoriesById = playbook.GearCategories.ToDictionary(c => c.Id);
        engaged = BespokeEngagement.Engaged(sectionPicked, optionsById);
        rules = [.. playbook.PickRules.OrderBy(r => r.SortOrder).ThenBy(r => r.Id)];

        foreach (var rule in rules)
        {
            foreach (var count in rule.Alternatives.SelectMany(a => a.Counts))
            {
                if (count.GearCategoryId is { } categoryId)
                {
                    ruleByGearCategory.TryAdd(categoryId, rule);
                }
                else if (count.BespokeOptionId is { } optionId)
                {
                    governedOptionIds.Add(optionId);
                    if (optionsById.TryGetValue(optionId, out var option))
                    {
                        ruleBySection.TryAdd(option.SectionId, rule);
                    }
                }
            }
        }
    }

    // -----------------------------------------------------------------------------------
    // Resolution (12.9 step 1)
    // -----------------------------------------------------------------------------------

    /// <summary>True when the count has an adjustment and one of its triggers is picked.</summary>
    public bool AdjustmentFired(PlaybookPickRuleCount count) =>
        count.AdjustedMinCount is not null
        && count.AdjustedMaxCount is not null
        && count.Triggers.Any(t => sectionPicked.Contains(t.BespokeOptionId));

    /// <summary>The range this count allows for these picks.</summary>
    public (int Min, int Max) EffectiveRange(PlaybookPickRuleCount count) =>
        AdjustmentFired(count)
            ? (count.AdjustedMinCount!.Value, count.AdjustedMaxCount!.Value)
            : (count.MinCount, count.MaxCount);

    /// <summary>
    /// How many picks sit under the count's target: picked options in a gear category, or a
    /// bespoke category's engaged direct children, so a write-your-own slot counts like any other.
    /// </summary>
    public int Picks(PlaybookPickRuleCount count)
    {
        if (count.GearCategoryId is { } categoryId)
        {
            return categoriesById.TryGetValue(categoryId, out var category)
                ? category.Options.Count(o => gearPicked.Contains(o.Id))
                : 0;
        }

        return count.BespokeOptionId is { } optionId && optionsById.TryGetValue(optionId, out var option)
            ? BespokeEngagement.CountUnder(option.Id, option.SectionId, engaged, optionsById)
            : 0;
    }

    public bool GovernsGearCategory(Guid categoryId) => ruleByGearCategory.ContainsKey(categoryId);

    public bool GovernsSection(Guid sectionId) => ruleBySection.ContainsKey(sectionId);

    /// <summary>True for a bespoke category divider a rule counts, whose own minimum it replaces.</summary>
    public bool GovernsOption(Guid optionId) => governedOptionIds.Contains(optionId);

    // -----------------------------------------------------------------------------------
    // Refusals (12.9 step 3) — HunterService.Validate
    // -----------------------------------------------------------------------------------

    /// <summary>
    /// The first gear rule the picks fit under no alternative of. Validate runs this after its
    /// bespoke checks, because a trigger has to be known to be this playbook's option first.
    /// </summary>
    public string? GearRefusal() => FirstRefusal(rules.Where(IsGearRule));

    /// <summary>The first bespoke-section rule the picks fit under no alternative of.</summary>
    public string? BespokeRefusal() => FirstRefusal(rules.Where(r => !IsGearRule(r)));

    private string? FirstRefusal(IEnumerable<PlaybookPickRule> candidates)
    {
        foreach (var rule in candidates)
        {
            var refusal = Refusal(rule);
            if (refusal is not null)
            {
                return refusal;
            }
        }

        return null;
    }

    /*
     * A rule refuses only when the picks fit under no alternative, meaning no alternative has
     * every target at or below its effective maximum. Partial picks that some alternative still
     * has room for pass, so every refusal is fixable by removing picks (architecture.md Section 9),
     * and zero picks fits every rule.
     */
    private string? Refusal(PlaybookPickRule rule)
    {
        if (rule.Alternatives.Count == 0 || rule.Alternatives.Any(a => a.Counts.All(c => Picks(c) <= EffectiveRange(c).Max)))
        {
            return null;
        }

        if (rule.Alternatives.Count == 1)
        {
            // The existing ceiling message, at the effective maximum, for the first target over it.
            var over = Ordered(rule.Alternatives.Single()).First(c => Picks(c) > EffectiveRange(c).Max);
            var max = EffectiveRange(over).Max;
            var message = $"\"{TargetName(over)}\" allows {max} {(max == 1 ? "pick" : "picks")}, but {Picks(over)} were made.";

            // An adjustment that hasn't fired and would allow more says what would allow it.
            if (!AdjustmentFired(over) && over.AdjustedMaxCount is { } adjustedMax && adjustedMax > max && over.Triggers.Count > 0)
            {
                message += $" {TriggerPhrase(over)} {(over.Triggers.Count == 1 ? "allows" : "allow")} {adjustedMax}.";
            }

            return message;
        }

        var picked = EnglishList.Join([.. Ordered(FirstAlternative(rule)).Select(c => $"{Picks(c)} {TargetName(c)}")], "and");
        return $"\"{Heading(rule)}\" allows: {RuleText(rule)} {picked} were picked.";
    }

    // -----------------------------------------------------------------------------------
    // Report (12.9 step 4) — HunterCompleteness
    // -----------------------------------------------------------------------------------

    /// <summary>
    /// The outstanding items a gear rule reports at this category's position in the gear list,
    /// in place of the category's own "n of PickCount picked" line. Nothing when the category
    /// isn't governed, or when some alternative is met.
    /// </summary>
    public IEnumerable<HunterOutstandingItem> GearItemsAt(PlaybookGearCategory category)
    {
        if (!ruleByGearCategory.TryGetValue(category.Id, out var rule) || rule.Alternatives.Count == 0 || IsMet(rule))
        {
            yield break;
        }

        if (rule.Alternatives.Count == 1)
        {
            // One item per list below its effective minimum, in the existing gear wording.
            var count = rule.Alternatives.Single().Counts.FirstOrDefault(c => c.GearCategoryId == category.Id);
            if (count is not null && Picks(count) < EffectiveRange(count).Min)
            {
                yield return new HunterOutstandingItem(
                    HunterOutstandingArea.Gear, null, category.Id,
                    $"Gear — {category.Label}: {Picks(count)} of {EffectiveRange(count).Min} picked.{DependsSuffix(count)}");
            }

            yield break;
        }

        // Several alternatives: one line for the whole rule, at its first governed category.
        // No canonical rule takes this path; it keeps an authored one from reporting nothing.
        var first = Ordered(FirstAlternative(rule)).First();
        if (first.GearCategoryId == category.Id)
        {
            yield return new HunterOutstandingItem(HunterOutstandingArea.Gear, null, null, $"Gear: {RuleText(rule)}");
        }
    }

    /// <summary>
    /// The lines a bespoke rule reports for its section, without the section-title prefix, in
    /// place of the section's own MinSelect line. Nothing when no rule governs the section, or
    /// when some alternative is met.
    /// </summary>
    public IEnumerable<string> SectionLines(BespokeSection section)
    {
        if (!ruleBySection.TryGetValue(section.Id, out var rule) || rule.Alternatives.Count == 0 || IsMet(rule))
        {
            yield break;
        }

        if (rule.Alternatives.Count == 1)
        {
            foreach (var count in Ordered(rule.Alternatives.Single()))
            {
                if (Picks(count) < EffectiveRange(count).Min)
                {
                    yield return $"{TargetName(count)} — {Picks(count)} of {EffectiveRange(count).Min} picked.{DependsSuffix(count)}";
                }
            }

            yield break;
        }

        // Natural Attacks and Combat Magic: "{section title}: {rule label}" once the caller prefixes it.
        yield return RuleText(rule);
    }

    /// <summary>An alternative is met when every one of its targets is within its effective range.</summary>
    private bool IsMet(PlaybookPickRule rule) =>
        rule.Alternatives.Any(a => a.Counts.All(c =>
        {
            var (min, max) = EffectiveRange(c);
            var picks = Picks(c);
            return picks >= min && picks <= max;
        }));

    /*
     * "This depends on your {section title} picks." (Y16, aligned with the client's L25 hint):
     * the adjustment hasn't fired and its trigger section has no section-level picks at all. A
     * partly answered section doesn't get it, because the hint and the refusal suffix already
     * name the triggers, and the client can see this condition without computing completeness.
     */
    private string DependsSuffix(PlaybookPickRuleCount count)
    {
        if (count.AdjustedMaxCount is null || count.Triggers.Count == 0 || AdjustmentFired(count))
        {
            return "";
        }

        var triggerSections = OrderedTriggers(count)
            .Select(t => optionsById.TryGetValue(t.BespokeOptionId, out var option) ? option.SectionId : (Guid?)null)
            .OfType<Guid>()
            .Distinct()
            .ToList();

        if (triggerSections.Count == 0 || triggerSections.Any(SectionHasPicks))
        {
            return "";
        }

        var titles = triggerSections.Select(id => sectionsById.TryGetValue(id, out var s) ? s.Title : null).OfType<string>().ToList();
        return $" This depends on your {EnglishList.Join(titles, "and")} picks.";
    }

    private bool SectionHasPicks(Guid sectionId) =>
        sectionPicked.Any(id => optionsById.TryGetValue(id, out var option) && option.SectionId == sectionId);

    // -----------------------------------------------------------------------------------
    // Wording, all from data
    // -----------------------------------------------------------------------------------

    /// <summary>"Fighting arts or Obsolete gear (Sect)": trigger titles, then their section's title.</summary>
    private string TriggerPhrase(PlaybookPickRuleCount count)
    {
        var groups = new List<(Guid? SectionId, List<string> Titles)>();
        foreach (var trigger in OrderedTriggers(count))
        {
            optionsById.TryGetValue(trigger.BespokeOptionId, out var option);
            var title = option?.Title ?? option?.DescriptionText ?? "an option";
            if (groups.Count > 0 && groups[^1].SectionId == option?.SectionId)
            {
                groups[^1].Titles.Add(title);
            }
            else
            {
                groups.Add((option?.SectionId, [title]));
            }
        }

        return string.Join(" or ", groups.Select(g =>
        {
            var titles = string.Join(" or ", g.Titles);
            return g.SectionId is { } id && sectionsById.TryGetValue(id, out var section) ? $"{titles} ({section.Title})" : titles;
        }));
    }

    /// <summary>The rule's label, or failing that a plain statement of its alternatives.</summary>
    private string RuleText(PlaybookPickRule rule)
    {
        if (!string.IsNullOrWhiteSpace(rule.Label))
        {
            return rule.Label.Trim();
        }

        var alternatives = rule.Alternatives
            .OrderBy(a => a.SortOrder).ThenBy(a => a.Id)
            .Select(a => EnglishList.Join([.. Ordered(a).Select(c => $"{RangeText(c.MinCount, c.MaxCount)} {TargetName(c)}")], "and"));
        return string.Join(", or ", alternatives) + ".";
    }

    private static string RangeText(int min, int max) => min == max ? $"{min}" : $"{min}–{max}";

    /// <summary>The governed section's title, or the governed gear lists' labels.</summary>
    private string Heading(PlaybookPickRule rule)
    {
        var counts = Ordered(FirstAlternative(rule)).ToList();
        if (counts.FirstOrDefault(c => c.BespokeOptionId is not null) is { } bespoke
            && optionsById.TryGetValue(bespoke.BespokeOptionId!.Value, out var option)
            && sectionsById.TryGetValue(option.SectionId, out var section))
        {
            return section.Title;
        }

        return EnglishList.Join([.. counts.Select(TargetName)], "and");
    }

    private string TargetName(PlaybookPickRuleCount count)
    {
        if (count.GearCategoryId is { } categoryId)
        {
            return categoriesById.TryGetValue(categoryId, out var category) ? category.Label : "a gear list";
        }

        return count.BespokeOptionId is { } optionId && optionsById.TryGetValue(optionId, out var option)
            ? option.Title ?? option.DescriptionText ?? "a category"
            : "a category";
    }

    private static PlaybookPickRuleAlternative FirstAlternative(PlaybookPickRule rule) =>
        rule.Alternatives.OrderBy(a => a.SortOrder).ThenBy(a => a.Id).First();

    /// <summary>Counts in the wire order (Y7): by their target's SortOrder, then target id.</summary>
    private IEnumerable<PlaybookPickRuleCount> Ordered(PlaybookPickRuleAlternative alternative) =>
        alternative.Counts
            .OrderBy(c => c.GearCategoryId is { } g
                ? categoriesById.TryGetValue(g, out var category) ? category.SortOrder : 0
                : c.BespokeOptionId is { } o && optionsById.TryGetValue(o, out var option) ? option.SortOrder : 0)
            .ThenBy(c => c.GearCategoryId ?? c.BespokeOptionId ?? Guid.Empty);

    /// <summary>Triggers in the wire order (Y7): by option SortOrder, then id.</summary>
    private IEnumerable<PlaybookPickRuleCountTrigger> OrderedTriggers(PlaybookPickRuleCount count) =>
        count.Triggers
            .OrderBy(t => optionsById.TryGetValue(t.BespokeOptionId, out var option) ? option.SortOrder : 0)
            .ThenBy(t => t.BespokeOptionId);

    private static bool IsGearRule(PlaybookPickRule rule) =>
        rule.Alternatives.SelectMany(a => a.Counts).Any(c => c.GearCategoryId is not null);
}

/// <summary>"a", "a and b", "a, b and c".</summary>
internal static class EnglishList
{
    public static string Join(IReadOnlyList<string> items, string conjunction) => items.Count switch
    {
        0 => "",
        1 => items[0],
        _ => $"{string.Join(", ", items.Take(items.Count - 1))} {conjunction} {items[^1]}",
    };
}
