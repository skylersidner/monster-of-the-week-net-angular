# Fake repositories in service tests mirror the real return semantics, and predicates get a real-database test

**By:** Toad (QA Tester)
**Date:** 2026-09-19

## What

Two rules for the backend test project, adopted while auditing Phase 1 of
`docs/updates/mystery-entity-linking.md`:

1. **A hand-written fake repository never hardcodes a success return for a method whose real
   implementation reports how much work it did.** All three `Fake*Repository` classes had
   `Unlink…FromMysteryAsync(…) => Task.FromResult(1)`, where the real repository returns
   `ExecuteDeleteAsync`'s row count. That made `UnlinkFromMysteryAsync` unconditionally `true` and
   every link/unlink round-trip assertion vacuous — the round-trip test passed against a fake that
   deleted nothing. Fakes now keep real backing state and return counts derived from it.

2. **A repository *predicate* is tested against the real repository and a real database; a service
   *branch* is tested against a fake.** Service-level fakes cannot falsify a predicate, because the
   fake's predicate is written by copying the implementation's. Transposing the two ids in all
   three real `…LinkedToMysteryAsync` methods left every one of the fifteen Phase 1 service tests
   green; only the new `Repositories/MysteryLinkRepositoryTests.cs` and
   `Controllers/MysteryLinkEndpointTests.cs` caught it.

## Why

**A test that passes against a broken implementation is worse than no test**, because it is counted
as coverage. Both rules come from mutation runs, not from taste: six mutants were applied to the
shipped Phase 1 code and reverted, and the two above were survived by the entire existing service
suite.

The second rule also has a specific target. `MonsterLinkedToMysteryAsync` shipped in Phase 7 with
**no production call site at all** and was reached only through a test fake that hardcoded `false`.
Phase 1 is the first change to depend on it. Speculative repository methods are exactly the
population where the fake and the implementation can disagree for a long time without anyone
noticing, and the M:N bridge tables give every one of them two same-typed `Guid` arguments that a
transposition will silently swap.

Phases 2 to 5 add membership reads to hydration, the `pendingRemovals` diff and the sub-resource
upsert — more predicates over pairs of `Guid`s, in the layer §5.4 identifies as the one where a bug
costs data rather than redundant writes. The rules are cheap now and get more valuable each phase.

## Not decided here

Nothing about production code. The race Bowser recorded as unguarded stays unguarded; it now has a
characterisation test (`DuplicateBridgeRow_ThrowsOnTheCompositeKey_RaceIsUnguarded`) that documents
today's behaviour so the trade becomes visible rather than enforcing a change to it.
