# Decision: Armor Support in Mystery Create Wizard

**Date:** 2026-07-21  
**Author:** Luigi (Frontend Developer)  
**Status:** Implemented

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
