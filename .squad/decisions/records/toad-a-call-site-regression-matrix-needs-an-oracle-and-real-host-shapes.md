# A call-site regression matrix needs an oracle, and hosts that bind what the real call sites bind

**By:** Toad (QA Tester)
**Date:** 2026-09-20

## What

Two rules for "prove this shared component's N existing call sites did not change," adopted while
doing the Phase 3 test pass for `docs/updates/mystery-entity-linking.md` §9.

1. **Compare the live render against a re-implementation of the previous template, not against a
   hand-written expectation.** `shared/confirm-delete-modal.call-sites.spec.ts` carries
   `renderedBeforeThisPhase(inputs)`, a pure function encoding HEAD's rules verbatim
   (`title → @if (message) → @if (items.length > 0) { <ul> … <p>{{ permanenceNote }}</p> }`), and
   asserts `renderedNow(element)` equals it for every call site expected to be unchanged. Whether a
   given call site changed depends on the interaction of four inputs, and a hand-written expectation
   gets that wrong in the same direction the code does.

2. **A test host must bind exactly the inputs its real call site binds — no more.** The first version
   of that spec used one host binding every input with `?? ''` fallbacks. It passed, and it was
   vacuous: it supplied the component's defaults from the spec instead of exercising them, so it
   **survived** a mutant that restored `footnote`'s old `'This cannot be undone.'` default — the exact
   regression Luigi's own decision note is about. Split into three hosts (name-only / message-only /
   footnote) mirroring the three real binding shapes, the same mutant is killed by 7 of the 8
   unchanged call sites.

A corollary for focus tests on the same kind of sweep: **drive the interaction from where the user
actually is, not from the most convenient element.** `shared/custom-select-escape-surfaces.spec.ts`
first pressed `Escape` from the select's trigger, which leaves `document.activeElement` on the trigger
whether or not the handler restores focus — vacuous on the 11 non-searchable instances, and 6 of 16
tests survived a focus-restore-deleted mutant. Pressing from the search `<input>` or the first option
button inside the open panel kills it 16 of 16.

## Why

Both failures share a shape: the test and the code agreed because the test had been written from the
same mental model as the code, so the assertion could not fail for the reason it existed. A mutant is
what exposes that, and in both cases the mutant was cheap (`perl -0pi` on one line, `cmp` to prove a
byte-exact restore).

> **Correction, 2026-09-21 (Bowser, R1c).** On the C# tree, `cmp` is not a sufficient restore check
> and this parenthetical should not be copied as though it were. A copy-restore preserves the
> source's `LastWriteTime`, leaving the restored file **older** than the assembly built from the
> mutant, so MSBuild skips the rebuild and the next `dotnet test` runs the mutant. `cmp` still
> passes, because it proves the bytes and says nothing about the build — which is precisely the
> silent-success failure mode this record exists to warn about, turned on the tool used to detect
> it. Reset the timestamp after restoring: `(Get-Item $f).LastWriteTime = Get-Date`. Full recipe in
> `README.md` → Testing.

The oracle rule also produced the useful by-product. Writing the previous template out as a function
forces you to enumerate the call sites, and enumerating them showed the count is **13 elements in 12
templates** — not the twelve of the architecture doc's §7.4 nor the fourteen of the UX doc's §7.5.
`monster-detail.html` and `minion-detail.html` have one instance each, not two; each reuses a single
dialog across all four sub-resource kinds via one `pendingDelete()` signal. Both documents should be
corrected. (`grep -c` counts matching *lines*; use `grep -o | wc -l`.)
