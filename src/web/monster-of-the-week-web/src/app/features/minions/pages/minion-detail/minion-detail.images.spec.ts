import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { MinionDetailResponse, ResourceImageResponse } from '../../../../core/models';
import { MinionService } from '../../../../core/minion';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ResourceImageService } from '../../../../core/resource-images';
import { MinionDetailComponent } from './minion-detail';

/**
 * Phase 6b: the Images section on `minion-detail`. The shared components have their own specs, so
 * what is under test here is the wiring — §4.1.1 placement on a page whose identity header is a
 * "Belongs to" sentence rather than a badge row, the store binding, the footnote reaching this
 * page's one modal through `deleteFootnoteFor`/`deleteImage`, and writes staying clear of the
 * page's own `activeMutation`.
 */

const loadedMinion: MinionDetailResponse = {
  id: 'mn1',
  monsterId: 'mo1',
  monsterName: 'The Beast',
  name: 'Rusted Blade',
  description: null,
  harmCapacity: 3,
  minionType: { id: 'mt1', name: 'Torturer', motivation: 'dominate' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
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

describe('MinionDetailComponent — Images section (Phase 6b)', () => {
  let fixture: ComponentFixture<MinionDetailComponent>;
  let component: MinionDetailComponent;
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
      imports: [MinionDetailComponent],
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
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ minionId: 'mn1' })) } },
        {
          provide: MinionService,
          useValue: {
            getById: () => of(loadedMinion),
            update: () => of(loadedMinion),
            deleteAttack: () => of(void 0),
            deletePower: () => of(void 0),
            deleteArmor: () => of(void 0),
            deleteWeakness: () => of(void 0),
          },
        },
        { provide: ReferenceDataService, useValue: { getMinionTypes: () => of([]), getWeaponTags: () => of([]) } },
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

    fixture = TestBed.createComponent(MinionDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('placement (design.md §4.1.1)', () => {
    it('closes the identity header: title, the Belongs-to sentence, then Images, then the form', () => {
      const order = all('h2, h3, p, app-minion-form')
        .map((node) => {
          if (node.tagName === 'APP-MINION-FORM') return 'form';
          if (node.tagName === 'H2') return 'title';
          if (node.tagName === 'H3') return node.textContent!.trim();
          return node.textContent!.includes('Belongs to:') ? 'belongs-to' : null;
        })
        .filter((entry): entry is string => entry !== null);

      expect(order.slice(0, 4)).toEqual(['title', 'belongs-to', 'Images', 'form']);
    });

    it('owns the Minion domain, not Monster', () => {
      expect(query('app-resource-images-card')!.getAttribute('ownertype')).toBe('Minion');
      expect(query('app-image-carousel')!.getAttribute('ownertype')).toBe('Minion');
    });

    it('renders the card and carousel, with the upload modal closed until asked for', () => {
      expect(query('[data-images-card]')).not.toBeNull();
      expect(query('[data-carousel]')).not.toBeNull();
      expect(query('[data-upload-modal]')).toBeNull();
    });
  });

  describe('store binding', () => {
    it('loads this minion’s images and seeds the primary from the server’s isPrimary', () => {
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
      const second = TestBed.createComponent(MinionDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      expect(host.querySelector('[data-images-error]')!.textContent!.trim()).toBe('Unable to load images.');
      expect(host.querySelector('app-minion-form')).not.toBeNull();
      expect(host.querySelector('h2')!.textContent!.trim()).toBe('Rusted Blade');
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
      const second = TestBed.createComponent(MinionDetailComponent);
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

  describe('delete, through this page’s one modal (§6)', () => {
    function requestDeleteOfActive(): void {
      (query('[data-delete]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    it('reuses the page’s existing modal rather than adding a second', () => {
      requestDeleteOfActive();

      expect(all('[role="dialog"]').length).toBe(1);
      expect(text('[role="dialog"] h3')).toBe('Delete "b.webp"?');
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

    it('last-image branch names the minion and never mentions primary', () => {
      images = [imageFixture('only', 1, true)];
      const second = TestBed.createComponent(MinionDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      host.querySelector<HTMLButtonElement>('[data-delete]')!.click();
      second.detectChanges();

      const body = host.querySelector('[role="dialog"]')!.textContent!;
      expect(body).toContain('This is the last image. Rusted Blade will have no images afterward.');
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

    it('cancelling deletes nothing', () => {
      requestDeleteOfActive();
      dialogButton('Cancel').click();
      fixture.detectChanges();

      expect(deleteCalls).toEqual([]);
      expect(component.imagesStore.count()).toBe(3);
    });

    it('a failure shows the section’s inline error and keeps the image', () => {
      deleteResult = () => throwError(() => new Error('boom'));
      requestDeleteOfActive();
      dialogButton('Delete').click();
      fixture.detectChanges();

      expect(text('[data-images-error]')).toBe('Unable to delete image.');
      expect(component.imagesStore.count()).toBe(3);
      expect(component.errorMessage()).toBeNull();
      expect(query('app-minion-form')).not.toBeNull();
    });

    it('leaves the footnote undefined for a non-image delete', () => {
      component.requestDeleteAttack('at1', 'Rusted Edge');
      fixture.detectChanges();

      expect(component.pendingDelete()!.footnote).toBeUndefined();
      expect(text('[role="dialog"] h3')).toBe('Delete "Rusted Edge"?');
      expect((dialog()!.textContent!.match(/This cannot be undone\./g) ?? []).length).toBe(1);
    });
  });

  it('image writes stay clear of the page’s own activeMutation', () => {
    const pending = new Subject<void>();
    deleteResult = () => pending.asObservable();

    (query('[data-delete]') as HTMLButtonElement).click();
    fixture.detectChanges();
    dialogButton('Delete').click();
    fixture.detectChanges();

    expect(component.imagesStore.isMutating()).toBe(true);
    expect(component.activeMutation()).toBeNull();
    expect(component.isMutating()).toBe(false);

    pending.next();
    pending.complete();
    fixture.detectChanges();
    expect(component.imagesStore.isMutating()).toBe(false);
  });
});
