import { Component, OnInit, OnDestroy, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, FormControl, AbstractControl, Validators } from '@angular/forms';
import { PosService, Item, CreateSaleRequest } from '../../../core/services/pos.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { CategoryService } from '../../../core/services/category.service';
import { TableService } from '../../../core/services/table.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { BarcodeService } from '../../../core/services/barcode.service';
import { CashRegisterService } from '../../../core/services/cash-register.service';
import { AdminService, Location } from '../../../core/services/admin.service';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { VariantSelectorComponent } from '../../../shared/components/variant-selector/variant-selector.component';

@Component({
  selector: 'app-pos-dashboard',
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
    MatChipsModule,
    MatBadgeModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatTabsModule,
    LoaderComponent,
    VariantSelectorComponent
  ],
  templateUrl: './pos-dashboard.component.html',
  styleUrls: ['./pos-dashboard.component.css']
})
export class PosDashboardComponent implements OnInit, OnDestroy {
  items: Item[] = [];
  filteredItems: Item[] = [];
  categories: any[] = [];
  selectedCategory: any = null;
  
  // Pagination
  currentPage: number = 1;
  perPage: number = 20;
  itemsPerPage: number = 20; // Alias for consistency
  totalItems: number = 0;
  lastPage: number = 1;
  paginationLoading: boolean = false;
  currentUser: any;
  processing = false;
  loadingItems = false;
  loadingCategories = false;
  loadingCustomers = false;
  locations: Location[] = [];
  selectedLocationId?: number; // For super admin location filtering
  
  searchForm: FormGroup;
  saleForm: FormGroup;
  paymentForm: FormGroup;
  
  showPaymentModal = false;
  showCustomerModal = false;
  showDiscountModal = false;
  showTableModal = false;
  showBarcodeScanner = false;
  showSplitBilling = false;
  showVariantModal = false;
  selectedItemForVariant: Item | null = null;
  
  selectedSale: any = null;
  customers: any[] = [];
  tables: any[] = [];
  suspendedSales: any[] = [];
  recentSales: any[] = [];
  showSalesList = false;
  loadingSales = false;
  salesError: string | null = null;
  
  // Sales pagination
  salesCurrentPage: number = 1;
  salesPerPage: number = 10;
  salesTotal: number = 0;
  salesLastPage: number = 1;
  
  suspendedSalesCurrentPage: number = 1;
  suspendedSalesPerPage: number = 10;
  suspendedSalesTotal: number = 0;
  suspendedSalesLastPage: number = 1;
  editingSale: any = null;
  showEditModal = false;
  showCancelModal = false;
  cancelReason = '';
  selectedSaleForCancel: any = null;
  
  // Real-time subscriptions
  private subscriptions: Subscription[] = [];
  
  // Cash register
  currentRegister: any = null;
  showCashRegisterModal = false;
  
  // Split billing
  splitBills!: FormArray;

  constructor(
    private fb: FormBuilder,
    private posService: PosService,
    private authService: AuthService,
    private router: Router,
    private customerService: CustomerService,
    private categoryService: CategoryService,
    private tableService: TableService,
    private notification: NotificationService,
    @Inject(RealtimeService) private realtimeService: RealtimeService,
    private barcodeService: BarcodeService,
    private cashRegisterService: CashRegisterService,
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {
    this.searchForm = this.fb.group({
      query: ['']
    });
    
    this.saleForm = this.fb.group({
      customer_id: [null],
      table_number: [''],
      items: this.fb.array([]),
      discount_amount: [0, [Validators.min(0)]],
      discount_type: ['fixed'],
      notes: ['']
    });
    
    this.paymentForm = this.fb.group({
      payments: this.fb.array([])
    });
    
    this.splitBills = this.fb.array([]);
    this.currentUser = this.authService.getCurrentUser();
  }

  ngOnInit(): void {
    // OPTIMIZATION: Load ONLY critical data initially for fast page load
    if (this.authService.isSuperAdmin()) {
      this.loadLocations();
      this.selectedLocationId = this.currentUser?.location_id; // Default to user's location
    }
    
    // Load ONLY essential data for POS to work (items and categories)
    this.loadItems();
    this.loadCategories();
    
    // Defer all non-critical data - load on demand when user interacts
    // Customers: Load when user clicks "Add Customer" or opens customer modal
    // Tables: Load when user clicks table selector
    // Suspended Sales: Load when user clicks "Suspended Sales" tab
    // Recent Sales: Load when user clicks "Show Sales List"
    // Cash Register: Load when user opens cash register modal
    
    this.setupSearchListener();
    this.initializePaymentForm();
    this.setupRealtimeSubscriptions();
    
    // Don't show sales list by default - user can toggle it
    this.showSalesList = false;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.showBarcodeScanner) {
      this.barcodeService.stopScanning();
    }
  }

  setupRealtimeSubscriptions(): void {
    // Subscribe to inventory updates with debouncing
    const inventorySub = this.realtimeService.inventoryUpdates$.pipe(
      debounceTime(500)
    ).subscribe(update => {
      if (update.type === 'low_stock') {
        this.notification.warning(`Low stock alert: ${update.item_name}`);
      }
      // Update specific item instead of full reload
      if (update.item_id) {
        this.updateItemInList(update.item_id, update);
      }
    });

    // Subscribe to sales notifications
    const salesSub = this.realtimeService.sales$.subscribe(sales => {
      // Handle real-time sales updates
    });

    this.subscriptions.push(inventorySub, salesSub);
  }

  updateItemInList(itemId: number, update: any): void {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index >= 0) {
      // Update item in place to prevent full re-render
      this.items[index] = { ...this.items[index], ...update };
      // Update filtered items if visible
      const filteredIndex = this.filteredItems.findIndex(item => item.id === itemId);
      if (filteredIndex >= 0) {
        this.filteredItems[filteredIndex] = { ...this.filteredItems[filteredIndex], ...update };
      }
      this.cdr.markForCheck();
    }
  }

  loadSuspendedSales(): void {
    const locationId = this.authService.isSuperAdmin() && this.selectedLocationId 
      ? this.selectedLocationId 
      : this.currentUser?.location_id;
    
    this.posService.getSuspendedSales(locationId, this.suspendedSalesCurrentPage, this.suspendedSalesPerPage).subscribe({
      next: (response: any) => {
        if (response.data && response.pagination) {
          this.suspendedSales = response.data;
          this.suspendedSalesTotal = response.pagination.total;
          this.suspendedSalesLastPage = response.pagination.last_page;
          this.suspendedSalesCurrentPage = response.pagination.current_page;
        } else {
          // Fallback for non-paginated response
          this.suspendedSales = Array.isArray(response) ? response : response.data || [];
        }
      },
      error: (err) => console.error('Error loading suspended sales:', err)
    });
  }

  loadRecentSales(): void {
    this.loadingSales = true;
    this.salesError = null;
    
    const locationId = this.authService.isSuperAdmin() && this.selectedLocationId 
      ? this.selectedLocationId 
      : this.currentUser?.location_id;
    
    const params: any = { 
      page: this.salesCurrentPage, 
      per_page: this.salesPerPage 
    };
    if (locationId) params.location_id = locationId;
    
    this.posService.getSaleList(params).subscribe({
      next: (response: any) => {
        this.loadingSales = false;
        if (response.data && response.pagination) {
          this.recentSales = response.data;
          this.salesTotal = response.pagination.total;
          this.salesLastPage = response.pagination.last_page;
          this.salesCurrentPage = response.pagination.current_page;
        } else if (response.data) {
          // Fallback for non-paginated response with data array
          this.recentSales = Array.isArray(response.data) ? response.data : [];
          this.salesTotal = this.recentSales.length;
          this.salesLastPage = 1;
        } else if (Array.isArray(response)) {
          // Direct array response
          this.recentSales = response;
          this.salesTotal = response.length;
          this.salesLastPage = 1;
        } else {
          this.recentSales = [];
          this.salesTotal = 0;
          this.salesLastPage = 1;
        }
      },
      error: (err) => {
        this.loadingSales = false;
        this.salesError = err.error?.message || 'Failed to load sales list';
        console.error('Error loading recent sales:', err);
        this.recentSales = [];
      }
    });
  }
  
  viewSale(sale: any): void {
    // Load sale details
    this.posService.getSale(sale.id).subscribe({
      next: (saleData) => {
        this.selectedSale = saleData;
        // You can open a modal or navigate to sale details here
        console.log('Sale details:', saleData);
      },
      error: (err) => {
        console.error('Error loading sale details:', err);
      }
    });
  }

  goToSalesPage(page: number): void {
    if (page >= 1 && page <= this.salesLastPage) {
      this.salesCurrentPage = page;
      this.loadRecentSales();
    }
  }

  goToSuspendedSalesPage(page: number): void {
    if (page >= 1 && page <= this.suspendedSalesLastPage) {
      this.suspendedSalesCurrentPage = page;
      this.loadSuspendedSales();
    }
  }

  loadCashRegister(): void {
    const locationId = this.currentUser?.location_id;
    this.cashRegisterService.getCurrentRegister(locationId).subscribe({
      next: (register) => {
        this.currentRegister = register;
        if (!register) {
          this.showCashRegisterModal = true;
        }
      },
      error: (err) => console.error('Error loading cash register:', err)
    });
  }

  initializePaymentForm(): void {
    // Add default cash payment
    this.addPayment();
    const paymentsArray = this.paymentForm.get('payments') as FormArray;
    if (paymentsArray.length > 0) {
      paymentsArray.at(0).patchValue({ method: 'cash' });
    }
  }

  get cartItems(): FormArray {
    return this.saleForm.get('items') as FormArray;
  }

  setupSearchListener(): void {
    this.searchForm.get('query')?.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(query => {
      this.currentPage = 1; // Reset to first page on search
      this.loadItems();
    });
  }

  loadLocations(): void {
    this.adminService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
      },
      error: (err) => console.error('Error loading locations:', err)
    });
  }

  onLocationChange(): void {
    this.loadItems();
    this.loadSuspendedSales();
  }

  loadItems(): void {
    // Use selected location for super admin, otherwise use user's location
    const locationId = this.authService.isSuperAdmin() && this.selectedLocationId 
      ? this.selectedLocationId 
      : this.currentUser?.location_id;
    
    const categoryId = this.selectedCategory && this.selectedCategory.id !== 0 ? this.selectedCategory.id : undefined;
    const searchQuery = this.searchForm.get('query')?.value || '';
    
    this.loadingItems = true;
    // Use itemsPerPage if available, otherwise fallback to perPage
    const perPageValue = this.itemsPerPage || this.perPage || 20;
    
    console.log('Loading items with params:', { locationId, currentPage: this.currentPage, perPage: perPageValue, categoryId, searchQuery });
    
    this.posService.getMenuItems(locationId, this.currentPage, perPageValue, categoryId, searchQuery).subscribe({
      next: (response: any) => {
        console.log('POS Menu items response:', response); // Debug log
        console.log('Response type:', typeof response);
        console.log('Response keys:', response ? Object.keys(response) : 'null');
        // Handle paginated response - show all items (inactive visible but not selectable)
        if (response && response.data && response.pagination) {
          this.items = Array.isArray(response.data) ? response.data : [];
          this.filteredItems = [...this.items];
          this.totalItems = response.pagination.total || 0;
          this.lastPage = response.pagination.last_page || 1;
          this.currentPage = response.pagination.current_page || 1;
          console.log('Items loaded:', this.items.length, 'Total:', this.totalItems);
        } else if (Array.isArray(response)) {
          this.items = response;
          this.filteredItems = [...response];
          this.totalItems = response.length;
          this.lastPage = 1;
        } else if (response && response.data && Array.isArray(response.data)) {
          this.items = response.data;
          this.filteredItems = [...response.data];
          this.totalItems = response.data.length;
          this.lastPage = 1;
        } else {
          console.warn('Unexpected response format:', response);
          this.items = [];
          this.filteredItems = [];
          this.totalItems = 0;
          this.lastPage = 1;
        }
        this.loadingItems = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading items:', err);
        console.error('Error details:', {
          message: err.message,
          status: err.status,
          error: err.error,
          url: err.url
        });
        this.items = [];
        this.filteredItems = [];
        this.loadingItems = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadCategories(): void {
    this.loadingCategories = true;
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = [{ id: 0, name: 'All', slug: 'all' }, ...categories];
        this.loadingCategories = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading categories:', err);
        // Fallback to default categories
        this.categories = [
          { id: 0, name: 'All', slug: 'all' },
          { id: 1, name: 'Beverages', slug: 'beverages' },
          { id: 2, name: 'Main Course', slug: 'main-course' },
          { id: 3, name: 'Desserts', slug: 'desserts' }
        ];
        this.loadingCategories = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadCustomers(): void {
    this.loadingCustomers = true;
    this.customerService.getCustomers().subscribe({
      next: (response) => {
        this.customers = response.data || [];
        this.loadingCustomers = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading customers:', err);
        this.loadingCustomers = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadTables(): void {
    this.tableService.getTables().subscribe({
      next: (tables) => {
        this.tables = tables;
      },
      error: (err) => console.error('Error loading tables:', err)
    });
  }

  selectCategory(category: any): void {
    this.selectedCategory = category;
    this.currentPage = 1; // Reset to first page when category changes
    this.loadItems(); // Reload with server-side filtering
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage) {
      this.currentPage = page;
      this.loadItems();
      // Scroll to top of products section
      const productsSection = document.querySelector('.products-section');
      if (productsSection) {
        productsSection.scrollTop = 0;
      }
    }
  }

  handlePageClick(page: number | string): void {
    if (typeof page === 'number') {
      this.goToPage(page);
    }
  }

  // TrackBy functions to prevent unnecessary DOM re-renders
  trackByItemId(index: number, item: Item): number {
    return item.id;
  }

  trackByCategoryId(index: number, category: any): number {
    return category.id;
  }

  trackByLocationId(index: number, location: Location): number {
    return location.id;
  }

  trackByCartItemId(index: number, item: AbstractControl): number {
    return item.get('menu_item_id')?.value || index;
  }

  trackByCustomerId(index: number, customer: any): number {
    return customer.id;
  }

  scanBarcode(event: any): void {
    const barcode = event.target.value;
    if (barcode && barcode.length > 0) {
      this.posService.getMenuItemByBarcode(barcode).subscribe({
        next: (item) => {
          this.addToCart(item);
          event.target.value = '';
          this.notification.success('Item added to cart');
        },
        error: (err) => {
          this.notification.error('Item not found');
          event.target.value = '';
        }
      });
    }
  }

  async startBarcodeScanner(): Promise<void> {
    if (!this.barcodeService.isSupported()) {
      this.notification.error('Barcode scanner not supported on this device');
      return;
    }

    try {
      this.showBarcodeScanner = true;
      await this.barcodeService.startScanning('barcode-scanner-container');
      
      const scanSub = this.barcodeService.scanResult$.subscribe(barcode => {
        this.posService.getMenuItemByBarcode(barcode).subscribe({
          next: (item) => {
            this.addToCart(item);
            this.notification.success('Item scanned and added to cart');
          },
          error: (err) => {
            this.notification.error('Item not found');
          }
        });
      });
      
      this.subscriptions.push(scanSub);
    } catch (err) {
      this.notification.error('Failed to start barcode scanner');
      this.showBarcodeScanner = false;
    }
  }

  stopBarcodeScanner(): void {
    this.barcodeService.stopScanning();
    this.showBarcodeScanner = false;
  }

  suspendSale(): void {
    if (this.cartItems.length === 0) {
      this.notification.warning('Cart is empty');
      return;
    }

    const saleData: CreateSaleRequest = {
      customer_id: this.saleForm.get('customer_id')?.value,
      table_number: this.saleForm.get('table_number')?.value,
      items: this.cartItems.value,
      discount_amount: this.discountAmount,
      discount_type: this.saleForm.get('discount_type')?.value,
      notes: this.saleForm.get('notes')?.value
    };

    this.posService.suspendSale(saleData).subscribe({
      next: () => {
        this.notification.success('Sale suspended successfully');
        this.clearCart();
        this.loadSuspendedSales();
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error suspending sale');
      }
    });
  }

  resumeSale(saleId: number): void {
    this.posService.resumeSale(saleId).subscribe({
      next: (sale) => {
        // Load items from suspended sale into cart
        if (sale.items) {
          this.clearCart();
          sale.items.forEach((item: any) => {
            const itemForm = this.fb.group({
              menu_item_id: [item.menu_item_id || item.item_id, Validators.required], // Support both for migration
              quantity: [item.quantity, Validators.required],
              unit_price: [item.unit_price, Validators.required],
              discount_amount: [item.discount_amount || 0],
              tax_rate: [item.tax_rate || 0],
              notes: [item.notes || '']
            });
            this.cartItems.push(itemForm);
          });
          this.notification.success('Sale resumed');
          this.loadSuspendedSales();
        }
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error resuming sale');
      }
    });
  }

  openSplitBilling(): void {
    if (this.cartItems.length === 0) {
      this.notification.warning('Cart is empty');
      return;
    }
    this.showSplitBilling = true;
    this.splitBills = this.fb.array([]);
    this.addSplitBill();
  }

  addSplitBill(): void {
    const bill = this.fb.group({
      items: this.fb.array([]),
      customer_id: [null],
      discount_amount: [0],
      discount_type: ['fixed']
    });
    this.splitBills.push(bill);
  }

  removeSplitBill(index: number): void {
    this.splitBills.removeAt(index);
  }

  processSplitBilling(): void {
    // Implementation for split billing
    this.notification.info('Split billing feature coming soon');
  }

  openCashRegister(): void {
    this.showCashRegisterModal = true;
  }

  openRegister(amount: number): void {
    const locationId = this.currentUser?.location_id;
    this.cashRegisterService.openRegister({ opening_balance: amount }, locationId).subscribe({
      next: (register) => {
        this.currentRegister = register;
        this.showCashRegisterModal = false;
        this.notification.success('Cash register opened');
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error opening register');
      }
    });
  }

  isItemActiveInLocation(item: Item): boolean {
    return item.is_active_in_location !== false;
  }

  addToCart(item: Item): void {
    // Check if item is active in current location
    if (!this.isItemActiveInLocation(item)) {
      this.notification.warning('This item is out of stock in your branch');
      return;
    }
    // Check if item has variants
    if (item.variants && item.variants.length > 0) {
      // Show variant selector modal
      this.selectedItemForVariant = item;
      this.showVariantModal = true;
    } else {
      // Add directly to cart (no variants)
      this.addItemToCart(item, null, 1);
    }
  }

  onVariantSelected(event: { variant: any; quantity: number }): void {
    if (this.selectedItemForVariant) {
      this.addItemToCart(this.selectedItemForVariant, event.variant, event.quantity);
      this.closeVariantModal();
    }
  }

  closeVariantModal(): void {
    this.showVariantModal = false;
    this.selectedItemForVariant = null;
  }

  addItemToCart(item: Item, variant: any, quantity: number): void {
    // Check if item is active in current location
    if (!this.isItemActiveInLocation(item)) {
      this.notification.warning('This item is out of stock in your branch');
      return;
    }
    
    const price = variant ? variant.price : item.selling_price;
    const variantId = variant ? variant.id : null;

    // Check if same item with same variant already exists in cart
    const existingIndex = this.cartItems.controls.findIndex(control => {
      const menuItemId = control.get('menu_item_id')?.value;
      const existingVariantId = control.get('menu_item_variant_id')?.value;
      return menuItemId === item.id && existingVariantId === variantId;
    });

    if (existingIndex >= 0) {
      const existingControl = this.cartItems.at(existingIndex);
      const currentQty = existingControl.get('quantity')?.value || 0;
      existingControl.patchValue({ quantity: currentQty + quantity });
    } else {
      const itemForm = this.fb.group({
        menu_item_id: [item.id, Validators.required],
        menu_item_variant_id: [variantId],
        quantity: [quantity, [Validators.required, Validators.min(1)]],
        unit_price: [price, Validators.required],
        discount_amount: [0, Validators.min(0)],
        tax_rate: [item.tax_rate || 0],
        notes: ['']
      });
      this.cartItems.push(itemForm);
    }
  }

  removeFromCart(index: number): void {
    this.cartItems.removeAt(index);
  }

  updateQuantity(index: number, change: number): void {
    const control = this.cartItems.at(index);
    const currentQty = control.get('quantity')?.value || 0;
    const newQty = Math.max(1, Math.floor(currentQty + change));
    control.patchValue({ quantity: newQty });
  }

  getItemTotal(index: number): number {
    const control = this.cartItems.at(index);
    const quantity = control.get('quantity')?.value || 0;
    const price = control.get('unit_price')?.value || 0;
    const discount = control.get('discount_amount')?.value || 0;
    const taxRate = control.get('tax_rate')?.value || 0;
    const subtotal = (price * quantity) - discount;
    return subtotal + (subtotal * taxRate / 100);
  }

  get subtotal(): number {
    return this.cartItems.controls.reduce((sum, control) => {
      const quantity = control.get('quantity')?.value || 0;
      const price = control.get('unit_price')?.value || 0;
      const discount = control.get('discount_amount')?.value || 0;
      return sum + (price * quantity) - discount;
    }, 0);
  }

  get taxAmount(): number {
    return this.cartItems.controls.reduce((sum, control) => {
      const quantity = control.get('quantity')?.value || 0;
      const price = control.get('unit_price')?.value || 0;
      const discount = control.get('discount_amount')?.value || 0;
      const taxRate = control.get('tax_rate')?.value || 0;
      const subtotal = (price * quantity) - discount;
      return sum + (subtotal * taxRate / 100);
    }, 0);
  }

  get discountAmount(): number {
    const discount = this.saleForm.get('discount_amount')?.value || 0;
    const discountType = this.saleForm.get('discount_type')?.value;
    
    if (discountType === 'percentage') {
      return (this.subtotal * discount) / 100;
    }
    return discount;
  }

  get total(): number {
    const rawTotal = this.subtotal + this.taxAmount - this.discountAmount;
    return Math.ceil(rawTotal); // Round up to nearest whole rupee (e.g., 200.20 -> 201)
  }

  clearCart(): void {
    this.cartItems.clear();
    this.saleForm.patchValue({
      customer_id: null,
      table_number: '',
      discount_amount: 0,
      discount_type: 'fixed',
      notes: ''
    });
  }

  openPaymentModal(): void {
    if (this.cartItems.length === 0) {
      alert('Cart is empty');
      return;
    }
    
    this.selectedSale = {
      subtotal: this.subtotal,
      tax: this.taxAmount,
      discount: this.discountAmount,
      total: this.total
    };
    
    // Initialize payment form with one default payment equal to rounded total
    const paymentsArray = this.paymentForm.get('payments') as FormArray;
    paymentsArray.clear();
    const defaultPayment = this.fb.group({
      method: ['cash', Validators.required],
      amount: [this.total, [Validators.required, Validators.min(0.01)]],
      reference_number: ['']
    });
    paymentsArray.push(defaultPayment);
    
    this.showPaymentModal = true;
  }

  // Quick checkout: pay full rounded amount with UPI, no modal
  quickCheckoutUpi(): void {
    // Prevent duplicate submissions
    if (this.processing) {
      this.notification.warning('Sale is already being processed. Please wait...', 'Processing');
      return;
    }

    if (this.cartItems.length === 0) {
      this.notification.error('Cart is empty. Please add items to cart.', 'Empty Cart');
      return;
    }

    // Reset payments to a single UPI payment with full rounded total
    const paymentsArray = this.paymentForm.get('payments') as FormArray;
    paymentsArray.clear();
    const upiPayment = this.fb.group({
      method: ['upi', Validators.required],
      amount: [this.total, [Validators.required, Validators.min(0.01)]],
      reference_number: ['']
    });
    paymentsArray.push(upiPayment);

    this.processSale();
  }

  addPayment(): void {
    const paymentsArray = this.paymentForm.get('payments') as FormArray;
    const paymentForm = this.fb.group({
      method: ['cash', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      reference_number: ['']
    });
    paymentsArray.push(paymentForm);
  }

  removePayment(index: number): void {
    const paymentsArray = this.paymentForm.get('payments') as FormArray;
    paymentsArray.removeAt(index);
  }

  get paymentTotal(): number {
    const paymentsArray = this.paymentForm.get('payments') as FormArray;
    return paymentsArray.controls.reduce((sum, control) => {
      return sum + (control.get('amount')?.value || 0);
    }, 0);
  }

  processSale(): void {
    // Prevent duplicate submissions
    if (this.processing) {
      this.notification.warning('Sale is already being processed. Please wait...', 'Processing');
      return;
    }

    if (this.cartItems.length === 0) {
      this.notification.error('Cart is empty. Please add items to cart.', 'Empty Cart');
      return;
    }

    if (this.paymentTotal < this.total) {
      this.notification.error(
        `Payment amount (₹${this.paymentTotal.toFixed(2)}) is less than total (₹${this.total.toFixed(2)})`,
        'Insufficient Payment'
      );
      return;
    }

    // Set processing flag early to prevent duplicate submissions
    this.processing = true;

    const saleData: any = {
      customer_id: this.saleForm.get('customer_id')?.value,
      table_number: this.saleForm.get('table_number')?.value,
      items: this.cartItems.value,
      discount_amount: this.discountAmount,
      discount_type: this.saleForm.get('discount_type')?.value,
      notes: this.saleForm.get('notes')?.value
    };

    // Add location_id for super admin
    if (this.authService.isSuperAdmin() && this.selectedLocationId) {
      saleData.location_id = this.selectedLocationId;
    }

    // First create the sale
    this.posService.createSale(saleData).subscribe({
      next: (response: any) => {
        const sale = response.sale || response;
        const saleId = sale.id;
        const saleNumber = sale.sale_number || sale.id;
        
        // Show success message when sale is created
        this.notification.success(
          `Sale #${saleNumber} created successfully! Processing payment...`,
          'Sale Created'
        );
        
        // Then complete the sale with payments
        const payments = this.paymentForm.get('payments')?.value;
        
        // Validate payment total - allow overpayment (customer can pay more, we'll give change)
        const paymentTotal = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
        const saleTotal = parseFloat(sale.total || this.total);
        
        // Only check if payment is less than sale total (underpayment not allowed)
        if (paymentTotal < saleTotal) {
          const shortage = saleTotal - paymentTotal;
          this.notification.error(
            `Payment total (₹${paymentTotal.toFixed(2)}) is less than sale total (₹${saleTotal.toFixed(2)}). Shortage: ₹${shortage.toFixed(2)}`,
            'Insufficient Payment'
          );
          this.processing = false;
          return;
        }
        
        // Show change amount if overpaid
        if (paymentTotal > saleTotal) {
          const change = paymentTotal - saleTotal;
          this.notification.info(
            `Change: ₹${change.toFixed(2)}`,
            'Overpayment'
          );
        }
        
        this.posService.completeSale(saleId, { payments }).subscribe({
          next: () => {
            this.notification.success(
              `Sale #${saleNumber} completed successfully! Total: ₹${saleTotal.toFixed(2)}`,
              'Success'
            );
            this.printReceipt(saleId);
            this.clearCart();
            this.showPaymentModal = false;
            this.processing = false;
            this.initializePaymentForm();
            this.loadRecentSales(); // Refresh sales list
          },
          error: (err) => {
            console.error('Error completing sale:', err);
            const errorMessage = err.error?.message || err.error?.error || 'Payment processing failed';
            this.notification.error(
              `Sale #${saleNumber} created but payment processing failed: ${errorMessage}`,
              'Payment Error'
            );
            this.processing = false;
            // Reload sales to show the pending sale
            this.loadRecentSales();
          }
        });
      },
      error: (err) => {
        console.error('Error creating sale:', err);
        const errorMessage = err.error?.message || err.error?.error || 'Failed to create sale. Please try again.';
        this.notification.error(errorMessage, 'Error');
        this.processing = false;
      }
    });
  }

  printReceipt(saleId: number): void {
    this.posService.printReceipt(saleId);
  }

  openCustomerModal(): void {
    this.showCustomerModal = true;
    // Load customers on demand when modal opens
    if (this.customers.length === 0) {
      this.loadCustomers();
    }
  }

  selectCustomer(customer: any): void {
    this.saleForm.patchValue({ customer_id: customer.id });
    this.showCustomerModal = false;
    this.notification.info(`Customer selected: ${customer.person?.first_name} ${customer.person?.last_name}`);
  }

  openDiscountModal(): void {
    this.showDiscountModal = true;
  }

  applyDiscount(): void {
    this.showDiscountModal = false;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
  }

  closeCustomerModal(): void {
    this.showCustomerModal = false;
  }

  closeDiscountModal(): void {
    this.showDiscountModal = false;
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  getItemName(item: any, index: number): string {
    const itemId = item.get('menu_item_id')?.value || item.get('item_id')?.value || null;
    if (!itemId) return 'Item';
    const foundItem = this.items.find(it => it.id === itemId);
    if (!foundItem) return 'Item';
    
    // Check if there's a variant
    const variantId = item.get('menu_item_variant_id')?.value;
    if (variantId && foundItem.variants) {
      const variant = foundItem.variants.find((v: any) => v.id === variantId);
      if (variant) {
        return `${foundItem.name} - ${variant.name}`;
      }
    }
    
    return foundItem.name;
  }

  getItemPrice(item: any): number {
    const control = item.get('unit_price');
    return control ? control.value : 0;
  }

  getItemQuantity(item: any): number {
    const control = item.get('quantity');
    return control ? control.value : 0;
  }

  getQuantityControl(item: any): FormControl {
    return item.get('quantity') as FormControl;
  }

  onQuantityBlur(item: any, index: number): void {
    const control = this.getQuantityControl(item);
    const value = parseInt(control.value, 10);
    if (isNaN(value) || value < 1) {
      control.setValue(1);
    } else {
      // Ensure it's a whole number
      control.setValue(Math.floor(value));
    }
  }

  onQuantityKeydown(event: KeyboardEvent): void {
    // Prevent decimal point, minus sign (except for navigation), and 'e' (scientific notation)
    const invalidKeys = ['.', 'e', 'E', '+'];
    if (invalidKeys.includes(event.key) || (event.key === '-' && event.target instanceof HTMLInputElement && event.target.selectionStart !== 0)) {
      event.preventDefault();
    }
  }

  getPaymentControls(): any[] {
    const paymentsControl = this.paymentForm.get('payments') as FormArray;
    if (paymentsControl && paymentsControl.controls) {
      return paymentsControl.controls;
    }
    return [];
  }

  getCustomerStatusText(): string {
    const customerControl = this.saleForm.get('customer_id');
    return (customerControl && customerControl.value) ? 'Customer Selected' : 'Select Customer';
  }

  getDiscountPlaceholder(): string {
    const discountTypeControl = this.saleForm.get('discount_type');
    if (discountTypeControl && discountTypeControl.value === 'percentage') {
      return 'Enter percentage (e.g., 10)';
    }
    return 'Enter amount';
  }

  toggleSalesList(): void {
    this.showSalesList = !this.showSalesList;
    if (this.showSalesList) {
      this.loadRecentSales();
    }
  }

  editSale(sale: any): void {
    this.editingSale = { ...sale };
    this.showEditModal = true;
    
    // Load sale items into cart
    this.clearCart();
    if (sale.items && sale.items.length > 0) {
      sale.items.forEach((item: any) => {
        const itemForm = this.fb.group({
          menu_item_id: [item.menu_item_id || item.menuItem?.id, Validators.required],
          quantity: [item.quantity, Validators.required],
          unit_price: [item.unit_price, Validators.required],
          discount_amount: [item.discount_amount || 0],
          tax_rate: [item.tax_rate || 0],
          notes: [item.notes || '']
        });
        this.cartItems.push(itemForm);
      });
    }
    
    // Set sale form values
    this.saleForm.patchValue({
      customer_id: sale.customer_id,
      table_number: sale.table_number || '',
      discount_amount: sale.discount_amount || 0,
      discount_type: sale.discount_type || 'fixed',
      notes: sale.notes || ''
    });
  }

  updateSale(): void {
    if (this.cartItems.length === 0) {
      this.notification.warning('Cart is empty');
      return;
    }

    if (!this.editingSale) {
      return;
    }

    this.processing = true;

    const saleData: any = {
      customer_id: this.saleForm.get('customer_id')?.value,
      table_number: this.saleForm.get('table_number')?.value,
      items: this.cartItems.value,
      discount_amount: this.discountAmount,
      discount_type: this.saleForm.get('discount_type')?.value,
      notes: this.saleForm.get('notes')?.value
    };

    this.posService.updateSale(this.editingSale.id, saleData).subscribe({
      next: (sale) => {
        this.notification.success('Sale updated successfully!');
        this.showEditModal = false;
        this.editingSale = null;
        this.clearCart();
        this.loadRecentSales(); // Refresh sales list
        this.processing = false;
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error updating sale');
        this.processing = false;
        this.loadRecentSales(); // Refresh even on error
      }
    });
  }

  openCancelModal(sale: any): void {
    this.selectedSaleForCancel = sale;
    this.cancelReason = '';
    this.showCancelModal = true;
  }

  cancelSale(): void {
    if (!this.selectedSaleForCancel) {
      return;
    }

    this.processing = true;

    this.posService.cancelSale(this.selectedSaleForCancel.id, this.cancelReason).subscribe({
      next: () => {
        this.notification.success('Sale cancelled successfully!');
        this.showCancelModal = false;
        this.selectedSaleForCancel = null;
        this.cancelReason = '';
        this.loadRecentSales(); // Refresh sales list
        this.processing = false;
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error cancelling sale');
        this.processing = false;
        this.loadRecentSales(); // Refresh even on error
      }
    });
  }

  printBill(sale: any): void {
    this.posService.printReceipt(sale.id);
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingSale = null;
    this.clearCart();
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.selectedSaleForCancel = null;
    this.cancelReason = '';
  }

  getSaleStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'pending': return 'status-pending';
      case 'cancelled': return 'status-cancelled';
      case 'refunded': return 'status-refunded';
      default: return '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  openTableModal(): void {
    this.showTableModal = true;
  }

  getPaginationPages(): (number | string)[] {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (this.lastPage <= maxVisible) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= this.lastPage; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);
      
      if (this.currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, this.currentPage - 1);
      const end = Math.min(this.lastPage - 1, this.currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (this.currentPage < this.lastPage - 2) {
        pages.push('...');
      }
      
      // Show last page
      pages.push(this.lastPage);
    }
    
    return pages;
  }

  // Expose Math to template
  Math = Math;

}
