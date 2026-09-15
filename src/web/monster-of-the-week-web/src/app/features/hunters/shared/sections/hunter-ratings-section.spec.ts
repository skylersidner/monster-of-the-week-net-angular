import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaybookDetailResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { HunterRatingsSectionComponent } from './hunter-ratings-section';

@Component({
  imports: [HunterRatingsSectionComponent],
  template: `<section appHunterRatingsSection></section>`,
})
class HostComponent {}

const playbook: PlaybookDetailResponse = {
  id: 'pb1', name: 'The Test Subject', description: null, luckBoxCount: 7, luckSpecialText: null,
  harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5, moveGrantCount: 0,
  gettingStartedText: null, introductionsText: null, levelingUpText: null, historyPromptsText: null,
  statArrayOptions: [
    { id: 'sa-1', charm: 1, cool: 0, sharp: 2, tough: -1, weird: 1, sortOrder: 0 },
    { id: 'sa-2', charm: -1, cool: 2, sharp: 1, tough: 0, weird: 1, sortOrder: 1 },
  ],
  moves: [], gearCategories: [], lookCategories: [], improvements: [], bespokeSections: [], bespokeJournals: [], extraTracks: [],
};

describe('HunterRatingsSectionComponent (13.6, L16)', () => {
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

  const radios = (): HTMLInputElement[] => Array.from(element.querySelectorAll<HTMLInputElement>('input[type="radio"]'));

  it('renders on the page\'s own section element, with no wrapper', () => {
    render(playbook);

    const section = element.querySelector('section')!;
    expect(section.classList).toContain('grid');
    expect(section.firstElementChild?.tagName).toBe('H3');
    expect(section.querySelector('h3')?.textContent?.trim()).toBe('Ratings');
  });

  it('lays each line out as a 5-column grid, stat name above its signed value', () => {
    render(playbook);

    const cards = Array.from(element.querySelectorAll('label'));
    expect(cards).toHaveLength(2);

    const grid = cards[0].querySelector('span.grid-cols-5')!;
    expect(grid).toBeTruthy();
    const cells = Array.from(grid.children).map((cell) =>
      Array.from(cell.children).map((part) => part.textContent?.trim())
    );
    expect(cells).toEqual([
      ['Charm', '+1'],
      ['Cool', '+0'],
      ['Sharp', '+2'],
      ['Tough', '-1'],
      ['Weird', '+1'],
    ]);
    expect(grid.children[0].children[0].classList).toContain('text-muted');
  });

  it('binds the radios to the draft\'s rating both ways, one checked at a time', () => {
    render(playbook);
    expect(element.textContent).toContain('Not chosen yet — you can pick this later.');

    radios()[1].click();
    fixture.detectChanges();
    expect(draft.form.controls.playbookStatArrayOptionId.value).toBe('sa-2');
    expect(radios().map((r) => r.checked)).toEqual([false, true]);
    expect(element.textContent).not.toContain('Not chosen yet');

    draft.form.controls.playbookStatArrayOptionId.setValue('sa-1');
    fixture.detectChanges();
    expect(radios().map((r) => r.checked)).toEqual([true, false]);
  });

  it('says so when a playbook has no rating lines', () => {
    render({ ...playbook, statArrayOptions: [] });

    expect(element.textContent).toContain('This playbook has no rating arrays yet.');
    expect(radios()).toHaveLength(0);
    expect(element.textContent).not.toContain('Not chosen yet');
  });
});
