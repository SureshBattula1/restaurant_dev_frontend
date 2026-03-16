import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface RawMaterial {
  id: number;
  name: string;
  sku: string;
  unit: string;
  cost_price: number;
  current_quantity: number;
  low_stock_threshold: number;
  stock_status: 'good' | 'warning' | 'low' | 'out-of-stock';
  stock_value: number;
  category?: any;
}

export interface LowStockAlert {
  item_id: number;
  item_name: string;
  item_sku: string;
  unit: string;
  current_quantity: number;
  threshold: number;
  shortage: number;
  status: 'low' | 'out-of-stock';
  cost_price: number;
  estimated_cost_to_restock: number;
}

export interface RawMaterialsDashboard {
  location_id?: number;
  summary: {
    total_items: number;
    total_stock_value: number;
    low_stock_count: number;
    out_of_stock_count: number;
  };
  items: RawMaterial[];
  low_stock_items: RawMaterial[];
  consumption_trends: any[];
}

@Injectable({
  providedIn: 'root'
})
export class RawMaterialsService {
  constructor(private api: ApiService) {}

  getDashboard(locationId?: number): Observable<RawMaterialsDashboard> {
    const params = locationId ? { location_id: locationId } : {};
    return this.api.get<RawMaterialsDashboard>('/inventory/raw-materials/dashboard', params);
  }

  getLowStockAlerts(locationId?: number): Observable<LowStockAlert[]> {
    const params = locationId ? { location_id: locationId } : {};
    return this.api.get<LowStockAlert[]>('/inventory/raw-materials/low-stock-alerts', params);
  }
}




