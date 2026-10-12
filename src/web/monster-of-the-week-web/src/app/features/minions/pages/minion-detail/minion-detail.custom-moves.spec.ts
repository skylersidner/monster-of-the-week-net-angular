import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { MinionService } from '../../../../core/minion';
import { CustomMoveResponse, MinionDetailResponse } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MinionDetailComponent } from './minion-detail';

/**
 * Custom moves on `minion-detail` — Phase 5b (architecture.md §29.1, §29.3).
 *
 * **The monster twin, with the owner type and the noun changed.** Deliberately the same structure
 * rather than a cleverer one: §29.3 named this file as copy-verbatim, and if Minion had needed a
 * different shape that would have meant the pilot was wrong rather than that Minion is special.
 *
 * Written out rather than `sed`-derived from the monster spec, and that was the right call: a blind
 * rename produced a duplicate `MinionService` import, a `minionArchetype`/`minionTypeId` fixture
 * for fields `MinionDetailResponse` does not have, a `getByMinion` stub for a method that does not
 * exist, and a `MysteryService` provider this page never injects. The 2026-10-06 lesson holds —
 * **a derived spec needs its string literals and its provider list re-checked, not just its
 * identifiers.**
 *
 * The two genuine differences from Monster's fixture, both just this domain's shape:
 *  - a minion belongs to a **monster**, not to mysteries — so there is no `mysteryIds`, no
 *    `MysteryService` and no membership flow anywhere near this;
 *  - its type is a nested `minionType` object rather than an id-plus-name pair.
 */

const move = (id: string, name: string, description: string | null = null): CustomMoveResponse => ({
  id,
  name,
  description,
});

const baseMinion: MinionDetailResponse = {
  id: 'mn1',
  monsterId: 'mo1',
  monsterName: 'The Beast',
  name: 'Rust-Wight',
  description: null,
  harmCapacity: 3,
  minionType: { id: 'mt1', name: 'Torturer', motivation: 'dominate' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [move('cm1', 'Reach Through', 'On a 10+, choose two.'), move('cm2', 'Whisper')],
};

describe('MinionDetailComponent — custom moves', () => {
  let fixture: ComponentFixture<MinionDetailComponent>;
  let component: MinionDetailComponent;

  /** Recorded at *subscribe*: `HttpClient` is cold, so recording at invocation over-counts a
   *  request that was built and dropped. */
  let sent: string[];
  let errorToasts: string[];
  let successToasts: string[];
  let failing: string | null;
  let currentMinion: MinionDetailResponse;

  beforeEach(async () => {
    sent = [];
    errorToasts = [];
    successToasts = [];
    failing = null;
    currentMinion = baseMinion;

    const record = <T>(name: string, result: () => T) =>
      (...args: unknown[]): Observable<T> =>
        defer(() => {
          sent.push(`${name}(${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`);
          return failing === name ? throwError(() => new Error('boom')) : of(result());
        });

    await TestBed.configureTestingModule({
      imports: [MinionDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ minionId: 'mn1' })) } },
        {
          provide: MinionService,
          // `getById` is recorded too, so each ledger shows the refetch as well as the write — the
          // card's rows come from `minion()`, so without it a successful write would leave the list
          // showing pre-write state.
          useValue: { getById: record('getById', () => currentMinion), update: () => of(currentMinion) },
        },
        {
          provide: CustomMoveService,
          useValue: {
            list: record('list', () => []),
            create: record('create', () => move('cm3', 'Added')),
            update: record('update', () => move('cm1', 'Updated')),
            delete: record('delete', () => undefined as unknown as void),
          },
        },
        {
          provide: ReferenceDataService,
          useValue: { getMinionTypes: () => of([]), getWeaponTags: () => of([]) },
        },
        {
          provide: NotificationService,
          useValue: {
            success: (m: string) => successToasts.push(m),
            error: (m: string) => errorToasts.push(m),
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MinionDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    sent.length = 0; // drop the page load; every ledger below is about one interaction
  });

  const el = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  const all = (selector: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));
  const card = () => el('[data-custom-moves-card]')!;
  const field = (selector: string) => el(selector) as HTMLInputElement | HTMLTextAreaElement;

  function type(selector: string, value: string): void {
    const input = field(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  describe('hydration', () => {
    it('renders the embedded customMoves with no request at all', () => {
      expect(all('[data-move-key]').map((li) => li.getAttribute('data-move-key'))).toEqual(['cm1', 'cm2']);
      expect(card().textContent).toContain('Reach Through');
      expect(card().textContent).toContain('On a 10+, choose two.');
      expect(sent).toEqual([]);
    });

    it('is wired to its own domain, and renders that for the Phase 6 guard', () => {
      expect(card().getAttribute('data-owner-type')).toBe('Minion');
    });

    it('namespaces its probe attributes, so they do not collide with the images card', () => {
      // The collision §28.1 item 2 records: both cards are on this page too.
      const imagesEmptyState = el('[data-empty-state]');
      if (imagesEmptyState) {
        expect(imagesEmptyState.closest('[data-custom-moves-card]')).toBeNull();
      }
      expect(all('[data-custom-moves-empty]')).toHaveLength(0); // this fixture has two moves
    });

    it('sits after the four-panel grid, last on the page', () => {
      const order = all('div.grid, [data-custom-moves-card]').map((node) =>
        node.hasAttribute('data-custom-moves-card') ? 'card' : 'grid'
      );
      expect(order[order.length - 1]).toBe('card');
    });
  });

  describe('writing', () => {
    it('adds through POST with the trimmed body, then refetches and reports', () => {
      type('[data-move-name]', '  Hollow Out  ');
      type('[data-move-description]', '  On a miss, the Keeper says how.  ');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(sent).toEqual([
        'create(Minion,mn1,{"name":"Hollow Out","description":"On a miss, the Keeper says how."})',
        'getById(mn1)',
      ]);
      expect(successToasts).toEqual(['Custom move added.']);
      expect(errorToasts).toEqual([]);
    });

    it('sends a blank description as null', () => {
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();

      expect(sent[0]).toBe('create(Minion,mn1,{"name":"Hollow Out","description":null})');
    });

    it('edits through PUT at that row’s id, not POST', () => {
      el('[data-move-key="cm1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      type('[data-move-name]', 'Reach Further');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(sent).toEqual([
        'update(Minion,mn1,cm1,{"name":"Reach Further","description":"On a 10+, choose two."})',
        'getById(mn1)',
      ]);
      expect(successToasts).toEqual(['Custom move saved.']);
    });

    it('returns the card to its add state after a successful edit', () => {
      el('[data-move-key="cm1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(component.editingCustomMoveKey()).toBeNull();
      expect(el('[data-submit-move]')!.textContent!.trim()).toBe('Add Custom Move');
      expect(field('[data-move-name]').value).toBe('');
    });

    it('fires exactly one write per commit — no duplicate arm', () => {
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();

      expect(sent.filter((call) => call.startsWith('create('))).toHaveLength(1);
    });
  });

  describe('removing', () => {
    it('routes through the page’s single confirm modal, and deletes only on confirm', () => {
      el('[data-move-key="cm2"] [data-remove-move]')!.click();
      fixture.detectChanges();

      expect(all('app-confirm-delete-modal')).toHaveLength(1);
      expect(component.pendingDelete()!.label).toBe('Whisper');
      expect(sent).toEqual([]);

      component.onDeleteConfirmed();
      fixture.detectChanges();

      expect(sent).toEqual(['delete(Minion,mn1,cm2)', 'getById(mn1)']);
    });

    it('sends nothing when the modal is cancelled', () => {
      el('[data-move-key="cm1"] [data-remove-move]')!.click();
      component.onDeleteCancelled();

      expect(component.pendingDelete()).toBeNull();
      expect(sent).toEqual([]);
    });

    it('passes no footnote, so the modal renders exactly as the other five flows do', () => {
      el('[data-move-key="cm1"] [data-remove-move]')!.click();

      expect(component.pendingDelete()!.footnote).toBeUndefined();
    });
  });

  describe('a failed write', () => {
    it('leaves the page mounted, reports once, and keeps the typing for a retry', () => {
      failing = 'create';
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(component.errorMessage()).toBeNull();
      expect(el('h2')!.textContent).toContain('Rust-Wight');
      expect(errorToasts).toEqual(['Unable to add custom move.']);
      expect(successToasts).toEqual([]);
      expect(component.isMutating()).toBe(false);
      expect(field('[data-move-name]').value).toBe('Hollow Out');
    });

    it('keeps the edited row open so Save can be pressed again', () => {
      failing = 'update';
      el('[data-move-key="cm1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(component.editingCustomMoveKey()).toBe('cm1');
      expect(errorToasts).toEqual(['Unable to save custom move.']);
    });

    it('survives a failed delete too', () => {
      failing = 'delete';
      el('[data-move-key="cm1"] [data-remove-move]')!.click();
      component.onDeleteConfirmed();
      fixture.detectChanges();

      expect(component.errorMessage()).toBeNull();
      expect(el('h2')!.textContent).toContain('Rust-Wight');
      expect(errorToasts).toEqual(['Unable to delete custom move.']);
    });
  });

  it('never calls list() — hydration is the detail response, not a fetch', () => {
    type('[data-move-name]', 'Hollow Out');
    el('[data-submit-move]')!.click();
    fixture.detectChanges();
    el('[data-move-key="cm1"] [data-remove-move]')!.click();
    component.onDeleteConfirmed();
    fixture.detectChanges();

    // The guard on decision 2. If this fails, someone added a redundant fetch.
    expect(sent.filter((call) => call.startsWith('list('))).toEqual([]);
  });
});
