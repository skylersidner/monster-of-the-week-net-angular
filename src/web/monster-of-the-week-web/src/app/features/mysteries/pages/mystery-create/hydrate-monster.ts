import {
  CustomMoveResponse,
  MinionArmorResponse,
  MinionAttackResponse,
  MinionDetailResponse,
  MinionPowerResponse,
  MinionWeaknessResponse,
  MonsterArmorResponse,
  MonsterAttackResponse,
  MonsterDetailResponse,
  MonsterPowerResponse,
  MonsterWeaknessResponse,
} from '../../../../core/models';
import type {
  ArmorDraft,
  AttackDraft,
  CustomMoveDraft,
  MinionDraft,
  MonsterDraft,
  PowerDraft,
  WeaknessDraft,
} from './mystery-create.store';
import { createDraftKey } from './mystery-create.store';

/**
 * Everything the wizard needs to hold a monster that already exists on the server: a complete
 * `MonsterDraft` — fields, four sub-resource drafts, the baselines those drafts were built from,
 * and the ids of its persisted minions — plus the minion drafts that travel with it (decision 13).
 *
 * **Both callers commit this atomically or not at all** (§6.6, J6): edit-mode load and attach. A
 * caller that took the monster and dropped the minions would produce exactly the half-hydrated
 * roster row the invariant exists to forbid.
 */
export interface HydratedMonster {
  /** The roster entry, complete and diffable. Nothing enters the roster that is not one of these. */
  monster: MonsterDraft;
  /** Its minions, already pointed at `monster.localKey`. They join the flat `minionDrafts()` roster. */
  minions: MinionDraft[];
}

/**
 * **The invariant, made structural** (§5.2, §6.6).
 *
 * Every draft below takes its `id` from the very response object that also becomes the baseline
 * row. There is no ordering to get wrong and no second traversal that could drift, because the
 * baseline *is* the array these were mapped from. Both halves of H2 — edit-mode load and the
 * post-submit refresh — and H3's attach reduce to calling this.
 *
 * Pure, so it can be tested without an HTTP layer and reused by the submit path's writeback.
 */
export function toHydratedMonster(monster: MonsterDetailResponse, minions: MinionDetailResponse[]): HydratedMonster {
  const localKey = createDraftKey('monster');

  return {
    monster: {
      id: monster.id,
      localKey,
      name: monster.name,
      description: monster.description ?? '',
      harmCapacity: monster.harmCapacity,
      monsterTypeId: monster.monsterTypeId,
      monsterArchetypeId: monster.monsterArchetype.id,
      attacks: monster.attacks.map(toAttackDraft),
      powers: monster.powers.map((row) => toNamedDraft(row)),
      weaknesses: monster.weaknesses.map((row) => toNamedDraft(row)),
      armors: monster.armors.map(toArmorDraft),
      customMoves: monster.customMoves.map((move) => toNamedDraft(move, 'move')),
      existingAttacks: monster.attacks,
      existingPowers: monster.powers,
      existingWeaknesses: monster.weaknesses,
      existingArmors: monster.armors,
      existingCustomMoves: monster.customMoves,
      // J1: the minion baseline is built here, from the same responses the drafts are, and it lives
      // on the draft. Removing the monster therefore forgets it with no separate step.
      existingMinionIds: minions.map((minion) => minion.id),
      // Tolerant of an absent field: this is read only by the removal modal's usage copy, and a
      // whole hydration — which is all-or-nothing (§6.6) — must not fail over it.
      mysteryIds: [...(monster.mysteryIds ?? [])],
    },
    minions: minions.map((minion) => toMinionDraft(minion, localKey)),
  };
}

/** The same construction one level down. H1: the minion path was never the safe model. */
export function toMinionDraft(minion: MinionDetailResponse, monsterKey: string): MinionDraft {
  return {
    id: minion.id,
    localKey: createDraftKey('minion'),
    monsterKey,
    // J2: the server's parent, recorded in the same step as the id and the four sub-resource
    // baselines. `monsterKey` is where it points now; this is where the server still has it.
    existingMonsterId: minion.monsterId,
    name: minion.name,
    description: minion.description ?? '',
    harmCapacity: minion.harmCapacity,
    minionTypeId: minion.minionType.id,
    attacks: minion.attacks.map(toAttackDraft),
    powers: minion.powers.map((row) => toNamedDraft(row)),
    weaknesses: minion.weaknesses.map((row) => toNamedDraft(row)),
    armors: minion.armors.map(toArmorDraft),
    customMoves: minion.customMoves.map((move) => toNamedDraft(move, 'move')),
    existingAttacks: minion.attacks,
    existingPowers: minion.powers,
    existingWeaknesses: minion.weaknesses,
    existingArmors: minion.armors,
    existingCustomMoves: minion.customMoves,
  };
}

function toAttackDraft(attack: MonsterAttackResponse | MinionAttackResponse): AttackDraft {
  return {
    id: attack.id,
    localKey: createDraftKey('attack'),
    name: attack.name,
    harm: attack.harm,
    description: attack.description ?? '',
    weaponTagIds: attack.weaponTags.map((tag) => tag.id),
  };
}

/**
 * **Call this in an arrow, never bare in `.map()`.** The second parameter is why: `.map(toNamedDraft)`
 * hands the array index to `prefix`, so every key would be minted `0-1`, `1-2`… §26.2 L7 called the
 * prefix "one line, no behaviour change to the four existing callers" — it is one line *plus four
 * arrows*, and TypeScript is what said so (`number` is not assignable to `string`). A widened or
 * untyped parameter would have compiled and silently re-keyed every hydrated row.
 *
 * One `{ id, name, description }` response as a draft — powers, weaknesses and now custom moves.
 *
 * **`CustomMoveResponse` had to be added to the union** (§26.2 L7): it is structurally identical to
 * the other four and still not a member, so passing one was a compile error until this line changed.
 * The good kind of friction — the compiler is what asked.
 *
 * **The prefix is a parameter rather than the hardcoded `'trait'`.** No behaviour change for the
 * four existing callers, which keep the default. It matters when a roster assertion fails and prints
 * these keys: five collections sharing one prefix is what makes such a failure unreadable.
 */
function toNamedDraft(
  row:
    | MonsterPowerResponse
    | MinionPowerResponse
    | MonsterWeaknessResponse
    | MinionWeaknessResponse
    | CustomMoveResponse,
  prefix = 'trait',
): PowerDraft & WeaknessDraft & CustomMoveDraft {
  return {
    id: row.id,
    localKey: createDraftKey(prefix),
    name: row.name,
    description: row.description ?? '',
  };
}

function toArmorDraft(armor: MonsterArmorResponse | MinionArmorResponse): ArmorDraft {
  return {
    id: armor.id,
    localKey: createDraftKey('armor'),
    name: armor.name,
    description: armor.description ?? '',
    harmSoak: armor.harmSoak,
    isSpecial: armor.isSpecial,
    specialDescription: armor.specialDescription ?? '',
  };
}

/**
 * Re-keys a saved collection back onto its drafts, preserving each draft's `localKey`.
 *
 * Used by the submit path's writeback: the diff returns the server's view of every surviving row,
 * and the drafts must pick up any newly-minted ids **without** losing the identity the template is
 * tracking. Position is safe here because `applySubResourceDiff` returns its results in draft
 * order, by construction.
 */
export function rekeyDrafts<TDraft extends { id: string | null; localKey: string }, TResponse extends { id: string }>(
  drafts: readonly TDraft[],
  saved: readonly TResponse[],
): TDraft[] {
  return drafts.map((draft, index) => {
    const row = saved[index];
    return row && draft.id !== row.id ? { ...draft, id: row.id } : draft;
  });
}
