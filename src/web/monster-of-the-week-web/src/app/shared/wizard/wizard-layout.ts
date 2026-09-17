import {
  Component,
  ElementRef,
  Injector,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
  afterNextRender,
  inject,
} from '@angular/core';

/**
 * Side-by-side wizard shell shared by the wizards (hunter-creation-wizard.md §5, 13.4): a tracker on
 * top, a form column (eyebrow, title, blurb, step content, error band, footer) and a live-preview aside.
 *
 * Slots: `[wizardTracker]`, `[wizardTitleIcon]`, the default slot for step content, `[wizardFooter]`
 * and `[wizardAside]`.
 *
 * On every `stepKey` change after the first render, the column scrolls back to the top and focus
 * moves to the step heading (L22). Below `md` the column is full width and the aside is hidden (L23).
 *
 * `ViewEncapsulation.None` so the `.dossier-section` entrance animation reaches projected dossier
 * markup; every rule is scoped under `.wizard-layout`.
 */
@Component({
  selector: 'app-wizard-layout',
  templateUrl: './wizard-layout.html',
  styleUrl: './wizard-layout.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'block h-full' },
})
export class WizardLayoutComponent implements OnChanges {
  private readonly injector = inject(Injector);

  @Input() eyebrow = '';
  @Input() title = '';
  @Input() blurb = '';
  @Input() error: string | null = null;
  /** Must change on every navigation, including between steps of the same phase. */
  @Input() stepKey: string | number | null = null;

  @ViewChild('column', { static: true }) private readonly column!: ElementRef<HTMLElement>;
  @ViewChild('heading', { static: true }) private readonly heading!: ElementRef<HTMLElement>;

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['stepKey'];
    if (!change || change.firstChange) {
      return;
    }

    // After the render, so the heading already reads the new step's title when it takes focus.
    afterNextRender({ write: () => this.moveToStepStart() }, { injector: this.injector });
  }

  private moveToStepStart(): void {
    this.column.nativeElement.scrollTop = 0;
    this.heading.nativeElement.focus({ preventScroll: true });
  }
}
