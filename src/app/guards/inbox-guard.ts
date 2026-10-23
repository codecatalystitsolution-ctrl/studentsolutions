import { inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Database, get, ref } from '@angular/fire/database';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, defer, from, map, of, switchMap } from 'rxjs';

const adminEmails = new Set(['admin@filecrafters.in', 'wmohd2514@outlook.com']);
const inboxRoles = new Set(['Student', 'Teacher', 'Delivery']);

export const inboxGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const db = inject(Database);
  const router = inject(Router);
  return authState(auth).pipe(switchMap(user => {
    if (!user) return of(router.createUrlTree(['/login']));
    if (user.email && adminEmails.has(user.email.toLowerCase())) return of(true);
    return defer(() => from(get(ref(db, `users/${user.uid}`)))).pipe(
      map(snapshot => {
        const profile = snapshot.val();
        return profile?.status === 'active' && inboxRoles.has(profile?.role) ? true : router.createUrlTree(['/login']);
      }),
      catchError(() => of(router.createUrlTree(['/login'])))
    );
  }));
};
