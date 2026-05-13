import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, RouterOutlet, RouterLinkActive } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Database, ref, onValue } from '@angular/fire/database';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  // Dhyan dein: RouterOutlet import karna zaroori hai nested routes ke liye
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

  userName: string = 'Loading...';
  userEmail: string = '';
  isSidebarOpen: boolean = false;
  isProfileMenuOpen: boolean = false; 

  ngOnInit(): void {
    authState(this.auth).subscribe(user => {
      if (user) {
        this.fetchHeaderData(user.uid);
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  fetchHeaderData(uid: string) {
    const userRef = ref(this.db, 'users/' + uid);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        this.userName = data.fullName || 'Student';
        this.userEmail = data.email || '';
      } else {
        this.userName = 'Student';
      }
      this.cdr.detectChanges();
    });
  }

  toggleSidebar() { this.isSidebarOpen = !this.isSidebarOpen; }
  toggleProfileMenu() { this.isProfileMenuOpen = !this.isProfileMenuOpen; }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}