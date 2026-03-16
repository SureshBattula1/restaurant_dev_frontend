import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface SupplierOrderItem {
  id: number;
  item_name: string;
  item_code: string;
  unit: string;
  required_qty: number;
  supplier_qty: number | null;
  price: number | null;
  _supplier_qty?: number;
  _price?: number;
}

export interface SupplierOrder {
  order_number: string;
  order_date: string;
  status?: string;
  items: SupplierOrderItem[];
}

@Injectable({ providedIn: 'root' })
export class SupplierOrderService {
  constructor(private api: ApiService) {}

  getOrder(token: string): Observable<SupplierOrder> {
    return this.api.get<SupplierOrder>(`/supplier-order/${token}`);
  }

  submitOrder(token: string, items: { id: number; supplier_qty: number; price: number }[]): Observable<{ message: string; order_number: string }> {
    return this.api.post(`/supplier-order/${token}/submit`, { items });
  }
}
