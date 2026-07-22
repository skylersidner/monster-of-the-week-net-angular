import { DestroyRef, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, forkJoin, of, startWith, switchMap } from 'rxjs';

import { ApiService } from '../../../../core/api';
import {
  TypeRefResponse,
  UpsertBystanderRequest,
  UpsertCountdownRequest,
  UpsertLocationRequest,
  UpsertMonsterRequest,
  UpsertMysteryRequest,
} from '../../../../core/models';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import type { MysterySectionIconKind } from '../../shared/mystery-section-icon';

export interface AttackDraft {
  name: string;
  harm: number;
  description: string;
}

export interface PowerDraft {
  name: string;
  description: string;
}

export interface WeaknessDraft {
  name: string;
  description: string;
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
    minionAttacks: AttackDraft[];
    minionPowers: PowerDraft[];
    minionWeaknesses: WeaknessDraft[];
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

@Injectable()
export class MysteryCreateStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly apiService = inject(ApiService);
  private readonly mysteryService = inject(MysteryService);
  private readonly monsterService = inject(MonsterService);
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
  readonly minionTypes = signal<TypeRefResponse[]>([]);
  readonly locationTypes = signal<TypeRefResponse[]>([]);
  readonly bystanderTypes = signal<TypeRefResponse[]>([]);

  readonly monsterAttacks = signal<AttackDraft[]>([]);
  readonly monsterPowers = signal<PowerDraft[]>([]);
  readonly monsterWeaknesses = signal<WeaknessDraft[]>([]);
  readonly minionAttacks = signal<AttackDraft[]>([]);
  readonly minionPowers = signal<PowerDraft[]>([]);
  readonly minionWeaknesses = signal<WeaknessDraft[]>([]);
  readonly locations = signal<LocationDraft[]>([]);
  readonly bystanders = signal<BystanderDraft[]>([]);

  readonly conceptForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(1)]),
    concept: this.fb.control(''),
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
    monsterTypeId: this.fb.nonNullable.control(''),
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
  });

  readonly minionPowerForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly minionWeaknessForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
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

  readonly mysteryPreview = computed(() => ({
    name: this.conceptValue()?.name ?? '',
    concept: this.conceptValue()?.concept ?? '',
    hook: this.hookValue()?.hook ?? '',
    overview: this.overviewValue()?.overview ?? '',
    countdown: this.countdownValue(),
  }));

  readonly monsterPreview = computed(() => {
    const typeId = this.monsterValue()?.monsterTypeId ?? '';
    const type = this.monsterTypes().find((item) => item.id === typeId);
    return {
      name: this.monsterValue()?.name ?? '',
      description: this.monsterValue()?.description ?? '',
      harmCapacity: this.monsterValue()?.harmCapacity ?? 7,
      typeName: type?.name ?? '',
      attacks: this.monsterAttacks(),
      powers: this.monsterPowers(),
      weaknesses: this.monsterWeaknesses(),
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
      minionAttacks: [...this.minionAttacks()],
      minionPowers: [...this.minionPowers()],
      minionWeaknesses: [...this.minionWeaknesses()],
      locations: [...this.locations()],
      bystanders: [...this.bystanders()],
    },
  }));

  init(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    forkJoin({
      monsterTypes: this.referenceDataService.getMonsterTypes(),
      minionTypes: this.referenceDataService.getMinionTypes(),
      locationTypes: this.referenceDataService.getLocationTypes(),
      bystanderTypes: this.referenceDataService.getBystanderTypes(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ monsterTypes, minionTypes, locationTypes, bystanderTypes }) => {
        this.monsterTypes.set(monsterTypes);
        this.minionTypes.set(minionTypes);
        this.locationTypes.set(locationTypes);
        this.bystanderTypes.set(bystanderTypes);
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
    };

    this.mysteryService
      .create(mysteryRequest)
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

    const monsterRequest: UpsertMonsterRequest = {
      name: this.monsterForm.controls.name.value.trim(),
      description: this.toNullable(this.monsterForm.controls.description.value),
      harmCapacity: this.monsterForm.controls.harmCapacity.value,
      monsterTypeId: this.toNullable(this.monsterForm.controls.monsterTypeId.value),
      minionTypeId: null,
    };

    this.monsterService
      .create(mysteryId, monsterRequest)
      .pipe(
        switchMap((monster) =>
          this.saveThreatCollections(
            monster.id,
            this.monsterAttacks(),
            this.monsterPowers(),
            this.monsterWeaknesses()
          )
        ),
        switchMap(() => {
          const minionName = this.minionForm.controls.name.value.trim();
          if (!minionName) {
            return of(null);
          }

          const minionRequest: UpsertMonsterRequest = {
            name: minionName,
            description: this.toNullable(this.minionForm.controls.description.value),
            harmCapacity: this.minionForm.controls.harmCapacity.value,
            monsterTypeId: null,
            minionTypeId: this.toNullable(this.minionForm.controls.minionTypeId.value),
          };

          return this.monsterService.create(mysteryId, minionRequest).pipe(
            switchMap((minion) =>
              this.saveThreatCollections(minion.id, this.minionAttacks(), this.minionPowers(), this.minionWeaknesses())
            )
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

    const requests = this.locations().map((location) =>
      this.apiService.post<UpsertLocationRequest, unknown>(`/api/mysteries/${mysteryId}/locations`, {
        name: location.name,
        description: this.toNullable(location.description),
        locationTypeId: location.locationTypeId,
      })
    );

    this.runBatch(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
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

    const requests = this.bystanders().map((bystander) =>
      this.apiService.post<UpsertBystanderRequest, unknown>(`/api/mysteries/${mysteryId}/bystanders`, {
        name: bystander.name,
        description: this.toNullable(bystander.description),
        bystanderTypeId: bystander.bystanderTypeId,
      })
    );

    this.runBatch(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.notificationService.success('Mystery created!');
          this.router.navigate(['/mysteries', mysteryId]);
        },
        error: () => this.handleSubmitError('Could not save bystanders. Please try again.'),
      });
  }

  private saveThreatCollections(
    monsterId: string,
    attacks: AttackDraft[],
    powers: PowerDraft[],
    weaknesses: WeaknessDraft[]
  ): Observable<unknown[]> {
    const requests: Observable<unknown>[] = [
      ...attacks.map((attack) =>
        this.monsterService.createAttack(monsterId, {
          name: attack.name,
          description: this.toNullable(attack.description),
          harm: attack.harm,
        })
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
      },
    ]);
    form.reset({ name: '', harm: 0, description: '' });
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

  private toNullable(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
