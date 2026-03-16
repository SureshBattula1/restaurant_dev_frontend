import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PermissionUpdateService {
  private apiUrl = environment.apiUrl;
  private permissionUpdateSubject = new BehaviorSubject<boolean>(false);
  public permissionUpdate$ = this.permissionUpdateSubject.asObservable();

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {
    // Listen to user changes to detect permission updates
    this.authService.currentUser$.subscribe(() => {
      // User data changed, permissions may have been updated
      // Don't auto-notify here to avoid infinite loops
    });
  }

  /**
   * Notify that permissions have been updated
   */
  notifyPermissionUpdate(): void {
    this.permissionUpdateSubject.next(true);
  }

  /**
   * Refresh user permissions from API
   */
  refreshPermissions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`).pipe(
      tap((user: any) => {
        // Update user in auth service
        localStorage.setItem('user', JSON.stringify(user));
        (this.authService as any).currentUserSubject.next(user);
      })
    );
  }

  /**
   * Listen to WebSocket/broadcast events for permission updates
   * This would be called when setting up WebSocket connection
   */
  setupPermissionListener(): void {
    // In a real implementation, this would set up WebSocket listeners
    // For now, we'll use polling or manual refresh
    // Example: Echo.private(`user-permissions.${userId}`)
    //   .listen('.user.permissions.changed', () => {
    //     this.refreshPermissions().subscribe();
    //   });
  }
}

