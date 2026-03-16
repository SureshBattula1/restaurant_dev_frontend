import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RawMaterialsService, RawMaterialsDashboard, LowStockAlert } from '../../../core/services/raw-materials.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService, Location } from '../../../core/services/admin.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { Subscription } from 'rxjs';
import { Chart, ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

Chart.register(...registerables);

@Component({
  selector: 'app-raw-materials-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    LoaderComponent
  ],
  templateUrl: './raw-materials-dashboard.component.html',
  styleUrls: ['./raw-materials-dashboard.component.css']
})
export class RawMaterialsDashboardComponent implements OnInit, OnDestroy {
  dashboardData: RawMaterialsDashboard | null = null;
  lowStockAlerts: LowStockAlert[] = [];
  loading = false;
  currentUser: any;
  selectedLocationId?: number;
  locations: Location[] = [];
  
  // Filter and pagination
  showGoodStock = false; // Hide good stock by default
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 20;
  filteredItems: any[] = [];

  // Chart instances
  consumptionChart: Chart | null = null;
  stockValueChart: Chart | null = null;
  stockStatusChart: Chart | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private rawMaterialsService: RawMaterialsService,
    private inventoryService: InventoryService,
    private authService: AuthService,
    private adminService: AdminService,
    private notification: NotificationService,
    @Inject(RealtimeService) private realtimeService: RealtimeService
  ) {
    this.currentUser = this.authService.getCurrentUser();
  }

  ngOnInit(): void {
    // Load locations for super admin
    if (this.isSuperAdmin()) {
      this.loadLocations();
      // Set default to user's location if available
      this.selectedLocationId = this.currentUser?.location_id;
    } else {
      // Admin users use their own location
      this.selectedLocationId = this.currentUser?.location_id;
    }
    
    this.loadDashboard();
    this.loadLowStockAlerts();
    this.setupRealtimeSubscriptions();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Destroy charts
    if (this.consumptionChart) {
      this.consumptionChart.destroy();
    }
    if (this.stockValueChart) {
      this.stockValueChart.destroy();
    }
    if (this.stockStatusChart) {
      this.stockStatusChart.destroy();
    }
  }

  loadLocations(): void {
    this.adminService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
      },
      error: (err) => {
        console.error('Error loading locations:', err);
        this.notification.error('Error loading locations');
      }
    });
  }

  setupRealtimeSubscriptions(): void {
    // Subscribe to low stock alerts
    const alertSub = this.realtimeService.inventoryUpdates$.subscribe(update => {
      if (update.type === 'low_stock') {
        this.notification.warning(`Low stock alert: ${update.item_name}`);
        this.loadLowStockAlerts();
        this.loadDashboard();
      }
    });

    this.subscriptions.push(alertSub);
  }

  loadDashboard(): void {
    this.loading = true;
    // For admin users, always use their location_id
    const locationId = this.isSuperAdmin() ? this.selectedLocationId : this.currentUser?.location_id;
    
    this.rawMaterialsService.getDashboard(locationId).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.applyFilters();
        this.loading = false;
        // Initialize charts after data is loaded
        setTimeout(() => {
          this.initCharts();
        }, 100);
      },
      error: (err) => {
        this.notification.error('Error loading dashboard');
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    if (!this.dashboardData) return;

    let items = [...this.dashboardData.items];

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        (item.category?.name && item.category.name.toLowerCase().includes(query))
      );
    }

    // Filter out good stock if not showing
    if (!this.showGoodStock) {
      items = items.filter(item => item.stock_status !== 'good');
    }

    // Sort: out-of-stock first, then low, then warning, then good
    items.sort((a, b) => {
      const statusOrder: { [key: string]: number } = {
        'out-of-stock': 0,
        'low': 1,
        'warning': 2,
        'good': 3
      };
      return (statusOrder[a.stock_status] || 99) - (statusOrder[b.stock_status] || 99);
    });

    this.filteredItems = items;
    this.currentPage = 1; // Reset to first page when filters change
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  toggleGoodStock(): void {
    this.showGoodStock = !this.showGoodStock;
    this.applyFilters();
  }

  get outOfStockItems(): any[] {
    return this.filteredItems.filter(i => i.stock_status === 'out-of-stock');
  }

  get lowStockAndWarningItems(): any[] {
    return this.filteredItems.filter(i => i.stock_status !== 'out-of-stock' && i.stock_status !== 'good');
  }

  get goodStockItems(): any[] {
    return this.filteredItems.filter(i => i.stock_status === 'good');
  }

  get paginatedGoodStockItems(): any[] {
    const goodItems = this.goodStockItems;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return goodItems.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.goodStockItems.length / this.itemsPerPage);
  }

  get hasNextPage(): boolean {
    return this.currentPage < this.totalPages;
  }

  get hasPrevPage(): boolean {
    return this.currentPage > 1;
  }

  nextPage(): void {
    if (this.hasNextPage) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.hasPrevPage) {
      this.currentPage--;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  loadLowStockAlerts(): void {
    // For admin users, always use their location_id
    const locationId = this.isSuperAdmin() ? this.selectedLocationId : this.currentUser?.location_id;
    
    this.rawMaterialsService.getLowStockAlerts(locationId).subscribe({
      next: (alerts) => {
        this.lowStockAlerts = alerts;
      },
      error: (err) => {
        console.error('Error loading low stock alerts:', err);
      }
    });
  }

  getStockStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'good': 'status-good',
      'warning': 'status-warning',
      'low': 'status-low',
      'out-of-stock': 'status-out-of-stock'
    };
    return classes[status] || '';
  }

  getStockStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'good': '✓',
      'warning': '⚠',
      'low': '⚠️',
      'out-of-stock': '✗'
    };
    return icons[status] || '';
  }

  onLocationChange(): void {
    this.loadDashboard();
    this.loadLowStockAlerts();
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  quickStockIn(item: any): void {
    // Navigate to inventory dashboard with stock-in modal
    this.notification.info(`Opening stock-in for ${item.name}`);
    // You can implement navigation to inventory dashboard with pre-selected item
  }

  // Helper methods for template
  getTotalConsumption(trend: any): number {
    if (!trend || !trend.daily_consumption) return 0;
    return trend.daily_consumption.reduce((total: number, day: any) => total + (day.quantity || 0), 0);
  }

  getAverageDailyConsumption(trend: any): number {
    const total = this.getTotalConsumption(trend);
    return total / 30;
  }

  getItemUnit(itemName: string): string {
    if (!this.dashboardData || !this.dashboardData.items) return '';
    const item = this.dashboardData.items.find((i: any) => i.name === itemName);
    return item?.unit || '';
  }

  getTrendIndicator(trend: any): string {
    if (!trend || !trend.daily_consumption || trend.daily_consumption.length < 2) return '';
    const first = trend.daily_consumption[0]?.quantity || 0;
    const last = trend.daily_consumption[trend.daily_consumption.length - 1]?.quantity || 0;
    return first > last ? '📉' : '📈';
  }

  initCharts(): void {
    if (!this.dashboardData) return;

    // Destroy existing charts
    if (this.consumptionChart) {
      this.consumptionChart.destroy();
    }
    if (this.stockValueChart) {
      this.stockValueChart.destroy();
    }
    if (this.stockStatusChart) {
      this.stockStatusChart.destroy();
    }

    // Consumption Trends Chart
    this.initConsumptionChart();

    // Stock Value Chart
    this.initStockValueChart();

    // Stock Status Chart
    this.initStockStatusChart();
  }

  initConsumptionChart(): void {
    const ctx = document.getElementById('consumptionChart') as HTMLCanvasElement;
    if (!ctx || !this.dashboardData) return;

    const trends = this.dashboardData.consumption_trends || [];
    if (trends.length === 0) return;

    // Get top 5 consumed items
    const topItems = trends
      .map(trend => ({
        name: trend.item_name,
        total: trend.daily_consumption.reduce((sum: number, day: any) => sum + day.quantity, 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const data: ChartData<'bar'> = {
      labels: topItems.map(item => item.name),
      datasets: [{
        label: 'Total Consumption (Last 30 Days)',
        data: topItems.map(item => item.total),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
      }]
    };

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Top 5 Consumed Raw Materials'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };

    this.consumptionChart = new Chart(ctx, config);
  }

  initStockValueChart(): void {
    const ctx = document.getElementById('stockValueChart') as HTMLCanvasElement;
    if (!ctx || !this.dashboardData) return;

    const items = this.dashboardData.items || [];
    if (items.length === 0) return;

    // Get top 10 items by stock value
    const topItems = items
      .sort((a, b) => b.stock_value - a.stock_value)
      .slice(0, 10);

    const data: ChartData<'doughnut'> = {
      labels: topItems.map(item => item.name),
      datasets: [{
        label: 'Stock Value (₹)',
        data: topItems.map(item => item.stock_value),
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(20, 184, 166, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)'
        ]
      }]
    };

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          },
          title: {
            display: true,
            text: 'Stock Value Distribution (Top 10)'
          }
        }
      }
    };

    this.stockValueChart = new Chart(ctx, config);
  }

  initStockStatusChart(): void {
    const ctx = document.getElementById('stockStatusChart') as HTMLCanvasElement;
    if (!ctx || !this.dashboardData) return;

    const items = this.dashboardData.items || [];
    if (items.length === 0) return;

    const statusCounts = {
      good: items.filter(item => item.stock_status === 'good').length,
      warning: items.filter(item => item.stock_status === 'warning').length,
      low: items.filter(item => item.stock_status === 'low').length,
      'out-of-stock': items.filter(item => item.stock_status === 'out-of-stock').length
    };

    const data: ChartData<'pie'> = {
      labels: ['Good', 'Warning', 'Low', 'Out of Stock'],
      datasets: [{
        label: 'Stock Status',
        data: [statusCounts.good, statusCounts.warning, statusCounts.low, statusCounts['out-of-stock']],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(107, 114, 128, 0.8)'
        ]
      }]
    };

    const config: ChartConfiguration<'pie'> = {
      type: 'pie',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          },
          title: {
            display: true,
            text: 'Stock Status Overview'
          }
        }
      }
    };

    this.stockStatusChart = new Chart(ctx, config);
  }
}

