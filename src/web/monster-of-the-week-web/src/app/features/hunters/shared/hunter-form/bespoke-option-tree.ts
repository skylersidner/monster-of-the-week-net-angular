import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { BespokeOptionResponse } from '../../../../core/models';

/** One recorded answer against a single option, as the form holds it before submit. */
export interface BespokeOptionAnswer {
  readonly freeformTitle: string;
  readonly freeformText: string;
  readonly numericValue: number | null;
}

/**
 * Renders a bespoke option tree to any depth. Its own child instance is what makes it
 * recursive; real data reaches three levels (architecture.md 6.1).
 *
 * <b>An option with children is a heading, not a pick.</b> That is 6.4's rule and it is what
 * this component's shape encodes: only leaves get a checkbox, and a category counts as engaged
 * purely because something under it is ticked. Rendering a checkbox on a divider would invite a
 * state the server has no way to store — there is no "this category is chosen" row, by design.
 *
 * All state lives in `HunterFormComponent`; this component is presentational and emits. That
 * keeps one map as the single source of truth rather than a tree of nested component state
 * that would have to be gathered back up on submit.
 */
@Component({
  selector: 'app-bespoke-option-tree',
  standalone: true,
  // Self-import via forwardRef is what makes the template able to render itself; the class
  // is not yet defined when the decorator metadata is evaluated.
  imports: [forwardRef(() => BespokeOptionTreeComponent)],
  templateUrl: './bespoke-option-tree.html',
  host: { class: 'block' },
})
export class BespokeOptionTreeComponent {
  @Input({ required: true }) options: BespokeOptionResponse[] = [];
  /** Option ids ticked within this scope — a whole section, or one instance of a repeatable one. */
  @Input({ required: true }) picked: ReadonlySet<string> = new Set();
  @Input({ required: true }) answers: ReadonlyMap<string, BespokeOptionAnswer> = new Map();
  /**
   * Identifies whose maximum governs the options at *this* level: the parent option's id, or
   * the empty string at a section's own top level.
   */
  @Input({ required: true }) parentKey = '';
  /** Scopes whose maximum is already met, so their unticked options render disabled. */
  @Input() lockedScopes: ReadonlySet<string> = new Set();

  @Output() readonly toggled = new EventEmitter<string>();
  @Output() readonly answerChanged = new EventEmitter<{
    optionId: string;
    field: 'title' | 'text' | 'numeric';
    value: string;
  }>();

  isLeaf(option: BespokeOptionResponse): boolean {
    return option.children.length === 0;
  }

  /** The blank-fill token from architecture.md 6.3 — where a free-text input belongs. */
  hasBlankTitle(option: BespokeOptionResponse): boolean {
    return (option.title ?? '').includes('{{blank}}');
  }

  hasBlankText(option: BespokeOptionResponse): boolean {
    return (option.descriptionText ?? '').includes('{{blank}}');
  }

  /** The template text with the token stripped, so the label reads as a sentence with a gap. */
  withoutBlank(text: string | null): string {
    return (text ?? '').replace(/\{\{blank\}\}/g, ' ______ ');
  }

  answerFor(optionId: string, field: 'title' | 'text'): string {
    const answer = this.answers.get(optionId);
    return field === 'title' ? (answer?.freeformTitle ?? '') : (answer?.freeformText ?? '');
  }

  numericFor(option: BespokeOptionResponse): number {
    return this.answers.get(option.id)?.numericValue ?? option.numericMin ?? 0;
  }

  isNumeric(option: BespokeOptionResponse): boolean {
    return option.numericMin !== null || option.numericMax !== null;
  }

  isDisabled(option: BespokeOptionResponse): boolean {
    return this.lockedScopes.has(this.parentKey) && !this.picked.has(option.id);
  }

  /** Pick-count hint for a category divider, e.g. "pick 2" or "pick 2–3". */
  hint(option: BespokeOptionResponse): string | null {
    if (option.minSelect === null && option.maxSelect === null) {
      return null;
    }
    if (option.minSelect !== null && option.minSelect === option.maxSelect) {
      return `pick ${option.minSelect}`;
    }
    if (option.maxSelect === null) {
      return `pick at least ${option.minSelect}`;
    }
    return `pick ${option.minSelect ?? 0}–${option.maxSelect}`;
  }
}
