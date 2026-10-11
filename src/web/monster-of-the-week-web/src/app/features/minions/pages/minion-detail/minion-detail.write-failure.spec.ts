import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { MinionDetailResponse } from '../../../../core/models';
import { MinionService } from '../../../../core/minion';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MinionDetailComponent } from './minion-detail';

/**
 * **A failed sub-resource write must not unmount the page** — Phase A of
 * `docs/domain-custom-moves/architecture.md` (§26.2 L1, §34). The twin of
 * `monster-detail.write-failure.spec.ts`; that file carries the full rationale, and the two are
 * deliberately the same shape because the defect and the fix were identical on both pages.
 *
 * `minion-detail.html:4-8` orders its branches `isLoading` → `errorMessage` → `minion()`, so any
 * code path that set `errorMessage` while the page was loaded replaced the minion, its form, the
 * images card and all four collections with one red line. `runAndRefresh`, `createAttack` and
 * `saveMinion` all did — the eight sub-resource writes below plus the entity save.
 *
 * **The invariant Phase A ends on:** `errorMessage` is now written by the **load path only**
 * (`ngOnInit`), so the branch that replaces the whole page means exactly "this minion could not
 * load" — the only claim that branch position is correct for. This file is the guard on it.
 *
 * One difference from the monster twin worth noting, because its absence looks like an omission:
 * there is no membership case here. A minion belongs to a *monster*, not to mysteries, so
 * `saveMinion` is a plain `update` with no batch and no caveat branch.
 *
 * Kept as its own file rather than folded into the monster one, even though the cases are parallel:
 * a parity-style spec that renders both pages together would make a single failure read as "the two
 * pages disagree", when the thing worth knowing is *which page and which collection*. The pages'
 * shared-ness is asserted elsewhere (`resource-images-four-domain-parity.spec.ts`) and is not what
 * this is about.
 */

const loadedMinion: MinionDetailResponse = {
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
  customMoves: [],
};

/** One failing method at a time, or `'*'` for all — see the monster twin for the reasoning. */
let failing: string | null = null;
let errorToasts: string[] = [];
let successToasts: string[] = [];

function sub<T>(method: string, value: T): () => Observable<T> {
  return () => (failing === method || failing === '*' ? throwError(() => new Error('boom')) : of(value));
}

describe('MinionDetailComponent — a failed sub-resource write leaves the page mounted (Phase A)', () => {
  let component: MinionDetailComponent;
  let fixture: ComponentFixture<MinionDetailComponent>;

  beforeEach(async () => {
    failing = null;
    errorToasts = [];
    successToasts = [];

    await TestBed.configureTestingModule({
      imports: [MinionDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ minionId: 'mn1' })) },
        },
        {
          provide: MinionService,
          useValue: {
            getById: () => of(loadedMinion),
            update: sub('update', loadedMinion),
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
        {
          provide: ReferenceDataService,
          useValue: { getMinionTypes: () => of([]), getWeaponTags: () => of([]) },
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

    fixture = TestBed.createComponent(MinionDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** The content branch's first element. Gone iff the `errorMessage` branch won. */
  const heading = (): string | null =>
    (fixture.nativeElement as HTMLElement).querySelector('h2')?.textContent?.trim() ?? null;

  it('renders the minion before any of the cases below, so "still mounted" means something', () => {
    expect(heading()).toBe('Rust-Wight');
    expect(component.errorMessage()).toBeNull();
  });

  const cases: readonly {
    readonly label: string;
    readonly method: string;
    readonly pipeline: 'runAndRefresh' | 'own subscribe';
    readonly toast: string;
    readonly act: (component: MinionDetailComponent) => void;
  }[] = [
    {
      label: 'create attack',
      method: 'createAttack',
      pipeline: 'own subscribe',
      toast: 'Unable to add attack.',
      act: (c) => {
        c.attackForm.patchValue({ name: 'Rusted Blade' });
        c.createAttack();
      },
    },
    {
      label: 'create power',
      method: 'createPower',
      pipeline: 'runAndRefresh',
      toast: 'Unable to add power.',
      act: (c) => {
        c.powerForm.patchValue({ name: 'Swarm' });
        c.createPower();
      },
    },
    {
      label: 'create armor',
      method: 'createArmor',
      pipeline: 'runAndRefresh',
      toast: 'Unable to add armor.',
      act: (c) => {
        c.armorForm.patchValue({ name: 'Scrap Plate' });
        c.createArmor();
      },
    },
    {
      label: 'create weakness',
      method: 'createWeakness',
      pipeline: 'runAndRefresh',
      toast: 'Unable to add weakness.',
      act: (c) => {
        c.weaknessForm.patchValue({ name: 'Salt' });
        c.createWeakness();
      },
    },
    {
      label: 'delete attack',
      method: 'deleteAttack',
      pipeline: 'runAndRefresh',
      toast: 'Unable to delete attack.',
      act: (c) => {
        c.requestDeleteAttack('a1', 'Rusted Blade');
        c.onDeleteConfirmed();
      },
    },
    {
      label: 'delete power',
      method: 'deletePower',
      pipeline: 'runAndRefresh',
      toast: 'Unable to delete power.',
      act: (c) => {
        c.requestDeletePower('p1', 'Swarm');
        c.onDeleteConfirmed();
      },
    },
    {
      label: 'delete armor',
      method: 'deleteArmor',
      pipeline: 'runAndRefresh',
      toast: 'Unable to delete armor.',
      act: (c) => {
        c.requestDeleteArmor('ar1', 'Scrap Plate');
        c.onDeleteConfirmed();
      },
    },
    {
      label: 'delete weakness',
      method: 'deleteWeakness',
      pipeline: 'runAndRefresh',
      toast: 'Unable to delete weakness.',
      act: (c) => {
        c.requestDeleteWeakness('w1', 'Salt');
        c.onDeleteConfirmed();
      },
    },
  ];

  for (const { label, method, pipeline, toast, act } of cases) {
    it(`a failed ${label} (${pipeline}) keeps the page rendered and reports once`, () => {
      failing = method;

      act(component);
      fixture.detectChanges();

      expect(component.errorMessage(), `${label}: errorMessage must stay null`).toBeNull();
      expect(heading(), `${label}: the page unmounted`).toBe('Rust-Wight');
      expect(errorToasts, `${label}: error reporting`).toEqual([toast]);
      expect(successToasts, `${label}: must not also claim success`).toEqual([]);
      expect(component.isMutating(), `${label}: mutation state must clear`).toBe(false);
    });
  }

  it('still clears the modal when a delete fails, so the dialog does not strand the user', () => {
    failing = 'deletePower';

    component.requestDeletePower('p1', 'Swarm');
    expect(component.pendingDelete()).not.toBeNull();
    component.onDeleteConfirmed();
    fixture.detectChanges();

    expect(component.pendingDelete()).toBeNull();
    expect(heading()).toBe('Rust-Wight');
  });

  it('a successful write still refreshes the page and says so, so the fix did not silence the happy path', () => {
    component.powerForm.patchValue({ name: 'Swarm' });
    component.createPower();
    fixture.detectChanges();

    expect(errorToasts).toEqual([]);
    expect(successToasts).toEqual(['Power added.']);
    expect(component.errorMessage()).toBeNull();
    expect(heading()).toBe('Rust-Wight');
  });

  /**
   * **The entity save — the same defect one step worse**, and worse for the reason the monster twin
   * gives: a failed `PUT` unmounted `<app-minion-form>` **while it still held the user's unsaved
   * edits**, so the work was gone and not merely the view. It needed no new error surface, which is
   * why it was in scope: `notificationService.error('Unable to save minion details.')` was already
   * firing on the line after the inline write, with the identical string.
   */
  describe('the entity save', () => {
    const body = {
      name: 'Rust-Wight',
      description: null,
      harmCapacity: 3,
      minionTypeId: 'mt1',
    };

    it('a failed save keeps the page and the form mounted, and reports once', () => {
      failing = 'update';

      component.saveMinion(body);
      fixture.detectChanges();

      expect(component.errorMessage(), 'save: errorMessage must stay null').toBeNull();
      expect(heading(), 'save: the page unmounted').toBe('Rust-Wight');
      expect(errorToasts, 'save: error reporting').toEqual(['Unable to save minion details.']);
      expect(successToasts, 'save: must not also claim success').toEqual([]);
      expect(component.isMutating(), 'save: mutation state must clear').toBe(false);
    });

    it('and the form itself survives, which is the part that held the unsaved edits', () => {
      failing = 'update';

      component.saveMinion(body);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('app-minion-form')).toBeTruthy();
    });

    it('a successful save still reports success and leaves errorMessage alone', () => {
      component.saveMinion(body);
      fixture.detectChanges();

      expect(errorToasts).toEqual([]);
      expect(successToasts).toEqual(['Minion details saved.']);
      expect(component.errorMessage()).toBeNull();
      expect(heading()).toBe('Rust-Wight');
    });
  });

  /** The invariant as a property of the component — see the monster twin. */
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
      () => component.saveMinion({ name: 'Rust-Wight', description: null, harmCapacity: 3, minionTypeId: 'mt1' }),
    ];

    failing = '*';
    for (const write of everyWrite) {
      write();
      fixture.detectChanges();
      expect(component.errorMessage()).toBeNull();
      expect(heading()).toBe('Rust-Wight');
    }

    expect(everyWrite).toHaveLength(9);
    expect(errorToasts.length).toBe(9);
  });
});
