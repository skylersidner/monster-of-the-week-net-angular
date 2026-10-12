import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { BystanderService } from '../../../../core/bystander';
import { BystanderDetailResponse, MysteryListItemResponse, UpsertBystanderRequest } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { BystanderFormComponent, BystanderFormSubmit } from '../../shared/bystander-form/bystander-form';
import { BystanderDetailComponent } from './bystander-detail';

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

const mysteries: MysteryListItemResponse[] = [
  buildMystery('m1', 'The Quiet'),
  buildMystery('m2', 'Dead Air'),
  buildMystery('m3', 'Cold Open'),
];

const loadedBystander: BystanderDetailResponse = {
  id: 'b1',
  mysteryIds: [],
  name: 'Bystander',
  description: null,
  bystanderTypeId: 'bt1',
  bystanderTypeName: 'Witness',
  bystanderTypeMotivation: 'Test',
  customMoves: [],
};

function submitWith(mysteryIds: string[], bystander?: UpsertBystanderRequest): BystanderFormSubmit {
  return {
    bystander: bystander ?? { name: 'Bystander', description: null, bystanderTypeId: 'bt1' },
    mysteryIds,
  };
}

describe('BystanderDetailComponent', () => {
  let component: BystanderDetailComponent;
  let fixture: ComponentFixture<BystanderDetailComponent>;
  let putSubject: Subject<unknown>;
  let updateCalls: { bystanderId: string; payload: UpsertBystanderRequest }[] = [];
  let linkCalls: { mysteryId: string; id: string }[] = [];
  let unlinkCalls: { mysteryId: string; id: string }[] = [];
  let successCalls = 0;
  let errorMessages: string[] = [];
  /**
   * What `getById` currently answers. Mutable so that a test can open the page against a server
   * that already holds a membership, which is the only way to reach the load path — every other
   * test here sets `component.bystander` directly and never exercises it.
   */
  let serverBystander: BystanderDetailResponse = loadedBystander;
  /** Counts `getById`, so the save-path refetch can be told apart from the initial load. */
  let getByIdCalls = 0;

  beforeEach(async () => {
    putSubject = new Subject();
    serverBystander = loadedBystander;
    getByIdCalls = 0;
    updateCalls = [];
    linkCalls = [];
    unlinkCalls = [];
    successCalls = 0;
    errorMessages = [];

    await TestBed.configureTestingModule({
      imports: [BystanderDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ bystanderId: 'b1' })),
          },
        },
        {
          provide: BystanderService,
          useValue: {
            getById: () => {
              getByIdCalls += 1;
              return of(serverBystander);
            },
            update: (bystanderId: string, payload: UpsertBystanderRequest) => {
              updateCalls.push({ bystanderId, payload });
              return putSubject;
            },
            linkToMystery: (mysteryId: string, id: string) => {
              linkCalls.push({ mysteryId, id });
              return of(undefined as void);
            },
            unlinkFromMystery: (mysteryId: string, id: string) => {
              unlinkCalls.push({ mysteryId, id });
              return of(undefined as void);
            },
          },
        },
        {
          provide: MysteryService,
          useValue: { getMysteries: () => of(mysteries) },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getBystanderTypes: () => of([{ id: 'bt1', name: 'Witness', motivation: 'Test' }]),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: () => {
              successCalls += 1;
            },
            error: (message: string) => errorMessages.push(message),
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BystanderDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function sharedForm(): BystanderFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(BystanderFormComponent));
    expect(debugElement).toBeTruthy();
    return debugElement.componentInstance as BystanderFormComponent;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the shared bystander form instead of its own core-fields form', () => {
    expect(fixture.nativeElement.querySelector('app-bystander-form')).toBeTruthy();
    expect((component as unknown as Record<string, unknown>)['form']).toBeUndefined();
  });

  it('passes the loaded bystander and a Save Bystander label down to the shared form', () => {
    const instance = sharedForm();
    expect(component.bystander()).not.toBeNull();
    expect(instance.bystander).toBe(loadedBystander);
    expect(instance.submitLabel).toBe('Save Bystander');
    expect(instance.bystanderTypes).toEqual([{ id: 'bt1', name: 'Witness', motivation: 'Test' }]);
    expect(instance.bystanderForm.getRawValue()).toEqual({
      name: 'Bystander',
      description: '',
      bystanderTypeId: 'bt1',
      mysteryIds: [],
    });
  });

  it('loads the mystery list and hands it to the form as picker options', () => {
    expect(component.mysteries()).toEqual(mysteries);
    expect(sharedForm().mysteries).toEqual(mysteries);
  });

  it('saves through the shared form output when the form is submitted with valid values', () => {
    const instance = sharedForm();
    instance.bystanderForm.setValue({
      name: 'Renamed',
      description: '',
      bystanderTypeId: 'bt1',
      mysteryIds: [],
    });

    const form = fixture.nativeElement.querySelector('app-bystander-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(updateCalls).toEqual([
      {
        bystanderId: 'b1',
        payload: {
          name: 'Renamed',
          description: null,
          bystanderTypeId: 'bt1',
        },
      },
    ]);
  });

  it('does not call update when no bystander has been loaded', () => {
    component.bystander.set(null);

    component.save(submitWith([]));

    expect(updateCalls).toEqual([]);
  });

  it('tracks save loading state and sends success toast', () => {
    component.save(submitWith([]));
    expect(component.isSaving()).toBe(true);

    putSubject.next({ ...loadedBystander, mysteryIds: ['m1'] });
    putSubject.complete();

    expect(component.isSaving()).toBe(false);
    expect(successCalls).toBe(1);
  });

  /**
   * **Was `it('leaves the read-only custom moves list rendering')`**, asserting `'No custom moves.'`
   * — the copy of the bare heading-and-list this page shipped with before Phase 5d of
   * domain-custom-moves replaced it with `app-custom-moves-card`.
   *
   * Replaced rather than patched, for the reason its location twin was in 5c: **it encoded a current
   * state as a requirement.** It passed happily through the whole period when custom moves were
   * unauthorable here and would have kept passing forever — the third instance of that shape in
   * this subsystem. The replacement asserts a property the page is actually required to have.
   *
   * The authoring behaviour itself is covered in `bystander-detail.custom-moves.spec.ts`.
   */
  it('mounts the custom-moves card, wired to this domain', () => {
    const card = (fixture.nativeElement as HTMLElement).querySelector('[data-custom-moves-card]');

    expect(card).not.toBeNull();
    expect(card!.getAttribute('data-owner-type')).toBe('Bystander');
    expect(fixture.nativeElement.textContent).toContain('Custom Moves');
    expect(fixture.nativeElement.textContent).toContain('No custom moves yet.');
  });

  // --- membership (mystery-entity-linking.md §4.3) -------------------------------------

  it('issues no membership calls at all when the selection is unchanged', () => {
    component.bystander.set({ ...loadedBystander, mysteryIds: ['m1', 'm2'] });

    component.save(submitWith(['m1', 'm2']));
    putSubject.next({ ...loadedBystander, mysteryIds: ['m1', 'm2'] });

    expect(updateCalls).toHaveLength(1);
    expect(linkCalls).toEqual([]);
    expect(unlinkCalls).toEqual([]);
  });

  it('PUTs the added memberships and DELETEs the removed ones in a single save', () => {
    component.bystander.set({ ...loadedBystander, mysteryIds: ['m1', 'm2'] });

    component.save(submitWith(['m2', 'm3']));
    putSubject.next({ ...loadedBystander, mysteryIds: ['m1', 'm2'] });

    expect(linkCalls).toEqual([{ mysteryId: 'm3', id: 'b1' }]);
    expect(unlinkCalls).toEqual([{ mysteryId: 'm1', id: 'b1' }]);
  });

  it('unlinks every mystery when the picker is emptied', () => {
    component.bystander.set({ ...loadedBystander, mysteryIds: ['m1', 'm2'] });

    component.save(submitWith([]));
    putSubject.next({ ...loadedBystander, mysteryIds: ['m1', 'm2'] });

    expect(linkCalls).toEqual([]);
    expect(unlinkCalls).toEqual([
      { mysteryId: 'm1', id: 'b1' },
      { mysteryId: 'm2', id: 'b1' },
    ]);
  });

  it('does not carry mysteryIds in the entity PUT body', () => {
    component.bystander.set({ ...loadedBystander, mysteryIds: ['m1'] });

    component.save(submitWith(['m1', 'm2']));

    expect(updateCalls[0].payload).toEqual({ name: 'Bystander', description: null, bystanderTypeId: 'bt1' });
    expect(Object.keys(updateCalls[0].payload)).not.toContain('mysteryIds');
  });

  it('refetches after a successful save and rehydrates the form from server truth, not from the payload', () => {
    component.bystander.set({ ...loadedBystander, mysteryIds: ['m1'] });
    const loadCount = getByIdCalls;
    // What the server holds once the save has landed.
    serverBystander = { ...loadedBystander, mysteryIds: ['m2'] };

    component.save(submitWith(['m2']));
    putSubject.next({ ...loadedBystander, mysteryIds: ['m1'] });
    fixture.detectChanges();

    expect(getByIdCalls).toBe(loadCount + 1);
    expect(component.bystander()).toBe(serverBystander);
    expect(sharedForm().bystanderForm.controls.mysteryIds.value).toEqual(['m2']);
  });

  it('shows what the server actually holds, not what was asked for, when the two differ', () => {
    component.bystander.set({ ...loadedBystander, mysteryIds: [] });
    // The user asked for m1 and m2; only m1 landed.
    serverBystander = { ...loadedBystander, mysteryIds: ['m1'] };

    component.save(submitWith(['m1', 'm2']));
    putSubject.next({ ...loadedBystander, mysteryIds: [] });
    fixture.detectChanges();

    expect(component.bystander()?.mysteryIds).toEqual(['m1']);
    expect(sharedForm().bystanderForm.controls.mysteryIds.value).toEqual(['m1']);
  });

  // "Membership survives a reload", which nothing above reaches: every membership test here
  // starts from component.bystander.set(...), so they all assume the load already happened. This
  // is the other half of the round trip — the server holds what an earlier save wrote, the page
  // is opened fresh, and the picker must come back ticked from GET /api/bystanders/{id} rather
  // than from anything left in memory.
  it('hydrates the picker from the loaded bystander, so saved membership survives a reload', () => {
    serverBystander = { ...loadedBystander, mysteryIds: ['m1', 'm3'] };

    const reloaded = TestBed.createComponent(BystanderDetailComponent);
    reloaded.detectChanges();

    const reloadedForm = reloaded.debugElement.query(By.directive(BystanderFormComponent))
      .componentInstance as BystanderFormComponent;
    expect(reloadedForm.bystanderForm.controls.mysteryIds.value).toEqual(['m1', 'm3']);

    // And the reloaded page's idea of "already linked" is the loaded set, not an empty one: an
    // untouched save re-issues nothing. Without this, a reload-then-save would re-PUT every
    // existing membership, which is harmless only because the verb happens to be idempotent.
    reloaded.componentInstance.save(submitWith(['m1', 'm3']));
    putSubject.next(serverBystander);

    expect(linkCalls).toEqual([]);
    expect(unlinkCalls).toEqual([]);
  });

  // Toad's characterisation of the concurrent-attachment case, kept, with its second half
  // updated: the page no longer goes stale, because the save now ends in a refetch (UX §9.5.2).
  //
  // The first half is the load-bearing one and is unchanged. With the page diffing against the
  // mysteryIds it loaded, a membership attached elsewhere after this page opened is invisible to
  // it — and the direction matters, being the opposite of the pessimistic reading: removals are
  // drawn from the *loaded* set, so the concurrent attachment is never in `removed` and is not
  // deleted. If that expectation ever fails, removals have been widened beyond the loaded set
  // and this page has started destroying memberships it never knew about.
  //
  // The second half used to be "the page's picture of it goes stale", because the save merged
  // the desired set locally. The refetch replaces that merge with server truth, so the page now
  // picks the concurrent attachment up on the same save rather than needing a reload.
  it('does not unlink a membership attached elsewhere since page open, and now re-reads it', () => {
    // Page opened while the bystander was in m1 alone. Elsewhere, afterwards, it was also
    // attached to m3 — which this page's picker has no way of knowing.
    component.bystander.set({ ...loadedBystander, mysteryIds: ['m1'] });
    // Server truth once this save lands: m1 removed, m2 added, m3 still there from elsewhere.
    serverBystander = { ...loadedBystander, mysteryIds: ['m2', 'm3'] };

    // The user swaps m1 for m2 and saves.
    component.save(submitWith(['m2']));
    putSubject.next({ ...loadedBystander, mysteryIds: ['m1'] });
    fixture.detectChanges();

    expect(linkCalls).toEqual([{ mysteryId: 'm2', id: 'b1' }]);
    // m1 goes because the user deselected it. m3 is untouched: it was never in the loaded set.
    expect(unlinkCalls).toEqual([{ mysteryId: 'm1', id: 'b1' }]);
    // And the page shows m2 *and* m3 without a reload, rather than the desired set alone.
    expect(component.bystander()?.mysteryIds).toEqual(['m2', 'm3']);
    expect(sharedForm().bystanderForm.controls.mysteryIds.value).toEqual(['m2', 'm3']);
  });

  // --- partial membership failure (UX §9.5.2) -----------------------------------------

  it('hedges the caveat copy rather than asserting the whole fan-out failed', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.bystander.set({ ...loadedBystander, mysteryIds: [] });

    component.save(submitWith(['m1']));
    putSubject.next({ ...loadedBystander, mysteryIds: [] });

    expect(component.isSaving()).toBe(false);
    expect(errorMessages).toEqual([
      'Bystander saved, but some of its mysteries may not have saved. Review them below and save again.',
    ]);
    expect(successCalls).toBe(0);
  });

  it('keeps the caveat to a toast so the form stays mounted and retryable', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.bystander.set({ ...loadedBystander, mysteryIds: [] });

    component.save(submitWith(['m1']));
    putSubject.next({ ...loadedBystander, mysteryIds: [] });
    fixture.detectChanges();

    // `bystander-detail.html`'s `@else if (errorMessage())` branch precedes the content branch,
    // so a non-null errorMessage here would unmount the form and leave nothing to retry into.
    expect(component.errorMessage()).toBeNull();
    expect(fixture.nativeElement.querySelector('app-bystander-form')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-mystery-select')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('refetches after a partial failure too, so the control answers "which ones failed?"', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.bystander.set({ ...loadedBystander, mysteryIds: [] });
    const loadCount = getByIdCalls;
    // m1 landed before the batch errored; m2 did not.
    serverBystander = { ...loadedBystander, mysteryIds: ['m1'] };

    component.save(submitWith(['m1', 'm2']));
    putSubject.next({ ...loadedBystander, mysteryIds: [] });
    fixture.detectChanges();

    expect(getByIdCalls).toBe(loadCount + 1);
    expect(sharedForm().bystanderForm.controls.mysteryIds.value).toEqual(['m1']);
  });

  // The regression the refetch exists for. `DELETE` on the membership URI is not idempotent in
  // status code — it 404s on repeat (architecture §4.1) — so a retry that recomputed `removed`
  // from a stale baseline would re-issue an already-applied unlink and fail forever.
  it('does not re-issue an already-applied unlink when the user saves again', () => {
    const bystanderService = TestBed.inject(BystanderService);
    const unlinkSpy = vi
      .spyOn(bystanderService, 'unlinkFromMystery')
      .mockImplementationOnce((mysteryId: string, id: string) => {
        unlinkCalls.push({ mysteryId, id });
        return of(undefined as void);
      })
      .mockImplementationOnce(() => throwError(() => new Error('nope')));

    // Loaded with m1 and m2; the user clears both. The m1 unlink lands, the m2 unlink fails.
    component.bystander.set({ ...loadedBystander, mysteryIds: ['m1', 'm2'] });
    serverBystander = { ...loadedBystander, mysteryIds: ['m2'] };

    component.save(submitWith([]));
    putSubject.next({ ...loadedBystander, mysteryIds: ['m1', 'm2'] });
    fixture.detectChanges();

    expect(errorMessages).toHaveLength(1);
    // The refetch has reset the baseline to m2 alone, so the control no longer offers m1.
    expect(sharedForm().bystanderForm.controls.mysteryIds.value).toEqual(['m2']);

    // The user deselects m2 again and saves. Only m2 is unlinked — m1 is not retried.
    unlinkSpy.mockImplementation((mysteryId: string, id: string) => {
      unlinkCalls.push({ mysteryId, id });
      return of(undefined as void);
    });
    putSubject = new Subject();
    serverBystander = { ...loadedBystander, mysteryIds: [] };

    component.save(submitWith([]));
    putSubject.next(serverBystander);
    fixture.detectChanges();

    expect(unlinkCalls).toEqual([
      { mysteryId: 'm1', id: 'b1' },
      { mysteryId: 'm2', id: 'b1' },
    ]);
    expect(errorMessages).toHaveLength(1);
    expect(successCalls).toBe(1);
  });

  it('reports the plain save failure when the entity PUT itself fails', () => {
    component.bystander.set({ ...loadedBystander, mysteryIds: [] });

    component.save(submitWith(['m1']));
    putSubject.error(new Error('nope'));

    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBe('Unable to save bystander.');
    expect(linkCalls).toEqual([]);
  });
});
