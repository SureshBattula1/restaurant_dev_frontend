import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DataTableParams, DataTablePagination, DataTableSort } from '../../shared/interfaces/datatable-config.interface';

@Injectable({
  providedIn: 'root'
})
export class DataTableService {
  private paginationSubject = new BehaviorSubject<DataTablePagination>({
    page: 1,
    per_page: 10,
    total: 0,
    last_page: 1
  });

  private sortSubject = new BehaviorSubject<DataTableSort>({});
  private filterSubject = new BehaviorSubject<any>({});

  public pagination$ = this.paginationSubject.asObservable();
  public sort$ = this.sortSubject.asObservable();
  public filters$ = this.filterSubject.asObservable();

  constructor() {}

  setPagination(pagination: DataTablePagination): void {
    this.paginationSubject.next(pagination);
  }

  getPagination(): DataTablePagination {
    return this.paginationSubject.value;
  }

  setSort(sort: DataTableSort): void {
    this.sortSubject.next(sort);
  }

  getSort(): DataTableSort {
    return this.sortSubject.value;
  }

  setFilters(filters: any): void {
    this.filterSubject.next(filters);
  }

  getFilters(): any {
    return this.filterSubject.value;
  }

  buildParams(customFilters: any = {}): DataTableParams {
    const pagination = this.getPagination();
    const sort = this.getSort();
    const filters = this.getFilters();

    return {
      page: pagination.page,
      per_page: pagination.per_page,
      ...sort,
      ...filters,
      ...customFilters
    };
  }

  reset(): void {
    this.paginationSubject.next({
      page: 1,
      per_page: 10,
      total: 0,
      last_page: 1
    });
    this.sortSubject.next({});
    this.filterSubject.next({});
  }

  // Date range utilities
  getDateRangePresets(): { label: string; from: Date; to: Date }[] {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);
    
    const thisYear = new Date(today);
    thisYear.setFullYear(thisYear.getFullYear() - 1);

    return [
      { label: 'Today', from: today, to: today },
      { label: 'Yesterday', from: yesterday, to: yesterday },
      { label: 'Last 7 Days', from: thisWeek, to: today },
      { label: 'Last 30 Days', from: thisMonth, to: today },
      { label: 'Last Year', from: thisYear, to: today }
    ];
  }

  formatDateForAPI(date: Date | null): string | undefined {
    if (!date) return undefined;
    return date.toISOString().split('T')[0];
  }
}




