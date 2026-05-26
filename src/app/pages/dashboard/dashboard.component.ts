import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, RouterOutlet, RouterLinkActive } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Database, ref, onValue } from '@angular/fire/database';
import { AuthService } from '../../services/auth.service';

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

  userName: string = 'Loading...';
  userEmail: string = '';
  isSidebarOpen: boolean = false;
  isProfileMenuOpen: boolean = false;
  isLearningHubOpen: boolean = true; 
  isAccountOpen: boolean = true;
  studentID: any;

  // === POPUP VARIABLES ===
  showWelcomeModal: boolean = false;
  currentUserId: string = '';

  toggleLearningHub() { this.isLearningHubOpen = !this.isLearningHubOpen; }
  toggleAccount() { this.isAccountOpen = !this.isAccountOpen; }

  ngOnInit(): void {
    authState(this.auth).subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.fetchHeaderData(user.uid);

        // === POPUP LOGIC ===
        // Check karein agar is user ne pehle popup dismiss kiya hai ya nahi
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
    onValue(userRef, (snapshot) => {
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
    });
  }

  toggleSidebar() { this.isSidebarOpen = !this.isSidebarOpen; }

  closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
      this.isSidebarOpen = false;
    }
  }

  toggleProfileMenu() { this.isProfileMenuOpen = !this.isProfileMenuOpen; }

  // === POPUP CLOSE FUNCTION ===
  closeWelcomeModal() {
    this.showWelcomeModal = false;
    localStorage.setItem(`welcome_seen_${this.currentUserId}`, 'true');
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}