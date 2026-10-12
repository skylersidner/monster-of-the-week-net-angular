import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { CustomMoveService } from '../../../../core/custom-moves';
import { MinionService } from '../../../../core/minion';
import { CustomMoveResponse, MysteryDetailResponse } from '../../../../core/models';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { MysteryDetailComponent } from './mystery-detail';

/**
 * Custom moves on `mystery-detail` — Phase 5e, the fifth and last detail page (architecture.md
 * §4.1, §29.7).
 *
 * **Written out, not derived.** The other four pages are twins of each other; this one is nobody's.
 * It has no form, no images, no membership picker and — until this phase — no write path, no
 * notifications, no modal and no stored route id. A rename from any of the four would have carried
 * all of that.
 *
 * What makes this page worth its own file rather than more of the same:
 *
 *  - **It is the page's first page-local write surface**, so the five additions §26.2 L12 names are
 *    all asserted here, including the two §4.1's original list missed (the stored `mysteryId` and a
 *    refetch that reloads *only* the mystery).
 *  - **The deliberate non-addition is the important one.** This template orders
 *    `@else if (errorMessage())` ahead of its content branch, so a write that set `errorMessage`
 *    would replace the mystery with a red line. The other four pages had that removed in Phase A;
 *    this page never had it, and 5e's job was not to introduce it. R14.
 *  - **It is the only new confirm-modal call site in the whole plan**, so the one-element assertion
 *    here is also the per-page derived half of the census (see that spec's note).
 */

const move = (id: string, name: string, description: string | null = null): CustomMoveResponse => ({
  id,
  name,
  description,
});

const baseMystery: MysteryDetailResponse = {
  id: 'my1',
  name: 'The Hollow Choir',
  concept: 'Something sings under the reservoir.',
  hook: null,
  overview: null,
  notes: null,
  adventureType: { id: 'at1', name: 'Haunting', description: '' },
  countdown: null,
  monsterCount: 0,
  locationCount: 0,
  bystanderCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  customMoves: [move('cm1', 'Reach Through', 'On a 10+, choose two.'), move('cm2', 'Whisper')],
};

describe('MysteryDetailComponent — custom moves', () => {
  let fixture: ComponentFixture<MysteryDetailComponent>;
  let component: MysteryDetailComponent;

  let sent: string[];
  let errorToasts: string[];
  let successToasts: string[];
  let failing: string | null;
  let currentMystery: MysteryDetailResponse;

  beforeEach(async () => {
    sent = [];
    errorToasts = [];
    successToasts = [];
    failing = null;
    currentMystery = baseMystery;

    const record = <T>(name: string, result: () => T) =>
      (...args: unknown[]): Observable<T> =>
        defer(() => {
          sent.push(`${name}(${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`);
          return failing === name ? throwError(() => new Error('boom')) : of(result());
        });

    await TestBed.configureTestingModule({
      imports: [MysteryDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'my1' })) } },
        {
          provide: MysteryService,
          // Recorded, so each ledger shows the refetch — and shows that it is the *mystery* refetch
          // and not the whole four-arm page load.
          useValue: { getMystery: record('getMystery', () => currentMystery) },
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
        { provide: MonsterService, useValue: { getByMystery: record('monsters.byMystery', () => []) } },
        { provide: MinionService, useValue: { getByMonster: () => of([]) } },
        { provide: ApiService, useValue: { get: record('api.get', () => []) } },
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

    fixture = TestBed.createComponent(MysteryDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    sent.length = 0; // drop the page load
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

  describe('the page’s first write surface', () => {
    it('renders the embedded customMoves with no request at all', () => {
      expect(all('[data-move-key]').map((li) => li.getAttribute('data-move-key'))).toEqual(['cm1', 'cm2']);
      expect(card().getAttribute('data-owner-type')).toBe('Mystery');
      // Decision 2: available on load. `MysteryDetailResponse.customMoves` has been populated since
      // Bowser's Phase 2, so 5e needed no backend work and no extra read.
      expect(sent).toEqual([]);
    });

    it('stores the route id, which the page never used to keep', () => {
      // §26.2 L12: `ngOnInit` read `params.get('id')` inside its pipe and discarded it — fine for a
      // read-only page, and not enough to address a POST at.
      expect(component.mysteryId()).toBe('my1');
    });

    it('sits after Countdown and above the linked-entity grid', () => {
      const nodes = all('h3, [data-custom-moves-card], div.grid');
      const order = nodes.map((n) =>
        n.hasAttribute('data-custom-moves-card') ? 'card' : n.classList.contains('grid') ? 'grid' : n.textContent!.trim()
      );
      const cardIndex = order.indexOf('card');
      const gridIndex = order.indexOf('grid');

      // The card is about the record the title names; every row in that grid links to a different
      // record (§13.2's rule, borrowed from monster-detail's Images placement).
      expect(cardIndex).toBeGreaterThan(order.indexOf('Countdown'));
      expect(cardIndex).toBeLessThan(gridIndex);
    });

    it('keeps the heading plain, with no section icon', () => {
      // L-D2 (Skyler). Every other heading on this page is icon-prefixed; this one is not, so the
      // card stays byte-identical across all five pages.
      const heading = all('[data-custom-moves-card] h3')[0];
      expect(heading.textContent!.trim()).toBe('Custom Moves');
      expect(heading.querySelector('app-mystery-section-icon')).toBeNull();
      expect(heading.querySelector('svg')).toBeNull();
    });
  });

  describe('writing', () => {
    it('adds through POST, then refetches ONLY the mystery', () => {
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      // The refetch that §4.1's list missed, and the reason it reloads one arm: monsters, locations,
      // bystanders and minions cannot change because of a custom-move write, and re-running them
      // would make a failure in any of those surface as a custom-move failure.
      expect(sent).toEqual([
        'create(Mystery,my1,{"name":"Hollow Out","description":null})',
        'getMystery(my1)',
      ]);
      expect(sent.filter((c) => c.startsWith('monsters.byMystery') || c.startsWith('api.get'))).toEqual([]);
      expect(successToasts).toEqual(['Custom move added.']);
    });

    it('edits through PUT at that row’s id, not POST', () => {
      el('[data-move-key="cm1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      type('[data-move-name]', 'Reach Further');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(sent).toEqual([
        'update(Mystery,my1,cm1,{"name":"Reach Further","description":"On a 10+, choose two."})',
        'getMystery(my1)',
      ]);
      expect(successToasts).toEqual(['Custom move saved.']);
    });

    it('returns the card to its add state after a successful commit', () => {
      el('[data-move-key="cm1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(component.editingCustomMoveKey()).toBeNull();
      expect(field('[data-move-name]').value).toBe('');
    });

    it('fires exactly one write per commit', () => {
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();

      expect(sent.filter((c) => c.startsWith('create('))).toHaveLength(1);
    });

    it('disables the card while a write is in flight', () => {
      component.activeMutation.set('Saving changes...');
      fixture.detectChanges();

      expect((el('[data-submit-move]') as HTMLButtonElement).disabled).toBe(true);
      expect((el('[data-move-key="cm1"] [data-remove-move]') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('the page’s first confirm modal', () => {
    it('mounts exactly one, which is the plan’s only new census entry', () => {
      // Also the per-page derived half of `confirm-delete-modal.call-sites.spec.ts`'s count — see
      // that file's note on why its own arithmetic cannot catch this.
      expect(all('app-confirm-delete-modal')).toHaveLength(1);
    });

    it('opens it on remove, named by the move, and deletes only on confirm', () => {
      el('[data-move-key="cm2"] [data-remove-move]')!.click();
      fixture.detectChanges();

      expect(component.pendingDelete()!.label).toBe('Whisper');
      expect(sent).toEqual([]);

      component.onDeleteConfirmed();
      fixture.detectChanges();

      expect(sent).toEqual(['delete(Mystery,my1,cm2)', 'getMystery(my1)']);
    });

    it('passes no footnote, since only the image flow sets one and this page has no images', () => {
      el('[data-move-key="cm1"] [data-remove-move]')!.click();

      expect(component.pendingDelete()!.footnote).toBeUndefined();
    });

    it('sends nothing when cancelled', () => {
      el('[data-move-key="cm1"] [data-remove-move]')!.click();
      component.onDeleteCancelled();

      expect(component.pendingDelete()).toBeNull();
      expect(sent).toEqual([]);
    });

    it('mounts the modal outside the content branch, so a pending delete cannot be orphaned', () => {
      component.mystery.set(null);
      fixture.detectChanges();

      expect(all('app-confirm-delete-modal')).toHaveLength(1);
    });
  });

  describe('a failed write — the R14 constraint', () => {
    it('leaves the mystery rendered, reports via toast, and never sets errorMessage', () => {
      failing = 'create';
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      // The whole point of 5e's deliberate non-addition. Setting `errorMessage` here would put the
      // template's `@else if (errorMessage())` branch in front of the content branch and replace
      // the mystery with one red line.
      expect(component.errorMessage()).toBeNull();
      expect(el('h2')!.textContent).toContain('The Hollow Choir');
      expect(el('[data-custom-moves-card]')).not.toBeNull();
      expect(errorToasts).toEqual(['Unable to add custom move.']);
      expect(successToasts).toEqual([]);
      expect(component.isMutating()).toBe(false);
      expect(field('[data-move-name]').value).toBe('Hollow Out');
    });

    it('survives a failed delete too', () => {
      failing = 'delete';
      el('[data-move-key="cm1"] [data-remove-move]')!.click();
      component.onDeleteConfirmed();
      fixture.detectChanges();

      expect(component.errorMessage()).toBeNull();
      expect(el('h2')!.textContent).toContain('The Hollow Choir');
      expect(errorToasts).toEqual(['Unable to delete custom move.']);
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

    it('still shows a LOAD failure inline, which is what that surface is for', () => {
      // The complement: `errorMessage` is not unused, it is load-only. Across all five detail pages
      // this branch now means exactly "this page could not be loaded".
      component.errorMessage.set('Unable to load mystery details.');
      fixture.detectChanges();

      expect(el('p.text-danger')!.textContent).toContain('Unable to load mystery details.');
      expect(el('h2')).toBeNull();
    });
  });

  it('never calls list() — hydration is the detail response, not a fetch', () => {
    type('[data-move-name]', 'Hollow Out');
    el('[data-submit-move]')!.click();
    fixture.detectChanges();

    expect(sent.filter((c) => c.startsWith('list('))).toEqual([]);
  });
});
