import { inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Database, get, ref } from '@angular/fire/database';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, defer, from, map, of, switchMap } from 'rxjs';

const adminEmails = new Set(['admin@filecrafters.in', 'wmohd2514@outlook.com']);

/** Protects delivery routes and ensures only active delivery personnel (and admins) can access. */
export const deliveryGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const db = inject(Database);
  const router = inject(Router);

  return authState(auth).pipe(
    switchMap(user => {
      if (!user) return of(router.createUrlTree(['/login']));
      if (user.email && adminEmails.has(user.email.toLowerCase())) return of(true);

      return defer(() => from(get(ref(db, `users/${user.uid}`)))).pipe(
        map(snapshot => {
          const profile = snapshot.val();
          return profile?.role === 'Delivery' && profile?.status === 'active'
            ? true
            : router.createUrlTree(['/login']);
        }),
        catchError(() => of(router.createUrlTree(['/login'])))
      );
    })
  );
};
