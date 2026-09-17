import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { HunterService } from '../../../../core/hunter';
import { HunterDetailResponse, UpsertHunterRequest } from '../../../../core/models';
import { PlaybookService } from '../../../../core/playbook';
import { HunterDraft } from '../../shared/hunter-draft';
import {
  killsJournal,
  networkSection,
  playbookList,
  playbooksById,
  rotesSection,
} from '../../shared/testing/characterisation-playbooks';
import { HunterCreateComponent } from './hunter-create';
import { HunterCreateStore } from './hunter-create.store';

/**
 * Characterisation spec for the request the Hunter creation wizard sends (hunter-creation-wizard.md
 * 13.15 item 1; Phase 7, L17).
 *
 * These five cases were the create-page cases of `shared/hunter-form/hunter-form.characterisation.spec.ts`,
 * written against the single-page create at efd5309 and run green there first. When create mode was
 * retired from `HunterFormComponent`, they moved here with their titles and expected literals unchanged.
 * Only how a request is obtained changed, which that spec's own rule allows:
 * - the page is the wizard, and a playbook is chosen through its picker control;
 * - the request is what `HunterCreateStore.create()` hands to `HunterService.create`, checked to be
 *   exactly `HunterDraft.toRequest()`, as the form's emitted request was;
 * - in the rendered case, the player walks the wizard's steps. The wizard shows Luck and extra tracks
 *   read-only (step 3), so those two writes go through the draft, with the same values the old inputs set;
 * - in the prune case, the wizard asks before switching a playbook with picks in place (F7, L13), so the
 *   case confirms the switch. Confirm is the prune, so the expected request is unchanged.
 */

/** What the server returns; only `name` and `outstanding` are read, by the toast. */
const createdHunter = { id: 'h-new', name: 'Created', outstanding: [] } as unknown as HunterDetailResponse;

describe('HunterCreateComponent request characterisation (13.15 item 1)', () => {
  let fixture: ComponentFixture<HunterCreateComponent>;
  let store: HunterCreateStore;
  let draft: HunterDraft;
  let posted: UpsertHunterRequest[];

  beforeEach(async () => {
    posted = [];
    await TestBed.configureTestingModule({
      imports: [HunterCreateComponent],
      providers: [
        provideRouter([]),
        { provide: PlaybookService, useValue: { getAll: () => of(playbookList), getById: (id: string) => of(playbooksById[id]) } },
        {
          provide: HunterService,
          useValue: {
            create: (request: UpsertHunterRequest) => {
              posted.push(request);
              return of(createdHunter);
            },
            // The wizard checks on every step change (F6); the check never changes a request.
            evaluate: () => of({ refusal: null, outstanding: [] }),
          },
        },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  /** The create page: the wizard, with its own draft and store. */
  function createCreatePage(): void {
    fixture = TestBed.createComponent(HunterCreateComponent);
    store = fixture.debugElement.injector.get(HunterCreateStore);
    draft = fixture.debugElement.injector.get(HunterDraft);
    fixture.detectChanges();
  }

  function choosePlaybook(playbookId: string): void {
    store.playbookPicker.setValue(playbookId);
    fixture.detectChanges();
  }

  /**
   * Creates once and returns the request. It must be exactly `HunterDraft.toRequest()`, as the form's
   * emitted request had to be.
   */
  function submitAndCapture(): UpsertHunterRequest {
    posted.length = 0;
    store.create();
    expect(posted).toHaveLength(1);
    const fromDraft = draft.toRequest();
    expect(posted[0]).toStrictEqual(fromDraft);
    return fromDraft;
  }

  it('create page: a minimal hunter sends nulls and empty lists, never undefined', () => {
    createCreatePage();
    choosePlaybook('pb-char');
    draft.form.controls.name.setValue('Minimal');
    draft.form.controls.pronouns.setValue('   ');

    expect(submitAndCapture()).toStrictEqual({
      name: 'Minimal',
      pronouns: null,
      playbookId: 'pb-char',
      playbookStatArrayOptionId: null,
      luck: 0,
      harm: 0,
      experience: 0,
      background: null,
      playbookMoveIds: [],
      playbookGearOptionIds: [],
      looks: [],
      extraTracks: [],
      bespokeSelections: [],
      bespokeInstances: [],
      journalEntries: [],
    } satisfies UpsertHunterRequest);
  });

  it('create page: a fully populated hunter', () => {
    createCreatePage();
    choosePlaybook('pb-char');
    const controls = draft.form.controls;

    // Scalars: free text is trimmed.
    controls.name.setValue('  Dana Scully  ');
    controls.pronouns.setValue('  she/her ');
    controls.playbookStatArrayOptionId.setValue('sa-2');
    controls.luck.setValue(3);
    controls.harm.setValue(2);
    controls.experience.setValue(4);
    controls.background.setValue('  Grew up on a naval base.  ');

    // Moves: ticked in order; Move C ticked then unticked. The Required move is never toggled.
    draft.toggleMove('mv-a');
    draft.toggleMove('mv-b');
    draft.toggleMove('mv-c');
    draft.toggleMove('mv-c');

    // Gear: two weapons and the optional extra. Granted gear has no toggle.
    draft.toggleGear('go-shotgun');
    draft.toggleGear('go-pistol');
    draft.toggleGear('go-kit');

    // Looks.
    draft.setLookOption('lc-face', 'lo-face-haggard');
    draft.setLookFreeform('lc-clothes', '  a borrowed coat ');
    draft.setLookFreeform('lc-eyes', 'tired');
    draft.setLookOption('lc-eyes', 'lo-eyes-cold'); // replaces the freeform, keeps its place
    draft.setLookOption('lc-hands', 'lo-hands-scarred');
    draft.setLookOption('lc-hands', 'lo-hands-scarred'); // clicked again: cleared
    draft.setLookFreeform('lc-hands', 'scar');
    draft.setLookFreeform('lc-hands', '   '); // whitespace: cleared

    // Extra tracks: clamped to the box count; unparseable becomes 0.
    draft.setTrackValue('tr-corruption', '9', 6);
    draft.setTrackValue('tr-glory', 'abc', 3);

    // Playbook-level bespoke: a nested leaf, and numeric leaves.
    draft.toggleBespoke('bs-fate', 'leaf-doom-forgotten');
    draft.toggleBespoke('bs-fate', 'bo-favour'); // starts at its NumericMax, 3
    draft.toggleBespoke('bs-fate', 'bo-debt'); // starts at 4 ...
    draft.setBespokeAnswer('bs-fate', { optionId: 'bo-debt', field: 'numeric', value: '2' }); // ... set to 2
    draft.toggleBespoke('bs-fate', 'bo-marks'); // starts at 5 ...
    draft.setBespokeAnswer('bs-fate', { optionId: 'bo-marks', field: 'numeric', value: '' }); // ... input cleared
    // An answer against an option that is not ticked is never sent.
    draft.setBespokeAnswer('bs-fate', { optionId: 'leaf-doom-betrayed', field: 'text', value: 'orphan' });
    draft.setFreeText('bs-notes', '  Owes the Keeper a favour.  ');

    // Move-internal bespoke: under the Required move, and under a picked move.
    draft.setFreeText('bs-req-encounter', '  The lights went out.  ');
    draft.toggleBespoke('bs-mva-artifact', 'bo-artifact-blade');
    draft.setBespokeAnswer('bs-mva-artifact', { optionId: 'bo-artifact-blade', field: 'title', value: '  Silver  ' });

    // Repeatable entries, across two sections, with one removed from the middle.
    draft.addInstance(rotesSection);
    const rote1 = draft.instancesFor(rotesSection).at(-1)!;
    draft.addInstance(rotesSection);
    const temp = draft.instancesFor(rotesSection).at(-1)!;
    draft.addInstance(networkSection);
    const contact = draft.instancesFor(networkSection).at(-1)!;
    draft.addInstance(rotesSection);
    const rote2 = draft.instancesFor(rotesSection).at(-1)!;

    draft.setInstanceName(rote1.key, '  Ward  ');
    draft.toggleBespoke(rote1.key, 'leaf-req-words');
    draft.toggleBespoke(rote1.key, 'rote-named');
    draft.setBespokeAnswer(rote1.key, { optionId: 'rote-named', field: 'title', value: '  Circle of salt ' });

    draft.toggleBespoke(temp.key, 'leaf-req-gestures');
    draft.removeInstance(temp.key);

    draft.setInstanceName(contact.key, 'Frohike');
    draft.setFreeText(contact.key, '  Knows a guy  ');
    draft.toggleBespoke(contact.key, 'bo-net-favour');
    draft.setBespokeAnswer(contact.key, { optionId: 'bo-net-favour', field: 'text', value: '   ' });

    draft.setInstanceName(rote2.key, '   ');
    draft.toggleBespoke(rote2.key, 'leaf-req-words'); // same option as rote1, its own scope
    draft.toggleBespoke(rote2.key, 'leaf-req-gestures');

    // Journal entries: fields in typed order, blanks dropped, an all-blank entry still sent.
    draft.addJournalEntry(killsJournal);
    draft.addJournalEntry(killsJournal);
    const [entry1, entry2] = draft.entriesFor(killsJournal);
    draft.setJournalField(entry1.key, 'jf-where', '  The docks ');
    draft.setJournalField(entry1.key, 'jf-what', 'A ghoul');
    draft.setJournalField(entry2.key, 'jf-what', '   ');

    fixture.detectChanges();

    expect(submitAndCapture()).toStrictEqual({
      name: 'Dana Scully',
      pronouns: 'she/her',
      playbookId: 'pb-char',
      playbookStatArrayOptionId: 'sa-2',
      luck: 3,
      harm: 2,
      experience: 4,
      background: 'Grew up on a naval base.',
      // Create mode never adds the Required move's id; the server adds it.
      playbookMoveIds: ['mv-a', 'mv-b'],
      playbookGearOptionIds: ['go-shotgun', 'go-pistol', 'go-kit'],
      looks: [
        { lookCategoryId: 'lc-face', lookOptionId: 'lo-face-haggard', freeformText: null },
        { lookCategoryId: 'lc-clothes', lookOptionId: null, freeformText: 'a borrowed coat' },
        { lookCategoryId: 'lc-eyes', lookOptionId: 'lo-eyes-cold', freeformText: null },
      ],
      extraTracks: [
        { extraTrackId: 'tr-corruption', currentValue: 6 },
        { extraTrackId: 'tr-glory', currentValue: 0 },
      ],
      bespokeSelections: [
        { sectionId: 'bs-fate', bespokeOptionId: 'leaf-doom-forgotten', freeformTitle: null, freeformText: null, numericValue: null },
        { sectionId: 'bs-fate', bespokeOptionId: 'bo-favour', freeformTitle: null, freeformText: null, numericValue: 3 },
        { sectionId: 'bs-fate', bespokeOptionId: 'bo-debt', freeformTitle: null, freeformText: null, numericValue: 2 },
        { sectionId: 'bs-fate', bespokeOptionId: 'bo-marks', freeformTitle: null, freeformText: null, numericValue: null },
        { sectionId: 'bs-notes', bespokeOptionId: null, freeformTitle: null, freeformText: 'Owes the Keeper a favour.', numericValue: null },
        { sectionId: 'bs-req-encounter', bespokeOptionId: null, freeformTitle: null, freeformText: 'The lights went out.', numericValue: null },
        { sectionId: 'bs-mva-artifact', bespokeOptionId: 'bo-artifact-blade', freeformTitle: 'Silver', freeformText: null, numericValue: null },
      ],
      bespokeInstances: [
        {
          id: null,
          sectionId: 'bs-rotes',
          name: 'Ward',
          sortOrder: 0,
          selections: [
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-words', freeformTitle: null, freeformText: null, numericValue: null },
            { sectionId: 'bs-rotes', bespokeOptionId: 'rote-named', freeformTitle: 'Circle of salt', freeformText: null, numericValue: null },
          ],
        },
        {
          id: null,
          sectionId: 'bs-mvb-network',
          name: 'Frohike',
          sortOrder: 1,
          selections: [
            { sectionId: 'bs-mvb-network', bespokeOptionId: null, freeformTitle: null, freeformText: 'Knows a guy', numericValue: null },
            { sectionId: 'bs-mvb-network', bespokeOptionId: 'bo-net-favour', freeformTitle: null, freeformText: null, numericValue: null },
          ],
        },
        {
          id: null,
          sectionId: 'bs-rotes',
          name: null,
          sortOrder: 2,
          selections: [
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-words', freeformTitle: null, freeformText: null, numericValue: null },
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-gestures', freeformTitle: null, freeformText: null, numericValue: null },
          ],
        },
      ],
      journalEntries: [
        {
          id: null,
          journalId: 'j-kills',
          sortOrder: 0,
          fields: [
            { journalFieldId: 'jf-where', text: 'The docks' },
            { journalFieldId: 'jf-what', text: 'A ghoul' },
          ],
        },
        { id: null, journalId: 'j-kills', sortOrder: 1, fields: [] },
      ],
    } satisfies UpsertHunterRequest);
  });

  it('create page: the same request when the player fills it in through the rendered form', async () => {
    createCreatePage();
    choosePlaybook('pb-char');
    const element = fixture.nativeElement as HTMLElement;

    const type = (input: HTMLInputElement, value: string): void => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const click = (target: HTMLElement): void => {
      target.click();
      fixture.detectChanges();
    };
    const checkboxLabelled = (text: string): HTMLInputElement =>
      Array.from(element.querySelectorAll('label'))
        .find((label) => label.textContent?.includes(text) && label.querySelector('input[type="checkbox"]'))!
        .querySelector('input[type="checkbox"]')!;
    const buttonNamed = (text: string): HTMLButtonElement =>
      Array.from(element.querySelectorAll('button')).find((button) => button.textContent?.trim() === text)!;
    const inputLabelled = (text: string): HTMLInputElement =>
      Array.from(element.querySelectorAll('label'))
        .find((label) => label.querySelector(':scope > span')?.textContent?.trim().startsWith(text))!
        .querySelector('input')!;
    const next = (): void => click(buttonNamed('Next →'));

    // Step 1.
    type(inputLabelled('Name'), '  Dana Scully ');
    next();
    // Step 2.
    click(element.querySelectorAll<HTMLInputElement>('input[type="radio"]')[0]);
    next();
    // Step 3 shows Luck and extra tracks read-only: the values the old inputs set go through the draft.
    expect(element.querySelector('input[type="number"]')).toBeNull();
    draft.form.controls.luck.setValue(2);
    draft.setTrackValue('tr-corruption', '4', 6);
    next();
    // Step 4: three Rules dots, left as they are.
    next();
    next();
    next();
    // Step 5.
    click(checkboxLabelled('Move A'));
    next();
    // Step 6.
    click(checkboxLabelled('Shotgun'));
    next();
    // Step 7.
    next();
    // Step 8.
    click(buttonNamed('haggard face'));
    type(buttonNamed('neat clothes').closest('div')!.querySelector('input[placeholder="or your own..."]')!, 'in a borrowed coat ');

    posted.length = 0;
    click(buttonNamed('Create Hunter'));
    await fixture.whenStable();

    expect(posted).toHaveLength(1);
    expect(posted[0]).toStrictEqual(draft.toRequest());
    expect(posted[0]).toStrictEqual({
      name: 'Dana Scully',
      pronouns: null,
      playbookId: 'pb-char',
      playbookStatArrayOptionId: 'sa-1',
      luck: 2,
      harm: 0,
      experience: 0,
      background: null,
      playbookMoveIds: ['mv-a'],
      playbookGearOptionIds: ['go-shotgun'],
      looks: [
        { lookCategoryId: 'lc-face', lookOptionId: 'lo-face-haggard', freeformText: null },
        { lookCategoryId: 'lc-clothes', lookOptionId: null, freeformText: 'in a borrowed coat' },
      ],
      extraTracks: [{ extraTrackId: 'tr-corruption', currentValue: 4 }],
      bespokeSelections: [],
      bespokeInstances: [],
      journalEntries: [],
    } satisfies UpsertHunterRequest);
  });

  it('untick clear: unticking a move drops its sections\' entries and answers; re-ticking starts empty', () => {
    createCreatePage();
    choosePlaybook('pb-char');
    draft.form.controls.name.setValue('Untick Tester');

    draft.toggleMove('mv-a');
    draft.toggleMove('mv-b');
    draft.toggleBespoke('bs-mva-artifact', 'bo-artifact-blade');
    draft.setBespokeAnswer('bs-mva-artifact', { optionId: 'bo-artifact-blade', field: 'title', value: 'Gold' });
    draft.addInstance(networkSection);
    const contact = draft.instancesFor(networkSection).at(-1)!;
    draft.setFreeText(contact.key, 'Byers');
    draft.toggleBespoke(contact.key, 'bo-net-favour');
    draft.addInstance(rotesSection);
    const rote = draft.instancesFor(rotesSection).at(-1)!;
    draft.toggleBespoke(rote.key, 'leaf-req-words');

    draft.toggleMove('mv-b');
    draft.toggleMove('mv-a');
    draft.toggleMove('mv-a');
    draft.toggleBespoke('bs-mva-artifact', 'bo-artifact-blade');
    fixture.detectChanges();

    expect(submitAndCapture()).toStrictEqual({
      name: 'Untick Tester',
      pronouns: null,
      playbookId: 'pb-char',
      playbookStatArrayOptionId: null,
      luck: 0,
      harm: 0,
      experience: 0,
      background: null,
      playbookMoveIds: ['mv-a'],
      playbookGearOptionIds: [],
      looks: [],
      extraTracks: [],
      bespokeSelections: [
        { sectionId: 'bs-mva-artifact', bespokeOptionId: 'bo-artifact-blade', freeformTitle: null, freeformText: null, numericValue: null },
      ],
      bespokeInstances: [
        {
          id: null,
          sectionId: 'bs-rotes',
          name: null,
          sortOrder: 0,
          selections: [
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-words', freeformTitle: null, freeformText: null, numericValue: null },
          ],
        },
      ],
      journalEntries: [],
    } satisfies UpsertHunterRequest);
  });

  it('prune: switching playbooks keeps only what the new playbook has, and every scalar but an invalid rating', () => {
    createCreatePage();
    choosePlaybook('pb-char');
    const controls = draft.form.controls;
    controls.name.setValue('Switcher');
    controls.pronouns.setValue('they/them');
    controls.background.setValue('Kept history');
    controls.playbookStatArrayOptionId.setValue('sa-1');
    controls.luck.setValue(1);

    draft.toggleMove('mv-a');
    draft.toggleMove('mv-b');
    draft.toggleGear('go-shotgun');
    draft.toggleGear('go-pistol');
    draft.setLookOption('lc-face', 'lo-face-haggard');
    draft.setLookFreeform('lc-clothes', 'a borrowed coat');
    draft.setTrackValue('tr-corruption', '3', 6);
    draft.setTrackValue('tr-glory', '2', 3);
    draft.toggleBespoke('bs-fate', 'bo-favour');
    draft.setFreeText('bs-notes', 'Kept note');
    draft.toggleBespoke('bs-mva-artifact', 'bo-artifact-blade');
    draft.setBespokeAnswer('bs-mva-artifact', { optionId: 'bo-artifact-blade', field: 'title', value: 'Gold' });
    draft.addInstance(networkSection);
    draft.setFreeText(draft.instancesFor(networkSection).at(-1)!.key, 'Langly');
    draft.addInstance(rotesSection);
    draft.toggleBespoke(draft.instancesFor(rotesSection).at(-1)!.key, 'leaf-req-words');
    draft.addJournalEntry(killsJournal);
    draft.setJournalField(draft.entriesFor(killsJournal).at(-1)!.key, 'jf-what', 'A ghoul');

    choosePlaybook('pb-other');
    // Picks are in place, so the wizard asks first (F7, L13); confirming is what prunes.
    expect(store.pendingSwitch()?.playbookId).toBe('pb-other');
    store.confirmSwitch();

    expect(submitAndCapture()).toStrictEqual({
      name: 'Switcher',
      pronouns: 'they/them',
      playbookId: 'pb-other',
      playbookStatArrayOptionId: null,
      luck: 1,
      harm: 0,
      experience: 0,
      background: 'Kept history',
      playbookMoveIds: ['mv-a'],
      playbookGearOptionIds: ['go-shotgun'],
      // Filtered by category id only: the option id is not checked against the new category.
      looks: [{ lookCategoryId: 'lc-face', lookOptionId: 'lo-face-haggard', freeformText: null }],
      extraTracks: [{ extraTrackId: 'tr-corruption', currentValue: 3 }],
      bespokeSelections: [
        { sectionId: 'bs-notes', bespokeOptionId: null, freeformTitle: null, freeformText: 'Kept note', numericValue: null },
        { sectionId: 'bs-mva-artifact', bespokeOptionId: 'bo-artifact-blade', freeformTitle: 'Gold', freeformText: null, numericValue: null },
      ],
      bespokeInstances: [],
      journalEntries: [],
    } satisfies UpsertHunterRequest);
  });
});
