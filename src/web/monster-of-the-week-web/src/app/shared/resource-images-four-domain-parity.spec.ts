import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';

import { BystanderService } from '../core/bystander';
import { LocationService } from '../core/location';
import { MinionService } from '../core/minion';
import { MonsterService } from '../core/monster';
import { MysteryService } from '../core/mystery';
import { NotificationService } from '../core/notifications';
import { ReferenceDataService } from '../core/reference-data';
import { ResourceImageService } from '../core/resource-images';
import { ResourceImageResponse, ResourceOwnerType } from '../core/models';
import { ResourceImagesStore } from './resource-images.store';

import { MonsterDetailComponent } from '../features/monsters/pages/monster-detail/monster-detail';
import { MinionDetailComponent } from '../features/minions/pages/minion-detail/minion-detail';
import { BystanderDetailComponent } from '../features/bystanders/pages/bystander-detail/bystander-detail';
import { LocationDetailComponent } from '../features/locations/pages/location-detail/location-detail';

/**
 * ============================================================================================
 * The four-domain drift guard for the resource-images feature.
 * ============================================================================================
 *
 * **What it protects.** Monster, Minion, Bystander and Location each wire the same three shared
 * image components into their own detail page (Phases 6a–6d). Nothing in the type system makes
 * those four wirings agree: add an input to `app-image-carousel` and bind it on three pages, or
 * drop `[busy]` from one, and every existing spec still passes while one domain quietly behaves
 * differently. That is the gap this file exists to close, and it was written after a manual
 * four-way comparison at the end of 6d found exactly one such inconsistency.
 *
 * **Why it compares rendered DOM and not template source.** Template text is unavailable to a unit
 * test here: `import.meta.glob` hangs the Angular unit-test runner, and both dynamic and static
 * `?raw` imports fail ("No loader is configured for \".html\" files"). Rendering is also the better
 * oracle — it compares what a user gets after bindings resolve, so a page that binds the wrong
 * expression to the right input is caught, which reading the template for input *names* would miss.
 *
 * **Why there is no stored hash, snapshot or golden string.** This asserts a *relative* invariant:
 * the four agree with each other. There is deliberately no recorded expected value, because a
 * recorded value is the thing people regenerate without reading when it goes red — which silently
 * retires the guard. A consistent change to all four templates keeps this green with no edit here
 * at all; only an *inconsistent* change trips it.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * **IF THIS SPEC FAILS, READ THIS BEFORE CHANGING IT.**
 *
 * The failure prints the offending domain and a line-by-line diff of its images section against
 * Monster's. Two possibilities:
 *
 *  1. *You changed one domain and not the others.* That is the drift this guard exists for — make
 *     the same change on the other three. Nothing in this file needs editing.
 *  2. *You deliberately introduced a difference a domain is supposed to have.* Then add it to
 *     `PERMITTED_DIFFERENCES` below **with a comment saying why**, in the same spirit as the
 *     modal-ownership entry that is already documented there. Do not widen the normalisation to
 *     make a diff disappear — normalisation is for noise (whitespace, the owner-type token), not
 *     for differences you would rather not think about.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * Differences the four domains are allowed to have, each with its reason. Empty today, and that is
 * a real finding rather than an oversight: the one genuine asymmetry between the four pages — which
 * object owns the delete-modal state — is an output subscription and a page field, so it does not
 * reach the DOM at all. It is asserted positively further down instead of being excused here, which
 * is the better place for intent that a reader needs to understand.
 */
const PERMITTED_DIFFERENCES: readonly { readonly pattern: RegExp; readonly why: string }[] = [];

/** One fixture set, shared by all four, so the only legitimate variation left is the owner type. */
const OWNER_ID = 'shared-owner-id';
const OWNER_NAME = 'Shared Fixture Name';

function imageFixture(id: string, sortOrder: number, isPrimary = false): ResourceImageResponse {
  return {
    id,
    fileName: `${id}.webp`,
    contentType: 'image/webp',
    sizeBytes: 150_000,
    width: 1024,
    height: 1024,
    sortOrder,
    isPrimary,
    createdAt: '2026-10-07T00:00:00Z',
  };
}

/** Three images with an explicit primary in the middle, so peeks, the glow and the star all render. */
const IMAGES: ResourceImageResponse[] = [
  imageFixture('alpha', 1),
  imageFixture('beta', 2, true),
  imageFixture('gamma', 3),
];

/**
 * The in-flight `PUT .../primary` used to produce the `busy` capture. Never completed, so
 * `ResourceImagesStore.isMutating()` stays true once `setPrimary` is called. Re-made per render.
 */
let pendingPrimary = new Subject<void>();

const sharedEntity = { id: OWNER_ID, name: OWNER_NAME, description: null, mysteryIds: [] as string[] };

const monster = {
  ...sharedEntity,
  harmCapacity: 7,
  monsterTypeId: 'mt1',
  monsterTypeName: 'Beast',
  monsterArchetype: { id: 'ma1', name: 'Ghost', description: '' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
};
const minion = {
  ...sharedEntity,
  monsterId: 'mo1',
  monsterName: 'The Beast',
  harmCapacity: 3,
  minionType: { id: 'mnt1', name: 'Torturer', motivation: 'dominate' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
};
const bystander = {
  ...sharedEntity,
  bystanderTypeId: 'bt1',
  bystanderTypeName: 'Witness',
  bystanderTypeMotivation: 'to tell',
  customMoves: [],
};
const location = {
  ...sharedEntity,
  locationTypeId: 'lt1',
  locationTypeName: 'Ruin',
  locationTypeMotivation: 'to collapse',
  customMoves: [],
};

interface Domain {
  readonly ownerType: ResourceOwnerType;
  readonly component: Type<unknown>;
}

const DOMAINS: readonly Domain[] = [
  { ownerType: 'Monster', component: MonsterDetailComponent },
  { ownerType: 'Minion', component: MinionDetailComponent },
  { ownerType: 'Bystander', component: BystanderDetailComponent },
  { ownerType: 'Location', component: LocationDetailComponent },
];

/**
 * One permissive provider set for all four pages. Each component injects only the services it needs
 * and ignores the rest, and the route carries every id key so each page finds its own — which keeps
 * this to a single list instead of four near-identical ones.
 */
function providers() {
  const entity = <T>(value: T) => ({ getById: () => of(value), update: () => of(value) });
  const membership = { linkToMystery: () => of(undefined), unlinkFromMystery: () => of(undefined) };
  const subResourceDeletes = {
    deleteAttack: () => of(void 0),
    deletePower: () => of(void 0),
    deleteArmor: () => of(void 0),
    deleteWeakness: () => of(void 0),
  };

  return [
    provideRouter([]),
    {
      provide: ActivatedRoute,
      useValue: {
        paramMap: of(
          convertToParamMap({
            monsterId: OWNER_ID,
            minionId: OWNER_ID,
            bystanderId: OWNER_ID,
            locationId: OWNER_ID,
          }),
        ),
      },
    },
    { provide: MonsterService, useValue: { ...entity(monster), ...membership, ...subResourceDeletes } },
    { provide: MinionService, useValue: { ...entity(minion), ...membership, ...subResourceDeletes, getByMonster: () => of([]) } },
    { provide: BystanderService, useValue: { ...entity(bystander), ...membership } },
    { provide: LocationService, useValue: { ...entity(location), ...membership } },
    { provide: MysteryService, useValue: { getMysteries: () => of([]) } },
    {
      provide: ReferenceDataService,
      useValue: {
        getMonsterTypes: () => of([]),
        getMonsterArchetypes: () => of([]),
        getMinionTypes: () => of([]),
        getBystanderTypes: () => of([]),
        getLocationTypes: () => of([]),
        getWeaponTags: () => of([]),
      },
    },
    { provide: NotificationService, useValue: { success: () => {}, error: () => {}, notifications: () => [], dismiss: () => {} } },
    {
      provide: ResourceImageService,
      useValue: {
        list: () => of(IMAGES),
        delete: () => of(void 0),
        // Deliberately never completes — see `pendingPrimary` and the `busy` capture.
        setPrimary: () => pendingPrimary.asObservable(),
        upload: () => of({ uploaded: [], rejected: [] }),
      },
    },
  ];
}

/**
 * Strips the two things that are *allowed* to differ, and nothing else:
 *
 *  - the owner-type token, wherever it appears (placeholder badge classes, the domain icon's sprite
 *    id, and the `/api/{segment}/…` image URLs);
 *  - insignificant whitespace between tags.
 *
 * Everything else is left intact on purpose. Resist adding rules here to silence a diff — see the
 * header.
 */
function normalise(html: string): string {
  return html
    .replace(/ownertype="(Monster|Minion|Bystander|Location)"/g, 'ownertype="OWNER"')
    .replace(/badge-(monster|minion|bystander|location)/g, 'badge-OWNER')
    .replace(/icon-nav-(monsters|minions|bystanders|locations)/g, 'icon-nav-OWNER')
    .replace(/\/api\/(monsters|minions|bystanders|locations)\//g, '/api/OWNER/')
    .replace(/>\s+</g, '><')
    .trim();
}

/** Readable per-line diff. Vitest's own string diff collapses long single-line HTML, so split first. */
function diffLines(expected: string, actual: string): string {
  const split = (s: string) => s.replace(/></g, '>\n<').split('\n');
  const a = split(expected);
  const b = split(actual);
  const out: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) {
      out.push(`  line ${i + 1}:`);
      out.push(`    Monster:  ${a[i] ?? '(nothing — section is shorter here)'}`);
      out.push(`    this one: ${b[i] ?? '(nothing — section is shorter here)'}`);
    }
  }
  return out.length > 0 ? out.join('\n') : '  (no line-level difference; check whitespace)';
}

/**
 * Captures each domain's section in **three states**, not one, and this is the part that gives the
 * guard teeth.
 *
 * A rendered-DOM comparison can only catch a missing binding when the bound value differs from the
 * input's own default. Found the hard way: deleting `[busy]="imagesStore.isMutating()"` from one
 * page did **not** trip an idle-only version of this spec, because `busy` defaults to `false` and
 * nothing was mutating, so the DOM was identical either way. The extra states exist to make each
 * binding observable:
 *
 *  - `idle`        — the section as first rendered.
 *  - `activeMoved` — after moving the active slide off the primary, so a page that fails to bind
 *                    `[activeImageId]` falls back to the primary and diverges.
 *  - `busy`        — with a mutation in flight, so a page that fails to bind `[busy]` leaves the
 *                    star and trash enabled while the others disable them.
 *
 * If you add an input to the card or the carousel, add a state here that makes it observable —
 * otherwise this spec will not protect it.
 */
type StateName = 'idle' | 'activeMoved' | 'busy';

async function renderStates(domain: Domain): Promise<{
  states: Record<StateName, string>;
  instance: Record<string, unknown>;
}> {
  // Manual reset, because this renders four components inside one test body and TestBed may only be
  // configured once per configuration.
  TestBed.resetTestingModule();
  pendingPrimary = new Subject<void>();
  await TestBed.configureTestingModule({
    imports: [domain.component],
    providers: providers(),
  }).compileComponents();

  const fixture = TestBed.createComponent(domain.component);
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  const read = (): string => {
    const card = host.querySelector('[data-images-card]');
    if (!card) {
      throw new Error(`${domain.ownerType}: no [data-images-card] rendered — the Images section is missing entirely.`);
    }
    return normalise(card.outerHTML);
  };

  const instance = fixture.componentInstance as Record<string, unknown>;
  const store = instance['imagesStore'] as ResourceImagesStore;

  // Checked here, *before* `normalise` collapses the owner-type token: the parity comparison has to
  // treat that token as noise, which would otherwise hide a page wired to the wrong domain
  // entirely. Negative control: binding Location's carousel as `ownerType="Bystander"` passed the
  // parity test and is caught only by this.
  const rawSection = host.querySelector('[data-images-card]')?.outerHTML ?? '';
  const otherTypes = DOMAINS.map((d) => d.ownerType).filter((t) => t !== domain.ownerType);
  expect(rawSection, `${domain.ownerType}: card is not wired to its own domain`).toContain(
    `ownertype="${domain.ownerType}"`,
  );
  for (const wrong of otherTypes) {
    expect(rawSection, `${domain.ownerType}: section mentions ${wrong}`).not.toContain(`ownertype="${wrong}"`);
  }

  const idle = read();

  // `gamma` is not the primary, so a page that binds `[activeImageId]` follows it here.
  store.setActive('gamma');
  fixture.detectChanges();
  const activeMoved = read();

  // Put the store in flight and leave it there: `pendingPrimary` is never completed, so
  // `isMutating()` stays true for this capture.
  store.setActive('beta');
  store.setPrimary('alpha');
  fixture.detectChanges();
  const busy = read();

  return { states: { idle, activeMoved, busy }, instance };
}

describe('resource images — four-domain parity', () => {
  it('renders a byte-identical Images section on all four detail pages, in every state', async () => {
    const rendered: { ownerType: string; states: Record<StateName, string> }[] = [];
    for (const domain of DOMAINS) {
      const { states } = await renderStates(domain);
      rendered.push({ ownerType: domain.ownerType, states });
    }

    // Guard against the whole thing passing vacuously if the selector ever stops matching.
    expect(rendered).toHaveLength(4);
    for (const { ownerType, states } of rendered) {
      expect(states.idle.length, `${ownerType}: rendered section is suspiciously small`).toBeGreaterThan(200);
      // And against the states collapsing into each other, which would silently remove the very
      // sensitivity they exist to provide.
      expect(states.activeMoved, `${ownerType}: activeMoved state is indistinguishable from idle`).not.toBe(states.idle);
      expect(states.busy, `${ownerType}: busy state is indistinguishable from activeMoved`).not.toBe(states.activeMoved);
    }

    const [baseline, ...others] = rendered;
    for (const candidate of others) {
      for (const state of ['idle', 'activeMoved', 'busy'] as StateName[]) {
        let expected = baseline.states[state];
        let actual = candidate.states[state];
        for (const { pattern } of PERMITTED_DIFFERENCES) {
          expected = expected.replace(pattern, '');
          actual = actual.replace(pattern, '');
        }

        if (expected !== actual) {
          throw new Error(
            [
              '',
              `${candidate.ownerType}'s Images section differs from ${baseline.ownerType}'s in the "${state}" state.`,
              '',
              diffLines(expected, actual),
              '',
              'This is the four-domain drift guard. Either the same change is missing from the other',
              'three pages, or the difference is deliberate — in which case add it to',
              'PERMITTED_DIFFERENCES in this file with a reason. See the header comment.',
              '',
            ].join('\n'),
          );
        }
      }
    }
  });

  it('wires the same carousel state on all four, so a missing binding cannot hide', async () => {
    // A spot-check with teeth: these are the bits of rendered state that only appear if the page
    // actually bound the corresponding input. `[primaryImageId]` drives the glow, `[images]` the
    // slide count, `[activeImageId]` which slide is active, `[ownerName]` the alt text.
    for (const domain of DOMAINS) {
      const { states } = await renderStates(domain);
      const section = states.idle;
      const where = `${domain.ownerType}:`;

      expect((section.match(/data-slide=/g) ?? []).length, `${where} slide count`).toBe(3);
      // `beta` is the fixture's explicit primary, so the active slide being `beta` rather than the
      // first image proves both `[images]` and `[primaryImageId]` were bound.
      expect(section, `${where} active slide is the primary`).toContain('data-slide="active" data-image-id="beta"');
      expect((section.match(/image-primary-glow/g) ?? []).length, `${where} primary glow`).toBe(1);
      expect(section, `${where} owner name reaches the alt text`).toContain(`${OWNER_NAME} image 2 of 3`);
      expect(section, `${where} star reflects primary state`).toContain('aria-pressed="true"');
    }
  });

  /**
   * **Delete-modal ownership, now uniform — and that is the assertion.** All four pages own their
   * own `pendingDelete` and route image deletes through it. There is no longer a per-domain column
   * for this, because there is no longer a difference: `domain-custom-moves` Phase 5c moved
   * Location and 5d moved Bystander, which were the last two.
   *
   * **The history, kept because it is what explains the rule rather than the outcome.** Monster and
   * Minion each already owned a `pendingDelete` serving four other delete flows before images
   * existed, so routing image deletes through the store's own pending signals would have left two
   * competing pending-delete concepts on one page. Bystander and Location had no modal at all, so
   * the store held it and those pages stayed free of the signal and its two handlers. That split
   * was correct for as long as it lasted; custom moves gave every page a second delete flow, which
   * is precisely the condition the rule turns on.
   *
   * **The rule, in the form that still decides a case** (Skyler, 2026-10-11): *a page that gains a
   * second kind of object to manage is better served moving state to the locus of control than
   * hooking into multiple stores — otherwise you end up hooked into several, when moving the state
   * would have been more straightforward.* The narrower test — *is there an existing pending-delete
   * concept for a second one to be ambiguous with?* — is the same question for this one case.
   *
   * So the store's `requestDelete`/`confirmDelete`/`cancelDelete` wrapper now has **no production
   * caller on any page**. It is still correct, still covered by `resource-images.store.spec.ts`,
   * and still the right shape for a hypothetical page with exactly one delete flow — there just
   * are not any. Removing it is tracked as a follow-up rather than done here.
   */
  it('owns delete-modal state on the page, uniformly across all four', async () => {
    for (const domain of DOMAINS) {
      const { instance } = await renderStates(domain);

      expect(typeof instance['pendingDelete'], `${domain.ownerType} should own pendingDelete`).toBe('function');
      expect(
        typeof instance['requestDeleteImage'],
        `${domain.ownerType} should route image deletes through the page`
      ).toBe('function');
    }
  });
});
