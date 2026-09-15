import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaybookDetailResponse, PlaybookLookCategoryResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { HunterLookSectionComponent } from './hunter-look-section';

@Component({
  imports: [HunterLookSectionComponent],
  template: `<section appHunterLookSection></section>`,
})
class HostComponent {}

function look(id: string, groupLabel: string | null, words: string[]): PlaybookLookCategoryResponse {
  return { id, allowsFreeform: true, groupLabel, sortOrder: 0, options: words.map((text, i) => ({ id: `${id}-${i}`, text, sortOrder: i })) };
}

/** Shaped like The Forged: runs of grouped lines, with a label that comes back after another. */
const playbook: PlaybookDetailResponse = {
  id: 'pb1', name: 'The Test Subject', description: null, luckBoxCount: 7, luckSpecialText: null,
  harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5, moveGrantCount: 0,
  gettingStartedText: null, introductionsText: null, levelingUpText: null, historyPromptsText: null,
  statArrayOptions: [], moves: [], gearCategories: [],
  lookCategories: [
    look('lc-face', 'Human look', ['scarred face', 'plain face']),
    look('lc-body', 'Human look', ['wiry body']),
    look('lc-blade', 'Weapon look', ['notched blade']),
    look('lc-eyes', 'Human look', ['cold eyes']),
  ],
  improvements: [], bespokeSections: [], bespokeJournals: [], extraTracks: [],
};

describe('HunterLookSectionComponent (13.6)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let draft: HunterDraft;
  let element: HTMLElement;

  function render(): void {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [HunterDraft] });
    draft = TestBed.inject(HunterDraft);
    draft.playbook.set(playbook);
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  const chip = (text: string): HTMLButtonElement =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  const counter = (): string | undefined => element.querySelector('h3 + span')?.textContent?.trim();

  it('groups consecutive runs that share a label, keeping the sheet\'s order', () => {
    render();

    const labels = Array.from(element.querySelectorAll('section > div.grid > span.font-semibold')).map((s) => s.textContent?.trim());
    expect(labels).toEqual(['Human look', 'Weapon look', 'Human look']);
  });

  it('selects a chip, clears it on a second click, and a typed answer replaces the chip', () => {
    render();
    expect(counter()).toBe('4 of 4 unanswered');

    chip('scarred face').click();
    fixture.detectChanges();
    expect(draft.lookOptionFor('lc-face')).toBe('lc-face-0');
    expect(chip('scarred face').classList).toContain('bg-accent');
    expect(chip('plain face').classList).toContain('bg-surface');
    expect(counter()).toBe('3 of 4 unanswered');

    chip('scarred face').click();
    fixture.detectChanges();
    expect(draft.lookOptionFor('lc-face')).toBeNull();
    expect(chip('scarred face').classList).not.toContain('bg-accent');

    chip('scarred face').click();
    fixture.detectChanges();
    const own = chip('scarred face').closest('div')!.querySelector<HTMLInputElement>('input[placeholder="or your own..."]')!;
    own.value = 'burned face';
    own.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(draft.lookOptionFor('lc-face')).toBeNull();
    expect(draft.lookFreeformFor('lc-face')).toBe('burned face');
    expect(chip('scarred face').classList).not.toContain('bg-accent');
  });

  it('drops the counter once every line has an answer', () => {
    render();

    for (const text of ['plain face', 'wiry body', 'notched blade', 'cold eyes']) {
      chip(text).click();
      fixture.detectChanges();
    }

    expect(counter()).toBeUndefined();
    expect(element.textContent).not.toContain('unanswered');
  });
});
