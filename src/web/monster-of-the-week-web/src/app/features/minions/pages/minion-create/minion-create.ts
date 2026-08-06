import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';
import { MinionFormComponent } from '../../shared/minion-form/minion-form';
import {
  MonsterListItemResponse,
  TypeRefResponse,
  UpsertMinionRequest,
  WeaponTagRefResponse,
} from '../../../../core/models';

/**
 * Local, page-scoped sub-resource drafts. These mirror the corresponding
 * `UpsertMinion*Request` contracts field-for-field (plus `weaponTagIds` on an attack,
 * which is assigned through a separate call once the attack exists).
 *
 * Deliberately declared here rather than imported from `monster-create.ts` or the
 * mystery wizard: they are driven by the `UpsertMinion*Request` contracts, not the
 * monster ones. No `id` field — a fresh create page has no baseline to diff against.
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

/**
 * One create page, two routes (Resolved Decision 5 / Open Question 1 — Option C):
 *
 * - `/monsters/:monsterId/minions/new` — the monster is locked from the route param.
 *   No dropdown is rendered; the monster's name is shown as fixed text.
 * - `/minions/new` — no route param, so a *required* monster dropdown is rendered.
 *   Unlike the monster page's optional mystery picker there is no valid blank state:
 *   `Minion.MonsterId` is a non-nullable FK, a minion cannot exist without a monster.
 *
 * Either way the resolved `monsterId` never reaches `MinionFormComponent` — it is not a
 * field on `UpsertMinionRequest` — so this page validates it itself before submitting.
 */
@Component({
  selector: 'app-minion-create',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MinionFormComponent,
    CustomSelectComponent,
    WeaponTagSelectComponent,
  ],
  templateUrl: './minion-create.html',
})
export class MinionCreateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly minionTypes = signal<TypeRefResponse[]>([]);
  readonly weaponTags = signal<WeaponTagRefResponse[]>([]);
  readonly monsters = signal<MonsterListItemResponse[]>([]);

  /** Set only when reached at `/monsters/:monsterId/minions/new`. */
  readonly routeMonsterId = signal<string | null>(null);
  /** Display-only name of the locked monster; `null` at the top-level route. */
  readonly lockedMonsterName = signal<string | null>(null);
  readonly isMonsterLocked = computed(() => this.routeMonsterId() !== null);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly attackDrafts = signal<AttackDraft[]>([]);
  readonly powerDrafts = signal<PowerDraft[]>([]);
  readonly armorDrafts = signal<ArmorDraft[]>([]);
  readonly weaknessDrafts = signal<WeaknessDraft[]>([]);

  /**
   * Required monster picker, rendered only at `/minions/new`. `MinionFormComponent`
   * cannot see it, so `onCreate` validates it directly rather than relying on the
   * shared form's own submit guard.
   */
  readonly monsterControl = this.formBuilder.nonNullable.control('', [Validators.required]);

  readonly backLink = computed(() =>
    this.isMonsterLocked() ? ['/monsters', this.routeMonsterId()!] : ['/minions']
  );
  readonly backLabel = computed(() =>
    this.isMonsterLocked() ? '← Back to monster' : '← Back to minions'
  );

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
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly minionService: MinionService,
    private readonly monsterService: MonsterService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const monsterId = params.get('monsterId');
          this.routeMonsterId.set(monsterId);
          this.isLoading.set(true);
          this.errorMessage.set(null);

          return forkJoin({
            minionTypes: this.referenceDataService.getMinionTypes(),
            weaponTags: this.referenceDataService.getWeaponTags(),
            // Locked entry: one monster, for display only. Top-level entry: every
            // monster, as the required dropdown's options.
            lockedMonster: monsterId ? this.monsterService.getById(monsterId) : of(null),
            monsters: monsterId
              ? of<MonsterListItemResponse[]>([])
              : this.monsterService.getAll(),
          });
        })
      )
      .subscribe({
        next: ({ minionTypes, weaponTags, lockedMonster, monsters }) => {
          this.minionTypes.set(minionTypes);
          this.weaponTags.set(weaponTags);
          this.lockedMonsterName.set(lockedMonster?.name ?? null);
          this.monsters.set(monsters);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load reference data.');
          this.isLoading.set(false);
        },
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
   * Emitted by `MinionFormComponent` once its own validation has passed, so the core
   * fields need no re-checking here. The monster, however, is invisible to that
   * component — it is not a field on `UpsertMinionRequest` — so it is validated here
   * before anything touches the API.
   */
  onCreate(payload: UpsertMinionRequest): void {
    const monsterId = this.effectiveMonsterId();

    if (!monsterId) {
      this.monsterControl.markAsTouched();
      this.errorMessage.set('Choose which monster this minion belongs to.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.minionService
      .create(monsterId, payload)
      .pipe(
        switchMap((minion) =>
          // The minion now exists. A failure past this point must not look like a
          // total failure, so it is caught here rather than reaching the error handler.
          this.saveSubResourceDrafts(minion.id).pipe(
            map(() => ({ minionId: minion.id, draftsFailed: false })),
            catchError(() => of({ minionId: minion.id, draftsFailed: true }))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ minionId, draftsFailed }) => {
          this.isSaving.set(false);

          if (draftsFailed) {
            this.notificationService.error(
              'Minion created, but some details may not have saved. Review them on the minion page.'
            );
          } else {
            this.notificationService.success('Minion created.');
          }

          // Always the monster-scoped shape (Resolved Decision 9), regardless of which
          // entry point was used — it gives the detail page its richest back-link.
          void this.router.navigate(['/monsters', monsterId, 'minions', minionId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.errorMessage.set('Unable to create minion.');
          this.notificationService.error('Unable to create minion.');
        },
      });
  }

  /** Route param when the monster is locked, dropdown selection otherwise. */
  private effectiveMonsterId(): string | null {
    const routeMonsterId = this.routeMonsterId();
    if (routeMonsterId) {
      return routeMonsterId;
    }

    const selected = this.monsterControl.value;
    return selected.length > 0 ? selected : null;
  }

  /**
   * Batch-creates every drafted sub-resource against the now-real minion id. Each
   * created attack chains its weapon-tag assignments; an empty draft array short-circuits
   * instead of firing an empty `forkJoin`.
   */
  private saveSubResourceDrafts(minionId: string): Observable<unknown> {
    return forkJoin({
      attacks: this.runBatch(
        this.attackDrafts().map((attack) =>
          this.minionService
            .createAttack(minionId, {
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
                    this.minionService.assignAttackWeaponTag(minionId, createdAttack.id, weaponTagId)
                  )
                ).pipe(switchMap(() => of(createdAttack)));
              })
            )
        )
      ),
      powers: this.runBatch(
        this.powerDrafts().map((power) =>
          this.minionService.createPower(minionId, {
            name: power.name,
            description: power.description,
          })
        )
      ),
      armors: this.runBatch(
        this.armorDrafts().map((armor) =>
          this.minionService.createArmor(minionId, {
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
          this.minionService.createWeakness(minionId, {
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
