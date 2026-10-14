import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomMoveCommit, CustomMoveRow, CustomMovesCardComponent } from './custom-moves-card.component';

/**
 * `app-custom-moves-card` — Phase 5a's shared component (architecture.md §28, §31.1).
 *
 * **The host binds signals, not plain fields, and that is not style.** This app is zoneless: setting
 * a plain host property and calling `detectChanges()` does **not** re-render, because only dirty
 * views refresh. Every input below is driven through a signal for that reason, which is also how a
 * real host page will bind them.
 */
@Component({
  imports: [CustomMovesCardComponent],
  template: `
    <app-custom-moves-card
      ownerType="Monster"
      [rows]="rows()"
      [(editingKey)]="editingKey"
      [busy]="busy()"
      [emptyText]="emptyText()"
      (committed)="commits.push($event)"
      (removeRequested)="removed.push($event)"
    />
  `,
})
class HostComponent {
  readonly rows = signal<CustomMoveRow[]>([]);
  readonly editingKey = signal<string | null>(null);
  readonly busy = signal(false);
  readonly emptyText = signal('No custom moves yet.');
  readonly commits: CustomMoveCommit[] = [];
  readonly removed: CustomMoveRow[] = [];
}

const ROWS: CustomMoveRow[] = [
  { key: 'm1', name: 'Reach Through', description: 'On a 10+, choose two.' },
  { key: 'm2', name: 'Whisper', description: null },
];

describe('CustomMovesCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  const all = (selector: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));
  const card = () => el('[data-custom-moves-card]')!;
  const input = (selector: string) => el(selector) as HTMLInputElement | HTMLTextAreaElement;

  function type(selector: string, value: string): void {
    const field = input(selector);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  describe('the shell', () => {
    it('wears the sibling article shell and renders its owner type for the Phase 6 guard', () => {
      expect(card().tagName).toBe('ARTICLE');
      expect(card().className).toContain('bg-surface');
      expect(card().className).toContain('border-default');
      // Rendered rather than merely held: the parity guard asserts this *before* normalising the
      // owner token away, which is the hole a control found in the images guard.
      expect(card().getAttribute('data-owner-type')).toBe('Monster');
    });

    it('caps the form and not the article, so the row list stays full width', () => {
      // §13.2's full-width argument collapses if this moves up to the article.
      expect(el('form')!.className).toContain('max-w-[42rem]');
      expect(card().className).not.toContain('max-w-');
    });

    it('gives the description textarea four rows and a vertical resize', () => {
      const textarea = input('[data-move-description]') as HTMLTextAreaElement;
      expect(textarea.getAttribute('rows')).toBe('4');
      expect(textarea.className).toContain('resize-y');
      // No cap: `Description` has no server-side length limit (B13).
      expect(textarea.hasAttribute('maxlength')).toBe(false);
    });

    it('caps the name at the contract length', () => {
      expect(input('[data-move-name]').getAttribute('maxlength')).toBe('255');
    });
  });

  describe('the empty state', () => {
    it('shows the host-supplied text and no second add button', () => {
      expect(el('[data-custom-moves-empty]')!.textContent!.trim()).toBe('No custom moves yet.');
      // The add form is permanently visible below, so one submit button is the whole surface.
      expect(all('[data-submit-move]')).toHaveLength(1);
      expect(all('li')).toHaveLength(0);
    });

    it('takes the create pages’ wording through the one input', () => {
      host.emptyText.set('No custom moves added yet.');
      fixture.detectChanges();

      expect(el('[data-custom-moves-empty]')!.textContent!.trim()).toBe('No custom moves added yet.');
    });
  });

  describe('rows', () => {
    beforeEach(() => {
      host.rows.set(ROWS);
      fixture.detectChanges();
    });

    it('renders a row per move, keyed for the focus restore', () => {
      const keys = all('li').map((li) => li.getAttribute('data-move-key'));
      expect(keys).toEqual(['m1', 'm2']);
      expect(el('[data-custom-moves-empty]')).toBeNull();
    });

    it('renders the description with pre-wrap, and omits the paragraph when there is none', () => {
      const paragraphs = all('li p');
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].textContent).toContain('On a 10+, choose two.');
      // The whole reason this type needs pre-wrap: roll outcomes sit on their own lines.
      expect(paragraphs[0].className).toContain('whitespace-pre-wrap');
    });

    it('keeps a long description from widening the row', () => {
      // `min-width: auto` on a flex item is this codebase's five-time trap, documented in styles.css.
      expect(el('li > div')!.className).toContain('min-w-0');
      expect(el('li > div:last-child')!.className).toContain('shrink-0');
    });

    it('names the move in both action labels, not just a bare verb', () => {
      expect(el('[data-move-key="m1"] [data-edit-move]')!.getAttribute('aria-label')).toBe('Edit Reach Through');
      expect(el('[data-move-key="m1"] [data-remove-move]')!.getAttribute('aria-label')).toBe('Remove Reach Through');
    });

    it('emits the whole row on remove, so a detail host has the name and a create host the key', () => {
      el('[data-move-key="m2"] [data-remove-move]')!.click();

      expect(host.removed).toEqual([ROWS[1]]);
    });
  });

  describe('adding', () => {
    it('emits a null key with trimmed values', () => {
      type('[data-move-name]', '  Reach Through  ');
      type('[data-move-description]', '  On a 10+.  ');
      el('[data-submit-move]')!.click();

      expect(host.commits).toEqual([{ key: null, name: 'Reach Through', description: 'On a 10+.' }]);
    });

    it('sends a blank description as null, matching the request contract', () => {
      type('[data-move-name]', 'Whisper');
      el('[data-submit-move]')!.click();

      expect(host.commits).toEqual([{ key: null, name: 'Whisper', description: null }]);
    });

    it('refuses an empty or whitespace-only name rather than letting the server store ""', () => {
      el('[data-submit-move]')!.click();
      type('[data-move-name]', '   ');
      el('[data-submit-move]')!.click();

      // `Validators.required` rejects '' but not '   ', and the server trims *after* validating —
      // so without this check a whitespace name persists as an empty string.
      expect(host.commits).toEqual([]);
    });
  });

  describe('editing', () => {
    beforeEach(() => {
      host.rows.set(ROWS);
      fixture.detectChanges();
    });

    it('asks the host through the two-way binding, and loads the row into the same form', () => {
      el('[data-move-key="m1"] [data-edit-move]')!.click();
      fixture.detectChanges();

      // The host's signal is what moved — there is no (editRequested) handler anywhere (L-D1).
      expect(host.editingKey()).toBe('m1');
      expect(input('[data-move-name]').value).toBe('Reach Through');
      expect(input('[data-move-description]').value).toBe('On a 10+, choose two.');
    });

    it('swaps the pencil for an Editing label on that row only, and marks the row', () => {
      host.editingKey.set('m1');
      fixture.detectChanges();

      expect(el('[data-move-key="m1"] [data-editing-label]')).not.toBeNull();
      expect(el('[data-move-key="m1"] [data-edit-move]')).toBeNull();
      expect(el('[data-move-key="m2"] [data-edit-move]')).not.toBeNull();
      expect(el('[data-move-key="m1"]')!.className).toContain('bg-accent-subtle');
    });

    it('retitles the form and its submit, and offers Cancel only while editing', () => {
      expect(el('[data-form-heading]')!.textContent!.trim()).toBe('Add a Custom Move');
      expect(el('[data-submit-move]')!.textContent!.trim()).toBe('Add Custom Move');
      expect(el('[data-cancel-edit]')).toBeNull();

      host.editingKey.set('m1');
      fixture.detectChanges();

      expect(el('[data-form-heading]')!.textContent).toContain('Editing');
      expect(el('[data-form-heading]')!.textContent).toContain('Reach Through');
      expect(el('[data-submit-move]')!.textContent!.trim()).toBe('Save Changes');
      expect(el('[data-cancel-edit]')).not.toBeNull();
    });

    it('emits the row key on commit, so the host knows to PUT rather than POST', () => {
      host.editingKey.set('m1');
      fixture.detectChanges();
      type('[data-move-name]', 'Reach Further');
      el('[data-submit-move]')!.click();

      expect(host.commits).toEqual([{ key: 'm1', name: 'Reach Further', description: 'On a 10+, choose two.' }]);
    });

    it('clears the editing key and the form on Cancel, discarding the edit', () => {
      host.editingKey.set('m1');
      fixture.detectChanges();
      type('[data-move-name]', 'Abandoned edit');

      el('[data-cancel-edit]')!.click();
      fixture.detectChanges();

      expect(host.editingKey()).toBeNull();
      expect(host.commits).toEqual([]);
      expect(input('[data-move-name]').value).toBe('');
      // The row is untouched — the card never mutates `rows`.
      expect(el('[data-move-key="m1"]')!.textContent).toContain('Reach Through');
    });

    it('only ever opens one row at a time', () => {
      host.editingKey.set('m1');
      fixture.detectChanges();
      el('[data-move-key="m2"] [data-edit-move]')!.click();
      fixture.detectChanges();

      expect(host.editingKey()).toBe('m2');
      expect(all('[data-editing-label]')).toHaveLength(1);
    });
  });

  describe('focus', () => {
    beforeEach(() => {
      host.rows.set(ROWS);
      fixture.detectChanges();
    });

    it('moves focus to the form heading on pencil activation', async () => {
      el('[data-move-key="m1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(el('[data-form-heading]'));
    });

    it('restores focus to that row’s pencil on Cancel — the button that did not exist yet', async () => {
      el('[data-move-key="m1"] [data-edit-move]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      el('[data-cancel-edit]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // L-R15: while editing, that pencil is replaced by the Editing label, so the restore target
      // is re-created only after this render. Resolved by [data-move-key], never a captured ref.
      expect(document.activeElement).toBe(el('[data-move-key="m1"] [data-edit-move]'));
    });

    /**
     * **The `track row.key` guard, and it took a negative control to get right** (14-R4).
     *
     * My first version of this file asserted the focus moves and the restore, and swapping
     * `track row.key` for `track $index` failed **none** of them — so 56 tests did not protect the
     * keying decision they were written alongside. Two things came out of chasing that:
     *
     *  - **14-R4's stated mechanism does not apply to this implementation.** It warns that the
     *    restore target is `isConnected` while belonging to a *different* row. That is true of a
     *    captured `ElementRef` or a positional lookup; `restoreFocusTo` resolves by
     *    `[data-move-key]`, which is a binding, so it cannot find the wrong move whatever the
     *    tracking strategy. That is a property worth keeping, not a reason to relax the keys.
     *  - **The real difference is node preservation, which is observable.** Under index tracking a
     *    shrinking list recycles nodes, destroying the one that holds focus; under key tracking the
     *    surviving row's node survives with its focus intact. A detail page hits exactly this on
     *    every refetch after a delete.
     */
    it('keeps focus on a surviving row’s control when the list shrinks — why track is by key', async () => {
      const pencil = el('[data-move-key="m2"] [data-edit-move]')!;
      pencil.focus();
      expect(document.activeElement).toBe(pencil);

      // What a detail page's post-delete refetch does: the same row, at a different index.
      host.rows.set([ROWS[1]]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(el('[data-move-key="m2"] [data-edit-move]'));
      expect(document.activeElement).not.toBe(document.body);
    });

    it('restores focus to the row’s pencil after the host reports a successful commit', async () => {
      el('[data-move-key="m2"] [data-edit-move]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const cardComponent = fixture.debugElement.children[0].componentInstance as CustomMovesCardComponent;
      cardComponent.commitSucceeded();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.editingKey()).toBeNull();
      expect(document.activeElement).toBe(el('[data-move-key="m2"] [data-edit-move]'));
    });
  });

  describe('busy', () => {
    it('disables every control while a mutation is in flight', () => {
      host.rows.set(ROWS);
      host.editingKey.set('m1');
      host.busy.set(true);
      fixture.detectChanges();

      const disabled = (selector: string) => (el(selector) as HTMLButtonElement).disabled;
      expect(disabled('[data-submit-move]')).toBe(true);
      expect(disabled('[data-cancel-edit]')).toBe(true);
      expect(disabled('[data-move-key="m2"] [data-edit-move]')).toBe(true);
      expect(disabled('[data-move-key="m1"] [data-remove-move]')).toBe(true);
    });

    it('re-enables them when it clears', () => {
      host.rows.set(ROWS);
      host.busy.set(true);
      fixture.detectChanges();
      host.busy.set(false);
      fixture.detectChanges();

      expect((el('[data-submit-move]') as HTMLButtonElement).disabled).toBe(false);
      expect((el('[data-move-key="m1"] [data-remove-move]') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('never calls a service — it has no injectable dependency beyond forms', () => {
    // The contract §28 rests on: immediate-versus-staged is the host's job, so this component is
    // testable with no HTTP layer at all. If this ever needs a service provider to render, the
    // presentational contract has been broken.
    expect(() => TestBed.createComponent(HostComponent)).not.toThrow();
  });
});
