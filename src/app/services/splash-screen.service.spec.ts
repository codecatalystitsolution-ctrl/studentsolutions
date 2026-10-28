import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SplashScreenService } from './splash-screen.service';

describe('SplashScreenService', () => {
  let service: SplashScreenService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });

    service = TestBed.inject(SplashScreenService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    service.resetSplash();
  });

  it('initializes with inactive splash', () => {
    expect(service.isActive()).toBe(false);
    expect(service.targetRoute()).toBe('/home');
  });

  it('triggers splash with specified destination', () => {
    service.triggerSplash('/home');
    expect(service.isActive()).toBe(true);
    expect(service.targetRoute()).toBe('/home');
  });

  it('completes splash and navigates to target route', () => {
    service.triggerSplash('/home');
    expect(service.isActive()).toBe(true);

    service.completeSplash();
    expect(service.isActive()).toBe(false);
    expect(service.hasSeenSplash()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('skips splash immediately', () => {
    service.triggerSplash('/home');
    service.skipSplash();
    expect(service.isActive()).toBe(false);
    expect(service.hasSeenSplash()).toBe(true);
  });
});
