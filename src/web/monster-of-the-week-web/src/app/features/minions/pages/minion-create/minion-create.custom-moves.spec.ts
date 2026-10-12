import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { UpsertMinionRequest } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MinionCreateComponent } from './minion-create';

/**
 * Custom moves on `minion-create` — Phase 5b's staged-write host (architecture.md §29.2, §29.3).
 *
 * The monster twin. **Asserted as an exact call ledger** for R5's reason: the draft arm is added to
 * five create pages independently and a duplicated arm, or one that skips `runBatch`'s empty
 * short-circuit, both leave the right rows in the database, so a positive `toContain` cannot see
 * either. Recorded at subscribe via `defer()`, because `HttpClient` is cold.
 *
 * One real difference from Monster, and it is this page's own shape rather than anything to do with
 * custom moves: a minion is created **under a monster** (`POST /api/monsters/{id}/minions`), so
 * this page resolves a `monsterId` first and has no membership flow at all.
 */

const validPayload: UpsertMinionRequest = {
  name: 'Rust-Wight',
  description: null,
  harmCapacity: 3,
  minionTypeId: 'mt1',
};

describe('MinionCreateComponent — custom moves', () => {
  let fixture: ComponentFixture<MinionCreateComponent>;
  let component: MinionCreateComponent;
  let sent: string[];
  let errorToasts: string[];
  let successToasts: string[];
  let navigated: unknown[][];
  let failing: string | null;

  const expectLedger = (expected: string[]): void => expect([...sent].sort()).toEqual([...expected].sort());

  beforeEach(async () => {
    sent = [];
    errorToasts = [];
    successToasts = [];
    navigated = [];
    failing = null;

    const record = <T>(name: string, result: () => T) =>
      (...args: unknown[]): Observable<T> =>
        defer(() => {
          sent.push(`${name}(${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`);
          return failing === name ? throwError(() => new Error('boom')) : of(result());
        });

    await TestBed.configureTestingModule({
      imports: [MinionCreateComponent],
      providers: [
        provideRouter([]),
        // Reached at `/monsters/:monsterId/minions/new`, so the monster is locked from the route.
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ monsterId: 'mo1' })) } },
        {
          provide: MinionService,
          useValue: {
            create: record('minion.create', () => ({ id: 'mn1' })),
            createAttack: record('attack.create', () => ({ id: 'a1' })),
            assignAttackWeaponTag: record('attack.tag', () => ({})),
            createPower: record('power.create', () => ({ id: 'p1' })),
            createArmor: record('armor.create', () => ({ id: 'ar1' })),
            createWeakness: record('weakness.create', () => ({ id: 'w1' })),
          },
        },
        {
          provide: CustomMoveService,
          useValue: { create: record('move.create', () => ({ id: 'cm1' })) },
        },
        {
          provide: MonsterService,
          useValue: { getById: () => of({ id: 'mo1', name: 'The Beast' }), getAll: () => of([]) },
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

    // Spy on the real Router rather than replacing it: `RouterLink` in this template injects
    // `Router` and needs the instance `provideRouter` built (5a's finding).
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation((commands: readonly unknown[]) => {
      navigated.push([...commands]);
      return Promise.resolve(true);
    });

    fixture = TestBed.createComponent(MinionCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  const all = (selector: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));
  const field = (selector: string) => el(selector) as HTMLInputElement | HTMLTextAreaElement;
  const rowNames = () => all('[data-move-key] strong').map((n) => n.textContent!.trim());

  function stage(name: string, description = ''): void {
    const nameInput = field('[data-move-name]');
    nameInput.value = name;
    nameInput.dispatchEvent(new Event('input'));
    if (description) {
      const descriptionInput = field('[data-move-description]');
      descriptionInput.value = description;
      descriptionInput.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    el('[data-submit-move]')!.click();
    fixture.detectChanges();
  }

  const create = () => {
    component.onCreate(validPayload);
    fixture.detectChanges();
  };

  describe('staging, before any request', () => {
    it('adds rows locally and sends nothing', () => {
      stage('Hollow Out', 'On a miss.');
      stage('Whisper');

      expect(rowNames()).toEqual(['Hollow Out', 'Whisper']);
      expectLedger([]);
    });

    it('uses the create pages’ empty wording, not the detail pages’', () => {
      expect(el('[data-custom-moves-empty]')!.textContent!.trim()).toBe('No custom moves added yet.');
    });

    it('edits a staged row in place rather than appending a second one', () => {
      stage('Hollow Out');
      el('[data-move-key] [data-edit-move]')!.click();
      fixture.detectChanges();
      const nameInput = field('[data-move-name]');
      nameInput.value = 'Hollow Out Deeper';
      nameInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Hollow Out Deeper']);
      expectLedger([]);
    });

    it('removes a staged row with no modal, because nothing is persisted yet', () => {
      stage('Hollow Out');
      stage('Whisper');
      el('[data-move-key] [data-remove-move]')!.click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Whisper']);
      expect(all('app-confirm-delete-modal')).toHaveLength(0);
      expectLedger([]);
    });

    it('closes the editor if the row being edited is removed', () => {
      stage('Hollow Out');
      el('[data-move-key] [data-edit-move]')!.click();
      fixture.detectChanges();
      el('[data-move-key] [data-remove-move]')!.click();
      fixture.detectChanges();

      expect(component.editingCustomMoveKey()).toBeNull();
    });
  });

  describe('the submit ledger (R5)', () => {
    it('fires exactly one POST per staged move, and nothing else', () => {
      stage('Hollow Out', 'On a miss.');
      stage('Whisper');

      create();

      expectLedger([
        `minion.create(mo1,${JSON.stringify(validPayload)})`,
        'move.create(Minion,mn1,{"name":"Hollow Out","description":"On a miss."})',
        'move.create(Minion,mn1,{"name":"Whisper","description":null})',
      ]);
      expect(successToasts).toEqual(['Minion created.']);
    });

    it('fires NO custom-move request when nothing was staged — runBatch’s short-circuit', () => {
      create();

      expectLedger([`minion.create(mo1,${JSON.stringify(validPayload)})`]);
      expect(sent.filter((c) => c.startsWith('move.create'))).toEqual([]);
    });

    it('scales one-for-one, with no duplicate arm', () => {
      stage('One');
      stage('Two');
      stage('Three');

      create();

      expect(sent.filter((c) => c.startsWith('move.create'))).toHaveLength(3);
    });

    it('writes moves alongside the other four sub-resource types, not instead of them', () => {
      component.powerDrafts.set([{ name: 'Swarm', description: null }]);
      stage('Hollow Out');

      create();

      expect(sent.filter((c) => c.startsWith('power.create'))).toHaveLength(1);
      expect(sent.filter((c) => c.startsWith('move.create'))).toHaveLength(1);
    });
  });

  describe('the partial-failure branch', () => {
    it('is a success with a caveat, never an error', () => {
      failing = 'move.create';
      stage('Hollow Out');

      create();

      expect(component.errorMessage()).toBeNull();
      expect(errorToasts).toEqual([
        'Minion created, but some details may not have saved. Review them on the minion page.',
      ]);
      expect(successToasts).toEqual([]);
      expect(component.isSaving()).toBe(false);
    });

    it('uses the shipped wording unchanged — this page already said "some details"', () => {
      failing = 'move.create';
      stage('Hollow Out');
      create();

      // §13.6.1 Ruling 1: Monster and Minion already carry the correct string, so 5a and 5b change
      // no copy. The two pages that say "some of its mysteries" converge in 5c/5d.
      expect(errorToasts[0]).toContain('some details may not have saved');
      expect(errorToasts[0]).not.toContain('some of its mysteries');
    });

    it('still created the minion, so the caveat is accurate rather than alarmist', () => {
      failing = 'move.create';
      stage('Hollow Out');

      create();

      expect(sent.filter((c) => c.startsWith('minion.create'))).toHaveLength(1);
    });

    it('a failed entity create is still a real error, not a caveat', () => {
      failing = 'minion.create';
      stage('Hollow Out');

      create();

      expect(component.errorMessage()).toBe('Unable to create minion.');
      expect(sent.filter((c) => c.startsWith('move.create'))).toEqual([]);
    });
  });

  it('explains the staged-write model to the user, naming all five types', () => {
    const blurb = all('p').find((p) => p.textContent!.includes('saved together with the minion'))!;
    expect(blurb.textContent).toContain('custom moves');
    expect(blurb.textContent).toMatch(/Attacks, powers, armors, weaknesses and custom moves/);
  });
});
