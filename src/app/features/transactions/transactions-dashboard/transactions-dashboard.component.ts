import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService, CashTransaction } from '../../../core/services/transaction.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableConfig, DataTableParams, DataTablePagination } from '../../../shared/interfaces/datatable-config.interface';
import { RealtimeService } from '../../../core/services/realtime.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { Subject } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
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

@Component({
  selector: 'app-transactions-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    DataTableComponent,
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
  templateUrl: './transactions-dashboard.component.html',
  styleUrls: ['./transactions-dashboard.component.css']
})
export class TransactionsDashboardComponent implements OnInit {
  currentUser: any;
  transactions: CashTransaction[] = [];
  dateFrom: string = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  dateTo: string = new Date().toISOString().split('T')[0];
  loading = false;

  // DataTable configuration
  transactionsTableConfig!: DataTableConfig;
  transactionsTableData: CashTransaction[] = [];
  transactionsTablePagination: DataTablePagination | null = null;
  transactionsTableLoading = false;
  transactionsRealtimeUpdates$ = new Subject<any>();
  locations: any[] = [];
  selectedLocationId?: number;

  constructor(
    private transactionService: TransactionService,
    private authService: AuthService,
    private notification: NotificationService,
    @Inject(RealtimeService) private realtimeService: RealtimeService,
    private adminService: AdminService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.webSocketService.subscribeToSalaryAndTransactionChannels();
    this.initializeTransactionsTableConfig();
    this.setupRealtimeUpdates();
    this.loadLocations();
  }

  static getReferenceLabel(row: CashTransaction): string {
    if (!row?.reference_type || row?.reference_id == null) return '-';
    const type = (row.reference_type || '').split('\\').pop() || '';
    if (type === 'Sale') return `Sale #${row.reference_id}`;
    return `${type} #${row.reference_id}`;
  }

  initializeTransactionsTableConfig(): void {
    const getRef = TransactionsDashboardComponent.getReferenceLabel;
    this.transactionsTableConfig = {
      columns: [
        { key: 'created_at', label: 'Date', sortable: true, type: 'date', format: (v) => v ? new Date(v).toLocaleString() : '-' },
        { key: 'transaction_type', label: 'Type', sortable: true },
        { key: 'amount', label: 'Amount', sortable: true, type: 'currency', format: (v) => `₹${Number(v).toFixed(2)}` },
        { key: 'notes', label: 'Notes', sortable: false },
        { key: 'reference_id', label: 'Reference', sortable: false, format: (v, row) => getRef(row) },
        { key: 'category', label: 'Category', sortable: true },
        { key: 'cashRegister.location.name', label: 'Location', sortable: true }
      ],
      filters: [
        {
          key: 'transaction_type',
          label: 'Type',
          type: 'select',
          options: [
            { value: 'in', label: 'In' },
            { value: 'out', label: 'Out' }
          ]
        }
      ],
      actions: [],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No transactions found'
    };
  }

  setupRealtimeUpdates(): void {
    this.realtimeService.transactionUpdates$.subscribe(() => {
      this.transactionsRealtimeUpdates$.next({ type: 'refresh' });
    });
  }

  loadLocations(): void {
    if (this.isSuperAdmin()) {
      this.adminService.getLocations().subscribe({
        next: (locations) => {
          this.locations = locations;
        },
        error: (err) => console.error('Error loading locations:', err)
      });
    }
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  loadTransactionsTableData = async (params: DataTableParams): Promise<any> => {
    this.transactionsTableLoading = true;
    
    const requestParams: any = {
      page: params.page || 1,
      per_page: params.per_page || 10,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
      date_from: params.date_from || this.dateFrom,
      date_to: params.date_to || this.dateTo
    };

    if (this.isSuperAdmin()) {
      if (this.selectedLocationId !== undefined && this.selectedLocationId !== null) {
        requestParams.location_id = this.selectedLocationId;
      }
    } else {
      requestParams.location_id = this.currentUser?.location_id;
    }

    if (params['transaction_type']) {
      requestParams.transaction_type = params['transaction_type'];
    }

    return new Promise((resolve, reject) => {
      this.transactionService.getTransactions(requestParams).subscribe({
        next: (response: any) => {
          let data: CashTransaction[] = [];
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

          this.transactionsTableData = data;
          this.transactionsTablePagination = pagination;
          this.transactionsTableLoading = false;

          resolve({ data, pagination });
        },
        error: (err) => {
          console.error('Error loading transactions:', err);
          this.notification.error('Error loading transactions');
          this.transactionsTableLoading = false;
          reject(err);
        }
      });
    });
  }

  loadTransactions(): void {
    this.transactionsRealtimeUpdates$.next({ type: 'refresh' });
  }
}
