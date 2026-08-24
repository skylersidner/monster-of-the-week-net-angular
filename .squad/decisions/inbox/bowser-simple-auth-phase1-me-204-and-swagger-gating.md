### 2026-08-23: Phase 1 implemented — two corrections: `Ok(null)` silently returns `204`, and the Swagger "watch for" understates what the fallback policy gates

**By:** Bowser (Backend Developer / DevOps)
**Requested by:** Skyler Sidner — implement Phase 1 of `docs/simple-authentication-update/phases.md`.

**What:**

1. **Phase 1 shipped as specified.** `Contracts/AuthContracts.cs`, `Services/IAuthService.cs` +
   `AuthService.cs`, `Controllers/AuthController.cs` (`login` / `logout` / `me`), the full `AddCookie`
   options block, `SetFallbackPolicy(RequireAuthenticatedUser)`, `UseAuthentication`/`UseAuthorization`,
   `.AllowAnonymous()` on the health check, a rewritten `.http` file, and `AuthServiceTests` with a
   `FakeUserRepository`. **Zero controller edits** — all 107 existing actions are now gated by the
   fallback policy alone, exactly as decision #8 intended. The `Events` overrides are written as
   mutation, not assignment.

2. **`return Ok(user)` where `user` is `null` produces `204 No Content`, not `200` with a JSON `null`.**
   `architecture.md` §3.2 explicitly pins the signed-out `GET /api/auth/me` response as *"`200` with a
   literal JSON `null`, not `204`"*, and the obvious implementation silently violates it:
   `ControllerBase.Ok(null)` yields an `ObjectResult` with a null value, which
   **`HttpNoContentOutputFormatter` converts to `204`**. Caught by live verification, not by the
   compiler or the tests.

   **Fixed locally with `return new JsonResult(user);`**, which bypasses that formatter. Deliberately
   *not* fixed by removing `HttpNoContentOutputFormatter` globally in `AddControllers`, which would
   change the response of every other action in the API that can return null — unacceptable in a phase
   whose remit is "no existing behaviour changes."

   **Why it matters even though Angular cannot tell the difference.** `HttpClient` yields `null` for
   both `200 null` and `204`, so Phase 2 would have worked either way and the divergence would have sat
   there undetected. It matters because §3.2 makes this the pinned contract, and because the `.http`
   file is where the contract gets locked in for anyone reading it later.

3. **The Phase 1 "Watch for" note about Swagger is wrong about the symptom, in the same direction as
   the `/health/live` row §2.2 already had to correct.** It reads: *"Swashbuckle's `UseSwagger` is
   middleware and unaffected, but 'Try it out' against a gated endpoint from the Swagger UI will need a
   session cookie in the browser."* **Verified false: the Swagger UI itself returns `401` — both
   `/swagger/index.html` and `/swagger/v1/swagger.json` — for an anonymous caller.** It is not that
   Try-it-out is limited; the UI does not load at all. With a session cookie both return `200`.

   **Mechanism, and it generalises.** `AuthorizationMiddleware` reads
   `endpoint?.Metadata.GetOrderedMetadata<IAuthorizeData>()` and calls `AuthorizationPolicy.CombineAsync`;
   with empty metadata that returns **the fallback policy**. Crucially this happens **when there is no
   endpoint at all**, not merely when an endpoint carries no attributes — so the fallback policy gates
   *every* request that reaches `UseAuthorization`, including ones destined for downstream middleware.
   Swagger is registered *after* `UseAuthentication`/`UseAuthorization` (which is exactly where Phase 1
   step 6 says to put them, "between `UseHttpsRedirection()` and `MapControllers()`"), so it is never
   reached. This is the same property §2.3 relies on in the opposite direction for static files, which
   is why `UseStaticFiles` must sit *above* `UseAuthorization` in Phase 3.

   **Left as-is, not worked around**, per the note's own instruction and because §2.2 already confirmed
   the design wants *"exactly four `[AllowAnonymous]`, with no hidden fifth for Swagger."* It is
   Development-only, it self-resolves once Phase 2 gives the browser a way to obtain a cookie, and the
   rewritten `.http` file is the intended verification tool in the meantime. **Only the stated symptom
   needs correcting** — an implementer told "the UI loads, Try-it-out needs a cookie" will file a bug
   when the UI 401s.

   If browsable Swagger in Development is ever wanted, the one-line change is to move the
   `if (IsDevelopment()) { UseSwagger(); UseSwaggerUI(); }` block **above** `app.UseAuthentication()`.
   That is a design call, not an implementation one, so it has not been made here.

**Why:** Both are the recurring shape of this initiative — a mechanism that does not do what the
document says, where the failure is quiet. (2) would have shipped a contract divergence that no test and
no frontend behaviour would ever surface. (3) would have had someone chasing a Swagger "regression" that
is actually correct, intended behaviour.

**Also worth recording:** the Data Protection assertion moved into this phase from Phase 0 **passes, and
proves what it was moved here to prove.** A cookie issued *before* an API restart still authenticated
*after* it, and `data_protection_keys` stayed at exactly **one** row across the restart — so the ticket
protector is demonstrably the DB-backed one and not a fresh in-memory key ring.

**Test credential row: left in place.** `test@local.dev` / `phase1-test-password`, inserted by hand over
`psql` per decision #3, on the local Docker Postgres only. Kept because Phase 2 needs a credential to
exercise the login form and re-deriving the `INSERT` is pure friction; the `.http` file documents the
statement. It must never be reused anywhere, and decision #18 already establishes that local data does
not reach production.
