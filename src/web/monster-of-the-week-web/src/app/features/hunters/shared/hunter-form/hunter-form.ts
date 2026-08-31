import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { BespokeOptionAnswer, BespokeOptionTreeComponent } from './bespoke-option-tree';
import { PlaybookService } from '../../../../core/playbook';
import {
  HunterDetailResponse,
  PlaybookDetailResponse,
  BespokeJournalResponse,
  BespokeOptionResponse,
  BespokeSectionResponse,
  HunterBespokeSelectionModel,
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
  imports: [ReactiveFormsModule, NgTemplateOutlet, CustomSelectComponent, BespokeOptionTreeComponent],
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

  /*
   * Bespoke state. Every answer is keyed by SCOPE, not by option id alone: the same option can
   * be ticked independently inside two entries of a repeatable section (two Rotes picking the
   * same requirement), and a single option-keyed map would silently merge them.
   *
   * A scope is a section id, or an instance's local key for a repeatable one. Instances carry a
   * local key rather than their server id because a newly-added entry has no server id until it
   * is saved, and the answers still have to attach to something in the meantime.
   */
  readonly bespokePicks = signal<ReadonlyMap<string, ReadonlySet<string>>>(new Map());
  readonly bespokeAnswers = signal<ReadonlyMap<string, ReadonlyMap<string, BespokeOptionAnswer>>>(new Map());
  readonly bespokeFreeText = signal<ReadonlyMap<string, string>>(new Map());
  readonly bespokeInstances = signal<readonly BespokeInstanceState[]>([]);
  readonly journalEntries = signal<readonly JournalEntryState[]>([]);

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

  // ---------------------------------------------------------------------------------------
  // Bespoke rulesets
  // ---------------------------------------------------------------------------------------

  isRepeatable(section: BespokeSectionResponse): boolean {
    return section.minInstances !== null || section.maxInstances !== null;
  }

  /** A section with no options and no free-text label is a fixed grant — rules, not a choice. */
  isFixedGrant(section: BespokeSectionResponse): boolean {
    return section.options.length === 0 && section.freeTextLabel === null;
  }

  instancesFor(section: BespokeSectionResponse): BespokeInstanceState[] {
    return this.bespokeInstances().filter((i) => i.sectionId === section.id);
  }

  canAddInstance(section: BespokeSectionResponse): boolean {
    return section.maxInstances === null || this.instancesFor(section).length < section.maxInstances;
  }

  addInstance(section: BespokeSectionResponse): void {
    this.bespokeInstances.update((current) => [
      ...current,
      { key: `${section.id}:${current.length}:${nextLocalKey()}`, serverId: null, sectionId: section.id, name: '' },
    ]);
  }

  removeInstance(key: string): void {
    this.bespokeInstances.update((current) => current.filter((i) => i.key !== key));
    this.bespokePicks.update((current) => omit(current, key));
    this.bespokeAnswers.update((current) => omit(current, key));
    this.bespokeFreeText.update((current) => omit(current, key));
  }

  setInstanceName(key: string, name: string): void {
    this.bespokeInstances.update((current) =>
      current.map((i) => (i.key === key ? { ...i, name } : i))
    );
  }

  picksFor(scopeKey: string): ReadonlySet<string> {
    return this.bespokePicks().get(scopeKey) ?? EMPTY_SET;
  }

  answersFor(scopeKey: string): ReadonlyMap<string, BespokeOptionAnswer> {
    return this.bespokeAnswers().get(scopeKey) ?? EMPTY_ANSWERS;
  }

  toggleBespoke(scopeKey: string, optionId: string): void {
    this.bespokePicks.update((current) => {
      const next = new Map(current);
      next.set(scopeKey, toggle(current.get(scopeKey) ?? EMPTY_SET, optionId));
      return next;
    });
  }

  setBespokeAnswer(scopeKey: string, change: { optionId: string; field: 'title' | 'text' | 'numeric'; value: string }): void {
    this.bespokeAnswers.update((current) => {
      const scope = new Map(current.get(scopeKey) ?? EMPTY_ANSWERS);
      const existing = scope.get(change.optionId) ?? { freeformTitle: '', freeformText: '', numericValue: null };
      scope.set(change.optionId, {
        freeformTitle: change.field === 'title' ? change.value : existing.freeformTitle,
        freeformText: change.field === 'text' ? change.value : existing.freeformText,
        numericValue: change.field === 'numeric' ? toIntOrNull(change.value) : existing.numericValue,
      });
      return new Map(current).set(scopeKey, scope);
    });
  }

  freeTextFor(scopeKey: string): string {
    return this.bespokeFreeText().get(scopeKey) ?? '';
  }

  setFreeText(scopeKey: string, value: string): void {
    this.bespokeFreeText.update((current) => new Map(current).set(scopeKey, value));
  }

  /**
   * Which pick-scopes within this section are full, so the tree can disable their remaining
   * options. Uses the same engagement rule the server does: a category counts because something
   * beneath it is ticked, never because the category itself was clicked.
   */
  lockedScopes(section: BespokeSectionResponse, scopeKey: string): ReadonlySet<string> {
    const picked = this.picksFor(scopeKey);
    const locked = new Set<string>();

    const engagedCount = (options: BespokeOptionResponse[]): number =>
      options.filter((o) => isEngaged(o, picked)).length;

    if (section.maxSelect !== null && engagedCount(section.options) >= section.maxSelect) {
      locked.add('');
    }

    const walk = (options: BespokeOptionResponse[]): void => {
      for (const option of options) {
        if (option.maxSelect !== null && engagedCount(option.children) >= option.maxSelect) {
          locked.add(option.id);
        }
        walk(option.children);
      }
    };
    walk(section.options);

    return locked;
  }

  /** Progress for a section's own top level, mirroring the "n of N picked" counters elsewhere. */
  sectionProgress(section: BespokeSectionResponse, scopeKey: string): string | null {
    if (section.minSelect === null && section.maxSelect === null) {
      return null;
    }
    const picked = this.picksFor(scopeKey);
    const engaged = section.options.filter((o) => isEngaged(o, picked)).length;
    return `${engaged} of ${section.minSelect ?? section.maxSelect} picked`;
  }

  // ---- Journals

  entriesFor(journal: BespokeJournalResponse): JournalEntryState[] {
    return this.journalEntries().filter((e) => e.journalId === journal.id);
  }

  addJournalEntry(journal: BespokeJournalResponse): void {
    this.journalEntries.update((current) => [
      ...current,
      { key: `${journal.id}:${nextLocalKey()}`, serverId: null, journalId: journal.id, fields: new Map() },
    ]);
  }

  removeJournalEntry(key: string): void {
    this.journalEntries.update((current) => current.filter((e) => e.key !== key));
  }

  journalFieldValue(entryKey: string, fieldId: string): string {
    return this.journalEntries().find((e) => e.key === entryKey)?.fields.get(fieldId) ?? '';
  }

  setJournalField(entryKey: string, fieldId: string, value: string): void {
    this.journalEntries.update((current) =>
      current.map((e) => (e.key === entryKey ? { ...e, fields: new Map(e.fields).set(fieldId, value) } : e))
    );
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
      bespokeSelections: this.collectSelections(this.nonRepeatableSectionIds()),
      bespokeInstances: this.bespokeInstances().map((instance, index) => ({
        id: instance.serverId,
        sectionId: instance.sectionId,
        name: instance.name.trim() || null,
        sortOrder: index,
        selections: this.collectSelections([instance.key], instance.sectionId),
      })),
      journalEntries: this.journalEntries().map((entry, index) => ({
        id: entry.serverId,
        journalId: entry.journalId,
        sortOrder: index,
        fields: [...entry.fields]
          .filter(([, text]) => text.trim().length > 0)
          .map(([journalFieldId, text]) => ({ journalFieldId, text: text.trim() })),
      })),
    });
  }

  /** Section ids whose answers live at the top level rather than inside an instance. */
  private nonRepeatableSectionIds(): string[] {
    return this.allSections()
      .filter((section) => !this.isRepeatable(section))
      .map((section) => section.id);
  }

  /**
   * Flattens one or more scopes into the wire shape. `sectionIdOverride` is what lets an
   * instance's scope key (which is not a section id) still report the section it belongs to.
   */
  private collectSelections(scopeKeys: string[], sectionIdOverride?: string): HunterBespokeSelectionModel[] {
    const out: HunterBespokeSelectionModel[] = [];
    for (const scopeKey of scopeKeys) {
      const sectionId = sectionIdOverride ?? scopeKey;

      const freeText = this.freeTextFor(scopeKey).trim();
      if (freeText.length > 0) {
        out.push({ sectionId, bespokeOptionId: null, freeformTitle: null, freeformText: freeText, numericValue: null });
      }

      const answers = this.answersFor(scopeKey);
      for (const optionId of this.picksFor(scopeKey)) {
        const answer = answers.get(optionId);
        out.push({
          sectionId,
          bespokeOptionId: optionId,
          freeformTitle: answer?.freeformTitle.trim() || null,
          freeformText: answer?.freeformText.trim() || null,
          numericValue: answer?.numericValue ?? null,
        });
      }
    }
    return out;
  }

  /** Playbook-level sections plus the ones nested inside taken moves. */
  private allSections(): BespokeSectionResponse[] {
    const playbook = this.playbook();
    if (!playbook) {
      return [];
    }
    return [
      ...playbook.bespokeSections,
      ...playbook.moves.flatMap((move) => move.bespokeSections),
    ];
  }

  /**
   * A move's own pick-structure, shown only once the hunter has the move. Required moves count
   * as taken from the start even though they are not in the picked set — the server adds them on
   * save regardless, and five of the thirteen move-internal sections hang off a Required move
   * (The Forged's Partner, The Searcher's First Encounter, and others), so treating them as
   * untaken would hide those sections entirely.
   */
  moveSectionsFor(move: PlaybookMoveResponse): BespokeSectionResponse[] {
    return move.required || this.isMoveSelected(move.id) ? move.bespokeSections : [];
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
      this.bespokePicks.set(new Map());
      this.bespokeAnswers.set(new Map());
      this.bespokeFreeText.set(new Map());
      this.bespokeInstances.set([]);
      this.journalEntries.set([]);
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

    // A saved instance's scope key is its server id, so re-loading keeps every nested answer
    // attached to the same entry it was saved under.
    const instances = hunter.bespokeInstances.map((instance) => ({
      key: instance.id!,
      serverId: instance.id,
      sectionId: instance.sectionId,
      name: instance.name ?? '',
    }));
    this.bespokeInstances.set(instances);
    this.journalEntries.set(hunter.journalEntries.map((entry) => ({
      key: entry.id!,
      serverId: entry.id,
      journalId: entry.journalId,
      fields: new Map(entry.fields.map((f) => [f.journalFieldId, f.text ?? ''])),
    })));

    const picks = new Map<string, Set<string>>();
    const answers = new Map<string, Map<string, BespokeOptionAnswer>>();
    const freeText = new Map<string, string>();

    const absorb = (scopeKey: string, selections: HunterBespokeSelectionModel[]): void => {
      for (const selection of selections) {
        if (selection.bespokeOptionId === null) {
          freeText.set(scopeKey, selection.freeformText ?? '');
          continue;
        }
        if (!picks.has(scopeKey)) picks.set(scopeKey, new Set());
        picks.get(scopeKey)!.add(selection.bespokeOptionId);
        if (!answers.has(scopeKey)) answers.set(scopeKey, new Map());
        answers.get(scopeKey)!.set(selection.bespokeOptionId, {
          freeformTitle: selection.freeformTitle ?? '',
          freeformText: selection.freeformText ?? '',
          numericValue: selection.numericValue,
        });
      }
    };

    for (const selection of hunter.bespokeSelections) {
      absorb(selection.sectionId, [selection]);
    }
    for (const instance of hunter.bespokeInstances) {
      absorb(instance.id!, instance.selections);
    }

    this.bespokePicks.set(picks);
    this.bespokeAnswers.set(answers);
    this.bespokeFreeText.set(freeText);
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

    // Bespoke answers belong to the previous playbook's sections entirely, so switching
    // playbooks clears them rather than filtering — there is nothing that could survive.
    const validSectionIds = new Set([
      ...playbook.bespokeSections.map((s) => s.id),
      ...playbook.moves.flatMap((m) => m.bespokeSections).map((s) => s.id),
    ]);
    this.bespokeInstances.update((current) => current.filter((i) => validSectionIds.has(i.sectionId)));
    const liveScopes = new Set([
      ...validSectionIds,
      ...this.bespokeInstances().map((i) => i.key),
    ]);
    this.bespokePicks.update((current) => new Map([...current].filter(([k]) => liveScopes.has(k))));
    this.bespokeAnswers.update((current) => new Map([...current].filter(([k]) => liveScopes.has(k))));
    this.bespokeFreeText.update((current) => new Map([...current].filter(([k]) => liveScopes.has(k))));
    const validJournalIds = new Set(playbook.bespokeJournals.map((j) => j.id));
    this.journalEntries.update((current) => current.filter((e) => validJournalIds.has(e.journalId)));

    const ratingControl = this.hunterForm.controls.playbookStatArrayOptionId;
    if (ratingControl.value && !playbook.statArrayOptions.some((o) => o.id === ratingControl.value)) {
      ratingControl.setValue('');
    }
  }
}

/** One entry of a repeatable bespoke section, as the form holds it before submit. */
export interface BespokeInstanceState {
  /** Stable within this form session; `serverId` is what the API round-trips. */
  readonly key: string;
  readonly serverId: string | null;
  readonly sectionId: string;
  readonly name: string;
}

export interface JournalEntryState {
  readonly key: string;
  readonly serverId: string | null;
  readonly journalId: string;
  readonly fields: ReadonlyMap<string, string>;
}

interface LookAnswer {
  readonly optionId: string | null;
  readonly freeform: string;
}

interface LookGroup {
  readonly label: string | null;
  readonly categories: PlaybookLookCategoryResponse[];
}

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_ANSWERS: ReadonlyMap<string, BespokeOptionAnswer> = new Map();

let localKeyCounter = 0;
/** Distinguishes two unsaved entries of the same section; never sent to the server. */
function nextLocalKey(): string {
  return `${++localKeyCounter}`;
}

function omit<T>(map: ReadonlyMap<string, T>, key: string): ReadonlyMap<string, T> {
  const next = new Map(map);
  next.delete(key);
  return next;
}

function toIntOrNull(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * architecture.md 6.4's rule, client-side: a leaf is engaged when it is ticked, and a category
 * divider is engaged when anything beneath it is. Dividers are never ticked themselves.
 */
function isEngaged(option: BespokeOptionResponse, picked: ReadonlySet<string>): boolean {
  return option.children.length === 0
    ? picked.has(option.id)
    : option.children.some((child) => isEngaged(child, picked));
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
