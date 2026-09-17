import {
  Component,
  DOCUMENT,
  HostListener,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Observable, Subject, take } from 'rxjs';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { WizardLayoutComponent } from '../../../../shared/wizard/wizard-layout';
import { WizardTrackerComponent } from '../../../../shared/wizard/wizard-tracker';
import { HunterDraft } from '../../shared/hunter-draft';
import { scrollToAnchor } from '../../shared/sections/section-anchors';
import { HUNTER_SECTION_NAVIGATOR } from '../../shared/sections/section-navigator';
import { HunterCreateStore } from './hunter-create.store';
import { DiscardGuardedPage } from './hunter-draft.guard';
import { HunterSheetPreviewComponent } from './hunter-sheet-preview';
import { HUNTER_STEP } from './hunter-step-model';
import { HunterGearStepComponent } from './steps/hunter-gear-step';
import { HunterImprovementsStepComponent } from './steps/hunter-improvements-step';
import { HunterIntroductionsStepComponent } from './steps/hunter-introductions-step';
import { HunterMovesStepComponent } from './steps/hunter-moves-step';
import { HunterPlaybookStepComponent } from './steps/hunter-playbook-step';
import { HunterRatingsStepComponent } from './steps/hunter-ratings-step';
import { HunterRulesStepComponent } from './steps/hunter-rules-step';
import { HunterTracksStepComponent } from './steps/hunter-tracks-step';

/**
 * `/hunters/new`: the Hunter creation wizard (hunter-creation-wizard.md 3, 5, 7; Phase 7). It replaced
 * the single-page create, and `HunterFormComponent` is now edit-only (L17).
 *
 * The page provides one `HunterDraft` and one `HunterCreateStore` for the wizard's lifetime. The step
 * components and the shared sections inside them inject both and own no state (L2): the whole hunter
 * is one request, sent once by Create, so the steps are a display concern, not a data boundary. The
 * store is also the sections' navigator, so their "Go to" buttons are step links here (F6).
 *
 * The page owns what belongs to leaving it (F7): the discard confirmation the route guard waits on,
 * and the browser's own prompt on refresh or tab close.
 */
@Component({
  selector: 'app-hunter-create',
  imports: [
    WizardLayoutComponent,
    WizardTrackerComponent,
    ConfirmDeleteModalComponent,
    HunterSheetPreviewComponent,
    HunterPlaybookStepComponent,
    HunterRatingsStepComponent,
    HunterTracksStepComponent,
    HunterRulesStepComponent,
    HunterMovesStepComponent,
    HunterGearStepComponent,
    HunterImprovementsStepComponent,
    HunterIntroductionsStepComponent,
  ],
  providers: [HunterDraft, HunterCreateStore, { provide: HUNTER_SECTION_NAVIGATOR, useExisting: HunterCreateStore }],
  templateUrl: './hunter-create.html',
  host: { class: 'block h-full' },
})
export class HunterCreateComponent implements OnInit, DiscardGuardedPage {
  readonly store = inject(HunterCreateStore);
  private readonly draft = inject(HunterDraft);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  readonly step = HUNTER_STEP;

  readonly isConfirmingDiscard = signal(false);
  private discardDecision: Subject<boolean> | null = null;

  /** L12: the name so far, or "New Hunter". */
  readonly discardName = computed(() => this.draft.formValue().name.trim() || 'New Hunter');

  readonly switchMessage = computed(() => {
    const pending = this.store.pendingSwitch();
    return pending ? `These belong to ${pending.fromName} and will be cleared:` : '';
  });

  constructor() {
    // A link's anchor scrolls once its step has rendered, and after the layout's own scroll reset:
    // the reset is a write-phase hook, this is a read-phase one, so it runs later in the same render.
    effect(() => {
      const anchor = this.store.pendingAnchor();
      if (!anchor) {
        return;
      }
      afterNextRender(
        {
          read: () => {
            scrollToAnchor(this.document, anchor);
            this.store.pendingAnchor.set(null);
          },
        },
        { injector: this.injector }
      );
    });
  }

  ngOnInit(): void {
    this.store.init();
  }

  /** Whether leaving now would lose anything (L12). Create's own navigation passes (13.10). */
  needsDiscardConfirmation(): boolean {
    return !this.store.submitted() && this.draft.isDirty();
  }

  /** The guard's question. A dirty draft opens the discard confirmation and waits for its answer. */
  canLeave(): boolean | Observable<boolean> {
    if (!this.needsDiscardConfirmation()) {
      return true;
    }
    this.resolveDiscard(false);
    const decision = new Subject<boolean>();
    this.discardDecision = decision;
    this.isConfirmingDiscard.set(true);
    return decision.pipe(take(1));
  }

  resolveDiscard(leave: boolean): void {
    this.isConfirmingDiscard.set(false);
    const decision = this.discardDecision;
    this.discardDecision = null;
    decision?.next(leave);
    decision?.complete();
  }

  /** Refresh or tab close: the browser's own prompt, under the same condition as the guard (7.5, L12). */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.needsDiscardConfirmation()) {
      event.preventDefault();
    }
  }
}
