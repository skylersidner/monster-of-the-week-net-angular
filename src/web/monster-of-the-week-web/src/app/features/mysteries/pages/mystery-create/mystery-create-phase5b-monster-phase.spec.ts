import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { BystanderService } from '../../../../core/bystander';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateComponent } from './mystery-create';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * **Phase 5b's component contract**: the monster step as roster → attach strip → composer, the
 * removal modal's variant table with its two lists, the attach strip's busy and error states, and
 * the minion step's parent picker.
 *
 * Its store twin is `mystery-create-phase5b-roster.spec.ts`. The split is the shipped one: what the
 * user is shown lives here, what goes on the wire lives there.
 */

const MONSTER_TYPE = { id: 'monster-type-1', name: 'Beast', motivation: 'to feed' };
const ARCHETYPE = { id: 'monster-archetype-1', name: 'Ghost', description: '' };

const MYSTERIES = [
  { id: 'mystery-1', name: 'The Hollow Choir' },
  { id: 'mystery-9', name: 'Dust Bowl Nights' },
];

const catalogueMonster = (id: string, name: string, mysteryIds: string[] = []) => ({
  id,
  mysteryIds,
  name,
  description: null,
  harmCapacity: 6,
  monsterType: MONSTER_TYPE,
  monsterArchetype: ARCHETYPE,
  // Deliberately wrong relative to the detail response below: `5b-T6` asserts the card reads the
  // draft's own collections and never these.
  attackCount: 9,
  powerCount: 9,
  armorCount: 9,
  weaknessCount: 9,
  minionCount: 9,
  createdAt: '2026-01-01T00:00:00Z',
});

const detailMonster = (id: string, name: string, mysteryIds: string[] = []) => ({
  id,
  mysteryIds,
  name,
  description: null,
  harmCapacity: 6,
  monsterTypeId: MONSTER_TYPE.id,
  monsterTypeName: MONSTER_TYPE.name,
  monsterArchetype: ARCHETYPE,
  attacks: [{ id: `${id}-attack-1`, name: 'Grasp', description: null, harm: 2, weaponTags: [] }],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
});

const detailMinion = (id: string, name: string, monsterId: string) => ({
  id,
  monsterId,
  monsterName: 'owner',
  name,
  description: null,
  harmCapacity: 3,
  minionType: { id: 'minion-type-1', name: 'Cultist', motivation: '' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
});

describe('The wizard’s Monsters phase — Phase 5b', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let store: MysteryCreateStore;
  let element: HTMLElement;

  let catalogue: ReturnType<typeof catalogueMonster>[];
  let monsterDetails: Map<string, ReturnType<typeof detailMonster>>;
  let minionsByMonster: Map<string, { id: string }[]>;
  let minionDetails: Map<string, ReturnType<typeof detailMinion>>;
  let failMinionDetail: string | null;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MysteryCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([ARCHETYPE]),
            getMonsterTypes: () => of([MONSTER_TYPE]),
            getMinionTypes: () => of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]),
            getLocationTypes: () => of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]),
            getBystanderTypes: () => of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]),
            getWeaponTags: () => of([]),
          },
        },
        {
          provide: MysteryService,
          useValue: {
            create: () => of({ id: 'mystery-1' }),
            upsertCountdown: () => of({}),
            getMysteries: () => of(MYSTERIES),
          },
        },
        {
          provide: MonsterService,
          useValue: {
            getAll: () => of(catalogue),
            getById: (monsterId: string) => of(monsterDetails.get(monsterId)),
            create: () => of({ id: 'monster-created' }),
            update: () => of({ id: 'monster-created' }),
            delete: () => of(undefined),
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
          },
        },
        {
          provide: MinionService,
          useValue: {
            getByMonster: (monsterId: string) => of(minionsByMonster.get(monsterId) ?? []),
            getById: (minionId: string) =>
              failMinionDetail === minionId ? throwError(() => new Error('boom')) : of(minionDetails.get(minionId)),
          },
        },
        { provide: LocationService, useValue: { getAll: () => of([]) } },
        { provide: BystanderService, useValue: { getAll: () => of([]) } },
        { provide: ApiService, useValue: { post: () => of({}), get: () => of([]) } },
        { provide: NotificationService, useValue: { success: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryCreateComponent);
    // The store is component-provided, so it comes from the component's own injector.
    store = fixture.debugElement.injector.get(MysteryCreateStore);
    element = fixture.nativeElement as HTMLElement;
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(1);
    store.currentStep.set(0);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    catalogue = [];
    monsterDetails = new Map();
    minionsByMonster = new Map();
    minionDetails = new Map();
    failMinionDetail = null;
  });

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const phasePanel = (): HTMLElement => element.querySelector<HTMLElement>('app-mystery-create-monster-phase')!;
  const rosterList = (): HTMLUListElement | null => phasePanel().querySelector<HTMLUListElement>('ul.grid.gap-2');
  const rosterRows = (): HTMLLIElement[] => Array.from(rosterList()?.querySelectorAll('li') ?? []);
  const dialog = (): HTMLElement | null => element.querySelector<HTMLElement>('[role="dialog"]');
  const dialogButtons = (): string[] =>
    Array.from(dialog()!.querySelectorAll<HTMLButtonElement>('button')).map((b) => b.textContent?.trim() ?? '');
  const dialogText = (): string => dialog()!.textContent ?? '';
  const attachStrip = (): HTMLElement | null =>
    phasePanel().querySelector<HTMLElement>('.bg-surface-sunken.border.border-default');

  function authorMonster(name: string): void {
    store.monsterForm.setValue({
      name,
      description: '',
      harmCapacity: 6,
      monsterTypeId: MONSTER_TYPE.id,
      monsterArchetypeId: ARCHETYPE.id,
    });
    store.saveMonsterDraftToList();
  }

  // -------------------------------------------------------------------------------------------
  // The section order, which §14.2(c) makes load-bearing for focus as well as for reading
  // -------------------------------------------------------------------------------------------

  it('renders roster → attach strip → composer, in that order', async () => {
    catalogue = [catalogueMonster('mo-9', 'The Hollow Man')];
    await create();

    const markers = Array.from(phasePanel().querySelectorAll<HTMLElement>('ul.grid.gap-2, label[for="attach-monster"], h4'))
      .map((node) => (node.tagName === 'UL' ? 'roster' : node.tagName === 'LABEL' ? 'strip' : 'composer'))
      .filter((marker, index, all) => all.indexOf(marker) === index);

    expect(markers).toEqual(['roster', 'strip', 'composer']);
  });

  it('5b-X3/§16.1: an empty roster shows the ordinary empty state, and the blurb carries the nudge', async () => {
    await create();

    expect(phasePanel().textContent).toContain('No monsters added yet.');
    expect(element.querySelector('section p')?.textContent ?? element.textContent).toContain(
      'or none, if the threat',
    );
  });

  it('5b-T6: the roster card counts come from the draft, not from the catalogue row', async () => {
    catalogue = [catalogueMonster('mo-9', 'The Hollow Man')];
    monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man'));
    minionsByMonster.set('mo-9', [{ id: 'mi-1' }]);
    minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-9'));
    await create();

    store.attachMonster('mo-9');
    await settle();

    // The catalogue row claims nine of everything. The card must read the draft, or "card says
    // Attacks: 9, composer shows one" is reachable — the §15.1 defect shape, one level up.
    const summary = rosterRows()[0].querySelector('small')!.textContent!.replace(/\s+/g, ' ');
    expect(summary).toContain('Attacks: 1');
    expect(summary).toContain('Minions: 1');
    expect(summary).not.toContain('9');
  });

  it('5b-R4: the pencil marks the row and loads it, and saving writes back into the same slot', async () => {
    await create();
    authorMonster('Maestro Vey');
    authorMonster('The Hollow Man');
    await settle();

    const editButton = Array.from(phasePanel().querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.getAttribute('aria-label') === 'Edit The Hollow Man',
    )!;
    editButton.click();
    await settle();

    expect(rosterRows()[1].textContent).toContain('Editing');
    expect(store.monsterForm.controls.name.value).toBe('The Hollow Man');

    store.monsterForm.controls.name.setValue('The Hollow Man, Renamed');
    store.saveMonsterDraftToList();
    await settle();

    expect(store.monsterDrafts().map((draft) => draft.name)).toEqual(['Maestro Vey', 'The Hollow Man, Renamed']);
    expect(rosterRows()).toHaveLength(2);
  });

  // -------------------------------------------------------------------------------------------
  // §5 — the attach strip's two transient states
  // -------------------------------------------------------------------------------------------

  describe('the attach strip', () => {
    it('5b-T4: hides entirely when the catalogue is empty', async () => {
      await create();

      expect(attachStrip()).toBeNull();
    });

    it('5b-T4: keeps the strip with its empty state once everything is already on the roster', async () => {
      catalogue = [catalogueMonster('mo-9', 'The Hollow Man')];
      monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man'));
      await create();

      store.attachMonster('mo-9');
      await settle();

      expect(attachStrip()).not.toBeNull();
      expect(store.attachableMonsters()).toEqual([]);
    });

    it('5b-T4: the busy state lives in the strip — disabled, named, with a spinner', async () => {
      catalogue = [catalogueMonster('mo-9', 'The Hollow Man')];
      await create();

      // Held mid-flight by setting the store's own in-flight signal, which is what the template
      // binds. The real hydration resolves synchronously in these doubles.
      store.attachingMonsterName.set('The Hollow Man');
      await settle();

      expect(attachStrip()!.textContent).toContain('Loading “The Hollow Man”…');
      expect(attachStrip()!.querySelector('app-icon[name="spinner"]')).not.toBeNull();
      // The select is replaced rather than merely disabled, so there is nothing to pick into.
      expect(attachStrip()!.querySelector('#attach-monster')).toBeNull();
      // And no roster card appeared while it was in flight (`5b-T2`).
      expect(rosterRows()).toEqual([]);
    });

    it('5b-T5: Next is disabled while an attach is in flight', async () => {
      catalogue = [catalogueMonster('mo-9', 'The Hollow Man')];
      await create();

      const next = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
        button.textContent?.includes('Next'),
      )!;
      expect(next.disabled).toBe(false);

      store.attachingMonsterName.set('The Hollow Man');
      await settle();

      expect(next.disabled).toBe(true);
    });

    it('5b-T3/5b-T4: a failure shows inline in the strip, never in the wizard footer band', async () => {
      catalogue = [catalogueMonster('mo-9', 'The Hollow Man')];
      monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man'));
      minionsByMonster.set('mo-9', [{ id: 'mi-1' }]);
      minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-9'));
      failMinionDetail = 'mi-1';
      await create();

      store.attachMonster('mo-9');
      await settle();

      expect(attachStrip()!.querySelector('.text-danger')!.textContent).toContain(
        'Couldn\'t load “The Hollow Man”. Try again.',
      );
      // The footer band belongs to submit failures and sits a scroll away from the action.
      expect(store.submitError()).toBeNull();
      expect(rosterRows()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------------------------
  // §6 — the removal modal's variant table
  // -------------------------------------------------------------------------------------------

  describe('the removal modal', () => {
    async function openRemoval(name: string): Promise<void> {
      const trash = Array.from(phasePanel().querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.getAttribute('aria-label') === `Remove ${name}`,
      )!;
      trash.click();
      await settle();
    }

    it('(A1) never saved: Cancel · Remove, and the copy says what was typed is discarded', async () => {
      await create();
      authorMonster('Maestro Vey');
      await settle();

      await openRemoval('Maestro Vey');

      expect(dialogButtons()).toEqual(['Cancel', 'Remove']);
      expect(dialogText()).toContain("This monster hasn't been saved yet. Removing it discards what you typed.");
      expect(dialogText()).not.toContain('Detach');
    });

    it('(A2) attached this session: Cancel · Remove, and no Delete anywhere near it', async () => {
      catalogue = [catalogueMonster('mo-9', 'The Hollow Man', ['mystery-9'])];
      monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man', ['mystery-9']));
      await create();

      store.attachMonster('mo-9');
      await settle();
      await openRemoval('The Hollow Man');

      // The most consequential place a stale `id` predicate would put Delete: this monster is real,
      // is used elsewhere, and deleting it would cascade its minions.
      expect(dialogButtons()).toEqual(['Cancel', 'Remove']);
      expect(dialogText()).toContain("This monster stays in your monsters list");
      expect(dialogText()).not.toContain('Delete');
    });

    it('(C) persisted and shared, with minions: both lists, and the cascade is tied to Delete only', async () => {
      catalogue = [catalogueMonster('mo-9', 'The Hollow Man', ['mystery-1', 'mystery-9'])];
      monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man', ['mystery-1', 'mystery-9']));
      minionsByMonster.set('mo-9', [{ id: 'mi-1' }, { id: 'mi-2' }]);
      minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-9'));
      minionDetails.set('mi-2', detailMinion('mi-2', 'Pale Choir', 'mo-9'));
      await create();

      store.attachMonster('mo-9');
      // Simulate the membership having been persisted by a previous submit, which is what moves the
      // variant from (A2) to (B)/(C) — the store refreshes this baseline on every successful submit.
      store['existingMonsterIds'].set(['mo-9']);
      await settle();
      await openRemoval('The Hollow Man');

      expect(dialogButtons()).toEqual(['Cancel', 'Detach', 'Delete']);
      // The usage list, above the cascade list.
      expect(dialogText()).toContain('This monster is also used by 1 other mystery:');
      expect(dialogText()).toContain('Dust Bowl Nights');
      // The cascade list.
      expect(dialogText()).toContain('This will also delete the following minions:');
      expect(dialogText()).toContain('Grave-Wight');
      expect(dialogText()).toContain('Pale Choir');
      // **Tied to Delete only**, or the footnote implies minions die either way (UX §7.1, §18.3).
      expect(dialogText()).toContain(
        'Detach removes it from this mystery only. Delete removes it from those mysteries too, along with its minions.',
      );
      expect(dialogText()).toContain('Either way, the change takes effect when you continue to the next step.');
    });

    it('(B) persisted, no other mysteries and no minions: no cascade clause is invented', async () => {
      catalogue = [catalogueMonster('mo-9', 'The Hollow Man', ['mystery-1'])];
      monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man', ['mystery-1']));
      await create();

      store.attachMonster('mo-9');
      store['existingMonsterIds'].set(['mo-9']);
      await settle();
      await openRemoval('The Hollow Man');

      expect(dialogButtons()).toEqual(['Cancel', 'Detach', 'Delete']);
      expect(dialogText()).toContain("This monster isn't used by any other mystery.");
      expect(dialogText()).toContain('Detach keeps it in your monsters list. Delete removes it for good.');
      expect(dialogText()).not.toContain('along with its minions');
      expect(dialogText()).not.toContain('This will also delete');
    });

    it('UX §18.4: the cascade list names persisted children, not whatever the roster shows', async () => {
      catalogue = [
        catalogueMonster('mo-a', 'Alpha', ['mystery-1']),
        catalogueMonster('mo-b', 'Beta', ['mystery-1']),
      ];
      monsterDetails.set('mo-a', detailMonster('mo-a', 'Alpha', ['mystery-1']));
      monsterDetails.set('mo-b', detailMonster('mo-b', 'Beta', ['mystery-1']));
      minionsByMonster.set('mo-a', [{ id: 'mi-1' }]);
      minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-a'));
      await create();

      store.attachMonster('mo-a');
      store.attachMonster('mo-b');
      store['existingMonsterIds'].set(['mo-a', 'mo-b']);
      await settle();

      // Move the minion onto Beta. The roster now shows it under Beta; the server still has it
      // under Alpha, and deleting Beta would not take it.
      const beta = store.monsterDrafts().find((draft) => draft.id === 'mo-b')!;
      store.editMinionDraft(store.minionDrafts()[0].localKey);
      store.minionForm.controls.monsterKey.setValue(beta.localKey);
      store.saveMinionDraftToList();
      await settle();

      await openRemoval('Beta');

      // `[items]` is a promise about what deletion takes, not a summary of the roster.
      expect(dialogText()).not.toContain('Grave-Wight');
      expect(dialogText()).not.toContain('This will also delete');
    });
  });

  // -------------------------------------------------------------------------------------------
  // §7 — the minion step's parent picker
  // -------------------------------------------------------------------------------------------

  describe('the minion step', () => {
    const minionPanel = (): HTMLElement => phasePanel();

    it('5b-O7/5b-K1: with no monsters the step says so, suppresses the composer, and does not block', async () => {
      await create();
      store.currentStep.set(1);
      await settle();

      expect(minionPanel().textContent).toContain('Add a monster first — minions belong to a monster.');
      expect(minionPanel().querySelector('#minionName')).toBeNull();
      expect(minionPanel().querySelector('#minionMonster')).toBeNull();
    });

    it('5b-K1: with exactly one monster there is no picker, only the prose line', async () => {
      await create();
      authorMonster('Maestro Vey');
      store.currentStep.set(1);
      store.startNewMinionDraft();
      await settle();

      expect(minionPanel().querySelector('#minionMonster')).toBeNull();
      expect(minionPanel().textContent).toContain('Belongs to');
      expect(minionPanel().textContent).toContain('Maestro Vey');
    });

    it('5b-K1/5b-K2: with two monsters the picker is the composer’s first field, over the roster', async () => {
      await create();
      authorMonster('Maestro Vey');
      authorMonster('The Hollow Man');
      store.currentStep.set(1);
      store.startNewMinionDraft();
      await settle();

      const picker = minionPanel().querySelector('#minionMonster');
      expect(picker).not.toBeNull();

      // First field: it precedes Minion Name in document order.
      const fields = Array.from(minionPanel().querySelectorAll('#minionMonster, #minionName'));
      expect(fields.map((node) => node.id)).toEqual(['minionMonster', 'minionName']);

      expect(store.monsterPickerOptions().map((option) => option.name)).toEqual([
        'Maestro Vey',
        'The Hollow Man',
      ]);
    });

    it('5b-K1: the picker shows the required-error sentence once it has been touched and left empty', async () => {
      await create();
      authorMonster('Maestro Vey');
      authorMonster('The Hollow Man');
      store.currentStep.set(1);
      store.startNewMinionDraft();
      store.minionForm.controls.monsterKey.markAsTouched();
      await settle();

      expect(minionPanel().textContent).toContain('A minion must belong to a monster.');
    });

    it('5b-K6: a minion roster card names its monster, and follows a re-parent immediately', async () => {
      await create();
      authorMonster('Maestro Vey');
      authorMonster('The Hollow Man');
      store.currentStep.set(1);
      store.minionForm.patchValue({
        monsterKey: store.monsterDrafts()[0].localKey,
        name: 'Choir Thrall',
        description: '',
        harmCapacity: 3,
        minionTypeId: 'minion-type-1',
      });
      store.saveMinionDraftToList();
      await settle();

      expect(minionPanel().textContent).toContain('Belongs to Maestro Vey');

      store.editMinionDraft(store.minionDrafts()[0].localKey);
      store.minionForm.controls.monsterKey.setValue(store.monsterDrafts()[1].localKey);
      store.saveMinionDraftToList();
      await settle();

      // Before the submit, not after: the re-parent is committed to the draft at Save.
      expect(minionPanel().textContent).toContain('Belongs to The Hollow Man');
    });
  });

  // -------------------------------------------------------------------------------------------
  // §9 — the dossier
  // -------------------------------------------------------------------------------------------

  it('5b-X3: the dossier renders one compact entry per monster and expands only the one in the composer', async () => {
    await create();
    authorMonster('Maestro Vey');
    authorMonster('The Hollow Man');
    await settle();

    const dossier = element.querySelector('aside')!;
    expect(dossier.textContent).toContain('Maestro Vey');
    expect(dossier.textContent).toContain('The Hollow Man');
    // Nothing is in the composer, so nothing is expanded.
    expect(dossier.textContent).not.toContain('Harm Capacity');

    store.editMonsterDraft(store.monsterDrafts()[1].localKey);
    await settle();

    expect(dossier.textContent).toContain('Harm Capacity');
  });

  it('5b-X3: and an empty roster gets an empty state rather than a missing section', async () => {
    await create();

    const dossier = element.querySelector('aside')!;
    expect(dossier.textContent).toContain('Monsters');
    expect(dossier.textContent).toContain('No monsters added yet.');
  });

  it('5b-X1: a surviving roster row keeps its DOM node when an earlier row is removed', async () => {
    // **The consequence of `track localKey`, asserted rather than the token.** Under `track $index`
    // every row after the removed one is re-created, which is invisible in a text assertion and is
    // exactly what the key exists to prevent. Bite: reverting one token fails this.
    await create();
    authorMonster('Alpha');
    authorMonster('Beta');
    authorMonster('Gamma');
    await settle();

    const survivor = rosterRows()[2];
    expect(survivor.textContent).toContain('Gamma');

    store.removeMonsterDraft(store.monsterDrafts()[0].localKey, 'delete');
    await settle();

    expect(rosterRows()).toHaveLength(2);
    expect(rosterRows()[1]).toBe(survivor);
  });

  it('5b-X1: and the dossier’s own location list does the same', async () => {
    await create();
    store.locations.set([
      { id: null, localKey: 'loc-a', name: 'Alpha', description: '', locationTypeId: 'location-type-1', mysteryIds: [] },
      { id: null, localKey: 'loc-b', name: 'Beta', description: '', locationTypeId: 'location-type-1', mysteryIds: [] },
    ]);
    store.currentPhase.set(2);
    await settle();

    const dossier = element.querySelector('aside')!;
    const items = Array.from(dossier.querySelectorAll('li'));
    const survivor = items[items.length - 1];
    expect(survivor.textContent).toContain('Beta');

    store.locations.update((drafts) => drafts.filter((draft) => draft.localKey !== 'loc-a'));
    await settle();

    const after = Array.from(dossier.querySelectorAll('li'));
    expect(after[after.length - 1]).toBe(survivor);
  });
  // -------------------------------------------------------------------------------------------
  // §8.8 — the derived half of the confirm-modal census
  // -------------------------------------------------------------------------------------------

  /**
   * **The wizard's share of `ConfirmDeleteModalComponent`'s call sites, counted rather than
   * written down** (§8.8, rev 12).
   *
   * `confirm-delete-modal.call-sites.spec.ts` keeps the readable census — which template has how
   * many — and that is the right place for it. What it could not do was *check* it: its two
   * assertions compared the literal against itself, so the census sat at 13-in-12 while Phase 4
   * added two wizard call sites and 5b added a third. Nothing failed, because nothing could.
   *
   * This is the other half. It mounts the wizard and counts the dialogs each phase actually
   * contributes, so the three rows the wizard owns are derived from the rendered application. The
   * numbers below are the census's; if a phase gains or loses a dialog, one of these fails and the
   * census has to be updated with it.
   *
   * The modal renders only while visible, so each phase is asserted by the count of *host elements*
   * rather than open dialogs — the host is in the template unconditionally, which is exactly the
   * thing being counted.
   */
  it('§8.8: the wizard contributes four confirm-modal call sites, counted from the rendered phases', async () => {
    await create();
    // **Each phase is put in the state where its dialog can render**, which is the trap §8.8 is
    // about: the Escape sweep narrowed silently because it held counts in the two states where the
    // new selects did not exist. With an empty roster the whole minion step is suppressed (§6 row
    // three), so counting there would have recorded one fewer and passed.
    authorMonster('Maestro Vey');
    store.locations.set([
      { id: null, localKey: 'loc-a', name: 'Ferris Mill', description: '', locationTypeId: 'location-type-1', mysteryIds: [] },
    ]);
    store.bystanders.set([
      { id: null, localKey: 'bys-a', name: 'Sheriff Dalton', description: '', bystanderTypeId: 'bystander-type-1', mysteryIds: [] },
    ]);

    const hostsInPhase = async (phase: number, step: number): Promise<number> => {
      store.currentPhase.set(phase);
      store.currentStep.set(step);
      await settle();
      return element.querySelectorAll('app-confirm-delete-modal').length;
    };

    // The monster phase carries two: the monster roster's (5b) and the minion roster's (multi-minion).
    expect(await hostsInPhase(1, 0)).toBe(1);
    expect(await hostsInPhase(1, 1)).toBe(1);
    // …and Locations and Bystanders one each, both from Phase 4.
    expect(await hostsInPhase(2, 0)).toBe(1);
    expect(await hostsInPhase(3, 0)).toBe(1);

    // Four in total across the wizard, which is the census row this derives.
    const total = [await hostsInPhase(1, 0), await hostsInPhase(1, 1), await hostsInPhase(2, 0), await hostsInPhase(3, 0)]
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });
});
