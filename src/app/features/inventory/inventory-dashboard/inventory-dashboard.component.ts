import { Component, OnInit, OnDestroy, ChangeDetectorRef, Inject, DoCheck } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { MenuItemService, MenuItem } from '../../../core/services/menu-item.service';
import { CategoryService } from '../../../core/services/category.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableConfig, DataTableParams, DataTablePagination } from '../../../shared/interfaces/datatable-config.interface';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AdminService, Location } from '../../../core/services/admin.service';
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
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

@Component({
  selector: 'app-inventory-dashboard',
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
    LoaderComponent
  ],
  templateUrl: './inventory-dashboard.component.html',
  styleUrls: ['./inventory-dashboard.component.css']
})
export class InventoryDashboardComponent implements OnInit, OnDestroy, DoCheck {
  currentUser: any;
  activeTab: 'items' | 'stock' | 'menu-items' | 'low-stock' = 'items';
  items: any[] = [];
  allItems: any[] = [];
  menuItems: MenuItem[] = [];
  categories: any[] = [];
  lowStockItems: any[] = [];
  locations: Location[] = [];
  selectedLocationId?: number;

  itemForm: FormGroup;
  menuItemForm: FormGroup;
  stockInForm: FormGroup;
  stockOutForm: FormGroup;
  stockTransferForm: FormGroup;
  stockAdjustForm: FormGroup;
  categoryForm: FormGroup;

  showItemModal = false;
  showMenuItemModal = false;
  showStockInModal = false;
  showStockOutModal = false;
  showStockTransferModal = false;
  showStockAdjustModal = false;
  showCategoryModal = false;
  
  savingStockIn = false;
  savingStockOut = false;
  savingStockTransfer = false;
  savingStockAdjust = false;

  selectedItem: any = null;
  selectedMenuItem: MenuItem | null = null;

  itemsTableConfig!: DataTableConfig;
  itemsTableData: any[] = [];
  itemsTablePagination: DataTablePagination | null = null;
  itemsTableLoading = false;
  itemsRealtimeUpdates$ = new Subject<any>();

  menuItemsTableConfig!: DataTableConfig;
  menuItemsTableData: MenuItem[] = [];
  menuItemsTablePagination: DataTablePagination | null = null;
  menuItemsTableLoading = false;
  menuItemsRealtimeUpdates$ = new Subject<any>();

  filteredItemsForStock: any[] = [];
  stockInAutocompleteStates: { [key: number]: { query: string; showDropdown: boolean; filteredItems: any[] } } = {};
  stockOutAutocompleteStates: { [key: number]: { query: string; showDropdown: boolean; filteredItems: any[] } } = {};
  transferAutocompleteState: { query: string; showDropdown: boolean; filteredItems: any[] } = { query: '', showDropdown: false, filteredItems: [] };
  adjustAutocompleteState: { query: string; showDropdown: boolean; filteredItems: any[] } = { query: '', showDropdown: false, filteredItems: [] };
  // Cache previous stock and cost for Stock In rows
  stockInPreviousQty: { [key: number]: number } = {};
  stockInPreviousCost: { [key: number]: number } = {};
  // Cache previous stock for Stock Out rows
  stockOutPreviousQty: { [key: number]: number } = {};
  // Previous stock for Transfer and Adjust
  transferPreviousQty: number | null = null;
  adjustPreviousQty: number | null = null;

  // Stock transactions listing
  stockTransactions: any[] = [];
  selectedStockTransactionsItemId: number | null = null;
  stockTransactionsLoading = false;
  stockTransactionsPage = 1;
  stockTransactionsPerPage = 10;
  stockTransactionsTotal = 0;
  stockTransactionsLastPage = 1;

  // Stock transaction edit
  stockTransactionForm: FormGroup;
  showStockTransactionModal = false;
  editingStockTransaction: any = null;

  // Menu item image upload (for menu card - not shown in listing)
  menuItemImageFile: File | null = null;
  menuItemImagePreviewUrl: string | null = null;
  menuItemImageRemoved = false; // User explicitly removed image – store null on save

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private menuItemService: MenuItemService,
    private categoryService: CategoryService,
    private authService: AuthService,
    private router: Router,
    private notification: NotificationService,
    @Inject(RealtimeService) private realtimeService: RealtimeService,
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {
    this.itemForm = this.fb.group({
      name: ['', Validators.required],
      sku: ['', Validators.required],
      barcode: [''],
      category_id: [null],
      unit: ['', Validators.required],
      cost_price: [0, [Validators.required, Validators.min(0)]],
      track_quantity: [true],
      low_stock_threshold: [0, Validators.min(0)],
      expiry_tracking: [false],
      description: [''],
      location_id: [null]
    });

    this.menuItemForm = this.fb.group({
      name: ['', Validators.required],
      sku: ['', Validators.required],
      barcode: [''],
      category_id: [null],
      selling_price: [0, [Validators.required, Validators.min(0)]],
      tax_rate: [0, [Validators.min(0), Validators.max(100)]],
      description: [''],
      status: ['active'], // Add status field to form
      location_ids: [[]],
      variants: this.fb.array([])
    });

    this.stockInForm = this.fb.group({
      location_id: [null, Validators.required],
      items: this.fb.array([]),
      notes: ['']
    });

    this.stockOutForm = this.fb.group({
      location_id: [null, Validators.required],
      items: this.fb.array([]),
      notes: ['']
    });

    this.stockTransferForm = this.fb.group({
      item_id: [null, Validators.required],
      from_location_id: [null, Validators.required],
      to_location_id: [null, Validators.required],
      quantity: [0, [Validators.required, Validators.min(0.01)]],
      reason: ['']
    });

    this.stockAdjustForm = this.fb.group({
      item_id: [null, Validators.required],
      quantity: [0, [Validators.required]],
      notes: ['', Validators.required]
    });

    this.stockTransactionForm = this.fb.group({
      quantity: [0, [Validators.required, Validators.min(0.01)]],
      unit_cost: [0, [Validators.min(0)]],
      notes: ['']
    });

    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      slug: [''],
      description: ['']
    });

    this.currentUser = this.authService.getCurrentUser();
  }

  ngOnInit(): void {
    this.initializeItemsTableConfig();
    this.initializeMenuItemsTableConfig();
    this.setupRealtimeUpdates();
    this.loadItems(); // Load items for table (with pagination)
    this.loadAllItemsForAutocomplete(); // Load ALL items for autocomplete
    this.loadMenuItems();
    this.loadLowStockItems();
    this.loadCategories();
    this.loadLocations();
    this.setupRealtimeSubscriptions();
    this.loadStockTransactions();
    this.filteredItemsForStock = this.items;
  }

  // Check if any modal is open
  get isAnyModalOpen(): boolean {
    return this.showItemModal || 
           this.showMenuItemModal || 
           this.showCategoryModal || 
           this.showStockInModal || 
           this.showStockOutModal || 
           this.showStockTransferModal || 
           this.showStockAdjustModal ||
           this.showStockTransactionModal;
  }

  // Helper method to toggle body scroll lock
  private toggleBodyScroll(lock: boolean): void {
    if (typeof document !== 'undefined') {
      if (lock) {
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
      } else {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
      }
    }
  }

  // Update body scroll lock when modals open/close
  ngDoCheck(): void {
    this.toggleBodyScroll(this.isAnyModalOpen);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Ensure body scroll is restored when component is destroyed
    this.toggleBodyScroll(false);
  }

  setupRealtimeSubscriptions(): void {
    const inventorySub = this.realtimeService.inventoryUpdates$.subscribe(update => {
      if (update.type === 'low_stock') {
        this.notification.warning(`Low stock alert: ${update.item_name}`);
        this.loadLowStockItems();
      }
      this.loadItems();
      this.loadAllItemsForAutocomplete(); // Reload all items for autocomplete
    });

    this.subscriptions.push(inventorySub);
  }

  loadLocations(): void {
    if (this.authService.isSuperAdmin()) {
      this.adminService.getLocations().subscribe({
        next: (locations) => {
          this.locations = locations;
          if (locations?.length > 0 && this.selectedLocationId === undefined && !this.currentUser?.location_id) {
            this.selectedLocationId = locations[0].id;
            this.refreshInventoryData();
          }
        },
        error: (err) => {
          console.error('Error loading locations:', err);
          this.locations = this.currentUser?.location_id ? [
            { id: this.currentUser.location_id, name: this.currentUser.location?.name || 'Current Location', code: '', status: 'active' }
          ] : [];
        }
      });
    } else {
      this.locations = this.currentUser?.location_id ? [
        { id: this.currentUser.location_id, name: this.currentUser.location?.name || 'Current Location', code: '', status: 'active' }
      ] : [];
    }
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  getSelectedLocationId(): number {
    if (this.isSuperAdmin()) {
      return this.selectedLocationId || this.stockInForm.get('location_id')?.value || this.currentUser?.location_id;
    }
    return this.currentUser?.location_id;
  }

  getSelectedBranchName(): string | null {
    const id = this.getCurrentLocationId();
    if (!id) return null;
    const loc = this.locations?.find(l => l.id === id);
    return loc?.name ?? null;
  }

  getCurrentLocationId(): number | null {
    if (this.isSuperAdmin()) {
      const id = this.selectedLocationId ?? this.stockInForm.get('location_id')?.value ?? this.currentUser?.location_id;
      if (id) return id;
      if (this.locations?.length > 0) return this.locations[0].id;
      return null;
    }
    return this.currentUser?.location_id ?? null;
  }

  /** Location for Stock In form (uses form value so super admin branch selection is respected) */
  getStockInLocationId(_index?: number): number | null {
    const id = this.stockInForm.get('location_id')?.value ?? this.getCurrentLocationId();
    return id ? Number(id) : null;
  }

  /** Location for Stock Out form (uses form value so super admin branch selection is respected) */
  getStockOutLocationId(_index?: number): number | null {
    const id = this.stockOutForm.get('location_id')?.value ?? this.getCurrentLocationId();
    return id ? Number(id) : null;
  }

  onLocationChange(): void {
    const stockInLocationId = this.stockInForm.get('location_id')?.value;
    const stockOutLocationId = this.stockOutForm.get('location_id')?.value;
    
    if (this.isSuperAdmin()) {
      this.selectedLocationId = stockInLocationId || stockOutLocationId || this.currentUser?.location_id;
      this.refreshInventoryData();
    }
  }

  onInventoryLocationChange(): void {
    if (this.isSuperAdmin()) {
      this.refreshInventoryData();
    }
  }

  private refreshInventoryData(): void {
    this.loadItems();
    this.loadAllItemsForAutocomplete();
    this.loadLowStockItems();
    this.loadStockTransactions();
    // Trigger datatable refresh (uses getCurrentLocationId() so branch is correct)
    this.itemsRealtimeUpdates$.next({ type: 'refresh', location_id: this.selectedLocationId });
    this.menuItemsRealtimeUpdates$.next({ type: 'refresh', location_id: this.selectedLocationId });
    // Explicitly reload table data so Items and Menu Items tables update for the new branch
    const baseParams = { page: 1, per_page: 10, search: '', sort_by: 'name', sort_dir: 'asc' as const };
    this.loadItemsTableData({ ...baseParams, filters: [] }).catch(() => {});
    this.loadMenuItemsTableData({ ...baseParams, filters: [] }).catch(() => {});
  }

  // Recipes feature disabled: no recipeIngredients getter

  get stockInItems(): FormArray {
    return this.stockInForm.get('items') as FormArray;
  }

  get stockOutItems(): FormArray {
    return this.stockOutForm.get('items') as FormArray;
  }

  get variantsFormArray(): FormArray<FormGroup> {
    return this.menuItemForm.get('variants') as FormArray<FormGroup>;
  }

  itemSearchQuery: string = '';

  loadItems(): void {
    const params: any = {};
    const locationId = this.getCurrentLocationId();
    if (locationId) {
      params.location_id = locationId;
    }
    this.inventoryService.getItems(params).subscribe({
      next: (response) => {
        this.items = response.data || response;
        this.filteredItemsForStock = this.items;
      },
      error: (err) => console.error('Error loading items:', err)
    });
  }

  // Load all items for autocomplete (without pagination limits)
  loadAllItemsForAutocomplete(): void {
    const params: any = {
      per_page: 1000, // Load a large number of items
      page: 1
    };
    
    // Don't filter by location for autocomplete - items are global
    // Only quantities are location-specific
    
    this.inventoryService.getItems(params).subscribe({
      next: (response) => {
        let items: any[] = [];
        
        // Handle paginated response
        if (response.data && Array.isArray(response.data)) {
          items = response.data;
        } else if (Array.isArray(response)) {
          items = response;
        }
        
        this.allItems = items;
        
        // If there are more pages, load them all
        if (response.pagination && response.pagination.last_page > 1) {
          this.loadRemainingItemPages(response.pagination.last_page, items);
        } else {
          console.log('All items loaded for autocomplete:', this.allItems.length);
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Error loading items for autocomplete:', err);
        this.allItems = [];
      }
    });
  }

  // Load remaining pages of items
  loadRemainingItemPages(totalPages: number, currentItems: any[]): void {
    const requests = [];
    for (let page = 2; page <= totalPages; page++) {
      requests.push(
        this.inventoryService.getItems({ per_page: 1000, page }).toPromise()
      );
    }
    
    Promise.all(requests).then((responses: any[]) => {
      let allItems = [...currentItems];
      responses.forEach(response => {
        if (response.data && Array.isArray(response.data)) {
          allItems = allItems.concat(response.data);
        } else if (Array.isArray(response)) {
          allItems = allItems.concat(response);
        }
      });
      this.allItems = allItems;
      console.log('All items loaded for autocomplete:', this.allItems.length);
      this.cdr.markForCheck();
    }).catch(err => {
      console.error('Error loading additional item pages:', err);
      // Still use what we have
      this.allItems = currentItems;
      this.cdr.markForCheck();
    });
  }

  loadMenuItems(): void {
    this.menuItemService.getMenuItems().subscribe({
      next: (response: any) => {
        console.log('Menu items response:', response); // Debug log
        if (response && response.data && Array.isArray(response.data)) {
          this.menuItems = response.data;
        } else if (Array.isArray(response)) {
          this.menuItems = response;
        } else {
          this.menuItems = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading menu items:', err);
        this.menuItems = [];
        this.cdr.markForCheck();
      }
    });
  }

  loadLowStockItems(): void {
    const locationId = this.getCurrentLocationId();
    const params = locationId ? { location_id: locationId } : {};
    this.inventoryService.getLowStockItems(params).subscribe({
      next: (items) => {
        this.lowStockItems = items || [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading low stock items:', err);
        this.lowStockItems = [];
        this.cdr.markForCheck();
      }
    });
  }

  // Recipes feature disabled

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories: any[]) => {
        this.categories = categories;
        this.updateCategoryFilters();
      },
      error: (err: any) => console.error('Error loading categories:', err)
    });
  }

  updateCategoryFilters(): void {
    if (this.itemsTableConfig && this.itemsTableConfig.filters) {
      const categoryFilter = this.itemsTableConfig.filters.find(f => f.key === 'category_id');
      if (categoryFilter) {
        categoryFilter.options = this.categories.map(cat => ({ value: cat.id, label: cat.name }));
      }
    }
    if (this.menuItemsTableConfig && this.menuItemsTableConfig.filters) {
      const categoryFilter = this.menuItemsTableConfig.filters.find(f => f.key === 'category_id');
      if (categoryFilter) {
        categoryFilter.options = this.categories.map(cat => ({ value: cat.id, label: cat.name }));
      }
    }
  }

  // Category Management
  openCategoryModal(): void {
    this.categoryForm.reset({
      name: '',
      slug: '',
      description: ''
    });
    this.showCategoryModal = true;
  }

  closeCategoryModal(): void {
    this.showCategoryModal = false;
    this.categoryForm.reset();
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.notification.error('Please fill all required fields');
      return;
    }

    const categoryData = this.categoryForm.value;
    // Auto-generate slug from name if not provided
    if (!categoryData.slug && categoryData.name) {
      categoryData.slug = categoryData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    this.categoryService.createCategory(categoryData).subscribe({
      next: (category) => {
        this.notification.success('Category created successfully');
        this.closeCategoryModal();
        this.loadCategories(); // Reload categories list
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error creating category');
        console.error('Error creating category:', err);
      }
    });
  }

  initializeItemsTableConfig(): void {
    this.itemsTableConfig = {
      columns: [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'sku', label: 'SKU', sortable: true },
        { key: 'category.name', label: 'Category', sortable: true },
        { key: 'cost_price', label: 'Cost Price', sortable: true, type: 'currency', format: (v) => `₹${Number(v).toFixed(2)}` },
        { key: 'quantity', label: 'Stock', sortable: true, format: (v, row) => `${Number(v || 0).toFixed(2)} ${row.unit || ''}` },
        { key: 'unit', label: 'Unit', sortable: true },
        { key: 'low_stock_threshold', label: 'Low Stock Threshold', sortable: true }
      ],
      filters: [
        {
          key: 'category_id',
          label: 'Category',
          type: 'select',
          options: []
        }
      ],
      actions: [
        {
          label: 'Edit',
          icon: 'pencil',
          color: 'primary',
          action: (row) => this.openItemModal(row),
          tooltip: 'Edit item'
        },
        {
          label: 'Delete',
          icon: 'trash',
          color: 'warn',
          action: (row) => this.deleteItem(row),
          tooltip: 'Delete item'
        }
      ],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No items found'
    };
  }

  initializeMenuItemsTableConfig(): void {
    this.menuItemsTableConfig = {
      columns: [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'sku', label: 'SKU', sortable: true },
        { key: 'category.name', label: 'Category', sortable: true },
        { key: 'selling_price', label: 'Selling Price', sortable: true, type: 'currency', format: (v) => `₹${Number(v).toFixed(2)}` },
        { key: 'tax_rate', label: 'Tax Rate', sortable: true, format: (v) => v ? `${v}%` : '-' },
        { 
          key: 'locations', 
          label: 'Branch Status', 
          sortable: false,
          format: (v, row) => this.formatBranchStatus(row)
        },
        { key: 'status', label: 'Status', sortable: true }
      ],
      filters: [
        {
          key: 'category_id',
          label: 'Category',
          type: 'select',
          options: []
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          defaultValue: 'all',
          options: [
            { value: 'all', label: 'All (Active & Inactive)' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' }
          ]
        }
      ],
      actions: [
        {
          label: 'Edit',
          icon: 'pencil',
          color: 'primary',
          action: (row) => this.openMenuItemModal(row),
          tooltip: 'Edit menu item'
        },
        {
          label: 'Toggle Branch',
          icon: 'toggles',
          color: 'accent',
          action: (row: any) => this.toggleMenuItemBranchStatus(row),
          tooltip: 'Toggle branch status',
          condition: (row: any) => this.canToggleBranchStatus(row)
        },
        {
          label: 'Delete',
          icon: 'trash',
          color: 'warn',
          action: (row) => this.deleteMenuItem(row),
          tooltip: 'Delete menu item'
        }
      ],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No menu items found'
    };
  }

  formatBranchStatus(menuItem: any): string {
    if (!menuItem.locations || menuItem.locations.length === 0) {
      return 'No branches assigned';
    }
    const currentLocationId = this.getCurrentLocationId();
    // Pivot data is accessed via pivot property in Laravel relationships
    const currentBranch = menuItem.locations.find((loc: any) => loc.id === currentLocationId || loc.pivot?.location_id === currentLocationId);
    if (currentBranch) {
      const isActive = currentBranch.pivot?.is_active ?? currentBranch.is_active ?? true;
      return isActive ? 'Active' : 'Inactive';
    }
    // Show all branches status for super admin
    if (this.isSuperAdmin()) {
      const activeCount = menuItem.locations.filter((loc: any) => {
        const isActive = loc.pivot?.is_active ?? loc.is_active ?? true;
        return isActive;
      }).length;
      return `${activeCount}/${menuItem.locations.length} Active`;
    }
    return 'Not assigned';
  }

  canToggleBranchStatus(menuItem: any): boolean {
    if (this.isSuperAdmin()) {
      return true; // Super admin can toggle any branch
    }
    const currentLocationId = this.getCurrentLocationId();
    if (!currentLocationId) return false;
    return menuItem.locations?.some((loc: any) => loc.id === currentLocationId || loc.pivot?.location_id === currentLocationId);
  }

  toggleMenuItemBranchStatus(menuItem: any): void {
    const currentLocationId = this.getCurrentLocationId();
    if (!currentLocationId) {
      this.notification.error('Location not found');
      return;
    }

    // Find current branch status - check both pivot and direct properties
    const currentBranch = menuItem.locations?.find((loc: any) => {
      const locId = loc.id || loc.pivot?.location_id;
      return locId === currentLocationId;
    });
    
    if (!currentBranch) {
      this.notification.error('Menu item is not assigned to your location');
      return;
    }

    // Toggle: active -> inactive, inactive -> active (manual menu item stock control)
    const currentStatus = currentBranch.pivot?.is_active ?? currentBranch.is_active ?? true;
    const newStatus = !currentStatus;
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (confirm(`Are you sure you want to ${action} this menu item for your branch?`)) {
      this.menuItemService.toggleBranchStatus(menuItem.id, currentLocationId, newStatus).subscribe({
        next: (response: any) => {
          this.notification.success(`Menu item ${action}d successfully for your branch`);
          const updated = (response as any).menu_item || response;
          // Update row in place - no full table reload for faster UI
          const idx = this.menuItemsTableData.findIndex((m: any) => m.id === menuItem.id);
          if (idx >= 0 && updated?.locations) {
            this.menuItemsTableData = this.menuItemsTableData.map((m: any) =>
              m.id === menuItem.id ? { ...m, locations: updated.locations } : m
            );
          } else {
            this.menuItemsRealtimeUpdates$.next({ type: 'updated', data: updated });
          }
        },
        error: (err) => {
          this.notification.error(err.error?.message || `Error ${action}ing menu item`);
        }
      });
    }
  }

  loadItemsTableData = async (params: DataTableParams): Promise<any> => {
    this.itemsTableLoading = true;
    try {
      const requestParams: any = {
        page: params.page,
        per_page: params.per_page,
        search: params.search || '',
        sort_by: params.sort_by || 'name',
        sort_dir: params.sort_dir || 'asc'
      };

      if (params['filters']) {
        params['filters'].forEach((filter: any) => {
          if (filter.value !== null && filter.value !== undefined && filter.value !== '') {
            requestParams[filter.key] = filter.value;
          }
        });
      }

      const locationId = this.getCurrentLocationId();
      if (locationId) {
        requestParams.location_id = locationId;
      }

      return new Promise((resolve, reject) => {
        this.inventoryService.getItems(requestParams).subscribe({
          next: (response: any) => {
            let data: any[] = [];
            let pagination: DataTablePagination | null = null;

            if (response.data) {
              data = Array.isArray(response.data) ? response.data : response.data.data || [];
              const responseData = Array.isArray(response.data) ? { current_page: 1, per_page: 10, total: response.data.length, last_page: 1 } : response.data;
              pagination = {
                page: responseData.current_page || response.current_page || 1,
                per_page: responseData.per_page || response.per_page || 10,
                total: responseData.total || response.total || 0,
                last_page: responseData.last_page || response.last_page || 1
              };
            } else if (Array.isArray(response)) {
              data = response;
            }

            this.itemsTableData = data;
            this.itemsTablePagination = pagination;
            this.itemsTableLoading = false;

            resolve({
              data,
              pagination
            });
          },
          error: (err) => {
            console.error('Error loading items:', err);
            this.itemsTableLoading = false;
            reject(err);
          }
        });
      });
    } catch (error) {
      this.itemsTableLoading = false;
      throw error;
    }
  };

  loadMenuItemsTableData = async (params: DataTableParams): Promise<any> => {
    this.menuItemsTableLoading = true;
    try {
      const requestParams: any = {
        page: params.page,
        per_page: params.per_page,
        search: params.search || '',
        sort_by: params.sort_by || 'name',
        sort_dir: params.sort_dir || 'asc'
      };

      // Apply filter params (flat or from filters array)
      const statusVal = params['status'] ?? (Array.isArray(params['filters']) ? params['filters'].find((f: any) => f.key === 'status')?.value : undefined);
      const catVal = params['category_id'] ?? (Array.isArray(params['filters']) ? params['filters'].find((f: any) => f.key === 'category_id')?.value : undefined);
      if (statusVal && statusVal !== 'all') requestParams.status = statusVal;
      if (catVal) requestParams.category_id = catVal;

      return new Promise((resolve, reject) => {
        this.menuItemService.getMenuItems(requestParams).subscribe({
          next: (response: any) => {
            let data: MenuItem[] = [];
            let pagination: DataTablePagination | null = null;

            if (response.data) {
              data = Array.isArray(response.data) ? response.data : response.data.data || [];
              const responseData = Array.isArray(response.data) ? { current_page: 1, per_page: 10, total: response.data.length, last_page: 1 } : response.data;
              pagination = {
                page: responseData.current_page || response.current_page || 1,
                per_page: responseData.per_page || response.per_page || 10,
                total: responseData.total || response.total || 0,
                last_page: responseData.last_page || response.last_page || 1
              };
            } else if (Array.isArray(response)) {
              data = response;
            }

            this.menuItemsTableData = data;
            this.menuItemsTablePagination = pagination;
            this.menuItemsTableLoading = false;

            resolve({
              data,
              pagination
            });
          },
          error: (err) => {
            console.error('Error loading menu items:', err);
            this.menuItemsTableLoading = false;
            reject(err);
          }
        });
      });
    } catch (error) {
      this.menuItemsTableLoading = false;
      throw error;
    }
  };

  setupRealtimeUpdates(): void {
    this.itemsRealtimeUpdates$.subscribe(update => {
      if (update.type === 'created' || update.type === 'updated') {
        this.loadItemsTableData({ page: 1, per_page: 10, search: '', sort_by: 'name', sort_dir: 'asc', filters: [] });
      }
    });

    this.menuItemsRealtimeUpdates$.subscribe(update => {
      if (update.type === 'created' || update.type === 'updated') {
        this.loadMenuItemsTableData({ page: 1, per_page: 10, search: '', sort_by: 'name', sort_dir: 'asc', filters: [] });
      }
    });
  }

  openItemModal(item?: any): void {
    this.selectedItem = item || null;
    const locationId = this.isSuperAdmin() ? (this.selectedLocationId || this.currentUser?.location_id) : this.currentUser?.location_id;
    
    if (item) {
      this.itemForm.patchValue({
        ...item,
        location_id: item.location_id || locationId
      });
    } else {
      this.itemForm.reset({
        cost_price: 0,
        track_quantity: true,
        low_stock_threshold: 0,
        expiry_tracking: false,
        location_id: locationId
      });
    }
    this.showItemModal = true;
  }

  openMenuItemModal(menuItem?: MenuItem): void {
    this.selectedMenuItem = menuItem || null;
    this.menuItemImageFile = null;
    this.menuItemImagePreviewUrl = (menuItem?.image_url) ? menuItem.image_url : null;
    this.menuItemImageRemoved = false;
    const locationId = this.isSuperAdmin() ? (this.selectedLocationId || this.currentUser?.location_id) : this.currentUser?.location_id;
    
    // Clear variants array
    while (this.variantsFormArray.length !== 0) {
      this.variantsFormArray.removeAt(0);
    }
    
    if (menuItem) {
      // Extract location_ids from locations array or use location_id if present
      let locationIds: number[] = [];
      if (menuItem.location_ids && menuItem.location_ids.length > 0) {
        locationIds = menuItem.location_ids;
      } else if (menuItem.locations && menuItem.locations.length > 0) {
        locationIds = menuItem.locations.map(loc => loc.location_id);
      } else if ((menuItem as any).location_id) {
        locationIds = [(menuItem as any).location_id];
      }
      
      this.menuItemForm.patchValue({
        ...menuItem,
        status: menuItem.status || 'active', // Ensure status is set
        location_ids: locationIds.length > 0 ? locationIds : (locationId ? [locationId] : [])
      });
      
      // Load variants if they exist
      if (menuItem.variants && menuItem.variants.length > 0) {
        menuItem.variants.forEach(variant => {
          this.addVariant(variant);
        });
      }
    } else {
      // For new items, auto-assign to user's location if not super admin
      const defaultLocationIds = locationId ? [locationId] : [];
      this.menuItemForm.reset({
        tax_rate: 0,
        status: 'active', // Default status for new items
        location_ids: defaultLocationIds
      });
    }
    this.showMenuItemModal = true;
  }

  addVariant(variant?: any): void {
    const variantForm = this.fb.group({
      id: [variant?.id || null],
      name: [variant?.name || '', Validators.required],
      price: [variant?.price || 0, [Validators.required, Validators.min(0)]],
      display_order: [variant?.display_order || 0],
      is_default: [variant?.is_default || false],
      status: [variant?.status || 'active']
    });
    this.variantsFormArray.push(variantForm);
  }

  removeVariant(index: number): void {
    this.variantsFormArray.removeAt(index);
  }

  onMenuItemImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && file.type.startsWith('image/') && file.size <= 2 * 1024 * 1024) {
      this.menuItemImageFile = file;
      this.menuItemImageRemoved = false;
      if (this.menuItemImagePreviewUrl && this.menuItemImagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(this.menuItemImagePreviewUrl);
      }
      this.menuItemImagePreviewUrl = URL.createObjectURL(file);
      input.value = '';
    } else if (file) {
      this.notification.warning('Please select an image file (max 2MB).');
    }
  }

  clearMenuItemImage(): void {
    this.menuItemImageFile = null;
    this.menuItemImageRemoved = true;
    if (this.menuItemImagePreviewUrl && this.menuItemImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.menuItemImagePreviewUrl);
    }
    this.menuItemImagePreviewUrl = null;
  }

  saveItem(): void {
    if (this.itemForm.invalid) return;

    const itemData = this.itemForm.value;
    if (this.selectedItem) {
      this.inventoryService.updateItem(this.selectedItem.id, itemData).subscribe({
        next: (response) => {
          this.notification.success('Raw material updated successfully');
          this.itemsRealtimeUpdates$.next({ type: 'updated', data: response.item || response });
          this.showItemModal = false;
          this.loadItems();
          this.loadAllItemsForAutocomplete(); // Reload all items for autocomplete
          this.loadLowStockItems();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error updating raw material');
          console.error('Error updating item:', err);
        }
      });
    } else {
      this.inventoryService.createItem(itemData).subscribe({
        next: (response) => {
          this.notification.success('Raw material created successfully');
          this.itemsRealtimeUpdates$.next({ type: 'created', data: response.item || response });
          this.showItemModal = false;
          this.loadItems();
          this.loadAllItemsForAutocomplete(); // Reload all items for autocomplete
          this.loadLowStockItems();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error creating raw material');
          console.error('Error creating item:', err);
        }
      });
    }
  }

  saveMenuItem(): void {
    if (this.menuItemForm.invalid) return;

    const menuItemData = { ...this.menuItemForm.value };
    // Include variants array in the data
    menuItemData.variants = this.variantsFormArray.value;
    const imageFile = this.menuItemImageFile || undefined;
    const removeImage = this.menuItemImageRemoved && !imageFile;
    if (this.selectedMenuItem) {
      this.menuItemService.updateMenuItem(this.selectedMenuItem.id, menuItemData, imageFile, removeImage).subscribe({
        next: (response: any) => {
          this.notification.success('Menu item updated successfully');
          this.menuItemsRealtimeUpdates$.next({ type: 'updated', data: (response as any).menu_item || response });
          // Reload menu items table - pass 'all' status to show updated item regardless of status
          const currentPage = this.menuItemsTablePagination?.page || 1;
          const currentPerPage = this.menuItemsTablePagination?.per_page || 10;
          this.loadMenuItemsTableData({ 
            page: currentPage, 
            per_page: currentPerPage, 
            search: '', 
            sort_by: 'name', 
            sort_dir: 'asc', 
            filters: [{ key: 'status', value: 'all' }] // Show all items to see the updated one
          });
          this.clearMenuItemImage();
          this.showMenuItemModal = false;
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error updating menu item');
        }
      });
    } else {
      this.menuItemService.createMenuItem(menuItemData, imageFile).subscribe({
        next: (response: any) => {
          this.notification.success('Menu item created successfully');
          this.menuItemsRealtimeUpdates$.next({ type: 'created', data: (response as any).menu_item || response });
          // Reload menu items table to show new item
          this.loadMenuItemsTableData({ page: 1, per_page: 10, search: '', sort_by: 'name', sort_dir: 'asc', filters: [] });
          this.clearMenuItemImage();
          this.showMenuItemModal = false;
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error creating menu item');
        }
      });
    }
  }

  deleteMenuItem(menuItem: MenuItem): void {
    if (confirm(`Delete ${menuItem.name}?`)) {
      this.menuItemService.deleteMenuItem(menuItem.id).subscribe({
        next: () => {
          this.notification.success('Menu item deleted');
          this.loadMenuItems();
        },
        error: (err) => console.error('Error deleting menu item:', err)
      });
    }
  }

  deleteItem(item: any): void {
    if (confirm(`Delete ${item.name}?`)) {
      this.inventoryService.deleteItem(item.id).subscribe({
        next: () => {
          this.notification.success('Item deleted');
          this.loadItems();
          this.loadAllItemsForAutocomplete(); // Reload all items for autocomplete
        },
        error: (err) => console.error('Error deleting item:', err)
      });
    }
  }

  closeItemModal(): void {
    this.showItemModal = false;
  }

  closeMenuItemModal(): void {
    this.clearMenuItemImage();
    this.showMenuItemModal = false;
  }

  switchTab(tab: string): void {
    this.activeTab = tab as 'items' | 'stock' | 'menu-items' | 'low-stock';
  }

  // Stock Operations
  openStockInModal(): void {
    this.stockInForm.reset({
      location_id: this.getCurrentLocationId(),
      items: [],
      notes: ''
    });
    this.stockInItems.clear();
    this.stockInAutocompleteStates = {};
    this.savingStockIn = false;
    this.addStockInItem();
    this.showStockInModal = true;
  }

  closeStockInModal(): void {
    if (this.savingStockIn) {
      return; // Prevent closing while saving
    }
    this.showStockInModal = false;
    this.stockInItems.clear();
    this.stockInAutocompleteStates = {};
    this.savingStockIn = false;
  }

  addStockInItem(): void {
    const itemForm = this.fb.group({
      // Allow empty row; we'll validate in saveStockIn instead
      item_id: [null],
      quantity: [0], // no validators; handled in saveStockIn()
      unit_cost: [0], // no validators; optional
      notes: ['']
    });
    this.stockInItems.push(itemForm);
  }

  removeStockInItem(index: number): void {
    this.stockInItems.removeAt(index);
  }

  saveStockIn(): void {
    if (this.savingStockIn) {
      return; // Prevent double submission
    }

    // SECURITY: Ensure location_id is set (for non-super-admin, use their assigned location)
    const locationId = this.getCurrentLocationId();
    if (!locationId) {
      this.notification.error('Location is required. Please ensure your account is assigned to a location.');
      return;
    }
    
    // Set location_id in form if not already set
    if (!this.stockInForm.get('location_id')?.value) {
      this.stockInForm.patchValue({ location_id: locationId });
    }

    const rawItems = this.stockInItems.value;
    // Keep only rows where an item is selected and quantity > 0
    const validItems = rawItems.filter((item: any) => item.item_id && Number(item.quantity) > 0);

    if (validItems.length === 0) {
      this.notification.error('Please add at least one item with quantity greater than zero.');
      return;
    }

    this.savingStockIn = true;
    const notes = this.stockInForm.get('notes')?.value || '';

    // Process each valid item
    const promises = validItems.map((item: any) => {
      return this.inventoryService.stockIn({
        item_id: item.item_id,
        location_id: locationId,
        quantity: item.quantity,
        unit_cost: item.unit_cost || undefined,
        notes: notes || item.notes || undefined
      }).toPromise();
    });

    Promise.all(promises).then(() => {
      this.savingStockIn = false;
      this.notification.success('Stock added successfully');
      this.closeStockInModal();
      // Refresh data - ensures item_quantity updates are visible
      this.loadItems();
      this.loadAllItemsForAutocomplete();
      this.loadLowStockItems();
      this.loadStockTransactions();
      this.itemsRealtimeUpdates$.next({ type: 'refresh' });
      this.cdr.markForCheck();
    }).catch((err) => {
      this.savingStockIn = false;
      this.notification.error(err.error?.message || 'Error adding stock');
      console.error('Error adding stock:', err);
      this.cdr.markForCheck();
    });
  }

  openStockOutModal(): void {
    this.stockOutForm.reset({
      location_id: this.getCurrentLocationId(),
      items: [],
      notes: ''
    });
    this.stockOutItems.clear();
    this.stockOutPreviousQty = {};
    this.addStockOutItem();
    this.showStockOutModal = true;
  }

  closeStockOutModal(): void {
    this.showStockOutModal = false;
    this.stockOutItems.clear();
    this.stockOutPreviousQty = {};
  }

  addStockOutItem(): void {
    const itemForm = this.fb.group({
      // Allow empty row; validate in saveStockOut()
      item_id: [null],
      quantity: [0],
      notes: ['']
    });
    this.stockOutItems.push(itemForm);
  }

  removeStockOutItem(index: number): void {
    this.stockOutItems.removeAt(index);
  }

  saveStockOut(): void {
    if (this.savingStockOut) {
      return;
    }

    // SECURITY: Ensure location_id is set (for non-super-admin, use their assigned location)
    const locationId = this.getCurrentLocationId();
    if (!locationId) {
      this.notification.error('Location is required. Please ensure your account is assigned to a location.');
      return;
    }
    
    // Set location_id in form if not already set
    if (!this.stockOutForm.get('location_id')?.value) {
      this.stockOutForm.patchValue({ location_id: locationId });
    }

    const rawItems = this.stockOutItems.value;
    const notes = this.stockOutForm.get('notes')?.value || '';

    // Only rows with item and quantity > 0
    const validItems = rawItems.filter((item: any) => item.item_id && Number(item.quantity) > 0);

    if (validItems.length === 0) {
      this.notification.error('Please add at least one item with quantity greater than zero.');
      return;
    }

    this.savingStockOut = true;

    const promises = validItems.map((item: any) => {
      return this.inventoryService.stockOut({
        item_id: item.item_id,
        location_id: locationId,
        quantity: item.quantity,
        notes: notes || item.notes || undefined
      }).toPromise();
    });

    Promise.all(promises).then(() => {
      this.savingStockOut = false;
      this.notification.success('Stock removed successfully');
      this.closeStockOutModal();
      this.loadItems();
      this.loadAllItemsForAutocomplete(); // Reload all items for autocomplete
      this.loadLowStockItems();
      this.loadStockTransactions();
    }).catch((err) => {
      this.savingStockOut = false;
      this.notification.error(err.error?.message || 'Error removing stock');
      console.error('Error removing stock:', err);
    });
  }

  openStockTransferModal(): void {
    this.stockTransferForm.reset({
      item_id: null,
      from_location_id: this.getCurrentLocationId(),
      to_location_id: null,
      quantity: 0,
      reason: ''
    });
    this.transferPreviousQty = null;
    this.showStockTransferModal = true;
  }

  closeStockTransferModal(): void {
    this.showStockTransferModal = false;
  }

  private loadTransferPreviousQty(): void {
    const itemId = this.stockTransferForm.get('item_id')?.value;
    const fromLocationId = this.stockTransferForm.get('from_location_id')?.value;
    if (!itemId || !fromLocationId) {
      this.transferPreviousQty = null;
      return;
    }
    this.inventoryService.getStockQuantity(itemId, fromLocationId).subscribe({
      next: (stock) => {
        const qty = typeof stock === 'number' ? stock : (stock?.quantity ?? 0);
        this.transferPreviousQty = Number(qty) || 0;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading transfer previous stock quantity:', err);
        this.transferPreviousQty = null;
      }
    });
  }

  onStockTransferFieldChange(): void {
    this.loadTransferPreviousQty();
  }

  saveStockTransfer(): void {
    if (this.savingStockTransfer) {
      return;
    }

    // SECURITY: For non-super-admin, ensure from_location_id is their assigned location
    if (!this.isSuperAdmin()) {
      const userLocationId = this.currentUser?.location_id;
      if (!userLocationId) {
        this.notification.error('Location is required. Please ensure your account is assigned to a location.');
        return;
      }
      this.stockTransferForm.patchValue({ from_location_id: userLocationId });
    }

    if (this.stockTransferForm.invalid) {
      this.notification.error('Please fill all required fields for Stock Transfer.');
      return;
    }

    this.savingStockTransfer = true;
    const data = this.stockTransferForm.value;
    this.inventoryService.transferStock(data).subscribe({
      next: () => {
        this.savingStockTransfer = false;
        this.notification.success('Stock transferred successfully');
        this.closeStockTransferModal();
        this.loadItems();
        this.loadAllItemsForAutocomplete(); // Reload all items for autocomplete
        this.loadLowStockItems();
        this.loadStockTransactions();
      },
      error: (err) => {
        this.savingStockTransfer = false;
        this.notification.error(err.error?.message || 'Error transferring stock');
        console.error('Error transferring stock:', err);
      }
    });
  }

  openStockAdjustModal(): void {
    this.stockAdjustForm.reset({
      item_id: null,
      quantity: 0,
      notes: ''
    });
    this.adjustPreviousQty = null;
    this.showStockAdjustModal = true;
  }

  closeStockAdjustModal(): void {
    this.showStockAdjustModal = false;
  }

  private loadAdjustPreviousQty(): void {
    const itemId = this.stockAdjustForm.get('item_id')?.value;
    const locationId = this.getCurrentLocationId();
    if (!itemId || !locationId) {
      this.adjustPreviousQty = null;
      return;
    }
    this.inventoryService.getStockQuantity(itemId, locationId).subscribe({
      next: (stock) => {
        const qty = typeof stock === 'number' ? stock : (stock?.quantity ?? 0);
        this.adjustPreviousQty = Number(qty) || 0;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading adjust previous stock quantity:', err);
        this.adjustPreviousQty = null;
      }
    });
  }

  onStockAdjustItemChange(): void {
    this.loadAdjustPreviousQty();
  }

  saveStockAdjust(): void {
    if (this.savingStockAdjust) {
      return;
    }

    if (this.stockAdjustForm.invalid) {
      this.notification.error('Please fill all required fields for Stock Adjust.');
      return;
    }

    this.savingStockAdjust = true;
    const data = {
      ...this.stockAdjustForm.value,
      location_id: this.getCurrentLocationId()
    };

    this.inventoryService.adjustStock(data).subscribe({
      next: () => {
        this.savingStockAdjust = false;
        this.notification.success('Stock adjusted successfully');
        this.closeStockAdjustModal();
        this.loadItems();
        this.loadAllItemsForAutocomplete(); // Reload all items for autocomplete
        this.loadLowStockItems();
        this.loadStockTransactions();
      },
      error: (err) => {
        this.savingStockAdjust = false;
        this.notification.error(err.error?.message || 'Error adjusting stock');
        console.error('Error adjusting stock:', err);
      }
    });
  }

  // Recipe operations removed: recipes feature disabled

  // Helper method to get item name by ID
  getItemName(itemId: number | null | undefined): string {
    if (!itemId) return '';
    const item = this.allItems.find(i => i.id === itemId);
    return item ? item.name : '';
  }

  // Helpers for Stock In previous and total quantities
  getStockInPreviousQty(index: number): number {
    return this.stockInPreviousQty[index] ?? 0;
  }

  getStockInTotalQty(index: number): number {
    const prev = this.getStockInPreviousQty(index);
    const row = this.stockInItems.at(index) as FormGroup;
    const add = Number(row.get('quantity')?.value || 0);
    return prev + add;
  }

  hasValidStockInItems(): boolean {
    const rawItems = this.stockInItems.value || [];
    return rawItems.some((item: any) => item.item_id && Number(item.quantity) > 0);
  }

  // Helpers for Stock Out previous qty
  getStockOutPreviousQty(index: number): number {
    return this.stockOutPreviousQty[index] ?? 0;
  }

  // Load stock transactions list
  loadStockTransactions(page: number = 1): void {
    this.stockTransactionsLoading = true;
    const params: any = {
      page,
      per_page: this.stockTransactionsPerPage,
      sort_by: 'created_at',
      sort_dir: 'desc'
    };

    const locationId = this.getCurrentLocationId();
    if (locationId) {
      params.location_id = locationId;
    }

    this.inventoryService.getStockTransactions(params).subscribe({
      next: (response: any) => {
        this.stockTransactions = response.data || [];
        if (response.pagination) {
          this.stockTransactionsTotal = response.pagination.total || 0;
          this.stockTransactionsPerPage = response.pagination.per_page || this.stockTransactionsPerPage;
          this.stockTransactionsPage = response.pagination.current_page || page;
          this.stockTransactionsLastPage = response.pagination.last_page || 1;
        }
        this.stockTransactionsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading stock transactions:', err);
        this.stockTransactionsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Simple pagination controls for stock transactions
  goToStockTransactionsPage(page: number): void {
    if (page >= 1 && page <= this.stockTransactionsLastPage) {
      this.loadStockTransactions(page);
    }
  }

  // Revert a stock transaction
  revertStockTransaction(tx: any): void {
    if (!tx || !tx.id) {
      return;
    }

    if (!confirm(`Are you sure you want to revert this transaction for item "${tx.item?.name || ''}"?`)) {
      return;
    }

    this.inventoryService.revertStockTransaction(tx.id).subscribe({
      next: (response: any) => {
        this.notification.success(response?.message || 'Transaction reverted successfully');
        this.loadItems();
        this.loadAllItemsForAutocomplete();
        this.loadLowStockItems();
        this.loadStockTransactions(this.stockTransactionsPage);
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Failed to revert transaction');
        console.error('Error reverting transaction:', err);
      }
    });
  }

  // Group stock transactions by item
  getStockTransactionsGroupedByItem(): { item_id: number; name: string; sku?: string; total_qty: number; count: number }[] {
    const groups: { [key: number]: { item_id: number; name: string; sku?: string; total_qty: number; count: number } } = {};

    this.stockTransactions.forEach((tx: any) => {
      const id = tx.item_id || tx.item?.id;
      if (!id) return;
      if (!groups[id]) {
        groups[id] = {
          item_id: id,
          name: tx.item?.name || 'Unknown',
          sku: tx.item?.sku,
          total_qty: 0,
          count: 0,
        };
      }
      groups[id].total_qty += Number(tx.quantity) || 0;
      groups[id].count += 1;
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Visible transactions based on selected item group
  getVisibleStockTransactions(): any[] {
    if (!this.selectedStockTransactionsItemId) {
      return this.stockTransactions;
    }
    return this.stockTransactions.filter(
      (tx: any) =>
        tx.item_id === this.selectedStockTransactionsItemId ||
        tx.item?.id === this.selectedStockTransactionsItemId
    );
  }

  // Open edit modal for a stock transaction
  openStockTransactionEdit(tx: any): void {
    if (!tx || tx.reverted_at) {
      return;
    }
    this.editingStockTransaction = tx;
    this.stockTransactionForm.reset({
      quantity: tx.quantity,
      unit_cost: tx.unit_cost || 0,
      notes: tx.notes || ''
    });
    this.showStockTransactionModal = true;
  }

  closeStockTransactionEdit(): void {
    this.showStockTransactionModal = false;
    this.editingStockTransaction = null;
    this.stockTransactionForm.reset();
  }

  saveStockTransactionEdit(): void {
    if (!this.editingStockTransaction || this.stockTransactionForm.invalid) {
      this.notification.error('Please enter a valid quantity.');
      return;
    }

    const id = this.editingStockTransaction.id;
    const payload = this.stockTransactionForm.value;

    this.inventoryService.updateStockTransaction(id, payload).subscribe({
      next: (response: any) => {
        this.notification.success(response?.message || 'Transaction updated successfully');
        this.closeStockTransactionEdit();
        this.loadItems();
        this.loadAllItemsForAutocomplete();
        this.loadLowStockItems();
        this.loadStockTransactions(this.stockTransactionsPage);
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Failed to update transaction');
        console.error('Error updating transaction:', err);
      }
    });
  }

  // Filter items for autocomplete with debounce
  private searchTimeouts: { [key: string]: any } = {};

  /** Match item if ALL search words appear in name, sku, or barcode (any order). Enables "basmati rice" to find "Rice Basmati". */
  private itemMatchesSearch(item: any, query: string): boolean {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const name = (item.name || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    const barcode = (item.barcode || '').toLowerCase();
    return words.every(word => name.includes(word) || sku.includes(word) || barcode.includes(word));
  }

  filterItemsForStock(query: string, index: number, type: 'in' | 'out'): void {
    const stateKey = `${type}-${index}`;
    
    // Clear previous timeout
    if (this.searchTimeouts[stateKey]) {
      clearTimeout(this.searchTimeouts[stateKey]);
    }

    // Debounce search for better performance
    this.searchTimeouts[stateKey] = setTimeout(() => {
      const state = type === 'in' 
        ? this.stockInAutocompleteStates[index] 
        : this.stockOutAutocompleteStates[index];
      
      if (!state) {
        if (type === 'in') {
          this.stockInAutocompleteStates[index] = { query: '', showDropdown: false, filteredItems: [] };
        } else {
          this.stockOutAutocompleteStates[index] = { query: '', showDropdown: false, filteredItems: [] };
        }
      }

      const currentState = type === 'in' 
        ? this.stockInAutocompleteStates[index] 
        : this.stockOutAutocompleteStates[index];

      currentState.query = query;
      if (query && query.length > 0) {
        currentState.filteredItems = this.allItems.filter(item => this.itemMatchesSearch(item, query)).slice(0, 100);
        currentState.showDropdown = currentState.filteredItems.length > 0;
      } else {
        currentState.showDropdown = false;
        currentState.filteredItems = [];
      }
      this.cdr.markForCheck();
    }, 200); // 200ms debounce
  }

  selectItemForStock(itemId: number, index: number, type: 'in' | 'out'): void {
    const state = type === 'in' 
      ? this.stockInAutocompleteStates[index] 
      : this.stockOutAutocompleteStates[index];
    
    const selectedItem = this.allItems.find(item => item.id === itemId);
    
    if (type === 'in') {
      this.stockInItems.at(index).patchValue({ item_id: itemId });

      // Load previous stock quantity and branch cost for this item at current location
      const locationId = this.getStockInLocationId(index);
      if (locationId && selectedItem) {
        this.inventoryService.getStockQuantity(itemId, locationId).subscribe({
          next: (stock) => {
            const res = typeof stock === 'object' ? stock : { quantity: stock, cost_price: null };
            const qty = typeof stock === 'number' ? stock : (res?.quantity ?? 0);
            this.stockInPreviousQty[index] = Number(qty) || 0;
            // Use branch cost from API if available, else fallback to item cost
            const branchCost = res?.cost_price != null && Number(res?.cost_price) > 0
              ? Number(res.cost_price)
              : (selectedItem?.cost_price != null ? Number(selectedItem.cost_price) : 0);
            this.stockInPreviousCost[index] = branchCost;
            if (branchCost > 0) {
              const row = this.stockInItems.at(index) as FormGroup;
              const currentCost = row.get('unit_cost')?.value;
              if (!currentCost || Number(currentCost) === 0) {
                row.patchValue({ unit_cost: branchCost });
              }
            }
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error('Error loading previous stock quantity:', err);
            this.stockInPreviousQty[index] = 0;
          }
        });
      }

      // Auto-add a new empty row when selecting an item in Stock In
      const isLastRow = index === this.stockInItems.length - 1;
      if (isLastRow) {
        this.addStockInItem();
      }
    } else {
      this.stockOutItems.at(index).patchValue({ item_id: itemId });

      // Load previous stock quantity for this item at current branch
      const locationId = this.getStockOutLocationId(index);
      if (locationId && selectedItem) {
        this.inventoryService.getStockQuantity(itemId, locationId).subscribe({
          next: (stock) => {
            const qty = typeof stock === 'number' ? stock : (stock?.quantity ?? 0);
            this.stockOutPreviousQty[index] = Number(qty) || 0;
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error('Error loading previous stock quantity for stock out:', err);
            this.stockOutPreviousQty[index] = 0;
          }
        });
      }
    }
    
    if (state && selectedItem) {
      state.showDropdown = false;
      state.query = selectedItem.name;
      state.filteredItems = [];
    }
    this.cdr.markForCheck();
  }

  closeAutocomplete(index: number, type: 'in' | 'out'): void {
    const state = type === 'in' 
      ? this.stockInAutocompleteStates[index] 
      : this.stockOutAutocompleteStates[index];
    
    if (state) {
      // Delay closing to allow click event to fire
      setTimeout(() => {
        if (state) {
          state.showDropdown = false;
          this.cdr.markForCheck();
        }
      }, 200);
    }
  }

  // Auto-search methods for Stock Transfer
  filterItemsForStockTransfer(query: string): void {
    const stateKey = 'transfer';
    
    // Clear previous timeout
    if (this.searchTimeouts[stateKey]) {
      clearTimeout(this.searchTimeouts[stateKey]);
    }

    // Debounce search for better performance
    this.searchTimeouts[stateKey] = setTimeout(() => {
      if (!this.transferAutocompleteState) {
        this.transferAutocompleteState = { query: '', showDropdown: false, filteredItems: [] };
      }

      this.transferAutocompleteState.query = query;
      
      if (!query || query.trim() === '') {
        this.transferAutocompleteState.filteredItems = this.allItems.slice(0, 100);
      } else {
        this.transferAutocompleteState.filteredItems = this.allItems
          .filter(item => this.itemMatchesSearch(item, query))
          .slice(0, 100);
      }
      
      this.transferAutocompleteState.showDropdown = this.transferAutocompleteState.filteredItems.length > 0;
      this.cdr.markForCheck();
    }, 150);
  }

  selectItemForStockTransfer(itemId: number): void {
    const selectedItem = this.allItems.find(item => item.id === itemId);
    
    if (selectedItem) {
      this.stockTransferForm.patchValue({ item_id: itemId });
      this.onStockTransferFieldChange();
      
      if (this.transferAutocompleteState) {
        this.transferAutocompleteState.showDropdown = false;
        this.transferAutocompleteState.query = selectedItem.name;
        this.transferAutocompleteState.filteredItems = [];
      }
    }
    this.cdr.markForCheck();
  }

  closeAutocompleteTransfer(): void {
    if (this.transferAutocompleteState) {
      setTimeout(() => {
        if (this.transferAutocompleteState) {
          this.transferAutocompleteState.showDropdown = false;
          this.cdr.markForCheck();
        }
      }, 200);
    }
  }

  // Auto-search methods for Stock Adjust
  filterItemsForStockAdjust(query: string): void {
    const stateKey = 'adjust';
    
    // Clear previous timeout
    if (this.searchTimeouts[stateKey]) {
      clearTimeout(this.searchTimeouts[stateKey]);
    }

    // Debounce search for better performance
    this.searchTimeouts[stateKey] = setTimeout(() => {
      if (!this.adjustAutocompleteState) {
        this.adjustAutocompleteState = { query: '', showDropdown: false, filteredItems: [] };
      }

      this.adjustAutocompleteState.query = query;
      
      if (!query || query.trim() === '') {
        this.adjustAutocompleteState.filteredItems = this.allItems.slice(0, 100);
      } else {
        this.adjustAutocompleteState.filteredItems = this.allItems
          .filter(item => this.itemMatchesSearch(item, query))
          .slice(0, 100);
      }
      
      this.adjustAutocompleteState.showDropdown = this.adjustAutocompleteState.filteredItems.length > 0;
      this.cdr.markForCheck();
    }, 150);
  }

  selectItemForStockAdjust(itemId: number): void {
    const selectedItem = this.allItems.find(item => item.id === itemId);
    
    if (selectedItem) {
      this.stockAdjustForm.patchValue({ item_id: itemId });
      this.onStockAdjustItemChange();
      
      if (this.adjustAutocompleteState) {
        this.adjustAutocompleteState.showDropdown = false;
        this.adjustAutocompleteState.query = selectedItem.name;
        this.adjustAutocompleteState.filteredItems = [];
      }
    }
    this.cdr.markForCheck();
  }

  closeAutocompleteAdjust(): void {
    if (this.adjustAutocompleteState) {
      setTimeout(() => {
        if (this.adjustAutocompleteState) {
          this.adjustAutocompleteState.showDropdown = false;
          this.cdr.markForCheck();
        }
      }, 200);
    }
  }
}

