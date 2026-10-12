import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { MinionService } from '../../../../core/minion';
import { MonsterDetailResponse, ResourceImageResponse } from '../../../../core/models';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ResourceImageService } from '../../../../core/resource-images';
import { MonsterDetailComponent } from './monster-detail';

/**
 * Phase 6a's Monster pilot: the Images section on `monster-detail`, and the §6 delete flow routed
 * through this page's single `<app-confirm-delete-modal>`. The shared components have their own
 * specs; what is under test here is the *wiring* — placement, store binding, the footnote reaching
 * the one modal, and persistence being independent of the page's Save button.
 */

const loadedMonster: MonsterDetailResponse = {
  id: 'mo1',
  mysteryIds: [],
  name: 'The Hollow Man',
  description: null,
  harmCapacity: 7,
  monsterTypeId: 'mt1',
  monsterTypeName: 'Beast',
  monsterArchetype: { id: 'ma1', name: 'Ghost', description: '' },
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

describe('MonsterDetailComponent — Images section (Phase 6a)', () => {
  let fixture: ComponentFixture<MonsterDetailComponent>;
  let component: MonsterDetailComponent;
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

  beforeEach(async () => {
    images = [imageFixture('a', 1), imageFixture('b', 2, true), imageFixture('c', 3)];
    listImages = () => of(images);
    deleteCalls = [];
    primaryCalls = [];
    deleteResult = () => of(void 0);

    await TestBed.configureTestingModule({
      imports: [MonsterDetailComponent],
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
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ monsterId: 'mo1' })) } },
        {
          provide: MonsterService,
          useValue: {
            getById: () => of(loadedMonster),
            update: () => of(loadedMonster),
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
            deleteAttack: () => of(void 0),
            deletePower: () => of(void 0),
            deleteArmor: () => of(void 0),
            deleteWeakness: () => of(void 0),
          },
        },
        {
          provide: ReferenceDataService,
          useValue: { getMonsterTypes: () => of([]), getMonsterArchetypes: () => of([]), getWeaponTags: () => of([]) },
        },
        { provide: MinionService, useValue: { getByMonster: () => of([]) } },
        { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
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

    fixture = TestBed.createComponent(MonsterDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('placement (design.md §4.1.1)', () => {
    it('puts the Images card directly under the title and badges, before the Minions block', () => {
      const headings = all('h2, h3').map((node) => node.textContent!.trim());
      expect(headings[0]).toBe('The Hollow Man');
      expect(headings[1]).toBe('Images');
      expect(headings[2]).toBe('Minions');
    });

    it('keeps the Images card above the form, and the Minions block between them', () => {
      const order = all('h3, app-monster-form').map((node) =>
        node.tagName === 'APP-MONSTER-FORM' ? 'form' : node.textContent!.trim(),
      );
      expect(order.slice(0, 3)).toEqual(['Images', 'Minions', 'form']);
    });

    it('renders the card, carousel and upload modal host for the loaded monster', () => {
      expect(query('[data-images-card]')).not.toBeNull();
      expect(query('[data-carousel]')).not.toBeNull();
      // The modal is closed until "+ Add Images" is pressed.
      expect(query('[data-upload-modal]')).toBeNull();
    });
  });

  describe('store binding', () => {
    it('loads the monster’s images and seeds the primary from the server’s isPrimary', () => {
      expect(component.imagesStore.images().map((image) => image.id)).toEqual(['a', 'b', 'c']);
      expect(component.imagesStore.primaryImageId()).toBe('b');
      expect(component.imagesStore.count()).toBe(3);
    });

    it('starts the carousel on the primary image', () => {
      expect(query('[data-slide="active"]')!.getAttribute('data-image-id')).toBe('b');
    });

    it('re-renders when store signals change (the app is zoneless, so these must be signals)', () => {
      component.imagesStore.setActive('c');
      fixture.detectChanges();
      expect(query('[data-slide="active"]')!.getAttribute('data-image-id')).toBe('c');
    });

    it('renders the image list failure inline, without unmounting the page', () => {
      listImages = () => throwError(() => new Error('boom'));
      const second = TestBed.createComponent(MonsterDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      expect(host.querySelector('[data-images-error]')!.textContent!.trim()).toBe('Unable to load images.');
      // The page itself is intact: the form and the title still render.
      expect(host.querySelector('app-monster-form')).not.toBeNull();
      expect(host.querySelector('h2')!.textContent!.trim()).toBe('The Hollow Man');
    });
  });

  describe('upload modal', () => {
    it('opens from the card’s "+ Add Images" button', () => {
      (query('[data-add-images]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(query('[data-upload-modal]')).not.toBeNull();
    });

    it('merges a successful upload into the carousel without any page save', () => {
      (query('[data-add-images]') as HTMLButtonElement).click();
      fixture.detectChanges();

      component.imagesStore.applyUpload({ attempted: 1, uploaded: [imageFixture('d', 4)], rejected: [] });
      fixture.detectChanges();

      expect(all('[data-slide]').length).toBe(4);
      // The active slide jumps to the first of the new batch (§5.4).
      expect(query('[data-slide="active"]')!.getAttribute('data-image-id')).toBe('d');
    });

    it('shows the 10/10 state and disables "+ Add Images" at the cap', () => {
      images = Array.from({ length: 10 }, (_, i) => imageFixture(`i${i}`, i + 1));
      const second = TestBed.createComponent(MonsterDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      expect(host.querySelector<HTMLElement>('[data-at-cap]')!.textContent!.trim()).toBe(
        '10/10 images — delete one to add another',
      );
      expect(host.querySelector<HTMLButtonElement>('[data-add-images]')!.disabled).toBe(true);
    });
  });

  describe('set primary', () => {
    it('sends the request and moves the indicator without touching the active slide', () => {
      component.imagesStore.setActive('c');
      fixture.detectChanges();
      (query('[data-star]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(primaryCalls).toEqual(['c']);
      expect(component.imagesStore.primaryImageId()).toBe('c');
      expect(query('[data-slide="active"]')!.getAttribute('data-image-id')).toBe('c');
    });
  });

  describe('delete, through this page’s one modal (§6)', () => {
    function requestDeleteOfActive(): void {
      (query('[data-delete]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    it('opens the page’s existing modal, named by fileName, not a second modal', () => {
      requestDeleteOfActive();

      expect(all('[role="dialog"]').length).toBe(1);
      expect(text('[role="dialog"] h3')).toBe('Delete "b.webp"?');
      expect(deleteCalls).toEqual([]);
    });

    it('still-has-images branch: the footnote names the first-uploaded remaining image', () => {
      // Active slide is the primary (b). After deleting it, derivation picks a — not the neighbour.
      requestDeleteOfActive();

      expect(dialog()!.textContent).toContain(
        "This is the current primary image. After it's deleted, a.webp becomes primary instead.",
      );
    });

    it('not-primary branch: no footnote at all', () => {
      component.imagesStore.setActive('c');
      fixture.detectChanges();
      requestDeleteOfActive();

      expect(component.pendingDelete()!.footnote).toBe('');
      expect(dialog()!.textContent).not.toContain('primary');
    });

    it('last-image branch: says the monster will have no images, and never mentions primary', () => {
      images = [imageFixture('only', 1, true)];
      const second = TestBed.createComponent(MonsterDetailComponent);
      second.detectChanges();
      const host = second.nativeElement as HTMLElement;

      host.querySelector<HTMLButtonElement>('[data-delete]')!.click();
      second.detectChanges();

      const body = host.querySelector('[role="dialog"]')!.textContent!;
      expect(body).toContain('This is the last image. The Hollow Man will have no images afterward.');
      expect(body).not.toContain('primary');
    });

    it('confirming deletes, removes the slide, and re-derives the primary', () => {
      requestDeleteOfActive();
      (Array.from(dialog()!.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Delete') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(deleteCalls).toEqual(['b']);
      expect(component.imagesStore.images().map((i) => i.id)).toEqual(['a', 'c']);
      expect(component.imagesStore.primaryImageId()).toBe('a');
      expect(all('[data-slide]').length).toBe(2);
      expect(dialog()).toBeNull();
    });

    it('cancelling deletes nothing and closes the modal', () => {
      requestDeleteOfActive();
      (Array.from(dialog()!.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Cancel') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(deleteCalls).toEqual([]);
      expect(component.imagesStore.count()).toBe(3);
      expect(dialog()).toBeNull();
    });

    it('a delete failure shows the section’s inline error and keeps the image', () => {
      deleteResult = () => throwError(() => new Error('boom'));
      requestDeleteOfActive();
      (Array.from(dialog()!.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Delete') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(text('[data-images-error]')).toBe('Unable to delete image.');
      expect(component.imagesStore.count()).toBe(3);
      // The page is not unmounted — errorMessage is untouched.
      expect(component.errorMessage()).toBeNull();
      expect(query('app-monster-form')).not.toBeNull();
    });

    it('leaves the footnote empty for a non-image delete, so other deletes render as before', () => {
      component.requestDeleteAttack('at1', 'Grave Chill');
      fixture.detectChanges();

      expect(component.pendingDelete()!.footnote).toBeUndefined();
      expect(text('[role="dialog"] h3')).toBe('Delete "Grave Chill"?');
      expect((dialog()!.textContent!.match(/This cannot be undone\./g) ?? []).length).toBe(1);
    });
  });

  describe('persistence is decoupled from the page Save button', () => {
    it('an image delete fires its own request and does not touch activeMutation', () => {
      const pendingDelete = new Subject<void>();
      deleteResult = () => pendingDelete.asObservable();

      (query('[data-delete]') as HTMLButtonElement).click();
      fixture.detectChanges();
      (Array.from(dialog()!.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Delete') as HTMLButtonElement).click();
      fixture.detectChanges();

      // The store is busy; the page's own mutation state is not, so the form stays usable.
      expect(component.imagesStore.isMutating()).toBe(true);
      expect(component.activeMutation()).toBeNull();
      expect(component.isMutating()).toBe(false);

      pendingDelete.next();
      pendingDelete.complete();
      fixture.detectChanges();
      expect(component.imagesStore.isMutating()).toBe(false);
    });
  });
});
