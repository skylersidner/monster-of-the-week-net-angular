import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';
import { MonsterFormComponent } from '../../shared/monster-form/monster-form';
import {
  MonsterArchetypeResponse,
  MysteryListItemResponse,
  TypeRefResponse,
  UpsertMonsterRequest,
  WeaponTagRefResponse,
} from '../../../../core/models';

/**
 * Local, page-scoped sub-resource drafts. These mirror the corresponding
 * `UpsertMonster*Request` contracts field-for-field (plus `weaponTagIds` on an attack,
 * which is assigned through a separate call once the attack exists).
 *
 * Deliberately *not* imported from the mystery-creation wizard, and deliberately
 * without an `id` field: a fresh create page always starts with zero existing
 * sub-resources, so there is no baseline to diff against on submit.
 */
export interface AttackDraft {
  name: string;
  description: string | null;
  harm: number;
  weaponTagIds: string[];
}

export interface PowerDraft {
  name: string;
  description: string | null;
}

export interface ArmorDraft {
  name: string;
  description: string | null;
  harmSoak: number;
  isSpecial: boolean;
  specialDescription: string | null;
}

export interface WeaknessDraft {
  name: string;
  description: string | null;
}

@Component({
  selector: 'app-monster-create',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MonsterFormComponent,
    CustomSelectComponent,
    WeaponTagSelectComponent,
  ],
  templateUrl: './monster-create.html',
})
export class MonsterCreateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly monsterTypes = signal<TypeRefResponse[]>([]);
  readonly monsterArchetypes = signal<MonsterArchetypeResponse[]>([]);
  readonly weaponTags = signal<WeaponTagRefResponse[]>([]);
  readonly mysteries = signal<MysteryListItemResponse[]>([]);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly attackDrafts = signal<AttackDraft[]>([]);
  readonly powerDrafts = signal<PowerDraft[]>([]);
  readonly armorDrafts = signal<ArmorDraft[]>([]);
  readonly weaknessDrafts = signal<WeaknessDraft[]>([]);

  /** Optional "attach to mystery" picker. Blank is the valid "create unattached" path. */
  readonly mysteryControl = this.formBuilder.nonNullable.control('');

  readonly attackDraftForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    harm: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    weaponTagIds: this.formBuilder.nonNullable.control<string[]>([]),
  });

  readonly powerDraftForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
  });

  readonly armorDraftForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    harmSoak: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    isSpecial: this.formBuilder.nonNullable.control(false),
    specialDescription: this.formBuilder.control(''),
  });

  readonly weaknessDraftForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
  });

  constructor(
    private readonly router: Router,
    private readonly monsterService: MonsterService,
    private readonly mysteryService: MysteryService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    forkJoin({
      monsterTypes: this.referenceDataService.getMonsterTypes(),
      monsterArchetypes: this.referenceDataService.getMonsterArchetypes(),
      weaponTags: this.referenceDataService.getWeaponTags(),
      mysteries: this.mysteryService.getMysteries(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ monsterTypes, monsterArchetypes, weaponTags, mysteries }) => {
          this.monsterTypes.set(monsterTypes);
          this.monsterArchetypes.set(monsterArchetypes);
          this.weaponTags.set(weaponTags);
          this.mysteries.set(mysteries);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load reference data.');
          this.isLoading.set(false);
        },
      });

    // Special Description is only required while Is Special is checked - UI-only rule,
    // the server continues to accept a null SpecialDescription regardless.
    this.armorDraftForm.controls.isSpecial.valueChanges
      .pipe(startWith(this.armorDraftForm.controls.isSpecial.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((isSpecial) => {
        const specialDescription = this.armorDraftForm.controls.specialDescription;
        specialDescription.setValidators(isSpecial ? [Validators.required] : []);
        specialDescription.updateValueAndValidity({ emitEvent: false });
      });
  }

  // --- Sub-resource drafts: local only, never an API call ---------------------

  addAttackDraft(): void {
    if (this.attackDraftForm.invalid) {
      this.attackDraftForm.markAllAsTouched();
      return;
    }

    this.attackDrafts.update((drafts) => [
      ...drafts,
      {
        name: this.attackDraftForm.controls.name.value.trim(),
        description: this.toNullable(this.attackDraftForm.controls.description.value),
        harm: this.attackDraftForm.controls.harm.value,
        weaponTagIds: this.attackDraftForm.controls.weaponTagIds.value.filter((id) => id.length > 0),
      },
    ]);

    this.attackDraftForm.reset({ name: '', description: '', harm: 0, weaponTagIds: [] });
  }

  removeAttackDraft(index: number): void {
    this.attackDrafts.update((drafts) => drafts.filter((_, i) => i !== index));
  }

  addPowerDraft(): void {
    if (this.powerDraftForm.invalid) {
      this.powerDraftForm.markAllAsTouched();
      return;
    }

    this.powerDrafts.update((drafts) => [
      ...drafts,
      {
        name: this.powerDraftForm.controls.name.value.trim(),
        description: this.toNullable(this.powerDraftForm.controls.description.value),
      },
    ]);

    this.powerDraftForm.reset({ name: '', description: '' });
  }

  removePowerDraft(index: number): void {
    this.powerDrafts.update((drafts) => drafts.filter((_, i) => i !== index));
  }

  addArmorDraft(): void {
    if (this.armorDraftForm.invalid) {
      this.armorDraftForm.markAllAsTouched();
      return;
    }

    this.armorDrafts.update((drafts) => [
      ...drafts,
      {
        name: this.armorDraftForm.controls.name.value.trim(),
        description: this.toNullable(this.armorDraftForm.controls.description.value),
        harmSoak: this.armorDraftForm.controls.harmSoak.value,
        isSpecial: this.armorDraftForm.controls.isSpecial.value,
        specialDescription: this.toNullable(this.armorDraftForm.controls.specialDescription.value),
      },
    ]);

    this.armorDraftForm.reset({
      name: '',
      description: '',
      harmSoak: 0,
      isSpecial: false,
      specialDescription: '',
    });
  }

  removeArmorDraft(index: number): void {
    this.armorDrafts.update((drafts) => drafts.filter((_, i) => i !== index));
  }

  addWeaknessDraft(): void {
    if (this.weaknessDraftForm.invalid) {
      this.weaknessDraftForm.markAllAsTouched();
      return;
    }

    this.weaknessDrafts.update((drafts) => [
      ...drafts,
      {
        name: this.weaknessDraftForm.controls.name.value.trim(),
        description: this.toNullable(this.weaknessDraftForm.controls.description.value),
      },
    ]);

    this.weaknessDraftForm.reset({ name: '', description: '' });
  }

  removeWeaknessDraft(index: number): void {
    this.weaknessDrafts.update((drafts) => drafts.filter((_, i) => i !== index));
  }

  tagsForAttack(weaponTagIds: string[]): WeaponTagRefResponse[] {
    return this.weaponTags().filter((tag) => weaponTagIds.includes(tag.id));
  }

  // --- The single page-level submit -------------------------------------------

  /**
   * Emitted by `MonsterFormComponent` only once its own validation has passed, so no
   * core-field validity check is needed here.
   */
  onCreate(payload: UpsertMonsterRequest): void {
    const mysteryId = this.mysteryControl.value;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const create$ = mysteryId
      ? this.monsterService.create(mysteryId, payload)
      : this.monsterService.createStandalone(payload);

    create$
      .pipe(
        switchMap((monster) =>
          // The monster now exists. A failure past this point must not look like a
          // total failure, so it is caught here rather than reaching the error handler.
          this.saveSubResourceDrafts(monster.id).pipe(
            map(() => ({ monsterId: monster.id, draftsFailed: false })),
            catchError(() => of({ monsterId: monster.id, draftsFailed: true }))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ monsterId, draftsFailed }) => {
          this.isSaving.set(false);

          if (draftsFailed) {
            this.notificationService.error(
              'Monster created, but some details may not have saved. Review them on the monster page.'
            );
          } else {
            this.notificationService.success('Monster created.');
          }

          void this.router.navigate(this.detailLink(monsterId, mysteryId));
        },
        error: () => {
          this.isSaving.set(false);
          this.errorMessage.set('Unable to create monster.');
          this.notificationService.error('Unable to create monster.');
        },
      });
  }

  private detailLink(monsterId: string, mysteryId: string): unknown[] {
    return mysteryId ? ['/mysteries', mysteryId, 'monsters', monsterId] : ['/monsters', monsterId];
  }

  /**
   * Batch-creates every drafted sub-resource against the now-real monster id. Each
   * created attack chains its weapon-tag assignments; an empty draft array short-circuits
   * instead of firing an empty `forkJoin`.
   */
  private saveSubResourceDrafts(monsterId: string): Observable<unknown> {
    return forkJoin({
      attacks: this.runBatch(
        this.attackDrafts().map((attack) =>
          this.monsterService
            .createAttack(monsterId, {
              name: attack.name,
              description: attack.description,
              harm: attack.harm,
            })
            .pipe(
              switchMap((createdAttack) => {
                if (attack.weaponTagIds.length === 0) {
                  return of(createdAttack);
                }

                return forkJoin(
                  attack.weaponTagIds.map((weaponTagId) =>
                    this.monsterService.assignAttackWeaponTag(monsterId, createdAttack.id, weaponTagId)
                  )
                ).pipe(switchMap(() => of(createdAttack)));
              })
            )
        )
      ),
      powers: this.runBatch(
        this.powerDrafts().map((power) =>
          this.monsterService.createPower(monsterId, {
            name: power.name,
            description: power.description,
          })
        )
      ),
      armors: this.runBatch(
        this.armorDrafts().map((armor) =>
          this.monsterService.createArmor(monsterId, {
            name: armor.name,
            description: armor.description,
            harmSoak: armor.harmSoak,
            isSpecial: armor.isSpecial,
            specialDescription: armor.specialDescription,
          })
        )
      ),
      weaknesses: this.runBatch(
        this.weaknessDrafts().map((weakness) =>
          this.monsterService.createWeakness(monsterId, {
            name: weakness.name,
            description: weakness.description,
          })
        )
      ),
    });
  }

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }

  private toNullable(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
