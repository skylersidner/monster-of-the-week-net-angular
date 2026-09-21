# Mystery Entity Linking Phase 1 — security review passes; the race is not a security bug, but the reason recorded for leaving it is wrong

**By:** Boo (Web Security Specialist)
**Date:** 2026-09-19

## What

Phase 1 of `docs/updates/mystery-entity-linking.md` (§9) — the three membership `PUT`s — **ships as
is.** No blocking security finding. Three things are recorded alongside that verdict.

1. **Authorization coverage confirmed, by endpoint enumeration rather than by probe.** All three new
   routes register at exactly `api/mysteries/{mysteryId:guid}/{monsters|locations|bystanders}/{id:guid}`
   with **no `IAllowAnonymous` and no `IAuthorizeData`**, which is precisely the condition under which
   `AuthorizationMiddleware` applies the `RequireAuthenticatedUser` fallback policy (`Program.cs:90-91`).
   Across the whole controller surface — 124 endpoints — only `api/auth/login` and `api/auth/me` carry
   `IAllowAnonymous`. **A 401 on an anonymous request is not evidence of any of this** and must not be
   cited as such: `app.Map("/api/{**rest}")` (`Program.cs:213`) is deliberately not `AllowAnonymous`, so
   every `/api/...` string 401s anonymously whether it routes anywhere or not.

2. **The duplicate-key race is a robustness defect, not a vulnerability, and it is unreachable in
   Phase 1.** It yields 500 instead of 204; the composite PK still holds the data invariant, and
   production returns a generic `ProblemDetails` with no stack trace or SQL. Phase 1 ships with no
   client, so nothing can reach it until Phase 2. **It becomes a Phase 2 gate, not a Phase 1 gate.**

3. **`bowser-mystery-entity-linking-phase1-link-verb.md`'s stated reason for leaving it needs
   correcting in place.** That note gives the cost as "catching `DbUpdateException` ... inside a
   service layer that today knows only repository interfaces." That cost does not exist: the note
   then names the repository as the right home, and `Microsoft.EntityFrameworkCore` is already
   imported in all three repository files. The trade is fine; the reason recorded for it is not, and
   it is the reason a future reader will inherit.

## Why

**The decision that matters is *how* the guard is written, not whether.** Two ways to write it are
worse than the 500 it replaces:

- A blanket `catch (DbUpdateException) { return true; }` also swallows the **second**, equally
  unguarded TOCTOU in the same method — `MysteryExistsAsync`/`{Entity}ExistsAsync` pass, the mystery
  or entity is deleted concurrently, and the insert fails on the **foreign key**, not the primary
  key. Swallowing that returns 204 for a membership that does not exist, and §5.1 has the wizard
  trusting exactly that answer. A 500 is an honest failure; a false 204 is a silent lie.
- `catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })`
  is correct against production and **cannot be tested here**: `MysteryLinkRepositoryTests.LinkFixture`
  runs in-memory **SQLite**, which throws `SqliteException`. A guard that the one harness able to
  reach it cannot exercise is a guard nobody will notice breaking.

So: **re-check `…LinkedToMysteryAsync` inside the catch.** Row now present → the concurrent insert
won and 204 is the truthful answer. Row absent → rethrow, because the failure was not a duplicate.
Provider-agnostic, exercisable under the existing SQLite fixture, and it distinguishes the two races
by the property that actually matters (did the membership end up existing) rather than by a vendor
error code. Detach the `Added` entry before returning, so the abandoned insert cannot be retried by a
later `SaveChanges` in the same request.

`MysteryLinkRepositoryTests.DuplicateBridgeRow_ThrowsOnTheCompositeKey_RaceIsUnguarded` is the
characterisation test that flips when this lands — it already documents itself as asserting today's
behaviour rather than the desired one, which is the right shape.

## Not decided here

**No per-user data ownership exists in this app, by decision** (`docs/simple-authentication-update/
architecture.md:601`), and no domain entity carries an owner column. So "user A links into user B's
mystery" is not a boundary crossing today and is not a finding against this change. One forward-looking
property is worth having in the record, because it is new: **`LinkToMysteryAsync` is the first write
verb in this codebase that joins two objects.** Every other write touches one. If ownership ever
lands, this verb needs a **two-sided** authorization check — the mystery *and* the entity — and the
one-object guard idiom every other service uses will not supply it.
