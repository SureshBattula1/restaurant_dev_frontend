import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface KitchenOrder {
  id: number;
  order_number: string;
  table_number?: string;
  status: 'pending' | 'preparing' | 'cooking' | 'ready' | 'delivered' | 'cancelled';
  priority?: number;
  estimated_time?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  items: KitchenOrderItem[];
  sale?: any;
}

export interface KitchenOrderItem {
  id: number;
  item: any;
  quantity: number;
  special_instructions?: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class KitchenService {
  constructor(private api: ApiService) {}

  getOrders(): Observable<KitchenOrder[]> {
    return this.api.get<KitchenOrder[]>('/kitchen/orders');
  }

  getActiveOrders(params?: any): Observable<KitchenOrder[]> {
    return this.api.get<KitchenOrder[]>('/kitchen/orders', params);
  }

  updateOrderStatus(orderId: number, status: string, estimatedTime?: number): Observable<KitchenOrder> {
    return this.api.put<KitchenOrder>(`/kitchen/orders/${orderId}/status`, { status, estimated_time: estimatedTime });
  }

  updateItemStatus(itemId: number, status: string): Observable<any> {
    return this.api.put(`/kitchen/order-items/${itemId}/status`, { status });
  }
}

