import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface SalaryPayment {
  id: number;
  employee_id: number;
  location_id: number;
  payment_date: string;
  salary_month: number;
  salary_year: number;
  base_salary: number;
  overtime_hours: number;
  overtime_amount: number;
  deductions: number;
  bonus: number;
  net_salary: number;
  payment_method: string;
  status: string;
  notes?: string;
  employee?: any;
  location?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SalaryService {
  constructor(private api: ApiService) {}

  getSalaries(params?: any): Observable<any> {
    return this.api.get('/salaries', { params });
  }

  getSalary(id: number): Observable<SalaryPayment> {
    return this.api.get(`/salaries/${id}`);
  }

  calculateSalary(data: { employee_id: number; month: number; year: number }): Observable<any> {
    return this.api.post('/salaries/calculate', data);
  }

  paySalary(data: any): Observable<SalaryPayment> {
    return this.api.post('/salaries/pay', data);
  }

  getEmployeeSalary(employeeId: number, params?: any): Observable<SalaryPayment[]> {
    return this.api.get(`/salaries/employee/${employeeId}`, { params });
  }

  getSalaryReport(params?: any): Observable<any> {
    return this.api.get('/salaries/report', { params });
  }
}




