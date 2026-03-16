import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface Expense {
  id: number;
  category_id: number;
  amount: number;
  description: string;
  expense_date: string;
  payment_method: string;
  reference_number?: string;
  category?: ExpenseCategory;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  constructor(private api: ApiService) {}

  getExpenses(params?: any): Observable<any> {
    return this.api.get('/expenses', params);
  }

  createExpense(expense: any): Observable<Expense> {
    return this.api.post('/expenses', expense);
  }

  updateExpense(id: number, expense: any): Observable<Expense> {
    return this.api.put(`/expenses/${id}`, expense);
  }

  deleteExpense(id: number): Observable<any> {
    return this.api.delete(`/expenses/${id}`);
  }

  getCategories(): Observable<ExpenseCategory[]> {
    return this.api.get('/expenses/categories');
  }

  createCategory(category: any): Observable<ExpenseCategory> {
    return this.api.post('/expenses/categories', category);
  }

  updateCategory(id: number, category: any): Observable<ExpenseCategory> {
    return this.api.put(`/expenses/categories/${id}`, category);
  }

  deleteCategory(id: number): Observable<any> {
    return this.api.delete(`/expenses/categories/${id}`);
  }
}

