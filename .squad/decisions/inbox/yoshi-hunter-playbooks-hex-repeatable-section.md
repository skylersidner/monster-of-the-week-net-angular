# Hunter Playbooks — The Hex's "Rotes": Repeatable `BespokeSection` (`MinInstances`/`MaxInstances`), Not `BespokeJournal`

**By:** Yoshi (Architect)
**Date:** 2026-08-28

## What

New schema for `BespokeSection`, approved by Skyler after rejecting an initial `BespokeJournal`-based proposal for The Hex's "Rotes":

```
BespokeSection
  ... (existing fields unchanged)
  MinInstances, MaxInstances (nullable ints, new) -- "how many times can this Section's whole option-tree be instantiated," same idiom as MinSelect/MaxSelect one level up

HunterBespokeSectionInstance (new table)
  Id, HunterId, SectionId (FK), Name (nullable), SortOrder

HunterBespokeSelection
  ... (existing fields unchanged)
  SectionInstanceId (nullable FK -> HunterBespokeSectionInstance, new) -- populated only for repeatable Sections
```

Every Section processed before Rotes: `MinInstances`/`MaxInstances` both `null` (concept doesn't apply, exactly one instance, current behavior unchanged, zero retroactive edits). Rotes: `MinInstances=0`, `MaxInstances=null` (unbounded — the source's worksheet has 8 printed blank Rote slots, confirmed to be a page-space artifact, not a stated rule cap). No changes to `BespokeOption` — Requirements (pick-2-of-5, title+description children) and Effect (3 mandatory die-result-keyed children, `DescriptionText = "{{blank}}"`) both fit the existing model exactly, verified directly against the source rather than assumed.

Deliberately no `IsRepeatable` boolean (derived from whether either bound is populated, consistent with this schema's "no `ShapeKind` enum" philosophy) and no bare `InstanceNumber` int on `HunterBespokeSelection` (rejected — no home for the per-instance free-text name, can't represent an in-progress zero-selection instance).

## Why

Full reasoning, both declined alternatives, and the Requirements/Effect fit verification: `docs/hunter-playbooks/phase5-bespoke-ideation.md` Section 3. Concrete application: `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` `## The Hex` → "Rotes". `.squad/agents/Yoshi/history.md` (2026-08-27/28 entry) has the full narrative, including why the rejected `BespokeJournal` framing conflated two separable properties ("grows over time" and "has no fixed structure") that happened to co-occur in the one prior case (Consumed Magic) that motivated `BespokeJournal`, and why the corrected direction needed less new schema than the rejected one.
