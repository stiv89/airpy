import { Injectable, signal } from '@angular/core';
import { AppNotification, NotificationTone } from '../models/app-notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private counter = 0;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly notifications = signal<AppNotification[]>([]);

  show(message: string, tone: NotificationTone = 'info', durationMs = 4200): void {
    const id = `n-${++this.counter}`;
    const notification: AppNotification = { id, message, tone, durationMs };

    this.notifications.update((current) => [...current, notification]);

    if (durationMs > 0) {
      const timer = setTimeout(() => this.dismiss(id), durationMs);
      this.timers.set(id, timer);
    }
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.notifications.update((current) => current.filter((n) => n.id !== id));
  }

  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.notifications.set([]);
  }
}
