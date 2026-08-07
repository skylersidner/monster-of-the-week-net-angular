import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BystanderDetailResponse, TypeRefResponse, UpsertBystanderRequest } from '../../../../core/models';
import { BystanderFormComponent } from './bystander-form';

const bystanderTypes: TypeRefResponse[] = [{ id: 'bt1', name: 'Witness', motivation: 'to reveal information' }];

function buildBystander(overrides: Partial<BystanderDetailResponse> = {}): BystanderDetailResponse {
  return {
    id: 'b1',
    mysteryIds: [],
    name: 'Bystander',
    description: 'A nervous shopkeeper.',
    bystanderTypeId: 'bt1',
    bystanderTypeName: 'Witness',
    bystanderTypeMotivation: 'to reveal information',
    customMoves: [],
    ...overrides,
  };
}

describe('BystanderFormComponent', () => {
  let fixture: ComponentFixture<BystanderFormComponent>;
  let component: BystanderFormComponent;
  let emitted: UpsertBystanderRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BystanderFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BystanderFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('bystanderTypes', bystanderTypes);
    fixture.componentRef.setInput('bystander', null);
    fixture.componentRef.setInput('isSaving', false);
    fixture.componentRef.setInput('submitLabel', 'Create Bystander');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the submit label it is given', () => {
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Create Bystander');
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
    expect(component.bystanderForm.controls.name.touched).toBe(true);
    expect(component.bystanderForm.controls.bystanderTypeId.touched).toBe(true);
  });

  it('does not emit save when submitted through the form element while invalid', () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(component.bystanderForm.invalid).toBe(true);
  });

  it('treats a blank bystanderTypeId as invalid, unlike the monster and minion forms', () => {
    component.bystanderForm.setValue({
      name: 'Shopkeeper',
      description: '',
      bystanderTypeId: '',
    });

    expect(component.bystanderForm.controls.bystanderTypeId.hasError('required')).toBe(true);

    component.onSubmit();

    expect(emitted).toEqual([]);
  });

  it('emits an UpsertBystanderRequest with trimmed name and nullable description when valid', () => {
    component.bystanderForm.setValue({
      name: '  Shopkeeper  ',
      description: '   ',
      bystanderTypeId: 'bt1',
    });

    component.onSubmit();

    expect(emitted).toEqual([
      {
        name: 'Shopkeeper',
        description: null,
        bystanderTypeId: 'bt1',
      },
    ]);
  });

  it('emits the trimmed description when one is provided', () => {
    component.bystanderForm.setValue({
      name: 'Shopkeeper',
      description: '  A nervous shopkeeper.  ',
      bystanderTypeId: 'bt1',
    });

    component.onSubmit();

    expect(emitted[0].description).toBe('A nervous shopkeeper.');
  });

  it('shows a required-field asterisk on Name and Bystander Type labels, but not Description', () => {
    const labels = fixture.nativeElement.querySelectorAll('label') as NodeListOf<HTMLLabelElement>;
    const [nameLabel, descriptionLabel, bystanderTypeLabel] = Array.from(labels);

    expect(nameLabel.querySelector('span.text-danger')).toBeTruthy();
    expect(bystanderTypeLabel.querySelector('span.text-danger')).toBeTruthy();
    expect(descriptionLabel.querySelector('span.text-danger')).toBeFalsy();
  });

  it('caps the Name input at 255 characters', () => {
    const input = fixture.nativeElement.querySelector('input[formControlName="name"]') as HTMLInputElement;
    expect(input.maxLength).toBe(255);
  });

  it('starts blank in create mode', () => {
    expect(component.bystanderForm.getRawValue()).toEqual({
      name: '',
      description: '',
      bystanderTypeId: '',
    });
  });

  it('populates the form when the bystander input is set', () => {
    fixture.componentRef.setInput('bystander', buildBystander());
    fixture.detectChanges();

    expect(component.bystanderForm.getRawValue()).toEqual({
      name: 'Bystander',
      description: 'A nervous shopkeeper.',
      bystanderTypeId: 'bt1',
    });
  });

  it('repopulates the form when the bystander input changes again', () => {
    fixture.componentRef.setInput('bystander', buildBystander());
    fixture.detectChanges();

    fixture.componentRef.setInput(
      'bystander',
      buildBystander({ name: 'Renamed', description: null, bystanderTypeId: 'bt2' })
    );
    fixture.detectChanges();

    expect(component.bystanderForm.getRawValue()).toEqual({
      name: 'Renamed',
      description: '',
      bystanderTypeId: 'bt2',
    });
  });

  it('clears the form when the bystander input goes back to null', () => {
    fixture.componentRef.setInput('bystander', buildBystander());
    fixture.detectChanges();

    fixture.componentRef.setInput('bystander', null);
    fixture.detectChanges();

    expect(component.bystanderForm.getRawValue()).toEqual({
      name: '',
      description: '',
      bystanderTypeId: '',
    });
  });
});
