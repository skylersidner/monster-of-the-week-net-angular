import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocationDetailResponse, TypeRefResponse, UpsertLocationRequest } from '../../../../core/models';
import { LocationFormComponent } from './location-form';

const locationTypes: TypeRefResponse[] = [{ id: 'lt1', name: 'Hub', motivation: 'to draw people in' }];

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
  let emitted: UpsertLocationRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('locationTypes', locationTypes);
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
    });

    component.onSubmit();

    expect(emitted).toEqual([
      {
        name: 'Crossroads',
        description: null,
        locationTypeId: 'lt1',
      },
    ]);
  });

  it('emits the trimmed description when one is provided', () => {
    component.locationForm.setValue({
      name: 'Crossroads',
      description: '  A dusty crossroads.  ',
      locationTypeId: 'lt1',
    });

    component.onSubmit();

    expect(emitted[0].description).toBe('A dusty crossroads.');
  });

  it('starts blank in create mode', () => {
    expect(component.locationForm.getRawValue()).toEqual({
      name: '',
      description: '',
      locationTypeId: '',
    });
  });

  it('populates the form when the location input is set', () => {
    fixture.componentRef.setInput('location', buildLocation());
    fixture.detectChanges();

    expect(component.locationForm.getRawValue()).toEqual({
      name: 'Location',
      description: 'A dusty crossroads.',
      locationTypeId: 'lt1',
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
});
