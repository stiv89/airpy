export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  message: string;
  tone: NotificationTone;
  durationMs: number;
}
