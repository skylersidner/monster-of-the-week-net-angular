import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, Observable, of, startWith, switchMap } from 'rxjs';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';
import { MonsterFormComponent } from '../../shared/monster-form/monster-form';
import {
  MinionListItemResponse,
  MonsterArchetypeResponse,
  MonsterDetailResponse,
  MonsterAttackResponse,
  TypeRefResponse,
  UpsertMonsterArmorRequest,
  UpsertMonsterAttackRequest,
  UpsertMonsterPowerRequest,
  UpsertMonsterRequest,
  UpsertMonsterWeaknessRequest,
  WeaponTagRefResponse,
} from '../../../../core/models';

@Component({
  selector: 'app-monster-detail-component',
  imports: [ReactiveFormsModule, RouterLink, MonsterFormComponent, WeaponTagSelectComponent, ConfirmDeleteModalComponent, IconComponent],
  templateUrl: './monster-detail.html',
  styleUrl: './monster-detail.scss',
})
export class MonsterDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly monster = signal<MonsterDetailResponse | null>(null);
  readonly monsterTypes = signal<TypeRefResponse[]>([]);
  readonly monsterArchetypes = signal<MonsterArchetypeResponse[]>([]);
  readonly weaponTags = signal<WeaponTagRefResponse[]>([]);
  readonly minions = signal<MinionListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly activeMutation = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDelete = signal<{ label: string; perform: () => void } | null>(null);
  readonly mysteryId = signal<string | null>(null);
  readonly isMutating = computed(() => this.activeMutation() !== null);

  readonly backLink = computed(() =>
    this.mysteryId() ? ['/mysteries', this.mysteryId()] : ['/monsters']
  );
  readonly backLabel = computed(() =>
    this.mysteryId() ? '← Back to mystery' : '← Back to monsters'
  );

  readonly attackForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    harm: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    weaponTagIds: this.formBuilder.nonNullable.control<string[]>([]),
  });

  readonly powerForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
  });

  readonly armorForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    harmSoak: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    isSpecial: this.formBuilder.nonNullable.control(false),
    specialDescription: this.formBuilder.control(''),
  });

  readonly weaknessForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly monsterService: MonsterService,
    private readonly minionService: MinionService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Special Description is only required while Is Special is checked - UI-only rule,
    // the server continues to accept a null SpecialDescription regardless.
    this.armorForm.controls.isSpecial.valueChanges
      .pipe(startWith(this.armorForm.controls.isSpecial.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((isSpecial) => {
        const specialDescription = this.armorForm.controls.specialDescription;
        specialDescription.setValidators(isSpecial ? [Validators.required] : []);
        specialDescription.updateValueAndValidity({ emitEvent: false });
      });

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const monsterId = params.get('monsterId');
          if (!monsterId) {
            throw new Error('Monster id is required.');
          }

          const mysteryId = params.get('mysteryId');
          this.mysteryId.set(mysteryId);
          this.isLoading.set(true);
          this.errorMessage.set(null);

          return forkJoin({
            monster: this.monsterService.getById(monsterId),
            monsterTypes: this.referenceDataService.getMonsterTypes(),
            monsterArchetypes: this.referenceDataService.getMonsterArchetypes(),
            weaponTags: this.referenceDataService.getWeaponTags(),
            minions: this.minionService.getByMonster(monsterId),
          });
        })
      )
      .subscribe({
        next: ({ monster, monsterTypes, monsterArchetypes, weaponTags, minions }) => {
          this.monster.set(monster);
          this.monsterTypes.set(monsterTypes);
          this.monsterArchetypes.set(monsterArchetypes);
          this.weaponTags.set(weaponTags);
          this.minions.set(minions);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load monster details.');
          this.isLoading.set(false);
        },
      });
  }

  saveMonster(payload: UpsertMonsterRequest): void {
    if (!this.monster()) {
      return;
    }

    this.activeMutation.set('Saving monster...');

    this.monsterService
      .update(this.monster()!.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (monster) => {
          this.monster.set(monster);
          this.activeMutation.set(null);
          this.notificationService.success('Monster details saved.');
          this.errorMessage.set(null);
        },
        error: () => {
          this.activeMutation.set(null);
          this.errorMessage.set('Unable to save monster details.');
          this.notificationService.error('Unable to save monster details.');
        },
      });
  }

  createAttack(): void {
    if (this.attackForm.invalid || !this.monster()) {
      this.attackForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMonsterAttackRequest = {
      name: this.attackForm.controls.name.value.trim(),
      description: this.toNullable(this.attackForm.controls.description.value),
      harm: this.attackForm.controls.harm.value,
    };

    const selectedTagIds = this.attackForm.controls.weaponTagIds.value;
    const monsterId = this.monster()!.id;
    this.activeMutation.set('Adding attack...');

    this.monsterService
      .createAttack(monsterId, payload)
      .pipe(
        switchMap((attack) => {
          if (selectedTagIds.length === 0) {
            return of(attack);
          }

          return forkJoin(
            selectedTagIds.map((tagId) => this.monsterService.assignAttackWeaponTag(monsterId, attack.id, tagId))
          ).pipe(switchMap(() => of(attack)));
        }),
        switchMap(() => this.monsterService.getById(monsterId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (monster) => {
          this.monster.set(monster);
          this.attackForm.reset({ name: '', description: '', harm: 0, weaponTagIds: [] });
          this.notificationService.success('Attack added.');
          this.errorMessage.set(null);
          this.activeMutation.set(null);
        },
        error: () => {
          this.errorMessage.set('Unable to add attack.');
          this.notificationService.error('Unable to add attack.');
          this.activeMutation.set(null);
        },
      });
  }

  requestDeleteAttack(attackId: string, name: string): void {
    this.pendingDelete.set({
      label: name,
      perform: () =>
        this.runAndRefresh(
          (monsterId) => this.monsterService.deleteAttack(monsterId, attackId),
          'Unable to delete attack.'
        ),
    });
  }

  createPower(): void {
    if (this.powerForm.invalid || !this.monster()) {
      this.powerForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMonsterPowerRequest = {
      name: this.powerForm.controls.name.value.trim(),
      description: this.toNullable(this.powerForm.controls.description.value),
    };

    this.runAndRefresh(
      (monsterId) => this.monsterService.createPower(monsterId, payload),
      'Unable to add power.',
      () => this.powerForm.reset({ name: '', description: '' }),
      'Power added.'
    );
  }

  requestDeletePower(powerId: string, name: string): void {
    this.pendingDelete.set({
      label: name,
      perform: () =>
        this.runAndRefresh(
          (monsterId) => this.monsterService.deletePower(monsterId, powerId),
          'Unable to delete power.'
        ),
    });
  }

  createArmor(): void {
    if (this.armorForm.invalid || !this.monster()) {
      this.armorForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMonsterArmorRequest = {
      name: this.armorForm.controls.name.value.trim(),
      description: this.toNullable(this.armorForm.controls.description.value),
      harmSoak: this.armorForm.controls.harmSoak.value,
      isSpecial: this.armorForm.controls.isSpecial.value,
      specialDescription: this.toNullable(this.armorForm.controls.specialDescription.value),
    };

    this.runAndRefresh(
      (monsterId) => this.monsterService.createArmor(monsterId, payload),
      'Unable to add armor.',
      () => this.armorForm.reset({ name: '', description: '', harmSoak: 0, isSpecial: false, specialDescription: '' }),
      'Armor added.'
    );
  }

  requestDeleteArmor(armorId: string, name: string): void {
    this.pendingDelete.set({
      label: name,
      perform: () =>
        this.runAndRefresh(
          (monsterId) => this.monsterService.deleteArmor(monsterId, armorId),
          'Unable to delete armor.'
        ),
    });
  }

  createWeakness(): void {
    if (this.weaknessForm.invalid || !this.monster()) {
      this.weaknessForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMonsterWeaknessRequest = {
      name: this.weaknessForm.controls.name.value.trim(),
      description: this.toNullable(this.weaknessForm.controls.description.value),
    };

    this.runAndRefresh(
      (monsterId) => this.monsterService.createWeakness(monsterId, payload),
      'Unable to add weakness.',
      () => this.weaknessForm.reset({ name: '', description: '' }),
      'Weakness added.'
    );
  }

  requestDeleteWeakness(weaknessId: string, name: string): void {
    this.pendingDelete.set({
      label: name,
      perform: () =>
        this.runAndRefresh(
          (monsterId) => this.monsterService.deleteWeakness(monsterId, weaknessId),
          'Unable to delete weakness.'
        ),
    });
  }

  private runAndRefresh(
    operation: (monsterId: string) => Observable<unknown>,
    errorMessage: string,
    onSuccess?: () => void,
    successMessage?: string
  ): void {
    if (!this.monster()) {
      return;
    }

    const monsterId = this.monster()!.id;
    this.activeMutation.set('Saving changes...');
    operation(monsterId)
      .pipe(
        switchMap(() => this.monsterService.getById(monsterId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (monster) => {
          this.monster.set(monster);
          onSuccess?.();
          this.errorMessage.set(null);
          this.activeMutation.set(null);
          this.notificationService.success(successMessage ?? 'Changes saved.');
        },
        error: () => {
          this.errorMessage.set(errorMessage);
          this.activeMutation.set(null);
          this.notificationService.error(errorMessage);
        },
      });
  }

  private toNullable(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  weaponTagNames(attack: MonsterAttackResponse): string {
    return attack.weaponTags.map((tag) => tag.name).join(', ');
  }

  onDeleteConfirmed(): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.perform();
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }
}
