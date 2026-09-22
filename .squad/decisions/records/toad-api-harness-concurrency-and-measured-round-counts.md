# An endpoint harness that hosts concurrent requests owns a connection string, not a connection — and a concurrency test's round count is measured, not guessed

**By:** Toad (QA Tester)
**Date:** 2026-09-19

## What

Two rules for Kestrel-backed endpoint harnesses in `MonsterOfTheWeek.Api.Tests`, adopted while
closing the Phase 2 gate item in `docs/updates/mystery-entity-linking.md` §9.

1. **A harness that will ever serve two requests at once configures EF with a connection *string*,
   never a single open `SqliteConnection` instance.** The shipped idiom —
   `new SqliteConnection("DataSource=:memory:")`, opened once and handed to both
   `DbContextOptionsBuilder.UseSqlite` and `AddDbContext` — gives two in-flight requests two scoped
   `DbContext`s but one connection between them. Driving that connection from two threads corrupts
   its state: a 500 with no application cause, and a `NullReferenceException` inside
   `SqliteConnection.Close()` at teardown. Use a uniquely named shared-cache in-memory database,
   `DataSource=file:{guid:N}?mode=memory&cache=shared`, with one `keepAlive` connection held open
   for the harness's lifetime so the database survives between requests and dies with the harness.
   An on-disk temp file is the other correct answer and was measured; it costs
   `MysteryLinkEndpointTests` about ten extra seconds a run for no additional coverage, and it
   needs `SqliteConnection.ClearPool` — per connection string, never the process-global
   `ClearAllPools` — before the file can be deleted.

2. **A test that repeats an operation to catch a race states a round count that was measured
   against a build with the fix removed, and says so next to the constant.** A concurrency test
   that cannot fail on the bug it names is worse than no test, because it reads as coverage.
   `ConcurrentPutRounds = 25` killed a guard-deleted build on all three collections in 5 of 5 runs;
   the slower file-backed harness serialised the requests enough that the same count killed only
   one or two of three per run. If the count is ever lowered, re-measure it the same way.

## Why

`MysteryLinkEndpointTests` exercised sequential idempotency end to end but never two simultaneous
`PUT`s, which is the exact shape of the race Boo raised and Bowser fixed in the repository. Writing
that test against the existing harness produced a 500 — and the 500 came from the harness's own
ADO.NET data race, not from the API. That failure mode is the whole problem: a harness-generated
500 is indistinguishable from the application 500 the test exists to refute, so a concurrency test
on a single-connection harness cannot be believed in either direction. It has to be fixed before
the result means anything.

The round-count rule exists because the first version of the test passed on one collection and
failed on another against the *same* broken build. A probabilistic kill rate presented as a test is
how a race gets marked covered and then ships.

Both rules apply to `HunterApiHarness` too, which has the same single-connection construction. It
is not changed here — nothing tests it concurrently yet — but anything that adds a concurrent case
to it must change it first.
