/**
 * **No unit test may reach the real `CustomMoveService`** (F-L9).
 *
 * `CustomMoveService` is `providedIn: 'root'`, so a `TestBed` that does not stub it resolves the
 * *real* one — which injects `ApiService`, which injects `HttpClient`, which Angular 22 root-provides
 * all the way down to `FetchBackend`. A spec in that state does not fail; it issues a real HTTP
 * request. Today those requests are refused because nothing is listening, and that is the whole of
 * the protection: **start a dev server on `:5225` and `ng test` writes to dev `motw`.** Four of the
 * last six sub-phases had one running.
 *
 * 5f-2 measured what that looks like when it happens: a stripped `editMonsterDraft` made the wizard
 * issue a `DELETE` for a custom move, the real `fetch` failed, the whole submit went with it, and
 * the symptom surfaced three layers away as a **null attack id in a weapon-tag test**. Effective by
 * accident, and unreadable.
 *
 * So this is the property, asserted rather than swept once: every spec that can resolve the real
 * service stubs it. Both halves are **derived**, which is what makes it survive new pages and new
 * specs:
 *
 * - the set of *injectors* comes from the production sources — anything containing
 *   `inject(CustomMoveService)` — so a tenth page that injects it is covered the day it is written;
 * - the set of *specs at risk* comes from which of those class names each spec mentions, so a new
 *   spec for an existing page is covered the day it is written.
 *
 * A hand-written list of files would have been a sweep. §29.7's lesson is that a census comparing a
 * literal against itself catches nothing; this compares the suite against the application.
 */
/**
 * `import.meta.glob` is replaced at transform time, so the call has to be written out in full at
 * the call site — hoisting it into a `const glob = …` throws *"statically replaced during file
 * transformation"* at module load, which reports as a suite with **zero tests** rather than as a
 * failure. Worth the sentence: a guard that silently stops running is the thing it exists to catch.
 */
const SOURCES = (
  import.meta as unknown as { glob: (pattern: string, options: unknown) => Record<string, string> }
).glob('/src/app/**/*.ts', { query: '?raw', import: 'default', eager: true });

const isSpec = (path: string): boolean => path.endsWith('.spec.ts');

/**
 * Classes that can resolve `CustomMoveService`, read out of the application rather than listed here.
 *
 * **Keyed on the import, not on `inject(...)`.** The wizard store writes
 * `inject(CustomMoveService)`; all nine page components use constructor injection
 * (`private readonly customMoveService: CustomMoveService`). A rule that matched only the first
 * form found one class out of ten and still passed its own sanity check, because the check was
 * `length > 0`. Importing the symbol is what both forms have in common.
 *
 * **Then a fixed point, for the transitive case.** `mystery-create-g1-tracker-jump.spec.ts` mounts
 * `MysteryCreateComponent`, which *provides* `MysteryCreateStore`, which injects the service — so
 * it is at risk without ever naming the injector. Expanding the set with any class whose source
 * mentions a class already in it closes that, and over-expansion is the safe direction: it can
 * only demand a stub somewhere one was not strictly needed.
 */
const injectorClasses = (): string[] => {
  const exported = (source: string): string[] => [...source.matchAll(/export class (\w+)/g)].map((m) => m[1]);

  const names = new Set<string>();
  for (const [path, source] of Object.entries(SOURCES)) {
    if (isSpec(path) || path.endsWith('/core/custom-moves.ts')) {
      continue;
    }
    // The **import**, not a mention: `monster-detail.ts` names the service in a comment too.
    if (!/import\s*\{[^}]*\bCustomMoveService\b[^}]*\}/.test(source)) {
      continue;
    }
    for (const name of exported(source)) {
      names.add(name);
    }
  }

  /**
   * Transitive case, and it has to be **`providers:` specifically**. The first attempt expanded on
   * "mentions a class already in the set", which went from 10 classes to 66 at-risk specs including
   * every hunter spec in the app — a shared `IconComponent` is enough to connect anything to
   * anything. Providing is the only way a component hands an injector to a child injector, so it is
   * the only edge worth walking.
   */
  for (let pass = 0; pass < 5; pass++) {
    const before = names.size;
    for (const [path, source] of Object.entries(SOURCES)) {
      if (isSpec(path)) {
        continue;
      }
      const providers = [...source.matchAll(/providers:\s*\[([^\]]*)\]/g)].map((m) => m[1]).join(',');
      if (!providers || ![...names].some((name) => new RegExp(`\\b${name}\\b`).test(providers))) {
        continue;
      }
      for (const name of exported(source)) {
        names.add(name);
      }
    }
    if (names.size === before) {
      break;
    }
  }

  return [...names].sort();
};

/**
 * Stubbing `ApiService` counts. It is what `CustomMoveService` injects, so a fake one keeps the
 * real service off the network just as effectively — and it is the shape the component-level specs
 * already use, because overriding `ApiService` leaves the production service being the one the
 * page actually resolves.
 */
const isStubbed = (source: string): boolean =>
  /provide:\s*CustomMoveService/.test(source) || /provide:\s*ApiService/.test(source);

describe('F-L9: no spec can reach the real CustomMoveService', () => {
  it('the derivation found the injectors it is supposed to find', () => {
    const classes = injectorClasses();

    // A guard whose input set is empty passes vacuously, which is the failure mode §29.7 is about.
    // These two are the extremes of the range: a page-level component and the wizard's store.
    expect(classes).toContain('MysteryCreateStore');
    expect(classes).toContain('MonsterDetailComponent');
    expect(classes.length).toBeGreaterThanOrEqual(10);
  });

  it('every spec that can resolve it stubs it', () => {
    const classes = injectorClasses();

    const atRisk = Object.entries(SOURCES).filter(
      ([path, source]) =>
        isSpec(path) &&
        /TestBed\.configureTestingModule/.test(source) &&
        classes.some((name) => new RegExp(`\\b${name}\\b`).test(source)),
    );

    // Non-vacuous: there really are specs in the at-risk set.
    expect(atRisk.length).toBeGreaterThan(10);

    const unstubbed = atRisk.filter(([, source]) => !isStubbed(source)).map(([path]) => path).sort();

    expect(unstubbed).toEqual([]);
  });
});
