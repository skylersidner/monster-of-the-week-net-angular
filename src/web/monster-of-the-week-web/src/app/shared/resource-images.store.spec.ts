import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ResourceImageResponse } from '../core/models';
import { ResourceImageService } from '../core/resource-images';
import { ResourceImagesStore } from './resource-images.store';

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
    createdAt: '2026-10-05T00:00:00Z',
  };
}

/** The store is component-scoped (`providers: [ResourceImagesStore]`), so it is tested the same way. */
@Component({ template: '', providers: [ResourceImagesStore] })
class HostComponent {
  readonly store = inject(ResourceImagesStore);
}

describe('ResourceImagesStore', () => {
  let store: ResourceImagesStore;
  let list: () => Observable<ResourceImageResponse[]>;
  let del: () => Observable<void>;
  let put: () => Observable<void>;
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    list = () => of([imageFixture('c', 3), imageFixture('a', 1), imageFixture('b', 2, true)]);
    del = () => of(void 0);
    put = () => of(void 0);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ResourceImageService,
          useValue: {
            list: (ownerType: string, ownerId: string) => {
              calls.push(`list ${ownerType} ${ownerId}`);
              return list();
            },
            delete: (_t: string, _o: string, imageId: string) => {
              calls.push(`delete ${imageId}`);
              return del();
            },
            setPrimary: (_t: string, _o: string, imageId: string) => {
              calls.push(`primary ${imageId}`);
              return put();
            },
          },
        },
      ],
    });
    store = TestBed.createComponent(HostComponent).componentInstance.store;
  });

  it('loads in SortOrder, seeds primary from the server’s isPrimary, and starts on the primary', () => {
    store.load('Monster', 'm1', 'The Hex');

    expect(calls).toEqual(['list Monster m1']);
    expect(store.images().map((image) => image.id)).toEqual(['a', 'b', 'c']);
    expect(store.primaryImageId()).toBe('b');
    expect(store.activeImageId()).toBe('b');
    expect(store.count()).toBe(3);
    expect(store.isLoading()).toBe(false);
  });

  it('derives the primary when no row says isPrimary', () => {
    list = () => of([imageFixture('b', 2), imageFixture('a', 1)]);
    store.load('Monster', 'm1', 'The Hex');
    expect(store.primaryImageId()).toBe('a');
  });

  it('a load failure is an inline section error', () => {
    list = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    store.load('Monster', 'm1', 'The Hex');
    expect(store.errorMessage()).toBe('Unable to load images.');
    expect(store.isLoading()).toBe(false);
  });

  describe('upload', () => {
    it('merges new images, keeps the existing primary, and activates the first image of the new batch', () => {
      store.load('Monster', 'm1', 'The Hex');
      store.applyUpload({ attempted: 2, uploaded: [imageFixture('e', 5), imageFixture('d', 4)], rejected: [] });

      expect(store.images().map((image) => image.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
      expect(store.primaryImageId()).toBe('b');
      expect(store.activeImageId()).toBe('d');
    });

    it('takes the first upload as primary when the owner had no images', () => {
      list = () => of([]);
      store.load('Monster', 'm1', 'The Hex');
      store.applyUpload({ attempted: 1, uploaded: [imageFixture('x', 1, true)], rejected: [] });

      expect(store.primaryImageId()).toBe('x');
      expect(store.activeImageId()).toBe('x');
    });

    it('an all-rejected outcome changes nothing', () => {
      store.load('Monster', 'm1', 'The Hex');
      store.setActive('c');
      store.applyUpload({ attempted: 1, uploaded: [], rejected: [{ fileName: 'z.gif', reason: 'UnsupportedType' }] });

      expect(store.count()).toBe(3);
      expect(store.activeImageId()).toBe('c');
    });
  });

  describe('set primary', () => {
    it('updates the primary in place and leaves the active slide alone', () => {
      store.load('Monster', 'm1', 'The Hex');
      store.setActive('c');
      store.setPrimary('c');

      expect(calls).toContain('primary c');
      expect(store.primaryImageId()).toBe('c');
      expect(store.activeImageId()).toBe('c');
      expect(store.isMutating()).toBe(false);
    });

    it('does not call the API for the image that is already primary', () => {
      store.load('Monster', 'm1', 'The Hex');
      store.setPrimary('b');
      expect(calls).not.toContain('primary b');
    });

    it('a failure is an inline error and the primary is unchanged', () => {
      put = () => throwError(() => new HttpErrorResponse({ status: 500 }));
      store.load('Monster', 'm1', 'The Hex');
      store.setPrimary('c');

      expect(store.primaryImageId()).toBe('b');
      expect(store.errorMessage()).toBe('Unable to set the primary image.');
    });
  });

  describe('delete', () => {
    beforeEach(() => store.load('Monster', 'm1', 'The Hex'));

    it('requestDelete opens the modal state with the footnote naming the replacement', () => {
      store.requestDelete(store.images()[1]); // b, the primary

      expect(store.pendingDelete()!.image.id).toBe('b');
      expect(store.pendingDelete()!.footnote).toBe(
        "This is the current primary image. After it's deleted, a.webp becomes primary instead.",
      );
      expect(calls).not.toContain('delete b');
    });

    it('cancel clears the modal without deleting', () => {
      store.requestDelete(store.images()[0]);
      store.cancelDelete();

      expect(store.pendingDelete()).toBeNull();
      expect(calls.filter((call) => call.startsWith('delete'))).toEqual([]);
    });

    it('confirming deletes, re-derives the primary, and moves to the next slide', () => {
      store.setActive('b');
      store.requestDelete(store.images()[1]);
      store.confirmDelete();

      expect(calls).toContain('delete b');
      expect(store.images().map((image) => image.id)).toEqual(['a', 'c']);
      expect(store.primaryImageId()).toBe('a'); // first-uploaded remaining, as the footnote said
      expect(store.activeImageId()).toBe('c'); // next in SortOrder
      expect(store.pendingDelete()).toBeNull();
    });

    it('deleting a non-primary keeps the primary', () => {
      store.setActive('c');
      store.requestDelete(store.images()[2]);
      expect(store.pendingDelete()!.footnote).toBe('');
      store.confirmDelete();

      expect(store.primaryImageId()).toBe('b');
      expect(store.activeImageId()).toBe('b'); // c was last, so the new last image
    });

    it('a 404 counts as already gone', () => {
      del = () => throwError(() => new HttpErrorResponse({ status: 404 }));
      store.requestDelete(store.images()[0]);
      store.confirmDelete();

      expect(store.images().map((image) => image.id)).toEqual(['b', 'c']);
      expect(store.errorMessage()).toBeNull();
    });

    it('any other failure keeps the image and shows the inline error', () => {
      del = () => throwError(() => new HttpErrorResponse({ status: 500 }));
      store.requestDelete(store.images()[0]);
      store.confirmDelete();

      expect(store.count()).toBe(3);
      expect(store.errorMessage()).toBe('Unable to delete image.');
    });

    it('is busy while the delete is in flight', () => {
      const pending = new Subject<void>();
      del = () => pending.asObservable();
      store.requestDelete(store.images()[0]);
      store.confirmDelete();

      expect(store.isMutating()).toBe(true);
      expect(store.activeMutation()).toBe('Deleting image...');
      pending.next();
      pending.complete();
      expect(store.isMutating()).toBe(false);
    });

    it('the last-image footnote uses the current owner name', () => {
      list = () => of([imageFixture('only', 1, true)]);
      store.load('Location', 'l1', 'Old Mill');
      store.setOwnerName('The Old Mill');
      store.requestDelete(store.images()[0]);

      expect(store.pendingDelete()!.footnote).toBe('This is the last image. The Old Mill will have no images afterward.');
    });
  });
});
