import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Permission {
  id: number;
  name: string;
  slug: string;
  description?: string;
  module: string;
}

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  permissions?: Permission[];
}

export interface PermissionGroup {
  [module: string]: Permission[];
}

@Injectable({
  providedIn: 'root'
})
export class RolePermissionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get all roles with their permissions
   */
  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/admin/roles`);
  }

  /**
   * Get all permissions (grouped by module)
   */
  getPermissions(): Observable<{ permissions: Permission[]; grouped: PermissionGroup }> {
    return this.http.get<{ permissions: Permission[]; grouped: PermissionGroup }>(`${this.apiUrl}/admin/permissions`);
  }

  /**
   * Create a new role
   */
  createRole(roleData: { name: string; slug: string; description?: string; permission_ids: number[] }): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/roles`, roleData);
  }

  /**
   * Update a role
   */
  updateRole(roleId: number, roleData: { name?: string; slug?: string; description?: string; permission_ids?: number[] }): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/roles/${roleId}`, roleData);
  }

  /**
   * Create a new permission
   */
  createPermission(permissionData: { name: string; slug: string; description?: string; module: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/permissions`, permissionData);
  }

  /**
   * Update a permission
   */
  updatePermission(permissionId: number, permissionData: { name?: string; slug?: string; description?: string; module?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/permissions/${permissionId}`, permissionData);
  }

  /**
   * Assign permissions to a role
   */
  assignPermissionToRole(roleId: number, permissionIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/roles/${roleId}/permissions`, { permission_ids: permissionIds });
  }

  /**
   * Get permissions for a role
   */
  getRolePermissions(roleId: number): Observable<{ role: Role; permissions: Permission[] }> {
    return this.http.get<{ role: Role; permissions: Permission[] }>(`${this.apiUrl}/admin/roles/${roleId}/permissions`);
  }

  /**
   * Assign permissions to a user
   * Supports both old format (permissionIds: number[]) and new format (permissions: Array<{permission_id, type}>)
   */
  assignPermissionToUser(userId: number, permissions: number[] | Array<{permission_id: number, type: 'allow' | 'deny'}>): Observable<any> {
    // Check if it's old format (array of numbers) or new format (array of objects)
    if (permissions.length > 0 && typeof permissions[0] === 'number') {
      // Old format - backward compatibility
      return this.http.post(`${this.apiUrl}/admin/users/${userId}/permissions`, { permission_ids: permissions });
    } else {
      // New format with allow/deny
      return this.http.post(`${this.apiUrl}/admin/users/${userId}/permissions`, { permissions: permissions });
    }
  }

  /**
   * Revoke permissions from a user
   */
  revokePermissionFromUser(userId: number, permissionIds: number[]): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/users/${userId}/permissions`, {
      body: { permission_ids: permissionIds }
    });
  }

  /**
   * Get all permissions for a user (role + individual)
   */
  getUserPermissions(userId: number): Observable<{
    user_id: number;
    role_permissions: Permission[];
    user_permissions: Permission[];
    all_permissions: Permission[];
    permission_slugs: string[];
  }> {
    return this.http.get<{
      user_id: number;
      role_permissions: Permission[];
      user_permissions: Permission[];
      all_permissions: Permission[];
      permission_slugs: string[];
    }>(`${this.apiUrl}/admin/users/${userId}/permissions`);
  }
}



