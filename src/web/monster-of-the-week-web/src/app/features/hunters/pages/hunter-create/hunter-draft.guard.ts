import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth';

/** A page that may ask before it is left. */
export interface DiscardGuardedPage {
  canLeave(): boolean | Observable<boolean>;
}

/**
 * The discard guard on `/hunters/new` (hunter-creation-wizard.md 7.5, 13.8, L11, L12; Phase 7, F7), the
 * app's first `canDeactivate` guard.
 *
 * Signed out, it always lets the navigation through, without asking. That covers both a session that
 * expired (the auth interceptor clears the user, then navigates to /login) and a deliberate Sign out
 * (`endSession` clears the user before navigating): cancelling either would strand the player on a
 * page whose every request now fails, and the draft couldn't be saved anyway. The accepted cost is
 * that Sign out discards a dirty draft without asking (L11).
 *
 * Signed in, the page decides: it lets a clean draft and a created hunter go, and asks otherwise.
 */
export const hunterDraftGuard: CanDeactivateFn<DiscardGuardedPage> = (page) =>
  inject(AuthService).isAuthenticated() ? page.canLeave() : true;
