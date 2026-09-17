import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { HunterService } from '../../../../core/hunter';
import { PlaybookListItemResponse } from '../../../../core/models';
import { PlaybookService } from '../../../../core/playbook';
import { HunterDraft } from '../../shared/hunter-draft';
import { buildPlaybook, option, section } from '../../shared/testing/pick-rule-playbooks';
import { HunterCreateStore } from './hunter-create.store';
import { HunterSheetPreviewComponent, pickedOptionText } from './hunter-sheet-preview';
import { HUNTER_STEP } from './hunter-step-model';

/** The wizard's dossier (hunter-creation-wizard.md 5, 13.4; Phase 7, F5). */

const book = buildPlaybook({
  id: 'pb-crooked',
  name: 'The Crooked',
  moveGrantCount: 2,
  statArrayOptions: [{ id: 'sa-1', charm: 1, cool: -1, sharp: 2, tough: 0, weird: 1, sortOrder: 0 }],
  extraTracks: [{ id: 'tr-c', name: 'Corruption', description: null, effectText: null, boxCount: 6, startLabel: null, endLabel: 'Lost', sortOrder: 0 }],
  bespokeSections: [
    section('bs-heat', 'Heat', { options: [option('heat-named', '{{blank}} wants you dead'), option('heat-cop', 'A cop')] }),
    section('bs-code', 'Code', { freeTextLabel: 'Your code' }),
  ],
  moves: [
    { id: 'mv-req', name: 'Always Yours', descriptionText: null, required: true, isAdvanced: false, sortOrder: 0, bespokeSections: [section('bs-first', 'First Encounter', { freeTextLabel: 'What happened' })] },
    { id: 'mv-1', name: 'Artful', descriptionText: null, required: false, isAdvanced: false, sortOrder: 1, bespokeSections: [] },
    { id: 'mv-2', name: 'Burglar', descriptionText: null, required: false, isAdvanced: false, sortOrder: 2, bespokeSections: [] },
  ],
  gearCategories: [
    { id: 'gc-w', label: 'Weapons', pickCount: 1, isOptional: false, sortOrder: 0, options: [{ id: 'go-knife', name: 'Knife', mechanicalText: null, sortOrder: 0 }, { id: 'go-gun', name: 'Gun', mechanicalText: null, sortOrder: 1 }] },
    { id: 'gc-g', label: 'A very long printed paragraph about what else you get.', pickCount: null, isOptional: false, sortOrder: 1, options: [{ id: 'go-car', name: 'A car', mechanicalText: null, sortOrder: 0 }] },
  ],
  lookCategories: [
    { id: 'lc-face', allowsFreeform: true, groupLabel: null, sortOrder: 0, options: [{ id: 'lo-scar', text: 'scarred face', sortOrder: 0 }] },
    { id: 'lc-eyes', allowsFreeform: true, groupLabel: null, sortOrder: 1, options: [] },
    { id: 'lc-hands', allowsFreeform: true, groupLabel: null, sortOrder: 2, options: [] },
  ],
});
const list: PlaybookListItemResponse[] = [{ id: book.id, name: book.name, statArrayOptionCount: 1, moveCount: 3, bespokeSectionCount: 2 }];

describe('HunterSheetPreviewComponent', () => {
  let fixture: ComponentFixture<HunterSheetPreviewComponent>;
  let store: HunterCreateStore;
  let draft: HunterDraft;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        HunterDraft,
        HunterCreateStore,
        { provide: PlaybookService, useValue: { getAll: () => of(list), getById: () => of(book) } },
        { provide: HunterService, useValue: {} },
      ],
    });
    store = TestBed.inject(HunterCreateStore);
    draft = TestBed.inject(HunterDraft);
    fixture = TestBed.createComponent(HunterSheetPreviewComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  const squash = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();
  const card = (name: string): HTMLElement | null => element.querySelector(`[data-card="${name}"]`);
  const lines = (name: string): string[] => Array.from(card(name)?.querySelectorAll('p') ?? []).map((p) => squash(p.textContent));
  /** A card's labelled rows as [label, value]. Angular drops whitespace between elements, so they are read apart. */
  const rows = (name: string): string[][] =>
    Array.from(card(name)?.querySelectorAll('p') ?? []).map((p) => {
      const label = p.querySelector(':scope > span.uppercase')?.textContent ?? '';
      return [squash(label), squash((p.textContent ?? '').slice(label.length))];
    });
  const render = (): void => fixture.detectChanges();
  const walkTo = (step: number): void => {
    for (let i = 0; i < 20 && store.current().step < step; i++) store.next();
    render();
  };

  it('starts empty, as the Mystery dossier does', () => {
    expect(squash(element.textContent)).toBe('Your hunter will take shape here as you work through each step.');
    expect(element.querySelectorAll('[data-card]')).toHaveLength(0);
  });

  it('shows the hunter card with name, pronouns and playbook badge as step 1 is filled in, and no other card yet', () => {
    store.init();
    store.playbookPicker.setValue(book.id);
    draft.form.controls.name.setValue('  Rook ');
    draft.form.controls.pronouns.setValue('they/them');
    render();

    expect(rows('hunter')).toEqual([['Name', 'Rook'], ['Pronouns', 'they/them'], ['Playbook', 'The Crooked']]);
    expect(card('hunter')?.querySelector('.bg-badge-playbook')?.textContent).toBe('The Crooked');
    expect(element.querySelectorAll('[data-card]')).toHaveLength(1);
  });

  it('adds each card once its step has been visited, in step order, and keeps it after going back', () => {
    store.playbookPicker.setValue(book.id);
    draft.form.controls.name.setValue('Rook');
    walkTo(HUNTER_STEP.ratings);
    expect(lines('ratings')).toEqual(['Not chosen yet.']);

    draft.form.controls.playbookStatArrayOptionId.setValue('sa-1');
    walkTo(HUNTER_STEP.tracks);
    expect(
      Array.from(card('ratings')!.querySelectorAll('.grid-cols-5 > span')).map((stat) =>
        Array.from(stat.children).map((part) => squash(part.textContent)).join(' ')
      )
    ).toEqual(['Charm +1', 'Cool -1', 'Sharp +2', 'Tough +0', 'Weird +1']);
    expect(lines('tracks')).toEqual(['Luck 0 of 7', 'Harm 0 of 7 · unstable at 4', 'Experience 0 of 5', 'Corruption 0 of 6']);
    expect(card('rules')).toBeNull();

    walkTo(HUNTER_STEP.rules);
    expect(lines('rules')).toEqual(['Nothing picked yet.']);
    draft.toggleBespoke('bs-heat', 'heat-named');
    draft.setBespokeAnswer('bs-heat', { optionId: 'heat-named', field: 'title', value: 'Big Tony' });
    draft.setFreeText('bs-code', 'Never rat.');
    render();
    expect(
      Array.from(card('rules')!.querySelectorAll(':scope > div')).map((block) => [
        squash(block.firstElementChild?.textContent),
        ...Array.from(block.querySelectorAll('p')).map((p) => squash(p.textContent)),
      ])
    ).toEqual([['Heat', 'Big Tony wants you dead'], ['Code', 'Never rat.']]);

    walkTo(HUNTER_STEP.moves);
    draft.setFreeText('bs-first', 'Saw it in the alley.');
    draft.toggleMove('mv-2');
    render();
    expect(lines('moves')).toEqual(['Always Yours', 'First Encounter: Saw it in the alley.', 'Burglar']);

    walkTo(HUNTER_STEP.gear);
    draft.toggleGear('go-gun');
    render();
    expect(rows('gear')).toEqual([['Weapons', 'Gun'], ['You get', 'A car']]);

    expect(Array.from(element.querySelectorAll('[data-card]')).map((c) => c.getAttribute('data-card'))).toEqual(['hunter', 'ratings', 'tracks', 'rules', 'moves', 'gear']);

    store.jumpTo(HUNTER_STEP.playbook);
    render();
    expect(element.querySelectorAll('[data-card]')).toHaveLength(6);
  });

  it('adds the look line to the hunter card once the last step is reached', () => {
    store.playbookPicker.setValue(book.id);
    draft.form.controls.name.setValue('Rook');
    draft.setLookOption('lc-face', 'lo-scar');
    draft.setLookFreeform('lc-hands', ' calloused hands ');
    walkTo(HUNTER_STEP.gear);
    expect(card('hunter')?.querySelector('[data-line="look"]')).toBeNull();

    walkTo(HUNTER_STEP.introductions);
    expect(rows('hunter').at(-1)).toEqual(['Look', 'scarred face, calloused hands']);
  });

  it('writes a picked option as its title, a filled blank, a description with tags stripped, or a number', () => {
    const answer = (extra: Partial<{ freeformTitle: string; freeformText: string; numericValue: number | null }>) => ({ freeformTitle: '', freeformText: '', numericValue: null, ...extra });

    expect(pickedOptionText(option('a', 'A cop'), undefined)).toBe('A cop');
    expect(pickedOptionText(option('b', '{{blank}} blade'), answer({ freeformTitle: ' Silver ' }))).toBe('Silver blade');
    expect(pickedOptionText(option('c', '{{blank}} blade'), undefined)).toBe('___ blade');
    expect(pickedOptionText(option('d', null, { descriptionText: '<b>Owes</b> you {{blank}}' }), answer({ freeformText: 'a favour' }))).toBe('Owes you a favour');
    expect(pickedOptionText(option('e', 'Charm', { descriptionText: 'Wards off {{blank}}' }), answer({ freeformText: 'iron' }))).toBe('Charm: Wards off iron');
    expect(pickedOptionText(option('f', 'Infernal Favour', { numericMin: 0, numericMax: 3 }), answer({ numericValue: 3 }))).toBe('Infernal Favour 3');
  });
});
