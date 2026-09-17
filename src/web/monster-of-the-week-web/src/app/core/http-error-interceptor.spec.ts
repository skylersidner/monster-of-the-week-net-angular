import { TestBed } from '@angular/core/testing';
import { HttpContext, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { throwError } from 'rxjs';

import { httpErrorInterceptor } from './http-error-interceptor';
import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { NotificationService } from './notifications';

describe('httpErrorInterceptor', () => {
  const notificationService = {
    error: vi.fn(),
  };

  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => httpErrorInterceptor(req, next));

  beforeEach(() => {
    notificationService.error.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: NotificationService, useValue: notificationService }],
    });
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });

  it('sends a toast for non-health HTTP errors', () => {
    const req = new HttpRequest('GET', 'http://localhost:5225/api/mysteries');
    interceptor(req, () => throwError(() => new HttpErrorResponse({ status: 500, url: req.url }))).subscribe({
      error: () => {},
    });

    expect(notificationService.error).toHaveBeenCalledTimes(1);
  });

  it('does not send a toast for health endpoint errors', () => {
    const req = new HttpRequest('GET', 'http://localhost:5225/health/live');
    interceptor(req, () => throwError(() => new HttpErrorResponse({ status: 503, url: req.url }))).subscribe({
      error: () => {},
    });

    expect(notificationService.error).not.toHaveBeenCalled();
  });

  // 13.11 item 4 / L9: a request whose caller already renders the server's own message opts out
  // of the generic toast via this context token, without going through isSelfHandledRequest
  // (which would also turn off the 401 bounce — see auth-error-interceptor.spec.ts for proof
  // that the bounce survives this token being set).
  it('does not send a toast when SUPPRESS_ERROR_TOAST is set on the request context', () => {
    const req = new HttpRequest('POST', 'http://localhost:5225/api/hunters', null, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, true),
    });
    interceptor(req, () => throwError(() => new HttpErrorResponse({ status: 400, url: req.url }))).subscribe({
      error: () => {},
    });

    expect(notificationService.error).not.toHaveBeenCalled();
  });

  it('still sends a toast when the context token is present but false', () => {
    const req = new HttpRequest('POST', 'http://localhost:5225/api/hunters', null, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, false),
    });
    interceptor(req, () => throwError(() => new HttpErrorResponse({ status: 400, url: req.url }))).subscribe({
      error: () => {},
    });

    expect(notificationService.error).toHaveBeenCalledTimes(1);
  });

  // B4's overlong-name 400 is ASP.NET's default ProblemDetails, with no `message` field. With
  // SUPPRESS_ERROR_TOAST set, this interceptor stays silent — the caller's own handler
  // (`createErrorMessage` in hunter-create.store.ts, `error?.error?.message ?? 'Unable to save
  // hunter.'` in hunter-detail.ts) is what falls back to fixed copy, so exactly one message shows.
  it('does not send a toast for a message-less ProblemDetails 400 when the token is set', () => {
    const problemDetails = {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { Name: ["The field Name must be a string or array type with a maximum length of '255'."] },
      traceId: 'abc',
    };
    const req = new HttpRequest('POST', 'http://localhost:5225/api/hunters', null, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, true),
    });
    interceptor(req, () =>
      throwError(() => new HttpErrorResponse({ status: 400, url: req.url, error: problemDetails }))
    ).subscribe({
      error: (err: HttpErrorResponse) => {
        // The page's own fallback: no `message` on this body, so `?? 'Unable to create hunter.'`
        // is what the user sees — confirmed here so the "exactly one message" chain is explicit.
        expect((err.error as { message?: string }).message).toBeUndefined();
      },
    });

    expect(notificationService.error).not.toHaveBeenCalled();
  });
});
