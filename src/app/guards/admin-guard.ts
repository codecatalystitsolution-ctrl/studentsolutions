import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map } from 'rxjs/operators';
import { NotificationService } from '../shared/notification/notification.service';

const allowedAdminEmails = new Set([
  'admin@studentsolutions.online',
  'admin@studentsolutions.in',
  'admin@filecrafters.in',
  'wmohd2514@outlook.com'
]);

export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const notification = inject(NotificationService);

  return authState(auth).pipe(
    map(user => {
      if (user?.email && allowedAdminEmails.has(user.email.toLowerCase())) {
        return true;
      }

      notification.show('error', 'Access Denied: Restricted Admin Area.', 'Access Denied');
      return router.createUrlTree(['/admin/login']);
    })
  );
};
