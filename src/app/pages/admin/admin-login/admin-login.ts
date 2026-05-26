import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.html',
  styleUrls: ['./admin-login.scss']
})
export class AdminLoginComponent {
  private auth = inject(Auth);
  private router = inject(Router);

  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  // Yahan apne authorized admin emails dalein
  allowedAdmins = ['admin@filecrafters.in', 'wmohd2514@outlook.com']; 

  async onAdminLogin() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      // 1. Firebase se Email & Password verify karein
      const userCredential = await signInWithEmailAndPassword(this.auth, this.email, this.password);
      const userEmail = userCredential.user.email;

      // 2. Check karein ki kya ye email Admin list me hai
      if (userEmail && this.allowedAdmins.includes(userEmail)) {
        // Success! Admin Dashboard par bhejein
        this.router.navigate(['/admin/dashboard']);
      } else {
        // Agar normal user yahan se login kare, to use bahar nikal do
        await signOut(this.auth);
        this.errorMessage = 'Access Denied: You are not an Administrator.';
      }
    } catch (error: any) {
      // Password galat hone par
      this.errorMessage = 'Invalid Admin Credentials. Please try again.';
      console.error('Admin Login Error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}