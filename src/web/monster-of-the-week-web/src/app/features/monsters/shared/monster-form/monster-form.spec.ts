import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonsterArchetypeResponse, MonsterDetailResponse, TypeRefResponse, UpsertMonsterRequest } from '../../../../core/models';
import { MonsterFormComponent } from './monster-form';

const monsterTypes: TypeRefResponse[] = [{ id: 'monster-type-1', name: 'Beast', motivation: 'to feed' }];

const monsterArchetypes: MonsterArchetypeResponse[] = [
  { id: 'monster-archetype-1', name: 'Ghost', description: 'A restless spirit.' },
];

function buildMonster(overrides: Partial<MonsterDetailResponse> = {}): MonsterDetailResponse {
  return {
    id: 'mo1',
    mysteryIds: ['m1'],
    name: 'Monster',
    description: 'Lurks in the fog.',
    harmCapacity: 7,
    monsterTypeId: 'monster-type-1',
    monsterTypeName: 'Beast',
    monsterArchetype: monsterArchetypes[0],
    attacks: [],
    powers: [],
    armors: [],
    weaknesses: [],
    customMoves: [],
    ...overrides,
  };
}

describe('MonsterFormComponent', () => {
  let fixture: ComponentFixture<MonsterFormComponent>;
  let component: MonsterFormComponent;
  let emitted: UpsertMonsterRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonsterFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MonsterFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('monsterTypes', monsterTypes);
    fixture.componentRef.setInput('monsterArchetypes', monsterArchetypes);
    fixture.componentRef.setInput('monster', null);
    fixture.componentRef.setInput('isSaving', false);
    fixture.componentRef.setInput('submitLabel', 'Create Monster');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the submit label it is given', () => {
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Create Monster');
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
    expect(component.monsterForm.controls.name.touched).toBe(true);
    expect(component.monsterForm.controls.monsterTypeId.touched).toBe(true);
    expect(component.monsterForm.controls.monsterArchetypeId.touched).toBe(true);
  });

  it('does not emit save when submitted through the form element while invalid', () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(component.monsterForm.invalid).toBe(true);
  });

  it('emits an UpsertMonsterRequest with trimmed name and nullable description when valid', () => {
    component.monsterForm.setValue({
      name: '  Swamp Thing  ',
      description: '   ',
      harmCapacity: 4,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });

    component.onSubmit();

    expect(emitted).toEqual([
      {
        name: 'Swamp Thing',
        description: null,
        harmCapacity: 4,
        monsterTypeId: 'monster-type-1',
        monsterArchetypeId: 'monster-archetype-1',
      },
    ]);
  });

  it('emits the trimmed description when one is provided', () => {
    component.monsterForm.setValue({
      name: 'Swamp Thing',
      description: '  Lurks in the fog.  ',
      harmCapacity: 4,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });

    component.onSubmit();

    expect(emitted[0].description).toBe('Lurks in the fog.');
  });

  it('starts blank in create mode', () => {
    expect(component.monsterForm.getRawValue()).toEqual({
      name: '',
      description: '',
      harmCapacity: 0,
      monsterTypeId: '',
      monsterArchetypeId: '',
    });
  });

  it('populates the form when the monster input is set', () => {
    fixture.componentRef.setInput('monster', buildMonster());
    fixture.detectChanges();

    expect(component.monsterForm.getRawValue()).toEqual({
      name: 'Monster',
      description: 'Lurks in the fog.',
      harmCapacity: 7,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });
  });

  it('repopulates the form when the monster input changes again', () => {
    fixture.componentRef.setInput('monster', buildMonster());
    fixture.detectChanges();

    fixture.componentRef.setInput(
      'monster',
      buildMonster({ name: 'Renamed', description: null, harmCapacity: 2 })
    );
    fixture.detectChanges();

    expect(component.monsterForm.getRawValue()).toEqual({
      name: 'Renamed',
      description: '',
      harmCapacity: 2,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });
  });

  it('renders a required-field asterisk on every required label', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('label')) as HTMLLabelElement[];
    const requiredLabels = ['Name', 'Harm Capacity', 'Monster Type', 'Monster Archetype'];

    for (const requiredLabel of requiredLabels) {
      const label = labels.find((element) => element.textContent?.trim().startsWith(requiredLabel));
      expect(label?.querySelector('span.text-danger')?.textContent?.trim()).toBe('*');
    }

    const descriptionLabel = labels.find((element) => element.textContent?.trim().startsWith('Description'));
    expect(descriptionLabel?.querySelector('span.text-danger')).toBeNull();
  });

  it('enforces maxlength 255 on the Name input', () => {
    const nameInput = fixture.nativeElement.querySelector('input[formControlName="name"]') as HTMLInputElement;
    expect(nameInput.maxLength).toBe(255);
  });

  it('clears the form when the monster input goes back to null', () => {
    fixture.componentRef.setInput('monster', buildMonster());
    fixture.detectChanges();

    fixture.componentRef.setInput('monster', null);
    fixture.detectChanges();

    expect(component.monsterForm.getRawValue()).toEqual({
      name: '',
      description: '',
      harmCapacity: 0,
      monsterTypeId: '',
      monsterArchetypeId: '',
    });
  });
});
