import { Component, HostListener, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { Database, ref, onValue, Unsubscribe } from '@angular/fire/database';
import { AuthService } from '../../../services/auth.service';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterOutlet, RouterLinkActive],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.scss']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private db = inject(Database, { optional: true });

  isSidebarOpen: boolean = false;
  globalSearch = '';
  pendingTeachersCount = 0;
  pendingDeliveryCount = 0;
  pendingPayoutsCount = 0;
  private stopUsersListener: Unsubscribe | null = null;
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
      'order-details': 'Order Insights', complaints: 'Support Desk',
      payments: 'Financial Ledger', pricing: 'Pricing & Commission Settings', audit: 'Audit History'
    };
    return titles[section] || 'Admin workspace';
  }

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        if (globalThis.innerWidth <= 900) this.isSidebarOpen = false;
      });
  }

  ngOnInit(): void {
    if (this.db) {
      try {
        const usersRef = ref(this.db, 'users');
        this.stopUsersListener = onValue(usersRef, snapshot => {
          const users = snapshot.val() || {};
          let teacherCount = 0;
          let deliveryCount = 0;
          let payoutCount = 0;
          Object.keys(users).forEach(uid => {
            const u = users[uid];
            const role = (u.role || '').toLowerCase();
            const status = (u.status || '').toLowerCase();
            if (status === 'pending_approval') {
              if (role === 'teacher') teacherCount++;
              else if (role === 'delivery' || role === 'deliveryboy' || role === 'delivery-boy') deliveryCount++;
            }
            if (u.payoutRequests) {
              Object.values(u.payoutRequests).forEach((req: any) => {
                if (req?.status === 'pending') {
                  payoutCount++;
                }
              });
            }
          });
          this.pendingTeachersCount = teacherCount;
          this.pendingDeliveryCount = deliveryCount;
          this.pendingPayoutsCount = payoutCount;
        });
      } catch (err) {
        console.warn('Could not listen for user approvals in admin layout:', err);
      }
    }
  }

  ngOnDestroy(): void {
    this.stopUsersListener?.();
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
