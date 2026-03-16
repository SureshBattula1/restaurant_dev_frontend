import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = environment.apiUrl;

  constructor(
    private api: ApiService,
    private http: HttpClient
  ) {}

  getDailySales(date?: string): Observable<any> {
    const params = date ? { date } : {};
    return this.api.get('/reports/sales/daily', params);
  }

  getItemSales(dateFrom: string, dateTo: string, params?: any): Observable<any> {
    const queryParams: any = { date_from: dateFrom, date_to: dateTo };
    if (params?.location_id) queryParams.location_id = params.location_id;
    return this.api.get('/reports/sales/item-wise', queryParams);
  }

  getCategorySales(dateFrom: string, dateTo: string, params?: any): Observable<any> {
    const queryParams: any = { date_from: dateFrom, date_to: dateTo };
    if (params?.location_id) queryParams.location_id = params.location_id;
    return this.api.get('/reports/sales/category-wise', queryParams);
  }

  getInventoryValuation(dateFrom?: string, dateTo?: string, params?: any): Observable<any> {
    const queryParams: any = {};
    if (dateFrom) queryParams.date_from = dateFrom;
    if (dateTo) queryParams.date_to = dateTo;
    if (params?.location_id) queryParams.location_id = params.location_id;
    return this.api.get('/reports/inventory/valuation', queryParams);
  }

  getLowStockReport(params?: any): Observable<any> {
    return this.api.get('/reports/inventory/low-stock', params);
  }

  getStockMovement(dateFrom: string, dateTo: string, params?: any): Observable<any> {
    const queryParams: any = { date_from: dateFrom, date_to: dateTo };
    if (params?.location_id) queryParams.location_id = params.location_id;
    return this.api.get('/reports/inventory/movement', queryParams);
  }

  getProfitLoss(dateFrom: string, dateTo: string, params?: any): Observable<any> {
    const queryParams: any = { date_from: dateFrom, date_to: dateTo };
    if (params?.location_id) queryParams.location_id = params.location_id;
    return this.api.get('/reports/accounting/profit-loss', queryParams);
  }

  getExpenseReport(dateFrom: string, dateTo: string, params?: any): Observable<any> {
    const queryParams: any = { date_from: dateFrom, date_to: dateTo };
    if (params?.location_id) queryParams.location_id = params.location_id;
    return this.api.get('/reports/accounting/expenses', queryParams);
  }

  exportReport(endpoint: string, params: any, format: 'pdf' | 'excel' | 'csv'): Observable<Blob> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key]);
      }
    });

    return this.http.get(`${this.apiUrl}${endpoint}`, {
      params: httpParams,
      responseType: 'blob',
      headers: new HttpHeaders({
        'Accept': format === 'pdf' ? 'application/pdf' : format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
      })
    });
  }
}

