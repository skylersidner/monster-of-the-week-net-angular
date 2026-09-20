import { Component, DestroyRef, Input, computed, forwardRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { MysteryListItemResponse } from '../core/models';
import { CustomSelectComponent } from './custom-select.component';

/**
 * Multi-picks the mysteries an entity belongs to. A near-copy of
 * `WeaponTagSelectComponent` — the app's shipped idiom for "multi-pick existing
 * entities" — with three deliberate differences, all from
 * `docs/updates/mystery-entity-linking-ux.md` §9.2:
 *
 * - **Chips use the Mystery domain badge**, `bg-badge-mystery`/`text-on-badge-mystery`
 *   with the shared badge class string, not the indigo weapon-tag chip. The domain
 *   colour map lives at `features/search/pages/search-results/search-results.ts`.
 * - **`optionSubLabel` is the adventure type name**, so two similarly-named mysteries
 *   are distinguishable in the dropdown.
 * - **No built-in label.** The host renders `Mysteries` in the same
 *   `<label class="grid font-medium gap-1">` shape as every other form field, because
 *   this control is a field of the form rather than a bolted-on side panel.
 *
 * The chips are display-only and are deliberately **not** links (§4.4 of the
 * architecture doc, §9.3 of the UX doc): this control lives inside a frequently-dirty
 * form that has no `CanDeactivate` guard, and a chip inside an editable multi-select is
 * already a control — making it a navigation target too makes clicking it ambiguous.
 * Removal is by unchecking in the dropdown, exactly as weapon tags work today.
 */
@Component({
  selector: 'app-mystery-select',
  standalone: true,
  imports: [CustomSelectComponent, ReactiveFormsModule],
  templateUrl: './mystery-select.component.html',
  host: { class: 'block' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MysterySelectComponent),
      multi: true,
    },
  ],
})
export class MysterySelectComponent implements ControlValueAccessor {
  private readonly destroyRef = inject(DestroyRef);

  private readonly optionList = signal<MysteryListItemResponse[]>([]);

  /**
   * Backed by a signal rather than being a plain field, because `selectedMysteries` is a
   * `computed()` that reads it. A `computed` only re-evaluates when a signal it read
   * changes, so reading a plain `@Input` field there would leave the chips frozen at
   * whatever the options were the first time it ran — set a value, then swap `options`,
   * and the chips stay empty forever.
   *
   * Not reachable from the two Phase 2 forms, which `forkJoin` the entity and the mystery
   * list into one callback so `options` is only ever assigned once. It is reachable from
   * any host that loads its options separately or refreshes them, which is why it is fixed
   * here rather than left to be discovered. `WeaponTagSelectComponent` has the same defect
   * verbatim and is deliberately left alone — pre-existing, and not this phase's scope.
   */
  @Input()
  set options(value: MysteryListItemResponse[]) {
    this.optionList.set(value ?? []);
  }
  get options(): MysteryListItemResponse[] {
    return this.optionList();
  }

  @Input() placeholder = 'Add to mysteries...';
  @Input() emptyText = 'No mysteries available';

  readonly innerControl = new FormControl<string[]>([], { nonNullable: true });

  private readonly selectedIds = signal<string[]>([]);

  readonly selectedMysteries = computed(() =>
    this.optionList().filter((mystery) => this.selectedIds().includes(mystery.id)),
  );

  readonly adventureTypeOf = (mystery: MysteryListItemResponse): string | null =>
    mystery.adventureType?.name ?? null;

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
