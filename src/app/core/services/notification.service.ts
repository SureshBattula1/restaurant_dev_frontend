import { Injectable } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  title?: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications: Notification[] = [];
  private idCounter = 0;

  show(type: NotificationType, message: string, title?: string, duration: number = 3000): void {
    const notification: Notification = {
      id: this.idCounter++,
      type,
      message,
      title,
      duration
    };

    this.notifications.push(notification);

    if (duration > 0) {
      setTimeout(() => {
        this.remove(notification.id);
      }, duration);
    }
  }

  success(message: string, title?: string): void {
    this.show('success', message, title);
  }

  error(message: string, title?: string): void {
    this.show('error', message, title, 5000);
  }

  warning(message: string, title?: string): void {
    this.show('warning', message, title);
  }

  info(message: string, title?: string): void {
    this.show('info', message, title);
  }

  getNotifications(): Notification[] {
    return this.notifications;
  }

  remove(id: number): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  clear(): void {
    this.notifications = [];
  }
}




