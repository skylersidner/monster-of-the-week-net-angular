### 2026-09-20: Flows that can issue two calls for one intention get an exact call ledger, not a pair of positive assertions
**By:** Toad (QA Tester)

**What:** Where a single user intention fans out into a batch of requests, the test asserts the **complete, sorted multiset** of calls that batch issues — not `toContain(the right one)` plus `some(...).toBe(false)` for the wrong one. Established for the Phase 4 wizard submits in `mystery-create-phase4-ledger.spec.ts`; the rule is meant to carry into Phase 5, where the monster subtree makes the fan-out an order of magnitude wider.

**Why:**

- **Phase 4 already produced the bug that lives in the blind spot.** A confirmed **Delete** issued two calls for one removal — the drain's `DELETE /api/locations/{id}` and `idsToRemove()`'s blind `DELETE /api/mysteries/{m}/locations/{id}` — racing inside one `forkJoin`. Luigi caught it, but only because he happened to write D7 as *"delete is issued **and** unlink is not"* rather than just the positive half.
- **Its twin was not protected, and is the worse one.** D6 (detach) asserts the unlink is present and no delete went out. Both stay true if the unlink is issued **twice**, which is exactly what the same regression does on the detach path. A duplicate delete is survivable — the drain maps 404 to success. A duplicate *unlink* is not: the second copy comes from the diff, which is not on the drain path and has no `catchError`, so it 404s and fails the whole phase with the generic error band. Reverting the four-character exclusion in `idsToRemove` kills four of the ledger tests, including D6. Luigi's own D6 passes.
- **The general shape: a positive assertion and a negative assertion are not the same as an exact one.** Two positives plus one negative still leave every call nobody thought to name. An exact ledger needs no one to have anticipated the wrong call — a duplicate is a second array element and fails the comparison, and a call for an entity the flow should not have touched fails it too.
- **It costs almost nothing.** The recorder is four lines; the expectation is the list you would have written in the comment anyway. The only real cost is that changing what a phase legitimately sends now fails a test — which is the point.

**Two mechanics that make it honest rather than decorative:**

1. **Record at `subscribe`, not at method invocation.** `defer(() => { sent.push(...); return result(); })`. `HttpClient` is cold, so a ledger written when the service method is *called* counts observables that were built and never subscribed — it over-reports, and an over-reporting exact assertion is worse than no assertion because it has to be loosened to pass.
2. **Sort both sides; never deduplicate either.** `forkJoin` gives no order worth asserting, so order must not be part of the contract. Multiplicity must be, since multiplicity is the whole point.

**Boundary, so the rule is not over-applied.** This is for batches where two different code paths can reach the same endpoint — the removal drain versus the baseline diff, the create-and-link versus the update-and-link. A single-call flow gains nothing from an exact ledger and loses readability. The test that identifies the criterion by name (`A6`, `D9`) is still the one that should name it; the ledger sits alongside as the one that cannot be fooled.
