import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface StockInRequest {
  item_id: number;
  location_id: number;
  quantity: number;
  unit_cost?: number;
  notes?: string;
}

export interface StockOutRequest {
  item_id: number;
  location_id: number;
  quantity: number;
  notes?: string;
}

export interface StockAdjustRequest {
  item_id: number;
  location_id: number;
  quantity: number;
  notes: string;
}

export interface StockTransferRequest {
  item_id: number;
  from_location_id: number;
  to_location_id: number;
  quantity: number;
  reason?: string;
}

export interface Recipe {
  id: number;
  menu_item_id?: number;
  item_id?: number; // Legacy support for migration
  name: string;
  description?: string;
  yield_quantity: number;
  unit: string;
  preparation_time?: number;
  cooking_time?: number;
  status: string;
  ingredients?: RecipeIngredient[];
}

export interface RecipeIngredient {
  id?: number;
  ingredient_item_id: number;
  quantity: number;
  unit: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  constructor(private api: ApiService) {}

  getItems(params?: any): Observable<any> {
    return this.api.get('/inventory/items', params);
  }

  getItem(id: number): Observable<any> {
    return this.api.get(`/inventory/items/${id}`);
  }

  createItem(item: any): Observable<any> {
    return this.api.post('/inventory/items', item);
  }

  updateItem(id: number, item: any): Observable<any> {
    return this.api.put(`/inventory/items/${id}`, item);
  }

  deleteItem(id: number): Observable<any> {
    return this.api.delete(`/inventory/items/${id}`);
  }

  getItemByBarcode(barcode: string): Observable<any> {
    return this.api.get(`/inventory/items/barcode/${barcode}`);
  }

  stockIn(data: StockInRequest): Observable<any> {
    return this.api.post('/inventory/stock/in', data);
  }

  stockOut(data: StockOutRequest): Observable<any> {
    return this.api.post('/inventory/stock/out', data);
  }

  adjustStock(data: StockAdjustRequest): Observable<any> {
    return this.api.post('/inventory/stock/adjust', data);
  }

  transferStock(data: StockTransferRequest): Observable<any> {
    return this.api.post('/inventory/stock/transfer', data);
  }

  getStock(itemId: number, locationId: number): Observable<any> {
    return this.api.get(`/inventory/stock/${itemId}/${locationId}`);
  }

  getStockQuantity(itemId: number, locationId: number): Observable<any> {
    return this.api.get(`/inventory/stock/${itemId}/${locationId}`);
  }

  getLowStockItems(params?: { location_id?: number }): Observable<any[]> {
    return this.api.get('/inventory/stock/low-stock', params);
  }

  // Recipes API removed: recipes feature disabled

  // Stock Transactions (Entries) Management
  getStockTransactions(params?: any): Observable<any> {
    return this.api.get('/inventory/stock/transactions', params);
  }

  updateStockTransaction(id: number, data: any): Observable<any> {
    return this.api.put(`/inventory/stock/transactions/${id}`, data);
  }

  revertStockTransaction(id: number): Observable<any> {
    return this.api.post(`/inventory/stock/transactions/${id}/revert`, {});
  }
}
