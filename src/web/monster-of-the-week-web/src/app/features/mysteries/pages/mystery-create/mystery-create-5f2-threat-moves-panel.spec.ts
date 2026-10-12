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
import { MysteryCreateStore, createDraftKey } from './mystery-create.store';

/**
 * **5f-2's rendered surface** — the two composer panels, the roster/dossier count lines, and the
 * minion removal modal's promise about what it will take.
 *
 * Its store twin is `mystery-create-5f2-threat-moves.spec.ts`. The split is the shipped one: what
 * the user is shown lives here, what goes on the wire lives there.
 *
 * Two of the assertions below cover sites **neither §26.2 L6's table nor §30.4 lists** — found by
 * deriving the per-owner sites from the four existing siblings rather than from the table:
 *
 * - the **count summaries** (`5f2-C4`), in four places across two templates. A monster whose only
 *   content is two custom moves otherwise reads "Attacks: 0 · Powers: 0 · Armors: 0 · Weaknesses:
 *   0 · Minions: 0" — an empty monster that is not empty.
 * - the minion removal modal's **`[items]`** (`5f2-C5`). That list is a *promise about what the
 *   deletion will take* (§7.7i(3), UX §18.4), so a minion holding only custom moves promised
 *   nothing and took them anyway.
 */
describe('5f-2 — the threat composers’ custom-move panels', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let store: MysteryCreateStore;
  let element: HTMLElement;

  const MONSTER_KEY = 'monster-fixture';

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
        // `CustomMoveService` is root-provided; stubbing `ApiService` keeps it off the network
        // without overriding the service the production code actually resolves.
        { provide: ApiService, useValue: { get: () => of([]), post: () => of({}), put: () => of({}), delete: () => of(undefined) } },
        { provide: NotificationService, useValue: { success: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryCreateComponent);
    store = fixture.debugElement.injector.get(MysteryCreateStore);
    element = fixture.nativeElement as HTMLElement;
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(1);
    store.currentStep.set(0);
    await settle();
  }

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** One roster monster, so the minion step has a parent and renders its composer. */
  const rosterMonster = () => ({
    id: null,
    localKey: MONSTER_KEY,
    name: 'Maestro Vey',
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
  });

  const move = (name: string, description = '') => ({ id: null, localKey: createDraftKey('move'), name, description });

  const monsterPanel = (): HTMLElement | null => element.querySelector('[data-monster-custom-moves]');
  const minionPanel = (): HTMLElement | null => element.querySelector('[data-minion-custom-moves]');

  it('5f2-C1: the monster composer carries a fifth panel, and a move renders as a row', async () => {
    await create();

    expect(monsterPanel()).not.toBeNull();
    expect(monsterPanel()!.textContent).toContain('Custom Moves');
    expect(element.querySelectorAll('[data-monster-custom-move]')).toHaveLength(0);

    store.monsterCustomMoveForm.setValue({ name: 'Conduct the Dead', description: 'Roll +Weird.' });
    store.addMonsterCustomMove();
    store.monsterCustomMoveForm.setValue({ name: 'Walk Through Walls', description: '' });
    store.addMonsterCustomMove();
    await settle();

    const rows = Array.from(element.querySelectorAll('[data-monster-custom-move]'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Conduct the Dead');
    expect(rows[0].textContent).toContain('Roll +Weird.');

    // Removing the **first** row, which is what a positional remove gets wrong.
    (rows[0].querySelector('button') as HTMLButtonElement).click();
    await settle();

    expect(element.querySelectorAll('[data-monster-custom-move]')).toHaveLength(1);
    expect(store.monsterCustomMoves().map((m) => m.name)).toEqual(['Walk Through Walls']);
  });

  it('5f2-C2: each panel matches the shell of its own neighbours, not the other composer’s', async () => {
    await create();
    store.monsterDrafts.set([rosterMonster()]);
    store.currentStep.set(1);
    store.startNewMinionDraft();
    await settle();

    expect(minionPanel()).not.toBeNull();

    // §13.5.3's "match the local neighbour, not the other composer": the monster composer's four
    // panels are bordered, the minion composer's are `bg-surface-sunken` with no border. Asserted
    // as a *contrast*, so a copy-paste that gave both the same shell fails here.
    const minionClasses = minionPanel()!.className;
    expect(minionClasses).toContain('bg-surface-sunken');
    expect(minionClasses).not.toContain('border-default');

    store.currentStep.set(0);
    await settle();
    const monsterClasses = monsterPanel()!.className;
    expect(monsterClasses).toContain('border-default');
    expect(monsterClasses).not.toContain('bg-surface-sunken');
  });

  it('5f2-C3: the dossier shows the composer’s moves, for both owners', async () => {
    await create();

    // A name is needed for the dossier's composer entry to render at all; the *preview omission*
    // this guards is covered non-vacuously in the store spec, which can hold a move and nothing else.
    store.monsterForm.patchValue({ name: 'Maestro Vey' });
    store.monsterCustomMoveForm.setValue({ name: 'Conduct the Dead', description: 'Roll +Weird.' });
    store.addMonsterCustomMove();
    await settle();

    const monsterList = element.querySelector('[data-dossier-monster-custom-moves]');
    expect(monsterList).not.toBeNull();
    expect(monsterList!.textContent).toContain('Conduct the Dead');
    expect(monsterList!.textContent).toContain('Roll +Weird.');

    store.monsterDrafts.set([rosterMonster()]);
    store.currentStep.set(1);
    store.startNewMinionDraft();
    store.minionForm.patchValue({ name: 'Choir Thrall' });
    store.minionCustomMoveForm.setValue({ name: 'Join the Chorus', description: '' });
    store.addMinionCustomMove();
    await settle();

    const minionList = element.querySelector('[data-dossier-minion-custom-moves]');
    expect(minionList).not.toBeNull();
    expect(minionList!.textContent).toContain('Join the Chorus');
  });

  it('5f2-C4: the roster card counts the moves — a site the twelve-row table does not list', async () => {
    await create();
    store.monsterDrafts.set([{ ...rosterMonster(), customMoves: [move('Conduct the Dead'), move('Walk Through Walls')] }]);
    await settle();

    // §17.2: every count on the card comes from the draft's own collections. A monster whose only
    // content is two custom moves otherwise reads as an entirely empty monster.
    const card = element.querySelector('.roster-card');
    expect(card).not.toBeNull();
    expect(card!.textContent?.replace(/\s+/g, ' ')).toContain('Moves: 2');

    // The dossier's roster entry carries the same line, from the same source.
    const dossierEntry = element.querySelector('app-mystery-create-dossier');
    expect(dossierEntry!.textContent?.replace(/\s+/g, ' ')).toContain('Moves: 2');
  });

  it('5f2-C5: the minion removal modal names the custom moves it will take with it', async () => {
    await create();
    store.monsterDrafts.set([rosterMonster()]);
    store.minionDrafts.set([
      {
        id: null,
        localKey: createDraftKey('minion'),
        monsterKey: MONSTER_KEY,
        existingMonsterId: null,
        name: 'Choir Thrall',
        description: '',
        harmCapacity: 3,
        minionTypeId: 'minion-type-1',
        attacks: [],
        powers: [],
        weaknesses: [],
        armors: [],
        // **Only** custom moves, so the list cannot be right by accident.
        customMoves: [move('Join the Chorus'), move('Keen')],
        existingAttacks: [],
        existingPowers: [],
        existingWeaknesses: [],
        existingArmors: [],
        existingCustomMoves: [],
      },
    ]);
    store.currentStep.set(1);
    await settle();

    const trash = Array.from(element.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Remove Choir Thrall',
    ) as HTMLButtonElement;
    expect(trash).toBeDefined();
    trash.click();
    await settle();

    const dialog = element.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // `[items]` is a promise, not a summary. "2 custom moves" has to be in it or the modal
    // under-promises and the deletion over-delivers.
    expect(dialog!.textContent).toContain('2 custom moves');
  });

  it('5f2-C5: and one move is singular, because the list is read as a sentence', async () => {
    await create();
    store.monsterDrafts.set([rosterMonster()]);
    store.minionDrafts.set([
      {
        id: null,
        localKey: createDraftKey('minion'),
        monsterKey: MONSTER_KEY,
        existingMonsterId: null,
        name: 'Choir Thrall',
        description: '',
        harmCapacity: 3,
        minionTypeId: 'minion-type-1',
        attacks: [],
        powers: [],
        weaknesses: [],
        armors: [],
        customMoves: [move('Join the Chorus')],
        existingAttacks: [],
        existingPowers: [],
        existingWeaknesses: [],
        existingArmors: [],
        existingCustomMoves: [],
      },
    ]);
    store.currentStep.set(1);
    await settle();

    (Array.from(element.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Remove Choir Thrall',
    ) as HTMLButtonElement).click();
    await settle();

    expect(element.querySelector('[role="dialog"]')!.textContent).toContain('1 custom move');
  });
});
