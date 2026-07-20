import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateTypeRefRequest, ReferenceTypeTable, TypeRefResponse } from '../../core/models';
import { NotificationService } from '../../core/notifications';
import { ReferenceDataService } from '../../core/reference-data';
import { WeaponTagAdminComponent } from './components/weapon-tag-admin/weapon-tag-admin';

interface ReferenceTypeOption {
  readonly table: ReferenceTypeTable;
  readonly label: string;
}

@Component({
  selector: 'app-data-admin-page',
  imports: [ReactiveFormsModule, WeaponTagAdminComponent],
  templateUrl: './data-admin.html',
  styleUrl: './data-admin.scss',
})
export class DataAdminPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly referenceTypeOptions: readonly ReferenceTypeOption[] = [
    { table: ReferenceTypeTable.MonsterTypes, label: 'Monster Types' },
    { table: ReferenceTypeTable.MinionTypes, label: 'Minion Types' },
    { table: ReferenceTypeTable.LocationTypes, label: 'Location Types' },
    { table: ReferenceTypeTable.BystanderTypes, label: 'Bystander Types' },
    { table: ReferenceTypeTable.WeaponTags, label: 'Weapon Tags' },
  ];

  readonly hasSubmitted = signal(false);
  readonly isSaving = signal(false);
  readonly isLoadingTypes = signal(false);
  readonly recordsLoadError = signal<string | null>(null);
  readonly selectedTypeRecords = signal<TypeRefResponse[]>([]);
  readonly form = this.formBuilder.group({
    referenceTypeTable: this.formBuilder.nonNullable.control(ReferenceTypeTable.MonsterTypes),
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    motivation: this.formBuilder.nonNullable.control('', [Validators.required, Validators.minLength(10)]),
  });

  constructor(
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSelectedTableRecords(this.form.controls.referenceTypeTable.value);
    this.form.controls.referenceTypeTable.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((table) => {
      this.hasSubmitted.set(false);
      this.loadSelectedTableRecords(table);
    });
  }

  canSave(): boolean {
    return (
      this.form.controls.name.value.trim().length > 0 &&
      this.form.controls.motivation.value.trim().length > 0 &&
      !this.isSaving()
    );
  }

  saveReferenceType(): void {
    if (!this.isTypeRefTable(this.form.controls.referenceTypeTable.value)) {
      return;
    }

    this.hasSubmitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: CreateTypeRefRequest = {
      name: this.form.controls.name.value.trim(),
      motivation: this.form.controls.motivation.value.trim(),
    };

    this.isSaving.set(true);
    this.referenceDataService
      .createType(this.form.controls.referenceTypeTable.value, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.hasSubmitted.set(false);
          this.form.controls.name.reset('');
          this.form.controls.motivation.reset('');
          this.loadSelectedTableRecords(this.form.controls.referenceTypeTable.value);
          this.notificationService.success(
            `${this.getReferenceTypeLabel(this.form.controls.referenceTypeTable.value)} entry "${created.name}" created.`
          );
        },
        error: () => {
          this.isSaving.set(false);
          this.notificationService.error('Unable to save reference type entry.');
        },
      });
  }

  shouldShowNameValidationError(): boolean {
    return this.hasSubmitted() && this.form.controls.name.invalid;
  }

  shouldShowMotivationValidationError(): boolean {
    return this.hasSubmitted() && this.form.controls.motivation.invalid;
  }

  isWeaponTagSelected(): boolean {
    return this.form.controls.referenceTypeTable.value === ReferenceTypeTable.WeaponTags;
  }

  private getReferenceTypeLabel(table: ReferenceTypeTable): string {
    return this.referenceTypeOptions.find((option) => option.table === table)?.label ?? 'Reference Type';
  }

  private loadSelectedTableRecords(table: ReferenceTypeTable): void {
    if (!this.isTypeRefTable(table)) {
      this.selectedTypeRecords.set([]);
      this.recordsLoadError.set(null);
      this.isLoadingTypes.set(false);
      return;
    }

    this.isLoadingTypes.set(true);
    this.recordsLoadError.set(null);
    this.referenceDataService
      .getTypesByTable(table)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (records) => {
          this.selectedTypeRecords.set(records);
          this.isLoadingTypes.set(false);
        },
        error: () => {
          this.selectedTypeRecords.set([]);
          this.recordsLoadError.set('Unable to load records for the selected type.');
          this.isLoadingTypes.set(false);
        },
      });
  }

  private isTypeRefTable(table: ReferenceTypeTable): table is Exclude<ReferenceTypeTable, ReferenceTypeTable.WeaponTags> {
    return table !== ReferenceTypeTable.WeaponTags;
  }
}
