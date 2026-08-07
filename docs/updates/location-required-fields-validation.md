# Required-Field Validation — Location (Phase 4 of a Cross-Domain Initiative)

**Prepared by:** Yoshi (Architect)
**Status:** Decisions locked — Skyler answered both open questions "yes" (2026-08-06). Ready for implementation (Bowser + Luigi).
**Date:** 2026-08-06 (revised 2026-08-06)

> This is **Phase 4** of the repeatable required-field-validation initiative started in `docs/updates/mystery-required-fields-validation.md`, applied to Monster in `docs/updates/monster-required-fields-validation.md`, and to Minion in `docs/updates/minion-required-fields-validation.md`. The validation *mechanism* was decided in Phase 1 and is not re-litigated here: (1) DataAnnotations (`[Required]`, `[MaxLength]`, `[Range]`) on `Upsert*Request` DTOs for presence/shape, evaluated automatically by `[ApiController]`'s existing model-validation pipeline; (2) `ServiceResult<T>` + an `XxxExistsAsync` check in the service layer for FK existence. This document applies that mechanism to Location's own field list and FK audit. No C#/TypeScript files were edited to produce it — every claim below was checked against live source and, where the claim was about runtime behavior, against the actual running dev API (`docker compose` postgres already up — `motw-postgres`, healthy — and an already-running `dotnet run` instance on `http://localhost:5225`, confirmed live before testing; all test data created during verification was created via `POST` and deleted afterward via `DELETE`, confirmed gone with a follow-up check of `GET /api/locations`).

---

## Background — Confirmed From Current Source

### Location's relationship to Mystery is genuinely M:N via a bridge table, same shape as Monster — re-verified live, not trusted from the prior doc's prediction

`Location` (`Data/Entities/DomainEntities.cs:184-196`): `Id`, `LocationTypeId` (`Guid`, non-null FK), `Name` (`required string`), `Description` (`string?`), `CreatedAt`/`UpdatedAt` (server-set), plus navigation collections `Mysteries: ICollection<MysteryLocation>` and `CustomMoves: ICollection<LocationCustomMove>`. **No `MysteryId` FK on `Location` itself** — its only relationship to `Mystery` is the plain bridge table `MysteryLocation` (`DomainEntities.cs:260-267`: just `MysteryId`/`LocationId`, no extra columns), confirmed directly against the entity rather than trusted from `docs/updates/standalone-creation-phase1-monsters.md`'s or `docs/updates/standalone-creation-phase3-locations.md`'s prior descriptions of this shape. This matters for scope: unlike Minion's required 1:N `MonsterId`, Location has no equivalent required-FK-to-a-clear-parent question to ask — its only FK is `LocationTypeId`, a reference-data type, not a parent entity.

### Entity / DTO / migration inventory

- `Location` has exactly 3 own fields plus its FK and its one child collection — no sub-resource entities of any kind (no attacks/powers/armors/weaknesses, unlike Monster/Minion). Confirmed by reading the full entity, not assumed from the domain name. `LocationCustomMove` (`DomainEntities.cs:198-206`) is the only child: `Name` (`required string`), `Description` (`string?`), single required `LocationId` FK.
- DB fluent config (`Data/MotwDbContext.cs:229-252`) matches every entity's C# nullability exactly. **Both `Name` fields (`Location` and `LocationCustomMove`) carry `.HasMaxLength(255).IsRequired()`** — same cap shape as every other domain's `Name` fields. `Description` on both entities has no length cap (unbounded `text`) — **unlike Mystery's `Concept`, Location's `Description` has no DB-level length gap to close alongside the presence fix.** `LocationType.Name`/`.Motivation` (reference data, not this pass's subject) are unrelated and untouched.
- `UpsertLocationRequest` (`Contracts/ApiContracts.cs:216`): `string Name` (non-nullable), `string? Description`, `Guid LocationTypeId` — a plain record, **zero DataAnnotations attributes**, identical gap shape to every other domain's pre-fix `Upsert*Request`.
- `UpsertCustomMoveRequest` (`ApiContracts.cs:136`) is the same shared record fixed in Phase 2 (`[param: Required, MaxLength(255)] string Name`) — Location's custom-move endpoints (`LocationsController.cs:112-131`) already consume it. Live-verified below, not assumed.
- `LocationListItemResponse`/`LocationDetailResponse` (`ApiContracts.cs:196-214`) both carry `MysteryIds: IReadOnlyList<Guid>`, already `[]`-safe. Angular's `LocationDetailResponse`/`UpsertLocationRequest` in `core/models.ts` mirror the C# contracts field-for-field (confirmed by reading `LocationFormComponent`'s and `location-create.ts`'s usage, which type-check against them).
- **Location has no numeric fields at all** — no `HarmCapacity`-equivalent, no `Harm`/`HarmSoak`-equivalent anywhere in the entity or DTO. This is a genuine, load-bearing difference from Monster's and Minion's field lists: the `[Range(0, int.MaxValue)]` question both prior phases raised (and Skyler answered "yes" to, twice) **has no field to apply to here** — not deferred, not overlooked, structurally absent.

### Current server-side validation — precisely, not approximately, live-verified

- **`Name`'s blank/whitespace gap reproduces identically to every prior phase, live-confirmed.** `POST /api/locations` with `"name": ""` or `"name": "   "` (valid `locationTypeId`) both return **`201 Created`**, persisting a Location with `"name":""`. `"name": null` correctly returns **`400 {"errors":{"Name":["The Name field is required."]}}`** — `[ApiController]`'s implicit-required inference for the non-nullable reference type, the same free mechanism every domain gets, still only covering null/missing, not blank/whitespace. Both test rows were created and deleted during this pass.
- **A real, live-reproduced length-overflow gap on `Location.Name` itself, identical in shape to every prior phase's finding.** `POST /api/locations` with a 300-character `name` (DB cap 255) returns an **unhandled `500`** — live-reproduced; re-listing `GET /api/locations` afterward confirmed no partial row persisted (no name over 50 characters present in the list).
- **`LocationService`'s FK-existence checks are already fully correct for both of Location's FKs — confirmed live, not just by reading the code, and Location has no hand-rolled blank-check anywhere (unlike Minion's finding).** Read `LocationService.cs` in full: `CreateAsync(Guid mysteryId, ...)` checks `MysteryExistsAsync` (returns `ServiceResult.NotFound`) before checking `LocationTypeExistsAsync` (returns `ServiceResult.Validation`); the mysteryless `CreateAsync(request)` overload (added by Standalone Creation Phase 3's LC-1) checks only `LocationTypeExistsAsync`; `UpdateAsync` checks `LocationTypeExistsAsync` too. **All three write paths are already `ServiceResult<T>`-wrapped with zero raw-response methods** — Location never had Mystery's original "service doesn't use its own established pattern" gap. Live-verified three ways against `locationTypeId`: a nonexistent-but-syntactically-valid GUID → clean `400 {"message":"LocationType ... does not exist."}`; `Guid.Empty` → the same clean `400`; the field omitted entirely (binds to `Guid.Empty`) → the same clean `400`. **None of the three produces a 500.** This is the third domain in a row (after Monster, Minion) confirming the FK-existence half of this pattern was gotten right early and consistently in this codebase's service layer.
- **Unlike `MinionService`, `LocationService` has no hand-rolled `IsNullOrWhiteSpace(request.Name)` check anywhere** — read `CreateAsync` (both overloads), `UpdateAsync`, and `CreateCustomMoveAsync`/`UpdateCustomMoveAsync` in full; none of the five methods do anything beyond `.Trim()` on `Name` before persisting. The blank/whitespace gap here is a clean, single-mechanism gap (DataAnnotations-shaped, nothing else to remove first) — this phase does **not** repeat Minion's "migrate off a disfavored mechanism" cleanup step.
- **The shared `UpsertCustomMoveRequest` fix from Phase 2 already protects Location's own custom-move endpoints — live-reconfirmed here, the third domain (after Monster, Minion) to get this for free.** Created a real Location, then `POST /api/locations/{id}/custom-moves` with `"name": ""` and `"name": "   "` both returned a clean **`400 {"errors":{"Name":["The Name field is required."]}}"`** today, with zero new backend work needed. Test location and its would-be custom moves deleted afterward.

### Frontend inventory — the "different shape of surprise" the task asked me to check for, confirmed

- **Location's own standalone-creation pass (Phase 3 of that separate initiative) already shipped and is fully wired** — confirmed by reading the actual files, not the doc's summary: `features/locations/shared/location-form/` (`location-form.ts`/`.html`/`.spec.ts`), `features/locations/pages/location-create/` (`.ts`/`.html`/`.spec.ts`), both registered in `locations.routes.ts`, and `location-detail.ts`/`.html` already rewired to consume `LocationFormComponent` (per `.squad/decisions/inbox/luigi-location-form-component.md`). `LocationFormComponent` is the single shared core-fields form used identically by both pages, same shape as `MonsterFormComponent`/`MinionFormComponent`.
- **Location does NOT have the "missing `Validators.required` on a required FK" bug class both Monster's and Minion's phases found — this is the genuine, confirmed-live divergence the task's own framing anticipated might exist.** `LocationFormComponent`'s `locationForm` (`location-form.ts:35-39`) has `name: [Validators.required]` **and** `locationTypeId: [Validators.required]` — both present, matching every other layer's already-correct required-ness. This isn't a coincidence of Location's schema; it's a direct, documented consequence of how the form was built: `location-detail.ts`'s pre-existing form already had `Validators.required` on `locationTypeId` before the standalone-creation extraction (unlike `monster-detail.ts`'s/`minion-detail.ts`'s equivalents, which never had it on their type fields), and Standalone Creation Phase 3's own plan doc explicitly instructed preserving that shape field-for-field rather than "fixing" it to match Monster's/Minion's asymmetric precedent (`standalone-creation-phase3-locations.md` Resolved Decision 5; `luigi-location-form-component.md` judgment call 1). **No client-side FK-validator fix is needed for Location.**
- `location-form.html` (`shared/location-form/location-form.html`) has no `maxlength` attribute on the Name `<input>` and no visual required-field indicator (asterisk) convention anywhere — grepped the whole `features/locations/` tree for `text-danger">*` and `maxlength`, zero hits for either. Same gap shape Monster's/Minion's forms had pre-fix; Location's forms were built by Standalone Creation Phase 3 (same day as Minion's Phase 2, before Monster's asterisk-adoption revision landed), so — like Minion's — they never inherited the convention.
- `onSubmit()` (`location-form.ts:47-60`) trims `name`/`description` only after `locationForm.invalid` is checked — same "validator runs on the untrimmed live control value" shape every prior phase found; a whitespace-only Name currently passes client-side validation and, since there's no hand-rolled server check either (see above), is an unbroken end-to-end gap all the way to persistence, matching Mystery's/Monster's shape (not Minion's, which had a hand-rolled server catch even though the client passed it through).
- **Location has no sub-resource authoring UI of any kind — `location-detail.html:23-32` renders `CustomMoves` as a plain, read-only `<ul>` of names.** Confirmed directly (not assumed from the domain's field count): no add-form, no edit, no delete button bound to `LocationService`'s custom-move methods, matching Standalone Creation Phase 3's own finding. There is no client-side gap to find or fix in a custom-move authoring form here, because none exists to audit.
- **Confirmed the same latent-bug pattern every prior phase found, and confirmed it's live-reachable via the same blank-Name repro used above.** `location-detail.html:9` renders `<h2>{{ location()!.name }}</h2>` unguarded; `locations-list.html:19` renders `{{ location.name }}` as the entire list-row link's text, also unguarded. `Description` is correctly guarded (`{{ location.description || 'No description provided' }}`, list page) or simply omitted when absent. This is evidence the app already treats `Name` as implicitly required in practice, same reasoning every prior phase used — not a separate work item, closed as a side effect of the `[Required]` fix.

### Cross-domain note

`[ApiController]` is present on `LocationsController` (`Controllers/LocationsController.cs:7`), so the implicit-required/DataAnnotations mechanism is already active for `UpsertLocationRequest` today, matching every other domain. `LocationService`/`LocationsController`/`ILocationRepository` were read in full for this pass (Location is this phase's own subject), not spot-checked. `LocationServiceTests.cs` already exists (created during Standalone Creation Phase 3's LC-1, per `.squad/decisions/inbox/bowser-standalone-creation-lc1-backend.md`) — the backend fix here extends it, doesn't create a new file.

---

## Field-by-Field Recommendation

| Field | Current nullability (entity/DTO/Angular) | Recommendation | Rationale |
|---|---|---|---|
| `Location.Name` | non-null / non-null / non-null | **Required** — presence already effectively assumed everywhere it's rendered (unguarded `<h2>` in `location-detail.html:9`, entire link text in `locations-list.html:19`) | Add `[Required, MaxLength(255)]` to `UpsertLocationRequest.Name`. Closes the live-confirmed blank/whitespace-passes-through gap and the live-confirmed 300-char-name 500. |
| `Location.Description` | nullable throughout | **Stay optional.** No DB length cap (unlike Mystery's `Concept`) — there is no adjacent length gap to bundle in alongside the `Name` fix. | Always rendered with a fallback (`\|\| 'No description provided'`) or simply omitted; no evidence anywhere of an unguarded-render assumption. |
| `Location.LocationTypeId` | non-null `Guid` FK | **Already fully required and correctly enforced at every layer, client and server — no gap.** | DB `.IsRequired()`; `LocationTypeExistsAsync` checked and `ServiceResult<T>`-wrapped on all three write paths (both `CreateAsync` overloads, `UpdateAsync`), live-verified never to 500 on `Guid.Empty`/omitted/nonexistent. `LocationFormComponent.locationTypeId` already carries `Validators.required` — the one domain across all four phases where this exact bug class doesn't recur. |
| Mystery-scoped `CreateAsync`'s `mysteryId` (route param, not a DTO field) | non-null `Guid`, M:N optional attachment | **Already fully required and correctly enforced** on the mystery-scoped overload; not applicable to the standalone overload by design. | `MysteryExistsAsync` checked, returns clean `ServiceResult.NotFound`, matches Monster's identical M:N relationship shape. No gap. |
| `LocationCustomMove.Name` | non-null | **Already fixed.** | Shared `UpsertCustomMoveRequest`, fixed in Phase 2, live-reconfirmed here for Location's own custom-move create endpoint — blank/whitespace both cleanly `400` today, zero new work. |
| `LocationCustomMove.Description` | nullable | **Stay optional.** | No DB length cap; matches every other domain's equivalent field. |
| *(No numeric fields exist on Location)* | n/a | **N/A — not a gap, a structural absence.** | Unlike Monster's/Minion's `HarmCapacity`/`Harm`/`HarmSoak`, Location has zero `int` fields anywhere in its entity or DTO. The `[Range]` question both prior phases raised (and Skyler answered "yes" to twice) has no field to apply to in this domain — noted explicitly so its absence from this doc reads as verified, not overlooked. |
| *(No conditional-required field shape exists on Location)* | n/a | **N/A — not a gap, a structural absence.** | Unlike `MonsterArmor`/`MinionArmor`'s `SpecialDescription`-required-when-`IsSpecial` shape, Location has no sub-resource types at all beyond the already-fixed `CustomMoves` — there is no analogous conditional-required product question to ask here. |

---

## Recommended Validation Pattern

**Unchanged from Phases 1-3 — applied, not redesigned.** For Location, this phase's scope is the smallest of the four so far:

1. **Presence/shape of a scalar → DataAnnotations on the `Upsert*Request` record.** Add `[param: Required, MaxLength(255)]` to `UpsertLocationRequest.Name` — the **only** DTO field in this domain needing a new attribute. (`UpsertCustomMoveRequest.Name` is shared cross-domain infrastructure, already fixed in Phase 2, live-reconfirmed above — no change needed.)
2. **Existence/validity of a referenced entity → stays in the service layer via `ServiceResult<T>`. No changes needed for Location** — `MysteryExistsAsync` and `LocationTypeExistsAsync` are both already correctly wired, already `ServiceResult<T>`-wrapped on every write path, live-verified to never 500. Same "audit found nothing to fix" outcome Monster and Minion both had for this half.

**No cleanup step is needed this phase** (unlike Minion's hand-rolled-check removal) — `LocationService` never had a disfavored-mechanism workaround to begin with; the gap here is a clean, single-mechanism DataAnnotations gap.

**No `[Range]` question this phase** (unlike Monster's/Minion's three each) — Location has no numeric fields of any kind.

**No sub-resource-scope judgment call this phase** (unlike Monster's/Minion's four-plus-shared-custom-move sub-resource sets) — Location's only child collection is `CustomMoves`, already fixed via the shared DTO. There is nothing else to decide "in scope or its own phase" for.

---

## Architecture Discussion

### Why this phase is the smallest of the four, and why that's a real finding, not a shortcut

Every dimension that added scope to Monster's and Minion's passes is structurally absent from Location: no sub-resource `Upsert*Request` types beyond the already-fixed shared custom-move DTO, no numeric fields to raise a `[Range]` question, no hand-rolled service-layer workaround to migrate off of, and — the one genuine surprise — no missing client-side FK validator to fix. The net backend change is one DataAnnotations attribute on one field of one record. This mirrors the shape Standalone Creation Phase 4 (Bystander) found for its own initiative: a phase can legitimately conclude "smallest scope yet" once enough of a pattern's dimensions have been independently re-verified rather than assumed, and it's worth stating that plainly rather than padding this document to match the length of Phases 2/3.

### Why Location doesn't have Monster's/Minion's missing-FK-validator bug, and why that's not evidence Location is "more correct" as a domain

It would be easy to read "Location's form already has `Validators.required` on its FK, unlike Monster's and Minion's" as if Location's own engineering were more careful. The actual mechanism is more specific and less flattering to generalize from: `location-detail.ts`'s form pre-dated the standalone-creation initiative with `Validators.required` already present on `locationTypeId` (for reasons unrelated to this initiative — likely just that domain's original author included it), and Standalone Creation Phase 3's extraction explicitly preserved that pre-existing shape field-for-field rather than harmonizing it toward Monster's/Minion's asymmetric pattern (`standalone-creation-phase3-locations.md`'s own wording: "a real, deliberate difference... preserved as-is, not 'fixed' to match them"). The absence of a bug here is downstream of an extraction-fidelity decision made for an unrelated reason, not evidence that Location's original authors were auditing for this specific gap. Worth remembering for Bystander's phase (5): don't assume its form will or won't have this gap either way without checking directly, the same discipline this doc applied to Location itself.

### Why the FK-existence half being correct a third time in a row still needed re-verification, not extrapolation

Phase 2 (Monster) and Phase 3 (Minion) both confirmed their FKs were already correctly existence-checked; it would have been tempting to treat "Location's FKs are probably fine too" as inferable from that streak. This phase re-read `LocationService.cs` in full and re-ran the same three live failure shapes (`Guid.Empty`, omitted, nonexistent) against `locationTypeId` independently, rather than skipping the check because the pattern held twice before. It held a third time — but a streak is not a proof, and the value of re-checking is exactly the same regardless of how many times the prediction has previously come true (the same point Phase 2's Architecture Discussion made about re-verifying Phase 1's own prediction).

---

## Concrete UI Gaps Found

1. **Whitespace-only `Name` passes client-side validation and, unlike Minion's top-level `Name`, has no server-side hand-rolled catch either — a full end-to-end gap, live-confirmed identically to Mystery's and Monster's shape.** `location-form.ts`'s `name` control validates only against `Validators.required` on the untrimmed value; `LocationService` has no blank-check anywhere. The fix is the server's new `[Required]` attribute — the app's existing `errorMessage.set(...)`/`NotificationService.error(...)` handling in both `location-create.ts` and `location-detail.ts` already surfaces a 400 without new frontend code.
2. **No client-side `maxlength` guard matches the DB's 255-character cap on `Location.Name`** — `location-form.html`'s Name `<input>` has no `maxlength` attribute. Live-reproduced 500 on a 300-character paste.
3. **No visual required-field indicator (asterisk) convention anywhere in the Location feature**, despite `Name` (already required, soon server-enforced too) and `Location Type` (already required at every layer) both qualifying. Same gap Monster's Phase 2 revision fixed and Minion's Phase 3 revision fixed; Location's forms (built the same day as Minion's, before the convention existed) never inherited it either.
4. **Unguarded `{{ location.name }}` / `{{ location()!.name }}` renders** (`locations-list.html:19`, `location-detail.html:9`) — reachable today via the same live blank-Name repro used above; not a separate fix, closes as a side effect of gap 1's server-side `[Required]`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|---|---|---|
| `Description` has no DB length cap | Confirmed, not just assumed absent — no adjacent length gap exists to bundle in the way Mystery's `Concept` or (implicitly) every domain's `Description` fields don't need one. | No action needed — genuinely nothing to fix. |
| No numeric fields on Location | Structural absence, not an oversight — confirmed by reading the full entity/DTO. | No `[Range]` work applies to this domain; not carried forward as an open item. |
| No sub-resource conditional-required shape (no `SpecialDescription`/`IsSpecial` analog) | Structural absence — Location's only child type is `CustomMoves`, already fixed. | No action needed. |
| `mystery-detail.html`-scoped "Add Location" entry point | Pre-existing, deliberately deferred gap from Standalone Creation Phase 3 (Resolved Decision 10), consistent with Monster's identical deferral. Unrelated to and unaffected by this pass. | Unchanged — flagged only for completeness, not reopened here. |

---

## Open Questions Left to Skyler

1. **Should `[MaxLength(255)]` be bundled into the same change as `[Required]` on `UpsertLocationRequest.Name`, plus a matching `maxlength="255"` HTML attribute on `location-form.html`'s Name input?** Same question every prior phase has asked and Skyler has answered "bundle" three times running. **My lean: yes, same as all three prior phases** — same file, same mechanism, and this phase live-reproduced the identical 500-on-overflow evidence Monster's and Minion's own `Name` fields showed.
2. **Should Location's forms (`location-form.html`, shared by both `location-create.ts` and `location-detail.ts`) adopt the asterisk required-field-indicator convention now, matching Monster's and Minion's already-shipped state?** Same question Phase 2 and Phase 3 both asked, both answered "yes." **My lean: yes, same as both** — every required field in the Location feature (`Name`, and `Location Type`, which is newly worth marking now that it's the one domain where the FK validator was already correct) should get the same visual marker the other three domains now have, for cross-domain UI consistency. Since `location-form.html` is the single shared component, this is a one-file change covering both the create and detail pages at once.

No question about `[Range]` (no numeric fields exist to ask about) and no question about a conditional-required field shape (no `SpecialDescription`-equivalent exists) — both structurally absent from this domain, not silently dropped.

---

## Implementation Scope Summary (for Bowser/Luigi, once Skyler answers above)

**Unconditional (no open question blocks this):**
- `UpsertLocationRequest.Name` (`Contracts/ApiContracts.cs:216`) → add `[param: Required]`.
- No entity, migration, `LocationRepository.cs`, or `LocationsController.cs` changes — the FK-existence half of the pattern is already fully correct for both of Location's FKs (`MysteryId` on the mystery-scoped overload, `LocationTypeId` on all three write paths).
- No `LocationService.cs` cleanup needed — there is no hand-rolled check to remove, unlike Minion.
- `UpsertCustomMoveRequest` needs no change — already fixed in Phase 2, live-reconfirmed here for Location's own custom-move endpoint.
- No `LocationFormComponent`/`location-form.ts` validator change needed — `name` and `locationTypeId` both already carry `Validators.required`.

**Conditional on Skyler's 2 answers above (my lean is "yes, bundle/match precedent" on both):**
- Add `[param: MaxLength(255)]` alongside `[Required]` on `UpsertLocationRequest.Name`.
- Add `maxlength="255"` to `location-form.html`'s Name `<input>`.
- Add the `<span class="text-danger">*</span>` asterisk convention to `location-form.html` next to the `Name` and `Location Type` labels, matching Monster's/Minion's shipped pattern.
- New/updated `LocationServiceTests.cs` coverage (file already exists — extend, don't recreate): blank/whitespace `Name` rejected on both `CreateAsync` overloads and `UpdateAsync`, oversized (256+ char) `Name` rejected — mirroring Phase 2/3's test rigor.
- Update `location-form.spec.ts` if the app's existing spec convention asserts template markup for the asterisk (matches how Monster's/Minion's specs were updated in their own revisions); no new validator-touched-state assertion is needed since no validator is changing.

**Not in scope for this pass:** the deferred `mystery-detail.html`-scoped "Add Location" entry point (Standalone Creation Phase 3's own Known Gaps, unrelated to and unaffected by required-field validation); Bystander's own required-field pass (Phase 5, separate future phase, per the initiative's framing).

**Docs:** `docs/updates/location-required-fields-validation.md` (this document). See also `.squad/decisions/inbox/yoshi-location-required-fields-validation.md`.

---

## Revision — Skyler's 2 Answers Resolved (2026-08-06)

**By:** Yoshi (Architect)
**Date:** 2026-08-06

Both answered **yes**, matching the recommended lean and the 3-for-3 precedent from every prior phase — no scope changes:

| # | Question | Answer |
|---|---|---|
| 1 | Bundle `[MaxLength(255)]` + matching `maxlength="255"` HTML with the `[Required]` fix on `Name`? | **Yes.** |
| 2 | Adopt the asterisk required-field convention on `location-form.html` for `Name` and `Location Type`? | **Yes.** |

**Net implementation scope, now unconditional — smallest of the four phases:**

**Backend (Bowser) — `Contracts/ApiContracts.cs` + tests only:**
- `[param: Required, MaxLength(255)]` on `UpsertLocationRequest.Name` (`ApiContracts.cs:216`).
- No repository/controller/service changes, no cleanup step — both FKs already correct, no hand-rolled check to remove.
- Extend `LocationServiceTests.cs` (exists — don't recreate): blank/whitespace `Name` rejected on both `CreateAsync` overloads and `UpdateAsync`, oversized (256+ char) `Name` rejected.

**Frontend (Luigi):**
- `maxlength="255"` on `location-form.html`'s Name input.
- Asterisk convention (`<span class="text-danger">*</span>`, wrapped with label text per the established grid-label fix) on `Name` and `Location Type` in `location-form.html` — one shared file covers both create and detail pages.
- No validator changes needed — `name`/`locationTypeId` already both have `Validators.required`.
- Update `location-form.spec.ts` for asterisk-markup assertions if that's this codebase's established spec convention (per Monster's/Minion's revisions).

**Not in scope:** deferred `mystery-detail.html` "Add Location" entry point (pre-existing, unrelated); Bystander's own pass (Phase 5).

**Docs:** `docs/updates/location-required-fields-validation.md` (this document). See also `.squad/decisions/inbox/yoshi-location-required-fields-validation.md`.
