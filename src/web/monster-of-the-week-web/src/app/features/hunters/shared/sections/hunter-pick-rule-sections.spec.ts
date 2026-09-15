import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HunterDetailResponse, PlaybookDetailResponse } from '../../../../core/models';
import { PlaybookService } from '../../../../core/playbook';
import { HunterDraft } from '../hunter-draft';
import { HunterFormComponent } from '../hunter-form/hunter-form';
import {
  COMBAT_MAGIC_LABEL,
  INITIATE,
  MONSTROUS,
  NATURAL_ATTACKS_LABEL,
  OLD_FASHIONED_LABEL,
  SPELL_SLINGER,
  initiatePlaybook,
  monstrousPlaybook,
  spellSlingerPlaybook,
} from '../testing/pick-rule-playbooks';
import { HunterBespokeSectionComponent } from './hunter-bespoke-section';
import { HunterGearSectionComponent } from './hunter-gear-section';

/*
 * Phase 6's pick rules in the shared gear and bespoke sections (hunter-creation-wizard.md 13.15
 * item 4): F8b (the Initiate's weapons), F8c (Natural Attacks, Combat Magic), L24, L25, L30, L31
 * and L33, then the same limits through `HunterFormComponent` on the edit page (Q10) and create.
 *
 * Nothing here provides HttpClient or a hunter service: every hint and notice, including
 * "This depends on your Sect picks.", comes from local picks with no check call (L25, Y14).
 */

@Component({
  imports: [HunterGearSectionComponent, HunterBespokeSectionComponent],
  template: `
    @if (draft.playbook(); as book) {
      @if (book.gearCategories.length > 0) {
        <section appHunterGearSection></section>
      }
      @for (s of book.bespokeSections; track s.id) {
        <div appHunterBespokeSection [section]="s"></div>
      }
    }
  `,
})
class HostComponent {
  readonly draft = inject(HunterDraft);
}

const squash = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();

function checkboxIn(scope: HTMLElement, name: string): HTMLInputElement {
  const label = Array.from(scope.querySelectorAll('label')).find(
    (l) => l.querySelector(':scope > span span.font-medium, :scope > span > span.font-medium')?.textContent?.trim() === name
  );
  if (!label) throw new Error(`No option named "${name}"`);
  return label.querySelector('input[type="checkbox"]')!;
}

describe('pick rules in the shared sections (Phase 6)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let draft: HunterDraft;
  let element: HTMLElement;

  function render(playbook: PlaybookDetailResponse): void {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [HunterDraft] });
    draft = TestBed.inject(HunterDraft);
    draft.playbook.set(playbook);
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  const click = (input: HTMLInputElement): void => {
    input.click();
    fixture.detectChanges();
  };
  const gearList = (categoryId: string): HTMLElement => element.querySelector<HTMLElement>(`#hunter-gear-${categoryId}`)!;
  const counter = (list: HTMLElement): HTMLElement[] => Array.from(list.querySelectorAll<HTMLElement>(':scope > div.flex > small'));
  const hint = (list: HTMLElement): string => squash(list.querySelector(':scope > p.text-muted')?.textContent);
  const notices = (scope: HTMLElement): string[] => Array.from(scope.querySelectorAll(':scope > p.text-danger')).map((p) => squash(p.textContent));
  const sectionEl = (sectionId: string): HTMLElement => element.querySelector<HTMLElement>(`#hunter-section-${sectionId}`)!;
  const dividerCounters = (sectionId: string): string[] =>
    Array.from(sectionEl(sectionId).querySelectorAll('div.border-l-2 > div > small')).map((s) => squash(s.textContent));
  const buttonIn = (scope: HTMLElement, text: string): HTMLButtonElement =>
    Array.from(scope.querySelectorAll('button')).find((b) => squash(b.textContent) === text)!;

  // -------------------------------------------------------------------------------------
  // F8b: the Initiate
  // -------------------------------------------------------------------------------------

  describe('the Initiate\'s weapons (F8b)', () => {
    it('with no Sect picks: printed headings, counters against 2 and 1, no stored "Pick 3" / "Pick 2", and the data-built hints (L25, L31)', () => {
      render(initiatePlaybook);
      const old = gearList(INITIATE.oldFashioned);
      const modern = gearList(INITIATE.modern);

      expect(old.querySelector('span.font-semibold')?.textContent?.trim()).toBe(OLD_FASHIONED_LABEL);
      expect(counter(old).map((s) => squash(s.textContent))).toEqual(['0 of 2 picked']);
      expect(counter(modern).map((s) => squash(s.textContent))).toEqual(['0 of 1 picked']);
      expect(squash(element.textContent)).not.toMatch(/Pick [23]\b/);

      expect(hint(old)).toBe('Fighting arts or Obsolete gear (Sect) allow 3. This depends on your Sect picks. Go to Sect');
      expect(hint(modern)).toBe('Modernised or Nifty gadgets (Sect) allow 1–2. This depends on your Sect picks. Go to Sect');
      expect(notices(old)).toEqual([]);
    });

    it('"Go to Sect" scrolls the trigger section into view on a single-page surface', () => {
      render(initiatePlaybook);
      const scroll = vi.fn();
      sectionEl(INITIATE.sect).scrollIntoView = scroll;

      buttonIn(gearList(INITIATE.oldFashioned), 'Go to Sect').click();

      expect(scroll).toHaveBeenCalledTimes(1);
    });

    it('limits come from the effective range: two lock the list, and Fighting arts raises it to "n of 3" and drops its hint', () => {
      render(initiatePlaybook);
      const old = gearList(INITIATE.oldFashioned);
      const modern = gearList(INITIATE.modern);

      click(checkboxIn(old, 'Sword'));
      click(checkboxIn(old, 'Axe'));
      expect(squash(counter(old)[0].textContent)).toBe('2 of 2 picked');
      expect(checkboxIn(old, 'Staff').disabled).toBe(true);
      expect(checkboxIn(old, 'Staff').closest('label')?.classList).toContain('opacity-60');

      click(checkboxIn(sectionEl(INITIATE.sect), 'Fighting arts'));
      expect(squash(counter(old)[0].textContent)).toBe('2 of 3 picked');
      expect(counter(old)[0].classList).toContain('text-muted'); // short of 3
      expect(checkboxIn(old, 'Staff').disabled).toBe(false);
      expect(hint(old)).toBe('');
      // The Sect is partly answered now, so the modern list keeps its hint without the sentence (Y16).
      expect(hint(modern)).toBe('Modernised or Nifty gadgets (Sect) allow 1–2.');

      click(checkboxIn(old, 'Staff'));
      expect(squash(counter(old)[0].textContent)).toBe('3 of 3 picked');
      expect(counter(old)[0].classList).not.toContain('text-muted');
      expect(checkboxIn(old, 'Crossbow').disabled).toBe(true);
    });

    it('a Sect with Modernised: the modern list reads "n of 1–2" and locks at two', () => {
      render(initiatePlaybook);
      const modern = gearList(INITIATE.modern);

      click(checkboxIn(sectionEl(INITIATE.sect), 'Modernised'));
      expect(squash(counter(modern)[0].textContent)).toBe('0 of 1–2 picked');

      click(checkboxIn(modern, 'Pistol'));
      expect(checkboxIn(modern, 'Shotgun').disabled).toBe(false);
      click(checkboxIn(modern, 'Shotgun'));
      expect(squash(counter(modern)[0].textContent)).toBe('2 of 1–2 picked');
      expect(checkboxIn(modern, 'Rifle').disabled).toBe(true);
    });

    it('removing a trigger tradition strands a weapon: the Sect notice and the list\'s L30 notice appear, and nothing is cleared (L24, L30, S5)', () => {
      render(initiatePlaybook);
      const sect = sectionEl(INITIATE.sect);
      const old = gearList(INITIATE.oldFashioned);

      click(checkboxIn(sect, 'Knowledgable'));
      click(checkboxIn(sect, 'Fighting arts'));
      for (const weapon of ['Sword', 'Axe', 'Staff']) click(checkboxIn(old, weapon));
      expect(element.querySelectorAll('p.text-danger')).toHaveLength(0);

      click(checkboxIn(sect, 'Fighting arts'));

      expect(notices(sect)).toEqual([`${OLD_FASHIONED_LABEL}: 3 picked, but your Sect picks now allow 2. Go to Gear`]);
      expect(squash(counter(old)[0].textContent)).toBe('3 of 2 picked');
      expect(counter(old)[0].classList).toContain('text-danger');
      expect(notices(old)).toEqual(['Only 2 allowed with your Sect picks.']);
      for (const weapon of ['Sword', 'Axe', 'Staff']) {
        expect(checkboxIn(old, weapon).checked).toBe(true);
        expect(checkboxIn(old, weapon).disabled).toBe(false);
      }
      expect(checkboxIn(old, 'Crossbow').disabled).toBe(true);
      expect(draft.toRequest().playbookGearOptionIds).toHaveLength(3);

      const scroll = vi.fn();
      old.scrollIntoView = scroll;
      buttonIn(sect, 'Go to Gear').click();
      expect(scroll).toHaveBeenCalledTimes(1);

      // Adding a tradition only widens a range, so it clears the notices rather than raising one.
      click(checkboxIn(sect, 'Obsolete gear'));
      expect(element.querySelectorAll('p.text-danger')).toHaveLength(0);
    });

    it('adding a tradition never raises the Sect notice', () => {
      render(initiatePlaybook);
      const sect = sectionEl(INITIATE.sect);
      const old = gearList(INITIATE.oldFashioned);

      click(checkboxIn(old, 'Sword'));
      click(checkboxIn(old, 'Axe'));
      click(checkboxIn(sect, 'Fighting arts'));
      click(checkboxIn(sect, 'Modernised'));

      expect(notices(sect)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------------------
  // F8c: Natural Attacks and Combat Magic
  // -------------------------------------------------------------------------------------

  describe('Natural Attacks and Combat Magic (F8c)', () => {
    it('shows the rule\'s instruction instead of "n of 2", and "n picked" instead of each divider\'s "pick n–m" (L25, L31)', () => {
      render(monstrousPlaybook);
      const attacks = sectionEl(MONSTROUS.naturalAttacks);

      expect(squash(attacks.querySelector(':scope > div.flex > small')?.textContent)).toBe(NATURAL_ATTACKS_LABEL);
      expect(squash(attacks.textContent)).not.toContain('of 2 picked');
      expect(squash(attacks.textContent)).not.toMatch(/pick \d–\d/);
      expect(dividerCounters(MONSTROUS.naturalAttacks)).toEqual(['0 picked', '0 picked']);

      click(checkboxIn(attacks, 'Teeth'));
      expect(dividerCounters(MONSTROUS.naturalAttacks)).toEqual(['1 picked', '0 picked']);
    });

    it('locks follow the alternatives: a Base and an Extra lock both lists; two Bases lock the Extras', () => {
      render(monstrousPlaybook);
      const attacks = sectionEl(MONSTROUS.naturalAttacks);

      click(checkboxIn(attacks, 'Teeth'));
      expect(checkboxIn(attacks, 'Claws').disabled).toBe(false);
      expect(checkboxIn(attacks, '+1 harm').disabled).toBe(false);

      click(checkboxIn(attacks, '+1 harm'));
      expect(checkboxIn(attacks, 'Claws').disabled).toBe(true);
      expect(checkboxIn(attacks, 'Long reach').disabled).toBe(true);
      expect(checkboxIn(attacks, 'Teeth').disabled).toBe(false);

      click(checkboxIn(attacks, '+1 harm'));
      click(checkboxIn(attacks, 'Claws'));
      expect(checkboxIn(attacks, '+1 harm').disabled).toBe(true);
      expect(checkboxIn(attacks, 'Life-drain').disabled).toBe(true);
      expect(notices(attacks)).toEqual([]);
    });

    it('counts write-your-own Base slots like any other option', () => {
      render(monstrousPlaybook);

      draft.toggleBespoke(MONSTROUS.naturalAttacks, 'nb-own-1');
      draft.toggleBespoke(MONSTROUS.naturalAttacks, 'nb-own-2');
      fixture.detectChanges();

      const attacks = sectionEl(MONSTROUS.naturalAttacks);
      expect(dividerCounters(MONSTROUS.naturalAttacks)).toEqual(['2 picked', '0 picked']);
      expect(checkboxIn(attacks, '+1 harm').disabled).toBe(true);
      expect(checkboxIn(attacks, 'Teeth').disabled).toBe(true);
    });

    it('an over-limit build (two Bases and an Extra) shows the L30 notice, keeps its picks enabled and disables the rest', () => {
      render(monstrousPlaybook);
      draft.bespokePicks.set(new Map([[MONSTROUS.naturalAttacks, new Set(['nb-teeth', 'nb-claws', 'ne-harm'])]]));
      fixture.detectChanges();

      const attacks = sectionEl(MONSTROUS.naturalAttacks);
      expect(notices(attacks)).toEqual([`These picks don't fit: ${NATURAL_ATTACKS_LABEL}`]);
      for (const picked of ['Teeth', 'Claws', '+1 harm']) expect(checkboxIn(attacks, picked).disabled).toBe(false);
      expect(checkboxIn(attacks, 'Spit').disabled).toBe(true);
      expect(checkboxIn(attacks, 'Long reach').disabled).toBe(true);

      click(checkboxIn(attacks, '+1 harm'));
      expect(notices(attacks)).toEqual([]);
    });

    it('Combat Magic: its instruction, and a fourth spell disabled once three fit (Q10)', () => {
      render(spellSlingerPlaybook);
      const magic = sectionEl(SPELL_SLINGER.combatMagic);

      expect(squash(magic.querySelector(':scope > div.flex > small')?.textContent)).toBe(COMBAT_MAGIC_LABEL);
      click(checkboxIn(magic, 'Blast'));
      click(checkboxIn(magic, 'Ball'));
      expect(checkboxIn(magic, 'Missile').disabled).toBe(false);
      click(checkboxIn(magic, 'Fire'));

      expect(dividerCounters(SPELL_SLINGER.combatMagic)).toEqual(['2 picked', '1 picked']);
      expect(checkboxIn(magic, 'Missile').disabled).toBe(true);
      expect(checkboxIn(magic, 'Earth').disabled).toBe(true);
    });

    it('leaves a section no rule governs exactly as before', () => {
      render(initiatePlaybook);
      const sect = sectionEl(INITIATE.sect);

      expect(squash(sect.querySelector(':scope > div.flex > small')?.textContent)).toBe('0 of 2 picked');
      expect(dividerCounters(INITIATE.sect)).toEqual(['pick 2', 'pick 1']);
    });
  });

  // -------------------------------------------------------------------------------------
  // L33: nothing hard-coded
  // -------------------------------------------------------------------------------------

  it('builds every hint and notice from the playbook\'s own titles: renamed section, traditions, lists and label (L33)', () => {
    const renamed = structuredClone(initiatePlaybook);
    renamed.gearCategories[0].label = 'You also get a helmet.';
    renamed.gearCategories[0].options[0].name = 'Helmet';
    renamed.gearCategories[1].label = 'Blades';
    renamed.gearCategories[2].label = 'Firearms';
    const order = renamed.bespokeSections[0];
    order.title = 'Order';
    const titles: Record<string, string> = {
      [INITIATE.fightingArts]: 'Sword schools',
      [INITIATE.obsoleteGear]: 'Relic arms',
      [INITIATE.modernised]: 'Up to date',
      [INITIATE.niftyGadgets]: 'Clever devices',
      [INITIATE.knowledgable]: 'Well read',
      [INITIATE.dubiousMotives]: 'Shady aims',
    };
    for (const group of order.options) for (const leaf of group.children) leaf.title = titles[leaf.id];

    render(renamed);
    const blades = gearList(INITIATE.oldFashioned);
    expect(hint(blades)).toBe('Sword schools or Relic arms (Order) allow 3. This depends on your Order picks. Go to Order');
    expect(hint(gearList(INITIATE.modern))).toBe('Up to date or Clever devices (Order) allow 1–2. This depends on your Order picks. Go to Order');

    click(checkboxIn(sectionEl(INITIATE.sect), 'Sword schools'));
    for (const weapon of ['Sword', 'Axe', 'Staff']) click(checkboxIn(blades, weapon));
    click(checkboxIn(sectionEl(INITIATE.sect), 'Sword schools'));

    expect(notices(blades)).toEqual(['Only 2 allowed with your Order picks.']);
    expect(notices(sectionEl(INITIATE.sect))).toEqual(['Blades: 3 picked, but your Order picks now allow 2. Go to Gear']);

    const visible = squash(element.textContent);
    for (const original of ['Sect', 'Fighting arts', 'Obsolete gear', 'Modernised', 'Nifty gadgets', 'Old-fashioned', 'Modern weapons']) {
      expect(visible).not.toContain(original);
    }

    const renamedAttacks = structuredClone(monstrousPlaybook);
    renamedAttacks.bespokeSections[0].title = 'Fangs';
    renamedAttacks.pickRules[0].label = 'Choose a core and an addon, or two cores.';
    TestBed.resetTestingModule();
    render(renamedAttacks);
    draft.bespokePicks.set(new Map([[MONSTROUS.naturalAttacks, new Set(['nb-teeth', 'nb-claws', 'ne-harm'])]]));
    fixture.detectChanges();
    expect(notices(sectionEl(MONSTROUS.naturalAttacks))).toEqual(["These picks don't fit: Choose a core and an addon, or two cores."]);
    expect(squash(element.textContent)).not.toContain(NATURAL_ATTACKS_LABEL);
  });
});

// ---------------------------------------------------------------------------------------
// Through HunterFormComponent: the edit page (Q10) and the still-live single-page create
// ---------------------------------------------------------------------------------------

describe('pick rules through HunterFormComponent (edit page and single-page create)', () => {
  const byId: Record<string, PlaybookDetailResponse> = {
    [INITIATE.playbookId]: initiatePlaybook,
    [MONSTROUS.playbookId]: monstrousPlaybook,
    [SPELL_SLINGER.playbookId]: spellSlingerPlaybook,
  };

  function hunter(overrides: Partial<HunterDetailResponse>): HunterDetailResponse {
    return {
      id: 'h1', name: 'Saved', pronouns: null, playbookId: MONSTROUS.playbookId, playbookName: 'The Monstrous',
      playbookStatArrayOptionId: null, luck: 0, harm: 0, experience: 0, background: null,
      playbookMoveIds: [], playbookGearOptionIds: [], looks: [], extraTracks: [],
      bespokeSelections: [], bespokeInstances: [], journalEntries: [], outstanding: [], createdAt: '2026-09-15T00:00:00Z',
      ...overrides,
    };
  }

  const selection = (sectionId: string, bespokeOptionId: string) => ({ sectionId, bespokeOptionId, freeformTitle: null, freeformText: null, numericValue: null });

  function mount(saved: HunterDetailResponse | null): { fixture: ComponentFixture<HunterFormComponent>; element: HTMLElement } {
    TestBed.configureTestingModule({
      imports: [HunterFormComponent],
      providers: [{ provide: PlaybookService, useValue: { getById: (id: string) => of(byId[id]) } }],
    });
    const fixture = TestBed.createComponent(HunterFormComponent);
    fixture.componentRef.setInput('playbooks', []);
    fixture.componentRef.setInput('hunter', saved);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('edit page: a saved Monstrous with a Base and an Extra cannot tick a level-up third attack (Q10)', () => {
    const { element } = mount(hunter({
      bespokeSelections: [selection(MONSTROUS.naturalAttacks, 'nb-teeth'), selection(MONSTROUS.naturalAttacks, 'ne-harm')],
    }));
    const attacks = element.querySelector<HTMLElement>(`#hunter-section-${MONSTROUS.naturalAttacks}`)!;

    expect(checkboxIn(attacks, 'Teeth').checked).toBe(true);
    expect(checkboxIn(attacks, 'Teeth').disabled).toBe(false);
    for (const other of ['Claws', 'Life-drain', 'Spit', 'Ignore armour', 'Long reach']) {
      expect(checkboxIn(attacks, other).disabled).toBe(true);
    }
  });

  it('edit page: a saved Spell-Slinger with three spells cannot tick a fourth (Q10)', () => {
    const { element } = mount(hunter({
      playbookId: SPELL_SLINGER.playbookId,
      bespokeSelections: [
        selection(SPELL_SLINGER.combatMagic, 'cb-blast'),
        selection(SPELL_SLINGER.combatMagic, 'ce-fire'),
        selection(SPELL_SLINGER.combatMagic, 'ce-earth'),
      ],
    }));
    const magic = element.querySelector<HTMLElement>(`#hunter-section-${SPELL_SLINGER.combatMagic}`)!;

    expect(checkboxIn(magic, 'Ball').disabled).toBe(true);
    expect(checkboxIn(magic, 'Frost or Ice').disabled).toBe(true);
    expect(checkboxIn(magic, 'Fire').disabled).toBe(false);
  });

  it('edit page: an existing over-limit Initiate opens with both notices, and saving sends every pick back (L30, L24)', () => {
    const saved = hunter({
      playbookId: INITIATE.playbookId,
      playbookGearOptionIds: ['of-sword', 'of-axe', 'of-staff', 'mw-pistol'],
      bespokeSelections: [selection(INITIATE.sect, INITIATE.knowledgable), selection(INITIATE.sect, INITIATE.dubiousMotives)],
    });
    const { fixture, element } = mount(saved);
    const old = element.querySelector<HTMLElement>(`#hunter-gear-${INITIATE.oldFashioned}`)!;
    const sect = element.querySelector<HTMLElement>(`#hunter-section-${INITIATE.sect}`)!;

    expect(squash(old.querySelector(':scope > div.flex > small')?.textContent)).toBe('3 of 2 picked');
    expect(squash(old.querySelector(':scope > p.text-danger')?.textContent)).toBe('Only 2 allowed with your Sect picks.');
    expect(squash(sect.querySelector(':scope > p.text-danger')?.textContent)).toBe(
      `${OLD_FASHIONED_LABEL}: 3 picked, but your Sect picks now allow 2. Go to Gear`
    );
    expect(fixture.componentInstance.draft.toRequest().playbookGearOptionIds).toEqual(['of-sword', 'of-axe', 'of-staff', 'mw-pistol']);
  });

  it('single-page create: choosing the Initiate applies the same limits and hints', () => {
    const { fixture, element } = mount(null);
    fixture.componentInstance.draft.form.controls.playbookId.setValue(INITIATE.playbookId);
    fixture.detectChanges();

    const old = element.querySelector<HTMLElement>(`#hunter-gear-${INITIATE.oldFashioned}`)!;
    expect(squash(old.querySelector(':scope > div.flex > small')?.textContent)).toBe('0 of 2 picked');
    expect(squash(old.querySelector(':scope > p.text-muted')?.textContent)).toContain('Fighting arts or Obsolete gear (Sect) allow 3.');

    checkboxIn(old, 'Sword').click();
    fixture.detectChanges();
    checkboxIn(old, 'Axe').click();
    fixture.detectChanges();
    expect(checkboxIn(old, 'Staff').disabled).toBe(true);
  });
});
