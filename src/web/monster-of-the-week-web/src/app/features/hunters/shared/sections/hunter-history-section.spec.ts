import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaybookDetailResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { HunterHistorySectionComponent } from './hunter-history-section';

@Component({
  imports: [HunterHistorySectionComponent],
  template: `<section appHunterHistorySection [mode]="mode()"></section>`,
})
class HostComponent {
  readonly mode = signal<'create' | 'edit'>('edit');
}

const playbook: PlaybookDetailResponse = {
  id: 'pb1', name: 'The Test Subject', description: null, luckBoxCount: 7, luckSpecialText: null,
  harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5, moveGrantCount: 0,
  gettingStartedText: null, introductionsText: null, levelingUpText: null,
  historyPromptsText: 'Go around the group.\n- <b>One</b> of them saved you.\n- One owes you.',
  statArrayOptions: [], moves: [], gearCategories: [], lookCategories: [], improvements: [], bespokeSections: [], bespokeJournals: [], extraTracks: [], pickRules: [],
};

describe('HunterHistorySectionComponent (13.6, L16)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let draft: HunterDraft;
  let element: HTMLElement;

  function render(book: PlaybookDetailResponse, mode: 'create' | 'edit' = 'edit'): void {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [HunterDraft] });
    draft = TestBed.inject(HunterDraft);
    draft.playbook.set(book);
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.mode.set(mode);
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

  it('create mode (the wizard\'s last step): the prompts in a reference panel headed "History", then an optional notes box on background (Q4)', () => {
    render(playbook, 'create');

    const panel = element.querySelector<HTMLElement>('[data-panel="history"]')!;
    expect(panel.firstElementChild?.textContent?.trim()).toBe('History');
    const prompts = panel.querySelector('.whitespace-pre-line')!;
    expect(prompts.querySelector('b')).toBeNull();
    expect(prompts.textContent).toBe(playbook.historyPromptsText);
    expect(element.querySelector('details')).toBeNull();
    expect(element.querySelector('h3')).toBeNull();

    // The notes box comes directly after the prompts.
    const label = panel.nextElementSibling as HTMLElement;
    expect(label.tagName).toBe('LABEL');
    expect(label.textContent?.trim()).toBe('History notes (optional)');
    const textarea = label.querySelector('textarea')!;
    textarea.value = 'Owes Dana a favour.';
    textarea.dispatchEvent(new Event('input'));
    expect(draft.toRequest().background).toBe('Owes Dana a favour.');
  });

  it('create mode keeps the notes box when the playbook has no prompts', () => {
    render({ ...playbook, historyPromptsText: null }, 'create');

    expect(element.querySelector('[data-panel="history"]')).toBeNull();
    expect(element.querySelector('label')?.textContent?.trim()).toBe('History notes (optional)');
    expect(element.querySelector('textarea')).toBeTruthy();
  });
});
