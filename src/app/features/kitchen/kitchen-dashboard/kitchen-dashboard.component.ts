import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { KitchenService, KitchenOrder } from '../../../core/services/kitchen.service';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService, Location } from '../../../core/services/admin.service';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { BranchSelectorComponent } from '../../../shared/components/branch-selector/branch-selector.component';

@Component({
  selector: 'app-kitchen-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatTabsModule,
    BranchSelectorComponent
  ],
  templateUrl: './kitchen-dashboard.component.html',
  styleUrls: ['./kitchen-dashboard.component.css']
})
export class KitchenDashboardComponent implements OnInit, OnDestroy {
  orders: KitchenOrder[] = [];
  filteredOrders: KitchenOrder[] = [];
  currentUser: any;
  selectedOrder: KitchenOrder | null = null;
  statusFilter: string = 'all';
  locations: Location[] = [];
  selectedLocationId?: number;
  
  statusForm: FormGroup;
  private refreshSubscription?: Subscription;
  private realtimeSubscriptions: Subscription[] = [];
  soundEnabled = true;

  constructor(
    private fb: FormBuilder,
    private kitchenService: KitchenService,
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router,
    private notification: NotificationService,
    @Inject(RealtimeService) private realtimeService: RealtimeService
  ) {
    this.statusForm = this.fb.group({
      status: ['', Validators.required],
      estimated_time: [null]
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.selectedLocationId = this.currentUser?.location_id;
    
    // Load locations if superadmin
    if (this.isSuperAdmin()) {
      this.adminService.getLocations().subscribe({
        next: (locations) => this.locations = locations
      });
    }
    
    this.loadOrders();
    this.setupRealtimeUpdates();
    
    // Auto-refresh every 10 seconds (reduced frequency since we have real-time updates)
    this.refreshSubscription = interval(10000).subscribe(() => {
      this.loadOrders();
    });
  }
  
  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }
  
  onLocationChange(): void {
    this.loadOrders();
  }

  setupRealtimeUpdates(): void {
    // Subscribe to real-time kitchen order updates
    const kitchenSub = this.realtimeService.kitchenOrders$.subscribe(orders => {
      if (orders && orders.length > 0) {
        this.orders = orders;
        this.applyFilter();
      }
    });

    // Subscribe to real-time notifications
    const notificationSub = this.realtimeService.notifications$.subscribe(notif => {
      if (notif.type === 'info' && notif.data?.status) {
        // Play sound for new orders
        if (this.soundEnabled && (notif.data.status === 'pending' || notif.data.status === 'preparing')) {
          this.playNotificationSound();
        }
        // Refresh orders
        this.loadOrders();
      }
    });

    this.realtimeSubscriptions.push(kitchenSub, notificationSub);
  }

  playNotificationSound(): void {
    if (this.soundEnabled) {
      const audio = new Audio('/assets/sounds/notification.mp3');
      audio.play().catch(err => {
        // Fallback to beep if sound file not found
        console.log('Sound notification');
      });
    }
  }

  toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
  }

  ngOnDestroy(): void {
    this.realtimeSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  loadOrders(): void {
    const params: any = {};
    if (this.isSuperAdmin() && this.selectedLocationId !== undefined) {
      params.location_id = this.selectedLocationId;
    }
    this.kitchenService.getActiveOrders(params).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.applyFilter();
      },
      error: (err) => console.error('Error loading orders:', err)
    });
  }

  applyFilter(): void {
    if (this.statusFilter === 'all') {
      this.filteredOrders = this.orders.filter(o => 
        o.status !== 'delivered' && o.status !== 'cancelled'
      );
    } else {
      this.filteredOrders = this.orders.filter(o => o.status === this.statusFilter);
    }
    
    // Sort by priority and created_at
    this.filteredOrders.sort((a, b) => {
      if (a.priority !== b.priority) {
        return (b.priority || 0) - (a.priority || 0);
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  filterByStatus(status: string): void {
    const validStatuses: ('all' | 'pending' | 'preparing' | 'cooking' | 'ready' | 'delivered' | 'cancelled')[] = 
      ['all', 'pending', 'preparing', 'cooking', 'ready', 'delivered', 'cancelled'];
    if (validStatuses.includes(status as any)) {
      this.statusFilter = status as 'all' | 'pending' | 'preparing' | 'cooking' | 'ready' | 'delivered' | 'cancelled';
      this.applyFilter();
    }
  }

  selectOrder(order: KitchenOrder): void {
    this.selectedOrder = order;
    this.statusForm.patchValue({
      status: order.status,
      estimated_time: order.estimated_time
    });
  }

  updateOrderStatus(): void {
    if (!this.selectedOrder) return;

    const formValue = this.statusForm.value;
    this.kitchenService.updateOrderStatus(
      this.selectedOrder.id,
      formValue.status,
      formValue.estimated_time
    ).subscribe({
      next: () => {
        this.notification.success('Order status updated');
        this.loadOrders();
        this.selectedOrder = null;
        this.playNotificationSound();
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error updating order status');
        console.error('Error updating order:', err);
      }
    });
  }

  getOrderCountByStatus(status: string): number {
    return this.orders.filter(o => o.status === status).length;
  }

  markAsReady(order: KitchenOrder): void {
    this.kitchenService.updateOrderStatus(order.id, 'ready').subscribe({
      next: () => {
        this.loadOrders();
        this.playNotificationSound();
      },
      error: (err) => console.error('Error:', err)
    });
  }

  markAsDelivered(order: KitchenOrder): void {
    this.kitchenService.updateOrderStatus(order.id, 'delivered').subscribe({
      next: () => {
        this.loadOrders();
      },
      error: (err) => console.error('Error:', err)
    });
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'preparing': 'bg-blue-100 text-blue-800',
      'cooking': 'bg-orange-100 text-orange-800',
      'ready': 'bg-green-100 text-green-800',
      'delivered': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  getPriorityColor(priority: number): string {
    if (priority >= 3) return 'bg-red-500';
    if (priority === 2) return 'bg-orange-500';
    return 'bg-blue-500';
  }

  getElapsedTime(createdAt: string): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diff = Math.floor((now.getTime() - created.getTime()) / 1000 / 60);
    
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m ago`;
  }

  closeStatusModal(): void {
    this.selectedOrder = null;
    this.statusForm.reset();
  }

}
