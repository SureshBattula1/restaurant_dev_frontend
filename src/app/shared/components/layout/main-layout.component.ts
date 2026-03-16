import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService, MenuItem } from '../../../core/services/permission.service';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatToolbarModule,
    MatMenuModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit {
  currentUser: any;
  sidebarOpen = true;
  menuItems: MenuItem[] = [];
  logoImageUrl: string;

  constructor(
    private authService: AuthService,
    private permissionService: PermissionService,
    private router: Router
  ) {
    // Construct the base URL from API URL (remove /api)
    const baseUrl = environment.apiUrl.replace('/api', '');
    this.logoImageUrl = `${baseUrl}/images/bigbridgz.jpg`;
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.updateMenuItems();
    
    // Subscribe to user changes to update menu when permissions change
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.updateMenuItems();
    });
    
    // Refresh user data on init to ensure permissions are loaded
    if (this.currentUser) {
      this.authService.refreshUser().subscribe({
        next: (user) => {
          this.currentUser = user;
          this.updateMenuItems();
        },
        error: (err) => {
          console.error('Error refreshing user:', err);
        }
      });
    }
  }

  private updateMenuItems(): void {
    // Get filtered menu items based on permissions
    this.menuItems = this.permissionService.getMenuItems();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  logout(): void {
    this.authService.logout();
  }

  hasPermission(permission: string): boolean {
    return this.permissionService.hasPermission(permission);
  }

  getMaterialIcon(route: string): string {
    const iconMap: { [key: string]: string } = {
      '/pos': 'point_of_sale',
      '/kitchen': 'restaurant_menu',
      '/inventory': 'inventory_2',
      '/raw-materials': 'category',
      '/purchase': 'shopping_cart',
      '/expense': 'payments',
      '/reports': 'assessment',
      '/admin': 'admin_panel_settings',
      '/cash-register': 'account_balance_wallet',
      '/cash-register/transactions': 'swap_horiz',
      '/attendance': 'event_available',
      '/salary': 'account_balance',
      '/financial': 'trending_up'
    };
    return iconMap[route] || 'dashboard';
  }
}

