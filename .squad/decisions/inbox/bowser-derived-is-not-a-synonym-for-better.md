# "Derived" Is Not a Synonym for "Better" — It Is Better Only When the Source Is Not the Subject

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-10-13
**Status:** Applied across U0–U3 of `docs/resource-images/endpoint-unification.md` (commits `d9fea56`,
`b07d07e`, `c44bb37`, `5244328`) and recorded as §16.3 item 4 of that document. Refines the
derivation-over-transcription preference established in `docs/domain-custom-moves/architecture.md`
§29.15; it does not reverse it.

## What

**Prefer a derived assertion over a transcribed one — except when the derivation's source is the thing
the assertion is about. Then transcribe, and pin the count.**

The house preference is right and most of this project's best guards come from it: the five-domain
drift spec, the segment cross-checks, the owner-matrix parameterisation. This records the one exception,
which came up **three times in four commits** and would have silently voided a guard each time:

1. **U0's Postgres data-contract test.** Wrote every enum member through EF, read it back as raw SQL,
   compared against `Enum.GetNames<DomainOwnerType>()`. Rename a member and all three move together.
   Control: with `Mystery` renamed, it **passed**.
2. **U1's four-owner endpoint matrix.** The obvious move was to parameterise the rows over
   `IResourceImageService.ImageOwnerTypes`. A member dropped from that set would then stop being
   seeded, stop being tested, and leave the suite green — the coverage shrinks instead of failing.
3. **U3's drift test.** `endpoint-unification.md` §6 specifies it as *"derived, from `ImageOwnerTypes`"*.
   Built that way it compares one declaration against two reflections of itself and cannot fail at all.

In each case the fix is the same shape: **at least one side of the comparison must be written by hand,
and a transcribed count must pin the size.** The count is not optional — every one of these guards also
passes vacuously on a consistently shrunken world, which is a different hole from the first and needs its
own number.

## Why

**Because derivation removes a maintenance burden by making two facts into one, and an assertion's whole
job is to check that two facts agree.** When those are the same two facts, the derivation has not made
the test cheaper to maintain; it has deleted the test while leaving it green.

The distinction that makes this operable without abandoning the preference:

> **Ask what the assertion is about.** If it is about *shape* — "these N things agree with each other" —
> derive every side you can from something *outside* the N. If it is about *the N themselves* — their
> count, their names, their stored representation — at least one side has to come from outside the code
> under test: a hand-written list, a raw-SQL literal, a fixture.

**A worked case, because the general rule is easy to nod at and still get wrong.** U3's guard compares a
route regex, a controller dictionary, and a declared `FrozenSet`. All three are hand-written. That looks
like three maintenance obligations and one missed opportunity to derive — and it is exactly why mutating
any one of them fails loudly. Deriving the dictionary from the set and the regex from the dictionary
would have reduced three transcriptions to one and reduced the guard to nothing.

**The secondary finding, which is the same error one level down.** A *rule* can be a transcription in
disguise. U3's segment convention was `name.ToLower() + "s"` — correct on all four image owners, wrong on
`Mystery` (`"mysterys"`, not `"mysteries"`), and therefore wrong as a rule while passing as a sample. It
would have fired a false failure the first time a `-y` domain got images. **If the derived side of a
comparison is a rule, test the rule separately against inputs the comparison never supplies** — otherwise
the rule is only as correct as the sample it happens to see.

## Cost

Transcriptions carry an obligation that does not appear in a diff. `IResourceImageService.ImageOwnerTypes`
is one line and cost a partition test, three drift assertions and a count pin, and it will cost a
paragraph of thought every time someone touches it. **A transcription with a guard is not equivalent to a
derivation; it is a derivation plus a maintenance obligation.** Pay it only where the alternative is a
test that cannot fail — which is narrower than it sounds, and was three places out of roughly a dozen
guards in this plan.
