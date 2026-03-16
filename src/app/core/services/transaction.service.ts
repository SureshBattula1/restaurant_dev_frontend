import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface CashTransaction {
  id: number;
  cash_register_id: number;
  transaction_type: string;
  amount: number;
  reference_type?: string;
  reference_id?: number;
  notes?: string;
  category?: string;
  cash_register?: any;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  constructor(private api: ApiService) {}

  getTransactions(params?: any): Observable<any> {
    return this.api.get('/transactions', { params });
  }

  getTransaction(id: number): Observable<CashTransaction> {
    return this.api.get(`/transactions/${id}`);
  }

  createTransaction(data: any): Observable<CashTransaction> {
    return this.api.post('/transactions', data);
  }

  getCashRegisterTransactions(cashRegisterId: number): Observable<any> {
    return this.api.get(`/transactions/cash-register/${cashRegisterId}`);
  }

  getTransactionReport(params?: any): Observable<any> {
    return this.api.get('/transactions/report', { params });
  }
}

