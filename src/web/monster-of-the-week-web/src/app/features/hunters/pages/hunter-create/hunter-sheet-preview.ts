import { Component, computed, inject } from '@angular/core';
import { BespokeOptionResponse, BespokeSectionResponse } from '../../../../core/models';
import { BespokeOptionAnswer } from '../../shared/hunter-form/bespoke-option-tree';
import { HunterDraft } from '../../shared/hunter-draft';
import { HunterCreateStore } from './hunter-create.store';
import { HUNTER_STEP } from './hunter-step-model';

/**
 * The wizard's live dossier (hunter-creation-wizard.md 5, 13.4; Phase 7, F5), in the Mystery dossier's
 * card vocabulary. It reads the draft and the store and owns nothing.
 *
 * Cards appear once their step has been visited, in step order: the hunter (with the look line once
 * step 8 is reached), Ratings, Tracks, Rules, Moves, Gear. Improvements has no card: it is reference,
 * not something the hunter has built. The layout hides the whole aside below `md` (L23).
 */
@Component({
  selector: 'app-hunter-sheet-preview',
  templateUrl: './hunter-sheet-preview.html',
  host: { class: 'block' },
})
export class HunterSheetPreviewComponent {
  readonly store = inject(HunterCreateStore);
  readonly draft = inject(HunterDraft);

  readonly stats = STATS;

  /** The loaded playbook, only once it is the one chosen (not the previous one while a switch loads). */
  readonly book = computed(() => {
    const playbook = this.draft.playbook();
    return playbook && playbook.id === this.draft.formValue().playbookId ? playbook : null;
  });

  readonly isEmpty = computed(() => !this.draft.formValue().name.trim() && !this.draft.formValue().playbookId);

  readonly playbookName = computed(() => {
    const id = this.draft.formValue().playbookId;
    return this.book()?.name ?? this.store.playbooks().find((playbook) => playbook.id === id)?.name ?? null;
  });

  readonly rating = computed(() => {
    const id = this.draft.formValue().playbookStatArrayOptionId;
    return this.book()?.statArrayOptions.find((option) => option.id === id) ?? null;
  });

  readonly trackLines = computed(() => {
    const book = this.book();
    if (!book) {
      return [];
    }
    const value = this.draft.formValue();
    return [
      `Luck ${value.luck} of ${book.luckBoxCount}`,
      `Harm ${value.harm} of ${book.harmBoxCount} · unstable at ${book.harmUnstableThreshold}`,
      `Experience ${value.experience} of ${book.experienceBoxCount}`,
      ...book.extraTracks.map((track) => `${track.name} ${this.draft.trackValueFor(track.id)} of ${track.boxCount}`),
    ];
  });

  readonly rulesBlocks = computed(() =>
    (this.book()?.bespokeSections ?? [])
      .map((section) => ({ id: section.id, title: section.title, lines: this.sectionLines(section) }))
      .filter((block) => block.lines.length > 0)
  );

  readonly moveEntries = computed(() => {
    const book = this.book();
    if (!book) {
      return [];
    }
    return book.moves
      .filter((move) => !move.isAdvanced && (move.required || this.draft.isMoveSelected(move.id)))
      .map((move) => ({
        id: move.id,
        name: move.name,
        lines: this.draft
          .moveSectionsFor(move)
          .flatMap((section) => this.sectionLines(section).map((line) => `${section.title}: ${line}`)),
      }));
  });

  readonly gearLines = computed(() => {
    const categories = this.book()?.gearCategories ?? [];
    const picked = categories
      .filter((category) => category.pickCount !== null)
      .map((category) => ({
        id: category.id,
        label: category.label,
        items: category.options.filter((option) => this.draft.isGearSelected(option.id)).map((option) => option.name),
      }))
      .filter((line) => line.items.length > 0);
    // Granted categories as one line: the Initiate's armour category label is a whole paragraph (Q11).
    const granted = categories.filter((category) => category.pickCount === null).flatMap((category) => category.options.map((option) => option.name));
    return granted.length > 0 ? [...picked, { id: 'granted', label: 'You get', items: granted }] : picked;
  });

  readonly lookLine = computed(() => {
    const answers = this.draft.lookAnswers();
    return (this.book()?.lookCategories ?? [])
      .map((category) => {
        const answer = answers.get(category.id);
        if (!answer) {
          return null;
        }
        return answer.optionId
          ? (category.options.find((option) => option.id === answer.optionId)?.text ?? null)
          : answer.freeform.trim() || null;
      })
      .filter((text): text is string => text !== null)
      .join(', ');
  });

  readonly rulesApplicable = computed(() => this.store.steps()[HUNTER_STEP.rules].applicable);

  visited(step: keyof typeof HUNTER_STEP): boolean {
    return this.store.furthest().step >= HUNTER_STEP[step];
  }

  formatStat(value: number): string {
    return value < 0 ? `${value}` : `+${value}`;
  }

  /** What a section holds, one line per entry, pick or free text. A fixed grant holds nothing. */
  private sectionLines(section: BespokeSectionResponse): string[] {
    if (this.draft.isRepeatable(section)) {
      return this.draft.instancesFor(section).map((instance, index) => instance.name.trim() || `Entry ${index + 1}`);
    }
    const lines: string[] = [];
    const freeText = this.draft.freeTextFor(section.id).trim();
    if (freeText) {
      lines.push(freeText);
    }
    const picked = this.draft.picksFor(section.id);
    const answers = this.draft.answersFor(section.id);
    const walk = (options: readonly BespokeOptionResponse[]): void => {
      for (const option of options) {
        if (option.children.length > 0) {
          walk(option.children);
        } else if (picked.has(option.id)) {
          lines.push(pickedOptionText(option, answers.get(option.id)));
        }
      }
    };
    walk(section.options);
    return lines;
  }
}

/**
 * A picked option as one line: its title with any blank filled in, then its description (tags
 * stripped, blank filled) when it has no title or carries a blank of its own, then a numeric value.
 */
export function pickedOptionText(option: BespokeOptionResponse, answer: BespokeOptionAnswer | undefined): string {
  const fill = (text: string, value: string | undefined): string => text.replace(/\{\{blank\}\}/g, value?.trim() || '___');
  const title = option.title ? fill(option.title, answer?.freeformTitle) : '';
  const description =
    option.descriptionText && (!title || option.descriptionText.includes('{{blank}}'))
      ? fill(option.descriptionText.replace(/<[^>]*>/g, ''), answer?.freeformText)
      : '';
  const text = [title, description].filter((part) => part.trim().length > 0).join(': ');
  const numeric = answer?.numericValue;
  return numeric !== null && numeric !== undefined ? `${text} ${numeric}` : text;
}

const STATS: readonly { readonly key: 'charm' | 'cool' | 'sharp' | 'tough' | 'weird'; readonly label: string }[] = [
  { key: 'charm', label: 'Charm' },
  { key: 'cool', label: 'Cool' },
  { key: 'sharp', label: 'Sharp' },
  { key: 'tough', label: 'Tough' },
  { key: 'weird', label: 'Weird' },
];
