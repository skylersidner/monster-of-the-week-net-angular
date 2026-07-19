import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, vi } from 'vitest';
import { NotificationService } from './notifications';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('adds and auto-dismisses notifications', () => {
    service.success('Saved');
    expect(service.notifications().length).toBe(1);
    expect(service.notifications()[0].kind).toBe('success');

    vi.advanceTimersByTime(4000);
    expect(service.notifications().length).toBe(0);
  });
});
