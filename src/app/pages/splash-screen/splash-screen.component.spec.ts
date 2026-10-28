import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { SplashScreenComponent } from './splash-screen.component';
import { SplashScreenService } from '../../services/splash-screen.service';

describe('SplashScreenComponent', () => {
  let component: SplashScreenComponent;
  let fixture: ComponentFixture<SplashScreenComponent>;
  let splashService: SplashScreenService;
  let router: Router;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [SplashScreenComponent],
      providers: [
        provideRouter([]),
        SplashScreenService
      ]
    }).compileComponents();

    splashService = TestBed.inject(SplashScreenService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(splashService, 'completeSplash');

    fixture = TestBed.createComponent(SplashScreenComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create the splash screen component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize at phase 1 in dark neon mode', () => {
    fixture.detectChanges();
    expect(component.phase()).toBe(1);
    expect(component.isLightMode()).toBe(false);
    expect(component.isDissolving()).toBe(false);
  });

  it('should progress through storyboard phases over time', () => {
    fixture.detectChanges();
    expect(component.phase()).toBe(1);

    // 0.8s: transitions to phase 2
    vi.advanceTimersByTime(800);
    expect(component.phase()).toBe(2);

    // 1.6s: transitions to phase 3
    vi.advanceTimersByTime(800);
    expect(component.phase()).toBe(3);

    // 2.4s: transitions to phase 4
    vi.advanceTimersByTime(800);
    expect(component.phase()).toBe(4);

    // 3.2s: transitions to phase 5
    vi.advanceTimersByTime(800);
    expect(component.phase()).toBe(5);

    // 4.0s: transitions to phase 6
    vi.advanceTimersByTime(800);
    expect(component.phase()).toBe(6);

    // 4.8s: transitions to phase 7 (Light Mode)
    vi.advanceTimersByTime(800);
    expect(component.phase()).toBe(7);
    expect(component.isLightMode()).toBe(true);

    // 5.6s: transitions to phase 8 (Final tagline)
    vi.advanceTimersByTime(800);
    expect(component.phase()).toBe(8);

    // 6.0s + dissolution (700ms + 450ms)
    vi.advanceTimersByTime(700);
    expect(component.isDissolving()).toBe(true);

    vi.advanceTimersByTime(450);
    expect(splashService.completeSplash).toHaveBeenCalled();
  });

  it('should immediately complete and dissolve on skip()', () => {
    fixture.detectChanges();
    const emitSpy = vi.spyOn(component.splashCompleted, 'emit');

    component.skip();
    expect(component.isDissolving()).toBe(true);

    vi.advanceTimersByTime(450);
    expect(emitSpy).toHaveBeenCalled();
    expect(splashService.completeSplash).toHaveBeenCalled();
  });

  it('should restart sequence on replay()', () => {
    fixture.detectChanges();
    vi.advanceTimersByTime(2400); // at phase 4
    expect(component.phase()).toBe(4);

    component.replay();
    expect(component.phase()).toBe(1);
    expect(component.isLightMode()).toBe(false);
    expect(component.isDissolving()).toBe(false);
  });

  it('should navigate to targetRoute in standalone mode upon completion', () => {
    component.standaloneMode = true;
    component.targetRoute = '/home';
    fixture.detectChanges();

    component.completeSplash();
    vi.advanceTimersByTime(450);

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });
});
