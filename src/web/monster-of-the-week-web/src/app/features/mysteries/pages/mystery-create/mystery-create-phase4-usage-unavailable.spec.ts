import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { BystanderService } from '../../../../core/bystander';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateComponent } from './mystery-create';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * **What the wizard's removal modal says when it has no verified answer about usage — the state
 * Phase 3 built a string for and Phase 4 does not use.**
 *
 * `MysteryCreateStore.loadAttachCatalogues` subscribes to `getMysteries()` on its own with
 * `error: () => {}` — deliberately, because a missing mystery list is not page data. So
 * `store.mysteries()` can be `[]` for two different reasons: the entity really is in no other
 * mystery, and *we could not find out*. `resolveMysteryNames` returns `[]` for both, the count is 0
 * for both, and `wizardMysteryUsageMessage` turns both into the same positive sentence.
 *
 * Phase 3 rejected exactly this on the list pages, and `shared/mystery-usage.ts` still carries
 * `mysteryUsageUnavailableMessage` with the reasoning in its docstring: *"a false 'isn't used by any
 * mystery' on an irreversible action is worse than silence"*, and silence is worse still because it
 * reproduces the same inference more quietly. The wizard has neither the string nor the branch.
 *
 * These are **characterisation tests**: they assert what the code does today, not what it should do,
 * so the suite stays green and the gap stays visible. If the fix lands, they are the tests that must
 * be changed on purpose — the assertions below say what to change them to.
 */

const CATALOGUE_LOCATIONS = [
  {
    id: 'loc-shared',
    // Three memberships, two of them elsewhere. A Delete here takes it out of both.
    mysteryIds: ['mystery-1', 'mystery-9', 'mystery-8'],
    name: 'Ferris Mill',
    description: 'Rust and river damp.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('The wizard’s removal modal when the mystery lookup did not answer', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let store: MysteryCreateStore;
  let element: HTMLElement;

  async function create(getMysteries: () => Observable<{ id: string; name: string }[]>): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MysteryCreateComponent],
      providers: [
        provideRouter([]),
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
        {
          provide: MysteryService,
          useValue: { create: () => of({ id: 'mystery-1' }), upsertCountdown: () => of({}), getMysteries },
        },
        { provide: MonsterService, useValue: { getAll: () => of([]), create: () => of({ id: 'monster-1' }) } },
        { provide: MinionService, useValue: {} },
        {
          provide: LocationService,
          useValue: {
            getAll: () => of(CATALOGUE_LOCATIONS),
            create: () => of({ id: 'loc-created' }),
            update: () => of({}),
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
            delete: () => of(undefined),
          },
        },
        { provide: BystanderService, useValue: { getAll: () => of([]) } },
        { provide: ApiService, useValue: { post: () => of({}), get: () => of([]) } },
        { provide: NotificationService, useValue: { success: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryCreateComponent);
    store = fixture.debugElement.injector.get(MysteryCreateStore);
    element = fixture.nativeElement as HTMLElement;
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(2);
    store.currentStep.set(0);
    await settle();

    // A persisted membership, so the dialog is variant (B)/(C) — the one with a Delete button.
    store.attachLocation('loc-shared');
    store.next();
    store.currentPhase.set(2);
    store.currentStep.set(0);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function openTheDialog(): Promise<void> {
    element.querySelector<HTMLButtonElement>('button[aria-label="Remove Ferris Mill"]')!.click();
    await settle();
  }

  const dialogText = (): string => element.querySelector<HTMLElement>('[role="dialog"]')!.textContent ?? '';
  const dialogButtons = (): string[] =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).map(
      (button) => button.textContent?.trim() ?? '',
    );

  it('control: with the mystery list loaded it names both other mysteries and counts them', async () => {
    await create(() =>
      of([
        { id: 'mystery-1', name: 'The Hollow Choir' },
        { id: 'mystery-9', name: 'Dust Bowl Nights' },
        { id: 'mystery-8', name: 'The Long Drive Home' },
      ]),
    );
    await openTheDialog();

    expect(dialogText()).toContain('This location is also used by 2 other mysteries:');
    expect(dialogText()).toContain('Dust Bowl Nights');
    expect(dialogText()).toContain('The Long Drive Home');
    expect(dialogText()).toContain('Delete removes it from those mysteries too.');
  });

  it('when `getMysteries()` fails it still states the count, and says only the names are missing', async () => {
    await create(() => throwError(() => new Error('network')));
    await openTheDialog();

    // The entity's own `mysteryIds` says three, and that array owes nothing to the name lookup.
    expect(store.locations()[0].mysteryIds).toEqual(['mystery-1', 'mystery-9', 'mystery-8']);

    // §15.1: the count drives the sentence, the names decide only whether bullets render. Deriving
    // the count from the names conflated "no other mysteries" with "no names resolved" and asserted
    // the opposite of the truth on the sentence an irreversible decision is made from.
    expect(dialogText()).toContain("This location is also used by 2 other mysteries. Their names couldn't be loaded.");
    expect(dialogText()).not.toContain("This location isn't used by any other mystery.");

    // A full stop, not a colon: a colon promises a list, and there is no list under it.
    expect(dialogText()).not.toContain('2 other mysteries:');
    expect(element.querySelectorAll('[role="dialog"] ul')).toHaveLength(0);

    // The footnote follows the count too, so it no longer promises what only variant (B) does.
    expect(dialogText()).toContain('Delete removes it from those mysteries too.');
    expect(dialogText()).not.toContain('Delete removes it for good.');

    // All three buttons stay: the count is what the Detach-vs-Delete choice needs, and degrading to
    // two would remove the safe option exactly when the user has least information.
    expect(dialogButtons()).toEqual(['Cancel', 'Detach', 'Delete']);
  });

  it('says the same while the lookup is merely in flight, then fills the names in without new copy', async () => {
    // `getMysteries()` is a bare subscription in `loadAttachCatalogues`, not part of `loadEditData`'s
    // `forkJoin`, so the roster renders before it answers. Unlike the list pages — whose dialog copy
    // is a snapshot taken at open time (UX §14.1) — the wizard's is a `computed`.
    await create(() => of([]));
    await openTheDialog();

    expect(dialogText()).toContain("This location is also used by 2 other mysteries. Their names couldn't be loaded.");

    store.mysteries.set([
      { id: 'mystery-1', name: 'The Hollow Choir' },
      { id: 'mystery-9', name: 'Dust Bowl Nights' },
      { id: 'mystery-8', name: 'The Long Drive Home' },
    ] as never);
    await settle();

    // Self-healing with the dialog still open — which is why one string is right here rather than a
    // "loading names…" state: the block fills in instead of narrating (§15.1).
    expect(dialogText()).toContain('This location is also used by 2 other mysteries:');
    expect(dialogText()).toContain('Dust Bowl Nights');
  });

  it('a partial resolution takes the names-missing wording rather than showing fewer bullets than it promised', async () => {
    // One of the two other mysteries resolves. Rendering it alone would put "2 other mysteries:"
    // above a single bullet — the count and the list disagreeing, which is the invariant Phase 3
    // established for this block.
    await create(() =>
      of([
        { id: 'mystery-1', name: 'The Hollow Choir' },
        { id: 'mystery-9', name: 'Dust Bowl Nights' },
      ]),
    );
    await openTheDialog();

    expect(dialogText()).toContain("This location is also used by 2 other mysteries. Their names couldn't be loaded.");
    expect(dialogText()).not.toContain('Dust Bowl Nights');
    expect(element.querySelectorAll('[role="dialog"] ul')).toHaveLength(0);
  });
});
