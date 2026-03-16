import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface MenuItemVariant {
  id?: number;
  menu_item_id?: number;
  name: string;
  slug?: string;
  price: number;
  display_order?: number;
  is_default?: boolean;
  status?: 'active' | 'inactive';
}

export interface Item {
  is_active_in_location?: boolean;
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  selling_price: number;
  cost_price: number;
  tax_rate: number;
  category?: any;
  images?: any[];
  variants?: MenuItemVariant[];
}

export interface SaleItem {
  menu_item_id: number; // Changed from item_id
  menu_item_variant_id?: number;
  quantity: number;
  unit_price?: number;
  discount_amount?: number;
  tax_rate?: number;
  notes?: string;
}

export interface CreateSaleRequest {
  customer_id?: number;
  table_number?: string;
  items: SaleItem[];
  discount_amount?: number;
  discount_type?: 'percentage' | 'fixed';
  notes?: string;
}

export interface Sale {
  id: number;
  sale_number: string;
  total: number;
  status: string;
  items: any[];
}

@Injectable({
  providedIn: 'root'
})
export class PosService {
  constructor(private api: ApiService) {}

  getMenuItems(locationId?: number, page: number = 1, perPage: number = 20, categoryId?: number, search: string = ''): Observable<any> {
    const params: any = { page, per_page: perPage };
    if (locationId) params.location_id = locationId;
    if (categoryId) params.category_id = categoryId;
    if (search) params.search = search;
    return this.api.get<any>('/pos/menu-items', params);
  }

  searchMenuItems(query: string, categoryId?: number): Observable<Item[]> {
    const params: any = { q: query };
    if (categoryId) params.category_id = categoryId;
    return this.api.get<Item[]>(`/pos/menu-items/search`, params);
  }

  // Legacy methods for backward compatibility
  getItems(): Observable<Item[]> {
    return this.getMenuItems();
  }

  searchItems(query: string): Observable<Item[]> {
    return this.searchMenuItems(query);
  }

  createSale(saleData: CreateSaleRequest): Observable<Sale> {
    return this.api.post<Sale>('/pos/sales', saleData);
  }

  getSale(id: number): Observable<Sale> {
    return this.api.get<Sale>(`/pos/sales/${id}`);
  }

  getSaleList(params?: any): Observable<any> {
    return this.api.get<any>('/pos/sales', params);
  }

  completeSale(id: number, paymentData: { payments: any[] }): Observable<Sale> {
    return this.api.post<Sale>(`/pos/sales/${id}/complete`, paymentData);
  }

  suspendSale(saleData: CreateSaleRequest): Observable<Sale> {
    return this.api.post<Sale>('/pos/sales/suspend', saleData);
  }

  getSuspendedSales(locationId?: number, page: number = 1, perPage: number = 20): Observable<any> {
    const params: any = { page, per_page: perPage };
    if (locationId) params.location_id = locationId;
    return this.api.get<any>('/pos/sales/suspended', params);
  }

  resumeSale(id: number): Observable<Sale> {
    return this.api.post<Sale>(`/pos/sales/suspended/${id}/resume`, {});
  }

  updateSale(id: number, saleData: CreateSaleRequest): Observable<Sale> {
    return this.api.put<Sale>(`/pos/sales/${id}`, saleData);
  }

  cancelSale(id: number, reason?: string): Observable<Sale> {
    return this.api.post<Sale>(`/pos/sales/${id}/cancel`, { reason });
  }

  printReceipt(id: number): void {
    try {
      // Get base URL - remove /api to get Laravel base URL for web routes
      const baseUrl = this.api.getBaseUrl();
      const laravelBaseUrl = baseUrl.replace('/api', '');
      // Use web route instead of API route for better compatibility
      const url = `${laravelBaseUrl}/pos/sales/${id}/receipt`;
      
      // Open in new window - the receipt template will auto-print
      const printWindow = window.open(url, '_blank', 'width=800,height=600');
      
      if (!printWindow) {
        console.warn('Popup blocked. Please allow popups for this site to enable automatic printing.');
        // Fallback: open in same window
        window.location.href = url;
        return;
      }
      
      // Focus the print window
      printWindow.focus();
      
      // The receipt template has auto-print script, but we'll also try to trigger print
      // as a fallback after a delay
      setTimeout(() => {
        try {
          // Try to trigger print dialog (may fail due to cross-origin restrictions)
          printWindow.print();
        } catch (e) {
          // This is expected if cross-origin - the receipt template's script will handle it
          console.log('Auto-print will be handled by receipt page script');
        }
      }, 1000);
      
      // Optional: Close window after print (user can cancel if needed)
      // Uncomment if you want to auto-close after printing
      // printWindow.addEventListener('afterprint', () => {
      //   printWindow.close();
      // });
    } catch (error) {
      console.error('Error opening print receipt:', error);
    }
  }

  refundSale(id: number, refundData: { refund_amount: number; reason?: string }): Observable<Sale> {
    return this.api.post<Sale>(`/pos/sales/${id}/refund`, refundData);
  }

  getMenuItemByBarcode(barcode: string): Observable<Item> {
    return this.api.get<Item>(`/inventory/menu-items/barcode/${barcode}`);
  }

  // Legacy method for backward compatibility
  getItemByBarcode(barcode: string): Observable<Item> {
    return this.getMenuItemByBarcode(barcode);
  }
}

