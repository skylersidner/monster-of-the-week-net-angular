import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';

/** One rung of the tracker's status ladder (hunter-creation-wizard.md §4.2). "Current" is not a status. */
export type WizardStepStatus = 'unreached' | 'visited' | 'finished' | 'notApplicable';

export interface WizardTrackerStep {
  label: string;
  status: WizardStepStatus;
  /** Whether the bubble can be used to jump to this step. The wizard owns the access rule. */
  clickable: boolean;
  /** One entry per step dot; empty when the step has no dots. */
  subSteps: readonly WizardStepStatus[];
  /** Opaque value handed to `iconTemplate` (e.g. a mystery section icon kind). Unused by the tracker. */
  icon?: string;
}

export interface WizardTrackerIconContext {
  $implicit: WizardTrackerStep;
}

/**
 * Presentational "pizza tracker" shared by the wizards. It injects no store: each wizard maps its own
 * state onto `steps`, `currentIndex` and `currentSubIndex`, and handles `jump`.
 *
 * "Current" comes from `currentIndex`, never from a status class, so the current bubble or dot can't
 * also carry `.complete` — the current step always wins (fixes the precedence bug in
 * luigi-theming-phase6-mystery-wizard.md §6).
 *
 * Below `md` the tracker is compact: only the current step's label stays visible (the rest are
 * `sr-only`), bubbles shrink to `h-7 w-7`, connectors to `minmax(0.5rem, 1.5rem)` and padding to `px-4`.
 */
@Component({
  selector: 'app-wizard-tracker',
  imports: [NgTemplateOutlet],
  templateUrl: './wizard-tracker.html',
  styleUrl: './wizard-tracker.scss',
  host: { class: 'block shrink-0' },
})
export class WizardTrackerComponent {
  @Input() steps: readonly WizardTrackerStep[] = [];
  @Input() currentIndex = 0;
  @Input() currentSubIndex = 0;
  @Input() iconTemplate: TemplateRef<WizardTrackerIconContext> | null = null;
  /** Hide non-current labels below `lg` rather than only below `md`. Off for Mysteries (L18). */
  @Input() collapseLabelsBelowLg = false;

  @Output() jump = new EventEmitter<number>();

  /** `auto` per step with a connector track between each pair; the connector width is set in the SCSS. */
  get gridTemplateColumns(): string {
    return this.steps.map(() => 'auto').join(' var(--wizard-tracker-connector) ');
  }

  isCurrent(index: number): boolean {
    return index === this.currentIndex;
  }

  isEnabled(step: WizardTrackerStep): boolean {
    return step.clickable && step.status !== 'notApplicable';
  }

  bubbleText(step: WizardTrackerStep, index: number): string {
    if (step.status === 'notApplicable') {
      return '–';
    }

    return step.status === 'finished' ? '✓' : String(index + 1);
  }

  ariaLabel(step: WizardTrackerStep, index: number): string {
    return `Step ${index + 1}, ${step.label}, ${this.statusText(step, index)}`;
  }

  /** Non-current labels are visually hidden on narrow screens; the current one always shows. */
  labelVisibilityClass(index: number): string {
    if (this.isCurrent(index)) {
      return '';
    }

    return this.collapseLabelsBelowLg ? 'max-lg:sr-only' : 'max-md:sr-only';
  }

  isCurrentDot(index: number, subIndex: number): boolean {
    return this.isCurrent(index) && subIndex === this.currentSubIndex;
  }

  select(index: number): void {
    const step = this.steps[index];
    if (!step || !this.isEnabled(step)) {
      return;
    }

    this.jump.emit(index);
  }

  private statusText(step: WizardTrackerStep, index: number): string {
    switch (step.status) {
      case 'finished':
        return 'finished';
      case 'notApplicable':
        return 'not applicable';
      case 'visited':
        return 'unfinished';
      default:
        return this.isCurrent(index) ? 'unfinished' : 'not started';
    }
  }
}
