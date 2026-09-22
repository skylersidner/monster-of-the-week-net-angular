import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { LocationDetailResponse, MysteryListItemResponse, TypeRefResponse } from '../../../../core/models';
import { MysterySelectComponent } from '../../../../shared/mystery-select.component';
import { LocationFormComponent, LocationFormSubmit } from './location-form';

const locationTypes: TypeRefResponse[] = [{ id: 'lt1', name: 'Hub', motivation: 'to draw people in' }];

function buildMystery(id: string, name: string): MysteryListItemResponse {
  return {
    id,
    name,
    concept: null,
    hook: null,
    adventureType: { id: 'adv-1', name: 'Haunting', description: '' },
    monsterCount: 0,
    locationCount: 0,
    bystanderCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

const mysteries: MysteryListItemResponse[] = [buildMystery('m1', 'The Quiet'), buildMystery('m2', 'Dead Air')];

function buildLocation(overrides: Partial<LocationDetailResponse> = {}): LocationDetailResponse {
  return {
    id: 'l1',
    mysteryIds: [],
    name: 'Location',
    description: 'A dusty crossroads.',
    locationTypeId: 'lt1',
    locationTypeName: 'Hub',
    locationTypeMotivation: 'to draw people in',
    customMoves: [],
    ...overrides,
  };
}

describe('LocationFormComponent', () => {
  let fixture: ComponentFixture<LocationFormComponent>;
  let component: LocationFormComponent;
  let emitted: LocationFormSubmit[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('locationTypes', locationTypes);
    fixture.componentRef.setInput('mysteries', mysteries);
    fixture.componentRef.setInput('location', null);
    fixture.componentRef.setInput('isSaving', false);
    fixture.componentRef.setInput('submitLabel', 'Create Location');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the submit label it is given', () => {
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Create Location');
  });

  it('disables the submit button while isSaving is true', () => {
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fixture.componentRef.setInput('isSaving', true);
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
  });

  it('does not emit save and marks the form touched when it is invalid', () => {
    component.onSubmit();

    expect(emitted).toEqual([]);
    expect(component.locationForm.controls.name.touched).toBe(true);
    expect(component.locationForm.controls.locationTypeId.touched).toBe(true);
  });

  it('does not emit save when submitted through the form element while invalid', () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(component.locationForm.invalid).toBe(true);
  });

  it('treats a blank locationTypeId as invalid, unlike the monster and minion forms', () => {
    component.locationForm.setValue({
      name: 'Crossroads',
      description: '',
      locationTypeId: '',
      mysteryIds: [],
    });

    expect(component.locationForm.controls.locationTypeId.hasError('required')).toBe(true);

    component.onSubmit();

    expect(emitted).toEqual([]);
  });

  it('emits an UpsertLocationRequest with trimmed name and nullable description when valid', () => {
    component.locationForm.setValue({
      name: '  Crossroads  ',
      description: '   ',
      locationTypeId: 'lt1',
      mysteryIds: [],
    });

    component.onSubmit();

    expect(emitted).toEqual([
      {
        location: {
          name: 'Crossroads',
          description: null,
          locationTypeId: 'lt1',
        },
        mysteryIds: [],
      },
    ]);
  });

  it('emits the trimmed description when one is provided', () => {
    component.locationForm.setValue({
      name: 'Crossroads',
      description: '  A dusty crossroads.  ',
      locationTypeId: 'lt1',
      mysteryIds: [],
    });

    component.onSubmit();

    expect(emitted[0].location.description).toBe('A dusty crossroads.');
  });

  it('starts blank in create mode, with no mysteries selected', () => {
    expect(component.locationForm.getRawValue()).toEqual({
      name: '',
      description: '',
      locationTypeId: '',
      mysteryIds: [],
    });
  });

  it('populates the form when the location input is set', () => {
    fixture.componentRef.setInput('location', buildLocation());
    fixture.detectChanges();

    expect(component.locationForm.getRawValue()).toEqual({
      name: 'Location',
      description: 'A dusty crossroads.',
      locationTypeId: 'lt1',
      mysteryIds: [],
    });
  });

  it('repopulates the form when the location input changes again', () => {
    fixture.componentRef.setInput('location', buildLocation());
    fixture.detectChanges();

    fixture.componentRef.setInput(
      'location',
      buildLocation({ name: 'Renamed', description: null, locationTypeId: 'lt2' })
    );
    fixture.detectChanges();

    expect(component.locationForm.getRawValue()).toEqual({
      name: 'Renamed',
      description: '',
      locationTypeId: 'lt2',
      mysteryIds: [],
    });
  });

  it('clears the form when the location input goes back to null', () => {
    fixture.componentRef.setInput('location', buildLocation());
    fixture.detectChanges();

    fixture.componentRef.setInput('location', null);
    fixture.detectChanges();

    expect(component.locationForm.getRawValue()).toEqual({
      name: '',
      description: '',
      locationTypeId: '',
      mysteryIds: [],
    });
  });

  it('shows a required-field asterisk on Name and Location Type labels but not Description', () => {
    const labels = fixture.nativeElement.querySelectorAll('label');
    const [nameLabel, descriptionLabel, locationTypeLabel] = Array.from(labels) as HTMLLabelElement[];

    expect(nameLabel.querySelector('span.text-danger')?.textContent?.trim()).toBe('*');
    expect(locationTypeLabel.querySelector('span.text-danger')?.textContent?.trim()).toBe('*');
    expect(descriptionLabel.querySelector('span.text-danger')).toBeNull();
  });

  it('enforces maxlength 255 on the Name input', () => {
    const nameInput = fixture.nativeElement.querySelector('input[formControlName="name"]') as HTMLInputElement;
    expect(nameInput.maxLength).toBe(255);
  });

  // --- membership picker (mystery-entity-linking-ux.md §9.1) ---------------------------

  it('renders the mystery picker as the last field, immediately above the submit button', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('label')) as HTMLLabelElement[];
    const lastLabel = labels[labels.length - 1];

    expect(labels).toHaveLength(4);
    expect(lastLabel.textContent).toContain('Mysteries');
    expect(lastLabel.querySelector('app-mystery-select')).toBeTruthy();
    expect(lastLabel.nextElementSibling?.getAttribute('type')).toBe('submit');
  });

  it('carries no required asterisk on the Mysteries label — zero mysteries is valid', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('label')) as HTMLLabelElement[];

    expect(labels[3].querySelector('span.text-danger')).toBeNull();
    expect(component.locationForm.controls.mysteryIds.hasError('required')).toBe(false);
    expect(component.locationForm.valid).toBe(false);

    component.locationForm.setValue({
      name: 'Crossroads',
      description: '',
      locationTypeId: 'lt1',
      mysteryIds: [],
    });

    expect(component.locationForm.valid).toBe(true);
  });

  it('shows no cross-mystery sharing warning when the location is in several mysteries', () => {
    fixture.componentRef.setInput('location', buildLocation({ mysteryIds: ['m1', 'm2'] }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('shared');
    expect(text).not.toContain('other mysteries');
    expect(text).not.toContain('will also');
  });

  it('passes its mystery options down to the shared picker', () => {
    const picker = fixture.debugElement.query(By.directive(MysterySelectComponent))
      .componentInstance as MysterySelectComponent;

    expect(picker.options).toBe(mysteries);
  });

  it('hydrates the picker from the location mysteryIds', () => {
    fixture.componentRef.setInput('location', buildLocation({ mysteryIds: ['m2'] }));
    fixture.detectChanges();

    expect(component.locationForm.controls.mysteryIds.value).toEqual(['m2']);

    const chips = fixture.nativeElement.querySelectorAll('app-mystery-select .bg-badge-mystery');
    expect(Array.from(chips).map((chip) => (chip as HTMLElement).textContent?.trim())).toEqual(['Dead Air']);
  });

  it('copies rather than aliases the location input mysteryIds array, in and out', () => {
    const location = buildLocation({ mysteryIds: ['m1'] });
    fixture.componentRef.setInput('location', location);
    fixture.detectChanges();

    const controlValue = component.locationForm.controls.mysteryIds.value;
    expect(controlValue).toEqual(['m1']);
    expect(controlValue).not.toBe(location.mysteryIds);

    component.onSubmit();

    expect(emitted[0].mysteryIds).toEqual(['m1']);
    expect(emitted[0].mysteryIds).not.toBe(controlValue);
    expect(emitted[0].mysteryIds).not.toBe(location.mysteryIds);
  });

  it('emits the full desired membership set alongside the location payload', () => {
    fixture.componentRef.setInput('location', buildLocation({ mysteryIds: ['m1'] }));
    fixture.detectChanges();

    component.locationForm.controls.mysteryIds.setValue(['m1', 'm2']);
    component.onSubmit();

    expect(emitted).toEqual([
      {
        location: {
          name: 'Location',
          description: 'A dusty crossroads.',
          locationTypeId: 'lt1',
        },
        mysteryIds: ['m1', 'm2'],
      },
    ]);
  });

  it('emits an empty membership set when every mystery is deselected', () => {
    fixture.componentRef.setInput('location', buildLocation({ mysteryIds: ['m1', 'm2'] }));
    fixture.detectChanges();

    component.locationForm.controls.mysteryIds.setValue([]);
    component.onSubmit();

    expect(emitted[0].mysteryIds).toEqual([]);
  });
});
