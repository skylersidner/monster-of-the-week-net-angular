import { DestroyRef, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, forkJoin, map, of, startWith, switchMap, tap } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { LocationService } from '../../../../core/location';
import {
  AdventureTypeResponse,
  MinionArmorResponse,
  MinionAttackResponse,
  MinionDetailResponse,
  MinionPowerResponse,
  MinionWeaknessResponse,
  MonsterArchetypeResponse,
  MonsterArmorResponse,
  MonsterAttackResponse,
  MonsterPowerResponse,
  MonsterWeaknessResponse,
  TypeRefResponse,
  UpsertBystanderRequest,
  UpsertCountdownRequest,
  UpsertLocationRequest,
  UpsertMinionRequest,
  UpsertMonsterRequest,
  UpsertMysteryRequest,
  WeaponTagRefResponse,
} from '../../../../core/models';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import type { MysterySectionIconKind } from '../../shared/mystery-section-icon';

export interface AttackDraft {
  name: string;
  harm: number;
  description: string;
  weaponTagIds: string[];
}

export interface PowerDraft {
  name: string;
  description: string;
}

export interface WeaknessDraft {
  name: string;
  description: string;
}

export interface ArmorDraft {
  name: string;
  description: string;
  harmSoak: number;
  isSpecial: boolean;
  specialDescription: string;
}

export interface LocationDraft {
  /** `null` until this draft has been saved at least once in this session (or hydrated from an existing mystery). */
  id: string | null;
  name: string;
  description: string;
  locationTypeId: string;
}

export interface BystanderDraft {
  /** `null` until this draft has been saved at least once in this session (or hydrated from an existing mystery). */
  id: string | null;
  name: string;
  description: string;
  bystanderTypeId: string;
}

/**
 * The wizard's minion harm-capacity default. Single-sourced because `composerDirty()` treats
 * "harm capacity is no longer the default" as evidence the user started a minion — see §1.3 of
 * `docs/updates/multi-minion-support.md`. It deliberately differs from `MinionFormComponent`'s 0.
 */
export const MINION_DEFAULT_HARM_CAPACITY = 3;

/** Error-band copy when the open composer holds work that cannot be committed yet (Rosalina §1.4). */
const COMPOSER_BLOCKED_MESSAGE = "Finish or clear the minion you're editing before continuing.";

/**
 * One minion under the wizard's monster. Unlike `LocationDraft`/`BystanderDraft` — flat leaf
 * entities where `id` was the whole story — a minion owns four sub-resource collections, so each
 * draft carries its own collections *and* its own existing-sub-resource-ID baseline: `submitPhase1`
 * runs an independent delete-all/recreate-all cycle per minion, not one shared cycle across all of them.
 */
export interface MinionDraft {
  /** `null` until this draft has been saved at least once in this session (or hydrated from an existing mystery). */
  id: string | null;
  name: string;
  description: string;
  harmCapacity: number;
  minionTypeId: string;
  attacks: AttackDraft[];
  powers: PowerDraft[];
  weaknesses: WeaknessDraft[];
  armors: ArmorDraft[];
  existingAttackIds: string[];
  existingPowerIds: string[];
  existingWeaknessIds: string[];
  existingArmorIds: string[];
}

export interface MysteryCreateDraftState {
  navigation: {
    currentPhase: number;
    currentStep: number;
    phaseComplete: boolean[];
    mysteryId: string | null;
  };
  forms: {
    concept: { name: string; concept: string | null };
    hook: { hook: string | null };
    overview: { overview: string | null };
    countdown: {
      day: string | null;
      shadows: string | null;
      sunset: string | null;
      dusk: string | null;
      nightfall: string | null;
      midnight: string | null;
    };
    monster: {
      name: string;
      description: string | null;
      harmCapacity: number;
      monsterTypeId: string;
      monsterArchetypeId: string;
    };
    minion: {
      name: string;
      description: string | null;
      harmCapacity: number;
      minionTypeId: string;
    };
    location: {
      name: string;
      description: string | null;
      locationTypeId: string;
    };
    bystander: {
      name: string;
      description: string | null;
      bystanderTypeId: string;
    };
  };
  collections: {
    monsterAttacks: AttackDraft[];
    monsterPowers: PowerDraft[];
    monsterWeaknesses: WeaknessDraft[];
    monsterArmors: ArmorDraft[];
    minionAttacks: AttackDraft[];
    minionPowers: PowerDraft[];
    minionWeaknesses: WeaknessDraft[];
    minionArmors: ArmorDraft[];
    locations: LocationDraft[];
    bystanders: BystanderDraft[];
    minionDrafts: MinionDraft[];
  };
  /**
   * Where the minion composer is pointed. `forms.minion` + `collections.minionAttacks`/etc. are the
   * composer's *contents*; these two are its position, and neither is derivable from the other.
   */
  composer: {
    open: boolean;
    editingDraftIndex: number | null;
  };
}

interface SavedThreatCollections {
  attacks: MonsterAttackResponse[];
  powers: MonsterPowerResponse[];
  weaknesses: MonsterWeaknessResponse[];
  armors: MonsterArmorResponse[];
}

interface SavedMinionCollections {
  attacks: MinionAttackResponse[];
  powers: MinionPowerResponse[];
  weaknesses: MinionWeaknessResponse[];
  armors: MinionArmorResponse[];
}

interface PhaseDefinition {
  index: number;
  name: string;
  icon: MysterySectionIconKind;
  steps: number;
  stepsArray: readonly number[];
}

type AttackFormGroup = FormGroup<{
  name: FormControl<string>;
  harm: FormControl<number>;
  description: FormControl<string | null>;
  weaponTagIds: FormControl<string[]>;
}>;

type NamedDraftFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string | null>;
}>;

type LocationFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string | null>;
  locationTypeId: FormControl<string>;
}>;

type BystanderFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string | null>;
  bystanderTypeId: FormControl<string>;
}>;

type ArmorFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string | null>;
  harmSoak: FormControl<number>;
  isSpecial: FormControl<boolean>;
  specialDescription: FormControl<string | null>;
}>;

@Injectable()
export class MysteryCreateStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly mysteryService = inject(MysteryService);
  private readonly monsterService = inject(MonsterService);
  private readonly minionService = inject(MinionService);
  private readonly locationService = inject(LocationService);
  private readonly bystanderService = inject(BystanderService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly notificationService = inject(NotificationService);

  private initialized = false;

  readonly phases: readonly PhaseDefinition[] = [
    { index: 0, name: 'Mystery', icon: 'mystery', steps: 4, stepsArray: [0, 1, 2, 3] },
    { index: 1, name: 'Monsters', icon: 'monster', steps: 2, stepsArray: [0, 1] },
    { index: 2, name: 'Locations', icon: 'locations', steps: 1, stepsArray: [0] },
    { index: 3, name: 'Bystanders', icon: 'bystanders', steps: 1, stepsArray: [0] },
  ];
  readonly lastPhaseIndex = this.phases.length - 1;

  readonly currentPhase = signal(0);
  readonly currentStep = signal(0);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly mysteryId = signal<string | null>(null);
  readonly phaseComplete = signal([false, false, false, false]);

  readonly monsterTypes = signal<TypeRefResponse[]>([]);
  readonly monsterArchetypes = signal<MonsterArchetypeResponse[]>([]);
  readonly minionTypes = signal<TypeRefResponse[]>([]);
  readonly locationTypes = signal<TypeRefResponse[]>([]);
  readonly bystanderTypes = signal<TypeRefResponse[]>([]);
  readonly weaponTags = signal<WeaponTagRefResponse[]>([]);
  readonly adventureTypes = signal<AdventureTypeResponse[]>([]);

  readonly monsterAttacks = signal<AttackDraft[]>([]);
  readonly monsterPowers = signal<PowerDraft[]>([]);
  readonly monsterWeaknesses = signal<WeaknessDraft[]>([]);
  readonly monsterArmors = signal<ArmorDraft[]>([]);
  readonly minionAttacks = signal<AttackDraft[]>([]);
  readonly minionPowers = signal<PowerDraft[]>([]);
  readonly minionWeaknesses = signal<WeaknessDraft[]>([]);
  readonly minionArmors = signal<ArmorDraft[]>([]);
  readonly locations = signal<LocationDraft[]>([]);
  readonly bystanders = signal<BystanderDraft[]>([]);

  readonly isEditMode = signal(false);
  readonly editingMonsterId = signal<string | null>(null);

  /** The roster. One entry per minion under the wizard's monster, in creation order (no reordering). */
  readonly minionDrafts = signal<MinionDraft[]>([]);
  /** Index into `minionDrafts()` the composer is editing, or `null` when composing a brand-new minion. */
  readonly editingDraftIndex = signal<number | null>(null);
  /**
   * Whether the composer panel is rendered. This is NOT derivable from `editingDraftIndex`: "roster
   * non-empty, nothing being edited, collapsed" and "roster non-empty, user clicked + Add Another
   * Minion" both have `editingDraftIndex() === null`. Nor from "the composer is non-empty" — that
   * would collapse the panel the user just opened. Invariant: `editingDraftIndex() !== null` implies
   * `composerOpen()`; every method that writes one writes the other.
   */
  readonly composerOpen = signal(true);
  private readonly existingMonsterAttackIds = signal<string[]>([]);
  private readonly existingMonsterPowerIds = signal<string[]>([]);
  private readonly existingMonsterWeaknessIds = signal<string[]>([]);
  private readonly existingMonsterArmorIds = signal<string[]>([]);
  /** Minion IDs on the server as of the last phase-1 save; anything missing from `minionDrafts()` gets hard-deleted. */
  private readonly existingMinionIds = signal<string[]>([]);
  private readonly existingLocationIds = signal<string[]>([]);
  private readonly existingBystanderIds = signal<string[]>([]);

  readonly conceptForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(1)]),
    concept: this.fb.control(''),
    adventureTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly hookForm = this.fb.group({
    hook: this.fb.control(''),
  });

  readonly overviewForm = this.fb.group({
    overview: this.fb.control(''),
  });

  readonly countdownForm = this.fb.group({
    day: this.fb.control(''),
    shadows: this.fb.control(''),
    sunset: this.fb.control(''),
    dusk: this.fb.control(''),
    nightfall: this.fb.control(''),
    midnight: this.fb.control(''),
  });

  readonly monsterForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    harmCapacity: this.fb.nonNullable.control(7, [Validators.required, Validators.min(0)]),
    monsterTypeId: this.fb.nonNullable.control('', [Validators.required]),
    monsterArchetypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly minionForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    harmCapacity: this.fb.nonNullable.control(MINION_DEFAULT_HARM_CAPACITY, [Validators.required, Validators.min(0)]),
    minionTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly monsterAttackForm: AttackFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    harm: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    description: this.fb.control(''),
    weaponTagIds: this.fb.nonNullable.control<string[]>([]),
  });

  readonly monsterPowerForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly monsterWeaknessForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly minionAttackForm: AttackFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    harm: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    description: this.fb.control(''),
    weaponTagIds: this.fb.nonNullable.control<string[]>([]),
  });

  readonly minionPowerForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly minionWeaknessForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly monsterArmorForm: ArmorFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    harmSoak: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    isSpecial: this.fb.nonNullable.control(false),
    specialDescription: this.fb.control(''),
  });

  readonly minionArmorForm: ArmorFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    harmSoak: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    isSpecial: this.fb.nonNullable.control(false),
    specialDescription: this.fb.control(''),
  });

  readonly addLocationForm: LocationFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    locationTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly addBystanderForm: BystanderFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    bystanderTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  private readonly conceptValue = toSignal(this.conceptForm.valueChanges.pipe(startWith(this.conceptForm.getRawValue())));
  private readonly hookValue = toSignal(this.hookForm.valueChanges.pipe(startWith(this.hookForm.getRawValue())));
  private readonly overviewValue = toSignal(this.overviewForm.valueChanges.pipe(startWith(this.overviewForm.getRawValue())));
  private readonly countdownValue = toSignal(
    this.countdownForm.valueChanges.pipe(startWith(this.countdownForm.getRawValue()))
  );
  private readonly monsterValue = toSignal(this.monsterForm.valueChanges.pipe(startWith(this.monsterForm.getRawValue())));
  private readonly minionValue = toSignal(this.minionForm.valueChanges.pipe(startWith(this.minionForm.getRawValue())));

  private readonly monsterAttackTagIds = toSignal(
    this.monsterAttackForm.controls.weaponTagIds.valueChanges.pipe(
      startWith(this.monsterAttackForm.controls.weaponTagIds.value)
    )
  );
  readonly selectedMonsterAttackTags = computed(() =>
    (this.monsterAttackTagIds() ?? [])
      .map((id) => this.weaponTags().find((t) => t.id === id))
      .filter((t): t is WeaponTagRefResponse => t !== undefined)
  );

  private readonly minionAttackTagIds = toSignal(
    this.minionAttackForm.controls.weaponTagIds.valueChanges.pipe(
      startWith(this.minionAttackForm.controls.weaponTagIds.value)
    )
  );
  readonly selectedMinionAttackTags = computed(() =>
    (this.minionAttackTagIds() ?? [])
      .map((id) => this.weaponTags().find((t) => t.id === id))
      .filter((t): t is WeaponTagRefResponse => t !== undefined)
  );

  readonly mysteryPreview = computed(() => ({
    name: this.conceptValue()?.name ?? '',
    concept: this.conceptValue()?.concept ?? '',
    adventureTypeName: this.adventureTypes().find((t) => t.id === (this.conceptValue()?.adventureTypeId ?? ''))?.name ?? '',
    hook: this.hookValue()?.hook ?? '',
    overview: this.overviewValue()?.overview ?? '',
    countdown: this.countdownValue(),
  }));

  readonly phaseStepComplete = computed<boolean[][]>(() => {
    const preview = this.mysteryPreview();
    const hasAnyCountdown = Object.values(preview.countdown ?? {}).some(
      (v) => typeof v === 'string' && v.trim().length > 0
    );

    return [
      // Phase 0 — Mystery (concept, hook, overview, countdown)
      [
        preview.name.trim().length > 0 && (this.conceptValue()?.adventureTypeId ?? '').length > 0,
        (preview.hook ?? '').trim().length > 0,
        (preview.overview ?? '').trim().length > 0,
        hasAnyCountdown,
      ],
      // Phase 1 — Monsters (monster, minion)
      [
        (this.monsterPreview()?.name ?? '').trim().length > 0 && (this.monsterValue()?.monsterArchetypeId ?? '').length > 0,
        // Lights when any minion is on the roster. Reads minionDrafts(), never the composer: an
        // uncommitted composer would flicker the dot on the first keystroke and drop it again on Next.
        // The step stays optional — an empty roster still advances.
        this.minionDrafts().length > 0,
      ],
      // Phase 2 — Locations
      [this.locations().length > 0],
      // Phase 3 — Bystanders
      [this.bystanders().length > 0],
    ];
  });

  readonly monsterPreview = computed(() => {
    const typeId = this.monsterValue()?.monsterTypeId ?? '';
    const type = this.monsterTypes().find((item) => item.id === typeId);
    const archetypeId = this.monsterValue()?.monsterArchetypeId ?? '';
    const archetype = this.monsterArchetypes().find((a) => a.id === archetypeId);
    return {
      name: this.monsterValue()?.name ?? '',
      description: this.monsterValue()?.description ?? '',
      harmCapacity: this.monsterValue()?.harmCapacity ?? 7,
      typeName: type?.name ?? '',
      archetypeName: archetype?.name ?? '',
      attacks: this.monsterAttacks(),
      powers: this.monsterPowers(),
      weaknesses: this.monsterWeaknesses(),
      armors: this.monsterArmors(),
    };
  });

  readonly currentSectionIcon = computed<MysterySectionIconKind>(() => {
    const phase = this.currentPhase();
    const step = this.currentStep();

    if (phase === 0 && step === 3) {
      return 'countdown';
    }

    if (phase === 1 && step === 1) {
      return 'minions';
    }

    return this.phases[phase]?.icon ?? 'mystery';
  });

  readonly minionPreview = computed(() => {
    const typeId = this.minionValue()?.minionTypeId ?? '';
    const type = this.minionTypes().find((item) => item.id === typeId);
    return {
      name: this.minionValue()?.name ?? '',
      description: this.minionValue()?.description ?? '',
      harmCapacity: this.minionValue()?.harmCapacity ?? MINION_DEFAULT_HARM_CAPACITY,
      typeName: type?.name ?? '',
      attacks: this.minionAttacks(),
      powers: this.minionPowers(),
      weaknesses: this.minionWeaknesses(),
      armors: this.minionArmors(),
    };
  });

  /**
   * True once there is anything in the composer worth blocking `Next` over. Deliberately wider than
   * the `minionSectionStarted()` it replaces (§1.3, approved by Skyler 2026-09-01):
   *
   * - it includes **Name**, because the old computed's job was "is Name required?" and a name cannot
   *   make itself required — under the draft-list model a name-only composer is simply not in
   *   `minionDrafts()`, so `submitPhase1` would never see it and the typed name would vanish silently;
   * - it includes the **four sub-resource signals**, so a composer holding two attacks and no name
   *   blocks instead of discarding both;
   * - it includes `harmCapacity !== MINION_DEFAULT_HARM_CAPACITY`. Accepted consequence: nudging harm
   *   capacity alone marks the composer dirty and blocks `Next` until Name and Type are supplied.
   */
  readonly composerDirty = computed(() => {
    const value = this.minionValue();
    if (!value) {
      return false;
    }

    return (
      (value.name ?? '').trim().length > 0 ||
      (value.description ?? '').trim().length > 0 ||
      (value.minionTypeId ?? '').length > 0 ||
      (value.harmCapacity ?? MINION_DEFAULT_HARM_CAPACITY) !== MINION_DEFAULT_HARM_CAPACITY ||
      this.minionAttacks().length > 0 ||
      this.minionPowers().length > 0 ||
      this.minionWeaknesses().length > 0 ||
      this.minionArmors().length > 0
    );
  });

  /** The two fields a minion cannot be saved without. Harm capacity carries its own control validators. */
  readonly composerValid = computed(() => {
    const value = this.minionValue();
    if (!value) {
      return false;
    }

    return (value.name ?? '').trim().length > 0 && (value.minionTypeId ?? '').length > 0;
  });

  readonly stepTitle = computed(() => {
    const phase = this.currentPhase();
    const step = this.currentStep();
    const titles: Record<string, string> = {
      '0-0': "What's the Core Idea?",
      '0-1': 'How Do the Hunters Get Involved?',
      '0-2': "What's Really Happening?",
      '0-3': "What Happens If the Hunters Don't Intervene?",
      '1-0': 'What Is the Threat?',
      '1-1': 'Who or What Serves the Monster?',
      '2-0': 'Where Does the Mystery Unfold?',
      '3-0': 'Who Else Is Caught Up in This?',
    };
    return titles[`${phase}-${step}`] ?? '';
  });

  readonly stepBlurb = computed(() => {
    const phase = this.currentPhase();
    const step = this.currentStep();
    const blurbs: Record<string, string> = {
      '0-0':
        "Every mystery starts with a concept—the one-sentence pitch that captures what's going wrong. Think of it as your elevator pitch: 'A vengeful ghost is drowning swimmers at the lake' or 'Teenagers are vanishing into a pocket dimension at the mall.' Keep it tight and evocative. This is the seed from which everything else grows.",
      '0-1':
        "The hook is the inciting incident—how this mystery crashes into your hunters' lives. Maybe someone they know goes missing, or strange phenomena make the news, or they're hired by a desperate local. This is the moment that pulls them from the ordinary world into the supernatural threat. Make it personal or urgent enough that walking away isn't an option.",
      '0-2':
        "The overview is your behind-the-scenes explanation—the full truth of what's going on, who's responsible, and why. Your hunters won't know this at the start; they'll piece it together through investigation. But you need the complete picture so you can answer their questions and improvise consistently.",
      '0-3':
        "The countdown is your mystery's doomsday clock—six escalating events that happen if the hunters don't stop it. Each stage represents the threat growing worse, more public, or more deadly. By Midnight, it's catastrophe. Describe what happens at each stage, not when—timing is flexible based on the hunters' actions.",
      '1-0':
        'This is your primary antagonist—the creature, entity, or force causing the mystery. Give it a name, describe what it is and how it manifests, and define its harm capacity. Choose a monster type, and list its attacks, powers, and weaknesses. Make it dangerous but defeatable.',
      '1-1':
        'Minions are lesser threats that support the main monster—cultists, possessed victims, summoned creatures, or loyal servants. Use the same structure as the monster. Minions are optional — you can add as many as you need, or skip this step entirely.',
      '2-0':
        "Locations are the key places where clues, action, and danger converge—the abandoned asylum, the forest clearing, the victim's apartment, the monster's lair. Describe what hunters will find there and what makes it memorable. Most mysteries have 4–6 core locations.",
      '3-0':
        'Bystanders are the NPCs who populate your mystery—victims, witnesses, suspects, allies, or innocents in danger. Some will help the hunters, some will get in the way, and some are in mortal danger. Most mysteries have 5–10 bystanders.',
    };
    return blurbs[`${phase}-${step}`] ?? '';
  });

  readonly canGoBack = computed(() => !(this.currentPhase() === 0 && this.currentStep() === 0));

  readonly draftState = computed<MysteryCreateDraftState>(() => ({
    navigation: {
      currentPhase: this.currentPhase(),
      currentStep: this.currentStep(),
      phaseComplete: [...this.phaseComplete()],
      mysteryId: this.mysteryId(),
    },
    forms: {
      concept: this.conceptForm.getRawValue(),
      hook: this.hookForm.getRawValue(),
      overview: this.overviewForm.getRawValue(),
      countdown: this.countdownForm.getRawValue(),
      monster: this.monsterForm.getRawValue(),
      minion: this.minionForm.getRawValue(),
      location: this.addLocationForm.getRawValue(),
      bystander: this.addBystanderForm.getRawValue(),
    },
    collections: {
      monsterAttacks: [...this.monsterAttacks()],
      monsterPowers: [...this.monsterPowers()],
      monsterWeaknesses: [...this.monsterWeaknesses()],
      monsterArmors: [...this.monsterArmors()],
      minionAttacks: [...this.minionAttacks()],
      minionPowers: [...this.minionPowers()],
      minionWeaknesses: [...this.minionWeaknesses()],
      minionArmors: [...this.minionArmors()],
      locations: [...this.locations()],
      bystanders: [...this.bystanders()],
      minionDrafts: [...this.minionDrafts()],
    },
    composer: {
      open: this.composerOpen(),
      editingDraftIndex: this.editingDraftIndex(),
    },
  }));

  init(mysteryId?: string): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (mysteryId) {
      this.isEditMode.set(true);
      this.mysteryId.set(mysteryId);
      this.phaseComplete.set([true, true, true, true]);
      this.loadEditData(mysteryId);
    } else {
      this.loadReferenceData();
    }
  }

  private loadReferenceData(): void {
    forkJoin({
      adventureTypes: this.referenceDataService.getAdventureTypes(),
      monsterArchetypes: this.referenceDataService.getMonsterArchetypes(),
      monsterTypes: this.referenceDataService.getMonsterTypes(),
      minionTypes: this.referenceDataService.getMinionTypes(),
      locationTypes: this.referenceDataService.getLocationTypes(),
      bystanderTypes: this.referenceDataService.getBystanderTypes(),
      weaponTags: this.referenceDataService.getWeaponTags(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ adventureTypes, monsterArchetypes, monsterTypes, minionTypes, locationTypes, bystanderTypes, weaponTags }) => {
        this.adventureTypes.set(adventureTypes);
        this.monsterArchetypes.set(monsterArchetypes);
        this.monsterTypes.set(monsterTypes);
        this.minionTypes.set(minionTypes);
        this.locationTypes.set(locationTypes);
        this.bystanderTypes.set(bystanderTypes);
        this.weaponTags.set(weaponTags);
      });
  }

  private loadEditData(mysteryId: string): void {
    forkJoin({
      adventureTypes: this.referenceDataService.getAdventureTypes(),
      monsterArchetypes: this.referenceDataService.getMonsterArchetypes(),
      monsterTypes: this.referenceDataService.getMonsterTypes(),
      minionTypes: this.referenceDataService.getMinionTypes(),
      locationTypes: this.referenceDataService.getLocationTypes(),
      bystanderTypes: this.referenceDataService.getBystanderTypes(),
      weaponTags: this.referenceDataService.getWeaponTags(),
      mystery: this.mysteryService.getMystery(mysteryId),
      monsters: this.monsterService.getByMystery(mysteryId),
      locations: this.locationService.getByMystery(mysteryId),
      bystanders: this.bystanderService.getByMystery(mysteryId),
    })
      .pipe(
        switchMap(({ adventureTypes, monsterArchetypes, monsterTypes, minionTypes, locationTypes, bystanderTypes, weaponTags, mystery, monsters, locations, bystanders }) => {
          this.adventureTypes.set(adventureTypes);
          this.monsterArchetypes.set(monsterArchetypes);
          this.monsterTypes.set(monsterTypes);
          this.minionTypes.set(minionTypes);
          this.locationTypes.set(locationTypes);
          this.bystanderTypes.set(bystanderTypes);
          this.weaponTags.set(weaponTags);

          this.conceptForm.patchValue({ name: mystery.name, concept: mystery.concept ?? '', adventureTypeId: mystery.adventureType.id });
          this.hookForm.patchValue({ hook: mystery.hook ?? '' });
          this.overviewForm.patchValue({ overview: mystery.overview ?? '' });
          if (mystery.countdown) {
            this.countdownForm.patchValue({
              day: mystery.countdown.day ?? '',
              shadows: mystery.countdown.shadows ?? '',
              sunset: mystery.countdown.sunset ?? '',
              dusk: mystery.countdown.dusk ?? '',
              nightfall: mystery.countdown.nightfall ?? '',
              midnight: mystery.countdown.midnight ?? '',
            });
          }

          this.existingLocationIds.set(locations.map((l) => l.id));
          this.locations.set(
            locations.map((l) => ({
              id: l.id,
              name: l.name,
              description: l.description ?? '',
              locationTypeId: l.locationTypeId,
            }))
          );

          this.existingBystanderIds.set(bystanders.map((b) => b.id));
          this.bystanders.set(
            bystanders.map((b) => ({
              id: b.id,
              name: b.name,
              description: b.description ?? '',
              bystanderTypeId: b.bystanderTypeId,
            }))
          );

          const pureMonster = monsters[0] ?? null;

          this.phaseComplete.set([
            mystery.name.trim().length > 0,
            pureMonster != null,
            locations.length > 0,
            bystanders.length > 0,
          ]);

          return forkJoin({
            pureMonster: pureMonster ? this.monsterService.getById(pureMonster.id) : of(null),
            minions: pureMonster
              ? this.minionService.getByMonster(pureMonster.id).pipe(
                  switchMap((minions) =>
                    minions.length > 0
                      ? forkJoin(minions.map((minion) => this.minionService.getById(minion.id)))
                      : of<MinionDetailResponse[]>([])
                  )
                )
              : of<MinionDetailResponse[]>([]),
          });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ pureMonster, minions }: { pureMonster: import('../../../../core/models').MonsterDetailResponse | null; minions: MinionDetailResponse[] }) => {
        if (pureMonster) {
          this.editingMonsterId.set(pureMonster.id);
          this.existingMonsterAttackIds.set(pureMonster.attacks.map((a) => a.id));
          this.existingMonsterPowerIds.set(pureMonster.powers.map((p) => p.id));
          this.existingMonsterWeaknessIds.set(pureMonster.weaknesses.map((w) => w.id));
          this.existingMonsterArmorIds.set(pureMonster.armors.map((a) => a.id));
          this.monsterForm.patchValue({
            name: pureMonster.name,
            description: pureMonster.description ?? '',
            harmCapacity: pureMonster.harmCapacity,
            monsterTypeId: pureMonster.monsterTypeId,
            monsterArchetypeId: pureMonster.monsterArchetype.id,
          });
          this.monsterAttacks.set(
            pureMonster.attacks.map((a) => ({
              name: a.name,
              harm: a.harm,
              description: a.description ?? '',
              weaponTagIds: a.weaponTags.map((t) => t.id),
            }))
          );
          this.monsterPowers.set(pureMonster.powers.map((p) => ({ name: p.name, description: p.description ?? '' })));
          this.monsterWeaknesses.set(pureMonster.weaknesses.map((w) => ({ name: w.name, description: w.description ?? '' })));
          this.monsterArmors.set(
            pureMonster.armors.map((a) => ({
              name: a.name,
              description: a.description ?? '',
              harmSoak: a.harmSoak,
              isSpecial: a.isSpecial,
              specialDescription: a.specialDescription ?? '',
            }))
          );
        }

        this.existingMinionIds.set(minions.map((minion) => minion.id));
        this.minionDrafts.set(
          minions.map((minion) => ({
            id: minion.id,
            name: minion.name,
            description: minion.description ?? '',
            harmCapacity: minion.harmCapacity,
            minionTypeId: minion.minionType.id,
            attacks: minion.attacks.map((a) => ({
              name: a.name,
              harm: a.harm,
              description: a.description ?? '',
              weaponTagIds: a.weaponTags.map((t) => t.id),
            })),
            powers: minion.powers.map((power) => ({ name: power.name, description: power.description ?? '' })),
            weaknesses: minion.weaknesses.map((w) => ({ name: w.name, description: w.description ?? '' })),
            armors: minion.armors.map((a) => ({
              name: a.name,
              description: a.description ?? '',
              harmSoak: a.harmSoak,
              isSpecial: a.isSpecial,
              specialDescription: a.specialDescription ?? '',
            })),
            existingAttackIds: minion.attacks.map((a) => a.id),
            existingPowerIds: minion.powers.map((power) => power.id),
            existingWeaknessIds: minion.weaknesses.map((w) => w.id),
            existingArmorIds: minion.armors.map((a) => a.id),
          }))
        );
        // A non-empty loaded roster is "nothing being edited" — composer collapsed (§1.2/§1.7).
        this.editingDraftIndex.set(null);
        this.composerOpen.set(minions.length === 0);
      });
  }

  next(): void {
    if (!this.validateCurrentStep()) {
      return;
    }

    // Rosalina §1.4 / decision #13: an open composer is committed if it can be. This runs here —
    // synchronously, before submitCurrentPhase() — and NOT inside submitPhase1's pipe, so the
    // committed draft is in minionDrafts() by the time submitPhase1 reads it, in the same tick.
    // Burying the mutation inside the rxjs chain would put it after monsterSave$ resolves, in a
    // re-enterable async path — the exact shape of the Bug 2 defect class this file already fixed.
    if (this.currentPhase() === 1 && this.currentStep() === 1 && !this.commitComposerIfValid()) {
      return;
    }

    const phase = this.currentPhase();
    const step = this.currentStep();
    const stepsInPhase = this.phases[phase]?.steps ?? 0;
    if (step < stepsInPhase - 1) {
      this.currentStep.set(step + 1);
      return;
    }

    this.submitCurrentPhase();
  }

  back(): void {
    if (this.currentStep() > 0) {
      this.currentStep.set(this.currentStep() - 1);
      return;
    }

    if (this.currentPhase() > 0) {
      const previousPhase = this.currentPhase() - 1;
      this.currentPhase.set(previousPhase);
      this.currentStep.set(this.phases[previousPhase].steps - 1);
    }
  }

  jumpToPhase(phase: number): void {
    if (!this.isPhaseAccessible(phase)) {
      return;
    }

    this.currentPhase.set(phase);
    this.currentStep.set(0);
  }

  isPhaseAccessible(phase: number): boolean {
    if (this.isEditMode()) {
      return true;
    }
    return phase === this.currentPhase() || this.phaseComplete()[phase] === true;
  }

  addMonsterAttack(): void {
    this.addAttackDraft(this.monsterAttacks, this.monsterAttackForm);
  }

  removeMonsterAttack(index: number): void {
    this.removeDraft(this.monsterAttacks, index);
  }

  addMonsterPower(): void {
    this.addNamedDraft(this.monsterPowers, this.monsterPowerForm);
  }

  removeMonsterPower(index: number): void {
    this.removeDraft(this.monsterPowers, index);
  }

  addMonsterWeakness(): void {
    this.addNamedDraft(this.monsterWeaknesses, this.monsterWeaknessForm);
  }

  removeMonsterWeakness(index: number): void {
    this.removeDraft(this.monsterWeaknesses, index);
  }

  addMinionAttack(): void {
    this.addAttackDraft(this.minionAttacks, this.minionAttackForm);
  }

  removeMinionAttack(index: number): void {
    this.removeDraft(this.minionAttacks, index);
  }

  addMinionPower(): void {
    this.addNamedDraft(this.minionPowers, this.minionPowerForm);
  }

  removeMinionPower(index: number): void {
    this.removeDraft(this.minionPowers, index);
  }

  addMinionWeakness(): void {
    this.addNamedDraft(this.minionWeaknesses, this.minionWeaknessForm);
  }

  removeMinionWeakness(index: number): void {
    this.removeDraft(this.minionWeaknesses, index);
  }

  addMonsterArmor(): void {
    this.addArmorDraft(this.monsterArmors, this.monsterArmorForm);
  }

  removeMonsterArmor(index: number): void {
    this.removeDraft(this.monsterArmors, index);
  }

  addMinionArmor(): void {
    this.addArmorDraft(this.minionArmors, this.minionArmorForm);
  }

  removeMinionArmor(index: number): void {
    this.removeDraft(this.minionArmors, index);
  }

  addLocation(): void {
    if (this.addLocationForm.invalid) {
      this.addLocationForm.markAllAsTouched();
      return;
    }

    this.locations.update((items) => [
      ...items,
      {
        id: null,
        name: this.addLocationForm.controls.name.value.trim(),
        description: this.addLocationForm.controls.description.value ?? '',
        locationTypeId: this.addLocationForm.controls.locationTypeId.value,
      },
    ]);
    this.addLocationForm.reset({ name: '', description: '', locationTypeId: '' });
  }

  removeLocation(index: number): void {
    this.removeDraft(this.locations, index);
  }

  addBystander(): void {
    if (this.addBystanderForm.invalid) {
      this.addBystanderForm.markAllAsTouched();
      return;
    }

    this.bystanders.update((items) => [
      ...items,
      {
        id: null,
        name: this.addBystanderForm.controls.name.value.trim(),
        description: this.addBystanderForm.controls.description.value ?? '',
        bystanderTypeId: this.addBystanderForm.controls.bystanderTypeId.value,
      },
    ]);
    this.addBystanderForm.reset({ name: '', description: '', bystanderTypeId: '' });
  }

  removeBystander(index: number): void {
    this.removeDraft(this.bystanders, index);
  }

  // ---------------------------------------------------------------------------
  // Minion roster + composer (§1.2, §1.4, §1.5 of docs/updates/multi-minion-support.md)
  // ---------------------------------------------------------------------------

  /**
   * Commits whatever is open in the composer, if it can be committed. One primitive, three callers
   * (`next()`, `editMinionDraft()`, `startNewMinionDraft()`), each of which must abort on `false`.
   *
   * @returns `true` when there was nothing to commit or the commit succeeded; `false` when the
   *          composer holds work that cannot be saved yet, in which case the caller must do nothing.
   */
  commitComposerIfValid(): boolean {
    if (!this.composerOpen() || !this.composerDirty()) {
      return true;
    }

    if (!this.composerValid()) {
      // Same message all three callers surface, so the pencil / + Add Another Minion clicks are not
      // silent no-ops — they show the wizard's error band, not just the inline field errors.
      this.minionForm.markAllAsTouched();
      this.submitError.set(COMPOSER_BLOCKED_MESSAGE);
      return false;
    }

    this.saveMinionDraftToList();
    return true;
  }

  /** Commits the composer into the roster — replacing the edited slot, or appending a new minion. */
  saveMinionDraftToList(): void {
    if (!this.composerValid()) {
      this.minionForm.markAllAsTouched();
      return;
    }

    const index = this.editingDraftIndex();
    const existing = index !== null ? this.minionDrafts()[index] ?? null : null;

    const draft: MinionDraft = {
      // Keep the server ID and the sub-resource baselines of the slot being edited: submitPhase1
      // needs them to update rather than duplicate, and to delete the right children first.
      id: existing?.id ?? null,
      name: this.minionForm.controls.name.value.trim(),
      description: this.minionForm.controls.description.value ?? '',
      harmCapacity: this.minionForm.controls.harmCapacity.value,
      minionTypeId: this.minionForm.controls.minionTypeId.value,
      attacks: [...this.minionAttacks()],
      powers: [...this.minionPowers()],
      weaknesses: [...this.minionWeaknesses()],
      armors: [...this.minionArmors()],
      existingAttackIds: existing?.existingAttackIds ?? [],
      existingPowerIds: existing?.existingPowerIds ?? [],
      existingWeaknessIds: existing?.existingWeaknessIds ?? [],
      existingArmorIds: existing?.existingArmorIds ?? [],
    };

    this.minionDrafts.update((drafts) =>
      existing !== null ? drafts.map((item, itemIndex) => (itemIndex === index ? draft : item)) : [...drafts, draft]
    );

    this.resetComposer();
    this.editingDraftIndex.set(null);
    // Invariant: editingDraftIndex() !== null implies composerOpen(). Collapse to
    // "+ Add Another Minion" now that the roster has something in it.
    this.composerOpen.set(this.minionDrafts().length === 0);
    this.submitError.set(null);
  }

  /** Loads a roster card back into the composer — core fields and all four sub-resource lists. */
  editMinionDraft(index: number): void {
    if (!this.commitComposerIfValid()) {
      return;
    }

    // Read the draft *after* the commit: committing may have appended to the roster, which never
    // shifts an existing index, but it can also have rewritten the slot we are about to load.
    const draft = this.minionDrafts()[index];
    if (!draft) {
      return;
    }

    this.resetComposer();
    this.minionForm.patchValue({
      name: draft.name,
      description: draft.description,
      harmCapacity: draft.harmCapacity,
      minionTypeId: draft.minionTypeId,
    });
    this.minionAttacks.set([...draft.attacks]);
    this.minionPowers.set([...draft.powers]);
    this.minionWeaknesses.set([...draft.weaknesses]);
    this.minionArmors.set([...draft.armors]);

    this.editingDraftIndex.set(index);
    this.composerOpen.set(true);
  }

  /** "+ Add Another Minion" — same commit rule as `Next`, then a blank composer. */
  startNewMinionDraft(): void {
    if (!this.commitComposerIfValid()) {
      return;
    }

    this.resetComposer();
    this.editingDraftIndex.set(null);
    this.composerOpen.set(true);
  }

  /** Abandons the composer's contents without touching the roster. */
  cancelComposerEdit(): void {
    this.resetComposer();
    this.editingDraftIndex.set(null);
    this.composerOpen.set(this.minionDrafts().length === 0);
  }

  /**
   * Removes a roster card. The draft's `id` (if any) is NOT deleted here — the real
   * `DELETE /api/minions/{id}` fires in `submitPhase1`'s diff, exactly like location/bystander
   * unlinking. Consequence, recorded rather than rediscovered: removing a previously-saved minion
   * and then abandoning the wizard leaves it on the server.
   */
  removeMinionDraft(index: number): void {
    this.minionDrafts.update((drafts) => drafts.filter((_, itemIndex) => itemIndex !== index));

    // editingDraftIndex is a positional reference into the array we just spliced, and removal is
    // the only index-invalidating mutation (Skyler declined reordering). Leaving it stale is a
    // silent wrong-minion overwrite: the next saveMinionDraftToList() would write the composer's
    // contents over a bystanding draft.
    const editing = this.editingDraftIndex();
    if (editing === null) {
      return;
    }

    if (editing === index) {
      // The thing being edited no longer exists.
      this.resetComposer();
      this.editingDraftIndex.set(null);
      this.composerOpen.set(this.minionDrafts().length === 0);
      return;
    }

    if (editing > index) {
      this.editingDraftIndex.set(editing - 1);
    }
  }

  /** Clears the composer: core fields, the four sub-resource lists, and the four inline add-forms. */
  private resetComposer(): void {
    this.minionForm.reset({
      name: '',
      description: '',
      harmCapacity: MINION_DEFAULT_HARM_CAPACITY,
      minionTypeId: '',
    });
    this.minionAttacks.set([]);
    this.minionPowers.set([]);
    this.minionWeaknesses.set([]);
    this.minionArmors.set([]);
    this.minionAttackForm.reset({ name: '', harm: 0, description: '', weaponTagIds: [] });
    this.minionPowerForm.reset({ name: '', description: '' });
    this.minionWeaknessForm.reset({ name: '', description: '' });
    this.minionArmorForm.reset({ name: '', description: '', harmSoak: 0, isSpecial: false, specialDescription: '' });
  }

  private validateCurrentStep(): boolean {
    const phase = this.currentPhase();
    const step = this.currentStep();

    if (phase === 0 && step === 0 && this.conceptForm.invalid) {
      this.conceptForm.markAllAsTouched();
      return false;
    }

    if (phase === 1 && step === 0 && this.monsterForm.invalid) {
      this.monsterForm.markAllAsTouched();
      return false;
    }

    if (phase === 1 && step === 1) {
      // Three-way classification of the open composer: empty -> proceed; valid -> commit and
      // proceed (see next()); started but invalid -> block, so the work isn't silently discarded.
      if (this.composerOpen() && this.composerDirty() && !this.composerValid()) {
        this.minionForm.markAllAsTouched();
        this.submitError.set(COMPOSER_BLOCKED_MESSAGE);
        return false;
      }

      this.submitError.set(null);
    }

    return true;
  }

  private submitCurrentPhase(): void {
    this.isSubmitting.set(true);
    this.submitError.set(null);

    switch (this.currentPhase()) {
      case 0:
        this.submitPhase0();
        break;
      case 1:
        this.submitPhase1();
        break;
      case 2:
        this.submitPhase2();
        break;
      case 3:
        this.submitPhase3();
        break;
    }
  }

  private submitPhase0(): void {
    const mysteryRequest: UpsertMysteryRequest = {
      name: this.conceptForm.controls.name.value.trim(),
      concept: this.toNullable(this.conceptForm.controls.concept.value),
      hook: this.toNullable(this.hookForm.controls.hook.value),
      overview: this.toNullable(this.overviewForm.controls.overview.value),
      notes: null,
      adventureTypeId: this.conceptForm.controls.adventureTypeId.value,
    };

    const existingId = this.mysteryId();
    const save$ = existingId
      ? this.mysteryService.update(existingId, mysteryRequest)
      : this.mysteryService.create(mysteryRequest);

    save$
      .pipe(
        switchMap((mystery) => {
          this.mysteryId.set(mystery.id);

          const countdownRequest: UpsertCountdownRequest = {
            day: this.toNullable(this.countdownForm.controls.day.value),
            shadows: this.toNullable(this.countdownForm.controls.shadows.value),
            sunset: this.toNullable(this.countdownForm.controls.sunset.value),
            dusk: this.toNullable(this.countdownForm.controls.dusk.value),
            nightfall: this.toNullable(this.countdownForm.controls.nightfall.value),
            midnight: this.toNullable(this.countdownForm.controls.midnight.value),
          };

          return this.mysteryService.upsertCountdown(mystery.id, countdownRequest);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.advancePhase(),
        error: () => this.handleSubmitError('Could not save mystery. Please try again.'),
      });
  }

  private submitPhase1(): void {
    const mysteryId = this.mysteryId();
    if (!mysteryId) {
      this.handleSubmitError('Could not save monster. Please try again.');
      return;
    }

    const editingMonsterId = this.editingMonsterId();
    const monsterRequest: UpsertMonsterRequest = {
      name: this.monsterForm.controls.name.value.trim(),
      description: this.toNullable(this.monsterForm.controls.description.value),
      harmCapacity: this.monsterForm.controls.harmCapacity.value,
      monsterTypeId: this.monsterForm.controls.monsterTypeId.value,
      monsterArchetypeId: this.monsterForm.controls.monsterArchetypeId.value,
    };

    const monsterSave$ = editingMonsterId
      ? this.monsterService.update(editingMonsterId, monsterRequest)
      : this.monsterService.create(mysteryId, monsterRequest);

    monsterSave$
      .pipe(
        switchMap((monster) => {
          this.editingMonsterId.set(monster.id);

          const deleteOps: Observable<void>[] = [
            ...this.existingMonsterAttackIds().map((id) => this.monsterService.deleteAttack(monster.id, id)),
            ...this.existingMonsterPowerIds().map((id) => this.monsterService.deletePower(monster.id, id)),
            ...this.existingMonsterWeaknessIds().map((id) => this.monsterService.deleteWeakness(monster.id, id)),
            ...this.existingMonsterArmorIds().map((id) => this.monsterService.deleteArmor(monster.id, id)),
          ];
          return this.runBatch(deleteOps).pipe(
            switchMap(() =>
              this.saveThreatCollections(
                monster.id,
                this.monsterAttacks(),
                this.monsterPowers(),
                this.monsterWeaknesses(),
                this.monsterArmors()
              )
            ),
            switchMap((saved) => {
              this.existingMonsterAttackIds.set(saved.attacks.map((a) => a.id));
              this.existingMonsterPowerIds.set(saved.powers.map((p) => p.id));
              this.existingMonsterWeaknessIds.set(saved.weaknesses.map((w) => w.id));
              this.existingMonsterArmorIds.set(saved.armors.map((a) => a.id));

              return this.saveMinionDrafts(monster.id);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.advancePhase(),
        error: () => this.handleSubmitError('Could not save monster. Please try again.'),
      });
  }

  private submitPhase2(): void {
    const mysteryId = this.mysteryId();
    if (!mysteryId) {
      this.handleSubmitError('Could not save locations. Please try again.');
      return;
    }

    const drafts = this.locations();
    const toRequest = (draft: LocationDraft): UpsertLocationRequest => ({
      name: draft.name,
      description: this.toNullable(draft.description),
      locationTypeId: draft.locationTypeId,
    });

    forkJoin({
      unlinked: this.runBatch(
        this.idsToRemove(this.existingLocationIds(), drafts).map((locationId) =>
          this.locationService.unlinkFromMystery(mysteryId, locationId)
        )
      ),
      updated: this.runBatch(
        drafts
          .filter((draft): draft is LocationDraft & { id: string } => draft.id !== null)
          .map((draft) => this.locationService.update(draft.id, toRequest(draft)))
      ),
      created: this.runBatch(
        drafts.filter((draft) => draft.id === null).map((draft) => this.locationService.create(mysteryId, toRequest(draft)))
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ created }) => {
          const saved = this.backfillDraftIds(drafts, created);
          this.locations.set(saved);
          this.existingLocationIds.set(this.savedDraftIds(saved));
          this.advancePhase();
        },
        error: () => this.handleSubmitError('Could not save locations. Please try again.'),
      });
  }

  private submitPhase3(): void {
    const mysteryId = this.mysteryId();
    if (!mysteryId) {
      this.handleSubmitError('Could not save bystanders. Please try again.');
      return;
    }

    const drafts = this.bystanders();
    const toRequest = (draft: BystanderDraft): UpsertBystanderRequest => ({
      name: draft.name,
      description: this.toNullable(draft.description),
      bystanderTypeId: draft.bystanderTypeId,
    });

    forkJoin({
      unlinked: this.runBatch(
        this.idsToRemove(this.existingBystanderIds(), drafts).map((bystanderId) =>
          this.bystanderService.unlinkFromMystery(mysteryId, bystanderId)
        )
      ),
      updated: this.runBatch(
        drafts
          .filter((draft): draft is BystanderDraft & { id: string } => draft.id !== null)
          .map((draft) => this.bystanderService.update(draft.id, toRequest(draft)))
      ),
      created: this.runBatch(
        drafts
          .filter((draft) => draft.id === null)
          .map((draft) => this.bystanderService.create(mysteryId, toRequest(draft)))
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ created }) => {
          const saved = this.backfillDraftIds(drafts, created);
          this.bystanders.set(saved);
          this.existingBystanderIds.set(this.savedDraftIds(saved));

          this.isSubmitting.set(false);
          this.notificationService.success(this.isEditMode() ? 'Mystery updated!' : 'Mystery created!');
          this.router.navigate(['/mysteries', mysteryId]);
        },
        error: () => this.handleSubmitError('Could not save bystanders. Please try again.'),
      });
  }

  /**
   * Diffs `minionDrafts()` against the last-saved baseline and applies it (SS1.6):
   * removed -> hard `DELETE /api/minions/{id}` (a minion belongs to exactly one monster, so there is
   * nothing to unlink); `id !== null` -> update; `id === null` -> create. Each surviving minion then
   * runs the existing delete-all/recreate-all sub-resource cycle against **its own** ID baseline —
   * one cycle per minion, not one shared cycle across all of them.
   */
  private saveMinionDrafts(monsterId: string): Observable<unknown> {
    const drafts = this.minionDrafts();
    const toRequest = (draft: MinionDraft): UpsertMinionRequest => ({
      name: draft.name,
      description: this.toNullable(draft.description),
      harmCapacity: draft.harmCapacity,
      minionTypeId: draft.minionTypeId,
    });

    const removedIds = this.idsToRemove(this.existingMinionIds(), drafts);

    return this.runBatch(removedIds.map((minionId) => this.minionService.delete(minionId))).pipe(
      switchMap(() =>
        this.runBatch(
          drafts.map((draft, index) =>
            (draft.id !== null
              ? this.minionService.update(draft.id, toRequest(draft))
              : this.minionService.create(monsterId, toRequest(draft))
            ).pipe(
              switchMap((minion) =>
                this.runBatch<void>([
                  ...draft.existingAttackIds.map((id) => this.minionService.deleteAttack(minion.id, id)),
                  ...draft.existingPowerIds.map((id) => this.minionService.deletePower(minion.id, id)),
                  ...draft.existingWeaknessIds.map((id) => this.minionService.deleteWeakness(minion.id, id)),
                  ...draft.existingArmorIds.map((id) => this.minionService.deleteArmor(minion.id, id)),
                ]).pipe(
                  switchMap(() =>
                    this.saveMinionCollections(minion.id, draft.attacks, draft.powers, draft.weaknesses, draft.armors)
                  ),
                  map((savedCollections) => ({ index, minionId: minion.id, savedCollections }))
                )
              )
            )
          )
        )
      ),
      tap((results) => {
        // Backfill server IDs and refresh each draft's own sub-resource baseline, so a revisit
        // updates rather than duplicates (the Bug 2 shape) and deletes the right children.
        const saved = [...drafts];
        for (const { index, minionId, savedCollections } of results) {
          saved[index] = {
            ...saved[index],
            id: minionId,
            existingAttackIds: savedCollections.attacks.map((a) => a.id),
            existingPowerIds: savedCollections.powers.map((power) => power.id),
            existingWeaknessIds: savedCollections.weaknesses.map((w) => w.id),
            existingArmorIds: savedCollections.armors.map((a) => a.id),
          };
        }

        this.minionDrafts.set(saved);
        this.existingMinionIds.set(this.savedDraftIds(saved));
      })
    );
  }

  /** IDs present as of the last save that are no longer present in the draft array. */
  private idsToRemove(savedIds: string[], drafts: { id: string | null }[]): string[] {
    return savedIds.filter((savedId) => !drafts.some((draft) => draft.id === savedId));
  }

  /**
   * Pairs newly created records back onto the drafts they came from. The locations/bystanders steps are
   * strictly append/remove — no reordering, no edit-in-place — so create responses line up by order.
   */
  private backfillDraftIds<T extends { id: string | null }>(drafts: T[], created: { id: string }[]): T[] {
    let createdIndex = 0;
    return drafts.map((draft) => (draft.id !== null ? draft : { ...draft, id: created[createdIndex++]?.id ?? null }));
  }

  private savedDraftIds(drafts: { id: string | null }[]): string[] {
    return drafts.map((draft) => draft.id).filter((id): id is string => id !== null);
  }

  private saveMinionCollections(
    minionId: string,
    attacks: AttackDraft[],
    powers: PowerDraft[],
    weaknesses: WeaknessDraft[],
    armors: ArmorDraft[]
  ): Observable<SavedMinionCollections> {
    return forkJoin({
      attacks: this.runBatch(
        attacks.map((attack) =>
          this.minionService.createAttack(minionId, {
            name: attack.name,
            description: this.toNullable(attack.description),
            harm: attack.harm,
          }).pipe(
            switchMap((createdAttack) => {
              const selectedTagIds = attack.weaponTagIds.filter((tagId) => tagId.length > 0);
              if (selectedTagIds.length === 0) {
                return of(createdAttack);
              }

              return forkJoin(
                selectedTagIds.map((weaponTagId) =>
                  this.minionService.assignAttackWeaponTag(minionId, createdAttack.id, weaponTagId)
                )
              ).pipe(switchMap(() => of(createdAttack)));
            })
          )
        )
      ),
      powers: this.runBatch(
        powers.map((power) =>
          this.minionService.createPower(minionId, {
            name: power.name,
            description: this.toNullable(power.description),
          })
        )
      ),
      weaknesses: this.runBatch(
        weaknesses.map((weakness) =>
          this.minionService.createWeakness(minionId, {
            name: weakness.name,
            description: this.toNullable(weakness.description),
          })
        )
      ),
      armors: this.runBatch(
        armors.map((armor) =>
          this.minionService.createArmor(minionId, {
            name: armor.name,
            description: this.toNullable(armor.description),
            harmSoak: armor.harmSoak,
            isSpecial: armor.isSpecial,
            specialDescription: this.toNullable(armor.specialDescription),
          })
        )
      ),
    });
  }

  private saveThreatCollections(
    monsterId: string,
    attacks: AttackDraft[],
    powers: PowerDraft[],
    weaknesses: WeaknessDraft[],
    armors: ArmorDraft[]
  ): Observable<SavedThreatCollections> {
    return forkJoin({
      attacks: this.runBatch(
        attacks.map((attack) =>
          this.monsterService.createAttack(monsterId, {
            name: attack.name,
            description: this.toNullable(attack.description),
            harm: attack.harm,
          }).pipe(
            switchMap((createdAttack) => {
              const selectedTagIds = attack.weaponTagIds.filter((tagId) => tagId.length > 0);
              if (selectedTagIds.length === 0) {
                return of(createdAttack);
              }

              return forkJoin(
                selectedTagIds.map((weaponTagId) =>
                  this.monsterService.assignAttackWeaponTag(monsterId, createdAttack.id, weaponTagId)
                )
              ).pipe(switchMap(() => of(createdAttack)));
            })
          )
        )
      ),
      powers: this.runBatch(
        powers.map((power) =>
          this.monsterService.createPower(monsterId, {
            name: power.name,
            description: this.toNullable(power.description),
          })
        )
      ),
      weaknesses: this.runBatch(
        weaknesses.map((weakness) =>
          this.monsterService.createWeakness(monsterId, {
            name: weakness.name,
            description: this.toNullable(weakness.description),
          })
        )
      ),
      armors: this.runBatch(
        armors.map((armor) =>
          this.monsterService.createArmor(monsterId, {
            name: armor.name,
            description: this.toNullable(armor.description),
            harmSoak: armor.harmSoak,
            isSpecial: armor.isSpecial,
            specialDescription: this.toNullable(armor.specialDescription),
          })
        )
      ),
    });
  }

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }

  private advancePhase(): void {
    this.isSubmitting.set(false);
    this.submitError.set(null);
    this.phaseComplete.update((phases) => phases.map((complete, index) => (index === this.currentPhase() ? true : complete)));
    this.currentPhase.update((phase) => phase + 1);
    this.currentStep.set(0);
  }

  private handleSubmitError(message: string): void {
    this.submitError.set(message);
    this.isSubmitting.set(false);
  }

  private addAttackDraft(target: WritableSignal<AttackDraft[]>, form: AttackFormGroup): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    target.update((items) => [
      ...items,
      {
        name: form.controls.name.value.trim(),
        harm: form.controls.harm.value,
        description: form.controls.description.value ?? '',
        weaponTagIds: [...(form.controls.weaponTagIds.value ?? [])],
      },
    ]);
    form.reset({ name: '', harm: 0, description: '', weaponTagIds: [] });
  }

  private addNamedDraft(target: WritableSignal<PowerDraft[] | WeaknessDraft[]>, form: NamedDraftFormGroup): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    target.update((items) => [
      ...items,
      {
        name: form.controls.name.value.trim(),
        description: form.controls.description.value ?? '',
      },
    ]);
    form.reset({ name: '', description: '' });
  }

  private removeDraft<T>(target: WritableSignal<T[]>, index: number): void {
    target.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  private addArmorDraft(target: WritableSignal<ArmorDraft[]>, form: ArmorFormGroup): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    target.update((items) => [
      ...items,
      {
        name: form.controls.name.value.trim(),
        description: form.controls.description.value ?? '',
        harmSoak: form.controls.harmSoak.value,
        isSpecial: form.controls.isSpecial.value,
        specialDescription: form.controls.specialDescription.value ?? '',
      },
    ]);
    form.reset({ name: '', description: '', harmSoak: 0, isSpecial: false, specialDescription: '' });
  }

  private toNullable(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
