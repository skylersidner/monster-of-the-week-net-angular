import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { BespokeOptionAnswer, BespokeOptionTreeComponent } from './bespoke-option-tree';
import { PlaybookService } from '../../../../core/playbook';
import { BespokeAnswerChange, BespokeInstanceState, HunterDraft, JournalEntryState } from '../hunter-draft';
import {
  HunterDetailResponse,
  PlaybookDetailResponse,
  BespokeJournalResponse,
  BespokeSectionResponse,
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
 * per-section counters are progress indicators, not validators: a name and a playbook are
 * the only things this form requires, because a hunter is savable and resumable at any stage.
 * The aggregate "what's left" list is not recomputed here — it comes back from the server on
 * `HunterDetailResponse.outstanding`, so the rule lives in exactly one place.
 *
 * All hunter state, prune, the untick clear and the request builder live in `HunterDraft`
 * (hunter-creation-wizard.md 13.5), which this component provides for itself. What stays here is
 * the playbook load, the submit gate, and display-only helpers. The pass-through members below
 * keep the template unchanged for Phase 4; Phase 5's section components inject the draft directly.
 */
@Component({
  selector: 'app-hunter-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgTemplateOutlet, CustomSelectComponent, BespokeOptionTreeComponent],
  templateUrl: './hunter-form.html',
  host: { class: 'block' },
  providers: [HunterDraft],
})
export class HunterFormComponent implements OnChanges {
  private readonly playbookService = inject(PlaybookService);
  private readonly destroyRef = inject(DestroyRef);

  /** This form's own draft: provided above, so every form instance gets a fresh one. */
  readonly draft = inject(HunterDraft);

  @Input() playbooks: PlaybookListItemResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  @Input() hunter: HunterDetailResponse | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Hunter';

  @Output() readonly save = new EventEmitter<UpsertHunterRequest>();

  readonly isLoadingPlaybook = signal(false);
  readonly playbookError = signal<string | null>(null);

  /**
   * Every playbookId, from the picker's own valueChanges and from populate()'s direct call on
   * edit-mode load, funnels through this one Subject into one switchMap (below). Both used to
   * call loadPlaybook() independently, each opening its own subscription to the HTTP call — so a
   * slow response for a playbook the user has since navigated away from could still land after,
   * and overwrite, a faster response for the one now showing (13.11 item 5).
   */
  private readonly playbookIdRequests = new Subject<string>();

  // ---- Draft state the template reads, passed through unchanged.
  readonly hunterForm = this.draft.form;
  readonly playbook = this.draft.playbook;
  readonly requiredMoves = this.draft.requiredMoves;
  readonly pickableMoves = this.draft.pickableMoves;
  readonly moveGrantCount = this.draft.moveGrantCount;
  readonly pickedMoveCount = this.draft.pickedMoveCount;
  readonly moveBudget = this.draft.moveBudget;
  readonly isMoveLimitReached = this.draft.isMoveLimitReached;
  readonly isMovePickShort = this.draft.isMovePickShort;
  readonly isRatingUnchosen = this.draft.isRatingUnchosen;
  readonly unansweredLookCount = this.draft.unansweredLookCount;

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

  /**
   * Wires the playbook-loading pipeline here, in the constructor, rather than in ngOnInit —
   * load-bearing, not stylistic. `hunter-detail.html` only creates this component once its
   * `hunter()` signal is already truthy (`@if (hunter(); as current) { <app-hunter-form
   * [hunter]="current" ...> }`), so on the edit page the very FIRST `ngOnChanges` this component
   * ever receives already carries a non-null hunter, and Angular calls ngOnChanges *before*
   * ngOnInit on that first change-detection pass. `populate()` (called from ngOnChanges) ends by
   * pushing into `playbookIdRequests`; a subscription set up in ngOnInit would not exist yet on
   * that first push, and — being a plain Subject, not a ReplaySubject — would silently drop it,
   * so the edit page's playbook would never load. Constructing the subscription here means it
   * exists before any lifecycle hook can possibly fire. The draft is injected in a field
   * initializer, so its form exists before this body runs.
   */
  constructor() {
    this.hunterForm.controls.playbookId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((playbookId) => this.loadPlaybook(playbookId));

    // switchMap: a new playbookId cancels whatever fetch is still in flight for the previous
    // one, so a slow response can never arrive after, and overwrite, a later one's.
    this.playbookIdRequests
      .pipe(
        switchMap((playbookId) => this.fetchPlaybook(playbookId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((outcome) => this.applyPlaybookOutcome(outcome));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hunter']) {
      this.populate(this.hunter);
    }
  }

  onSubmit(): void {
    if (this.hunterForm.invalid) {
      this.hunterForm.markAllAsTouched();
      return;
    }

    this.save.emit(this.draft.toRequest());
  }

  // ---- Display-only helpers

  /** A section with no options and no free-text label is a fixed grant — rules, not a choice. */
  isFixedGrant(section: BespokeSectionResponse): boolean {
    return section.options.length === 0 && section.freeTextLabel === null;
  }

  /** Ratings are always written signed on a playbook sheet, including `+0`. */
  formatStat(value: number): string {
    return value < 0 ? `${value}` : `+${value}`;
  }

  gearCategoryHint(category: PlaybookGearCategoryResponse): string {
    const limit = category.pickCount === null ? 'any number' : `${category.pickCount}`;
    return category.isOptional ? `Optional — pick ${limit}` : `Pick ${limit}`;
  }

  // ---- Pass-throughs to HunterDraft

  isMoveSelected(moveId: string): boolean { return this.draft.isMoveSelected(moveId); }
  toggleMove(moveId: string): void { this.draft.toggleMove(moveId); }
  moveSectionsFor(move: PlaybookMoveResponse): BespokeSectionResponse[] { return this.draft.moveSectionsFor(move); }

  isGearSelected(optionId: string): boolean { return this.draft.isGearSelected(optionId); }
  toggleGear(optionId: string): void { this.draft.toggleGear(optionId); }
  pickedInCategory(category: PlaybookGearCategoryResponse): number { return this.draft.pickedInCategory(category); }
  isGearLimitReached(category: PlaybookGearCategoryResponse): boolean { return this.draft.isGearLimitReached(category); }
  isGearPickShort(category: PlaybookGearCategoryResponse): boolean { return this.draft.isGearPickShort(category); }

  lookOptionFor(categoryId: string): string | null { return this.draft.lookOptionFor(categoryId); }
  lookFreeformFor(categoryId: string): string { return this.draft.lookFreeformFor(categoryId); }
  setLookOption(categoryId: string, optionId: string): void { this.draft.setLookOption(categoryId, optionId); }
  setLookFreeform(categoryId: string, text: string): void { this.draft.setLookFreeform(categoryId, text); }

  trackValueFor(trackId: string): number { return this.draft.trackValueFor(trackId); }
  setTrackValue(trackId: string, raw: string, boxCount: number): void { this.draft.setTrackValue(trackId, raw, boxCount); }

  isRepeatable(section: BespokeSectionResponse): boolean { return this.draft.isRepeatable(section); }
  instancesFor(section: BespokeSectionResponse): BespokeInstanceState[] { return this.draft.instancesFor(section); }
  canAddInstance(section: BespokeSectionResponse): boolean { return this.draft.canAddInstance(section); }
  addInstance(section: BespokeSectionResponse): void { this.draft.addInstance(section); }
  removeInstance(key: string): void { this.draft.removeInstance(key); }
  setInstanceName(key: string, name: string): void { this.draft.setInstanceName(key, name); }
  picksFor(scopeKey: string): ReadonlySet<string> { return this.draft.picksFor(scopeKey); }
  answersFor(scopeKey: string): ReadonlyMap<string, BespokeOptionAnswer> { return this.draft.answersFor(scopeKey); }
  toggleBespoke(scopeKey: string, optionId: string): void { this.draft.toggleBespoke(scopeKey, optionId); }
  setBespokeAnswer(scopeKey: string, change: BespokeAnswerChange): void { this.draft.setBespokeAnswer(scopeKey, change); }
  freeTextFor(scopeKey: string): string { return this.draft.freeTextFor(scopeKey); }
  setFreeText(scopeKey: string, value: string): void { this.draft.setFreeText(scopeKey, value); }
  lockedScopes(section: BespokeSectionResponse, scopeKey: string): ReadonlySet<string> { return this.draft.lockedScopes(section, scopeKey); }
  sectionProgress(section: BespokeSectionResponse, scopeKey: string): string | null { return this.draft.sectionProgress(section, scopeKey); }

  entriesFor(journal: BespokeJournalResponse): JournalEntryState[] { return this.draft.entriesFor(journal); }
  addJournalEntry(journal: BespokeJournalResponse): void { this.draft.addJournalEntry(journal); }
  removeJournalEntry(key: string): void { this.draft.removeJournalEntry(key); }
  journalFieldValue(entryKey: string, fieldId: string): string { return this.draft.journalFieldValue(entryKey, fieldId); }
  setJournalField(entryKey: string, fieldId: string, value: string): void { this.draft.setJournalField(entryKey, fieldId, value); }

  // ---- Playbook loading

  /** The draft is filled first, then the playbook loads (and prunes) — the same order as before extraction. */
  private populate(hunter: HunterDetailResponse | null): void {
    this.draft.populate(hunter);
    if (hunter) {
      this.loadPlaybook(hunter.playbookId);
    }
  }

  private loadPlaybook(playbookId: string): void {
    this.playbookIdRequests.next(playbookId);
  }

  /** The switchMap's projection. Sets isLoadingPlaybook as a side effect before the request goes out. */
  private fetchPlaybook(playbookId: string) {
    if (!playbookId) {
      return of<PlaybookLoadOutcome>({ kind: 'empty' });
    }

    this.isLoadingPlaybook.set(true);
    return this.playbookService.getById(playbookId).pipe(
      map((playbook): PlaybookLoadOutcome => ({ kind: 'loaded', playbook })),
      catchError(() => of<PlaybookLoadOutcome>({ kind: 'error' }))
    );
  }

  private applyPlaybookOutcome(outcome: PlaybookLoadOutcome): void {
    if (outcome.kind === 'empty') {
      this.playbook.set(null);
      this.playbookError.set(null);
      this.isLoadingPlaybook.set(false);
      return;
    }
    if (outcome.kind === 'error') {
      this.playbook.set(null);
      this.playbookError.set('Unable to load that playbook.');
      this.isLoadingPlaybook.set(false);
      return;
    }
    this.playbook.set(outcome.playbook);
    this.playbookError.set(null);
    this.isLoadingPlaybook.set(false);
    this.draft.prune(outcome.playbook);
  }
}

interface LookGroup {
  readonly label: string | null;
  readonly categories: PlaybookLookCategoryResponse[];
}

/** The switchMap pipeline's result shape — see fetchPlaybook/applyPlaybookOutcome. */
type PlaybookLoadOutcome =
  | { readonly kind: 'empty' }
  | { readonly kind: 'error' }
  | { readonly kind: 'loaded'; readonly playbook: PlaybookDetailResponse };
