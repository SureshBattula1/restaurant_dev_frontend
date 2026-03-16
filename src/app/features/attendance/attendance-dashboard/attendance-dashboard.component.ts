import { Component, OnInit, ChangeDetectorRef, AfterViewChecked, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { AttendanceService, Attendance } from '../../../core/services/attendance.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AdminService } from '../../../core/services/admin.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableConfig, DataTableParams, DataTablePagination } from '../../../shared/interfaces/datatable-config.interface';
import { RealtimeService } from '../../../core/services/realtime.service';
import { Subject } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

@Component({
  selector: 'app-attendance-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    DataTableComponent,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatTabsModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatTableModule,
    MatChipsModule,
    LoaderComponent
  ],
  templateUrl: './attendance-dashboard.component.html',
  styleUrls: ['./attendance-dashboard.component.css']
})
export class AttendanceDashboardComponent implements OnInit, AfterViewChecked {
  currentUser: any;
  activeTab: 'daily' | 'employee' | 'create' | 'bulk' = 'daily';
  selectedTabIndex = 0;
  tabNames = ['daily', 'create', 'bulk'];
  attendances: Attendance[] = [];
  employees: any[] = [];
  allEmployees: any[] = []; // Store all employees for filtering
  locations: any[] = [];
  selectedDate: string = new Date().toISOString().split('T')[0];
  dateFrom: string = new Date().toISOString().split('T')[0];
  dateTo: string = new Date().toISOString().split('T')[0];
  selectedLocationId?: number;
  
  // Bulk attendance
  bulkAttendanceForm: FormGroup;
  bulkEmployees: any[] = [];
  bulkDate: string = new Date().toISOString().split('T')[0];
  bulkLocationId?: number;
  existingAttendances: Map<number, Attendance> = new Map(); // employee_id => attendance
  
  // Edit mode tracking
  editingAttendanceId: number | null = null;
  
  // DataTable configuration
  attendanceTableConfig!: DataTableConfig;
  attendanceTableData: Attendance[] = [];
  attendanceTablePagination: DataTablePagination | null = null;
  attendanceTableLoading = false;
  attendanceRealtimeUpdates$ = new Subject<any>();
  
  checkInForm: FormGroup;
  checkOutForm: FormGroup;
  createAttendanceForm: FormGroup;
  loading = false;
  activeAttendances: Attendance[] = [];

  constructor(
    private fb: FormBuilder,
    private attendanceService: AttendanceService,
    private authService: AuthService,
    private adminService: AdminService,
    private notification: NotificationService,
    @Inject(RealtimeService) private realtimeService: RealtimeService,
    private cdr: ChangeDetectorRef
  ) {
    this.checkInForm = this.fb.group({
      employee_id: [null, Validators.required],
      location_id: [null, Validators.required],
      check_in_time: [''],
      notes: ['']
    });

    this.checkOutForm = this.fb.group({
      attendance_id: [null, Validators.required],
      check_out_time: [''],
      notes: ['']
    });

    this.createAttendanceForm = this.fb.group({
      employee_id: [null, Validators.required],
      location_id: [null, Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      check_in_time: [''],
      check_out_time: [''],
      status: ['present', Validators.required],
      notes: ['']
    });

    this.bulkAttendanceForm = this.fb.group({
      date: [new Date().toISOString().split('T')[0], Validators.required],
      location_id: [null, Validators.required],
      employees: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.initializeAttendanceTableConfig();
    this.setupRealtimeUpdates();
    this.loadLocations();
    this.loadEmployees();
    this.loadDailyAttendance();
    this.loadActiveAttendances();
    if (this.currentUser?.location_id) {
      this.checkInForm.patchValue({ location_id: this.currentUser.location_id });
      this.createAttendanceForm.patchValue({ location_id: this.currentUser.location_id });
    }
  }

  ngAfterViewChecked(): void {
    // This lifecycle hook helps prevent ExpressionChangedAfterItHasBeenCheckedError
    // by ensuring changes are detected after view initialization
  }

  initializeAttendanceTableConfig(): void {
    this.attendanceTableConfig = {
      columns: [
        { key: 'employee.person.name', label: 'Employee', sortable: true, format: (v, row) => row.employee?.person?.name || (row.employee?.person?.first_name || '') + ' ' + (row.employee?.person?.last_name || '') || 'N/A' },
        { key: 'date', label: 'Date', sortable: true, type: 'date', format: (v) => v ? new Date(v).toLocaleDateString() : '-' },
        { key: 'check_in_time', label: 'Check In', sortable: true, type: 'date', format: (v) => v ? new Date(v).toLocaleString() : '-' },
        { key: 'check_out_time', label: 'Check Out', sortable: true, type: 'date', format: (v) => v ? new Date(v).toLocaleString() : '-' },
        { key: 'total_hours', label: 'Hours', sortable: true, format: (v) => v ? `${Number(v).toFixed(2)} hrs` : '-' },
        { key: 'status', label: 'Status', sortable: true, type: 'status', format: (v) => v }
      ],
      filters: [
        {
          key: 'dateRange',
          label: 'Date Range',
          type: 'dateRange'
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'present', label: 'Present' },
            { value: 'absent', label: 'Absent' },
            { value: 'late', label: 'Late' },
            { value: 'half_day', label: 'Half Day' }
          ]
        }
      ],
      actions: [
        {
          label: 'Edit',
          icon: 'edit',
          color: 'primary',
          action: (row) => this.editAttendance(row),
          tooltip: 'Edit attendance record'
        },
        {
          label: 'Check Out',
          icon: 'logout',
          color: 'warn',
          action: (row) => this.checkOut(row.id),
          condition: (row) => !row.check_out_time && row.check_in_time,
          tooltip: 'Check out employee'
        }
      ],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No attendance records found'
    };
  }

  setupRealtimeUpdates(): void {
    this.realtimeService.attendanceUpdates$.subscribe(() => {
      this.attendanceRealtimeUpdates$.next({ type: 'refresh' });
    });
  }

  loadAttendanceTableData = async (params: DataTableParams): Promise<any> => {
    this.attendanceTableLoading = true;
    
    const requestParams: any = {
      page: params.page || 1,
      per_page: params.per_page || 10,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir
    };

    // Use date range from params (from data table date range filter)
    if (params.date_from) {
      requestParams.date_from = params.date_from;
    }
    if (params.date_to) {
      requestParams.date_to = params.date_to;
    }

    if (this.isSuperAdmin()) {
      if (this.selectedLocationId !== undefined && this.selectedLocationId !== null) {
        requestParams.location_id = this.selectedLocationId;
      }
    } else {
      requestParams.location_id = this.currentUser?.location_id;
    }

    if (params['status']) {
      requestParams.status = params['status'];
    }

    return new Promise((resolve, reject) => {
      this.attendanceService.getAttendances(requestParams).subscribe({
        next: (response: any) => {
          let data: Attendance[] = [];
          let pagination: DataTablePagination | null = null;

          if (response && response.data) {
            data = response.data;
            if (response.pagination) {
              pagination = response.pagination;
            } else if (response.current_page) {
              pagination = {
                page: response.current_page,
                per_page: response.per_page || 10,
                total: response.total || 0,
                last_page: response.last_page || 1,
                from: response.from,
                to: response.to
              };
            }
          } else if (Array.isArray(response)) {
            data = response;
          }

          this.attendanceTableData = data;
          this.attendanceTablePagination = pagination;
          this.attendanceTableLoading = false;

          resolve({ data, pagination });
        },
        error: (err) => {
          console.error('Error loading attendance:', err);
          this.notification.error('Error loading attendance');
          this.attendanceTableLoading = false;
          reject(err);
        }
      });
    });
  }

  loadEmployees(): void {
    // For super admin: load all employees from all locations
    // For regular users: load only employees from their location
    const params: any = {};
    if (this.currentUser?.location_id && !this.isSuperAdmin()) {
      params.location_id = this.currentUser.location_id;
    }
    // For super admin, don't pass location_id to get all employees
    this.adminService.getEmployees(this.isSuperAdmin() ? {} : params).subscribe({
      next: (response) => {
        const loadedEmployees = response.data || response || [];
        this.allEmployees = loadedEmployees;
        // Initially filter by user's location if not super admin, otherwise show all
        if (this.currentUser?.location_id && !this.isSuperAdmin()) {
          this.employees = this.allEmployees.filter(emp => emp.location_id === this.currentUser.location_id);
        } else {
          this.employees = this.allEmployees;
        }
      },
      error: (err) => {
        console.error('Error loading employees:', err);
      }
    });
  }

  filterEmployeesByLocation(locationId?: number): void {
    if (!locationId) {
      // If no location selected, show all employees or filter by user's location if not super admin
      if (!this.isSuperAdmin() && this.currentUser?.location_id) {
        this.employees = this.allEmployees.filter(emp => emp.location_id === this.currentUser.location_id);
      } else {
        this.employees = this.allEmployees;
      }
      return;
    }
    this.employees = this.allEmployees.filter(emp => emp.location_id === locationId);
  }

  onCheckInLocationChange(): void {
    const locationId = this.checkInForm.get('location_id')?.value;
    this.filterEmployeesByLocation(locationId);
    // Reset employee selection when location changes
    this.checkInForm.patchValue({ employee_id: null });
  }

  onCreateLocationChange(): void {
    const locationId = this.createAttendanceForm.get('location_id')?.value;
    this.filterEmployeesByLocation(locationId);
    // Reset employee selection when location changes
    this.createAttendanceForm.patchValue({ employee_id: null });
  }

  loadLocations(): void {
    this.adminService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
      }
    });
  }

  loadDailyAttendance(): void {
    this.loading = true;
    // For super admin: if selectedLocationId is undefined/null, pass undefined to show all locations
    // For non-super admin: use their location_id
    let locationId: number | undefined;
    if (this.isSuperAdmin()) {
      locationId = (this.selectedLocationId !== undefined && this.selectedLocationId !== null) 
        ? this.selectedLocationId 
        : undefined;
    } else {
      locationId = this.currentUser?.location_id;
    }
    
    this.attendanceService.getDailyAttendance(this.selectedDate, locationId).subscribe({
      next: (response) => {
        this.attendances = response.attendances || [];
        this.loading = false;
      },
      error: (err) => {
        this.notification.error('Error loading attendance');
        this.loading = false;
      }
    });
  }

  loadActiveAttendances(): void {
    const today = new Date().toISOString().split('T')[0];
    let locationId: number | undefined;
    if (this.isSuperAdmin()) {
      locationId = (this.selectedLocationId !== undefined && this.selectedLocationId !== null) 
        ? this.selectedLocationId 
        : undefined;
    } else {
      locationId = this.currentUser?.location_id;
    }
    
    this.attendanceService.getDailyAttendance(today, locationId).subscribe({
      next: (response) => {
        // Filter to only show attendances that have check-in but no check-out
        this.activeAttendances = (response.attendances || []).filter(
          (att: Attendance) => att.check_in_time && !att.check_out_time
        );
      },
      error: (err) => {
        console.error('Error loading active attendances:', err);
      }
    });
  }

  checkIn(): void {
    if (this.checkInForm.invalid) return;
    
    this.loading = true;
    const formValue = this.checkInForm.value;
    const checkInData: any = {
      employee_id: formValue.employee_id,
      location_id: formValue.location_id,
      notes: formValue.notes || null
    };

    // Add check-in time if provided
    if (formValue.check_in_time) {
      const today = new Date().toISOString().split('T')[0];
      const checkInDateTime = new Date(`${today}T${formValue.check_in_time}`);
      checkInData.check_in_time = checkInDateTime.toISOString();
    }

    this.attendanceService.checkIn(checkInData).subscribe({
      next: () => {
        this.notification.success('Check-in successful');
        this.checkInForm.reset();
        if (this.currentUser?.location_id) {
          this.checkInForm.patchValue({ location_id: this.currentUser.location_id });
        }
        this.loadDailyAttendance();
        this.loadActiveAttendances();
        this.attendanceRealtimeUpdates$.next({ type: 'refresh' });
        this.loading = false;
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error checking in');
        this.loading = false;
      }
    });
  }

  checkOut(attendanceId?: number): void {
    // If called from form, use form value; otherwise use provided ID
    if (!attendanceId) {
      if (this.checkOutForm.invalid) return;
      attendanceId = this.checkOutForm.value.attendance_id;
    }

    this.loading = true;
    const checkOutData: any = {};

    // Add check-out time if provided from form
    if (!attendanceId && this.checkOutForm.value.check_out_time) {
      const today = new Date().toISOString().split('T')[0];
      const checkOutDateTime = new Date(`${today}T${this.checkOutForm.value.check_out_time}`);
      checkOutData.check_out_time = checkOutDateTime.toISOString();
    }

    if (this.checkOutForm.value.notes) {
      checkOutData.notes = this.checkOutForm.value.notes;
    }

    this.attendanceService.checkOut(attendanceId!, checkOutData.notes, checkOutData.check_out_time).subscribe({
      next: () => {
        this.notification.success('Check-out successful');
        this.checkOutForm.reset();
        this.loadDailyAttendance();
        this.loadActiveAttendances();
        this.attendanceRealtimeUpdates$.next({ type: 'refresh' });
        this.loading = false;
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error checking out');
        this.loading = false;
      }
    });
  }

  onTabChange(index: number): void {
    const tab = this.tabNames[index];
    if (tab) {
      this.switchTab(tab);
    }
  }

  switchTab(tab: string): void {
    this.selectedTabIndex = this.tabNames.indexOf(tab);
    if (tab === 'daily' || tab === 'employee' || tab === 'create' || tab === 'bulk') {
      this.activeTab = tab as 'daily' | 'employee' | 'create' | 'bulk';
      if (tab === 'bulk') {
        if (this.currentUser?.location_id && !this.isSuperAdmin()) {
          this.bulkAttendanceForm.patchValue({ location_id: this.currentUser.location_id });
        }
      }
    }
  }

  createAttendance(): void {
    if (this.createAttendanceForm.invalid) {
      this.createAttendanceForm.markAllAsTouched();
      this.notification.error('Please fill all required fields');
      return;
    }

    const formValue = this.createAttendanceForm.value;
    const locationId = this.createAttendanceForm.get('location_id')?.value;

    // If editingAttendanceId exists, update; otherwise create
    if (this.editingAttendanceId) {
      this.updateAttendance(this.editingAttendanceId, formValue, locationId);
      return;
    }

    this.loading = true;
    
    // Format datetime strings if provided
    const attendanceData: any = {
      employee_id: formValue.employee_id,
      location_id: locationId,
      date: formValue.date,
      status: formValue.status,
      notes: formValue.notes || null
    };

    // Add check-in time if provided
    if (formValue.check_in_time && formValue.check_in_time.trim() !== '') {
      const checkInDate = new Date(`${formValue.date}T${formValue.check_in_time}`);
      attendanceData.check_in_time = checkInDate.toISOString();
    }

    // Add check-out time if provided
    if (formValue.check_out_time && formValue.check_out_time.trim() !== '') {
      const checkOutDate = new Date(`${formValue.date}T${formValue.check_out_time}`);
      attendanceData.check_out_time = checkOutDate.toISOString();
    }

    this.attendanceService.createAttendance(attendanceData).subscribe({
      next: () => {
        this.notification.success('Attendance created successfully');
        this.resetCreateForm();
        this.attendanceRealtimeUpdates$.next({ type: 'refresh' });
        this.loading = false;
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error creating attendance');
        this.loading = false;
      }
    });
  }

  updateAttendance(id: number, formValue: any, locationId: number): void {
    this.loading = true;
    
    const attendanceData: any = {
      status: formValue.status,
      notes: formValue.notes || null
    };

    // Add check-in time if provided
    if (formValue.check_in_time && formValue.check_in_time.trim() !== '') {
      const checkInDateTime = new Date(`${formValue.date}T${formValue.check_in_time}`);
      attendanceData.check_in_time = checkInDateTime.toISOString();
    } else {
      attendanceData.check_in_time = null;
    }

    // Add check-out time if provided
    if (formValue.check_out_time && formValue.check_out_time.trim() !== '') {
      const checkOutDateTime = new Date(`${formValue.date}T${formValue.check_out_time}`);
      attendanceData.check_out_time = checkOutDateTime.toISOString();
    } else {
      attendanceData.check_out_time = null;
    }

    this.attendanceService.updateAttendance(id, attendanceData).subscribe({
      next: () => {
        this.notification.success('Attendance updated successfully');
        this.resetCreateForm();
        this.attendanceRealtimeUpdates$.next({ type: 'refresh' });
        this.loading = false;
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error updating attendance');
        this.loading = false;
      }
    });
  }

  onDateRangeChange(): void {
    // Validate date range
    if (this.dateFrom && this.dateTo && new Date(this.dateFrom) > new Date(this.dateTo)) {
      this.notification.error('Date From must be before Date To');
      return;
    }
    // Clear existing data and refresh table
    this.attendanceTableData = [];
    this.attendanceTablePagination = null;
    // Trigger data table refresh
    this.attendanceRealtimeUpdates$.next({ type: 'refresh' });
  }

  onDateChange(): void {
    // Keep for backward compatibility, but use date range now
    this.dateFrom = this.selectedDate;
    this.dateTo = this.selectedDate;
    this.onDateRangeChange();
  }

  onLocationChange(): void {
    // Clear existing data and refresh table
    this.attendanceTableData = [];
    this.attendanceTablePagination = null;
    // Trigger data table refresh
    this.attendanceRealtimeUpdates$.next({ type: 'refresh' });
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  resetCreateForm(): void {
    // Clear editing attendance ID
    this.editingAttendanceId = null;
    this.createAttendanceForm.reset({
      date: new Date().toISOString().split('T')[0],
      status: 'present',
      location_id: this.currentUser?.location_id
    });
  }

  editAttendance(attendance: Attendance): void {
    // Open edit form by populating createAttendanceForm
    this.createAttendanceForm.patchValue({
      employee_id: attendance.employee_id,
      location_id: attendance.location_id,
      date: attendance.date ? new Date(attendance.date).toISOString().split('T')[0] : '',
      status: attendance.status,
      check_in_time: attendance.check_in_time ? this.formatTimeForInput(attendance.check_in_time) : '',
      check_out_time: attendance.check_out_time ? this.formatTimeForInput(attendance.check_out_time) : '',
      notes: attendance.notes || ''
    });
    
    // Store the attendance ID for update
    this.editingAttendanceId = attendance.id;
    
    // Switch to create tab (which will be used for editing)
    this.activeTab = 'create';
    this.selectedTabIndex = this.tabNames.indexOf('create');
    
    // Scroll to form
    setTimeout(() => {
      const formElement = document.querySelector('.create-attendance-form') || document.querySelector('form[formGroup="createAttendanceForm"]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  formatCheckInTime(checkInTime: string | null | undefined): string {
    if (!checkInTime) return 'No check-in';
    return new Date(checkInTime).toLocaleString();
  }

  // Bulk Attendance Methods
  get bulkEmployeesFormArray(): FormArray {
    return this.bulkAttendanceForm.get('employees') as FormArray;
  }

  onBulkDateLocationChange(): void {
    // Clear employees when date or location changes
    while (this.bulkEmployeesFormArray.length !== 0) {
      this.bulkEmployeesFormArray.removeAt(0);
    }
    this.bulkEmployees = [];
    this.existingAttendances.clear();
  }

  loadBulkEmployees(): void {
    const date = this.bulkAttendanceForm.get('date')?.value;
    const locationId = this.bulkAttendanceForm.get('location_id')?.value;

    // Validate both date and location are selected
    if (!date || !locationId) {
      this.notification.error('Please select both date and location');
      return;
    }

    // Format date to ensure consistency
    const selectedDate = new Date(date).toISOString().split('T')[0];
    if (!selectedDate) {
      this.notification.error('Invalid date format');
      return;
    }

    this.loading = true;
    
    // Load employees for the selected location ONLY
    // Pass both date and location_id for validation (even though employees are filtered by location)
    this.adminService.getEmployees({ location_id: locationId }).subscribe({
      next: (response) => {
        const employees = response.data || response || [];
        
        // Filter employees to ensure they belong to the selected location
        // Convert both to numbers for comparison (location_id might come as string from API)
        const selectedLocationIdNum = Number(locationId);
        const filteredEmployees = employees.filter((emp: any) => {
          const empLocationId = emp.location_id ? Number(emp.location_id) : null;
          return empLocationId === selectedLocationIdNum;
        });
        this.bulkEmployees = filteredEmployees;
        
        // Load existing attendances for the SPECIFIC date AND location
        // Backend will only return data matching the exact date and location
        this.attendanceService.getDailyAttendance(selectedDate, locationId).subscribe({
          next: (attResponse) => {
            // Verify the response date matches the selected date
            const responseDate = attResponse.date;
            const responseDateFormatted = responseDate ? new Date(responseDate).toISOString().split('T')[0] : null;
            
            // Verify the response location matches the selected location
            // Convert both to numbers for comparison (location_id might come as string from API)
            const responseLocationId = attResponse.location_id ? Number(attResponse.location_id) : null;
            const selectedLocationIdNum = Number(locationId);
            
            // Only process if both date and location match
            if (responseDateFormatted && responseDateFormatted !== selectedDate) {
              this.notification.warning('Date mismatch detected. Please reload.');
              this.loading = false;
              return;
            }
            
            // Only check location mismatch if response has location_id (it might be optional)
            if (responseLocationId && responseLocationId !== selectedLocationIdNum) {
              this.notification.warning('Location mismatch detected. Please reload.');
              this.loading = false;
              return;
            }
            
            const existing = (attResponse.attendances || []) as Attendance[];
            this.existingAttendances.clear();
            
            // Filter and store only attendance records that match BOTH the selected date AND location
            existing.forEach(att => {
              if (att.employee_id) {
                // Triple-check: date, location, and employee must match
                const attDate = att.date ? new Date(att.date).toISOString().split('T')[0] : null;
                const attLocationId = att.location_id ? Number(att.location_id) : null;
                if (attDate === selectedDate && attLocationId === selectedLocationIdNum) {
                  // Only add if employee exists in the filtered employees list
                  const employeeExists = filteredEmployees.some((emp: any) => emp.id === att.employee_id);
                  if (employeeExists) {
                    this.existingAttendances.set(att.employee_id, att);
                  }
                }
              }
            });

            // Clear existing form array completely
            this.bulkEmployeesFormArray.clear();

            // Create form array for employees with updated data from saved attendance
            // Only include employees that match the selected location
            filteredEmployees.forEach((emp: any) => {
              // Double-check employee belongs to selected location (already filtered, but verify)
              const empLocationId = emp.location_id ? Number(emp.location_id) : null;
              if (empLocationId !== selectedLocationIdNum) {
                return; // Skip employees that don't match the location
              }
              
              // Get existing attendance data for this employee, date, and location
              const existingAtt = this.existingAttendances.get(emp.id);
              
              // Verify existing attendance matches both date and location
              if (existingAtt) {
                const attDate = existingAtt.date ? new Date(existingAtt.date).toISOString().split('T')[0] : null;
                const attLocationId = existingAtt.location_id ? Number(existingAtt.location_id) : null;
                if (attDate !== selectedDate || attLocationId !== selectedLocationIdNum) {
                  // Don't use this attendance data if it doesn't match both date and location
                  const empGroup = this.fb.group({
                    selected: [true],
                    employee_id: [emp.id],
                    status: ['present'], // Default status
                    check_in_time: [''],
                    check_out_time: [''],
                    notes: ['']
                  });
                  this.bulkEmployeesFormArray.push(empGroup);
                  return;
                }
              }
              
              const empGroup = this.fb.group({
                selected: [true], // Default to selected
                employee_id: [emp.id],
                status: [existingAtt?.status || 'present'], // Update with latest saved status if matches date and location
                // Show saved times if they exist and match the date and location
                check_in_time: [existingAtt?.check_in_time ? this.formatTimeForInput(existingAtt.check_in_time) : ''],
                check_out_time: [existingAtt?.check_out_time ? this.formatTimeForInput(existingAtt.check_out_time) : ''],
                notes: [existingAtt?.notes || ''] // Update with latest saved notes
              });
              this.bulkEmployeesFormArray.push(empGroup);
            });

            this.loading = false;
            
            // Defer change detection to avoid ExpressionChangedAfterItHasBeenCheckedError
            setTimeout(() => {
              this.cdr.detectChanges();
              // Show notification if data was updated
              if (existing.length > 0) {
                this.notification.info(`Loaded ${existing.length} existing attendance record(s) for this date`);
              }
            }, 0);
          },
          error: (err) => {
            console.error('Error loading existing attendances:', err);
            this.loading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error loading employees:', err);
        this.notification.error('Error loading employees');
        this.loading = false;
      }
    });
  }

  formatTimeForInput(dateTime: string): string {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  getEmployeeName(index: number): string {
    const emp = this.bulkEmployees[index];
    if (!emp) return 'Unknown';
    return `${emp.person?.first_name || ''} ${emp.person?.last_name || ''}`.trim() || 'Unknown';
  }

  getEmployeeNumber(index: number): string {
    const emp = this.bulkEmployees[index];
    return emp?.employee_number || '';
  }

  get allSelected(): boolean {
    if (this.bulkEmployeesFormArray.length === 0) return false;
    return this.bulkEmployeesFormArray.controls.every(control => control.get('selected')?.value);
  }

  toggleSelectAll(event: any): void {
    const checked = event.target.checked;
    this.bulkEmployeesFormArray.controls.forEach(control => {
      control.patchValue({ selected: checked });
    });
  }

  selectAllEmployees(): void {
    this.bulkEmployeesFormArray.controls.forEach(control => {
      control.patchValue({ selected: true });
    });
  }

  deselectAllEmployees(): void {
    this.bulkEmployeesFormArray.controls.forEach(control => {
      control.patchValue({ selected: false });
    });
  }

  setAllStatus(status: 'present' | 'absent' | 'late' | 'half_day'): void {
    this.bulkEmployeesFormArray.controls.forEach(control => {
      if (control.get('selected')?.value) {
        control.patchValue({ status });
      }
    });
  }

  autoSetAllTimes(): void {
    const defaultInTime = '09:00';
    const defaultOutTime = '18:00';
    
    this.bulkEmployeesFormArray.controls.forEach(control => {
      if (control.get('selected')?.value && control.get('status')?.value === 'present') {
        const existingIn = control.get('check_in_time')?.value;
        const existingOut = control.get('check_out_time')?.value;
        
        if (!existingIn) {
          control.patchValue({ check_in_time: defaultInTime });
        }
        if (!existingOut) {
          control.patchValue({ check_out_time: defaultOutTime });
        }
      }
    });
  }

  getSelectedCount(): number {
    return this.bulkEmployeesFormArray.controls.filter(control => control.get('selected')?.value).length;
  }

  saveBulkAttendance(): void {
    if (this.bulkAttendanceForm.invalid) {
      this.notification.error('Please fill all required fields');
      return;
    }

    const date = this.bulkAttendanceForm.get('date')?.value;
    const locationId = this.bulkAttendanceForm.get('location_id')?.value;

    if (!date || !locationId) {
      this.notification.error('Please select both date and location');
      return;
    }

    // Validate and format date to ensure consistency
    const selectedDate = new Date(date).toISOString().split('T')[0];
    if (!selectedDate) {
      this.notification.error('Invalid date format');
      return;
    }

    const selectedEmployees = this.bulkEmployeesFormArray.controls
      .filter(control => control.get('selected')?.value)
      .map(control => {
        const value = control.value;
        const attendanceData: any = {
          employee_id: value.employee_id,
          location_id: locationId,
          date: selectedDate, // Use validated and formatted date
          status: value.status,
          notes: value.notes || null
        };

        // Only add check-in time if explicitly provided (don't send if empty)
        // This ensures we only update the specific date's record
        if (value.check_in_time && value.check_in_time.trim() !== '') {
          const checkInDateTime = new Date(`${selectedDate}T${value.check_in_time}`);
          attendanceData.check_in_time = checkInDateTime.toISOString();
        }
        // Don't include check_in_time in the payload if empty - backend will preserve existing

        // Only add check-out time if explicitly provided (don't send if empty)
        // Users can update checkout time at end of day
        if (value.check_out_time && value.check_out_time.trim() !== '') {
          const checkOutDateTime = new Date(`${selectedDate}T${value.check_out_time}`);
          attendanceData.check_out_time = checkOutDateTime.toISOString();
        }
        // Don't include check_out_time in the payload if empty - backend will preserve existing

        return attendanceData;
      });

    if (selectedEmployees.length === 0) {
      this.notification.error('Please select at least one employee');
      return;
    }

    this.loading = true;
    this.attendanceService.bulkSave(selectedEmployees).subscribe({
      next: (response) => {
        this.notification.success(response.message || `Successfully saved ${selectedEmployees.length} attendance record(s)`);
        this.attendanceRealtimeUpdates$.next({ type: 'refresh' });
        
        // Small delay to ensure backend has processed the save before reloading
        setTimeout(() => {
          this.loadBulkEmployees(); // Reload to show updated data with latest saved values
        }, 300);
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error saving bulk attendance');
        this.loading = false;
      }
    });
  }
}
