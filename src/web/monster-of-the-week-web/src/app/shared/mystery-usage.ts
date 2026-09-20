/**
 * Copy and resolution for the removal modal's **usage** block — the "where is this used" half of
 * `docs/updates/mystery-entity-linking-ux.md` §7.1, as opposed to the `items` half, which keeps its
 * shipped "what gets destroyed with it" meaning.
 *
 * Shared rather than copied three times because all three list pages must say the same thing, and
 * because one sentence here carries a rule that is easy to get wrong in isolation: on a list page it
 * is **"used by 2 mysteries"**, never "2 *other* mysteries". There is no current mystery on a flat
 * catalogue route for the others to be other than, and the extra word makes the count read as
 * off-by-one (§7.1, variant D).
 *
 * The wizard's variants (B) and (C) *do* say "other", because there the user is standing inside one
 * of the mysteries. That wording belongs to Phase 4 and is deliberately not built here.
 */

/** Anything with an id and a name — `MysteryListItemResponse` satisfies it without importing it. */
export interface NamedMystery {
  id: string;
  name: string;
}

/**
 * Names for the mysteries an entity belongs to, in mystery-list order.
 *
 * IDs with no matching mystery are dropped, which is why every caller must take its **count from
 * the returned array**, never from the `mysteryIds` it passed in: a stale ID would otherwise make
 * the sentence claim a number the list beneath it does not show.
 */
export function resolveMysteryNames(
  mysteryIds: readonly string[],
  mysteries: readonly NamedMystery[],
): string[] {
  return mysteries.filter((mystery) => mysteryIds.includes(mystery.id)).map((mystery) => mystery.name);
}

/**
 * The sentence above the usage list. `noun` is the entity's own noun — "location", "bystander",
 * "monster" — so the copy reads about the thing the user is deleting.
 *
 * Pluralisation is real, not a bare `(s)`.
 */
export function mysteryUsageMessage(noun: string, count: number): string {
  if (count === 0) {
    return `This ${noun} isn't used by any mystery.`;
  }

  return `This ${noun} is used by ${count} ${count === 1 ? 'mystery' : 'mysteries'}:`;
}

/**
 * What the usage block says when we have **no verified answer** — the mystery list failed to load,
 * or has not arrived yet.
 *
 * The first instinct was to render nothing at all, on the grounds that a false "isn't used by any
 * mystery" on an irreversible action is worse than silence. Rosalina agreed with the reasoning and
 * overrode the treatment (§7.7): **silence reproduces the very inference it avoids.** Once users
 * learn this dialog always reports usage, a missing block reads as "used nowhere" just as a false
 * sentence would — only quieter, and unfalsifiable from the user's side. Saying the check failed
 * turns an invisible failure into a visible one the user can act on.
 *
 * The confirm button deliberately stays enabled: a network blip must not block a legitimate delete,
 * and the user now has what they need to cancel and retry instead.
 */
export function mysteryUsageUnavailableMessage(noun: string): string {
  return `Couldn't check which mysteries use this ${noun}.`;
}

/**
 * The closing line. On a list page the delete is immediate, so the hard "This cannot be undone."
 * is correct here — unlike the wizard, where removal is deferred to the next phase transition and
 * saying so would be false at the moment it is read (§7.3).
 */
export function mysteryUsageFootnote(count: number): string {
  return count > 0
    ? 'Deleting removes it from those mysteries too. This cannot be undone.'
    : 'This cannot be undone.';
}
