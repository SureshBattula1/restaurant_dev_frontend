import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface Customer {
  id: number;
  customer_code: string;
  person?: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  };
  loyalty_points?: number;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  constructor(private api: ApiService) {}

  getCustomers(params?: any): Observable<any> {
    return this.api.get<any>('/customers', params);
  }

  searchCustomers(query: string): Observable<Customer[]> {
    return this.api.get<Customer[]>(`/customers/search?q=${query}`);
  }

  createCustomer(customer: any): Observable<Customer> {
    return this.api.post<Customer>('/customers', customer);
  }

  getCustomer(id: number): Observable<Customer> {
    return this.api.get<Customer>(`/customers/${id}`);
  }
}




