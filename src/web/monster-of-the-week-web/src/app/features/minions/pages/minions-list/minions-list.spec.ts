import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { MinionService } from '../../../../core/minion';
import { MinionsListComponent } from './minions-list';

describe('MinionsListComponent', () => {
  let component: MinionsListComponent;
  let fixture: ComponentFixture<MinionsListComponent>;
  let deleteCalls: string[];
  let deleteResult: () => Observable<void>;

  beforeEach(async () => {
    deleteCalls = [];
    deleteResult = () => of(void 0);

    await TestBed.configureTestingModule({
      imports: [MinionsListComponent],
      providers: [
        provideRouter([]),
        {
          provide: MinionService,
          useValue: {
            getAll: () =>
              of([
                {
                  id: '1',
                  monsterId: 'm1',
                  monsterName: 'The Beast',
                  name: 'Grunt',
                  description: null,
                  harmCapacity: 2,
                  minionType: { id: 'mt1', name: 'Torturer', motivation: 'dominate' },
                  powerCount: 0,
                  armorCount: 0,
                  weaknessCount: 0,
                  createdAt: '2026-01-01T00:00:00Z',
                },
              ]),
            delete: (id: string) => {
              deleteCalls.push(id);
              return deleteResult();
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MinionsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a minion card after loading', () => {
    expect(component.minions().length).toBe(1);
    expect(component.minions()[0].name).toBe('Grunt');
  });

  /**
   * The `<ul>` is a grid, so without `min-w-0` on the `<li>` the row claims its min-content width
   * and overflows its track, pushing the delete action off-screen on a phone. Shared across all
   * four list pages.
   */
  it('lets each row shrink below its content width', () => {
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.classList).toContain('min-w-0');
    }
  });

  /**
   * This page renders a description like the other three. It did not until after Phase 6b — the
   * field was always on the list response and the row simply never showed it, which Skyler ruled a
   * design oversight rather than an intentional difference. The spec that used to assert the
   * absence is gone, not skipped.
   */
  it('renders the description, clamped to two lines below lg and released from desktop up', () => {
    const descriptions = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li p')).filter((p) =>
      p.classList.contains('my-1'),
    );
    expect(descriptions.length).toBeGreaterThan(0);
    for (const description of descriptions) {
      expect(description.classList).toContain('line-clamp-2');
      expect(description.classList).toContain('lg:line-clamp-none');
      // `line-clamp-*` carries its own display; a co-occurring display utility kills it.
      for (const conflicting of ['block', 'truncate']) {
        expect(description.classList).not.toContain(conflicting);
      }
    }
  });

  it('falls back to the same placeholder sentence the other three lists use', () => {
    // The fixture minion has `description: null`.
    const description = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li p')).find((p) =>
      p.classList.contains('my-1'),
    )!;
    expect(description.textContent!.trim()).toBe('No description provided');
  });

  it('keeps the description above the Belongs-to line, matching the other three lists’ slot', () => {
    const paragraphs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li p'));
    const descriptionIndex = paragraphs.findIndex((p) => p.classList.contains('my-1'));
    const belongsToIndex = paragraphs.findIndex((p) => p.textContent!.includes('Belongs to:'));

    expect(descriptionIndex).toBeGreaterThanOrEqual(0);
    expect(belongsToIndex).toBeGreaterThan(descriptionIndex);
  });

  /**
   * Phase 6b, list half. The thumbnail's 128px box, `min-w-0` and the placeholder all come from
   * shared pieces already in place; what this page adds is the thumbnail itself and the stacking
   * trio. Breakpoint behaviour is asserted as classes, since jsdom resolves no media queries — the
   * rendered geometry is measured on the dev server.
   */
  describe('row thumbnail (Phase 6b)', () => {
    const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const thumbnails = (): HTMLElement[] =>
      Array.from(element().querySelectorAll<HTMLElement>('app-resource-thumbnail'));

    it('renders one thumbnail per row, as the row’s first child', () => {
      const rows = Array.from(element().querySelectorAll('li'));
      expect(thumbnails().length).toBe(rows.length);
      for (const row of rows) {
        expect(row.firstElementChild!.tagName).toBe('APP-RESOURCE-THUMBNAIL');
      }
    });

    it('renders the Minion placeholder when the minion has no images', () => {
      // The fixture minion carries no `primaryImageId`, so the URL is null and the placeholder shows.
      const placeholder = thumbnails()[0].querySelector('[data-placeholder]')!;
      expect(thumbnails()[0].querySelector('img')).toBeNull();
      expect(placeholder.className).toContain('bg-badge-minion/40');
      expect(placeholder.querySelector('use')!.getAttribute('href')).toBe('#icon-nav-minions');
    });

    it('inherits the 128px box from the component rather than classes on this row', () => {
      for (const expected of ['h-32', 'w-32', 'shrink-0', 'rounded-lg', 'border-default']) {
        expect(thumbnails()[0].classList).toContain(expected);
      }
    });

    it('points at the thumbnail endpoint, never the original, when an image exists', () => {
      expect(component.thumbnailUrl({ id: 'mn9', primaryImageId: 'img-3' } as never)).toBe(
        '/api/minions/mn9/images/img-3/thumbnail',
      );
      expect(component.thumbnailUrl({ id: 'mn9', primaryImageId: null } as never)).toBeNull();
      // The by-monster projection omits the field entirely; that must read as "no image", not a crash.
      expect(component.thumbnailUrl({ id: 'mn9' } as never)).toBeNull();
    });

    it('stacks the row below sm, with the image centred and the text full width', () => {
      for (const row of Array.from(element().querySelectorAll('li'))) {
        expect(row.classList).toContain('flex-col');
        expect(row.classList).toContain('sm:flex-row');
        expect(row.classList).toContain('items-center');
      }

      const content = element().querySelector('li .flex-1')!;
      expect(content.classList).toContain('w-full');
      expect(content.classList).toContain('sm:w-auto');
    });

    it('keeps the delete action at the trailing edge when stacked', () => {
      const actions = element().querySelector('li button')!.parentElement!;
      expect(actions.classList).toContain('self-end');
      expect(actions.classList).toContain('sm:self-auto');
    });
  });

  it('shows the parent monster name', () => {
    expect(component.minions()[0].monsterName).toBe('The Beast');
  });

  it('requesting delete sets pendingDelete without calling the service', () => {
    component.requestDelete('1', 'Grunt');

    expect(component.pendingDelete()).toEqual({ id: '1', name: 'Grunt' });
    expect(deleteCalls).toEqual([]);
  });

  it('confirming delete calls the service and removes the minion from the list', () => {
    component.requestDelete('1', 'Grunt');

    component.onDeleteConfirmed();

    expect(deleteCalls).toEqual(['1']);
    expect(component.pendingDelete()).toBeNull();
    expect(component.minions()).toEqual([]);
  });

  it('cancelling delete clears pendingDelete without calling the service', () => {
    component.requestDelete('1', 'Grunt');

    component.onDeleteCancelled();

    expect(component.pendingDelete()).toBeNull();
    expect(deleteCalls).toEqual([]);
    expect(component.minions().length).toBe(1);
  });

  it('sets an error message and keeps the minion in the list when delete fails', () => {
    deleteResult = () => throwError(() => new Error('boom'));
    component.requestDelete('1', 'Grunt');

    component.onDeleteConfirmed();

    expect(component.errorMessage()).toBe('Unable to delete minion.');
    expect(component.minions().length).toBe(1);
  });
});
