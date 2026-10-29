import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NotificationComponent } from './shared/notification/notification.component';
import { ConfirmComponent } from './shared/confirmation/confirm.component';
import { ThemeService } from './services/theme.service';
import { SplashScreenComponent } from './pages/splash-screen/splash-screen.component';
import { SplashScreenService } from './services/splash-screen.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, NotificationComponent, ConfirmComponent, SplashScreenComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly themeService = inject(ThemeService);
  protected readonly splashService = inject(SplashScreenService);
  protected readonly title = signal('Student Solutions');
}
