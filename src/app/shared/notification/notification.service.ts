import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationMessage {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private _messages = signal<NotificationMessage[]>([]);
  messages = this._messages.asReadonly();

  show(type: NotificationType, message: string, title = '', duration = 4000) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notification: NotificationMessage = { id, type, title, message };
    this._messages.update(current => [...current, notification]);

    window.setTimeout(() => this.dismiss(id), duration);
  }

  dismiss(id: string) {
    this._messages.update(current => current.filter(notification => notification.id !== id));
  }

  clear() {
    this._messages.set([]);
  }
}
