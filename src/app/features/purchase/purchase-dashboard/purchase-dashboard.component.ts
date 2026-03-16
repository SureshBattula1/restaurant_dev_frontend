import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { PurchaseService, PurchaseOrder, PurchaseItem, Supplier } from '../../../core/services/purchase.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableConfig, DataTableParams, DataTablePagination } from '../../../shared/interfaces/datatable-config.interface';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AdminService } from '../../../core/services/admin.service';
import { Subject } from 'rxjs';
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

@Component({
  selector: 'app-purchase-dashboard',
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
    MatTooltipModule
  ],
  templateUrl: './purchase-dashboard.component.html',
  styleUrls: ['./purchase-dashboard.component.css']
})
export class PurchaseDashboardComponent implements OnInit {
  currentUser: any;
  activeTab: 'orders' | 'receivings' | 'suppliers' = 'orders';
  
  purchaseOrders: PurchaseOrder[] = [];
  receivings: any[] = [];
  suppliers: Supplier[] = [];
  
  // DataTable configurations
  purchaseOrdersTableConfig!: DataTableConfig;
  purchaseOrdersTableData: PurchaseOrder[] = [];
  purchaseOrdersTablePagination: DataTablePagination | null = null;
  purchaseOrdersTableLoading = false;
  purchaseOrdersRealtimeUpdates$ = new Subject<any>();

  receivingsTableConfig!: DataTableConfig;
  receivingsTableData: any[] = [];
  receivingsTablePagination: DataTablePagination | null = null;
  receivingsTableLoading = false;
  receivingsRealtimeUpdates$ = new Subject<any>();

  locations: any[] = [];
  selectedLocationId?: number;
  dashboardStats: { pending: number; confirmed: number; received: number; total_purchase_cost: number } | null = null;
  
  poForm: FormGroup;
  receivingForm: FormGroup;
  supplierForm: FormGroup;
  
  showPOModal = false;
  showReceivingModal = false;
  showSupplierModal = false;
  selectedPO: PurchaseOrder | null = null;
  selectedPOForReceiving: PurchaseOrder | null = null;
  showRevertModal = false;
  selectedPOForRevert: PurchaseOrder | null = null;
  revertItemSelections: Set<number> = new Set();
  selectedSupplier: Supplier | null = null;
  items: any[] = [];
  allItems: any[] = [];
  poItemAutocompleteStates: { [key: number]: { query: string; showDropdown: boolean; filteredItems: any[] } } = {};
  private searchTimeouts: { [key: string]: any } = {};

  constructor(
    private fb: FormBuilder,
    private purchaseService: PurchaseService,
    private inventoryService: InventoryService,
    private authService: AuthService,
    private router: Router,
    private notification: NotificationService,
    @Inject(RealtimeService) private realtimeService: RealtimeService,
    private adminService: AdminService
  ) {
    this.poForm = this.fb.group({
      supplier_id: [null, Validators.required],
      location_id: [null],
      order_date: [new Date().toISOString().split('T')[0], Validators.required],
      expected_date: [null],
      items: this.fb.array([]),
      notes: ['']
    });

    this.receivingForm = this.fb.group({
      purchase_order_id: [null, Validators.required],
      receiving_date: [new Date().toISOString().split('T')[0], Validators.required],
      items: this.fb.array([]),
      notes: ['']
    });

    this.supplierForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      email: ['', Validators.email],
      phone: [''],
      whatsapp_number: [''],
      company_name: [''],
      tax_id: [''],
      payment_terms: [''],
      address: ['']
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadLocations();
    this.loadDashboardStats();
    this.initializePurchaseOrdersTableConfig();
    this.initializeReceivingsTableConfig();
    this.setupRealtimeUpdates();
    this.loadSuppliers();
    this.loadItems();
  }

  loadLocations(): void {
    if (this.isSuperAdmin()) {
      this.adminService.getLocations().subscribe({
        next: (locations) => {
          this.locations = locations;
        },
        error: (err) => console.error('Error loading locations:', err)
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

  initializePurchaseOrdersTableConfig(): void {
    this.purchaseOrdersTableConfig = {
      columns: [
        { key: 'po_number', label: 'PO Number', sortable: true, width: '12%' },
        { key: 'supplier.person.name', label: 'Supplier', sortable: true, format: (v, row) => row.supplier?.person?.name || (row.supplier?.person?.first_name || '') + ' ' + (row.supplier?.person?.last_name || '') || 'N/A', width: '15%' },
        { key: 'order_date', label: 'Order Date', sortable: true, type: 'date', format: (v) => v ? new Date(v).toLocaleDateString() : '-', width: '10%' },
        { key: 'expected_date', label: 'Expected Date', sortable: true, type: 'date', format: (v) => v ? new Date(v).toLocaleDateString() : '-', width: '10%' },
        { key: 'total', label: 'Total', sortable: true, type: 'currency', format: (v) => `₹${Number(v || 0).toFixed(2)}`, width: '10%' },
        { key: 'status', label: 'Status', sortable: true, type: 'status', format: (v) => v, width: '10%' }
      ],
      filters: [
        { key: 'dateRange', label: 'Date Range', type: 'dateRange' },
        { key: 'status', label: 'Status', type: 'select', options: [
          { value: 'CREATED', label: 'Created' },
          { value: 'SENT_TO_SUPPLIER', label: 'Sent' },
          { value: 'SUPPLIER_SUBMITTED', label: 'Supplier Submitted' },
          { value: 'CONFIRMED', label: 'Confirmed' },
          { value: 'RECEIVED', label: 'Received' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' }
        ]}
      ],
      actions: [
        { label: 'View', icon: 'visibility', color: 'primary', action: (row) => this.openPOModal(row), tooltip: 'View purchase order' },
        { label: 'Send', icon: 'send', color: 'accent', action: (row) => this.sendToSupplier(row), tooltip: 'Send to supplier', condition: (row) => row.status === 'CREATED' },
        { label: 'Get Link', icon: 'link', color: 'primary', action: (row) => this.copySupplierLink(row), tooltip: 'Copy link to send manually to supplier', condition: (row) => ['CREATED', 'SENT_TO_SUPPLIER'].includes(row.status) },
        { label: 'Confirm', icon: 'check_circle', color: 'primary', action: (row) => this.confirmPO(row), tooltip: 'Confirm order', condition: (row) => row.status === 'SUPPLIER_SUBMITTED' },
        { label: 'Revert', icon: 'undo', color: 'warn', action: (row) => this.revertPO(row), tooltip: 'Revert all items', condition: (row) => row.status === 'CONFIRMED' },
        { label: 'Revert Item', icon: 'restore', color: 'warn', action: (row) => this.openRevertModal(row), tooltip: 'Revert selected items', condition: (row) => row.status === 'CONFIRMED' },
        { label: 'Edit', icon: 'edit', color: 'accent', action: (row) => this.editPO(row), tooltip: 'Edit order', condition: (row) => ['CREATED', 'SENT_TO_SUPPLIER'].includes(row.status) },
        { label: 'Receive', icon: 'inventory', color: 'accent', action: (row) => this.openReceivingModal(row), tooltip: 'Receive goods', condition: (row) => ['CONFIRMED', 'RECEIVED'].includes(row.status) },
        { label: 'Cancel', icon: 'cancel', color: 'warn', action: (row) => this.cancelPO(row), tooltip: 'Cancel', condition: (row) => !['RECEIVED', 'COMPLETED', 'CANCELLED'].includes(row.status) },
        { label: 'Excel', icon: 'table_chart', color: 'primary', action: (row) => this.exportExcel(row), tooltip: 'Export Excel' },
        { label: 'PDF', icon: 'picture_as_pdf', color: 'warn', action: (row) => this.exportPdf(row), tooltip: 'Export PDF' }
      ],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No purchase orders found',
      loadingMessage: 'Loading purchase orders...'
    };
  }

  initializeReceivingsTableConfig(): void {
    this.receivingsTableConfig = {
      columns: [
        { key: 'receiving_number', label: 'Receiving #', sortable: true, width: '12%' },
        { key: 'purchaseOrder.po_number', label: 'PO Number', sortable: true, width: '12%' },
        { key: 'receiving_date', label: 'Date', sortable: true, type: 'date', format: (v) => v ? new Date(v).toLocaleDateString() : '-', width: '10%' },
        { key: 'status', label: 'Status', sortable: true, type: 'status', format: (v) => v, width: '10%' }
      ],
      filters: [
        { key: 'dateRange', label: 'Date Range', type: 'dateRange' },
        { key: 'status', label: 'Status', type: 'select', options: [
          { value: 'pending', label: 'Pending' },
          { value: 'received', label: 'Received' },
          { value: 'completed', label: 'Completed' }
        ]}
      ],
      actions: [
        { label: 'View', icon: 'visibility', color: 'primary', action: (row) => this.viewReceiving(row.id), tooltip: 'View receiving details' }
      ],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No receivings found',
      loadingMessage: 'Loading receivings...'
    };
  }

  setupRealtimeUpdates(): void {
    this.realtimeService.purchaseOrderUpdates$.subscribe(() => {
      this.purchaseOrdersRealtimeUpdates$.next({ type: 'refresh' });
    });
    // Add receivings updates if available
  }

  loadPurchaseOrdersTableData = async (params: DataTableParams): Promise<any> => {
    this.purchaseOrdersTableLoading = true;
    
    const requestParams: any = {
      page: params.page || 1,
      per_page: params.per_page || 10,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
      date_from: params.date_from,
      date_to: params.date_to
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
      this.purchaseService.getPurchaseOrders(requestParams).subscribe({
        next: (response: any) => {
          let data: PurchaseOrder[] = [];
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

          this.purchaseOrdersTableData = data;
          this.purchaseOrdersTablePagination = pagination;
          this.purchaseOrdersTableLoading = false;

          resolve({ data, pagination });
        },
        error: (err) => {
          console.error('Error loading purchase orders:', err);
          this.notification.error('Error loading purchase orders');
          this.purchaseOrdersTableLoading = false;
          reject(err);
        }
      });
    });
  };

  loadReceivingsTableData = async (params: DataTableParams): Promise<any> => {
    this.receivingsTableLoading = true;
    
    const requestParams: any = {
      page: params.page || 1,
      per_page: params.per_page || 10,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
      date_from: params.date_from,
      date_to: params.date_to
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
      this.purchaseService.getReceivings(requestParams).subscribe({
        next: (response: any) => {
          let data: any[] = [];
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

          this.receivingsTableData = data;
          this.receivingsTablePagination = pagination;
          this.receivingsTableLoading = false;

          resolve({ data, pagination });
        },
        error: (err) => {
          console.error('Error loading receivings:', err);
          this.notification.error('Error loading receivings');
          this.receivingsTableLoading = false;
          reject(err);
        }
      });
    });
  };

  get poItems(): FormArray {
    return this.poForm.get('items') as FormArray;
  }

  get receivingItems(): FormArray {
    return this.receivingForm.get('items') as FormArray;
  }

  switchTab(tab: string): void {
    if (tab === 'orders' || tab === 'receivings' || tab === 'suppliers') {
      this.activeTab = tab as 'orders' | 'receivings' | 'suppliers';
    }
  }

  loadPurchaseOrders(): void {
    // Trigger DataTable reload
    this.purchaseOrdersRealtimeUpdates$.next({ type: 'refresh' });
  }

  loadReceivings(): void {
    // Trigger DataTable reload
    this.receivingsRealtimeUpdates$.next({ type: 'refresh' });
  }

  loadDashboardStats(): void {
    const params: any = {};
    if (this.isSuperAdmin() && this.selectedLocationId) params.location_id = this.selectedLocationId;
    else if (!this.isSuperAdmin() && this.currentUser?.location_id) params.location_id = this.currentUser.location_id;
    this.purchaseService.getPurchaseDashboard(params).subscribe({
      next: (data) => (this.dashboardStats = data),
      error: () => (this.dashboardStats = null),
    });
  }

  loadSuppliers(): void {
    this.purchaseService.getSuppliers().subscribe({
      next: (response: any) => {
        this.suppliers = response.data || response;
      },
      error: (err) => console.error('Error loading suppliers:', err)
    });
  }

  loadItems(): void {
    this.loadAllItemsForAutocomplete();
  }

  loadAllItemsForAutocomplete(): void {
    const params = { per_page: 100, page: 1 };
    this.inventoryService.getItems(params).subscribe({
      next: (response: any) => {
        let items: any[] = response.data || (Array.isArray(response) ? response : []);
        this.items = items;
        this.allItems = items;
        if (response.pagination && response.pagination.last_page > 1) {
          this.loadRemainingItemPages(response.pagination.last_page, items);
        }
      },
      error: (err) => {
        console.error('Error loading items:', err);
        this.allItems = [];
      }
    });
  }

  private loadRemainingItemPages(totalPages: number, currentItems: any[]): void {
    const requests = [];
    for (let page = 2; page <= totalPages; page++) {
      requests.push(this.inventoryService.getItems({ per_page: 100, page }).toPromise());
    }
    Promise.all(requests).then((responses: any[]) => {
      let allItems = [...currentItems];
      responses.forEach((response: any) => {
        if (response?.data && Array.isArray(response.data)) {
          allItems = allItems.concat(response.data);
        }
      });
      this.items = allItems;
      this.allItems = allItems;
    }).catch(() => {});
  }

  /** Match item if ALL search words appear in name, sku, or barcode (any order). */
  private itemMatchesSearch(item: any, query: string): boolean {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const name = (item.name || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    const barcode = (item.barcode || '').toLowerCase();
    return words.every(word => name.includes(word) || sku.includes(word) || barcode.includes(word));
  }

  // Auto-search methods for Purchase Order items
  filterItemsForPO(query: string, index: number): void {
    const stateKey = `po-${index}`;
    
    // Clear previous timeout
    if (this.searchTimeouts[stateKey]) {
      clearTimeout(this.searchTimeouts[stateKey]);
    }

    // Debounce search for better performance
    this.searchTimeouts[stateKey] = setTimeout(() => {
      if (!this.poItemAutocompleteStates[index]) {
        this.poItemAutocompleteStates[index] = { query: '', showDropdown: false, filteredItems: [] };
      }

      this.poItemAutocompleteStates[index].query = query;
      
      if (!query || query.trim() === '') {
        this.poItemAutocompleteStates[index].filteredItems = this.allItems.slice(0, 100);
      } else {
        this.poItemAutocompleteStates[index].filteredItems = this.allItems
          .filter(item => this.itemMatchesSearch(item, query))
          .slice(0, 100);
      }
      
      this.poItemAutocompleteStates[index].showDropdown = this.poItemAutocompleteStates[index].filteredItems.length > 0;
    }, 150);
  }

  selectItemForPO(itemId: number, index: number): void {
    const selectedItem = this.allItems.find(item => item.id === itemId);
    
    if (selectedItem) {
      this.poItems.at(index).patchValue({ item_id: itemId });
      
      if (this.poItemAutocompleteStates[index]) {
        this.poItemAutocompleteStates[index].showDropdown = false;
        this.poItemAutocompleteStates[index].query = selectedItem.name;
        this.poItemAutocompleteStates[index].filteredItems = [];
      }
    }
  }

  closeAutocompletePO(index: number): void {
    if (this.poItemAutocompleteStates[index]) {
      setTimeout(() => {
        if (this.poItemAutocompleteStates[index]) {
          this.poItemAutocompleteStates[index].showDropdown = false;
        }
      }, 200);
    }
  }

  onAutocompleteItemHover(event: Event): void {
    const target = event.target as HTMLElement;
    if (target) {
      target.style.backgroundColor = '#f5f5f5';
    }
  }

  onAutocompleteItemLeave(event: Event): void {
    const target = event.target as HTMLElement;
    if (target) {
      target.style.backgroundColor = 'white';
    }
  }

  openPOModal(po?: PurchaseOrder): void {
    this.selectedPO = po || null;
    this.poItems.clear();
    
    if (po) {
      this.poForm.patchValue({
        supplier_id: po.supplier_id,
        location_id: po.location_id,
        order_date: po.order_date,
        expected_date: po.expected_date,
        notes: po.notes
      });
      // Show row data immediately, then fetch fresh data for latest supplier-submitted values
      if (po.items?.length) {
        po.items.forEach((item: any) => this.addPOItem(item));
      }
      this.purchaseService.getPurchaseOrder(po.id).subscribe({
        next: (freshPo) => {
          this.selectedPO = freshPo;
          const items = freshPo.items;
          if (items?.length) {
            this.poItems.clear();
            items.forEach((item: any) => this.addPOItem(item));
          }
        },
        error: () => {}
      });
    } else {
      this.poForm.patchValue({
        location_id: this.selectedLocationId ?? this.currentUser?.location_id ?? null
      });
      this.addPOItem();
    }
    
    this.showPOModal = true;
    this.loadAllItemsForAutocomplete();
  }

  addPOItem(item?: any): void {
    const itemForm = this.fb.group({
      item_id: [item?.item_id || null, Validators.required],
      quantity: [item?.quantity ?? item?.required_qty ?? 0, [Validators.required, Validators.min(0.01)]],
      unit_cost: [item?.unit_cost ?? 0, [Validators.required, Validators.min(0)]],
      tax_rate: [item?.tax_rate ?? 0, Validators.min(0)]
    });
    this.poItems.push(itemForm);
  }

  removePOItem(index: number): void {
    this.poItems.removeAt(index);
  }

  savePurchaseOrder(sendToSupplierAfterCreate = false): void {
    if (this.poForm.invalid) return;

    const rawData = this.poForm.value;
    // Clean payload: convert empty expected_date to null for validation
    const poData = {
      ...rawData,
      expected_date: rawData.expected_date || null,
      items: (rawData.items || []).filter((item: any) => item.item_id && item.quantity > 0),
    };

    if (this.selectedPO) {
      this.purchaseService.updatePurchaseOrder(this.selectedPO.id, poData).subscribe({
        next: () => {
          this.notification.success('Order updated');
          this.purchaseOrdersRealtimeUpdates$.next({ type: 'refresh' });
          this.loadDashboardStats();
          this.showPOModal = false;
        },
        error: (err) => this.notification.error(err.error?.message || 'Update failed'),
      });
    } else {
      // Location is required for create
      const locationId = poData.location_id ?? (this.isSuperAdmin() ? this.selectedLocationId : this.currentUser?.location_id);
      if (!locationId) {
        this.notification.error('Please select a location first');
        return;
      }
      const createPayload = { ...poData, location_id: locationId };

      this.purchaseService.createPurchaseOrder(createPayload).subscribe({
        next: (response: any) => {
          const createdPo = (response as any).purchase_order || response;
          this.notification.success('Purchase order created successfully');
          this.purchaseOrdersRealtimeUpdates$.next({ type: 'created', data: createdPo });
          this.loadDashboardStats();
          this.showPOModal = false;

          if (sendToSupplierAfterCreate && createdPo?.id) {
            this.purchaseService.sendToSupplier(createdPo.id).subscribe({
              next: (res: any) => {
                this.notification.success(res?.message || 'Order sent to supplier via WhatsApp');
                this.loadPurchaseOrders();
                this.loadDashboardStats();
              },
              error: (err) => this.notification.warning(err.error?.message || 'Order created but failed to send to supplier'),
            });
          }
        },
        error: (err) => {
          const msg = err.error?.message || err.error?.errors ? JSON.stringify(err.error?.errors) : 'Error creating purchase order';
          this.notification.error(msg);
        },
      });
    }
  }

  openReceivingModal(po: PurchaseOrder): void {
    this.selectedPOForReceiving = po;
    this.receivingForm.patchValue({
      purchase_order_id: po.id,
      receiving_date: new Date().toISOString().split('T')[0]
    });
    this.receivingItems.clear();
    this.purchaseService.getPurchaseOrder(po.id).subscribe({
      next: (freshPo) => {
        this.selectedPOForReceiving = freshPo;
        const items = freshPo.items || [];
        items.forEach((item: any) => {
          const qty = item.supplier_qty ?? item.required_qty ?? item.quantity ?? 0;
          const cost = item.price ?? item.unit_cost ?? 0;
          const remainingQty = Math.max(0, (qty || 0) - (item.received_quantity || 0));
          this.receivingItems.push(this.fb.group({
            purchase_item_id: [item.id],
            item_id: [item.item_id],
            quantity: [remainingQty > 0 ? remainingQty : qty, [Validators.required, Validators.min(0)]],
            unit_cost: [cost, [Validators.required, Validators.min(0)]],
            expiry_date: [null],
            required_qty: [item.required_qty ?? item.quantity],
            supplier_qty: [item.supplier_qty]
          }));
        });
      },
      error: () => {
        this.selectedPOForReceiving = po;
        if (po.items) {
          po.items.forEach((item: any) => {
            const qty = item.supplier_qty ?? item.required_qty ?? item.quantity ?? 0;
            const cost = item.price ?? item.unit_cost ?? 0;
            this.receivingItems.push(this.fb.group({
              purchase_item_id: [item.id],
              item_id: [item.item_id],
              quantity: [qty, [Validators.required, Validators.min(0)]],
              unit_cost: [cost, [Validators.required, Validators.min(0)]],
              expiry_date: [null],
              required_qty: [item.required_qty ?? item.quantity],
              supplier_qty: [item.supplier_qty]
            }));
          });
        }
      }
    });
    this.showReceivingModal = true;
  }

  saveReceiving(): void {
    if (this.receivingForm.invalid) return;

    const raw = this.receivingForm.value;
    const items = (raw.items || []).filter((it: any) => it.quantity > 0).map((it: any) => ({
        purchase_item_id: it.purchase_item_id,
        item_id: it.item_id,
        quantity: it.quantity,
        unit_cost: it.unit_cost,
        expiry_date: it.expiry_date
      }));
    if (items.length === 0) {
      this.notification.error('Add at least one item with quantity > 0');
      return;
    }
    const receivingData = { ...raw, items };
    this.purchaseService.createReceiving(receivingData).subscribe({
      next: (response: any) => {
        this.notification.success('Goods received successfully');
        this.receivingsRealtimeUpdates$.next({ type: 'created', data: (response as any).receiving || response });
        this.purchaseOrdersRealtimeUpdates$.next({ type: 'refresh' });
        this.loadDashboardStats();
        this.showReceivingModal = false;
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error receiving goods');
      }
    });
  }

  openSupplierModal(supplier?: Supplier): void {
    this.selectedSupplier = supplier || null;
    if (supplier) {
      this.supplierForm.patchValue({
        first_name: supplier.person?.first_name || '',
        last_name: supplier.person?.last_name || '',
        email: supplier.person?.email || '',
        phone: supplier.person?.phone || '',
        whatsapp_number: supplier.person?.whatsapp_number || supplier.whatsapp_number || '',
        company_name: supplier.company_name || '',
        tax_id: supplier.tax_id || '',
        payment_terms: supplier.payment_terms || '',
        address: supplier.person?.address || ''
      });
    } else {
      this.supplierForm.patchValue({ whatsapp_number: '' });
    }
    this.showSupplierModal = true;
  }

  saveSupplier(): void {
    if (this.supplierForm.invalid) return;

    const supplierData = this.supplierForm.value;
    if (this.selectedSupplier) {
      this.purchaseService.updateSupplier(this.selectedSupplier.id, supplierData).subscribe({
        next: () => {
          this.notification.success('Supplier updated successfully');
          this.loadSuppliers();
          this.showSupplierModal = false;
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error updating supplier');
        }
      });
    } else {
      this.purchaseService.createSupplier(supplierData).subscribe({
        next: () => {
          this.notification.success('Supplier created successfully');
          this.loadSuppliers();
          this.showSupplierModal = false;
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error creating supplier');
        }
      });
    }
  }

  sendToSupplier(po: PurchaseOrder): void {
    this.purchaseService.sendToSupplier(po.id).subscribe({
      next: (res: any) => {
        this.notification.success(res?.message || 'Order sent to supplier');
        if (res?.supplier_link) this.notification.info('Link: ' + res.supplier_link);
        this.loadPurchaseOrders();
        this.loadDashboardStats();
      },
      error: (err) => this.notification.error(err.error?.message || 'Failed to send'),
    });
  }

  copySupplierLink(po: PurchaseOrder): void {
    if (!po?.secure_token) {
      this.notification.error('Order link not available');
      return;
    }
    const link = `${window.location.origin}/supplier-order/${po.secure_token}`;
    navigator.clipboard.writeText(link).then(() => {
      this.notification.success('Link copied! Send this to your supplier manually (WhatsApp, email, etc.)');
    }).catch(() => {
      this.notification.error('Could not copy link');
    });
  }

  confirmPO(po: PurchaseOrder): void {
    if (confirm('Confirm this order? Inventory will be updated.')) {
      this.purchaseService.confirmPurchaseOrder(po.id).subscribe({
        next: () => {
          this.notification.success('Order confirmed and inventory updated');
          this.loadPurchaseOrders();
          this.loadDashboardStats();
        },
        error: (err) => this.notification.error(err.error?.message || 'Failed'),
      });
    }
  }

  revertPO(po: PurchaseOrder): void {
    if (confirm('Revert confirmation? Inventory will be reversed for all items.')) {
      this.purchaseService.revertPurchaseOrder(po.id).subscribe({
        next: () => {
          this.notification.success('Order reverted');
          this.loadPurchaseOrders();
          this.loadDashboardStats();
        },
        error: (err) => this.notification.error(err.error?.message || 'Failed'),
      });
    }
  }

  openRevertModal(po: PurchaseOrder): void {
    this.purchaseService.getPurchaseOrder(po.id).subscribe({
      next: (freshPo) => {
        this.selectedPOForRevert = freshPo;
        this.revertItemSelections = new Set();
        this.showRevertModal = true;
      },
      error: () => {
        this.selectedPOForRevert = po;
        this.revertItemSelections = new Set();
        this.showRevertModal = true;
      }
    });
  }

  closeRevertModal(): void {
    this.showRevertModal = false;
    this.selectedPOForRevert = null;
    this.revertItemSelections = new Set();
  }

  toggleRevertItem(purchaseItemId: number | undefined): void {
    if (purchaseItemId == null) return;
    if (this.revertItemSelections.has(purchaseItemId)) {
      this.revertItemSelections.delete(purchaseItemId);
    } else {
      this.revertItemSelections.add(purchaseItemId);
    }
    this.revertItemSelections = new Set(this.revertItemSelections);
  }

  isRevertItemSelected(purchaseItemId: number | undefined): boolean {
    return purchaseItemId != null && this.revertItemSelections.has(purchaseItemId);
  }

  revertSelectedItems(): void {
    if (!this.selectedPOForRevert || this.revertItemSelections.size === 0) {
      this.notification.error('Select at least one item to revert');
      return;
    }
    if (!confirm(`Revert ${this.revertItemSelections.size} selected item(s)? Stock will be reduced.`)) return;
    const orderId = this.selectedPOForRevert.id;
    const ids = Array.from(this.revertItemSelections);
    let completed = 0;
    const total = ids.length;
    ids.forEach((purchaseItemId) => {
      this.purchaseService.revertPurchaseItem(orderId, purchaseItemId).subscribe({
        next: () => {
          completed++;
          if (completed === total) {
            this.notification.success('Selected items reverted');
            this.closeRevertModal();
            this.loadPurchaseOrders();
            this.loadDashboardStats();
          }
        },
        error: (err) => this.notification.error(err.error?.message || 'Revert failed')
      });
    });
  }

  revertAllItems(): void {
    if (!this.selectedPOForRevert) return;
    this.closeRevertModal();
    this.revertPO(this.selectedPOForRevert);
  }

  editPO(po: PurchaseOrder): void {
    this.openPOModal(po);
  }

  exportExcel(po: PurchaseOrder): void {
    this.purchaseService.exportExcel(po.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `purchase-order-${po.po_number}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.notification.success('Export downloaded');
      },
      error: (err) => this.notification.error(err.error?.message || 'Export failed'),
    });
  }

  exportPdf(po: PurchaseOrder): void {
    this.purchaseService.exportPdf(po.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `purchase-order-${po.po_number}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.notification.success('Export downloaded');
      },
      error: (err) => this.notification.error('Export failed'),
    });
  }

  cancelPO(po: PurchaseOrder): void {
    if (confirm('Cancel this purchase order?')) {
      this.purchaseService.cancelPurchaseOrder(po.id).subscribe({
        next: () => {
          this.notification.success('Purchase order cancelled');
          this.loadPurchaseOrders();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error cancelling purchase order');
        }
      });
    }
  }

  closePOModal(): void {
    this.showPOModal = false;
  }

  closeReceivingModal(): void {
    this.showReceivingModal = false;
  }

  closeSupplierModal(): void {
    this.showSupplierModal = false;
  }

  getItemName(itemIdOrItem: number | null | undefined | any): string {
    if (itemIdOrItem == null) return '';
    if (typeof itemIdOrItem === 'object' && itemIdOrItem.item?.name) return itemIdOrItem.item.name;
    const itemId = typeof itemIdOrItem === 'object' ? itemIdOrItem.item_id : itemIdOrItem;
    if (!itemId) return '';
    const item = this.allItems.find(i => i.id === itemId) || this.items.find(i => i.id === itemId);
    return item ? item.name : '';
  }

  isSupplierSubmittedView(): boolean {
    const status = this.selectedPO?.status;
    return !!status && ['SUPPLIER_SUBMITTED', 'CONFIRMED', 'RECEIVED', 'COMPLETED'].includes(status);
  }

  getSupplierName(po: PurchaseOrder | null): string {
    if (!po?.supplier) return '';
    const p = po.supplier.person || po.supplier;
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || po.supplier.company_name || '';
  }

  getSupplierPhone(po: PurchaseOrder | null): string {
    if (!po?.supplier) return '';
    const p = po.supplier.person || po.supplier;
    return p.phone || po.supplier.whatsapp_number || '';
  }

  getSupplierSubmittedItems(): any[] {
    return this.selectedPO?.items || [];
  }

  getItemIdValue(item: any): number {
    const control = item.get('item_id');
    return control ? (control.value || 0) : 0;
  }

  viewReceiving(id: number): void {
    this.purchaseService.getReceiving(id).subscribe({
      next: (receiving) => {
        // Handle viewing receiving - you can open a modal or navigate
        console.log('Receiving:', receiving);
        this.notification.info('Receiving details loaded');
      },
      error: (err) => {
        this.notification.error('Error loading receiving details');
      }
    });
  }

  deleteSupplier(supplier: Supplier): void {
    if (confirm(`Delete supplier ${supplier.person?.first_name} ${supplier.person?.last_name}?`)) {
      this.purchaseService.deleteSupplier(supplier.id).subscribe({
        next: () => {
          this.notification.success('Supplier deleted successfully');
          this.loadSuppliers();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error deleting supplier');
        }
      });
    }
  }

}

