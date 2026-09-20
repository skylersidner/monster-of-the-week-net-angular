import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

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
 * Phase 4's component contract: the removal modal's variant table (UX §7.1), the four bindings
 * §14.2 requires be explicit, the section order §14.2(c) makes load-bearing for focus, and the
 * Escape nesting Phase 3 built — which this phase is the first to actually exercise, because it is
 * the first time a select and a dialog share a screen in the wizard.
 */

const CATALOGUE_LOCATIONS = [
  {
    id: 'loc-existing',
    mysteryIds: ['mystery-1', 'mystery-9', 'mystery-8'],
    name: 'Ferris Mill',
    description: 'Rust and river damp.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: 'to hide things',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-lonely',
    mysteryIds: ['mystery-1'],
    name: 'The Diner',
    description: '',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: 'to hide things',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const MYSTERIES = [
  { id: 'mystery-1', name: 'The Hollow Choir' },
  { id: 'mystery-9', name: 'Dust Bowl Nights' },
  { id: 'mystery-8', name: 'The Long Drive Home' },
];

describe('The wizard’s Locations phase — Phase 4', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let store: MysteryCreateStore;
  let element: HTMLElement;
  let catalogue: typeof CATALOGUE_LOCATIONS;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MysteryCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([{ id: 'monster-archetype-1', name: 'Ghost', description: '' }]),
            getMonsterTypes: () => of([{ id: 'monster-type-1', name: 'Beast', motivation: '' }]),
            getMinionTypes: () => of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]),
            getLocationTypes: () => of([{ id: 'location-type-1', name: 'Lair', motivation: 'to hide things' }]),
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
        { provide: MonsterService, useValue: { create: () => of({ id: 'monster-1' }) } },
        { provide: MinionService, useValue: {} },
        {
          provide: LocationService,
          useValue: {
            getAll: () => of(catalogue),
            create: () => of({ id: 'loc-created' }),
            update: () => of({}),
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
            delete: () => of(undefined),
          },
        },
        { provide: BystanderService, useValue: { getAll: () => of([]) } },
        { provide: ApiService, useValue: { post: () => of({}), get: () => of([]) } },
        { provide: NotificationService, useValue: { success: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryCreateComponent);
    store = fixture.debugElement.injector.get(MysteryCreateStore);
    element = fixture.nativeElement as HTMLElement;
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(2);
    store.currentStep.set(0);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const dialog = (): HTMLElement | null => element.querySelector<HTMLElement>('[role="dialog"]');
  const dialogButtons = (): string[] =>
    Array.from(dialog()!.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');
  const dialogText = (): string => dialog()!.textContent ?? '';
  const rosterRows = (): HTMLLIElement[] => Array.from(element.querySelectorAll('li.roster-card'));
  const attachStrip = (): HTMLElement | null => element.querySelector<HTMLElement>('#attach-location');
  const trashFor = (name: string): HTMLButtonElement =>
    element.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${name}"]`)!;

  /** Puts a persisted membership on the roster — the (B)/(C) precondition. */
  async function attachAndSubmit(id: string): Promise<void> {
    store.attachLocation(id);
    store.next();
    store.currentPhase.set(2);
    store.currentStep.set(0);
    await settle();
  }

  beforeEach(async () => {
    catalogue = CATALOGUE_LOCATIONS;
    await create();
  });

  // --- the anatomy (§2.1) ---------------------------------------------------------------

  it('renders roster → attach strip → composer, in that order', async () => {
    store.attachLocation('loc-existing');
    await settle();

    const order = Array.from(element.querySelectorAll('li.roster-card, #attach-location, h4'))
      .filter((node) => node.closest('app-mystery-create-locations-phase'))
      .map((node) => (node.tagName === 'LI' ? 'roster' : node.id === 'attach-location' ? 'attach' : 'composer'));

    // §14.2(c): this is load-bearing for focus, not only for reading — the modal's close-time
    // fallback focuses the first control in this component's root, which must be a roster pencil.
    expect(order[0]).toBe('roster');
    expect(order.indexOf('attach')).toBeGreaterThan(order.indexOf('roster'));
  });

  it('tracks the roster by localKey, never $index', async () => {
    store.attachLocation('loc-existing');
    store.attachLocation('loc-lonely');
    await settle();

    const second = rosterRows()[1] as HTMLLIElement & { marker?: string };
    second.marker = 'diner';

    store.removeLocationDraft(store.locations()[0].localKey, 'delete');
    await settle();

    // Under `track $index` Angular recycles the node, and the modal's `opener?.isConnected` restore
    // would then land focus on a *different* entity's control with no error anywhere.
    const survivor = rosterRows()[0] as HTMLLIElement & { marker?: string };
    expect(survivor.marker).toBe('diner');
  });

  // --- the attach strip (§3, A1–A3) -------------------------------------------------------

  it('A1/A3: hides the strip entirely when the catalogue is empty', async () => {
    catalogue = [];
    TestBed.resetTestingModule();
    await create();

    expect(attachStrip()).toBeNull();
  });

  it('A3: keeps the strip when everything in the catalogue is already on the roster, with its empty state', async () => {
    store.attachLocation('loc-existing');
    store.attachLocation('loc-lonely');
    await settle();

    expect(attachStrip()).toBeTruthy();

    // `CustomSelectComponent` renders `emptyText` inside the panel, not on the trigger.
    const trigger = element.querySelector<HTMLButtonElement>('#attach-location .custom-select__trigger')!;
    trigger.click();
    await settle();

    expect(element.textContent).toContain("Every location you've made is already in this mystery.");
  });

  it('A2: picking an option attaches on the spot and resets the control', async () => {
    const select = element.querySelector<HTMLElement>('#attach-location')!;
    select.querySelector<HTMLButtonElement>('.custom-select__trigger')!.click();
    await settle();

    const option = Array.from(select.querySelectorAll<HTMLButtonElement>('.custom-select__option')).find((button) =>
      button.textContent?.includes('Ferris Mill'),
    )!;
    option.click();
    await settle();

    expect(store.locations().map((draft) => draft.name)).toEqual(['Ferris Mill']);
    expect(rosterRows()).toHaveLength(1);
    // No second click, no confirmation — and the picked entity is no longer offered.
    expect(store.attachableLocations().map((item) => item.id)).toEqual(['loc-lonely']);
  });

  it('A9: the locations phase offers no monster attach affordance', () => {
    expect(element.querySelector('#attach-monster')).toBeNull();
  });

  it('R3: editing a shared entity shows no warning, advisory or "this is shared" copy anywhere', async () => {
    // Decision 4 / UX §9.4, and the one Peach flags as most likely to be "helpfully" undone later.
    // `loc-existing` is in three mysteries, so if any surface were going to say so, it is this one.
    await attachAndSubmit('loc-existing');

    const pencil = element.querySelector<HTMLButtonElement>('button[aria-label="Edit Ferris Mill"]')!;
    pencil.click();
    await settle();

    const text = element.textContent ?? '';
    expect(text).not.toContain('shared');
    expect(text).not.toContain('other mysteries');
    expect(text).not.toContain('will also');
    expect(text).not.toContain('Dust Bowl Nights');
    // The roster card carries no origin or sharing marker either (OQ5).
    expect(rosterRows()[0].textContent).not.toContain('Attached');
  });

  // --- the variant table (§7.1) -----------------------------------------------------------

  it('(A1) never persisted: Cancel · Remove, and the copy says what was typed is discarded', async () => {
    store.addLocationForm.setValue({ name: 'The Chapel', description: '', locationTypeId: 'location-type-1' });
    store.saveLocationDraft();
    await settle();

    trashFor('The Chapel').click();
    await settle();

    expect(dialogButtons()).toEqual(['Cancel', 'Remove']);
    expect(dialogText()).toContain('Remove "The Chapel"?');
    expect(dialogText()).toContain("This location hasn't been saved yet. Removing it discards what you typed.");
  });

  it('(A2) attached this session: Cancel · Remove, and no Delete anywhere near it', async () => {
    // Peach's G3. The entity has an id the instant it is attached, so an `id !== null` predicate
    // would offer Delete — permanent catalogue destruction — for a mis-click a second old.
    store.attachLocation('loc-existing');
    await settle();

    trashFor('Ferris Mill').click();
    await settle();

    expect(dialogButtons()).toEqual(['Cancel', 'Remove']);
    expect(dialogButtons()).not.toContain('Delete');
    expect(dialogButtons()).not.toContain('Detach');
    expect(dialogText()).toContain(
      "This location stays in your locations list — it just won't be part of this mystery.",
    );
    // (A1)'s sentence is wrong here: nothing was typed.
    expect(dialogText()).not.toContain('discards what you typed');
  });

  it('(B) persisted, no other mysteries: Cancel · Detach · Delete, and it says so explicitly', async () => {
    await attachAndSubmit('loc-lonely');

    trashFor('The Diner').click();
    await settle();

    expect(dialogButtons()).toEqual(['Cancel', 'Detach', 'Delete']);
    expect(dialogText()).toContain("This location isn't used by any other mystery.");
    expect(dialogText()).toContain('Detach keeps it in your locations list. Delete removes it for good.');
  });

  it('(C) persisted and shared: the count agrees with the names, and the current mystery is not one of them', async () => {
    await attachAndSubmit('loc-existing');

    trashFor('Ferris Mill').click();
    await settle();

    expect(dialogButtons()).toEqual(['Cancel', 'Detach', 'Delete']);
    expect(dialogText()).toContain('This location is also used by 2 other mysteries:');
    expect(dialogText()).toContain('Dust Bowl Nights');
    expect(dialogText()).toContain('The Long Drive Home');
    // The mystery being built is not "other".
    expect(dialogText()).not.toContain('The Hollow Choir');
  });

  it('(D2) Detach is offered even when this is the entity’s only mystery', async () => {
    await attachAndSubmit('loc-lonely');

    trashFor('The Diner').click();
    await settle();

    expect(dialogButtons()).toContain('Detach');
  });

  // --- the four bindings §14.2 requires be explicit ---------------------------------------

  it('§14.2(a): passes message="" so the modal cannot render its false default', async () => {
    // `message` still defaults to 'This cannot be undone.' — which is false for a wizard removal,
    // because it is deferred to the next phase submit. This is the trap, asserted rather than
    // trusted to care.
    await attachAndSubmit('loc-existing');

    trashFor('Ferris Mill').click();
    await settle();

    expect(dialogText()).not.toContain('This cannot be undone');
  });

  it('§14.2(b): the A variants leave confirmLabel unset; B and C set it, so the title still says Remove', async () => {
    store.attachLocation('loc-existing');
    await settle();
    trashFor('Ferris Mill').click();
    await settle();
    expect(dialogText()).toContain('Remove "Ferris Mill"?');
    expect(dialogButtons().at(-1)).toBe('Remove');

    element.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click();
    await settle();

    await attachAndSubmit('loc-lonely');
    trashFor('The Diner').click();
    await settle();

    expect(dialogText()).toContain('Remove "The Diner"?');
    expect(dialogButtons().at(-1)).toBe('Delete');
  });

  it('G2: the deferral clause names the button the user is actually looking at', async () => {
    await attachAndSubmit('loc-lonely');

    trashFor('The Diner').click();
    await settle();
    expect(dialogText()).toContain('the change takes effect when you continue to the next step.');
    expect(dialogText()).not.toContain('press Finish');

    element.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click();
    await settle();

    // Same dialog, last phase. Bystanders is `lastPhaseIndex` and its control reads Finish.
    store.currentPhase.set(store.lastPhaseIndex);
    store.currentPhase.set(2);
    await settle();

    // Drive the branch through the store rather than navigating, so the assertion is about the
    // derived clause and not about the bystander phase's markup.
    expect(store.deferredChangeTail()).toBe('when you continue to the next step');
    store.currentPhase.set(store.lastPhaseIndex);
    expect(store.deferredChangeTail()).toBe('when you press Finish');
  });

  // --- what the buttons do ---------------------------------------------------------------

  it('D4: Cancel records nothing and leaves the card alone', async () => {
    await attachAndSubmit('loc-existing');

    trashFor('Ferris Mill').click();
    await settle();
    element.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click();
    await settle();

    expect(dialog()).toBeNull();
    expect(store.locations()).toHaveLength(1);
    expect(store.pendingRemovals()).toEqual([]);
  });

  it('records a delete from the destructive button and a detach from the secondary one', async () => {
    await attachAndSubmit('loc-existing');

    trashFor('Ferris Mill').click();
    await settle();
    Array.from(dialog()!.querySelectorAll('button')).at(-1)!.click();
    await settle();

    expect(store.pendingRemovals()).toEqual([{ collection: 'locations', id: 'loc-existing', action: 'delete' }]);

    store.attachLocation('loc-existing');
    await settle();
    trashFor('Ferris Mill').click();
    await settle();
    Array.from(dialog()!.querySelectorAll('button'))[1].click();
    await settle();

    expect(store.pendingRemovals()).toEqual([{ collection: 'locations', id: 'loc-existing', action: 'detach' }]);
  });

  it('(A2) both buttons are a local discard — the destructive one records nothing', async () => {
    store.attachLocation('loc-existing');
    await settle();

    trashFor('Ferris Mill').click();
    await settle();
    Array.from(dialog()!.querySelectorAll('button')).at(-1)!.click();
    await settle();

    expect(store.locations()).toEqual([]);
    expect(store.pendingRemovals()).toEqual([]);
  });

  // --- Escape nesting, first exercised here (§8.7) -----------------------------------------

  it('takes two Escape presses to close an open attach select and then the dialog, never one', async () => {
    await attachAndSubmit('loc-existing');

    trashFor('Ferris Mill').click();
    await settle();
    expect(dialog()).toBeTruthy();

    // A select and a dialog on one screen — which Phase 4 is the first thing in the wizard to do.
    const trigger = element.querySelector<HTMLButtonElement>('#attach-location .custom-select__trigger')!;
    trigger.click();
    await settle();
    expect(element.querySelector('#attach-location .custom-select__panel')).toBeTruthy();

    const press = (): void => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };

    press();
    expect(element.querySelector('#attach-location .custom-select__panel')).toBeNull();
    expect(dialog()).toBeTruthy();

    press();
    expect(dialog()).toBeNull();
  });

  it('closes the dialog on the first Escape when no dropdown is open', async () => {
    await attachAndSubmit('loc-existing');

    trashFor('Ferris Mill').click();
    await settle();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(dialog()).toBeNull();
    expect(store.locations()).toHaveLength(1);
  });

  // --- focus (§8 items 1 and 6, §14.2c) ----------------------------------------------------

  it('moves focus to the composer heading when the pencil pulls a card in', async () => {
    store.attachLocation('loc-existing');
    await settle();

    const pencil = element.querySelector<HTMLButtonElement>('button[aria-label="Edit Ferris Mill"]')!;
    pencil.focus();
    pencil.click();
    await settle();

    expect(element.contains(pencil)).toBe(false);
    const heading = element.querySelector<HTMLElement>('app-mystery-create-locations-phase h4')!;
    expect(document.activeElement).toBe(heading);
    expect(heading.textContent).toContain('Editing');
  });

  it('moves focus to + Add Another Location when the composer collapses', async () => {
    store.attachLocation('loc-existing');
    await settle();

    const pencil = element.querySelector<HTMLButtonElement>('button[aria-label="Edit Ferris Mill"]')!;
    pencil.click();
    await settle();

    const cancel = Array.from(element.querySelectorAll<HTMLButtonElement>('app-mystery-create-locations-phase button')).find(
      (button) => button.textContent?.trim() === 'Cancel',
    )!;
    cancel.click();
    await settle();

    const addAnother = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Add Another Location'),
    )!;
    expect(document.activeElement).toBe(addAnother);
  });

  it('sends focus back into the roster after a confirmed removal', async () => {
    store.attachLocation('loc-existing');
    store.attachLocation('loc-lonely');
    await settle();

    const trash = trashFor('Ferris Mill');
    trash.focus();
    trash.click();
    await settle();

    Array.from(dialog()!.querySelectorAll('button')).at(-1)!.click();
    await settle();

    expect(trash.isConnected).toBe(false);
    expect(document.activeElement).not.toBe(document.body);
    // The order in §2.1 is what makes this a roster control rather than the attach select.
    expect(document.activeElement).toBe(element.querySelector('button[aria-label="Edit The Diner"]'));
  });
});
