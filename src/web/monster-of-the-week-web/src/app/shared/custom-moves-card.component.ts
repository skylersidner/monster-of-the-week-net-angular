import {
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  Output,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomMoveOwnerType } from '../core/models';
import { IconComponent } from './icons/icon.component';

/**
 * One row the card renders.
 *
 * **A card-local view model rather than `CustomMoveResponse`**, which is the one type decision in
 * this component worth arguing (architecture.md §28.1). A detail page has
 * `CustomMoveResponse[]` with real server ids; a create page has staged drafts with none. Taking
 * the response type would force the create pages to invent ids inside an object *named*
 * `…Response`, which is the "a baseline and its draft" confusion this subsystem has already been
 * bitten by twice. Three fields, and each host maps into it with a one-line `computed`.
 */
export interface CustomMoveRow {
  /** Stable identity: the server id on a detail page, a client draft key on a create page. */
  key: string;
  name: string;
  description: string | null;
}

/** What a submit means. `key === null` is an add; anything else is an edit of that row. */
export interface CustomMoveCommit {
  key: string | null;
  /** Trimmed and non-empty — the card refuses to emit otherwise, so no host re-validates. */
  name: string;
  /** Trimmed, or null when blank. Matches `UpsertCustomMoveRequest` and the services' own trimming. */
  description: string | null;
}

/**
 * The Custom Moves card — one component for all five detail pages and all four standalone create
 * pages (architecture.md §13.2, §28; nine call sites).
 *
 * **Presentational: it never injects `CustomMoveService` and never shows a modal.** Immediate
 * versus staged is not a configuration, it is what the *host* does with `(committed)` and
 * `(removeRequested)` — a detail page turns them into `POST`/`PUT`/`DELETE`, a create page into a
 * `signal<T[]>` update. There is deliberately **no `mode` input**, so there is nothing for the two
 * modes to drift apart on. That is `app-resource-images-card`'s contract exactly, one feature over.
 *
 * **The one departure from that card: this one owns a form.** Justified because the images card's
 * action is a modal the host opens, whereas this is two fields that would otherwise be duplicated
 * at nine call sites.
 *
 * **Five inputs, three outputs** (Skyler's L-D1). `(editRequested)`/`(editCancelled)` collapse into
 * the two-way `[(editingKey)]`, the same shape `app-image-carousel`'s `[(activeImageId)]` already
 * ships on four pages — so a host binds one signal and writes no handler for either. Skyler's
 * reason was broader than this component: *"Overall, I prefer the two-way binding as a more
 * straightforward pattern"*, so the next shared component with a request-plus-cancel pair should
 * reach for `[(x)]` first.
 */
@Component({
  selector: 'app-custom-moves-card',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './custom-moves-card.component.html',
  host: { class: 'block' },
})
export class CustomMovesCardComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * **Rendered, not just held** — see the template's `[attr.data-owner-type]`.
   *
   * Nothing in the card's own behaviour needs the owner type: there is no icon and no copy
   * variation. Rather than carry an unused required input, it is put in the DOM, which gives
   * Phase 6's five-domain guard a value to assert *before* it normalises the owner token away.
   * That is the exact hole a negative control found in the images guard, where normalising
   * `ownertype="X"` made "this page is wired to the wrong domain" invisible. The images card only
   * has a readable attribute because every call site happens to pass it as a *static* attribute;
   * a binding would not appear in `outerHTML` at all. Not depending on that accident twice.
   */
  @Input({ required: true }) ownerType!: CustomMoveOwnerType;

  /** Signal-backed: read by `editingRow` below, not only by the template. */
  @Input()
  set rows(value: readonly CustomMoveRow[]) {
    this.rowsSignal.set(value ?? []);
  }
  get rows(): readonly CustomMoveRow[] {
    return this.rowsSignal();
  }

  /**
   * Which row is open for editing, or `null` for the add form. Two-way: the card asks by emitting
   * `editingKeyChange`, the host owns the state.
   */
  @Input()
  set editingKey(value: string | null) {
    const previous = this.editingKeySignal();
    this.editingKeySignal.set(value ?? null);
    if (previous !== this.editingKeySignal()) {
      this.syncFormToEditingRow();
    }
  }
  get editingKey(): string | null {
    return this.editingKeySignal();
  }
  @Output() editingKeyChange = new EventEmitter<string | null>();

  /** Set while any mutation is in flight; disables the whole surface. */
  @Input()
  set busy(value: boolean) {
    this.busySignal.set(!!value);
  }
  get busy(): boolean {
    return this.busySignal();
  }

  /**
   * Detail pages take the default, matching the images card's *"No images yet."*; the create pages
   * pass *"No custom moves added yet."* to match their four sibling draft panels' *"No attacks
   * added yet."* One input, both local consistencies satisfied (§13.3).
   */
  @Input() emptyText = 'No custom moves yet.';

  @Output() committed = new EventEmitter<CustomMoveCommit>();

  /**
   * **The whole row, not the key.** A detail host needs `name` for the confirm modal's `itemName`
   * and a create host needs `key` for the splice; emitting the row serves both with no lookup.
   * `app-image-carousel`'s `(deleteRequested)` emits the whole `ResourceImageResponse` for the
   * same reason.
   */
  @Output() removeRequested = new EventEmitter<CustomMoveRow>();

  private readonly rowsSignal = signal<readonly CustomMoveRow[]>([]);
  private readonly editingKeySignal = signal<string | null>(null);
  private readonly busySignal = signal(false);

  readonly isEditing = computed(() => this.editingKeySignal() !== null);
  readonly isEmpty = computed(() => this.rowsSignal().length === 0);
  readonly editingRow = computed(
    () => this.rowsSignal().find((row) => row.key === this.editingKeySignal()) ?? null
  );

  /**
   * `maxlength` matches `UpsertCustomMoveRequest`'s `[MaxLength(255)]` on `Name`. **The textarea
   * has no cap, and that is correct rather than an omission**: `Description` has no server-side
   * length limit at all — the annotation is on `Name` only and the column is Postgres `text`
   * (architecture.md B13). A client cap would invent a rule the API does not have.
   */
  readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
  });

  submit(): void {
    const name = this.form.controls.name.value.trim();
    // `Validators.required` rejects '' but not '   ', and the server accepts a whitespace-only name
    // (it trims *after* validating, so it persists as ''). Blocking it here is a deliberate
    // client-side tightening: a row rendering as an empty <strong> is worse than a blocked submit.
    if (this.form.invalid || name.length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    const description = (this.form.controls.description.value ?? '').trim();
    this.committed.emit({
      key: this.editingKeySignal(),
      name,
      description: description.length > 0 ? description : null,
    });
  }

  /** Pencil. The host echoes the key back through `[(editingKey)]`, which populates the form. */
  requestEdit(row: CustomMoveRow): void {
    this.editingKeySignal.set(row.key);
    this.editingKeyChange.emit(row.key);
    this.syncFormToEditingRow();
    this.focusFormHeading();
  }

  /** Cancel. Restores focus to the row's pencil — see `restoreFocusTo`. */
  cancelEdit(): void {
    const leaving = this.editingKeySignal();
    this.editingKeySignal.set(null);
    this.editingKeyChange.emit(null);
    this.syncFormToEditingRow();
    this.restoreFocusTo(leaving);
  }

  /**
   * Called by the host after a successful commit, to put the card back in add mode and return
   * focus to the row that was being edited.
   *
   * **Why the host calls this rather than the card watching `rows`:** a detail page's rows come
   * back from a refetch, so "the write landed" is not inferable from the inputs alone — an
   * unchanged `rows` is also what a *failed* write leaves behind. The host knows; the card does not.
   */
  commitSucceeded(): void {
    const leaving = this.editingKeySignal();
    this.form.reset({ name: '', description: '' });
    if (leaving === null) {
      return;
    }

    this.editingKeySignal.set(null);
    this.editingKeyChange.emit(null);
    this.restoreFocusTo(leaving);
  }

  private syncFormToEditingRow(): void {
    const row = this.editingRow();
    this.form.reset({ name: row?.name ?? '', description: row?.description ?? '' });
  }

  private focusFormHeading(): void {
    afterNextRender(
      {
        write: () =>
          this.hostElement.nativeElement
            .querySelector<HTMLElement>('[data-form-heading]')
            ?.focus({ preventScroll: true }),
      },
      { injector: this.injector }
    );
  }

  /**
   * **Focus restore, and the reason it is written this way** (architecture.md L-R15).
   *
   * The edited row's pencil is *replaced* by the `Editing` label while editing, so at the moment
   * Save or Cancel fires the button does not exist — it is re-created only once `editingKey`
   * clears and the view re-renders. So this cannot hold an `ElementRef` captured on the way in
   * (it would be stale or null) and cannot run synchronously. It resolves the target *after* the
   * next render, by `[data-move-key]`, which is also why `@for` must track `row.key` and never
   * `$index`: under index tracking Angular recycles the node, so the restore target is still
   * `isConnected` while belonging to a **different** move, and focus lands on the wrong row with
   * no error anywhere (14-R4).
   */
  private restoreFocusTo(key: string | null): void {
    if (key === null) {
      return;
    }

    afterNextRender(
      {
        write: () =>
          this.hostElement.nativeElement
            .querySelector<HTMLElement>(`[data-move-key="${key}"] [data-edit-move]`)
            ?.focus({ preventScroll: true }),
      },
      { injector: this.injector }
    );
  }
}
