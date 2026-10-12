import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { LocationService } from '../../../../core/location';
import { CustomMoveResponse, LocationDetailResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { LocationDetailComponent } from './location-detail';

/**
 * Custom moves on `location-detail` — Phase 5c (architecture.md §29.1, §29.3, §29.5).
 *
 * **The first sub-phase that genuinely diverged**, and most of what it carried is asserted
 * elsewhere rather than here: the `pendingDelete` migration in `location-detail.images.spec.ts` and
 * `resource-images-four-domain-parity.spec.ts`, the copy convergence in `location-create.spec.ts`,
 * and the card replacing the old read-only block in `location-detail.spec.ts`. What is left for
 * this file is the same thing 5a and 5b assert: that the authoring surface works and that a failure
 * cannot take the page down with it.
 *
 * Written out, not `sed`-derived, per 5b's ruling — and it earned it again. A rename from the
 * monster spec would have carried `monsterArchetype`, a `MinionService` provider, and a
 * `mysteryIds: []` that `LocationDetailResponse` does want but for a different reason.
 */

const move = (id: string, name: string, description: string | null = null): CustomMoveResponse => ({
  id,
  name,
  description,
});

const baseLocation: LocationDetailResponse = {
  id: 'l1',
  mysteryIds: [],
  name: 'The Old Mill',
  description: null,
  locationTypeId: 'lt1',
  locationTypeName: 'Lair',
  locationTypeMotivation: 'to collapse',
  customMoves: [move('cm1', 'Reach Through', 'On a 10+, choose two.'), move('cm2', 'Whisper')],
};

describe('LocationDetailComponent — custom moves', () => {
  let fixture: ComponentFixture<LocationDetailComponent>;
  let component: LocationDetailComponent;

  let sent: string[];
  let errorToasts: string[];
  let successToasts: string[];
  let failing: string | null;
  let currentLocation: LocationDetailResponse;

  beforeEach(async () => {
    sent = [];
    errorToasts = [];
    successToasts = [];
    failing = null;
    currentLocation = baseLocation;

    const record = <T>(name: string, result: () => T) =>
      (...args: unknown[]): Observable<T> =>
        defer(() => {
          sent.push(`${name}(${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`);
          return failing === name ? throwError(() => new Error('boom')) : of(result());
        });

    await TestBed.configureTestingModule({
      imports: [LocationDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ locationId: 'l1' })) } },
        {
          provide: LocationService,
          // `getById` is recorded, so each ledger shows the refetch as well as the write.
          useValue: {
            getById: record('getById', () => currentLocation),
            update: () => of(currentLocation),
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
          },
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
        { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
        { provide: ReferenceDataService, useValue: { getLocationTypes: () => of([]) } },
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

    fixture = TestBed.createComponent(LocationDetailComponent);
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

  describe('replacing the read-only block', () => {
    it('renders the embedded customMoves as an authorable card, with no request', () => {
      expect(all('[data-move-key]').map((li) => li.getAttribute('data-move-key'))).toEqual(['cm1', 'cm2']);
      expect(card().getAttribute('data-owner-type')).toBe('Location');
      expect(sent).toEqual([]);
    });

    it('renders descriptions, which this page never showed before', () => {
      // The old block was name-only: `<li>{{ move.name }}</li>`. `description` was rendered
      // nowhere in the app before this feature.
      const paragraphs = all('[data-custom-moves-card] [data-move-key] p');
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].textContent).toContain('On a 10+, choose two.');
      expect(paragraphs[0].className).toContain('whitespace-pre-wrap');
    });

    it('keeps its position below the form, where this page always put it', () => {
      const order = all('h2, h3, app-location-form').map((node) =>
        node.tagName === 'APP-LOCATION-FORM' ? 'form' : node.textContent!.trim()
      );
      // The same order `location-detail.images.spec.ts` asserts, which is why that spec needed no
      // edit: the card keeps an `<h3>Custom Moves</h3>` at exactly the old block's position.
      expect(order).toEqual(['The Old Mill', 'Images', 'form', 'Custom Moves']);
    });

    it('namespaces its probe attributes, so they do not collide with the images card', () => {
      const imagesEmptyState = el('[data-empty-state]');
      if (imagesEmptyState) {
        expect(imagesEmptyState.closest('[data-custom-moves-card]')).toBeNull();
      }
      expect(all('[data-custom-moves-empty]')).toHaveLength(0); // this fixture has two moves
    });
  });

  describe('writing', () => {
    it('adds through POST with the trimmed body, then refetches and reports', () => {
      type('[data-move-name]', '  Hollow Out  ');
      type('[data-move-description]', '  On a miss.  ');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(sent).toEqual([
        'create(Location,l1,{"name":"Hollow Out","description":"On a miss."})',
        'getById(l1)',
      ]);
      expect(successToasts).toEqual(['Custom move added.']);
    });

    it('edits through PUT at that row’s id, not POST', () => {
      el('[data-move-key="cm1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      type('[data-move-name]', 'Reach Further');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      expect(sent).toEqual([
        'update(Location,l1,cm1,{"name":"Reach Further","description":"On a 10+, choose two."})',
        'getById(l1)',
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

    it('fires exactly one write per commit — no duplicate arm', () => {
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();

      expect(sent.filter((c) => c.startsWith('create('))).toHaveLength(1);
    });
  });

  describe('the migrated mutation state', () => {
    /**
     * **The reason `isSaving` became `activeMutation`** (§26.2 L4): the banner printed a
     * hard-coded *"Saving location..."* whenever the flag was set, so the moment a second kind of
     * write existed it would have announced the wrong thing. Asserted by holding a write open —
     * `pending` never completes — and reading what the banner actually says.
     */
    it('announces what is in flight, not always "Saving location..."', () => {
      let release!: (value: CustomMoveResponse) => void;
      const pending = new Promise<CustomMoveResponse>((resolve) => (release = resolve));
      const service = TestBed.inject(CustomMoveService) as unknown as Record<string, unknown>;
      service['create'] = () => defer(() => pending);

      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      // In flight: the message is the custom-move one, not the entity-save one.
      expect(component.activeMutation()).toBe('Saving changes...');
      expect(el('p.text-primary.font-semibold')!.textContent!.trim()).toBe('Saving changes...');
      expect(el('p.text-primary.font-semibold')!.textContent).not.toContain('Saving location...');

      release(move('cm3', 'Hollow Out'));
    });

    it('still says "Saving location..." for the entity save, which is what it always meant', () => {
      component.activeMutation.set('Saving location...');
      fixture.detectChanges();

      expect(el('p.text-primary.font-semibold')!.textContent!.trim()).toBe('Saving location...');
    });

    it('still exposes isSaving, because shipped specs outside this phase read it', () => {
      // Kept as a computed alias of `isMutating` rather than editing six assertions in two specs
      // this phase was not scoped to touch. Same value, same meaning.
      expect(component.isSaving()).toBe(component.isMutating());
      expect(component.isSaving()).toBe(false);
    });

    it('disables the card while a write is in flight', () => {
      component.activeMutation.set('Saving changes...');
      fixture.detectChanges();

      expect((el('[data-submit-move]') as HTMLButtonElement).disabled).toBe(true);
      expect((el('[data-move-key="cm1"] [data-remove-move]') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('removing, through the page’s newly-owned modal', () => {
    it('routes through one modal and deletes only on confirm', () => {
      el('[data-move-key="cm2"] [data-remove-move]')!.click();
      fixture.detectChanges();

      expect(all('app-confirm-delete-modal')).toHaveLength(1);
      expect(component.pendingDelete()!.label).toBe('Whisper');
      expect(sent).toEqual([]);

      component.onDeleteConfirmed();
      fixture.detectChanges();

      expect(sent).toEqual(['delete(Location,l1,cm2)', 'getById(l1)']);
    });

    it('shares that one modal with the image flow — the whole point of the migration', () => {
      // Two delete flows, one modal, one pending concept. Before 5c the modal read straight off
      // `imagesStore.pendingDelete()`, which could not have carried a custom-move row.
      el('[data-move-key="cm1"] [data-remove-move]')!.click();
      expect(component.pendingDelete()!.footnote).toBeUndefined();
      component.onDeleteCancelled();

      expect(component.pendingDelete()).toBeNull();
      expect(typeof component.requestDeleteImage).toBe('function');
    });

    it('sends nothing when the modal is cancelled', () => {
      el('[data-move-key="cm1"] [data-remove-move]')!.click();
      component.onDeleteCancelled();

      expect(sent).toEqual([]);
    });
  });

  describe('a failed write', () => {
    it('leaves the page mounted, reports once, and keeps the typing for a retry', () => {
      failing = 'create';
      type('[data-move-name]', 'Hollow Out');
      el('[data-submit-move]')!.click();
      fixture.detectChanges();

      // This page's template orders `@else if (errorMessage())` ahead of its content branch, and
      // `save()` has documented that hazard since 5b of mystery-entity-linking. The custom-move
      // pipeline keeps `errorMessage` null for the same reason.
      expect(component.errorMessage()).toBeNull();
      expect(el('h2')!.textContent).toContain('The Old Mill');
      expect(el('[data-custom-moves-card]')).not.toBeNull();
      expect(errorToasts).toEqual(['Unable to add custom move.']);
      expect(component.isMutating()).toBe(false);
      expect(field('[data-move-name]').value).toBe('Hollow Out');
    });

    it('survives a failed delete too', () => {
      failing = 'delete';
      el('[data-move-key="cm1"] [data-remove-move]')!.click();
      component.onDeleteConfirmed();
      fixture.detectChanges();

      expect(component.errorMessage()).toBeNull();
      expect(el('h2')!.textContent).toContain('The Old Mill');
      expect(errorToasts).toEqual(['Unable to delete custom move.']);
    });
  });

  it('never calls list() — hydration is the detail response, not a fetch', () => {
    type('[data-move-name]', 'Hollow Out');
    el('[data-submit-move]')!.click();
    fixture.detectChanges();

    expect(sent.filter((c) => c.startsWith('list('))).toEqual([]);
  });
});
