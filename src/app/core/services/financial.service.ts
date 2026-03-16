import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FinancialService {
  constructor(private api: ApiService) {}

  getDashboard(params?: any): Observable<any> {
    return this.api.get('/reports/financial/dashboard', params);
  }
}




