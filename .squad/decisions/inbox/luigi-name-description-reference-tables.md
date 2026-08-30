### 2026-08-30: Name + Description Reference Tables Share One Admin Component
**By:** Luigi (Frontend Developer) — requested by Skyler Sidner

**What:** Surfaced `adventure_types` and `monster_archetypes` in Data Admin. Rather than adding a third and fourth `isXSelected()` special case alongside weapon tags, split the reference tables by *row shape* and gave each shape one renderer.

- `ReferenceTypeTable` gained `AdventureTypes = 'adventure-types'` and `MonsterArchetypes = 'monster-archetypes'`.
- `models.ts` gained `NameDescriptionTable` (weapon tags + the two new tables) and `TypeRefTable = Exclude<ReferenceTypeTable, NameDescriptionTable>`, plus the shared `NameDescriptionRefResponse` / `CreateNameDescriptionRequest` shapes.
- `WeaponTagAdminComponent` was generalized into `NameDescriptionAdminComponent` (`@Input({ required: true }) table`), driven by a `TABLE_DESCRIPTORS` map holding the only things that differ per table: singular label, plural label, and Description `minLength`. The old weapon-tag component was deleted; its markup and copy carried over unchanged.
- `DataAdminPageComponent` now has exactly **one** shape branch (`selectedNameDescriptionTable()`), not one per table.
- `ReferenceDataService` gained `createAdventureType`, `createMonsterArchetype` (both clearing their cached `shareReplay` observable, matching `createWeaponTag`), plus `getNameDescriptionsByTable` / `createNameDescription` routers mirroring the existing `getTypesByTable` / `createType`. `getTypesByTable` and `createType` were narrowed to `TypeRefTable`, deleting their two `throw new Error(...)` runtime guards.

**Why:** The two new tables are Name + Description, identical in shape to weapon tags and unlike the four Name + Motivation `*-types` tables. Extracting the shape rather than adding branches means a future Name + Description table costs one descriptor entry, two service switch cases and one dropdown option — no new component and no new branch in the page.

Chose a shared *component* over a fully descriptor-driven single form because the two shapes differ in field name, payload key, validation copy and list column. Collapsing them into one generic form would have required rewriting the working Name + Motivation path for no user-visible gain; the Name + Motivation path is untouched.

**Guardrail:** `DataAdminPageComponent.isNameDescriptionTable` is written as an exhaustive `switch` over all seven enum members rather than a chain of `!==` comparisons, specifically so that `noImplicitReturns` fails the build if a future table isn't classified. Verified by negative control: planting a bogus enum member produces 3 x `TS2366` (that classifier plus both narrowed service switches). A `!==` chain would have compiled and silently routed the new table to the wrong form.

**Note for future edits:** the Description `minLength` is intentionally per-table (weapon tags 10, adventure types and monster archetypes 5) because the server-side `[MinLength]` differs. It is re-applied in `ngOnChanges` because the single `FormGroup` instance is reused across table changes. Do not replace it with a shared constant.
