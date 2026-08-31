/**
 * The signed-in user, as returned by POST /api/auth/login and GET /api/auth/me.
 *
 * Email is the sole login identifier — there is no username concept at any layer
 * (docs/simple-authentication-update/phases.md decision #4). No roles in this pass.
 */
export interface CurrentUser {
  id: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TypeRefResponse {
  id: string;
  name: string;
  motivation: string;
}

export interface CreateTypeRefRequest {
  name: string;
  motivation: string;
}

export interface CreateWeaponTagRequest {
  name: string;
  description: string;
}

export interface CreateAdventureTypeRequest {
  name: string;
  description: string;
}

export interface CreateMonsterArchetypeRequest {
  name: string;
  description: string;
}

export enum ReferenceTypeTable {
  MonsterTypes = 'monster-types',
  MinionTypes = 'minion-types',
  LocationTypes = 'location-types',
  BystanderTypes = 'bystander-types',
  AdventureTypes = 'adventure-types',
  MonsterArchetypes = 'monster-archetypes',
  WeaponTags = 'weapon-tags',
}

/**
 * The reference tables whose rows are Name + Description. All three are managed by the
 * single `app-name-description-admin` component in Data Admin; the only per-table
 * differences are wording and the Description minimum length (weapon tags require 10
 * characters server-side, adventure types and monster archetypes require 5).
 */
export type NameDescriptionTable =
  | ReferenceTypeTable.WeaponTags
  | ReferenceTypeTable.AdventureTypes
  | ReferenceTypeTable.MonsterArchetypes;

/** The reference tables whose rows are Name + Motivation (`TypeRefResponse`). */
export type TypeRefTable = Exclude<ReferenceTypeTable, NameDescriptionTable>;

/**
 * Read shape common to every `NameDescriptionTable`. `description` is nullable only
 * because `WeaponTagRefResponse.description` is; adventure types and monster archetypes
 * always carry a value.
 */
export interface NameDescriptionRefResponse {
  id: string;
  name: string;
  description: string | null;
}

/** Write shape common to every `NameDescriptionTable`. */
export interface CreateNameDescriptionRequest {
  name: string;
  description: string;
}

export interface WeaponTagRefResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface AdventureTypeResponse {
  id: string;
  name: string;
  description: string;
}

export interface MonsterArchetypeResponse {
  id: string;
  name: string;
  description: string;
}

export interface CustomMoveResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface SearchResultItem {
  entityType: string;
  id: string;
  name: string;
  matchedField: string;
}

export interface SearchMatchSpan {
  start: number;
  length: number;
}

export interface SearchResultDetailItem extends SearchResultItem {
  excerpt: string;
  snippet: string | null;
  matchSpans: SearchMatchSpan[];
  matchedSubResourceName: string | null;
}

export interface PagedSearchResult {
  items: SearchResultDetailItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface MysteryListItemResponse {
  id: string;
  name: string;
  concept: string | null;
  hook: string | null;
  adventureType: AdventureTypeResponse;
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
  adventureType: AdventureTypeResponse;
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
  adventureTypeId: string;
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
  mysteryIds: string[];
  name: string;
  description: string | null;
  harmCapacity: number;
  monsterType: TypeRefResponse;
  monsterArchetype: MonsterArchetypeResponse;
  attackCount: number;
  powerCount: number;
  armorCount: number;
  weaknessCount: number;
  minionCount: number;
  createdAt: string;
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
  isSpecial: boolean;
  specialDescription?: string | null;
}

export interface MonsterWeaknessResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface MonsterDetailResponse {
  id: string;
  mysteryIds: string[];
  name: string;
  description: string | null;
  harmCapacity: number;
  monsterTypeId: string;
  monsterTypeName: string | null;
  monsterArchetype: MonsterArchetypeResponse;
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
  monsterTypeId: string;
  monsterArchetypeId: string;
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
  isSpecial: boolean;
  specialDescription: string | null;
}

export interface UpsertMonsterWeaknessRequest {
  name: string;
  description: string | null;
}

export interface UpsertCustomMoveRequest {
  name: string;
  description: string | null;
}

export interface MinionListItemResponse {
  id: string;
  monsterId: string;
  monsterName: string;
  name: string;
  description: string | null;
  harmCapacity: number;
  minionType: TypeRefResponse;
  attackCount: number;
  powerCount: number;
  armorCount: number;
  weaknessCount: number;
  createdAt: string;
}

export interface MinionAttackResponse {
  id: string;
  name: string;
  description: string | null;
  harm: number;
  weaponTags: WeaponTagRefResponse[];
}

export interface MinionPowerResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface MinionArmorResponse {
  id: string;
  name: string;
  description: string | null;
  harmSoak: number;
  isSpecial: boolean;
  specialDescription: string | null;
}

export interface MinionWeaknessResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface MinionDetailResponse {
  id: string;
  monsterId: string;
  monsterName: string;
  name: string;
  description: string | null;
  harmCapacity: number;
  minionType: TypeRefResponse;
  attacks: MinionAttackResponse[];
  powers: MinionPowerResponse[];
  armors: MinionArmorResponse[];
  weaknesses: MinionWeaknessResponse[];
  customMoves: CustomMoveResponse[];
}

export interface UpsertMinionRequest {
  name: string;
  description: string | null;
  harmCapacity: number;
  minionTypeId: string;
}

export interface UpsertMinionAttackRequest {
  name: string;
  description: string | null;
  harm: number;
}

export interface UpsertMinionPowerRequest {
  name: string;
  description: string | null;
}

export interface UpsertMinionArmorRequest {
  name: string;
  description: string | null;
  harmSoak: number;
  isSpecial: boolean;
  specialDescription: string | null;
}

export interface UpsertMinionWeaknessRequest {
  name: string;
  description: string | null;
}

export interface LocationListItemResponse {
  id: string;
  mysteryIds: string[];
  name: string;
  description: string | null;
  locationTypeId: string;
  locationTypeName: string;
  locationTypeMotivation: string;
  createdAt: string;
}

export interface LocationDetailResponse {
  id: string;
  mysteryIds: string[];
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
  mysteryIds: string[];
  name: string;
  description: string | null;
  bystanderTypeId: string;
  bystanderTypeName: string;
  bystanderTypeMotivation: string;
  createdAt: string;
}

export interface BystanderDetailResponse {
  id: string;
  mysteryIds: string[];
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

// ---------------------------------------------------------------------------------------
// Hunter Playbooks
//
// Every child *request* carries a nullable `id`, and that nullable is load-bearing rather
// than incidental: the server reconciles a PUT by matching child rows on it (present =
// update that row in place, absent = insert, stored-but-missing = delete). Child ids must
// therefore survive the GET -> form -> PUT round-trip, because a Hunter instance
// live-links to the exact row id it picked. Dropping them would silently re-create every
// child on each save. See docs/hunter-playbooks/architecture.md Section 3.
// ---------------------------------------------------------------------------------------

export interface PlaybookListItemResponse {
  id: string;
  name: string;
  statArrayOptionCount: number;
  moveCount: number;
  bespokeSectionCount: number;
}

export interface PlaybookStatArrayOptionResponse {
  id: string;
  charm: number;
  cool: number;
  sharp: number;
  tough: number;
  weird: number;
  sortOrder: number;
}

export interface PlaybookMoveResponse {
  id: string;
  name: string;
  descriptionText: string | null;
  required: boolean;
  sortOrder: number;
}

export interface PlaybookGearOptionResponse {
  id: string;
  name: string;
  mechanicalText: string | null;
  sortOrder: number;
}

export interface PlaybookGearCategoryResponse {
  id: string;
  label: string;
  pickCount: number | null;
  isOptional: boolean;
  sortOrder: number;
  options: PlaybookGearOptionResponse[];
}

export interface PlaybookLookOptionResponse {
  id: string;
  text: string;
  sortOrder: number;
}

export interface PlaybookLookCategoryResponse {
  id: string;
  allowsFreeform: boolean;
  sortOrder: number;
  options: PlaybookLookOptionResponse[];
}

export interface PlaybookImprovementResponse {
  id: string;
  text: string;
  isAdvanced: boolean;
  sortOrder: number;
}

export interface PlaybookDetailResponse {
  id: string;
  name: string;
  description: string | null;
  luckBoxCount: number;
  luckSpecialText: string | null;
  harmUnstableThreshold: number;
  harmBoxCount: number;
  experienceBoxCount: number;
  moveGrantCount: number;
  gettingStartedText: string | null;
  introductionsText: string | null;
  levelingUpText: string | null;
  historyPromptsText: string | null;
  statArrayOptions: PlaybookStatArrayOptionResponse[];
  moves: PlaybookMoveResponse[];
  gearCategories: PlaybookGearCategoryResponse[];
  lookCategories: PlaybookLookCategoryResponse[];
  improvements: PlaybookImprovementResponse[];
  bespokeSections: BespokeSectionResponse[];
  bespokeJournals: BespokeJournalResponse[];
  extraTracks: PlaybookExtraTrackResponse[];
}

export interface UpsertPlaybookStatArrayOptionRequest {
  id: string | null;
  charm: number;
  cool: number;
  sharp: number;
  tough: number;
  weird: number;
  sortOrder: number;
}

export interface UpsertPlaybookMoveRequest {
  id: string | null;
  name: string;
  descriptionText: string | null;
  required: boolean;
  sortOrder: number;
}

export interface UpsertPlaybookGearOptionRequest {
  id: string | null;
  name: string;
  mechanicalText: string | null;
  sortOrder: number;
}

export interface UpsertPlaybookGearCategoryRequest {
  id: string | null;
  label: string;
  pickCount: number | null;
  isOptional: boolean;
  sortOrder: number;
  options: UpsertPlaybookGearOptionRequest[];
}

export interface UpsertPlaybookLookOptionRequest {
  id: string | null;
  text: string;
  sortOrder: number;
}

export interface UpsertPlaybookLookCategoryRequest {
  id: string | null;
  allowsFreeform: boolean;
  sortOrder: number;
  options: UpsertPlaybookLookOptionRequest[];
}

export interface UpsertPlaybookImprovementRequest {
  id: string | null;
  text: string;
  isAdvanced: boolean;
  sortOrder: number;
}

export interface UpsertPlaybookRequest {
  name: string;
  description: string | null;
  luckBoxCount: number;
  luckSpecialText: string | null;
  harmUnstableThreshold: number;
  harmBoxCount: number;
  experienceBoxCount: number;
  moveGrantCount: number;
  gettingStartedText: string | null;
  introductionsText: string | null;
  levelingUpText: string | null;
  historyPromptsText: string | null;
  statArrayOptions: UpsertPlaybookStatArrayOptionRequest[];
  moves: UpsertPlaybookMoveRequest[];
  gearCategories: UpsertPlaybookGearCategoryRequest[];
  lookCategories: UpsertPlaybookLookCategoryRequest[];
  improvements: UpsertPlaybookImprovementRequest[];
  bespokeSections: UpsertBespokeSectionRequest[];
  bespokeJournals: UpsertBespokeJournalRequest[];
  extraTracks: UpsertPlaybookExtraTrackRequest[];
}

// --- Phase 5: bespoke rulesets ---------------------------------------------------------
// Options are a nested tree on the wire (children), not a flat list plus parent ids — the
// nesting is the model's whole point, and a flat format would make every client rebuild it.

export interface BespokeOptionResponse {
  id: string;
  title: string | null;
  descriptionText: string | null;
  minSelect: number | null;
  maxSelect: number | null;
  numericMin: number | null;
  numericMax: number | null;
  sortOrder: number;
  children: BespokeOptionResponse[];
}

export interface BespokeSectionResponse {
  id: string;
  title: string;
  description: string | null;
  effectText: string | null;
  freeTextLabel: string | null;
  minSelect: number | null;
  maxSelect: number | null;
  minInstances: number | null;
  maxInstances: number | null;
  sortOrder: number;
  options: BespokeOptionResponse[];
}

export interface BespokeJournalFieldResponse {
  id: string;
  label: string;
  sortOrder: number;
}

export interface BespokeJournalResponse {
  id: string;
  title: string;
  description: string | null;
  effectText: string | null;
  sortOrder: number;
  fields: BespokeJournalFieldResponse[];
}

export interface PlaybookExtraTrackResponse {
  id: string;
  name: string;
  description: string;
  effectText: string | null;
  boxCount: number;
  startLabel: string | null;
  endLabel: string;
  sortOrder: number;
}

export interface UpsertBespokeOptionRequest {
  id: string | null;
  title: string | null;
  descriptionText: string | null;
  minSelect: number | null;
  maxSelect: number | null;
  numericMin: number | null;
  numericMax: number | null;
  sortOrder: number;
  children: UpsertBespokeOptionRequest[];
}

export interface UpsertBespokeSectionRequest {
  id: string | null;
  title: string;
  description: string | null;
  effectText: string | null;
  freeTextLabel: string | null;
  minSelect: number | null;
  maxSelect: number | null;
  minInstances: number | null;
  maxInstances: number | null;
  sortOrder: number;
  options: UpsertBespokeOptionRequest[];
}

export interface UpsertBespokeJournalFieldRequest {
  id: string | null;
  label: string;
  sortOrder: number;
}

export interface UpsertBespokeJournalRequest {
  id: string | null;
  title: string;
  description: string | null;
  effectText: string | null;
  sortOrder: number;
  fields: UpsertBespokeJournalFieldRequest[];
}

export interface UpsertPlaybookExtraTrackRequest {
  id: string | null;
  name: string;
  description: string;
  effectText: string | null;
  boxCount: number;
  startLabel: string | null;
  endLabel: string;
  sortOrder: number;
}
