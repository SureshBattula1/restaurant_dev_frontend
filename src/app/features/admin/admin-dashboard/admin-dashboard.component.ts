import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, User, Role, Location } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableConfig, DataTableColumn, DataTableFilter, DataTableAction, DataTableParams, DataTablePagination } from '../../../shared/interfaces/datatable-config.interface';
import { RolePermissionService, Permission, PermissionGroup } from '../../../core/services/role-permission.service';
import { Subject, Subscription } from 'rxjs';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatBadgeModule } from '@angular/material/badge';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    DataTableComponent,
    // Material Modules
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatTabsModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatBadgeModule,
    LoaderComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription[] = [];
  currentUser: any;
  activeTab: 'dashboard' | 'users' | 'roles' | 'locations' | 'permissions' = 'dashboard';
  selectedTabIndex = 0;
  tabNames = ['dashboard', 'users', 'roles', 'locations', 'permissions'];
  
  dashboardData: any = null;
  dashboardLoading = false;
  users: User[] = [];
  roles: Role[] = [];
  locations: Location[] = [];
  selectedLocationId?: number;
  
  // Permissions data
  permissions: Permission[] = [];
  groupedPermissions: PermissionGroup = {};
  selectedRoleForPermissions: Role | null = null;
  selectedUserForPermissions: User | null = null;
  rolePermissions: Permission[] = [];
  userPermissions: Permission[] = [];
  allUserPermissions: Permission[] = [];
  userPermissionTypes: { [permissionId: number]: 'allow' | 'deny' } = {}; // Track allow/deny for user permissions
  // Draft state for role/user permission modals (save only on Save button)
  rolePermissionIdsDraft: number[] = [];
  userPermissionIdsDraft: number[] = [];
  rolePermissionSearch = '';
  userPermissionSearch = '';
  rolePermissionsSaving = false;
  userPermissionsSaving = false;
  
  // Attendance data
  attendances: any[] = [];
  selectedAttendanceDate: string = new Date().toISOString().split('T')[0];
  
  // DataTable configurations
  usersTableConfig!: DataTableConfig;
  usersTableData: User[] = [];
  usersTablePagination: DataTablePagination | null = null;
  usersTableLoading = false;
  usersRealtimeUpdates$ = new Subject<any>();

  attendanceTableConfig!: DataTableConfig;
  attendanceTableData: any[] = [];
  attendanceTablePagination: DataTablePagination | null = null;
  attendanceTableLoading = false;
  attendanceRealtimeUpdates$ = new Subject<any>();

  userForm: FormGroup;
  roleForm: FormGroup;
  locationForm: FormGroup;
  permissionForm: FormGroup;
  
  showUserModal = false;
  showRoleModal = false;
  showLocationModal = false;
  showPermissionModal = false;
  selectedUser: User | null = null;
  selectedRole: Role | null = null;
  selectedLocation: Location | null = null;
  selectedPermission: Permission | null = null;
  permissionsLoading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private authService: AuthService,
    private router: Router,
    private notification: NotificationService,
    private rolePermissionService: RolePermissionService,
    private cdr: ChangeDetectorRef
  ) {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      location_id: [null, Validators.required],
      phone: [''],
      secondary_phone: [''],
      date_of_birth: [''],
      education: [''],
      education_details: [''],
      experience_years: [0],
      experience_details: [''],
      salary: [0],
      joining_date: [''],
      designation: [''],
      address: [''],
      city: [''],
      state: [''],
      postal_code: [''],
      emergency_contact_name: [''],
      emergency_contact_phone: [''],
      status: ['active', Validators.required],
      roles: [[], Validators.required]
    });

    this.roleForm = this.fb.group({
      name: ['', Validators.required],
      slug: ['', Validators.required],
      description: ['']
    });

    this.locationForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      address: [''],
      phone: [''],
      email: ['', Validators.email],
      status: ['active', Validators.required]
    });

    this.permissionForm = this.fb.group({
      name: ['', Validators.required],
      slug: ['', Validators.required],
      description: [''],
      module: ['', Validators.required]
    });
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    
    // Set default location
    this.selectedLocationId = this.currentUser?.location_id;
    
    // Initialize table configs (lightweight, no API calls)
    this.initializeUsersTableConfig();
    this.initializeAttendanceTableConfig();
    
    // OPTIMIZATION: Load dashboard and locations in parallel, but defer locations if not super admin
    this.loadDashboard();
    
    // OPTIMIZATION: Only load locations if super admin (needed for filter dropdown)
    // For regular users, locations can be loaded on demand
    if (this.isSuperAdmin()) {
      // Load locations after a small delay to not block initial render
      setTimeout(() => {
        this.loadLocations();
      }, 100);
    }
    
    // Defer all other data loading - load when user switches to that tab
    // Users: Loaded by DataTable when tab is opened
    // Roles: Load when roles tab is opened
    // Employees: Load when advance/salary modal is opened
  }

  initializeUsersTableConfig(): void {
    this.usersTableConfig = {
      columns: [
        { key: 'name', label: 'Name', sortable: true, filterable: true },
        { key: 'email', label: 'Email', sortable: true, filterable: true },
        { key: 'phone', label: 'Phone', sortable: false },
        { key: 'location.name', label: 'Location', sortable: true },
        { 
          key: 'roles', 
          label: 'Roles', 
          sortable: false,
          format: (v, row) => {
            if (row.roles && Array.isArray(row.roles) && row.roles.length > 0) {
              return row.roles.map((r: any) => r.name || r).join(', ');
            }
            return '-';
          }
        },
        { key: 'designation', label: 'Designation', sortable: true },
        { key: 'salary', label: 'Salary', sortable: true, type: 'currency', format: (v) => v ? `₹${Number(v).toFixed(2)}` : '-' },
        { 
          key: 'status', 
          label: 'Status', 
          sortable: true, 
          type: 'text'
        }
      ],
      filters: [
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' }
          ]
        },
        {
          key: 'role_id',
          label: 'Role',
          type: 'select',
          options: []
        }
      ],
      actions: [
        {
          label: 'Edit',
          icon: 'edit',
          color: 'primary',
          action: (row) => this.openUserModal(row),
          tooltip: 'Edit user',
          condition: (row) => !row.deleted_at // Only show edit if not deleted
        },
        {
          label: 'Permissions',
          icon: 'key',
          color: 'primary',
          action: (row) => this.openUserPermissionsModal(row),
          tooltip: 'Manage user permissions',
          condition: (row) => !row.deleted_at // Only show permissions if not deleted
        },
        {
          label: 'Delete',
          icon: 'delete',
          color: 'warn',
          action: (row) => this.deleteUser(row),
          tooltip: 'Soft delete user',
          condition: (row) => !row.deleted_at // Only show delete if not already deleted
        },
        {
          label: 'Restore',
          icon: 'restore',
          color: 'accent',
          action: (row) => this.restoreUser(row),
          tooltip: 'Restore deleted user',
          condition: (row) => !!row.deleted_at // Only show restore if deleted
        }
      ],
      pageSize: 10,
      pageSizeOptions: [5, 10, 25, 50, 100],
      showSearch: true,
      showExport: true,
      showPagination: true,
      enableRealtime: true,
      emptyMessage: 'No users found'
    };
  }

  loadUsersTableData = async (params: DataTableParams): Promise<any> => {
    // Defer loading state change to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.usersTableLoading = true;
      this.cdr.markForCheck();
    }, 0);
    
    // Build request params
    const requestParams: any = {
      page: params.page || 1,
      per_page: params.per_page || 10,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir
    };

    // Add location filter
    if (this.isSuperAdmin()) {
      if (this.selectedLocationId !== undefined && this.selectedLocationId !== null) {
        requestParams.location_id = this.selectedLocationId;
      }
    } else {
      requestParams.location_id = this.currentUser?.location_id;
    }

    // Add status filter
    if (params['status']) {
      requestParams.status = params['status'];
    }

    return new Promise((resolve, reject) => {
      this.adminService.getUsers(requestParams).subscribe({
        next: (response: any) => {
          let data: User[] = [];
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

          this.usersTableData = data;
          this.usersTablePagination = pagination;
          this.usersTableLoading = false;

          resolve({
            data,
            pagination
          });
        },
        error: (err) => {
          console.error('Error loading users:', err);
          this.notification.error('Error loading users');
          this.usersTableLoading = false;
          reject(err);
        }
      });
    });
  }

  initializeAttendanceTableConfig(): void {
    this.attendanceTableConfig = {
      columns: [
        { key: 'employee.person.first_name', label: 'Employee', sortable: true },
        { key: 'location.name', label: 'Location', sortable: true },
        { key: 'date', label: 'Date', sortable: true, type: 'date' },
        { key: 'check_in_time', label: 'Check In', sortable: true, type: 'date', format: (v) => v ? new Date(v).toLocaleString() : '-' },
        { key: 'check_out_time', label: 'Check Out', sortable: true, type: 'date', format: (v) => v ? new Date(v).toLocaleString() : '-' },
        { key: 'total_hours', label: 'Hours', sortable: true, format: (v) => v ? `${Number(v).toFixed(2)} hrs` : '-' },
        { key: 'status', label: 'Status', sortable: true }
      ],
      filters: [
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
          action: (row) => this.updateAttendance(row),
          tooltip: 'Edit attendance'
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

  loadAttendanceTableData = async (params: DataTableParams): Promise<any> => {
    this.attendanceTableLoading = true;
    
    const requestParams: any = {
      page: params.page || 1,
      per_page: params.per_page || 10,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
      date_from: params.date_from || this.selectedAttendanceDate,
      date_to: params.date_to || this.selectedAttendanceDate
    };

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
      this.adminService.getAttendances(requestParams).subscribe({
        next: (response: any) => {
          let data: any[] = [];
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

  switchTab(tab: string): void {
    const validTabs = ['dashboard', 'users', 'roles', 'locations', 'attendance', 'permissions'];
    if (validTabs.includes(tab)) {
      this.activeTab = tab as any;
      this.selectedTabIndex = this.tabNames.indexOf(tab);
      
      // Load data on-demand when switching tabs (lazy loading)
      if (tab === 'dashboard') {
        this.loadDashboard();
      } else if (tab === 'users') {
        // DataTable handles loading automatically, no need to call loadUsers()
      } else if (tab === 'attendance') {
        // DataTable handles loading automatically
      } else if (tab === 'roles' && this.roles.length === 0) {
        // Only load if not already loaded
        this.loadRoles();
      } else if (tab === 'permissions' && this.permissions.length === 0) {
        // Only load if not already loaded
        this.loadPermissions();
      } else if (tab === 'locations' && this.locations.length === 0) {
        // Only load if not already loaded
        this.loadLocations();
      }
    }
  }

  onTabChange(index: number): void {
    const tab = this.tabNames[index];
    if (tab) {
      this.switchTab(tab);
    }
  }

  loadDashboard(): void {
    let locationId: number | undefined;
    
    if (this.isSuperAdmin()) {
      // For super admin: use selectedLocationId, but if it's undefined/null, don't filter (show all)
      locationId = (this.selectedLocationId !== undefined && this.selectedLocationId !== null) 
        ? this.selectedLocationId 
        : undefined;
    } else {
      // For non-super admin: always use their location
      locationId = this.currentUser?.location_id;
    }
    
    this.dashboardLoading = true;
    this.adminService.getDashboard(locationId).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.dashboardLoading = false;
      },
      error: (err) => {
        console.error('Error loading dashboard:', err);
        this.dashboardLoading = false;
      }
    });
  }

  onLocationChange(): void {
    // Clear existing data first to prevent showing old data
    this.usersTableData = [];
    
    // Reset pagination
    this.usersTablePagination = null;
    
    // Reload all data when location filter changes
    this.loadDashboard();
    
    // Trigger data table refresh for currently active tab using realtime updates
    if (this.activeTab === 'users') {
      this.usersRealtimeUpdates$.next({ type: 'refresh', location_id: this.selectedLocationId });
    }
  }

  isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  loadUsers(): void {
    // DataTable handles loading automatically via loadUsersTableData
    // This method is kept for backward compatibility only
  }

  handleUserAction(event: { action: string; row: any }): void {
    // Handle actions from DataTable
    // Actions are already defined in the config, this is just for additional handling if needed
  }

  loadRoles(): void {
    this.adminService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        // Update role filter options in users table config
        if (this.usersTableConfig) {
          const roleFilter = this.usersTableConfig.filters?.find(f => f.key === 'role_id');
          if (roleFilter) {
            roleFilter.options = roles.map(role => ({
              value: role.id,
              label: role.name
            }));
          }
        }
        // Trigger change detection to update dropdown
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading roles:', err);
        this.notification.error('Failed to load roles. Please try again.');
      }
    });
  }

  loadLocations(): void {
    this.adminService.getLocations().subscribe({
      next: (locations) => {
        // Filter locations based on user role
        if (this.isSuperAdmin()) {
          // Super admin sees all locations
          this.locations = locations;
        } else {
          // Regular admin sees only their location
          const userLocationId = this.currentUser?.location_id;
          this.locations = userLocationId 
            ? locations.filter(loc => loc.id === userLocationId)
            : [];
        }
      },
      error: (err) => console.error('Error loading locations:', err)
    });
  }

  openUserModal(user?: User): void {
    this.selectedUser = user || null;
    
    // Ensure form is enabled when opening modal
    if (this.userForm.disabled) {
      this.userForm.enable();
    }
    
    // Load roles if not already loaded (needed for dropdown)
    if (this.roles.length === 0) {
      this.loadRoles();
      // Trigger change detection after roles are loaded
      this.cdr.detectChanges();
    }
    
    // Load locations if not already loaded (needed for dropdown)
    if (this.locations.length === 0) {
      this.loadLocations();
      // Trigger change detection after locations are loaded
      this.cdr.detectChanges();
    }
    
    // Auto-select location for non-super admins
    const autoLocationId = !this.isSuperAdmin() ? this.currentUser?.location_id : null;
    
    if (user) {
      this.userForm.patchValue({
        name: user.name,
        email: user.email,
        location_id: user.location_id || autoLocationId,
        phone: (user as any).phone || '',
        secondary_phone: (user as any).secondary_phone || '',
        date_of_birth: (user as any).date_of_birth || '',
        education: (user as any).education || '',
        education_details: (user as any).education_details || '',
        experience_years: (user as any).experience_years || 0,
        experience_details: (user as any).experience_details || '',
        salary: (user as any).salary || 0,
        joining_date: (user as any).joining_date || '',
        designation: (user as any).designation || '',
        address: (user as any).address || '',
        city: (user as any).city || '',
        state: (user as any).state || '',
        postal_code: (user as any).postal_code || '',
        emergency_contact_name: (user as any).emergency_contact_name || '',
        emergency_contact_phone: (user as any).emergency_contact_phone || '',
        status: user.status,
        roles: user.roles?.map((r: any) => r.id) || []
      });
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
      
      // Disable location field for non-super admins when editing
      if (!this.isSuperAdmin()) {
        this.userForm.get('location_id')?.disable();
        // Clear required validator when disabled
        this.userForm.get('location_id')?.clearValidators();
      } else {
        this.userForm.get('location_id')?.enable();
        // Add required validator when enabled
        this.userForm.get('location_id')?.setValidators([Validators.required]);
      }
      this.userForm.get('location_id')?.updateValueAndValidity();
    } else {
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('password')?.updateValueAndValidity();
      this.userForm.patchValue({
        password: '',
        location_id: autoLocationId, // Auto-select location for new users
        roles: [],
        phone: '',
        secondary_phone: '',
        date_of_birth: '',
        education: '',
        education_details: '',
        experience_years: 0,
        experience_details: '',
        salary: 0,
        joining_date: '',
        designation: '',
        address: '',
        city: '',
        state: '',
        postal_code: '',
        emergency_contact_name: '',
        emergency_contact_phone: ''
      });
      
      // Disable location field for non-super admins when creating
      if (!this.isSuperAdmin()) {
        this.userForm.get('location_id')?.disable();
        // Clear required validator when disabled
        this.userForm.get('location_id')?.clearValidators();
      } else {
        this.userForm.get('location_id')?.enable();
        // Add required validator when enabled
        this.userForm.get('location_id')?.setValidators([Validators.required]);
      }
      this.userForm.get('location_id')?.updateValueAndValidity();
    }
    this.showUserModal = true;
  }

  saveUser(): void {
    // Mark all fields as touched to show validation errors
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      // Get user-friendly field names
      const fieldNames: { [key: string]: string } = {
        'name': 'Name',
        'email': 'Email',
        'password': 'Password',
        'roles': 'Roles',
        'status': 'Status'
      };
      
      const invalidFields: string[] = [];
      Object.keys(this.userForm.controls).forEach(key => {
        const control = this.userForm.get(key);
        if (control && control.invalid && control.errors) {
          const fieldName = fieldNames[key] || key;
          invalidFields.push(fieldName);
        }
      });
      
      if (invalidFields.length > 0) {
        this.notification.error(`Please fill in all required fields: ${invalidFields.join(', ')}`);
      }
      return;
    }

    // Use getRawValue() to include disabled fields (like location_id for non-super admins)
    const userData = this.userForm.getRawValue();
    
    // Prevent multiple submissions
    if (this.userForm.disabled) return;
    
    // Only disable form if it's valid and we're about to submit
    this.userForm.disable();
    
    if (this.selectedUser) {
      this.adminService.updateUser(this.selectedUser.id, userData).subscribe({
        next: (response: any) => {
          this.notification.success('User updated successfully');
          this.usersRealtimeUpdates$.next({ type: 'updated', data: (response as any).user || response });
          this.showUserModal = false;
          this.selectedUser = null;
          this.userForm.reset();
          this.userForm.enable();
          // Reset password validators for next creation
          this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
          this.userForm.get('password')?.updateValueAndValidity();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error updating user');
          this.userForm.enable();
        }
      });
    } else {
      this.adminService.createUser(userData).subscribe({
        next: (response: any) => {
          this.notification.success('User created successfully');
          this.usersRealtimeUpdates$.next({ type: 'created', data: (response as any).user || response });
          this.showUserModal = false;
          this.selectedUser = null;
          this.userForm.reset();
          this.userForm.enable();
          // Reset password validators for next creation
          this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
          this.userForm.get('password')?.updateValueAndValidity();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error creating user');
          this.userForm.enable();
        }
      });
    }
  }

  deleteUser(user: User): void {
    if (confirm(`Are you sure you want to delete user "${user.name}"?\n\nThis will soft delete the user. You can restore them later if needed.`)) {
      this.adminService.deleteUser(user.id).subscribe({
        next: () => {
          this.notification.success(`User "${user.name}" deleted successfully`);
          this.usersRealtimeUpdates$.next({ type: 'deleted', data: { id: user.id } });
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error deleting user');
        }
      });
    }
  }

  restoreUser(user: User): void {
    if (confirm(`Restore user "${user.name}"?`)) {
      this.adminService.restoreUser(user.id).subscribe({
        next: () => {
          this.notification.success(`User "${user.name}" restored successfully`);
          this.usersRealtimeUpdates$.next({ type: 'restored', data: { id: user.id } });
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error restoring user');
        }
      });
    }
  }

  deleteRole(role: Role): void {
    if (confirm(`Delete role ${role.name}?`)) {
      this.adminService.deleteRole(role.id).subscribe({
        next: () => {
          this.notification.success('Role deleted successfully');
          this.loadRoles();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error deleting role');
        }
      });
    }
  }

  deleteLocation(location: Location): void {
    if (confirm(`Delete location ${location.name}?`)) {
      this.adminService.deleteLocation(location.id).subscribe({
        next: () => {
          this.notification.success('Location deleted successfully');
          this.loadLocations();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error deleting location');
        }
      });
    }
  }

  openRoleModal(role?: Role): void {
    this.selectedRole = role || null;
    if (role) {
      this.roleForm.patchValue(role);
    }
    this.showRoleModal = true;
  }

  saveRole(): void {
    if (this.roleForm.invalid) return;

    const roleData = this.roleForm.value;
    if (this.selectedRole) {
      this.adminService.updateRole(this.selectedRole.id, roleData).subscribe({
        next: () => {
          this.loadRoles();
          this.showRoleModal = false;
        },
        error: (err) => console.error('Error updating role:', err)
      });
    } else {
      this.adminService.createRole(roleData).subscribe({
        next: () => {
          this.loadRoles();
          this.showRoleModal = false;
        },
        error: (err) => console.error('Error creating role:', err)
      });
    }
  }

  openLocationModal(location?: Location): void {
    this.selectedLocation = location || null;
    if (location) {
      this.locationForm.patchValue(location);
    }
    this.showLocationModal = true;
  }

  saveLocation(): void {
    if (this.locationForm.invalid) return;

    const locationData = this.locationForm.value;
    if (this.selectedLocation) {
      this.adminService.updateLocation(this.selectedLocation.id, locationData).subscribe({
        next: () => {
          this.loadLocations();
          this.showLocationModal = false;
        },
        error: (err) => console.error('Error updating location:', err)
      });
    } else {
      this.adminService.createLocation(locationData).subscribe({
        next: () => {
          this.loadLocations();
          this.showLocationModal = false;
        },
        error: (err) => console.error('Error creating location:', err)
      });
    }
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.selectedUser = null;
    this.userForm.reset();
    // Re-enable location field
    this.userForm.get('location_id')?.enable();
    // Reset password validators for next creation
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
  }

  closeRoleModal(): void {
    this.showRoleModal = false;
  }

  closeLocationModal(): void {
    this.showLocationModal = false;
  }

  // Attendance methods
  loadAttendances(): void {
    let locationId: number | undefined;
    
    if (this.isSuperAdmin()) {
      // For super admin: use selectedLocationId, but if it's undefined/null, don't filter (show all)
      locationId = (this.selectedLocationId !== undefined && this.selectedLocationId !== null) 
        ? this.selectedLocationId 
        : undefined;
    } else {
      // For non-super admin: always use their location
      locationId = this.currentUser?.location_id;
    }
    
    // Ensure we have a valid date
    if (!this.selectedAttendanceDate) {
      this.selectedAttendanceDate = new Date().toISOString().split('T')[0];
    }
    
    this.adminService.getDailyAttendance(this.selectedAttendanceDate, locationId).subscribe({
      next: (response) => {
        console.log('Attendance API Response:', response);
        // Handle different response structures
        if (response && response.attendances) {
          this.attendances = response.attendances;
        } else if (response && response.data && Array.isArray(response.data)) {
          this.attendances = response.data;
        } else if (Array.isArray(response)) {
          this.attendances = response;
        } else {
          this.attendances = [];
        }
        
        if (this.attendances.length === 0) {
          console.log('No attendance records found for date:', this.selectedAttendanceDate, 'location:', locationId);
        } else {
          console.log('Loaded', this.attendances.length, 'attendance records');
        }
      },
      error: (err) => {
        console.error('Error loading attendances:', err);
        this.notification.error(err.error?.message || 'Error loading attendances');
        this.attendances = [];
      }
    });
  }

  onAttendanceDateChange(): void {
    // Trigger DataTable reload
    if (this.attendanceTableConfig) {
      // DataTable will reload automatically when date changes
    }
  }

  updateAttendance(attendance: any): void {
    const data = {
      check_in_time: attendance.check_in_time,
      check_out_time: attendance.check_out_time,
      status: attendance.status,
      notes: attendance.notes
    };
    this.adminService.updateAttendance(attendance.id, data).subscribe({
      next: () => {
        this.notification.success('Attendance updated successfully');
        this.attendanceRealtimeUpdates$.next({ type: 'updated', data: attendance });
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error updating attendance');
      }
    });
  }

  markAbsent(employeeId: number): void {
    const locationId = this.isSuperAdmin() ? this.selectedLocationId : this.currentUser?.location_id;
    if (!locationId) {
      this.notification.error('Please select a location');
      return;
    }
    const data = {
      employee_id: employeeId,
      location_id: locationId,
      date: this.selectedAttendanceDate,
      notes: ''
    };
    this.adminService.markAbsent(data).subscribe({
      next: () => {
        this.notification.success('Absence marked successfully');
        this.attendanceRealtimeUpdates$.next({ type: 'created', data });
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error marking absence');
      }
    });
  }

  // Permission Management Methods
  loadPermissions(): void {
    this.permissionsLoading = true;
    this.rolePermissionService.getPermissions().subscribe({
      next: (response) => {
        this.permissions = response.permissions;
        this.groupedPermissions = response.grouped;
        this.permissionsLoading = false;
      },
      error: (err) => {
        console.error('Error loading permissions:', err);
        this.notification.error('Error loading permissions');
        this.permissionsLoading = false;
      }
    });
  }

  hasAdminRole(): boolean {
    const user = this.authService.getCurrentUser();
    if (!user || !user.roles) return false;
    return user.roles.some((r: any) => r.slug === 'admin' || r.slug === 'super-admin');
  }

  openPermissionModal(permission?: Permission): void {
    this.selectedPermission = permission || null;
    if (permission) {
      this.permissionForm.patchValue({
        name: permission.name,
        slug: permission.slug,
        description: permission.description || '',
        module: permission.module
      });
    } else {
      this.permissionForm.reset({
        name: '',
        slug: '',
        description: '',
        module: ''
      });
    }
    this.showPermissionModal = true;
  }

  closePermissionModal(): void {
    this.showPermissionModal = false;
    this.selectedPermission = null;
    this.permissionForm.reset();
  }

  savePermission(): void {
    if (this.permissionForm.invalid) {
      this.permissionForm.markAllAsTouched();
      return;
    }

    const formData = this.permissionForm.value;

    if (this.selectedPermission) {
      // Update existing permission
      this.rolePermissionService.updatePermission(this.selectedPermission.id, formData).subscribe({
        next: () => {
          this.notification.success('Permission updated successfully');
          this.loadPermissions();
          this.closePermissionModal();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error updating permission');
        }
      });
    } else {
      // Create new permission
      this.rolePermissionService.createPermission(formData).subscribe({
        next: () => {
          this.notification.success('Permission created successfully');
          this.loadPermissions();
          this.closePermissionModal();
        },
        error: (err) => {
          this.notification.error(err.error?.message || 'Error creating permission');
        }
      });
    }
  }

  openRolePermissionsModal(role: Role): void {
    this.selectedRoleForPermissions = role;
    this.rolePermissionSearch = '';
    const loadRolePerms = () => {
      this.rolePermissionService.getRolePermissions(role.id).subscribe({
        next: (response) => {
          this.rolePermissions = response.permissions;
          this.rolePermissionIdsDraft = response.permissions
            .map(p => p.id)
            .filter(id => this.permissions.some(perm => perm.id === id));
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading role permissions:', err);
          this.notification.error(err.error?.message || 'Error loading role permissions');
          if (err.status === 403) {
            this.closeRolePermissionsModal();
          }
        }
      });
    };
    if (this.permissions.length === 0) {
      this.permissionsLoading = true;
      this.rolePermissionService.getPermissions().subscribe({
        next: (response) => {
          this.permissions = response.permissions;
          this.groupedPermissions = response.grouped;
          this.permissionsLoading = false;
          loadRolePerms();
        },
        error: (err) => {
          console.error('Error loading permissions:', err);
          this.notification.error('Error loading permissions');
          this.permissionsLoading = false;
        }
      });
    } else {
      loadRolePerms();
    }
  }

  openUserPermissionsModal(user: User): void {
    this.selectedUserForPermissions = user;
    this.userPermissionSearch = '';
    this.userPermissionTypes = {};
    const loadUserPerms = () => {
      this.rolePermissionService.getUserPermissions(user.id).subscribe({
        next: (response) => {
          this.userPermissions = response.user_permissions;
          this.allUserPermissions = response.all_permissions;
          this.userPermissionIdsDraft = response.user_permissions.map((p: Permission) => p.id);
          response.user_permissions.forEach((perm: Permission & { type?: string }) => {
            this.userPermissionTypes[perm.id] = (perm as any).pivot?.type === 'deny' ? 'deny' : 'allow';
          });
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading user permissions:', err);
          this.notification.error('Error loading user permissions');
        }
      });
    };
    if (this.permissions.length === 0) {
      this.permissionsLoading = true;
      this.rolePermissionService.getPermissions().subscribe({
        next: (response) => {
          this.permissions = response.permissions;
          this.groupedPermissions = response.grouped;
          this.permissionsLoading = false;
          loadUserPerms();
        },
        error: (err) => {
          console.error('Error loading permissions:', err);
          this.notification.error('Error loading permissions');
          this.permissionsLoading = false;
        }
      });
    } else {
      loadUserPerms();
    }
  }

  assignPermissionsToRole(roleId: number, permissionIds: number[]): void {
    this.rolePermissionService.assignPermissionToRole(roleId, permissionIds).subscribe({
      next: () => {
        this.notification.success('Permissions assigned to role successfully');
        this.loadRoles();
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error assigning permissions');
      }
    });
  }

  assignPermissionsToUser(userId: number, permissionIds: number[]): void {
    // Convert to new format with allow/deny types
    const permissions = permissionIds.map(permissionId => ({
      permission_id: permissionId,
      type: this.userPermissionTypes[permissionId] || 'allow'
    }));

    // Use the new API format
    this.rolePermissionService.assignPermissionToUser(userId, permissions).subscribe({
      next: () => {
        this.notification.success('Permissions assigned to user successfully');
        // Refresh permissions to get updated list
        if (this.selectedUserForPermissions) {
          this.openUserPermissionsModal(this.selectedUserForPermissions);
        }
        this.loadUsers();
        // Refresh user permissions in auth service if it's the current user
        if (this.authService.getCurrentUser()?.id === userId) {
          this.authService.refreshPermissions().subscribe();
        }
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error assigning permissions');
      }
    });
  }

  revokePermissionsFromUser(userId: number, permissionIds: number[]): void {
    this.rolePermissionService.revokePermissionFromUser(userId, permissionIds).subscribe({
      next: () => {
        this.notification.success('Permissions revoked from user successfully');
        this.openUserPermissionsModal(this.selectedUserForPermissions!);
        this.loadUsers();
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error revoking permissions');
      }
    });
  }

  isPermissionAssigned(permissionId: number, permissions: Permission[]): boolean {
    return permissions.some(p => p.id === permissionId);
  }

  /** Draft-only toggle for role permissions (no API until Save) */
  toggleRolePermissionDraft(permissionId: number): void {
    const idx = this.rolePermissionIdsDraft.indexOf(permissionId);
    if (idx >= 0) {
      this.rolePermissionIdsDraft = this.rolePermissionIdsDraft.filter(id => id !== permissionId);
    } else {
      this.rolePermissionIdsDraft = [...this.rolePermissionIdsDraft, permissionId];
    }
  }

  /** Draft-only toggle for user permissions (no API until Save) */
  toggleUserPermissionDraft(permissionId: number): void {
    const idx = this.userPermissionIdsDraft.indexOf(permissionId);
    if (idx >= 0) {
      this.userPermissionIdsDraft = this.userPermissionIdsDraft.filter(id => id !== permissionId);
    } else {
      this.userPermissionIdsDraft = [...this.userPermissionIdsDraft, permissionId];
      if (!this.userPermissionTypes[permissionId]) {
        this.userPermissionTypes[permissionId] = 'allow';
      }
    }
  }

  saveRolePermissions(): void {
    if (!this.selectedRoleForPermissions) return;
    this.rolePermissionsSaving = true;
    this.rolePermissionService.assignPermissionToRole(this.selectedRoleForPermissions.id, this.rolePermissionIdsDraft).subscribe({
      next: () => {
        this.notification.success('Permissions saved successfully');
        this.rolePermissionsSaving = false;
        this.rolePermissions = this.permissions.filter(p => this.rolePermissionIdsDraft.includes(p.id));
        this.closeRolePermissionsModal();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error saving permissions');
        this.rolePermissionsSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  saveUserPermissions(): void {
    if (!this.selectedUserForPermissions) return;
    const permissions = this.userPermissionIdsDraft.map(permissionId => ({
      permission_id: permissionId,
      type: this.userPermissionTypes[permissionId] || 'allow'
    }));
    this.userPermissionsSaving = true;
    this.rolePermissionService.assignPermissionToUser(this.selectedUserForPermissions.id, permissions).subscribe({
      next: () => {
        this.notification.success('Permissions saved successfully');
        this.userPermissionsSaving = false;
        this.userPermissions = this.permissions.filter(p => this.userPermissionIdsDraft.includes(p.id));
        if (this.authService.getCurrentUser()?.id === this.selectedUserForPermissions!.id) {
          this.authService.refreshPermissions().subscribe();
        }
        this.loadUsers();
        this.closeUserPermissionsModal();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.notification.error(err.error?.message || 'Error saving permissions');
        this.userPermissionsSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Toggle permission type between allow and deny (draft only, no API until Save)
   */
  toggleUserPermissionType(permissionId: number): void {
    const currentType = this.userPermissionTypes[permissionId] || 'allow';
    this.userPermissionTypes[permissionId] = currentType === 'allow' ? 'deny' : 'allow';
    if (!this.userPermissionIdsDraft.includes(permissionId)) {
      this.userPermissionIdsDraft = [...this.userPermissionIdsDraft, permissionId];
    }
  }

  /**
   * Get permission type for display (uses draft state)
   */
  getUserPermissionType(permissionId: number): 'allow' | 'deny' | 'none' {
    if (!this.userPermissionIdsDraft.includes(permissionId)) {
      return 'none';
    }
    return this.userPermissionTypes[permissionId] || 'allow';
  }

  /** Filtered modules for role permissions modal (by search) */
  getFilteredPermissionModulesForRole(): string[] {
    const q = (this.rolePermissionSearch || '').trim().toLowerCase();
    if (!q) return Object.keys(this.groupedPermissions);
    return Object.keys(this.groupedPermissions).filter(module => {
      const perms = this.getFilteredPermissionsForRoleModule(module);
      return perms.length > 0;
    });
  }

  getFilteredPermissionsForRoleModule(module: string): Permission[] {
    const list = this.groupedPermissions[module] || [];
    const q = (this.rolePermissionSearch || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      (p.name || '').toLowerCase().includes(q) || (p.slug || '').toLowerCase().includes(q)
    );
  }

  /** Filtered modules for user permissions modal (by search) */
  getFilteredPermissionModulesForUser(): string[] {
    const q = (this.userPermissionSearch || '').trim().toLowerCase();
    if (!q) return Object.keys(this.groupedPermissions);
    return Object.keys(this.groupedPermissions).filter(module => {
      const perms = this.getFilteredPermissionsForUserModule(module);
      return perms.length > 0;
    });
  }

  getFilteredPermissionsForUserModule(module: string): Permission[] {
    const list = this.groupedPermissions[module] || [];
    const q = (this.userPermissionSearch || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      (p.name || '').toLowerCase().includes(q) || (p.slug || '').toLowerCase().includes(q)
    );
  }

  closeRolePermissionsModal(): void {
    this.selectedRoleForPermissions = null;
    this.rolePermissions = [];
    this.rolePermissionIdsDraft = [];
    this.rolePermissionSearch = '';
  }

  closeUserPermissionsModal(): void {
    this.selectedUserForPermissions = null;
    this.userPermissions = [];
    this.allUserPermissions = [];
    this.userPermissionIdsDraft = [];
    this.userPermissionSearch = '';
  }

  // Helper method to get permission module keys for template
  getPermissionModules(): string[] {
    return Object.keys(this.groupedPermissions);
  }
}

