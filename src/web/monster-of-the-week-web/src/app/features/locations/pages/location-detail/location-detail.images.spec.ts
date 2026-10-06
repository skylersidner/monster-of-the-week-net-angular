import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { LocationService } from '../../../../core/location';
import { LocationDetailResponse, ResourceImageResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ResourceImageService } from '../../../../core/resource-images';
import { LocationDetailComponent } from './location-detail';

/**
 * Phase 6d: the Images section on `location-detail`. This page had no `pendingDelete`, no modal and
 * no mutation state before this sub-phase, so the delete infrastructure is new here — and the store
 * owns the pending state rather than the page, which is the one structural difference from Monster
 * and Minion. That choice is what these specs pin.
 */

const loadedLocation: LocationDetailResponse = {
  id: 'l1',
  mysteryIds: [],
  name: 'The Old Mill',
  description: null,
  locationTypeId: 'lt1',
  locationTypeName: 'Ruin',
  locationTypeMotivation: 'to collapse',
  customMoves: [],
};

function imageFixture(id: string, sortOrder: number, isPrimary = false): ResourceImageResponse {
  return {
    id,
    fileName: `${id}.webp`,
    contentType: 'image/webp',
    sizeBytes: 150_000,
    width: 1024,
    height: 1024,
    sortOrder,
    isPrimary,
    createdAt: '2026-10-06T00:00:00Z',
  };
}

describe('LocationDetailComponent — Images section (Phase 6d)', () => {
  let fixture: ComponentFixture<LocationDetailComponent>;
  let component: LocationDetailComponent;
  let images: ResourceImageResponse[];
  let listImages: () => Observable<ResourceImageResponse[]>;
  let deleteCalls: string[];
  let primaryCalls: string[];
  let deleteResult: () => Observable<void>;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const query = (selector: string): HTMLElement | null => element().querySelector<HTMLElement>(selector);
  const all = (selector: string): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>(selector));
  const text = (selector: string): string => query(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const dialog = (): HTMLElement | null => query('[role="dialog"]');
  const dialogButton = (label: string): HTMLButtonElement =>
    Array.from(dialog()!.querySelectorAll('button')).find((b) => b.textContent!.trim() === label) as HTMLButtonElement;

  beforeEach(async () => {
    images = [imageFixture('a', 1), imageFixture('b', 2, true), imageFixture('c', 3)];
    listImages = () => of(images);
    deleteCalls = [];
    primaryCalls = [];
    deleteResult = () => of(void 0);

    await TestBed.configureTestingModule({
      imports: [LocationDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ locationId: 'l1' })) } },
        {
          provide: LocationService,
          useValue: {
            getById: () => of(loadedLocation),
            update: () => of(loadedLocation),
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
          },
        },
        { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
        { provide: ReferenceDataService, useValue: { getLocationTypes: () => of([]) } },
        {
          provide: NotificationService,
          useValue: { success: () => {}, error: () => {}, notifications: () => [], dismiss: () => {} },
        },
        {
          provide: ResourceImageService,
          useValue: {
            list: () => listImages(),
            delete: (_t: string, _o: string, imageId: string) => {
              deleteCalls.push(imageId);
              return deleteResult();
            },
            setPrimary: (_t: string, _o: string, imageId: string) => {
              primaryCalls.push(imageId);
              return of(void 0);
            },
            upload: () => of({ uploaded: [], rejected: [] }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('placement (design.md §4.1.1)', () => {
    it('puts Images directly under the title, with Custom Moves still below the form', () => {
      const order = all('h2, h3, app-location-form').map((node) =>
        node.tagName === 'APP-LOCATION-FORM' ? 'form' : node.textContent!.trim(),
      );
      expect(order).toEqual(['The Old Mill', 'Images', 'form', 'Custom Moves']);
    });

    it('owns the Location domain', () => {
      expect(query('app-resource-images-card')!.getAttribute('ownertype')).toBe('Location');
      expect(query('app-image-carousel')!.getAttribute('ownertype')).toBe('Location');
    });

    it('renders the card and carousel, with the upload modal closed until asked for', () => {
      expect(query('[data-images-card]')).not.toBeNull();
      expect(query('[data-carousel]')).not.toBeNull();
      expect(query('[data-upload-modal]')).toBeNull();
    });
  });

  describe('store binding', () => {
    it('loads this location’s images and seeds the primary from the server’s isPrimary', () => {
      expect(component.imagesStore.images().map((image) => image.id)).toEqual(['a', 'b', 'c']);
      expect(component.imagesStore.primaryImageId()).toBe('b');
      expect(component.imagesStore.count()).toBe(3);
    });

    it('starts the carousel on the primary image', () => {
      expect(query('[data-slide="active"]')!.getAttribute('data-image-id')).toBe('b');
    });

    it('re-renders from store signals (the app is zoneless)', () => {
      component.imagesStore.setActive('c');
      fixture.detectChanges();
      expect(query('[data-slide="active"]')!.getAttribute('data-image-id')).toBe('c');
    });

    it('renders an image-list failure inline, leaving the page mounted', () => {
      listImages = () => throwError(() => new Error('boom'));
      const second = TestBed.createComponent(LocationDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      expect(host.querySelector('[data-images-error]')!.textContent!.trim()).toBe('Unable to load images.');
      expect(host.querySelector('app-location-form')).not.toBeNull();
      expect(host.querySelector('h2')!.textContent!.trim()).toBe('The Old Mill');
    });
  });

  describe('upload', () => {
    it('opens the modal from the card button and merges the result into the carousel', () => {
      (query('[data-add-images]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(query('[data-upload-modal]')).not.toBeNull();

      component.imagesStore.applyUpload({ attempted: 1, uploaded: [imageFixture('d', 4)], rejected: [] });
      fixture.detectChanges();

      expect(all('[data-slide]').length).toBe(4);
      expect(query('[data-slide="active"]')!.getAttribute('data-image-id')).toBe('d');
    });

    it('shows the 10/10 state and disables the button at the cap', () => {
      images = Array.from({ length: 10 }, (_, i) => imageFixture(`i${i}`, i + 1));
      const second = TestBed.createComponent(LocationDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      expect(host.querySelector<HTMLElement>('[data-at-cap]')!.textContent!.trim()).toBe(
        '10/10 images — delete one to add another',
      );
      expect(host.querySelector<HTMLButtonElement>('[data-add-images]')!.disabled).toBe(true);
    });
  });

  it('set-primary sends the request and leaves the active slide alone', () => {
    component.imagesStore.setActive('c');
    fixture.detectChanges();
    (query('[data-star]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(primaryCalls).toEqual(['c']);
    expect(component.imagesStore.primaryImageId()).toBe('c');
    expect(query('[data-slide="active"]')!.getAttribute('data-image-id')).toBe('c');
  });

  /**
   * The store owns the pending state on this page. These assert that choice directly: the page
   * carries no `pendingDelete` of its own, and the modal reads straight off the store.
   */
  describe('delete, with the store owning the modal state (§6)', () => {
    function requestDeleteOfActive(): void {
      (query('[data-delete]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    it('the page keeps no pending-delete state of its own', () => {
      expect((component as unknown as Record<string, unknown>)['pendingDelete']).toBeUndefined();
    });

    it('opens exactly one modal, named by fileName, without calling the API', () => {
      requestDeleteOfActive();

      expect(all('[role="dialog"]').length).toBe(1);
      expect(text('[role="dialog"] h3')).toBe('Delete "b.webp"?');
      expect(component.imagesStore.pendingDelete()!.image.id).toBe('b');
      expect(deleteCalls).toEqual([]);
    });

    it('still-has-images branch names the first-uploaded remaining image', () => {
      requestDeleteOfActive();

      expect(dialog()!.textContent).toContain(
        "This is the current primary image. After it's deleted, a.webp becomes primary instead.",
      );
    });

    it('not-primary branch renders no footnote', () => {
      component.imagesStore.setActive('c');
      fixture.detectChanges();
      requestDeleteOfActive();

      expect(component.imagesStore.pendingDelete()!.footnote).toBe('');
      expect(dialog()!.textContent).not.toContain('primary');
    });

    it('last-image branch names the location and never mentions primary', () => {
      images = [imageFixture('only', 1, true)];
      const second = TestBed.createComponent(LocationDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      host.querySelector<HTMLButtonElement>('[data-delete]')!.click();
      second.detectChanges();

      const body = host.querySelector('[role="dialog"]')!.textContent!;
      expect(body).toContain('This is the last image. The Old Mill will have no images afterward.');
      expect(body).not.toContain('primary');
    });

    it('confirming deletes, drops the slide and re-derives the primary', () => {
      requestDeleteOfActive();
      dialogButton('Delete').click();
      fixture.detectChanges();

      expect(deleteCalls).toEqual(['b']);
      expect(component.imagesStore.images().map((i) => i.id)).toEqual(['a', 'c']);
      expect(component.imagesStore.primaryImageId()).toBe('a');
      expect(all('[data-slide]').length).toBe(2);
      expect(dialog()).toBeNull();
    });

    it('cancelling deletes nothing and closes the modal', () => {
      requestDeleteOfActive();
      dialogButton('Cancel').click();
      fixture.detectChanges();

      expect(deleteCalls).toEqual([]);
      expect(component.imagesStore.count()).toBe(3);
      expect(dialog()).toBeNull();
    });

    it('a failure shows the section’s inline error and keeps the image', () => {
      deleteResult = () => throwError(() => new Error('boom'));
      requestDeleteOfActive();
      dialogButton('Delete').click();
      fixture.detectChanges();

      expect(text('[data-images-error]')).toBe('Unable to delete image.');
      expect(component.imagesStore.count()).toBe(3);
      expect(component.errorMessage()).toBeNull();
      expect(query('app-location-form')).not.toBeNull();
    });
  });

  it('image writes stay clear of the page’s own isSaving', () => {
    const pending = new Subject<void>();
    deleteResult = () => pending.asObservable();

    (query('[data-delete]') as HTMLButtonElement).click();
    fixture.detectChanges();
    dialogButton('Delete').click();
    fixture.detectChanges();

    expect(component.imagesStore.isMutating()).toBe(true);
    expect(component.isSaving()).toBe(false);

    pending.next();
    pending.complete();
    fixture.detectChanges();
    expect(component.imagesStore.isMutating()).toBe(false);
  });
});
