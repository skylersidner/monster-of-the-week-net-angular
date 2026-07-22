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
});
