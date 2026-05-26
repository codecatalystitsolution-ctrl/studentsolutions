import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { Auth,sendPasswordResetEmail } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';

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
      await this.authService.login(email, password);
      console.log('Login Successful!');
      
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
      alert('Login Failed: ' + error.message);
    }
  } else {
    alert('Please fill in all required fields with valid information.');
  }
}

  // === NAYA: FORGOT PASSWORD LOGIC ===
  toggleForgotPassword() {
    this.isForgotPasswordMode = !this.isForgotPasswordMode;
    this.resetEmail = ''; // Mode switch karne par input clear kar do
  }

  async sendResetLink() {
    if (!this.resetEmail) {
      alert("Please enter your registered email address.");
      return;
    }

    this.isResetting = true;

    try {
      // Firebase ka inbuilt function email bhejne ke liye
      await sendPasswordResetEmail(this.auth, this.resetEmail);
      
      alert("Password reset link sent! 📧 Please check your email inbox (and spam folder).");
      this.isForgotPasswordMode = false; // Wapas login screen dikha do
      this.resetEmail = '';
      
    } catch (error: any) {
      console.error("Forgot password error:", error);
      // Firebase alag-alag error deta hai, unko handle karein
      if (error.code === 'auth/user-not-found') {
        alert("No account found with this email.");
      } else if (error.code === 'auth/invalid-email') {
        alert("Please enter a valid email address.");
      } else {
        alert("Failed to send reset email. Please try again later.");
      }
    } finally {
      this.isResetting = false;
    }
  }
}