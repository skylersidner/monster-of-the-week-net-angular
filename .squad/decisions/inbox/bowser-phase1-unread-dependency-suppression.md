# Phase 1 Lands `ICustomMoveService` Unread in Five Services, and Suppresses CS9113 Rather Than Deleting the Parameter

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-10-11
**Status:** **Settled by Skyler, 2026-10-11** — *"Keep the supression. Go ahead with Phase 2."* — and
recorded as **§16.4 D4** of `docs/domain-custom-moves/architecture.md`. Landed in `64e9826` (Phase 1,
commit 2 of 2) on branch `custom-moves`. Amends
`bowser-domain-custom-moves-route-constraint-and-sweep.md`'s D1 split with the one thing that split did not
survive contact with the compiler. **Carries a removal obligation on Phase 2.**

> **This was my judgement call when I filed it and is now his ruling.** I reported the suppression as a
> divergence from my own plan, named its cost (the codebase's first hand-written `#pragma warning`), and
> offered to reverse it by moving the five parameters to Phase 2. He kept it. Nothing below changes — the
> reasoning is the reasoning the answer was given on — but the *status* of the trade does: it is no longer
> mine to re-litigate, and the only thing still open is the Phase 2 removal.

## What

`ICustomMoveService` is a constructor dependency of `MysteryService`, `MonsterService`, `MinionService`,
`LocationService` and `BystanderService` as of Phase 1, and **none of the five reads it** — Phase 1's whole
premise is that nothing calls the new service. C# reports that as **CS9113, *"Parameter
'customMoveService' is unread"***, once per class, because all five use primary constructors.

The call: **keep the parameter, suppress the warning narrowly at each of the five**, with a comment naming
the phase and stating that Phase 2 deletes the *suppression* and not the parameter. The suppression is a
`#pragma warning disable CS9113` immediately above the class declaration and a `restore` immediately inside
it, so it covers the parameter list and nothing else.

Rejected: tolerating five new warnings for a phase; and deferring the parameter to Phase 2.

## Why

**The parameter is the point of the split, not incidental to it.** D1 split Phase 1 into a no-op commit and
a feature commit so that Phase 2's diff is behaviour and nothing else. If Phase 2 has to add the
constructor parameter, re-edit eight test factories and touch five production files before it writes a line
of behaviour, the split has bought a smaller Phase 1 and not a cleaner Phase 2 — which is backwards.

**It is also what makes the harness registrations real.** B-R1 is the top-ranked backend risk: the three
endpoint harnesses build their own `WebApplication`, so a missing `ICustomMoveService` registration is a
request-time 500 and not a build error, and the first test it breaks reads as a cascade bug. Registering in
Phase 1 only *pre-empts* that if something resolves the registration — which is exactly what an injected
constructor parameter does. Without it the registrations sit in three files unexercised until Phase 2,
which is the situation B-R1 describes.

**Why suppress rather than tolerate.** The obvious way to silence CS9113 is to delete the parameter, and
deleting the parameter is precisely the regression B-R1 is about. A bare warning is an invitation to make
that edit; a pragma with a reason is a tripwire that has to be read before it is removed. It also keeps the
build's warning count where it was (one pre-existing CS8603), so "build clean" stays a meaningful gate for
the next two phases instead of becoming "clean apart from the five we know about".

**Why not defer the parameter to Phase 2.** That costs all three benefits above to avoid a suppression, and
it leaves `FakeCustomMoveService` with no consumer in Phase 1 — a fake that nothing constructs is dead code
asserted by nothing, which is worse than a suppressed warning.

## The cost, stated plainly

This is **the codebase's first hand-written `#pragma warning`**. Every other one in the tree is inside a
generated `*.Designer.cs`. §22 declines to build a Swagger filter on exactly this reasoning — not worth a
new pattern in a phase whose point is subtraction — so introducing one here is a real trade and not a free
move. It is justified only because it is temporary and self-announcing.

**Phase 2 must delete all five suppressions.** They become stale the moment the detail projections call
`ListForProjectionAsync` and the delete flows call `DeleteAllForOwnerAsync`, and a stale suppression hides
the next genuinely-unread parameter. If Phase 2 lands without removing them, that is a defect in Phase 2.

## Where this is recorded

`docs/domain-custom-moves/architecture.md` §16.3 B1, as the first of the three ways Phase 1's second commit
diverged from its plan. Not recorded in §24, because it is not a standing risk once Phase 2 lands — it is a
debt with a named due date.
