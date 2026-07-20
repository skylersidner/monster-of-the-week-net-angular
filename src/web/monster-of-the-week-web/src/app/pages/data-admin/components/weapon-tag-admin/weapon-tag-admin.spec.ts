import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { WeaponTagAdminComponent } from './weapon-tag-admin';

describe('WeaponTagAdminComponent', () => {
  let component: WeaponTagAdminComponent;
  let fixture: ComponentFixture<WeaponTagAdminComponent>;
  let createWeaponTagCalls = 0;

  beforeEach(async () => {
    createWeaponTagCalls = 0;
    await TestBed.configureTestingModule({
      imports: [WeaponTagAdminComponent],
      providers: [
        {
          provide: ReferenceDataService,
          useValue: {
            createWeaponTag: () => {
              createWeaponTagCalls += 1;
              return of({ id: 'tag-1', name: 'Close', description: 'Used in close-range attacks.' });
            },
            getWeaponTags: () => of([{ id: 'tag-1', name: 'Close', description: 'Used in close-range attacks.' }]),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: () => {},
            error: () => {},
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WeaponTagAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders description column', () => {
    expect(fixture.nativeElement.textContent).toContain('Description');
  });

  it('submits weapon tag payload', () => {
    component.form.controls.name.setValue('Hand');
    component.form.controls.description.setValue('Best used in hand-to-hand range.');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(createWeaponTagCalls).toBe(1);
  });
});
