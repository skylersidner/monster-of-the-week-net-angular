import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ConfirmDeleteModalComponent } from './confirm-delete-modal.component';
import { CustomSelectComponent } from './custom-select.component';

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
