import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from './notifications';
import { isSelfHandledRequest } from './self-handled-request';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);
  // Shared with authErrorInterceptor rather than a second copy of the list here — see
  // core/self-handled-request.ts. This replaces the inline '/health/live' check this interceptor
  // used to carry, and adds the /api/auth/ exemption: without it the login page would render its
  // own inline "wrong email or password" message *and* a generic
  // "Request failed (400) for POST /api/auth/login" toast underneath it.
  const isSelfHandled = isSelfHandledRequest(req);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        console.error(`HTTP ${error.status} ${req.method} ${req.urlWithParams}`);
        if (!isSelfHandled) {
          const message = error.status > 0
            ? `Request failed (${error.status}) for ${req.method} ${req.urlWithParams}`
            : `Request failed for ${req.method} ${req.urlWithParams}`;
          notificationService.error(message);
        }
      } else {
        console.error(`Unexpected HTTP pipeline error for ${req.method} ${req.urlWithParams}`);
        if (!isSelfHandled) {
          notificationService.error(`Unexpected request failure for ${req.method} ${req.urlWithParams}`);
        }
      }

      return throwError(() => error);
    })
  );
};
