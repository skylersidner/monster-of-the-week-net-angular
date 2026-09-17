import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { BespokeOptionAnswer } from './hunter-form/bespoke-option-tree';
import { IndexedPickRule, TargetPicks, engagedChildCount, hasRoomFor, indexPickRules, isEngaged } from './hunter-pick-rules';
import {
  BespokeJournalResponse,
  BespokeOptionResponse,
  BespokeSectionResponse,
  HunterBespokeSelectionModel,
  HunterDetailResponse,
  PlaybookDetailResponse,
  PlaybookGearCategoryResponse,
  PlaybookMoveResponse,
  UpsertHunterRequest,
} from '../../../core/models';

/**
 * Everything a hunter surface holds before it saves, and the one place that turns it into an
 * `UpsertHunterRequest` (hunter-creation-wizard.md 13.5, L1; Phase 4, R4).
 *
 * `@Injectable()`, not root: each surface provides its own. `HunterFormComponent` provides one for
 * the edit page, and `HunterCreateComponent` provides one for the creation wizard (Phase 7), where
 * a fresh draft is the empty hunter, so `populate` only ever takes a saved one.
 *
 * It owns a `FormGroup`, which `angular-wizard-decomposition/SKILL.md` and the 2026-07-21
 * decomposition record otherwise keep out of stores. Those rules stop form state leaking between
 * sibling steps that submit separately. This draft is submitted once, as one request, so there is
 * nothing for it to leak into. Both records carry the limited supersession (2026-09-14).
 *
 * Playbook *loading* is not here. Each consumer fetches (with `switchMap`), sets `playbook`, then
 * calls `prune`.
 *
 * Move and gear picks are held as `signal<Set<string>>` beside the form rather than in
 * `FormArray`s, following `monster-create.ts`: they are checkbox sets over a list that is itself
 * reloaded asynchronously, and rebuilding a FormArray on every playbook change buys nothing that
 * a set does not already give.
 */
@Injectable()
export class HunterDraft {
  private readonly formBuilder = inject(FormBuilder);

  readonly playbook = signal<PlaybookDetailResponse | null>(null);

  readonly form = this.formBuilder.group({
    playbookId: this.formBuilder.nonNullable.control('', [Validators.required]),
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    pronouns: this.formBuilder.control(''),
    // No Validators.required, deliberately: a rating array is part of a *finished* hunter, not
    // a savable one. See isRatingUnchosen for how the gap is surfaced instead.
    playbookStatArrayOptionId: this.formBuilder.nonNullable.control(''),
    luck: this.formBuilder.nonNullable.control(0, [Validators.min(0)]),
    harm: this.formBuilder.nonNullable.control(0, [Validators.min(0)]),
    experience: this.formBuilder.nonNullable.control(0, [Validators.min(0)]),
    background: this.formBuilder.control(''),
  });

  /**
   * The form's scalars as a signal, read through `getRawValue()` and never `.value`. The edit page
   * disables `playbookId`, and a disabled control is dropped from `.value` entirely.
   *
   * Anything computed reads this, never a control: a control value is not a signal, so a
   * `computed` over one caches its first answer and never recomputes.
   */
  readonly formValue = toSignal(
    this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      startWith(this.form.getRawValue())
    ),
    { requireSync: true }
  );

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

  /**
   * The pick budget: `moveGrantCount` is the printed total, required moves included, so the
   * picks left for the player is that total minus however many moves are required. Mirrors
   * `HunterService.Validate` and `HunterCompleteness` — see `HunterService.cs`.
   */
  readonly moveBudget = computed(() =>
    Math.max(0, this.moveGrantCount() - this.requiredMoves().length)
  );

  /** A grant count of 0 means "unspecified", not "no picks allowed" — see HunterService.cs. */
  readonly isMoveLimitReached = computed(
    () => this.moveGrantCount() > 0 && this.pickedMoveCount() >= this.moveBudget()
  );

  /**
   * Progress hints, not validators. Each one mirrors a line HunterCompleteness produces
   * server-side so the user sees the gap while they are in the section that closes it, rather
   * than only in the summary after saving — but none of them stops the form submitting.
   */
  readonly isMovePickShort = computed(
    () => this.moveGrantCount() > 0 && this.pickedMoveCount() < this.moveBudget()
  );

  /**
   * A `computed` over `formValue`, not over the control. This used to be a method reading the
   * control directly, because a computed over a control caches its first answer (the lesson
   * 13.5 generalises into "computeds read the getRawValue signal").
   */
  readonly isRatingUnchosen = computed(
    () =>
      (this.playbook()?.statArrayOptions.length ?? 0) > 0 &&
      !this.formValue().playbookStatArrayOptionId
  );

  /** Look lines with no answer yet, across the whole playbook. */
  readonly unansweredLookCount = computed(() => {
    const answered = this.lookAnswers();
    return (this.playbook()?.lookCategories ?? []).filter((c) => !answered.has(c.id)).length;
  });

  /**
   * Whether leaving would lose anything (13.8, L12): a playbook chosen, or a name or pronouns typed.
   * Everything else needs a playbook first, so it is covered by the first condition.
   */
  readonly isDirty = computed(() => {
    const value = this.formValue();
    return value.playbookId !== '' || value.name.trim() !== '' || (value.pronouns ?? '').trim() !== '';
  });

  // ---------------------------------------------------------------------------------------
  // Moves and gear
  // ---------------------------------------------------------------------------------------

  isMoveSelected(moveId: string): boolean {
    return this.selectedMoveIds().has(moveId);
  }

  isGearSelected(optionId: string): boolean {
    return this.selectedGearIds().has(optionId);
  }

  toggleMove(moveId: string): void {
    const wasSelected = this.selectedMoveIds().has(moveId);
    this.selectedMoveIds.update((current) => toggle(current, moveId));
    if (wasSelected) {
      // Unticking a move drops its bespoke section state so the save never sends it — the
      // server refuses an entry or answer under a section whose move the hunter hasn't taken.
      // Re-ticking starts empty; there is no restore.
      const move = this.playbook()?.moves.find((m) => m.id === moveId);
      this.clearBespokeSections(move?.bespokeSections ?? []);
    }
  }

  /**
   * Only ever reached from a pickable category's checkbox. Granted categories render no checkbox,
   * so the draft never adds a granted option's id, and leaves an already-saved one alone (B6, L15).
   */
  toggleGear(optionId: string): void {
    this.selectedGearIds.update((current) => toggle(current, optionId));
  }

  /** How many of this category's options are picked. */
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

  // ---------------------------------------------------------------------------------------
  // Pick rules (hunter-creation-wizard.md 12.9, 13.5; Phase 6)
  // ---------------------------------------------------------------------------------------

  /** The loaded playbook's pick rules, indexed once per playbook. Locks and hints only, never marks. */
  readonly pickRules = computed(() => indexPickRules(this.playbook()));

  /**
   * The input to trigger matching (12.9 step 1). Triggers are leaf options in playbook-level,
   * non-repeatable sections (S2), so this is the union of those sections' picks. Repeatable entries
   * and move-internal sections are never read.
   */
  readonly sectionLevelPickedOptionIds = computed<ReadonlySet<string>>(() => {
    const picks = this.bespokePicks();
    const ids = new Set<string>();
    for (const section of this.playbook()?.bespokeSections ?? []) {
      if (!this.isRepeatable(section)) {
        picks.get(section.id)?.forEach((id) => ids.add(id));
      }
    }
    return ids;
  });

  /**
   * What each of a rule's targets counts (12.9): picked options in a gear category, or a bespoke
   * divider's engaged direct children in its section's own scope, write-your-own slots included.
   */
  targetPicks(indexed: IndexedPickRule): TargetPicks {
    const playbook = this.playbook();
    const counts = new Map<string, number>();
    for (const targetId of indexed.targetIds) {
      if (indexed.kind === 'gear') {
        const category = playbook?.gearCategories.find((c) => c.id === targetId);
        counts.set(targetId, category ? this.pickedInCategory(category) : 0);
      } else {
        const divider = indexed.section?.options.find((o) => o.id === targetId);
        counts.set(targetId, divider && indexed.section ? engagedChildCount(divider, this.picksFor(indexed.section.id)) : 0);
      }
    }
    return counts;
  }

  gearRuleFor(category: PlaybookGearCategoryResponse): IndexedPickRule | null {
    const indexed = this.pickRules().byTarget.get(category.id);
    return indexed?.kind === 'gear' ? indexed : null;
  }

  /**
   * Whether an unpicked option in this category can still be ticked. Under a pick rule that is
   * `hasRoomFor` against the effective range (13.5); the stored `pickCount` stays as a ceiling too,
   * as it does on the server (S8), though every range fits under it. Otherwise, the stored cap.
   */
  gearHasRoom(category: PlaybookGearCategoryResponse): boolean {
    const indexed = this.gearRuleFor(category);
    if (!indexed) {
      return !this.isGearLimitReached(category);
    }
    return (
      !this.isGearLimitReached(category) &&
      hasRoomFor(indexed.rule, category.id, this.targetPicks(indexed), this.sectionLevelPickedOptionIds())
    );
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

  // ---------------------------------------------------------------------------------------
  // Looks and extra tracks
  // ---------------------------------------------------------------------------------------

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
    this.bespokePicks.update((current) => omit(current, [key]));
    this.bespokeAnswers.update((current) => omit(current, [key]));
    this.bespokeFreeText.update((current) => omit(current, [key]));
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
    const wasPicked = this.picksFor(scopeKey).has(optionId);
    this.bespokePicks.update((current) => {
      const next = new Map(current);
      next.set(scopeKey, toggle(current.get(scopeKey) ?? EMPTY_SET, optionId));
      return next;
    });

    // A numeric leaf with no stored answer starts at its maximum, not null (13.11 item 6, L14) —
    // ticking it without ever touching the number input used to send numericValue: null.
    if (!wasPicked && !this.answersFor(scopeKey).has(optionId)) {
      const option = this.findBespokeOption(optionId);
      if (option?.numericMax !== null && option?.numericMax !== undefined) {
        this.bespokeAnswers.update((current) => {
          const scope = new Map(current.get(scopeKey) ?? EMPTY_ANSWERS);
          scope.set(optionId, { freeformTitle: '', freeformText: '', numericValue: option.numericMax });
          return new Map(current).set(scopeKey, scope);
        });
      }
    }
  }

  setBespokeAnswer(scopeKey: string, change: BespokeAnswerChange): void {
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

    // A pick rule's divider with no room for one more pick in any alternative (13.5; Q10 on the edit
    // page). Rules only govern playbook-level, non-repeatable sections, so only the section's own
    // scope is ever affected, and every other section's locks are exactly as before.
    const indexed = this.pickRules().bySection.get(section.id);
    if (indexed && scopeKey === section.id) {
      const picks = this.targetPicks(indexed);
      const triggers = this.sectionLevelPickedOptionIds();
      for (const targetId of indexed.targetIds) {
        if (!hasRoomFor(indexed.rule, targetId, picks, triggers)) {
          locked.add(targetId);
        }
      }
    }

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

  /**
   * What switching playbook would clear, for the switch confirmation's list (7.4, 13.5, L13), in the
   * doc's order: "Rating line", "2 moves", "Background, Heat", "3 gear picks", "2 look lines". Name,
   * pronouns, History notes and Luck, Harm and Experience aren't playbook-scoped, so they never appear.
   * Empty means nothing would be lost, and the wizard switches without asking.
   */
  playbookScopedSummary(): string[] {
    const items: string[] = [];
    if (this.formValue().playbookStatArrayOptionId) {
      items.push('Rating line');
    }
    const moves = this.selectedMoveIds().size;
    if (moves > 0) {
      items.push(countOf(moves, 'move'));
    }
    const sections = this.allSections()
      .filter((section) => this.picksFor(section.id).size > 0 || this.freeTextFor(section.id).trim() !== '' || this.instancesFor(section).length > 0)
      .map((section) => section.title);
    if (sections.length > 0) {
      items.push(sections.join(', '));
    }
    const gear = this.selectedGearIds().size;
    if (gear > 0) {
      items.push(countOf(gear, 'gear pick'));
    }
    const looks = this.lookAnswers().size;
    if (looks > 0) {
      items.push(countOf(looks, 'look line'));
    }
    return items;
  }

  // ---------------------------------------------------------------------------------------
  // Populate, prune, request
  // ---------------------------------------------------------------------------------------

  /**
   * Replaces the whole draft with a saved hunter. Does not load the playbook: the consumer does that
   * afterwards, then calls `prune`. There is no "empty it" form any more: that was the single-page
   * create's (L17), and the wizard starts from a fresh draft.
   */
  populate(hunter: HunterDetailResponse): void {
    this.form.reset({
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
    this.form.controls.playbookId.disable({ emitEvent: false });
  }

  /**
   * Clears picks that don't belong to the newly-loaded playbook (formerly the form's
   * `dropSelectionsOutside`).
   *
   * Without this, switching playbooks mid-create leaves the previous playbook's move and gear
   * ids in the sets — invisible, since nothing renders them any more, and rejected by the server
   * on submit with an error about a move the user can no longer see. Keeps ids that *are* valid,
   * so re-loading the same playbook (edit mode) preserves everything.
   */
  prune(playbook: PlaybookDetailResponse): void {
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

    const ratingControl = this.form.controls.playbookStatArrayOptionId;
    if (ratingControl.value && !playbook.statArrayOptions.some((o) => o.id === ratingControl.value)) {
      ratingControl.setValue('');
    }
  }

  /**
   * The only request builder (L1). Pinned end to end by `hunter-form.characterisation.spec.ts`.
   *
   * Reads `form.getRawValue()` at call time rather than the `formValue` signal: same values, but
   * no dependency on every write having emitted. Wire-shape rules it keeps (13.5):
   * - required move ids are sent when they are in the picked set (a loaded hunter's are);
   * - unanswered look lines are left out;
   * - instance and journal `serverId`s are echoed back, because dropping them recreates those
   *   rows on every save;
   * - instance-scoped selections nest under their instance;
   * - free text and blanks are trimmed, and empty values become null.
   */
  toRequest(): UpsertHunterRequest {
    const raw = this.form.getRawValue();
    return {
      name: raw.name.trim(),
      pronouns: toNullable(raw.pronouns),
      playbookId: raw.playbookId,
      playbookStatArrayOptionId: toNullable(raw.playbookStatArrayOptionId),
      luck: raw.luck,
      harm: raw.harm,
      experience: raw.experience,
      background: toNullable(raw.background),
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
    };
  }

  /**
   * Clears every scope's state for a set of bespoke sections — instances filed under them, plus
   * the picks/answers/freeText keyed by those section ids and by the removed instances' own
   * keys. Same shape as `removeInstance`'s per-instance clear, generalized to "every instance
   * under these sections" for `toggleMove`'s untick case.
   */
  private clearBespokeSections(sections: readonly BespokeSectionResponse[]): void {
    const sectionIds = new Set(sections.map((s) => s.id));
    if (sectionIds.size === 0) {
      return;
    }
    const instanceKeys = this.bespokeInstances()
      .filter((instance) => sectionIds.has(instance.sectionId))
      .map((instance) => instance.key);
    this.bespokeInstances.update((current) => current.filter((instance) => !sectionIds.has(instance.sectionId)));

    const deadScopes = new Set([...sectionIds, ...instanceKeys]);
    this.bespokePicks.update((current) => omit(current, deadScopes));
    this.bespokeAnswers.update((current) => omit(current, deadScopes));
    this.bespokeFreeText.update((current) => omit(current, deadScopes));
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

  /** Finds a bespoke option by id anywhere in the currently loaded playbook's option trees. */
  private findBespokeOption(optionId: string): BespokeOptionResponse | undefined {
    const search = (options: BespokeOptionResponse[]): BespokeOptionResponse | undefined => {
      for (const option of options) {
        if (option.id === optionId) {
          return option;
        }
        const found = search(option.children);
        if (found) {
          return found;
        }
      }
      return undefined;
    };
    for (const section of this.allSections()) {
      const found = search(section.options);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  /** Playbook-level sections plus the ones nested inside moves. */
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
}

/** One entry of a repeatable bespoke section, as the draft holds it before submit. */
export interface BespokeInstanceState {
  /** Stable within this draft's session; `serverId` is what the API round-trips. */
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

/** What `BespokeOptionTreeComponent.answerChanged` emits. */
export interface BespokeAnswerChange {
  readonly optionId: string;
  readonly field: 'title' | 'text' | 'numeric';
  readonly value: string;
}

interface LookAnswer {
  readonly optionId: string | null;
  readonly freeform: string;
}

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_ANSWERS: ReadonlyMap<string, BespokeOptionAnswer> = new Map();

let localKeyCounter = 0;
/** Distinguishes two unsaved entries of the same section; never sent to the server. */
function nextLocalKey(): string {
  return `${++localKeyCounter}`;
}

function omit<T>(map: ReadonlyMap<string, T>, keys: Iterable<string>): ReadonlyMap<string, T> {
  const next = new Map(map);
  for (const key of keys) {
    next.delete(key);
  }
  return next;
}

function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function toIntOrNull(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
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
