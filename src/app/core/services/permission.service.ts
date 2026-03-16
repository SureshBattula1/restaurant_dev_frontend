import { Injectable } from '@angular/core';
import { AuthService, User } from './auth.service';
import { PermissionUpdateService } from './permission-update.service';
import { Subscription } from 'rxjs';

export interface MenuItem {
  label: string;
  route: string;
  icon: string;
  permission?: string; // Required permission to access
  children?: MenuItem[];
}

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private userPermissions: string[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private permissionUpdateService: PermissionUpdateService
  ) {
    // Subscribe to user changes to update permissions
    const userSub = this.authService.currentUser$.subscribe(user => {
      if (user && user.permissions) {
        this.userPermissions = Array.isArray(user.permissions) 
          ? user.permissions 
          : (user.permissions as any).permission_slugs || [];
      } else {
        this.userPermissions = [];
      }
    });
    this.subscriptions.push(userSub);

    // Subscribe to permission update notifications
    const updateSub = this.permissionUpdateService.permissionUpdate$.subscribe(updated => {
      if (updated) {
        // Refresh permissions when notified
        this.refreshPermissions();
      }
    });
    this.subscriptions.push(updateSub);

    // Load initial permissions
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.permissions) {
      this.userPermissions = Array.isArray(currentUser.permissions)
        ? currentUser.permissions
        : (currentUser.permissions as any).permission_slugs || [];
    }
  }

  /**
   * Refresh permissions from API
   */
  private refreshPermissions(): void {
    this.permissionUpdateService.refreshPermissions().subscribe({
      next: (user: any) => {
        // Permissions will be updated via currentUser$ subscription
      },
      error: (err) => {
        console.error('Error refreshing permissions:', err);
      }
    });
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string): boolean {
    const user = this.authService.getCurrentUser();
    
    // Super Admin has all permissions
    if (this.authService.isSuperAdmin()) {
      return true;
    }

    // Check if user has the permission
    return this.userPermissions.includes(permission);
  }

  /**
   * Check if user has any of the given permissions
   */
  hasAnyPermission(permissions: string[]): boolean {
    if (this.authService.isSuperAdmin()) {
      return true;
    }

    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Check if user can access a route based on permission
   */
  canAccess(route: string): boolean {
    // Map routes to required permissions
    const routePermissions: { [key: string]: string } = {
      '/pos': 'pos.view',
      '/kitchen': 'kitchen.orders.view',
      '/inventory': 'inventory.view',
      '/raw-materials': 'inventory.view',
      '/purchase': 'purchase.view',
      '/expense': 'expense.view',
      '/reports': 'reports.sales.view', // At least one report permission
      '/admin': 'admin.users.manage', // At least one admin permission
      '/cash-register': 'transactions.view',
      '/cash-register/transactions': 'transactions.view',
      '/attendance': 'attendance.view',
      '/salary': 'salary.view',
      '/financial': 'financial.dashboard.view',
    };

    const requiredPermission = routePermissions[route];
    
    if (!requiredPermission) {
      // If no permission required, allow access
      return true;
    }

    // For reports, check if user has any report permission
    if (route === '/reports') {
      return this.hasAnyPermission([
        'reports.sales.view',
        'reports.inventory.view',
        'reports.financial.view'
      ]);
    }

    // For admin, check if user has any admin permission
    if (route === '/admin') {
      return this.hasAnyPermission([
        'admin.users.manage',
        'admin.roles.manage',
        'admin.locations.manage',
        'admin.settings.manage',
        'admin.permission.view',
        'admin.permission.manage'
      ]);
    }

    return this.hasPermission(requiredPermission);
  }

  /**
   * Get all user permissions
   */
  getUserPermissions(): string[] {
    return [...this.userPermissions];
  }

  /**
   * Get filtered menu items based on permissions
   */
  getMenuItems(): MenuItem[] {
    const allMenuItems: MenuItem[] = [
      {
        label: 'POS Dashboard',
        route: '/pos',
        icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
        permission: 'pos.view'
      },
      {
        label: 'Kitchen Display',
        route: '/kitchen',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        permission: 'kitchen.orders.view'
      },
      {
        label: 'Inventory',
        route: '/inventory',
        icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
        permission: 'inventory.view'
      },
      {
        label: 'Raw Materials',
        route: '/raw-materials',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
        permission: 'inventory.view'
      },
      {
        label: 'Purchase & Suppliers',
        route: '/purchase',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        permission: 'purchase.view'
      },
      {
        label: 'Expense Management',
        route: '/expense',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        permission: 'expense.view'
      },
      {
        label: 'Reports',
        route: '/reports',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
        permission: 'reports.sales.view' // Will check for any report permission
      },
      {
        label: 'Admin',
        route: '/admin',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
        permission: 'admin.users.manage' // Will check for any admin permission
      },
      {
        label: 'Cash Register',
        route: '/cash-register',
        icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
        permission: 'transactions.view'
      },
      {
        label: 'Attendance',
        route: '/attendance',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
        permission: 'attendance.view'
      },
      {
        label: 'Salary',
        route: '/salary',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        permission: 'salary.view'
      },
      {
        label: 'Financial',
        route: '/financial',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
        permission: 'financial.dashboard.view'
      },
    ];

    // Filter menu items based on permissions
    return allMenuItems.filter(item => {
      if (!item.permission) {
        return true; // No permission required
      }

      // Special handling for reports and admin
      if (item.route === '/reports') {
        return this.hasAnyPermission([
          'reports.sales.view',
          'reports.inventory.view',
          'reports.financial.view'
        ]);
      }

      if (item.route === '/admin') {
        return this.hasAnyPermission([
          'admin.users.manage',
          'admin.roles.manage',
          'admin.locations.manage',
          'admin.settings.manage',
          'admin.permission.view',
          'admin.permission.manage'
        ]);
      }

      return this.hasPermission(item.permission);
    });
  }

  /**
   * Update permissions (called when user data is refreshed)
   */
  updatePermissions(permissions: string[]): void {
    this.userPermissions = permissions;
  }
}



