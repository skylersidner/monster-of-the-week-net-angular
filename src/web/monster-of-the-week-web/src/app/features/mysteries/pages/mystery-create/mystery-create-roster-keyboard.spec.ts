import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateComponent } from './mystery-create';
import { MinionDraft, MysteryCreateStore, createDraftKey } from './mystery-create.store';

/**
 * `mystery-entity-linking.md` §9 asks Toad for **keyboard-only traversal of the minion roster end to
 * end** and a **screen-reader pass on the roster and the modal**.
 *
 * **What this file can and cannot establish, stated plainly so nobody reads more into it.** It walks
 * the roster the way a keyboard user does — tab order, activation, where focus lands after each
 * mutation — and it asserts the ARIA wiring a screen reader would consume: computed accessible
 * names, `tabindex`, dialog labelling. That is *programmatic* a11y coverage. **It is not a
 * screen-reader result.** No assistive technology ran here, and nothing in this file establishes what
 * NVDA, JAWS or VoiceOver actually say. The human items are listed at the bottom of this comment.
 *
 * Three of the assertions below are **characterisations of current behaviour that is wrong**, marked
 * `CHARACTERISED DEFECT`. They are written as `expect(...)` on the broken value on purpose, so that
 * fixing the defect fails the test and the fix cannot land silently. Each names who owns it.
 *
 * **Still needs a human with a screen reader:**
 * - that focusing the composer `<h4>` actually announces "Editing “{name}”" rather than being
 *   swallowed as a non-interactive focus target;
 * - that the roster's `<ul>`/`<li>` structure is announced as a list of N items, and that the
 *   per-row badges and sub-resource summary read in a usable order;
 * - that the dialog's `aria-describedby` block is read in full on open, including both lists;
 * - that nothing double-announces now that `title` and `aria-label` differ on the roster buttons.
 */

// ---------------------------------------------------------------------------------------------

class MockReferenceDataService {
  getAdventureTypes = () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]);
  getMonsterArchetypes = () => of([{ id: 'monster-archetype-1', name: 'Ghost', description: '' }]);
  getMonsterTypes = () => of([{ id: 'monster-type-1', name: 'Beast', motivation: '' }]);
  getMinionTypes = () => of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]);
  getLocationTypes = () => of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]);
  getBystanderTypes = () => of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]);
  getWeaponTags = () => of([{ id: 'weapon-tag-1', name: 'Bladed', description: '' }]);
}

/** One monster, so the minion composer needs no picker and every fixture minion has a parent. */
const MONSTER_KEY = 'monster-fixture';

function minionDraft(name: string, overrides: Partial<MinionDraft> = {}): MinionDraft {
  return {
    id: null,
    localKey: createDraftKey(),
    monsterKey: MONSTER_KEY,
    existingMonsterId: null,
    name,
    description: '',
    harmCapacity: 3,
    minionTypeId: 'minion-type-1',
    attacks: [],
    powers: [],
    weaknesses: [],
    armors: [],
    existingAttacks: [],
    existingPowers: [],
    existingWeaknesses: [],
    existingArmors: [],
    ...overrides,
  };
}

/**
 * The accessible name a browser would compute for a control, restricted to the sources this app
 * actually uses: `aria-label` wins, then text content, then `title`. Written out rather than taken
 * from a library so the precedence being relied on is visible — §8 item 4's whole point is that
 * `title` is a *fallback* source and must stop being the only one.
 */
function accessibleName(element: HTMLElement): string {
  const label = element.getAttribute('aria-label');
  if (label) {
    return label;
  }
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text) {
    return text;
  }
  return element.getAttribute('title') ?? '';
}

describe('The minion roster, keyboard-only and by its ARIA', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let store: MysteryCreateStore;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MysteryCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ReferenceDataService, useClass: MockReferenceDataService },
        {
          provide: MysteryService,
          useValue: { create: () => of({ id: 'mystery-1' }), upsertCountdown: () => of({}), getMysteries: () => of([]) },
        },
        { provide: MonsterService, useValue: { getAll: () => of([]), create: () => of({ id: 'monster-1' }) } },
        // Phase 4: the store loads the attach catalogues through the real Location/Bystander services.
        { provide: ApiService, useValue: { post: () => of({}), get: () => of([]) } },
        { provide: NotificationService, useValue: { success: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryCreateComponent);
    store = fixture.debugElement.injector.get(MysteryCreateStore);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Puts the wizard on the minion step with a roster and the composer collapsed. */
  async function showRoster(names: string[], overrides: Partial<MinionDraft> = {}): Promise<void> {
    store.currentPhase.set(1);
    store.currentStep.set(1);
    const drafts = names.map((name) => minionDraft(name, overrides));
    store.minionDrafts.set(drafts);
    // The removal modal asks the store whether a row is persisted, and the store answers from the
    // baseline (5a). A fixture that sets an id without the baseline is exactly the state the shared
    // hydrator makes unreachable in production, so keep the two in step here too. Bracket access
    // because the baseline is private and should stay that way — the store owns it; this is a
    // fixture standing in for a load.
    // The minion baseline is derived from the roster (J1), so a persisted minion fixture needs its
    // monster on the roster carrying its id. That is also the production invariant: a minion id can
    // only be in the baseline because its monster hydrated with it.
    store.monsterDrafts.set([
      {
        id: 'monster-1',
        localKey: MONSTER_KEY,
        name: 'The Hollow Man',
        description: '',
        harmCapacity: 8,
        monsterTypeId: 'monster-type-1',
        monsterArchetypeId: 'monster-archetype-1',
        attacks: [],
        powers: [],
        weaknesses: [],
        armors: [],
        existingAttacks: [],
        existingPowers: [],
        existingWeaknesses: [],
        existingArmors: [],
        existingMinionIds: drafts.map((draft) => draft.id).filter((id): id is string => id !== null),
        mysteryIds: [],
      },
    ]);
    store.editingMinionKey.set(null);
    store.minionComposerOpen.set(false);
    await settle();
  }

  const rosterList = (): HTMLUListElement => element.querySelector<HTMLUListElement>('ul.grid.gap-2')!;
  const rows = (): HTMLLIElement[] => Array.from(rosterList().querySelectorAll('li'));
  const composer = (): HTMLElement | null => element.querySelector<HTMLElement>('.border.border-default.rounded-lg.mt-4');
  const composerHeading = (): HTMLElement => composer()!.querySelector<HTMLElement>('h4')!;
  const addAnother = (): HTMLButtonElement =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Add Another Minion'))!;
  const dialog = (): HTMLElement | null => element.querySelector<HTMLElement>('[role="dialog"]');
  const dialogButtons = (): HTMLButtonElement[] =>
    Array.from(dialog()!.querySelectorAll<HTMLButtonElement>('button'));
  const buttonNamed = (name: string): HTMLButtonElement =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => accessibleName(button) === name,
    )!;

  function pressEscape(from: HTMLElement): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    from.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  // -------------------------------------------------------------------------------------------
  // 1. Tab order and accessible names
  // -------------------------------------------------------------------------------------------

  it('gives every roster control a distinct accessible name, in row order', async () => {
    await showRoster(['Cultist', 'Thrall', 'Acolyte', 'Pale Choir', 'Grave-Wight']);

    const names = rows().flatMap((row) =>
      Array.from(row.querySelectorAll<HTMLButtonElement>('button')).map(accessibleName),
    );

    // Five rows × two controls, and the defect §8 item 4 describes — "Edit minion" five times over —
    // would show up here as five duplicates.
    expect(names).toEqual([
      'Edit Cultist',
      'Remove Cultist',
      'Edit Thrall',
      'Remove Thrall',
      'Edit Acolyte',
      'Remove Acolyte',
      'Edit Pale Choir',
      'Remove Pale Choir',
      'Edit Grave-Wight',
      'Remove Grave-Wight',
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps every roster control in the natural tab order — nothing is reachable only by mouse', async () => {
    await showRoster(['Cultist', 'Thrall']);

    const controls = [
      ...rows().flatMap((row) => Array.from(row.querySelectorAll<HTMLElement>('button'))),
      addAnother(),
    ];

    // §8.8: an "every one of them" loop over a derived set passes vacuously when the set is empty,
    // which is the same silent-narrowing shape the Escape sweep had. Two rows, two controls each,
    // plus + Add Another Minion.
    expect(controls).toHaveLength(5);

    for (const control of controls) {
      // No negative tabindex, and not disabled — the two ways a control drops out of the tab ring.
      expect(control.getAttribute('tabindex'), accessibleName(control)).toBeNull();
      expect((control as HTMLButtonElement).disabled, accessibleName(control)).toBe(false);
      control.focus();
      expect(document.activeElement, accessibleName(control)).toBe(control);
    }
  });

  it('exposes the composer heading as a focus target only, never as a tab stop', async () => {
    await showRoster(['Cultist']);
    buttonNamed('Edit Cultist').click();
    await settle();

    // tabindex="-1" is the whole idiom: programmatically focusable so the mode change is announced,
    // and *not* a stop the user has to Tab past on every pass through the composer.
    expect(composerHeading().getAttribute('tabindex')).toBe('-1');
  });

  // -------------------------------------------------------------------------------------------
  // 2. End-to-end keyboard journey: edit a row, change it, save it
  // -------------------------------------------------------------------------------------------

  it('walks edit → composer → first field → save without ever losing the keyboard, until the save', async () => {
    await showRoster(['Cultist', 'Thrall']);

    const thrallKeyBefore = store.minionDrafts()[1].localKey;

    // (a) Tab to the second row's pencil and activate it.
    const pencil = buttonNamed('Edit Thrall');
    pencil.focus();
    expect(document.activeElement).toBe(pencil);
    pencil.click();
    await settle();

    // (b) The pencil is gone — the defect — and focus followed the composer instead of dropping.
    expect(element.contains(pencil)).toBe(false);
    expect(document.activeElement).toBe(composerHeading());
    expect(composerHeading().textContent).toContain('Editing');
    expect(composerHeading().textContent).toContain('Thrall');

    // (c) Tab from the heading reaches the composer's first field, with no stop in between.
    const focusables = Array.from(
      composer()!.querySelectorAll<HTMLElement>('input, select, textarea, button, [tabindex]:not([tabindex="-1"])'),
    );
    const firstField = focusables[0];
    expect(firstField.tagName.toLowerCase()).toBe('input');
    firstField.focus();
    expect(document.activeElement).toBe(firstField);

    // (d) Retype the name and commit with the composer's own Save Changes.
    store.minionForm.controls.name.setValue('Thrall, Second');
    await settle();
    const save = Array.from(composer()!.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Save Changes'),
    )!;
    save.focus();
    save.click();
    await settle();

    expect(store.minionDrafts().map((d) => d.name)).toEqual(['Cultist', 'Thrall, Second']);
    // The row kept its identity through a rename, which is what `localKey` buys: the card is the
    // same card even though every displayed field changed.
    expect(store.minionDrafts()[1].localKey).toBe(thrallKeyBefore);

    // (e) Focus after the composer collapses — §8 item 6, the exit half of the contract (b) opened.
    //
    // Was a characterised defect: `Save Changes` unmounts itself when the composer collapses,
    // exactly as the pencil unmounts itself on the way in, so focus was orphaned to `<body>` on the
    // way out. Fixing only the entry left a keyboard user able to get into the composer and not out
    // of it, which is why §8 pairs items 1 and 6.
    expect(element.contains(save)).toBe(false);
    expect(document.activeElement).toBe(addAnother());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('moves focus to + Add Another Minion when the composer is dismissed with Cancel', async () => {
    await showRoster(['Cultist']);
    buttonNamed('Edit Cultist').click();
    await settle();

    const cancel = Array.from(composer()!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    )!;
    cancel.focus();
    cancel.click();
    await settle();

    // Same contract as the save path. OQ2 settled that the composer always collapses, so there is
    // one exit, not two.
    expect(composer()).toBeNull();
    expect(element.contains(cancel)).toBe(false);
    expect(document.activeElement).toBe(addAnother());
  });

  it('leaves focus on Save when the composer refuses to commit and stays open', async () => {
    await showRoster(['Cultist']);
    buttonNamed('Edit Cultist').click();
    await settle();

    store.minionForm.controls.name.setValue('');
    await settle();

    const save = Array.from(composer()!.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Save Changes'),
    )!;
    save.focus();
    save.click();
    await settle();

    // Nothing collapsed, so the button the user pressed is still there and still theirs.
    expect(composer()).not.toBeNull();
    expect(document.activeElement).toBe(save);
  });

  // -------------------------------------------------------------------------------------------
  // 3. End-to-end keyboard journey: remove a row through the dialog
  // -------------------------------------------------------------------------------------------

  it('opens the dialog from the trash, lands focus on Cancel, and Escape returns it to the trash', async () => {
    await showRoster(['Cultist', 'Thrall']);

    const trash = buttonNamed('Remove Thrall');
    trash.focus();
    trash.click();
    await settle();

    // Initial focus is the least destructive actionable control, never the destructive one.
    expect(dialog()).toBeTruthy();
    expect(document.activeElement).toBe(dialogButtons()[0]);
    expect(dialogButtons().map((b) => b.textContent?.trim())).toEqual(['Cancel', 'Remove']);
    expect(document.activeElement).not.toBe(dialogButtons()[dialogButtons().length - 1]);

    // Escape cancels, and the row survives, so the opener is still connected and gets focus back.
    pressEscape(dialogButtons()[0]);
    await settle();

    expect(dialog()).toBeNull();
    expect(store.minionDrafts().map((d) => d.name)).toEqual(['Cultist', 'Thrall']);
    expect(document.activeElement).toBe(trash);
  });

  it('traps Tab inside the dialog while the roster behind it stays untabbable', async () => {
    await showRoster(['Cultist']);
    buttonNamed('Remove Cultist').click();
    await settle();

    const [cancel, confirm] = dialogButtons();

    confirm.focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    confirm.dispatchEvent(forward);
    fixture.detectChanges();
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancel);

    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    cancel.dispatchEvent(backward);
    fixture.detectChanges();
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(confirm);
  });

  it('still cancels on Escape once focus has left the dialog to <body>', async () => {
    await showRoster(['Cultist']);
    buttonNamed('Remove Cultist').click();
    await settle();

    // **How this state is reached, and which half of it was measured where.** The dialog's title,
    // message and padding are not focusable, so a single click on any of them moves
    // `document.activeElement` to `<body>` while the dialog stays open. jsdom does not model
    // blur-on-click, so that step is asserted here as an explicit `blur()` and was verified
    // separately in real Chromium via Playwright: focus goes `cancel` → `BODY` on a click on the
    // dialog's `<h3>`, and the backdrop's `keydown` listener then recorded **zero** events for a
    // subsequent `Escape`.
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    const escape = pressEscape(document.body);
    await settle();

    // Fixed by moving the handler to `@HostListener('document:keydown')`. It was bound on the
    // backdrop element, and a keydown raised on `<body>` never propagates *down* into it — so one
    // stray click disabled Escape for the rest of the dialog's life, on all thirteen call sites.
    // The nesting property survives, because `CustomSelectComponent.handleEscape` stops the event
    // before it reaches `document` too (`escape-nesting.spec.ts`).
    expect(dialog()).toBeNull();
    expect(escape.defaultPrevented).toBe(true);
  });

  it('still traps Tab once focus has left the dialog to <body>', async () => {
    await showRoster(['Cultist']);
    buttonNamed('Remove Cultist').click();
    await settle();

    (document.activeElement as HTMLElement).blur();

    // Same root cause, much smaller blast radius in a real browser — Chromium resumes sequential
    // navigation from the click point, so the next Tab lands back inside and the trap re-engages.
    // It falls out of the same change, so it is asserted rather than left as a known gap.
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.body.dispatchEvent(tab);
    fixture.detectChanges();

    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialogButtons()[0]);
  });

  it('sends focus to the roster when a confirmed removal takes the opener with it', async () => {
    await showRoster(['Cultist', 'Thrall']);

    const trash = buttonNamed('Remove Thrall');
    trash.focus();
    trash.click();
    await settle();

    const confirm = dialogButtons()[dialogButtons().length - 1];
    confirm.click();
    await settle();

    expect(store.minionDrafts().map((d) => d.name)).toEqual(['Cultist']);
    expect(trash.isConnected).toBe(false);

    // §8 item 5's last clause: "fall back to the composer heading or the phase's first focusable
    // control". The `isConnected` guard alone stopped the crash and left focus on `<body>`; the
    // fallback is derived from the DOM — the first focus stop on the surface containing the dialog —
    // so every call site gets it without passing anything. Here that is the surviving row's pencil.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(buttonNamed('Edit Cultist'));
    expect(addAnother()).toBeTruthy();
  });

  // -------------------------------------------------------------------------------------------
  // 5. The removal dialog's two variants (UX §16.4, 5a-M2/5a-M3)
  // -------------------------------------------------------------------------------------------

  const dialogText = (): string => dialog()!.textContent ?? '';
  const dialogButtonNames = (): string[] => dialogButtons().map((button) => button.textContent?.trim() ?? '');

  const attackDraft = (name: string) => ({
    id: null,
    localKey: createDraftKey('attack'),
    name,
    harm: 1,
    description: '',
    weaponTagIds: [] as string[],
  });

  async function openRemovalDialog(overrides: Partial<MinionDraft> = {}): Promise<void> {
    await showRoster(['Cultist'], overrides);
    buttonNamed('Remove Cultist').click();
    await settle();
  }

  it('5a-M2/(A1-minion): a never-saved minion offers Cancel · Remove, and says nothing is on the server', async () => {
    await openRemovalDialog({ attacks: [attackDraft('Bite'), attackDraft('Claw')] });

    expect(dialogButtonNames()).toEqual(['Cancel', 'Remove']);
    expect(dialogText()).toContain("This minion hasn't been saved yet. Removing it discards what you typed, including:");
    expect(dialogText()).toContain('2 attacks');
    // Nothing is destroyed, so there is no permanence warning to give.
    expect(dialogText()).not.toContain('will be deleted');
  });

  it('(A1-minion) with nothing attached drops the trailing clause rather than promising an empty list', async () => {
    await openRemovalDialog();

    expect(dialogText()).toContain("This minion hasn't been saved yet. Removing it discards what you typed.");
    expect(dialogText()).not.toContain('including:');
  });

  it('5a-M2/(E): a persisted minion offers Cancel · Delete — and never a Detach, which it has nothing to detach from', async () => {
    await openRemovalDialog({ id: 'minion-1', attacks: [attackDraft('Bite')] });

    // The whole of 5a-M2: two buttons, and the middle one the other three collections get is absent
    // under every draft state, because a minion has no mystery membership.
    expect(dialogButtonNames()).toEqual(['Cancel', 'Delete']);
    expect(dialogButtonNames()).not.toContain('Detach');
    // The title still says Remove: the user's action is removing it from the roster, and the button
    // names the consequence. Same split as variants (B)/(C).
    expect(dialogText()).toContain('Remove "Cultist"?');
    expect(dialogText()).toContain('Deleting it also removes:');
    expect(dialogText()).toContain('1 attack');
    // Derived from deferredChangeTail(), not written out — phase 1 is never last today, and this
    // feature is reordering the phases.
    expect(dialogText()).toContain('The minion will be deleted when you continue to the next step.');
  });

  it('(E) with no sub-resources is title plus footnote, with no invented filler', async () => {
    await openRemovalDialog({ id: 'minion-1' });

    expect(dialogButtonNames()).toEqual(['Cancel', 'Delete']);
    expect(dialogText()).toContain('Remove "Cultist"?');
    expect(dialogText()).toContain('The minion will be deleted when you continue to the next step.');
    expect(dialogText()).not.toContain('Deleting it also removes');
    expect(dialogText()).not.toContain("hasn't been saved");
  });

  it('5a-M3: the counts come from the card being removed, never from the composer', async () => {
    // The composer holds a *different* minion's attacks. §15.1's defect shape: a summary and its
    // detail must come from one source, not two that usually agree.
    store.minionAttacks.set([attackDraft('Not This One'), attackDraft('Nor This')]);

    await openRemovalDialog({ id: 'minion-1', powers: [{ id: null, localKey: createDraftKey('trait'), name: 'Keening', description: '' }] });

    expect(dialogText()).toContain('1 power');
    expect(dialogText()).not.toContain('attack');
  });

  // -------------------------------------------------------------------------------------------
  // 4. What a screen reader is given — and what it is not
  // -------------------------------------------------------------------------------------------

  it('labels the dialog by its title and describes it by both lists, with ids unique to the instance', async () => {
    await showRoster(['Cultist'], { id: 'minion-1', attacks: [{ id: null, localKey: createDraftKey('attack'), name: 'Bite', harm: 1, description: '', weaponTagIds: [] }] });
    buttonNamed('Remove Cultist').click();
    await settle();

    const labelId = dialog()!.getAttribute('aria-labelledby')!;
    const describedId = dialog()!.getAttribute('aria-describedby')!;

    expect(dialog()!.getAttribute('role')).toBe('dialog');
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    expect(labelId).not.toBe('modal-title');
    expect(labelId).not.toBe(describedId);
    expect(document.querySelectorAll(`#${labelId}`)).toHaveLength(1);
    expect(document.querySelectorAll(`#${describedId}`)).toHaveLength(1);

    const label = document.getElementById(labelId)!;
    const described = document.getElementById(describedId)!;
    expect(label.textContent).toContain('Remove "Cultist"?');
    // Everything the user must weigh is inside the described region, not just the title.
    // Variant (E): the persisted cascade lead-in, not the never-saved one (UX §16.4).
    expect(described.textContent).toContain('Deleting it also removes:');
    expect(described.textContent).toContain('1 attack');
    expect(described.textContent).toContain('The minion will be deleted when you continue');
  });

  it('CHARACTERISED GAP: a save, an add and a removal are all silent — there is no status region', async () => {
    await showRoster(['Cultist', 'Thrall']);

    // Rosalina §8 item 2 asks for one visually-hidden polite status region per phase, written on
    // save / attach / remove ("Sheriff Dalton removed."). She flags it as a live defect; the
    // architecture doc's §8.6 names only three defects and this is not one of them, so it is **not
    // in Phase 3's scope** and its absence is not a regression. Recorded because the brief asks for
    // a screen-reader pass on the roster, and this is the honest answer to it: the roster's
    // mutations produce no announcement at all.
    expect(element.querySelectorAll('[aria-live]')).toHaveLength(0);
    expect(element.querySelectorAll('[role="status"]')).toHaveLength(0);

    buttonNamed('Remove Thrall').click();
    await settle();
    dialogButtons()[dialogButtons().length - 1].click();
    await settle();

    expect(store.minionDrafts().map((d) => d.name)).toEqual(['Cultist']);
    // The only feedback is a card disappearing, which a screen reader does not narrate.
    expect(element.querySelectorAll('[aria-live]')).toHaveLength(0);
  });

  it('CHARACTERISED GAP: the composer is not a labelled group, so its heading is only a visual caption', async () => {
    await showRoster(['Cultist']);
    buttonNamed('Edit Cultist').click();
    await settle();

    // Rosalina §8 item 3 asks for `role="group"` + `aria-labelledby` pointing at the composer
    // heading, so "Editing “Cultist”" is part of every contained field's context. Also outside the
    // three §8.6 defects and therefore outside Phase 3. The mode is announced *once*, when the
    // heading takes focus, and not thereafter.
    const panel = composer()!;
    expect(panel.getAttribute('role')).toBeNull();
    expect(panel.getAttribute('aria-labelledby')).toBeNull();
    expect(composerHeading().id).toBe('');
  });
});
