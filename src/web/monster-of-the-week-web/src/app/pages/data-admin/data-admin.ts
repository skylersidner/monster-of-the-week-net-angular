import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CreateTypeRefRequest,
  NameDescriptionTable,
  ReferenceTypeTable,
  TypeRefResponse,
  TypeRefTable,
} from '../../core/models';
import { NotificationService } from '../../core/notifications';
import { ReferenceDataService } from '../../core/reference-data';
import { CustomSelectComponent } from '../../shared/custom-select.component';
import { NameDescriptionAdminComponent } from './components/name-description-admin/name-description-admin';
import { PlaybookAdminComponent } from './components/playbook-admin/playbook-admin';

interface ReferenceTypeOption {
  readonly table: ReferenceTypeTable;
  readonly label: string;
}

/**
 * Which top-level section of the Data Admin page is showing. Client-side state on the
 * existing `/data-admin` route rather than a router child — there is no deep-linking need
 * for "which Data Admin tab" the way there is for a domain detail page, and this page is a
 * `pages/` cross-cutting view, not a `features/*` vertical with CRUD-per-route.
 * See docs/hunter-playbooks/architecture.md Section 5.
 *
 * A discriminated union rather than the `isShowingUserMenu`-style boolean signals in
 * `page-layout.ts`: those are independent toggles that can both be on, whereas tabs are
 * mutually exclusive, so one signal holding the active tab makes an invalid state
 * unrepresentable and extends to a third tab without a second boolean to keep in sync.
 */
export type DataAdminTab = 'types' | 'playbooks';

interface DataAdminTabOption {
  readonly tab: DataAdminTab;
  readonly label: string;
}

@Component({
  selector: 'app-data-admin-page',
  imports: [ReactiveFormsModule, CustomSelectComponent, NameDescriptionAdminComponent, PlaybookAdminComponent],
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
    { table: ReferenceTypeTable.AdventureTypes, label: 'Adventure Types' },
    { table: ReferenceTypeTable.MonsterArchetypes, label: 'Monster Archetypes' },
    { table: ReferenceTypeTable.WeaponTags, label: 'Weapon Tags' },
  ];

  readonly referenceTypeOptionValue = (option: ReferenceTypeOption): string => option.table;
  readonly referenceTypeOptionLabel = (option: ReferenceTypeOption): string => option.label;

  readonly tabs: readonly DataAdminTabOption[] = [
    { tab: 'types', label: 'Types' },
    { tab: 'playbooks', label: 'Playbooks' },
  ];

  readonly activeTab = signal<DataAdminTab>('types');

  selectTab(tab: DataAdminTab): void {
    this.activeTab.set(tab);
  }

  /**
   * Roving-focus keyboard support for the tablist. Claiming `role="tablist"`/`role="tab"`
   * without arrow-key navigation would be worse than not claiming it at all — assistive
   * technology announces the widget as a tablist and users then expect arrows to move
   * between tabs. Home/End included for the same reason.
   */
  onTabKeydown(event: KeyboardEvent, index: number): void {
    const lastIndex = this.tabs.length - 1;
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = index === lastIndex ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        nextIndex = index === 0 ? lastIndex : index - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.selectTab(this.tabs[nextIndex].tab);
    const target = event.target as HTMLElement;
    const nextTab = target.parentElement?.children.item(nextIndex);
    if (nextTab instanceof HTMLElement) {
      nextTab.focus();
    }
  }

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

  /**
   * The selected table when it is one of the Name + Description tables, otherwise `null`.
   * The template branches on this once and hands the table to `app-name-description-admin`,
   * so a new table of that shape needs no new branch here.
   */
  selectedNameDescriptionTable(): NameDescriptionTable | null {
    const table = this.form.controls.referenceTypeTable.value;
    return this.isTypeRefTable(table) ? null : table;
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

  private isTypeRefTable(table: ReferenceTypeTable): table is TypeRefTable {
    return !this.isNameDescriptionTable(table);
  }

  /**
   * Exhaustive on purpose: with `noImplicitReturns`, adding a member to
   * `ReferenceTypeTable` without classifying it here fails the build, so a new table can
   * never silently fall through to the wrong form.
   */
  private isNameDescriptionTable(table: ReferenceTypeTable): table is NameDescriptionTable {
    switch (table) {
      case ReferenceTypeTable.WeaponTags:
      case ReferenceTypeTable.AdventureTypes:
      case ReferenceTypeTable.MonsterArchetypes:
        return true;
      case ReferenceTypeTable.MonsterTypes:
      case ReferenceTypeTable.MinionTypes:
      case ReferenceTypeTable.LocationTypes:
      case ReferenceTypeTable.BystanderTypes:
        return false;
    }
  }
}
