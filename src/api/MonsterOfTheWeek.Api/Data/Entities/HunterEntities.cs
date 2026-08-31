namespace MonsterOfTheWeek.Api.Data.Entities;

/*
 * Hunter instances — Phase 9 of docs/hunter-playbooks/.
 *
 * Its own file rather than an addition to DomainEntities.cs or PlaybookEntities.cs, for two
 * reasons. DomainEntities.cs is already the largest entity file in the project, and Hunter is
 * a domain of its own rather than another Mystery-owned record. PlaybookEntities.cs holds
 * *template* data; Hunter is the instance side of that template, and Phase 10 adds four more
 * instance-side tables (HunterMove, HunterGearSelection, HunterExtraTrackValue,
 * HunterBespokeSelection) plus two for bespoke rulesets — all of which belong here, next to
 * the row they hang off, not mixed into the template file.
 *
 * Phase 9 shipped the minimal list-row shape; Phase 10 (2026-08-31) added the create/edit
 * schema from architecture.md Section 3 — the rating-array link, the mutable play-state
 * counters, the freeform background, and the two pick bridges.
 *
 * Follow-on 10a added structured Looks and Extra Tracks; Follow-on 10b added the bespoke
 * instance tables at the bottom of this file. Every hunter-side table in architecture.md
 * Sections 3 and 6.4 now exists.
 *
 * What Hunter.Background still holds, and all it holds: History, which Section 2 deliberately
 * models as flat prose because the brief ruled out modelling hunter-to-hunter relationships.
 */

/// <summary>
/// A player character built from a <see cref="Playbook"/> template.
///
/// <para>
/// <b>Live-linked to its Playbook, not snapshotted</b> (architecture.md Section 3, resolved
/// 2026-08-25). Nothing about the Playbook is copied onto this row — not the stat array, not
/// the moves, not the gear. If a template is edited, Hunters built from it change with it, and
/// that is the intended behaviour rather than something to design around. Phase 10's child
/// tables continue the same pattern as FK bridges into the Playbook's own child rows.
/// </para>
///
/// <para>
/// <b>No Mystery relationship</b>, this phase or later in the shape it currently has. Hunters
/// will eventually be many-to-many with Mysteries, via a future bridge table that is a pure
/// addition — nothing here would need to change for it (architecture.md Section 3, confirmed
/// 2026-08-25). That is also why the list endpoint is flat rather than mystery-scoped the way
/// Monster's optionally is.
/// </para>
/// </summary>
public sealed class Hunter : ITimestamped
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>
    /// Required, and deliberately <c>Restrict</c> rather than the EF default for a
    /// non-nullable FK. Cascade here would mean deleting a Playbook silently destroys every
    /// Hunter ever built from it — an entire top-level user record, not just a pick. See
    /// <c>PlaybookService.DeleteAsync</c> for the guard that turns the resulting constraint
    /// violation into a 409 before the database ever sees it.
    /// </summary>
    public Guid PlaybookId { get; set; }

    public required string Name { get; set; }

    /// <summary>
    /// Every playbook sheet has a blank "Pronouns: ___" line and nothing to pick from, so this
    /// is Hunter-instance free text with zero Playbook-side schema (architecture.md Section 2).
    /// </summary>
    public string? Pronouns { get; set; }

    /// <summary>
    /// Which preset rating array was chosen — a live FK into the Playbook's own rows, never a
    /// copy of the five numbers (architecture.md Section 3, resolved 2026-08-25).
    ///
    /// <para>
    /// <b>Nullable, which is a judgement call worth knowing about.</b> Section 3's sketch does
    /// not mark nullability either way, and every hunter of the canonical 28 will have one. It
    /// is nullable because the alternative fails hard in a recoverable situation: a playbook
    /// Skyler creates through the admin UI (Section 4 "Path B") may not have had its rating
    /// arrays authored yet, and a non-nullable column would make it impossible to create any
    /// hunter for that playbook at all, with an error that does not explain itself. The form
    /// requires a selection whenever the playbook offers one, so the normal path still cannot
    /// produce a hunter without ratings.
    /// </para>
    /// </summary>
    public Guid? PlaybookStatArrayOptionId { get; set; }

    /*
     * Mutable play state, not template data. These are the counters a player marks during a
     * session, so they live on the instance as plain ints; the *maximums* stay on the Playbook
     * (LuckBoxCount / HarmBoxCount / ExperienceBoxCount) and are validated against on write.
     */
    public int Luck { get; set; }
    public int Harm { get; set; }
    public int Experience { get; set; }

    /// <summary>
    /// The deliberate placeholder catch-all for history and bespoke-pick answers, per
    /// architecture.md Section 3 and Skyler's confirmation recorded in phases.md Phase 10.
    /// Looks no longer land here — they got structured capture of their own in the follow-on
    /// pass. What remains in this box is exactly what the bespoke-ruleset pass will replace.
    /// </summary>
    public string? Background { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Playbook Playbook { get; set; } = null!;
    public PlaybookStatArrayOption? PlaybookStatArrayOption { get; set; }
    public ICollection<HunterMove> Moves { get; set; } = [];
    public ICollection<HunterGearSelection> GearSelections { get; set; } = [];
    public ICollection<HunterLookSelection> LookSelections { get; set; } = [];
    public ICollection<HunterExtraTrackValue> ExtraTrackValues { get; set; } = [];
    public ICollection<HunterBespokeSelection> BespokeSelections { get; set; } = [];
    public ICollection<HunterBespokeSectionInstance> BespokeSectionInstances { get; set; } = [];
    public ICollection<HunterJournalEntry> JournalEntries { get; set; } = [];
}

/*
 * Both bridges below are composite-keyed FK pairs with no surrogate Id, matching
 * MysteryBystander / MonsterAttackWeaponTag rather than the Id-carrying child entities. The
 * composite key is doing real work: it makes "this hunter picked this move twice" impossible
 * at the database level rather than something the service has to remember to check.
 *
 * Both FKs into the Playbook side are Restrict, for the same reason Hunter.PlaybookId is —
 * see PlaybookService.UpdateAsync, which refuses to remove a template row a hunter is using.
 */

/// <summary>A move this hunter actually picked, live-linked to the Playbook's own row.</summary>
public sealed class HunterMove
{
    public Guid HunterId { get; set; }
    public Guid PlaybookMoveId { get; set; }

    public Hunter Hunter { get; set; } = null!;
    public PlaybookMove PlaybookMove { get; set; } = null!;
}

/// <summary>A gear option this hunter actually picked, live-linked to the Playbook's own row.</summary>
public sealed class HunterGearSelection
{
    public Guid HunterId { get; set; }
    public Guid PlaybookGearOptionId { get; set; }

    public Hunter Hunter { get; set; } = null!;
    public PlaybookGearOption PlaybookGearOption { get; set; } = null!;
}

/// <summary>
/// This hunter's answer to one Look line — either one of the printed options or their own words.
///
/// <para>
/// <b>Keyed by category, so a hunter has at most one answer per line.</b> That is how the
/// playbook sheet works: each Look category is a row of alternatives with one circled. All 77
/// categories across the 28 playbooks allow freeform (verified against the data, not assumed),
/// which is why <see cref="FreeformText"/> needs no per-category permission check beyond the
/// category's own <c>AllowsFreeform</c> flag. If multiple picks per line ever turn out to be
/// wanted, the composite key is the single thing to change.
/// </para>
///
/// <para>
/// Exactly one of <see cref="LookOptionId"/> and <see cref="FreeformText"/> is populated — the
/// service enforces that, since no database constraint expresses "exactly one of these two".
/// </para>
/// </summary>
public sealed class HunterLookSelection
{
    public Guid HunterId { get; set; }
    public Guid LookCategoryId { get; set; }

    public Guid? LookOptionId { get; set; }
    public string? FreeformText { get; set; }

    public Hunter Hunter { get; set; } = null!;
    public PlaybookLookCategory LookCategory { get; set; } = null!;
    public PlaybookLookOption? LookOption { get; set; }
}

/// <summary>
/// The current value of one <see cref="PlaybookExtraTrack"/> for this hunter — the Curse-Eater's
/// Corruption, the Pararomantic's Relationship Status.
///
/// <para>
/// Cannot be a fixed column on <see cref="Hunter"/> the way Luck/Harm/Experience are, because
/// only some playbooks have a track at all (architecture.md Section 2, "Extra Tracks").
/// </para>
///
/// <para>
/// <b>Composite-keyed, deviating from Section 6.4's sketch</b>, which shows a surrogate
/// <c>Id</c>. There is exactly one value per (hunter, track) pair, and the composite key makes
/// that structurally impossible to violate; a surrogate would need an extra unique index to say
/// the same thing. It also matches the two bridges above rather than introducing a third
/// convention in the same file.
/// </para>
/// </summary>
public sealed class HunterExtraTrackValue
{
    public Guid HunterId { get; set; }
    public Guid ExtraTrackId { get; set; }
    public int CurrentValue { get; set; }

    public Hunter Hunter { get; set; } = null!;
    public PlaybookExtraTrack ExtraTrack { get; set; } = null!;
}

/*
 * ---------------------------------------------------------------------------------------
 * Bespoke-ruleset instance side — architecture.md Section 6.4.
 *
 * Two deliberate departures from 6.4's sketch, both forced by real data rather than taste:
 *
 * 1. HunterBespokeSelection carries SectionId. 6.4 has only BespokeOptionId (nullable, for
 *    the free-text case) and SectionInstanceId (nullable, only for repeatable Sections).
 *    That leaves a free-text answer on a NON-repeatable Section — the Gumshoe Code, whose
 *    FreeTextLabel is "Your Code" — with no way to say which Section it answers: no option,
 *    no instance. Storing SectionId always also makes "everything this hunter answered for
 *    this Section" one flat query. It is the same denormalisation BespokeOption.SectionId
 *    and BespokeSection.PlaybookId already make, for the same stated reason.
 *
 * 2. HunterBespokeSelection carries FreeformTitle as well as FreeformText. A BespokeOption
 *    has two text fields that can each contain a {{blank}} fill-in token, and four real
 *    options (The Monstrous's Curses and Natural Attacks) put a blank in BOTH — "write your
 *    own, name it and describe it". One string cannot hold two answers without inventing a
 *    delimiter, so the selection mirrors the template's own two fields one-for-one.
 * ---------------------------------------------------------------------------------------
 */

/// <summary>
/// One independent copy of a repeatable <see cref="BespokeSection"/>'s whole option tree —
/// a single Rote, one Network member, one of the Spell-Slinger's three organizations.
///
/// <para>
/// Its own row rather than a bare instance-number on the selections, so a freshly-added
/// entry with nothing filled in yet is representable, and so an instance's own name (when
/// the source asks for one — "give your new rote a name") has somewhere to live that is not
/// a <see cref="BespokeOption"/>. Both reasons are 6.4's, restated here because they are the
/// whole justification for the table existing.
/// </para>
/// </summary>
public sealed class HunterBespokeSectionInstance
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid HunterId { get; set; }
    public Guid SectionId { get; set; }

    /// <summary>Per-instance free text, only where the source asks for a name.</summary>
    public string? Name { get; set; }

    public int SortOrder { get; set; }

    public Hunter Hunter { get; set; } = null!;
    public BespokeSection Section { get; set; } = null!;
    public ICollection<HunterBespokeSelection> Selections { get; set; } = [];
}

/// <summary>
/// One answer a hunter has recorded against a bespoke ruleset: a picked option, a filled-in
/// blank, a numeric value, or the free-text answer to a whole Section.
///
/// <para>
/// <b>Zero-option Sections never produce a row here.</b> A fixed always-active grant (the
/// Covenant, Monster Breed, the Snoop's Crew — seven of them) is something the hunter has by
/// virtue of the playbook, exactly like a <c>Required</c> move needing no per-hunter record.
/// </para>
/// </summary>
public sealed class HunterBespokeSelection
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid HunterId { get; set; }

    /// <summary>Always populated — see this file's departure note 1.</summary>
    public Guid SectionId { get; set; }

    /// <summary>
    /// Null only when the Section is answered as a whole rather than by picking: a
    /// <c>FreeTextLabel</c> Section. That is 6.4's single documented exception, and the
    /// service refuses a null here for any other Section.
    /// </summary>
    public Guid? BespokeOptionId { get; set; }

    /// <summary>Fills a <c>{{blank}}</c> in the option's DescriptionText, or answers a FreeTextLabel Section.</summary>
    public string? FreeformText { get; set; }

    /// <summary>Fills a <c>{{blank}}</c> in the option's Title — see departure note 2.</summary>
    public string? FreeformTitle { get; set; }

    /// <summary>Set only for an option carrying NumericMin/NumericMax (one option, playbook-wide).</summary>
    public int? NumericValue { get; set; }

    /// <summary>Set only when this answer belongs to one instance of a repeatable Section.</summary>
    public Guid? SectionInstanceId { get; set; }

    public Hunter Hunter { get; set; } = null!;
    public BespokeSection Section { get; set; } = null!;
    public BespokeOption? BespokeOption { get; set; }
    public HunterBespokeSectionInstance? SectionInstance { get; set; }
}

/// <summary>
/// One entry in a <see cref="BespokeJournal"/> — a Curse-Eater's consumed magic. Unlike every
/// other hunter-side row this is not a bridge to a template row at all: the content is
/// invented during play and the template defines only the field labels.
/// </summary>
public sealed class HunterJournalEntry
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid HunterId { get; set; }
    public Guid JournalId { get; set; }
    public int SortOrder { get; set; }

    public Hunter Hunter { get; set; } = null!;
    public BespokeJournal Journal { get; set; } = null!;
    public ICollection<HunterJournalEntryFieldValue> FieldValues { get; set; } = [];
}

/// <summary>One entry's value for one of its journal's labelled slots.</summary>
public sealed class HunterJournalEntryFieldValue
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid EntryId { get; set; }
    public Guid JournalFieldId { get; set; }
    public string? Text { get; set; }

    public HunterJournalEntry Entry { get; set; } = null!;
    public BespokeJournalField JournalField { get; set; } = null!;
}
