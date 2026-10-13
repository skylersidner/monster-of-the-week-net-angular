/**
 * **Phase 6 — the five-domain drift guard.**
 *
 * §31.3 planned this as a rendered-DOM parity spec modelled on
 * `resource-images-four-domain-parity.spec.ts`, and said flatly that *"template source is genuinely
 * unavailable to a unit test in this project — `?raw` imports fail both statically and dynamically,
 * and `import.meta.glob` hangs the runner."*
 *
 * **That is measured false.** F-L9's `custom-moves-stubbed-everywhere.spec.ts` reads every `.ts` in
 * the app with `import.meta.glob(..., { query: '?raw' })` and runs in a few milliseconds. The one
 * real constraint is that the call must be written out in full at the call site, because it is
 * replaced at transform time — hoisting it throws at module load and reports as a suite with
 * **zero tests**, which is the failure mode a guard must never have.
 *
 * Correcting that unlocks the half §31.3 could not have: **the write literal**. §29.4's discovery is
 * that a card's `ownerType` and its host's write literal are *two independent strings, neither
 * guarding the other* — a page can render "Minion" and write to the monster owner space, and the
 * rendered DOM cannot tell. A DOM-parity spec proves the card is *labelled* right and never that
 * the page *writes* right. So this guard is source-derived, and it checks both halves plus their
 * agreement.
 *
 * **It also reaches the five wizard owner literals**, which have no card and therefore no
 * `data-owner-type` analogue at all. Until now they were guarded only by per-owner write assertions
 * spread across four separate spec files (5f-1, 5f-2, 5f-3a, 5f-3b), each of which proves its own
 * site and says nothing about the set. §31.3's "nine call sites" is nine *card* sites; the guarded
 * surface is nine plus five.
 *
 * **Everything here is relative and derived.** No stored hash, no golden string, no list of file
 * names, no count that a reader has to maintain. A consistent change to all five domains needs no
 * edit; only an inconsistent one trips it. Where two declarations could drift apart, each side is
 * read independently and the two are compared — which is the only construction that cannot pass
 * vacuously when a domain goes missing.
 */

/**
 * Written out in full at the call site, deliberately — see the header. One glob for the whole app,
 * both `.ts` and `.html`, because the guard's two halves live in different file types.
 */
const SOURCES: Record<string, string> = (
  import.meta as unknown as { glob: (pattern: string, options: unknown) => Record<string, string> }
).glob('/src/app/**/*.{ts,html}', { query: '?raw', import: 'default', eager: true });

/**
 * **Prose is not code, and both of this guard's first two failures were a matcher forgetting it.**
 * `app-custom-moves-card` appears in four wizard templates in comments saying why they do *not*
 * use it, and `customMoveSubResource(` appears in a comment explaining why it must never be called
 * inline. Line comments and block-comment bodies come out before anything is counted.
 */
const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

const entries = (predicate: (path: string, source: string) => boolean): [string, string][] =>
  Object.entries(SOURCES)
    .filter(([path, source]) => !path.endsWith('.spec.ts') && predicate(path, source))
    .sort(([a], [b]) => a.localeCompare(b));

// =============================================================================================
// The five domains, derived twice and cross-checked.
// =============================================================================================

/** The union's members, read out of the type rather than typed out here. */
const domainsFromUnionType = (): string[] => {
  const models = SOURCES['/src/app/core/models.ts'];
  const declaration = /export type CustomMoveOwnerType =([^;]+);/.exec(models);
  if (!declaration) { throw new Error('CustomMoveOwnerType not found in core/models.ts'); }
  return [...declaration[1].matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
};

/** The route-segment map's keys — an independent declaration of the same set. */
const domainsFromSegmentMap = (): string[] => {
  const service = SOURCES['/src/app/core/custom-moves.ts'];
  const block = /const OWNER_SEGMENT[^{]*\{([^}]*)\}/.exec(service);
  if (!block) { throw new Error('OWNER_SEGMENT not found in core/custom-moves.ts'); }
  return [...block[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort();
};

const DOMAINS = domainsFromUnionType();

/** `Monster` → the file paths that belong to the monster domain, and to no other domain. */
const ownsPath = (domain: string, path: string): boolean => {
  const mine = new RegExp(`\\b${domain.toLowerCase()}s?\\b`);
  const others = DOMAINS.filter((other) => other !== domain).map((other) => new RegExp(`\\b${other.toLowerCase()}s?\\b`));
  return mine.test(path) && !others.some((re) => re.test(path));
};

// =============================================================================================
// The card call sites, derived twice and cross-checked.
// =============================================================================================

/**
 * **The element, not the name.** Four wizard templates mention `app-custom-moves-card` in a comment
 * explaining why they do *not* use it (§35.5), so a name match reports 13 call sites where there
 * are 9. The opening angle bracket is the difference between a usage and a reference.
 */
const cardTemplates = (): [string, string][] => entries((path, source) => path.endsWith('.html') && source.includes('<app-custom-moves-card'));

/** Hosts that import the component — the other side of the same fact. */
const cardHosts = (): [string, string][] =>
  entries((path, source) => path.endsWith('.ts') && /import\s*\{[^}]*\bCustomMovesCardComponent\b[^}]*\}/.test(source));

/** The whole `<app-custom-moves-card … />` element, for binding comparison. */
const cardElement = (template: string): string => {
  const start = template.indexOf('<app-custom-moves-card');
  const end = template.indexOf('/>', start);
  if (start < 0 || end < 0) { throw new Error('card element not delimited'); }
  return template.slice(start, end + 2);
};

/** Every binding on the element, by name, normalised of its value. `ownerType` included. */
const bindingNames = (element: string): string[] =>
  [...element.matchAll(/^\s*(?:\[\(?|\()?([A-Za-z]+)(?:\)?\]|\))?\s*=/gm)].map((m) => m[1]).sort();

const ownerToken = (element: string): string | null => (/ownerType="(\w+)"/.exec(element) ?? [])[1] ?? null;

/** Owner literals the host passes to `CustomMoveService` — the write half. */
const writeLiterals = (source: string): string[] =>
  [
    ...source.matchAll(/customMoveService\s*\n?\s*\.?\s*(?:list|create|update|delete)\(\s*'(\w+)'/g),
    ...source.matchAll(/customMoveService\.(?:list|create|update|delete)\(\s*'(\w+)'/g),
  ].map((m) => m[1]);

describe('Phase 6 — the five-domain custom-move drift guard', () => {
  // -------------------------------------------------------------------------------------------
  // Self-checks. A guard whose input set is empty passes everything, and this feature has
  // produced that failure twice: the confirm-modal census read as coverage while catching nothing
  // (§29.7), and its "derived" half walked four hard-coded coordinates and never visited phase 0
  // (§29.9). So the inputs are asserted non-empty, and asserted to have been *read*, first.
  // -------------------------------------------------------------------------------------------

  it('6-X1: the glob reached the application, not an empty object', () => {
    const paths = Object.keys(SOURCES);
    expect(paths.length).toBeGreaterThan(100);
    expect(paths.some((p) => p.endsWith('/core/models.ts'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/core/custom-moves.ts'))).toBe(true);
    expect(paths.filter((p) => p.endsWith('.html')).length).toBeGreaterThan(20);
    // And the contents are real text, not module objects.
    expect(SOURCES['/src/app/core/custom-moves.ts']).toContain('OWNER_SEGMENT');
  });

  it('6-X2: the element matcher distinguishes a usage from a mention', () => {
    const mentions = entries((path, source) => path.endsWith('.html') && source.includes('app-custom-moves-card'));
    const usages = cardTemplates();

    // The wizard templates mention the card in comments saying why they do not use it. If these
    // two numbers were equal, the matcher would be counting prose.
    expect(mentions.length).toBeGreaterThan(usages.length);
    expect(usages.every(([, source]) => source.includes('<app-custom-moves-card'))).toBe(true);
  });

  // -------------------------------------------------------------------------------------------
  // The domain set — derived twice, never typed.
  // -------------------------------------------------------------------------------------------

  it('6-D1: the owner union and the route-segment map declare the same five domains', () => {
    // Two independent declarations of one fact. A sixth domain added to the type and not the map
    // (or the reverse) is the drift this catches, and neither side is written down here.
    expect(domainsFromUnionType()).toEqual(domainsFromSegmentMap());
    expect(DOMAINS.length).toBe(5);
  });

  it('6-D2: every domain owns a distinguishable slice of the file tree', () => {
    // `ownsPath` is what lets every assertion below derive "which domain is this file?" instead of
    // carrying a map. It only works if the names do not collide, so that is asserted rather than
    // assumed — and it is the thing a sixth domain called `MonsterGroup` would break.
    for (const domain of DOMAINS) {
      const owned = Object.keys(SOURCES).filter((path) => ownsPath(domain, path));
      expect(owned.length, `no files resolve to ${domain}`).toBeGreaterThan(0);
    }
    const ambiguous = Object.keys(SOURCES).filter((path) => DOMAINS.filter((d) => ownsPath(d, path)).length > 1);
    expect(ambiguous).toEqual([]);
  });

  // -------------------------------------------------------------------------------------------
  // The nine card call sites.
  // -------------------------------------------------------------------------------------------

  it('6-C1: every template that renders the card has a host that imports it, and vice versa', () => {
    const templates = cardTemplates().map(([path]) => path.replace(/\.html$/, ''));
    const hosts = cardHosts().map(([path]) => path.replace(/\.ts$/, ''));

    // Two independent facts about the same nine pages. A page added to one side only — a template
    // that renders a component its class never imported, or a class that imports it and renders
    // something else — shows up as an asymmetry rather than as a number that needs updating.
    expect(templates).toEqual(hosts);
    expect(templates.length).toBe(DOMAINS.length * 2 - 1);
  });

  it('6-C2: the nine call sites are five detail pages and four create pages, one per domain', () => {
    const byDomain = new Map<string, string[]>(DOMAINS.map((d) => [d, []]));
    for (const [path] of cardTemplates()) {
      const domain = DOMAINS.find((d) => ownsPath(d, path));
      expect(domain, `no domain owns ${path}`).toBeDefined();
      byDomain.get(domain as string)!.push(path.includes('-detail') ? 'detail' : 'create');
    }

    // **Derived, not listed.** Every domain has a detail call site; exactly one has no create call
    // site, and it is the one whose create surface is the wizard — which uses hand-written panels
    // (§35.5) and so correctly does not appear among the card's call sites at all.
    for (const domain of DOMAINS) {
      expect(byDomain.get(domain), `${domain} has no detail call site`).toContain('detail');
    }
    const withoutCreate = DOMAINS.filter((d) => !byDomain.get(d)!.includes('create'));
    expect(withoutCreate).toHaveLength(1);
    expect(cardTemplates().some(([path]) => ownsPath(withoutCreate[0], path) && path.includes('mystery-create'))).toBe(false);
  });

  it('6-C3: all nine call sites bind the same inputs and outputs, bar the one that differs by design', () => {
    const sites = cardTemplates().map(([path, source]) => ({ path, bindings: bindingNames(cardElement(source)) }));
    // Derived from the domain set, not typed: `6-C2` proves the shape this encodes (every
    // domain has a detail call site; all but the wizard-backed one also have a create call site).
    expect(sites.length).toBe(DOMAINS.length * 2 - 1);

    // **A relative invariant.** No golden list: the first site sets the shape and the other eight
    // must agree with it, so a consistent change to all nine needs no edit here.
    const shape = (bindings: string[]): string[] => bindings.filter((name) => name !== 'emptyText');
    const reference = shape(sites[0].bindings);
    expect(reference.length).toBeGreaterThanOrEqual(6);
    for (const site of sites) {
      expect(shape(site.bindings), `${site.path} binds a different set`).toEqual(reference);
    }

    // `emptyText` is the designed difference (§31.3 item 4): a create page's empty state says
    // something else. So it is normalised away above — and therefore asserted here, because any
    // token normalised away needs its own positive assertion.
    const creates = sites.filter((site) => !site.path.includes('-detail'));
    const details = sites.filter((site) => site.path.includes('-detail'));
    expect(creates.every((site) => site.bindings.includes('emptyText'))).toBe(true);
    expect(details.every((site) => !site.bindings.includes('emptyText'))).toBe(true);
  });

  it('6-C4: every call site labels the card with its own domain — asserted before normalising', () => {
    // §31.3 item 3, and the negative control it demands. The token is read per site and compared
    // against the domain the *path* resolves to, so the two cannot be the same transcription.
    for (const [path, source] of cardTemplates()) {
      const token = ownerToken(cardElement(source));
      const domain = DOMAINS.find((d) => ownsPath(d, path));
      expect(token, `${path} binds no ownerType literal`).not.toBeNull();
      expect(token, `${path} is labelled ${token} but belongs to ${domain}`).toBe(domain);
    }
  });

  it('6-C5: the card is never a child of the four-panel sub-resource grid (14-R2)', () => {
    for (const [path, source] of cardTemplates()) {
      const before = source.slice(0, source.indexOf('<app-custom-moves-card'));
      const openGrids = (before.match(/<div[^>]*sub-resource-grid/g) ?? []).length;
      const closed = (before.match(/<\/div>/g) ?? []).length;
      // A crude depth check is enough for the one thing 14-R2 forbids: the card must not sit inside
      // the grid that holds Attacks/Powers/Weaknesses/Armor, because it is not one of them.
      expect(openGrids === 0 || closed >= openGrids, `${path} may nest the card in the panel grid`).toBe(true);
    }
  });

  // -------------------------------------------------------------------------------------------
  // The write half — the thing a DOM-parity spec cannot see (§29.4).
  // -------------------------------------------------------------------------------------------

  it('6-W1: every card host writes to the owner space it labels itself with', () => {
    const checked: string[] = [];
    for (const [path, source] of cardHosts()) {
      const literals = [...new Set(writeLiterals(source))];
      if (literals.length === 0) { continue; }
      const domain = DOMAINS.find((d) => ownsPath(d, path));
      // **§29.4's finding, closed.** The card's `ownerType` and this literal are two independent
      // strings; 5b's control proved neither guards the other. Both are now compared against the
      // domain the path resolves to, which is a third, independent fact.
      expect(literals, `${path} writes to ${literals.join('/')} but belongs to ${domain}`).toEqual([domain]);
      checked.push(path);
    }
    // Non-vacuous: the nine hosts all write, so skipping them all would be a silent pass.
    expect(checked.length).toBe(9);
  });

  it('6-W2: the wizard declares all five owner adapters in one adjacent block, and calls the factory nowhere else', () => {
    const store = SOURCES['/src/app/features/mysteries/pages/mystery-create/mystery-create.store.ts'];
    expect(store, 'wizard store not found').toBeDefined();

    const declarations = [...store.matchAll(/private readonly \w+ = this\.customMoveSubResource\('(\w+)'\);/g)];
    // **All five, and the set is the derived one** — this is the only guard on the wizard's owner
    // literals, because the wizard has no card and therefore no `data-owner-type` to check.
    expect(declarations.map((m) => m[1]).sort()).toEqual(DOMAINS);

    // **Adjacent** (§35.4). A reviewer can check five consecutive lines against five collection
    // names; they cannot check five literals a thousand lines apart. Asserted as "the five
    // declarations occupy five consecutive lines", derived from their offsets.
    const lineOf = (index: number): number => store.slice(0, index).split('\n').length;
    const lines = declarations.map((m) => lineOf(m.index as number)).sort((a, b) => a - b);
    expect(lines[lines.length - 1] - lines[0]).toBe(DOMAINS.length - 1);

    // **And never inline at a save site**, which is the other half of the recommendation: every
    // call to the factory is one of the five declarations above. Comments stripped first — the
    // §35.4 note in this very file names the function while explaining the rule, and counting that
    // was this assertion's first failure.
    const allCalls = [...withoutComments(store).matchAll(/customMoveSubResource\(/g)];
    expect(allCalls).toHaveLength(declarations.length + 1); // the five, plus the factory's definition
  });

  it('6-W3: no owner literal appears anywhere a different domain owns the file', () => {
    // The broadest form of §29.4's hazard: a `'Monster'` typed into a minion file, wherever it
    // lands. Scoped to files that actually talk to the custom-move service, so an unrelated
    // mention of the word cannot trip it.
    const offenders: string[] = [];
    for (const [path, source] of entries((p, s) => p.endsWith('.ts') && /\bcustomMoveService\b/.test(s))) {
      const domain = DOMAINS.find((d) => ownsPath(d, path));
      if (!domain) { continue; }
      /**
       * **One file legitimately owns all five, and it identifies itself.** The wizard writes for
       * every domain, which is the condition §35.4's adapter table exists for — so a
       * single-domain rule cannot apply to it. The exemption is *derived*, not a file name: a file
       * that declares `customMoveSubResource` is multi-owner by construction, and `6-W2` checks its
       * five literals exhaustively instead.
       */
      if (/private customMoveSubResource\(/.test(source)) { continue; }
      for (const literal of new Set(writeLiterals(source))) {
        if (literal !== domain) { offenders.push(`${path}: ${literal}`); }
      }
    }
    expect(offenders).toEqual([]);
  });

  // -------------------------------------------------------------------------------------------
  // The polish §5 and §31 put in this phase.
  // -------------------------------------------------------------------------------------------

  it('6-P1: the four create pages converge on one partial-failure caveat (14-R1)', () => {
    // §13.6.1 Ruling 1, whose *convergence* landed with 5c/5d — Phase 6 owns the assertion.
    // 14-R1's hazard was Location and Bystander saying "some of its mysteries" while a custom-move
    // failure routed through the same flag, which is copy that is false by omission. Compared
    // **relatively**, with the domain noun normalised out, so a future rewording of all four needs
    // no edit here and a rewording of one trips it.
    const caveats = entries((path, source) => /pages\/\w+-create\/\w+-create\.ts$/.test(path) && source.includes('may not have saved'))
      .map(([path, source]) => {
        const domain = DOMAINS.find((d) => ownsPath(d, path)) as string;
        const line = /'([^']*may not have saved[^']*)'/.exec(source);
        expect(line, `${path} has no caveat string`).not.toBeNull();
        // **Lowercase first, then split.** The caveat names the domain twice — capitalised at the
        // start and lowercase in "on the location page" — so replacing the capitalised form alone
        // leaves the second one behind and four identical strings compare as four different ones.
        const normalised = (line as RegExpExecArray)[1].toLowerCase().split(domain.toLowerCase()).join('<domain>');
        return { path, normalised };
      });

    // Four create pages carry the card (`6-C1`), so four caveats — derived, not typed.
    expect(caveats).toHaveLength(DOMAINS.length - 1);
    const reference = caveats[0].normalised;
    expect(reference).toContain('some details may not have saved');
    for (const caveat of caveats) {
      expect(caveat.normalised, `${caveat.path} words it differently`).toBe(reference);
    }
  });

  it('6-P2: every create page’s custom-move spec asserts an exact call multiset (R5)', () => {
    // §7 R5: the draft arm is added to each create page independently, and a *duplicated* arm
    // produces the right end state with twice the requests. A `toContain` assertion cannot see
    // that, which is why those specs carry a sorted exact ledger — and why this asserts that all
    // of them carry one rather than trusting that they do.
    const hosts = cardHosts().filter(([path]) => !path.includes('-detail'));
    expect(hosts).toHaveLength(DOMAINS.length - 1);

    for (const [path] of hosts) {
      const specPath = path.replace(/\.ts$/, '.custom-moves.spec.ts');
      const spec = SOURCES[specPath];
      expect(spec, `${specPath} is missing`).toBeDefined();
      // The ledger's shape: sorted both sides, so multiplicity survives and a duplicate arm fails.
      expect(spec, `${specPath} has no exact-multiset ledger`).toMatch(/\[\.\.\.sent\]\.sort\(\)/);
      // And an N-staged/N-sent count, which is the assertion a duplicate arm actually trips.
      expect(spec, `${specPath} never counts move.create`).toMatch(/move\.create[\s\S]{0,80}toHaveLength\(/);
    }
  });

  // -------------------------------------------------------------------------------------------
  // The service's own five-way symmetry.
  // -------------------------------------------------------------------------------------------

  it('6-S1: every domain reaches the same four methods through one path builder', () => {
    const service = SOURCES['/src/app/core/custom-moves.ts'];
    const methods = [...service.matchAll(/^\s{2}(list|create|update|delete)\(/gm)].map((m) => m[1]).sort();
    expect(methods).toEqual(['create', 'delete', 'list', 'update']);

    // One builder, used by all four — the §2.9/`OWNER_SEGMENT` property. Four `customMovesPath`
    // references, one per method, and no hand-built path anywhere in the file.
    expect([...service.matchAll(/customMovesPath\(/g)].length).toBeGreaterThanOrEqual(methods.length);
    expect(service).not.toMatch(/`\/api\/\$\{[^}]*\}\/custom-moves`/);
  });
});
