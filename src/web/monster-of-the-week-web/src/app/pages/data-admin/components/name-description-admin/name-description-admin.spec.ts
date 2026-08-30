import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { NameDescriptionTable, ReferenceTypeTable } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { NameDescriptionAdminComponent } from './name-description-admin';

describe('NameDescriptionAdminComponent', () => {
  let component: NameDescriptionAdminComponent;
  let fixture: ComponentFixture<NameDescriptionAdminComponent>;
  let createCalls = 0;
  let createdTable: NameDescriptionTable | null = null;
  let loadedTable: NameDescriptionTable | null = null;
  let loadCalls = 0;
  let listShouldFail = false;
  let successMessages: string[] = [];

  beforeEach(async () => {
    createCalls = 0;
    createdTable = null;
    loadedTable = null;
    loadCalls = 0;
    listShouldFail = false;
    successMessages = [];

    await TestBed.configureTestingModule({
      imports: [NameDescriptionAdminComponent],
      providers: [
        {
          provide: ReferenceDataService,
          useValue: {
            createNameDescription: (table: NameDescriptionTable) => {
              createCalls += 1;
              createdTable = table;
              return of({ id: 'record-1', name: 'Close', description: 'Used in close-range attacks.' });
            },
            getNameDescriptionsByTable: (table: NameDescriptionTable) => {
              loadCalls += 1;
              loadedTable = table;
              if (listShouldFail) {
                return throwError(() => new Error('boom'));
              }
              return of([{ id: `${table}-1`, name: `${table} name`, description: `${table} description` }]);
            },
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: (message: string) => successMessages.push(message),
            error: () => {},
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NameDescriptionAdminComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('table', ReferenceTypeTable.WeaponTags);
    fixture.detectChanges();
  });

  it('loads records for the bound table on first change', () => {
    expect(loadCalls).toBe(1);
    expect(loadedTable).toBe(ReferenceTypeTable.WeaponTags);
    expect(fixture.nativeElement.textContent).toContain('Description');
    expect(fixture.nativeElement.textContent).toContain('weapon-tags name');
    expect(fixture.nativeElement.textContent).toContain('weapon-tags description');
  });

  it('submits through the table-routed create call', () => {
    component.form.controls.name.setValue('Hand');
    component.form.controls.description.setValue('Best used in hand-to-hand range.');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(createCalls).toBe(1);
    expect(createdTable).toBe(ReferenceTypeTable.WeaponTags);
    expect(successMessages).toEqual(['Weapon tag "Close" created.']);
  });

  it('reloads and clears the form when the bound table changes', () => {
    component.form.controls.name.setValue('Leftover');
    fixture.componentRef.setInput('table', ReferenceTypeTable.AdventureTypes);
    fixture.detectChanges();

    expect(loadCalls).toBe(2);
    expect(loadedTable).toBe(ReferenceTypeTable.AdventureTypes);
    expect(component.form.controls.name.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('adventure-types name');
  });

  it('applies the per-table description minimum length', () => {
    expect(component.descriptionMinLength()).toBe(10);

    component.form.controls.name.setValue('Ab');
    component.form.controls.description.setValue('Short');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(createCalls).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Description must be at least 10 characters.');

    fixture.componentRef.setInput('table', ReferenceTypeTable.AdventureTypes);
    fixture.detectChanges();
    expect(component.descriptionMinLength()).toBe(5);

    component.form.controls.name.setValue('Ab');
    component.form.controls.description.setValue('Short');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Name must be at least 3 characters.');
    expect(fixture.nativeElement.textContent).not.toContain('Description must be at least 5 characters.');
  });

  it('uses the table label in the load error message', () => {
    listShouldFail = true;
    fixture.componentRef.setInput('table', ReferenceTypeTable.MonsterArchetypes);
    fixture.detectChanges();

    expect(component.recordsLoadError()).toBe('Unable to load monster archetypes.');
    expect(fixture.nativeElement.textContent).toContain('Unable to load monster archetypes.');
  });
});
