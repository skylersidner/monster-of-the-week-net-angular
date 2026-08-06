import { Component, DestroyRef, Input, computed, forwardRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { WeaponTagRefResponse } from '../core/models';
import { CustomSelectComponent } from './custom-select.component';

@Component({
  selector: 'app-weapon-tag-select',
  standalone: true,
  imports: [CustomSelectComponent, ReactiveFormsModule],
  templateUrl: './weapon-tag-select.component.html',
  host: { class: 'block' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => WeaponTagSelectComponent),
      multi: true,
    },
  ],
})
export class WeaponTagSelectComponent implements ControlValueAccessor {
  private readonly destroyRef = inject(DestroyRef);

  @Input() options: WeaponTagRefResponse[] = [];
  @Input() placeholder = 'Add weapon tags...';
  @Input() compact = false;

  readonly innerControl = new FormControl<string[]>([], { nonNullable: true });

  private readonly selectedIds = signal<string[]>([]);

  readonly selectedTags = computed(() =>
    this.options.filter((t) => this.selectedIds().includes(t.id)),
  );

  private onChange: (value: string[]) => void = () => {};
  private onTouched = () => {};

  constructor() {
    this.innerControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ids) => {
        this.selectedIds.set(ids);
        this.onChange(ids);
        this.onTouched();
      });
  }

  writeValue(value: string[] | null): void {
    const ids = value ?? [];
    this.selectedIds.set(ids);
    this.innerControl.setValue(ids, { emitEvent: false });
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.innerControl.disable({ emitEvent: false });
    } else {
      this.innerControl.enable({ emitEvent: false });
    }
  }
}
