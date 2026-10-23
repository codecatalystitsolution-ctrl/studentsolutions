import { inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Database, get, ref } from '@angular/fire/database';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, defer, from, map, of, switchMap } from 'rxjs';

export const deliveryGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const db = inject(Database);
  const router = inject(Router);

  return authState(auth).pipe(
    switchMap(user => {
      if (!user) return of(router.createUrlTree(['/login']));
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
