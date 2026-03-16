import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  location_id?: number;
  order_date: string;
  expected_date?: string;
  status: string;
  total: number;
  notes?: string;
  secure_token?: string;
  items?: PurchaseItem[];
  supplier?: Supplier;
  purchase_order?: PurchaseOrder;
}

export interface PurchaseItem {
  id?: number;
  item_id: number;
  quantity: number;
  required_qty?: number;
  supplier_qty?: number;
  price?: number;
  received_quantity?: number;
  unit_cost: number;
  tax_rate?: number;
  item?: any;
}

export interface Receiving {
  id: number;
  receiving_number: string;
  purchase_order_id: number;
  receiving_date: string;
  status: string;
}

export interface Supplier {
  id: number;
  supplier_code: string;
  company_name?: string;
  tax_id?: string;
  payment_terms?: string;
  whatsapp_number?: string;
  balance?: number;
  person?: any;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  constructor(private api: ApiService) {}

  getPurchaseOrders(params?: any): Observable<{ data: PurchaseOrder[] }> {
    return this.api.get<{ data: PurchaseOrder[] }>('/purchase/orders', params);
  }

  createPurchaseOrder(order: any): Observable<PurchaseOrder> {
    return this.api.post('/purchase/orders', order);
  }

  getPurchaseOrder(id: number): Observable<PurchaseOrder> {
    return this.api.get(`/purchase/orders/${id}`);
  }

  cancelPurchaseOrder(id: number): Observable<any> {
    return this.api.post(`/purchase/orders/${id}/cancel`, {});
  }

  sendToSupplier(id: number): Observable<any> {
    return this.api.post(`/purchase/orders/${id}/send-to-supplier`, {});
  }

  confirmPurchaseOrder(id: number): Observable<any> {
    return this.api.post(`/purchase/orders/${id}/confirm`, {});
  }

  revertPurchaseOrder(id: number): Observable<any> {
    return this.api.post(`/purchase/orders/${id}/revert`, {});
  }

  revertPurchaseItem(orderId: number, purchaseItemId: number): Observable<any> {
    return this.api.post(`/purchase/orders/${orderId}/revert-item`, { purchase_item_id: purchaseItemId });
  }

  updatePurchaseOrder(id: number, data: any): Observable<PurchaseOrder> {
    return this.api.put(`/purchase/orders/${id}`, data);
  }

  getPurchaseDashboard(params?: any): Observable<any> {
    return this.api.get('/purchase/orders/dashboard', params);
  }

  exportExcel(id: number): Observable<Blob> {
    return this.api.getBlob(`/purchase/orders/${id}/export/excel`);
  }

  exportPdf(id: number): Observable<Blob> {
    return this.api.getBlob(`/purchase/orders/${id}/export/pdf`);
  }

  getReceivings(params?: any): Observable<{ data: Receiving[] }> {
    return this.api.get<{ data: Receiving[] }>('/purchase/receivings', params);
  }

  createReceiving(receiving: any): Observable<Receiving> {
    return this.api.post('/purchase/receivings', receiving);
  }

  getReceiving(id: number): Observable<Receiving> {
    return this.api.get(`/purchase/receivings/${id}`);
  }

  getSuppliers(params?: any): Observable<{ data: Supplier[] }> {
    return this.api.get<{ data: Supplier[] }>('/purchase/suppliers', params);
  }

  createSupplier(supplier: any): Observable<Supplier> {
    return this.api.post('/purchase/suppliers', supplier);
  }

  getSupplier(id: number): Observable<Supplier> {
    return this.api.get(`/purchase/suppliers/${id}`);
  }

  updateSupplier(id: number, supplier: any): Observable<Supplier> {
    return this.api.put(`/purchase/suppliers/${id}`, supplier);
  }

  deleteSupplier(id: number): Observable<any> {
    return this.api.delete(`/purchase/suppliers/${id}`);
  }

  getSupplierPayments(supplierId: number): Observable<any[]> {
    return this.api.get(`/purchase/suppliers/${supplierId}/payments`);
  }

  createSupplierPayment(payment: any): Observable<any> {
    return this.api.post('/purchase/supplier-payments', payment);
  }
}

