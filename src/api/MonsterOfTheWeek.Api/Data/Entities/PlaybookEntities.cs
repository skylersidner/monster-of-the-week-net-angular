namespace MonsterOfTheWeek.Api.Data.Entities;

/*
 * Hunter Playbook template data — Phase 2 of docs/hunter-playbooks/.
 *
 * Kept in its own file rather than appended to DomainEntities.cs, which would push a
 * shared file past the point of being navigable. AppUser.cs already establishes that a
 * domain may own its own entity file. Phase 5's bespoke-ruleset entities took the same
 * split one step further and live in BespokeEntities.cs alongside this one.
 *
 * Deliberately NOT ITimestamped, matching the reference/lookup precedent (AdventureType,
 * MonsterType, WeaponTag) rather than the user-content precedent (Mystery, Monster):
 * Playbooks are canonical template data seeded into every environment, not per-user
 * records whose edit history matters. architecture.md Section 3 specifies no timestamps.
 */

/// <summary>
/// A hunter playbook template — the character type a Hunter instance is built from.
/// Global reference data, not owned by any Mystery.
/// </summary>
public sealed class Playbook
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }

    public string? Description { get; set; }

    public int LuckBoxCount { get; set; }

    /// <summary>
    /// The playbook-specific "[Playbook] special" trigger — what spending a Luck point does.
    /// The track itself is uniform across playbooks; only this text varies.
    /// </summary>
    public string? LuckSpecialText { get; set; }

    public int HarmUnstableThreshold { get; set; }
    public int HarmBoxCount { get; set; }
    public int ExperienceBoxCount { get; set; }

    /// <summary>
    /// How many playbook moves a Hunter picks at creation.
    /// <para>
    /// Stays 0 until Phase 6 authors the Moves section — Phase 4 does not populate it.
    /// During that window 0 is indistinguishable from "this playbook grants no moves", so
    /// nothing should branch on this value or treat it as authored data. See
    /// docs/hunter-playbooks/architecture.md Section 3.
    /// </para>
    /// </summary>
    public int MoveGrantCount { get; set; }

    /// <summary>
    /// Per-playbook creation instructions, which name that playbook's own sections in
    /// order — bespoke ones included, so this genuinely varies across playbooks.
    /// </summary>
    public string? GettingStartedText { get; set; }

    public string? IntroductionsText { get; set; }
    public string? LevelingUpText { get; set; }

    /// <summary>
    /// The full History section as flat text, including its own intro sentence — not a
    /// normalized per-relationship table, per the explicit instruction not to model
    /// hunter-to-hunter relationships (architecture.md Section 2, "History").
    /// </summary>
    public string? HistoryPromptsText { get; set; }

    public ICollection<PlaybookStatArrayOption> StatArrayOptions { get; set; } = [];
    public ICollection<PlaybookMove> Moves { get; set; } = [];
    public ICollection<PlaybookGearCategory> GearCategories { get; set; } = [];
    public ICollection<PlaybookLookCategory> LookCategories { get; set; } = [];
    public ICollection<PlaybookImprovement> Improvements { get; set; } = [];

    // Phase 5 — see BespokeEntities.cs
    public ICollection<BespokeSection> BespokeSections { get; set; } = [];
    public ICollection<BespokeJournal> BespokeJournals { get; set; } = [];
    public ICollection<PlaybookExtraTrack> ExtraTracks { get; set; } = [];
}

/// <summary>
/// One preset "Ratings, pick one line" row — five signed stat modifiers chosen as a set.
/// </summary>
public sealed class PlaybookStatArrayOption
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PlaybookId { get; set; }
    public int Charm { get; set; }
    public int Cool { get; set; }
    public int Sharp { get; set; }
    public int Tough { get; set; }
    public int Weird { get; set; }
    public int SortOrder { get; set; }

    public Playbook Playbook { get; set; } = null!;
}

/// <summary>
/// One playbook-specific move. Authored in Phase 6, not Phase 4.
/// </summary>
public sealed class PlaybookMove
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PlaybookId { get; set; }
    public required string Name { get; set; }

    /// <summary>
    /// Carries the constrained HTML subset (&lt;b&gt;/&lt;i&gt;/&lt;ul&gt;/&lt;li&gt;) —
    /// the only standard-section field that does. Every other standard field is plain text.
    /// See architecture.md Section 6.3.
    /// </summary>
    public string? DescriptionText { get; set; }

    /// <summary>
    /// True when the playbook grants this move automatically ("You get this one:"), in
    /// which case it does not count against <see cref="Playbook.MoveGrantCount"/>.
    /// </summary>
    public bool Required { get; set; }

    public int SortOrder { get; set; }

    public Playbook Playbook { get; set; } = null!;
}

/// <summary>
/// A gear grouping with its own pick count — "Effective weapons, pick three", a fixed
/// no-choice grant, or one facet of a build-your-own weapon.
/// </summary>
public sealed class PlaybookGearCategory
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PlaybookId { get; set; }
    public required string Label { get; set; }

    /// <summary>
    /// How many options the Hunter picks. <c>null</c> means every listed option is granted
    /// automatically (a fixed grant such as The Divine's divine armour), which is why this
    /// is nullable rather than 0 — 0 would read as "pick none of these".
    /// </summary>
    public int? PickCount { get; set; }

    /// <summary>True for a category the Hunter may skip entirely ("if you want").</summary>
    public bool IsOptional { get; set; }

    public int SortOrder { get; set; }

    public Playbook Playbook { get; set; } = null!;
    public ICollection<PlaybookGearOption> Options { get; set; } = [];
}

public sealed class PlaybookGearOption
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid CategoryId { get; set; }
    public required string Name { get; set; }

    /// <summary>
    /// Free text, deliberately not decomposed into harm/range/tag columns: no uniform
    /// taxonomy exists across playbooks' gear, and some options carry no mechanics at all.
    /// </summary>
    public string? MechanicalText { get; set; }

    /*
     * SortOrder is an addition to architecture.md Section 3's field list, which gives it to
     * the four parent tables but not to the two leaf option tables (here and
     * PlaybookLookOption). Read as an oversight rather than a decision: the source prints
     * these lists in a fixed order, that order is user-visible, and without the column rows
     * come back in whatever order the database returns them. Adding it later would cost a
     * migration plus re-authoring the order; adding it now costs one int. Flagged to Skyler
     * rather than left silent.
     */
    public int SortOrder { get; set; }

    public PlaybookGearCategory Category { get; set; } = null!;
}

/// <summary>
/// One "Look, pick one from each list" category (eyes, clothes, and so on).
/// </summary>
public sealed class PlaybookLookCategory
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PlaybookId { get; set; }

    /// <summary>
    /// True when the category ends with a blank-fill option ("__________ eyes"). True in
    /// every category sampled so far, but kept as a real column rather than assumed, in
    /// case a later playbook's category is closed-list-only.
    /// </summary>
    public bool AllowsFreeform { get; set; }

    public int SortOrder { get; set; }

    public Playbook Playbook { get; set; } = null!;
    public ICollection<PlaybookLookOption> Options { get; set; } = [];
}

public sealed class PlaybookLookOption
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid CategoryId { get; set; }
    public required string Text { get; set; }
    public int SortOrder { get; set; }

    public PlaybookLookCategory Category { get; set; } = null!;
}

/// <summary>
/// One Improvements or Advanced Improvements line. Flat and untyped on purpose: the
/// variation across playbooks is entirely in which text appears, never in structure, so
/// semantic sub-typing (IsStatBoost/IsMoveGrant/...) would over-fit the sample.
/// </summary>
public sealed class PlaybookImprovement
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PlaybookId { get; set; }
    public required string Text { get; set; }

    /// <summary>False for the Improvements list, true for Advanced Improvements.</summary>
    public bool IsAdvanced { get; set; }

    public int SortOrder { get; set; }

    public Playbook Playbook { get; set; } = null!;
}

/// <summary>
/// The eight moves every hunter gets regardless of playbook. A real reference table rather
/// than a frontend constant, at Skyler's direction — the content is expected to be tweaked
/// over time and should live in the database like every other reference data in this app.
/// Not related to <see cref="Playbook"/> by any FK: these are universal.
/// </summary>
public sealed class BasicMove
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string DescriptionText { get; set; }
    public int SortOrder { get; set; }
}
