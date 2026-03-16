import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

export const permissionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  // Get required permission from route data
  const requiredPermission = route.data?.['permission'] as string;
  const requiredPermissions = route.data?.['permissions'] as string[];

  // If no permission required, allow access
  if (!requiredPermission && !requiredPermissions) {
    return true;
  }

  // Check single permission
  if (requiredPermission) {
    if (!permissionService.hasPermission(requiredPermission)) {
      // Redirect to a page user has access to, or admin dashboard
      router.navigate(['/admin']);
      return false;
    }
    return true;
  }

  // Check multiple permissions (any of them)
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!permissionService.hasAnyPermission(requiredPermissions)) {
      router.navigate(['/admin']);
      return false;
    }
    return true;
  }

  return true;
};


