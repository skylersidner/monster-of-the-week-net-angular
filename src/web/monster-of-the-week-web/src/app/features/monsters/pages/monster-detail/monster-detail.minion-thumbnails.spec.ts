import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { MinionListItemResponse, MonsterDetailResponse } from '../../../../core/models';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ResourceImageService } from '../../../../core/resource-images';
import { MonsterDetailComponent } from './monster-detail';

/**
 * Thumbnails on `monster-detail`'s **nested Minions block** — a different surface from the page's
 * own Images section, and Monster-only.
 *
 * Phase 4 deliberately left `GetByMonsterIdAsync` without `primaryImageId`, so this block was
 * excluded through 6a–6d. Skyler reversed that on 2026-10-07 and Bowser's `5c697a6` made the two
 * minion projections share one expression, so the data arrives here now.
 *
 * Two things are easy to get wrong and are pinned below: each row is a **Minion** owner (not the
 * Monster whose page this is), and the thumbnail is `size="compact"` (64px) rather than the 128px
 * list-row default, because these rows carry 42px of content against a list row's 177px.
 */

const loadedMonster: MonsterDetailResponse = {
  id: 'mo1',
  mysteryIds: [],
  name: 'Pierce Jones',
  description: null,
  harmCapacity: 7,
  monsterTypeId: 'mt1',
  monsterTypeName: 'Queen',
  monsterArchetype: { id: 'ma1', name: 'Queen', description: '' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
};

function minionFixture(id: string, name: string, primaryImageId?: string | null): MinionListItemResponse {
  return {
    id,
    monsterId: 'mo1',
    monsterName: 'Pierce Jones',
    name,
    description: 'A servant.',
    harmCapacity: 2,
    minionType: { id: 'mnt1', name: 'Cultist', motivation: 'to serve' },
    attackCount: 1,
    powerCount: 1,
    armorCount: 0,
    weaknessCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
    primaryImageId,
  };
}

/** Mirrors the real seeded data this was verified against: one minion with a derived primary, one without. */
const MINIONS = [
  minionFixture('mn-wells', 'Scarlett Wells', 'img-wells'),
  minionFixture('mn-thneed', 'Carl Thneed', null),
  // A row from a projection that predates the field entirely — must read as "no image", not crash.
  minionFixture('mn-absent', 'Field Absent', undefined),
];

describe('MonsterDetailComponent — nested Minions block thumbnails', () => {
  let fixture: ComponentFixture<MonsterDetailComponent>;
  let component: MonsterDetailComponent;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;

  /** The nested block's rows, found via the Minions heading so the Images section cannot be picked up. */
  const minionRows = (): HTMLElement[] => {
    const heading = Array.from(element().querySelectorAll('h3')).find((h) => h.textContent!.trim() === 'Minions')!;
    const list = heading.parentElement!.parentElement!.querySelector('ul')!;
    return Array.from(list.querySelectorAll('li'));
  };
  const rowFor = (name: string): HTMLElement => minionRows().find((li) => li.textContent!.includes(name))!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonsterDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ monsterId: 'mo1' })) } },
        { provide: MonsterService, useValue: { getById: () => of(loadedMonster), update: () => of(loadedMonster) } },
        { provide: MinionService, useValue: { getByMonster: () => of(MINIONS) } },
        {
          provide: ReferenceDataService,
          useValue: { getMonsterTypes: () => of([]), getMonsterArchetypes: () => of([]), getWeaponTags: () => of([]) },
        },
        { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
        {
          provide: NotificationService,
          useValue: { success: () => {}, error: () => {}, notifications: () => [], dismiss: () => {} },
        },
        {
          provide: ResourceImageService,
          useValue: { list: () => of([]), delete: () => of(void 0), setPrimary: () => of(void 0), upload: () => of({ uploaded: [], rejected: [] }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MonsterDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders one thumbnail per minion row, as the row’s first child', () => {
    const rows = minionRows();
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.firstElementChild!.tagName).toBe('APP-RESOURCE-THUMBNAIL');
    }
  });

  it('points a minion with an image at the Minion endpoint, not the Monster’s', () => {
    const img = rowFor('Scarlett Wells').querySelector('img')!;
    // The owner is the minion, even though this is the monster's page — the easy mistake here.
    expect(img.getAttribute('src')).toBe('/api/minions/mn-wells/images/img-wells/thumbnail');
    expect(img.getAttribute('src')).not.toContain('/api/monsters/');
    expect(img.getAttribute('src')).not.toContain('/file');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.alt).toBe('Scarlett Wells');
  });

  it('renders the Minion placeholder for a minion with no images', () => {
    const row = rowFor('Carl Thneed');
    expect(row.querySelector('img')).toBeNull();
    const placeholder = row.querySelector('[data-placeholder]')!;
    expect(placeholder.className).toContain('bg-badge-minion/40');
    expect(placeholder.querySelector('use')!.getAttribute('href')).toBe('#icon-nav-minions');
  });

  it('treats an absent primaryImageId the same as a null one', () => {
    const row = rowFor('Field Absent');
    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector('[data-placeholder]')).not.toBeNull();
  });

  it('uses the 64px compact size, not the 128px list-row default', () => {
    const thumb = rowFor('Scarlett Wells').querySelector('app-resource-thumbnail')!;
    for (const expected of ['h-16', 'w-16', 'shrink-0', 'rounded-lg', 'border-default']) {
      expect(thumb.classList).toContain(expected);
    }
    // The list-row size would be more than three times this block's 42px of content.
    expect(thumb.classList).not.toContain('h-32');
    expect(thumb.classList).not.toContain('w-32');
  });

  it('scales the placeholder icon down with the smaller box', () => {
    const svg = rowFor('Carl Thneed').querySelector('[data-placeholder] svg')!;
    expect(svg.getAttribute('class')).toBe('h-5 w-5');
  });

  it('lets each row shrink below its content width', () => {
    // The `<ul>` is a grid, so without `min-w-0` the row claims its min-content width and overflows.
    for (const row of minionRows()) {
      expect(row.classList).toContain('min-w-0');
    }
  });

  it('keeps the row horizontal at every width — no stacking here', () => {
    // Unlike the four list pages: 64px leaves the text ~258px at a 390px viewport, where their
    // 128px left only 132px and forced a stacked layout.
    for (const row of minionRows()) {
      expect(row.classList).toContain('flex');
      expect(row.classList).not.toContain('flex-col');
      expect(row.classList).not.toContain('sm:flex-row');
    }
  });

  it('builds the URL from the component helper', () => {
    expect(component.minionThumbnailUrl(MINIONS[0])).toBe('/api/minions/mn-wells/images/img-wells/thumbnail');
    expect(component.minionThumbnailUrl(MINIONS[1])).toBeNull();
    expect(component.minionThumbnailUrl(MINIONS[2])).toBeNull();
  });

  it('keeps the minion name and badge reachable beside the thumbnail', () => {
    const row = rowFor('Scarlett Wells');
    expect(row.querySelector('a.entity-link')!.textContent!.trim()).toBe('Scarlett Wells');
    expect(row.textContent).toContain('Cultist: to serve');
    expect(row.textContent).toContain('Attacks: 1');
  });
});
