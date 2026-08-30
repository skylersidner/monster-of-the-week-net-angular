# Hunter Playbooks — The Curse-Eater: `PlaybookExtraTrack` + `BespokeJournal` Schema Additions

**By:** Yoshi (Architect)
**Date:** 2026-08-27

## What

Two new schema structures, both approved by Skyler as proposed:

1. **`PlaybookExtraTrack` / `HunterExtraTrackValue`** — for Curse-Eater's "Corruption," a fourth tracked numeric stat (7 boxes, "Okay"→"Lost") that isn't universal like Luck/Harm/Experience. **Additive only**: Luck/Harm/Experience stay exactly as already built (hardcoded fields on `Playbook`) — no migration, no rework. `PlaybookExtraTrack` is a new, separate table reused by any future playbook-specific track. Accepted, stated trade-off: Luck/Harm/Experience and Corruption are now modeled two different ways (3 hardcoded fields, 1 normalized table) rather than uniformly — deliberate, not an oversight, chosen because a full unification would cost a real migration against an already-"fully specified" Phase 2 schema for a consistency benefit not worth that cost with only one playbook needing the extra-track shape so far.
2. **`BespokeJournal` / `BespokeJournalField` (template) + `HunterJournalEntry` / `HunterJournalEntryFieldValue` (instance)** — for Curse-Eater's "Consumed Magic (Power, Downside)," a growing, player-authored entry list added to throughout play, not a fixed pick from a predefined option list. Genuinely doesn't fit `BespokeOption` (nothing predefined to select from, only a field shape — "Power" + "Downside" — that's fixed per playbook). `BespokeJournalField` is a real normalized child table so it generalizes past this one 2-field case. The instance side (`HunterJournalEntry`/`HunterJournalEntryFieldValue`) is the first Hunter-instance concept storing genuinely free-authored, growing content rather than a fixed selection from a template — a real departure from `HunterMove`/`HunterGearSelection`/`HunterBespokeSelection`, flagged as such when proposed rather than assumed.

Both reuse `BespokeSection`'s `Description`/`EffectText` role split rather than inventing new field names — first reuse of that pattern outside the table it was designed for.

**Content-fidelity split, resolved**: the source's one shared paragraph (explaining both Corruption and Consumed Magic at once) split three ways by what each clause actually instructs — Corruption's `Description` (the "you gain corruption" framing), Corruption's `EffectText` (the "repeated devouring"/"track is full" consequences), and `BespokeJournal.Description` (the "record what the magic was, the power, the downside" instruction, which is directly about the journal, not the track).

**Also confirmed**: "How Consuming Magic Works" is an ordinary, already-modeled Mission-shaped `BespokeSection` (real pick-1-of-5 list) — no new concept needed, distinct from both of the above.

## Why

Recommended additive-only for Corruption and a genuinely new parallel structure for Consumed Magic because forcing either into the existing shapes (a one-off column set for the former, `BespokeOption` for the latter) would have been a real category error or a repeat of exactly the ad hoc pattern Skyler was worried about recurring. Full reasoning: `docs/hunter-playbooks/architecture.md` ("Extra Tracks" section), `docs/hunter-playbooks/phase5-bespoke-ideation.md` (`BespokeJournal` section).
