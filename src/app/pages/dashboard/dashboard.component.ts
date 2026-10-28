import { Component, OnInit, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, RouterOutlet, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { Auth, authState } from '@angular/fire/auth';
import { Database, ref, onValue } from '@angular/fire/database';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { SplashScreenService } from '../../services/splash-screen.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private auth = inject(Auth);
  private db = inject(Database);
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  protected splashService = inject(SplashScreenService);

  userName = 'Loading...';
  userEmail = '';
  studentID: string | null = '';
  isSidebarOpen = false;
  isProfileMenuOpen = false;
  isLearningHubOpen = true;
  isAccountOpen = true;
  showWelcomeModal = false;
  currentUserId = '';
  readonly theme = this.themeService.theme;

  toggleLearningHub() {
    this.isLearningHubOpen = !this.isLearningHubOpen;
  }

  toggleAccount() {
    this.isAccountOpen = !this.isAccountOpen;
  }

  ngOnInit(): void {
    this.applyTheme(this.themeService.theme());

    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.closeSidebarOnMobile());

    authState(this.auth).subscribe((user) => {
      if (user) {
        this.currentUserId = user.uid;
        this.fetchHeaderData(user.uid);

        const hasSeenSplash = this.splashService.hasSeenSplash();
        if (!hasSeenSplash) {
          this.splashService.triggerSplash('/dashboard');
        }

        const hasSeenWelcome = localStorage.getItem(`welcome_seen_${user.uid}`);
        if (!hasSeenWelcome) {
          this.showWelcomeModal = true;
        }
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  fetchHeaderData(uid: string) {
    const userRef = ref(this.db, 'users/' + uid);
    onValue(
      userRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this.userName = data.fullName || 'Student';
          this.userEmail = data.email || '';
          this.studentID = data.studentID || '';
        } else {
          this.userName = 'Student';
          this.studentID = '';
        }
        this.cdr.detectChanges();
      },
      { onlyOnce: false }
    );
  }

  applyTheme(theme: 'dark' | 'light') {

    this.themeService.setTheme(theme);
  }

  toggleTheme() {
    this.applyTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  getStoredTheme(): 'dark' | 'light' {
    return this.themeService.theme();
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebarOnMobile() {
    if (window.innerWidth <= 900) {
      this.isSidebarOpen = false;
    }
  }

  @HostListener('window:resize')
  onViewportResize() {
    if (window.innerWidth > 900) this.isSidebarOpen = false;
  }

  toggleProfileMenu() {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  closeWelcomeModal() {
    this.showWelcomeModal = false;
    localStorage.setItem(`welcome_seen_${this.currentUserId}`, 'true');
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
