import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeaponTagSelectComponent } from './weapon-tag-select.component';

describe('WeaponTagSelectComponent', () => {
  let fixture: ComponentFixture<WeaponTagSelectComponent>;
  let component: WeaponTagSelectComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeaponTagSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WeaponTagSelectComponent);
    component = fixture.componentInstance;
    component.options = [
      { id: 'fire', name: 'Fire', description: null },
      { id: 'loud', name: 'Loud', description: null },
    ];
    fixture.detectChanges();
  });

  it('renders the "Weapon Tags" label by default', () => {
    const label = fixture.nativeElement.querySelector('span.text-primary');
    expect(label?.textContent).toContain('Weapon Tags');
  });

  it('omits the "Weapon Tags" label and renders a compact select when compact is true', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('span.text-primary');
    expect(label).toBeNull();

    const customSelect = fixture.nativeElement.querySelector('app-custom-select .custom-select');
    expect(customSelect?.classList.contains('is-compact')).toBe(true);
  });

  it('does not mark the underlying select as compact by default', () => {
    const customSelect = fixture.nativeElement.querySelector('app-custom-select .custom-select');
    expect(customSelect?.classList.contains('is-compact')).toBe(false);
  });

  it('shrinks the selected-tag chips when compact', () => {
    fixture.componentRef.setInput('compact', true);
    component.writeValue(['fire']);
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.bg-weapon-chip');
    expect(chip?.classList.contains('text-[0.7rem]')).toBe(true);
  });
});
