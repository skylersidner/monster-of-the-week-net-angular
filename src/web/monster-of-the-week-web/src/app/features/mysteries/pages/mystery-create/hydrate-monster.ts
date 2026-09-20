import {
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
import type { ArmorDraft, AttackDraft, MinionDraft, PowerDraft, WeaknessDraft } from './mystery-create.store';
import { createDraftKey } from './mystery-create.store';

/**
 * Everything the wizard needs to hold a monster that already exists on the server: the composer's
 * fields, its four sub-resource drafts, the baseline those drafts were built from, and the minions
 * that travel with it (decision 13).
 *
 * 5a fills the monster half into the shipped single-monster signals. 5b turns this into a
 * `MonsterDraft` plus its minions, with no change to how it is built.
 */
export interface HydratedMonster {
  id: string;
  name: string;
  description: string;
  harmCapacity: number;
  monsterTypeId: string;
  monsterArchetypeId: string;
  attacks: AttackDraft[];
  powers: PowerDraft[];
  weaknesses: WeaknessDraft[];
  armors: ArmorDraft[];
  existingAttacks: MonsterAttackResponse[];
  existingPowers: MonsterPowerResponse[];
  existingWeaknesses: MonsterWeaknessResponse[];
  existingArmors: MonsterArmorResponse[];
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
  return {
    id: monster.id,
    name: monster.name,
    description: monster.description ?? '',
    harmCapacity: monster.harmCapacity,
    monsterTypeId: monster.monsterTypeId,
    monsterArchetypeId: monster.monsterArchetype.id,
    attacks: monster.attacks.map(toAttackDraft),
    powers: monster.powers.map(toNamedDraft),
    weaknesses: monster.weaknesses.map(toNamedDraft),
    armors: monster.armors.map(toArmorDraft),
    existingAttacks: monster.attacks,
    existingPowers: monster.powers,
    existingWeaknesses: monster.weaknesses,
    existingArmors: monster.armors,
    minions: minions.map(toMinionDraft),
  };
}

/** The same construction one level down. H1: the minion path was never the safe model. */
export function toMinionDraft(minion: MinionDetailResponse): MinionDraft {
  return {
    id: minion.id,
    localKey: createDraftKey('minion'),
    name: minion.name,
    description: minion.description ?? '',
    harmCapacity: minion.harmCapacity,
    minionTypeId: minion.minionType.id,
    attacks: minion.attacks.map(toAttackDraft),
    powers: minion.powers.map(toNamedDraft),
    weaknesses: minion.weaknesses.map(toNamedDraft),
    armors: minion.armors.map(toArmorDraft),
    existingAttacks: minion.attacks,
    existingPowers: minion.powers,
    existingWeaknesses: minion.weaknesses,
    existingArmors: minion.armors,
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

function toNamedDraft(
  row: MonsterPowerResponse | MinionPowerResponse | MonsterWeaknessResponse | MinionWeaknessResponse,
): PowerDraft & WeaknessDraft {
  return {
    id: row.id,
    localKey: createDraftKey('trait'),
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
