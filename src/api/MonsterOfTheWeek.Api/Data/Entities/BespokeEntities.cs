namespace MonsterOfTheWeek.Api.Data.Entities;

/*
 * Phase 5 — bespoke, playbook-unique rulesets.
 *
 * Full field-by-field spec: docs/hunter-playbooks/architecture.md Section 6, which is
 * authoritative and was validated against all 28 real playbooks. Per-playbook content to
 * author from: bespoke-ruleset-catalogue.md.
 *
 * Core design rule, applied throughout: there is NO ShapeKind/discriminator column. Which
 * shape a row represents is always derived from which nullable fields are populated — the
 * same pattern PlaybookGearCategory.PickCount/IsOptional already uses. The named shapes in
 * Section 6.5 (Titled Choice, Tag Pick, Nested Choice, Numeric leaf, ...) are vocabulary
 * for docs and conversation only; they are never stored.
 *
 * Split from PlaybookEntities.cs, whose header anticipated these living alongside it: five
 * entities with this much explanatory weight would have doubled that file. Same domain,
 * same conventions, separate file.
 *
 * Hunter-side tables (HunterBespokeSelection, HunterBespokeSectionInstance,
 * HunterJournalEntry, HunterJournalEntryFieldValue, HunterExtraTrackValue) are NOT here:
 * they all require a Hunter table, which lands in Phase 9/10. Their shapes are specified in
 * architecture.md Section 6.4 and ship with Hunter.
 */

/// <summary>
/// One named bespoke ruleset belonging to a playbook — "Background", "Fate", "Combat Magic".
/// </summary>
public sealed class BespokeSection
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PlaybookId { get; set; }

    /// <summary>
    /// Phase 6 — the entire schema delta for Move-internal pick structure.
    /// <para>
    /// Null means a playbook-level bespoke ruleset (every Phase 5 row). Set means this
    /// Section is the pick-structure printed inside that Move's own text.
    /// </para>
    /// <para>
    /// PlaybookId stays populated either way, even though it is derivable through the Move:
    /// keeping it makes "everything for this playbook" a single flat query, and matches how
    /// HunterBespokeSectionInstance.SectionId is stored directly rather than derived.
    /// </para>
    /// <para>
    /// The cost this introduces, stated plainly: BespokeSection is now polymorphic in its
    /// owner, so any query for a playbook's top-level rulesets must exclude rows where this
    /// is set. The API shape enforces that structurally rather than by convention — a Move's
    /// sections are nested under the Move in both the request and the response, so a client
    /// cannot mix the two by accident.
    /// </para>
    /// </summary>
    public Guid? PlaybookMoveId { get; set; }

    public required string Title { get; set; }

    /// <summary>
    /// Intro/framing prose: what you are picking and why, read once at character creation.
    /// Genuinely null when the Section is a pure umbrella whose real content lives one level
    /// down in its category-divider options.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// A semantically distinct second prose block: what having made these picks means during
    /// ongoing play, not what you are about to pick. Only populated when the source presents
    /// it as a separately-positioned block after the options — never for a forward-looking
    /// clause inside one continuous paragraph.
    /// </summary>
    public string? EffectText { get; set; }

    /// <summary>
    /// Populated only for a Section with zero options whose entire content is one
    /// player-authored value. When set, MinSelect/MaxSelect are both null and the UI renders
    /// a labelled free-text input instead of a pick control.
    /// </summary>
    public string? FreeTextLabel { get; set; }

    /// <summary>
    /// How many of this Section's direct top-level options must/may be picked.
    /// <para>
    /// Both null is valid and expected — it means "there is no option set to pick from at
    /// all" (a fixed always-active grant, or a FreeTextLabel Section). It is NOT the same as
    /// 0/0, which would wrongly read as a real but empty option set.
    /// </para>
    /// </summary>
    public int? MinSelect { get; set; }
    public int? MaxSelect { get; set; }

    /// <summary>
    /// How many times this Section's whole option tree can be instantiated per Hunter — the
    /// same idiom as MinSelect/MaxSelect one level up. Both null (the default) means the
    /// concept does not apply: exactly one instance.
    /// </summary>
    public int? MinInstances { get; set; }
    public int? MaxInstances { get; set; }

    public int SortOrder { get; set; }

    public Playbook Playbook { get; set; } = null!;
    public PlaybookMove? PlaybookMove { get; set; }
    public ICollection<BespokeOption> Options { get; set; } = [];
}

/// <summary>
/// One pickable item within a <see cref="BespokeSection"/>, at any nesting depth.
/// </summary>
public sealed class BespokeOption
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>
    /// Always set, at every depth — not just on top-level options. Keeping it denormalised
    /// through the tree makes "every option in this section" a single flat query instead of
    /// a recursive walk.
    /// </summary>
    public Guid SectionId { get; set; }

    /// <summary>
    /// Plain adjacency list. Null means top-level; set means nested under another option.
    /// Generalises to any depth for free — real data reaches three levels
    /// (Section, category divider, sub-category, tag item).
    /// </summary>
    public Guid? ParentOptionId { get; set; }

    /// <summary>
    /// Independently nullable from DescriptionText, not a package deal. Real data has
    /// title-only, description-only, both, and neither-but-has-children cases.
    /// <para>Titles never carry markup, even when the source prints the label bold.</para>
    /// </summary>
    public string? Title { get; set; }

    /// <summary>
    /// Carries the constrained HTML subset and may embed a blank-fill token marking where
    /// the UI renders a free-text input (architecture.md Section 6.3).
    /// </summary>
    public string? DescriptionText { get; set; }

    /// <summary>
    /// Identical meaning to the Section-level pair, scoped to <em>this option's own
    /// children</em>. Only populated on options that have children. This recursion is what
    /// makes multi-level nesting fall out of one mechanism with zero extra schema.
    /// </summary>
    public int? MinSelect { get; set; }
    public int? MaxSelect { get; set; }

    /// <summary>
    /// A bounded numeric resource the Hunter mutates during play, attached to a leaf option
    /// so its existence is automatically conditional on that option being picked. Distinct
    /// from MinSelect/MaxSelect, which govern a pick count over children — a numeric leaf
    /// has no children, so its own MinSelect/MaxSelect stay null.
    /// </summary>
    public int? NumericMin { get; set; }
    public int? NumericMax { get; set; }

    public int SortOrder { get; set; }

    public BespokeSection Section { get; set; } = null!;
    public BespokeOption? ParentOption { get; set; }
    public ICollection<BespokeOption> ChildOptions { get; set; } = [];
}

/// <summary>
/// Growing, freeform-labelled entries — content the Keeper and player invent live during
/// play, where the template defines only a <em>field shape</em> and never option content.
/// <para>
/// Structurally different from a repeatable <see cref="BespokeSection"/>, and the
/// distinction matters: a repeatable Section has real described structure that simply needs
/// several independent copies; a Journal has no structure at all beyond bare field labels,
/// and nothing a Hunter picks <em>from</em>. Forcing this into BespokeOption would be a
/// category error.
/// </para>
/// </summary>
public sealed class BespokeJournal
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PlaybookId { get; set; }
    public required string Title { get; set; }

    /// <summary>
    /// Can be genuinely null — verified against the source, not assumed — when the source
    /// gives the journal nothing beyond its own bare heading.
    /// </summary>
    public string? Description { get; set; }

    public string? EffectText { get; set; }
    public int SortOrder { get; set; }

    public Playbook Playbook { get; set; } = null!;
    public ICollection<BespokeJournalField> Fields { get; set; } = [];
}

/// <summary>
/// One labelled slot every entry in a <see cref="BespokeJournal"/> carries (e.g. "Power",
/// "Downside"). A real child table rather than hardcoded Field1Label/Field2Label columns.
/// </summary>
public sealed class BespokeJournalField
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid JournalId { get; set; }
    public required string Label { get; set; }
    public int SortOrder { get; set; }

    public BespokeJournal Journal { get; set; } = null!;
}

/// <summary>
/// A Luck-like tracked resource universal to every Hunter of a playbook (Curse-Eater's
/// Corruption, Pararomantic's Relationship Status).
/// <para>
/// Deliberately its own table rather than merged into BespokeSection/BespokeOption: a track
/// is a numeric range with start/end labels and no pick involved at all. Also deliberately
/// NOT a rework of Luck/Harm/Experience, which stay as hardcoded columns on Playbook — an
/// accepted inconsistency, since unifying them would cost a migration against a working
/// schema for no benefit yet.
/// </para>
/// </summary>
public sealed class PlaybookExtraTrack
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PlaybookId { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public string? EffectText { get; set; }
    public int BoxCount { get; set; }

    /// <summary>
    /// Null means "render the implicit 'Okay' default" — true of every track whose start
    /// state carries no thematic meaning. A populated value overrides it (e.g. "Loving").
    /// </summary>
    public string? StartLabel { get; set; }

    public required string EndLabel { get; set; }
    public int SortOrder { get; set; }

    public Playbook Playbook { get; set; } = null!;
}
