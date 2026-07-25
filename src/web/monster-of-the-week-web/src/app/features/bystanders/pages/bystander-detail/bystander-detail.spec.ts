import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { BystanderDetailComponent } from './bystander-detail';

describe('BystanderDetailComponent', () => {
  let component: BystanderDetailComponent;
  let fixture: ComponentFixture<BystanderDetailComponent>;
  let putSubject: Subject<unknown>;
  let successCalls = 0;

  beforeEach(async () => {
    putSubject = new Subject();
    successCalls = 0;

    await TestBed.configureTestingModule({
      imports: [BystanderDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ mysteryId: 'm1', bystanderId: 'b1' })),
          },
        },
        {
          provide: ApiService,
          useValue: {
            get: () =>
              of({
                id: 'b1',
                mysteryIds: ['m1'],
                name: 'Bystander',
                description: null,
                bystanderTypeId: 'bt1',
                bystanderTypeName: 'Witness',
                bystanderTypeMotivation: 'Test',
                customMoves: [],
              }),
            put: () => putSubject,
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('tracks save loading state and sends success toast', () => {
    component.save();
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
});
