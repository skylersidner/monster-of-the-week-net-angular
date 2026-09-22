import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MysteryListItemResponse } from '../core/models';
import { MysterySelectComponent } from './mystery-select.component';

function buildMystery(id: string, name: string, adventureTypeName: string): MysteryListItemResponse {
  return {
    id,
    name,
    concept: null,
    hook: null,
    adventureType: { id: `adv-${id}`, name: adventureTypeName, description: '' },
    monsterCount: 0,
    locationCount: 0,
    bystanderCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

describe('MysterySelectComponent', () => {
  let fixture: ComponentFixture<MysterySelectComponent>;
  let component: MysterySelectComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MysterySelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MysterySelectComponent);
    component = fixture.componentInstance;
    component.options = [
      buildMystery('m1', 'The Quiet', 'Haunting'),
      buildMystery('m2', 'Dead Air', 'Torture'),
    ];
    fixture.detectChanges();
  });

  function chips(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.bg-badge-mystery')) as HTMLElement[];
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders no chips and no label of its own when nothing is selected', () => {
    expect(chips()).toEqual([]);
    expect((fixture.nativeElement.textContent as string).trim()).not.toContain('Mysteries');
  });

  // The empty state the app actually starts in: a fresh install has no mysteries, and this
  // control is now a field of every location and bystander form, so it is on screen before the
  // first mystery exists. It must degrade to an explanation rather than an empty box — and the
  // explanation lives in the panel, not on the trigger, which keeps showing the placeholder.
  it('offers its empty text, not a blank panel, when no mysteries exist at all', () => {
    component.options = [];
    fixture.detectChanges();

    expect(chips()).toEqual([]);
    expect((fixture.nativeElement.textContent as string)).not.toContain('No mysteries available');

    (fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain('No mysteries available');
    expect(fixture.nativeElement.querySelectorAll('[role="listbox"] button')).toHaveLength(0);
  });

  it('renders a chip per selected mystery, in option order', () => {
    component.writeValue(['m2', 'm1']);
    fixture.detectChanges();

    expect(chips().map((chip) => chip.textContent?.trim())).toEqual(['The Quiet', 'Dead Air']);
  });

  it('uses the Mystery domain badge token, not the weapon-tag chip', () => {
    component.writeValue(['m1']);
    fixture.detectChanges();

    const [chip] = chips();
    expect(chip.classList.contains('bg-badge-mystery')).toBe(true);
    expect(chip.classList.contains('text-on-badge-mystery')).toBe(true);
    expect(chip.classList.contains('bg-weapon-chip')).toBe(false);
  });

  it('uses the shared badge class string', () => {
    component.writeValue(['m1']);
    fixture.detectChanges();

    const [chip] = chips();
    for (const token of [
      'rounded-full',
      'text-[0.72rem]',
      'font-semibold',
      'tracking-[0.02em]',
      'px-[0.55rem]',
      'py-[0.15rem]',
      'whitespace-nowrap',
    ]) {
      expect(chip.classList.contains(token)).toBe(true);
    }
  });

  it('renders the chips as plain spans, never links', () => {
    component.writeValue(['m1', 'm2']);
    fixture.detectChanges();

    expect(chips().every((chip) => chip.tagName === 'SPAN')).toBe(true);
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });

  function openPanel(): void {
    const trigger = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
  }

  it('drives the custom-select in multi-pick mode', () => {
    const select = fixture.nativeElement.querySelector('app-custom-select .custom-select') as HTMLElement;
    expect(select.classList.contains('multiple-select')).toBe(true);

    component.writeValue(['m1', 'm2']);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLElement;
    expect(trigger.textContent?.trim()).toContain('2 selected');
  });

  it('shows the placeholder on the trigger while nothing is selected', () => {
    const trigger = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLElement;
    expect(trigger.textContent).toContain('Add to mysteries...');
  });

  it('makes the option panel searchable', () => {
    openPanel();

    expect(fixture.nativeElement.querySelector('.custom-select__search input')).toBeTruthy();
  });

  it('renders the adventure type as each option sub-label', () => {
    openPanel();

    const subLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.custom-select__option-sublabel')
    ) as HTMLElement[];

    expect(subLabels.map((element) => element.textContent?.trim())).toEqual(['Haunting', 'Torture']);
  });

  it('selects an option from the panel without clearing the previous one', () => {
    component.writeValue(['m1']);
    fixture.detectChanges();
    openPanel();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('.custom-select__option')
    ) as HTMLButtonElement[];
    options[1].click();
    fixture.detectChanges();

    expect(component.innerControl.value).toEqual(['m1', 'm2']);
    expect(chips().map((chip) => chip.textContent?.trim())).toEqual(['The Quiet', 'Dead Air']);
  });

  it('removes a mystery by unticking it in the panel, there being no per-chip control', () => {
    component.writeValue(['m1', 'm2']);
    fixture.detectChanges();
    openPanel();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('.custom-select__option')
    ) as HTMLButtonElement[];
    options[0].click();
    fixture.detectChanges();

    expect(component.innerControl.value).toEqual(['m2']);
    expect(fixture.nativeElement.querySelector('.bg-badge-mystery button')).toBeNull();
  });

  it('propagates selection changes through the ControlValueAccessor', () => {
    const seen: string[][] = [];
    component.registerOnChange((ids) => seen.push(ids));

    component.innerControl.setValue(['m1', 'm2']);

    expect(seen).toEqual([['m1', 'm2']]);
  });

  it('treats a null written value as an empty selection', () => {
    component.writeValue(['m1']);
    component.writeValue(null);
    fixture.detectChanges();

    expect(chips()).toEqual([]);
    expect(component.innerControl.value).toEqual([]);
  });

  it('does not emit a change when a value is written in', () => {
    const seen: string[][] = [];
    component.registerOnChange((ids) => seen.push(ids));

    component.writeValue(['m1']);

    expect(seen).toEqual([]);
  });

  // `selectedMysteries` is a `computed()`. If it read a plain `@Input()` field, nothing would
  // invalidate it when the options arrived, and the chips would stay empty forever. Reachable
  // from any host that loads its options separately from the entity.
  it('renders chips for options that arrive after a value has been written', () => {
    fixture.componentRef.setInput('options', []);
    component.writeValue(['m1']);
    fixture.detectChanges();

    expect(chips()).toEqual([]);

    fixture.componentRef.setInput('options', [buildMystery('m1', 'The Quiet', 'Haunting')]);
    fixture.detectChanges();

    expect(chips().map((chip) => chip.textContent?.trim())).toEqual(['The Quiet']);
  });

  it('re-renders chips when the option list is replaced', () => {
    component.writeValue(['m1']);
    fixture.detectChanges();
    expect(chips().map((chip) => chip.textContent?.trim())).toEqual(['The Quiet']);

    fixture.componentRef.setInput('options', [buildMystery('m1', 'Renamed', 'Haunting')]);
    fixture.detectChanges();

    expect(chips().map((chip) => chip.textContent?.trim())).toEqual(['Renamed']);
  });

  it('treats a null option list as empty rather than throwing', () => {
    fixture.componentRef.setInput('options', null);
    component.writeValue(['m1']);
    fixture.detectChanges();

    expect(component.options).toEqual([]);
    expect(chips()).toEqual([]);
  });

  it('disables and re-enables the inner control', () => {
    component.setDisabledState(true);
    expect(component.innerControl.disabled).toBe(true);

    component.setDisabledState(false);
    expect(component.innerControl.disabled).toBe(false);
  });
});
