import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { BystanderListItemResponse, MysteryListItemResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { BystandersListComponent } from './bystanders-list';

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

function buildBystander(id: string, name: string, mysteryIds: string[]): BystanderListItemResponse {
  return {
    id,
    mysteryIds,
    name,
    description: 'Nervous and helpful.',
    bystanderTypeId: 'bt1',
    bystanderTypeName: 'Witness',
    bystanderTypeMotivation: 'to reveal information',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

const bystanders = [
  buildBystander('b1', 'Sheriff Dalton', ['m1', 'm2']),
  buildBystander('b2', 'Mae Whitlock', []),
  // Carries an id the mystery list cannot resolve — a mystery deleted from another surface since
  // this page loaded. The count must come from the names that resolved, not from this array.
  buildBystander('b3', 'Father Amos', ['m1', 'deleted-elsewhere']),
];

const mysteries = [buildMystery('m1', 'Dust Bowl Nights'), buildMystery('m2', 'The Long Drive Home')];

describe('BystandersListComponent', () => {
  let component: BystandersListComponent;
  let fixture: ComponentFixture<BystandersListComponent>;
  let getMysteries: () => Observable<MysteryListItemResponse[]>;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [BystandersListComponent],
      providers: [
        provideRouter([]),
        {
          provide: BystanderService,
          useValue: { getAll: () => of(bystanders), delete: () => of(undefined as void) },
        },
        { provide: MysteryService, useValue: { getMysteries: () => getMysteries() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BystandersListComponent);
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
    await create();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a bystander card after loading', () => {
    expect(component.bystanders().length).toBe(3);
    expect(component.bystanders()[0].name).toBe('Sheriff Dalton');
    // The mystery lookup has landed too, and must not have re-gated the page.
    expect(component.isLoading()).toBe(false);
  });

  // --- the sweep (§7.4, variant D) ------------------------------------------------------

  it('names every mystery the bystander is used by, and states the count', () => {
    component.requestDelete(bystanders[0]);
    fixture.detectChanges();

    expect(dialog()!.textContent).toContain('Delete "Sheriff Dalton"?');
    expect(dialog()!.textContent).toContain('This bystander is used by 2 mysteries:');
    expect(dialogLists()).toEqual([['Dust Bowl Nights', 'The Long Drive Home']]);
    expect(dialog()!.textContent).toContain(
      'Deleting removes it from those mysteries too. This cannot be undone.',
    );
  });

  it('says so plainly when the bystander is in no mystery, with no empty list', () => {
    component.requestDelete(bystanders[1]);
    fixture.detectChanges();

    expect(dialog()!.textContent).toContain("This bystander isn't used by any mystery.");
    expect(dialogLists()).toEqual([]);
    expect(dialog()!.textContent).toContain('This cannot be undone.');
  });

  it('counts from mysteryIds, and withholds the bullets when an id will not resolve', () => {
    // §15.1 inverts the old rule here. The count is the entity's own `mysteryIds`, which is always
    // available; the names are the part that can be missing. Showing one bullet under "2" would be
    // the count and the list disagreeing, so a partial resolution takes the names-missing wording.
    component.requestDelete(bystanders[2]);
    fixture.detectChanges();

    expect(dialog()!.textContent).toContain("This bystander is used by 2 mysteries. Their names couldn't be loaded.");
    expect(dialog()!.textContent).not.toContain('2 mysteries:');
    expect(dialogLists()).toEqual([]);
  });

  it('says "This cannot be undone." exactly once', () => {
    component.requestDelete(bystanders[1]);
    fixture.detectChanges();

    expect(dialog()!.textContent?.match(/This cannot be undone\./g)).toHaveLength(1);
  });

  it('offers no Detach button — a flat catalogue has no mystery to detach from (§7.5)', () => {
    component.requestDelete(bystanders[0]);
    fixture.detectChanges();

    const labels = Array.from(dialog()!.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Cancel', 'Delete']);
    expect(labels).not.toContain('Detach');
  });

  it('says the check failed when the mystery list could not be loaded, and still lets the delete through', async () => {
    // Two rules at once (§7.7). Never state an unverified zero — but do not go silent either, since
    // once users learn the dialog always reports usage, an absent block reads as "used nowhere"
    // just as a false sentence would, only unfalsifiable. And the confirm stays enabled: a network
    // blip must not block a legitimate delete.
    getMysteries = () => throwError(() => new Error('nope')) as never;
    TestBed.resetTestingModule();
    await create();

    expect(component.bystanders().length).toBe(3);
    expect(component.errorMessage()).toBeNull();

    component.requestDelete(bystanders[0]);
    fixture.detectChanges();

    // §15.1: the count survives a failed lookup, because it comes from the row's own `mysteryIds`.
    // Saying "couldn't check" threw that away and told the user less than the page already knew.
    expect(dialog()!.textContent).toContain("This bystander is used by 2 mysteries. Their names couldn't be loaded.");
    expect(dialog()!.textContent).not.toContain("Couldn't check which mysteries use this bystander.");
    expect(dialog()!.textContent).not.toContain("isn't used by any mystery");
    expect(dialogLists()).toEqual([]);
    expect(dialog()!.textContent).toContain('This cannot be undone.');

    const confirm = Array.from(dialog()!.querySelectorAll('button')).at(-1) as HTMLButtonElement;
    expect(confirm.textContent?.trim()).toBe('Delete');
    expect(confirm.disabled).toBe(false);
  });

  it('renders the list without waiting for the mystery lookup, which is disclosure data only', async () => {
    // The two loads are deliberately not a `forkJoin`: gating `isLoading` on the mystery list lets a
    // slow `/api/mysteries` delay the bystanders themselves.
    const mysteriesLater = new Subject<MysteryListItemResponse[]>();
    getMysteries = () => mysteriesLater.asObservable();
    TestBed.resetTestingModule();
    await create();

    expect(component.isLoading()).toBe(false);
    expect(component.bystanders().length).toBe(3);

    // Before it arrives the dialog still states the count — only the names are missing.
    component.requestDelete(bystanders[0]);
    fixture.detectChanges();
    expect(dialog()!.textContent).toContain("This bystander is used by 2 mysteries. Their names couldn't be loaded.");

    component.onDeleteCancelled();
    mysteriesLater.next(mysteries);
    fixture.detectChanges();

    // And once it lands, the usage block fills in.
    component.requestDelete(bystanders[0]);
    fixture.detectChanges();
    expect(dialog()!.textContent).toContain('This bystander is used by 2 mysteries:');
  });

  it('removes the row on a confirmed delete', () => {
    component.requestDelete(bystanders[0]);
    component.onDeleteConfirmed();
    fixture.detectChanges();

    expect(component.bystanders().map((b: { id: string }) => b.id)).toEqual(['b2', 'b3']);
    expect(dialog()).toBeNull();
  });
});
