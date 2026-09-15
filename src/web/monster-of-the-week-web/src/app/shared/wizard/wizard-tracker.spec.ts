import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WizardStepStatus, WizardTrackerComponent, WizardTrackerStep } from './wizard-tracker';

function step(label: string, status: WizardStepStatus, options: Partial<WizardTrackerStep> = {}): WizardTrackerStep {
  return { label, status, clickable: status !== 'unreached', subSteps: [], icon: label.toLowerCase(), ...options };
}

@Component({
  imports: [WizardTrackerComponent],
  template: `
    <app-wizard-tracker
      [steps]="steps()"
      [currentIndex]="currentIndex()"
      [currentSubIndex]="currentSubIndex()"
      [iconTemplate]="withIcons() ? icon : null"
      [collapseLabelsBelowLg]="collapseLabelsBelowLg()"
      (jump)="jumps.push($event)" />

    <ng-template #icon let-step><i class="test-icon">{{ step.icon }}</i></ng-template>
  `,
})
class HostComponent {
  readonly steps = signal<WizardTrackerStep[]>([
    step('Mystery', 'finished'),
    step('Monsters', 'finished'),
    step('Locations', 'unreached'),
    step('Bystanders', 'unreached'),
  ]);
  readonly currentIndex = signal(0);
  readonly currentSubIndex = signal(0);
  readonly withIcons = signal(false);
  readonly collapseLabelsBelowLg = signal(false);
  readonly jumps: number[] = [];
}

describe('WizardTrackerComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = () => fixture.nativeElement as HTMLElement;
  const bubbles = () => Array.from(element().querySelectorAll<HTMLButtonElement>('.phase-bubble'));
  const lines = () => Array.from(element().querySelectorAll<HTMLElement>('.tracker-line'));
  const labels = () => Array.from(element().querySelectorAll<HTMLElement>('.tracker-label'));
  const phases = () => Array.from(element().querySelectorAll<HTMLElement>('.tracker-phase'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('generates one grid column per step with a connector column between each pair', () => {
    const tracker = fixture.debugElement.children[0].componentInstance as WizardTrackerComponent;
    const connector = 'var(--wizard-tracker-connector)';

    expect(tracker.gridTemplateColumns).toBe(['auto', 'auto', 'auto', 'auto'].join(` ${connector} `));
    expect(element().querySelector<HTMLElement>('.tracker')!.style.gridTemplateColumns).toBe(tracker.gridTemplateColumns);
    expect(bubbles().length).toBe(4);
    expect(lines().length).toBe(3);
    expect(phases().map((phase) => phase.style.gridColumn)).toEqual(['1', '3', '5', '7']);
    expect(lines().map((line) => line.style.gridColumn)).toEqual(['2', '4', '6']);

    host.steps.set(Array.from({ length: 8 }, (_, index) => step('Step ' + index, 'unreached')));
    fixture.detectChanges();

    const tracks = tracker.gridTemplateColumns.split(` ${connector} `);
    expect(tracks).toEqual(Array(8).fill('auto'));
    expect(bubbles().length).toBe(8);
    expect(lines().length).toBe(7);
    expect(phases()[7].style.gridColumn).toBe('15');

    host.steps.set([step('Only', 'unreached')]);
    fixture.detectChanges();
    expect(tracker.gridTemplateColumns).toBe('auto');
    expect(lines().length).toBe(0);
  });

  it('lets the current step win over finished: accent with a check, never green', () => {
    host.currentIndex.set(1);
    fixture.detectChanges();

    const [first, current] = bubbles();

    expect(current.classList).toContain('active');
    expect(current.classList).not.toContain('complete');
    expect(current.textContent?.trim()).toBe('✓');
    expect(current.getAttribute('aria-current')).toBe('step');

    expect(first.classList).toContain('complete');
    expect(first.classList).not.toContain('active');
    expect(first.textContent?.trim()).toBe('✓');
    expect(first.hasAttribute('aria-current')).toBe(false);
  });

  it('renders the rest of the status ladder', () => {
    host.steps.set([
      step('Playbook', 'visited'),
      step('Ratings', 'unreached'),
      step('Rules', 'notApplicable', { clickable: true }),
      step('Moves', 'unreached', { clickable: true }),
    ]);
    host.currentIndex.set(3);
    fixture.detectChanges();

    const [visited, unreached, notApplicable, current] = bubbles();

    expect(visited.classList).toContain('visited');
    expect(visited.disabled).toBe(false);
    expect(visited.textContent?.trim()).toBe('1');

    expect(unreached.className).not.toMatch(/\b(active|complete|visited|not-applicable)\b/);
    expect(unreached.disabled).toBe(true);
    expect(unreached.textContent?.trim()).toBe('2');

    expect(notApplicable.classList).toContain('not-applicable');
    expect(notApplicable.disabled).toBe(true);
    expect(notApplicable.textContent?.trim()).toBe('–');

    expect(current.classList).toContain('active');
    expect(current.textContent?.trim()).toBe('4');
  });

  it('emits jump only for clickable, applicable steps', () => {
    host.steps.set([
      step('Mystery', 'finished'),
      step('Monsters', 'unreached'),
      step('Rules', 'notApplicable', { clickable: true }),
    ]);
    fixture.detectChanges();

    const tracker = fixture.debugElement.children[0].componentInstance as WizardTrackerComponent;
    bubbles()[0].click();
    bubbles()[1].click();
    bubbles()[2].click();
    tracker.select(1);
    tracker.select(2);
    tracker.select(9);

    expect(host.jumps).toEqual([0]);
  });

  it('lights a connector once the step before it is finished', () => {
    expect(lines().map((line) => line.classList.contains('complete'))).toEqual([true, true, false]);
  });

  it('marks sub-step dots with the same precedence and hides them from assistive tech', () => {
    host.steps.set([
      step('Mystery', 'unreached', { clickable: true, subSteps: ['finished', 'finished', 'unreached', 'unreached'] }),
      step('Locations', 'unreached'),
    ]);
    host.currentSubIndex.set(1);
    fixture.detectChanges();

    const [withDots, withoutDots] = phases();
    const dots = Array.from(withDots.querySelectorAll('.step-dot'));

    expect(dots.map((dot) => [dot.classList.contains('active'), dot.classList.contains('complete')])).toEqual([
      [false, true],
      [true, false],
      [false, false],
      [false, false],
    ]);
    expect(withDots.querySelector('.tracker-dots')!.getAttribute('aria-hidden')).toBe('true');
    expect(withoutDots.querySelectorAll('.step-dot').length).toBe(0);

    // Dots on a step that isn't current are never "active", whatever the sub-index says.
    host.currentIndex.set(1);
    fixture.detectChanges();
    expect(phases()[0].querySelectorAll('.step-dot.active').length).toBe(0);
  });

  it('labels each bubble with its number, name and status', () => {
    host.steps.set([
      step('Playbook', 'finished'),
      step('Ratings', 'visited'),
      step('Tracks', 'unreached', { clickable: true }),
      step('Rules', 'notApplicable'),
      step('Moves', 'unreached'),
    ]);
    host.currentIndex.set(2);
    fixture.detectChanges();

    expect(bubbles().map((bubble) => bubble.getAttribute('aria-label'))).toEqual([
      'Step 1, Playbook, finished',
      'Step 2, Ratings, unfinished',
      'Step 3, Tracks, unfinished',
      'Step 4, Rules, not applicable',
      'Step 5, Moves, not started',
    ]);
    expect(bubbles().filter((bubble) => bubble.getAttribute('aria-current') === 'step').length).toBe(1);
  });

  it('renders icons through the optional template, with the step as context', () => {
    expect(element().querySelectorAll('.test-icon').length).toBe(0);

    host.withIcons.set(true);
    fixture.detectChanges();

    const icons = Array.from(element().querySelectorAll('.tracker-label .test-icon'));
    expect(icons.map((icon) => icon.textContent)).toEqual(['mystery', 'monsters', 'locations', 'bystanders']);
  });

  it('goes compact below md: only the current label stays visible, bubbles, connectors and padding shrink', () => {
    host.currentIndex.set(2);
    fixture.detectChanges();

    expect(labels().map((label) => label.classList.contains('max-md:sr-only'))).toEqual([true, true, false, true]);
    expect(labels().some((label) => label.classList.contains('max-lg:sr-only'))).toBe(false);
    // Hidden labels stay in the DOM for screen readers, and keep their base classes.
    expect(labels().every((label) => label.classList.contains('text-xs'))).toBe(true);

    for (const bubble of bubbles()) {
      expect(Array.from(bubble.classList)).toEqual(expect.arrayContaining(['h-7', 'w-7', 'md:h-9', 'md:w-9']));
    }
    expect(Array.from(element().querySelector('.tracker')!.classList)).toEqual(expect.arrayContaining(['px-4', 'md:px-8']));
    expect(Array.from(lines()[0].classList)).toEqual(expect.arrayContaining(['min-w-2', 'md:min-w-6']));

    host.currentIndex.set(0);
    fixture.detectChanges();
    expect(labels().map((label) => label.classList.contains('max-md:sr-only'))).toEqual([false, true, true, true]);
  });

  it('collapses non-current labels below lg instead when asked', () => {
    host.collapseLabelsBelowLg.set(true);
    host.currentIndex.set(1);
    fixture.detectChanges();

    expect(labels().map((label) => label.classList.contains('max-lg:sr-only'))).toEqual([true, false, true, true]);
    expect(labels().some((label) => label.classList.contains('max-md:sr-only'))).toBe(false);
  });
});
