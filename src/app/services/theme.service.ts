import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<AppTheme>(this.readStoredTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
    this.applyTheme(theme);
  }

  private readStoredTheme(): AppTheme {
    try {
      return this.document.defaultView?.localStorage.getItem('student-solution-theme') === 'light'
        ? 'light'
        : 'dark';
    } catch {
      return 'dark';
    }
  }

  private applyTheme(theme: AppTheme): void {
    this.document.body.classList.toggle('app-theme-light', theme === 'light');
    this.document.body.classList.toggle('app-theme-dark', theme === 'dark');

    try {
      this.document.defaultView?.localStorage.setItem('student-solution-theme', theme);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }
}