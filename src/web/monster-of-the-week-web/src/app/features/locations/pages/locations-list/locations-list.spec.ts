import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { LocationService } from '../../../../core/location';
import { LocationListItemResponse, MysteryListItemResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { LocationsListComponent } from './locations-list';

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

function buildLocation(id: string, name: string, mysteryIds: string[]): LocationListItemResponse {
  return {
    id,
    mysteryIds,
    name,
    description: 'Creaky and ominous.',
    locationTypeId: 'lt1',
    locationTypeName: 'Hub',
    locationTypeMotivation: 'to be a crossroads',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

const locations = [
  buildLocation('l1', 'The Old Mill', ['m1', 'm2']),
  buildLocation('l2', 'The Diner', []),
  // Carries an id the mystery list cannot resolve — a mystery deleted from another surface since
  // this page loaded. The count must come from the names that resolved, not from this array.
  buildLocation('l3', 'The Chapel', ['m1', 'deleted-elsewhere']),
];

const mysteries = [buildMystery('m1', 'Dust Bowl Nights'), buildMystery('m2', 'The Long Drive Home')];

describe('LocationsListComponent', () => {
  let component: LocationsListComponent;
  let fixture: ComponentFixture<LocationsListComponent>;
  let getMysteries: () => Observable<MysteryListItemResponse[]>;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [LocationsListComponent],
      providers: [
        provideRouter([]),
        {
          provide: LocationService,
          useValue: { getAll: () => of(locations), delete: () => of(undefined as void) },
        },
        { provide: MysteryService, useValue: { getMysteries: () => getMysteries() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationsListComponent);
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

  /**
   * The shared narrow-viewport row treatment (docs/resource-images/design.md §4.2). Asserted as
   * classes, not geometry: jsdom resolves no media queries, so the rendered breakpoint behaviour is
   * measured on the dev server instead.
   */
  describe("narrow-viewport row treatment", () => {
    it("lets each row shrink below its content width", () => {
      // The `<ul>` is a grid, so without `min-w-0` here the row claims its min-content width and
      // overflows its track, pushing the delete action off-screen on a phone.
      const rows = Array.from(element().querySelectorAll("li"));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.classList).toContain("min-w-0");
      }
    });

    it("clamps the description to two lines below lg and releases it from desktop up", () => {
      // Selected structurally, not by its text: the description is the row's `my-1` paragraph.
      const descriptions = Array.from(element().querySelectorAll('li p')).filter((p) =>
        p.classList.contains('my-1'),
      );
      expect(descriptions.length).toBeGreaterThan(0);
      for (const description of descriptions) {
        expect(description.classList).toContain("line-clamp-2");
        expect(description.classList).toContain("lg:line-clamp-none");
        // `line-clamp-*` carries its own display; a co-occurring display utility kills it.
        for (const conflicting of ["block", "truncate"]) {
          expect(description.classList).not.toContain(conflicting);
        }
      }
    });
  });

  beforeEach(async () => {
    getMysteries = () => of(mysteries);
    await create();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a location card after loading', () => {
    expect(component.locations().length).toBe(3);
    expect(component.locations()[0].name).toBe('The Old Mill');
    // The mystery lookup has landed too, and must not have re-gated the page.
    expect(component.isLoading()).toBe(false);
  });

  // --- the sweep (§7.4, variant D) ------------------------------------------------------

  it('names every mystery the location is used by, and states the count', () => {
    component.requestDelete(locations[0]);
    fixture.detectChanges();

    expect(dialog()!.textContent).toContain('Delete "The Old Mill"?');
    expect(dialog()!.textContent).toContain('This location is used by 2 mysteries:');
    expect(dialogLists()).toEqual([['Dust Bowl Nights', 'The Long Drive Home']]);
    expect(dialog()!.textContent).toContain(
      'Deleting removes it from those mysteries too. This cannot be undone.',
    );
  });

  it('says so plainly when the location is in no mystery, with no empty list', () => {
    component.requestDelete(locations[1]);
    fixture.detectChanges();

    expect(dialog()!.textContent).toContain("This location isn't used by any mystery.");
    expect(dialogLists()).toEqual([]);
    expect(dialog()!.textContent).toContain('This cannot be undone.');
  });

  it('counts from mysteryIds, and withholds the bullets when an id will not resolve', () => {
    // §15.1 inverts the old rule here. The count is the entity's own `mysteryIds`, which is always
    // available; the names are the part that can be missing. Showing one bullet under "2" would be
    // the count and the list disagreeing, so a partial resolution takes the names-missing wording.
    component.requestDelete(locations[2]);
    fixture.detectChanges();

    expect(dialog()!.textContent).toContain("This location is used by 2 mysteries. Their names couldn't be loaded.");
    expect(dialog()!.textContent).not.toContain('2 mysteries:');
    expect(dialogLists()).toEqual([]);
  });

  it('says "This cannot be undone." exactly once', () => {
    component.requestDelete(locations[1]);
    fixture.detectChanges();

    expect(dialog()!.textContent?.match(/This cannot be undone\./g)).toHaveLength(1);
  });

  it('offers no Detach button — a flat catalogue has no mystery to detach from (§7.5)', () => {
    component.requestDelete(locations[0]);
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

    expect(component.locations().length).toBe(3);
    expect(component.errorMessage()).toBeNull();

    component.requestDelete(locations[0]);
    fixture.detectChanges();

    // §15.1: the count survives a failed lookup, because it comes from the row's own `mysteryIds`.
    // Saying "couldn't check" threw that away and told the user less than the page already knew.
    expect(dialog()!.textContent).toContain("This location is used by 2 mysteries. Their names couldn't be loaded.");
    expect(dialog()!.textContent).not.toContain("Couldn't check which mysteries use this location.");
    expect(dialog()!.textContent).not.toContain("isn't used by any mystery");
    expect(dialogLists()).toEqual([]);
    expect(dialog()!.textContent).toContain('This cannot be undone.');

    const confirm = Array.from(dialog()!.querySelectorAll('button')).at(-1) as HTMLButtonElement;
    expect(confirm.textContent?.trim()).toBe('Delete');
    expect(confirm.disabled).toBe(false);
  });

  it('renders the list without waiting for the mystery lookup, which is disclosure data only', async () => {
    // The two loads are deliberately not a `forkJoin`: gating `isLoading` on the mystery list lets a
    // slow `/api/mysteries` delay the locations themselves.
    const mysteriesLater = new Subject<MysteryListItemResponse[]>();
    getMysteries = () => mysteriesLater.asObservable();
    TestBed.resetTestingModule();
    await create();

    expect(component.isLoading()).toBe(false);
    expect(component.locations().length).toBe(3);

    // Before it arrives the dialog still states the count — only the names are missing.
    component.requestDelete(locations[0]);
    fixture.detectChanges();
    expect(dialog()!.textContent).toContain("This location is used by 2 mysteries. Their names couldn't be loaded.");

    component.onDeleteCancelled();
    mysteriesLater.next(mysteries);
    fixture.detectChanges();

    // And once it lands, the usage block fills in.
    component.requestDelete(locations[0]);
    fixture.detectChanges();
    expect(dialog()!.textContent).toContain('This location is used by 2 mysteries:');
  });

  it('removes the row on a confirmed delete', () => {
    component.requestDelete(locations[0]);
    component.onDeleteConfirmed();
    fixture.detectChanges();

    expect(component.locations().map((l) => l.id)).toEqual(['l2', 'l3']);
    expect(dialog()).toBeNull();
  });
});
