import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateWeaponTagRequest, WeaponTagRefResponse } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';

@Component({
  selector: 'app-weapon-tag-admin',
  imports: [ReactiveFormsModule],
  templateUrl: './weapon-tag-admin.html',
  styleUrl: './weapon-tag-admin.scss',
})
export class WeaponTagAdminComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly hasSubmitted = signal(false);
  readonly isSaving = signal(false);
  readonly isLoadingWeaponTags = signal(false);
  readonly weaponTagsLoadError = signal<string | null>(null);
  readonly weaponTags = signal<WeaponTagRefResponse[]>([]);
  readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    description: this.formBuilder.nonNullable.control('', [Validators.required, Validators.minLength(10)]),
  });

  constructor(
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadWeaponTags();
  }

  canSave(): boolean {
    return (
      this.form.controls.name.value.trim().length > 0 &&
      this.form.controls.description.value.trim().length > 0 &&
      !this.isSaving()
    );
  }

  shouldShowNameValidationError(): boolean {
    return this.hasSubmitted() && this.form.controls.name.invalid;
  }

  shouldShowDescriptionValidationError(): boolean {
    return this.hasSubmitted() && this.form.controls.description.invalid;
  }

  saveWeaponTag(): void {
    this.hasSubmitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: CreateWeaponTagRequest = {
      name: this.form.controls.name.value.trim(),
      description: this.form.controls.description.value.trim(),
    };

    this.isSaving.set(true);
    this.referenceDataService
      .createWeaponTag(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.hasSubmitted.set(false);
          this.form.controls.name.reset('');
          this.form.controls.description.reset('');
          this.loadWeaponTags();
          this.notificationService.success(`Weapon tag "${created.name}" created.`);
        },
        error: () => {
          this.isSaving.set(false);
          this.notificationService.error('Unable to save weapon tag entry.');
        },
      });
  }

  private loadWeaponTags(): void {
    this.isLoadingWeaponTags.set(true);
    this.weaponTagsLoadError.set(null);
    this.referenceDataService
      .getWeaponTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (records) => {
          this.weaponTags.set(records);
          this.isLoadingWeaponTags.set(false);
        },
        error: () => {
          this.weaponTags.set([]);
          this.weaponTagsLoadError.set('Unable to load weapon tags.');
          this.isLoadingWeaponTags.set(false);
        },
      });
  }
}
