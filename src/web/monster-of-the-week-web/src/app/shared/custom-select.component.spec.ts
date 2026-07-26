import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomSelectComponent } from './custom-select.component';

describe('CustomSelectComponent', () => {
  let fixture: ComponentFixture<CustomSelectComponent<{ id: string; name: string }>>;
  let component: CustomSelectComponent<{ id: string; name: string }>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomSelectComponent<{ id: string; name: string }>);
    component = fixture.componentInstance;
    component.options = [
      { id: 'monster', name: 'Monster' },
      { id: 'ghost', name: 'Ghost' },
    ];
    component.placeholder = 'Choose a type';
    fixture.detectChanges();
  });

  it('renders the placeholder and opens to show the available options', () => {
    const button = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Choose a type');
    expect(fixture.nativeElement.textContent).toContain('Monster');
    expect(fixture.nativeElement.textContent).toContain('Ghost');
  });

  it('filters options when searchable mode is enabled', () => {
    component.searchable = true;
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.custom-select__search input') as HTMLInputElement;
    input.value = 'gh';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ghost');
    expect(fixture.nativeElement.textContent).not.toContain('Monster');
  });

  it('shows motivation as a sub-label when the option has a motivation field', () => {
    type TypeOption = { id: string; name: string; motivation: string };
    const typedFixture = TestBed.createComponent(CustomSelectComponent<TypeOption>);
    const typedComponent = typedFixture.componentInstance;
    typedComponent.options = [
      { id: 'beast', name: 'Beast', motivation: 'to feed' },
      { id: 'devourer', name: 'Devourer', motivation: 'to consume everything' },
    ];
    typedComponent.placeholder = 'Select a type';
    typedFixture.detectChanges();

    const trigger = typedFixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    trigger.click();
    typedFixture.detectChanges();

    const sublabels = typedFixture.nativeElement.querySelectorAll('.custom-select__option-sublabel') as NodeListOf<HTMLElement>;
    expect(sublabels.length).toBe(2);
    expect(sublabels[0].textContent).toContain('to feed');
    expect(sublabels[1].textContent).toContain('to consume everything');
  });

  it('does not render a sub-label element when options have no motivation field', () => {
    const trigger = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const sublabels = fixture.nativeElement.querySelectorAll('.custom-select__option-sublabel') as NodeListOf<HTMLElement>;
    expect(sublabels.length).toBe(0);
  });

  it('supports a custom optionSubLabel input to render secondary text', () => {
    type TagOption = { id: string; name: string; category: string };
    const typedFixture = TestBed.createComponent(CustomSelectComponent<TagOption>);
    const typedComponent = typedFixture.componentInstance;
    typedComponent.options = [{ id: 'loud', name: 'Loud', category: 'sonic' }];
    typedComponent.optionSubLabel = (opt) => opt.category;
    typedComponent.placeholder = 'Pick';
    typedFixture.detectChanges();

    const trigger = typedFixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    trigger.click();
    typedFixture.detectChanges();

    const sublabel = typedFixture.nativeElement.querySelector('.custom-select__option-sublabel') as HTMLElement;
    expect(sublabel).toBeTruthy();
    expect(sublabel.textContent).toContain('sonic');
  });
});
