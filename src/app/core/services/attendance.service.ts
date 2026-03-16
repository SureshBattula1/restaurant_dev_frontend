import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface Attendance {
  id: number;
  employee_id: number;
  location_id: number;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  total_hours: number;
  status: string;
  notes?: string;
  employee?: any;
  location?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  constructor(private api: ApiService) {}

  checkIn(data: { employee_id: number; location_id: number; check_in_time?: string; notes?: string }): Observable<any> {
    return this.api.post('/attendance/check-in', data);
  }

  checkOut(id: number, notes?: string, check_out_time?: string): Observable<any> {
    const payload: any = {};
    if (notes) payload.notes = notes;
    if (check_out_time) payload.check_out_time = check_out_time;
    return this.api.post(`/attendance/${id}/check-out`, payload);
  }

  getAttendances(params?: any): Observable<any> {
    return this.api.get('/attendance', { params });
  }

  getAttendance(id: number): Observable<Attendance> {
    return this.api.get(`/attendance/${id}`);
  }

  updateAttendance(id: number, data: any): Observable<Attendance> {
    return this.api.put(`/attendance/${id}`, data);
  }

  getEmployeeAttendance(employeeId: number, params?: any): Observable<Attendance[]> {
    return this.api.get(`/attendance/employee/${employeeId}`, { params });
  }

  getDailyAttendance(date: string, locationId?: number): Observable<any> {
    const params: any = { date };
    if (locationId) params.location_id = locationId;
    return this.api.get('/attendance/daily/list', params);
  }

  markAbsent(data: { employee_id: number; location_id: number; date: string; notes?: string }): Observable<any> {
    return this.api.post('/attendance/mark-absent', data);
  }

  createAttendance(data: {
    employee_id: number;
    location_id: number;
    date: string;
    check_in_time?: string;
    check_out_time?: string;
    status: 'present' | 'absent' | 'late' | 'half_day';
    notes?: string;
  }): Observable<Attendance> {
    return this.api.post('/attendance', data);
  }

  bulkSave(attendances: Array<{
    employee_id: number;
    location_id: number;
    date: string;
    check_in_time?: string;
    check_out_time?: string;
    status: 'present' | 'absent' | 'late' | 'half_day';
    notes?: string;
  }>): Observable<any> {
    return this.api.post('/attendance/bulk-save', { attendances });
  }
}
