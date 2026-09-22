import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';

import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MonsterListItemResponse, MysteryListItemResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { MonstersListComponent } from './monsters-list';

/**
 * `monsters-list` is the only one of the three swept pages whose trash button is
 * `[disabled]="isLoadingMinions()"`, and it is the only one whose `requestDelete` does a **second
 * round trip** before the dialog opens. Those two facts interact with the dialog's new focus-restore,
 * and the interaction is invisible to a spec whose `getByMonster` is a synchronous `of(...)` — which
 * is what `monsters-list.spec.ts` uses, so its own coverage cannot see this.
 *
 * `ConfirmDeleteModalComponent` captures its opener from `document.activeElement` at the moment
 * `visible` flips true. On this page that moment is *after* the minion fetch resolves, and the trash
 * button has been `disabled` for the whole of that fetch. A disabled button cannot hold focus, so by
 * the time the capture happens the opener the dialog is supposed to remember has already blurred.
 */

function buildMystery(id: string, name: string): MysteryListItemResponse {
  return {
    id,
    name,
    concept: null,
    hook: null,
    adventureType: { id: 'adv-1', name: 'Haunting', description: '' },
    monsterCount: 0,
    locationCount: 0,
    bystanderCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function buildMonster(id: string, name: string, mysteryIds: string[]): MonsterListItemResponse {
  return {
    id,
    mysteryIds,
    name,
    description: 'Tall and quiet.',
    harmCapacity: 6,
    monsterType: { id: 'mt1', name: 'Beast', motivation: 'to hunt' },
    monsterArchetype: { id: 'ma1', name: 'Ghost', description: 'a restless dead' },
    attackCount: 1,
    powerCount: 1,
    armorCount: 0,
    weaknessCount: 1,
    minionCount: 2,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

describe('MonstersListComponent · focus across the async minion lookup', () => {
  let fixture: ComponentFixture<MonstersListComponent>;
  let minions: Subject<{ name: string }[]>;

  beforeEach(async () => {
    minions = new Subject<{ name: string }[]>();

    await TestBed.configureTestingModule({
      imports: [MonstersListComponent],
      providers: [
        provideRouter([]),
        {
          provide: MonsterService,
          useValue: {
            getAll: () => of([buildMonster('mo1', 'The Hollow Man', ['m1'])]),
            delete: () => of(undefined as void),
          },
        },
        // Deliberately *not* synchronous: the gap only exists while the fetch is in flight.
        { provide: MinionService, useValue: { getByMonster: () => minions.asObservable() as Observable<{ name: string }[]> } },
        { provide: MysteryService, useValue: { getMysteries: () => of([buildMystery('m1', 'Dust Bowl Nights')]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MonstersListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const trash = (): HTMLButtonElement => element().querySelector<HTMLButtonElement>('.action-btn--delete')!;
  const dialog = (): HTMLElement | null => element().querySelector<HTMLElement>('[role="dialog"]');
  const dialogButtons = (): HTMLButtonElement[] =>
    Array.from(dialog()!.querySelectorAll<HTMLButtonElement>('button'));

  it('leaves the trash button disabled, and the dialog unopened, for the whole of the lookup', () => {
    const button = trash();
    button.focus();
    expect(document.activeElement).toBe(button);

    button.click();
    fixture.detectChanges();

    // This window is the whole defect. `requestDelete` sets `isLoadingMinions` and only opens the
    // dialog in the subscriber, so there is a render in between in which the control the user
    // activated is `disabled`.
    expect(dialog()).toBeNull();
    expect(button.disabled).toBe(true);
  });

  it('returns focus to the trash button even though it blurred while disabled', async () => {
    const button = trash();
    button.focus();
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);

    // **Why focus has moved by now, and where that was established.** jsdom does not implement
    // blur-on-disable, so this spec cannot produce the state the browser produces; it stands in for
    // it with an explicit `blur()`. The browser half was measured in Chromium via Playwright:
    // focusing a `<button>` and then setting `disabled = true` leaves
    // `document.activeElement === document.body`, and re-enabling the button does **not** bring it
    // back. So in a real browser this line is what `[disabled]="isLoadingMinions()"` does by itself.
    //
    // The earlier version of this test moved focus to a *different real button* instead, which is
    // not the state the browser produces — and that made it pass either way, before and after the
    // fix. Dropping focus to `<body>` is the whole point: that is what the component now has to
    // recover from.
    //
    // Two jsdom mechanics to work around, both of which would otherwise fake the test:
    // `blur()` is a no-op on a *disabled* element, so the attribute comes off for the duration of
    // the call; and focusing any stand-in element instead would fire `focusin` and overwrite the
    // very opener whose recovery is under test.
    button.removeAttribute('disabled');
    button.blur();
    button.setAttribute('disabled', '');
    expect(document.activeElement).toBe(document.body);
    expect(button.disabled).toBe(true);

    // The lookup resolves and the dialog opens.
    minions.next([{ name: 'Grave-Wight' }, { name: 'Pale Choir' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialog()).toBeTruthy();
    expect(document.activeElement).toBe(dialogButtons()[0]);
    expect(trash().disabled).toBe(false);

    dialogButtons()[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialog()).toBeNull();
    // §8 item 5: "focus returns to the trash button that opened it". Capturing `activeElement` when
    // `visible` flipped could not do that here — by then the opener had already blurred — so the
    // dialog tracks focus as it moves and restores the last element that held it.
    expect(document.activeElement).toBe(trash());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('the two pages with no pre-fetch do return focus, so the cause is the disable-then-fetch, not the modal', async () => {
    // Same component, but with the lookup already resolved before the click: `requestDelete` then
    // flips `isLoadingMinions` back to false inside the same synchronous turn, the button is never
    // rendered disabled, and the capture sees it. This is the shape `locations-list` and
    // `bystanders-list` have unconditionally.
    minions.next([]);
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [MonstersListComponent],
      providers: [
        provideRouter([]),
        {
          provide: MonsterService,
          useValue: {
            getAll: () => of([buildMonster('mo1', 'The Hollow Man', ['m1'])]),
            delete: () => of(undefined as void),
          },
        },
        { provide: MinionService, useValue: { getByMonster: () => of([{ name: 'Grave-Wight' }]) } },
        { provide: MysteryService, useValue: { getMysteries: () => of([buildMystery('m1', 'Dust Bowl Nights')]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MonstersListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const button = trash();
    button.focus();
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialog()).toBeTruthy();
    dialogButtons()[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
