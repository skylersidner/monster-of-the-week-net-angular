namespace MonsterOfTheWeek.Api.Data.Entities;

/*
 * Pick rules — hunter-creation-wizard.md 12.9 (Q3, Q5, Q12), architecture.md Section 6.10.
 *
 * A pick rule states a limit that no single stored count can: The Initiate's two weapons
 * lists, whose numbers depend on the Sect's traditions, and the either/or picks in The
 * Monstrous's Natural Attacks and The Spell-Slinger's Combat Magic. The stored PickCount,
 * MinSelect and MaxSelect values those rules govern stay exactly as they are, as ceilings
 * (S8); a rule replaces only the minimums they would otherwise report.
 *
 * - A rule is a set of alternatives. A hunter's picks satisfy the rule when they fit at least
 *   one alternative.
 * - An alternative has one count per target the rule governs. A target is a gear category, or
 *   a top-level category divider of one bespoke section.
 * - A count is an allowed range, plus at most one adjustment: a different range that applies
 *   when any of its trigger options is picked.
 *
 * Playbook-owned template data like every other table in PlaybookEntities.cs, so deliberately
 * not ITimestamped, and every FK is Cascade. PlaybookService validation, not the database, is
 * what stops a playbook edit from silently deleting part of a rule (12.9, 14.3.2).
 *
 * The hunter side has no new table or column: the gear picks and bespoke selections a hunter
 * already stores are the entire input. Evaluation lives in Services/PickRules.cs.
 */

/// <summary>One pick rule on a playbook.</summary>
public sealed class PlaybookPickRule
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PlaybookId { get; set; }

    /// <summary>
    /// Printed plain text: the governed section's own instruction where it has one ("Pick a Base
    /// and add an extra to it, or two Bases."). Null when the targets' own headings already say
    /// it, as The Initiate's two weapons lists do.
    /// </summary>
    public string? Label { get; set; }

    public int SortOrder { get; set; }

    public Playbook Playbook { get; set; } = null!;
    public ICollection<PlaybookPickRuleAlternative> Alternatives { get; set; } = [];
}

/// <summary>One allowed combination within a rule. Every rule has at least one.</summary>
public sealed class PlaybookPickRuleAlternative
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid RuleId { get; set; }

    /// <summary>Printed plain text, or null. Null on all three canonical rules.</summary>
    public string? Label { get; set; }

    public int SortOrder { get; set; }

    public PlaybookPickRule Rule { get; set; } = null!;
    public ICollection<PlaybookPickRuleCount> Counts { get; set; } = [];
}

/// <summary>
/// How many picks one alternative allows under one target.
///
/// <para>
/// <b>Exactly one target</b>, enforced by a check constraint. For a gear category the count is
/// its picked options; for a bespoke category divider it is the divider's picked direct children
/// (<c>BespokeEngagement.CountUnder</c>), so write-your-own slots count like any other option.
/// </para>
///
/// <para>
/// <b><see cref="Id"/> is storage-only.</b> Counts carry no id on the wire and are replaced
/// wholesale within their alternative; nothing outside the rule references them.
/// </para>
/// </summary>
public sealed class PlaybookPickRuleCount
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid AlternativeId { get; set; }

    public Guid? GearCategoryId { get; set; }
    public Guid? BespokeOptionId { get; set; }

    public int MinCount { get; set; }
    public int MaxCount { get; set; }

    /// <summary>
    /// The range that applies instead when any of <see cref="Triggers"/> is among the hunter's
    /// section-level picks. Both null, or both set (check constraint); triggers exist exactly when
    /// they are set (PlaybookService). A count has at most one adjustment, so nothing ever has to
    /// choose between two of them.
    /// </summary>
    public int? AdjustedMinCount { get; set; }

    public int? AdjustedMaxCount { get; set; }

    public PlaybookPickRuleAlternative Alternative { get; set; } = null!;
    public ICollection<PlaybookPickRuleCountTrigger> Triggers { get; set; } = [];
}

/// <summary>
/// One option that switches a count to its adjusted range — The Initiate's Fighting arts, for
/// example. Always a leaf option in a playbook-level, non-repeatable section that the same rule
/// does not govern (S2). Composite-keyed: an option triggers a count once or not at all.
/// </summary>
public sealed class PlaybookPickRuleCountTrigger
{
    public Guid CountId { get; set; }
    public Guid BespokeOptionId { get; set; }

    public PlaybookPickRuleCount Count { get; set; } = null!;
}
