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

  it('sizes the thumbnail per §4.2 and keeps it from shrinking', async () => {
    await create();

    const classes = thumbnails()[0].className;
    for (const expected of ['h-16', 'w-16', 'shrink-0', 'rounded-lg']) {
      expect(classes).toContain(expected);
    }
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
