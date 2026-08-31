# Hunter Playbooks — Partial Hunters Are Savable; Completeness Is Derived, Not Enforced

**By:** Yoshi (Architect)
**Date:** 2026-08-31
**Status:** Resolved and implemented. Full record in `docs/hunter-playbooks/architecture.md` Section 9 and the "Hunter completeness" section of `phases.md`.

## What

Skyler had earlier selected the strict option for bespoke pick counts ("a hunter can't be saved until every section is fully and correctly answered"), then delegated the direction outright — "have Yoshi make a decision to lean in one direction or the other and implement." **The earlier selection was reversed.**

**Decided: a hunter is savable and resumable at any stage**, with validation split into two tiers by *what the stored row asserts*:

| Tier | Rule | Behaviour | Home |
|---|---|---|---|
| Correctness | the row would assert something **false** about its playbook — a foreign pick, a duplicate, an advanced move, more picks than a ceiling allows, a value past a track's last box, a look line with both an option and text or neither | **refused, `400`** | `HunterService.Validate` |
| Completeness | the row is merely **unfinished** — no rating array, fewer move picks than `MoveGrantCount`, a gear category short of its `PickCount`, unanswered look lines | **reported, never blocks** | `HunterCompleteness.Evaluate` (new) |

Completeness surfaces as `HunterDetailResponse.Outstanding` — an ordered, human-readable list, empty when ready to play — recomputed on every read and never stored. The detail page renders it as a "Still to finish" panel, or a "Ready to play" badge when empty.

## Why

**The deciding argument**: hunters are live-linked to playbooks (`architecture.md` Section 3, Skyler's own 2026-08-25 correction), so *"every stored hunter satisfies its playbook's minimums" is not an invariant the database can hold*. A playbook edit falsifies it for every hunter built from that playbook without touching any of them. Strict save-time enforcement therefore buys a guarantee true only at the instant of the last write — and costs a hard lockout with no migration path: after such an edit the hunter cannot be saved at all, so its owner cannot fix a typo in its *name* without first finishing rules work. Since completeness has to be recomputed on read to be correct at all, blocking the write adds nothing but the lockout.

This was verified in the running app, not argued from the armchair: raising The Crooked's `MoveGrantCount` from 2 to 3 made an untouched, previously-complete hunter report "Moves: 2 of 3 picked." — and an unrelated rename still saved. Under strict validation that rename would have been refused.

Three supporting facts, measured against the dev database:

- **Nothing consumes completeness yet** — no play view, no dice roller, no rendered sheet. The guarantee would protect no reader today; the cost lands on the user immediately.
- **The wall is real**: The Crooked needs 1 rating + 2 moves + 3 gear + 2 look lines + 5 bespoke sections before anything persists. Across the 28: `MoveGrantCount` 2–4, non-optional gear picks 0–7, look lines 2–7, and 39 of 49 bespoke sections carry `MinSelect > 0`.
- **Authored data is not uniformly trustworthy** — Section 3 already documents that `MoveGrantCount == 0` cannot be distinguished from an unauthored Moves section, which is exactly the state an admin-created (Path B) playbook sits in. Strict minimums make such a playbook impossible to build a hunter from.

**Argument against, accepted rather than dismissed**: the database will hold hunters that are not legal characters, so every future consumer must cope with a hunter that has no rating array and no moves rather than trusting the row. That is a permanent tax on every downstream reader. It is mitigated only by the live link imposing nearly the same tax regardless.

## Why an explicit completeness concept rather than plain permissiveness

1. **The minimums are authored data with nowhere else to go.** All 39 pick-bearing bespoke sections carry `MinSelect > 0`; someone read those off the sheets on purpose. Pure permissiveness leaves the rules unrepresented anywhere in the software.
2. **Follow-on 10b needs a home for 39 more of them.** Defining the mechanism now makes 10b an extension of one tested evaluator rather than a fresh invention under time pressure — the failure mode being a second, subtly different notion of "done."
3. **Derived is the only shape that can be correct.** A stored flag would be silently falsified by a playbook edit. Section 6.4 already reached exactly this conclusion for bespoke category engagement ("always a derived fact, never a separately stored one"); this reuses that precedent instead of contradicting it.

## Deliberate boundaries

- **Extra tracks and Luck/Harm/Experience contribute nothing to completeness.** A missing value is indistinguishable from `0`, and `0` is a real starting position (the Curse-Eater's Corruption starts empty) — no answer is being withheld. Their ceilings are still enforced.
- **A gear category with a null `PickCount` owes nothing** — null means every option is granted outright, so there is no choice to leave unmade. Neither does an `IsOptional` category.
- **`Outstanding` is not on the list row.** It would need the full template graph for every distinct playbook in the list, to answer a question the user acts on only after opening the hunter. A "which of mine are unfinished" view later is a deliberate addition with a known cost, not an oversight.
- **`GetByIdAsync` makes two round trips**, reusing `GetPlaybookForValidationAsync` rather than widening the hunter query's includes — so completeness and validation read the *same* graph and cannot drift.

## Consequences worth acting on

- **Gear `PickCount` is now enforced server-side.** It previously existed only as the Angular form disabling checkboxes, which is not enforcement — a real gap in shipped Phase 10, closed.
- **The rating array is no longer required by the form.** The API always allowed null (Phase 10's judgement call for Path B playbooks); the form contradicted it.
- **Follow-on 10b's "minimums *and* maximums, enforced recursively" is superseded** — maximums to tier one, minimums to tier two. No schema change to the four instance-side tables.
- **A `computed()` reading a reactive form control's `.value` never recomputes**, because a form control is not a signal. `HunterFormComponent.isRatingUnchosen` was written that way and shipped stale until a spec caught it; it is now a plain method with the reason stated inline. The neighbouring computeds are safe only because every input they read *is* a signal.

## Verification

197 API tests (5 new) and 344 Angular tests (7 new, the hunters feature's first spec file). All three new API guards negative-tested individually, each failing exactly its own test and no neighbours; a fourth sabotage — restoring `Validators.required` on the rating control — failed exactly the three specs that assert the decision. Driven in a real browser in both themes, including the playbook-grows-a-requirement case above. Dev database restored to 28 playbooks / 0 hunters; a seed re-export came back byte-identical to the committed file.
