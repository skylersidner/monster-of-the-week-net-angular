import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BespokeSectionResponse, PlaybookDetailResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { HunterMovesSectionComponent } from './hunter-moves-section';

@Component({
  imports: [HunterMovesSectionComponent],
  template: `<section appHunterMovesSection></section>`,
})
class HostComponent {}

function section(id: string, title: string): BespokeSectionResponse {
  return {
    id, title, description: null, effectText: null, freeTextLabel: null, minSelect: null, maxSelect: null, minInstances: null, maxInstances: null, sortOrder: 0,
    options: [{ id: `${id}-opt`, title: `${title} option`, descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [] }],
  };
}

const playbook: PlaybookDetailResponse = {
  id: 'pb1', name: 'The Test Subject', description: null, luckBoxCount: 7, luckSpecialText: null,
  harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5,
  // The printed total, the required move included: a pick budget of 2 (B1).
  moveGrantCount: 3,
  gettingStartedText: null, introductionsText: null, levelingUpText: null, historyPromptsText: null,
  statArrayOptions: [],
  moves: [
    { id: 'mv-req', name: 'Granted Move', descriptionText: '<em>Always yours.</em>', required: true, isAdvanced: false, sortOrder: 0, bespokeSections: [section('bs-encounter', 'First Encounter')] },
    { id: 'mv1', name: 'Networked', descriptionText: null, required: false, isAdvanced: false, sortOrder: 1, bespokeSections: [section('bs-network', 'Network')] },
    { id: 'mv2', name: 'Second Move', descriptionText: null, required: false, isAdvanced: false, sortOrder: 2, bespokeSections: [] },
    { id: 'mv3', name: 'Third Move', descriptionText: null, required: false, isAdvanced: false, sortOrder: 3, bespokeSections: [] },
    { id: 'mv-adv', name: 'Advanced Move', descriptionText: null, required: false, isAdvanced: true, sortOrder: 4, bespokeSections: [] },
  ],
  gearCategories: [], lookCategories: [], improvements: [], bespokeSections: [], bespokeJournals: [], extraTracks: [],
};

describe('HunterMovesSectionComponent (13.6)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let draft: HunterDraft;
  let element: HTMLElement;

  function render(book: PlaybookDetailResponse): void {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [HunterDraft] });
    draft = TestBed.inject(HunterDraft);
    draft.playbook.set(book);
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  const card = (name: string): HTMLLabelElement =>
    Array.from(element.querySelectorAll('label')).find(
      (label) => label.querySelector(':scope > span > span.font-semibold')?.textContent?.trim() === name
    )!;
  const checkbox = (name: string): HTMLInputElement => card(name).querySelector('input[type="checkbox"]')!;
  const counter = (): HTMLElement | null => element.querySelector('h3 + span');
  const sectionTitles = (): string[] =>
    Array.from(element.querySelectorAll('[apphunterbespokesection] > div > span.font-semibold')).map((s) => s.textContent!.trim());

  it('shows required moves checked, disabled and "Always granted", and never offers advanced moves', () => {
    render(playbook);

    expect(checkbox('Granted Move').checked).toBe(true);
    expect(checkbox('Granted Move').disabled).toBe(true);
    expect(card('Granted Move').textContent).toContain('Always granted');
    expect(card('Granted Move').querySelector('em')?.textContent).toBe('Always yours.');
    expect(element.textContent).not.toContain('Advanced Move');
  });

  it('counts picks against the budget, not the printed total, and locks unpicked moves at the budget (B1)', () => {
    render(playbook);
    expect(counter()?.textContent?.trim()).toBe('0 of 2 picked');
    expect(counter()?.classList).toContain('text-muted');

    checkbox('Networked').click();
    fixture.detectChanges();
    checkbox('Second Move').click();
    fixture.detectChanges();

    expect([...draft.selectedMoveIds()]).toEqual(['mv1', 'mv2']);
    expect(counter()?.textContent?.trim()).toBe('2 of 2 picked');
    expect(counter()?.classList).not.toContain('text-muted');
    expect(checkbox('Third Move').disabled).toBe(true);
    expect(card('Third Move').classList).toContain('opacity-60');
    // A picked move stays enabled, so it can be unticked.
    expect(checkbox('Second Move').disabled).toBe(false);
  });

  it('shows no counter when the grant count is unspecified (0)', () => {
    render({ ...playbook, moveGrantCount: 0 });

    expect(element.textContent).not.toContain('picked');
  });

  it('renders a move\'s own sections under a required move at once, and under a picked move only while it is ticked', () => {
    render(playbook);
    expect(sectionTitles()).toEqual(['First Encounter']);

    checkbox('Networked').click();
    fixture.detectChanges();
    expect(sectionTitles()).toEqual(['First Encounter', 'Network']);

    checkbox('Networked').click();
    fixture.detectChanges();
    expect(sectionTitles()).toEqual(['First Encounter']);
  });

  it('says so when a playbook has no moves to pick', () => {
    render({ ...playbook, moves: [playbook.moves[0]] });

    expect(element.textContent).toContain('This playbook has no moves to pick from yet.');
  });
});
