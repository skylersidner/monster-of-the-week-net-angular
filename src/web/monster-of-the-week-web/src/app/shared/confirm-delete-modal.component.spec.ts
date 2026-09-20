import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDeleteModalComponent } from './confirm-delete-modal.component';

@Component({
  imports: [ConfirmDeleteModalComponent],
  template: `
    <button type="button" class="opener">Delete</button>
    <app-confirm-delete-modal
      [visible]="visible()"
      itemName="The Hex"
      [verb]="verb()"
      [confirmLabel]="confirmLabel()"
      [usageMessage]="usageMessage()"
      [usage]="usage()"
      [message]="message()"
      [items]="items()"
      [footnote]="footnote()"
      [secondaryLabel]="secondaryLabel()"
      (confirmed)="log('confirmed')"
      (secondary)="log('secondary')"
      (cancelled)="log('cancelled')" />
  `,
})
class HostComponent {
  readonly visible = signal(true);
  readonly verb = signal('Delete');
  readonly confirmLabel = signal<string | null>(null);
  readonly usageMessage = signal('');
  readonly usage = signal<readonly string[]>([]);
  readonly message = signal('These belong to The Crooked and will be cleared:');
  readonly items = signal<readonly string[]>(['2 moves']);
  readonly footnote = signal('Your name, pronouns and History notes stay.');
  readonly secondaryLabel = signal<string | null>(null);
  readonly events: string[] = [];

  log(event: string): void {
    this.events.push(event);
  }
}

describe('ConfirmDeleteModalComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLElement => element().querySelector<HTMLElement>('[role="dialog"]')!;
  const backdrop = (): HTMLElement => element().querySelector<HTMLElement>('.fixed.inset-0')!;
  const opener = (): HTMLButtonElement => element().querySelector<HTMLButtonElement>('.opener')!;
  const buttons = (): HTMLButtonElement[] =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button'));
  const buttonLabels = (): string[] => buttons().map((button) => button.textContent?.trim() ?? '');
  const title = (): string | undefined => element().querySelector('h3')?.textContent?.trim();

  /** Blocks under the description wrapper, in DOM order, as `tag:text`. */
  const blocks = (): string[] =>
    Array.from(dialog().querySelector(`#${dialog().getAttribute('aria-describedby')}`)!.children).map(
      (child) =>
        `${child.tagName.toLowerCase()}:${
          child.tagName === 'UL'
            ? Array.from(child.querySelectorAll('li'))
                .map((li) => li.textContent?.trim())
                .join('|')
            : child.textContent?.trim()
        }`,
    );

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function press(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
    (document.activeElement ?? backdrop()).dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await render();
  });

  // --- shipped behaviour, unchanged -----------------------------------------------------

  it('labels the confirm button with the verb by default, so existing call sites are unchanged', () => {
    expect(title()).toBe('Delete "The Hex"?');
    expect(buttonLabels()).toEqual(['Cancel', 'Delete']);
  });

  it('takes an optional confirmLabel when the verb reads badly on a button (L13)', async () => {
    host.verb.set('Switch to');
    host.confirmLabel.set('Switch playbook');
    await render();

    expect(title()).toBe('Switch to "The Hex"?');
    expect(buttonLabels()).toEqual(['Cancel', 'Switch playbook']);
    expect(element().textContent).toContain('Your name, pronouns and History notes stay.');
  });

  // --- the two lists (§7.1) -------------------------------------------------------------

  it('renders title → usage → items → footnote, in that order', async () => {
    host.usageMessage.set('This monster is used by 2 mysteries:');
    host.usage.set(['Dust Bowl Nights', 'The Long Drive Home']);
    host.message.set('This will also delete the following minions:');
    host.items.set(['Grave-Wight', 'Pale Choir']);
    host.footnote.set('Deleting removes it from those mysteries too. This cannot be undone.');
    await render();

    expect(blocks()).toEqual([
      'p:This monster is used by 2 mysteries:',
      'ul:Dust Bowl Nights|The Long Drive Home',
      'p:This will also delete the following minions:',
      'ul:Grave-Wight|Pale Choir',
      'p:Deleting removes it from those mysteries too. This cannot be undone.',
    ]);
  });

  it('keeps usage and items as separate lists rather than merging them', async () => {
    host.usageMessage.set('This monster is used by 1 mystery:');
    host.usage.set(['Dust Bowl Nights']);
    host.items.set(['Grave-Wight']);
    await render();

    const lists = dialog().querySelectorAll('ul');
    expect(lists).toHaveLength(2);
    expect(lists[0].textContent).toContain('Dust Bowl Nights');
    expect(lists[0].textContent).not.toContain('Grave-Wight');
    expect(lists[1].textContent).toContain('Grave-Wight');
  });

  it('omits the usage block entirely when there is no usage message', () => {
    expect(dialog().querySelectorAll('ul')).toHaveLength(1);
    expect(blocks()[0]).toBe('p:These belong to The Crooked and will be cleared:');
  });

  // --- the footnote fix -----------------------------------------------------------------

  it('renders the footnote when there is nothing to cascade, which is the common case', async () => {
    host.message.set('');
    host.items.set([]);
    host.footnote.set('This cannot be undone.');
    await render();

    expect(blocks()).toEqual(['p:This cannot be undone.']);
  });

  it('defaults the footnote to nothing, so a call site that never passed one still renders one line', async () => {
    // Ten of the thirteen shipped call sites end up with "This cannot be undone." as `message`
    // and an empty `items` — seven pass it, three inherit it from `message`'s own default. With the
    // old 'This cannot be undone.' footnote default and unconditional rendering they would print it
    // twice; the empty default is what keeps them byte-identical.
    host.footnote.set('');
    host.message.set('This cannot be undone.');
    host.items.set([]);
    await render();

    expect(blocks()).toEqual(['p:This cannot be undone.']);
    expect(element().textContent?.match(/This cannot be undone\./g)).toHaveLength(1);
  });

  // --- the secondary action -------------------------------------------------------------

  it('shows no secondary button unless one is labelled — every non-wizard call site leaves it null', () => {
    expect(buttonLabels()).toEqual(['Cancel', 'Delete']);
  });

  it('places the secondary button between Cancel and the destructive confirm', async () => {
    host.secondaryLabel.set('Detach');
    await render();

    expect(buttonLabels()).toEqual(['Cancel', 'Detach', 'Delete']);
  });

  it('emits each action separately', async () => {
    host.secondaryLabel.set('Detach');
    await render();

    const [cancel, detach, remove] = buttons();
    detach.click();
    remove.click();
    cancel.click();

    expect(host.events).toEqual(['secondary', 'confirmed', 'cancelled']);
  });

  it('gives the secondary button the outline-accent treatment, not a second filled one', async () => {
    host.secondaryLabel.set('Detach');
    await render();

    const detach = buttons()[1];
    expect(detach.classList.contains('border-accent')).toBe(true);
    expect(detach.classList.contains('text-accent')).toBe(true);
    expect(detach.classList.contains('bg-danger')).toBe(false);
  });

  // --- dialog behaviour (§8.6 item 5) ---------------------------------------------------

  it('takes initial focus on Cancel, the least destructive control, never on the confirm button', () => {
    expect(document.activeElement).toBe(buttons()[0]);
    expect(document.activeElement).not.toBe(buttons()[buttons().length - 1]);
  });

  it('prefers the secondary action for initial focus when one is present', async () => {
    host.visible.set(false);
    await render();
    host.secondaryLabel.set('Detach');
    host.visible.set(true);
    await render();

    expect(document.activeElement).toBe(buttons()[1]);
    expect((document.activeElement as HTMLElement).textContent?.trim()).toBe('Detach');
  });

  it('cancels on Escape', () => {
    press('Escape');

    expect(host.events).toEqual(['cancelled']);
  });

  it('consumes the Escape it acts on', () => {
    // The handler is a `document:keydown` listener now, so "did it reach document" is no longer the
    // question — it reaches document *by design*. What still matters is that the press is consumed
    // so nothing downstream treats it as unhandled. The property that it does not fire when a
    // nested control has already handled the press lives in `escape-nesting.spec.ts`.
    const event = press('Escape');

    expect(event.defaultPrevented).toBe(true);
    expect(host.events).toEqual(['cancelled']);
  });

  // The bug this listener was moved to `document` for: the dialog's own title, message and padding
  // are not focusable, so one click on them drops focus to `<body>`. While the handler was bound on
  // the backdrop, a keydown raised on `<body>` never propagated *down* into it and Escape silently
  // stopped working — on every call site, after a single stray click.
  it('still cancels on Escape after focus has been dropped to <body>', () => {
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    fixture.detectChanges();

    expect(host.events).toEqual(['cancelled']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('still traps Tab after focus has been dropped to <body>', () => {
    (document.activeElement as HTMLElement).blur();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('ignores keys entirely while it is not visible', async () => {
    host.visible.set(false);
    await render();

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(escape);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.body.dispatchEvent(tab);
    fixture.detectChanges();

    expect(host.events).toEqual([]);
    expect(escape.defaultPrevented).toBe(false);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('wraps Tab from the last control back to the first', () => {
    buttons()[buttons().length - 1].focus();

    const event = press('Tab');

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('wraps Shift+Tab from the first control to the last', () => {
    buttons()[0].focus();

    const event = press('Tab', { shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons()[buttons().length - 1]);
  });

  it('leaves a Tab between two inner controls alone', async () => {
    host.secondaryLabel.set('Detach');
    await render();
    buttons()[0].focus();

    const event = press('Tab');

    expect(event.defaultPrevented).toBe(false);
  });

  it('returns focus to whatever opened it when it closes', async () => {
    host.visible.set(false);
    await render();

    opener().focus();
    host.visible.set(true);
    await render();
    expect(document.activeElement).not.toBe(opener());

    host.visible.set(false);
    await render();

    expect(document.activeElement).toBe(opener());
  });

  it('does not throw when the opener no longer exists by the time it closes', async () => {
    host.visible.set(false);
    await render();

    const detached = document.createElement('button');
    document.body.appendChild(detached);
    detached.focus();
    host.visible.set(true);
    await render();
    detached.remove();

    expect(() => {
      host.visible.set(false);
      fixture.detectChanges();
    }).not.toThrow();
  });

  it('falls back to the first control on the surrounding surface when the opener is gone', async () => {
    // §8 item 5's last clause. The `isConnected` guard stops the crash; without a fallback it left
    // focus on `<body>`, which is the orphaning defect one interaction later. Derived from the DOM
    // rather than passed in, so all thirteen call sites get it without changing anything.
    host.visible.set(false);
    await render();

    const doomed = document.createElement('button');
    element().appendChild(doomed);
    doomed.focus();
    host.visible.set(true);
    await render();
    doomed.remove();

    host.visible.set(false);
    await render();

    expect(document.activeElement).toBe(opener());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('restores to the opener even when it blurred between the click and the open', async () => {
    // `monsters-list` is the real case: its trash button is disabled for the duration of a minion
    // pre-fetch, and Chromium drops focus to `<body>` when a focused button is disabled without
    // putting it back on re-enable. Capturing `activeElement` at open time therefore recorded
    // nothing; the component tracks focus as it moves instead.
    host.visible.set(false);
    await render();

    opener().focus();
    expect(document.activeElement).toBe(opener());

    // What the browser does by itself while the button is disabled.
    opener().blur();
    expect(document.activeElement).toBe(document.body);

    host.visible.set(true);
    await render();
    expect(document.activeElement).toBe(buttons()[0]);

    host.visible.set(false);
    await render();

    expect(document.activeElement).toBe(opener());
  });

  it('wires aria-labelledby and aria-describedby to real, unique ids', () => {
    const titleId = dialog().getAttribute('aria-labelledby')!;
    const descriptionId = dialog().getAttribute('aria-describedby')!;

    expect(element().querySelector(`#${titleId}`)?.tagName).toBe('H3');
    expect(element().querySelector(`#${descriptionId}`)).toBeTruthy();
    expect(titleId).not.toBe(descriptionId);
    // `id="modal-title"` used to be hardcoded, so two instances collided.
    expect(titleId).not.toBe('modal-title');
  });
});

@Component({
  imports: [ConfirmDeleteModalComponent],
  template: `
    <app-confirm-delete-modal [visible]="true" itemName="One" />
    <app-confirm-delete-modal [visible]="true" itemName="Two" />
  `,
})
class TwoModalHostComponent {}

/**
 * The shape of the seven call sites that pass the permanence sentence as `message` with an empty
 * `items` and never pass a footnote — `hunters-list`, `hunter-detail`, `minions-list`,
 * `playbook-admin` and the three swept list pages before this change. `BareCallSiteHostComponent`
 * below covers the other three, which reach the same rendered state by inheriting `message`'s
 * default instead of passing it.
 */
@Component({
  imports: [ConfirmDeleteModalComponent],
  template: `
    <app-confirm-delete-modal [visible]="true" itemName="The Hex" message="This cannot be undone." [items]="[]" />
  `,
})
class ShippedCallSiteHostComponent {}

/** The shape of `mysteries-list` and the two detail pages: no message, no items, no footnote. */
@Component({
  imports: [ConfirmDeleteModalComponent],
  template: ` <app-confirm-delete-modal [visible]="true" itemName="The Hex" /> `,
})
class BareCallSiteHostComponent {}

/**
 * A call site that renders the dialog **before** the surface it belongs to. Every shipped one puts
 * it last, so this exists to keep the close-time fallback from silently depending on that: the
 * fallback must skip the dialog's own controls rather than rely on DOM order to miss them.
 */
@Component({
  imports: [ConfirmDeleteModalComponent],
  template: `
    <app-confirm-delete-modal [visible]="visible()" itemName="The Hex" (cancelled)="visible.set(false)" />
    <button type="button" class="surface-control">On the surface</button>
  `,
})
class DialogFirstHostComponent {
  readonly visible = signal(false);
}

describe('ConfirmDeleteModalComponent · two on one page', () => {
  it('gives each instance its own title id', async () => {
    await TestBed.configureTestingModule({ imports: [TwoModalHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwoModalHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const ids = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="dialog"]'),
    ).map((element) => element.getAttribute('aria-labelledby'));

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('ConfirmDeleteModalComponent · shipped call sites are unchanged', () => {
  async function renderHost(hostType: unknown): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [hostType as never] }).compileComponents();
    const fixture = TestBed.createComponent(hostType as never);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('does not print the permanence sentence twice for a call site that passes it as the message', async () => {
    // This is why the footnote's default had to become '' when it started rendering
    // unconditionally: ten call sites end up with "This cannot be undone." as `message` and no
    // items, and the old 'This cannot be undone.' default would now duplicate it on every one.
    const element = await renderHost(ShippedCallSiteHostComponent);

    expect(element.textContent).toContain('This cannot be undone.');
    expect(element.textContent?.match(/This cannot be undone\./g)).toHaveLength(1);
  });

  it('still shows one permanence line for a call site that passes nothing but a name', async () => {
    const element = await renderHost(BareCallSiteHostComponent);

    expect(element.textContent).toContain('Delete "The Hex"?');
    expect(element.textContent?.match(/This cannot be undone\./g)).toHaveLength(1);
  });

  it('leaves such a call site with the two buttons it has always had', async () => {
    const element = await renderHost(BareCallSiteHostComponent);

    const labels = Array.from(element.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Cancel', 'Delete']);
  });
});

describe('ConfirmDeleteModalComponent · the fallback does not pick its own controls', () => {
  it('skips the dialog when it is rendered ahead of the surface it belongs to', async () => {
    await TestBed.configureTestingModule({ imports: [DialogFirstHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DialogFirstHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const surfaceControl = element.querySelector<HTMLButtonElement>('.surface-control')!;

    // Open with focus on a control that will be gone by the time it closes, so the fallback runs.
    const doomed = document.createElement('button');
    element.appendChild(doomed);
    doomed.focus();
    fixture.componentInstance.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    doomed.remove();

    const dialogButtons = Array.from(
      element.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    );
    expect(dialogButtons.length).toBeGreaterThan(0);

    fixture.componentInstance.visible.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    // `ngOnChanges` runs before the view updates, so the dialog's own buttons are still in the DOM
    // when the fallback searches — and they come first here. It must not land on one of them.
    expect(document.activeElement).toBe(surfaceControl);
    expect(dialogButtons).not.toContain(document.activeElement);
  });
});
