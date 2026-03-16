import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SalaryService, SalaryPayment } from '../../../core/services/salary.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AdminService } from '../../../core/services/admin.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableConfig, DataTableParams, DataTablePagination } from '../../../shared/interfaces/datatable-config.interface';
import { RealtimeService } from '../../../core/services/realtime.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { Subject, Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { BranchSelectorComponent } from '../../../shared/components/branch-selector/branch-selector.component';

@Component({
  selector: 'app-salary-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    DataTableComponent,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatTabsModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    LoaderComponent,
    BranchSelectorComponent
  ],
  templateUrl: './salary-dashboard.component.html',
  styleUrls: ['./salary-dashboard.component.css']
})
export class SalaryDashboardComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription[] = [];
  currentUser: any;
  activeTab: 'salary' | 'advances' = 'salary';
  salaries: SalaryPayment[] = [];
  locations: any[] = [];
  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();
  selectedLocationId?: number;
  employees: any[] = [];
  
  // DataTable configuration
  salariesTableConfig!: DataTableConfig;
  salariesTableData: SalaryPayment[] = [];
  salariesTablePagination: DataTablePagination | null = null;
  salariesTableLoading = false;
  salariesRealtimeUpdates$ = new Subject<any>();

  advancesTableConfig!: DataTableConfig;
  advancesTableData: any[] = [];
  advancesTablePagination: DataTablePagination | null = null;
  advancesTableLoading = false;
  advancesRealtimeUpdates$ = new Subject<any>();
  
  advancePaymentForm: FormGroup;
  showAdvanceModal = false;
  selectedAdvance: any = null;
  
  calculateForm: FormGroup;
  payForm: FormGroup;
  showPayModal = false;
  calculation: any = null;
  loading = false;

  selectedSalary: SalaryPayment | null = null;
  showViewSalaryModal = false;

  constructor(
    private fb: FormBuilder,
    private salaryService: SalaryService,
    private authService: AuthService,
    private adminService: AdminService,
    private notification: NotificationService,
    @Inject(RealtimeService) private realtimeService: RealtimeService,
    private webSocketService: WebSocketService
  ) {
    this.calculateForm = this.fb.group({
      employee_id: [null, Validators.required],
      month: [this.selectedMonth, Validators.required],
      year: [this.selectedYear, Validators.required]
    });

    this.payForm = this.fb.group({
      employee_id: [null, Validators.required],
      location_id: [null, Validators.required],
      salary_month: [this.selectedMonth, Validators.required],
      salary_year: [this.selectedYear, Validators.required],
      base_salary: [0, Validators.required],
      overtime_hours: [0],
      overtime_amount: [0],
      deductions: [0],
      bonus: [0],
      net_salary: [0, Validators.required],
      payment_method: ['bank_transfer'],
      notes: ['']
    });

    this.advancePaymentForm = this.fb.group({
      employee_id: ['', Validators.required],
      location_id: [null, Validators.required],
      payment_date: [new Date().toISOString().split('T')[0], Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      reason: [''],
      notes: ['']
    });

    const advanceLocationSub = this.advancePaymentForm.get('location_id')?.valueChanges.subscribe(locationId => {
      if (locationId) {
        this.loadEmployeesForLocation(locationId);
        this.advancePaymentForm.patchValue({ employee_id: '' }, { emitEvent: false });
      }
    });
    if (advanceLocationSub) {
      this.subscriptions.push(advanceLocationSub);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.webSocketService.subscribeToSalaryAndTransactionChannels();
    this.initializeSalariesTableConfig();
    this.initializeAdvancesTableConfig();
    this.setupRealtimeUpdates();
    this.loadLocations();
    this.loadSalaries();
  }

  initializeSalariesTableConfig(): void {
    this.salariesTableConfig = {
      columns: [
        { key: 'employee.person.name', label: 'Employee', sortable: true, format: (v, row) => row.employee?.person?.name || (row.employee?.person?.first_name || '') + ' ' + (row.employee?.person?.last_name || '') || 'N/A' },
        { key: 'salary_month', label: 'Month/Year', sortable: true, format: (v, row) => `${row.salary_month}/${row.salary_year}` },
        { key: 'base_salary', label: 'Base Salary', sortable: true, type: 'currency', format: (v) => `₹${Number(v).toFixed(2)}` },
        { key: 'overtime_amount', label: 'Overtime', sortable: true, type: 'currency', format: (v) => `₹${Number(v || 0).toFixed(2)}` },
        { key: 'deductions', label: 'Deductions', sortable: true, type: 'currency', format: (v) => `₹${Number(v || 0).toFixed(2)}` },
        { key: 'bonus', label: 'Bonus', sortable: true, type: 'currency', format: (v) => `₹${Number(v || 0).toFixed(2)}` },
        { key: 'net_salary', label: 'Net Salary', sortable: true, type: 'currency', format: (v) => `₹${Number(v).toFixed(2)}` },
        { key: 'status', label: 'Status', sortable: true, type: 'status', format: (v) => v }
      ],
      filters: [
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'cancelled', label: 'Cancelled' }
          ]
        },
        {
          key: 'month',
          label: 'Month',
          type: 'select',
          options: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}` }))
        },
        {
          key: 'year',
          label: 'Year',
          type: 'select',
          options: Array.from({ length: 5 }, (_, i) => ({ value: new Date().getFullYear() - 2 + i, label: `${new Date().getFullYear() - 2 + i}` }))
        }
      ],
      actions: [
        {
          label: 'View',
          icon: 'visibility',
          color: 'primary',
          action: (row) => this.viewSalary(row),
          tooltip: 'View salary details'
        }
      ],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No salary records found'
    };
  }

  setupRealtimeUpdates(): void {
    this.realtimeService.salaryUpdates$.subscribe(() => {
      this.salariesRealtimeUpdates$.next({ type: 'refresh' });
    });
  }

  initializeAdvancesTableConfig(): void {
    this.advancesTableConfig = {
      columns: [
        { key: 'employee.person.first_name', label: 'Employee', sortable: true, format: (v: any, row?: any) => this.getEmployeeDisplayName(row?.employee) || 'N/A' },
        { key: 'location.name', label: 'Location', sortable: true },
        { key: 'payment_date', label: 'Date', sortable: true, type: 'date' },
        { key: 'amount', label: 'Amount', sortable: true, type: 'currency', format: (v: any) => `₹${Number(v).toFixed(2)}` },
        { key: 'repaid_amount', label: 'Repaid', sortable: true, type: 'currency', format: (v: any) => `₹${Number(v || 0).toFixed(2)}` },
        { key: 'remaining', label: 'Remaining', sortable: false, type: 'currency', format: (v: any, row?: any) => {
          if (row) return `₹${Number((row.amount || 0) - (row.repaid_amount || 0)).toFixed(2)}`;
          return `₹${Number(v || 0).toFixed(2)}`;
        }},
        { key: 'status', label: 'Status', sortable: true }
      ],
      filters: [
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'repaid', label: 'Repaid' }
          ]
        }
      ],
      actions: [
        { label: 'Edit', icon: 'edit', color: 'primary', action: (row: any) => this.openAdvanceModal(row), tooltip: 'Edit advance' },
        { label: 'Approve', icon: 'check', color: 'primary', action: (row: any) => this.approveAdvance(row), condition: (row: any) => row.status === 'pending', tooltip: 'Approve advance' },
        { label: 'Reject', icon: 'close', color: 'warn', action: (row: any) => this.rejectAdvance(row), condition: (row: any) => row.status === 'pending', tooltip: 'Reject advance' }
      ],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No advance payments found'
    };
  }

  loadAdvancesTableData = async (params: DataTableParams): Promise<any> => {
    this.advancesTableLoading = true;
    const requestParams: any = {
      page: params.page || 1,
      per_page: params.per_page || 10,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir
    };
    if (this.isSuperAdmin()) {
      if (this.selectedLocationId !== undefined && this.selectedLocationId !== null) {
        requestParams.location_id = this.selectedLocationId;
      }
    } else {
      requestParams.location_id = this.currentUser?.location_id;
    }
    if (params['status']) requestParams.status = params['status'];

    return new Promise((resolve, reject) => {
      this.adminService.getAdvancePayments(requestParams).subscribe({
        next: (response: any) => {
          let data: any[] = [];
          let pagination: DataTablePagination | null = null;
          if (response?.data) {
            data = response.data.map((a: any) => ({ ...a, remaining: (a.amount || 0) - (a.repaid_amount || 0) }));
            if (response.pagination) pagination = response.pagination;
            else if (response.current_page) pagination = { page: response.current_page, per_page: response.per_page || 10, total: response.total || 0, last_page: response.last_page || 1, from: response.from, to: response.to };
          } else if (Array.isArray(response)) {
            data = response.map((a: any) => ({ ...a, remaining: (a.amount || 0) - (a.repaid_amount || 0) }));
          }
          this.advancesTableData = data;
          this.advancesTablePagination = pagination;
          this.advancesTableLoading = false;
          resolve({ data, pagination });
        },
        error: (err) => {
          this.notification.error('Error loading advance payments');
          this.advancesTableLoading = false;
          reject(err);
        }
      });
    });
  };

  loadSalariesTableData = async (params: DataTableParams): Promise<any> => {
    this.salariesTableLoading = true;
    
    const requestParams: any = {
      page: params.page || 1,
      per_page: params.per_page || 10,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
      month: params['month'] || this.selectedMonth,
      year: params['year'] || this.selectedYear
    };

    if (this.isSuperAdmin()) {
      if (this.selectedLocationId !== undefined && this.selectedLocationId !== null) {
        requestParams.location_id = this.selectedLocationId;
      }
    } else {
      requestParams.location_id = this.currentUser?.location_id;
    }

    if (params['status']) {
      requestParams.status = params['status'];
    }

    return new Promise((resolve, reject) => {
      this.salaryService.getSalaries(requestParams).subscribe({
        next: (response: any) => {
          let data: SalaryPayment[] = [];
          let pagination: DataTablePagination | null = null;

          if (response && response.data) {
            data = response.data;
            if (response.pagination) {
              pagination = response.pagination;
            } else if (response.current_page) {
              pagination = {
                page: response.current_page,
                per_page: response.per_page || 10,
                total: response.total || 0,
                last_page: response.last_page || 1,
                from: response.from,
                to: response.to
              };
            }
          } else if (Array.isArray(response)) {
            data = response;
          }

          this.salariesTableData = data;
          this.salariesTablePagination = pagination;
          this.salariesTableLoading = false;

          resolve({ data, pagination });
        },
        error: (err) => {
          console.error('Error loading salaries:', err);
          const message = err?.error?.message || 'Error loading salaries';
          this.notification.error(message);
          this.salariesTableLoading = false;
          reject(err);
        }
      });
    });
  }

  onBranchChange(): void {
    this.loadSalaries();
    this.salariesRealtimeUpdates$.next({ type: 'refresh' });
    this.advancesRealtimeUpdates$.next({ type: 'refresh' });
  }

  loadEmployeesForLocation(locationId?: number): void {
    const params: any = {};
    if (locationId != null) params.location_id = locationId;
    this.adminService.getEmployees(params).subscribe({
      next: (response: any) => {
        this.employees = Array.isArray(response) ? response : (response?.data || []);
      },
      error: () => { this.employees = []; }
    });
  }

  openAdvanceModal(advance?: any): void {
    this.selectedAdvance = advance || null;
    const autoLocationId = !this.isSuperAdmin() ? this.currentUser?.location_id : (this.selectedLocationId ?? null);
    const locationId = advance?.location_id ?? autoLocationId;
    if (locationId) this.loadEmployeesForLocation(locationId);

    if (advance) {
      this.advancePaymentForm.patchValue({
        employee_id: advance.employee_id,
        location_id: advance.location_id ?? autoLocationId,
        payment_date: advance.payment_date,
        amount: advance.amount,
        reason: advance.reason ?? '',
        notes: advance.notes ?? ''
      });
      if (!this.isSuperAdmin()) this.advancePaymentForm.get('location_id')?.disable();
      else this.advancePaymentForm.get('location_id')?.enable();
    } else {
      this.advancePaymentForm.patchValue({
        employee_id: '',
        location_id: autoLocationId,
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        reason: '',
        notes: ''
      });
      if (!this.isSuperAdmin()) this.advancePaymentForm.get('location_id')?.disable();
      else this.advancePaymentForm.get('location_id')?.enable();
    }
    this.showAdvanceModal = true;
  }

  saveAdvancePayment(): void {
    if (this.advancePaymentForm.invalid) return;
    const data = this.advancePaymentForm.getRawValue();
    if (this.selectedAdvance) {
      this.adminService.updateAdvancePayment(this.selectedAdvance.id, data).subscribe({
        next: (res: any) => {
          this.notification.success('Advance payment updated successfully');
          this.advancesRealtimeUpdates$.next({ type: 'updated', data: res.advance ?? res });
          this.showAdvanceModal = false;
        },
        error: (err) => this.notification.error(err.error?.message ?? 'Error updating advance payment')
      });
    } else {
      this.adminService.createAdvancePayment(data).subscribe({
        next: (res: any) => {
          this.notification.success('Advance payment created successfully');
          this.advancesRealtimeUpdates$.next({ type: 'created', data: res.advance ?? res });
          this.showAdvanceModal = false;
        },
        error: (err) => this.notification.error(err.error?.message ?? 'Error creating advance payment')
      });
    }
  }

  approveAdvance(advance: any): void {
    this.adminService.updateAdvancePayment(advance.id, { status: 'approved' }).subscribe({
      next: () => {
        this.notification.success('Advance payment approved');
        this.advancesRealtimeUpdates$.next({ type: 'updated', data: { ...advance, status: 'approved' } });
      },
      error: (err) => this.notification.error(err.error?.message ?? 'Error approving advance')
    });
  }

  rejectAdvance(advance: any): void {
    this.adminService.updateAdvancePayment(advance.id, { status: 'rejected' }).subscribe({
      next: () => {
        this.notification.success('Advance payment rejected');
        this.advancesRealtimeUpdates$.next({ type: 'updated', data: { ...advance, status: 'rejected' } });
      },
      error: (err) => this.notification.error(err.error?.message ?? 'Error rejecting advance')
    });
  }

  closeAdvanceModal(): void {
    this.showAdvanceModal = false;
    this.advancePaymentForm.get('location_id')?.enable();
  }

  getEmployeeDisplayName(emp: any): string {
    if (!emp) return '';
    if (emp.person) {
      if (emp.person.name) return emp.person.name;
      if (emp.person.first_name || emp.person.last_name) return `${emp.person.first_name ?? ''} ${emp.person.last_name ?? ''}`.trim();
    }
    return emp.employee_number ? `Employee #${emp.employee_number}` : `Employee ${emp.id}`;
  }

  viewSalary(salary: SalaryPayment): void {
    this.selectedSalary = salary;
    this.showViewSalaryModal = true;
  }

  closeViewSalaryModal(): void {
    this.showViewSalaryModal = false;
    this.selectedSalary = null;
  }

  loadLocations(): void {
    this.adminService.getLocations().subscribe({
      next: (locations) => this.locations = locations
    });
  }

  loadSalaries(): void {
    this.loading = true;
    const params: any = { month: this.selectedMonth, year: this.selectedYear };
    // Only add location_id if it's a valid number (not undefined/null)
    if (this.selectedLocationId !== undefined && this.selectedLocationId !== null) {
      params.location_id = this.selectedLocationId;
    }
    
    this.salaryService.getSalaries(params).subscribe({
      next: (response: any) => {
        this.salaries = response.data || response.data?.data || response;
        this.loading = false;
      },
      error: () => {
        this.notification.error('Error loading salaries');
        this.loading = false;
      }
    });
  }

  calculateSalary(): void {
    if (this.calculateForm.invalid) return;
    
    this.loading = true;
    this.salaryService.calculateSalary(this.calculateForm.value).subscribe({
      next: (response) => {
        this.calculation = response.calculation;
        this.payForm.patchValue({
          employee_id: this.calculateForm.value.employee_id,
          base_salary: this.calculation.base_salary,
          overtime_hours: this.calculation.overtime_hours,
          overtime_amount: this.calculation.overtime_amount,
          deductions: this.calculation.deductions,
          net_salary: this.calculation.net_salary
        });
        this.showPayModal = true;
        this.loading = false;
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error calculating salary');
        this.loading = false;
      }
    });
  }

  paySalary(): void {
    if (this.payForm.invalid) return;
    
    this.loading = true;
    this.salaryService.paySalary(this.payForm.value).subscribe({
      next: () => {
        this.notification.success('Salary paid successfully');
        this.showPayModal = false;
        this.loadSalaries();
        this.salariesRealtimeUpdates$.next({ type: 'refresh' });
        this.loading = false;
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error processing payment');
        this.loading = false;
      }
    });
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }
}
