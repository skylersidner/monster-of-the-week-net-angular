import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { throwError } from 'rxjs';

import { httpErrorInterceptor } from './http-error-interceptor';
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
});
