# Decision: Armor Support in Mystery Create Wizard

**Date:** 2026-07-21  
**Author:** Luigi (Frontend Developer)  
**Status:** Implemented

> **Recovered and assessed 2026-09-21 (Koopa). Historical — not promoted to `.squad/decisions/README.md`.**
>
> **Provenance.** This record was destroyed on 2026-07-25 by `986e52d`, the merge that produced the since-retired `.squad/decisions.md`. It was one of three deleted that day (405 lines total) and the only one **nothing ever cited**, so its loss produced no dead link and no symptom of any kind — it went unnoticed for two months. Recovered byte-identical from `986e52d^`.
>
> **Why historical rather than standing.** It is an implementation log: its substance is a changelog of what was built, and the one rule it states — reuse the draft to form to signal to submission flow used by attacks, powers and weaknesses — is an *instance* of a decision already in the index (*sub-item lists use `signal<T[]>`, not FormArrays*), not a new one. Kept for the reasoning in **Alternatives Considered**, which is the only surviving record of why `isSpecial` / `specialDescription` exist on armor at all: parity with the monster detail page.
>
> **Superseded in part.** The `ArmorDraft` field list below is the 2026-07-21 shape and is **no longer current**. Decision 8 of the mystery-entity-linking work (2026-09-20, Phase 5a, `f8170eb`) gave all four sub-resource draft kinds `id` and `localKey`, and replaced the delete-all/recreate-all submission described here with a per-row diff against a response baseline. Read this section as history, not as the current contract.
>
> **One live fact about armor is recorded in no decision record, here or elsewhere** — flagged rather than invented: `MonsterArmorResponse.specialDescription` is optional while its minion twin is required, so a draft `''` compares unequal to an `undefined` baseline and marks an untouched armor dirty on every submit. Phase 5a fixed it with `sameNullableText`. It lives only in Luigi's history and the `f8170eb` commit body. If anyone ever writes the armor-shape record this one is mistaken for, that asymmetry belongs in it.

## Context

The mystery create wizard needed to support adding armor entries for both monsters and minions, matching the existing monster detail experience where armor can be managed post-creation.

## Decision

Implemented full armor support in the mystery create wizard following the established pattern used for attacks, powers, and weaknesses:

### Changes Made

1. **Store Layer** (`mystery-create.store.ts`)
   - Added `ArmorDraft` interface with fields: name, description, harmSoak, isSpecial, specialDescription
   - Added armor signals for both monster and minion (`monsterArmors`, `minionArmors`)
   - Added armor form groups (`monsterArmorForm`, `minionArmorForm`)
   - Added armor CRUD methods: `addMonsterArmor()`, `removeMonsterArmor()`, `addMinionArmor()`, `removeMinionArmor()`
   - Updated preview computeds to include armor arrays
   - Updated draft state to track armor collections
   - Modified `saveThreatCollections()` to submit armor via `monsterService.createArmor()`

2. **UI Layer** (`mystery-create-monster-phase.html`)
   - Added armor sub-items sections for both monster (step 0) and minion (step 1)
   - Form fields: name, harmSoak (number), isSpecial (checkbox), description, specialDescription
   - Displays armor entries with "Soak X" notation and special/regular descriptions

3. **Dossier Preview** (`mystery-create-dossier.html`)
   - Added armor rendering in both monster and minion preview sections
   - Shows armor name with harm soak value
   - Conditionally displays special vs regular descriptions

4. **Styling** (`mystery-create.scss`)
   - Added `.checkbox-inline` styles for the isSpecial checkbox
   - Added `.tag-count` styling for consistency

5. **Tests** (`mystery-create.store.spec.ts`)
   - Added `createArmor` mock to monsterService
   - Added test for independent armor draft management
   - Added test to verify armor is included in draft state collections

## Rationale

- **Pattern Consistency:** Reused the exact same draft → form → signal → submission flow as attacks/powers/weaknesses
- **API Compatibility:** Used the existing `UpsertMonsterArmorRequest` interface and `monsterService.createArmor()` endpoint
- **UX Alignment:** Armor appears in the same sub-items pattern, maintaining wizard visual consistency
- **Backend Contract:** The store correctly passes `harmSoak`, `isSpecial`, and `specialDescription` to match the API's expected payload

## Alternatives Considered

- **Omitting isSpecial:** Would have reduced UI complexity but wouldn't match the monster detail page
- **Separate armor phase:** Would have broken the existing flow where all monster attributes are collected in phase 1

## Consequences

- Users can now define armor during mystery creation instead of only post-creation
- Armor data flows through the submission pipeline alongside attacks, powers, and weaknesses
- The wizard now fully matches the capabilities available in the monster detail editing experience
- CSS budget warning increased slightly (7.60 kB vs 4 kB target) but within acceptable range

## Related Files

- `src/web/monster-of-the-week-web/src/app/features/mysteries/pages/mystery-create/mystery-create.store.ts`
- `src/web/monster-of-the-week-web/src/app/features/mysteries/pages/mystery-create/mystery-create-monster-phase.html`
- `src/web/monster-of-the-week-web/src/app/features/mysteries/pages/mystery-create/mystery-create-dossier.html`
- `src/web/monster-of-the-week-web/src/app/features/mysteries/pages/mystery-create/mystery-create.scss`
- `src/web/monster-of-the-week-web/src/app/features/mysteries/pages/mystery-create/mystery-create.store.spec.ts`
