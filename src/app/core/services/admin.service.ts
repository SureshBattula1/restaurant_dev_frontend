import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface User {
  id: number;
  name: string;
  email: string;
  location_id?: number;
  location?: Location;
  phone?: string;
  secondary_phone?: string;
  date_of_birth?: string;
  education?: string;
  education_details?: string;
  experience_years?: number;
  experience_details?: string;
  salary?: number;
  joining_date?: string;
  designation?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  status: string;
  roles?: Role[];
}

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  name: string;
  slug: string;
  module?: string;
}

export interface Location {
  id: number;
  name: string;
  code: string;
  address?: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private api: ApiService) {}

  getDashboard(locationId?: number): Observable<any> {
    const params = locationId ? { location_id: locationId } : {};
    return this.api.get('/admin/dashboard', params);
  }

  getUsers(params?: any): Observable<any> {
    return this.api.get('/admin/users', params);
  }

  createUser(user: any): Observable<User> {
    return this.api.post('/admin/users', user);
  }

  updateUser(id: number, user: any): Observable<User> {
    return this.api.put(`/admin/users/${id}`, user);
  }

  deleteUser(id: number): Observable<any> {
    return this.api.delete(`/admin/users/${id}`);
  }

  restoreUser(id: number): Observable<any> {
    return this.api.post(`/admin/users/${id}/restore`, {});
  }

  getRoles(): Observable<Role[]> {
    return this.api.get('/admin/roles');
  }

  createRole(role: any): Observable<Role> {
    return this.api.post('/admin/roles', role);
  }

  updateRole(id: number, role: any): Observable<Role> {
    return this.api.put(`/admin/roles/${id}`, role);
  }

  getLocations(): Observable<Location[]> {
    return this.api.get('/admin/locations');
  }

  createLocation(location: any): Observable<Location> {
    return this.api.post('/admin/locations', location);
  }

  updateLocation(id: number, location: any): Observable<Location> {
    return this.api.put(`/admin/locations/${id}`, location);
  }

  deleteRole(id: number): Observable<any> {
    return this.api.delete(`/admin/roles/${id}`);
  }

  deleteLocation(id: number): Observable<any> {
    return this.api.delete(`/admin/locations/${id}`);
  }

  // Attendance methods
  getAttendances(params?: any): Observable<any> {
    return this.api.get('/attendance', params);
  }

  getDailyAttendance(date?: string, locationId?: number): Observable<any> {
    const params: any = {};
    if (date) params.date = date;
    if (locationId) params.location_id = locationId;
    return this.api.get('/attendance/daily/list', params);
  }

  updateAttendance(id: number, data: any): Observable<any> {
    return this.api.put(`/attendance/${id}`, data);
  }

  markAbsent(data: any): Observable<any> {
    return this.api.post('/attendance/mark-absent', data);
  }

  // Advance Payment methods
  getAdvancePayments(params?: any): Observable<any> {
    return this.api.get('/advance-payments', params);
  }

  createAdvancePayment(data: any): Observable<any> {
    return this.api.post('/advance-payments', data);
  }

  updateAdvancePayment(id: number, data: any): Observable<any> {
    return this.api.put(`/advance-payments/${id}`, data);
  }

  deleteAdvancePayment(id: number): Observable<any> {
    return this.api.delete(`/advance-payments/${id}`);
  }

  getEmployeeAdvances(employeeId: number, params?: any): Observable<any> {
    return this.api.get(`/advance-payments/employee/${employeeId}`, params);
  }

  // Salary methods
  getSalaries(params?: any): Observable<any> {
    return this.api.get('/salaries', params);
  }

  calculateSalary(data: any): Observable<any> {
    return this.api.post('/salaries/calculate', data);
  }

  paySalary(data: any): Observable<any> {
    return this.api.post('/salaries/pay', data);
  }

  getEmployeeSalaries(employeeId: number, params?: any): Observable<any> {
    return this.api.get(`/salaries/employee/${employeeId}`, params);
  }

  getSalaryReport(params?: any): Observable<any> {
    return this.api.get('/salaries/report', params);
  }

  // Employee methods
  getEmployees(params?: any): Observable<any> {
    return this.api.get('/admin/employees', params);
  }
}

