import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationComponent } from './shared/notification/notification.component';
import { ConfirmComponent } from './shared/confirmation/confirm.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationComponent, ConfirmComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly themeService = inject(ThemeService);
  protected readonly title = signal('filecrafters-web');
}
