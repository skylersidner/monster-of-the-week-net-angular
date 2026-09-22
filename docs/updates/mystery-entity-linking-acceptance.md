# Connecting Monsters, Locations and Bystanders to a Mystery — Acceptance Criteria

**Prepared by:** Peach (Product Owner / Business Analyst)
**Status:** **Phase 4 criteria, for the design review gating Phase 4.** Three gaps found and routed (§8); none of them blocks writing the tests for everything else.
**Date:** 2026-09-20

> Third companion to `docs/updates/mystery-entity-linking.md` (Yoshi — architecture, API, phasing) and `docs/updates/mystery-entity-linking-ux.md` (Rosalina — interaction and visual design). **Ownership rule, extending the one already agreed between those two:** what the software must *do* to be accepted lives here; *how* it does it lives in Yoshi's; *how it looks and reads* lives in Rosalina's. This document restates neither, and cites both rather than paraphrasing them.
>
> **Audience.** Toad turns §§3–5 into tests. Skyler reads §2 and §9 to judge "is this done?" without opening the architecture. Nothing here reopens a settled decision; where a criterion exists only because of a decision, the decision is cited so a future reader can tell a requirement from a preference.

---

## 1. Scope, and what is already accepted

Phase 4 ships **the wizard half of "connect an existing object to a mystery," for Locations and Bystanders only**: attach an existing one, re-edit any one that is in the mystery, and remove one through the Detach/Delete modal. Monsters wait for Phase 5 on the hard sequencing constraint in architecture §6.2; minions never gain an attach affordance at all (UX §2.5).

**Already shipped and already tested — do not restate these as Phase 4 criteria.** They are listed so the review can see the remaining gap rather than the whole feature.

| Shipped | Where | What it already covers |
|---|---|---|
| Phase 1 (`72ebc5c`) | Link verb | `PUT` succeeds, is idempotent in effect, 204 on repeat; unknown mystery or entity → 404; link/unlink round-trip; concurrent duplicate link leaves exactly one row. 36 endpoint tests. |
| Phase 2 (`2814168`) | Edit-form surface | Membership add / remove / both-in-one-save from a Location's or Bystander's own detail page; create page with zero, one and two mysteries selected; the hedged partial-failure copy and the post-save refetch that keeps a retry from 404ing forever (UX §9.5.2, D5). **The edit-form half of the ask is done.** |
| Phase 3 (`c9d554a`) | Modal and disclosure | `ConfirmDeleteModalComponent`'s input contract as built (UX §7.7) — `usage`/`usageMessage`, `footnote` unconditional with an `''` default, `secondaryLabel` + `(secondary)`, asserted block order, initial focus on the least destructive control, `Escape`, focus restore; usage disclosure on the three list pages; stable per-draft `localKey`. |

So Phase 4's criteria are about **which modal variant the wizard chooses, what the wizard does with the answer, and when.** The modal's own rendering is Phase 3's contract and is not re-asserted here.

---

## 2. The stories

**US-1 — Attach.** *As a Keeper building a mystery, I want to add a location or bystander I already made to the mystery I'm building, so a recurring place or person doesn't have to be retyped — and so it stays the same object everywhere it appears.*

**US-2 — Re-edit.** *As a Keeper, I want to edit any location or bystander that's in the mystery from inside the wizard, whether I wrote it here or pulled it in, so the wizard is the one place I work.*

**US-3 — Remove.** *As a Keeper taking a location or bystander out of a mystery, I want to choose between removing it from this mystery and deleting it for good, so a recurring character isn't destroyed by a tidy-up in one case.*

All three are scoped to Locations and Bystanders. Each has the same monster-and-minion twin in Phase 5, and the criteria below are written so that phase can inherit them by substituting the noun.

---

## 3. Attach an existing entity (US-1)

| # | Criterion |
|---|---|
| **A1** | The attach affordance appears on the Locations step (phase 2) and the Bystanders step (phase 3), in **both** create mode (`/mysteries/create`) and edit mode (`/mysteries/:id/edit`). |
| **A2** | It offers every catalogue entity of that type that is **not already in the roster**. Picking one appends a roster card immediately — no second click, no confirmation — the control resets to its placeholder, and the picked entity is no longer offered. |
| **A3** | Catalogue empty → the affordance is not rendered at all. Catalogue non-empty but entirely in the roster → it is rendered, and its empty state is reachable. *(Toad, 2026-09-19: `CustomSelectComponent` renders `emptyText` in the panel, not on the trigger — assert it where it actually is.)* |
| **A4** | **Attaching is local.** No HTTP request is issued on pick. Abandoning the wizard at this point leaves the mystery, the entity and their membership exactly as they were. |
| **A5** | **The load-bearing one.** Attach an existing location, press Next → `GET /api/mysteries/{id}/locations` now includes it. This is the silent no-op that architecture §5.1 Concern A describes, and it is the single criterion whose failure makes the feature worthless while looking like it works. |
| **A6** | An attached entity that was **not** edited has byte-identical field values after the phase submit. **Assert the values, not the absence of a request.** A no-op `PUT` of identical values is expected behaviour in Phase 4 (architecture §5.4: the derived dirty check is Phase 5, and only for monsters). A test written as "no `PUT` is issued" asserts a requirement this phase does not have. |
| **A7** | Re-entering a phase and submitting it again with no changes completes successfully. The repeated membership `PUT` returns 204 and must not surface an error. |
| **A8** | Attaching an entity that is already in another mystery leaves **one** catalogue row carrying both memberships — verify from the second mystery, not just from this one. This is decision 1 made observable. |
| **A9** | No monster attach affordance appears anywhere in Phase 4 (architecture §6.2), and no minion attach affordance appears ever (UX §2.5). |

---

## 4. Re-edit an associated entity (US-2)

| # | Criterion |
|---|---|
| **R1** | The edit affordance on **any** roster card — authored or attached, `id` null or set — loads that entity into the composer, marks the card as the one being edited, names it in the composer header, and on save writes back into the **same roster slot**. A saved edit never produces a second card. |
| **R2** | Cancel discards the composer's changes, leaves the roster untouched, clears the editing state, and raises no confirmation dialog (UX §2.4). |
| **R3** | Edit an attached entity, submit the phase, then open a **different** mystery that uses it: the change is there. **No warning, advisory or "this is shared" copy appears at any point in this flow** (decision 4, UX §9.4). A test that asserts the absence is worth writing once — this is the decision most likely to be "helpfully" undone later. |
| **R4** | Next with a valid uncommitted composer commits it and then submits the phase. Next with a started-but-invalid composer **blocks**, shows the phase's own blocked-composer message, and issues no request (UX §2.3). |
| **R5** | The composer collapses after a save; it is open when the roster is empty and collapsed behind the add-another control when it is not (UX §2.3, OQ2). |

---

## 5. The removal contract (architecture §7.1, UX §7.1)

### 5.1 Which choice is offered

| # | Criterion |
|---|---|
| **D1** | A draft that has never been saved (`id === null`) offers **Remove** only. No API call is ever made for it, in any circumstance. |
| **D2** | A draft with an `id` offers **Cancel · Detach · Delete**, in that order, **whether or not any other mystery uses it** (decision 10). Detach is not hidden when this is the entity's only mystery. |
| **D3** | The modal states how many other mysteries use the entity and names them; when there are none it says so explicitly rather than staying silent (UX §7.1 variants B and C). The count agrees with the list because both come from the resolved names (`shared/mystery-usage.ts`, Phase 3). |
| **D4** | Cancel records nothing and leaves the card in the roster. |

### 5.2 When it applies

| # | Criterion |
|---|---|
| **D5** | Confirming either choice removes the card immediately and issues **no HTTP request**. Nothing is unlinked or deleted until the phase submits (decision 12). |
| **D6** | Detach, then submit → the membership is gone; the entity is still in `GET /api/locations`; it is still in every other mystery that used it. |
| **D7** | Delete, then submit → the entity is gone from `GET /api/locations` **and** from every other mystery that used it. Verify the second mystery, not just this one — "removes it everywhere" is the whole difference between the two buttons. |
| **D8** | Confirm either choice, then abandon the wizard without advancing → **nothing is applied.** The entity and the membership are both intact. This is a feature, not a leak (architecture §7.3). |
| **D9** | Remove an entity and then re-attach the same one from the picker before submitting → the pending removal is cancelled; after submit the entity is still linked and still exists. **Assert this for the Delete disposition specifically**, not only Detach: a cancelled deletion that still deletes is the worst outcome in this feature. |

### 5.3 Replay, and the states the design accepts

| # | Criterion |
|---|---|
| **D10** | **Partial-failure replay.** Make the phase submit fail after some removals have landed, then press Next again: the phase completes. A 404 from a replayed detach or delete is treated as success (architecture §7.3 rule 2). This is Toad's named test and it is the reason rule 2 exists. |
| **D11** | **No replay after success.** After a phase submits successfully, re-entering that phase and submitting again issues **no** removal calls (rule 1). |
| **D12** | **Rule 2 is scoped.** A user-initiated delete elsewhere in the app that 404s still surfaces an error. The 404-as-success rule applies only when applying a recorded disposition. A test that proves the narrow scope is worth more than one that proves the rule. |
| **D13** | Membership changes made in the mystery picker on an entity's **own detail page** never raise this modal (UX §7.4). Shipped in Phase 2; listed here as a boundary, not as new work. |

### 5.4 Accepted states — expected behaviour, not defects

Stated as criteria so Toad asserts them deliberately rather than filing them.

| # | Expected behaviour |
|---|---|
| **S1** | **Usage disclosure can be stale.** `mysteryIds` is a page-load snapshot (architecture §7.2). If the entity's memberships changed elsewhere since the wizard loaded, the modal's count and names may be out of date. This changes the **wording only** — both Detach and Delete appear for any persisted draft regardless — so there is no branch to get wrong. Accepted. |
| **S2** | **Submitting a phase writes back the values loaded at page-open or attach.** An edit made to the same entity from another surface in between is overwritten. Pre-existing, single-user tool, deliberately not engineered against (architecture §5.1). |
| **S3** | **A phase submit is a fan-out, so "it failed" never means "none of it landed."** On failure the wizard stays on the phase and shows that phase's generic error; pressing Next again completes it (D10). The hedged "some of its mysteries may not have saved" copy is the **create and detail pages'** convention (UX §9.5) and is deliberately not imported into the wizard, where the retry is a button the user is already looking at. |
| **S4** | **Every roster draft with an `id` is written on every phase transition, touched or not.** Expected in Phase 4 and shipped behaviour today; the cure for the monster subtree version lands in Phase 5 (architecture §5.4). |
| **S5** | **Detaching an entity from its only mystery leaves a catalogue entity in no mystery.** That is a first-class state standalone creation already produces, not an orphan to be cleaned up. |

---

## 6. Explicitly out of scope for Phase 4

Listed because each is a plausible "while we're in here" and each has a reason on record.

- **Monsters and minions** — Phase 5. Attaching a monster from the wizard before the roster exists makes monsters 2..N invisible in the mystery's own editing surface (architecture §6.2).
- **A Detach button on `/locations` or `/bystanders`** — there is no mystery to detach *from* on a flat catalogue route (architecture §7.5). Those pages got disclosure in Phase 3 and that is the whole of their share.
- **Attach or detach from the mystery detail page** — follow-ups F1 and F2.
- **Undoing a confirmed removal before the phase submits** — not offered, and the copy is written so it is not implied (UX §7.3).
- **Mid-wizard draft persistence** — F4. A reload mid-wizard still loses the session, and now loses recorded dispositions with it.

---

## 7. Definition of done

Phase 4 is done when A1–A9, R1–R5 and D1–D13 hold; S1–S5 have been observed and accepted rather than filed as bugs; and the three items in §8 have each been either resolved or explicitly deferred by Skyler.

---

## 8. Gaps found — three, and none of them is a disagreement with a decision

Each is a state nobody specified or two decisions that do not compose. None needs a new decision from me; each needs a call from someone else, so the owner is named.

### G1 — In edit mode, a confirmed removal can be silently discarded by clicking the step tracker

**The composition.** Decision 12 says removals apply at the next phase transition. That is sound only if every way of leaving a phase is a phase transition, and it is not. `jumpToPhase` (`mystery-create.store.ts:900`) sets the phase directly and **does not submit**, and in edit mode `isPhaseAccessible` (`:909`) returns `true` for every phase unconditionally.

**The sequence.** Edit an existing mystery → Locations step → trash a location → confirm **Delete** → the card disappears → click the Bystanders bubble in the tracker → **Finish**. Phase 2 never submits. The wizard saves, navigates to the mystery detail page, and the location is still there, still linked, still in the catalogue. The user answered a destructive confirmation, watched the row vanish, and nothing happened.

**Why it is worth raising even though half of it is pre-existing.** The *mechanism* is old — today's unlink is discarded by the same path — but today's discarded action is "unlink," which is recoverable and unconfirmed. Phase 4 puts a confirmation dialog and the word **Delete** in front of the same gesture, and a confirmed destructive action that silently doesn't happen is a different class of problem from a lost unlink. `Back → Next` is fine, because it re-enters the phase and re-submits; the tracker jump is the only hole, and only in edit mode.

**Routed to Yoshi, with Rosalina on whichever answer wins.** Three shapes, all cheap, and I am deliberately not choosing: (a) a tracker jump out of a phase with pending changes performs that phase's submit, (b) it is blocked or warned, or (c) it is accepted and the modal's footnote stops promising that the change will be applied. (c) is the only one that costs nothing to build and the only one that makes the product worse.

### G2 — "…when you continue to the next step" is false on the Bystanders phase

The footnote in variants B and C reads *"Either way, the change takes effect when you continue to the next step."* Bystanders is `lastPhaseIndex`; its button says **Finish** (`mystery-create.html:34`), and pressing it submits and navigates out of the wizard to the mystery detail page. There is no next step. The sentence is the one thing standing between the user and the deferred-execution model, so it needs a last-phase variant — and, per UX §7.3's own rule, one that still doesn't say "this cannot be undone," because at the moment it is read it still isn't true.

**Routed to Rosalina**, who is in that file today. One string, in the section she is already editing.

### G3 — "Attached in this session, not yet submitted" is not a state the removal table has

**The composition.** UX §7.1 picks the variant from `id === null` versus `id !== null`, plus other-mystery usage. An entity attached from the picker has an `id` the moment it is attached. So attach a location by mistake, trash it one second later, and the modal offers **Detach** — against a membership that was never created, which is exactly the absent-membership `DELETE` that returns 404 (Toad, 2026-09-19; architecture §4.1) and gets swallowed by rule 2 — and **Delete**, which permanently destroys a catalogue entity the user only meant to un-attach. Architecture §7.3's "re-attaching cancels the pending removal" shows the design was thinking about this pair in the other order; this order was not covered.

The natural reading of trashing a card you added a moment ago is *undo the attach*, which is variant A's behaviour. The state is **already derivable with no new store state** — the entity's `id` is not in that phase's baseline (`existingLocationIds()`), which is precisely "attached or authored in this session and not yet saved."

**Routed to Rosalina (a fifth variant, or A extended) and Yoshi (whether the diff should key on the baseline rather than on `id`).** My product position, offered as input and not as a decision: removal of an entity that this mystery has never actually been linked to should be a plain **Remove** with no disposition recorded and no call made. Deleting the catalogue object stays available where it belongs, on `/locations`, with the disclosure Phase 3 just gave it.

### G4 — Minor, and listed only so it is not rediscovered

The attach picker's options are a page-load snapshot. Delete a location at the phase 2 submit, press Back, and the picker will still offer it; attaching it and submitting sends a membership `PUT` for a deleted entity, which 404s and fails the whole phase with the generic message. Rule 2's 404-as-success is tightly scoped to the removal path and deliberately does not cover a link. Low likelihood, nothing is destroyed, and the user can recover by removing the row. Worth one line of expected behaviour so Toad can assert *something* rather than discovering it: **the phase submit fails with its generic error and the wizard stays put.** If that is unsatisfying, dropping a deleted entity from the in-memory catalogue on a successful submit closes it — Luigi's call, not a design change.
