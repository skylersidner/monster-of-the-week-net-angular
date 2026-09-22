### 2026-08-18: `withInterceptors` array order is REQUEST order — the last entry is the first to see an error

**By:** Luigi (Frontend Developer)
**Raised by:** frontend review of `docs/simple-authentication-update/` Phase 2. Corrects the same error in `docs/authentication-update/architecture.md:961` before either plan is implemented.

**What:** Any interceptor that intends to **swallow** an error must be registered **last** in the `withInterceptors([...])` array, not first. Both authentication designs specified `withInterceptors([credentialsInterceptor, authErrorInterceptor, httpErrorInterceptor])` with the claim that `authErrorInterceptor` "swallows the `401` so no toast fires." That is backwards; the toast fires.

---

#### The mechanism

Angular builds the chain with `reduceRight` over the array:

```ts
this.chain = interceptors.reduceRight(
  (next, interceptorFn) => chainedInterceptorFn(next, interceptorFn, this.injector),
  downstreamRequestFn,
);
```

`withInterceptors([A, B, C])` therefore produces `A(next: B(next: C(next: backend)))`.

- **Requests** travel `A → B → C → backend`. The array reads in request order, which is the intuitive reading and the reason this is easy to get wrong.
- **Responses and errors** travel back `C → B → A`. **The last entry in the array is the innermost interceptor and the first to see an error response.**

So with `[credentials, authError, httpError]`, `httpErrorInterceptor`'s `catchError` runs first and enqueues `Request failed (401) for GET /api/mysteries`; `authErrorInterceptor` then swallows an error nobody is waiting for. The swallow is real but useless — the side effect it was meant to prevent has already happened.

**Correct order:** `[credentialsInterceptor, httpErrorInterceptor, authErrorInterceptor]`. `authErrorInterceptor` is innermost, returns `EMPTY` for the `401`, the stream completes without erroring, and `httpErrorInterceptor`'s `catchError` never runs. `credentialsInterceptor` only mutates the outgoing request, so its position is unaffected and it stays first.

#### The rule, phrased for a code comment

> **Last in the array = first to see an error.** An interceptor that swallows or transforms an error response must sit *after* every interceptor whose behaviour it means to suppress.

Phrasing it as "ordered before `httpErrorInterceptor`" — which is what both design docs said — reads as the opposite of what is required, and is how it got written backwards twice.

#### Why it would have survived a dev loop

In this codebase the notification toast host lives inside `page-layout.html`, and the `401` path tears that component down as it navigates to `/login`. The toast is queued into a signal that no longer has a host, and `NotificationService` auto-dismisses it after 4 s. **The bug is invisible until the toast host is hoisted to `App`** — which the same review recommends for an unrelated reason. Fixing the hoist without fixing the order turns a masked bug into a stack of `Request failed (401)` toasts on the login page.

#### Test that pins it

An interceptor spec asserting that a `401` response produces **zero** `NotificationService` entries. This is the only automated check that catches the order regressing; nothing about the wrong order fails to compile, and nothing logs.

#### Generalisation

Applies to any future swallow-or-transform interceptor, not just auth: retry-with-backoff, offline queueing, error-shape normalisation. All of them belong at the **end** of the array, below the generic reporter.
