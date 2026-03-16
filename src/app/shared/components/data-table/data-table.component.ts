import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { DataTableConfig, DataTableColumn, DataTableFilter, DataTableAction, DataTableParams, DataTablePagination } from '../../interfaces/datatable-config.interface';

/** Maps Material/other icon names to Bootstrap Icons (bi-*) for consistent display across all datatables */
const ICON_MAP: Record<string, string> = {
  // Material → Bootstrap
  visibility: 'eye',
  edit: 'pencil',
  delete: 'trash',
  send: 'send',
  link: 'link-45deg',
  check_circle: 'check-circle',
  undo: 'arrow-counterclockwise',
  restore: 'arrow-counterclockwise',
  inventory: 'box',
  cancel: 'x-circle',
  table_chart: 'file-earmark-excel',
  picture_as_pdf: 'file-earmark-pdf',
  key: 'key',
  check: 'check-circle',
  close: 'x',
  logout: 'box-arrow-right'
};
import { DataTableService } from '../../../core/services/datatable.service';
import { ExportService } from '../../../core/services/export.service';
import { LoaderComponent } from '../loader/loader.component';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LoaderComponent
  ],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.css']
})
export class DataTableComponent implements OnInit, OnDestroy {
  @Input() config!: DataTableConfig;
  @Input() data: any[] = [];
  @Input() loading: boolean = false;
  @Input() pagination: DataTablePagination | null = null;
  @Input() loadDataFn?: (params: DataTableParams) => Promise<any>;
  @Input() enableRealtime: boolean = false;
  @Input() realtimeUpdates$?: Subject<any>;

  @Output() rowAction = new EventEmitter<{ action: string; row: any }>();
  @Output() dataChange = new EventEmitter<any[]>();
  @Output() paramsChange = new EventEmitter<DataTableParams>();

  displayedColumns: string[] = [];
  dataSource: any[] = [];
  
  // Pagination state
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [5, 10, 25, 50, 100];
  
  // Sorting state
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Export menu state
  toggleExportMenu: boolean = false;
  filterForm!: FormGroup;
  searchControl!: any;
  dateFromControl!: any;
  dateToControl!: any;
  
  // Expandable rows
  expandedRows = new Set<any>();
  groupedData: any[] = [];
  
  currentParams: DataTableParams = {};
  private subscriptions: Subscription[] = [];
  private searchSubject = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private dataTableService: DataTableService,
    private exportService: ExportService,
    private cdr: ChangeDetectorRef
  ) {
    // Initialize form controls after FormBuilder is available
    this.searchControl = this.fb.control('');
    this.dateFromControl = this.fb.control<Date | null>(null);
    this.dateToControl = this.fb.control<Date | null>(null);
    this.filterForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.initializeColumns();
    this.initializeFilters();
    this.setupSearch();
    this.setupRealtime();
    this.loadData();
    this.setupClickOutside();
  }

  private setupClickOutside(): void {
    // Close export menu when clicking outside
    document.addEventListener('click', (event: any) => {
      if (!event.target.closest('.export-section')) {
        this.toggleExportMenu = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeColumns(): void {
    this.displayedColumns = this.config.columns
      .filter(col => !col.hidden)
      .map(col => col.key);
    
    // Add expand column if expandable is enabled
    if (this.config.expandable) {
      this.displayedColumns.unshift('expand');
    }
    
    if (this.config.actions && this.config.actions.length > 0) {
      this.displayedColumns.push('actions');
    }
  }

  private initializeFilters(): void {
    if (this.config.filters) {
      this.config.filters.forEach(filter => {
        const defaultValue = (filter as any).defaultValue ?? null;
        this.filterForm.addControl(
          filter.key,
          this.fb.control(defaultValue)
        );
        if (defaultValue !== null && defaultValue !== undefined && defaultValue !== '') {
          this.currentParams[filter.key] = defaultValue;
        }
      });
    }
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.currentParams.search = searchTerm;
      this.loadData();
    });
  }

  private setupRealtime(): void {
    if (this.enableRealtime && this.realtimeUpdates$) {
      const sub = this.realtimeUpdates$.subscribe((update: any) => {
        // If it's a refresh triggered by location change, reset to page 1
        if (update && update.type === 'refresh') {
          this.currentParams.page = 1;
          // Clear any existing filters that might conflict
          if (update.location_id !== undefined) {
            // Location filter is handled by the parent component's loadDataFn
          }
        }
        this.loadData();
      });
      this.subscriptions.push(sub);
    }
  }

  onSearchChange(value: string): void {
    const searchValue = value || '';
    this.searchSubject.next(searchValue);
    // Also clear search from params if empty
    if (!searchValue) {
      delete this.currentParams.search;
    }
  }

  onFilterChange(): void {
    const filterValues = this.filterForm.value;
    Object.keys(filterValues).forEach(key => {
      if (filterValues[key] !== null && filterValues[key] !== undefined && filterValues[key] !== '') {
        this.currentParams[key] = filterValues[key];
      } else {
        delete this.currentParams[key];
      }
    });
    this.currentParams.page = 1;
    this.loadData();
  }

  onDateRangeChange(): void {
    const from = this.dateFromControl.value;
    const to = this.dateToControl.value;
    
    if (from) {
      this.currentParams.date_from = this.dataTableService.formatDateForAPI(from);
    } else {
      delete this.currentParams.date_from;
    }
    
    if (to) {
      this.currentParams.date_to = this.dataTableService.formatDateForAPI(to);
    } else {
      delete this.currentParams.date_to;
    }
    
    this.currentParams.page = 1;
    this.loadData();
  }

  onSortChange(column: string): void {
    if (this.sortColumn === column) {
      // Toggle direction if same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    if (this.sortColumn) {
      this.currentParams.sort_by = this.sortColumn;
      this.currentParams.sort_dir = this.sortDirection;
    } else {
      delete this.currentParams.sort_by;
      delete this.currentParams.sort_dir;
    }
    this.currentParams.page = 1;
    this.currentPage = 1;
    this.loadData();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.currentParams.page = page;
    this.loadData();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentParams.per_page = size;
    this.currentParams.page = 1;
    this.currentPage = 1;
    this.loadData();
  }

  loadData(): void {
    if (this.loadDataFn) {
      this.loading = true;
      this.loadDataFn(this.currentParams).then(response => {
        if (response && response.data) {
          this.data = response.data;
          if (response.pagination) {
            this.pagination = response.pagination;
          }
        } else if (Array.isArray(response)) {
          this.data = response;
        }
        this.updateDataSource();
        this.paramsChange.emit(this.currentParams);
        this.dataChange.emit(this.data);
        this.loading = false;
        this.cdr.detectChanges();
      }).catch(error => {
        console.error('Error loading data:', error);
        this.loading = false;
        this.cdr.detectChanges();
      });
    } else {
      this.updateDataSource();
    }
  }

  private updateDataSource(): void {
    // Group data if groupBy is configured
    if (this.config.groupBy && this.data.length > 0) {
      this.groupData();
    } else {
      this.dataSource = this.data;
    }
    
    if (this.pagination) {
      this.currentPage = this.pagination.page;
      this.pageSize = this.pagination.per_page;
    }
  }

  private groupData(): void {
    const groups = new Map<string, any[]>();
    
    this.data.forEach(row => {
      let groupKey: string;
      if (typeof this.config.groupBy === 'function') {
        groupKey = this.config.groupBy(row);
      } else {
        // Group by date or other field
        const date = new Date(row[this.config.groupBy!] || row.created_at);
        groupKey = date.toLocaleDateString() + ' - ' + (row.user?.name || 'Unknown');
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    });
    
    // Convert to grouped structure - always create groups for better organization
    this.groupedData = Array.from(groups.entries()).map(([key, items]) => {
      // Sort items by created_at within group
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Calculate totals for the group
      const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const totalValue = items.reduce((sum, item) => {
        return sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0));
      }, 0);
      
      if (items.length === 1) {
        // Single item, but still allow expansion for consistency
        return {
          ...items[0],
          _isGroup: true, // Allow expansion even for single items
          _groupKey: key,
          _groupItems: [items[0]],
          _groupCount: 1,
          _totalQuantity: Number(items[0].quantity || 0),
          _totalValue: Number(items[0].quantity || 0) * Number(items[0].unit_cost || 0)
        };
      }
      
      // Multiple items, create group
      return {
        _isGroup: true,
        _groupKey: key,
        _groupItems: items,
        _groupCount: items.length,
        _totalQuantity: totalQuantity,
        _totalValue: totalValue,
        // Show summary from first item
        created_at: items[0]?.created_at,
        user: items[0]?.user,
        location: items[0]?.location,
        // For mixed types, show the first one (will be overridden by format function)
        transaction_type: items[0]?.transaction_type,
        id: items[0]?.id // For sorting
      };
    });
    
    // Sort groups by created_at descending
    this.groupedData.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
    
    this.dataSource = this.groupedData;
  }

  toggleRow(row: any): void {
    if (this.expandedRows.has(row)) {
      this.expandedRows.delete(row);
    } else {
      this.expandedRows.add(row);
    }
  }

  isRowExpanded(row: any): boolean {
    return this.expandedRows.has(row);
  }

  getGroupItems(row: any): any[] {
    return row._groupItems || [];
  }

  handleAction(action: DataTableAction, row: any): void {
    // Condition is already checked in template with *ngIf, but keep as safety check
    if (action.condition && !action.condition(row)) {
      console.warn('Action condition not met for:', action.label, row);
      return;
    }
    this.rowAction.emit({ action: action.label, row });
    action.action(row);
  }

  exportToCSV(): void {
    const columns = this.config.columns.filter(col => !col.hidden).map(col => ({ key: col.key, label: col.label }));
    const filename = this.config.emptyMessage?.replace('No ', '').replace(' found', '') || 'export';
    this.exportService.exportToCSV(this.data, columns, filename);
  }

  exportToExcel(): void {
    const columns = this.config.columns.filter(col => !col.hidden).map(col => ({ key: col.key, label: col.label }));
    const filename = this.config.emptyMessage?.replace('No ', '').replace(' found', '') || 'export';
    this.exportService.exportToExcel(this.data, columns, { filename });
  }

  exportToPDF(): void {
    const columns = this.config.columns.filter(col => !col.hidden).map(col => ({ key: col.key, label: col.label }));
    const filename = this.config.emptyMessage?.replace('No ', '').replace(' found', '') || 'export';
    this.exportService.exportToPDF(this.data, columns, { filename });
  }

  clearFilters(): void {
    // Reset all filter form controls
    this.filterForm.reset();
    
    // Reset search control and clear search from params
    this.searchControl.setValue('');
    this.searchSubject.next('');
    
    // Reset date controls
    this.dateFromControl.setValue(null);
    this.dateToControl.setValue(null);
    
    // Reset all params except pagination settings
    this.currentParams = { 
      page: 1, 
      per_page: this.currentParams.per_page || 10 
    };
    
    // Clear search from params
    delete this.currentParams.search;
    delete this.currentParams.date_from;
    delete this.currentParams.date_to;
    
    this.loadData();
  }

  getColumnValue(row: any, column: DataTableColumn): any {
    const value = this.getNestedValue(row, column.key);
    if (column.format) {
      return column.format(value, row);
    }
    return value;
  }

  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return null;
    
    return path.split('.').reduce((current, prop) => {
      if (current && typeof current === 'object') {
        return current[prop] !== undefined ? current[prop] : null;
      }
      return null;
    }, obj);
  }

  getEmployeeName(row: any): string {
    if (row.employee?.person) {
      const firstName = row.employee.person.first_name || '';
      const lastName = row.employee.person.last_name || '';
      return `${firstName} ${lastName}`.trim() || 'N/A';
    }
    return 'N/A';
  }

  get visibleColumns(): DataTableColumn[] {
    return this.config.columns.filter(col => !col.hidden);
  }

  hasDateRangeFilter(): boolean {
    return this.config.filters ? this.config.filters.some(f => f.type === 'dateRange') : false;
  }

  getStatusClass(status: any): string {
    if (!status) return 'inactive';
    const statusStr = String(status).toLowerCase();
    if (statusStr === 'mixed') {
      return 'pending'; // Use pending style for mixed types
    }
    if (['active', 'present', 'approved', 'received', 'completed', 'paid', 'in'].includes(statusStr)) {
      return 'active';
    }
    if (['inactive', 'absent', 'rejected', 'cancelled', 'out'].includes(statusStr)) {
      return 'inactive';
    }
    if (['pending', 'partial', 'late', 'half_day'].includes(statusStr)) {
      return 'pending';
    }
    return 'inactive';
  }

  /** Returns Bootstrap Icons class name for action icons (resolves Material/other names) */
  getActionIcon(action: DataTableAction): string {
    if (!action.icon) return '';
    return ICON_MAP[action.icon] || action.icon;
  }

  getSortHeader(column: DataTableColumn): string {
    return column.sortable ? column.key : '';
  }

  getSortIcon(column: DataTableColumn): string {
    if (!column.sortable || this.sortColumn !== column.key) {
      return 'bi-arrow-down-up';
    }
    return this.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
  }

  isColumnSorted(column: DataTableColumn): boolean {
    return this.sortColumn === column.key;
  }

  formatCurrency(value: any): string {
    if (!value) return '-';
    return '₹' + Number(value).toFixed(2);
  }

  formatTotal(quantity: any, unitCost: any): string {
    if (!unitCost) return '-';
    return '₹' + (Number(quantity) * Number(unitCost)).toFixed(2);
  }

  formatStatusValue(value: any): string {
    if (!value) return '-';
    const statusStr = String(value).toLowerCase();
    if (statusStr === 'in') return 'Stock In';
    if (statusStr === 'out') return 'Stock Out';
    if (statusStr === 'mixed') return 'Mixed';
    return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
  }

  getPageNumbers(): number[] {
    if (!this.pagination) return [];
    const totalPages = this.getTotalPages();
    const current = this.currentPage;
    const pages: number[] = [];
    
    // Show max 5 page numbers
    let start = Math.max(1, current - 2);
    let end = Math.min(totalPages, start + 4);
    
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  getTotalPages(): number {
    if (!this.pagination) return 1;
    return Math.ceil(this.pagination.total / this.pageSize);
  }

  // Expose Math to template
  Math = Math;
}
