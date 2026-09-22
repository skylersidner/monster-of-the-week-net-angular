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
 * **`count` and `namesResolved` are two facts from two sources, and collapsing them was a bug
 * (§15.1).** The count comes from the entity's own `mysteryIds`, which is carried on the list and
 * detail responses and does not depend on the mystery lookup at all. The *names* come from that
 * lookup. Deriving the count from the resolved names made "is in no mystery" and "could not resolve
 * any name" render as the same positive sentence — the second of which is the opposite of the truth,
 * on the sentence an irreversible decision is made from.
 *
 * Pluralisation is real, not a bare `(s)`. The punctuation carries weight too: the colon promises a
 * list, so the names-missing variant ends in a full stop. A trailing colon above an empty block is
 * its own small lie.
 */
export function mysteryUsageMessage(noun: string, count: number, namesResolved = true): string {
  if (count === 0) {
    return `This ${noun} isn't used by any mystery.`;
  }

  const plural = `${count} ${count === 1 ? 'mystery' : 'mysteries'}`;
  return namesResolved
    ? `This ${noun} is used by ${plural}:`
    : `This ${noun} is used by ${plural}. Their names couldn't be loaded.`;
}

/**
 * **Currently uncalled, and retained deliberately (§15.1).** Every shipped surface now takes its
 * count from the entity's own `mysteryIds`, which is always available wherever the entity is, so
 * "we cannot say how many" no longer arises: a failed name lookup degrades to the
 * `namesResolved: false` variants above, which are strictly more useful. This stays for a case
 * where even the **count** is unknowable — a surface that has an entity id and no `mysteryIds` —
 * because the reasoning below is the part worth keeping, and it is cheaper to keep than to
 * rediscover.
 *
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
 * The wizard's variants (B) and (C) — the **"other mysteries"** wording, and the one place the
 * difference from the list-page functions above is visible.
 *
 * Inside the wizard there *is* a current mystery, so the others really are other; on a flat
 * catalogue route there is not, and saying "other" there makes the count read as off-by-one. Two
 * sentences, one file, so nobody has to remember which surface they are on — they pick the
 * function named after it.
 */
export function wizardMysteryUsageMessage(noun: string, count: number, namesResolved = true): string {
  if (count === 0) {
    return `This ${noun} isn't used by any other mystery.`;
  }

  const plural = `${count} other ${count === 1 ? 'mystery' : 'mysteries'}`;
  return namesResolved
    ? `This ${noun} is also used by ${plural}:`
    : `This ${noun} is also used by ${plural}. Their names couldn't be loaded.`;
}

/**
 * The wizard's deferral footnote for variants (B) and (C).
 *
 * `tail` comes from `MysteryCreateStore.deferredChangeTail` — "when you press Finish" on the last
 * phase, "when you continue to the next step" everywhere else (§7.1, G2). It is passed in rather
 * than derived here so this file stays free of wizard state, and so there is exactly one place the
 * branch is computed.
 *
 * Note what this deliberately does **not** say: "This cannot be undone." A wizard removal has not
 * happened yet at the moment the user reads this, so the hard permanence line the list pages use
 * would be false here (§7.3).
 */
export function wizardRemovalFootnote(
  noun: string,
  sharedWithOthers: boolean,
  tail: string,
  /**
   * **Monsters only** (UX §7.1): `'along with its minions'`, appended to the *Delete* sentence and
   * to nothing else.
   *
   * It is a parameter rather than a second function because the deferral branch above must stay in
   * one place, and it attaches to the Delete clause specifically because that is the only verb it
   * is true of — detach leaves the minions alone, since they travel with the monster rather than
   * with the membership. A footnote that mentioned them without saying which verb takes them would
   * imply minions die either way, which is the sentence §18.3 is holding us to.
   */
  deleteCascadeClause = '',
): string {
  const cascade = deleteCascadeClause ? `, ${deleteCascadeClause}` : '';
  const consequence = sharedWithOthers
    ? `Detach removes it from this mystery only. Delete removes it from those mysteries too${cascade}.`
    : `Detach keeps it in your ${noun}s list. Delete removes it for good${cascade}.`;

  return `${consequence} Either way, the change takes effect ${tail}.`;
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
