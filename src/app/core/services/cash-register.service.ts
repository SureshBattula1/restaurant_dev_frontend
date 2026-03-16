import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CashRegister {
  id: number;
  location_id: number;
  user_id: number;
  opening_balance: number;
  closing_balance: number;
  expected_balance?: number;
  balance_difference?: number;
  opening_time: string;
  closing_time?: string;
  status: 'open' | 'closed';
  notes?: string;
  transactions?: CashTransaction[];
}

export interface CashTransaction {
  id: number;
  cash_register_id: number;
  transaction_type: 'in' | 'out';
  amount: number;
  reference_type?: string;
  reference_id?: number;
  notes?: string;
  category?: string;
  created_at: string;
}

export interface OpenRegisterRequest {
  opening_balance: number;
  notes?: string;
}

export interface CloseRegisterRequest {
  closing_balance: number;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CashRegisterService {
  constructor(private api: ApiService) {}

  getCurrentRegister(locationId?: number): Observable<CashRegister | null> {
    return this.api.get<CashRegister | null>('/cash-register/current', { location_id: locationId });
  }

  openRegister(data: OpenRegisterRequest, locationId?: number): Observable<CashRegister> {
    return this.api.post<CashRegister>('/cash-register/open', { ...data, location_id: locationId });
  }

  closeRegister(data: CloseRegisterRequest, registerId: number): Observable<CashRegister> {
    return this.api.post<CashRegister>(`/cash-register/${registerId}/close`, data);
  }

  getTransactions(registerId: number): Observable<CashTransaction[]> {
    if (registerId == null || registerId === undefined) {
      return of([]);
    }
    return this.api.get<{ transactions: CashTransaction[] }>(`/transactions/cash-register/${registerId}`).pipe(
      map(res => res?.transactions ?? [])
    );
  }

  addTransaction(registerId: number, transaction: Partial<CashTransaction>): Observable<CashTransaction> {
    if (registerId == null || registerId === undefined) {
      return new Observable(obs => obs.error(new Error('Cash register ID is required')));
    }
    return this.api.post<{ transaction: CashTransaction }>('/transactions', { ...transaction, cash_register_id: registerId }).pipe(
      map(res => res?.transaction!)
    );
  }

  getRegisterHistory(locationId?: number, date?: string): Observable<CashRegister[]> {
    return this.api.get<CashRegister[]>('/cash-register/history', { location_id: locationId, date });
  }
}




