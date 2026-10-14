import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, Observable, of, startWith, switchMap } from 'rxjs';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { resourceImageThumbnailUrl } from '../../../../core/resource-images';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import {
  CustomMoveCommit,
  CustomMoveRow,
  CustomMovesCardComponent,
} from '../../../../shared/custom-moves-card.component';
import { CustomMoveService } from '../../../../core/custom-moves';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { ImageCarouselComponent } from '../../../../shared/image-carousel.component';
import { ImageUploadModalComponent } from '../../../../shared/image-upload-modal.component';
import { ResourceImagesCardComponent } from '../../../../shared/resource-images-card.component';
import { ResourceImagesStore } from '../../../../shared/resource-images.store';
import { ResourceThumbnailComponent } from '../../../../shared/resource-thumbnail.component';
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';
import { MonsterFormComponent, MonsterFormSubmit } from '../../shared/monster-form/monster-form';
import {
  MinionListItemResponse,
  MonsterArchetypeResponse,
  MonsterDetailResponse,
  MonsterAttackResponse,
  ResourceImageResponse,
  MysteryListItemResponse,
  TypeRefResponse,
  UpsertCustomMoveRequest,
  UpsertMonsterArmorRequest,
  UpsertMonsterAttackRequest,
  UpsertMonsterPowerRequest,
  UpsertMonsterRequest,
  UpsertMonsterWeaknessRequest,
  WeaponTagRefResponse,
} from '../../../../core/models';

@Component({
  selector: 'app-monster-detail-component',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MonsterFormComponent,
    WeaponTagSelectComponent,
    ConfirmDeleteModalComponent,
    CustomMovesCardComponent,
    IconComponent,
    ResourceImagesCardComponent,
    ImageCarouselComponent,
    ImageUploadModalComponent,
    ResourceThumbnailComponent,
  ],
  // Component-scoped, so the section's state is torn down with the page (the MysteryCreateStore
  // precedent). Not `providedIn: 'root'` — a second monster's images must not inherit the first's.
  providers: [ResourceImagesStore],
  templateUrl: './monster-detail.html',
})
export class MonsterDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly monster = signal<MonsterDetailResponse | null>(null);
  readonly monsterTypes = signal<TypeRefResponse[]>([]);
  readonly monsterArchetypes = signal<MonsterArchetypeResponse[]>([]);
  readonly weaponTags = signal<WeaponTagRefResponse[]>([]);
  /** Options for the membership picker (5b, §6.2). */
  readonly mysteries = signal<MysteryListItemResponse[]>([]);
  readonly minions = signal<MinionListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly activeMutation = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  /**
   * `footnote` is new in Phase 6a and only ever set by the image delete flow (§6) — every other
   * call site leaves it undefined, so the modal keeps its `''` default and renders no footnote,
   * exactly as before.
   */
  readonly pendingDelete = signal<{ label: string; footnote?: string; perform: () => void } | null>(null);
  readonly mysteryId = signal<string | null>(null);
  readonly isMutating = computed(() => this.activeMutation() !== null);

  /** The Images section's state (design.md §4.1). Provided on this component, so it dies with the page. */
  readonly imagesStore = inject(ResourceImagesStore);
  readonly isUploadingImages = signal(false);

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
    private readonly mysteryService: MysteryService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService,
    private readonly customMoveService: CustomMoveService
  ) {}

  /**
   * The card, so a successful commit can return it to its add state and restore focus.
   *
   * Optional because the card lives inside the template's `@if (monster())` branch, so it does not
   * exist until the page has loaded — and `commitCustomMove` is only reachable once it has.
   */
  @ViewChild(CustomMovesCardComponent) private readonly customMovesCard?: CustomMovesCardComponent;

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
            mysteries: this.mysteryService.getMysteries(),
          });
        })
      )
      .subscribe({
        next: ({ monster, monsterTypes, monsterArchetypes, weaponTags, minions, mysteries }) => {
          // Deliberately outside the forkJoin above: the images section loads independently and
          // renders its own inline error, so a failing image list must not fail the whole page.
          this.imagesStore.load('Monster', monster.id, monster.name);
          this.monster.set(monster);
          this.mysteries.set(mysteries);
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

  /**
   * The entity body and its mystery membership are two separate writes (architecture §4.1), and this
   * is the Location/Bystander shape with the noun changed (`5b-L1`).
   *
   * **It ends in a refetch on both branches**, which does two jobs: it makes the re-rendered
   * membership control itself the answer to "which mysteries failed?", and it resets the diff
   * baseline to server truth. `DELETE` on a membership URI 404s on repeat, so without the refetch a
   * retry after a partial failure would fail permanently.
   *
   * **No failure here touches `errorMessage` — not the membership caveat and not a total failure.**
   * The caveat never did (setting it unmounts the form, leaving nothing to retry into); the total
   * failure used to, and that was the same bug one step worse, because a failed `PUT` unmounts the
   * form *while it still holds the user's unsaved edits*. The `notificationService.error` below was
   * already firing the identical string, so removing the inline write cost nothing.
   *
   * **The invariant this completes, and the reason the template's branch order is safe:**
   * `errorMessage` is now written by the **load path only** (`ngOnInit`), on this page and on
   * `minion-detail`. So `monster-detail.html:6`'s `@else if (errorMessage())` — which sits *ahead*
   * of the content branch and therefore replaces the entire page — means exactly "this monster
   * could not be loaded", which is the only claim that branch position is correct for. **Anything
   * that happens after a successful load reports through a toast or its own inline element, never
   * here.** If you are about to add an `errorMessage.set` to a write path, that is the rule you are
   * breaking; the images section (its own `data-images-error`) is the shape to copy instead.
   *
   * architecture.md (domain-custom-moves) §34 — Phase A.
   */
  saveMonster(submit: MonsterFormSubmit): void {
    const current = this.monster();
    if (!current) {
      return;
    }

    const monsterId = current.id;
    const desired = submit.mysteryIds;
    const existing = current.mysteryIds ?? [];
    const added = desired.filter((mysteryId) => !existing.includes(mysteryId));
    const removed = existing.filter((mysteryId) => !desired.includes(mysteryId));

    this.activeMutation.set('Saving monster...');

    this.monsterService
      .update(monsterId, submit.monster)
      .pipe(
        switchMap(() =>
          this.runBatch<void>([
            ...added.map((mysteryId) => this.monsterService.linkToMystery(mysteryId, monsterId)),
            ...removed.map((mysteryId) => this.monsterService.unlinkFromMystery(mysteryId, monsterId)),
          ]).pipe(
            map(() => false),
            catchError(() => of(true)),
          ),
        ),
        switchMap((membershipFailed) =>
          this.monsterService.getById(monsterId).pipe(map((monster) => ({ monster, membershipFailed }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ monster, membershipFailed }) => {
          this.monster.set(monster);
          // The only write on this page that can rename the monster, and the §6 last-image footnote
          // quotes that name ("{name} will have no images afterward").
          this.imagesStore.setOwnerName(monster.name);
          this.activeMutation.set(null);

          if (membershipFailed) {
            // `forkJoin` reports that one call failed, never that all of them did, so the copy hedges.
            this.notificationService.error(
              'Monster saved, but some of its mysteries may not have saved. Review them below and save again.',
            );
          } else {
            this.notificationService.success('Monster details saved.');
          }
        },
        error: () => {
          this.activeMutation.set(null);
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
          this.activeMutation.set(null);
        },
        // The toast is the whole failure surface — `errorMessage` is deliberately untouched. See
        // `runAndRefresh`. This method has its own subscribe only because an attack chains its
        // weapon-tag assignments, so it needs the same treatment rather than inheriting it.
        error: () => {
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

  // --- Custom moves (architecture.md §29.1; Phase 5a, the pilot for 5b–5e) ---
  //
  // **Writes are immediate and per row**, unlike the create page's staged list — and that
  // difference lives entirely in these three members, not in the card, which has no `mode` input
  // (§13.4). Everything below is the shape 5b–5e copy with the owner type and the noun changed.

  /**
   * The card's rows, mapped from the `customMoves` already on the detail response.
   *
   * **No request on load** (decision 2): `customMoves` is embedded in `MonsterDetailResponse`, so
   * the first paint of the card *is* server truth and `CustomMoveService.list()` is never called
   * here. That is also what makes the create→detail recovery path coherent — a user bounced here by
   * a partial create failure sees exactly what saved.
   *
   * Single-sourced from `monster()` on purpose. A page-level `customMoves` signal fed by `list()`
   * after each write would be one request cheaper, and was rejected: two sources for one collection
   * that agree only by coincidence is the hazard `mystery-create-monster-phase.html:22-28` already
   * names in this repo (§27.2).
   */
  readonly customMoveRows = computed<CustomMoveRow[]>(() =>
    (this.monster()?.customMoves ?? []).map((move) => ({
      key: move.id,
      name: move.name,
      description: move.description,
    }))
  );

  /** Which row the card has open. Bound two-way; the page owns it, the card asks (L-D1). */
  readonly editingCustomMoveKey = signal<string | null>(null);

  /**
   * Add or edit, decided by `commit.key` — `null` means add. One handler for both, because the card
   * emits one event for both and the only difference is the verb.
   *
   * Routed through `runAndRefresh`, which since Phase A reports failures as a toast and never
   * touches `errorMessage`. So this needs no special pipeline: **the custom-move write is the
   * normal case on this page now**, which is the simplification Phase A bought.
   *
   * `commitSucceeded()` on the success branch is what returns the card to its add state and puts
   * focus back on the edited row's pencil. It is deliberately *not* called on failure: the form
   * keeps the user's text so they can retry, which is the whole point of not unmounting anything.
   */
  commitCustomMove(commit: CustomMoveCommit): void {
    const request: UpsertCustomMoveRequest = { name: commit.name, description: commit.description };
    const { key } = commit;

    this.runAndRefresh(
      (monsterId) =>
        key === null
          ? this.customMoveService.create('Monster', monsterId, request)
          : this.customMoveService.update('Monster', monsterId, key, request),
      key === null ? 'Unable to add custom move.' : 'Unable to save custom move.',
      () => this.customMovesCard?.commitSucceeded(),
      key === null ? 'Custom move added.' : 'Custom move saved.'
    );
  }

  /**
   * Routed through **this page's single `<app-confirm-delete-modal>`** rather than a second element
   * — decision 14, and the shape `requestDeletePower` above already uses. The modal's confirm
   * handler calls `pending.perform()` and never branches on which kind of delete is pending, so
   * adding a sixth flow to this page costs exactly this method and no template change at all.
   *
   * Passes no `message` (so the component's own *"This cannot be undone."* default applies, which
   * is true on a detail page) and no `footnote` — the least demanding of all eighteen call sites,
   * so the census spec's transcribed data is unaffected and R12's gate stays 5e-only.
   */
  requestDeleteCustomMove(row: CustomMoveRow): void {
    this.pendingDelete.set({
      label: row.name,
      perform: () =>
        this.runAndRefresh(
          (monsterId) => this.customMoveService.delete('Monster', monsterId, row.key),
          'Unable to delete custom move.'
        ),
    });
  }

  /**
   * Every attack/power/armor/weakness create and delete on this page.
   *
   * **A failure here is a toast and nothing else — `errorMessage` is never set.** The template puts
   * `@else if (errorMessage())` ahead of its content branch, so setting it unmounts the monster,
   * the form and all five collections, leaving the user with one red line and no way back except a
   * reload. That is the same hazard `saveMonster`'s membership caveat always avoided above
   * (*"setting it unmounts the form, leaving nothing to retry into"*) and that the images section
   * avoids by keeping its own inline error — this method, `createAttack` and `saveMonster`'s total
   * failure were the three places on this page that still had it.
   *
   * Nothing was lost in removing it: the `notificationService.error(errorMessage)` below was always
   * fired with the *same string*, so the inline write was duplication with a destructive side
   * effect. `errorMessage` stays the surface for **load** failures and for the **entity save**.
   *
   * The success branches' `errorMessage.set(null)` calls went too, and the honest reason is that
   * they were **unreachable**, not that they were wrong: `errorMessage` is only ever non-null after
   * a failed load, and in that state the template renders the error branch — no form, no panels, no
   * controls — so no write can be triggered to reach the clear. Verified by control: restoring one
   * fails no test, and there is no assertion that could catch it. They are removed so that the load
   * path is the *single* writer (see `saveMonster`), which is a property worth having rather than a
   * behaviour change.
   *
   * architecture.md (domain-custom-moves) §34 — Phase A.
   */
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
          this.activeMutation.set(null);
          this.notificationService.success(successMessage ?? 'Changes saved.');
        },
        error: () => {
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

  /**
   * The nested Minions block's row thumbnail (scope reversed 2026-10-07). Points at the **Minion**
   * endpoint, not this Monster's — each row is a different owner — and returns `null` when that
   * minion has no images, which is what makes the placeholder render.
   *
   * `primaryImageId` rides along on `GET /api/monsters/{id}/minions` as of Bowser's `5c697a6`, so
   * this costs no request per row; before that the field was absent from this projection, which is
   * why the block was excluded.
   */
  minionThumbnailUrl(minion: MinionListItemResponse): string | null {
    return resourceImageThumbnailUrl('Minion', minion.id, minion.primaryImageId);
  }

  // --- Images (design.md §4.1, §4.1.1, §6) ---
  //
  // Every image write fires its own request through `imagesStore` and updates the section's own
  // state, independent of `saveMonster()` — the same decoupling Attacks/Powers/Armors/Weaknesses
  // already have on this page. A user never saves to keep an image change, and an image failure
  // stays inside the section rather than touching `errorMessage`, which would unmount the page.

  /** Opens the upload modal. The 10/10 block lives on the card's button, so this is only reachable below the cap. */
  openImageUpload(): void {
    this.isUploadingImages.set(true);
  }

  /**
   * The carousel's `deleteRequested`. Routed through **this page's** single
   * `<app-confirm-delete-modal>` rather than the store's own pending signals, so the page keeps one
   * modal and one pending-delete concept instead of two that can disagree. The store still computes
   * the footnote, since it owns the image list and the primary id.
   */
  requestDeleteImage(image: ResourceImageResponse): void {
    this.pendingDelete.set({
      label: image.fileName,
      footnote: this.imagesStore.deleteFootnoteFor(image),
      perform: () => this.imagesStore.deleteImage(image),
    });
  }

  onDeleteConfirmed(): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.perform();
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }
}
