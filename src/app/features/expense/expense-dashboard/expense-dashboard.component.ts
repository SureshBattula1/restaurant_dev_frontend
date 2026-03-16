import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ExpenseService, Expense, ExpenseCategory } from '../../../core/services/expense.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableConfig, DataTableParams, DataTablePagination } from '../../../shared/interfaces/datatable-config.interface';
import { RealtimeService } from '../../../core/services/realtime.service';
import { Subject } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
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
import { BranchSelectorComponent } from '../../../shared/components/branch-selector/branch-selector.component';

@Component({
  selector: 'app-expense-dashboard',
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
    BranchSelectorComponent
  ],
  templateUrl: './expense-dashboard.component.html',
  styleUrls: ['./expense-dashboard.component.css']
})
export class ExpenseDashboardComponent implements OnInit {
  currentUser: any;
  activeTab: 'expenses' | 'categories' = 'expenses';
  
  expenses: Expense[] = [];
  categories: ExpenseCategory[] = [];
  locations: any[] = [];
  selectedLocationId?: number;
  
  // DataTable configuration
  expensesTableConfig!: DataTableConfig;
  expensesTableData: Expense[] = [];
  expensesTablePagination: DataTablePagination | null = null;
  expensesTableLoading = false;
  expensesRealtimeUpdates$ = new Subject<any>();
  
  expenseForm: FormGroup;
  categoryForm: FormGroup;
  
  showExpenseModal = false;
  showCategoryModal = false;
  selectedExpense: Expense | null = null;
  selectedCategory: ExpenseCategory | null = null;
  dateFrom: string = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  dateTo: string = new Date().toISOString().split('T')[0];

  constructor(
    private fb: FormBuilder,
    private expenseService: ExpenseService,
    private authService: AuthService,
    private router: Router,
    private notification: NotificationService,
    @Inject(RealtimeService) private realtimeService: RealtimeService,
    private adminService: AdminService
  ) {
    this.expenseForm = this.fb.group({
      location_id: [null],
      category_id: [null, Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      description: ['', Validators.required],
      expense_date: [new Date().toISOString().split('T')[0], Validators.required],
      payment_method: ['cash', Validators.required],
      reference_number: ['']
    });

    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadLocations();
    this.initializeExpensesTableConfig();
    this.setupRealtimeUpdates();
    this.loadExpenses();
    this.loadCategories();
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  loadLocations(): void {
    if (this.isSuperAdmin()) {
      this.adminService.getLocations().subscribe({
        next: (locations) => this.locations = locations,
        error: (err) => console.error('Error loading locations:', err)
      });
    }
  }

  onBranchChange(): void {
    this.expensesRealtimeUpdates$.next({ type: 'refresh' });
  }

  initializeExpensesTableConfig(): void {
    const columns: any[] = [
      { key: 'expense_date', label: 'Date', sortable: true, type: 'date' },
      { key: 'category.name', label: 'Category', sortable: true },
        { key: 'description', label: 'Description', sortable: true },
        { key: 'amount', label: 'Amount', sortable: true, type: 'currency', format: (v: any) => `₹${Number(v).toFixed(2)}` },
        { key: 'payment_method', label: 'Payment Method', sortable: true },
        { key: 'reference_number', label: 'Reference', sortable: false }
      ];
    if (this.isSuperAdmin()) {
      columns.splice(2, 0, { key: 'location.name', label: 'Branch', sortable: true });
    }
    this.expensesTableConfig = {
      columns,
      filters: [
        {
          key: 'category_id',
          label: 'Category',
          type: 'select',
          options: []
        },
        {
          key: 'payment_method',
          label: 'Payment Method',
          type: 'select',
          options: [
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
            { value: 'bank_transfer', label: 'Bank Transfer' },
            { value: 'online', label: 'Online' }
          ]
        }
      ],
      actions: [
        {
          label: 'Edit',
          icon: 'edit',
          color: 'primary',
          action: (row) => this.openExpenseModal(row),
          tooltip: 'Edit expense'
        },
        {
          label: 'Delete',
          icon: 'delete',
          color: 'warn',
          action: (row) => this.deleteExpense(row),
          tooltip: 'Delete expense'
        }
      ],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No expenses found'
    };
  }

  setupRealtimeUpdates(): void {
    this.realtimeService.expenseUpdates$.subscribe(() => {
      this.expensesRealtimeUpdates$.next({ type: 'refresh' });
    });
  }

  loadExpensesTableData = async (params: DataTableParams): Promise<any> => {
    this.expensesTableLoading = true;
    
    const requestParams: any = {
      page: params.page || 1,
      per_page: params.per_page || 10,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
      date_from: params.date_from || this.dateFrom,
      date_to: params.date_to || this.dateTo
    };

    if (params['category_id']) {
      requestParams.category_id = params['category_id'];
    }

    if (params['payment_method']) {
      requestParams.payment_method = params['payment_method'];
    }

    if (this.isSuperAdmin()) {
      if (this.selectedLocationId !== undefined && this.selectedLocationId !== null) {
        requestParams.location_id = this.selectedLocationId;
      }
    } else {
      requestParams.location_id = this.currentUser?.location_id;
    }

    return new Promise((resolve, reject) => {
      this.expenseService.getExpenses(requestParams).subscribe({
        next: (response: any) => {
          let data: Expense[] = [];
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

          this.expensesTableData = data;
          this.expensesTablePagination = pagination;
          this.expensesTableLoading = false;

          resolve({ data, pagination });
        },
        error: (err) => {
          console.error('Error loading expenses:', err);
          this.notification.error('Error loading expenses');
          this.expensesTableLoading = false;
          reject(err);
        }
      });
    });
  }

  switchTab(tab: string): void {
    if (tab === 'expenses' || tab === 'categories') {
      this.activeTab = tab as 'expenses' | 'categories';
    }
  }

  loadExpenses(): void {
    // DataTable handles loading now
    // This method is kept for backward compatibility
  }

  loadCategories(): void {
    this.expenseService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        // Update filter options
        if (this.expensesTableConfig && this.expensesTableConfig.filters) {
          const categoryFilter = this.expensesTableConfig.filters.find(f => f.key === 'category_id');
          if (categoryFilter) {
            categoryFilter.options = categories.map(cat => ({ value: cat.id, label: cat.name }));
          }
        }
      },
      error: (err) => console.error('Error loading categories:', err)
    });
  }

  filterExpenses(): void {
    this.expensesRealtimeUpdates$.next({ type: 'refresh' });
  }

  openExpenseModal(expense?: any): void {
    this.selectedExpense = expense || null;
    const locControl = this.expenseForm.get('location_id');
    if (this.isSuperAdmin()) {
      locControl?.setValidators(Validators.required);
    } else {
      locControl?.clearValidators();
    }
    locControl?.updateValueAndValidity();

    if (expense) {
      this.expenseForm.patchValue({
        location_id: expense.location_id ?? this.selectedLocationId,
        category_id: expense.category_id,
        amount: expense.amount,
        description: expense.description,
        expense_date: expense.expense_date,
        payment_method: expense.payment_method,
        reference_number: expense.reference_number || ''
      });
    } else {
      this.expenseForm.reset({
        location_id: this.selectedLocationId ?? null,
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash'
      });
    }
    this.showExpenseModal = true;
  }

  saveExpense(): void {
    if (this.expenseForm.invalid) return;

    const expenseData = { ...this.expenseForm.value };
    if (this.isSuperAdmin()) {
      if (!expenseData.location_id) {
        this.notification.error('Please select a branch');
        return;
      }
    } else {
      expenseData.location_id = this.currentUser?.location_id;
    }

    if (this.selectedExpense) {
      this.expenseService.updateExpense(this.selectedExpense.id, expenseData).subscribe({
        next: (response: any) => {
          this.notification.success('Expense updated successfully');
          this.expensesRealtimeUpdates$.next({ type: 'updated', data: (response as any).expense || response });
          this.showExpenseModal = false;
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error updating expense');
        }
      });
    } else {
      this.expenseService.createExpense(expenseData).subscribe({
        next: (response: any) => {
          this.notification.success('Expense recorded successfully');
          this.expensesRealtimeUpdates$.next({ type: 'created', data: (response as any).expense || response });
          this.showExpenseModal = false;
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error recording expense');
        }
      });
    }
  }

  deleteExpense(expense: Expense): void {
    if (confirm(`Delete expense: ${expense.description}?`)) {
      this.expenseService.deleteExpense(expense.id).subscribe({
        next: () => {
          this.notification.success('Expense deleted successfully');
          this.expensesRealtimeUpdates$.next({ type: 'deleted', data: { id: expense.id } });
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error deleting expense');
        }
      });
    }
  }

  openCategoryModal(category?: ExpenseCategory): void {
    this.selectedCategory = category || null;
    if (category) {
      this.categoryForm.patchValue(category);
    }
    this.showCategoryModal = true;
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) return;

    const categoryData = this.categoryForm.value;
    if (this.selectedCategory) {
      this.expenseService.updateCategory(this.selectedCategory.id, categoryData).subscribe({
        next: () => {
          this.notification.success('Category updated successfully');
          this.loadCategories();
          this.showCategoryModal = false;
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error updating category');
        }
      });
    } else {
      this.expenseService.createCategory(categoryData).subscribe({
        next: () => {
          this.notification.success('Category created successfully');
          this.loadCategories();
          this.showCategoryModal = false;
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error creating category');
        }
      });
    }
  }

  deleteCategory(category: ExpenseCategory): void {
    if (confirm(`Delete category: ${category.name}?`)) {
      this.expenseService.deleteCategory(category.id).subscribe({
        next: () => {
          this.notification.success('Category deleted successfully');
          this.loadCategories();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error deleting category');
        }
      });
    }
  }

  get totalExpenses(): number {
    return this.expensesTableData.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  }

  closeExpenseModal(): void {
    this.showExpenseModal = false;
  }

  closeCategoryModal(): void {
    this.showCategoryModal = false;
  }

}

