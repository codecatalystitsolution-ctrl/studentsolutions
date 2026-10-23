import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  private readonly themeService = inject(ThemeService);
  readonly theme = this.themeService.theme;

  setDarkMode(enabled: boolean): void {
    this.themeService.setTheme(enabled ? 'dark' : 'light');
  }
}
