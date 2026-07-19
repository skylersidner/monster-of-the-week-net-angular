import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { ReferenceDataService } from '../../../../core/reference-data';
import { BystanderDetailComponent } from './bystander-detail';

describe('BystanderDetailComponent', () => {
  let component: BystanderDetailComponent;
  let fixture: ComponentFixture<BystanderDetailComponent>;

  beforeEach(async () => {
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
                mysteryId: 'm1',
                name: 'Bystander',
                description: null,
                bystanderTypeId: 'bt1',
                bystanderTypeName: 'Witness',
                bystanderTypeMotivation: 'Test',
                customMoves: [],
              }),
            put: () => of({}),
          },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getBystanderTypes: () => of([{ id: 'bt1', name: 'Witness', motivation: 'Test' }]),
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
});
