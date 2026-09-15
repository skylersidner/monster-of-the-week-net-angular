import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaybookDetailResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { HunterGearSectionComponent } from './hunter-gear-section';

@Component({
  imports: [HunterGearSectionComponent],
  template: `<section appHunterGearSection></section>`,
})
class HostComponent {}

/** Shaped like the Initiate's first category: a granted list under the printed paragraph (Q11). */
const armourLabel =
  'If your Sect has fighting arts or obsolete gear (see next page) then pick three old-fashioned weapons. You also get old-fashioned armour (1-armour heavy).';

const playbook: PlaybookDetailResponse = {
  id: 'pb1', name: 'The Test Subject', description: null, luckBoxCount: 7, luckSpecialText: null,
  harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5, moveGrantCount: 0,
  gettingStartedText: null, introductionsText: null, levelingUpText: null, historyPromptsText: null,
  statArrayOptions: [], moves: [],
  gearCategories: [
    { id: 'gc-armour', label: armourLabel, pickCount: null, isOptional: false, sortOrder: 0, options: [{ id: 'go-armour', name: 'Old-fashioned armour', mechanicalText: '1-armour heavy', sortOrder: 0 }] },
    {
      id: 'gc-weapons', label: 'Weapons', pickCount: 2, isOptional: false, sortOrder: 1,
      options: [
        { id: 'go1', name: 'Shotgun', mechanicalText: '3-harm close loud', sortOrder: 0 },
        { id: 'go2', name: 'Machete', mechanicalText: null, sortOrder: 1 },
        { id: 'go3', name: 'Pistol', mechanicalText: null, sortOrder: 2 },
      ],
    },
    { id: 'gc-extra', label: 'Extras', pickCount: 1, isOptional: true, sortOrder: 2, options: [{ id: 'go4', name: 'First aid kit', mechanicalText: null, sortOrder: 0 }] },
  ],
  lookCategories: [], improvements: [], bespokeSections: [], bespokeJournals: [], extraTracks: [], pickRules: [],
};

describe('HunterGearSectionComponent (13.6, L15)', () => {
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

  const category = (label: string): HTMLElement =>
    Array.from(element.querySelectorAll<HTMLElement>('section > div.grid')).find(
      (block) => block.querySelector('span.font-semibold')?.textContent?.trim() === label
    )!;
  const checkbox = (name: string): HTMLInputElement =>
    Array.from(element.querySelectorAll('label'))
      .find((label) => label.querySelector('span.font-medium')?.textContent?.trim() === name)!
      .querySelector('input[type="checkbox"]')!;

  it('renders granted gear as a read-only "You get" list with no checkbox, under its label as stored (Gap 6, Q11)', () => {
    render();
    const granted = category(armourLabel);

    expect(granted).toBeTruthy();
    expect(granted.querySelector('small')?.textContent?.trim()).toBe('You get');
    expect(granted.querySelector('input')).toBeNull();
    expect(granted.textContent).toContain('Old-fashioned armour');
    expect(granted.textContent).toContain('1-armour heavy');
  });

  it('gives a pickable category its hint and counter, and an optional one its optional hint', () => {
    render();

    const weaponsSmalls = Array.from(category('Weapons').querySelectorAll('small')).map((s) => s.textContent?.trim());
    expect(weaponsSmalls).toEqual(['Pick 2', '0 of 2 picked']);
    const extrasSmalls = Array.from(category('Extras').querySelectorAll('small')).map((s) => s.textContent?.trim());
    expect(extrasSmalls).toEqual(['Optional — pick 1', '0 of 1 picked']);
  });

  it('toggles picks on the draft, locks unpicked options at the ceiling, and never sends granted ids (B6)', () => {
    render();

    checkbox('Shotgun').click();
    fixture.detectChanges();
    checkbox('Pistol').click();
    fixture.detectChanges();

    expect(category('Weapons').querySelectorAll('small')[1].textContent?.trim()).toBe('2 of 2 picked');
    expect(checkbox('Machete').disabled).toBe(true);
    expect(checkbox('Machete').closest('label')?.classList).toContain('opacity-60');
    expect(checkbox('Shotgun').disabled).toBe(false);

    checkbox('Shotgun').click();
    fixture.detectChanges();
    expect(checkbox('Machete').disabled).toBe(false);

    expect(draft.toRequest().playbookGearOptionIds).toEqual(['go3']);
  });
});
