import { Component, Input } from '@angular/core';
import { MysteryCountdownStageIconKind } from './mystery-countdown-stage';

export type MysterySectionIconKind =
  | 'mystery'
  | 'countdown'
  | 'monster'
  | 'minions'
  | 'locations'
  | 'bystanders'
  | MysteryCountdownStageIconKind;

@Component({
  selector: 'app-mystery-section-icon',
  template: `
    <svg
      class="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.8"
      aria-hidden="true">
      @switch (kind) {
        @case ('mystery') {
          <path d="M7 4.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5z" />
          <path d="M14 4.5v4h4" />
          <path d="M9 12h6" />
          <path d="M9 15.5h6" />
        }
        @case ('countdown') {
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.8V12l3 1.9" />
          <path d="M12 3.5v1.7" />
          <path d="M20.5 12h-1.7" />
          <path d="M5.2 12H3.5" />
          <path d="M12 20.5v-1.7" />
        }
        @case ('day') {
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 4.5v2" />
          <path d="M12 17.5v2" />
          <path d="M4.5 12h2" />
          <path d="M17.5 12h2" />
          <path d="m6.7 6.7 1.4 1.4" />
          <path d="m15.9 15.9 1.4 1.4" />
          <path d="m17.3 6.7-1.4 1.4" />
          <path d="m8.1 15.9-1.4 1.4" />
        }
        @case ('shadows') {
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 7.8a4.2 4.2 0 0 1 0 8.4" />
          <path d="M12 4.2v1.8" />
          <path d="M12 18v1.8" />
          <path d="M4.2 12H6" />
          <path d="M18 12h1.8" />
          <path d="m6.7 6.7 1.2 1.2" />
          <path d="m16.1 16.1 1.2 1.2" />
        }
        @case ('sunset') {
          <path d="M4 15.5h16" />
          <path d="M8 15.5a4 4 0 0 1 8 0" />
          <path d="M12 6.5v2" />
          <path d="m7.2 9.2 1.4 1.1" />
          <path d="m16.8 9.2-1.4 1.1" />
          <path d="M5.5 12h2" />
          <path d="M16.5 12h2" />
        }
        @case ('dusk') {
          <path d="M4 16h11" />
          <path d="M17.8 7.2 18.4 9l1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" />
          <path d="M7 16a5 5 0 0 1 10 0" />
        }
        @case ('nightfall') {
          <path d="M15.8 5.4a6.8 6.8 0 1 0 0 13.2 5.7 5.7 0 1 1 0-13.2z" />
        }
        @case ('midnight') {
          <path d="M14.8 5.6a6.2 6.2 0 1 0 0 12 5.3 5.3 0 1 1 0-12z" />
          <path d="m17.6 5.8.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" />
          <path d="m18.3 11.8.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" />
        }
        @case ('monster') {
          <path d="M7.5 5.5 10.5 13 12 10.5 13.5 13 16.5 5.5" />
          <path d="M7 17c1.4-1.7 3.1-2.5 5-2.5s3.6.8 5 2.5" />
        }
        @case ('minions') {
          <path d="M7.5 7.5 9.5 12l1.4-1.8L12.2 12l1.9-4.5" />
          <path d="M9 16.2c.8-.8 1.8-1.2 3-1.2s2.2.4 3 1.2" />
          <path d="M4.5 9.5 6 13l1-1.2 1.1 1.2 1.4-3.5" />
          <path d="M5.5 17c.6-.6 1.3-.9 2.1-.9.4 0 .8.1 1.2.2" />
        }
        @case ('locations') {
          <path d="M12 20.5s5-4.7 5-9a5 5 0 1 0-10 0c0 4.3 5 9 5 9Z" />
          <circle cx="12" cy="11.5" r="1.8" />
        }
        @case ('bystanders') {
          <circle cx="9" cy="9.2" r="2.2" />
          <circle cx="15.2" cy="10.2" r="1.9" />
          <path d="M5.8 18.5c.6-2 2.2-3.2 4.2-3.2s3.6 1.2 4.2 3.2" />
          <path d="M13 18.5c.4-1.5 1.5-2.4 3-2.4 1.4 0 2.5.9 3 2.4" />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        align-items: center;
        color: inherit;
        display: inline-flex;
        flex: 0 0 auto;
        height: var(--mystery-section-icon-size, 1rem);
        justify-content: center;
        width: var(--mystery-section-icon-size, 1rem);
      }

      .icon {
        display: block;
        height: 100%;
        overflow: visible;
        width: 100%;
      }
    `,
  ],
})
export class MysterySectionIconComponent {
  @Input({ required: true }) kind!: MysterySectionIconKind;
}
