import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { BystanderDetailResponse, MysteryListItemResponse, TypeRefResponse } from '../../../../core/models';
import { MysterySelectComponent } from '../../../../shared/mystery-select.component';
import { BystanderFormComponent, BystanderFormSubmit } from './bystander-form';

const bystanderTypes: TypeRefResponse[] = [{ id: 'bt1', name: 'Witness', motivation: 'to reveal information' }];

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
  let emitted: BystanderFormSubmit[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BystanderFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BystanderFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('bystanderTypes', bystanderTypes);
    fixture.componentRef.setInput('mysteries', mysteries);
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
      mysteryIds: [],
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
      mysteryIds: [],
    });

    component.onSubmit();

    expect(emitted).toEqual([
      {
        bystander: {
          name: 'Shopkeeper',
          description: null,
          bystanderTypeId: 'bt1',
        },
        mysteryIds: [],
      },
    ]);
  });

  it('emits the trimmed description when one is provided', () => {
    component.bystanderForm.setValue({
      name: 'Shopkeeper',
      description: '  A nervous shopkeeper.  ',
      bystanderTypeId: 'bt1',
      mysteryIds: [],
    });

    component.onSubmit();

    expect(emitted[0].bystander.description).toBe('A nervous shopkeeper.');
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

  it('starts blank in create mode, with no mysteries selected', () => {
    expect(component.bystanderForm.getRawValue()).toEqual({
      name: '',
      description: '',
      bystanderTypeId: '',
      mysteryIds: [],
    });
  });

  it('populates the form when the bystander input is set', () => {
    fixture.componentRef.setInput('bystander', buildBystander());
    fixture.detectChanges();

    expect(component.bystanderForm.getRawValue()).toEqual({
      name: 'Bystander',
      description: 'A nervous shopkeeper.',
      bystanderTypeId: 'bt1',
      mysteryIds: [],
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
      mysteryIds: [],
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
      mysteryIds: [],
    });
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

    expect(labels[3].querySelector('span.text-danger')).toBeFalsy();
    expect(component.bystanderForm.controls.mysteryIds.hasError('required')).toBe(false);
    expect(component.bystanderForm.valid).toBe(false);

    component.bystanderForm.setValue({
      name: 'Shopkeeper',
      description: '',
      bystanderTypeId: 'bt1',
      mysteryIds: [],
    });

    expect(component.bystanderForm.valid).toBe(true);
  });

  it('shows no cross-mystery sharing warning when the bystander is in several mysteries', () => {
    fixture.componentRef.setInput('bystander', buildBystander({ mysteryIds: ['m1', 'm2'] }));
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

  it('hydrates the picker from the bystander mysteryIds', () => {
    fixture.componentRef.setInput('bystander', buildBystander({ mysteryIds: ['m2'] }));
    fixture.detectChanges();

    expect(component.bystanderForm.controls.mysteryIds.value).toEqual(['m2']);

    const chips = fixture.nativeElement.querySelectorAll('app-mystery-select .bg-badge-mystery');
    expect(Array.from(chips).map((chip) => (chip as HTMLElement).textContent?.trim())).toEqual(['Dead Air']);
  });

  it('copies rather than aliases the bystander input mysteryIds array, in and out', () => {
    const bystander = buildBystander({ mysteryIds: ['m1'] });
    fixture.componentRef.setInput('bystander', bystander);
    fixture.detectChanges();

    const controlValue = component.bystanderForm.controls.mysteryIds.value;
    expect(controlValue).toEqual(['m1']);
    expect(controlValue).not.toBe(bystander.mysteryIds);

    component.onSubmit();

    expect(emitted[0].mysteryIds).toEqual(['m1']);
    expect(emitted[0].mysteryIds).not.toBe(controlValue);
    expect(emitted[0].mysteryIds).not.toBe(bystander.mysteryIds);
  });

  it('emits the full desired membership set alongside the bystander payload', () => {
    fixture.componentRef.setInput('bystander', buildBystander({ mysteryIds: ['m1'] }));
    fixture.detectChanges();

    component.bystanderForm.controls.mysteryIds.setValue(['m1', 'm2']);
    component.onSubmit();

    expect(emitted).toEqual([
      {
        bystander: {
          name: 'Bystander',
          description: 'A nervous shopkeeper.',
          bystanderTypeId: 'bt1',
        },
        mysteryIds: ['m1', 'm2'],
      },
    ]);
  });

  it('emits an empty membership set when every mystery is deselected', () => {
    fixture.componentRef.setInput('bystander', buildBystander({ mysteryIds: ['m1', 'm2'] }));
    fixture.detectChanges();

    component.bystanderForm.controls.mysteryIds.setValue([]);
    component.onSubmit();

    expect(emitted[0].mysteryIds).toEqual([]);
  });
});
