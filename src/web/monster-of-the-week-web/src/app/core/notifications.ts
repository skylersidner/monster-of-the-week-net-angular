import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'success' | 'error';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private nextId = 1;
  private readonly durationMs = 4000;
  readonly notifications = signal<AppNotification[]>([]);

  success(message: string): void {
    this.enqueue('success', message);
  }

  error(message: string): void {
    this.enqueue('error', message);
  }

  dismiss(id: number): void {
    this.notifications.update((items) => items.filter((item) => item.id !== id));
  }

  private enqueue(kind: NotificationKind, message: string): void {
    const id = this.nextId++;
    this.notifications.update((items) => [...items, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), this.durationMs);
  }
}
