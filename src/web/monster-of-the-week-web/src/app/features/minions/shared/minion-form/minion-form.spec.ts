import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MinionDetailResponse, TypeRefResponse, UpsertMinionRequest } from '../../../../core/models';
import { MinionFormComponent } from './minion-form';

const minionTypes: TypeRefResponse[] = [{ id: 'minion-type-1', name: 'Torturer', motivation: 'to dominate' }];

function buildMinion(overrides: Partial<MinionDetailResponse> = {}): MinionDetailResponse {
  return {
    id: 'mn1',
    monsterId: 'mo1',
    monsterName: 'The Beast',
    name: 'Minion',
    description: 'Skulks in the alley.',
    harmCapacity: 3,
    minionType: minionTypes[0],
    attacks: [],
    powers: [],
    armors: [],
    weaknesses: [],
    customMoves: [],
    ...overrides,
  };
}

describe('MinionFormComponent', () => {
  let fixture: ComponentFixture<MinionFormComponent>;
  let component: MinionFormComponent;
  let emitted: UpsertMinionRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinionFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MinionFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('minionTypes', minionTypes);
    fixture.componentRef.setInput('minion', null);
    fixture.componentRef.setInput('isSaving', false);
    fixture.componentRef.setInput('submitLabel', 'Create Minion');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the submit label it is given', () => {
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Create Minion');
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
    expect(component.minionForm.controls.name.touched).toBe(true);
    expect(component.minionForm.controls.harmCapacity.touched).toBe(true);
  });

  it('does not emit save when submitted through the form element while invalid', () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(component.minionForm.invalid).toBe(true);
  });

  it('emits an UpsertMinionRequest with trimmed name and nullable description when valid', () => {
    component.minionForm.setValue({
      name: '  Alley Thug  ',
      description: '   ',
      harmCapacity: 2,
      minionTypeId: 'minion-type-1',
    });

    component.onSubmit();

    expect(emitted).toEqual([
      {
        name: 'Alley Thug',
        description: null,
        harmCapacity: 2,
        minionTypeId: 'minion-type-1',
      },
    ]);
  });

  it('emits the trimmed description when one is provided', () => {
    component.minionForm.setValue({
      name: 'Alley Thug',
      description: '  Skulks in the alley.  ',
      harmCapacity: 2,
      minionTypeId: 'minion-type-1',
    });

    component.onSubmit();

    expect(emitted[0].description).toBe('Skulks in the alley.');
  });

  it('starts blank in create mode', () => {
    expect(component.minionForm.getRawValue()).toEqual({
      name: '',
      description: '',
      harmCapacity: 0,
      minionTypeId: '',
    });
  });

  it('populates the form when the minion input is set', () => {
    fixture.componentRef.setInput('minion', buildMinion());
    fixture.detectChanges();

    expect(component.minionForm.getRawValue()).toEqual({
      name: 'Minion',
      description: 'Skulks in the alley.',
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
  });

  it('repopulates the form when the minion input changes again', () => {
    fixture.componentRef.setInput('minion', buildMinion());
    fixture.detectChanges();

    fixture.componentRef.setInput('minion', buildMinion({ name: 'Renamed', description: null, harmCapacity: 1 }));
    fixture.detectChanges();

    expect(component.minionForm.getRawValue()).toEqual({
      name: 'Renamed',
      description: '',
      harmCapacity: 1,
      minionTypeId: 'minion-type-1',
    });
  });

  it('clears the form when the minion input goes back to null', () => {
    fixture.componentRef.setInput('minion', buildMinion());
    fixture.detectChanges();

    fixture.componentRef.setInput('minion', null);
    fixture.detectChanges();

    expect(component.minionForm.getRawValue()).toEqual({
      name: '',
      description: '',
      harmCapacity: 0,
      minionTypeId: '',
    });
  });
});
