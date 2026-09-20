import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MonsterListItemResponse, MysteryListItemResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { MonstersListComponent } from './monsters-list';

function buildMystery(id: string, name: string): MysteryListItemResponse {
  return {
    id,
    name,
    concept: null,
    hook: null,
    adventureType: { id: 'adv-1', name: 'Haunting', description: '' },
    monsterCount: 0,
    locationCount: 0,
    bystanderCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function buildMonster(id: string, name: string, mysteryIds: string[]): MonsterListItemResponse {
  return {
    id,
    mysteryIds,
    name,
    description: 'Tall and quiet.',
    harmCapacity: 6,
    monsterType: { id: 'mt1', name: 'Beast', motivation: 'to hunt' },
    monsterArchetype: { id: 'ma1', name: 'Ghost', description: 'a restless dead' },
    attackCount: 1,
    powerCount: 1,
    armorCount: 0,
    weaknessCount: 1,
    minionCount: 2,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

const monsters = [
  buildMonster('mo1', 'The Hollow Man', ['m1']),
  buildMonster('mo2', 'The Quiet Thing', []),
];

const mysteries = [buildMystery('m1', 'Dust Bowl Nights'), buildMystery('m2', 'The Long Drive Home')];

describe('MonstersListComponent', () => {
  let component: MonstersListComponent;
  let fixture: ComponentFixture<MonstersListComponent>;
  let getMysteries: () => Observable<MysteryListItemResponse[]>;
  let minions: { name: string }[];

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MonstersListComponent],
      providers: [
        provideRouter([]),
        {
          provide: MonsterService,
          useValue: { getAll: () => of(monsters), delete: () => of(undefined as void) },
        },
        { provide: MinionService, useValue: { getByMonster: () => of(minions) } },
        { provide: MysteryService, useValue: { getMysteries: () => getMysteries() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MonstersListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLElement | null => element().querySelector<HTMLElement>('[role="dialog"]');
  const dialogLists = (): string[][] =>
    Array.from(dialog()!.querySelectorAll('ul')).map((list) =>
      Array.from(list.querySelectorAll('li')).map((item) => item.textContent?.trim() ?? ''),
    );

  beforeEach(async () => {
    getMysteries = () => of(mysteries);
    minions = [{ name: 'Grave-Wight' }, { name: 'Pale Choir' }];
    await create();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders monster cards after loading', () => {
    expect(component.monsters().map((m) => m.name)).toEqual(['The Hollow Man', 'The Quiet Thing']);
    // The mystery lookup has landed too, and must not have re-gated the page.
    expect(component.isLoading()).toBe(false);
  });

  // --- the sweep (§7.4, variant D) ------------------------------------------------------

  it('shows the usage list above the minion cascade, as two separate lists', () => {
    // Two questions, two lists (§7.1): where is this used, and what is destroyed with it. The
    // cascade already shipped here and must not be displaced by the new block.
    component.requestDelete(monsters[0]);
    fixture.detectChanges();

    expect(dialog()!.textContent).toContain('This monster is used by 1 mystery:');
    expect(dialog()!.textContent).toContain('This will also delete the following minions:');
    expect(dialogLists()).toEqual([['Dust Bowl Nights'], ['Grave-Wight', 'Pale Choir']]);
  });

  it('keeps the shipped minion cascade intact for a monster in no mystery', () => {
    component.requestDelete(monsters[1]);
    fixture.detectChanges();

    expect(dialog()!.textContent).toContain("This monster isn't used by any mystery.");
    expect(dialogLists()).toEqual([['Grave-Wight', 'Pale Choir']]);
  });

  it('shows no list at all for a monster with neither mysteries nor minions', async () => {
    minions = [];
    TestBed.resetTestingModule();
    await create();

    component.requestDelete(monsters[1]);
    fixture.detectChanges();

    expect(dialogLists()).toEqual([]);
    expect(dialog()!.textContent).toContain('This cannot be undone.');
    expect(dialog()!.textContent?.match(/This cannot be undone\./g)).toHaveLength(1);
  });

  it('offers no Detach button — a flat catalogue has no mystery to detach from (§7.5)', () => {
    component.requestDelete(monsters[0]);
    fixture.detectChanges();

    const labels = Array.from(dialog()!.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Cancel', 'Delete']);
  });

  it('still discloses the minion cascade when the minion lookup fails', () => {
    TestBed.inject(MinionService).getByMonster = () => throwError(() => new Error('nope'));

    component.requestDelete(monsters[0]);
    fixture.detectChanges();

    expect(component.isLoadingMinions()).toBe(false);
    expect(dialog()!.textContent).toContain('This monster is used by 1 mystery:');
    expect(dialogLists()).toEqual([['Dust Bowl Nights']]);
  });

  it('says the check failed when the mystery list could not be loaded, and still lets the delete through', async () => {
    // §7.7: never state an unverified zero, and do not go silent either — an absent block reads as
    // "used nowhere" just as a false sentence would.
    getMysteries = () => throwError(() => new Error('nope')) as never;
    TestBed.resetTestingModule();
    await create();

    expect(component.monsters().length).toBe(2);
    expect(component.errorMessage()).toBeNull();

    component.requestDelete(monsters[0]);
    fixture.detectChanges();

    expect(dialog()!.textContent).toContain("Couldn't check which mysteries use this monster.");
    expect(dialog()!.textContent).not.toContain('is used by');
    // The cascade half is unaffected by a mystery-lookup failure.
    expect(dialogLists()).toEqual([['Grave-Wight', 'Pale Choir']]);

    const confirm = Array.from(dialog()!.querySelectorAll('button')).at(-1) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
  });

  it('renders the list without waiting for the mystery lookup, which is disclosure data only', async () => {
    const mysteriesLater = new Subject<MysteryListItemResponse[]>();
    getMysteries = () => mysteriesLater.asObservable();
    TestBed.resetTestingModule();
    await create();

    expect(component.isLoading()).toBe(false);
    expect(component.monsters().length).toBe(2);

    component.requestDelete(monsters[0]);
    fixture.detectChanges();
    expect(dialog()!.textContent).toContain("Couldn't check which mysteries use this monster.");
    // The minion cascade does not wait on the mystery list either.
    expect(dialogLists()).toEqual([['Grave-Wight', 'Pale Choir']]);

    component.onDeleteCancelled();
    mysteriesLater.next(mysteries);
    fixture.detectChanges();

    component.requestDelete(monsters[0]);
    fixture.detectChanges();
    expect(dialog()!.textContent).toContain('This monster is used by 1 mystery:');
  });

  it('removes the row on a confirmed delete', () => {
    component.requestDelete(monsters[0]);
    component.onDeleteConfirmed();
    fixture.detectChanges();

    expect(component.monsters().map((m) => m.id)).toEqual(['mo2']);
    expect(dialog()).toBeNull();
  });
});
