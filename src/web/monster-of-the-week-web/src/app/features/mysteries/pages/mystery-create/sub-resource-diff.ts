import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { WeaponTagRefResponse } from '../../../../core/models';
import type { SubResourceIdentity } from './mystery-create.store';

/**
 * The sub-resource upsert diff (decisions 8 and 9), written once and used four times per owner,
 * for two owners.
 *
 * **Why this is a parameterised function and not inline store code.** 5a needs it twice — once
 * against `MonsterService`, once against `MinionService`, with different request and response
 * types — so the generic pays for itself inside 5a without appealing to 5b. And the state it reads
 * moves in 5b: the monster's four draft arrays and four baselines relocate onto `MonsterDraft`.
 * Inlined against `store.monsterAttacks()` and siblings, all of this would be rewritten in the
 * riskiest phase; as a function over drafts and a baseline, 5b changes only who supplies them.
 *
 * **What it replaces.** Delete every baseline id, then create every draft from scratch. That
 * preserved content and rotated every key on every phase transition, and it is why §5.2's worked
 * example exists. It also made the dirty check impossible: nothing could ever match.
 */

/** The three calls a collection needs. Keyed by owner id so one adapter serves monster and minion. */
export interface SubResourceService<TDraft, TRequest, TResponse> {
  create(ownerId: string, request: TRequest): Observable<TResponse>;
  update(ownerId: string, id: string, request: TRequest): Observable<TResponse>;
  delete(ownerId: string, id: string): Observable<void>;
  /** Draft → request body. */
  toRequest(draft: TDraft): TRequest;
  /**
   * Has this row changed since the baseline? **Derived, per row, never a stored flag** (§5.4).
   *
   * A stored `edited` flag desyncs the moment a user edits a field and changes it back, and it
   * makes "a cancelled composer edit must not count as an edit" a rule someone has to remember.
   * Comparing against the baseline makes both cases clean by construction.
   */
  isDirty(draft: TDraft, baseline: TResponse): boolean;
  /**
   * Optional per-row follow-up — weapon tags on an attack. Runs for created and updated rows alike.
   *
   * **It returns the row, not `void`, and that is load-bearing.** Whatever this emits becomes the
   * new baseline for the row. `POST /attacks` answers before its tags are assigned, so a follow-up
   * that returned nothing would leave a tagged attack's baseline holding `weaponTags: []` — and
   * `isDirty` would then report that attack as changed on *every* subsequent submit, re-PUTting it
   * and re-assigning the same tag for ever. The follow-up knows what the server now holds; it says
   * so.
   */
  afterSave?(ownerId: string, saved: TResponse, draft: TDraft, baseline: TResponse | null): Observable<TResponse>;
}

/**
 * Applies one collection's diff and returns **the new baseline**: the server's view of every row
 * that survives, in draft order.
 *
 * Three buckets, and the rule for each is the one §5.1 states for the entity row, one level down:
 *
 * - draft with no `id` → create
 * - draft with an `id`, values differ from its baseline row → update
 * - draft with an `id`, values identical → **no request at all**, and the baseline row is carried
 *   forward unchanged so its key is stable
 * - baseline row that no draft claims → delete
 *
 * The unchanged branch is decision 9's entire point, and the carried-forward row is what makes
 * `5a-U1` (ids survive a phase transition) true.
 */
export function applySubResourceDiff<TDraft extends SubResourceIdentity, TRequest, TResponse extends { id: string }>(
  ownerId: string,
  drafts: readonly TDraft[],
  baseline: readonly TResponse[],
  service: SubResourceService<TDraft, TRequest, TResponse>,
): Observable<TResponse[]> {
  const baselineById = new Map(baseline.map((row) => [row.id, row]));
  const claimed = new Set(drafts.map((draft) => draft.id).filter((id): id is string => id !== null));

  const deletes = baseline
    .filter((row) => !claimed.has(row.id))
    .map((row) => service.delete(ownerId, row.id));

  const saves = drafts.map((draft) => {
    const existing = draft.id === null ? null : (baselineById.get(draft.id) ?? null);

    // An id with no baseline row is not an update we can trust — treat it as a create rather than
    // PUT at a row we have never seen. Reachable only if some path sets an id without recording the
    // baseline, which is exactly the class of bug the shared hydrator exists to make impossible.
    if (existing === null) {
      return service
        .create(ownerId, service.toRequest(draft))
        .pipe(switchMap((saved) => runAfterSave(ownerId, saved, draft, null, service)));
    }

    if (!service.isDirty(draft, existing)) {
      // No request. The baseline row is returned as-is, so its id is carried forward untouched.
      return runAfterSave(ownerId, existing, draft, existing, service);
    }

    return service
      .update(ownerId, existing.id, service.toRequest(draft))
      .pipe(switchMap((saved) => runAfterSave(ownerId, saved, draft, existing, service)));
  });

  return forkJoin({
    deleted: batch(deletes),
    saved: batch(saves),
  }).pipe(map(({ saved }) => saved));
}

function runAfterSave<TDraft, TRequest, TResponse>(
  ownerId: string,
  saved: TResponse,
  draft: TDraft,
  baseline: TResponse | null,
  service: SubResourceService<TDraft, TRequest, TResponse>,
): Observable<TResponse> {
  return service.afterSave?.(ownerId, saved, draft, baseline) ?? of(saved);
}

function batch<T>(requests: Observable<T>[]): Observable<T[]> {
  return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
}

/**
 * The weapon-tag assign/remove diff (`5a-U8`).
 *
 * Today's path is assign-only, so a tag removed in the composer stayed on the server for ever.
 * Bowser confirmed `UpdateAttackAsync` does not clear tags, so this runs against a stable set —
 * which is what lets it be a diff rather than a clear-and-reassign.
 *
 * `baseline` is null for a newly created attack: everything selected is an assign, nothing to
 * remove. For an updated or unchanged one it is the response's own `weaponTags`.
 */
export function weaponTagOperations(
  selectedIds: readonly string[],
  baseline: readonly WeaponTagRefResponse[] | null,
  assign: (weaponTagId: string) => Observable<unknown>,
  remove: (weaponTagId: string) => Observable<unknown>,
): Observable<unknown>[] {
  const selected = new Set(selectedIds.filter((id) => id.length > 0));
  const current = new Set((baseline ?? []).map((tag) => tag.id));

  return [
    ...[...selected].filter((id) => !current.has(id)).map(assign),
    ...[...current].filter((id) => !selected.has(id)).map(remove),
  ];
}

/**
 * Value equality for the three simple sub-resource kinds, and for an attack's own fields.
 *
 * Both sides are normalised to null: a draft holds '' for "no value", and a response may hold null
 * or — `MonsterArmorResponse.specialDescription` is optional — omit the field entirely. Comparing
 * those raw would mark an untouched armor dirty on every submit.
 */
export function sameNullableText(draftValue: string, responseValue: string | null | undefined): boolean {
  const normalised = draftValue.trim();
  return (normalised.length > 0 ? normalised : null) === (responseValue ?? null);
}

/** Tag-set equality, order-insensitive — the diff's `isDirty` half for an attack's weapon tags. */
export function sameWeaponTags(selectedIds: readonly string[], baseline: readonly WeaponTagRefResponse[]): boolean {
  const selected = new Set(selectedIds.filter((id) => id.length > 0));
  const current = new Set(baseline.map((tag) => tag.id));
  return selected.size === current.size && [...selected].every((id) => current.has(id));
}
