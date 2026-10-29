import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Observable, firstValueFrom } from 'rxjs';
import { adminGuard } from './admin-guard';
import { NotificationService } from '../shared/notification/notification.service';

describe('adminGuard', () => {
  const authMock: { testUser?: { uid: string; email: string } | null } = { testUser: null };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Auth,
          useValue: authMock
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: string[]) => ({ toString: () => commands.join('/') } as UrlTree)
          }
        },
        {
          provide: NotificationService,
          useValue: {
            show: () => {}
          }
        }
      ]
    });
  });

  it('allows access for allowed administrator emails', async () => {
    for (const email of ['admin@studentsolutions.online', 'admin@filecrafters.in', 'wmohd2514@outlook.com']) {
      authMock.testUser = { uid: 'admin-uid', email };
      const result = await firstValueFrom(
        TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any)) as Observable<boolean | UrlTree>
      );
      expect(result).toBe(true);
    }
  });

  it('redirects unauthorized users to /admin/login', async () => {
    authMock.testUser = { uid: 'student-uid', email: 'student@example.com' };
    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any)) as Observable<boolean | UrlTree>
    );
    expect((result as UrlTree).toString()).toBe('/admin/login');
  });

  it('redirects unauthenticated users to /admin/login', async () => {
    authMock.testUser = null;
    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any)) as Observable<boolean | UrlTree>
    );
    expect((result as UrlTree).toString()).toBe('/admin/login');
  });
});
