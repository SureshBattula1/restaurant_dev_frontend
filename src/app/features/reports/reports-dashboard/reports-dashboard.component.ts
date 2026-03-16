import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReportService } from '../../../core/services/report.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AdminService } from '../../../core/services/admin.service';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

Chart.register(...registerables);

@Component({
  selector: 'app-reports-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatTabsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    LoaderComponent
  ],
  templateUrl: './reports-dashboard.component.html',
  styleUrls: ['./reports-dashboard.component.css']
})
export class ReportsDashboardComponent implements OnInit {
  currentUser: any;
  activeReport: 'sales' | 'inventory' | 'accounting' = 'sales';
  locations: any[] = [];
  selectedLocationId?: number;
  
  salesReportForm: FormGroup;
  inventoryReportForm: FormGroup;
  accountingReportForm: FormGroup;
  
  salesData: any = null;
  inventoryData: any = null;
  accountingData: any = null;
  loading = false;
  
  salesChart: Chart | null = null;
  inventoryChart: Chart | null = null;
  profitLossChart: Chart | null = null;

  constructor(
    private fb: FormBuilder,
    private reportService: ReportService,
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router,
    private notification: NotificationService
  ) {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    // All reports: Use current date for both from and to
    this.salesReportForm = this.fb.group({
      date_from: [todayString, Validators.required],
      date_to: [todayString, Validators.required]
    });

    this.inventoryReportForm = this.fb.group({
      date_from: [todayString, Validators.required],
      date_to: [todayString, Validators.required]
    });

    this.accountingReportForm = this.fb.group({
      date_from: [todayString, Validators.required],
      date_to: [todayString, Validators.required]
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    // Set default location for non-superadmin users
    if (!this.authService.isSuperAdmin() && this.currentUser?.location_id) {
      this.selectedLocationId = this.currentUser.location_id;
    }
    if (this.authService.isSuperAdmin()) {
      this.loadLocations();
    }
  }

  loadLocations(): void {
    this.adminService.getLocations().subscribe({
      next: (locations) => this.locations = locations
    });
  }

  switchReport(report: string): void {
    if (report === 'sales' || report === 'inventory' || report === 'accounting') {
      this.activeReport = report;
    }
  }

  generateSalesReport(): void {
    if (this.salesReportForm.invalid) return;
    
    this.loading = true;
    this.salesData = null; // Clear previous data
    const { date_from, date_to } = this.salesReportForm.value;
    const params: any = { date_from, date_to };
    
    // Only add location_id if superadmin explicitly selected one, or for non-superadmin use their location
    if (this.authService.isSuperAdmin()) {
      if (this.selectedLocationId != null && this.selectedLocationId !== undefined) {
        params.location_id = this.selectedLocationId;
      }
    } else {
      // For non-superadmin, backend will use their assigned location automatically
      // But we can still pass it explicitly for clarity
      if (this.currentUser?.location_id) {
        params.location_id = this.currentUser.location_id;
      }
    }
    
    this.reportService.getItemSales(date_from, date_to, params).subscribe({
      next: (data) => {
        console.log('Sales report data:', data);
        this.salesData = data;
        if (data && data.items && data.items.length > 0) {
          this.createSalesChart(data);
          this.notification.success('Sales report generated successfully');
        } else {
          this.notification.info('No sales data found for the selected period');
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error generating sales report:', err);
        const errorMsg = err.error?.message || err.message || 'Error generating sales report';
        this.notification.error(errorMsg);
        this.loading = false;
      }
    });
  }

  generateInventoryReport(): void {
    if (this.inventoryReportForm.invalid) return;
    
    this.loading = true;
    this.inventoryData = null; // Clear previous data
    const { date_from, date_to } = this.inventoryReportForm.value;
    const params: any = { date_from, date_to };
    
    // Only add location_id if superadmin explicitly selected one, or for non-superadmin use their location
    if (this.authService.isSuperAdmin()) {
      if (this.selectedLocationId != null && this.selectedLocationId !== undefined) {
        params.location_id = this.selectedLocationId;
      }
    } else {
      // For non-superadmin, backend will use their assigned location automatically
      if (this.currentUser?.location_id) {
        params.location_id = this.currentUser.location_id;
      }
    }
    
    this.reportService.getInventoryValuation(date_from, date_to, params).subscribe({
      next: (data) => {
        console.log('Inventory report data:', data);
        this.inventoryData = data;
        if (data && data.items && data.items.length > 0) {
          this.createInventoryChart(data);
          this.notification.success('Inventory report generated successfully');
        } else {
          this.notification.info('No inventory data found for the selected period');
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error generating inventory report:', err);
        const errorMsg = err.error?.message || err.message || 'Error generating inventory report';
        this.notification.error(errorMsg);
        this.loading = false;
      }
    });
  }

  generateAccountingReport(): void {
    if (this.accountingReportForm.invalid) return;
    
    this.loading = true;
    this.accountingData = null; // Clear previous data
    const { date_from, date_to } = this.accountingReportForm.value;
    const params: any = { date_from, date_to };
    
    // Only add location_id if superadmin explicitly selected one, or for non-superadmin use their location
    if (this.authService.isSuperAdmin()) {
      if (this.selectedLocationId != null && this.selectedLocationId !== undefined) {
        params.location_id = this.selectedLocationId;
      }
    } else {
      // For non-superadmin, backend will use their assigned location automatically
      if (this.currentUser?.location_id) {
        params.location_id = this.currentUser.location_id;
      }
    }
    
    this.reportService.getProfitLoss(date_from, date_to, params).subscribe({
      next: (data) => {
        console.log('Accounting report data:', data);
        this.accountingData = data;
        if (data && (data.revenue || data.expenses || data.cost_of_goods_sold)) {
          this.createProfitLossChart(data);
          this.notification.success('Profit & Loss report generated successfully');
        } else {
          this.notification.info('No accounting data found for the selected period');
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error generating accounting report:', err);
        const errorMsg = err.error?.message || err.message || 'Error generating accounting report';
        this.notification.error(errorMsg);
        this.loading = false;
      }
    });
  }

  createSalesChart(data: any): void {
    setTimeout(() => {
      const canvas = document.getElementById('salesChart') as HTMLCanvasElement;
      if (!canvas) return;
      
      if (this.salesChart) {
        this.salesChart.destroy();
      }

      const items = data.items || [];
      if (items.length === 0) return;

      const labels = items.map((item: any) => item.name || item.item_name).slice(0, 10);
      const quantities = items.map((item: any) => item.total_quantity || 0).slice(0, 10);
      const revenues = items.map((item: any) => item.total_revenue || 0).slice(0, 10);

    this.salesChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Quantity Sold',
            data: quantities,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1
          },
          {
            label: 'Revenue (₹)',
            data: revenues,
            backgroundColor: 'rgba(16, 185, 129, 0.5)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            position: 'left'
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true
          }
        }
      }
    });
    }, 100);
  }

  createInventoryChart(data: any): void {
    setTimeout(() => {
      const canvas = document.getElementById('inventoryChart') as HTMLCanvasElement;
      if (!canvas) return;
      
      const items = data.items || [];
      if (items.length === 0) return;

      const labels = items.map((item: any) => item.item_name || item.name).slice(0, 10);
      const values = items.map((item: any) => item.total_value || 0).slice(0, 10);
      const quantities = items.map((item: any) => item.quantity || 0).slice(0, 10);

      // Destroy existing chart if any
      if (this.inventoryChart) {
        this.inventoryChart.destroy();
      }

    this.inventoryChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Stock Value (₹)',
            data: values,
            backgroundColor: 'rgba(139, 92, 246, 0.5)',
            borderColor: 'rgba(139, 92, 246, 1)',
            borderWidth: 1
          },
          {
            label: 'Quantity',
            data: quantities,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            position: 'left'
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true
          }
        }
      }
    });
    }, 100);
  }

  createProfitLossChart(data: any): void {
    setTimeout(() => {
      const canvas = document.getElementById('profitLossChart') as HTMLCanvasElement;
      if (!canvas) return;
      
      if (this.profitLossChart) {
        this.profitLossChart.destroy();
      }

      const revenue = data.revenue || 0;
      const expenses = data.expenses || 0;
      const cogs = data.cost_of_goods_sold || 0;
      const profit = data.net_profit || 0;

      if (revenue === 0 && expenses === 0 && cogs === 0 && profit === 0) return;

    this.profitLossChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Revenue', 'COGS', 'Expenses', 'Profit'],
        datasets: [{
          data: [revenue, cogs, expenses, profit],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(16, 185, 129, 0.8)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
    }, 100);
  }

  exportReport(format: 'pdf' | 'excel' | 'csv'): void {
    this.loading = true;
    const form = this.activeReport === 'sales' ? this.salesReportForm : this.activeReport === 'inventory' ? this.inventoryReportForm : this.accountingReportForm;
    const { date_from, date_to } = form.value;

    let endpoint = '';
    const params: any = { format, date_from, date_to };
    if (this.authService.isSuperAdmin() && this.selectedLocationId != null && this.selectedLocationId !== undefined) {
      params.location_id = this.selectedLocationId;
    } else if (!this.authService.isSuperAdmin() && this.currentUser?.location_id) {
      params.location_id = this.currentUser.location_id;
    }

    switch (this.activeReport) {
      case 'sales':
        endpoint = '/reports/sales/export';
        break;
      case 'inventory':
        endpoint = '/reports/inventory/export';
        break;
      case 'accounting':
        endpoint = '/reports/accounting/export';
        break;
    }

    this.reportService.exportReport(endpoint, params, format).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.activeReport}_report_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.notification.success(`Report exported as ${format.toUpperCase()}`);
        this.loading = false;
      },
      error: (err) => {
        this.notification.error('Error exporting report');
        this.loading = false;
      }
    });
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

}
