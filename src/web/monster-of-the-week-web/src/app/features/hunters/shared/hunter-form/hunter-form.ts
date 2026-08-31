import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { PlaybookService } from '../../../../core/playbook';
import {
  HunterDetailResponse,
  PlaybookDetailResponse,
  PlaybookGearCategoryResponse,
  PlaybookLookCategoryResponse,
  PlaybookListItemResponse,
  PlaybookMoveResponse,
  UpsertHunterRequest,
} from '../../../../core/models';

/**
 * The Hunter create/edit form — one page, one submit, reactively gated on the chosen Playbook
 * (docs/hunter-playbooks/architecture.md Section 8, which rejected a wizard for this).
 *
 * Mirrors `MonsterFormComponent`'s `@Input() hunter | null` / `@Output() save` contract, with
 * one deliberate departure: this component loads the selected Playbook itself rather than
 * receiving its options as inputs. The option lists have to be re-fetched whenever `playbookId`
 * changes, and that subscription would otherwise be duplicated identically in both the create
 * and the detail page. Section 8 specifies this shape explicitly.
 *
 * Nothing in here blocks a save on an *unfinished* sheet (architecture.md Section 9). The
 * per-section counters below are progress indicators, not validators: a name and a playbook are
 * the only things this form requires, because a hunter is savable and resumable at any stage.
 * The aggregate "what's left" list is not recomputed here — it comes back from the server on
 * `HunterDetailResponse.outstanding`, so the rule lives in exactly one place.
 *
 * Move and gear picks are held as `signal<Set<string>>` beside the reactive form rather than in
 * `FormArray`s. That follows `monster-create.ts`, which keeps its sub-resource drafts in signals
 * next to its form for the same reason: these are checkbox sets over a list that is itself
 * reloaded asynchronously, and rebuilding a FormArray on every playbook change buys nothing that
 * a set does not already give.
 */
@Component({
  selector: 'app-hunter-form',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './hunter-form.html',
  host: { class: 'block' },
})
export class HunterFormComponent implements OnInit, OnChanges {
  private readonly formBuilder = inject(FormBuilder);
  private readonly playbookService = inject(PlaybookService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() playbooks: PlaybookListItemResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  @Input() hunter: HunterDetailResponse | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Hunter';

  @Output() readonly save = new EventEmitter<UpsertHunterRequest>();

  readonly playbook = signal<PlaybookDetailResponse | null>(null);
  readonly isLoadingPlaybook = signal(false);
  readonly playbookError = signal<string | null>(null);

  readonly selectedMoveIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedGearIds = signal<ReadonlySet<string>>(new Set());

  /**
   * One answer per Look line, keyed by category id — the sheet has one circled word per row.
   * `optionId` and `freeform` are mutually exclusive by construction here (each setter clears
   * the other), which is the same rule the server enforces.
   */
  readonly lookAnswers = signal<ReadonlyMap<string, LookAnswer>>(new Map());

  /** Current value per extra track, keyed by track id. */
  readonly trackValues = signal<ReadonlyMap<string, number>>(new Map());

  readonly hunterForm = this.formBuilder.group({
    playbookId: this.formBuilder.nonNullable.control('', [Validators.required]),
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    pronouns: this.formBuilder.control(''),
    // No Validators.required, deliberately: a rating array is part of a *finished* hunter, not
    // a savable one. See isRatingUnchosen() for how the gap is surfaced instead.
    playbookStatArrayOptionId: this.formBuilder.nonNullable.control(''),
    luck: this.formBuilder.nonNullable.control(0, [Validators.min(0)]),
    harm: this.formBuilder.nonNullable.control(0, [Validators.min(0)]),
    experience: this.formBuilder.nonNullable.control(0, [Validators.min(0)]),
    background: this.formBuilder.control(''),
  });

  /** Granted outright by the playbook — always taken, never a choice (`PlaybookMove.Required`). */
  readonly requiredMoves = computed<PlaybookMoveResponse[]>(() =>
    (this.playbook()?.moves ?? []).filter((move) => move.required && !move.isAdvanced)
  );

  /**
   * Advanced moves are excluded entirely rather than shown disabled: they are reachable only
   * through an advanced improvement during play, so offering them here — even greyed — would
   * misrepresent the rules at the one moment the rules are least familiar.
   */
  readonly pickableMoves = computed<PlaybookMoveResponse[]>(() =>
    (this.playbook()?.moves ?? []).filter((move) => !move.required && !move.isAdvanced)
  );

  readonly moveGrantCount = computed(() => this.playbook()?.moveGrantCount ?? 0);
  readonly pickedMoveCount = computed(
    () => this.pickableMoves().filter((move) => this.selectedMoveIds().has(move.id)).length
  );

  /** A grant count of 0 means "unspecified", not "no picks allowed" — see HunterService.cs. */
  readonly isMoveLimitReached = computed(
    () => this.moveGrantCount() > 0 && this.pickedMoveCount() >= this.moveGrantCount()
  );

  /**
   * Progress hints, not validators. Each one mirrors a line HunterCompleteness produces
   * server-side so the user sees the gap while they are in the section that closes it, rather
   * than only in the summary after saving — but none of them stops the form submitting.
   */
  readonly isMovePickShort = computed(
    () => this.moveGrantCount() > 0 && this.pickedMoveCount() < this.moveGrantCount()
  );

  /**
   * A method, not a `computed()`, and the distinction is load-bearing: this reads a reactive
   * *form control* value, which is not a signal, so a computed would cache the first answer and
   * never recompute. The neighbouring computeds above are safe because every input they read is
   * a signal. Caught by a spec rather than by review — worth leaving stated.
   */
  isRatingUnchosen(): boolean {
    return (
      (this.playbook()?.statArrayOptions.length ?? 0) > 0 &&
      !this.hunterForm.controls.playbookStatArrayOptionId.value
    );
  }

  ngOnInit(): void {
    this.hunterForm.controls.playbookId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((playbookId) => this.loadPlaybook(playbookId));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hunter']) {
      this.populate(this.hunter);
    }
  }

  isMoveSelected(moveId: string): boolean {
    return this.selectedMoveIds().has(moveId);
  }

  isGearSelected(optionId: string): boolean {
    return this.selectedGearIds().has(optionId);
  }

  toggleMove(moveId: string): void {
    this.selectedMoveIds.update((current) => toggle(current, moveId));
  }

  toggleGear(optionId: string): void {
    this.selectedGearIds.update((current) => toggle(current, optionId));
  }

  /** How many options this category still allows, or `null` when it sets no limit. */
  pickedInCategory(category: PlaybookGearCategoryResponse): number {
    return category.options.filter((option) => this.selectedGearIds().has(option.id)).length;
  }

  isGearLimitReached(category: PlaybookGearCategoryResponse): boolean {
    return category.pickCount !== null && this.pickedInCategory(category) >= category.pickCount;
  }

  /**
   * A category that still owes picks. Optional categories owe nothing, and a null pickCount
   * means every option is granted outright rather than picked — there is no choice to make.
   */
  isGearPickShort(category: PlaybookGearCategoryResponse): boolean {
    return (
      !category.isOptional &&
      category.pickCount !== null &&
      this.pickedInCategory(category) < category.pickCount
    );
  }

  /** Look lines with no answer yet, across the whole playbook. */
  readonly unansweredLookCount = computed(() => {
    const answered = this.lookAnswers();
    return (this.playbook()?.lookCategories ?? []).filter((c) => !answered.has(c.id)).length;
  });

  /**
   * Look categories in sort order, with consecutive runs that share a `groupLabel` collapsed
   * into one group. Only The Forged uses this (its "Human look" / "Weapon look" split), and
   * grouping by consecutive run rather than by distinct label keeps the sheet's own ordering
   * intact instead of reordering lines to gather labels together.
   */
  readonly lookGroups = computed<LookGroup[]>(() => {
    const groups: LookGroup[] = [];
    for (const category of this.playbook()?.lookCategories ?? []) {
      const label = category.groupLabel ?? null;
      const open = groups.at(-1);
      if (open && open.label === label) {
        open.categories.push(category);
      } else {
        groups.push({ label, categories: [category] });
      }
    }
    return groups;
  });

  lookOptionFor(categoryId: string): string | null {
    return this.lookAnswers().get(categoryId)?.optionId ?? null;
  }

  lookFreeformFor(categoryId: string): string {
    return this.lookAnswers().get(categoryId)?.freeform ?? '';
  }

  /** Picking a printed option clears any custom text for that line, and vice versa. */
  setLookOption(categoryId: string, optionId: string): void {
    this.lookAnswers.update((current) => {
      const next = new Map(current);
      const existing = current.get(categoryId);
      if (existing?.optionId === optionId) {
        next.delete(categoryId); // clicking the chosen option again clears the line
      } else {
        next.set(categoryId, { optionId, freeform: '' });
      }
      return next;
    });
  }

  setLookFreeform(categoryId: string, text: string): void {
    this.lookAnswers.update((current) => {
      const next = new Map(current);
      if (text.trim().length === 0) {
        next.delete(categoryId);
      } else {
        next.set(categoryId, { optionId: null, freeform: text });
      }
      return next;
    });
  }

  trackValueFor(trackId: string): number {
    return this.trackValues().get(trackId) ?? 0;
  }

  setTrackValue(trackId: string, raw: string, boxCount: number): void {
    const parsed = Number.parseInt(raw, 10);
    const clamped = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), boxCount);
    this.trackValues.update((current) => new Map(current).set(trackId, clamped));
  }

  /** Ratings are always written signed on a playbook sheet, including `+0`. */
  formatStat(value: number): string {
    return value < 0 ? `${value}` : `+${value}`;
  }

  gearCategoryHint(category: PlaybookGearCategoryResponse): string {
    const limit = category.pickCount === null ? 'any number' : `${category.pickCount}`;
    return category.isOptional ? `Optional — pick ${limit}` : `Pick ${limit}`;
  }

  onSubmit(): void {
    if (this.hunterForm.invalid) {
      this.hunterForm.markAllAsTouched();
      return;
    }

    const controls = this.hunterForm.controls;
    this.save.emit({
      name: controls.name.value.trim(),
      pronouns: toNullable(controls.pronouns.value),
      // getRawValue(), not .value: the control is disabled in edit mode (changing a hunter's
      // playbook would invalidate every pick it has), and a disabled control is omitted from
      // .value entirely — which would send an empty playbookId and fail validation server-side.
      playbookId: controls.playbookId.getRawValue(),
      playbookStatArrayOptionId: toNullable(controls.playbookStatArrayOptionId.value),
      luck: controls.luck.value,
      harm: controls.harm.value,
      experience: controls.experience.value,
      background: toNullable(controls.background.value),
      // Required moves are added server-side regardless, but sending them keeps the request an
      // honest description of the hunter rather than one that relies on a server-side fixup.
      playbookMoveIds: [...this.selectedMoveIds()],
      playbookGearOptionIds: [...this.selectedGearIds()],
      // Unanswered lines are omitted entirely rather than sent as empty entries — the server
      // rejects a selection carrying neither an option nor text.
      looks: [...this.lookAnswers()].map(([lookCategoryId, answer]) => ({
        lookCategoryId,
        lookOptionId: answer.optionId,
        freeformText: answer.optionId ? null : answer.freeform.trim(),
      })),
      extraTracks: [...this.trackValues()].map(([extraTrackId, currentValue]) => ({
        extraTrackId,
        currentValue,
      })),
    });
  }

  private populate(hunter: HunterDetailResponse | null): void {
    if (!hunter) {
      this.hunterForm.reset({
        playbookId: '',
        name: '',
        pronouns: '',
        playbookStatArrayOptionId: '',
        luck: 0,
        harm: 0,
        experience: 0,
        background: '',
      });
      this.hunterForm.controls.playbookId.enable({ emitEvent: false });
      this.selectedMoveIds.set(new Set());
      this.selectedGearIds.set(new Set());
      this.lookAnswers.set(new Map());
      this.trackValues.set(new Map());
      this.playbook.set(null);
      return;
    }

    this.hunterForm.reset({
      playbookId: hunter.playbookId,
      name: hunter.name,
      pronouns: hunter.pronouns ?? '',
      playbookStatArrayOptionId: hunter.playbookStatArrayOptionId ?? '',
      luck: hunter.luck,
      harm: hunter.harm,
      experience: hunter.experience,
      background: hunter.background ?? '',
    });
    this.selectedMoveIds.set(new Set(hunter.playbookMoveIds));
    this.selectedGearIds.set(new Set(hunter.playbookGearOptionIds));
    this.lookAnswers.set(new Map(hunter.looks.map((look) => [
      look.lookCategoryId,
      { optionId: look.lookOptionId, freeform: look.freeformText ?? '' },
    ])));
    this.trackValues.set(new Map(hunter.extraTracks.map((t) => [t.extraTrackId, t.currentValue])));
    // Locked after creation: switching playbooks would silently discard every move, gear and
    // rating pick, which is not something a dropdown should do without asking. The API still
    // accepts a changed playbookId from a deliberate client.
    this.hunterForm.controls.playbookId.disable({ emitEvent: false });
    this.loadPlaybook(hunter.playbookId);
  }

  private loadPlaybook(playbookId: string): void {
    if (!playbookId) {
      this.playbook.set(null);
      this.playbookError.set(null);
      return;
    }

    this.isLoadingPlaybook.set(true);
    this.playbookService
      .getById(playbookId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playbook) => {
          this.playbook.set(playbook);
          this.playbookError.set(null);
          this.isLoadingPlaybook.set(false);
          this.dropSelectionsOutside(playbook);
        },
        error: () => {
          this.playbook.set(null);
          this.playbookError.set('Unable to load that playbook.');
          this.isLoadingPlaybook.set(false);
        },
      });
  }

  /**
   * Clears picks that don't belong to the newly-loaded playbook.
   *
   * Without this, switching playbooks mid-create leaves the previous playbook's move and gear
   * ids in the sets — invisible, since nothing renders them any more, and rejected by the server
   * on submit with an error about a move the user can no longer see. Keeps ids that *are* valid,
   * so re-loading the same playbook (edit mode) preserves everything.
   */
  private dropSelectionsOutside(playbook: PlaybookDetailResponse): void {
    const validMoveIds = new Set(playbook.moves.map((move) => move.id));
    const validGearIds = new Set(playbook.gearCategories.flatMap((c) => c.options).map((o) => o.id));
    this.selectedMoveIds.update((current) => new Set([...current].filter((id) => validMoveIds.has(id))));
    this.selectedGearIds.update((current) => new Set([...current].filter((id) => validGearIds.has(id))));

    const validLookCategories = new Set(playbook.lookCategories.map((c) => c.id));
    this.lookAnswers.update((current) =>
      new Map([...current].filter(([categoryId]) => validLookCategories.has(categoryId)))
    );
    const validTrackIds = new Set(playbook.extraTracks.map((t) => t.id));
    this.trackValues.update((current) =>
      new Map([...current].filter(([trackId]) => validTrackIds.has(trackId)))
    );

    const ratingControl = this.hunterForm.controls.playbookStatArrayOptionId;
    if (ratingControl.value && !playbook.statArrayOptions.some((o) => o.id === ratingControl.value)) {
      ratingControl.setValue('');
    }
  }
}

interface LookAnswer {
  readonly optionId: string | null;
  readonly freeform: string;
}

interface LookGroup {
  readonly label: string | null;
  readonly categories: PlaybookLookCategoryResponse[];
}

function toggle(current: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(current);
  if (!next.delete(id)) {
    next.add(id);
  }
  return next;
}

function toNullable(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
