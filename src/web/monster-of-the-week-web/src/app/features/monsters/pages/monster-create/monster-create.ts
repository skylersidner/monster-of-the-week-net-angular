import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';
import {
  CustomMoveCommit,
  CustomMoveRow,
  CustomMovesCardComponent,
} from '../../../../shared/custom-moves-card.component';
import { CustomMoveService, createCustomMoveDraftKey } from '../../../../core/custom-moves';
import { MonsterFormComponent, MonsterFormSubmit } from '../../shared/monster-form/monster-form';
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

/**
 * A staged custom move. Same three fields as `PowerDraft` plus the client key the card tracks rows
 * by, and deliberately **not** the wizard's `CustomMoveDraft extends SubResourceIdentity`: that one
 * carries `id: string | null` because the wizard diffs against a hydrated baseline, and a fresh
 * create page has none. Two draft types with the same fields and different identity semantics is
 * already the situation for powers and weaknesses, and is correct for the same reason.
 */
export interface CustomMoveDraft {
  /** From `createCustomMoveDraftKey()`. The card tracks by this, never by `$index` (14-R4). */
  key: string;
  name: string;
  description: string | null;
}

@Component({
  selector: 'app-monster-create',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MonsterFormComponent,
    WeaponTagSelectComponent,
    CustomMovesCardComponent,
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

  // --- Custom moves, staged (architecture.md §29.2; Phase 5a) ---
  //
  // The fifth sibling draft list. `signal<T[]>`, not a `FormArray`, per the standing rule and the
  // four lists above. The card owns the *form*; this page owns only the list and the write.

  readonly customMoveDrafts = signal<CustomMoveDraft[]>([]);

  /** Which staged row the card has open for editing. Bound two-way (L-D1). */
  readonly editingCustomMoveKey = signal<string | null>(null);

  /**
   * The card's rows. Identical mapping to `monster-detail`'s, except the key is the client draft
   * key rather than a server id — which is the entire difference between staged and immediate
   * authoring as far as the card is concerned. It has no `mode` input and needs none (§13.4).
   */
  readonly customMoveRows = computed<CustomMoveRow[]>(() =>
    this.customMoveDrafts().map((draft) => ({
      key: draft.key,
      name: draft.name,
      description: draft.description,
    }))
  );

  /** Optional "attach to mystery" picker. Blank is the valid "create unattached" path. */

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
    private readonly notificationService: NotificationService,
    private readonly customMoveService: CustomMoveService
  ) {}

  /** The card, so a commit can return it to its add state. See `monster-detail`'s twin. */
  @ViewChild(CustomMovesCardComponent) private readonly customMovesCard?: CustomMovesCardComponent;

  /**
   * Add or edit a staged move — purely local, no request. `key === null` is an add.
   *
   * **The staged counterpart of `monster-detail.commitCustomMove`**, and the contrast is the point:
   * same card, same event, same payload; one turns it into a `POST`/`PUT`, this one into a
   * `signal<T[]>` update. Nothing inside the card knows which.
   */
  commitCustomMoveDraft(commit: CustomMoveCommit): void {
    const { key, name, description } = commit;

    this.customMoveDrafts.update((drafts) =>
      key === null
        ? [...drafts, { key: createCustomMoveDraftKey(), name, description }]
        : drafts.map((draft) => (draft.key === key ? { ...draft, name, description } : draft))
    );

    this.customMovesCard?.commitSucceeded();
  }

  /**
   * Remove a staged move. A local splice and **no modal** — nothing is persisted yet, so there is
   * nothing to confirm (§13.3). The trash glyph is still the trash: one component must not change
   * its glyph by mode, and the trash already means "deferred removal" in the wizard roster.
   */
  removeCustomMoveDraft(row: CustomMoveRow): void {
    this.customMoveDrafts.update((drafts) => drafts.filter((draft) => draft.key !== row.key));
    if (this.editingCustomMoveKey() === row.key) {
      this.editingCustomMoveKey.set(null);
    }
  }

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
  onCreate(submit: MonsterFormSubmit): void {
    const mysteryIds = submit.mysteryIds;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    // Always standalone, then one membership PUT per selection — the shape Locations and
    // Bystanders have had since Phase 2. Zero selections is valid and creates an unattached monster,
    // which is a first-class state under decision 1.
    this.monsterService
      .createStandalone(submit.monster)
      .pipe(
        switchMap((monster) =>
          // The monster now exists. A failure past this point must not look like a
          // total failure, so it is caught here rather than reaching the error handler.
          forkJoin({
            drafts: this.saveSubResourceDrafts(monster.id),
            links: this.runBatch(
              mysteryIds.map((mysteryId) => this.monsterService.linkToMystery(mysteryId, monster.id)),
            ),
          }).pipe(
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

          void this.router.navigate(draftsFailed ? ['/monsters', monsterId] : this.detailLink(monsterId, mysteryIds));
        },
        error: () => {
          this.isSaving.set(false);
          this.errorMessage.set('Unable to create monster.');
          this.notificationService.error('Unable to create monster.');
        },
      });
  }

  /**
   * With exactly one mystery selected there is an unambiguous scoped route to land on. Zero or many
   * have no single referent, so they fall back to the flat catalogue route — and so does the
   * partial-failure branch, where the scoped route would assert a membership we no longer know holds.
   */
  private detailLink(monsterId: string, mysteryIds: string[]): unknown[] {
    return mysteryIds.length === 1 ? ['/mysteries', mysteryIds[0], 'monsters', monsterId] : ['/monsters', monsterId];
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
      // The fifth arm (§2.10 item 2, §29.2). One `POST /api/monsters/{id}/custom-moves` per staged
      // move, through the same owner-checked endpoint a detail page uses — there is no second write
      // path and no "trust me, I just created it" exemption (§2.10 item 4).
      //
      // `runBatch`'s empty short-circuit means a create with no staged moves fires **no** request at
      // all, which is the positive half of R5's ledger assertion: for N staged moves, exactly N
      // custom-move POSTs, and zero for an empty list.
      customMoves: this.runBatch(
        this.customMoveDrafts().map((move) =>
          this.customMoveService.create('Monster', monsterId, {
            name: move.name,
            description: move.description,
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
