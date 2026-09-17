import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HunterDraft } from '../hunter-draft';
import { buildPlaybook, option, section } from '../testing/pick-rule-playbooks';
import { HunterBespokeSectionComponent } from './hunter-bespoke-section';
import { HunterHistorySectionComponent } from './hunter-history-section';
import { HunterLookSectionComponent } from './hunter-look-section';

/*
 * Every text input and textarea the shared sections render can shrink inside the wizard's narrow
 * 42% column (Toad's F9 sweeps at 768: B2 on step 1, N1 in the bespoke tree). jsdom does no layout,
 * so this pins the classes that do it:
 * - a stretched grid input or textarea: `w-full min-w-0`, so its intrinsic width stops counting toward
 *   its ancestors' minimum width. It already fills its cell, so desktop widths don't change;
 * - a flex item that keeps its own width (the look write-in, the entry name): `min-w-0`, plus
 *   `max-w-full` where it has no `flex-1`;
 * - the leaf option's text column in the tree: `min-w-0`.
 */

const rotes = section('bs-rotes', 'Rotes', {
  freeTextLabel: 'Rote name',
  minInstances: 0,
  options: [option('rote-effect', '{{blank}} effect', { descriptionText: 'On a 10+ {{blank}}' })],
});
const code = section('bs-code', 'Code', { freeTextLabel: 'Your code' });
const playbook = buildPlaybook({
  bespokeSections: [rotes, code],
  historyPromptsText: 'Go around the group.',
  lookCategories: [{ id: 'lc-face', allowsFreeform: true, groupLabel: null, sortOrder: 0, options: [{ id: 'lo-1', text: 'haggard face', sortOrder: 0 }] }],
});

@Component({
  imports: [HunterBespokeSectionComponent, HunterLookSectionComponent, HunterHistorySectionComponent],
  template: `
    <div appHunterBespokeSection [section]="rotes" mode="create"></div>
    <div appHunterBespokeSection [section]="code" mode="create"></div>
    <section appHunterLookSection></section>
    <section appHunterHistorySection [mode]="historyMode()"></section>
  `,
})
class HostComponent {
  readonly rotes = rotes;
  readonly code = code;
  readonly historyMode = signal<'create' | 'edit'>('create');
}

describe('shared section inputs in a narrow column (F9: B2, N1)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let draft: HunterDraft;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [HunterDraft] });
    draft = TestBed.inject(HunterDraft);
    draft.playbook.set(playbook);
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  const classes = (target: Element | null): string[] => Array.from(target?.classList ?? []);

  it('lets the tree\'s write-in inputs and their text column shrink (the Hex\'s Rotes, the Professional\'s Agency name)', () => {
    draft.addInstance(rotes);
    const [entry] = draft.instancesFor(rotes);
    draft.toggleBespoke(entry.key, 'rote-effect');
    fixture.detectChanges();

    const writeIns = Array.from(element.querySelectorAll<HTMLInputElement>('app-bespoke-option-tree input[type="text"]'));
    expect(writeIns.map((input) => input.placeholder)).toEqual(['Name it...', 'Fill in the blank...']);
    for (const input of writeIns) {
      expect(classes(input)).toEqual(expect.arrayContaining(['w-full', 'min-w-0']));
      expect(classes(input.parentElement)).toContain('min-w-0');
    }
  });

  it('lets a repeatable entry\'s name and details inputs shrink', () => {
    draft.addInstance(rotes);
    fixture.detectChanges();

    const name = element.querySelector<HTMLInputElement>('input[placeholder="Rote name"]')!;
    const details = element.querySelector<HTMLInputElement>('input[placeholder="Details..."]')!;
    expect(classes(name)).toEqual(expect.arrayContaining(['flex-1', 'min-w-0']));
    expect(classes(details)).toEqual(expect.arrayContaining(['w-full', 'min-w-0']));
  });

  it('lets a free-text section\'s textarea, the look write-in and the History notes shrink, in both History modes', () => {
    const codeArea = element.querySelector('[apphunterbespokesection]:nth-of-type(2) textarea');
    expect(classes(codeArea)).toEqual(expect.arrayContaining(['w-full', 'min-w-0']));

    const lookWriteIn = element.querySelector('[apphunterlooksection] input[placeholder="or your own..."]');
    expect(classes(lookWriteIn)).toEqual(expect.arrayContaining(['max-w-full', 'min-w-0']));

    expect(classes(element.querySelector('[apphunterhistorysection] textarea'))).toEqual(expect.arrayContaining(['w-full', 'min-w-0']));
    fixture.componentInstance.historyMode.set('edit');
    fixture.detectChanges();
    expect(classes(element.querySelector('[apphunterhistorysection] textarea'))).toEqual(expect.arrayContaining(['w-full', 'min-w-0']));
  });
});
