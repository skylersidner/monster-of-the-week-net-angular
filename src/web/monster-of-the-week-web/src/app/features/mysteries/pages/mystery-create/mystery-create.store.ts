import { DestroyRef, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, forkJoin, of, startWith, switchMap } from 'rxjs';

import { ApiService } from '../../../../core/api';
import {
  AdventureTypeResponse,
  BystanderListItemResponse,
  LocationListItemResponse,
  MinionDetailResponse,
  MonsterArchetypeResponse,
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
  name: string;
  description: string;
  locationTypeId: string;
}

export interface BystanderDraft {
  name: string;
  description: string;
  bystanderTypeId: string;
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
  };
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
  private readonly apiService = inject(ApiService);
  private readonly mysteryService = inject(MysteryService);
  private readonly monsterService = inject(MonsterService);
  private readonly minionService = inject(MinionService);
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
  readonly editingMinionId = signal<string | null>(null);
  private readonly existingMonsterAttackIds = signal<string[]>([]);
  private readonly existingMonsterPowerIds = signal<string[]>([]);
  private readonly existingMonsterWeaknessIds = signal<string[]>([]);
  private readonly existingMonsterArmorIds = signal<string[]>([]);
  private readonly existingMinionAttackIds = signal<string[]>([]);
  private readonly existingMinionPowerIds = signal<string[]>([]);
  private readonly existingMinionWeaknessIds = signal<string[]>([]);
  private readonly existingMinionArmorIds = signal<string[]>([]);
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
    harmCapacity: this.fb.nonNullable.control(7, [Validators.min(0)]),
    monsterTypeId: this.fb.nonNullable.control('', [Validators.required]),
    monsterArchetypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly minionForm = this.fb.group({
    name: this.fb.nonNullable.control(''),
    description: this.fb.control(''),
    harmCapacity: this.fb.nonNullable.control(3, [Validators.min(0)]),
    minionTypeId: this.fb.nonNullable.control(''),
  });

  readonly monsterAttackForm: AttackFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    harm: this.fb.nonNullable.control(0),
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
    harm: this.fb.nonNullable.control(0),
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
    harmSoak: this.fb.nonNullable.control(0, [Validators.min(0)]),
    isSpecial: this.fb.nonNullable.control(false),
    specialDescription: this.fb.control(''),
  });

  readonly minionArmorForm: ArmorFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    harmSoak: this.fb.nonNullable.control(0, [Validators.min(0)]),
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
        false, // minion is optional — never force-complete
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
      harmCapacity: this.minionValue()?.harmCapacity ?? 3,
      typeName: type?.name ?? '',
      attacks: this.minionAttacks(),
      powers: this.minionPowers(),
      weaknesses: this.minionWeaknesses(),
      armors: this.minionArmors(),
    };
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
        'Minions are lesser threats that support the main monster—cultists, possessed victims, summoned creatures, or loyal servants. Use the same structure as the monster. Minions are optional—leave the name blank to skip this step.',
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
      locations: this.apiService.get<LocationListItemResponse[]>(`/api/mysteries/${mysteryId}/locations`),
      bystanders: this.apiService.get<BystanderListItemResponse[]>(`/api/mysteries/${mysteryId}/bystanders`),
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
            locations.map((l) => ({ name: l.name, description: l.description ?? '', locationTypeId: l.locationTypeId }))
          );

          this.existingBystanderIds.set(bystanders.map((b) => b.id));
          this.bystanders.set(
            bystanders.map((b) => ({ name: b.name, description: b.description ?? '', bystanderTypeId: b.bystanderTypeId }))
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
            minion: pureMonster
              ? this.minionService.getByMonster(pureMonster.id).pipe(
                  switchMap((minions) => (minions.length > 0 ? this.minionService.getById(minions[0].id) : of(null)))
                )
              : of(null),
          });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ pureMonster, minion }: { pureMonster: import('../../../../core/models').MonsterDetailResponse | null; minion: MinionDetailResponse | null }) => {
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

        if (minion) {
          this.editingMinionId.set(minion.id);
          this.existingMinionAttackIds.set(minion.attacks.map((a) => a.id));
          this.existingMinionPowerIds.set(minion.powers.map((p) => p.id));
          this.existingMinionWeaknessIds.set(minion.weaknesses.map((w) => w.id));
          this.existingMinionArmorIds.set(minion.armors.map((a) => a.id));
          this.minionForm.patchValue({
            name: minion.name,
            description: minion.description ?? '',
            harmCapacity: minion.harmCapacity,
            minionTypeId: minion.minionType.id,
          });
          this.minionAttacks.set(
            minion.attacks.map((a) => ({
              name: a.name,
              harm: a.harm,
              description: a.description ?? '',
              weaponTagIds: a.weaponTags.map((t) => t.id),
            }))
          );
          this.minionPowers.set(minion.powers.map((p) => ({ name: p.name, description: p.description ?? '' })));
          this.minionWeaknesses.set(minion.weaknesses.map((w) => ({ name: w.name, description: w.description ?? '' })));
          this.minionArmors.set(
            minion.armors.map((a) => ({
              name: a.name,
              description: a.description ?? '',
              harmSoak: a.harmSoak,
              isSpecial: a.isSpecial,
              specialDescription: a.specialDescription ?? '',
            }))
          );
        }
      });
  }

  next(): void {
    if (!this.validateCurrentStep()) {
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
    const save$ =
      this.isEditMode() && existingId
        ? this.mysteryService.update(existingId, mysteryRequest)
        : this.mysteryService.create(mysteryRequest);

    save$
      .pipe(
        switchMap((mystery) => {
          if (!this.isEditMode()) {
            this.mysteryId.set(mystery.id);
          }

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
          const deleteOps: Observable<unknown>[] = [
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
            switchMap(() => {
              const minionName = this.minionForm.controls.name.value.trim();
              const editingMinionId = this.editingMinionId();
              if (!minionName) {
                return of(null);
              }

              const minionTypeId = this.minionForm.controls.minionTypeId.value;
              if (!minionTypeId) {
                this.handleSubmitError('A minion type is required when adding a minion.');
                return of(null);
              }

              const minionRequest: UpsertMinionRequest = {
                name: minionName,
                description: this.toNullable(this.minionForm.controls.description.value),
                harmCapacity: this.minionForm.controls.harmCapacity.value,
                minionTypeId: minionTypeId,
              };

              const minionSave$ = editingMinionId
                ? this.minionService.update(editingMinionId, minionRequest)
                : this.minionService.create(monster.id, minionRequest);

              return minionSave$.pipe(
                switchMap((minion) => {
                  const deleteMinionOps: Observable<unknown>[] = [
                    ...this.existingMinionAttackIds().map((id) => this.minionService.deleteAttack(minion.id, id)),
                    ...this.existingMinionPowerIds().map((id) => this.minionService.deletePower(minion.id, id)),
                    ...this.existingMinionWeaknessIds().map((id) => this.minionService.deleteWeakness(minion.id, id)),
                    ...this.existingMinionArmorIds().map((id) => this.minionService.deleteArmor(minion.id, id)),
                  ];
                  return this.runBatch(deleteMinionOps).pipe(
                    switchMap(() =>
                      this.saveMinionCollections(
                        minion.id,
                        this.minionAttacks(),
                        this.minionPowers(),
                        this.minionWeaknesses(),
                        this.minionArmors()
                      )
                    )
                  );
                })
              );
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

    const unlinkOps = this.existingLocationIds().map((locationId) =>
      this.apiService.delete(`/api/mysteries/${mysteryId}/locations/${locationId}`)
    );

    this.runBatch(unlinkOps)
      .pipe(
        switchMap(() => {
          const createRequests = this.locations().map((location) =>
            this.apiService.post<UpsertLocationRequest, unknown>(`/api/mysteries/${mysteryId}/locations`, {
              name: location.name,
              description: this.toNullable(location.description),
              locationTypeId: location.locationTypeId,
            })
          );
          return this.runBatch(createRequests);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.advancePhase(),
        error: () => this.handleSubmitError('Could not save locations. Please try again.'),
      });
  }

  private submitPhase3(): void {
    const mysteryId = this.mysteryId();
    if (!mysteryId) {
      this.handleSubmitError('Could not save bystanders. Please try again.');
      return;
    }

    const unlinkOps = this.existingBystanderIds().map((bystanderId) =>
      this.apiService.delete(`/api/mysteries/${mysteryId}/bystanders/${bystanderId}`)
    );

    this.runBatch(unlinkOps)
      .pipe(
        switchMap(() => {
          const createRequests = this.bystanders().map((bystander) =>
            this.apiService.post<UpsertBystanderRequest, unknown>(`/api/mysteries/${mysteryId}/bystanders`, {
              name: bystander.name,
              description: this.toNullable(bystander.description),
              bystanderTypeId: bystander.bystanderTypeId,
            })
          );
          return this.runBatch(createRequests);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.notificationService.success(this.isEditMode() ? 'Mystery updated!' : 'Mystery created!');
          this.router.navigate(['/mysteries', mysteryId]);
        },
        error: () => this.handleSubmitError('Could not save bystanders. Please try again.'),
      });
  }

  private saveMinionCollections(
    minionId: string,
    attacks: AttackDraft[],
    powers: PowerDraft[],
    weaknesses: WeaknessDraft[],
    armors: ArmorDraft[]
  ): Observable<unknown[]> {
    const requests: Observable<unknown>[] = [
      ...attacks.map((attack) =>
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
      ),
      ...powers.map((power) =>
        this.minionService.createPower(minionId, {
          name: power.name,
          description: this.toNullable(power.description),
        })
      ),
      ...weaknesses.map((weakness) =>
        this.minionService.createWeakness(minionId, {
          name: weakness.name,
          description: this.toNullable(weakness.description),
        })
      ),
      ...armors.map((armor) =>
        this.minionService.createArmor(minionId, {
          name: armor.name,
          description: this.toNullable(armor.description),
          harmSoak: armor.harmSoak,
          isSpecial: armor.isSpecial,
          specialDescription: this.toNullable(armor.specialDescription),
        })
      ),
    ];

    return this.runBatch(requests);
  }

  private saveThreatCollections(
    monsterId: string,
    attacks: AttackDraft[],
    powers: PowerDraft[],
    weaknesses: WeaknessDraft[],
    armors: ArmorDraft[]
  ): Observable<unknown[]> {
    const requests: Observable<unknown>[] = [
      ...attacks.map((attack) =>
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
      ),
      ...powers.map((power) =>
        this.monsterService.createPower(monsterId, {
          name: power.name,
          description: this.toNullable(power.description),
        })
      ),
      ...weaknesses.map((weakness) =>
        this.monsterService.createWeakness(monsterId, {
          name: weakness.name,
          description: this.toNullable(weakness.description),
        })
      ),
      ...armors.map((armor) =>
        this.monsterService.createArmor(monsterId, {
          name: armor.name,
          description: this.toNullable(armor.description),
          harmSoak: armor.harmSoak,
          isSpecial: armor.isSpecial,
          specialDescription: this.toNullable(armor.specialDescription),
        })
      ),
    ];

    return this.runBatch(requests);
  }

  private runBatch(requests: Observable<unknown>[]): Observable<unknown[]> {
    return requests.length > 0 ? forkJoin(requests) : of([]);
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
