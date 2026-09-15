import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BespokeOptionResponse, BespokeSectionResponse, PlaybookDetailResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { HunterBespokeSectionComponent } from './hunter-bespoke-section';

@Component({
  imports: [HunterBespokeSectionComponent],
  template: `<div appHunterBespokeSection [section]="section()" [mode]="mode()"></div>`,
})
class HostComponent {
  readonly section = signal<BespokeSectionResponse>(null!);
  readonly mode = signal<'create' | 'edit'>('edit');
}

function option(id: string, title: string, extra: Partial<BespokeOptionResponse> = {}): BespokeOptionResponse {
  return { id, title, descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [], ...extra };
}

function section(id: string, title: string, extra: Partial<BespokeSectionResponse> = {}): BespokeSectionResponse {
  return { id, title, description: null, effectText: null, freeTextLabel: null, minSelect: null, maxSelect: null, minInstances: null, maxInstances: null, sortOrder: 0, options: [], ...extra };
}

const fixedGrant = section('bs-fixed', 'Monster Breed', { description: '<p>You are part monster.</p>', effectText: 'Always on.' });
const fate = section('bs-fate', 'Fate', {
  minSelect: 1,
  maxSelect: 1,
  options: [option('cat-doom', 'Doom', { minSelect: 1, maxSelect: 1, children: [option('leaf-betrayed', 'Betrayed'), option('leaf-forgotten', 'Forgotten')] })],
});
const rotes = section('bs-rotes', 'Rotes', { freeTextLabel: 'Rote name', minInstances: 0, maxInstances: 2, minSelect: 1, maxSelect: 1, options: [option('rote-words', 'Words')] });
const code = section('bs-code', 'Code', { freeTextLabel: 'Your code' });
/** The Spooktacular's The Show: the seed's one numeric leaf, 0–3. */
const show = section('bs-show', 'The Show', { options: [option('opt-favour', 'Infernal Favour', { numericMin: 0, numericMax: 3 })] });

const playbook: PlaybookDetailResponse = {
  id: 'pb1', name: 'The Test Subject', description: null, luckBoxCount: 7, luckSpecialText: null,
  harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5, moveGrantCount: 0,
  gettingStartedText: null, introductionsText: null, levelingUpText: null, historyPromptsText: null,
  statArrayOptions: [], moves: [], gearCategories: [], lookCategories: [], improvements: [],
  bespokeSections: [fixedGrant, fate, rotes, code, show], bespokeJournals: [], extraTracks: [],
};

describe('HunterBespokeSectionComponent (13.6)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let draft: HunterDraft;
  let element: HTMLElement;

  function render(target: BespokeSectionResponse, mode: 'create' | 'edit' = 'edit'): void {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [HunterDraft] });
    draft = TestBed.inject(HunterDraft);
    draft.playbook.set(playbook);
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.section.set(target);
    fixture.componentInstance.mode.set(mode);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  const progress = (): string | undefined => element.querySelector('[apphunterbespokesection] > div > small')?.textContent?.trim();
  const buttonNamed = (text: string): HTMLButtonElement | undefined =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  const leaf = (title: string): HTMLInputElement =>
    Array.from(element.querySelectorAll('label'))
      .find((label) => label.querySelector('span.font-medium')?.textContent?.trim() === title)!
      .querySelector('input[type="checkbox"]')!;

  it('renders a fixed grant read-only, between its description and effect text', () => {
    render(fixedGrant);

    expect(element.querySelector('[apphunterbespokesection]')?.classList).toContain('grid');
    expect(element.textContent).toContain('Always active — nothing to choose.');
    expect(element.querySelector('p')?.textContent).toBe('You are part monster.');
    expect(element.textContent).toContain('Always on.');
    expect(element.querySelector('input, textarea')).toBeNull();
  });

  it('counts an engaged category and locks its remaining siblings at the maximum', () => {
    render(fate);
    expect(progress()).toBe('0 of 1 picked');

    leaf('Betrayed').click();
    fixture.detectChanges();

    expect(draft.picksFor('bs-fate').has('leaf-betrayed')).toBe(true);
    expect(progress()).toBe('1 of 1 picked');
    expect(leaf('Forgotten').disabled).toBe(true);
  });

  it('adds, names and removes repeatable entries, with no section counter and no + Add past the maximum', () => {
    render(rotes);
    expect(element.textContent).toContain('None yet.');
    expect(progress()).toBeUndefined();

    buttonNamed('+ Add')!.click();
    fixture.detectChanges();
    buttonNamed('+ Add')!.click();
    fixture.detectChanges();

    expect(draft.instancesFor(rotes)).toHaveLength(2);
    expect(buttonNamed('+ Add')).toBeUndefined();
    expect(element.textContent).not.toContain('None yet.');

    const name = element.querySelector<HTMLInputElement>('input[placeholder="Rote name"]')!;
    name.value = 'Ward';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(draft.instancesFor(rotes)[0].name).toBe('Ward');

    buttonNamed('Remove')!.click();
    fixture.detectChanges();
    expect(draft.instancesFor(rotes)).toHaveLength(1);
    expect(buttonNamed('+ Add')).toBeTruthy();
  });

  it('writes a free-text section to the draft', () => {
    render(code);

    const textarea = element.querySelector('textarea')!;
    expect(textarea.closest('label')?.textContent).toContain('Your code');
    textarea.value = 'Never lie to a friend.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(draft.freeTextFor('bs-code')).toBe('Never lie to a friend.');
  });

  it('edit mode (the default): a ticked numeric leaf is an input starting at NumericMax (L14)', () => {
    render(show);

    leaf('Infernal Favour').click();
    fixture.detectChanges();

    const input = element.querySelector<HTMLInputElement>('input[type="number"]')!;
    expect(input).toBeTruthy();
    expect(input.value).toBe('3');
    expect(draft.toRequest().bespokeSelections[0].numericValue).toBe(3);
  });

  it('create mode (the wizard): a ticked numeric leaf reads "3 of 3" with no input (L14)', () => {
    render(show, 'create');

    leaf('Infernal Favour').click();
    fixture.detectChanges();

    expect(element.querySelector('input[type="number"]')).toBeNull();
    expect(element.textContent).toContain('3 of 3');
    expect(draft.toRequest().bespokeSelections[0].numericValue).toBe(3);
  });
});
