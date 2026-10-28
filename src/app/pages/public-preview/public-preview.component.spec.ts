import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { PublicPreviewComponent } from './public-preview.component';
import { VisitorCounterService } from '../../services/visitor-counter.service';
import { ThemeService } from '../../services/theme.service';
import { SplashScreenService } from '../../services/splash-screen.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { AuthService } from '../../services/auth.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('PublicPreviewComponent', () => {
  let component: PublicPreviewComponent;
  let fixture: ComponentFixture<PublicPreviewComponent>;
  let router: Router;
  let notificationServiceMock: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    notificationServiceMock = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PublicPreviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: VisitorCounterService,
          useValue: {
            visitorCount: () => 1420,
            recordUniqueVisit: vi.fn().mockResolvedValue(true)
          }
        },
        {
          provide: ThemeService,
          useValue: {
            theme: () => 'dark',
            toggleTheme: vi.fn()
          }
        },
        {
          provide: NotificationService,
          useValue: notificationServiceMock
        },
        {
          provide: Auth,
          useValue: {}
        },
        {
          provide: AuthService,
          useValue: {
            getUserProfile: vi.fn(async () => null)
          }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(PublicPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the public preview component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('filters project portfolio by category', () => {
    expect(component.filteredProjects.length).toBe(6);
    component.filterCategory('web');
    expect(component.filteredProjects.length).toBe(2);
    expect(component.filteredProjects.every(p => p.category === 'web')).toBe(true);

    component.filterCategory('all');
    expect(component.filteredProjects.length).toBe(6);
  });

  it('opens and closes project details modal', () => {
    expect(component.selectedProject()).toBeNull();
    const sample = component.projects[0];
    component.openProjectDetails(sample);
    expect(component.selectedProject()).toBe(sample);

    component.closeProjectDetails();
    expect(component.selectedProject()).toBeNull();
  });

  it('toggles FAQ item expansion', () => {
    expect(component.activeFaq()).toBe(0);
    component.toggleFaq(1);
    expect(component.activeFaq()).toBe(1);
    component.toggleFaq(1);
    expect(component.activeFaq()).toBeNull();
  });

  it('triggers splash screen when not seen in session', async () => {
    const splashService = TestBed.inject(SplashScreenService);
    vi.spyOn(splashService, 'hasSeenSplash').mockReturnValue(false);
    const triggerSpy = vi.spyOn(splashService, 'triggerSplash');

    component.ngOnInit();
    await Promise.resolve();

    expect(triggerSpy).toHaveBeenCalledWith('/home');
  });

  it('provides dynamic visitor counter for unique visits', () => {
    expect(component.animatedVisitorCount()).toBeGreaterThan(1000);
  });

  it('redirects unauthenticated user to login when attempting to book or order', () => {
    component.currentUser.set(null);
    component.orderNow();

    expect(notificationServiceMock.show).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Please sign in or register'),
      'Login Required'
    );
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/new-order' } });
  });

  it('redirects authenticated student directly to new order page', () => {
    component.currentUser.set({ uid: 'student-123', role: 'Student' });
    component.orderNow();

    expect(router.navigate).toHaveBeenCalledWith(['/new-order']);
  });

  it('redirects authenticated teacher to teacher referrals portal', () => {
    component.currentUser.set({ uid: 'teacher-123', role: 'Teacher' });
    component.orderNow();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/referrals']);
  });

  it('redirects authenticated delivery partner to delivery portal', () => {
    component.currentUser.set({ uid: 'del-123', role: 'Delivery' });
    component.orderNow();

    expect(router.navigate).toHaveBeenCalledWith(['/delivery-portal']);
  });
});
