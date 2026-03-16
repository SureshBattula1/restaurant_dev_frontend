import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface Table {
  id: number;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  current_order?: any;
}

@Injectable({
  providedIn: 'root'
})
export class TableService {
  constructor(private api: ApiService) {}

  getTables(): Observable<Table[]> {
    return this.api.get<Table[]>('/pos/tables');
  }

  getTableOrders(tableNumber: string): Observable<any> {
    return this.api.get<any>(`/pos/tables/${tableNumber}/orders`);
  }
}




