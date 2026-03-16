import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

export const posAccessGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  
  // If user is not authenticated, redirect to login
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  // Check for pos.view permission
  if (!permissionService.hasPermission('pos.view')) {
    router.navigate(['/admin']);
    return false;
  }

  return true;
};


