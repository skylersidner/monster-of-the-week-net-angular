import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { MonsterDetailResponse } from '../../../../core/models';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MonsterDetailComponent } from './monster-detail';

/**
 * **A failed sub-resource write must not unmount the page** — Phase A of
 * `docs/domain-custom-moves/architecture.md` (§26.2 L1, §34).
 *
 * **The bug this closes.** `monster-detail.html:4-8` orders its branches
 * `isLoading` → `errorMessage` → `monster()`, and an `@if`/`@else if` chain renders its *first*
 * match — so any code path that sets `errorMessage` while the page is loaded replaces the monster,
 * its form, the images card and all four collections with a single red line. Until Phase A, both
 * sub-resource write pipelines did exactly that: `runAndRefresh` (every power/armor/weakness create
 * and every delete) and `createAttack` (which has its own `subscribe`, because an attack chains its
 * weapon-tag assignments). A Keeper mid-session who failed one delete lost the page they were
 * reading from, with no recovery but a reload.
 *
 * The page already knew the rule in three other places and applied it there — `saveMonster`'s
 * membership caveat (`monster-detail.spec.ts`'s `5b-L1`), the images section's own inline error, and
 * `location-detail.ts`'s comment naming the same hazard. This file is that rule asserted for the
 * eight paths that were missing it.
 *
 * **Why a table over eight cases rather than one or two examples.** The two pipelines are *not* one
 * method, which is the single most likely way to half-fix this: three of the four creates go through
 * `runAndRefresh` and Attack does not. An example-based test would very plausibly have picked a
 * power and left Attack — the busiest collection — still unmounting the page. So every write path
 * gets a row, and the row names which pipeline it exercises.
 *
 * **Why `errorMessage` is not simply asserted, but the rendered page is too.** `errorMessage()`
 * being `null` is the cause; the heading still being in the DOM is the effect the user experiences.
 * Asserting only the signal would keep passing if the template's branch order changed; asserting
 * only the DOM would not say *why* it survived. Both, cheaply.
 *
 * **Scope, and the invariant Phase A ends on.** `errorMessage` is now written by the **load path
 * only** — `ngOnInit` and nothing else, on this page and on `minion-detail`. That is what makes the
 * template's branch order safe: a branch that replaces the entire page should mean "this page could
 * not load", and now it means exactly that. Both defect classes are covered below: the eight
 * sub-resource writes, and the entity save (`describe` at the bottom), which was the same bug one
 * step worse because it unmounted the form while it still held the user's unsaved edits.
 *
 * So this file is the guard on that invariant, and it is deliberately the whole of it: if someone
 * adds an `errorMessage.set` to any write path on this page, a case here fails.
 */

const loadedMonster: MonsterDetailResponse = {
  id: 'mo1',
  mysteryIds: ['m1'],
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
  customMoves: [],
};

/**
 * Which `MonsterService` method should reject, or `'*'` for all of them.
 *
 * **One name at a time in the per-flow cases, deliberately:** the point of each is that *this* write
 * failing leaves the page alone, and a stub failing everything could pass for the wrong reason (a
 * page that never loaded has no heading to lose either — note `getById` is never in this set, so the
 * load always succeeds). `'*'` is used only by the closing invariant test, where the question is the
 * opposite one: did *anything* reach the page-level surface.
 */
let failing: string | null = null;

/** Every `notificationService.error(...)` string, in order. Multiplicity matters — see the cases. */
let errorToasts: string[] = [];
let successToasts: string[] = [];

function sub<T>(method: string, value: T): () => Observable<T> {
  return () => (failing === method || failing === '*' ? throwError(() => new Error('boom')) : of(value));
}

describe('MonsterDetailComponent — a failed sub-resource write leaves the page mounted (Phase A)', () => {
  let component: MonsterDetailComponent;
  let fixture: ComponentFixture<MonsterDetailComponent>;

  beforeEach(async () => {
    failing = null;
    errorToasts = [];
    successToasts = [];

    await TestBed.configureTestingModule({
      imports: [MonsterDetailComponent],
      providers: [
        /**
         * **F-L9.** `CustomMoveService` is `providedIn: 'root'`, so without this the real one
         * resolves and any stray call becomes a real HTTP request — refused today only because
         * nothing is listening on :5225, and a write against dev the moment something is. This
         * spec drives no custom-move traffic, so the stub says so by throwing.
         */
        {
          provide: CustomMoveService,
          useValue: (() => {
            // Only the service's own four methods. A catch-all `Proxy` refuses `ngOnDestroy()` too,
            // which Angular calls on every provider instance at teardown — 386 tests, one stub.
            const refuse = (method: string) => () => {
              throw new Error(`Unexpected CustomMoveService.${method}() — this spec expects no custom-move traffic.`);
            };
            return { list: refuse('list'), create: refuse('create'), update: refuse('update'), delete: refuse('delete') };
          })(),
        },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ monsterId: 'mo1' })) },
        },
        {
          provide: MonsterService,
          useValue: {
            getById: () => of(loadedMonster),
            update: sub('update', loadedMonster),
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
            createAttack: sub('createAttack', { id: 'a1' }),
            assignAttackWeaponTag: () => of({}),
            createPower: sub('createPower', { id: 'p1' }),
            createArmor: sub('createArmor', { id: 'ar1' }),
            createWeakness: sub('createWeakness', { id: 'w1' }),
            deleteAttack: sub('deleteAttack', void 0),
            deletePower: sub('deletePower', void 0),
            deleteArmor: sub('deleteArmor', void 0),
            deleteWeakness: sub('deleteWeakness', void 0),
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
            success: (message: string) => successToasts.push(message),
            error: (message: string) => errorToasts.push(message),
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MonsterDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** The content branch's first element. Gone iff the `errorMessage` branch won. */
  const heading = (): string | null =>
    (fixture.nativeElement as HTMLElement).querySelector('h2')?.textContent?.trim() ?? null;

  it('renders the monster before any of the cases below, so "still mounted" means something', () => {
    expect(heading()).toBe('Grief-Eater');
    expect(component.errorMessage()).toBeNull();
  });

  /**
   * Every write path on the page, with the pipeline each one exercises. `pipeline` is documentation
   * rather than an assertion, but it is the reason the table has eight rows instead of two: a fix
   * applied only to `runAndRefresh` leaves the one `own subscribe` row broken, and that row is
   * Attack — the collection with the most moving parts.
   */
  const cases: readonly {
    readonly label: string;
    readonly method: string;
    readonly pipeline: 'runAndRefresh' | 'own subscribe';
    readonly toast: string;
    readonly act: (component: MonsterDetailComponent) => void;
  }[] = [
    {
      label: 'create attack',
      method: 'createAttack',
      pipeline: 'own subscribe',
      toast: 'Unable to add attack.',
      act: (c) => {
        c.attackForm.patchValue({ name: 'Cold Grip' });
        c.createAttack();
      },
    },
    {
      label: 'create power',
      method: 'createPower',
      pipeline: 'runAndRefresh',
      toast: 'Unable to add power.',
      act: (c) => {
        c.powerForm.patchValue({ name: 'Walk Through Walls' });
        c.createPower();
      },
    },
    {
      label: 'create armor',
      method: 'createArmor',
      pipeline: 'runAndRefresh',
      toast: 'Unable to add armor.',
      act: (c) => {
        c.armorForm.patchValue({ name: 'Grave Shroud' });
        c.createArmor();
      },
    },
    {
      label: 'create weakness',
      method: 'createWeakness',
      pipeline: 'runAndRefresh',
      toast: 'Unable to add weakness.',
      act: (c) => {
        c.weaknessForm.patchValue({ name: 'Iron' });
        c.createWeakness();
      },
    },
    {
      label: 'delete attack',
      method: 'deleteAttack',
      pipeline: 'runAndRefresh',
      toast: 'Unable to delete attack.',
      act: (c) => {
        c.requestDeleteAttack('a1', 'Cold Grip');
        c.onDeleteConfirmed();
      },
    },
    {
      label: 'delete power',
      method: 'deletePower',
      pipeline: 'runAndRefresh',
      toast: 'Unable to delete power.',
      act: (c) => {
        c.requestDeletePower('p1', 'Walk Through Walls');
        c.onDeleteConfirmed();
      },
    },
    {
      label: 'delete armor',
      method: 'deleteArmor',
      pipeline: 'runAndRefresh',
      toast: 'Unable to delete armor.',
      act: (c) => {
        c.requestDeleteArmor('ar1', 'Grave Shroud');
        c.onDeleteConfirmed();
      },
    },
    {
      label: 'delete weakness',
      method: 'deleteWeakness',
      pipeline: 'runAndRefresh',
      toast: 'Unable to delete weakness.',
      act: (c) => {
        c.requestDeleteWeakness('w1', 'Iron');
        c.onDeleteConfirmed();
      },
    },
  ];

  for (const { label, method, pipeline, toast, act } of cases) {
    it(`a failed ${label} (${pipeline}) keeps the page rendered and reports once`, () => {
      failing = method;

      act(component);
      fixture.detectChanges();

      // The cause: nothing wrote the page-level error surface.
      expect(component.errorMessage(), `${label}: errorMessage must stay null`).toBeNull();
      // The effect: the content branch still won, so the monster is still on screen.
      expect(heading(), `${label}: the page unmounted`).toBe('Grief-Eater');
      // Exactly one report, through the surface that does not destroy anything. "Exactly" is the
      // assertion with teeth: before Phase A the same string was written to `errorMessage` *and*
      // pushed as a toast, so a partial revert that kept the inline write would still show one
      // toast here while failing the two assertions above.
      expect(errorToasts, `${label}: error reporting`).toEqual([toast]);
      expect(successToasts, `${label}: must not also claim success`).toEqual([]);
      // The page is usable again, not stuck behind a spinner.
      expect(component.isMutating(), `${label}: mutation state must clear`).toBe(false);
    });
  }

  it('still clears the modal when a delete fails, so the dialog does not strand the user', () => {
    failing = 'deletePower';

    component.requestDeletePower('p1', 'Walk Through Walls');
    expect(component.pendingDelete()).not.toBeNull();
    component.onDeleteConfirmed();
    fixture.detectChanges();

    // `onDeleteConfirmed` clears before performing, so this holds regardless of the outcome. Worth
    // pinning next to the cases above: "the page is still there" would be a hollow guarantee if the
    // confirm dialog were still over it.
    expect(component.pendingDelete()).toBeNull();
    expect(heading()).toBe('Grief-Eater');
  });

  it('a successful write still refreshes the page and says so, so the fix did not silence the happy path', () => {
    component.powerForm.patchValue({ name: 'Walk Through Walls' });
    component.createPower();
    fixture.detectChanges();

    expect(errorToasts).toEqual([]);
    expect(successToasts).toEqual(['Power added.']);
    expect(component.errorMessage()).toBeNull();
    expect(heading()).toBe('Grief-Eater');
  });

  /**
   * **The entity save — the same defect one step worse.**
   *
   * `saveMonster`'s *membership caveat* never set `errorMessage` (its own comment says why, and
   * `monster-detail.spec.ts`'s `5b-L1` has pinned it since 5b). Its *total* failure did. That is
   * worse than the sub-resource case rather than equivalent, and the reason is what the user loses:
   * a failed `PUT` unmounted `<app-monster-form>` **while it still held their unsaved edits**, so
   * the work was gone, not just the view. The sub-resource panels at least had already cleared
   * their own add-form inputs on the way in.
   *
   * It needed no new error surface, which is the only reason it was in scope at all:
   * `notificationService.error('Unable to save monster details.')` was already firing on the line
   * after the inline write, with the identical string.
   */
  describe('the entity save', () => {
    const body = {
      name: 'Grief-Eater',
      description: null,
      harmCapacity: 7,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    };

    it('a failed save keeps the page and the form mounted, and reports once', () => {
      failing = 'update';

      // The same membership set the fixture already has, so no link/unlink is in play and the only
      // thing that can fail is the `PUT` itself.
      component.saveMonster({ monster: body, mysteryIds: ['m1'] });
      fixture.detectChanges();

      expect(component.errorMessage(), 'save: errorMessage must stay null').toBeNull();
      expect(heading(), 'save: the page unmounted').toBe('Grief-Eater');
      expect(errorToasts, 'save: error reporting').toEqual(['Unable to save monster details.']);
      expect(successToasts, 'save: must not also claim success').toEqual([]);
      expect(component.isMutating(), 'save: mutation state must clear').toBe(false);
    });

    it('and the form itself survives, which is the part that held the unsaved edits', () => {
      failing = 'update';

      component.saveMonster({ monster: body, mysteryIds: ['m1'] });
      fixture.detectChanges();

      // The assertion that names what the bug actually destroyed. `monster-detail.spec.ts`'s
      // `5b-L1` makes the same check for the membership branch; this is its total-failure twin.
      expect((fixture.nativeElement as HTMLElement).querySelector('app-monster-form')).toBeTruthy();
    });

    it('a successful save still reports success and leaves errorMessage alone', () => {
      component.saveMonster({ monster: body, mysteryIds: ['m1'] });
      fixture.detectChanges();

      expect(errorToasts).toEqual([]);
      expect(successToasts).toEqual(['Monster details saved.']);
      expect(component.errorMessage()).toBeNull();
      expect(heading()).toBe('Grief-Eater');
    });
  });

  /**
   * The invariant the two defect classes add up to, asserted as a property of the component rather
   * than of any one flow: **after a successful load, nothing on this page writes `errorMessage`.**
   * Worth having as its own test because it is the sentence the comments in the component state,
   * and because a future sixth write path would be covered by it without anyone adding a case.
   */
  it('no write path on the page touches errorMessage, whatever fails', () => {
    const everyWrite: (() => void)[] = [
      () => {
        component.attackForm.patchValue({ name: 'x' });
        component.createAttack();
      },
      () => {
        component.powerForm.patchValue({ name: 'x' });
        component.createPower();
      },
      () => {
        component.armorForm.patchValue({ name: 'x' });
        component.createArmor();
      },
      () => {
        component.weaknessForm.patchValue({ name: 'x' });
        component.createWeakness();
      },
      () => {
        component.requestDeleteAttack('a1', 'x');
        component.onDeleteConfirmed();
      },
      () => {
        component.requestDeletePower('p1', 'x');
        component.onDeleteConfirmed();
      },
      () => {
        component.requestDeleteArmor('ar1', 'x');
        component.onDeleteConfirmed();
      },
      () => {
        component.requestDeleteWeakness('w1', 'x');
        component.onDeleteConfirmed();
      },
      () =>
        component.saveMonster({
          monster: {
            name: 'Grief-Eater',
            description: null,
            harmCapacity: 7,
            monsterTypeId: 'monster-type-1',
            monsterArchetypeId: 'monster-archetype-1',
          },
          mysteryIds: ['m1'],
        }),
    ];

    // Everything fails at once — the one case the per-flow tests above deliberately avoid, because
    // here the question is not "which flow" but "did anything at all reach the page-level surface".
    failing = '*';
    for (const write of everyWrite) {
      write();
      fixture.detectChanges();
      expect(component.errorMessage()).toBeNull();
      expect(heading()).toBe('Grief-Eater');
    }

    // Nine flows attempted, so the loop cannot have passed by doing nothing.
    expect(everyWrite).toHaveLength(9);
    expect(errorToasts.length).toBe(9);
  });
});
