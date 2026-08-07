# Required-Field Validation — Bystander (Phase 5 of a Cross-Domain Initiative, Final Domain)

**Prepared by:** Yoshi (Architect)
**Status:** Decisions locked — Skyler answered both open questions "yes" (2026-08-06), 5/5 and 4/4 on precedent. Ready for implementation (Bowser + Luigi) — the last implementation step in this five-phase initiative.
**Date:** 2026-08-06 (revised 2026-08-06)

> This is **Phase 5 — the final phase — of the repeatable required-field-validation initiative** started in `docs/updates/mystery-required-fields-validation.md`, applied to Monster (`docs/updates/monster-required-fields-validation.md`), Minion (`docs/updates/minion-required-fields-validation.md`), and Location (`docs/updates/location-required-fields-validation.md`). The validation *mechanism* was decided in Phase 1 and is not re-litigated here: (1) DataAnnotations (`[Required]`, `[MaxLength]`, `[Range]`) on `Upsert*Request` DTOs for presence/shape, evaluated automatically by `[ApiController]`'s existing model-validation pipeline; (2) `ServiceResult<T>` + an `XxxExistsAsync` check in the service layer for FK existence. This document applies that mechanism to Bystander's own field list and FK audit — the last domain in this initiative. No C#/TypeScript files were edited to produce it — every claim below was checked against live source and, where the claim was about runtime behavior, against the actual running dev API (`docker compose` — `motw-postgres`, healthy, already up — and an already-running `dotnet run` instance on `http://localhost:5225`, confirmed live before testing; all test data created during verification was created via `POST` and deleted afterward via `DELETE`, confirmed gone with a follow-up `404`).
>
> All four prior phases are fully shipped and committed as of this writing (`git log`: `689d484` Mystery, `5ca0e10` Monster, `ec64b9b` Minion, `983b3bd` Location) — confirmed by reading the current state of `ApiContracts.cs` directly rather than trusting the docs' "revision" sections, since a doc's stated final state and the actual shipped code aren't guaranteed to be the same thing until independently re-checked.

---

## Background — Confirmed From Current Source

### Bystander's relationship to Mystery is genuinely M:N via a bridge table, same shape as Monster and Location — re-verified live, not trusted from the task brief's prediction

`Bystander` (`Data/Entities/DomainEntities.cs:217-229`): `Id`, `BystanderTypeId` (`Guid`, non-null FK), `Name` (`required string`), `Description` (`string?`), `CreatedAt`/`UpdatedAt` (server-set), plus navigation collections `Mysteries: ICollection<MysteryBystander>` and `CustomMoves: ICollection<BystanderCustomMove>`. **No `MysteryId` FK on `Bystander` itself** — its only relationship to `Mystery` is the plain bridge table `MysteryBystander` (`DomainEntities.cs:269-276`: just `MysteryId`/`BystanderId`, no extra columns), confirmed directly against the entity rather than trusted from `docs/updates/standalone-creation-phase1-monsters.md`'s background grouping. This matches Location's and Monster's shape exactly, not Minion's required 1:N `MonsterId`.

### Entity / DTO / migration inventory

- `Bystander` has exactly 3 own fields plus its FK and its one child collection — no sub-resource entities of any kind (no attacks/powers/armors/weaknesses), matching Location's shape. `BystanderCustomMove` (`DomainEntities.cs:231-239`) is the only child: `Name` (`required string`), `Description` (`string?`), single required `BystanderId` FK.
- DB fluent config (`Data/MotwDbContext.cs:263-286`) matches every entity's C# nullability exactly. **Both `Name` fields (`Bystander` and `BystanderCustomMove`) carry `.HasMaxLength(255).IsRequired()`** — confirmed by reading the full block, not assumed. `Description` on both entities has no length cap (unbounded `text`) — same as Location, unlike Mystery's `Concept`.
- `UpsertBystanderRequest` (`Contracts/ApiContracts.cs:238`): `string Name` (non-nullable), `string? Description`, `Guid BystanderTypeId` — a plain record, **zero DataAnnotations attributes**, identical gap shape to every other domain's pre-fix `Upsert*Request`.
- `UpsertCustomMoveRequest` (`ApiContracts.cs:136`) is the same shared record fixed in Phase 2 (`[param: Required, MaxLength(255)] string Name`) — Bystander's custom-move endpoints (`BystandersController.cs:107-126`) already consume it.
- `BystanderListItemResponse`/`BystanderDetailResponse` (`ApiContracts.cs:218-236`) both carry `MysteryIds: IReadOnlyList<Guid>`, already `[]`-safe. Angular's equivalents in `core/models.ts` mirror the C# contracts field-for-field.
- **Bystander has no numeric fields at all** — no `HarmCapacity`-equivalent, no `Harm`/`HarmSoak`-equivalent anywhere in the entity or DTO. Same structural absence as Location; the `[Range(0, int.MaxValue)]` question Monster's and Minion's phases raised has no field to apply to here.

### Current server-side validation — precisely, not approximately, live-verified

- **`Name`'s blank/whitespace gap reproduces identically to every prior phase, live-confirmed.** `POST /api/bystanders` with `"name": ""` or `"name": "   "` (valid `bystanderTypeId`) both returned **`201 Created`**, persisting a Bystander with `"name":""`. `"name": null` correctly returned **`400 {"errors":{"Name":["The Name field is required."]}}`** — `[ApiController]`'s implicit-required inference for the non-nullable reference type, the same free mechanism every domain gets, still only covering null/missing, not blank/whitespace. Both blank-name test rows were created and deleted during this pass.
- **A real, live-reproduced length-overflow gap on `Bystander.Name` itself, identical in shape to every prior phase's finding.** `POST /api/bystanders` with a 300-character `name` (DB cap 255) returned an **unhandled `500`** — live-reproduced.
- **`BystanderService`'s FK-existence checks are already fully correct for both of Bystander's FKs — confirmed live, and Bystander has no hand-rolled blank-check anywhere (unlike Minion's finding, matching Location's).** Read `BystanderService.cs` in full: `CreateAsync(Guid mysteryId, ...)` checks `MysteryExistsAsync` (`ServiceResult.NotFound`) then `BystanderTypeExistsAsync` (`ServiceResult.Validation`); the mysteryless `CreateAsync(request)` overload (added by Standalone Creation Phase 4's BC-1) checks only `BystanderTypeExistsAsync`; `UpdateAsync` checks `BystanderTypeExistsAsync` too. **All three write paths are already `ServiceResult<T>`-wrapped, no raw-response methods anywhere.** Live-verified against `bystanderTypeId`: a nonexistent-but-syntactically-valid GUID → clean `400 {"message":"BystanderType ... does not exist."}`; `Guid.Empty` → the same clean `400`; the field omitted entirely (binds to `Guid.Empty`) → the same clean `400`; malformed empty-string → a clean `400` from JSON deserialization itself, before model binding completes. Also live-verified the mystery-scoped `CreateAsync`'s route-parameter `mysteryId` with a nonexistent GUID → clean `404`, no 500. **None of these produce a 500.** This is the fourth domain in a row (after Monster, Minion, Location) confirming the FK-existence half of this pattern was gotten right early and consistently in this codebase's service layer.
- **The shared `UpsertCustomMoveRequest` fix from Phase 2 already protects Bystander's own custom-move endpoints — live-reconfirmed here, the fourth domain (after Monster, Minion, Location) to get this for free.** Created a real Bystander, then `POST /api/bystanders/{id}/custom-moves` with `"name": ""` and `"name": "   "` both returned a clean **`400 {"errors":{"Name":["The Name field is required."]}}"`** today, with zero new backend work needed. Test bystander and its custom-move attempt deleted afterward.

### Frontend inventory — the FK-validator bug-class check the task explicitly flagged, confirmed either way rather than assumed

- **Bystander's own standalone-creation pass (Phase 4 of that separate initiative) is fully shipped and wired — confirmed by reading the actual committed files (`git log`: `61c5575 Creating Add Bystander flow`), not the plan doc's summary.** `features/bystanders/shared/bystander-form/` (`bystander-form.ts`/`.html`/`.spec.ts`), `features/bystanders/pages/bystander-create/` (`.ts`/`.html`/`.spec.ts`), both registered in `bystanders.routes.ts`, and `bystander-detail.ts`/`.html` already rewired to consume `BystanderFormComponent`. `BystanderFormComponent` is the single shared core-fields form used identically by `bystander-create.ts` (single-call submit, no draft arrays — Bystander has no interactive sub-resources) and `bystander-detail.ts` (immediate-mutation `update()` call).
- **Bystander does NOT have the "missing `Validators.required` on a required FK" bug class Monster's and Minion's phases found — confirmed live, matching Location, not Monster/Minion.** `BystanderFormComponent`'s `bystanderForm` (`bystander-form.ts:36-40`) has `name: [Validators.required]` **and** `bystanderTypeId: [Validators.required]` — both present. The component's own doc comment states this explicitly and deliberately: *"`bystanderTypeId` carries `Validators.required` here... it matches `LocationFormComponent` and differs from `MonsterFormComponent`/`MinionFormComponent`... and that difference is intentional."* This is the same root cause Location's phase traced: `bystander-detail.ts`'s pre-existing form already had `Validators.required` on `bystanderTypeId` before the standalone-creation extraction, and that extraction (`.squad/decisions/inbox/luigi-bystander-form-component.md`, judgment call 1) explicitly preserved the shape field-for-field rather than harmonizing it toward Monster's/Minion's asymmetric precedent. **No client-side FK-validator fix is needed for Bystander** — the second of two domains (of five) where this bug class doesn't recur.
- `bystander-form.html` has no `maxlength` attribute on the Name `<input>` and no visual required-field indicator (asterisk) convention anywhere — grepped the whole `features/bystanders/` tree for `text-danger">*` and `maxlength`, zero hits for either. Same gap shape every domain's forms had pre-fix.
- `onSubmit()` (`bystander-form.ts:48-61`) trims `name`/`description` only after `bystanderForm.invalid` is checked — same "validator runs on the untrimmed live control value" shape every prior phase found; a whitespace-only Name currently passes client-side validation and, since there's no hand-rolled server check either, is an unbroken end-to-end gap all the way to persistence — matching Mystery's/Monster's/Location's shape, not Minion's (which had a hand-rolled server catch even though the client passed it through).
- **Bystander has no sub-resource authoring UI of any kind** — `bystander-detail.html:20-31` renders `CustomMoves` as a plain, read-only `<ul>` of names, byte-for-byte the same markup shape as `location-detail.html`'s: no add-form, no edit, no delete button bound to `BystanderService`'s custom-move methods anywhere in the component. Confirmed directly, not assumed. `UpsertBystanderRequest` has exactly 3 fields — no sub-resource collections in the request shape at all.
- **The parked Mystery-creation wizard's own bystander-authoring step (`mystery-create.store.ts`) already has `Validators.required` on both `name` and `bystanderTypeId`** (`addBystanderForm`, lines 346-350) — checked directly since Minion's phase found a still-open gap in the wizard's own minion forms; Bystander's wizard-side form has no equivalent gap, and (since Bystander has no numeric fields) there's no harm-field analog to the `minionForm.harmCapacity`-shaped gap Minion's phase found and bundled. Nothing to fix here.

### Cross-domain note

`[ApiController]` is present on `BystandersController` (`Controllers/BystandersController.cs:7`), so the implicit-required/DataAnnotations mechanism is already active for `UpsertBystanderRequest` today, matching every other domain. `BystanderService`/`BystandersController`/`IBystanderRepository` were read in full for this pass (Bystander is this phase's own subject), not spot-checked. `BystanderServiceTests.cs` already exists (created during Standalone Creation Phase 4's BC-1, confirmed by `find`) — the backend fix here extends it, doesn't create a new file; current coverage (4 `[Fact]`s, all around `BystanderTypeId` FK-existence and standalone-create shape) has no blank/whitespace/oversized-`Name` cases yet.

---

## Field-by-Field Recommendation

| Field | Current nullability (entity/DTO/Angular) | Recommendation | Rationale |
|---|---|---|---|
| `Bystander.Name` | non-null / non-null / non-null | **Required** — presence already effectively assumed everywhere it's rendered (unguarded `<h2>{{ bystander()!.name }}</h2>` in `bystander-detail.html:9`, entire link text `{{ bystander.name }}` in `bystanders-list.html:19`) | Add `[Required, MaxLength(255)]` to `UpsertBystanderRequest.Name`. Closes the live-confirmed blank/whitespace-passes-through gap and the live-confirmed 300-char-name 500. |
| `Bystander.Description` | nullable throughout | **Stay optional.** No DB length cap — no adjacent length gap to bundle in. | Matches Location's `Description` treatment exactly; no evidence anywhere of an unguarded-render assumption. |
| `Bystander.BystanderTypeId` | non-null `Guid` FK | **Already fully required and correctly enforced at every layer, client and server — no gap.** | DB `.IsRequired()`; `BystanderTypeExistsAsync` checked and `ServiceResult<T>`-wrapped on all three write paths, live-verified never to 500 on `Guid.Empty`/omitted/nonexistent. `BystanderFormComponent.bystanderTypeId` already carries `Validators.required`, both in the standalone form and the wizard's own `addBystanderForm` — the second domain (after Location) across all five phases where the missing-FK-validator bug class doesn't recur. |
| Mystery-scoped `CreateAsync`'s `mysteryId` (route param, not a DTO field) | non-null `Guid`, M:N optional attachment | **Already fully required and correctly enforced.** | `MysteryExistsAsync` checked, returns clean `ServiceResult.NotFound`, live-verified `404` on a nonexistent mystery. Matches Monster's/Location's identical M:N relationship shape. No gap. |
| `BystanderCustomMove.Name` | non-null | **Already fixed.** | Shared `UpsertCustomMoveRequest`, fixed in Phase 2, live-reconfirmed here — blank/whitespace both cleanly `400` today, zero new work. |
| `BystanderCustomMove.Description` | nullable | **Stay optional.** | No DB length cap; matches every other domain's equivalent field. |
| *(No numeric fields exist on Bystander)* | n/a | **N/A — not a gap, a structural absence.** | Unlike Monster's/Minion's harm-related `int`s, Bystander has zero `int` fields anywhere in its entity or DTO. The `[Range]` question has no field to apply to in this domain — noted explicitly so its absence reads as verified, not overlooked. Same structural absence Location had. |
| *(No conditional-required field shape exists on Bystander)* | n/a | **N/A — not a gap, a structural absence.** | Unlike `MonsterArmor`/`MinionArmor`'s `SpecialDescription`-required-when-`IsSpecial` shape, Bystander has no sub-resource types at all beyond the already-fixed `CustomMoves` — there is no analogous conditional-required product question to ask here. Same structural absence Location had. |

---

## Recommended Validation Pattern

**Unchanged from Phases 1-4 — applied, not redesigned.** For Bystander, this phase's scope is the smallest possible shape, matching Location's:

1. **Presence/shape of a scalar → DataAnnotations on the `Upsert*Request` record.** Add `[param: Required, MaxLength(255)]` to `UpsertBystanderRequest.Name` — the **only** DTO field in this domain needing a new attribute. (`UpsertCustomMoveRequest.Name` is shared cross-domain infrastructure, already fixed in Phase 2, live-reconfirmed above — no change needed.)
2. **Existence/validity of a referenced entity → stays in the service layer via `ServiceResult<T>`. No changes needed for Bystander** — `MysteryExistsAsync` and `BystanderTypeExistsAsync` are both already correctly wired, already `ServiceResult<T>`-wrapped on every write path, live-verified to never 500. Same "audit found nothing to fix" outcome Monster, Minion, and Location all had for this half.

**No cleanup step is needed this phase** (unlike Minion's hand-rolled-check removal) — `BystanderService` never had a disfavored-mechanism workaround; the gap here is a clean, single-mechanism DataAnnotations gap, exactly like Location's.

**No `[Range]` question this phase** — Bystander has no numeric fields of any kind.

**No sub-resource-scope judgment call this phase** — Bystander's only child collection is `CustomMoves`, already fixed via the shared DTO.

**No client-side FK-validator fix needed this phase** — `bystanderTypeId` already carries `Validators.required` in both `BystanderFormComponent` and the wizard's `addBystanderForm`.

---

## Architecture Discussion

### Why Bystander is the second (not the first) domain confirming Location's "smallest scope" shape, and why that's still worth re-verifying rather than assuming

Location's own doc predicted this exact shape might repeat: "flag for Bystander's phase (5): don't assume its form will or won't have this gap either way without checking directly." This phase honored that literally — every claim above (M:N relationship shape, no sub-resources, no numeric fields, `bystanderTypeId`'s validator state, the FK-existence audit) was independently re-checked against Bystander's own source and the live API, not inferred from Location's resemblance. The result matches Location's shape in every dimension, but it's a second confirmed finding, not an assumption inherited from the first — the same distinction Standalone Creation Phase 4's own closing note drew about "looks the same" vs. "is the same."

### Why the FK-existence half being correct a fourth time in a row still needed re-verification, not extrapolation

Monster, Minion, and Location all independently confirmed their FKs were already correctly existence-checked. This phase re-read `BystanderService.cs` in full and re-ran the same failure shapes (`Guid.Empty`, omitted, nonexistent, malformed) against `bystanderTypeId` and `mysteryId` independently, rather than treating a three-domain streak as sufficient evidence. It held a fourth time — the value of re-checking doesn't diminish as the streak grows, the same point every prior phase's Architecture Discussion made about its own domain.

---

## Concrete UI Gaps Found

1. **Whitespace-only `Name` passes client-side validation and has no server-side hand-rolled catch either — a full end-to-end gap, live-confirmed identically to Mystery's, Monster's, and Location's shape (not Minion's).** `bystander-form.ts`'s `name` control validates only against `Validators.required` on the untrimmed value; `BystanderService` has no blank-check anywhere. The fix is the server's new `[Required]` attribute — the app's existing `errorMessage.set(...)`/`NotificationService.error(...)` handling in both `bystander-create.ts` and `bystander-detail.ts` already surfaces a 400 without new frontend code.
2. **No client-side `maxlength` guard matches the DB's 255-character cap on `Bystander.Name`** — `bystander-form.html`'s Name `<input>` has no `maxlength` attribute. Live-reproduced 500 on a 300-character paste.
3. **No visual required-field indicator (asterisk) convention anywhere in the Bystander feature**, despite `Name` (already required, soon server-enforced too) and `Bystander Type` (already required at every layer) both qualifying. Same gap Monster's, Minion's, and Location's phases each found and fixed; Bystander's forms (built the same initiative day as Location's, sharing that initiative's timeline) never inherited the convention either.
4. **Unguarded `{{ bystander.name }}` / `{{ bystander()!.name }}` renders** (`bystanders-list.html:19`, `bystander-detail.html:9`) — reachable today via the same live blank-Name repro used above; not a separate fix, closes as a side effect of gap 1's server-side `[Required]`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|---|---|---|
| `Description` has no DB length cap | Confirmed, not just assumed absent. | No action needed — genuinely nothing to fix. |
| No numeric fields on Bystander | Structural absence, not an oversight — confirmed by reading the full entity/DTO. | No `[Range]` work applies to this domain; not carried forward as an open item. |
| No sub-resource conditional-required shape (no `SpecialDescription`/`IsSpecial` analog) | Structural absence — Bystander's only child type is `CustomMoves`, already fixed. | No action needed. |
| No "attach an existing unattached bystander to a mystery" UI | Pre-existing gap from Standalone Creation Phase 4's own Known Gaps, shared with Monster's and Location's identical relationship shape. | Unrelated to and unaffected by this pass; flagged only for completeness. |
| `mystery-detail.html`-scoped "Add Bystander" entry point | Deliberately deferred (Standalone Creation Phase 4 Resolved Decision 10), consistent with Monster's and Location's identical deferral. | Unchanged, not this document's concern. |

---

## Open Questions Left to Skyler

1. **Should `[MaxLength(255)]` be bundled into the same change as `[Required]` on `UpsertBystanderRequest.Name`, plus a matching `maxlength="255"` HTML attribute on `bystander-form.html`'s Name input?** Same question every prior phase has asked and Skyler has answered "bundle" four times running (Mystery's `Concept`, Monster's/Minion's/Location's own `Name` fields). **My lean: yes, same as all four prior phases** — same file, same mechanism, and this phase live-reproduced the identical 500-on-overflow evidence every prior phase's own `Name` field showed. I'm noting the streak explicitly rather than treating it as a reason to skip asking — Skyler's own answer is still the one that governs, and a fifth "yes" is worth confirming fresh, not assuming.
2. **Should Bystander's forms (`bystander-form.html`, shared by both `bystander-create.ts` and `bystander-detail.ts`) adopt the asterisk required-field-indicator convention now, matching Monster's, Minion's, and Location's already-shipped state?** Same question the last three phases each asked, each answered "yes." **My lean: yes, same as all three** — every required field in the Bystander feature (`Name`, and `Bystander Type`) should get the same visual marker the other four domains now have, for cross-domain UI consistency. Since `bystander-form.html` is the single shared component, this is a one-file change covering both the create and detail pages at once.

No question about `[Range]` (no numeric fields exist to ask about), no question about a conditional-required field shape (no `SpecialDescription`-equivalent exists), and no question about a hand-rolled-check removal or a missing FK validator (neither gap exists in this domain) — all four structurally absent, not silently dropped.

---

## Implementation Scope Summary (for Bowser/Luigi, once Skyler answers above)

**Unconditional (no open question blocks this):**
- `UpsertBystanderRequest.Name` (`Contracts/ApiContracts.cs:238`) → add `[param: Required]`.
- No entity, migration, `BystanderRepository.cs`, or `BystandersController.cs` changes — the FK-existence half of the pattern is already fully correct for both of Bystander's FKs (`MysteryId` on the mystery-scoped overload, `BystanderTypeId` on all three write paths).
- No `BystanderService.cs` cleanup needed — there is no hand-rolled check to remove.
- `UpsertCustomMoveRequest` needs no change — already fixed in Phase 2, live-reconfirmed here for Bystander's own custom-move endpoint.
- No `BystanderFormComponent`/`bystander-form.ts` validator change needed — `name` and `bystanderTypeId` both already carry `Validators.required`, in both the standalone form and the wizard's `addBystanderForm`.

**Conditional on Skyler's 2 answers above (my lean is "yes, bundle/match precedent" on both):**
- Add `[param: MaxLength(255)]` alongside `[Required]` on `UpsertBystanderRequest.Name`.
- Add `maxlength="255"` to `bystander-form.html`'s Name `<input>`.
- Add the `<span class="text-danger">*</span>` asterisk convention to `bystander-form.html` next to the `Name` and `Bystander Type` labels, matching Monster's/Minion's/Location's shipped pattern.
- New/updated `BystanderServiceTests.cs` coverage (file already exists — extend, don't recreate): blank/whitespace `Name` rejected on both `CreateAsync` overloads and `UpdateAsync`, oversized (256+ char) `Name` rejected — mirroring Phase 2/3/4's test rigor.
- Update `bystander-form.spec.ts` if the app's existing spec convention asserts template markup for the asterisk (matches how Monster's/Minion's/Location's specs were updated in their own revisions); no new validator-touched-state assertion is needed since no validator is changing.

**Not in scope for this pass:** the deferred `mystery-detail.html`-scoped "Add Bystander" entry point (Standalone Creation Phase 4's own Known Gaps, unrelated to and unaffected by required-field validation); the "attach an existing unattached bystander to a mystery" gap (same doc's Known Gaps).

**Docs:** `docs/updates/bystander-required-fields-validation.md` (this document). See also `.squad/decisions/inbox/yoshi-bystander-required-fields-validation.md`.

---

## Closing Note — Initiative Complete: Did the Pattern Hold Across All Five Domains?

**Yes, with a clean, explainable spread of differences — not a uniform result, but a consistent mechanism underneath every difference.** Summary across all five phases:

| Dimension | Mystery | Monster | Minion | Location | Bystander |
|---|---|---|---|---|---|
| Blank/whitespace `Name` gap found live | Yes | Yes (×6 fields) | Yes, but service-layer-masked (hand-rolled check) | Yes | Yes |
| Oversized-`Name` 500 reproduced live | N/A (`Concept` only, optional field) | Yes | Yes | Yes | Yes |
| FK-existence checks already correct pre-fix | **No** — the one domain needing a `ServiceResult<T>` retrofit | Yes | Yes | Yes | Yes |
| Hand-rolled service-layer check to remove | No | No | **Yes** — the one domain with this | No | No |
| Missing client-side `Validators.required` on a required FK | N/A (no separate create/edit form) | **Yes** | **Yes** | No | No |
| Numeric fields (`[Range]` question applies) | No | Yes (×3) | Yes (×3) | No | No |
| Interactive sub-resources (draft-array/batch-submit scope question) | No | Yes (×4 + shared custom-move) | Yes (×4 + shared custom-move, already fixed) | No | No |

Every difference in this table has a traced, non-arbitrary cause (Mystery's own service predating the `ServiceResult<T>` convention; Minion's multi-minion-wizard history producing the hand-rolled check; Location's and Bystander's FK-validator correctness being a preserved extraction-fidelity artifact, not superior original engineering) — none of it is unexplained variance. The one constant across all five: **the blank/whitespace `Name` gap and the oversized-`Name` 500 recurred in every single domain**, always closed the same way (`[Required, MaxLength(255)]` on the `Upsert*Request`), and **the FK-existence half of the pattern was correct in 4 of 5 domains from before this initiative started** — the service layer's `ServiceResult<T>`/`XxxExistsAsync` convention was already sound engineering practice in this codebase; this initiative's main yield was closing the one presence/shape gap DataAnnotations was never wired up to catch, plus the two adjacent client-side bugs (Monster's, Minion's missing FK validators) and one piece of dead-code cleanup (Minion's hand-rolled check) it surfaced along the way.

**A checklist for auditing a future new domain against this same pattern**, distilled from what varied and what didn't across these five phases:

1. Read the entity directly for FKs, numeric fields, and sub-resource collections before assuming shape from the domain's name or a superficial resemblance to a sibling domain — Location and Bystander both "looked like" they might need Monster's sub-resource machinery by relationship-shape resemblance alone, and didn't.
2. Live-test blank/whitespace/null on every string field backed by a DB `.IsRequired()` column. Expect the gap to reproduce; if it doesn't, check *how* it's already being caught (DataAnnotations vs. a hand-rolled check) before concluding "nothing to fix" — Minion's case shows a passing live test can still hide a real gap (length) and a real inconsistency (disfavored mechanism).
3. Live-test an oversized string against the DB's `HasMaxLength`, on every required field, not just for presence — a reproduced 500 is real, not hypothetical, and this initiative found it in every domain that had a required string field with a DB cap.
4. Live-test every FK field with `Guid.Empty`/omitted/nonexistent-but-valid-format, every phase, regardless of how many prior domains already got this right — this codebase's service layer has now confirmed FK-existence correctness four domains running, but a streak was never treated as a substitute for the check.
5. Check each shared form component's validator array field-by-field against its own DTO's required-at-every-other-layer fields, especially reference-data type pickers — this was the one bug class that recurred unevenly (2 of 5 domains) and is a pure client-side, no-DB-round-trip check, easy to miss because the server-side layers all still look correct.
6. Check whether numeric fields exist at all before raising the `[Range]` question, and whether interactive sub-resources exist (versus a read-only child list) before assuming the draft-array/batched-submit scope question applies — both were genuine structural absences in 3 of 5 domains, not overlooked items.
7. Check whether the domain's custom-move endpoints already consume the shared `UpsertCustomMoveRequest` — if so, that field is already fixed permanently as of Phase 2, and every future domain with custom moves gets it for free with zero incremental work, confirmed live for four domains running.

**Docs:** `docs/updates/bystander-required-fields-validation.md` (this document). See also `.squad/decisions/inbox/yoshi-bystander-required-fields-validation.md`. This closes the five-phase required-field-validation initiative (Mystery/Monster/Minion/Location/Bystander all have phase docs now).

---

## Revision — Skyler's 2 Answers Resolved (2026-08-06)

**By:** Yoshi (Architect)
**Date:** 2026-08-06

Both answered **yes**, matching the recommended lean and the full precedent (5/5 on MaxLength bundling, 4/4 on the asterisk convention) — no scope changes:

| # | Question | Answer |
|---|---|---|
| 1 | Bundle `[MaxLength(255)]` + matching `maxlength="255"` HTML with the `[Required]` fix on `Name`? | **Yes.** |
| 2 | Adopt the asterisk required-field convention on `bystander-form.html` for `Name` and `Bystander Type`? | **Yes.** |

**Net implementation scope, now unconditional — smallest possible shape, matching Location's:**

**Backend (Bowser) — `Contracts/ApiContracts.cs` + tests only:**
- `[param: Required, MaxLength(255)]` on `UpsertBystanderRequest.Name` (`ApiContracts.cs:238`).
- No repository/controller/service changes, no cleanup step — both FKs already correct, no hand-rolled check to remove.
- Extend `BystanderServiceTests.cs` (exists — don't recreate): blank/whitespace `Name` rejected on both `CreateAsync` overloads and `UpdateAsync`, oversized (256+ char) `Name` rejected.

**Frontend (Luigi):**
- `maxlength="255"` on `bystander-form.html`'s Name input.
- Asterisk convention (`<span class="text-danger">*</span>`, wrapped with label text per the established grid-label fix) on `Name` and `Bystander Type` in `bystander-form.html` — one shared file covers both create and detail pages.
- No validator changes needed — `name`/`bystanderTypeId` already both have `Validators.required`.
- Update `bystander-form.spec.ts` for asterisk-markup assertions if that's this codebase's established spec convention.

**Not in scope:** the deferred `mystery-detail.html` "Add Bystander" entry point and the "attach an existing unattached bystander" gap (both pre-existing, unrelated).

**This is the final implementation step of the five-phase required-field-validation initiative.** Once Bowser and Luigi finish, all five domains (Mystery, Monster, Minion, Location, Bystander) will have the same validation mechanism applied consistently.

**Docs:** `docs/updates/bystander-required-fields-validation.md` (this document). See also `.squad/decisions/inbox/yoshi-bystander-required-fields-validation.md`.
