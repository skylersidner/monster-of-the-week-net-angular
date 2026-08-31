# Hunter Playbooks — The Pararomantic: Relationship Status as `PlaybookExtraTrack` (Not a Bespoke Section), `PlaybookExtraTrack.StartLabel` Added, "Guide's Gift" Naming

**By:** Yoshi (Architect)
**Date:** 2026-08-28

## What

Skyler proposed merging two pieces of The Pararomantic's content into one bespoke Section named "Supernatural Guide": a "Relationship Status" tracker (embedded near Luck) and a set of item picks (embedded in Gear). Verified directly against the source and pushed back on both the merge and the name, both accepted:

1. **Relationship Status is `PlaybookExtraTrack`-shaped, not `BespokeSection`-shaped, and was modeled separately, not folded into any Section.** The source prints it as a plain labeled box-track ("Loving `bbbbbbb` Broken"), structurally identical to Luck/Harm/Corruption — zero pickable options. Forcing it into `BespokeSection`/`BespokeOption` (a structure fundamentally about option-picks) would repeat the exact category error `PlaybookExtraTrack` was invented to avoid for Corruption.
2. **New field, `PlaybookExtraTrack.StartLabel` (nullable string)** — every track before this one (Luck, Harm, Corruption) used the same generic "Okay" as its start label, so no field ever captured it. Relationship Status's start label ("Loving") carries real thematic meaning. `null` means "render the implicit Okay default"; every existing row, including Corruption, stays `null` with no retroactive change.
3. **The relocated Gear-embedded item-pick content is named "Guide's Gift," not "Supernatural Guide."** "Supernatural Guide" is already the playbook's own Required Move name — reusing it for the Section would create a genuine naming collision between two unrelated, differently-scoped concepts.

Net structure for The Pararomantic: 3 `BespokeSection`s (Guide's Gift, Bond Abuse, Fate of Your Love — the latter two zero-option, Covenant precedent) + 1 separate `PlaybookExtraTrack` (Relationship Status).

## Why

Full reasoning: `docs/hunter-playbooks/architecture.md` ("Extra Tracks" section — `StartLabel` addition), `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` (`## The Pararomantic`, including the in-entry note on the merge-proposal correction and the naming-collision catch). `.squad/agents/Yoshi/history.md` (2026-08-28 entry) has the full narrative, including why this is the first case where a stakeholder's own bespoke-Section-shaping proposal was directly overridden on architectural grounds rather than merely refined.
