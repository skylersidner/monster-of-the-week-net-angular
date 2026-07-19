import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from './notifications';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);
  const isHealthCheckRequest = req.urlWithParams.includes('/health/live');

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        console.error(`HTTP ${error.status} ${req.method} ${req.urlWithParams}`);
        if (!isHealthCheckRequest) {
          const message = error.status > 0
            ? `Request failed (${error.status}) for ${req.method} ${req.urlWithParams}`
            : `Request failed for ${req.method} ${req.urlWithParams}`;
          notificationService.error(message);
        }
      } else {
        console.error(`Unexpected HTTP pipeline error for ${req.method} ${req.urlWithParams}`);
        if (!isHealthCheckRequest) {
          notificationService.error(`Unexpected request failure for ${req.method} ${req.urlWithParams}`);
        }
      }

      return throwError(() => error);
    })
  );
};
