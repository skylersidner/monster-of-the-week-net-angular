import { Component, ElementRef, HostListener, Input, ViewChild, computed, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-custom-select',
  standalone: true,
  templateUrl: './custom-select.component.html',
  styleUrl: './custom-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true,
    },
  ],
})
export class CustomSelectComponent<T> implements ControlValueAccessor {
  @Input() options: readonly T[] = [];
  @Input() placeholder = 'Select an option';
  @Input() searchable = false;
  @Input() multiple = false;
  @Input() emptyText = 'No options available';
  @Input() disabled = false;
  @Input() size: 'default' | 'compact' = 'default';
  @Input() optionValue: (option: T) => string = (option: T) => this.resolveOptionValue(option);
  @Input() optionLabel: (option: T) => string = (option: T) => this.resolveOptionLabel(option);
  @Input() optionSubLabel: (option: T) => string | null = (option: T) => this.resolveOptionSubLabel(option);

  readonly isOpen = signal(false);
  readonly searchTerm = signal('');
  readonly selectedValue = signal<string | null>(null);
  readonly selectedValues = signal<string[]>([]);

  readonly displayText = computed(() => {
    if (this.multiple) {
      const selectedCount = this.selectedValues().length;
      return selectedCount > 0 ? `${selectedCount} selected` : this.placeholder;
    }

    const currentValue = this.selectedValue();
    if (!currentValue) {
      return this.placeholder;
    }

    const selectedOption = this.options.find((option) => this.optionValue(option) === currentValue);
    return selectedOption ? this.optionLabel(selectedOption) : this.placeholder;
  });

  readonly selectedTriggerSubLabel = computed(() => {
    if (this.multiple) return null;
    const currentValue = this.selectedValue();
    if (!currentValue) return null;
    const selectedOption = this.options.find((option) => this.optionValue(option) === currentValue);
    return selectedOption ? this.optionSubLabel(selectedOption) : null;
  });

  private resolveOptionValue(option: T): string {
    const record = option as Record<string, unknown>;
    const value = record['id'];
    return typeof value === 'string' ? value : String(option);
  }

  private resolveOptionLabel(option: T): string {
    const record = option as Record<string, unknown>;
    const label = record['name'];
    return typeof label === 'string' ? label : String(option);
  }

  private resolveOptionSubLabel(option: T): string | null {
    const record = option as Record<string, unknown>;
    const subLabel = record['motivation'] ?? record['description'];
    return typeof subLabel === 'string' && subLabel.length > 0 ? subLabel : null;
  }

  readonly filteredOptions = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.options;
    }

    return this.options.filter((option) => this.optionLabel(option).toLowerCase().includes(term));
  });

  private onChange: (value: string | string[] | null) => void = () => {};
  private onTouched = () => {};

  @ViewChild('trigger') private readonly trigger?: ElementRef<HTMLButtonElement>;

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  /**
   * `Escape` closes the panel and puts focus back on the trigger. Until now the panel could only
   * be dismissed by clicking elsewhere (`handleDocumentClick`), which a keyboard user cannot do.
   *
   * Bound on the **host**, not the trigger, so it also catches `keydown` from the searchable
   * variant's `<input>` inside the panel.
   *
   * The early return and the `stopPropagation()` are load-bearing, not boilerplate: this control
   * can be rendered inside `ConfirmDeleteModalComponent`, which also closes on `Escape`. Returning
   * early while the panel is already closed is what lets a second `Escape` reach the dialog;
   * `stopPropagation()` is what stops the first one from closing the dropdown *and* the dialog at
   * once. Get either wrong and the dropdown takes the whole dialog down with it (§8.7).
   *
   * Scope note: this makes the control **dismissable**, not conformant. Its remaining ARIA gaps —
   * `role="listbox"` over children that are not `role="option"`, no `aria-activedescendant`, no
   * arrow-key navigation — are untouched and logged as a follow-up.
   */
  // `$event` is typed `Event` for a key pseudo-event, and nothing here needs `KeyboardEvent`.
  @HostListener('keydown.escape', ['$event'])
  handleEscape(event: Event): void {
    if (!this.isOpen()) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    this.isOpen.set(false);
    this.searchTerm.set('');
    this.trigger?.nativeElement.focus();
  }

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  toggleOpen(): void {
    if (this.disabled) {
      return;
    }

    this.isOpen.update((open) => !open);
    if (!this.isOpen()) {
      this.searchTerm.set('');
    }
  }

  selectOption(option: T): void {
    const nextValue = this.optionValue(option);

    if (this.multiple) {
      const nextValues = this.selectedValues().includes(nextValue)
        ? this.selectedValues().filter((value) => value !== nextValue)
        : [...this.selectedValues(), nextValue];

      this.selectedValues.set(nextValues);
      this.onChange(nextValues);
      this.onTouched();
      return;
    }

    this.selectedValue.set(nextValue);
    this.onChange(nextValue);
    this.onTouched();
    this.isOpen.set(false);
  }

  isOptionSelected(option: T): boolean {
    const value = this.optionValue(option);
    return this.multiple ? this.selectedValues().includes(value) : this.selectedValue() === value;
  }

  writeValue(value: string | string[] | null): void {
    if (this.multiple) {
      const normalizedValues = Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [];
      this.selectedValues.set(normalizedValues);
      this.selectedValue.set(null);
      return;
    }

    this.selectedValue.set(typeof value === 'string' ? value : null);
    this.selectedValues.set([]);
  }

  registerOnChange(fn: (value: string | string[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
