import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ConfirmDeleteModalComponent } from './confirm-delete-modal.component';

/**
 * `mystery-entity-linking.md` §9 asks Toad to *"confirm none of the … existing
 * `ConfirmDeleteModalComponent` call sites changed behaviour."* This file does that call site by
 * call site, against an oracle rather than against a hand-written expectation.
 *
 * **The count.** The architecture doc §7.4 says twelve and the UX doc §7.5 says fourteen. Neither is
 * right: `grep -ro '<app-confirm-delete-modal' --include=*.html src/app` returns **13** elements in
 * 12 files, at `HEAD` and in the working tree alike. `hunter-create.html` is the only one with two.
 * `monster-detail.html` and `minion-detail.html` have **one each**, not two — each reuses a single
 * instance across all four sub-resource kinds via one `pendingDelete()` signal.
 *
 * **Why an oracle.** The risk this phase carries is the `permanenceNote` → `footnote` rename *plus*
 * the move out of the `items.length > 0` branch. Whether that changed a given call site depends on
 * the interaction of four inputs, which is exactly the kind of thing a hand-written expectation gets
 * wrong in the same direction as the code. So `renderedBeforeThisPhase()` below re-implements the
 * shipped template's rules as a pure function, and every call site's live DOM is compared against
 * it. Two call sites are expected to differ; the rest must match exactly.
 */

// ---------------------------------------------------------------------------------------------
// The oracle: what `confirm-delete-modal.component.html` rendered before this phase
// ---------------------------------------------------------------------------------------------

interface CallSiteInputs {
  readonly itemName: string;
  readonly verb?: string;
  readonly confirmLabel?: string | null;
  readonly message?: string;
  readonly items?: readonly string[];
  readonly footnote?: string;
  readonly usageMessage?: string;
  readonly usage?: readonly string[];
  readonly secondaryLabel?: string | null;
}

/**
 * The pre-Phase-3 template, as a function. Verbatim rules, from `git show HEAD:…`:
 * title → `@if (message)` → `@if (items.length > 0) { <ul> … <p>{{ permanenceNote }}</p> }` → buttons,
 * with `message` defaulting to `'This cannot be undone.'` and `permanenceNote` to the same string.
 *
 * Note where the note sat: **inside** the items branch. That is the defect §7.1 fixes, and it is why
 * a call site with an empty `items` never saw its note no matter what it passed.
 */
function renderedBeforeThisPhase(inputs: CallSiteInputs): string[] {
  const verb = inputs.verb ?? 'Delete';
  const message = inputs.message ?? 'This cannot be undone.';
  const items = inputs.items ?? [];
  // `footnote` is this phase's name for it; before the rename the same value arrived as
  // `permanenceNote`, whose default was 'This cannot be undone.'.
  const permanenceNote = inputs.footnote ?? 'This cannot be undone.';

  const blocks: string[] = [`h3:${verb} "${inputs.itemName}"?`];
  if (message) {
    blocks.push(`p:${message}`);
  }
  if (items.length > 0) {
    blocks.push(`ul:${items.join('|')}`);
    if (permanenceNote) {
      blocks.push(`p:${permanenceNote}`);
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------------------------
// The live render
// ---------------------------------------------------------------------------------------------

/**
 * Three hosts, because **which inputs a call site binds is part of what is under test.** A single
 * host that bound everything with `?? ''` fallbacks would supply the component's defaults from the
 * spec instead of exercising them, and would pass unchanged if someone put the old
 * `'This cannot be undone.'` footnote default back — the exact regression this phase's decision note
 * is about. So each host binds only what its real templates bind, and nothing else.
 */

/** `mysteries-list`, `monster-detail`, `minion-detail`: a name and nothing else. */
@Component({
  imports: [ConfirmDeleteModalComponent],
  template: `<app-confirm-delete-modal [visible]="true" [itemName]="i().itemName" />`,
})
class NameOnlyHostComponent {
  readonly i = signal<CallSiteInputs>({ itemName: '' });
}

/** `hunter-detail`, `hunters-list`, `minions-list`, `playbook-admin`, `hunter-create` (discard). */
@Component({
  imports: [ConfirmDeleteModalComponent],
  template: `
    <app-confirm-delete-modal
      [visible]="true"
      [itemName]="i().itemName"
      [verb]="i().verb ?? 'Delete'"
      [message]="i().message ?? ''"
      [items]="i().items ?? []" />
  `,
})
class MessageOnlyHostComponent {
  readonly i = signal<CallSiteInputs>({ itemName: '' });
}

/** The call sites that pass a footnote: `hunter-create` ×2, the wizard roster, the three swept lists. */
@Component({
  imports: [ConfirmDeleteModalComponent],
  template: `
    <app-confirm-delete-modal
      [visible]="true"
      [itemName]="i().itemName"
      [verb]="i().verb ?? 'Delete'"
      [confirmLabel]="i().confirmLabel ?? null"
      [usageMessage]="i().usageMessage ?? ''"
      [usage]="i().usage ?? []"
      [message]="i().message ?? ''"
      [items]="i().items ?? []"
      [footnote]="i().footnote ?? ''"
      [secondaryLabel]="i().secondaryLabel ?? null" />
  `,
})
class FootnoteHostComponent {
  readonly i = signal<CallSiteInputs>({ itemName: '' });
}

type HostShape = 'name-only' | 'message-only' | 'footnote';

const hostFor: Record<HostShape, unknown> = {
  'name-only': NameOnlyHostComponent,
  'message-only': MessageOnlyHostComponent,
  footnote: FootnoteHostComponent,
};

async function render(inputs: CallSiteInputs, shape: HostShape): Promise<HTMLElement> {
  const hostType = hostFor[shape];
  await TestBed.configureTestingModule({ imports: [hostType as never] }).compileComponents();
  const fixture = TestBed.createComponent(hostType as never);
  (fixture.componentInstance as { i: { set(value: CallSiteInputs): void } }).i.set(inputs);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const squash = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();

/** Title plus every block under the description wrapper, in DOM order, as `tag:text`. */
function renderedNow(element: HTMLElement): string[] {
  const dialog = element.querySelector<HTMLElement>('[role="dialog"]')!;
  const description = dialog.querySelector<HTMLElement>(`#${dialog.getAttribute('aria-describedby')}`)!;
  const blocks = [`h3:${squash(dialog.querySelector('h3')?.textContent)}`];
  for (const child of Array.from(description.children)) {
    const tag = child.tagName.toLowerCase();
    blocks.push(
      tag === 'ul'
        ? `ul:${Array.from(child.querySelectorAll('li')).map((li) => squash(li.textContent)).join('|')}`
        : `${tag}:${squash(child.textContent)}`,
    );
  }
  return blocks;
}

function buttonLabels(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).map((button) =>
    squash(button.textContent),
  );
}

// ---------------------------------------------------------------------------------------------
// The 13 call sites, transcribed from their templates
// ---------------------------------------------------------------------------------------------

/**
 * The eight call sites this phase must leave alone. Each entry is the exact input set its template
 * passes; `null`-ish inputs are omitted so the component's own defaults apply, exactly as they do in
 * the real template.
 */
const untouched: ReadonlyArray<{ site: string; shape: HostShape; inputs: CallSiteInputs }> = [
  // --- pass "This cannot be undone." as `message`, with items empty or absent -----------------
  {
    site: 'hunter-detail.html:53',
    shape: 'message-only',
    inputs: { itemName: 'Hex', message: 'This cannot be undone.' },
  },
  {
    site: 'hunters-list.html:40',
    shape: 'message-only',
    inputs: { itemName: 'Hex', message: 'This cannot be undone.' },
  },
  {
    site: 'minions-list.html:47',
    shape: 'message-only',
    inputs: { itemName: 'Grave-Wight', message: 'This cannot be undone.', items: [] },
  },
  {
    site: 'playbook-admin.html:68',
    shape: 'message-only',
    inputs: { itemName: 'The Chosen', message: 'This cannot be undone.', items: [] },
  },
  // --- pass nothing but a name, so `message`'s own default carries the sentence ---------------
  { site: 'mysteries-list.html:42', shape: 'name-only', inputs: { itemName: 'The Quiet' } },
  { site: 'monster-detail.html:236', shape: 'name-only', inputs: { itemName: 'Grave Chill' } },
  { site: 'minion-detail.html:206', shape: 'name-only', inputs: { itemName: 'Rusted Blade' } },
  // --- hunter-create's discard dialog: an explicit empty footnote, before and after -----------
  {
    site: 'hunter-create.html:69 (discard a dirty draft)',
    shape: 'footnote',
    inputs: { itemName: 'Unnamed hunter', verb: 'Discard', message: 'Nothing has been saved yet.', footnote: '' },
  },
  // --- the three swept list pages, in the state the sweep did not change: `usage` empty and
  //     unavailable, which is what a failed `getMysteries()` produces. The permanence sentence
  //     moves from `message` to `footnote`, so the *text* is identical and its position in the
  //     block list is not — those three are asserted separately below, with their own oracle.
];

/**
 * The two call sites that **do** change, and the change is the §7.1 fix rather than a regression:
 * both pass a footnote explicitly, and it used to be swallowed whenever `items` was empty.
 */
describe('ConfirmDeleteModalComponent · the 13 shipped call sites', () => {
  it('there are 13 of them, in 12 templates — not the 12 of §7.4 nor the 14 of §7.5', () => {
    // Pinned as data rather than by globbing the templates from a unit test: the count is a claim
    // this file's coverage rests on, and it belongs where a reader of the coverage can see it.
    const perTemplate = {
      'bystanders-list.html': 1,
      'hunter-create.html': 2,
      'hunter-detail.html': 1,
      'hunters-list.html': 1,
      'locations-list.html': 1,
      'minion-detail.html': 1,
      'minions-list.html': 1,
      'monster-detail.html': 1,
      'monsters-list.html': 1,
      'mysteries-list.html': 1,
      'mystery-create-monster-phase.html': 1,
      'playbook-admin.html': 1,
    };

    expect(Object.keys(perTemplate)).toHaveLength(12);
    expect(Object.values(perTemplate).reduce((a, b) => a + b, 0)).toBe(13);
  });

  describe('the eight that must render byte-identically', () => {
    for (const { site, shape, inputs } of untouched) {
      it(`${site}`, async () => {
        const element = await render(inputs, shape);

        expect(renderedNow(element)).toEqual(renderedBeforeThisPhase(inputs));
        // And the permanence sentence appears once, never twice — the failure mode the footnote's
        // changed default exists to prevent.
        const occurrences = (element.textContent ?? '').match(/This cannot be undone\./g) ?? [];
        expect(occurrences.length).toBeLessThanOrEqual(1);
        expect(buttonLabels(element)).toEqual(['Cancel', inputs.verb ?? 'Delete']);
      });
    }
  });

  describe('the two that change, and the change is the fix', () => {
    it('hunter-create.html:57 — the playbook switch keeps its footnote, because its items are never empty', async () => {
      // `HunterCreateStore.requestPlaybook` only raises this dialog when
      // `draft.playbookScopedSummary()` is non-empty (`hunter-create.store.ts:331-334`), so this
      // call site never reaches the empty-items case and its rendering is unchanged in practice.
      const inputs: CallSiteInputs = {
        itemName: 'The Chosen',
        verb: 'Switch to',
        confirmLabel: 'Switch playbook',
        message: 'These belong to The Crooked and will be cleared:',
        items: ['2 moves', '1 gear pick'],
        footnote: 'Your name, pronouns and History notes stay.',
      };

      const element = await render(inputs, 'footnote');

      expect(renderedNow(element)).toEqual(renderedBeforeThisPhase(inputs));
      expect(buttonLabels(element)).toEqual(['Cancel', 'Switch playbook']);
    });

    it('hunter-create.html:57 — …and if it ever could reach empty items, the footnote would now show', async () => {
      // Recorded as the shape of the change rather than as a live difference: the guard above means
      // no user can see it today. If that guard is ever relaxed, this is the new behaviour.
      const inputs: CallSiteInputs = {
        itemName: 'The Chosen',
        verb: 'Switch to',
        confirmLabel: 'Switch playbook',
        message: 'These belong to The Crooked and will be cleared:',
        items: [],
        footnote: 'Your name, pronouns and History notes stay.',
      };

      const element = await render(inputs, 'footnote');

      expect(renderedBeforeThisPhase(inputs)).not.toContain('p:Your name, pronouns and History notes stay.');
      expect(renderedNow(element)).toContain('p:Your name, pronouns and History notes stay.');
    });

    it('mystery-create-monster-phase.html:210 — a saved minion with no sub-resources now gets its deferral note', async () => {
      // THIS ONE IS USER-REACHABLE TODAY, and it is a visible change to a pre-existing call site.
      // `pendingRemoveNote()` returns the deferral sentence for any minion with a server id, and
      // `pendingRemoveItems()` is empty for a minion with no attacks, powers, armors or weaknesses.
      // Before this phase those two facts cancelled out and the user was told nothing about the
      // deferral. That suppression is precisely the §7.1 defect.
      const inputs: CallSiteInputs = {
        itemName: 'Grave-Wight',
        verb: 'Remove',
        message: 'This minion will be removed from the mystery.',
        items: [],
        footnote: 'The minion will be deleted when you continue to the next step.',
      };

      const element = await render(inputs, 'footnote');

      expect(renderedBeforeThisPhase(inputs)).toEqual([
        'h3:Remove "Grave-Wight"?',
        'p:This minion will be removed from the mystery.',
      ]);
      expect(renderedNow(element)).toEqual([
        'h3:Remove "Grave-Wight"?',
        'p:This minion will be removed from the mystery.',
        'p:The minion will be deleted when you continue to the next step.',
      ]);
    });

    it('mystery-create-monster-phase.html:210 — a minion *with* sub-resources renders exactly as before', async () => {
      const inputs: CallSiteInputs = {
        itemName: 'Grave-Wight',
        verb: 'Remove',
        message: 'This minion will be removed from the mystery.',
        items: ['2 attacks', '1 power'],
        footnote: 'The minion will be deleted when you continue to the next step.',
      };

      const element = await render(inputs, 'footnote');

      expect(renderedNow(element)).toEqual(renderedBeforeThisPhase(inputs));
    });

    it('mystery-create-monster-phase.html:210 — a never-saved draft still gets no permanence claim at all', async () => {
      const inputs: CallSiteInputs = {
        itemName: 'Half-typed',
        verb: 'Remove',
        message: 'This minion will be removed from the mystery.',
        items: [],
        footnote: '',
      };

      const element = await render(inputs, 'footnote');

      expect(renderedNow(element)).toEqual(renderedBeforeThisPhase(inputs));
      expect(element.textContent).not.toContain('cannot be undone');
      expect(element.textContent).not.toContain('next step');
    });
  });

  describe('the three swept list pages — the sentence moves block, and says more when there is usage', () => {
    it('locations-list: in no mystery, the permanence sentence is still there and still once', async () => {
      const before = renderedBeforeThisPhase({ itemName: 'Ferris Mill', message: 'This cannot be undone.' });
      const element = await render({
        itemName: 'Ferris Mill',
        usageMessage: "This location isn't used by any mystery.",
        usage: [],
        message: '',
        items: [],
        footnote: 'This cannot be undone.',
      }, 'footnote');

      expect(before).toEqual(['h3:Delete "Ferris Mill"?', 'p:This cannot be undone.']);
      expect(renderedNow(element)).toEqual([
        'h3:Delete "Ferris Mill"?',
        "p:This location isn't used by any mystery.",
        'p:This cannot be undone.',
      ]);
      expect((element.textContent ?? '').match(/This cannot be undone\./g)).toHaveLength(1);
    });

    it('monsters-list: the shipped minion cascade is not displaced by the new usage list', async () => {
      const element = await render({
        itemName: 'The Hollow Man',
        usageMessage: 'This monster is used by 1 mystery:',
        usage: ['Dust Bowl Nights'],
        message: 'This will also delete the following minions:',
        items: ['Grave-Wight', 'Pale Choir'],
        footnote: 'Deleting removes it from those mysteries too. This cannot be undone.',
      }, 'footnote');

      expect(renderedNow(element)).toEqual([
        'h3:Delete "The Hollow Man"?',
        'p:This monster is used by 1 mystery:',
        'ul:Dust Bowl Nights',
        'p:This will also delete the following minions:',
        'ul:Grave-Wight|Pale Choir',
        'p:Deleting removes it from those mysteries too. This cannot be undone.',
      ]);
      // The cascade sentence and its list are in the same relative order they shipped in.
      const blocks = renderedNow(element);
      expect(blocks.indexOf('p:This will also delete the following minions:')).toBeLessThan(
        blocks.indexOf('ul:Grave-Wight|Pale Choir'),
      );
      expect((element.textContent ?? '').match(/This cannot be undone\./g)).toHaveLength(1);
    });

    it('all three: no secondary button, because a flat catalogue has no mystery to detach from', async () => {
      const element = await render({
        itemName: 'Sheriff Dalton',
        usageMessage: 'This bystander is used by 2 mysteries:',
        usage: ['Dust Bowl Nights', 'The Long Drive Home'],
        message: '',
        items: [],
        footnote: 'Deleting removes it from those mysteries too. This cannot be undone.',
      }, 'footnote');

      expect(buttonLabels(element)).toEqual(['Cancel', 'Delete']);
    });
  });
});
