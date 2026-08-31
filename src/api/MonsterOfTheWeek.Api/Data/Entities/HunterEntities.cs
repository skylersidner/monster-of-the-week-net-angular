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
 * This phase deliberately ships the minimal list-row shape only (phases.md Phase 9). The full
 * create/edit schema is Phase 10's delivery, and architecture.md Section 3 already specifies it.
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

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Playbook Playbook { get; set; } = null!;
}
