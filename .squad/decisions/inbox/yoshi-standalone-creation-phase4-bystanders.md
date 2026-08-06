# Standalone Creation Phase 4 (Bystanders) — Architecture Decisions

**By:** Yoshi (Architect)
**Date:** 2026-08-05

**What:**
- **Independently re-verified Bystander's schema, contracts, controller/service, and both frontend pages fresh** rather than assuming Phase 3's Location conclusions applied — per my own explicit closing note in the Phase 3 doc, which this task was given as its instruction. The result: a **confirmed, evidence-backed match to Location's shape in every respect**, not an assumed one.
- **Bystander↔Mystery is genuinely M:N** via a `MysteryBystander` bridge table (no `MysteryId` FK on `Bystander` at all), identical to Location's and Monster's shape. Backend gap confirmed identical to Location's: `BystandersController.cs` has only the mystery-scoped `POST /api/mysteries/{mysteryId}/bystanders`, no top-level create — new `BystanderService.CreateAsync(UpsertBystanderRequest)` overload + `POST /api/bystanders` needed.
- **Bystander has no interactive sub-resources**, confirmed by reading `bystander-detail.html` directly (not inferred): its only child collection (`CustomMoves`) is rendered fully read-only, same as Location's and Monster's/Minion's custom moves. No draft-array/batch-submit machinery needed — single 3-field form, one API call.
- Entry point: top-level `/bystanders` list only — confirmed no second "known parent" context exists (Bystander's only relationship is to Mystery), same finding as Location, unlike Minion which had Monster as a genuine second context.
- Shared `BystanderFormComponent` wired into `bystander-detail.ts` in the same phase — decided directly, the fourth consecutive time this exact shape of decision has been answered identically (Phase 1, 2, 3, now 4).
- **Zero open questions for Skyler** — the second time this initiative has reached that outcome (after Phase 3), and the first time every dimension of a phase's design matched a prior phase's already-decided answer.

**Why:**
- The task's own framing (quoting my Phase 3 closing note back at me) was itself worth taking literally: "looks the same" and "confirmed the same" are different claims, and only re-deriving evidence for the new domain makes "no open questions" a checked conclusion rather than a second unchecked resemblance. Location itself was proof the resemblance heuristic can mislead (it looked like it might need Monster's sub-resource machinery by relationship-shape alone, and didn't) — so Bystander's independent check mattering wasn't about expecting a different result, it was about not letting a correct guess substitute for verification a second time.
- This is the cleanest test yet of the "structurally identical relationship shape → don't re-derive the same decision" principle first named in the Phase 3 doc: every one of this phase's Resolved Decisions cites either a direct prior-phase precedent or freshly-gathered evidence, none required a fresh judgment call. Worth remembering as the shape a "final phase of a repeated pattern" doc can legitimately take — a full verification pass with an empty decision surface, not a shortened or templated document.
- Confirmed one asymmetry worth flagging for implementation, not design: no `BystanderServiceTests.cs` exists today (`LocationServiceTests.cs` does) — the backend sub-phase needs a new test file, not just new test cases in an existing one.

**Docs:** `docs/updates/standalone-creation-phase4-bystanders.md`. This closes out the four-domain standalone-creation initiative (Monster/Minion/Location/Bystander all now have phase docs).
