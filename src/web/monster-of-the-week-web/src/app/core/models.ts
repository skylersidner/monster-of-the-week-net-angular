export interface TypeRefResponse {
  id: string;
  name: string;
  motivation: string;
}

export interface CreateTypeRefRequest {
  name: string;
  motivation: string;
}

export enum ReferenceTypeTable {
  MonsterTypes = 'monster-types',
  MinionTypes = 'minion-types',
  LocationTypes = 'location-types',
  BystanderTypes = 'bystander-types',
}

export interface WeaponTagRefResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface CustomMoveResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface MysteryListItemResponse {
  id: string;
  name: string;
  concept: string | null;
  hook: string | null;
  monsterCount: number;
  locationCount: number;
  bystanderCount: number;
  createdAt: string;
}

export interface CountdownResponse {
  id: string;
  day: string | null;
  shadows: string | null;
  sunset: string | null;
  dusk: string | null;
  nightfall: string | null;
  midnight: string | null;
}

export interface MysteryDetailResponse {
  id: string;
  name: string;
  concept: string | null;
  hook: string | null;
  overview: string | null;
  notes: string | null;
  countdown: CountdownResponse | null;
  monsterCount: number;
  locationCount: number;
  bystanderCount: number;
  customMoves: CustomMoveResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMysteryRequest {
  name: string;
  concept: string | null;
  hook: string | null;
  overview: string | null;
  notes: string | null;
}

export interface UpsertCountdownRequest {
  day: string | null;
  shadows: string | null;
  sunset: string | null;
  dusk: string | null;
  nightfall: string | null;
  midnight: string | null;
}

export interface MonsterListItemResponse {
  id: string;
  mysteryId: string;
  name: string;
  description: string | null;
  harmCapacity: number;
  monsterTypeId: string | null;
  monsterTypeName: string | null;
  minionTypeId: string | null;
  minionTypeName: string | null;
}

export interface MonsterAttackResponse {
  id: string;
  name: string;
  description: string | null;
  harm: number;
  weaponTags: WeaponTagRefResponse[];
}

export interface MonsterPowerResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface MonsterArmorResponse {
  id: string;
  name: string;
  description: string | null;
  harmSoak: number;
  isMagical: boolean;
}

export interface MonsterWeaknessResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface MonsterDetailResponse {
  id: string;
  mysteryId: string;
  name: string;
  description: string | null;
  harmCapacity: number;
  monsterTypeId: string | null;
  monsterTypeName: string | null;
  minionTypeId: string | null;
  minionTypeName: string | null;
  attacks: MonsterAttackResponse[];
  powers: MonsterPowerResponse[];
  armors: MonsterArmorResponse[];
  weaknesses: MonsterWeaknessResponse[];
  customMoves: CustomMoveResponse[];
}

export interface UpsertMonsterRequest {
  name: string;
  description: string | null;
  harmCapacity: number;
  monsterTypeId: string | null;
  minionTypeId: string | null;
}

export interface UpsertMonsterAttackRequest {
  name: string;
  description: string | null;
  harm: number;
}

export interface AssignWeaponTagRequest {
  weaponTagId: string;
}

export interface UpsertMonsterPowerRequest {
  name: string;
  description: string | null;
}

export interface UpsertMonsterArmorRequest {
  name: string;
  description: string | null;
  harmSoak: number;
  isMagical: boolean;
}

export interface UpsertMonsterWeaknessRequest {
  name: string;
  description: string | null;
}

export interface UpsertCustomMoveRequest {
  name: string;
  description: string | null;
}

export interface LocationListItemResponse {
  id: string;
  mysteryId: string;
  name: string;
  description: string | null;
  locationTypeId: string;
  locationTypeName: string;
}

export interface LocationDetailResponse {
  id: string;
  mysteryId: string;
  name: string;
  description: string | null;
  locationTypeId: string;
  locationTypeName: string;
  locationTypeMotivation: string;
  customMoves: CustomMoveResponse[];
}

export interface UpsertLocationRequest {
  name: string;
  description: string | null;
  locationTypeId: string;
}

export interface BystanderListItemResponse {
  id: string;
  mysteryId: string;
  name: string;
  description: string | null;
  bystanderTypeId: string;
  bystanderTypeName: string;
}

export interface BystanderDetailResponse {
  id: string;
  mysteryId: string;
  name: string;
  description: string | null;
  bystanderTypeId: string;
  bystanderTypeName: string;
  bystanderTypeMotivation: string;
  customMoves: CustomMoveResponse[];
}

export interface UpsertBystanderRequest {
  name: string;
  description: string | null;
  bystanderTypeId: string;
}
