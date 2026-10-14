# Resource Images — Endpoint Unification

**Prepared by:** Yoshi (Architect)
**Date:** 2026-10-12, amended the same day with Skyler's four answers (§11)
**Status:** **LANDED, 2026-10-13**, on branch `image-endpoint-unification` (off `custom-moves`). §§0–12
remain exactly as written when this was research; **§§13–16 are Bowser's implementation record, appended,
and they are where this document is corrected** — four of its numbers and claims did not survive contact,
and §16.3 lists them in one place rather than leaving a reader to find them.

| Commit | Phase | What landed |
|---|---|---|
| `d9fea56` | **U0** | The enum merge: one `DomainOwnerType`, `ImageOwnerTypes`, `Exclude<>`, 5 pinning tests, the Postgres data-contract gate. §13. |
| `b07d07e` | **U1** | The oracle: harness widened to all four domains, 61-case four-owner matrix. §14. |
| `c44bb37` | **U2** | The atomic switchover: `ResourceImagesController` created and 24 actions deleted in one commit. §15. |
| `5244328` | **U3** | The drift guard, the `design.md` §3 supersession, the frontend comment, this record. §16. |

It was the deliverable of `docs/domain-custom-moves/architecture.md` **Phase 7 / §12 F1**, which was gated
on Phase 6 of that plan. As *research* it wrote no production code and committed nothing; the four commits
above are the implementation it specified.
**Supersedes:** `docs/resource-images/design.md` §3's *"not a new fifth cross-cutting controller"*
sentence — in writing, in §3 of this document, not quietly. Everything else in `design.md` stands.
**And supersedes `docs/domain-custom-moves/architecture.md` §2.8**, the two-enum decision, which Skyler
has reversed on purpose (§2.6, §11 Q3). That reversal is the one place this document's recommendation was
overruled, and §2.6 is written as the decided position with the consequences worked rather than as an
argument with it.

> **Settled by Skyler, 2026-10-12.** Four answers, three of them mine and one not.
>
> | | Question | Answer |
> |---|---|---|
> | **Q1** | Unify at all? | **(A) Yes, as specced** — backend-only, URLs unchanged. *My recommendation.* |
> | **Q3** | One enum or two? | **(B) Merge into one `DomainOwnerType`.** *Against my recommendation — §2.6 is rewritten to the decision, with its three worked consequences and the one place it is strictly better than what I proposed.* |
> | **Q5** | Swagger | **(A) Accept the loss.** No `IOperationFilter`. *My recommendation.* |
> | **Q7** | Scope | **"Images only, close the question."** The flat sub-resources (powers, weaknesses, armors, attacks) are **considered and declined**, not deferred — §9.2. This does **not** close the separately-numbered §12 F2 of the custom-moves plan, which is the create-page batch primitive and was not among Q7's options — §9.3. |
>
> **Q2, Q4, Q6 and Q8 stood at my recommendations pending Q3. Q3's resolution moves exactly one of them:
> Q6 goes from three commits to four**, because the enum merge is a 368-site rename across shipped green
> code that must not be buried inside the one commit that has to be reviewed line by line (§4, U0).
> Q2 is unmoved and is now answered on the merge's own terms (§2.6). Q4 and Q8 are untouched.

**Grounding — read this session, not inherited.** Globbed the whole `src/` tree (every directory under
`src/api` and `src/web`, excluding `bin`/`obj`/`node_modules`/`.angular`/`dist`) before scoping anything,
because every agent on the custom-moves document had a count corrected and several had one corrected
twice. Read in full: all four domain controllers' image blocks (extracted and diffed against each other
mechanically, §1.1), `CustomMovesController.cs`, `MysteriesController.cs`,
`Services/ResourceImages/ResourceImageService.cs`, `Data/Entities/DomainEntities.cs` (every entity
declaration), the `OwnerType` configuration in `MotwDbContext.cs`, `Program.cs`'s catch-all,
`MonsterOfTheWeek.Api.csproj`, `Controllers/ResourceImageApiHarness.cs`,
`Controllers/ResourceImageEndpointTests.cs`, `Controllers/CustomMoveEndpointTests.cs`,
`Controllers/CustomMoveOwnerDriftTests.cs`, `MysteryLinkApiHarness.cs` and `MinionReparentApiHarness.cs`'s
DI blocks, `core/resource-images.ts`, `shared/resource-images-four-domain-parity.spec.ts`'s header,
`docs/resource-images/design.md` §§0–3, `docs/domain-custom-moves/architecture.md` §§2.8–2.10, §12, §16,
§17, §22, §29.15, and `.squad/agents/Yoshi/history.md`.

**Read on the second pass, for §2.6 specifically** — because answering a reversed decision from a summary
of the code is how a consequence gets missed: `IResourceImageService.cs` in full (every method's XML doc),
`CustomMoveService.OwnerExistsAsync`, every `ResourceOwnerType.`/`CustomMoveOwnerType.` call site in the
backend (151 occurrences each, enumerated), `MotwDbContextModelSnapshot.cs`'s two `owner_type` property
declarations, `core/models.ts`'s two union declarations with their comments,
`core/custom-moves.ts`'s `OWNER_SEGMENT`, `shared/custom-moves-five-domain-drift.spec.ts`'s derivation
block, and `core/custom-moves.spec.ts`'s cross-derivation from `resourceImagesPath`.

**Nothing was started and nothing is running.** No server, no test run, no build. Every number below came
from reading or from `grep`/`diff` over the working tree, and each one says how it was obtained.

---

## 0. The ask, and the verdict in three sentences

Skyler, recorded in the custom-moves plan: *"we really should clean this up… it makes a lot more sense to
have it match this pattern instead… I would like it noted down and a reminder once this work is done."*

**Unify. One `ResourceImagesController` with six actions behind a four-member constrained owner segment,
replacing twenty-four actions across four controllers.** The trade-off it accepts is the same one §2.9 of
the custom-moves plan accepted and the same one Swagger paid there: the legal owner set moves out of the
route table into a regex plus a dictionary, so *"which owners have images"* stops being readable from
`/swagger` and becomes a thing a drift test asserts. **What makes this cheaper than the custom-move case
rather than harder is that the URLs do not change at all** — the client already builds them from a single
`OWNER_SEGMENT` map, the service is already cross-domain, and there is no schema, no migration, no
teardown and no frontend edit beyond one stale comment.

**Three of the four "what makes it harder" claims in my own Phase 7 entry do not survive measurement.**
§2 says so with the evidence. This is a correction to my own text, not a softening of it.

**The fourth — the enum convergence — was re-opened, and Skyler reversed `architecture.md` §2.8.** The
two owner enums become one `DomainOwnerType`. That is a separate decision riding on the same branch, and
it lands as its own first commit (**U0**) rather than inside the switchover: a 368-token rename across
shipped green code must not be reviewed together with a 24-action deletion. §2.6 works it through — the
three newly-reachable throws and what they should do, why the route still takes four segments, why it is
**not a migration**, and the one place the merge is strictly better than what I recommended.

---

## 1. Current state, verified by reading source

### 1.1 There are exactly 24 actions, and across domains they are near-identical

Derived, not counted by eye:

```
grep -n '\[Http[A-Za-z]*("api/[^"]*images' Controllers/*Controller.cs | wc -l   → 24
```

Six per controller on `MonstersController`, `MinionsController`, `LocationsController`,
`BystandersController`. `MysteriesController` has none.

| Template | Verb(s) | Notes |
|---|---|---|
| `api/{domain}/{id:guid}/images` | `GET`, `POST` | `POST` carries `[RequestSizeLimit]` + `[RequestFormLimits]` and binds `[FromForm] IFormFileCollection files` |
| `api/{domain}/{id:guid}/images/{imageId:guid}` | `DELETE` | 204 / 404 |
| `api/{domain}/{id:guid}/images/{imageId:guid}/file` | `GET` | sets `Cache-Control`, returns `File(bytes, contentType)` |
| `api/{domain}/{id:guid}/images/{imageId:guid}/thumbnail` | `GET` | same, with the null-thumbnail fallback to the original |
| `api/{domain}/{id:guid}/images/{imageId:guid}/primary` | `PUT` | 204 / 404 |

**Five path templates, six operations, per domain. Twenty templates and twenty-four operations in total.**

**The non-uniformity my Phase 7 entry warned about is real but it is between the six actions, not between
the four domains.** Measured: extracted each controller's image block with `awk` from the `--- Images`
marker, normalised the four owner tokens to `OWNER`/`OWNERS`, and diffed.

- **Minions vs Monsters:** identical apart from **two comments** present on Monsters and absent on
  Minions (the `design.md` §2.1 thumbnail-fallback note and the §3 201-vs-400 note).
- **Bystanders vs Locations:** **byte-identical after normalisation.**
- **Locations vs Monsters:** the same two missing comments, one re-worded comment, and **three
  `return ToErrorResult(result.Error!)` lines that are `return NotFound()` instead** — §1.2.

Block sizes, measured from the `--- Images` marker to the last line of `SetPrimaryImage`:
Monsters 86, Minions 82, Locations 82, Bystanders 82 — **332 lines of controller code.**

### 1.2 The one divergence across domains, and why it is currently unobservable

`MonstersController` and `MinionsController` route image failures through their private
`ToActionResult`/`ToErrorResult` pair (`NotFound` → 404, `Validation` → 400 with a message, anything else
→ bare 400). `LocationsController` and `BystandersController` **have no such pair at all** — verified by
grep, neither file declares `ToActionResult<T>` or `ToErrorResult` — and inline `return NotFound()`,
collapsing every error to 404.

This is exactly the shape of the custom-move plan's **B9**, and it resolves the same way, for a reason
that has to be read off the service rather than assumed:

- Only **two of the six** `IResourceImageService` methods return a `ServiceResult` at all — `UploadAsync`
  and `ListAsync`. `GetImageAsync` returns `ResourceImage?`; `DeleteAsync` and `SetPrimaryAsync` return
  `bool`; `GetPrimaryImageIdAsync` returns `Guid?`.
- In both of those two, the only failure constructed anywhere in the file is
  `ServiceResult<T>.NotFound(...)`, guarded by `OwnerExistsAsync`. Nothing returns `Validation` or
  `Conflict`. Per-file rejections are **not** errors — they ride in the `rejected` array of a 201 or of
  the all-rejected 400, which both controller families build identically.

**So the two policies cannot produce a different response today**, and adopting `ToErrorResult` in the
unified controller is a zero-behaviour-change choice that is also the one that stays correct if a
`Validation` error is ever added. Same conclusion as B9, reached independently against the image service.

### 1.3 The service is already unified. So is the client.

`ResourceImageService` is one class taking `(ResourceOwnerType ownerType, Guid ownerId, …)` — read
`DomainOwnerType` after U0, §2.6 — on every
method. The four controllers are, in `ResourceImageEndpointTests.cs`'s own words, *"deliberately thin,
identical wrappers around the one shared `IResourceImageService`."*

**And `core/resource-images.ts` is already the unified client.** It has one `OWNER_SEGMENT` map, one
`resourceImagesPath(ownerType, ownerId)` builder, and `resourceImageFileUrl`/`resourceImageThumbnailUrl`
built on top of it. Grepping the whole Angular `src/app` for `'/api/` in non-spec code returns **zero
image URLs** — the only hits are three identical comments mentioning `/api/mysteries` and two
`mystery-detail` membership calls. Every production image URL in the app comes out of that one builder.

**This is the single most important fact in the document.** The duplication being removed exists *only*
between `Program.cs` and the controller layer. Above it the client is unified; below it the service is
unified. The HTTP surface is the one layer that was built four times.

### 1.4 Three of the four domains' image endpoints have no automated HTTP coverage

`ResourceImageEndpointTests.cs` has **15 facts**, every one of them against
`/api/monsters/{harness.MonsterId}/images…`. Its own header says the other three *"get a manual multipart
check per the Phase 3 verification list, not a second copy of this suite,"* justified by the four
controllers being thin identical wrappers.

That justification is a comment. **Nothing in the build makes it true**, and §1.1 already measured one
place where it is not quite true (the error-mapping divergence). Among the untested-over-HTTP cases:
`[RequestSizeLimit(24 MiB)]` on Location, Bystander and Minion — the one attribute whose absence would be
invisible in review and would surface as an unbounded multipart body.

### 1.5 What is duplicated today with no guard at all

| Duplicated | Copies | Guard today |
|---|---|---|
| `ImageCacheControl = "private, max-age=31536000, immutable"` | 4 | none |
| `ImageRequestSizeLimitBytes = 24 * 1024 * 1024` | 4 | none |
| `[RequestSizeLimit]` / `[RequestFormLimits]` pair | 4 | one test, Monster only |
| the 201-if-any-uploaded / 400-if-all-rejected branch | 4 | one test, Monster only |
| the null-thumbnail fallback | 4 | one test, Monster only |
| the derived-`isPrimary` projection in `GetImages` | 4 | one test, Monster only |
| `IResourceImageService` on a controller constructor | 4 | n/a |

The frontend's `resource-images-four-domain-parity.spec.ts` is a real drift guard, but it compares
**rendered DOM on the four detail pages**. It is blind to every row above.

---

## 2. The structural call

### 2.1 Recommendation

**One `ResourceImagesController`, six actions, one constrained owner segment of four members. The URLs do
not change. No schema change, no migration, no service change, no frontend change beyond one comment.**

```
GET    /api/{owner}/{ownerId:guid}/images
POST   /api/{owner}/{ownerId:guid}/images
DELETE /api/{owner}/{ownerId:guid}/images/{imageId:guid}
GET    /api/{owner}/{ownerId:guid}/images/{imageId:guid}/file
GET    /api/{owner}/{ownerId:guid}/images/{imageId:guid}/thumbnail
PUT    /api/{owner}/{ownerId:guid}/images/{imageId:guid}/primary
```

`{owner}` constrained to `monsters|minions|locations|bystanders` — **four, not five, even though
`DomainOwnerType` now has five members.** The constraint expresses what the *feature* serves, not what
the *domain* contains; §2.6.3 is the worked answer and the declared `ImageOwnerTypes` set is the one place
that boundary is written down.

**The trade-off accepted, stated once and not hedged:** Swagger goes from twenty concrete path templates
to five templated ones with `owner` as an un-enumerated `string`, so a developer can no longer read
"which resources have images" off the route table. That is the same loss §22 of the custom-moves plan
measured and accepted, and it is paid for by removing 332 lines of fourfold-copied controller code, seven
unguarded duplications, and a test-coverage hole that currently leaves three of four domains' upload
limits unexercised.

### 2.2 Three of my own Phase 7 claims, re-tested

My Phase 7 entry named four things that made this harder than custom moves. **One holds. Three do not,
and one of them inverts.**

**(a) "The actions are not uniform."** *Holds, and is the reason this is six actions rather than four — but
it is not a risk.* The non-uniformity is between the six actions, not between the four copies of them.
Per-action attributes and `File(...)` returns are properties of an action, not of the controller class
that hosts it: `RequestSizeLimitAttribute` and `RequestFormLimitsAttribute` are MVC filters resolved per
endpoint with no host registration and no `ConstraintMap`-style coupling, and `ControllerBase.File(...)`
and `Response.Headers` are available on any `ControllerBase`. Moving the action moves its behaviour.
**And this is checkable rather than assumable**: `Upload_RejectsTheRequest_WhenTheBodyExceedsThe
TwentyFourMebibyteLimit` already exercises the limit end-to-end through a real Kestrel host, so the gate
for "the attributes survived" is a test that already exists. §4's phasing makes that test cover all four
owners *before* the move, which is the whole de-risking idea.

**(b) "Unlike custom moves, these endpoints are shipped, working and user-facing."** *True, and almost
entirely irrelevant — this is the claim that inverts.* The custom-move endpoints being dead is what made
it safe to **change their contract**. Nothing here changes a contract. The method, path, status codes,
request body, response body and cache headers are all preserved byte-for-byte, because the whole point of
a constrained owner segment is that `/api/monsters/{id}/images` is still `/api/monsters/{id}/images`. The
live consumers therefore require **zero edits**, in production code *and* in specs — every URL literal in
the Angular test suite (`'/api/monsters/m1/images'`, `'/api/minions/n1/images/i1/thumbnail'`, and the
rest) continues to be correct. *Liveness would be the dominant risk if the URLs moved. They do not, and
the correct way to hold that claim honest is a test suite written against the shipped routes before the
switchover and not edited after it — §4 U1.*

**(c) "`design.md` §3 explicitly chose per-domain controllers."** *True, and it is one sentence with one
reason.* It is not a load-bearing structural decision with consequences spread through the codebase; it is
a consistency argument — *"to match how this app already organizes per-domain sub-resources"* — and that
convention has itself since been set aside on purpose, by Skyler, for custom moves. §3 writes the
supersession rather than relying on precedent.

**(d) "The enum convergence."** *Holds as a question, and §2.6 answers it — in favour of keeping two
enums, for a mechanical reason I had not checked when I wrote the entry.*

### 2.3 The route and controller shape

Copy `CustomMovesController`'s mechanism exactly. It is seven days old, it was proven against a scratch
Kestrel host and against the real `Program.cs`, and the reasons behind each choice apply here unchanged:

```csharp
private const string OwnerSegment =
    "{owner:regex(^(monsters|minions|locations|bystanders)$)}";

private const string CollectionRoute = "api/" + OwnerSegment + "/{ownerId:guid}/images";
private const string ItemRoute       = CollectionRoute + "/{imageId:guid}";

private static readonly IReadOnlyDictionary<string, DomainOwnerType> Owners =
    new Dictionary<string, DomainOwnerType>(StringComparer.OrdinalIgnoreCase) { … };
```

(`DomainOwnerType` after U0 — the merged enum, §2.6. The dictionary has **four** entries where the enum
has five, which is the whole content of §2.6.3 and is why `IResourceImageService.ImageOwnerTypes` exists
and why U3's drift test asserts the dictionary's key set against it in both directions.)

Three things are carried over as **requirements**, not as style, because each is invisible in review and
each was measured rather than reasoned (custom-moves §17.1):

1. **The `^…$` anchors are mandatory.** `RegexInlineRouteConstraint` matches with `IsMatch`, which is
   unanchored; without the anchors the segment `xmonstersx` matches and reaches the dictionary. Probe B
   in §17.1 returned `200` with `owner == "xmonstersx"`.
2. **`StringComparer.OrdinalIgnoreCase` is load-bearing.** Route matching is case-insensitive *including
   literal segments*, and the constraint hands the action the caller's own casing.
   `GET /api/MONSTERS/{id}/images` returns 200 on the shipped routes today — an ordinal dictionary would
   turn a working URL into a 500 via the indexer.
3. **Inline `regex`, not a registered `IRouteConstraint`.** A named constraint lives in
   `RouteOptions.ConstraintMap`, configured on the host — and `ResourceImageApiHarness`,
   `MysteryLinkApiHarness` and `MinionReparentApiHarness` each build their own `WebApplication`. The
   constraint would silently not apply in exactly the harness that exists to test these routes.

Keep the **indexer, not `TryGetValue`**, in the segment→enum lookup, with `CustomMovesController`'s
comment reused: a miss is regex/dictionary drift, which is a bug in the file and should surface as a 500
rather than be laundered into a 404 that looks like a stale id. The drift test (§6) is what makes it
unreachable; the throw is the backstop.

**Collision check, conclusive rather than hopeful.** The only `api/*/{id}/images…` templates in the route
table are the twenty being deleted. `api/{owner:regex(monsters|minions|locations|bystanders)}/…/images`
cannot collide with `api/{owner:regex(mysteries|monsters|…)}/…/custom-moves`: the fourth segment is a
different literal in each. And `GET /api/mysteries/{id}/images` correctly falls through the constraint to
`Program.cs:225`'s catch-all — a bare 404 authenticated, 401 anonymous — which is what it does today.

### 2.4 Error mapping: one policy, and it changes nothing

Adopt `ToErrorResult`, matching `MonstersController`/`MinionsController`/`MysteriesController`/
`CustomMovesController`. §1.2 is the verification that this cannot change a single response today.

Copy the eleven-line `ToActionResult`/`ToErrorResult` pair as `CustomMovesController` did, rather than
starting a `ControllerBase` subclass. There would then be **five** private copies of it, which is
genuinely worse-looking than four — and it is still the right call in a change whose point is subtraction.
Record it as a follow-up (§12 U-F1), not as a thing to do here.

### 2.5 Ownership validation, index and query shape: unchanged

**No image-service *logic* changes.** `OwnerExistsAsync` is already the `(OwnerType, OwnerId)` model the
custom-move service was built from, it is already called by exactly the two methods that need it
(`UploadAsync`, `ListAsync`), and the other four methods already filter by the discriminator pair in the
`WHERE`, which is a stronger guarantee than a pre-check. The `(OwnerType, OwnerId, SortOrder)` index is
untouched, and **no method body, query or branch in `ResourceImageService` is rewritten by the
unification itself** — which is worth stating plainly, because the custom-move case spent an entire phase
on the service layer.

**One correction against my first pass, forced by Q3.** I had written "zero service lines change." That is
now false in a narrow, precise way: U0's enum merge rewrites the *parameter type* on all seven
`IResourceImageService` members and the `switch` *labels* in the three private helpers, and adds the
`ImageOwnerTypes` declaration (§2.6.3). That is a rename plus one constant — no behaviour — but it is not
zero lines and the plan should not claim it is. The unification phases U1–U3 remain service-free.

### 2.6 The enum: one `DomainOwnerType` — decided by Skyler, against my recommendation

**`ResourceOwnerType` and `CustomMoveOwnerType` become one five-member `DomainOwnerType`
(`Mystery`, `Monster`, `Minion`, `Location`, `Bystander`).** This reverses
`docs/domain-custom-moves/architecture.md` §2.8, which is seven days old and shipped, and it is the one
place in this document where my recommendation was overruled. It is recorded as the decision and designed
for, not re-argued. What follows is the work the reversal creates, in the order it has to be done.

**My recommendation was to keep two enums, and the reason mattered**, so it stays on the page rather than
being deleted — a closed question whose rationale is deleted becomes an answer nobody can check. It was:
`Mystery` has no `PrimaryImageId` property, no `HasOne<ResourceImage>()` FK and no
`idx_mysteries_primary_image_id`, where the other four have all three. So mystery images is a migration
plus three service arms plus a list projection plus a UI, and until that feature exists the image-legal
set is genuinely narrower than the domain. **That fact is still true and is now the thing the design has
to encode explicitly rather than get for free from the type system.** Skyler chose one domain vocabulary
over two feature-scoped ones; the cost of that is three paragraphs below, and the benefit is real and
stated in 2.6.4.

#### 2.6.1 Is the throwing default newly reachable? Yes — and the blast radius is one method, not three

Verified by reading all four `switch` expressions over an owner type, not from my earlier summary of them:

| Switch | Arms | Default today | Under `DomainOwnerType` |
|---|---|---|---|
| `CustomMoveService.OwnerExistsAsync` (`:126-135`) | **5 of 5** | unreachable by exhaustion | **unchanged** |
| `ResourceImageService.OwnerExistsAsync` (`:207-215`) | 4 of 5 | unreachable by exhaustion | **newly reachable** |
| `ResourceImageService.GetExplicitPrimaryImageIdAsync` (`:217-225`) | 4 of 5 | unreachable by exhaustion | **newly reachable** |
| `ResourceImageService.SetPrimaryImageIdAsync` (`:232-244`) | 4 of 5 | unreachable by exhaustion | **newly reachable** |

So the answer to "is it reachable in a way it wasn't" is **yes, unambiguously**: today `ResourceOwnerType`
has four members and all four are handled, so the `_ =>` arm is dead by exhaustion even though the
compiler never proves it. Under a five-member enum, `DomainOwnerType.Mystery` is a value anyone can write
and all three arms become live.

**But they are not three independent hazards, and that is the part that decides the behaviour.** Traced
every entry point:

- `OwnerExistsAsync` is private, called by `UploadAsync` and `ListAsync`, and is the **first** statement in
  each.
- `GetExplicitPrimaryImageIdAsync` is private, called only by `GetPrimaryImageIdAsync`. Every production
  call to `GetPrimaryImageIdAsync` is downstream of a successful `ListAsync` or `UploadAsync` — i.e.
  downstream of `OwnerExistsAsync` having already returned `true`. (The four repository list projections
  re-implement the derivation **in SQL** and do not call the service at all —
  `MonsterRepository.cs:51`, `MinionRepository.cs:38`, `LocationRepository.cs:123`,
  `BystanderRepository.cs:122`.)
- `SetPrimaryImageIdAsync` is private, called only by `SetPrimaryAsync`, and **only after** a
  `belongsToOwner` check that queries `resource_images` for a row with that owner. A `Mystery` row can
  only exist if `UploadAsync` wrote one, which `OwnerExistsAsync` prevents. So this arm is
  **unreachable by construction**, not merely unreached.

**`OwnerExistsAsync` dominates both others in every call path that exists.** The blast radius of the merge
is one method, and the other two throws are backstops behind it.

#### 2.6.2 Throw, return not-found, or make it unrepresentable?

**Make it unrepresentable is off the table, and that is worth stating because it is what someone will
propose.** In C# there is no subtype-of-enum. A wrapper (`readonly record struct ImageOwner` with a
private constructor and a `TryFrom`) still carries a `DomainOwnerType` inside it, so the three switches
still need a default; the only wrapper that removes the default is one carrying its own four-member enum —
**which is the two-enum design that was just declined, under another name.** So the real choice is two
options, not three.

**Recommendation: keep `_ => throw new ArgumentOutOfRangeException`. Do not add
`Mystery => false` / `null` / `0` arms.**

The case for the honest-"no" arms is not bad: a Mystery genuinely is not an image owner, `false` is a true
statement, and it would make the service agree with the route (which 404s `/api/mysteries/{id}/images`)
instead of contradicting it. It loses on two counts.

1. **Under §2.6.3's route answer, neither behaviour can reach a user** — the constraint rejects
   `mysteries` before any application code runs. So the choice is purely about which signal a *developer*
   gets for a programming error, and a loud `ArgumentOutOfRangeException` beats a silent 404 that sends
   them debugging a mystery that exists.
2. **A `Mystery => false` arm is a permanent, quiet encoding of "mysteries have no images" that compiles
   and passes in a world where mystery images has been built and the arm was never updated.** It would
   answer "this mystery has no images, and never will," silently, forever. The throw has the opposite
   failure: when mystery images arrives, it fails loudly at the exact three lines that need the real
   query. **This is the §2.8 hazard displaced rather than removed, and it is the sharper argument of the
   two.**

One implementation note so the pinning test is not written wrong: the throw happens inside an
expression-bodied method returning `Task<bool>`, so it is raised **synchronously** — but it is consumed
inside `async` `ListAsync`/`UploadAsync`, which capture it onto the returned task. The test is
`await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => service.ListAsync(DomainOwnerType.Mystery, …))`,
not `Assert.Throws`.

#### 2.6.3 Q2 under one enum: the route still takes four segments

**Answer: four — `^(monsters|minions|locations|bystanders)$`. The merge does not move this.**

Three options, and the merge adds the third:

- **(A) four segments.** The enum has a member the route rejects. `GET /api/mysteries/{id}/images` is a
  **routing** 404 with a zero-byte body, which is exactly what it is today.
- **(B) five segments, the action rejects `mysteries` by falling into the throw.** Rejected: it makes a
  user-constructible URL a 500. This is §2.8's named hazard, verbatim.
- **(C) five segments, the action maps `mysteries` to an explicit 404 before calling the service.** New
  under the merge, and worth evaluating rather than dismissing. Rejected on two counts: it changes a
  shipped response from a routing 404 (0 bytes, no `Content-Type`) to a controller 404 (162-byte
  ProblemDetails) — the one observable difference §16.2's corrected table exists to document — and it puts
  a per-feature legality branch inside the action, which is precisely the *"per-feature 'which members are
  legal for me' rule that someone must remember forever"* §2.8 warned rots. It buys nothing: no client
  constructs that URL.

**The principle this settles, which is the useful output:** a route constraint's job is to express what
the **feature** serves, not what the **domain** contains. Under two enums those sets coincided and the
constraint could be derived from `Enum.GetValues`. Under one enum they do not, and the feature boundary
has to be stated somewhere. **The route constraint is the right place for it** — it is the only site that
already has to enumerate the set, it is already drift-tested, and it fails **closed** (404) rather than
open.

So: **one declared set, read by three things.** `IResourceImageService` gains

```csharp
public static readonly FrozenSet<DomainOwnerType> ImageOwnerTypes =
    FrozenSet.ToFrozenSet([DomainOwnerType.Monster, DomainOwnerType.Minion,
                           DomainOwnerType.Location, DomainOwnerType.Bystander]);
```

and the route alternation, the controller's segment dictionary and the drift test all read or assert
against it. It lives on the image feature's own contract, not on the controller, because the service's
three switches must be asserted against it too and a test reading a controller's internals to check a
service is backwards.

**The honest price, in the vocabulary §29.15 established:** under two enums the image-owner set was
**derived** (`Enum.GetValues<ResourceOwnerType>()`). Under one enum it becomes **transcribed** (a declared
four-element set) plus the same drift guard. *That is the entire cost of Q3 going this way on the C#
side* — one derived fact becomes one transcribed constant with a test behind it. It is a real cost and it
is small.

#### 2.6.4 TypeScript: the merge is strictly better here, and `Exclude<>` is load-bearing

This is the half where the decision pays, and I did not credit it when I recommended against the merge.

Today `core/models.ts` declares two **independent, hand-written** unions. Nothing relates them; a sixth
domain must be added to both by hand and no tool notices if it is added to one. The merged shape fixes
that:

```ts
export type DomainOwnerType = 'Mystery' | 'Monster' | 'Minion' | 'Location' | 'Bystander';
export type ImageOwnerType = Exclude<DomainOwnerType, 'Mystery'>;
```

- `Record<ImageOwnerType, string>` stays exhaustive at four, so `core/resource-images.ts`'s
  `OWNER_SEGMENT` **cannot** gain a `Mystery` key and cannot lose one of its four.
- `Record<DomainOwnerType, string>` keeps `core/custom-moves.ts`'s map exhaustive at five.
- `ImageOwnerType` stays a strict subtype, so `resourceImagesPath`'s narrow parameter is unchanged and
  `core/custom-moves.spec.ts:69`'s cross-derivation from `resourceImagesPath` keeps compiling.
- **And the subset becomes derived rather than transcribed** — the mirror image of what happens on the C#
  side. Add a sixth domain to `DomainOwnerType` and the images map is a **compile error** until someone
  decides whether that domain has images. That is the correct, loud failure, and nothing in the repo
  produces it today.

**The silent failure this must avoid, named because it is the easy mistake.** If someone merges the unions
but skips the narrowing and types `resourceImagesPath(ownerType: DomainOwnerType, …)`, then `Record<…>`
exhaustiveness **forces** a `Mystery: 'mysteries'` entry into the images map;
`resourceImagesPath('Mystery', id)` compiles and builds `/api/mysteries/{id}/images`, which 404s; and
because every method in `core/resource-images.ts` sets `SUPPRESS_ERROR_TOAST` through
`inlineErrorContext()`, **the failure is silent in the browser.** Worse, the one existing cross-guard does
not catch it: `custom-moves.spec.ts:69` compares `segmentOf(resourceImagesPath(owner, id))` against the
custom-move map, and `'mysteries'` is the *correct* custom-move segment, so it would pass. **`Exclude<>`
is load-bearing, not tidiness** — the same register as the `OrdinalIgnoreCase` note in §2.3, and it wants
the same kind of comment at its declaration.

#### 2.6.5 It is not a migration — confirmed for merging now, not only later

I had noted that both columns are string-converted so a merge would not be a data migration. The
coordinator asked whether that holds for a merge happening **now**, with rows in both tables, rather than
later. It does, and the reason is stronger than I stated:

**`MotwDbContextModelSnapshot.cs` records the *provider* type, not the CLR type.** Both `owner_type`
properties — `custom_moves` at `:437-441` and `resource_images` at `:1896-1900` — are recorded identically
as:

```csharp
b.Property<string>("OwnerType")
    .IsRequired()
    .HasMaxLength(16)
    .HasColumnType("character varying(16)")
    .HasColumnName("owner_type");
```

The value converter does not appear in the snapshot at all. So swapping the CLR enum type produces a
**byte-identical snapshot**: `dotnet ef migrations add` would generate an **empty** migration, and none is
needed. **Not a data migration, not a schema migration, not a migration.** The timing is therefore
neutral — merging now with rows present is exactly as safe as merging later, because no stored byte
changes either way. This also means the plan keeps its *"no migration at any point"* property, so the
`MigrateAsync()`-runs-at-startup trap (B6 / B-R7) still cannot fire.

**Conditional on one thing, and it is a data contract rather than a style choice: the merged enum must
keep the five member names exactly** — `Mystery`, `Monster`, `Minion`, `Location`, `Bystander`. Those
strings are what `HasConversion<string>()` writes and reads. Rename a member and every existing row in
both tables fails to materialise. It deserves a comment at the enum declaration saying so, and a
Postgres-gated assertion that the stored strings are these five. Member **order** is free: the ordinals
were never persisted, which is why the two enums' differing order (`Monster/Minion/Bystander/Location`
versus `Mystery/Monster/Minion/Location/Bystander`) costs nothing to reconcile. `HasMaxLength(16)` is
unchanged; the longest member, `Bystander`, is 9.

#### 2.6.6 What the merge does to the shipped custom-moves code

`CustomMoveOwnerType` is referenced in **151 places across 21 backend files** and **34 places across 10
frontend files** (counted, not estimated; `ResourceOwnerType` is **151 across 23** and **32 across 10**).
Nearly all of it is a mechanical rename, and the important property is that **a type rename is the safest
possible large diff: the old type stops existing, so the compiler proves completeness on both sides.**
`tsc` does the same for the two TypeScript unions, which are exported types referenced by name.

Four groups need more than a rename:

1. **The four EF projections** (`MonsterRepository.cs:51`, `MinionRepository.cs:38`,
   `LocationRepository.cs:123`, `BystanderRepository.cs:122`) use the enum inside **expression trees
   translated to SQL**. The generated SQL is unchanged because the member *names* are unchanged, but these
   are four sites a sweep of "the service and the controllers" would not look at. Named so they are not
   missed.
2. **`CustomMoveService.OwnerExistsAsync` keeps all five arms and needs nothing** — it is the one switch
   the merge does not touch.
3. **`shared/custom-moves-five-domain-drift.spec.ts` — Phase 6's drift guard — needs a two-token
   amendment, does not weaken, and can be made stronger.** It reads `core/models.ts` as **source text**:
   `:67` regexes `export type CustomMoveOwnerType =([^;]+);` and throws its own
   `'CustomMoveOwnerType not found in core/models.ts'` if it misses. So a rename breaks it **loudly at
   module load**, not silently — the one place in the sweep the compiler cannot help, failing in the right
   direction. `:75`'s `OWNER_SEGMENT` regex is unaffected; `:161`'s `expect(DOMAINS.length).toBe(5)` is
   transcribed and stays 5; everything downstream derives from `DOMAINS` and keeps working unchanged.
   **The strengthening available only under the merge:** add one assertion that the images segment map's
   key set is exactly `DOMAINS` minus `Mystery`, taken from `Exclude<>` rather than transcribed. Today the
   two maps are related only by `custom-moves.spec.ts:69`'s one-directional runtime check over four
   members. Recommended as part of U0.
4. **`core/custom-moves.spec.ts:69`** derives four of the five custom-move segments from
   `resourceImagesPath` — a runtime call, not a source regex. It keeps compiling and keeps working,
   **provided** §2.6.4's narrowing is applied. Without it, this is the test that gives false comfort.

#### 2.6.7 Does any of this make the merge unwise? No

Working it through surfaced three newly-reachable throws (one of which dominates the other two, and all of
which stay unreachable from a URL), one derived fact becoming a transcribed constant on the C# side, one
transcribed pair of lists becoming a derived subset on the TypeScript side, a 368-site compiler-proven
rename, two source-text regex tokens that fail loudly, and **no migration**.

The only thing I would call a real cost is the sweep size — a large diff across shipped, green code for
zero behaviour change. That is a legitimate thing to be uneasy about and it is exactly the trade Skyler
has already stated his position on: *"I prefer less code, simpler, even if it means a bit more rework."*
**Nothing here makes the merge unwise, and I am not re-arguing the preference.** §4's U0 exists so the
rename lands as its own reviewable commit rather than inside the one that must be read line by line.

### 2.7 Swagger

Predicted, by arithmetic over §22's measured post-Phase-2 figure of **78 path templates**:
`78 − 20 + 5 = 63`, with `24 → 6` image operations retagged from four domain tags to `ResourceImages`, and
`owner` emitted as a plain `string` with no `enum`. **Measure it after U2 rather than leaving the
prediction standing** — §16.2's one wrong row is the precedent for why.

**Recommendation: accept the loss; do not build the `IOperationFilter`.** But note honestly that the
arithmetic has changed since §22: this would be the **second** parameterised-owner route, so a ~15-line
filter would now serve two controllers rather than one. My threshold for building it: a **third**
parameterised-owner route. It sits on the shelf, named, rather than being rediscovered.

### 2.8 What it costs and what it removes

| | Today | After |
|---|---|---|
| Controllers with image actions | 4 | 1 |
| Image actions | 24 | 6 |
| Swagger path templates (images) | 20 | 5 |
| Lines of image controller code | 332 | ~170 |
| Copies of `ImageCacheControl` | 4 | 1 |
| Copies of `ImageRequestSizeLimitBytes` | 4 | 1 |
| Copies of `[RequestSizeLimit]`/`[RequestFormLimits]` | 4 | 1 |
| `IResourceImageService` on controller constructors | 4 | 1 |
| Domains with automated HTTP image coverage | 1 of 4 | 4 of 4 |
| Tables, migrations, service methods, entities changed | — | **0** |
| Frontend files changed | — | **1 comment** |

### 2.9 Reservations, logged rather than acted on

1. **Swagger discoverability**, §2.7. Real, accepted, with a named cure and a named threshold.
2. **Five private copies of `ToErrorResult`**, §2.4. Made slightly worse by this change; recorded as a
   follow-up rather than fixed in a subtraction phase.
3. **The segment↔enum↔service-switch triple is a drift surface**, exactly as it is for custom moves. The
   cure is the same three-assertion drift test (§6), and it is cheaper here because there is no
   `OwnerExistsAsync` to add an arm to.
4. **`MinionsController` and `MonstersController` keep their own `ToErrorResult`** after losing their
   image actions, because the rest of their actions use it. Nothing to do; stated so a teardown pass does
   not delete it.

---

## 3. Superseding `design.md` §3 — the exact words

`design.md` is a **closed record** of a shipped feature, so the rule that applies is the resource-images
rule, not the custom-moves rule: *amend a closed record; do not rewrite it.* The superseded sentence stays
in place, struck through, with the amendment beside it — because the original text is the only thing that
explains why the four controllers were built that way, and deleting it makes the four copies look
arbitrary to a later reader.

**Proposed edit — the opening sentence of `design.md` §3 becomes:**

> ~~Added to each of the four existing controllers (`MonstersController`, `MinionsController`,
> `BystandersController`, `LocationsController`), following the exact nested-resource shape already used
> for Attacks/Powers/Armors/Weaknesses/CustomMoves on these same controllers — not a new fifth
> cross-cutting controller, to match how this app already organizes per-domain sub-resources.~~
>
> **Superseded 2026-10-12 — see `docs/resource-images/endpoint-unification.md`.** The per-domain
> controller decision was made to match this app's then-current convention of organising sub-resources
> under their owner's controller. That convention has since been set aside deliberately for custom moves
> (`docs/domain-custom-moves/architecture.md` §2.9, shipped), and the reason given here does not survive
> it: the twenty-four actions are four copies of the same six signatures over one shared service, and the
> client already addresses them through a single `OWNER_SEGMENT` map. **The paths in the table below are
> unchanged** — they are now served by one `ResourceImagesController` through a constrained `{owner}`
> segment instead of by four controllers through four literal ones. Nothing else in this section changes:
> the status codes, the per-file `{ uploaded, rejected }` response, the cache headers and the 201/400 rule
> are all preserved exactly.

The `{resource}` placeholders already used in §3's table need no edit — they were always generic, and
after this change they are literally a route parameter.

**One further edit, one line, in the frontend.** `core/resource-images.ts`'s `OWNER_SEGMENT` comment reads
*"Owner type → the per-domain controller's route segment (design.md §3: images nest under each domain)."*
The first half goes false. Replace with a reference to this document. That is the **entire** frontend
change in this plan.

---

## 4. Phasing, and the commit-ordering constraint that is not optional

**Four** commits on one branch, gated. Numbered **U0–U3** to avoid colliding with the custom-moves phase
numbers.

**Q3's resolution added U0, and that is the only thing it changed about the phasing.** The enum merge is a
368-site rename across shipped, green code for zero behaviour change. Folding it into U2 would bury a
24-action deletion inside it and make the one commit that has to be read line by line unreadable. It goes
first, not last, so U1's widened harness and matrix are written against the final type names and never
have to be swept twice.

### U0 — Merge the enums. Rename plus one constant; no behaviour. *(Bowser)*

`ResourceOwnerType` and `CustomMoveOwnerType` become one `DomainOwnerType` with the five member names
**unchanged** (§2.6.5 — those strings are a data contract). In the same commit:

- the **four TypeScript consequences** of §2.6.4 and §2.6.6: `DomainOwnerType` +
  `ImageOwnerType = Exclude<DomainOwnerType, 'Mystery'>` in `core/models.ts`, with the comment at
  `ImageOwnerType` saying what the narrowing prevents; the two-token amendment to
  `shared/custom-moves-five-domain-drift.spec.ts`'s source regex and its error message; and the new
  assertion that the images segment map's key set is `DOMAINS` minus `Mystery`, derived from `Exclude<>`;
- `IResourceImageService.ImageOwnerTypes`, the declared four-element set (§2.6.3), which U2's route
  alternation and U3's drift test both read;
- the three **pinning tests** for the newly-reachable throws (§2.6.1): `ListAsync`, `UploadAsync` and
  `GetPrimaryImageIdAsync` each raise `ArgumentOutOfRangeException` for `DomainOwnerType.Mystery`. Written
  with `Assert.ThrowsAsync`, not `Assert.Throws` — §2.6.2's note;
- a Postgres-gated assertion that `custom_moves.owner_type` and `resource_images.owner_type` still hold
  exactly the five expected strings, so a future member rename fails here rather than at materialisation.

**Gate.** Backend and frontend suites pass with **the same counts as before the commit** — this is a
rename, so a changed count means something else happened. `dotnet ef migrations add` must produce an
**empty** migration if anyone runs it as a check (§2.6.5); **do not commit one.** And confirm the generated
SQL for the four repository projections is unchanged — the member names did not move, but
`MonsterRepository.cs:51` and its three siblings are inside expression trees and deserve the explicit
look rather than the compiler's word.

**U0 stands alone.** If U1–U3 were abandoned, U0 would still be a complete, coherent change. That is the
property that makes it safe to put first.

### U1 — Build the oracle. Test-only, zero production files. *(Bowser)*

Widen `ResourceImageApiHarness` to seed a **Location** and a **Bystander** alongside the existing two
Monsters and one Minion, and turn `ResourceImageEndpointTests`' fifteen Monster-only facts into a
**four-owner matrix against the shipped per-domain routes**.

**Why this is the most valuable commit in the plan.** It is the same discipline as 5f-0 and as the Phase
2/3 backend split: separate the behaviour-preserving measurement from the change it enables, so each
reviews against a different question. And it is *better* here than it was there, because of a property the
custom-move switchover did not have:

> **The URLs do not change, so U1's suite needs zero edits after U2.** A test file that is byte-identical
> before and after a refactor, and green both times, is the strongest available statement that nothing
> observable moved. Custom moves could not offer this — its endpoint tests had to be written against
> routes that were about to change hands.

**Gate:** green; `git diff --stat` touches no file outside `MonsterOfTheWeek.Api.Tests/Controllers/`.
Record the fact count before and after.

**One thing U1 should expect to find.** It will run `[RequestSizeLimit]`, the null-thumbnail fallback and
the 201/400 branch against Location, Bystander and Minion for the first time. If any of the four has
drifted, **U1 is where that surfaces** — as a pre-existing bug fixed before the refactor, not as a
regression introduced by it. §1.1's normalised diff says it has not, but a diff of source is not a test of
behaviour.

### U2 — The atomic switchover. *(Bowser)*

`ResourceImagesController` is created **and the twenty-four old actions are deleted in the same commit.**
This is not a stylistic preference.

> **A literal route segment outranks a constrained parameter.** `api/monsters/{id:guid}/images` has a
> literal at segment two; `api/{owner:regex(…)}/{ownerId:guid}/images` has a constrained parameter there.
> Route precedence resolves in favour of the literal — no `AmbiguousMatchException`, no warning, no
> failing test. If the new controller lands first, **all four domains keep routing to the old actions and
> the new controller receives zero traffic, while every gate passes.** For custom moves this cost four of
> five domains; here it costs **four of four**, so the new controller would be entirely dead and
> indistinguishable from working.

In the same commit: the four `private const string ImageCacheControl` and four
`private const long ImageRequestSizeLimitBytes`; the `IResourceImageService` parameter from the four
controller constructors; and the now-unused `using` directives (§5).

**Gate — and this is the part that has to be designed, because U1's suite cannot see it.** U1's matrix
passing proves the URLs still answer. It does **not** prove *which controller* answered them, because the
URLs are identical either way. The discriminating gate is the one `CustomMoveEndpointTests.cs:259-275`
already demonstrates, and it is cleaner here:

> **Register only `IResourceImageService` in the harness.** The unified controller's sole dependency is
> `IResourceImageService`; the harness seeds its four owners through `MotwDbContext` directly and needs no
> domain service or repository at all. So the harness's DI block drops from six registrations
> (`IMonsterRepository`, `IMinionRepository`, `IResourceImageService`, `ICustomMoveService`,
> `IMonsterService`, `IMinionService`) to **one**. A surviving per-domain image action would need
> `IMonsterService`/`ILocationService`/… and would 500 on activation instead of answering 200. That turns
> "the old actions are gone" from a claim into a test.

Plus two assertions that only the new shape can satisfy: `GET /api/MONSTERS/{id}/images` → 200 (pins the
`OrdinalIgnoreCase` dictionary), and `GET /api/xmonstersx/{id}/images` → 404 with a **zero-byte** body and
no `Content-Type` (pins the anchors — an unanchored regex would route it into the action, which would
answer with a ProblemDetails body from `AddProblemDetails()`; the body length is what distinguishes a
routing 404 from a controller 404, per §16.2's corrected table).

**Also exercise it against the real `Program.cs` host**, as Phase 2 of custom moves did, since the
harness is explicitly *"not `Program.cs`"* and the catch-all interaction lives there.

### U3 — The drift guard and the record. *(Bowser, then Yoshi)*

`ResourceImageOwnerDriftTests`, modelled on `CustomMoveOwnerDriftTests` — three assertions:

1. the alternation parsed back out of the `const string` **off the `[Http*]` attributes by reflection**,
   not off the constant, so an action given its own literal template fails too;
2. that alternation equals the controller dictionary's key set equals **`IResourceImageService.ImageOwnerTypes`**
   mapped through the segment convention. *Under two enums this expected set would have been
   `Enum.GetValues<ResourceOwnerType>()` and the whole assertion derived; under one enum it reads the
   declared set instead. That substitution is the entire C#-side cost of Q3 — §2.6.3.*
3. **Both halves of the membership question, which is the assertion that only exists because of the
   merge.** Every member of `ImageOwnerTypes` reaches a non-throwing arm of `OwnerExistsAsync`,
   `GetExplicitPrimaryImageIdAsync` **and** `SetPrimaryImageIdAsync` — three switches here, where custom
   moves had one — **and** every `DomainOwnerType` member *not* in `ImageOwnerTypes` reaches the throwing
   arm. Under two enums the second half was inexpressible, because `ResourceOwnerType.Mystery` did not
   exist. It turns §2.6.1's latent hazard into pinned, intentional behaviour, and it is what would catch a
   future `Mystery` arm being added to one of the three switches and not the others.

Then the record: the `design.md` §3 amendment (§3 above), the one-line `core/resource-images.ts` comment,
the one-line pointer in `docs/domain-custom-moves/architecture.md` §12 F1, **the amendment to that
document's §2.8 recording that it has been superseded** (§2.6 here is the replacement), and this
document's status updated to "landed" with the commit hashes — following `phases.md`'s own convention of a
header table mapping commit → phase.

**U3 may be folded into U2** if Skyler prefers; the only cost is that the deletion half and the
record-keeping half review together. **U0 may not be folded into anything** — Q6, as re-answered under
§2.6.

### What is deliberately not a phase

- **No additive table phase and no teardown phase.** The table, the service and the client already exist
  and are already unified. The entire custom-moves Phases 1 and 3 have no analogue here. U1–U3 are
  custom-moves Phase 2 alone, with an oracle in front of it and a guard behind it; U0 is a rename that
  belongs to neither.
- **No frontend phase for the unification.** §1.3 and §2.2(b): the client is already unified and the URLs
  do not move. **U0 is the exception and it is not a unification cost** — the enum merge reaches
  `core/models.ts`, two segment maps and one drift spec (§2.6.4, §2.6.6), which is Q3's bill, not this
  refactor's.
- **No `MigrateAsync()` hazard.** There is no migration in the tree at any point in this plan — confirmed
  for U0 as well, since the model snapshot records the provider type and the merge produces an empty
  migration (§2.6.5) — so the
  *"merging the commit and letting the host restart **is** the migration"* trap (B6 / B-R7) cannot fire.
  Stated explicitly because it is the loudest warning in the custom-moves record and its absence here is a
  genuine, checkable difference rather than an oversight.

---

## 5. Change inventory — derived, with the derivation

The custom-moves teardown inventory had **six file omissions** while its counts were all correct, and a
grep-driven teardown would have stranded eight methods because two domains named their repository methods
differently. The lesson is to publish the derivation, not the list. Here is both.

```sh
# the actions
grep -n '\[Http[A-Za-z]*("api/[^"]*images' src/api/MonsterOfTheWeek.Api/Controllers/*.cs
# the constants
grep -rn 'ImageCacheControl\|ImageRequestSizeLimitBytes' src/api/MonsterOfTheWeek.Api/
# the constructor parameters and every other reference
grep -rn 'IResourceImageService' src/api/ --include=*.cs | grep -v /obj/ | grep -v /bin/
# the enum references that decide which `using` dies
grep -c 'ResourceOwnerType' src/api/MonsterOfTheWeek.Api/Controllers/*Controller.cs
# U0's sweep, both sides — the compiler proves completeness, these give the size up front
grep -rc 'ResourceOwnerType\|CustomMoveOwnerType' src/api --include=*.cs | grep -v ':0'
grep -rc 'ResourceOwnerType\|CustomMoveOwnerType' src/web/monster-of-the-week-web/src --include=*.ts | grep -v ':0'
```

**U0's sweep, measured.** `ResourceOwnerType`: **151** occurrences in **23** backend files, **32** in
**10** frontend files. `CustomMoveOwnerType`: **151** in **21** backend files, **34** in **10** frontend
files. **368 token edits in 41 distinct files**, all but two of them compiler-proven on one side or the
other — the two exceptions are the source-text regex and its error message in
`shared/custom-moves-five-domain-drift.spec.ts:67-68`, which fail loudly at module load rather than
silently (§2.6.6). The four EF projections in `MonsterRepository`, `MinionRepository`,
`LocationRepository` and `BystanderRepository` are inside expression trees and are named separately
because a sweep of "the service and the controllers" would not reach them.

| File | Change | Verified |
|---|---|---|
| *(U0)* `Data/Entities/DomainEntities.cs` | two enums → one `DomainOwnerType`, five member names **unchanged** | both declarations read; names are a data contract, §2.6.5 |
| *(U0)* 40 further `.cs`/`.ts` files | mechanical rename | counted above; compiler-proven |
| *(U0)* `Services/ResourceImages/IResourceImageService.cs` | + `ImageOwnerTypes` declared set | §2.6.3 |
| *(U0)* `core/models.ts` | `DomainOwnerType` + `ImageOwnerType = Exclude<…>` | §2.6.4 |
| *(U0)* `shared/custom-moves-five-domain-drift.spec.ts` | regex + message amended; one new derived assertion | §2.6.6 item 3 |
| `Controllers/ResourceImagesController.cs` | **new**, ~170 lines | — |
| `Controllers/MonstersController.cs` | −86 lines (154–239), −2 consts, −1 ctor param, −2 `using` | 8 `ResourceOwnerType` refs, all after the `--- Images` marker |
| `Controllers/MinionsController.cs` | −82 lines (157–238), same | 8, all after the marker |
| `Controllers/LocationsController.cs` | −82 lines (119–200), same | 8, all after the marker |
| `Controllers/BystandersController.cs` | −82 lines (112–193), same | 8, all after the marker |
| `Tests/Controllers/ResourceImageApiHarness.cs` | +2 seeded owners (U1); DI 6 registrations → 1 (U2) | read in full |
| `Tests/Controllers/ResourceImageEndpointTests.cs` | 15 facts → four-owner matrix (U1); **unchanged by U2** | read in full |
| `Tests/Controllers/ResourceImageOwnerDriftTests.cs` | **new** (U3) | — |
| `core/resource-images.ts` | one comment line | read in full |
| `docs/resource-images/design.md` | §3 amendment | §3 above |
| `docs/domain-custom-moves/architecture.md` | one line in §12 F1 (Yoshi's own section) | — |

**Two `using` directives die per controller**, not one: `MonsterOfTheWeek.Api.Services.ResourceImages`
(for `IResourceImageService`) and `MonsterOfTheWeek.Api.Data.Entities` (for `ResourceOwnerType` — the only
`Data.Entities` type any of the four controllers references, 8 occurrences each, every one inside the
image block). `TreatWarningsAsErrors` is **not** set in either `.csproj`, so a leftover `using` is a
warning and will not fail the build. Do not rely on the compiler to find these.

**Three things that must NOT be torn down, each of which looks like dead config:**

1. **`builder.Services.AddScoped<IResourceImageService, ResourceImageService>()` in
   `MysteryLinkApiHarness.cs:117` and `MinionReparentApiHarness.cs:117`.** These read like registrations
   for the controller's constructor, and after U2 that constructor no longer takes it. **They are still
   required** — `MonsterService`, `MinionService`, `LocationService` and `BystanderService` each take
   `IResourceImageService` for owner-delete cleanup. Removing them does not fail the build; it fails the
   first request, which is exactly the B1 hazard shape.
2. **`Contracts/ApiMappers.cs`'s `ToUploadFilesAsync`.** It goes from four callers to one. It stays.
3. **`ToActionResult`/`ToErrorResult` on `MonstersController` and `MinionsController`.** Still used by
   their non-image actions.

---

## 6. Test strategy

| Guard | Kind | What it covers |
|---|---|---|
| `ResourceImageEndpointTests` as a four-owner matrix | **transcribed** URLs, **derived** owner set if parameterised over `ImageOwnerTypes` | the six actions × four owners over real HTTP |
| the only-`IResourceImageService` harness | **derived** | that no per-domain image action survived |
| the mixed-case probe | transcribed | the `OrdinalIgnoreCase` dictionary |
| the `xmonstersx` zero-byte-404 probe | transcribed | the regex anchors |
| `ResourceImageOwnerDriftTests` | **derived**, from `ImageOwnerTypes` — which is itself **transcribed** | regex ↔ dictionary ↔ declared set ↔ three service switches, in **both** directions (§4 U3 item 3) |
| **`IResourceImageService.ImageOwnerTypes`** | **transcribed** — the one place the image-owner set is written down, and the direct cost of Q3 | §2.6.3 |
| the three `ArgumentOutOfRangeException` pinning tests (U0) | derived from `DomainOwnerType \ ImageOwnerTypes` | that `Mystery` fails loudly rather than quietly, §2.6.2 |
| `shared/custom-moves-five-domain-drift.spec.ts` | derived, from the union's **source text** | still five domains after the rename; plus the new `Exclude<>` cross-check, §2.6.6 |
| `core/models.ts`'s `ImageOwnerType = Exclude<…>` | **derived**, and newly so | the images segment map cannot gain or lose a key, §2.6.4 |
| `resource-images-four-domain-parity.spec.ts` | derived (DOM) | unaffected — the front end does not move |

Applying §29.15's frame, and this is where Q3 shows up most honestly:

> **Before the merge, *everything* about shape here was derivable** — the owner set was an enum the tests
> could enumerate, and the only transcriptions were three probe URLs and the response-body expectations
> that were already transcribed. **After the merge, exactly one shape fact becomes transcribed on the C#
> side** (`ImageOwnerTypes`, four elements, with a drift guard reading it) **and exactly one becomes
> derived on the TypeScript side** (`ImageOwnerType = Exclude<DomainOwnerType, 'Mystery'>`, replacing two
> independently hand-written unions). Net, it is close to a wash, and it is a *better* wash than it looks:
> the thing that became transcribed has a test over it, and the thing that became derived previously had
> nothing relating the two lists at all.

**If this feature breaks quietly it will break in the response-body expectations, not in the owner set** —
which is the opposite of the custom-moves answer, because this change brings no new data and no new UI.

One standing-decision check, since it is the kind of boundary that gets reopened by accident:
`ByMysteryVariantsStayOutOfScopeTests.cs` encodes the deliberate ruling that the four by-mystery list
endpoints are out of scope for images. **Nothing in this plan touches list projections at all**, so that
boundary is untouched. Said explicitly because §10's F5 interaction lands on the same two files.

---

## 7. Risks

| | Risk | Mitigation |
|---|---|---|
| **U-R1** | The controller lands before the deletions; all four domains keep routing to the old actions; every gate passes against the old code. | U2 is one commit. The only-`IResourceImageService` harness is the test that can tell the difference. §4 U2. |
| **U-R2** | Unanchored regex silently accepts `xmonstersx`. Invisible in review. | The anchors are a stated requirement with the probe that proves them, and the comment at the declaration says why. §2.3. |
| **U-R3** | An ordinal dictionary turns `/api/MONSTERS/{id}/images` from a working 200 into a 500. | `OrdinalIgnoreCase` + the mixed-case probe in the endpoint matrix. §2.3. |
| **U-R4** | The four duplicated constants are collapsed to one without anyone checking they are equal, silently changing one domain's limit or cache header. | §1.1's normalised diff says they are identical **today**; U1's matrix asserts the behaviour per owner **before** the collapse. Do both; the diff is source and the matrix is behaviour. |
| **U-R5** | A per-action attribute is dropped in the move and nobody notices, because only Monster's is tested. | U1 makes the 24 MiB test cover all four owners before U2. After U2 there is one action, so one test is complete rather than partial. |
| **U-R6** | A harness's `IResourceImageService` registration is removed as apparently-dead config and the harness 500s at request time, not build time. | §5's explicit do-not-remove list, with the reason. |
| **U-R7** | Swagger discoverability loss is discovered later and treated as a regression. | §2.7 states it as an accepted cost with a named cure and a named threshold, and U2's gate re-measures the path count rather than leaving the prediction standing. |
| **U-R8** | Someone later builds mystery images and adds a `Mystery` arm to one of the three image switches but not the others, or to all three but not the route — producing a reachable 500 or an unreachable feature. | U3's drift assertion 3 guards **both** directions over all three switches, which is only expressible under the merged enum (§4 U3). |
| **U-R9** | **The TypeScript unions are merged without the `Exclude<>` narrowing.** `Record<DomainOwnerType, string>` then *forces* a `Mystery: 'mysteries'` key into the images segment map; `resourceImagesPath('Mystery', id)` compiles and builds a URL that 404s; `SUPPRESS_ERROR_TOAST` makes it silent; and `custom-moves.spec.ts:69`'s cross-check **passes anyway**, because `'mysteries'` is the correct *custom-move* segment. The one guard that looks like it covers this does not. | §2.6.4 states the narrowing as a requirement with a comment at the declaration saying what it prevents, and U0 carries the derived `DOMAINS`-minus-`Mystery` assertion that does catch it. **This is the highest-value new risk Q3 created and the easiest one to not notice.** |
| **U-R10** | A member of the merged enum is renamed (tidied, pluralised, reordered-and-retyped) and every existing `custom_moves` / `resource_images` row fails to materialise. | The five member names are a **data contract** under `HasConversion<string>()` (§2.6.5), stated at the declaration and pinned by U0's Postgres-gated assertion on the stored strings. |
| **U-R11** | The enum merge is folded into U2 and a 24-action deletion is reviewed inside a 368-site rename. | U0 is a separate, first commit whose gate is "same test counts as before." §4. |

---

## 8. Honest cost, against the thing it resembles

The custom-moves backend rework is the measured experiment this would otherwise have to estimate. Its
Phases 1–3 were **six commits** (`619be92`, `64e9826`, `d87974b`, `52cc63b`, `84facbc`, `81f5960`), moving
the backend suite from 615/0/4/619 to 677/0/7/684, and its diffstats were 10, 27, 13, 20, 31 and 4 files.

| | Custom moves, Phases 1–3 (measured) | Images unification (estimated) |
|---|---|---|
| Commits | 6 | **4** (U0 is Q3's, not the refactor's — U1–U3 are **3**) |
| New tables | 1 | 0 |
| Migrations | 2, one of them irreversible and auto-applied at startup | **0** — confirmed for U0 too, §2.6.5 |
| Service layer | a new interface + implementation; five domain services gained a dependency reaching **67 constructor call sites** and three harnesses | **no logic change**; U0 renames the parameter type on 7 members and adds one declared set |
| Entities / repos / context config torn down | 5 entities, 5 nav collections, 5 `DbSet`s, 5 config blocks, 16+16 repo members, 16+16 service members | **0** |
| Detail projections re-pointed | 7 | **0** |
| Controller actions deleted | 16 | **24** |
| Frontend | Phases 4, 5a–5e, 5f-0…5f-3b, 6 — nine card call sites, a wizard, a drift guard | **one comment line** for U1–U3; **66 renamed tokens in 10 files + one `Exclude<>` + one spec amendment** for U0 |
| Contract change | none, by construction | none, by construction |
| Irreversible step | the drop migration | **none** |
| *(added by Q3)* | — | a **368-token, 41-file, compiler-proven** rename with zero behaviour change |

**So the honest estimate is: this is custom-moves Phase 2, and only Phase 2** — plus a rename that Skyler's
Q3 answer bought deliberately and that would be exactly the same size whenever it was taken. The two
expensive halves of
that work — the schema/service construction in Phase 1 and the teardown in Phase 3 — have no analogue,
because `resource-images` already paid for both when it chose a single table and a single service. The
largest single item in the custom-move backend (B1's 67 call sites) has no analogue either, in the
*opposite* direction: this change **removes** a constructor parameter from four classes that nothing
constructs by hand (verified: zero `new *Controller(` anywhere in the repo).

**Where it is genuinely harder than Phase 2 was:** six actions instead of four, two of which have
behaviour the other four do not (multipart binding, `File()` + cache headers); live consumers that must be
proved unaffected rather than argued unaffected; and three domains whose HTTP behaviour is currently
unverified, so U1 is a real piece of work rather than a formality. **Where it is easier:** no contract
risk at all, no migration, no teardown, no frontend, and an oracle that needs zero edits across the
switchover.

**If this is bigger than one sitting, the natural cut is U1 alone** — it is pure coverage, it stands on
its own merits whether or not the unification ever happens, and it leaves nothing half-done.

---

## 9. The other flat sub-resources — closed; and the separately-numbered F2, which is not

### 9.1 The label collision, and which of the two Skyler's answer closed

Two different things have been called "F2," and the distinction is load-bearing because **one of them is
now closed and the other is not.**

- **"The other flat sub-resources"** — powers, weaknesses, armors, attacks. This was F2's content in an
  earlier revision of the custom-moves plan, and it is what **Q7's options were about**. Skyler answered
  *"images only, close the question."* **Considered and declined — §9.2 keeps the reasoning so the next
  person meets a decision rather than an open invitation.**
- **The shipped `docs/domain-custom-moves/architecture.md` §12 F2** — *"Revisit the create-page batch
  pattern as a unit"*, the frontend `saveSubResourceDrafts` + `runBatch` + `draftsFailed` primitive. F2
  was **inverted** to this when Skyler reverted the create shape from one-shot back to two-step, because
  its original premise (pulling sub-resources into the create transaction) had been decided against three
  paragraphs earlier. **It was not among Q7's options and is therefore untouched by Q7's answer** — §9.3.

**Neither should be referred to by number without saying which.** A follow-up referred to by number across
a revision boundary needs its content restated, not its number.

### 9.2 The flat sub-resources — **closed, 2026-10-12: considered and declined**

**Skyler's answer to Q7 was "images only, close the question."** So this is not deferred, not parked, and
not waiting for a trigger: powers, weaknesses, armors and attacks stay as they are, duplicated across
Monster and Minion. The analysis below is kept in full because *a declined option whose reasoning is
deleted gets re-proposed*, and because one of its findings (§9.2's reading of `design.md` §1.3) outlives
the decision and is recorded as U-F5.

**The structural case is real.** Applying §2.2's test — *is the row field-for-field identical across
domains?* — to every sub-resource, read off `DomainEntities.cs`:

| Family | Monster side | Minion side | Identical? |
|---|---|---|---|
| Power | `Id / MonsterId / Name / Description?` | `Id / MinionId / Name / Description?` | **yes** |
| Weakness | `Id / MonsterId / Name / Description?` | `Id / MinionId / Name / Description?` | **yes** |
| Armor | `+ HarmSoak / IsSpecial / SpecialDescription?` | same | **yes** |
| Attack | `+ Harm`, plus a weapon-tag join table | same, plus its own join table | **yes**, including the join table |

So all four families pass the test, and `design.md` §1.3's claim that *"Attacks/Powers/CustomMoves are
genuinely different data per domain"* is wrong about **all three** of its examples, not just the one my
earlier history entry caught. Worth recording.

**And the cost case is completely different from images, for one structural reason.**

> For images, the table was already unified and **only the HTTP surface was duplicated.** For powers,
> weaknesses, armors and attacks, **the duplication goes all the way down** — eight tables, eight
> entities, eight repository member sets, eight service member sets, eight sets of detail-projection
> `.Include`s, two client services, and every call site in the detail pages, the create pages and the
> wizard.

That is why the images unification is three commits (four with U0's enum rename) and this is not.
Specifically:

1. **It is two domains, not four or five.** Monster and Minion only — Location, Bystander and Mystery have
   none of these. So it halves the duplication-removal benefit relative to custom moves while paying the
   **full** discriminator cost: no FK, no DB cascade, nav properties removed, detail projections gaining a
   query each, owner-delete cleanup in application code.
2. **The Monster → Minion cascade trap is four times worse.** Deleting a Monster cascades to its Minions
   in the database, running no application code. Custom moves solved this once, in the explicit
   transaction `MonsterService.DeleteAsync` already had. Four families means four cleanups per owner, and
   the test that would stay green over the bug is the same shape as `MonsterMinionCascadeTests` — an
   assertion over a sibling sub-resource that still has its FK cannot see the one that lost it.
3. **These endpoints are live and the client is not unified.** Measured: `MonstersController` carries
   **19** sub-resource actions (attacks 4, weapon-tags 3, powers 4, armors 4, weaknesses 4) and
   `MinionsController` the same 19 — **38 actions**. Unlike images, there is no `OWNER_SEGMENT` map
   waiting for them: `core/monster.ts` and `core/minion.ts` are per-domain services with per-domain
   methods, and the detail pages, create pages and the 3,000-line wizard store all call them. This is the
   one of the three cleanups with a **real** frontend migration, and it lands on the app's most-used write
   surface.
4. **Attacks drag a join table each.** `MonsterAttackWeaponTag` and `MinionAttackWeaponTag` both FK to
   `WeaponTag`. Unifying attacks means unifying those too, and a join table hanging off a discriminated,
   FK-less parent is a materially worse shape than a flat child.

**My recommendation was a separate later pass with a lean against attacks and armors. Skyler went
further and closed it.** That is the right call on this evidence and I have nothing to add against it:
taking all four families would reproduce the custom-moves Phases 1–3 shape four times over against live
endpoints, which is a multi-week feature, not a cleanup pass.

**If it is ever reopened**, the decomposition that was on the table is recorded here so it does not have
to be re-derived: **one family at a time, weaknesses first** (smallest surface, no extra columns, no join
table, one card per detail page), with a gate that the next family does not start until the first has
landed and been used — and never sharing a branch or phase list with the images work, which has nothing in
common with it mechanically.

**One finding outlives the decision**, and it is recorded as **U-F5** rather than lost with the declined
option: `design.md` §1.3 justifies the single-`ResourceImage`-table departure by saying
*"Attacks/Powers/CustomMoves are genuinely different data per domain."* Measured above, that is wrong
about **all three** of its examples. The §1.3 *decision* holds; its *reason* over-reached. Worth one
amended sentence whenever §1.3 is next touched, independently of whether the cleanup is ever done.

### 9.3 The separately-numbered F2 (the create-page batch primitive) — **not closed by Q7**

**`docs/domain-custom-moves/architecture.md` §12 F2 stands exactly as written.** It was not among Q7's
options, so Q7's answer does not reach it, and nobody should later read "images only, close the question"
as having closed it — §9.1.

`saveSubResourceDrafts` + `runBatch` + `draftsFailed` + the hedged caveat copy is hand-rolled on four
create pages and now carries five sub-resource types plus membership links. Phase 6's parity spec
(`6-P1`, `6-P2`) currently guards it by asserting the four agree — which is a drift guard over a
duplication, i.e. the thing you build when you have decided not to extract yet.

It is a genuine candidate, it is frontend-only, and it interacts with **nothing** in this document. Two
notes for whoever picks it up:

- `6-P1` asserts the four caveats **agree**; it does not know what they should say. A wrong-but-uniform
  caveat passes. An extraction would make that assertion trivially true and should replace it with one
  over the extracted primitive's behaviour, not merely delete it.
- Its best moment is **after F5**, not before: F5 removes the wizard attach fetch, which changes what the
  wizard's equivalent of this primitive has to handle.

**Recommendation: separate pass, lower priority than F5, and not blocked by anything here.**

---

## 10. F5 interaction — noted, nothing decided

Out of scope by Skyler's own deferral, and about custom-move list projections rather than images. One
interaction worth having written down, and no decision taken:

F5 would add `customMoves` to `LocationListItemResponse` and `BystanderListItemResponse` — **the same two
list projections that already carry the derived `primaryImageId`**, and the same two guarded by
`ListProjectionPrimaryImageAgreementTests.cs` and bounded by `ByMysteryVariantsStayOutOfScopeTests.cs`.
Nothing in this plan touches list projections, so there is no ordering constraint in either direction and
either can land first. The only thing to carry across: **both of those test files encode the deliberate
by-mystery exclusion**, and whichever of F1 or F5 lands second must not widen it by accident.

The `CustomMoveService.list()`-has-no-caller consequence recorded in §12's F5 entry is unaffected by
anything here.

---

## 11. The questions, with their answers and the reasoning kept beside them

Each was a real choice with its options and my recommendation. **Four were answered by Skyler on
2026-10-12; the other four stand at my recommendation, one of them re-answered under the new enum.** The
reasoning is kept next to each answer rather than deleted — a closed question whose rationale is gone is
an answer nobody can check.

**Q1 — Unify at all?** ✅ **ANSWERED (A), as recommended.**
**(A)** Unify, as §2.1: one controller, four-member owner segment, URLs unchanged, backend-only.
**(B)** Leave the twenty-four actions and close F1 as "considered and declined," keeping Swagger's
concrete route list as the thing the duplication buys. **(C)** Unify *and* build mystery images in the
same pass.
➡ **Recommended (A); taken.** (C) turns a zero-migration refactor into a schema change and a UI
feature — §2.6. (B) is defensible only if the Swagger route list is worth more than 332 lines, seven
unguarded duplications and the coverage gap in §1.4; I do not think it is.

**Q2 — Four owner segments or five?** ⚖️ **Stood at my recommendation; re-answered on the merged enum's
own terms, and unmoved. (A).**
**(A)** `monsters|minions|locations|bystanders` — four. **(B)** Five, with `mysteries` falling into the
throwing arm. **(C)** *(only possible under the merge)* Five, with `mysteries` mapped to an explicit 404
in the action.
➡ **(A).** Worked in full at §2.6.3. (B) makes a user-constructible URL a 500. (C) changes a shipped
routing 404 (0 bytes) into a controller 404 (162-byte ProblemDetails) and puts a per-feature legality
branch inside the action, which is precisely the rule §2.8 warned rots — for no benefit, since no client
constructs that URL. **The principle it settles:** a route constraint expresses what the *feature*
serves, not what the *domain* contains, and it is the right place to write the image-owner boundary down
because it already enumerates the set, is already drift-tested, and fails closed.

**Q3 — One enum or two?** ❗ **ANSWERED (B) — against my recommendation. This is the §2.8 reversal.**
**(A)** Keep two: `ResourceOwnerType` at four, `CustomMoveOwnerType` at five.
**(B)** Merge into one `DomainOwnerType` with five members, each feature validating its own subset.
➡ **I recommended (A); Skyler took (B).** My reasoning, kept because it is the fact the new design has to
encode explicitly: `Mystery` has no `PrimaryImageId` column, no FK and no index, so mystery images is a
migration plus three service arms plus a list projection plus a UI — the enums converge when the *feature*
is built, not when a member is typed, and until then the image-legal set is genuinely narrower than the
domain.
➡ **The decision stands and §2.6 is written to it, not against it.** Worked through in full there:
**(1)** three default arms become newly reachable, but `OwnerExistsAsync` dominates the other two in every
call path that exists, so the blast radius is one method (§2.6.1); **(2)** the right behaviour is to keep
the throw — "make it unrepresentable" collapses back into the declined two-enum design, and a
`Mystery => false` arm would compile and pass silently in a world where mystery images *had* been built
(§2.6.2); **(3)** Q2 is unmoved, with the route constraint carrying the feature boundary (§2.6.3);
**(4)** on the TypeScript side the merge is **strictly better** — `Exclude<DomainOwnerType, 'Mystery'>`
replaces two independently hand-written unions with a derived subset, which nothing in the repo produces
today (§2.6.4); **(5)** it is **not a migration at all**, now or later, because the model snapshot records
the provider type (§2.6.5); **(6)** the shipped custom-moves drift guard needs two tokens, does not
weaken, and gains an assertion only the merge makes expressible (§2.6.6).
➡ **Nothing surfaced that makes the merge unwise** (§2.6.7). The one real cost is the 368-site rename
across shipped green code, which is the trade Skyler has already stated his position on.

**Q4 — Error-mapping policy for the unified controller.** ⚖️ **Stands at my recommendation. (A).**
**(A)** `ToErrorResult` (Monster/Minion/Mystery/CustomMoves' policy; 400-with-message for `Validation`).
**(B)** `IsSuccess ? Ok : NotFound` (Location/Bystander's policy; everything collapses to 404).
➡ **Recommended: (A).** Verified it changes no response today — §1.2 — and it is the policy that stays
correct if a `Validation` error is ever added to the image service. Identical reasoning to B9, re-derived
against this service rather than inherited.

**Q5 — Swagger.** ✅ **ANSWERED (A), as recommended.**
**(A)** Accept the loss (20 templates → 5; `owner` an un-enumerated `string`), as §22 did.
**(B)** Build the ~15-line `IOperationFilter` now, serving both parameterised-owner controllers.
➡ **Recommended (A); taken**, with the honest note that (B) had got stronger — §22 declined it when the
payoff was one controller and it would now be two. The threshold for revisiting is a **third**
parameterised-owner route; recorded as U-F2 so it sits on the shelf rather than being rediscovered.
Swagger is Development-only (`Program.cs:179-183`), so this is developer ergonomics, not an API contract.

**Q6 — How many commits?** ⚖️ **Moved by Q3's answer: three becomes four. (A), extended.**
**(A)** U1 oracle / U2 switchover / U3 guard + record. **(B)** U1 / U2+U3 combined.
➡ **(A) — and Q3 adds U0 in front of it.** The enum merge is a 368-token, 41-file rename with zero
behaviour change; folding it into U2 would bury a 24-action deletion inside it and make the one commit
that must be read line by line unreadable. U0 goes **first**, so U1's widened harness and matrix are
written against the final type names and are never swept twice — and U0 stands alone, remaining a
complete coherent change even if U1–U3 were abandoned. U3 may still be folded into U2 if preferred; **U0
may not be folded into anything.** §4.

**Q7 — Scope: the other flat sub-resources.** ✅ **ANSWERED: "images only, close the question."**
**(A)** Images only. Close the flat-sub-resource question as considered and declined.
**(B)** Images now; the flat sub-resources as a separate, later plan, one family at a time starting with
weaknesses. **(C)** Both in one pass.
➡ **I recommended (B); Skyler took the narrower (A).** Right call on this evidence — §9.2 keeps the
reasoning (two domains instead of four, duplication that goes all the way down rather than stopping at the
HTTP layer, a real frontend migration on the app's most-used write surface, a join table per attack
family) so the option is met as a decision rather than an open invitation. **Powers, weaknesses, armors
and attacks are considered and declined, not deferred.**
➡ **This does not close `docs/domain-custom-moves/architecture.md` §12 F2**, the create-page batch
primitive, which was not among these options. §9.1 and §9.3 make the distinction explicit precisely so
nobody collapses the two later.

**Q8 — Does U1 need to land even if Q1 had been answered (B)?** ⚖️ **Stands at my recommendation. (A)** —
moot now that Q1 is (A), but the reasoning is why U1 is first among U1–U3.
**(A)** Yes — the four-owner endpoint matrix is worth having whether or not the unification happens, since
three of four domains have no automated HTTP coverage of their upload limit today.
**(B)** No — it exists only to de-risk U2.
➡ **(A).** It is the one piece of the plan whose value does not depend on the rest of it.

---

## 12. Follow-ups from this document

| # | Follow-up | Trigger |
|---|---|---|
| **U-F1** | **Five private copies of `ToActionResult`/`ToErrorResult`.** This change adds the fifth. A shared `ControllerBase` subclass or an extension method would collapse them, and was deliberately not done in a phase whose point is subtraction (§2.4). | On request, or the first time a sixth controller needs one. |
| **U-F2** | **Build the Swagger `IOperationFilter`** that sets the `owner` parameter's `Schema.Enum`, serving every parameterised-owner route at once. | A **third** parameterised-owner route appears. §2.7. |
| ~~**U-F3**~~ | ~~**Merge `ResourceOwnerType` and `CustomMoveOwnerType`** into one enum, gated on mystery images being built.~~ **Retired 2026-10-12 — Skyler answered Q3 (B) and the merge is now U0, not a follow-up.** The gate this row proposed (wait for mystery images) was my recommendation and was declined. §2.6. | — |
| **U-F3a** | **When mystery images is eventually built**, the three `ArgumentOutOfRangeException` arms in `ResourceImageService` and `ImageOwnerTypes` must be updated together, and the route alternation with them. U3's bidirectional drift assertion is what forces this rather than leaving it to memory — it fails whether the arms are added without the set or the set without the arms. | Mystery images. §2.6.1, §4 U3. |
| ~~**U-F4**~~ | ~~**The flat sub-resources** (powers, weaknesses, armors, attacks across Monster and Minion).~~ **Closed 2026-10-12 — considered and declined** by Skyler's Q7 answer, *"images only, close the question."* Not deferred. The reasoning is kept in §9.2 so the option is met as a decision; the decomposition that was on the table is recorded there in case it is ever reopened. **Distinct from `docs/domain-custom-moves/architecture.md` §12 F2, which is untouched** (§9.1, §9.3). | — |
| **U-F5** | **`design.md` §1.3's generalisation is wrong about all three of its examples**, not just custom moves: powers, weaknesses, armors and attacks are each field-for-field identical across Monster and Minion (§9.2). The §1.3 *decision* holds; its *reason* over-reached. Worth one amended sentence whenever §1.3 is next touched. | With U3's record-keeping commit, or the next `design.md` pass. |

---

## 13. U0 as built — the five places it differed from §2.6/§4

**Added by Bowser, 2026-10-13, on branch `image-endpoint-unification`.** Yoshi's text above is his; this
section records only where the implementation departed from what it specified, per the standing rule that
a spec's outcome is recorded where it differs and nowhere else. **Everything not listed here was built as
written** — including the decision itself (one `DomainOwnerType`, five member names unchanged), the
`Exclude<>` narrowing, the declared `ImageOwnerTypes` set, the two-token drift-spec amendment, the "no
migration" property, and §2.6.6's four EF projections.

**1. The sweep is 368 edits across 57 distinct files, not 41.** Every one of Yoshi's four component
counts re-measured exactly — `ResourceOwnerType` 151 occurrences / 23 backend files + 32 / 10 frontend,
`CustomMoveOwnerType` 151 / 21 + 34 / 10, totalling 368. **The 41 is an arithmetic slip, not a
measurement error:** the two backend sets overlap in 6 files and the two frontend sets in 1, so the
distinct count is (23 + 21 − 6) + (10 + 10 − 1) = 38 + 19 = **57**. `git status` after the sweep reports
exactly 57 modified files, which is the same number arrived at independently.

**2. Five pinning tests, not three.** §4's three (`ListAsync`, `UploadAsync`, `GetPrimaryImageIdAsync`)
reach only **two** of §2.6.1's three switches — `ListAsync` and `UploadAsync` both land on
`OwnerExistsAsync`. A fourth was added for `SetPrimaryAsync`, which needs a `Mystery`-owned row written
straight through the context to get past the `belongsToOwner` check; §2.6.1 calls that arm "unreachable
by construction", and this constructs it on purpose so the arm is *pinned* rather than merely unreached.
A fifth asserts that `ImageOwnerTypes` and the throwing members **partition** `DomainOwnerType`, which is
the part of U3's third assertion that is true before the controller exists — the declared constant should
not land unguarded for three commits.

**3. "The same suite counts as before" cannot hold literally, and the number that matters is the
delta.** U0's own specified contents are new tests. Backend **677 → 682 passed** (+5: the five above),
**7 → 8 skipped** (+1: the new Postgres gate), 0 failed. Frontend **1,790 → 1,791 passed** (+1: the new
6-D3 assertion), 129 files unchanged. The gate was read as *"every pre-existing test still passes and the
count moves by exactly the tests this commit deliberately adds, enumerated"* — which is checkable, where
the literal reading forbids U0's own contents.

**4. §4's Postgres assertion is vacuous as specified, and needed a transcribed pin.** *"Assert the two
`owner_type` columns still hold exactly the five expected strings"* was first built deriving both sides
from `Enum.GetNames<DomainOwnerType>()`. **That cannot fail.** Rename a member and the written value, the
read value and the expectation all move together — confirmed by control: with `Mystery` renamed, the
derived version passed, and so did `CustomMoveMigrationPostgresTests`, which round-trips the member
through the real provider. What catches a rename is (a) a **transcribed** list of the five strings, and
(b) rows **inserted as raw SQL with those literals** and then materialised through EF, which is the
production failure exactly: `Cannot convert string value 'Mystery' from the database to any value in the
mapped 'DomainOwnerType' enum.` Both are in the test; (b) was verified to fire on its own with (a)
disabled. **Generalising: a round trip through the same converter on both ends proves the converter is a
bijection, not that its names are the ones already in the table.**

**5. §2.6.4 understates how blind `custom-moves.spec.ts` is to U-R9 — the conclusion is right and the
reason is stronger.** §2.6.4 says the cross-check *"would pass, because `'mysteries'` is the correct
custom-move segment."* Measured: `:69` loops over `['Monster', 'Minion', 'Bystander', 'Location']` and
**never passes `'Mystery'` to `resourceImagesPath` at all** — the mystery segment is checked by a separate
test, against `MysteryService`'s shipped URL. So it is not a check that happens to agree; it is a check
that never runs on the broken input. **Control, predicted and then measured:** widening `ImageOwnerType`
to `DomainOwnerType` without adding the forced keys fails `tsc` with exactly two errors, both
`Property 'Mystery' is missing` (`core/resource-images.ts` `OWNER_SEGMENT` and
`shared/resource-thumbnail.component.ts` `PLACEHOLDER_CLASSES`) — the compiler *forcing* the key in,
verbatim as §2.6.4 describes. Add the two keys and `tsc` is **clean**, and the whole pre-U0 suite is
**green: 1,790 passed, 0 failed.** The single failure is 6-D3, the assertion this commit adds. That is
the evidence that the narrowing is load-bearing: without it the hazard is invisible to every test that
existed, and visible to exactly one that did not.

---

## 14. U1 as built — the four places it differed from §4

**Added by Bowser, 2026-10-13**, same append-only convention as §13. Everything not listed here was built
as §4 specifies: the harness widened to Location and Bystander, the Monster-only facts turned into a
four-owner matrix against the **shipped per-domain routes**, zero production files touched.

**1. Fourteen facts, not fifteen.** Measured before converting anything: `ResourceImageEndpointTests.cs`
held **14 `[Fact]`s and 26 URL references, every one `api/monsters/`** — no `[Theory]`, no `[InlineData]`,
and `public async Task` also counts 14. §4's "fifteen" is one high. Same shape as §5's 41-files slip and
caught the same way, by counting before repeating.

**2. The null-thumbnail fallback had zero coverage, not three-quarters of it.** §4's *"One thing U1
should expect to find"* lists the fallback alongside `[RequestSizeLimit]` and the 201/400 branch as things
U1 runs *"against Location, Bystander and Minion for the first time"* — which reads as "Monster already
covers all three." Monster covered the first and the third. **Nothing covered the fallback, for any
domain:** `return image.ThumbnailBytes is null ? File(image.ImageBytes, image.ContentType) : …` exists in
four controller copies and no test in the solution ever reached it, because the service generates a
thumbnail for every file it accepts, so no upload can produce the state the branch tests. The matrix adds
it as a sixteenth theory, with a harness helper that nulls a stored row's `ThumbnailBytes` directly —
**the only way to reach it.** Included rather than noted because U2 rewrites exactly this branch into one
place, and a branch with no oracle is one a refactor can drop silently.

**3. §4 expected U1 might surface a pre-existing per-domain bug. It did not — and that is a result, not a
non-event.** All sixty matrix cases passed on the first run. §1.1's normalised source diff and §1.2's
argument that the two error policies *"cannot produce a different response today"* both now hold under
**execution** rather than under reading, which is precisely the gap §4 named when it said *"a diff of
source is not a test of behaviour."* The Location/Bystander inline `NotFound()` and the
Monster/Minion `ToErrorResult` pair produce identical responses on every path the six endpoints have.

**4. The matrix is 61 cases, and which side is transcribed is a deliberate choice.** 15 theories × 4
owners + 1 count pin. **The four `{DomainOwnerType, segment}` pairs are transcribed, and the harness's
seed table is transcribed separately**; neither derives from `IResourceImageService.ImageOwnerTypes`. That
is not an oversight to tidy at U3 — deriving the matrix from the declared set would make the expectation
and the subject two readings of one declaration, so a member quietly dropped from `ImageOwnerTypes` would
stop being seeded, stop being tested, and leave the suite green. **That is U0 §13 item 4's vacuity in a
new costume, and it is also why U3's comparison of the declared set against the route table can be
honest: both of U3's sides are things U1 wrote down independently.** Verified by control — deleting one
row from the matrix drops the suite by exactly 15 cases and fails **only** the count pin, which is the
single assertion standing between "a domain lost its coverage" and a green run.

**On the property U1 exists for.** The matrix names no controller type, reaches into no DI, and builds
every URL through one private helper. U2's gate is `git diff` over
`Controllers/ResourceImageEndpointTests.cs` returning **empty**; everything U2 must change — the DI block
that collapses from eight registrations to one — is in the harness, which U2 is expected to edit.

---

## 15. U2 as built — the three places it differed from §4, and one correction to §2.7

**Added by Bowser, 2026-10-13**, same append-only convention as §§13–14. Built as §4 specifies: one
`ResourceImagesController` with six actions behind an anchored, case-insensitive four-segment
alternation; the twenty-four per-domain actions, eight duplicated constants, four constructor
parameters and eight `using` directives deleted **in the same commit**; the harness DI block collapsed
from eight registrations to one.

**1. §2.7 overstates the Swagger loss — the legal owner set is still readable from `/swagger`.**
Measured off the running document, not predicted: the `owner` path parameter is emitted as

```json
{"name":"owner","in":"path","required":true,
 "schema":{"pattern":"^(monsters|minions|locations|bystanders)$","type":"string"}}
```

Swashbuckle surfaces an inline `regex` route constraint as a JSON-Schema `pattern`, so *"which owners
have images"* survives the move as a regex rather than vanishing. What is genuinely lost is the **enum
dropdown** in the Swagger UI, which is what the declined `IOperationFilter` would have restored. **The
Q5 decision is unaffected and the stated cost was too high.** The whole document went **78 → 63** path
templates, which is `78 − 20 + 5` and independently confirms §1.1's count of twenty replaced templates.

> **This also corrects my own record elsewhere.** `architecture.md` §22's post-Phase-2 Swagger
> measurement says the custom-move `owner` is *"a plain string with no enum."* Re-measured on the same
> host: it carries `"pattern":"^(mysteries|monsters|minions|locations|bystanders)$"` too. That earlier
> reading was true of the UI and false of the schema. Not amended there, because that document is not
> U2's to edit — flagged for U3's record-keeping pass.

**2. The "a literal silently outranks a constrained parameter" premise is now measured for images, and
the measurement makes §4's gate claim stronger than §4 states.** The premise was inherited from the
custom-move switchover rather than re-observed. Re-observed here, against the real `Program.cs` host,
by giving both `GetImages` implementations a distinguishing `X-Answered-By` response header and
restoring one per-domain action:

| Request | Answered by |
|---|---|
| `GET /api/monsters/{id}/images` | **`MonstersController`** — 200, no `AmbiguousMatchException`, no warning |
| `GET /api/MONSTERS/{id}/images` | **`MonstersController`** — the literal matches case-insensitively too |
| `GET /api/minions/{id}/images` | `ResourceImagesController` |

**The second row is the finding.** §4 offers the mixed-case 200 and the DI collapse as U2's gates; the
mixed-case probe **cannot** discriminate a survivor, because a literal route segment is matched
case-insensitively just as a constrained one is. So the collapsed harness DI is not merely *the*
discriminating gate — it is the **only** one. Confirmed in both directions, which is the part worth
keeping: with the survivor present and its dependencies registered, **all 744 tests pass**, U1's
sixty-case matrix included; with the same survivor and the collapsed DI, exactly **11** fail.

**3. §4's "two assertions that only the new shape can satisfy" needed a file of their own, and that is
not a filing decision.** §4 does not say where they go, and the obvious home is the endpoint suite —
which would destroy the one property U1 exists for, since an assertion that can only pass *after* U2
makes the file no longer byte-identical across the refactor. They are in a separate
`ResourceImagesControllerRoutingTests` (7 cases: three casings, four rejected segments), and
`ResourceImageEndpointTests.cs` has a **`git diff` of exactly zero bytes** across this commit while
green on both sides.

**4. Both one-token details are invisible to U1's matrix, measured rather than assumed.** Removing the
regex anchors fails **3 of 4** new segment cases — `xmonstersx`, `monstersx`, `xmonsters` — and
**`mysteries` still passes**, because it is not a superstring of any alternative and an unanchored
regex rejects it anyway. Swapping `OrdinalIgnoreCase` for `Ordinal` fails **3 of 3** casing cases.
Neither mutation fails a single one of U1's sixty matrix cases, because the matrix only ever requests
the four correct, lower-case segments. That is the argument for these seven assertions existing.

---

## 16. U3, and the close of the plan

**Added by Bowser, 2026-10-13.** The last of the four append-only implementation sections.

### 16.1 What U3 built, and the one thing §4 assigned to it that was already done

`ResourceImageOwnerDriftTests` asserts the owner set written down in **three independent places** —
the route alternation inside `ResourceImagesController`'s `const string OwnerSegment`, that
controller's private `Owners` dictionary, and `IResourceImageService.ImageOwnerTypes`.

**§4 states the claim as one chain; it is asserted as three tests.** A chain that fails as a single
blob says *something* drifted, not *which link*. Each link fails independently and names its own pair:

| Link | Compares | Transcribed side(s) |
|---|---|---|
| 1 | route alternation ↔ dictionary **keys** | **both** — the regex and the dictionary are hand-written separately |
| 2 | dictionary **values** ↔ `ImageOwnerTypes` (+ a pinned count of 4) | **both** — the dictionary and the declared set are hand-written separately |
| 3 | each **key** is the segment of **its own value** | the dictionary; compared against the one derived rule |

The alternation is read **off the `[Http*]` attributes by reflection**, not off the constant, so an
action given its own literal template fails too — and the `^`/`$` are part of the pattern being
matched, so an unanchored regex does not parse and the test fails.

**The fourth link — the enum against the service's three `switch` expressions — is not in this file,
and that is not an omission.** U0 landed it next to `ImageOwnerTypes` itself (§13 item 2) so the
transcribed constant would not sit unguarded for three commits, and it is already asserted **in both
directions**: every member of the set reaches a live arm of all three switches, and every member
outside it reaches the throwing arm of all three. Re-asserting it here would duplicate, not
strengthen. **Both directions are expressible only because U0 merged the enums** — under the old
four-member `ResourceOwnerType` there was no `Mystery` to assert about, so *"and nothing else gets an
arm"* could not be written down at all.

### 16.2 What the controls found, including a bug in the guard itself

Four mutations, each predicted in both directions before it was run. All four matched — **and the
predicted non-failures are the useful half**, because they are what says each assertion earns its place.

| Control | Predicted | Actual |
|---|---|---|
| **F1** dictionary gains `mysteries`, regex does not | links 1 **and 2** fail, **link 3 passes** | exactly that — 2 failures |
| **F2** regex gains `mysteries`, dictionary does not | link 1 fails, **2 and 3 pass**, U2's `mysteries` routing case fails | exactly that — 2 failures |
| **F3** dictionary cross-wired (`monsters` to `Minion`) | **links 1 and 2 pass**, link 3 fails | exactly that — 1 drift failure + 25 behavioural |
| **F4** a domain dropped from **all three** at once | **links 1 and 3 pass**, only the pinned count catches it | exactly that — link 2's count + U0's five arm tests |

**F3 is why link 3 exists.** Set equality is blind to a permutation: swap two dictionary entries and
the key set is unchanged, the value set is unchanged, every segment still resolves to a legal owner
type — while `/api/monsters/…` quietly reads and writes the minion image space.

**F4 is the vacuity control, and it is the third time this plan has needed one** (§13 item 4, §14 item
4). A consistently shrunken world is self-consistent: links 1 and 3 both pass on three domains. Only a
**transcribed count** turns that into a failure.

> **F1 caught a real bug in the guard, which is the whole argument for running controls on a test.**
> `SegmentFor` originally appended `"s"`, giving `Mystery` to `"mysterys"` — wrong; the shipped segment
> is `mysteries`. It never bit, because all four image owners end in a consonant, so the broken rule
> passed every assertion in the file. **A rule that is only correct on the inputs it currently receives
> is a transcription wearing a rule's clothes**, and this one would have fired a *false failure* the
> first time a `-y` domain got images. Fixed to handle `-y` to `-ies` and pinned against all five
> members, including the one the image feature excludes and no other assertion will ever evaluate.

### 16.3 Four things this document gets wrong

Three were corrected in §§13–15 as they were found. **The fourth is new, and it is the most
consequential, because §6 is the section someone reads to decide how to write a guard.**

1. **§5: "368 token edits in 41 distinct files."** The 368 is exact; the file count is **57**. §13 item 1.
2. **§4 U1: "fifteen Monster-only facts."** It is **14**. §14 item 1.
3. **§2.7 / §11 Q5: the Swagger loss.** The legal owner set **is** still readable from `/swagger`, as a
   JSON-Schema `pattern` — Swashbuckle surfaces an inline `regex` route constraint. Only the enum
   *dropdown* is lost. The Q5 decision is unaffected; the stated cost was too high. §15 item 1. *(The
   same correction applies to `architecture.md` §22, which is amended there.)*
4. **§6's test-strategy table marks the two strongest guards as `derived` when their entire value is
   that they are not.** Two rows:
   - *`ResourceImageOwnerDriftTests` — **derived**, from `ImageOwnerTypes`.* **It must not be.** A drift
     test derived from one of the three declarations it compares would be comparing a declaration with
     two reflections of itself, and could not fail. All three sides are transcribed independently, on
     purpose, and that is the only reason F1–F3 above produce failures at all.
   - *`ResourceImageEndpointTests` — **derived** owner set if parameterised over `ImageOwnerTypes`.*
     U1 deliberately did **not** do this. A matrix whose row set comes from the declaration it is
     meant to protect shrinks silently instead of failing — measured at §14 item 4.

   **The generalisation, which is the thing worth keeping:** *derived* is not a synonym for *better*. It
   is better exactly when the derivation's source is **not** the thing the assertion is about. When it
   is, derivation converts a guard into a tautology. §6's own framing — inherited from §29.15 — counts
   derivations as wins without asking that question, and this plan hit the exception three times.

### 16.4 Derivation versus transcription, for the image path, as it now stands

What a reader actually needs: which facts here are held by a mechanism, and which are held by someone
remembering.

**Derived — a machine will notice.**

- **The images segment map's key set, on the client.** `ImageOwnerType = Exclude<DomainOwnerType,
  'Mystery'>` plus `Record<ImageOwnerType, string>` exhaustiveness. Add a sixth domain and the map is a
  **compile error** until someone decides whether it has images. **Newly derived at U0** — before it,
  two hand-written unions with nothing relating them. This is the single biggest gain in the plan.
- **Which URLs the six actions answer.** One `const string` composes all six templates, and the drift
  test reads them back off the attributes, so there is no per-action route literal to get wrong.
- **Every type reference to the owner enum.** The merge made these compiler-proven on both sides: the
  old types stopped existing, so completeness was not a judgement call.
- **That the four domains behave identically over HTTP.** U1's matrix is one body of assertions
  parameterised over the owner, not four copies — a behaviour added for one domain and not the others
  cannot pass.

**Transcribed — a person must maintain it, and here is what watches each one.**

| Transcribed fact | Watched by |
|---|---|
| `IResourceImageService.ImageOwnerTypes` (4 members) | drift link 2 + U0's partition test, both directions |
| the route alternation in `OwnerSegment` | drift link 1, read off the attributes |
| `ResourceImagesController.Owners` (keys **and** pairings) | drift links 1, 2 **and** 3 |
| the matrix's four `{owner, segment}` rows | its own count pin (§14) |
| the harness's seeded owner table | the matrix's count pin |
| **the five enum member names** | `DomainOwnerTypePostgresTests` — the only one here guarding a *data* contract rather than a shape one, and the only one that needed raw SQL to be non-vacuous (§13 item 4) |

**The honest summary of Q3's cost, now that it is built.** Exactly one shape fact became transcribed on
the C# side (`ImageOwnerTypes`) and exactly one became derived on the TypeScript side (`Exclude<>`).
§2.6.7 called that close to a wash and it was right — **but the wash is not symmetric in effort.** The
derived side cost one line and protects itself forever. The transcribed side cost one line, one
partition test, three drift assertions and a count pin, and it will cost a paragraph of thought every
time someone touches it. **A transcription with a guard is not equivalent to a derivation; it is a
derivation plus a maintenance obligation, and the obligation is the part that does not show up in a
diff.**

### 16.5 What is deliberately still open

- **U-F3a stands.** When mystery images is built, the three `ArgumentOutOfRangeException` arms,
  `ImageOwnerTypes` and the route alternation must move **together**. Drift link 2 and U0's partition
  test fail whether the arms are added without the set or the set without the arms, which is what makes
  this a forced conversation rather than a remembered one.
- **U-F1, U-F2, U-F5** are unchanged and untriggered.
- **The `ToActionResult`/`ToErrorResult` duplication is now five copies**, counting the new controller.
  That is U-F1 and it was declined on purpose in a phase whose point was subtraction.
