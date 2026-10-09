import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { MinionService } from '../../../../core/minion';
import { MonsterListItemResponse } from '../../../../core/models';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { MonstersListComponent } from './monsters-list';

/**
 * Phase 6a, list half: `monsters-list` rows carry a thumbnail fed by the `primaryImageId` the list
 * response already supplies (design.md §4.2). The component's placeholder/error behaviour has its
 * own spec; what is under test here is the row wiring — which URL, which position, lazy loading,
 * and the placeholder when a monster has no images.
 */

function buildMonster(id: string, name: string, primaryImageId?: string | null): MonsterListItemResponse {
  return {
    id,
    mysteryIds: [],
    name,
    description: 'Tall and quiet.',
    harmCapacity: 6,
    monsterType: { id: 'mt1', name: 'Beast', motivation: 'to hunt' },
    monsterArchetype: { id: 'ma1', name: 'Ghost', description: 'a restless dead' },
    attackCount: 1,
    powerCount: 1,
    armorCount: 0,
    weaknessCount: 1,
    minionCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    primaryImageId,
  };
}

const withImage = buildMonster('mo1', 'The Hollow Man', 'img-7');
const withoutImage = buildMonster('mo2', 'The Quiet Thing', null);
/** A row from the by-mystery projection, which is out of Phase 4's scope and omits the field entirely. */
const fieldAbsent = buildMonster('mo3', 'The Third', undefined);

describe('MonstersListComponent — row thumbnails (Phase 6a)', () => {
  let fixture: ComponentFixture<MonstersListComponent>;
  let monsters: MonsterListItemResponse[];

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const rows = (): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>('li'));
  const thumbnails = (): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>('app-resource-thumbnail'));

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MonstersListComponent],
      providers: [
        provideRouter([]),
        { provide: MonsterService, useValue: { getAll: () => of(monsters), delete: () => of(undefined as void) } },
        { provide: MinionService, useValue: { getByMonster: () => of([]) } },
        { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MonstersListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    monsters = [withImage, withoutImage, fieldAbsent];
  });

  it('renders one thumbnail per row, as the first child of the row', async () => {
    await create();

    expect(thumbnails().length).toBe(3);
    for (const row of rows()) {
      expect(row.firstElementChild!.tagName).toBe('APP-RESOURCE-THUMBNAIL');
    }
  });

  it('points a row with an image at the thumbnail endpoint, never the original', async () => {
    await create();

    const img = thumbnails()[0].querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/api/monsters/mo1/images/img-7/thumbnail');
    expect(img.getAttribute('src')).not.toContain('/file');
    expect(img.alt).toBe('The Hollow Man');
  });

  it('lazy-loads the row images, so fetches track the rows on screen', async () => {
    await create();

    expect(thumbnails()[0].querySelector('img')!.getAttribute('loading')).toBe('lazy');
  });

  it('renders the Monster domain placeholder when there is no image', async () => {
    await create();

    const placeholder = thumbnails()[1].querySelector('[data-placeholder]')!;
    expect(thumbnails()[1].querySelector('img')).toBeNull();
    expect(placeholder.className).toContain('bg-badge-monster/40');
    expect(placeholder.querySelector('use')!.getAttribute('href')).toBe('#icon-nav-monsters');
  });

  it('treats an absent primaryImageId the same as a null one', async () => {
    await create();

    expect(thumbnails()[2].querySelector('img')).toBeNull();
    expect(thumbnails()[2].querySelector('[data-placeholder]')).not.toBeNull();
  });

  it('gets its 128px box from the component, not from classes on this row', async () => {
    await create();

    // The size lives in `app-resource-thumbnail`'s `size="row"` default, so all four domains'
    // lists share one number instead of four call sites agreeing on it.
    for (const expected of ['h-32', 'w-32', 'shrink-0', 'rounded-lg', 'border-default']) {
      expect(thumbnails()[0].classList).toContain(expected);
    }
  });

  it('scales the placeholder icon with the larger box', async () => {
    await create();

    expect(thumbnails()[1].querySelector('[data-placeholder] svg')!.getAttribute('class')).toBe('h-12 w-12');
  });

  /**
   * The row is a grid item (`<ul class="grid">`), and grid items default to `min-width: auto`, so
   * without `min-w-0` on the `<li>` itself the row claims its content's min-content width and
   * overflows its track. Measured at 390px wide: 488px row in a 358px track, which scrolled `main`
   * horizontally and pushed the delete button off-screen. `min-w-0` on the inner `flex-1` div does
   * not substitute — it shrinks the text, but the row has already claimed its width a level up.
   */
  it('lets the row shrink below its content width, so a narrow viewport cannot push the actions off-screen', async () => {
    await create();

    for (const row of rows()) {
      expect(row.classList).toContain('min-w-0');
    }
  });

  /**
   * Stacking and truncation are breakpoint behaviour, so these assert the classes that produce it
   * rather than computed geometry — jsdom resolves no media queries. The rendered geometry at each
   * breakpoint is measured on the dev server instead.
   */
  describe('narrow-viewport layout', () => {
    it('stacks the row below sm, with the image centred and the text full width', async () => {
      await create();

      for (const row of rows()) {
        // Column by default, row from `sm` (540px) up; `items-center` centres the thumbnail.
        expect(row.classList).toContain('flex-col');
        expect(row.classList).toContain('sm:flex-row');
        expect(row.classList).toContain('items-center');
      }

      // The content block spans the row when stacked, instead of shrinking to its content width.
      const content = rows()[0].querySelector('.flex-1')!;
      expect(content.classList).toContain('w-full');
      expect(content.classList).toContain('sm:w-auto');
    });

    it('keeps the delete action at the trailing edge when stacked', async () => {
      await create();

      const actions = rows()[0].querySelector('button')!.parentElement!;
      expect(actions.classList).toContain('self-end');
      expect(actions.classList).toContain('sm:self-auto');
    });

    it('clamps the description to two lines below lg, and releases it from desktop up', async () => {
      await create();

      const description = Array.from(rows()[0].querySelectorAll('p')).find((p) =>
        p.textContent!.includes('Tall and quiet.'),
      )!;
      expect(description.classList).toContain('line-clamp-2');
      expect(description.classList).toContain('lg:line-clamp-none');
      // `line-clamp-*` supplies its own `display`, so a co-occurring display utility would
      // silently defeat it.
      for (const conflicting of ['block', 'inline', 'inline-block', 'truncate']) {
        expect(description.classList).not.toContain(conflicting);
      }
    });
  });

  it('issues no extra request per row — the ids come from the list response', async () => {
    let getAllCalls = 0;
    await TestBed.configureTestingModule({
      imports: [MonstersListComponent],
      providers: [
        provideRouter([]),
        {
          provide: MonsterService,
          useValue: {
            getAll: () => {
              getAllCalls += 1;
              return of(monsters);
            },
            delete: () => of(undefined as void),
          },
        },
        { provide: MinionService, useValue: { getByMonster: () => of([]) } },
        { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
      ],
    }).compileComponents();

    const created = TestBed.createComponent(MonstersListComponent);
    created.detectChanges();
    await created.whenStable();

    expect(getAllCalls).toBe(1);
  });

  it('builds the URL from the component helper, so the row template holds no path string', async () => {
    await create();
    const component = fixture.componentInstance;

    expect(component.thumbnailUrl(withImage)).toBe('/api/monsters/mo1/images/img-7/thumbnail');
    expect(component.thumbnailUrl(withoutImage)).toBeNull();
    expect(component.thumbnailUrl(fieldAbsent)).toBeNull();
  });
});
