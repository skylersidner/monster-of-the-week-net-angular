import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ApiService } from '../core/api';
import { BystanderService } from '../core/bystander';
import { HunterService } from '../core/hunter';
import { MinionService } from '../core/minion';
import { MonsterService } from '../core/monster';
import { MysteryService } from '../core/mystery';
import { NotificationService } from '../core/notifications';
import { PlaybookService } from '../core/playbook';
import { ReferenceDataService } from '../core/reference-data';
import { ThemeService } from '../core/theme';

import { BystanderFormComponent } from '../features/bystanders/shared/bystander-form/bystander-form';
import { HunterCreateComponent } from '../features/hunters/pages/hunter-create/hunter-create';
import { HunterFormComponent } from '../features/hunters/shared/hunter-form/hunter-form';
import { LocationFormComponent } from '../features/locations/shared/location-form/location-form';
import { MinionCreateComponent } from '../features/minions/pages/minion-create/minion-create';
import { MinionFormComponent } from '../features/minions/shared/minion-form/minion-form';
import { MonsterCreateComponent } from '../features/monsters/pages/monster-create/monster-create';
import { MonsterFormComponent } from '../features/monsters/shared/monster-form/monster-form';
import { MysteryCreateComponent } from '../features/mysteries/pages/mystery-create/mystery-create';
import { MonsterDraft, MysteryCreateStore } from '../features/mysteries/pages/mystery-create/mystery-create.store';
import { DataAdminPageComponent } from '../pages/data-admin/data-admin';
import { SettingsPageComponent } from '../pages/settings/settings';
import { MysterySelectComponent } from './mystery-select.component';
import { WeaponTagSelectComponent } from './weapon-tag-select.component';

/**
 * `mystery-entity-linking.md` §9 asks for `Escape`-closes-and-restores-focus **"verified on every
 * surface that uses it, not just the new ones."** `custom-select.component.spec.ts` proves the
 * behaviour on the component in isolation and `escape-nesting.spec.ts` proves the dialog pair; this
 * file is the per-surface sweep, and it exists because the isolated proof does not cover the two
 * ways a *surface* can break it:
 *
 * 1. **Something above the select acts on the same press.** The handler is on the select's host, so
 *    it fires first and calls `stopPropagation()` — but only if nothing higher up listens in the
 *    capture phase and nothing on the way up is reached before it. The sweep measures this directly
 *    by counting how many `keydown` events reach `document` (must be zero on the press that closes
 *    a panel) and by asserting the surface itself did not change.
 * 2. **The `#trigger` `ViewChild` is unresolved on that surface**, in which case the panel closes
 *    and focus silently lands nowhere. A surface that renders the control inside `@if`, inside a
 *    `formGroup`, or inside a wrapper CVA is where that would show up.
 *
 * **Every template in the app that renders `<app-custom-select>` is covered**, mounted through the
 * smallest component that owns that template. The inventory, taken from
 * `grep -rn '<app-custom-select' --include=*.html`, is 17 instances across 15 templates.
 *
 * **What this file is not.** It is not a register of every surface that handles `Escape`. Its unit
 * is a template that renders `<app-custom-select>`, and what it measures is that the press reaches
 * the *select* there. `ImageUploadModalComponent` was considered for this sweep during Phase 7's
 * close-out and deliberately left out: it renders no select, so there is nothing here to measure on
 * it. Its own Escape behaviour is covered in `image-upload-modal.component.spec.ts`, and its
 * interaction with a second overlay — where the real cross-surface risk lives, and where a genuine
 * defect was found — is covered in `escape-nesting.spec.ts`. Recorded so the absence reads as a
 * decision rather than an oversight.
 *
 * The inventory:
 *
 * | Template | Instances | Mounted here as |
 * |---|---|---|
 * | `pages/settings/settings.html` | 1 | `SettingsPageComponent` |
 * | `pages/data-admin/data-admin.html` | 1 | `DataAdminPageComponent` |
 * | `location-form.html` | 1 | `LocationFormComponent` |
 * | `bystander-form.html` | 1 | `BystanderFormComponent` |
 * | `monster-form.html` | 2 | `MonsterFormComponent` |
 * | `minion-form.html` | 1 | `MinionFormComponent` |
 * | `monster-create.html` | 1 | `MonsterCreateComponent` |
 * | `minion-create.html` | 1 | `MinionCreateComponent` |
 * | `hunter-form.html` | 1 | `HunterFormComponent` |
 * | `steps/hunter-playbook-step.html` | 1 | `HunterCreateComponent` |
 * | `mystery-create-monster-phase.html` | 3 | `MysteryCreateComponent`, phase 1 steps 0 and 1 |
 * | `mystery-create-locations-phase.html` | 1 | `MysteryCreateComponent`, phase 2 |
 * | `mystery-create-bystanders-phase.html` | 1 | `MysteryCreateComponent`, phase 3 |
 * | `shared/mystery-select.component.html` | 1 | `MysterySelectComponent` (and via both forms) |
 * | `shared/weapon-tag-select.component.html` | 1 | `WeaponTagSelectComponent` (and via 6 hosts) |
 *
 * The two wrapper CVAs are swept both standalone and through a host, because "does the wrapper
 * forward the trigger" and "does the host disturb the press" are different questions.
 */

// ---------------------------------------------------------------------------------------------
// The assertion every surface gets
// ---------------------------------------------------------------------------------------------

interface SweepResult {
  readonly swept: number;
}

/**
 * Opens every `<app-custom-select>` currently in `root`, one at a time, presses `Escape` from the
 * deepest control inside the open panel, and asserts the four properties §8.7 asks for plus the two
 * surface-level ones above.
 */
function sweepEscape(fixture: ComponentFixture<unknown>, root: HTMLElement, label: string): SweepResult {
  const selects = Array.from(root.querySelectorAll<HTMLElement>('app-custom-select'));
  expect(selects.length, `${label}: expected at least one app-custom-select to sweep`).toBeGreaterThan(0);

  let reachedDocument = 0;
  const counter = (): void => {
    reachedDocument += 1;
  };
  document.addEventListener('keydown', counter);

  try {
    selects.forEach((select, index) => {
      const where = `${label} · select ${index + 1}/${selects.length}`;
      const trigger = select.querySelector<HTMLButtonElement>('.custom-select__trigger')!;
      expect(trigger, `${where}: no trigger button`).toBeTruthy();
      expect(trigger.disabled, `${where}: trigger is disabled, cannot sweep`).toBe(false);

      // --- open it the way a keyboard user does: focus the trigger, activate it -----------
      trigger.focus();
      expect(document.activeElement, `${where}: trigger did not take focus`).toBe(trigger);
      trigger.click();
      fixture.detectChanges();

      const panel = select.querySelector<HTMLElement>('.custom-select__panel');
      expect(panel, `${where}: panel did not open`).toBeTruthy();

      // Press from a control *inside* the open panel, never from the trigger. That is both the
      // real keyboard path — the search box and the options are focusable, so `Tab` reaches them —
      // and the only way the focus restore is observable: pressing from the trigger leaves
      // `activeElement` on the trigger whether the handler restores focus or not, which makes the
      // assertion vacuous on the eleven non-searchable instances.
      const search = panel!.querySelector<HTMLInputElement>('.custom-select__search input');
      const option = panel!.querySelector<HTMLButtonElement>('.custom-select__option');
      const from: HTMLElement | null = search ?? option;
      expect(from, `${where}: panel has neither a search box nor an option to press from`).toBeTruthy();
      from!.focus();
      expect(document.activeElement, `${where}: could not move focus into the panel`).toBe(from);
      if (search) {
        search.value = 'zz-no-match';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
      }

      const before = reachedDocument;
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      from!.dispatchEvent(event);
      fixture.detectChanges();

      // 1. the panel is gone
      expect(select.querySelector('.custom-select__panel'), `${where}: panel stayed open`).toBeNull();
      // 2. focus is on this select's own trigger, not lost to <body> and not on another select's
      expect(document.activeElement, `${where}: focus was not restored to the trigger`).toBe(trigger);
      // 3. the press was consumed, so nothing above it can act on the same press
      expect(event.defaultPrevented, `${where}: press was not consumed`).toBe(true);
      expect(reachedDocument - before, `${where}: press escaped to document`).toBe(0);
      // 4. the search term is cleared, matching what closing by click already does
      trigger.click();
      fixture.detectChanges();
      const reopened = select.querySelector<HTMLElement>('.custom-select__panel')!;
      const reopenedSearch = reopened.querySelector<HTMLInputElement>('.custom-select__search input');
      if (reopenedSearch) {
        expect(reopenedSearch.value, `${where}: search term survived the Escape`).toBe('');
      }
      // Leave it closed, so the next select in the sweep starts from a clean surface.
      trigger.click();
      fixture.detectChanges();
    });
  } finally {
    document.removeEventListener('keydown', counter);
  }

  return { swept: selects.length };
}

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const typeRef = (id: string, name: string) => ({ id, name, motivation: 'to lurk' });
const nameDescription = (id: string, name: string) => ({ id, name, description: 'A tag.' });

const mysteryListItem = (id: string, name: string) => ({
  id,
  name,
  concept: null,
  hook: null,
  adventureType: { id: 'adv-1', name: 'Haunting', description: '' },
  monsterCount: 0,
  locationCount: 0,
  bystanderCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
});

const mysteries = [mysteryListItem('m1', 'The Quiet'), mysteryListItem('m2', 'Dead Air')];
const weaponTags = [nameDescription('tag-1', 'Messy'), nameDescription('tag-2', 'Forceful')];

class MockReferenceDataService {
  getAdventureTypes = () => of([typeRef('adventure-type-1', 'Haunting')]);
  getMonsterArchetypes = () => of([nameDescription('monster-archetype-1', 'Ghost')]);
  getMonsterTypes = () => of([typeRef('monster-type-1', 'Beast')]);
  getMinionTypes = () => of([typeRef('minion-type-1', 'Cultist')]);
  getLocationTypes = () => of([typeRef('location-type-1', 'Lair')]);
  getBystanderTypes = () => of([typeRef('bystander-type-1', 'Witness')]);
  getWeaponTags = () => of(weaponTags);
  getTypesByTable = () => of([typeRef('t-1', 'A type')]);
  getNameDescriptionsByTable = () => of([nameDescription('nd-1', 'A tag')]);
  createType = () => of(typeRef('t-2', 'Created'));
  createNameDescription = () => of(nameDescription('nd-2', 'Created'));
}

const notifications = {
  success: () => {},
  error: () => {},
  notifications: () => [],
  dismiss: () => {},
};

// ---------------------------------------------------------------------------------------------

const MONSTER_KEY = 'monster-fixture';

/**
 * A complete roster monster. 5b makes a minion impossible without one — `Minion.MonsterId` is a
 * required FK and the minion step renders its empty state with an empty roster — so any fixture
 * that puts minions on the roster has to put their parent there too.
 */
function rosterMonster(overrides: Partial<MonsterDraft> = {}): MonsterDraft {
  return {
    id: null,
    localKey: MONSTER_KEY,
    name: 'The Hollow Man',
    description: '',
    harmCapacity: 8,
    monsterTypeId: 'monster-type-1',
    monsterArchetypeId: 'monster-archetype-1',
    attacks: [],
    powers: [],
    weaknesses: [],
    armors: [],
    customMoves: [],
    existingAttacks: [],
    existingPowers: [],
    existingWeaknesses: [],
    existingArmors: [],
    existingCustomMoves: [],
    existingMinionIds: [],
    mysteryIds: [],
    ...overrides,
  };
}

describe('Escape closes the panel and restores focus — on every surface that renders one', () => {
  // -------------------------------------------------------------------------------------------
  // The two shared wrapper CVAs, standalone. Both put a select inside their own template, so
  // "the wrapper forwards the trigger" is its own question.
  // -------------------------------------------------------------------------------------------

  it('shared/mystery-select.component.html — the Phase 2 multi-select', async () => {
    await TestBed.configureTestingModule({ imports: [MysterySelectComponent] }).compileComponents();
    const fixture = TestBed.createComponent(MysterySelectComponent);
    fixture.componentRef.setInput('options', mysteries);
    fixture.detectChanges();

    expect(sweepEscape(fixture, fixture.nativeElement, 'mystery-select').swept).toBe(1);
  });

  it('shared/weapon-tag-select.component.html — the idiom mystery-select was copied from', async () => {
    await TestBed.configureTestingModule({ imports: [WeaponTagSelectComponent] }).compileComponents();
    const fixture = TestBed.createComponent(WeaponTagSelectComponent);
    fixture.componentRef.setInput('options', weaponTags);
    fixture.detectChanges();

    expect(sweepEscape(fixture, fixture.nativeElement, 'weapon-tag-select').swept).toBe(1);
  });

  // -------------------------------------------------------------------------------------------
  // Entity forms. Location and Bystander each render two: their own type select and the
  // mystery-select Phase 2 put inside the FormGroup.
  // -------------------------------------------------------------------------------------------

  it('location-form.html — type select and the nested mystery-select', async () => {
    await TestBed.configureTestingModule({ imports: [LocationFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LocationFormComponent);
    fixture.componentRef.setInput('locationTypes', [typeRef('location-type-1', 'Lair')]);
    fixture.componentRef.setInput('mysteries', mysteries);
    fixture.componentRef.setInput('location', null);
    fixture.detectChanges();

    expect(sweepEscape(fixture, fixture.nativeElement, 'location-form').swept).toBe(2);
  });

  it('bystander-form.html — type select and the nested mystery-select', async () => {
    await TestBed.configureTestingModule({ imports: [BystanderFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(BystanderFormComponent);
    fixture.componentRef.setInput('bystanderTypes', [typeRef('bystander-type-1', 'Witness')]);
    fixture.componentRef.setInput('mysteries', mysteries);
    fixture.componentRef.setInput('bystander', null);
    fixture.detectChanges();

    expect(sweepEscape(fixture, fixture.nativeElement, 'bystander-form').swept).toBe(2);
  });

  it('monster-form.html — the type and archetype selects', async () => {
    await TestBed.configureTestingModule({ imports: [MonsterFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(MonsterFormComponent);
    fixture.componentRef.setInput('monsterTypes', [typeRef('monster-type-1', 'Beast')]);
    fixture.componentRef.setInput('monsterArchetypes', [nameDescription('monster-archetype-1', 'Ghost')]);
    fixture.componentRef.setInput('monster', null);
    fixture.detectChanges();

    // Three since 5b: type, archetype, and the mystery membership multi-select (§6.2).
    expect(sweepEscape(fixture, fixture.nativeElement, 'monster-form').swept).toBe(3);
  });

  it('minion-form.html — the minion type select', async () => {
    await TestBed.configureTestingModule({ imports: [MinionFormComponent] }).compileComponents();
    const fixture = TestBed.createComponent(MinionFormComponent);
    fixture.componentRef.setInput('minionTypes', [typeRef('minion-type-1', 'Cultist')]);
    fixture.componentRef.setInput('minion', null);
    fixture.detectChanges();

    expect(sweepEscape(fixture, fixture.nativeElement, 'minion-form').swept).toBe(1);
  });

  it('hunter-form.html — the playbook select, which is `searchable`', async () => {
    await TestBed.configureTestingModule({
      imports: [HunterFormComponent],
      providers: [{ provide: PlaybookService, useValue: { getAll: () => of([]), getById: () => of(null) } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(HunterFormComponent);
    fixture.componentRef.setInput('playbooks', [
      { id: 'pb1', name: 'The Chosen', statArrayOptionCount: 1, moveCount: 3, bespokeSectionCount: 0 },
    ]);
    fixture.detectChanges();

    expect(sweepEscape(fixture, fixture.nativeElement, 'hunter-form').swept).toBe(1);
  });

  // -------------------------------------------------------------------------------------------
  // Create pages that still own a picker of their own, above the form component.
  // -------------------------------------------------------------------------------------------

  it('monster-create.html — the page-level "Attach to Mystery" picker', async () => {
    await TestBed.configureTestingModule({
      imports: [MonsterCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ReferenceDataService, useClass: MockReferenceDataService },
        { provide: MysteryService, useValue: { getMysteries: () => of(mysteries) } },
        { provide: MonsterService, useValue: { getAll: () => of([]), create: () => of(null), createStandalone: () => of(null) } },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MonsterCreateComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    // The page's own picker, the two inside <app-monster-form>, and the one inside the
    // <app-weapon-tag-select> on the attack add-form.
    expect(sweepEscape(fixture, fixture.nativeElement, 'monster-create').swept).toBe(4);
  });

  it('minion-create.html — the page-level monster picker', async () => {
    await TestBed.configureTestingModule({
      imports: [MinionCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ReferenceDataService, useClass: MockReferenceDataService },
        {
          provide: MonsterService,
          useValue: { getAll: () => of([{ id: 'mo1', name: 'The Beast', mysteryIds: [] }]) },
        },
        { provide: MinionService, useValue: { create: () => of(null) } },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MinionCreateComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    // The page's own monster picker, the one inside <app-minion-form>, and the one inside the
    // <app-weapon-tag-select> on the attack add-form.
    expect(sweepEscape(fixture, fixture.nativeElement, 'minion-create').swept).toBe(3);
  });

  // -------------------------------------------------------------------------------------------
  // Wizards. These are the surfaces the feature adds capability to, and the ones where the
  // control sits inside a `@switch` over the current phase.
  // -------------------------------------------------------------------------------------------

  describe('the mystery wizard, phase by phase', () => {
    let fixture: ComponentFixture<MysteryCreateComponent>;
    let store: MysteryCreateStore;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [MysteryCreateComponent],
        providers: [
          provideRouter([]),
          { provide: ReferenceDataService, useClass: MockReferenceDataService },
          {
            provide: MysteryService,
            useValue: { create: () => of({ id: 'mystery-1' }), upsertCountdown: () => of({}), getMysteries: () => of([]) },
          },
          { provide: MonsterService, useValue: { getAll: () => of([]), create: () => of({ id: 'monster-1' }) } },
          // Phase 4: the store loads the attach catalogues through the real Location service.
          { provide: ApiService, useValue: { post: () => of({}), get: () => of([]) } },
          { provide: NotificationService, useValue: notifications },
          { provide: BystanderService, useValue: { getAll: () => of([]) } },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(MysteryCreateComponent);
      store = fixture.debugElement.injector.get(MysteryCreateStore);
      fixture.detectChanges();
    });

    it('monster phase, step 1 — monster type, archetype, and the attack weapon-tag select', () => {
      store.currentPhase.set(1);
      store.currentStep.set(0);
      fixture.detectChanges();

      // Type, archetype, and the weapon-tag-select on the monster's attack add-form.
      expect(sweepEscape(fixture, fixture.nativeElement, 'wizard monster phase step 1').swept).toBe(3);
    });

    it('monster phase, step 2 — the minion type and attack weapon-tag selects in the composer', () => {
      store.currentPhase.set(1);
      store.currentStep.set(1);
      // 5b: with no monsters the minion step renders its empty state and no composer at all. One
      // monster means no parent picker either, so the select count is unchanged.
      store.monsterDrafts.set([rosterMonster()]);
      store.minionComposerOpen.set(true);
      fixture.detectChanges();

      // Minion type, and the weapon-tag-select on the minion's attack add-form.
      expect(sweepEscape(fixture, fixture.nativeElement, 'wizard minion composer').swept).toBe(2);
    });

    /**
     * **The two selects 5b adds, and neither was in the sweep.**
     *
     * The step-1 and step-2 cases above hold their counts at 3 and 2 by keeping the catalogue empty
     * and the roster at one monster — which is what keeps them stable, and is also exactly the two
     * states in which the new controls do not render. Phase 3's invariant is *every surface that
     * renders a panel*, so a new instance that only appears in a second state needs a second state.
     */
    it('monster phase, step 1 — and the attach strip’s picker, once the catalogue is non-empty', () => {
      store.currentPhase.set(1);
      store.currentStep.set(0);
      store['catalogMonsters'].set([
        {
          id: 'mo-9',
          mysteryIds: [],
          name: 'The Hollow Man',
          description: null,
          harmCapacity: 6,
          monsterType: { id: 'monster-type-1', name: 'Beast', motivation: '' },
          monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: '' },
          attackCount: 0,
          powerCount: 0,
          armorCount: 0,
          weaknessCount: 0,
          minionCount: 0,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ]);
      fixture.detectChanges();

      // Type, archetype, the attack weapon-tag select — and the attach strip (UX §17.1).
      expect(sweepEscape(fixture, fixture.nativeElement, 'wizard monster attach strip').swept).toBe(4);
    });

    it('monster phase, step 2 — and the parent picker, once there are two monsters to choose from', () => {
      store.currentPhase.set(1);
      store.currentStep.set(1);
      // Two monsters is the whole trigger: `soleMonsterKey()` goes null, the prose line is replaced
      // by the picker, and it is the composer's *first* field (§18.3).
      store.monsterDrafts.set([
        rosterMonster(),
        rosterMonster({ localKey: 'monster-fixture-2', name: 'The Pale Choir' }),
      ]);
      store.minionComposerOpen.set(true);
      fixture.detectChanges();

      // Minion type, the attack weapon-tag select — and the monster picker.
      expect(sweepEscape(fixture, fixture.nativeElement, 'wizard minion parent picker').swept).toBe(3);
    });

    it('locations phase — the location type select', () => {
      store.currentPhase.set(2);
      store.currentStep.set(0);
      fixture.detectChanges();

      expect(sweepEscape(fixture, fixture.nativeElement, 'wizard locations phase').swept).toBe(1);
    });

    it('bystanders phase — the bystander type select', () => {
      store.currentPhase.set(3);
      store.currentStep.set(0);
      fixture.detectChanges();

      expect(sweepEscape(fixture, fixture.nativeElement, 'wizard bystanders phase').swept).toBe(1);
    });
  });

  it('steps/hunter-playbook-step.html — the hunter wizard’s searchable playbook picker', async () => {
    await TestBed.configureTestingModule({
      imports: [HunterCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: PlaybookService,
          useValue: {
            getAll: () =>
              of([{ id: 'pb1', name: 'The Chosen', statArrayOptionCount: 1, moveCount: 3, bespokeSectionCount: 0 }]),
            getById: () => of(null),
          },
        },
        { provide: HunterService, useValue: { create: () => of(null), evaluate: () => of({}) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HunterCreateComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sweepEscape(fixture, fixture.nativeElement, 'hunter-create playbook step').swept).toBe(1);
  });

  // -------------------------------------------------------------------------------------------
  // Non-entity pages. Included because the brief is "every surface", and because `settings` is
  // the one surface where the select is the page's only control.
  // -------------------------------------------------------------------------------------------

  it('pages/settings/settings.html — the theme select', async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        {
          provide: ThemeService,
          useValue: {
            preference: signal('system'),
            resolvedTheme: signal('light'),
            setPreference: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();

    expect(sweepEscape(fixture, fixture.nativeElement, 'settings').swept).toBe(1);
  });

  it('pages/data-admin/data-admin.html — the reference-table select', async () => {
    await TestBed.configureTestingModule({
      imports: [DataAdminPageComponent],
      providers: [
        { provide: ReferenceDataService, useClass: MockReferenceDataService },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DataAdminPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(sweepEscape(fixture, fixture.nativeElement, 'data-admin').swept).toBe(1);
  });
});
