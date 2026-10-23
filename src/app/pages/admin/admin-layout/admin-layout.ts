import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterOutlet, RouterLinkActive],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.scss']
})
export class AdminLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);

  isSidebarOpen: boolean = false;
  globalSearch = '';
  readonly theme = this.themeService.theme;

  get pageTitle(): string {
    const path = this.router.url.split('?')[0];
    if (/\/students\/[^/]+/.test(path)) return 'Student Profile';
    if (/\/teachers\/[^/]+/.test(path)) return 'Teacher Profile';
    if (/\/delivery\/[^/]+/.test(path)) return 'Delivery Profile';
    const section = path.split('/').filter(Boolean).at(-1) || 'dashboard';
    const titles: Record<string, string> = {
      dashboard: 'Dashboard', orders: 'Manage Orders', students: 'Student Management',
      teachers: 'Teacher Management', delivery: 'Delivery Management',
      'order-details': 'Order Insights', complaints: 'Support Desk'
    };
    return titles[section] || 'Admin workspace';
  }

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        if (globalThis.innerWidth <= 900) this.isSidebarOpen = false;
      });
  }

  searchOrders() { const term = this.globalSearch.trim(); this.router.navigate(['/admin/orders'], { queryParams: term ? { search: term } : {} }); }

  toggleSidebar() { this.isSidebarOpen = !this.isSidebarOpen; }
  closeSidebar() { this.isSidebarOpen = false; }

  @HostListener('window:resize')
  onViewportResize() {
    if (window.innerWidth > 900) this.isSidebarOpen = false;
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
