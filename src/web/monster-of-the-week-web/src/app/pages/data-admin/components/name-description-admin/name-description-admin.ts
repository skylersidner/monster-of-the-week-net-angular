import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CreateNameDescriptionRequest,
  NameDescriptionRefResponse,
  NameDescriptionTable,
  ReferenceTypeTable,
} from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';

/**
 * Everything that differs between the three Name + Description reference tables. Adding a
 * fourth such table means adding one entry here plus one case in
 * `ReferenceDataService.getNameDescriptionsByTable`/`createNameDescription` — no new
 * component and no new branch in `DataAdminPageComponent`.
 */
interface NameDescriptionTableDescriptor {
  /** Sentence-initial singular, e.g. `Weapon tag "Messy" created.` */
  readonly singular: string;
  /** Lower-case plural, e.g. `Unable to load weapon tags.` */
  readonly plural: string;
  /**
   * Mirrors the server's `[MinLength]` on Description. Deliberately per-table and NOT a
   * shared constant: `CreateWeaponTagRefRequest.Description` requires 10 characters while
   * the adventure-type and monster-archetype requests require 5.
   */
  readonly descriptionMinLength: number;
}

const TABLE_DESCRIPTORS: Readonly<Record<NameDescriptionTable, NameDescriptionTableDescriptor>> = {
  [ReferenceTypeTable.WeaponTags]: { singular: 'Weapon tag', plural: 'weapon tags', descriptionMinLength: 10 },
  [ReferenceTypeTable.AdventureTypes]: {
    singular: 'Adventure type',
    plural: 'adventure types',
    descriptionMinLength: 5,
  },
  [ReferenceTypeTable.MonsterArchetypes]: {
    singular: 'Monster archetype',
    plural: 'monster archetypes',
    descriptionMinLength: 5,
  },
};

/** Server-side `[MinLength]` on Name, identical across all three tables. */
const NAME_MIN_LENGTH = 3;

/**
 * Create form + "Current Records" list for any reference table shaped Name + Description
 * (weapon tags, adventure types, monster archetypes), as opposed to the Name + Motivation
 * tables that `DataAdminPageComponent` renders inline.
 */
@Component({
  selector: 'app-name-description-admin',
  imports: [ReactiveFormsModule],
  templateUrl: './name-description-admin.html',
  styleUrl: './name-description-admin.scss',
})
export class NameDescriptionAdminComponent implements OnChanges {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  /** Any change to this input clears the form and reloads the record list. */
  @Input({ required: true }) table!: NameDescriptionTable;

  readonly hasSubmitted = signal(false);
  readonly isSaving = signal(false);
  readonly isLoadingRecords = signal(false);
  readonly recordsLoadError = signal<string | null>(null);
  readonly records = signal<NameDescriptionRefResponse[]>([]);
  readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.minLength(NAME_MIN_LENGTH)]),
    description: this.formBuilder.nonNullable.control('', [Validators.required]),
  });

  constructor(
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['table']) {
      this.hasSubmitted.set(false);
      this.form.controls.name.reset('');
      this.form.controls.description.reset('');
      this.applyDescriptionValidators();
      this.loadRecords();
    }
  }

  nameMinLength(): number {
    return NAME_MIN_LENGTH;
  }

  descriptionMinLength(): number {
    return this.descriptor().descriptionMinLength;
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

  saveRecord(): void {
    this.hasSubmitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: CreateNameDescriptionRequest = {
      name: this.form.controls.name.value.trim(),
      description: this.form.controls.description.value.trim(),
    };

    this.isSaving.set(true);
    this.referenceDataService
      .createNameDescription(this.table, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.hasSubmitted.set(false);
          this.form.controls.name.reset('');
          this.form.controls.description.reset('');
          this.loadRecords();
          this.notificationService.success(`${this.descriptor().singular} "${created.name}" created.`);
        },
        error: () => {
          this.isSaving.set(false);
          this.notificationService.error(`Unable to save ${this.descriptor().singular.toLowerCase()} entry.`);
        },
      });
  }

  private descriptor(): NameDescriptionTableDescriptor {
    return TABLE_DESCRIPTORS[this.table];
  }

  private applyDescriptionValidators(): void {
    this.form.controls.description.setValidators([
      Validators.required,
      Validators.minLength(this.descriptionMinLength()),
    ]);
    this.form.controls.description.updateValueAndValidity({ emitEvent: false });
  }

  private loadRecords(): void {
    this.isLoadingRecords.set(true);
    this.recordsLoadError.set(null);
    this.referenceDataService
      .getNameDescriptionsByTable(this.table)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (records) => {
          this.records.set(records);
          this.isLoadingRecords.set(false);
        },
        error: () => {
          this.records.set([]);
          this.recordsLoadError.set(`Unable to load ${this.descriptor().plural}.`);
          this.isLoadingRecords.set(false);
        },
      });
  }
}
