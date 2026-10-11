import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, Observable, of, startWith, switchMap } from 'rxjs';
import { MinionService } from '../../../../core/minion';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { ImageCarouselComponent } from '../../../../shared/image-carousel.component';
import { ImageUploadModalComponent } from '../../../../shared/image-upload-modal.component';
import { ResourceImagesCardComponent } from '../../../../shared/resource-images-card.component';
import { ResourceImagesStore } from '../../../../shared/resource-images.store';
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';
import { MinionFormComponent } from '../../shared/minion-form/minion-form';
import {
  MinionDetailResponse,
  MinionAttackResponse,
  ResourceImageResponse,
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
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MinionFormComponent,
    WeaponTagSelectComponent,
    ConfirmDeleteModalComponent,
    IconComponent,
    ResourceImagesCardComponent,
    ImageCarouselComponent,
    ImageUploadModalComponent,
  ],
  // Component-scoped, as on monster-detail: the section's state dies with the page, so a second
  // minion cannot inherit the first's images.
  providers: [ResourceImagesStore],
  templateUrl: './minion-detail.html',
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
  /**
   * `footnote` is only ever set by the image delete flow (§6). Every other call site leaves it
   * undefined, so the modal keeps its `''` default and renders no footnote — same shape as
   * monster-detail since Phase 6a.
   */
  readonly pendingDelete = signal<{ label: string; footnote?: string; perform: () => void } | null>(null);

  /** The Images section's state (design.md §4.1). Provided on this component, so it dies with the page. */
  readonly imagesStore = inject(ResourceImagesStore);
  readonly isUploadingImages = signal(false);
  readonly mysteryId = signal<string | null>(null);
  readonly monsterId = signal<string | null>(null);
  readonly isMutating = computed(() => this.activeMutation() !== null);

  readonly backLink = computed(() => {
    if (this.mysteryId()) return ['/mysteries', this.mysteryId()];
    if (this.monsterId()) return ['/monsters', this.monsterId()];
    return ['/minions'];
  });
  readonly backLabel = computed(() => {
    if (this.mysteryId()) return '← Back to mystery';
    if (this.monsterId()) return '← Back to monster';
    return '← Back to minions';
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
          const minionId = params.get('minionId');
          if (!minionId) {
            throw new Error('Minion id is required.');
          }

          const mysteryId = params.get('mysteryId');
          this.mysteryId.set(mysteryId);
          const monsterId = params.get('monsterId');
          this.monsterId.set(monsterId);
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
          // Deliberately outside the forkJoin above: the images section loads independently and
          // renders its own inline error, so a failing image list must not fail the whole page.
          this.imagesStore.load('Minion', minion.id, minion.name);
          this.minion.set(minion);
          this.minionTypes.set(minionTypes);
          this.weaponTags.set(weaponTags);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load minion details.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * **A failed save does not touch `errorMessage`.** It used to, and that was the same bug as the
   * one `runAndRefresh` carried but one step worse: the template puts `@else if (errorMessage())`
   * ahead of the content branch, so a failed `PUT` unmounted the form *while it still held the
   * user's unsaved edits*. The `notificationService.error` below was already firing the identical
   * string, so removing the inline write cost nothing.
   *
   * **The invariant this completes, and the reason the template's branch order is safe:**
   * `errorMessage` is now written by the **load path only** (`ngOnInit`), on this page and on
   * `monster-detail`. So `minion-detail.html:6`'s `@else if (errorMessage())` means exactly "this
   * minion could not be loaded", which is the only claim that branch position is correct for.
   * **Anything that happens after a successful load reports through a toast or its own inline
   * element, never here** — the images section (`data-images-error`) is the shape to copy.
   *
   * architecture.md (domain-custom-moves) §34 — Phase A.
   */
  saveMinion(payload: UpsertMinionRequest): void {
    if (!this.minion()) {
      return;
    }

    this.activeMutation.set('Saving minion...');

    this.minionService
      .update(this.minion()!.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (minion) => {
          this.minion.set(minion);
          // The one write here that can rename the minion, and the §6 last-image footnote quotes
          // that name ("{name} will have no images afterward").
          this.imagesStore.setOwnerName(minion.name);
          this.activeMutation.set(null);
          this.notificationService.success('Minion details saved.');
        },
        error: () => {
          this.activeMutation.set(null);
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

  /**
   * Every attack/power/armor/weakness create and delete on this page.
   *
   * **A failure here is a toast and nothing else — `errorMessage` is never set.** The template puts
   * `@else if (errorMessage())` ahead of its content branch, so setting it unmounts the minion, the
   * form and all four collections, leaving the user with one red line and no way back except a
   * reload. That is the same hazard the images section avoids by keeping its own inline error
   * (`data-images-error`) — this method, `createAttack` and `saveMinion` were the three places on
   * this page that still had it. (Unlike `monster-detail`, this page has no membership batch to
   * compare with: a minion belongs to a monster, not to mysteries, so `saveMinion` is a plain
   * update.)
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
   * path is the *single* writer (see `saveMinion`), which is a property worth having rather than a
   * behaviour change.
   *
   * architecture.md (domain-custom-moves) §34 — Phase A. Identical to `monster-detail.ts`'s.
   */
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

  weaponTagNames(attack: MinionAttackResponse): string {
    return attack.weaponTags.map((tag) => tag.name).join(', ');
  }

  // --- Images (design.md §4.1, §4.1.1, §6) ---
  //
  // Every image write fires its own request through `imagesStore` and updates the section's own
  // state, independent of `saveMinion()` — the same decoupling Attacks/Powers/Armors/Weaknesses
  // already have here. An image failure stays inside the section rather than touching
  // `errorMessage`, which this template's `@else if` would use to unmount the page.

  /** Opens the upload modal. The 10/10 block lives on the card's button, so this is only reachable below the cap. */
  openImageUpload(): void {
    this.isUploadingImages.set(true);
  }

  /**
   * The carousel's `deleteRequested`. Routed through **this page's** single
   * `<app-confirm-delete-modal>` using the store's `deleteFootnoteFor`/`deleteImage` pair, rather
   * than the store's own pending signals — this page already owns a `pendingDelete`, and adopting
   * the store's too would hold the pending image in two places. That pair was split out in Phase 6a
   * for exactly this case.
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
}
