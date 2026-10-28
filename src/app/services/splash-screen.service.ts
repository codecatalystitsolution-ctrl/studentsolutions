import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class SplashScreenService {
  private router = inject(Router);

  // Splash Visibility State
  readonly isActive = signal<boolean>(false);
  readonly targetRoute = signal<string>('/home');

  private readonly SESSION_KEY = 'studentsolutions_splash_played';

  /**
   * Triggers the full splash animation before navigating to target
   */
  triggerSplash(target: string = '/home'): void {
    this.targetRoute.set(target);
    this.isActive.set(true);
  }

  /**
   * Completes the splash animation and navigates to the target route
   */
  completeSplash(): void {
    this.markAsSeen();
    this.isActive.set(false);
    const destination = this.targetRoute();
    if (destination && this.router.url !== destination) {
      this.router.navigate([destination]);
    }
  }

  /**
   * Skips the splash immediately
   */
  skipSplash(): void {
    this.completeSplash();
  }

  /**
   * Check if splash has been viewed in this browser session
   */
  hasSeenSplash(): boolean {
    try {
      return sessionStorage.getItem(this.SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Mark splash as viewed in session
   */
  markAsSeen(): void {
    try {
      sessionStorage.setItem(this.SESSION_KEY, 'true');
    } catch {
      // Ignore storage restrictions if private browsing
    }
  }

  /**
   * Reset session marker to replay
   */
  resetSplash(): void {
    try {
      sessionStorage.removeItem(this.SESSION_KEY);
    } catch {
      // Ignore
    }
  }
}
