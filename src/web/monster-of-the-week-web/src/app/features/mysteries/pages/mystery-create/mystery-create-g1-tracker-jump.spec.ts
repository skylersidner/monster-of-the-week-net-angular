import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateComponent } from './mystery-create';

/**
 * **Peach's G1, driven the way she wrote it** — through the roster's trash icon, the modal's own
 * Delete button, the step tracker's Bystanders bubble and the footer's Finish button, with nothing
 * poked at the store directly.
 *
 * `mystery-create-phase4.store.spec.ts` asserts the same sequence by calling
 * `removeLocationDraft(key, 'delete')` and `jumpToPhase(3)`. That proves the disposition is
 * wizard-scoped, which is the mechanism — but it assumes the three things G1 is actually about: that
 * the trash icon raises the modal for the *right* card, that the modal's destructive button reaches
 * the `delete` disposition rather than a detach, and that the tracker bubble really is the
 * non-submitting `jumpToPhase` that created the hole. Every one of those is a wiring fact in a
 * template, and a template is exactly where this bug would come back.
 *
 * The one thing a jsdom test cannot show is what the `DELETE` does on the server. That half is
 * `MysteryMembershipVisibilityTests.D7_DeletingTheEntity_RemovesItFromEveryMysteryAndFromTheCatalogue`,
 * which drives the same route against a real Kestrel host and a real database. Here the catalogue is
 * a `Set` the fake service mutates, so "the location is actually gone" is at least asserted as a
 * state change rather than as a call.
 */
describe('G1 — a confirmed Delete survives an edit-mode tracker jump', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let sent: string[];
  /** The fake server's locations table. The delete actually removes the row. */
  let catalogue: Map<string, { id: string; name: string }>;
  let navigatedTo: unknown[] | null;

  const HYDRATED = {
    id: 'loc-hydrated',
    name: 'Ferris Mill',
    description: 'Rust and river damp.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    mysteryIds: ['mystery-1'],
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    sent = [];
    navigatedTo = null;
    catalogue = new Map([[HYDRATED.id, { id: HYDRATED.id, name: HYDRATED.name }]]);

    const locationService = {
      getAll: () => of([...catalogue.values()].map(() => ({ ...HYDRATED }))),
      getByMystery: () => of([{ ...HYDRATED }]),
      create: (...args: unknown[]) => {
        sent.push(`location.create(${args[0]})`);
        return of({ id: 'loc-created' });
      },
      update: (...args: unknown[]) => {
        sent.push(`location.update(${args[0]})`);
        return of({ id: args[0] });
      },
      linkToMystery: (...args: unknown[]) => {
        sent.push(`location.link(${args[0]},${args[1]})`);
        return of(undefined);
      },
      unlinkFromMystery: (...args: unknown[]) => {
        sent.push(`location.unlink(${args[0]},${args[1]})`);
        return of(undefined);
      },
      delete: (...args: unknown[]) => {
        sent.push(`location.delete(${args[0]})`);
        catalogue.delete(args[0] as string);
        return of(undefined);
      },
    };

    await TestBed.configureTestingModule({
      imports: [MysteryCreateComponent],
      providers: [
        // The route param is `id`, not `mysteryId` (`mystery-create.ts:66`) — get it wrong and the
        // wizard silently opens in *create* mode, where every Phase 4 assertion here is vacuous.
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'mystery-1']]) } } },
        { provide: Router, useValue: { navigate: (commands: unknown[]) => (navigatedTo = commands) } },
        { provide: NotificationService, useValue: { success: () => {} } },
        { provide: LocationService, useValue: locationService },
        {
          provide: BystanderService,
          useValue: {
            // Non-empty, so A1's "the strip appears on the Bystanders step too" is observable
            // rather than indistinguishable from A3's empty-catalogue hide.
            getAll: () =>
              of([
                {
                  id: 'bys-catalogue',
                  name: 'Sheriff Dalton',
                  description: '',
                  bystanderTypeId: 'bystander-type-1',
                  bystanderTypeName: 'Witness',
                  bystanderTypeMotivation: '',
                  mysteryIds: [],
                  createdAt: '2026-01-01T00:00:00Z',
                },
              ]),
            getByMystery: () => of([]),
            create: () => of({ id: 'b' }),
            update: () => of({ id: 'b' }),
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
            delete: () => of(undefined),
          },
        },
        {
          provide: MysteryService,
          useValue: {
            getMystery: () =>
              of({
                id: 'mystery-1',
                name: 'The Hollow Choir',
                concept: '',
                hook: '',
                overview: '',
                adventureType: { id: 'adventure-type-1', name: 'Haunting' },
                countdown: null,
                customMoves: [],
              }),
            getMysteries: () => of([{ id: 'mystery-1', name: 'The Hollow Choir' }]),
            update: () => of({ id: 'mystery-1' }),
            upsertCountdown: () => of({ id: 'countdown-1' }),
          },
        },
        { provide: MonsterService, useValue: { getAll: () => of([]), getByMystery: () => of([]), create: () => of({ id: 'monster-1' }) } },
        { provide: MinionService, useValue: { getByMonster: () => of([]) } },
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([{ id: 'monster-archetype-1', name: 'Ghost', description: '' }]),
            getMonsterTypes: () => of([{ id: 'monster-type-1', name: 'Beast', motivation: '' }]),
            getMinionTypes: () => of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]),
            getLocationTypes: () => of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]),
            getBystanderTypes: () => of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]),
            getWeaponTags: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryCreateComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const query = <T extends HTMLElement>(selector: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));

  const text = (element: Element | null | undefined): string => (element?.textContent ?? '').trim();

  const trackerBubble = (index: number): HTMLButtonElement => query<HTMLButtonElement>('.phase-bubble')[index];

  const footerButton = (label: string): HTMLButtonElement =>
    query<HTMLButtonElement>('button').find((button) => text(button) === label)!;

  const dialogButtons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[role="dialog"] button'));

  function click(element: HTMLElement): void {
    element.click();
    fixture.detectChanges();
  }

  it('the location is gone after trash → Delete → tracker bubble → Finish, and the delete goes out once', async () => {
    // Edit an existing mystery → Locations step, reached the way the bug report says: the tracker.
    click(trackerBubble(2));
    expect(fixture.componentInstance.store.currentPhase()).toBe(2);
    expect(query('.roster-card').map((card) => text(card.querySelector('span')))).toEqual(['Ferris Mill']);

    // Trash the location.
    click(query<HTMLButtonElement>('[aria-label="Remove Ferris Mill"]')[0]);

    // It is a persisted membership, so the choice is the real one — and the destructive button
    // says Delete while the title still says Remove (§14.2b).
    expect(dialogButtons().map(text)).toEqual(['Cancel', 'Detach', 'Delete']);
    expect(text(fixture.nativeElement.querySelector('[role="dialog"] h3'))).toBe('Remove "Ferris Mill"?');

    // Confirm Delete. The card disappears and nothing is sent — decision 12.
    click(dialogButtons()[2]);
    expect(query('.roster-card')).toHaveLength(0);
    expect(sent).toEqual([]);
    expect(catalogue.has('loc-hydrated')).toBe(true);

    // Click the Bystanders bubble. This is the hole: `jumpToPhase` sets the phase and does not
    // submit, so a phase-scoped disposition would die right here, silently.
    click(trackerBubble(3));
    expect(fixture.componentInstance.store.currentPhase()).toBe(3);

    // Bystanders is the last phase, so the control says Finish, not Next.
    click(footerButton('Finish'));
    await fixture.whenStable();

    // The location is actually gone — not "a delete was called for it", gone from the fake
    // server's table — and the delete was issued exactly once.
    expect(sent).toEqual(['location.delete(loc-hydrated)']);
    expect(catalogue.has('loc-hydrated')).toBe(false);
    expect(fixture.componentInstance.store.pendingRemovals()).toEqual([]);
    expect(navigatedTo).toEqual(['/mysteries', 'mystery-1']);
  });

  it('A1: the attach strip is on both steps in **edit** mode, which no other spec opens', () => {
    // Every other Phase 4 component spec drives the wizard in create mode with the mystery id poked
    // in. A1 asks for both modes explicitly, and edit mode is the one that reaches the strip through
    // `loadEditData` + `loadAttachCatalogues` rather than `loadReferenceData`.
    click(trackerBubble(2));
    expect(fixture.nativeElement.querySelector('#attach-location')).not.toBeNull();

    click(trackerBubble(3));
    expect(fixture.nativeElement.querySelector('#attach-bystander')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#attach-location')).toBeNull();
  });

  it('Cancel on the same dialog leaves the card and records nothing (D4)', () => {
    click(trackerBubble(2));
    click(query<HTMLButtonElement>('[aria-label="Remove Ferris Mill"]')[0]);

    click(dialogButtons()[0]);

    expect(query('.roster-card')).toHaveLength(1);
    expect(fixture.componentInstance.store.pendingRemovals()).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('Detach on the same dialog reaches the unlink, not the delete (D6, through the template)', async () => {
    click(trackerBubble(2));
    click(query<HTMLButtonElement>('[aria-label="Remove Ferris Mill"]')[0]);

    // The secondary slot. Binding `(secondary)` to the delete disposition by mistake is a
    // one-character error with no other symptom, and this is the only assertion that sees it.
    click(dialogButtons()[1]);
    click(trackerBubble(3));
    click(footerButton('Finish'));
    await fixture.whenStable();

    expect(sent).toEqual(['location.unlink(mystery-1,loc-hydrated)']);
    expect(catalogue.has('loc-hydrated')).toBe(true);
  });
});
