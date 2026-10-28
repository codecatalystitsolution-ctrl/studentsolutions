import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WelcomeComponent } from './welcome.component';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

describe('WelcomeComponent', () => {
  let component: WelcomeComponent;
  let fixture: ComponentFixture<WelcomeComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [WelcomeComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('creates the welcome component in crafting stage', () => {
    expect(component).toBeTruthy();
    expect(component.stage()).toBe('crafting');
  });

  it('transitions through crafting steps over time', () => {
    expect(component.craftingStep()).toBe(1);

    // Fast-forward to step 2
    vi.advanceTimersByTime(1300);
    expect(component.craftingStep()).toBe(2);

    // Fast-forward to step 3
    vi.advanceTimersByTime(1300);
    expect(component.craftingStep()).toBe(3);

    // Fast-forward to step 4
    vi.advanceTimersByTime(1300);
    expect(component.craftingStep()).toBe(4);

    // Fast-forward into 3D book inspection
    vi.advanceTimersByTime(1500);
    expect(component.stage()).toBe('inspecting');
    expect(component.isBookOpen()).toBe(true);
  });

  it('allows manual skipping to book inspection', () => {
    component.transitionToBookInspection();
    expect(component.stage()).toBe('inspecting');
    expect(component.isBookOpen()).toBe(true);
    expect(component.currentPageIndex()).toBe(0);
  });

  it('navigates through pages with next and previous buttons', () => {
    component.transitionToBookInspection();
    expect(component.currentPageIndex()).toBe(0);

    component.nextPage();
    expect(component.currentPageIndex()).toBe(1);

    component.nextPage();
    expect(component.currentPageIndex()).toBe(2);

    component.prevPage();
    expect(component.currentPageIndex()).toBe(1);

    component.goToPage(3);
    expect(component.currentPageIndex()).toBe(3);
  });

  it('completes the showcase when reaching beyond the last page', () => {
    component.transitionToBookInspection();
    component.goToPage(component.pages.length - 1);
    component.nextPage();

    expect(component.stage()).toBe('completed');
  });

  it('toggles autoplay on and off', () => {
    component.transitionToBookInspection();
    expect(component.isAutoPlay()).toBe(true);

    component.toggleAutoPlay();
    expect(component.isAutoPlay()).toBe(false);

    component.toggleAutoPlay();
    expect(component.isAutoPlay()).toBe(true);
  });

  it('navigates to target route when proceeding to platform', () => {
    component.proceedToPlatform('/login');
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('skips directly to new-order', () => {
    component.skipToOrder();
    expect(router.navigate).toHaveBeenCalledWith(['/new-order']);
  });
});
