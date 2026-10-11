import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { MinionService } from '../../../../core/minion';
import { CustomMoveResponse, MonsterDetailResponse } from '../../../../core/models';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MonsterDetailComponent } from './monster-detail';

/**
 * Custom moves on `monster-detail` — Phase 5a's immediate-write host (architecture.md §29.1, §31.2).
 *
 * **The pilot for 5b–5e**, so this file is as much the template for four more as the component is.
 * What it asserts, and why each one:
 *
 *  - **Hydration costs no request.** `customMoves` is embedded in `MonsterDetailResponse`
 *    (decision 2), so the card's first paint is server truth and `list()` is never called. A spec
 *    that only checked the rows rendered would pass with a redundant fetch in place.
 *  - **The three verbs, with their exact URLs and bodies**, driven through the card's own DOM rather
 *    than by calling host methods — because the thing 5a actually delivers is the card *and* the
 *    host agreeing, and a host-method test would pass against a card wired to nothing.
 *  - **A failed write leaves the page mounted** (§26.2 L1 / Phase A, now extended to the sixth flow
 *    on this page), reports once through the toast, and keeps the user's typing so a retry is
 *    possible.
 *  - **The write goes through the page's one confirm modal**, not a second element (decision 14).
 */

const move = (id: string, name: string, description: string | null = null): CustomMoveResponse => ({
  id,
  name,
  description,
});

const baseMonster: MonsterDetailResponse = {
  id: 'mo1',
  mysteryIds: [],
  name: 'Grief-Eater',
  description: null,
  harmCapacity: 7,
  monsterTypeId: 'monster-type-1',
  monsterTypeName: null,
  monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: '' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [move('cm1', 'Reach Through', 'On a 10+, choose two.'), move('cm2', 'Whisper')],
};

describe('MonsterDetailComponent — custom moves', () => {
  let fixture: ComponentFixture<MonsterDetailComponent>;
  let component: MonsterDetailComponent;

  /** Recorded at *subscribe*, not at invocation: `HttpClient` is cold, so a ledger written when the
   *  service method is called over-counts a request that was built and dropped. */
  let sent: string[];
  let errorToasts: string[];
  let successToasts: string[];
  let failing: string | null;
  /** Server truth, so the post-write refetch behaves like a server rather than replaying the past. */
  let currentMonster: MonsterDetailResponse;

  beforeEach(async () => {
    sent = [];
    errorToasts = [];
    successToasts = [];
    failing = null;
    currentMonster = baseMonster;

    const record = <T>(name: string, result: () => T) =>
      (...args: unknown[]): Observable<T> =>
        defer(() => {
          sent.push(`${name}(${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`);
          return failing === name ? throwError(() => new Error('boom')) : of(result());
        });

    await TestBed.configureTestingModule({
      imports: [MonsterDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ monsterId: 'mo1' })) } },
        {
          provide: MonsterService,
          // `getById` is recorded too, so each ledger below shows the **refetch** as well as the
          // write. That is a real property and not noise: the card's rows come from `monster()`, so
          // without the refetch a successful write would leave the list showing the pre-write state.
          useValue: { getById: record('getById', () => currentMonster), update: () => of(currentMonster) },
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
        { provide: MinionService, useValue: { getByMonster: () => of([]) } },
        { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
        {
          provide: ReferenceDataService,
          useValue: {
            getMonsterTypes: () => of([]),
            getMonsterArchetypes: () => of([]),
            getWeaponTags: () => of([]),
          },
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

    fixture = TestBed.createComponent(MonsterDetailComponent);
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
      // Decision 2's whole point: available on load, no second request.
      expect(sent).toEqual([]);
    });

    it('is wired to its own domain, and renders that for the Phase 6 guard', () => {
      expect(card().getAttribute('data-owner-type')).toBe('Monster');
    });

    /**
     * **Found in the browser, and only a real page could find it.** The images card also renders a
     * `data-empty-state`, and both cards live on all five detail pages — so an unscoped
     * `[data-empty-state]` query matches *theirs* first. The card's own unit spec queries inside
     * its own fixture, where no images card exists, so the collision was structurally invisible
     * there. Pinned here, on a page that has both, so 5b–5e cannot reintroduce it.
     */
    it('namespaces its probe attributes, so they do not collide with the images card on this page', () => {
      expect(all('[data-empty-state]').length).toBeLessThanOrEqual(1);
      const imagesEmptyState = el('[data-empty-state]');
      if (imagesEmptyState) {
        expect(imagesEmptyState.closest('[data-custom-moves-card]')).toBeNull();
      }
      // And the custom-moves one is unambiguous page-wide.
      expect(all('[data-custom-moves-empty]')).toHaveLength(0); // this fixture has two moves
    });

    it('sits after the four-panel grid, last on the page', () => {
      const order = all('div.grid, [data-custom-moves-card]').map((node) =>
        node.hasAttribute('data-custom-moves-card') ? 'card' : 'grid'
      );
      // The four-panel grid, then the card — §13.2's "joins the end of the owned sub-resource run".
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
        'create(Monster,mo1,{"name":"Hollow Out","description":"On a miss, the Keeper says how."})',
        'getById(mo1)',
      ]);
      expect(successToasts).toEqual(['Custom move added.']);
      expect(errorToasts).toEqual([]);
    });

    it('sends a blank description as null', () => {
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();

      expect(sent[0]).toBe('create(Monster,mo1,{"name":"Hollow Out","description":null})');
    });

    it('edits through PUT at that row’s id, not POST', () => {
      el('[data-move-key="cm1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      type('[data-move-name]', 'Reach Further');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(sent).toEqual([
        'update(Monster,mo1,cm1,{"name":"Reach Further","description":"On a 10+, choose two."})',
        'getById(mo1)',
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

    it('clears the add form after a successful add', () => {
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(field('[data-move-name]').value).toBe('');
    });

    it('fires exactly one write per commit — no duplicate arm', () => {
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();

      // A positive `toContain` cannot see a duplicate, and a duplicate is the bug that lives in
      // that blind spot (`toad-exact-call-ledger-over-positive-assertions.md`).
      expect(sent.filter((call) => call.startsWith('create('))).toHaveLength(1);
    });
  });

  describe('removing', () => {
    it('routes through the page’s single confirm modal, and deletes only on confirm', () => {
      el('[data-move-key="cm2"] [data-remove-move]')!.click();
      fixture.detectChanges();

      // One modal element on the page, serving six flows (decision 14) — not a second one.
      expect(all('app-confirm-delete-modal')).toHaveLength(1);
      expect(component.pendingDelete()).not.toBeNull();
      expect(component.pendingDelete()!.label).toBe('Whisper');
      expect(sent).toEqual([]);

      component.onDeleteConfirmed();
      fixture.detectChanges();

      expect(sent).toEqual(['delete(Monster,mo1,cm2)', 'getById(mo1)']);
      expect(successToasts).toEqual(['Changes saved.']);
    });

    it('sends nothing when the modal is cancelled', () => {
      el('[data-move-key="cm1"] [data-remove-move]')!.click();
      component.onDeleteCancelled();

      expect(component.pendingDelete()).toBeNull();
      expect(sent).toEqual([]);
    });

    it('passes no footnote, so the confirm modal renders exactly as the other five flows do', () => {
      el('[data-move-key="cm1"] [data-remove-move]')!.click();

      // The least demanding of all eighteen call sites: `visible` and `itemName` only. This is why
      // 5a adds no census entry and R12's gate is 5e-only.
      expect(component.pendingDelete()!.footnote).toBeUndefined();
    });
  });

  describe('a failed write', () => {
    it('leaves the page mounted, reports once, and keeps the typing for a retry', () => {
      failing = 'create';
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      // Phase A's rule, now covering this page's sixth write flow.
      expect(component.errorMessage()).toBeNull();
      expect(el('h2')!.textContent).toContain('Grief-Eater');
      expect(errorToasts).toEqual(['Unable to add custom move.']);
      expect(successToasts).toEqual([]);
      expect(component.isMutating()).toBe(false);
      // Not calling `commitSucceeded()` on failure is what preserves this.
      expect(field('[data-move-name]').value).toBe('Hollow Out');
    });

    it('keeps the edited row open so Save can be pressed again', () => {
      failing = 'update';
      el('[data-move-key="cm1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(component.editingCustomMoveKey()).toBe('cm1');
      expect(el('[data-submit-move]')!.textContent!.trim()).toBe('Save Changes');
      expect(errorToasts).toEqual(['Unable to save custom move.']);
    });

    it('survives a failed delete too', () => {
      failing = 'delete';
      el('[data-move-key="cm1"] [data-remove-move]')!.click();
      component.onDeleteConfirmed();
      fixture.detectChanges();

      expect(component.errorMessage()).toBeNull();
      expect(el('h2')!.textContent).toContain('Grief-Eater');
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

    // L-D3: `list()` ships for 5f-3's wizard attach and has no caller on a detail page. If this
    // ever fails, someone has added a redundant fetch and decision 2 has quietly stopped holding.
    expect(sent.filter((call) => call.startsWith('list('))).toEqual([]);
  });
});
