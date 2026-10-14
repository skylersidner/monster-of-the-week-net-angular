import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { BystanderService } from '../../../../core/bystander';
import { BystanderDetailResponse, ResourceImageResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ResourceImageService } from '../../../../core/resource-images';
import { BystanderDetailComponent } from './bystander-detail';

/**
 * Phase 6c: the Images section on `bystander-detail`. This page had no `pendingDelete`, no modal and
 * no mutation state before this sub-phase, so the delete infrastructure is new here — and the store
 * owns the pending state rather than the page, which is the one structural difference from Monster
 * and Minion. That choice is what these specs pin.
 */

const loadedBystander: BystanderDetailResponse = {
  id: 'b1',
  mysteryIds: [],
  name: 'Mrs. Alder',
  description: null,
  bystanderTypeId: 'bt1',
  bystanderTypeName: 'Witness',
  bystanderTypeMotivation: 'to reveal what they saw',
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

describe('BystanderDetailComponent — Images section (Phase 6c)', () => {
  let fixture: ComponentFixture<BystanderDetailComponent>;
  let component: BystanderDetailComponent;
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
      imports: [BystanderDetailComponent],
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
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ bystanderId: 'b1' })) } },
        {
          provide: BystanderService,
          useValue: {
            getById: () => of(loadedBystander),
            update: () => of(loadedBystander),
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
          },
        },
        { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
        { provide: ReferenceDataService, useValue: { getBystanderTypes: () => of([]) } },
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

    fixture = TestBed.createComponent(BystanderDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('placement (design.md §4.1.1)', () => {
    it('puts Images directly under the title, with Custom Moves still below the form', () => {
      const order = all('h2, h3, app-bystander-form').map((node) =>
        node.tagName === 'APP-BYSTANDER-FORM' ? 'form' : node.textContent!.trim(),
      );
      expect(order).toEqual(['Mrs. Alder', 'Images', 'form', 'Custom Moves']);
    });

    it('owns the Bystander domain', () => {
      expect(query('app-resource-images-card')!.getAttribute('ownertype')).toBe('Bystander');
      expect(query('app-image-carousel')!.getAttribute('ownertype')).toBe('Bystander');
    });

    it('renders the card and carousel, with the upload modal closed until asked for', () => {
      expect(query('[data-images-card]')).not.toBeNull();
      expect(query('[data-carousel]')).not.toBeNull();
      expect(query('[data-upload-modal]')).toBeNull();
    });
  });

  describe('store binding', () => {
    it('loads this bystander’s images and seeds the primary from the server’s isPrimary', () => {
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
      const second = TestBed.createComponent(BystanderDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      expect(host.querySelector('[data-images-error]')!.textContent!.trim()).toBe('Unable to load images.');
      expect(host.querySelector('app-bystander-form')).not.toBeNull();
      expect(host.querySelector('h2')!.textContent!.trim()).toBe('Mrs. Alder');
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
      const second = TestBed.createComponent(BystanderDetailComponent);
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
   * **The page owns the pending state, as of Phase 5d of domain-custom-moves** — and with this page
   * the migration finishes: all four image-bearing detail pages now own their record, and the
   * store's `requestDelete`/`confirmDelete`/`cancelDelete` wrapper has no production caller left.
   * These assertions were inverted rather than deleted, because *which object owns it* is still the
   * thing worth asserting; only the answer changed.
   *
   * **Why, in the general form rather than this page's narrow one** (Skyler, 2026-10-11): *a page
   * that gains a second kind of object to manage is better served moving state to the locus of
   * control than hooking into multiple stores — otherwise you end up hooked into several, when
   * moving the state would have been more straightforward.* Custom moves are that second object.
   * Decision 14 and the note this page used to carry on its `imagesStore` field were each the same
   * principle stated about one page and one modal; this is the version that still answers when
   * there is a third.
   *
   * The store still computes the footnote (`deleteFootnoteFor`) and performs the delete
   * (`deleteImage`) — only the *pending* state moved, which is what made this a rebinding rather
   * than a rewrite.
   */
  describe('delete, with the page owning the modal state (§6)', () => {
    function requestDeleteOfActive(): void {
      (query('[data-delete]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    it('the page owns the pending-delete record, and the store no longer holds it', () => {
      expect(typeof (component as unknown as Record<string, unknown>)['pendingDelete']).toBe('function');
      expect(component.pendingDelete()).toBeNull();
      // The store's wrapper is still there and still covered by `resource-images.store.spec.ts`;
      // after 5d it simply has no caller on any page.
      expect(component.imagesStore.pendingDelete()).toBeNull();
    });

    it('opens exactly one modal, named by fileName, without calling the API', () => {
      requestDeleteOfActive();

      expect(all('[role="dialog"]').length).toBe(1);
      expect(text('[role="dialog"] h3')).toBe('Delete "b.webp"?');
      expect(component.pendingDelete()!.label).toBe('b.webp');
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

      expect(component.pendingDelete()!.footnote).toBe('');
      expect(dialog()!.textContent).not.toContain('primary');
    });

    it('last-image branch names the bystander and never mentions primary', () => {
      images = [imageFixture('only', 1, true)];
      const second = TestBed.createComponent(BystanderDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      host.querySelector<HTMLButtonElement>('[data-delete]')!.click();
      second.detectChanges();

      const body = host.querySelector('[role="dialog"]')!.textContent!;
      expect(body).toContain('This is the last image. Mrs. Alder will have no images afterward.');
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
      expect(query('app-bystander-form')).not.toBeNull();
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
