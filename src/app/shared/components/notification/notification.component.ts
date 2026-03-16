import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
    <div class="notification-container">
      <div
        *ngFor="let notification of notifications"
        [class]="'notification notification-' + notification.type"
        (click)="remove(notification.id)"
      >
        <div class="notification-icon">
          <mat-icon *ngIf="notification.type === 'success'">check_circle</mat-icon>
          <mat-icon *ngIf="notification.type === 'error'">error</mat-icon>
          <mat-icon *ngIf="notification.type === 'warning'">warning</mat-icon>
          <mat-icon *ngIf="notification.type === 'info'">info</mat-icon>
        </div>
        <div class="notification-content">
          <div class="notification-title" *ngIf="notification.title">{{ notification.title }}</div>
          <div class="notification-message">{{ notification.message }}</div>
        </div>
        <button mat-icon-button class="notification-close" (click)="remove(notification.id); $event.stopPropagation()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .notification-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 400px;
    }

    .notification {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      animation: slideIn 0.3s ease-out;
      min-width: 300px;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .notification-success {
      background: #d1fae5;
      border-left: 4px solid #10b981;
      color: #065f46;
    }

    .notification-error {
      background: #fee2e2;
      border-left: 4px solid #ef4444;
      color: #991b1b;
    }

    .notification-warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      color: #92400e;
    }

    .notification-info {
      background: #dbeafe;
      border-left: 4px solid #3b82f6;
      color: #1e40af;
    }

    .notification-icon {
      flex-shrink: 0;
    }

    .notification-content {
      flex: 1;
    }

    .notification-title {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .notification-message {
      font-size: 0.875rem;
    }

    .notification-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .notification-close:hover {
      opacity: 1;
    }
  `]
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: any[] = [];
  private subscription?: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.updateNotifications();
    // Subscribe to changes
    setInterval(() => this.updateNotifications(), 100);
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  updateNotifications(): void {
    this.notifications = this.notificationService.getNotifications();
  }

  remove(id: number): void {
    this.notificationService.remove(id);
    this.updateNotifications();
  }
}


