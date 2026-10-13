# A Test That Pins a Stored Representation Must Have One Side That Is Not Derived

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-10-13
**Status:** Applied in `DomainOwnerTypePostgresTests` on branch `image-endpoint-unification`, commit
`d9fea56` (U0 of `docs/resource-images/endpoint-unification.md`). Recorded in that document's §13 item 4.
Reverses nothing; sharpens the house preference for derived assertions, which is otherwise right.

## What

**When a test's subject is "the stored representation is still X", at least one side of the comparison
must not be derived from the thing that could change.** Everywhere else, derive both sides — the five-
domain drift guards, the route/dictionary/enum cross-checks and the segment-map comparisons are all
better for it, and nothing here argues with that. This is the one shape where deriving both sides makes
the test incapable of failing.

Concretely, `DomainOwnerType`'s five member names are literally the bytes in `custom_moves.owner_type`
and `resource_images.owner_type`, because both columns are `.HasConversion<string>()`. The test that
guards that fact has three halves, and only the first two are new practice:

1. a **transcribed** list of the five strings, compared against `Enum.GetNames<DomainOwnerType>()`;
2. rows **inserted as raw SQL using those literals**, then materialised through EF;
3. the derived round trip (write every member through EF, read it back as raw SQL), which is still worth
   having — it proves the converter writes names rather than ordinals.

## Why

**Because the obvious version cannot fail, and it was measured failing to fail.** The first version of
this test wrote all five members through EF, read them back as raw SQL, and compared against
`Enum.GetNames<DomainOwnerType>()`. Every side of that derives from the enum, so a renamed member moves
the written value, the read value and the expectation together. Control run, with `Mystery` renamed: the
derived test **passed**. So did `CustomMoveMigrationPostgresTests`, which round-trips a member through
real Postgres and is the nearest existing guard.

What did fail, once halves 1 and 2 existed, was both of them — and half 2 reproduces the production
failure verbatim rather than standing in for it:

```
System.InvalidOperationException : Cannot convert string value 'Mystery' from the database
to any value in the mapped 'DomainOwnerType' enum.
```

That was confirmed by disabling half 1 and re-running, so the two are known to fire independently rather
than assumed to.

**The general principle, stated so it transfers past enums.** A round trip through the same converter on
both ends proves the converter is a **bijection**. It does not prove its outputs are the values already
sitting in the table. Any test about an *existing* stored representation — a column's string values, a
serialised payload's field names, a cache key format, a migration's data shape — needs an input the
current code did not produce. Raw SQL, a fixture file, or a written-down list. A test that reads a fact
out of the code and then asserts the code agrees with it is a tautology no matter how many layers it
travels through on the way.

**The cost is real and it is small.** A transcribed list is a thing a reader has to maintain, which is
exactly what the house style avoids — so it carries a comment saying it is transcribed on purpose and
why nothing around it can do the job. One such list, sorted so member order stays free, against a data
contract that nothing else in the suite can see.
