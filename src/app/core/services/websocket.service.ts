import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import Pusher from 'pusher-js';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { RealtimeService } from './realtime.service';
import { AdminService } from './admin.service';

/**
 * WebSocket service for realtime salary, transaction, and financial updates.
 * Subscribes to location.{locationId} channels and forwards events to RealtimeService.
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private pusher: Pusher | null = null;
  private subscribedChannels = new Set<string>();
  private isInitializing = false;
  private initialized = false;

  constructor(
    private authService: AuthService,
    private realtimeService: RealtimeService,
    private adminService: AdminService
  ) {}

  /**
   * Subscribe to salary and transaction channels for the current user's locations.
   * Called lazily when salary, transactions, or financial dashboards load.
   */
  subscribeToSalaryAndTransactionChannels(): void {
    if (this.initialized || this.isInitializing) {
      return;
    }
    if (!this.authService.getToken()) {
      return;
    }
    this.isInitializing = true;

    const user = this.authService.getCurrentUser();
    if (user) {
      this.initializeAndSubscribe(user);
      this.isInitializing = false;
      return;
    }

    this.authService.currentUser$.pipe(
      filter(u => u !== null),
      take(1)
    ).subscribe(u => {
      this.initializeAndSubscribe(u);
      this.isInitializing = false;
    });
  }

  private initializeAndSubscribe(user: any): void {
    const isSuperAdmin = this.authService.isSuperAdmin();

    if (isSuperAdmin) {
      this.adminService.getLocations().subscribe({
        next: (locations) => {
          const ids = locations.map((l: any) => l.id);
          this.subscribeToLocationChannels(ids);
        },
        error: () => {
          this.initialized = true;
        }
      });
    } else if (user?.location_id) {
      this.subscribeToLocationChannels([user.location_id]);
    } else {
      this.initialized = true;
    }
  }

  private subscribeToLocationChannels(locationIds: number[]): void {
    try {
      if (!this.pusher && environment.pusherKey && environment.pusherKey !== 'your-pusher-key') {
        this.pusher = new Pusher(environment.pusherKey, {
          cluster: environment.pusherCluster || 'ap2'
        });
      }

      if (!this.pusher) {
        this.initialized = true;
        return;
      }

      locationIds.forEach(id => {
        const channelName = `location.${id}`;
        if (this.subscribedChannels.has(channelName)) {
          return;
        }

        const channel = this.pusher!.subscribe(channelName);

        channel.bind('SalaryProcessed', (data: any) => {
          this.realtimeService.updateSalary(data);
          this.realtimeService.updateFinancial({ type: 'salary' });
        });

        channel.bind('TransactionCreated', (data: any) => {
          this.realtimeService.updateTransaction(data);
          this.realtimeService.updateFinancial({ type: 'transaction' });
        });

        channel.bind('ExpenseCreated', (data: any) => {
          this.realtimeService.updateExpense(data);
          this.realtimeService.updateFinancial({ type: 'expense' });
        });

        channel.bind('ExpenseUpdated', (data: any) => {
          this.realtimeService.updateExpense(data);
          this.realtimeService.updateFinancial({ type: 'expense' });
        });

        this.subscribedChannels.add(channelName);
      });

      this.initialized = true;
    } catch (err) {
      console.warn('WebSocket/Pusher initialization failed:', err);
      this.initialized = true;
    }
  }

  ngOnDestroy(): void {
    this.subscribedChannels.clear();
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }
  }
}
