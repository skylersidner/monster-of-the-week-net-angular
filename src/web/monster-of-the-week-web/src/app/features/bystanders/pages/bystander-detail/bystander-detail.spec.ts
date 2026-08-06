import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { BystanderDetailResponse, UpsertBystanderRequest } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { BystanderFormComponent } from '../../shared/bystander-form/bystander-form';
import { BystanderDetailComponent } from './bystander-detail';

const loadedBystander: BystanderDetailResponse = {
  id: 'b1',
  mysteryIds: [],
  name: 'Bystander',
  description: null,
  bystanderTypeId: 'bt1',
  bystanderTypeName: 'Witness',
  bystanderTypeMotivation: 'Test',
  customMoves: [],
};

describe('BystanderDetailComponent', () => {
  let component: BystanderDetailComponent;
  let fixture: ComponentFixture<BystanderDetailComponent>;
  let putSubject: Subject<unknown>;
  let updateCalls: { bystanderId: string; payload: UpsertBystanderRequest }[] = [];
  let successCalls = 0;

  beforeEach(async () => {
    putSubject = new Subject();
    updateCalls = [];
    successCalls = 0;

    await TestBed.configureTestingModule({
      imports: [BystanderDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ bystanderId: 'b1' })),
          },
        },
        {
          provide: BystanderService,
          useValue: {
            getById: () => of(loadedBystander),
            update: (bystanderId: string, payload: UpsertBystanderRequest) => {
              updateCalls.push({ bystanderId, payload });
              return putSubject;
            },
          },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getBystanderTypes: () => of([{ id: 'bt1', name: 'Witness', motivation: 'Test' }]),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: () => {
              successCalls += 1;
            },
            error: () => {},
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BystanderDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function sharedForm(): BystanderFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(BystanderFormComponent));
    expect(debugElement).toBeTruthy();
    return debugElement.componentInstance as BystanderFormComponent;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the shared bystander form instead of its own core-fields form', () => {
    expect(fixture.nativeElement.querySelector('app-bystander-form')).toBeTruthy();
    expect((component as unknown as Record<string, unknown>)['form']).toBeUndefined();
  });

  it('passes the loaded bystander and a Save Bystander label down to the shared form', () => {
    const instance = sharedForm();
    expect(component.bystander()).not.toBeNull();
    expect(instance.bystander).toBe(loadedBystander);
    expect(instance.submitLabel).toBe('Save Bystander');
    expect(instance.bystanderTypes).toEqual([{ id: 'bt1', name: 'Witness', motivation: 'Test' }]);
    expect(instance.bystanderForm.getRawValue()).toEqual({
      name: 'Bystander',
      description: '',
      bystanderTypeId: 'bt1',
    });
  });

  it('saves through the shared form output when the form is submitted with valid values', () => {
    const instance = sharedForm();
    instance.bystanderForm.setValue({
      name: 'Renamed',
      description: '',
      bystanderTypeId: 'bt1',
    });

    const form = fixture.nativeElement.querySelector('app-bystander-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(updateCalls).toEqual([
      {
        bystanderId: 'b1',
        payload: {
          name: 'Renamed',
          description: null,
          bystanderTypeId: 'bt1',
        },
      },
    ]);
  });

  it('does not call update when no bystander has been loaded', () => {
    component.bystander.set(null);

    component.save({ name: 'Renamed', description: null, bystanderTypeId: 'bt1' });

    expect(updateCalls).toEqual([]);
  });

  it('tracks save loading state and sends success toast', () => {
    component.save({ name: 'Bystander', description: null, bystanderTypeId: 'bt1' });
    expect(component.isSaving()).toBe(true);

    putSubject.next({
      id: 'b1',
      mysteryIds: ['m1'],
      name: 'Bystander',
      description: null,
      bystanderTypeId: 'bt1',
      bystanderTypeName: 'Witness',
      bystanderTypeMotivation: 'Test',
      customMoves: [],
    });
    putSubject.complete();

    expect(component.isSaving()).toBe(false);
    expect(successCalls).toBe(1);
  });

  it('leaves the read-only custom moves list rendering', () => {
    expect(fixture.nativeElement.textContent).toContain('Custom Moves');
    expect(fixture.nativeElement.textContent).toContain('No custom moves.');
  });
});
