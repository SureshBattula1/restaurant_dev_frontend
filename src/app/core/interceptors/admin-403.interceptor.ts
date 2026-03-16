import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

const ADMIN_API_PATTERN = /\/admin\//;
const DEFAULT_403_MESSAGE = "You don't have access to this resource. You can only manage users and roles below your own level.";

export const admin403Interceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 403 && req.url && ADMIN_API_PATTERN.test(req.url)) {
        const message = err.error?.message || DEFAULT_403_MESSAGE;
        notification.error(message);
      }
      return throwError(() => err);
    })
  );
};
