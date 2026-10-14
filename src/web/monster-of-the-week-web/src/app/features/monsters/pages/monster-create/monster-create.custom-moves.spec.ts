import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MonsterCreateComponent } from './monster-create';

/**
 * Custom moves on `monster-create` — Phase 5a's staged-write host (architecture.md §29.2, §31.2).
 *
 * **Asserted as an exact call ledger, because the failure this guards against produces the right
 * end state.** R5: the draft arm is added to five create pages independently and nothing makes the
 * five agree — a duplicated arm, or one that skips `runBatch`'s empty short-circuit and fires an
 * empty request, both leave the correct rows in the database. A positive `toContain` cannot see
 * either. So the criterion is the **complete sorted multiset** of calls: for N staged moves,
 * exactly N custom-move POSTs and no more, and **zero** when the list is empty
 * (`toad-exact-call-ledger-over-positive-assertions.md`).
 *
 * **Recorded at subscribe, not at invocation** — `HttpClient` is cold, so a ledger written when the
 * service method is *called* over-counts a request that was built and dropped. `defer()` moves the
 * record to the honest moment, the same discipline the two wizard ledger specs use.
 */

const monsterBody = {
  name: 'Grief-Eater',
  description: null,
  harmCapacity: 7,
  monsterTypeId: 'monster-type-1',
  monsterArchetypeId: 'monster-archetype-1',
};

describe('MonsterCreateComponent — custom moves', () => {
  let fixture: ComponentFixture<MonsterCreateComponent>;
  let component: MonsterCreateComponent;
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
      imports: [MonsterCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: MonsterService,
          useValue: {
            createStandalone: record('monster.create', () => ({ id: 'mo1' })),
            linkToMystery: record('monster.link', () => undefined),
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

    // Spy on the real Router rather than replacing it: `RouterLink` in this template injects
    // `Router` and needs the instance `provideRouter` built, so a `useValue` override fails inside
    // `provide_router.ts` rather than in anything this file is about. Matches `monster-create.spec.ts`.
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation((commands: readonly unknown[]) => {
      navigated.push([...commands]);
      return Promise.resolve(true);
    });

    fixture = TestBed.createComponent(MonsterCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  const all = (selector: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));
  const field = (selector: string) => el(selector) as HTMLInputElement | HTMLTextAreaElement;

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
    component.onCreate({ monster: monsterBody, mysteryIds: [] });
    fixture.detectChanges();
  };

  describe('staging, before any request', () => {
    it('adds rows locally and sends nothing', () => {
      stage('Hollow Out', 'On a miss, the Keeper says how.');
      stage('Whisper');

      expect(all('[data-move-key]')).toHaveLength(2);
      expect(component.customMoveDrafts().map((d) => d.name)).toEqual(['Hollow Out', 'Whisper']);
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

      expect(component.customMoveDrafts()).toHaveLength(1);
      expect(component.customMoveDrafts()[0].name).toBe('Hollow Out Deeper');
      expectLedger([]);
    });

    it('removes a staged row with no modal, because nothing is persisted yet', () => {
      stage('Hollow Out');
      stage('Whisper');
      el('[data-move-key] [data-remove-move]')!.click();
      fixture.detectChanges();

      expect(component.customMoveDrafts().map((d) => d.name)).toEqual(['Whisper']);
      // Create pages mount no confirm modal at all: a local splice has nothing to confirm (§13.3).
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
        'monster.create({"name":"Grief-Eater","description":null,"harmCapacity":7,"monsterTypeId":"monster-type-1","monsterArchetypeId":"monster-archetype-1"})',
        'move.create(Monster,mo1,{"name":"Hollow Out","description":"On a miss."})',
        'move.create(Monster,mo1,{"name":"Whisper","description":null})',
      ]);
      expect(successToasts).toEqual(['Monster created.']);
    });

    it('fires NO custom-move request when nothing was staged — runBatch’s short-circuit', () => {
      create();

      // The positive half of R5: an arm that skipped the short-circuit would fire an empty request
      // here, which produces the same end state and is invisible to a `toContain` assertion.
      expectLedger([
        'monster.create({"name":"Grief-Eater","description":null,"harmCapacity":7,"monsterTypeId":"monster-type-1","monsterArchetypeId":"monster-archetype-1"})',
      ]);
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
      component.powerDrafts.set([{ name: 'Walk Through Walls', description: null }]);
      stage('Hollow Out');

      create();

      expect(sent.filter((c) => c.startsWith('power.create'))).toHaveLength(1);
      expect(sent.filter((c) => c.startsWith('move.create'))).toHaveLength(1);
    });
  });

  describe('the partial-failure branch', () => {
    it('is a success with a caveat, never an error — and lands on the flat route', () => {
      failing = 'move.create';
      stage('Hollow Out');

      create();

      // The standing rule: routing this to `error:` would leave the user on a populated create form
      // whose only control makes a duplicate (`rosalina-partial-failure-copy-entity-linking.md`).
      expect(component.errorMessage()).toBeNull();
      expect(errorToasts).toEqual([
        'Monster created, but some details may not have saved. Review them on the monster page.',
      ]);
      expect(successToasts).toEqual([]);
      // Flat, not mystery-scoped: the scoped route would assert a membership no longer known to hold.
      expect(navigated).toEqual([['/monsters', 'mo1']]);
      expect(component.isSaving()).toBe(false);
    });

    it('still created the monster, so the caveat is accurate rather than alarmist', () => {
      failing = 'move.create';
      stage('Hollow Out');

      create();

      expect(sent.filter((c) => c.startsWith('monster.create'))).toHaveLength(1);
    });

    it('uses the shipped wording unchanged — the "some details" string, already correct here', () => {
      failing = 'move.create';
      stage('Hollow Out');
      create();

      // §13.6.1 Ruling 1: this page already says "some details", so 5a changes no copy. The two
      // pages that say "some of its mysteries" converge in 5c/5d, where that string becomes false
      // by omission.
      expect(errorToasts[0]).toContain('some details may not have saved');
      expect(errorToasts[0]).not.toContain('some of its mysteries');
    });

    it('a failed entity create is still a real error, not a caveat', () => {
      failing = 'monster.create';
      stage('Hollow Out');

      create();

      expect(component.errorMessage()).toBe('Unable to create monster.');
      expect(navigated).toEqual([]);
      // And no move was attempted, because there is no monster to hang one on.
      expect(sent.filter((c) => c.startsWith('move.create'))).toEqual([]);
    });
  });

  it('explains the staged-write model to the user, naming all five types', () => {
    // The only place this is explained, and it goes stale the moment a fifth type appears below it.
    const blurb = all('p').find((p) => p.textContent!.includes('saved together with the monster'))!;
    expect(blurb.textContent).toContain('custom moves');
    expect(blurb.textContent).toMatch(/Attacks, powers, armors, weaknesses and custom moves/);
  });
});
