import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { BystanderService } from '../../../../core/bystander';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { BystanderCreateComponent } from './bystander-create';

/**
 * Custom moves on `bystander-create` — Phase 5d's staged-write host (architecture.md §29.2, §29.6).
 *
 * **This page's post-create batch was memberships only**, so like `location-create` and unlike
 * monster and minion, the second `forkJoin` arm, the draft list and the combined failure flag are
 * all first-of-kind here — three items, not four, because the card brings its own form. That makes
 * the ledger the important assertion: it has to show **both arms coexisting**, because the failure
 * mode these two pages can have and the other two cannot is one arm *replacing* the other rather
 * than joining it.
 *
 * Derived from `location-create.custom-moves.spec.ts` once the two pages were genuine twins; see
 * the detail twin's header for what the derivation got wrong and why that is recorded.
 *
 * Recorded at subscribe via `defer()` — `HttpClient` is cold, so recording at invocation
 * over-counts a request that was built and dropped.
 */

const bystanderBody = { name: 'Mrs. Alder', description: null, bystanderTypeId: 'bt1' };
const submitWith = (mysteryIds: string[]) => ({ bystander: bystanderBody, mysteryIds });

describe('BystanderCreateComponent — custom moves', () => {
  let fixture: ComponentFixture<BystanderCreateComponent>;
  let component: BystanderCreateComponent;
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
      imports: [BystanderCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: BystanderService,
          useValue: {
            createStandalone: record('bystander.create', () => ({ id: 'b1' })),
            linkToMystery: record('bystander.link', () => undefined),
          },
        },
        {
          provide: CustomMoveService,
          useValue: { create: record('move.create', () => ({ id: 'cm1' })) },
        },
        { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
        { provide: ReferenceDataService, useValue: { getBystanderTypes: () => of([]) } },
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

    // Spy on the real Router rather than replacing it (5a's finding): `RouterLink` injects it.
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation((commands: readonly unknown[]) => {
      navigated.push([...commands]);
      return Promise.resolve(true);
    });

    fixture = TestBed.createComponent(BystanderCreateComponent);
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
      const d = field('[data-move-description]');
      d.value = description;
      d.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    el('[data-submit-move]')!.click();
    fixture.detectChanges();
  }

  const create = (mysteryIds: string[] = []) => {
    component.onCreate(submitWith(mysteryIds));
    fixture.detectChanges();
  };

  describe('the page’s first sub-resource surface', () => {
    it('renders the card, which brings its own form — so this page still needs no FormBuilder', () => {
      // §13.1 item 3 budgeted four first-of-kind items; the draft *surface* was not one of them,
      // because the card owns its form. This page's imports are still RouterLink + the two cards.
      expect(el('[data-custom-moves-card]')).not.toBeNull();
      expect(el('[data-custom-moves-card]')!.querySelector('form')).not.toBeNull();
    });

    it('introduces the staged-write sentence, which this page never had', () => {
      // Monster/minion had a sentence to widen; this page had none, so 5c adds one (§13.4).
      const blurb = all('p').find((p) => p.textContent!.includes('saved together with the bystander'));
      expect(blurb).toBeDefined();
      expect(blurb!.textContent).toContain('Custom moves added below');
    });

    it('uses the create pages’ empty wording', () => {
      expect(el('[data-custom-moves-empty]')!.textContent!.trim()).toBe('No custom moves added yet.');
    });

    it('mounts no confirm modal, because nothing it removes is persisted', () => {
      expect(all('app-confirm-delete-modal')).toHaveLength(0);
    });
  });

  describe('staging, before any request', () => {
    it('adds rows locally and sends nothing', () => {
      stage('Hollow Out', 'On a miss.');
      stage('Whisper');

      expect(rowNames()).toEqual(['Hollow Out', 'Whisper']);
      expectLedger([]);
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

    it('removes a staged row with no modal and no request', () => {
      stage('Hollow Out');
      stage('Whisper');
      el('[data-move-key] [data-remove-move]')!.click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Whisper']);
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

  describe('the submit ledger (R5), with two arms where there was one', () => {
    it('writes memberships AND moves — the new arm joined the batch, it did not replace it', () => {
      stage('Hollow Out', 'On a miss.');
      stage('Whisper');

      create(['mystery-1', 'mystery-2']);

      // The assertion this page needs and monster/minion did not: both arms present, exactly once
      // each. An arm that replaced the membership `runBatch` rather than joining it in a `forkJoin`
      // would leave the moves correct and the memberships silently gone.
      expectLedger([
        `bystander.create(${JSON.stringify(bystanderBody)})`,
        'bystander.link(mystery-1,b1)',
        'bystander.link(mystery-2,b1)',
        'move.create(Bystander,b1,{"name":"Hollow Out","description":"On a miss."})',
        'move.create(Bystander,b1,{"name":"Whisper","description":null})',
      ]);
      expect(successToasts).toEqual(['Bystander created.']);
    });

    it('fires NO custom-move request when nothing was staged — runBatch’s short-circuit', () => {
      create(['mystery-1']);

      expectLedger([`bystander.create(${JSON.stringify(bystanderBody)})`, 'bystander.link(mystery-1,b1)']);
      expect(sent.filter((c) => c.startsWith('move.create'))).toEqual([]);
    });

    it('fires neither arm’s requests when there is nothing for either', () => {
      create([]);

      expectLedger([`bystander.create(${JSON.stringify(bystanderBody)})`]);
    });

    it('scales one-for-one, with no duplicate arm', () => {
      stage('One');
      stage('Two');
      stage('Three');

      create();

      expect(sent.filter((c) => c.startsWith('move.create'))).toHaveLength(3);
    });
  });

  describe('the combined failure flag', () => {
    it('a failed MOVE produces the converged caveat, not the old mysteries wording', () => {
      failing = 'move.create';
      stage('Hollow Out');

      create(['mystery-1']);

      // The correctness fix: before 5c this page said "some of its mysteries may not have saved",
      // which a failed *move* would have made false by omission (§13.6.1 Ruling 1).
      expect(errorToasts).toEqual([
        'Bystander created, but some details may not have saved. Review them on the bystander page.',
      ]);
      expect(errorToasts[0]).not.toContain('some of its mysteries');
      expect(component.errorMessage()).toBeNull();
      expect(successToasts).toEqual([]);
      expect(navigated).toEqual([['/bystanders', 'b1']]);
    });

    it('a failed MEMBERSHIP produces the same caveat, since one flag is all forkJoin supports', () => {
      failing = 'bystander.link';
      stage('Hollow Out');

      create(['mystery-1']);

      // `forkJoin` reports that one call failed, never which — so a flag per arm would be a
      // distinction the data cannot support. Both arms share `draftsFailed` deliberately.
      expect(errorToasts).toEqual([
        'Bystander created, but some details may not have saved. Review them on the bystander page.',
      ]);
    });

    it('is a success with a caveat, never an error — the bystander still exists', () => {
      failing = 'move.create';
      stage('Hollow Out');

      create();

      expect(component.errorMessage()).toBeNull();
      expect(sent.filter((c) => c.startsWith('bystander.create'))).toHaveLength(1);
      expect(component.isSaving()).toBe(false);
    });

    it('a failed entity create is still a real error, and attempts no arm', () => {
      failing = 'bystander.create';
      stage('Hollow Out');

      create(['mystery-1']);

      expect(component.errorMessage()).toBe('Unable to create bystander.');
      expect(navigated).toEqual([]);
      expect(sent.filter((c) => c.startsWith('move.create'))).toEqual([]);
      expect(sent.filter((c) => c.startsWith('bystander.link'))).toEqual([]);
    });
  });
});
