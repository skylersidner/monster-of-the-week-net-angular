import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { MinionService } from '../../../../core/minion';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';
import {
  MinionDetailResponse,
  MinionAttackResponse,
  TypeRefResponse,
  UpsertMinionArmorRequest,
  UpsertMinionAttackRequest,
  UpsertMinionPowerRequest,
  UpsertMinionRequest,
  UpsertMinionWeaknessRequest,
  WeaponTagRefResponse,
} from '../../../../core/models';

@Component({
  selector: 'app-minion-detail',
  imports: [ReactiveFormsModule, RouterLink, CustomSelectComponent, WeaponTagSelectComponent, ConfirmDeleteModalComponent],
  templateUrl: './minion-detail.html',
  styleUrl: './minion-detail.scss',
})
export class MinionDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly minion = signal<MinionDetailResponse | null>(null);
  readonly minionTypes = signal<TypeRefResponse[]>([]);
  readonly weaponTags = signal<WeaponTagRefResponse[]>([]);
  readonly isLoading = signal(true);
  readonly activeMutation = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDelete = signal<{ label: string; perform: () => void } | null>(null);
  readonly isMutating = computed(() => this.activeMutation() !== null);

  readonly backLink = computed(() => ['/minions']);

  readonly minionForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    harmCapacity: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    minionTypeId: this.formBuilder.nonNullable.control(''),
  });

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
    private readonly minionService: MinionService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const minionId = params.get('minionId');
          if (!minionId) {
            throw new Error('Minion id is required.');
          }

          this.isLoading.set(true);
          this.errorMessage.set(null);

          return forkJoin({
            minion: this.minionService.getById(minionId),
            minionTypes: this.referenceDataService.getMinionTypes(),
            weaponTags: this.referenceDataService.getWeaponTags(),
          });
        })
      )
      .subscribe({
        next: ({ minion, minionTypes, weaponTags }) => {
          this.minion.set(minion);
          this.minionTypes.set(minionTypes);
          this.weaponTags.set(weaponTags);
          this.populateMinionForm(minion);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load minion details.');
          this.isLoading.set(false);
        },
      });
  }

  saveMinion(): void {
    if (this.minionForm.invalid || !this.minion()) {
      this.minionForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMinionRequest = {
      name: this.minionForm.controls.name.value.trim(),
      description: this.toNullable(this.minionForm.controls.description.value),
      harmCapacity: this.minionForm.controls.harmCapacity.value,
      minionTypeId: this.minionForm.controls.minionTypeId.value,
    };

    this.activeMutation.set('Saving minion...');

    this.minionService
      .update(this.minion()!.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (minion) => {
          this.minion.set(minion);
          this.populateMinionForm(minion);
          this.activeMutation.set(null);
          this.notificationService.success('Minion details saved.');
          this.errorMessage.set(null);
        },
        error: () => {
          this.activeMutation.set(null);
          this.errorMessage.set('Unable to save minion details.');
          this.notificationService.error('Unable to save minion details.');
        },
      });
  }

  createAttack(): void {
    if (this.attackForm.invalid || !this.minion()) {
      this.attackForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMinionAttackRequest = {
      name: this.attackForm.controls.name.value.trim(),
      description: this.toNullable(this.attackForm.controls.description.value),
      harm: this.attackForm.controls.harm.value,
    };

    const selectedTagIds = this.attackForm.controls.weaponTagIds.value;
    const minionId = this.minion()!.id;
    this.activeMutation.set('Adding attack...');

    this.minionService
      .createAttack(minionId, payload)
      .pipe(
        switchMap((attack) => {
          if (selectedTagIds.length === 0) {
            return of(attack);
          }

          return forkJoin(
            selectedTagIds.map((tagId) => this.minionService.assignAttackWeaponTag(minionId, attack.id, tagId))
          ).pipe(switchMap(() => of(attack)));
        }),
        switchMap(() => this.minionService.getById(minionId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (minion) => {
          this.minion.set(minion);
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
          (minionId) => this.minionService.deleteAttack(minionId, attackId),
          'Unable to delete attack.'
        ),
    });
  }

  createPower(): void {
    if (this.powerForm.invalid || !this.minion()) {
      this.powerForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMinionPowerRequest = {
      name: this.powerForm.controls.name.value.trim(),
      description: this.toNullable(this.powerForm.controls.description.value),
    };

    this.runAndRefresh(
      (minionId) => this.minionService.createPower(minionId, payload),
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
          (minionId) => this.minionService.deletePower(minionId, powerId),
          'Unable to delete power.'
        ),
    });
  }

  createArmor(): void {
    if (this.armorForm.invalid || !this.minion()) {
      this.armorForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMinionArmorRequest = {
      name: this.armorForm.controls.name.value.trim(),
      description: this.toNullable(this.armorForm.controls.description.value),
      harmSoak: this.armorForm.controls.harmSoak.value,
      isSpecial: this.armorForm.controls.isSpecial.value,
      specialDescription: this.toNullable(this.armorForm.controls.specialDescription.value),
    };

    this.runAndRefresh(
      (minionId) => this.minionService.createArmor(minionId, payload),
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
          (minionId) => this.minionService.deleteArmor(minionId, armorId),
          'Unable to delete armor.'
        ),
    });
  }

  createWeakness(): void {
    if (this.weaknessForm.invalid || !this.minion()) {
      this.weaknessForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMinionWeaknessRequest = {
      name: this.weaknessForm.controls.name.value.trim(),
      description: this.toNullable(this.weaknessForm.controls.description.value),
    };

    this.runAndRefresh(
      (minionId) => this.minionService.createWeakness(minionId, payload),
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
          (minionId) => this.minionService.deleteWeakness(minionId, weaknessId),
          'Unable to delete weakness.'
        ),
    });
  }

  private runAndRefresh(
    operation: (minionId: string) => Observable<unknown>,
    errorMessage: string,
    onSuccess?: () => void,
    successMessage?: string
  ): void {
    if (!this.minion()) {
      return;
    }

    const minionId = this.minion()!.id;
    this.activeMutation.set('Saving changes...');
    operation(minionId)
      .pipe(
        switchMap(() => this.minionService.getById(minionId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (minion) => {
          this.minion.set(minion);
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

  private populateMinionForm(minion: MinionDetailResponse): void {
    this.minionForm.reset({
      name: minion.name,
      description: minion.description ?? '',
      harmCapacity: minion.harmCapacity,
      minionTypeId: minion.minionType.id,
    });
  }

  private toNullable(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  weaponTagNames(attack: MinionAttackResponse): string {
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
