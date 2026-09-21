# Decisions

**`records/` is the archive. This file is the index of what still binds.**

- **A decision is standing when it is listed below.** If it is not here, it is history: it explains a past choice and does not constrain a new one.
- **Every entry points at its record.** The record holds the reasoning. This file holds one line and a pointer, and is meant to be read in one sitting.
- **Do not silently contradict anything below.** If you think one is wrong, say so explicitly in your output and file a record arguing it.
- **Agents write records, never this file.** Drop a new record at `.squad/decisions/records/{agent}-{slug}.md`. Promotion to this index is a deliberate, separate act — most records should never be promoted.
- **When in doubt, do not promote.** The archive stays searchable either way; a long index is one nobody reads.
- **Superseded records stay in `records/`, marked as superseded.** Nothing is deleted. See §4 for why that rule exists.

> **`.squad/decisions.md` was retired on 2026-09-21** (Skyler's ruling; `docs/engineering-practice-improvements-plan.md` §8 and §10 item 4). It held four entries, all from 2026-07-21, while `records/` held 126 files — so the standing instruction to consult it returned a two-month-old picture and missed every decision made since July. Its content is preserved verbatim at `records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md`.

---

## 1. Process and testing

| Decision | Record |
|---|---|
| **A review brief names a code artifact, and the artifacts are enumerated per feature.** Design documents are a coordination surface, not a defect surface — ~50 findings came from code, 4 from documents. Agreement between two documents is not evidence. | `koopa-review-briefs-name-a-code-artifact.md` |
| **A baseline and its draft share one lifecycle: created together, destroyed together, written in one place.** Test the drop/abandon edge, not only the create edge, and assert the baseline rather than only the drafts. | `toad-a-baseline-and-its-draft-are-created-and-destroyed-together.md` |
| **Assert the complete sorted multiset of calls wherever two code paths can reach one endpoint.** A positive assertion (`toContain`) cannot see a duplicate, and a duplicate is the bug that lives in that blind spot. | `toad-exact-call-ledger-over-positive-assertions.md` |
| **A fake repository must mirror the real one's return semantics.** A hardcoded success return makes every round-trip assertion vacuous; a predicate copied from the implementation agrees with itself. A predicate gets a real-repo test; a branch gets a fake test. | `toad-fake-repositories-must-mirror-real-return-semantics.md` |
| **A call-site regression matrix needs an oracle and real per-call-site host shapes.** One host binding every input with `?? ''` fallbacks supplies the defaults instead of exercising them. | `toad-a-call-site-regression-matrix-needs-an-oracle-and-real-host-shapes.md` |
| **The endpoint harness gives each request its own connection, and concurrency round counts are measured against a mutant, not guessed.** A 500 from an ADO.NET data race is indistinguishable from the application 500 a race test exists to refute. | `toad-api-harness-concurrency-and-measured-round-counts.md` |

## 2. Backend and API shape

| Decision | Record |
|---|---|
| **Membership is its own resource, never a field on the entity.** House precedent is weapon tags. Never put membership in an `Upsert*Request` body — whole-collection PUT semantics would unlink everything on the next save. | `yoshi-mystery-entity-linking-membership-as-resource.md` |
| **A race guard discriminates on whether the desired state obtains, not on a vendor error code.** Catch `DbUpdateException`, detach the entry, re-check. A `PostgresException { SqlState: "23505" }` filter is dead code under SQLite-backed tests; a blanket swallow is strictly worse than the 500 it replaces, because a false 204 is a lie downstream code builds on. | `boo-mystery-entity-linking-phase1-security-review.md`, `bowser-mystery-entity-linking-phase1-link-verb.md` |
| **Backend query logic stays provider-agnostic because the test fixture is SQLite and production is Postgres.** Hit twice independently: search declined `EF.Functions.ILike`, and the link guard declined a SQLSTATE filter. | `bowser-search-phase1-backend.md` |
| **Two verbs with the same HTTP shape can have opposite semantics — name the method for what it does.** M:N membership `PUT` *adds*; a required 1:N re-parent `PUT` *moves*, and moves silently against a stale id. Hence `MoveToMonsterAsync`, not `LinkToMonsterAsync`. | `bowser-minion-reparent-verb.md` |

## 3. The mystery wizard (and any wizard built on it)

| Decision | Record |
|---|---|
| **Submission happens at phase transitions, not at the end.** Preserved deliberately by decision 15 of the entity-linking work, which widened a state's scope rather than touching navigation. | `luigi-mystery-create-wizard.md` |
| **Sub-item lists use `signal<T[]>`, not FormArrays.** | `luigi-mystery-create-wizard.md` |
| **The minion step is optional.** *Invisible from 2026-07-25 to 2026-09-21 — see §4.* | `luigi-mystery-create-wizard.md` |
| **Decompose by phase, not by step. The store owns navigation, submission state and accumulated drafts; ReactiveForm instances stay in phase components. No NgRx.** **Limited supersession (2026-09-14):** a draft that is submitted once may own its form (`HunterDraft`). The rule still stands for anything submitting in separate phases. | `luigi-mystery-create-frontend-decomposition.md`; supersession in `luigi-mystery-create-wizard-2026-07-21-decisions-md.md` |

## 4. UX and copy

| Decision | Record |
|---|---|
| **An entity-then-batch write that partially fails is a success with a caveat, never an `error:`.** Routing it to `error:` leaves the user on a populated create form whose only control makes a duplicate, and unmounts the form on detail pages. The copy hedges, because an errored `forkJoin` tells you one call failed and never that all did. There is no warning severity — spend `.error()` on it. | `rosalina-partial-failure-copy-entity-linking.md` |

## 5. Design system

| Decision | Record |
|---|---|
| **Token→utility naming uses Tailwind v4's `@utility` directive.** No token is renamed; the fix is additive in `styles.css`. | `luigi-theming-token-utility-mechanism.md` |
| **Type badges keep their hue family across light and dark.** They are a memorised cross-app legend and the theme toggle re-colours live, so a hue swap would make a badge appear to change identity mid-toggle. | `rosalina-dark-theme-palette.md` |
| **`.entity-link` is the app's cross-domain anchor style.** Tailwind preflight reset anchors and nothing re-established them; this is the only anchor style the app has. | `rosalina-cross-domain-link-style.md`, `luigi-cross-domain-link-style-implementation.md` |

## 6. Domain

| Decision | Record |
|---|---|
| **Completeness is derived, never stored or enforced.** Partial hunters are savable. The generalisation — raise ceiling and minimum by a delta and the existing completeness list becomes the to-do — is worth checking first whenever a feature "grants" picks. | `yoshi-hunter-playbooks-hunter-completeness-partial-saves.md` |
| **The playbook extraction pipeline is formalised, and the catalogue's purpose is settled.** | `yoshi-hunter-playbooks-pipeline-formalized-catalogue-purpose.md` |

## 7. Standing, but recorded in a document rather than a record

| Decision | Where |
|---|---|
| **No per-user data ownership. No `owner_id`, no `ICurrentUser`, no EF global query filters — a deliberate, documented exclusion.** Consequence worth knowing before writing a security finding: IDOR findings on domain routes are non-findings here. `LinkToMysteryAsync` is the first write verb that joins two objects, so if ownership ever lands it needs a two-sided check. | `docs/simple-authentication-update/architecture.md:601`; consequence in `boo-mystery-entity-linking-phase1-security-review.md` and `mystery-entity-linking.md` §12 F8 |

---

## 8. Not judged — left in the archive deliberately

These were not promoted and were **not** ruled historical either. Nobody has read them closely enough to say whether they still bind. Listed so the gap is visible rather than implied.

- `yoshi-bug2-wizard-phase-resubmission.md` + `yoshi-bug2-wizard-resubmission-resolved.md` — a resolved wizard bug sitting directly adjacent to the phase-transition backbone in §3. If its resolution imposed a standing rule on resubmission, that rule belongs above.
- The ~15 `*-required-fields-validation.md` records (five entities × Yoshi/Luigi/Bowser) — unclear whether they encode a standing validation convention or five sets of per-entity implementation notes.
- `luigi-name-description-reference-tables.md` — reads like a standing schema convention.
- `bowser-monster-archetypes.md`, `luigi-monster-archetype-ui.md` — unclear whether the archetype model is settled or has been superseded.
- `luigi-theming-reference-directive-evaluation.md` + `yoshi-theming-reference-directive-evaluation.md` — an evaluation by two authors; outcome and whether they agree were not established.
- `luigi-favicon-logo-mark.md` — likely standing, but an asset decision rather than a rule.

**One citation cannot be resolved.** `luigi-theming-token-utility-mechanism.md` (promoted in §5) states that it supersedes `luigi-theming-phase1-utility-name-stutter.md`. No such file is in `records/` and git has no record of it ever being committed. The superseding decision stands on its own; the superseded one is simply absent.

---

## 9. Why "superseded records stay, marked"

Not a preference — a repair. On **2026-07-25** (`986e52d`) a merge compressed **three** records totalling **405 lines** into the **29 lines** of `decisions.md` and **deleted all three**. It also dropped one decision outright: *"the minion step is optional"* survived nowhere, and stayed invisible through the multi-minion work and through decision 19 of the entity-linking feature — which is the same question one step over.

All three were recovered from git on 2026-09-21 and are back in `records/`:

| Record | Lines | Left a dead citation? |
|---|---|---|
| `luigi-mystery-create-frontend-decomposition.md` | 261 | yes — 2 pointers |
| `luigi-mystery-create-wizard.md` | 74 | yes — 1 pointer |
| `luigi-armor-support.md` | 70 | **no — nothing ever cited it** |

Three citations that had pointed into the void since July now resolve again: `.squad/orchestration-log/2026-07-21-202001-Luigi.md` (two) and `.squad/skills/angular-wizard-decomposition/SKILL.md` (one).

**The third record is the worst case, and it is the one that took two passes to find.** A destroyed record that something *cites* announces itself the moment anyone follows the link. A destroyed record that nothing cites is gone silently and permanently — there is no symptom at all. `luigi-armor-support.md` sat in that state for two months. Dead-link checking finds only the cited casualties; it is a floor, not a measure.

### The recovery reproduced the failure it was repairing

The first pass enumerated the deletion set with a **filename pattern encoding what the searcher expected to find** — a glob for *mystery-create* against the records directory. The armor record is *about* the mystery-create wizard but is not *named* for it, so it did not match, and the loss was reported as two records and 335 lines. The commit's own deletion set — `git show --diff-filter=D 986e52d`, one command — gives three and 405.

That is §1 of this file (*derive the count, never write it down*) being broken in the act of writing this file. It is kept here rather than in a report because it is the same shape as the incident: **both were a summary standing in for the thing it summarised.** When you need a set, ask the artifact that defines it, never a pattern that resembles it.

That is what a drain costs, measured on this repository. It is why `records/` is an archive and not a queue, and why this file is an index and not a summary.
