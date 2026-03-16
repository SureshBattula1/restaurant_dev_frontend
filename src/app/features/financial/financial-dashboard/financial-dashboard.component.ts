import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FinancialService } from '../../../core/services/financial.service';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { BranchSelectorComponent } from '../../../shared/components/branch-selector/branch-selector.component';

Chart.register(...registerables);

@Component({
  selector: 'app-financial-dashboard',
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
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    LoaderComponent,
    BranchSelectorComponent
  ],
  templateUrl: './financial-dashboard.component.html',
  styleUrls: ['./financial-dashboard.component.css']
})
export class FinancialDashboardComponent implements OnInit, OnDestroy {
  currentUser: any;
  dashboardData: any = null;
  locations: any[] = [];
  selectedLocationId?: number | null;
  dateFrom: string = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  dateTo: string = new Date().toISOString().split('T')[0];
  chart: Chart | null = null;
  loading = false;
  private financialSub?: Subscription;

  constructor(
    private financialService: FinancialService,
    private authService: AuthService,
    private adminService: AdminService,
    private realtimeService: RealtimeService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.webSocketService.subscribeToSalaryAndTransactionChannels();
    this.financialSub = this.realtimeService.financialUpdates$.subscribe(() => {
      this.loadDashboard();
    });
    this.loadLocations();
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.financialSub?.unsubscribe();
  }

  loadLocations(): void {
    this.adminService.getLocations().subscribe({
      next: (locations) => this.locations = locations
    });
  }

  onBranchChange(locationId: number | null | undefined): void {
    this.selectedLocationId = locationId ?? undefined;
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.dashboardData = null;
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.loading = true;
    const params: any = { date_from: this.dateFrom, date_to: this.dateTo };
    const locationId = this.selectedLocationId;
    if (locationId != null && locationId !== undefined) {
      params.location_id = locationId;
    }
    
    this.financialService.getDashboard(params).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.createChart();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  createChart(): void {
    if (!this.dashboardData?.daily_trends) return;
    
    const canvas = document.getElementById('financialChart') as HTMLCanvasElement;
    if (!canvas) return;
    
    if (this.chart) this.chart.destroy();
    
    const labels = this.dashboardData.daily_trends.map((d: any) => d.date);
    const revenue = this.dashboardData.daily_trends.map((d: any) => d.revenue);
    const expenses = this.dashboardData.daily_trends.map((d: any) => d.expenses);
    
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Revenue', data: revenue, borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.1)' },
          { label: 'Expenses', data: expenses, borderColor: 'rgb(239, 68, 68)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }
        ]
      },
      options: { responsive: true }
    });
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }
}
