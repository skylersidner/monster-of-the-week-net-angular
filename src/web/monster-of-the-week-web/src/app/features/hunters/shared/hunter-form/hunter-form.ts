import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { PlaybookService } from '../../../../core/playbook';
import { HunterDraft } from '../hunter-draft';
import { HunterBespokeSectionComponent } from '../sections/hunter-bespoke-section';
import { HunterGearSectionComponent } from '../sections/hunter-gear-section';
import { HunterHistorySectionComponent } from '../sections/hunter-history-section';
import { HunterLookSectionComponent } from '../sections/hunter-look-section';
import { HunterMovesSectionComponent } from '../sections/hunter-moves-section';
import { HunterRatingsSectionComponent } from '../sections/hunter-ratings-section';
import {
  HunterDetailResponse,
  PlaybookDetailResponse,
  PlaybookListItemResponse,
  UpsertHunterRequest,
} from '../../../../core/models';

/**
 * The Hunter edit form on `/hunters/:hunterId`: one page, one submit, for a hunter that already
 * exists. Edit-only since Phase 7 (hunter-creation-wizard.md L17): creating a hunter is the wizard at
 * `/hunters/new` (`pages/hunter-create/`), which replaced the single-page create that architecture.md
 * Section 8 described. Section 8's persistence half still holds for both: a hunter is one request.
 *
 * Mirrors `MonsterFormComponent`'s `@Input() hunter` / `@Output() save` contract, with one deliberate
 * departure: this component loads the hunter's Playbook itself rather than receiving its options as
 * inputs, because the option lists belong to the playbook, not to the page.
 *
 * Nothing in here blocks a save on an *unfinished* sheet (architecture.md Section 9). The
 * per-section counters are progress indicators, not validators: a name and a playbook are
 * the only things this form requires, because a hunter is savable and resumable at any stage.
 * The aggregate "what's left" list is not recomputed here — it comes back from the server on
 * `HunterDetailResponse.outstanding`, so the rule lives in exactly one place.
 *
 * All hunter state, prune, the untick clear and the request builder live in `HunterDraft`
 * (hunter-creation-wizard.md 13.5), which this component provides for itself. The page is composed
 * of the shared sections in `../sections/` (13.6): ratings, moves, gear, look, bespoke sections and
 * History. They inject this form's draft. What stays here is the locked playbook picker, name and
 * pronouns, the edit-only blocks (extra tracks, Luck / Harm / Experience, journals, which the wizard
 * shows read-only instead), the playbook load and the submit gate.
 */
@Component({
  selector: 'app-hunter-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CustomSelectComponent,
    HunterRatingsSectionComponent,
    HunterMovesSectionComponent,
    HunterGearSectionComponent,
    HunterLookSectionComponent,
    HunterBespokeSectionComponent,
    HunterHistorySectionComponent,
  ],
  templateUrl: './hunter-form.html',
  host: { class: 'block' },
  providers: [HunterDraft],
})
export class HunterFormComponent implements OnChanges {
  private readonly playbookService = inject(PlaybookService);
  private readonly destroyRef = inject(DestroyRef);

  /** This form's own draft: provided above, so every form instance, and its sections, share a fresh one. */
  readonly draft = inject(HunterDraft);

  @Input() playbooks: PlaybookListItemResponse[] = [];
  /** The saved hunter being edited. Any change to this input repopulates the form. */
  @Input({ required: true }) hunter!: HunterDetailResponse;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Hunter';

  @Output() readonly save = new EventEmitter<UpsertHunterRequest>();

  readonly isLoadingPlaybook = signal(false);
  readonly playbookError = signal<string | null>(null);

  /**
   * Every load goes through this one Subject into one switchMap (below), so when the hunter input is
   * re-set (after a save) while an earlier load is still in flight, the earlier response can't land
   * after, and overwrite, the later one (13.11 item 5).
   */
  private readonly playbookIdRequests = new Subject<string>();

  /**
   * Wires the playbook-loading pipeline here, in the constructor, rather than in ngOnInit —
   * load-bearing, not stylistic. `hunter-detail.html` only creates this component once its
   * `hunter()` signal is already truthy (`@if (hunter(); as current) { <app-hunter-form
   * [hunter]="current" ...> }`), so the very FIRST `ngOnChanges` this component ever receives
   * already carries the hunter, and Angular calls ngOnChanges *before* ngOnInit on that first
   * change-detection pass. `populate()` (called from ngOnChanges) ends by pushing into
   * `playbookIdRequests`; a subscription set up in ngOnInit would not exist yet on that first push,
   * and — being a plain Subject, not a ReplaySubject — would silently drop it, so the playbook
   * would never load. The draft is injected in a field initializer, so its form exists before this
   * body runs.
   */
  constructor() {
    // switchMap: a new load cancels whatever fetch is still in flight for the previous one, so a
    // slow response can never arrive after, and overwrite, a later one's.
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
    if (this.draft.form.invalid) {
      this.draft.form.markAllAsTouched();
      return;
    }

    this.save.emit(this.draft.toRequest());
  }

  // ---- Playbook loading

  /** The draft is filled first, then the playbook loads (and prunes) — the same order as before extraction. */
  private populate(hunter: HunterDetailResponse): void {
    this.draft.populate(hunter);
    this.playbookIdRequests.next(hunter.playbookId);
  }

  /** The switchMap's projection. Sets isLoadingPlaybook as a side effect before the request goes out. */
  private fetchPlaybook(playbookId: string) {
    this.isLoadingPlaybook.set(true);
    return this.playbookService.getById(playbookId).pipe(
      map((playbook): PlaybookLoadOutcome => ({ kind: 'loaded', playbook })),
      catchError(() => of<PlaybookLoadOutcome>({ kind: 'error' }))
    );
  }

  private applyPlaybookOutcome(outcome: PlaybookLoadOutcome): void {
    if (outcome.kind === 'error') {
      this.draft.playbook.set(null);
      this.playbookError.set('Unable to load that playbook.');
      this.isLoadingPlaybook.set(false);
      return;
    }
    this.draft.playbook.set(outcome.playbook);
    this.playbookError.set(null);
    this.isLoadingPlaybook.set(false);
    this.draft.prune(outcome.playbook);
  }
}

/** The switchMap pipeline's result shape — see fetchPlaybook/applyPlaybookOutcome. */
type PlaybookLoadOutcome =
  | { readonly kind: 'error' }
  | { readonly kind: 'loaded'; readonly playbook: PlaybookDetailResponse };
