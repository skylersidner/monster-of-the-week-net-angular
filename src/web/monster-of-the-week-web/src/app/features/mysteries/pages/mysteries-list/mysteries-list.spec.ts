import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';

import { MysteriesListComponent } from './mysteries-list';
import { MysteryService } from '../../../../core/mystery';

describe('MysteriesListComponent', () => {
  let component: MysteriesListComponent;
  let fixture: ComponentFixture<MysteriesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MysteriesListComponent],
      providers: [
        provideRouter([]),
        {
          provide: MysteryService,
          useValue: {
            getMysteries: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteriesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
