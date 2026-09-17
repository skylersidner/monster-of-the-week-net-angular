import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WizardLayoutComponent } from './wizard-layout';

@Component({
  imports: [WizardLayoutComponent],
  template: `
    <button type="button" class="outside">Outside</button>
    <app-wizard-layout [eyebrow]="eyebrow()" [title]="title()" [blurb]="blurb()" [error]="error()" [stepKey]="stepKey()">
      <div wizardTracker class="test-tracker">tracker</div>
      <span wizardTitleIcon class="test-title-icon">*</span>
      <p class="test-step">Step content</p>
      <button wizardFooter type="button" class="test-back">Back</button>
      <button wizardFooter type="button" class="test-next">Next</button>
      <div wizardAside class="test-aside">dossier</div>
    </app-wizard-layout>
  `,
})
class HostComponent {
  readonly eyebrow = signal('Phase 1 · Step 1');
  readonly title = signal("What's the Core Idea?");
  readonly blurb = signal('Every mystery starts with a concept.');
  readonly error = signal<string | null>(null);
  readonly stepKey = signal('0-0');
}

@Component({
  imports: [WizardLayoutComponent],
  template: `
    <app-wizard-layout eyebrow="Step 5 of 8" title="What Can They Do?" blurb="" error="Refused." stepKey="4-0">
      <button wizardErrorAction type="button" class="test-error-action">Go to Gear</button>
    </app-wizard-layout>
  `,
})
class ActionHostComponent {}

describe('WizardLayoutComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = () => fixture.nativeElement as HTMLElement;
  const column = () => element().querySelector<HTMLElement>('section')!;
  const heading = () => element().querySelector<HTMLElement>('h1')!;
  const outside = () => element().querySelector<HTMLButtonElement>('.outside')!;

  /** jsdom does no layout, so `scrollTop` is always 0; give the column a writable one. */
  function scrollColumnTo(top: number): void {
    Object.defineProperty(column(), 'scrollTop', { value: top, writable: true, configurable: true });
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('projects each slot into its place in the shell', async () => {
    await render();

    const root = element().querySelector('.wizard-layout')!;
    const aside = element().querySelector('aside')!;

    // The shell sets the theme's text colour for everything projected into it. Without it, content
    // with no colour class of its own renders the browser's black on the dark theme's surfaces.
    expect(root.classList).toContain('text-primary');
    expect(root.contains(column()) && root.contains(aside)).toBe(true);
    expect(root.firstElementChild?.classList).toContain('test-tracker');
    expect(column().querySelector('.test-tracker')).toBeNull();
    expect(heading().querySelector('.test-title-icon')).not.toBeNull();
    expect(heading().textContent).toContain("What's the Core Idea?");
    expect(column().textContent).toContain('Phase 1 · Step 1');
    expect(column().textContent).toContain('Every mystery starts with a concept.');
    expect(column().querySelector('.test-step')).not.toBeNull();
    expect(Array.from(column().querySelectorAll('.mt-auto button')).map((button) => button.textContent)).toEqual(['Back', 'Next']);
    expect(aside.querySelector('.test-aside')).not.toBeNull();
    expect(column().querySelector('.test-aside')).toBeNull();
  });

  it('shows the error band only when there is an error', async () => {
    await render();
    expect(column().querySelector('.bg-danger-subtle')).toBeNull();

    host.error.set('Unable to save.');
    await render();

    const band = column().querySelector('.bg-danger-subtle')!;
    expect(band.textContent).toBe('Unable to save.');
    // The band sits after the step content and before the footer.
    expect(column().querySelector('.test-step')!.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(band.compareDocumentPosition(column().querySelector('.mt-auto')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('projects an optional action into the error band, after the message (the hunter wizard\'s L7 link)', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({ imports: [ActionHostComponent] })
      .compileComponents();
    const actionFixture = TestBed.createComponent(ActionHostComponent);
    actionFixture.detectChanges();
    await actionFixture.whenStable();
    const root = actionFixture.nativeElement as HTMLElement;

    const band = root.querySelector('.bg-danger-subtle')!;
    expect(band.firstChild?.textContent).toBe('Refused.');
    expect(band.querySelector('button.test-error-action')?.textContent).toBe('Go to Gear');
  });

  it('keeps the 42% column at desktop widths and stacks to one column below md', async () => {
    await render();

    expect(Array.from(column().classList)).toEqual(expect.arrayContaining(['w-full', 'md:w-[42%]', 'md:border-r', 'overflow-y-auto']));
    expect(column().classList).not.toContain('w-[42%]');
    expect(Array.from(element().querySelector('aside')!.classList)).toEqual(expect.arrayContaining(['flex-1', 'max-md:hidden']));
  });

  it('does not move focus or scroll on first render', async () => {
    outside().focus();
    await render();

    expect(heading().getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(outside());
  });

  it('resets the column scroll and focuses the step heading when the step changes', async () => {
    await render();
    outside().focus();
    scrollColumnTo(640);

    host.stepKey.set('0-1');
    host.title.set('How Do the Hunters Get Involved?');
    await render();

    expect(column().scrollTop).toBe(0);
    expect(document.activeElement).toBe(heading());
    expect(heading().textContent).toContain('How Do the Hunters Get Involved?');

    // And again on the next change, after the user has scrolled and moved on.
    outside().focus();
    scrollColumnTo(300);
    host.stepKey.set('1-0');
    await render();

    expect(column().scrollTop).toBe(0);
    expect(document.activeElement).toBe(heading());
  });

  it('leaves scroll and focus alone when other inputs change on the same step', async () => {
    await render();
    outside().focus();
    scrollColumnTo(640);

    host.error.set('Finish or clear the minion you are editing before continuing.');
    host.blurb.set('A different blurb.');
    await render();

    expect(column().scrollTop).toBe(640);
    expect(document.activeElement).toBe(outside());
  });
});
