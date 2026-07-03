import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../shared/notification/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  
  // Dependencies inject karein
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private auth = inject(Auth);
  private notificationService = inject(NotificationService);

  // Naye variables Forgot Password ke liye
  isForgotPasswordMode: boolean = false; 
  resetEmail: string = '';
  isResetting: boolean = false;

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onSubmit() {
if (this.loginForm.valid) {
    const { email, password } = this.loginForm.value;
    try {
      const user = await this.authService.login(email, password);
      console.log('Login Successful!');

      const userProfile = await this.authService.getUserProfile(user.uid);
      if (userProfile?.status === 'suspended') {
        await this.authService.logout();
        this.notificationService.show('error', 'Your account has been suspended. Please contact support to reopen your account.', 'Account Suspended');
        return;
      }

      // Admin emails ki list (Yahan apne actual admin emails zarur rakhein)
      const adminEmails = ['admin@filecrafters.in', 'wmohd2514@outlook.com'];

      // Smart Routing Logic: Admin ko Admin page, Student ko Student page
      if (adminEmails.includes(email)) {
        console.log('Admin detected. Redirecting to Operations Center...');
        this.router.navigate(['/admin/dashboard']);
      } else {
        console.log('Student detected. Redirecting to Student Dashboard...');
        this.router.navigate(['/dashboard/home']); 
      }
      
    } catch (error: any) {
      console.error('Login Failed:', error.message);
      this.notificationService.show('error', error.message || 'Login Failed. Please try again.', 'Login Error');
    }
  } else {
    this.notificationService.show('warning', 'Please fill in all required fields with valid information.', 'Invalid Input');
  }
}

  // === NAYA: FORGOT PASSWORD LOGIC ===
  toggleForgotPassword() {
    this.isForgotPasswordMode = !this.isForgotPasswordMode;
    this.resetEmail = ''; // Mode switch karne par input clear kar do
  }

  async sendResetLink() {
    if (!this.resetEmail) {
      this.notificationService.show('warning', 'Please enter your registered email address.', 'Missing Email');
      return;
    }

    this.isResetting = true;

    try {
      // Firebase ka inbuilt function email bhejne ke liye
      await sendPasswordResetEmail(this.auth, this.resetEmail);
      
      this.notificationService.show('success', 'Password reset link sent! Please check your email inbox (and spam folder).', 'Email Sent');
      this.isForgotPasswordMode = false; // Wapas login screen dikha do
      this.resetEmail = '';
      
    } catch (error: any) {
      console.error("Forgot password error:", error);
      // Firebase alag-alag error deta hai, unko handle karein
      if (error.code === 'auth/user-not-found') {
        this.notificationService.show('error', 'No account found with this email.', 'Email Not Registered');
      } else if (error.code === 'auth/invalid-email') {
        this.notificationService.show('warning', 'Please enter a valid email address.', 'Invalid Email');
      } else {
        this.notificationService.show('error', 'Failed to send reset email. Please try again later.', 'Send Error');
      }
    } finally {
      this.isResetting = false;
    }
  }
}