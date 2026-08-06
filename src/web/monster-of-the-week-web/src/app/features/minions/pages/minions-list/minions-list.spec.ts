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
