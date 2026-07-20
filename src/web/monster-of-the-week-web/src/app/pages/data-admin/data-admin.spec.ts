import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ReferenceTypeTable } from '../../core/models';
import { NotificationService } from '../../core/notifications';
import { ReferenceDataService } from '../../core/reference-data';
import { DataAdminPageComponent } from './data-admin';

describe('DataAdminPageComponent', () => {
  let component: DataAdminPageComponent;
  let fixture: ComponentFixture<DataAdminPageComponent>;
  let createTypeCalls = 0;
  let selectedTable: ReferenceTypeTable | null = null;
  let selectedLoadTable: ReferenceTypeTable | null = null;
  let loadTypeCalls = 0;

  beforeEach(async () => {
    createTypeCalls = 0;
    selectedTable = null;
    selectedLoadTable = null;
    loadTypeCalls = 0;

    await TestBed.configureTestingModule({
      imports: [DataAdminPageComponent],
      providers: [
        {
          provide: ReferenceDataService,
          useValue: {
            createType: (table: ReferenceTypeTable) => {
              createTypeCalls += 1;
              selectedTable = table;
              return of({ id: 'type-1', name: 'Crossroads', motivation: 'Tempts visitors toward danger.' });
            },
            getTypesByTable: (table: ReferenceTypeTable) => {
              loadTypeCalls += 1;
              selectedLoadTable = table;
              return of([{ id: `${table}-1`, name: `${table} name`, motivation: `${table} motivation` }]);
            },
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

    fixture = TestBed.createComponent(DataAdminPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(loadTypeCalls).toBe(1);
    expect(selectedLoadTable).toBe(ReferenceTypeTable.MonsterTypes);
  });

  it('enables save logic only when both inputs have values', async () => {
    expect(component.canSave()).toBe(false);
    component.form.controls.name.setValue('Ab');
    component.form.controls.motivation.setValue('short');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.canSave()).toBe(true);
  });

  it('shows validation text on submit when form values are invalid', () => {
    component.form.controls.name.setValue('Ab');
    component.form.controls.motivation.setValue('short');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(createTypeCalls).toBe(0);
    expect(text).toContain('Name must be at least 3 characters.');
    expect(text).toContain('Motivation must be at least 10 characters.');
  });

  it('routes submission based on selected table', () => {
    component.form.controls.referenceTypeTable.setValue(ReferenceTypeTable.BystanderTypes);
    component.form.controls.name.setValue('Helpful Witness');
    component.form.controls.motivation.setValue('Warn hunters when danger appears.');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(createTypeCalls).toBe(1);
    expect(selectedTable).toBe(ReferenceTypeTable.BystanderTypes);
  });

  it('loads records when selected type changes', () => {
    component.form.controls.referenceTypeTable.setValue(ReferenceTypeTable.LocationTypes);
    fixture.detectChanges();

    expect(selectedLoadTable).toBe(ReferenceTypeTable.LocationTypes);
    expect(fixture.nativeElement.textContent).toContain('location-types name');
    expect(fixture.nativeElement.textContent).toContain('location-types motivation');
  });
});
