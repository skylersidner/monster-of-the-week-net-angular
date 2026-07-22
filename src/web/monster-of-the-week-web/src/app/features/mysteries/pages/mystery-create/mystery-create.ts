import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { ApiService } from '../../../../core/api';
import { MysteryService } from '../../../../core/mystery';
import { MonsterService } from '../../../../core/monster';
import { ReferenceDataService } from '../../../../core/reference-data';
import { NotificationService } from '../../../../core/notifications';
import {
  TypeRefResponse,
  UpsertMysteryRequest,
  UpsertCountdownRequest,
  UpsertMonsterRequest,
  UpsertMonsterAttackRequest,
  UpsertMonsterPowerRequest,
  UpsertMonsterWeaknessRequest,
  UpsertLocationRequest,
  UpsertBystanderRequest,
} from '../../../../core/models';

interface AttackDraft {
  name: string;
  harm: number;
  description: string;
}

interface PowerDraft {
  name: string;
  description: string;
}

interface WeaknessDraft {
  name: string;
  description: string;
}

interface LocationDraft {
  name: string;
  description: string;
  locationTypeId: string;
}

interface BystanderDraft {
  name: string;
  description: string;
  bystanderTypeId: string;
}

@Component({
  selector: 'app-mystery-create',
  imports: [ReactiveFormsModule],
  templateUrl: './mystery-create.html',
  styleUrl: './mystery-create.scss',
})
export class MysteryCreateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly apiService = inject(ApiService);
  private readonly mysteryService = inject(MysteryService);
  private readonly monsterService = inject(MonsterService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly notificationService = inject(NotificationService);

  readonly phases = [
    { index: 0, name: 'Mystery', steps: 4, stepsArray: [0, 1, 2, 3] },
    { index: 1, name: 'Monsters', steps: 2, stepsArray: [0, 1] },
    { index: 2, name: 'Locations', steps: 1, stepsArray: [0] },
    { index: 3, name: 'Bystanders', steps: 1, stepsArray: [0] },
  ];

  // Navigation state
  readonly currentPhase = signal(0);
  readonly currentStep = signal(0);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly mysteryId = signal<string | null>(null);

  // Phase completion tracking
  readonly phaseComplete = signal([false, false, false, false]);

  // Reference data
  readonly monsterTypes = signal<TypeRefResponse[]>([]);
  readonly minionTypes = signal<TypeRefResponse[]>([]);
  readonly locationTypes = signal<TypeRefResponse[]>([]);
  readonly bystanderTypes = signal<TypeRefResponse[]>([]);

  // Accumulated sub-items
  readonly monsterAttacks = signal<AttackDraft[]>([]);
  readonly monsterPowers = signal<PowerDraft[]>([]);
  readonly monsterWeaknesses = signal<WeaknessDraft[]>([]);
  readonly minionAttacks = signal<AttackDraft[]>([]);
  readonly minionPowers = signal<PowerDraft[]>([]);
  readonly minionWeaknesses = signal<WeaknessDraft[]>([]);
  readonly locations = signal<LocationDraft[]>([]);
  readonly bystanders = signal<BystanderDraft[]>([]);

  // Phase 0 forms
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

  // Phase 1 forms
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

  readonly addAttackForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    harm: this.fb.nonNullable.control(0),
    description: this.fb.control(''),
  });

  readonly addPowerForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly addWeaknessForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  // Phase 2 form
  readonly addLocationForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    locationTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  // Phase 3 form
  readonly addBystanderForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    bystanderTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  // Preview signals
  private readonly conceptValue = toSignal(this.conceptForm.valueChanges.pipe(startWith(this.conceptForm.value)));
  private readonly hookValue = toSignal(this.hookForm.valueChanges.pipe(startWith(this.hookForm.value)));
  private readonly overviewValue = toSignal(this.overviewForm.valueChanges.pipe(startWith(this.overviewForm.value)));
  private readonly countdownValue = toSignal(
    this.countdownForm.valueChanges.pipe(startWith(this.countdownForm.value))
  );
  private readonly monsterValue = toSignal(this.monsterForm.valueChanges.pipe(startWith(this.monsterForm.value)));
  private readonly minionValue = toSignal(this.minionForm.valueChanges.pipe(startWith(this.minionForm.value)));

  readonly previewName = computed(() => this.conceptValue()?.name ?? '');
  readonly previewConcept = computed(() => this.conceptValue()?.concept ?? '');
  readonly previewHook = computed(() => this.hookValue()?.hook ?? '');
  readonly previewOverview = computed(() => this.overviewValue()?.overview ?? '');
  readonly previewCountdown = computed(() => this.countdownValue());
  readonly previewMonsterName = computed(() => this.monsterValue()?.name ?? '');
  readonly previewMonsterDescription = computed(() => this.monsterValue()?.description ?? '');
  readonly previewMonsterHarmCapacity = computed(() => this.monsterValue()?.harmCapacity ?? 7);
  readonly previewMonsterTypeId = computed(() => this.monsterValue()?.monsterTypeId ?? '');
  readonly previewMonsterTypeName = computed(() => {
    const typeId = this.previewMonsterTypeId();
    const type = this.monsterTypes().find((t) => t.id === typeId);
    return type?.name ?? '';
  });
  readonly previewMinionName = computed(() => this.minionValue()?.name ?? '');
  readonly previewMinionDescription = computed(() => this.minionValue()?.description ?? '');
  readonly previewMinionHarmCapacity = computed(() => this.minionValue()?.harmCapacity ?? 3);
  readonly previewMinionTypeId = computed(() => this.minionValue()?.minionTypeId ?? '');
  readonly previewMinionTypeName = computed(() => {
    const typeId = this.previewMinionTypeId();
    const type = this.minionTypes().find((t) => t.id === typeId);
    return type?.name ?? '';
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

  ngOnInit(): void {
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
    const phase = this.currentPhase();
    const step = this.currentStep();

    if (!this.validateCurrentStep()) return;

    const stepsInPhase = [4, 2, 1, 1][phase];
    if (step < stepsInPhase - 1) {
      this.currentStep.set(step + 1);
      if (phase === 1 && step === 0) {
        this.addAttackForm.reset({ name: '', harm: 0, description: '' });
        this.addPowerForm.reset({ name: '', description: '' });
        this.addWeaknessForm.reset({ name: '', description: '' });
      }
      return;
    }

    this.submitCurrentPhase();
  }

  back(): void {
    if (this.currentStep() > 0) {
      this.currentStep.set(this.currentStep() - 1);
    } else if (this.currentPhase() > 0) {
      const prevPhase = this.currentPhase() - 1;
      const stepsInPrevPhase = [4, 2, 1, 1][prevPhase];
      this.currentPhase.set(prevPhase);
      this.currentStep.set(stepsInPrevPhase - 1);
    }
  }

  jumpToPhase(phase: number): void {
    if (this.phaseComplete()[phase - 1] === false && phase > 0) return;
    this.currentPhase.set(phase);
    this.currentStep.set(0);
  }

  private validateCurrentStep(): boolean {
    const phase = this.currentPhase();
    const step = this.currentStep();

    if (phase === 0 && step === 0) {
      if (this.conceptForm.invalid) {
        this.conceptForm.markAllAsTouched();
        return false;
      }
    }

    if (phase === 1 && step === 0) {
      if (this.monsterForm.invalid) {
        this.monsterForm.markAllAsTouched();
        return false;
      }
    }

    return true;
  }

  private submitCurrentPhase(): void {
    this.isSubmitting.set(true);
    this.submitError.set(null);

    const phase = this.currentPhase();

    if (phase === 0) {
      this.submitPhase0();
    } else if (phase === 1) {
      this.submitPhase1();
    } else if (phase === 2) {
      this.submitPhase2();
    } else if (phase === 3) {
      this.submitPhase3();
    }
  }

  private submitPhase0(): void {
    const mysteryReq: UpsertMysteryRequest = {
      name: this.conceptForm.controls.name.value.trim(),
      concept: this.toNullable(this.conceptForm.controls.concept.value),
      hook: this.toNullable(this.hookForm.controls.hook.value),
      overview: this.toNullable(this.overviewForm.controls.overview.value),
      notes: null,
    };

    this.mysteryService
      .create(mysteryReq)
      .pipe(
        switchMap((mystery) => {
          this.mysteryId.set(mystery.id);
          const countdownReq: UpsertCountdownRequest = {
            day: this.toNullable(this.countdownForm.controls.day.value),
            shadows: this.toNullable(this.countdownForm.controls.shadows.value),
            sunset: this.toNullable(this.countdownForm.controls.sunset.value),
            dusk: this.toNullable(this.countdownForm.controls.dusk.value),
            nightfall: this.toNullable(this.countdownForm.controls.nightfall.value),
            midnight: this.toNullable(this.countdownForm.controls.midnight.value),
          };
          return this.mysteryService.upsertCountdown(mystery.id, countdownReq);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.advancePhase(),
        error: () => {
          this.submitError.set('Could not save mystery. Please try again.');
          this.isSubmitting.set(false);
        },
      });
  }

  private submitPhase1(): void {
    const mysteryId = this.mysteryId()!;
    const monsterReq: UpsertMonsterRequest = {
      name: this.monsterForm.controls.name.value.trim(),
      description: this.toNullable(this.monsterForm.controls.description.value),
      harmCapacity: this.monsterForm.controls.harmCapacity.value,
      monsterTypeId: this.toNullable(this.monsterForm.controls.monsterTypeId.value),
      minionTypeId: null,
    };

    this.monsterService
      .create(mysteryId, monsterReq)
      .pipe(
        switchMap((monster) => {
          const subs: any[] = [
            ...this.monsterAttacks().map((a) =>
              this.monsterService.createAttack(monster.id, {
                name: a.name,
                description: this.toNullable(a.description),
                harm: a.harm,
              })
            ),
            ...this.monsterPowers().map((p) =>
              this.monsterService.createPower(monster.id, {
                name: p.name,
                description: this.toNullable(p.description),
              })
            ),
            ...this.monsterWeaknesses().map((w) =>
              this.monsterService.createWeakness(monster.id, {
                name: w.name,
                description: this.toNullable(w.description),
              })
            ),
          ];
          return subs.length > 0 ? forkJoin(subs) : of(null);
        }),
        switchMap(() => {
          const minionName = this.minionForm.controls.name.value.trim();
          if (!minionName) return of(null);
          const minionReq: UpsertMonsterRequest = {
            name: minionName,
            description: this.toNullable(this.minionForm.controls.description.value),
            harmCapacity: this.minionForm.controls.harmCapacity.value,
            monsterTypeId: null,
            minionTypeId: this.toNullable(this.minionForm.controls.minionTypeId.value),
          };
          return this.monsterService.create(mysteryId, minionReq).pipe(
            switchMap((minion) => {
              const subs: any[] = [
                ...this.minionAttacks().map((a) =>
                  this.monsterService.createAttack(minion.id, {
                    name: a.name,
                    description: this.toNullable(a.description),
                    harm: a.harm,
                  })
                ),
                ...this.minionPowers().map((p) =>
                  this.monsterService.createPower(minion.id, {
                    name: p.name,
                    description: this.toNullable(p.description),
                  })
                ),
                ...this.minionWeaknesses().map((w) =>
                  this.monsterService.createWeakness(minion.id, {
                    name: w.name,
                    description: this.toNullable(w.description),
                  })
                ),
              ];
              return subs.length > 0 ? forkJoin(subs) : of(null);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.advancePhase(),
        error: () => {
          this.submitError.set('Could not save monster. Please try again.');
          this.isSubmitting.set(false);
        },
      });
  }

  private submitPhase2(): void {
    const mysteryId = this.mysteryId()!;
    const locationObs = this.locations().map((l) =>
      this.apiService.post<UpsertLocationRequest, unknown>(`/api/mysteries/${mysteryId}/locations`, {
        name: l.name,
        description: this.toNullable(l.description),
        locationTypeId: l.locationTypeId,
      })
    );
    const obs$ = locationObs.length > 0 ? forkJoin(locationObs) : of([] as unknown[]);
    obs$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.advancePhase(),
        error: () => {
          this.submitError.set('Could not save locations. Please try again.');
          this.isSubmitting.set(false);
        },
      });
  }

  private submitPhase3(): void {
    const mysteryId = this.mysteryId()!;
    const bystanderObs = this.bystanders().map((b) =>
      this.apiService.post<UpsertBystanderRequest, unknown>(`/api/mysteries/${mysteryId}/bystanders`, {
        name: b.name,
        description: this.toNullable(b.description),
        bystanderTypeId: b.bystanderTypeId,
      })
    );
    const obs$ = bystanderObs.length > 0 ? forkJoin(bystanderObs) : of([] as unknown[]);
    obs$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notificationService.success('Mystery created!');
          this.router.navigate(['/mysteries', mysteryId]);
        },
        error: () => {
          this.submitError.set('Could not save bystanders. Please try again.');
          this.isSubmitting.set(false);
        },
      });
  }

  private advancePhase(): void {
    this.isSubmitting.set(false);
    this.submitError.set(null);
    const phases = this.phaseComplete();
    phases[this.currentPhase()] = true;
    this.phaseComplete.set([...phases]);
    this.currentPhase.set(this.currentPhase() + 1);
    this.currentStep.set(0);
  }

  addMonsterAttack(): void {
    if (this.addAttackForm.invalid) {
      this.addAttackForm.markAllAsTouched();
      return;
    }
    this.monsterAttacks.set([
      ...this.monsterAttacks(),
      {
        name: this.addAttackForm.controls.name.value.trim(),
        harm: this.addAttackForm.controls.harm.value,
        description: this.addAttackForm.controls.description.value ?? '',
      },
    ]);
    this.addAttackForm.reset({ name: '', harm: 0, description: '' });
  }

  removeMonsterAttack(index: number): void {
    const attacks = [...this.monsterAttacks()];
    attacks.splice(index, 1);
    this.monsterAttacks.set(attacks);
  }

  addMonsterPower(): void {
    if (this.addPowerForm.invalid) {
      this.addPowerForm.markAllAsTouched();
      return;
    }
    this.monsterPowers.set([
      ...this.monsterPowers(),
      {
        name: this.addPowerForm.controls.name.value.trim(),
        description: this.addPowerForm.controls.description.value ?? '',
      },
    ]);
    this.addPowerForm.reset({ name: '', description: '' });
  }

  removeMonsterPower(index: number): void {
    const powers = [...this.monsterPowers()];
    powers.splice(index, 1);
    this.monsterPowers.set(powers);
  }

  addMonsterWeakness(): void {
    if (this.addWeaknessForm.invalid) {
      this.addWeaknessForm.markAllAsTouched();
      return;
    }
    this.monsterWeaknesses.set([
      ...this.monsterWeaknesses(),
      {
        name: this.addWeaknessForm.controls.name.value.trim(),
        description: this.addWeaknessForm.controls.description.value ?? '',
      },
    ]);
    this.addWeaknessForm.reset({ name: '', description: '' });
  }

  removeMonsterWeakness(index: number): void {
    const weaknesses = [...this.monsterWeaknesses()];
    weaknesses.splice(index, 1);
    this.monsterWeaknesses.set(weaknesses);
  }

  addMinionAttack(): void {
    if (this.addAttackForm.invalid) {
      this.addAttackForm.markAllAsTouched();
      return;
    }
    this.minionAttacks.set([
      ...this.minionAttacks(),
      {
        name: this.addAttackForm.controls.name.value.trim(),
        harm: this.addAttackForm.controls.harm.value,
        description: this.addAttackForm.controls.description.value ?? '',
      },
    ]);
    this.addAttackForm.reset({ name: '', harm: 0, description: '' });
  }

  removeMinionAttack(index: number): void {
    const attacks = [...this.minionAttacks()];
    attacks.splice(index, 1);
    this.minionAttacks.set(attacks);
  }

  addMinionPower(): void {
    if (this.addPowerForm.invalid) {
      this.addPowerForm.markAllAsTouched();
      return;
    }
    this.minionPowers.set([
      ...this.minionPowers(),
      {
        name: this.addPowerForm.controls.name.value.trim(),
        description: this.addPowerForm.controls.description.value ?? '',
      },
    ]);
    this.addPowerForm.reset({ name: '', description: '' });
  }

  removeMinionPower(index: number): void {
    const powers = [...this.minionPowers()];
    powers.splice(index, 1);
    this.minionPowers.set(powers);
  }

  addMinionWeakness(): void {
    if (this.addWeaknessForm.invalid) {
      this.addWeaknessForm.markAllAsTouched();
      return;
    }
    this.minionWeaknesses.set([
      ...this.minionWeaknesses(),
      {
        name: this.addWeaknessForm.controls.name.value.trim(),
        description: this.addWeaknessForm.controls.description.value ?? '',
      },
    ]);
    this.addWeaknessForm.reset({ name: '', description: '' });
  }

  removeMinionWeakness(index: number): void {
    const weaknesses = [...this.minionWeaknesses()];
    weaknesses.splice(index, 1);
    this.minionWeaknesses.set(weaknesses);
  }

  addLocation(): void {
    if (this.addLocationForm.invalid) {
      this.addLocationForm.markAllAsTouched();
      return;
    }
    this.locations.set([
      ...this.locations(),
      {
        name: this.addLocationForm.controls.name.value.trim(),
        description: this.addLocationForm.controls.description.value ?? '',
        locationTypeId: this.addLocationForm.controls.locationTypeId.value,
      },
    ]);
    this.addLocationForm.reset({ name: '', description: '', locationTypeId: '' });
  }

  removeLocation(index: number): void {
    const locs = [...this.locations()];
    locs.splice(index, 1);
    this.locations.set(locs);
  }

  addBystander(): void {
    if (this.addBystanderForm.invalid) {
      this.addBystanderForm.markAllAsTouched();
      return;
    }
    this.bystanders.set([
      ...this.bystanders(),
      {
        name: this.addBystanderForm.controls.name.value.trim(),
        description: this.addBystanderForm.controls.description.value ?? '',
        bystanderTypeId: this.addBystanderForm.controls.bystanderTypeId.value,
      },
    ]);
    this.addBystanderForm.reset({ name: '', description: '', bystanderTypeId: '' });
  }

  removeBystander(index: number): void {
    const bys = [...this.bystanders()];
    bys.splice(index, 1);
    this.bystanders.set(bys);
  }

  private toNullable(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
