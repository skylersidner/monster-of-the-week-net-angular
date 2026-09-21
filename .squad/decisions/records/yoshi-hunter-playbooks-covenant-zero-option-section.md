# Hunter Playbooks — The Covenant: Zero-Option `BespokeSection` Degenerate Case

**By:** Yoshi (Architect)
**Date:** 2026-08-27

## What

The Covenant's fixed, always-active ability ("you have a knack for keeping allies safe... they return... at the start of the next mystery") has no picks at all, and is headed by the playbook's own name, not the nearby "Friendship" ruleset's title. Flagged as a genuine structural question rather than resolved unilaterally — two options presented: fold into Friendship's `EffectText` (my lean), or model as its own standalone `BespokeSection` with zero `BespokeOption` rows.

**Skyler's decision**: standalone zero-option `BespokeSection` — Title "Covenant", `Description` = the full paragraph, no options.

**Representation resolved**: `MinSelect`/`MaxSelect` = both `null`, not `0`/`0` — these fields mean "how many of my direct options must/may be picked," which doesn't apply when there are zero direct options; `null` already carries this "not applicable" meaning everywhere else in the schema (e.g. `BespokeOption.MinSelect` on a childless option). A consuming UI/API derives "render `Description` only, no pick control" directly from the empty `BespokeOption` child collection.

**Consequence stated for the instance side**: zero `HunterBespokeSelection` rows are ever needed for a zero-option Section — the Hunter has the ability unconditionally by virtue of the Playbook, the same shape as a `Required` Move needing no per-Hunter selection record.

**Not yet finalized**: `## The Covenant`'s actual catalogue entry (both `BespokeSection`s — "Covenant" and "Friendship") is pending Bowser's formatting extraction for the Covenant/Friendship column, dispatched in parallel by the coordinator. Only the schema/structural side is settled by this decision.

## Why

Chose to escalate rather than resolve silently because this content's positioning (under the playbook's own name, not the nearby ruleset's title) was a bigger reach for the existing `EffectText` field than either of its two validated cases (Fate, Unknown Heritage), both of which stayed within the same ruleset's own titled area — a structural choice here would set precedent for future eponymous-ability cases, worth Skyler's call rather than a unilateral extension.

Full detail: `docs/hunter-playbooks/phase5-bespoke-ideation.md` Section 3.
