import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { posAccessGuard } from './core/guards/pos-access.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { MainLayoutComponent } from './shared/components/layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/pos',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'qr-menu',
    loadComponent: () => import('./features/qr-ordering/qr-menu.component').then(m => m.QrMenuComponent)
  },
  {
    path: 'supplier-order/:token',
    loadComponent: () => import('./features/supplier-order/supplier-order.component').then(m => m.SupplierOrderComponent)
  },
  {
    path: 'menu-card',
    loadComponent: () => import('./features/menu-card/menu-card.component').then(m => m.MenuCardComponent)
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'pos',
        loadComponent: () => import('./features/pos/pos-dashboard/pos-dashboard.component').then(m => m.PosDashboardComponent),
        canActivate: [posAccessGuard]
      },
      {
        path: 'kitchen',
        loadComponent: () => import('./features/kitchen/kitchen-dashboard/kitchen-dashboard.component').then(m => m.KitchenDashboardComponent),
        canActivate: [permissionGuard],
        data: { permission: 'kitchen.orders.view' }
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/inventory/inventory-dashboard/inventory-dashboard.component').then(m => m.InventoryDashboardComponent),
        canActivate: [permissionGuard],
        data: { permission: 'inventory.view' }
      },
      {
        path: 'raw-materials',
        loadComponent: () => import('./features/raw-materials/raw-materials-dashboard/raw-materials-dashboard.component').then(m => m.RawMaterialsDashboardComponent),
        canActivate: [permissionGuard],
        data: { permission: 'inventory.view' }
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports-dashboard/reports-dashboard.component').then(m => m.ReportsDashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['reports.sales.view', 'reports.inventory.view', 'reports.financial.view'] }
      },
      {
        path: 'admin',
        loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['admin.users.manage', 'admin.roles.manage', 'admin.locations.manage', 'admin.settings.manage', 'admin.permission.view', 'admin.permission.manage'] }
      },
      {
        path: 'purchase',
        loadComponent: () => import('./features/purchase/purchase-dashboard/purchase-dashboard.component').then(m => m.PurchaseDashboardComponent),
        canActivate: [permissionGuard],
        data: { permission: 'purchase.view' }
      },
      {
        path: 'expense',
        loadComponent: () => import('./features/expense/expense-dashboard/expense-dashboard.component').then(m => m.ExpenseDashboardComponent),
        canActivate: [permissionGuard],
        data: { permission: 'expense.view' }
      },
      {
        path: 'cash-register',
        loadComponent: () => import('./features/cash-register/cash-register-layout.component').then(m => m.CashRegisterLayoutComponent),
        canActivate: [permissionGuard],
        data: { permission: 'transactions.view' },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/cash-register/cash-register.component').then(m => m.CashRegisterComponent)
          },
          {
            path: 'transactions',
            loadComponent: () => import('./features/transactions/transactions-dashboard/transactions-dashboard.component').then(m => m.TransactionsDashboardComponent)
          }
        ]
      },
      {
        path: 'attendance',
        loadComponent: () => import('./features/attendance/attendance-dashboard/attendance-dashboard.component').then(m => m.AttendanceDashboardComponent),
        canActivate: [permissionGuard],
        data: { permission: 'attendance.view' }
      },
      {
        path: 'salary',
        loadComponent: () => import('./features/salary/salary-dashboard/salary-dashboard.component').then(m => m.SalaryDashboardComponent),
        canActivate: [permissionGuard],
        data: { permission: 'salary.view' }
      },
      {
        path: 'financial',
        loadComponent: () => import('./features/financial/financial-dashboard/financial-dashboard.component').then(m => m.FinancialDashboardComponent),
        canActivate: [permissionGuard],
        data: { permission: 'financial.dashboard.view' }
      }
    ]
  }
];

