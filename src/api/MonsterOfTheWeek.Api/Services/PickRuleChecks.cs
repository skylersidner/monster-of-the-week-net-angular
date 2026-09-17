using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Services;

/// <summary>
/// <see cref="PlaybookService"/>'s graph checks for pick rules (hunter-creation-wizard.md 12.9,
/// 14.3.1, 14.3.4; Y3, Y6).
///
/// <para>
/// <b>One set of checks, run in two places</b> against two readings of the playbook:
/// </para>
/// <list type="bullet">
/// <item><b>Before the load</b> (<c>ValidateGraph</c>), on rules the request sends, against the
/// request's own children and ids. A problem is a 400.</item>
/// <item><b>After the load</b>, on the rules that will exist after the save, against the children
/// the save will actually keep. A child only keeps its id when the Id-based diff will match it,
/// so a removed row, or an id the diff would treat as new, is simply absent. Sent rules that fail
/// here are still a 400. <b>Kept</b> rules that fail here (the request omitted <c>pickRules</c>)
/// are a 409 naming the rule, because the edit, not the rule, is what changed (S11).</item>
/// </list>
///
/// <para>
/// That second pass is what catches an edit which removes a target or trigger, lowers a governed
/// PickCount or MaxSelect below a rule's range, turns a trigger into a category, moves it into a
/// repeatable or move section, or adds a top-level option a rule's categories no longer cover.
/// Every rule FK cascades, so without it such an edit would silently delete part of a rule (14.3.2).
/// </para>
/// </summary>
internal static class PickRuleChecks
{
    internal sealed record Rule(int Index, string? Label, IReadOnlyList<Alternative> Alternatives);

    internal sealed record Alternative(IReadOnlyList<Count> Counts);

    internal sealed record Count(Guid? GearCategoryId, Guid? BespokeOptionId, int MinCount, int MaxCount, Adjustment? Adjustment)
    {
        public Guid Target => GearCategoryId ?? BespokeOptionId ?? Guid.Empty;

        public bool IsGear => GearCategoryId is not null;
    }

    internal sealed record Adjustment(IReadOnlyList<Guid> TriggerOptionIds, int MinCount, int MaxCount);

    internal sealed record GearNode(string Label, int? PickCount, bool IsOptional);

    internal sealed record SectionNode(string Title, bool IsMoveInternal, bool IsRepeatable, List<Guid> TopLevelOptions);

    internal sealed record OptionNode(string Label, Guid SectionKey, Guid? ParentKey, bool HasChildren, int? MaxSelect);

    /// <summary>The playbook as a save would leave it, keyed by the ids rules can refer to.</summary>
    internal sealed class Graph
    {
        public Dictionary<Guid, GearNode> Gear { get; } = [];

        public Dictionary<Guid, SectionNode> Sections { get; } = [];

        public Dictionary<Guid, OptionNode> Options { get; } = [];
    }

    /// <summary>
    /// Labels as stored, so a message about a kept rule can still name a row the edit removed.
    /// </summary>
    internal sealed class Names
    {
        public Dictionary<Guid, string> Gear { get; } = [];

        public Dictionary<Guid, string> Options { get; } = [];

        public Dictionary<Guid, string> SectionOfOption { get; } = [];

        /// <summary>So a rule's gear lists are named in sheet order, not whatever order they arrived in.</summary>
        public Dictionary<Guid, int> GearSortOrder { get; } = [];

        public static Names From(Playbook? stored)
        {
            var names = new Names();
            if (stored is null)
            {
                return names;
            }

            foreach (var category in stored.GearCategories)
            {
                names.Gear[category.Id] = category.Label;
                names.GearSortOrder[category.Id] = category.SortOrder;
            }

            foreach (var section in stored.BespokeSections)
            {
                foreach (var option in section.Options)
                {
                    names.Options[option.Id] = option.Title ?? option.DescriptionText ?? "(untitled)";
                    names.SectionOfOption[option.Id] = section.Title;
                }
            }

            return names;
        }
    }

    // -----------------------------------------------------------------------------------
    // Readings
    // -----------------------------------------------------------------------------------

    public static IReadOnlyList<Rule> FromRequest(IReadOnlyList<UpsertPlaybookPickRuleRequest> rules) =>
    [
        .. rules.Select((r, index) => new Rule(
            index,
            r.Label,
            [
                .. (r.Alternatives ?? []).Select(a => new Alternative(
                [
                    .. (a.Counts ?? []).Select(c => new Count(
                        c.GearCategoryId,
                        c.BespokeOptionId,
                        c.MinCount,
                        c.MaxCount,
                        c.Adjustment is { } adjustment
                            ? new Adjustment([.. adjustment.TriggerOptionIds ?? []], adjustment.MinCount, adjustment.MaxCount)
                            : null)),
                ])),
            ])),
    ];

    /// <summary>
    /// The stored rules in the same order the response uses (Y7), so the message about a kept rule
    /// names it, and picks its first problem, the same way every time rather than in database row order.
    /// </summary>
    public static IReadOnlyList<Rule> FromStored(Playbook stored)
    {
        var categorySortOrder = stored.GearCategories.ToDictionary(c => c.Id, c => c.SortOrder);
        var optionSortOrder = stored.BespokeSections.SelectMany(s => s.Options).ToDictionary(o => o.Id, o => o.SortOrder);

        int TargetSortOrder(PlaybookPickRuleCount count) =>
            count.GearCategoryId is { } categoryId ? categorySortOrder.GetValueOrDefault(categoryId)
            : count.BespokeOptionId is { } optionId ? optionSortOrder.GetValueOrDefault(optionId)
            : 0;

        return
        [
            .. stored.PickRules.OrderBy(r => r.SortOrder).ThenBy(r => r.Id).Select((r, index) => new Rule(
                index,
                r.Label,
                [
                    .. r.Alternatives.OrderBy(a => a.SortOrder).ThenBy(a => a.Id).Select(a => new Alternative(
                    [
                        .. a.Counts
                            .OrderBy(TargetSortOrder).ThenBy(c => c.GearCategoryId ?? c.BespokeOptionId ?? Guid.Empty)
                            .Select(c => new Count(
                                c.GearCategoryId,
                                c.BespokeOptionId,
                                c.MinCount,
                                c.MaxCount,
                                c.AdjustedMinCount is { } adjustedMin && c.AdjustedMaxCount is { } adjustedMax
                                    ? new Adjustment(
                                        [
                                            .. c.Triggers
                                                .Select(t => t.BespokeOptionId)
                                                .OrderBy(id => optionSortOrder.GetValueOrDefault(id))
                                                .ThenBy(id => id),
                                        ],
                                        adjustedMin,
                                        adjustedMax)
                                    : null)),
                    ])),
                ])),
        ];
    }

    /// <summary>
    /// The request's children as a graph. With <paramref name="stored"/> null (before the load)
    /// every id the request sends is taken at its word. With the stored playbook, a child keeps its
    /// id only where <c>PlaybookService</c>'s reconcilers will match it: a gear category by id; a
    /// section by id within the same owner (the playbook, or the same move); an option by id within
    /// the same section and under the same parent. Anything else is a new row, given a fresh key
    /// that no rule can refer to.
    /// </summary>
    public static Graph GraphFromRequest(UpsertPlaybookRequest request, Playbook? stored)
    {
        var graph = new Graph();
        var storedOptions = stored?.BespokeSections.SelectMany(s => s.Options).ToDictionary(o => o.Id);

        foreach (var category in request.GearCategories ?? [])
        {
            var kept = category.Id is { } id && (stored is null || stored.GearCategories.Any(c => c.Id == id));
            graph.Gear[Key(category.Id, kept)] = new GearNode(category.Label.Trim(), category.PickCount, category.IsOptional);
        }

        foreach (var section in request.BespokeSections ?? [])
        {
            var kept = section.Id is { } id
                && (stored is null || stored.BespokeSections.Any(s => s.Id == id && s.PlaybookMoveId is null));
            AddSection(graph, section, Key(section.Id, kept), isMoveInternal: false, storedOptions);
        }

        foreach (var move in request.Moves ?? [])
        {
            var moveKept = move.Id is { } moveId && (stored is null || stored.Moves.Any(m => m.Id == moveId));
            foreach (var section in move.BespokeSections ?? [])
            {
                var kept = moveKept
                    && section.Id is { } id
                    && (stored is null || stored.BespokeSections.Any(s => s.Id == id && s.PlaybookMoveId == move.Id));
                AddSection(graph, section, Key(section.Id, kept), isMoveInternal: true, storedOptions);
            }
        }

        return graph;
    }

    private static Guid Key(Guid? id, bool kept) => kept ? id!.Value : Guid.NewGuid();

    private static void AddSection(
        Graph graph,
        UpsertBespokeSectionRequest section,
        Guid key,
        bool isMoveInternal,
        Dictionary<Guid, BespokeOption>? storedOptions)
    {
        var node = new SectionNode(
            section.Title.Trim(),
            isMoveInternal,
            section.MinInstances is not null || section.MaxInstances is not null,
            []);
        graph.Sections[key] = node;
        AddOptions(graph, section.Options, key, null, node, storedOptions);
    }

    private static void AddOptions(
        Graph graph,
        IReadOnlyList<UpsertBespokeOptionRequest>? options,
        Guid sectionKey,
        Guid? parentKey,
        SectionNode section,
        Dictionary<Guid, BespokeOption>? storedOptions)
    {
        foreach (var option in options ?? [])
        {
            var kept = option.Id is { } id
                && (storedOptions is null
                    || (storedOptions.TryGetValue(id, out var existing) && existing.SectionId == sectionKey && existing.ParentOptionId == parentKey));
            var key = Key(option.Id, kept);

            graph.Options[key] = new OptionNode(
                option.Title ?? option.DescriptionText ?? "(untitled)",
                sectionKey,
                parentKey,
                (option.Children?.Count ?? 0) > 0,
                option.MaxSelect);

            if (parentKey is null)
            {
                section.TopLevelOptions.Add(key);
            }

            AddOptions(graph, option.Children, sectionKey, key, section, storedOptions);
        }
    }

    // -----------------------------------------------------------------------------------
    // The checks
    // -----------------------------------------------------------------------------------

    /// <summary>The first problem with <paramref name="rules"/> on <paramref name="graph"/>, or null.</summary>
    public static string? Check(IReadOnlyList<Rule> rules, Graph graph, Names names)
    {
        var ruleByTarget = new Dictionary<Guid, int>();
        var ruleBySection = new Dictionary<Guid, int>();

        foreach (var rule in rules)
        {
            var error = CheckRule(rule, graph, names, out var targets, out var governedSection);
            if (error is not null)
            {
                return error;
            }

            // Two rules on one list or section would make both the ceiling and the reported
            // minimum ambiguous (14.3.4).
            foreach (var target in targets)
            {
                if (!ruleByTarget.TryAdd(target.Target, rule.Index))
                {
                    return $"{Capitalize(TargetLabel(target, graph, names))} is counted by more than one pick rule; a list or category can have only one.";
                }
            }

            if (governedSection is { } sectionKey && !ruleBySection.TryAdd(sectionKey, rule.Index))
            {
                return $"\"{graph.Sections[sectionKey].Title}\" is governed by more than one pick rule; a section can have only one.";
            }
        }

        return null;
    }

    private static string? CheckRule(Rule rule, Graph graph, Names names, out List<Count> targets, out Guid? governedSection)
    {
        targets = [];
        governedSection = null;
        var name = RuleName(rule, graph, names);
        var counts = rule.Alternatives.SelectMany(a => a.Counts).ToList();

        if (rule.Alternatives.Count == 0)
        {
            return $"{Capitalize(name)} has no alternatives; a rule needs at least one.";
        }

        if (counts.FirstOrDefault(c => (c.GearCategoryId is null) == (c.BespokeOptionId is null)) is { } unaimed)
        {
            var what = unaimed.GearCategoryId is null
                ? "neither a gear category nor a bespoke option"
                : "both a gear category and a bespoke option";
            return $"{Capitalize(name)} has a count that names {what}; a count names exactly one.";
        }

        targets = [.. counts.DistinctBy(c => c.Target)];
        if (targets.Count == 0)
        {
            return $"{Capitalize(name)} counts nothing; a rule needs at least one list or category to count.";
        }

        // Duplicates are reported here first, readably; the two unique indexes are the backstop (Y5).
        foreach (var alternative in rule.Alternatives)
        {
            var seen = new HashSet<Guid>();
            foreach (var count in alternative.Counts)
            {
                if (!seen.Add(count.Target))
                {
                    return $"{Capitalize(name)} counts {TargetLabel(count, graph, names)} twice in one alternative.";
                }
            }

            if (targets.FirstOrDefault(t => !seen.Contains(t.Target)) is { } missing)
            {
                return $"Every alternative of {name} has to count each of its targets once, but one leaves out {TargetLabel(missing, graph, names)}.";
            }
        }

        foreach (var target in targets)
        {
            var exists = target.GearCategoryId is { } categoryId
                ? graph.Gear.ContainsKey(categoryId)
                : graph.Options.ContainsKey(target.BespokeOptionId!.Value);
            if (!exists)
            {
                return $"{Capitalize(name)} counts {TargetLabel(target, graph, names)}, but the playbook would not have it after this save.";
            }
        }

        if (targets.Any(t => t.IsGear) && targets.Any(t => !t.IsGear))
        {
            return $"{Capitalize(name)} counts both gear lists and bespoke categories; a rule counts only gear lists, or only the top-level categories of one section.";
        }

        if (targets[0].IsGear)
        {
            foreach (var target in targets)
            {
                var gear = graph.Gear[target.GearCategoryId!.Value];

                // Null means every option is granted outright, and B6 never stores those picks, so
                // such a rule could never be met. An optional flag would contradict the rule's own
                // minimum (Y6).
                if (gear.PickCount is null)
                {
                    return $"{Capitalize(name)} counts \"{gear.Label}\", whose options are all granted outright, so there is nothing to pick.";
                }

                if (gear.IsOptional)
                {
                    return $"{Capitalize(name)} counts \"{gear.Label}\", which is optional; the rule's minimum decides that instead.";
                }
            }
        }
        else
        {
            foreach (var target in targets)
            {
                var option = graph.Options[target.BespokeOptionId!.Value];
                if (option.ParentKey is not null || !option.HasChildren)
                {
                    return $"{Capitalize(name)} counts \"{option.Label}\", which is not a top-level category with options of its own.";
                }
            }

            var sectionKeys = targets.Select(t => graph.Options[t.BespokeOptionId!.Value].SectionKey).Distinct().ToList();
            if (sectionKeys.Count > 1)
            {
                return $"{Capitalize(name)} counts categories from more than one section; a rule governs one section.";
            }

            var section = graph.Sections[sectionKeys[0]];
            if (section.IsMoveInternal)
            {
                return $"{Capitalize(name)} governs \"{section.Title}\", which belongs to a move; a rule governs a playbook-level section.";
            }

            if (section.IsRepeatable)
            {
                return $"{Capitalize(name)} governs \"{section.Title}\", which is repeatable; a rule governs a section that is answered once.";
            }

            var targetIds = targets.Select(t => t.Target).ToHashSet();
            if (section.TopLevelOptions.Any(key => !targetIds.Contains(key)))
            {
                return $"{Capitalize(name)} doesn't count every top-level option of \"{section.Title}\"; its categories have to cover the whole section.";
            }

            governedSection = sectionKeys[0];
        }

        foreach (var count in counts)
        {
            var label = TargetLabel(count, graph, names);

            // The stored caps stay in force under a rule (S8), so every range has to fit under them.
            var cap = count.GearCategoryId is { } categoryId
                ? graph.Gear[categoryId].PickCount
                : graph.Options[count.BespokeOptionId!.Value].MaxSelect;

            var rangeError = RangeError(name, label, "range", count.MinCount, count.MaxCount, cap);
            if (rangeError is not null)
            {
                return rangeError;
            }

            if (count.Adjustment is not { } adjustment)
            {
                continue;
            }

            rangeError = RangeError(name, label, "adjusted range", adjustment.MinCount, adjustment.MaxCount, cap);
            if (rangeError is not null)
            {
                return rangeError;
            }

            if (adjustment.TriggerOptionIds.Count == 0)
            {
                return $"{Capitalize(name)} gives {label} an adjusted range with no trigger options; an adjustment needs at least one.";
            }

            if (adjustment.TriggerOptionIds.Distinct().Count() != adjustment.TriggerOptionIds.Count)
            {
                return $"{Capitalize(name)} names the same trigger twice for {label}.";
            }

            // Triggers are leaf options in playbook-level, non-repeatable sections, never in the
            // section the same rule governs (S2).
            foreach (var triggerId in adjustment.TriggerOptionIds)
            {
                var triggerLabel = OptionLabel(triggerId, graph, names);
                if (!graph.Options.TryGetValue(triggerId, out var trigger))
                {
                    return $"{Capitalize(name)} uses {triggerLabel} as a trigger, but the playbook would not have it after this save.";
                }

                if (trigger.HasChildren)
                {
                    return $"{Capitalize(name)} uses {triggerLabel} as a trigger, but it has options of its own; a trigger is a single option.";
                }

                var triggerSection = graph.Sections[trigger.SectionKey];
                if (triggerSection.IsMoveInternal)
                {
                    return $"{Capitalize(name)} uses {triggerLabel} as a trigger, but it sits in a move's section; triggers come from playbook-level sections.";
                }

                if (triggerSection.IsRepeatable)
                {
                    return $"{Capitalize(name)} uses {triggerLabel} as a trigger, but it sits in the repeatable section \"{triggerSection.Title}\".";
                }

                if (trigger.SectionKey == governedSection)
                {
                    return $"{Capitalize(name)} uses {triggerLabel} as a trigger inside \"{triggerSection.Title}\", the section it governs.";
                }
            }
        }

        return null;
    }

    private static string? RangeError(string name, string label, string kind, int min, int max, int? cap)
    {
        if (min < 0 || min > max)
        {
            return $"{Capitalize(name)} gives {label} the {kind} {min}–{max}; a range starts at 0 or more, with its minimum no higher than its maximum.";
        }

        if (cap is { } limit && max > limit)
        {
            return $"{Capitalize(name)} allows up to {max} for {label} in its {kind}, above that list's own limit of {limit}.";
        }

        return null;
    }

    // -----------------------------------------------------------------------------------
    // Naming the rule and its rows
    // -----------------------------------------------------------------------------------

    /// <summary>
    /// "the pick rule on "Natural Attacks"", or on the gear lists it counts. Stored names win, so
    /// a 409 names the rule the way the playbook stood before the edit.
    /// </summary>
    private static string RuleName(Rule rule, Graph graph, Names names)
    {
        var counts = rule.Alternatives.SelectMany(a => a.Counts).ToList();

        foreach (var optionId in counts.Select(c => c.BespokeOptionId).OfType<Guid>())
        {
            if (names.SectionOfOption.TryGetValue(optionId, out var storedTitle))
            {
                return $"the pick rule on \"{storedTitle}\"";
            }

            if (graph.Options.TryGetValue(optionId, out var option) && graph.Sections.TryGetValue(option.SectionKey, out var section))
            {
                return $"the pick rule on \"{section.Title}\"";
            }
        }

        var gearLabels = counts
            .Select(c => c.GearCategoryId)
            .OfType<Guid>()
            .Distinct()
            .OrderBy(id => names.GearSortOrder.TryGetValue(id, out var sortOrder) ? sortOrder : int.MaxValue)
            .ThenBy(id => id)
            .Select(id => names.Gear.TryGetValue(id, out var label) ? label : graph.Gear.TryGetValue(id, out var node) ? node.Label : null)
            .OfType<string>()
            .Select(label => $"\"{label}\"")
            .ToList();
        if (gearLabels.Count > 0)
        {
            return $"the pick rule on {EnglishList.Join(gearLabels, "and")}";
        }

        return string.IsNullOrWhiteSpace(rule.Label)
            ? $"pick rule {rule.Index + 1}"
            : $"the pick rule \"{rule.Label.Trim()}\"";
    }

    private static string TargetLabel(Count count, Graph graph, Names names)
    {
        if (count.GearCategoryId is { } categoryId)
        {
            return names.Gear.TryGetValue(categoryId, out var label) ? $"\"{label}\""
                : graph.Gear.TryGetValue(categoryId, out var node) ? $"\"{node.Label}\""
                : $"gear category {categoryId}";
        }

        return count.BespokeOptionId is { } optionId ? OptionLabel(optionId, graph, names) : "an unnamed target";
    }

    private static string OptionLabel(Guid optionId, Graph graph, Names names) =>
        names.Options.TryGetValue(optionId, out var label) ? $"\"{label}\""
        : graph.Options.TryGetValue(optionId, out var node) ? $"\"{node.Label}\""
        : $"bespoke option {optionId}";

    private static string Capitalize(string text) =>
        text.Length == 0 ? text : char.ToUpperInvariant(text[0]) + text[1..];
}
