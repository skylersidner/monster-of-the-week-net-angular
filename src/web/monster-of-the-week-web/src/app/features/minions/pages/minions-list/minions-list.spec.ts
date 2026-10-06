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
   *
   * This page gets no description clamp, because it renders no description — its second line is
   * "Belongs to: {monster}", which is a single short link, not free text.
   */
  it('lets each row shrink below its content width', () => {
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.classList).toContain('min-w-0');
    }
  });

  it('has no description paragraph to clamp', () => {
    const paragraphs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li p'));
    for (const paragraph of paragraphs) {
      expect(paragraph.textContent).toContain('Belongs to:');
    }
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
