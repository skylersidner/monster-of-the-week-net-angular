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
 * (hunter-creation-wizard.md 13.5), which this component provides for itself. The page is composed
 * of the shared sections in `../sections/` (13.6): ratings, moves, gear, look, bespoke sections and
 * History. They inject this form's draft. What stays here is the playbook picker, name and pronouns,
 * the edit-only blocks (extra tracks, Luck / Harm / Experience, journals, which the wizard shows
 * read-only instead), the playbook load and the submit gate.
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
    this.draft.form.controls.playbookId.valueChanges
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
    if (this.draft.form.invalid) {
      this.draft.form.markAllAsTouched();
      return;
    }

    this.save.emit(this.draft.toRequest());
  }

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
      this.draft.playbook.set(null);
      this.playbookError.set(null);
      this.isLoadingPlaybook.set(false);
      return;
    }
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
  | { readonly kind: 'empty' }
  | { readonly kind: 'error' }
  | { readonly kind: 'loaded'; readonly playbook: PlaybookDetailResponse };
