import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map } from 'rxjs/operators';

export const adminGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // Yahan apna Admin Email likhein (Multiple admins bhi add kar sakte hain)
  const allowedAdminEmails = [
    'admin@filecrafters.in', 
    'wmohd2514@outlook.com' // Isey apne actual email se replace karein
  ];

  return authState(auth).pipe(
    map(user => {
      // Check 1: User logged in hona chahiye
      // Check 2: User ka email humari admin list mein hona chahiye
      if (user && user.email && allowedAdminEmails.includes(user.email)) {
        return true; // Access Granted! ✅
      } else {
        // Access Denied! ❌ Wapas login page par bhejo
        alert('Access Denied: Restricted Admin Area.');
        router.navigate(['/login']);
        return false;
      }
    })
  );
};