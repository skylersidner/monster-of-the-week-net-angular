import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaybookDetailResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { HunterHistorySectionComponent } from './hunter-history-section';

@Component({
  imports: [HunterHistorySectionComponent],
  template: `<section appHunterHistorySection></section>`,
})
class HostComponent {}

const playbook: PlaybookDetailResponse = {
  id: 'pb1', name: 'The Test Subject', description: null, luckBoxCount: 7, luckSpecialText: null,
  harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5, moveGrantCount: 0,
  gettingStartedText: null, introductionsText: null, levelingUpText: null,
  historyPromptsText: 'Go around the group.\n- <b>One</b> of them saved you.\n- One owes you.',
  statArrayOptions: [], moves: [], gearCategories: [], lookCategories: [], improvements: [], bespokeSections: [], bespokeJournals: [], extraTracks: [],
};

describe('HunterHistorySectionComponent (13.6, L16)', () => {
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

  it('is headed "History" with a "History notes" label (L16)', () => {
    render(playbook);

    expect(element.querySelector('h3')?.textContent?.trim()).toBe('History');
    expect(element.querySelector('label')?.textContent?.trim()).toBe('History notes');
    expect(element.textContent).not.toContain('Background');
  });

  it('binds the notes to the draft\'s background both ways', () => {
    render(playbook);
    const textarea = element.querySelector('textarea')!;

    textarea.value = 'Grew up on a naval base.';
    textarea.dispatchEvent(new Event('input'));
    expect(draft.form.controls.background.value).toBe('Grew up on a naval base.');

    draft.form.controls.background.setValue('Rewritten');
    fixture.detectChanges();
    expect(textarea.value).toBe('Rewritten');
  });

  it('renders the prompts as text with their line breaks kept, never as HTML (Gap 5)', () => {
    render(playbook);

    const prompts = element.querySelector('details div')!;
    expect(prompts.classList).toContain('whitespace-pre-line');
    expect(prompts.querySelector('b')).toBeNull();
    expect(prompts.textContent).toBe(playbook.historyPromptsText);
    expect(element.querySelector('summary')?.textContent?.trim()).toBe('History prompts for The Test Subject');
  });

  it('leaves the prompts out when the playbook has none', () => {
    render({ ...playbook, historyPromptsText: null });

    expect(element.querySelector('details')).toBeNull();
    expect(element.querySelector('textarea')).toBeTruthy();
  });
});
