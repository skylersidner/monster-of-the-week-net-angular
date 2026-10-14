import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NotificationService } from '../core/notifications';
import { ResourceImageService } from '../core/resource-images';
import { ConfirmDeleteModalComponent } from './confirm-delete-modal.component';
import { CustomSelectComponent } from './custom-select.component';
import { ImageUploadModalComponent } from './image-upload-modal.component';

/**
 * The cross-cutting case from `docs/updates/mystery-entity-linking-ux.md` §8.7, and the reason
 * `CustomSelectComponent.handleEscape` opens with an early return and a `stopPropagation()` rather
 * than just closing the panel.
 *
 * Both controls now close on `Escape`. A select rendered *inside* the dialog must therefore swallow
 * the **first** press — closing only its own dropdown — and let the **second** through to close the
 * dialog. Get the `stopPropagation()` wrong and one press takes both down; get the early return
 * wrong and the second press never reaches the dialog at all.
 *
 * This lives in its own file because it is a property of the pair, not of either component, and
 * neither component's own spec is the honest home for it.
 */
@Component({
  imports: [ConfirmDeleteModalComponent, CustomSelectComponent],
  template: `
    <app-confirm-delete-modal
      [visible]="visible()"
      itemName="The Hollow Man"
      (cancelled)="visible.set(false)">
    </app-confirm-delete-modal>
    <!--
      The modal projects no content today, so the select is rendered as a sibling and then moved
      into the dialog in the spec. That is a fixture mechanic, not a claim about the markup: what is
      under test is event propagation between two nested host elements, and moving the node gives
      exactly that with no production change.
    -->
    <app-custom-select class="nested" [options]="options" placeholder="Pick one"></app-custom-select>
  `,
})
class HostComponent {
  readonly visible = signal(true);
  readonly options = [
    { id: 'a', name: 'Dust Bowl Nights' },
    { id: 'b', name: 'The Long Drive Home' },
  ];
}

describe('Escape nesting — a CustomSelect inside a ConfirmDeleteModal', () => {
  let fixture: Awaited<ReturnType<typeof create>>;

  async function create() {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const created = TestBed.createComponent(HostComponent);
    created.detectChanges();
    await created.whenStable();
    return created;
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLElement => element().querySelector<HTMLElement>('[role="dialog"]')!;
  const select = (): HTMLElement => element().querySelector<HTMLElement>('app-custom-select')!;
  const trigger = (): HTMLButtonElement =>
    select().querySelector<HTMLButtonElement>('.custom-select__trigger')!;
  const panel = (): HTMLElement | null => select().querySelector<HTMLElement>('.custom-select__panel');

  function pressEscape(): void {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    fixture = await create();
    // Nest the select inside the dialog so its keydown events bubble through the dialog's handler.
    dialog().appendChild(select());
    fixture.detectChanges();
  });

  it('takes two Escape presses to close both, in that order, never one', () => {
    trigger().click();
    fixture.detectChanges();
    expect(panel()).toBeTruthy();
    expect(fixture.componentInstance.visible()).toBe(true);

    // First press: the dropdown closes and the dialog does not.
    pressEscape();
    expect(panel()).toBeNull();
    expect(fixture.componentInstance.visible()).toBe(true);
    expect(dialog()).toBeTruthy();

    // Second press: the dropdown is already closed, so the press reaches the dialog.
    pressEscape();
    expect(fixture.componentInstance.visible()).toBe(false);
    expect(element().querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes the dialog on the first press when the dropdown was never opened', () => {
    expect(panel()).toBeNull();

    pressEscape();

    expect(fixture.componentInstance.visible()).toBe(false);
  });
});

/**
 * The second Escape-handler pair in the app, added when `ImageUploadModalComponent` shipped
 * (Phase 5r). It belongs in this file for the same reason the pair above does: the property under
 * test is not either component's own Escape handling — both have that in their own specs — but what
 * happens when **two** `document:keydown` listeners are mounted at once.
 *
 * All four **image-bearing** detail pages render the upload modal and `<app-confirm-delete-modal>`
 * as siblings, so this pairing is real markup rather than a contrived fixture.
 * `ImageUploadModalComponent.onKeydown` calls `stopPropagation()`; nothing outside this file proved
 * that it stops the press from also reaching the dialog, and a missing `stopPropagation()` would
 * close both overlays on one press exactly as the `CustomSelect`/dialog pair would.
 *
 * **"Four" is now a qualifier rather than a total, and that is deliberate.** There are five detail
 * pages as of domain-custom-moves Phase 5e, and `mystery-detail` is the fifth — but it mounts a
 * confirm modal and **no** upload modal, because mystery images were cut from scope
 * (`domain-custom-moves/architecture.md` §2.8). So the pairing this file tests does not exist there
 * and **this file needs no fifth case**. Recorded because R12 predicted the opposite, and reading it
 * that way would invite someone to add an upload modal to `mystery-detail` to satisfy a census.
 *
 * **Why the upload modal is not in `custom-select-escape-surfaces.spec.ts`** (asked during Phase 7's
 * close-out, recorded so the absence is a decision rather than an oversight): that file's inventory
 * is every template rendering `<app-custom-select>`, taken from a grep, and it checks that Escape
 * reaches the *select* on each surface. The upload modal renders no select, so it has nothing for
 * that sweep to measure. Its Escape behaviour — close when nothing is staged, raise the discard
 * confirmation when files are staged, inert while a request is in flight — is covered in
 * `image-upload-modal.component.spec.ts`, and its interaction with another overlay is covered here.
 */
@Component({
  imports: [ConfirmDeleteModalComponent, ImageUploadModalComponent],
  template: `
    <app-confirm-delete-modal
      [visible]="dialogVisible()"
      itemName="swamp-thing.webp"
      (cancelled)="dialogVisible.set(false)" />
    <app-image-upload-modal
      ownerType="Monster"
      ownerId="mo1"
      [currentCount]="0"
      [visible]="uploadVisible()"
      (closed)="uploadVisible.set(false)" />
  `,
})
class TwoOverlayHostComponent {
  readonly dialogVisible = signal(true);
  readonly uploadVisible = signal(true);
}

describe('Escape nesting — an ImageUploadModal alongside a ConfirmDeleteModal', () => {
  let fixture: ComponentFixture<TwoOverlayHostComponent>;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLElement | null => element().querySelector<HTMLElement>('[role="dialog"]:not([data-upload-modal])');
  const uploadModal = (): HTMLElement | null => element().querySelector<HTMLElement>('[data-upload-modal]');
  const discardStep = (): HTMLElement | null => element().querySelector<HTMLElement>('[data-discard-confirm]');

  function pressEscape(): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwoOverlayHostComponent],
      providers: [
        {
          provide: ResourceImageService,
          useValue: { upload: () => of({ uploaded: [], rejected: [] }) },
        },
        { provide: NotificationService, useValue: { success: () => {}, error: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TwoOverlayHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('both overlays are mounted, as they are on every detail page', () => {
    expect(uploadModal()).toBeTruthy();
    expect(dialog()).toBeTruthy();
  });

  /**
   * The stacking order: the confirm dialog is the one opened last (it is raised from a control
   * behind this modal), so it is on top and Escape belongs to it first.
   *
   * This pair found a real defect when it was written. Both handlers listen on `document`, and
   * `stopPropagation()` does not stop other listeners on the same node, so one press closed *both*
   * overlays. `ImageUploadModalComponent.onKeydown` now yields while another dialog is open —
   * order-independent, unlike `stopImmediatePropagation`, which would still depend on which
   * component registered its listener first.
   */
  it('one press closes only the dialog on top, leaving the upload modal open', () => {
    pressEscape();

    expect(fixture.componentInstance.dialogVisible()).toBe(false);
    expect(uploadModal()).toBeTruthy();
  });

  it('the second press then closes the upload modal', () => {
    pressEscape();
    pressEscape();

    expect(dialog()).toBeNull();
    expect(uploadModal()).toBeNull();
  });

  it('never closes both overlays on a single press', () => {
    pressEscape();

    const closed = [fixture.componentInstance.dialogVisible() === false, uploadModal() === null].filter(Boolean);
    expect(closed).toHaveLength(1);
  });

  it('with files staged, the press still goes to the dialog and does not raise the discard step', () => {
    const modal = fixture.debugElement.children
      .find((child) => child.componentInstance instanceof ImageUploadModalComponent)!
      .componentInstance as ImageUploadModalComponent;
    modal.stage([new File(['x'], 'staged.webp', { type: 'image/webp' })]);
    fixture.detectChanges();

    pressEscape();

    // The upload modal is not the topmost surface, so it does nothing at all — including not
    // prompting about its staged files.
    expect(discardStep()).toBeNull();
    expect(fixture.componentInstance.dialogVisible()).toBe(false);
    expect(uploadModal()).toBeTruthy();
  });

  it('once the dialog is gone, Escape behaves normally for the staged upload modal', () => {
    const modal = fixture.debugElement.children
      .find((child) => child.componentInstance instanceof ImageUploadModalComponent)!
      .componentInstance as ImageUploadModalComponent;
    modal.stage([new File(['x'], 'staged.webp', { type: 'image/webp' })]);
    fixture.detectChanges();

    pressEscape();
    expect(dialog()).toBeNull();

    // Now topmost: the staged-files discard confirmation appears rather than closing through.
    pressEscape();
    expect(discardStep()).toBeTruthy();
    expect(uploadModal()).toBeTruthy();
  });
});
