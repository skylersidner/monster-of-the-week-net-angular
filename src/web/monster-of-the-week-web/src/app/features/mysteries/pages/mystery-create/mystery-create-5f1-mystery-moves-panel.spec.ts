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
 * **Step `0-4`'s rendered surface — the panel and the dossier entry (5f-1).**
 *
 * The store twin is `mystery-create-5f1-mystery-moves.spec.ts`. The split is the shipped one: what
 * the user is shown lives here, what goes on the wire lives there.
 *
 * **The dossier half is the reason this file exists at all.** 14-R10's argument is that a
 * collection missing from the dossier reads to the user as a collection that did not save — a
 * failure mode with no error, no empty state and nothing on the wire to notice. Nothing else in the
 * suite would catch the entry being dropped from `mystery-create-dossier.html`, because the moves
 * would still save correctly and every request assertion would still pass.
 */
describe('Step 0-4 — the panel and the dossier entry', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let store: MysteryCreateStore;
  let element: HTMLElement;

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
            getLocationTypes: () => of([]),
            getBystanderTypes: () => of([]),
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
        { provide: LocationService, useValue: { getAll: () => of([]) } },
        { provide: BystanderService, useValue: { getAll: () => of([]) } },
        // `CustomMoveService` is root-provided, so stubbing `ApiService` is what keeps it off the
        // network without overriding the service the production code actually resolves.
        { provide: ApiService, useValue: { get: () => of([]), post: () => of({}), put: () => of({}), delete: () => of(undefined) } },
        { provide: NotificationService, useValue: { success: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryCreateComponent);
    store = fixture.debugElement.injector.get(MysteryCreateStore);
    element = fixture.nativeElement as HTMLElement;
    // The dossier's Mystery block renders only once the mystery has a name.
    store.conceptForm.setValue({ name: 'The Hollow Choir', concept: '', adventureTypeId: 'adventure-type-1' });
    store.currentPhase.set(0);
    store.currentStep.set(4);
    await settle();
  }

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const panel = (): HTMLElement | null => element.querySelector('[data-mystery-custom-moves]');
  const rows = (): HTMLElement[] => Array.from(element.querySelectorAll('[data-mystery-custom-move]'));
  const dossierList = (): HTMLElement | null => element.querySelector('[data-dossier-mystery-custom-moves]');

  const addMove = async (name: string, description = ''): Promise<void> => {
    store.mysteryCustomMoveForm.setValue({ name, description });
    store.addMysteryCustomMove();
    await settle();
  };

  it('5f1-P1: the step shows its own empty state, and the panel appears only on step 4', async () => {
    await create();

    expect(panel()).not.toBeNull();
    expect(element.querySelector('[data-mystery-custom-moves-empty]')?.textContent).toContain('No custom moves added yet.');
    expect(rows()).toHaveLength(0);

    // Not copied from the four neighbour panels, which have none — copied from the locations and
    // bystanders *phases*, which do. A step whose only content is an empty list reads as broken.
    store.currentStep.set(3);
    await settle();
    expect(panel()).toBeNull();
  });

  it('5f1-P2: a row shows the name and the description, and the × removes that row by key', async () => {
    await create();
    await addMove('Call the Choir', 'Roll +Weird to summon the dead chorus.');
    await addMove('Read the Hymnal');

    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('Call the Choir');
    expect(rows()[0].textContent).toContain('Roll +Weird to summon the dead chorus.');
    // A description-less row renders no sub-line rather than an empty one.
    expect(rows()[1].textContent).toContain('Read the Hymnal');

    // Removing the **first** row, which is the case a positional remove gets wrong.
    (rows()[0].querySelector('button') as HTMLButtonElement).click();
    await settle();

    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('Read the Hymnal');
    expect(store.mysteryCustomMoves().map((move) => move.name)).toEqual(['Read the Hymnal']);
  });

  it('5f1-P3: the dossier grows a Custom Moves entry — the silent omission 14-R10 names', async () => {
    await create();

    // Nothing authored: no entry at all, rather than an empty heading.
    expect(dossierList()).toBeNull();

    await addMove('Call the Choir', 'Roll +Weird to summon the dead chorus.');
    await addMove('Read the Hymnal');

    const list = dossierList();
    expect(list).not.toBeNull();
    expect(Array.from(list!.querySelectorAll('li')).map((item) => item.textContent?.trim())).toHaveLength(2);
    expect(list!.textContent).toContain('Call the Choir');
    expect(list!.textContent).toContain('Roll +Weird to summon the dead chorus.');
    expect(list!.textContent).toContain('Read the Hymnal');

    // The label, in the Powers block's idiom this copies.
    expect(element.querySelector('.dossier-section')?.textContent).toContain('Custom Moves');
  });

  it('5f1-P4: pressing + Add on a nameless move says so instead of doing nothing', async () => {
    await create();

    // The four neighbour panels mark the form touched and display nothing, so `+ Add` on an empty
    // one is a button that visibly does nothing. Tolerable three levels down inside a composer and
    // not at the top level of a step.
    store.mysteryCustomMoveForm.patchValue({ description: 'Roll +Weird.' });
    store.addMysteryCustomMove();
    await settle();

    expect(rows()).toHaveLength(0);
    expect(panel()?.textContent).toContain('Name is required');
  });
});
