import { Injectable } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { CustomMoveOwnerType, CustomMoveResponse, UpsertCustomMoveRequest } from './models';

/**
 * Owner type → the unified controller's route segment
 * (`docs/domain-custom-moves/architecture.md` §2.9, §27). The server's five legal segments are one
 * anchored regex in `CustomMovesController.OwnerSegment`; this is the client's copy of that set.
 *
 * **Not exported, and `customMovesPath` is the only builder.** §2.5's guarantee that a
 * correct-but-unintended owner pair cannot be constructed by accident rests on there being exactly
 * one place a custom-move URL is assembled. Exporting this map invites a second one.
 *
 * **`Record<CustomMoveOwnerType, string>` is exhaustive**, so a sixth owner type added to the union
 * without a segment here is a compile error rather than a runtime 404.
 *
 * **What happens if a segment is wrong**, since the guard is not this comment: the route constraint
 * rejects the path before any application code runs, and `Program.cs`'s `/api/{**rest}` catch-all
 * answers a bare 404 — **no body and no `Content-Type`**, which is distinguishable from a real
 * `NotFound()` (162 bytes of `application/problem+json`). So a typo here is diagnosable from the
 * network tab, though not from the UI. `custom-moves.spec.ts` derives four of these five segments
 * from `resourceImagesPath`'s shipped map rather than re-typing them, which is the guard that
 * actually runs; §27.3 and §34's live probe are the other half.
 */
const OWNER_SEGMENT: Readonly<Record<CustomMoveOwnerType, string>> = {
  Mystery: 'mysteries',
  Monster: 'monsters',
  Minion: 'minions',
  Location: 'locations',
  Bystander: 'bystanders',
};

/** `/api/{segment}/{ownerId}/custom-moves` — rooted, no base URL. `ApiService` adds that. */
export function customMovesPath(ownerType: CustomMoveOwnerType, ownerId: string): string {
  return `/api/${OWNER_SEGMENT[ownerType]}/${ownerId}/custom-moves`;
}

/**
 * **Set on all four methods, and the token is not dead config.**
 *
 * Without it `httpErrorInterceptor` (`:26-29`) raises a raw
 * `"Request failed (500) for POST /api/monsters/{guid}/custom-moves"` toast beside whatever the
 * caller shows — the card's own message on a detail page, or the deliberately vague
 * *"some details may not have saved"* caveat on a create page. Two toasts per failure, one of them
 * useless, and the vague one undermined by the precise one.
 *
 * **This is measured, not predicted.** Phase A's browser checks showed exactly that pairing on the
 * four *existing* sub-resource types, which do not set this token: every failed write produced
 * `"Request failed (500) for PUT /api/monsters/{guid}"` alongside the page's own message. That is
 * 14-R3 / F-R2, deliberately not swept — and the reason custom moves must not join it.
 *
 * Suppresses only that toast. A 401 still reaches `authErrorInterceptor`; see
 * `http-context-tokens.ts` for why this is narrower than `isSelfHandledRequest`.
 */
function inlineErrorContext(): HttpContext {
  return new HttpContext().set(SUPPRESS_ERROR_TOAST, true);
}

/**
 * The custom-move endpoints for all five owner types — one client service, because one controller
 * serves them all and only the route segment differs (architecture.md §2.9, §27).
 *
 * **Argument order is `(ownerType, ownerId, …)` on every method, matching `ResourceImageService`
 * exactly.** That consistency is the only protection there is: `(ownerType, ownerId, moveId)` is
 * three `string`s with nothing at the type level to stop two of them being transposed, so the fact
 * that both cross-domain services read the same way is doing real work.
 *
 * **Status codes are the server's shipped ones, not the conventional ones** — `POST` answers
 * `200`, not `201`, and `DELETE` answers `204` then `404` on a repeat. Verified against the running
 * API, and documented at `CustomMovesController` with the reason (all sixteen actions it replaced
 * did the same). Nothing here depends on the distinction, but a caller writing a retry does.
 */
@Injectable({
  providedIn: 'root',
})
export class CustomMoveService {
  constructor(private readonly apiService: ApiService) {}

  /**
   * **Ships unexercised, on purpose, and that is recorded as a decision rather than left to look
   * like an oversight** (architecture.md L-D3, §27.2).
   *
   * No detail page calls this: `customMoves` is embedded in all five detail responses, so the first
   * paint is server truth and a load costs no second request (decision 2). Its caller arrives in
   * **5f-3**, where the wizard's location/bystander attach needs exactly the one field
   * `LocationListItemResponse` lacks — which is why `list()` and not `getById()`: it leaves
   * `attachLocation`'s draft-construction expression untouched and keeps the characterised staleness
   * of `mystery-create-phase4-ledger.spec.ts`'s S2 characterised.
   *
   * Skyler, on shipping it now: *"this is not expected to function fully until 5f-3. Tests obviously
   * won't be useful until then, either. We just need a note to be sure to validate the functionality
   * in 5f-3 and ensure tests have the correct coverage."* So its Phase 4 coverage is the URL/verb/
   * token row in the 4 × 5 table and nothing behavioural — a spec asserting it issues a `GET` and
   * returns the body would be covering `ApiService`, not a feature. **§30.5's 5f-3 gate is what
   * closes this**, and it does not close until a real caller exercises it with a non-empty fixture.
   */
  list(ownerType: CustomMoveOwnerType, ownerId: string): Observable<CustomMoveResponse[]> {
    return this.apiService.get<CustomMoveResponse[]>(customMovesPath(ownerType, ownerId), inlineErrorContext());
  }

  create(
    ownerType: CustomMoveOwnerType,
    ownerId: string,
    request: UpsertCustomMoveRequest
  ): Observable<CustomMoveResponse> {
    return this.apiService.post<UpsertCustomMoveRequest, CustomMoveResponse>(
      customMovesPath(ownerType, ownerId),
      request,
      inlineErrorContext()
    );
  }

  update(
    ownerType: CustomMoveOwnerType,
    ownerId: string,
    moveId: string,
    request: UpsertCustomMoveRequest
  ): Observable<CustomMoveResponse> {
    return this.apiService.put<UpsertCustomMoveRequest, CustomMoveResponse>(
      `${customMovesPath(ownerType, ownerId)}/${moveId}`,
      request,
      inlineErrorContext()
    );
  }

  delete(ownerType: CustomMoveOwnerType, ownerId: string, moveId: string): Observable<void> {
    return this.apiService.delete(`${customMovesPath(ownerType, ownerId)}/${moveId}`, inlineErrorContext());
  }
}

/**
 * Client identity for a *staged* custom move — a row the user has typed on a create page but which
 * has no server id yet. The card tracks rows by this (14-R4: `track $index` would let a
 * focus-restore land on the wrong row with no error).
 *
 * **Deliberately not the wizard's `createDraftKey`** (`mystery-create.store.ts`), and not a
 * promotion of it to `shared/` (architecture.md §30.1). That one sits behind a module-level counter
 * inside a 3,187-line store; sharing a mutable counter between two features that never co-mount
 * buys nothing and couples their key sequences, which appear in wizard roster failure output. The
 * wizard keeps its own and goes on using `createDraftKey('move')`. §32 F-L3 carries the question of
 * one shared primitive, with F2.
 */
let nextDraftKey = 0;
export function createCustomMoveDraftKey(): string {
  return `move-${++nextDraftKey}`;
}
