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
 * **5f-3a's rendered surface**, and `5f3a-P2` is the one that matters.
 *
 * §35.1 splits 5f-3 on a falsifier: *decline the split if an attached record's panel cannot be
 * rendered honestly without the fetch* — if it cannot be made clear that existing moves are not
 * shown, rather than implying the record has none. The split was taken, so the panel has to carry
 * that, and `5f3a-P2` is where it is checked. It is asserted as a **contrast**: the caveat appears
 * for a row that arrived un-fetched and is absent for one the wizard authored, because a line that
 * always shows says nothing.
 */
describe('5f-3a — the flat composers’ custom-move panels', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let store: MysteryCreateStore;
  let element: HTMLElement;

  const CATALOGUE_LOCATION = {
    id: 'loc-a',
    mysteryIds: [],
    name: 'Ferris Mill',
    description: 'Rust and river damp.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MysteryCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([]),
            getMonsterTypes: () => of([]),
            getMinionTypes: () => of([]),
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
            getMysteries: () => of([{ id: 'mystery-1', name: 'The Hollow Choir' }]),
          },
        },
        { provide: MonsterService, useValue: { getAll: () => of([]) } },
        { provide: MinionService, useValue: {} },
        { provide: LocationService, useValue: { getAll: () => of([CATALOGUE_LOCATION]) } },
        { provide: BystanderService, useValue: { getAll: () => of([]) } },
        { provide: ApiService, useValue: { get: () => of([]), post: () => of({}), put: () => of({}), delete: () => of(undefined) } },
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

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const panel = (): HTMLElement | null => element.querySelector('[data-location-custom-moves]');
  const caveat = (): HTMLElement | null => element.querySelector('[data-location-custom-moves-partial]');
  const rows = (): HTMLElement[] => Array.from(element.querySelectorAll('[data-location-custom-move]'));

  const addMove = async (name: string, description = ''): Promise<void> => {
    store.locationCustomMoveForm.setValue({ name, description });
    store.addLocationCustomMove();
    await settle();
  };

  it('5f3a-P1: both composers carry a panel, each in its own composer’s shell', async () => {
    await create();

    expect(panel()).not.toBeNull();
    expect(panel()!.textContent).toContain('Custom Moves');
    // Bordered, like the composer card it sits in — not the minion composer's sunken shell.
    expect(panel()!.className).toContain('border-default');
    expect(panel()!.className).not.toContain('bg-surface-sunken');

    store.currentPhase.set(3);
    await settle();
    const bystanderPanel = element.querySelector('[data-bystander-custom-moves]');
    expect(bystanderPanel).not.toBeNull();
    expect(bystanderPanel!.className).toContain('border-default');
  });

  it('5f3a-P2: the caveat shows for an attached row and not for one the wizard authored', async () => {
    await create();

    // A new draft: the wizard knows its moves, because there are none it could be missing.
    expect(caveat()).toBeNull();
    expect(element.querySelector('[data-location-custom-moves-empty]')).not.toBeNull();

    store.attachLocation('loc-a');
    store.editLocationDraft(store.locations()[0].localKey);
    await settle();

    // **The falsifier, answered.** The panel does not say "no custom moves"; it says it cannot see
    // them and that anything added joins them. That is honest with no fetch, which is what makes
    // 5f-3a shippable on its own.
    expect(caveat()).not.toBeNull();
    expect(caveat()!.textContent).toContain("aren't shown here");
    expect(caveat()!.textContent).toContain('added to them');
    // And the empty state stands down, because "none" would be the claim it cannot make.
    expect(element.querySelector('[data-location-custom-moves-empty]')).toBeNull();
  });

  it('5f3a-P3: a row renders with its description, and the × removes the row it belongs to', async () => {
    await create();
    await addMove('Mind the Floorboards', 'Roll +Cool or the floor gives.');
    await addMove('The Mill Remembers');

    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('Mind the Floorboards');
    expect(rows()[0].textContent).toContain('Roll +Cool or the floor gives.');

    (rows()[0].querySelector('button') as HTMLButtonElement).click();
    await settle();

    expect(rows()).toHaveLength(1);
    expect(store.locationCustomMoves().map((m) => m.name)).toEqual(['The Mill Remembers']);
  });

  it('5f3a-P4: a fresh composer shows the panel empty — asserted with the panel on screen', async () => {
    await create();
    await addMove('Mind the Floorboards');
    store.addLocationForm.setValue({ name: 'The Old Mill', description: '', locationTypeId: 'location-type-1' });
    store.saveLocationDraft();
    await settle();

    // **Saving collapses the composer**, so `rows().length === 0` here would be vacuous — it would
    // be counting an absent container. 5f-2 made exactly that mistake one domain over. Reopen first.
    expect(panel()).toBeNull();

    store.startNewLocationDraft();
    await settle();

    expect(panel()).not.toBeNull();
    expect(rows()).toHaveLength(0);
    expect(store.locationCustomMoveForm.controls.name.value).toBe('');
  });

  it('5f3a-P5: the removal modal names typed moves, and only for a draft that has not been saved', async () => {
    await create();
    await addMove('Mind the Floorboards');
    await addMove('The Mill Remembers');
    store.addLocationForm.setValue({ name: 'The Old Mill', description: '', locationTypeId: 'location-type-1' });
    store.saveLocationDraft();
    await settle();

    const trash = Array.from(element.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Remove The Old Mill',
    ) as HTMLButtonElement;
    trash.click();
    await settle();

    expect(element.querySelector('[role="dialog"]')!.textContent).toContain('2 custom moves');

    // An **attached** row is the opposite case: Detach deletes nothing, and the wizard has not even
    // seen the server's moves — so the sentence would be false twice over.
    (element.querySelector('[role="dialog"]') as HTMLElement)
      .querySelectorAll('button')
      .forEach((b) => { if (b.textContent?.trim() === 'Cancel') { b.click(); } });
    await settle();

    store.attachLocation('loc-a');
    await settle();
    const attachedTrash = Array.from(element.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Remove Ferris Mill',
    ) as HTMLButtonElement;
    attachedTrash.click();
    await settle();

    expect(element.querySelector('[role="dialog"]')!.textContent).not.toContain('custom move');
  });

  it('5f3a-P6: the dossier counts a location’s moves — 14-R10’s silent omission', async () => {
    await create();
    await addMove('Mind the Floorboards');
    store.addLocationForm.setValue({ name: 'The Old Mill', description: '', locationTypeId: 'location-type-1' });
    store.saveLocationDraft();
    await settle();

    const dossier = (element.querySelector('app-mystery-create-dossier') as HTMLElement).textContent ?? '';
    expect(dossier.replace(/\s+/g, ' ')).toContain('The Old Mill · 1 move');
  });
});
