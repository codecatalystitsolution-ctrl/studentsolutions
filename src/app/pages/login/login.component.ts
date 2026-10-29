import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../shared/notification/notification.service';
import { ThemeService } from '../../services/theme.service';

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
  private route = inject(ActivatedRoute);
  private auth = inject(Auth);
  private notificationService = inject(NotificationService);
  private themeService = inject(ThemeService);

  // Naye variables Forgot Password ke liye
  isForgotPasswordMode: boolean = false; 
  resetEmail: string = '';
  isResetting: boolean = false;
  showPendingModal: boolean = false;
  pendingApplicant: any = null;
  showRejectedModal: boolean = false;
  rejectedApplicant: any = null;
  theme = this.themeService.theme();

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.theme = this.themeService.theme();
  }

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

      if (userProfile?.status === 'pending_approval') {
        await this.authService.logout();
        this.pendingApplicant = {
          fullName: userProfile.fullName || 'Applicant',
          email: userProfile.email || email,
          role: userProfile.role || 'Partner',
          id: userProfile.employeeID || userProfile.deliveryID || userProfile.studentID || 'FC-PENDING',
          appliedAt: userProfile.appliedAt || userProfile.createdAt
        };
        this.showPendingModal = true;
        this.notificationService.show(
          'info',
          'Your account application is currently under verification by Student Solutions Admin. You will receive an email once approved.',
          'Application Under Review'
        );
        return;
      }

      if (userProfile?.status === 'rejected') {
        await this.authService.logout();
        this.rejectedApplicant = {
          fullName: userProfile.fullName || 'Applicant',
          email: userProfile.email || email,
          role: userProfile.role || 'Partner',
          id: userProfile.employeeID || userProfile.deliveryID || userProfile.studentID || 'FC-REJECTED',
          reason: userProfile.rejectionReason || 'Submitted verification credentials could not be approved.',
          rejectedAt: userProfile.rejectedAt
        };
        this.showRejectedModal = true;
        this.notificationService.show(
          'error',
          `Your application was rejected by Admin. Reason: ${this.rejectedApplicant.reason}`,
          'Application Rejected'
        );
        return;
      }

      // Admin emails ki list (Yahan apne actual admin emails zarur rakhein)
      const adminEmails = ['admin@studentsolutions.online', 'admin@studentsolutions.in', 'admin@filecrafters.in', 'wmohd2514@outlook.com'];

      const returnUrl = this.route.snapshot.queryParams['returnUrl'];

      // Smart Routing Logic: Admin ko Admin page, Student ko Student page
      if (adminEmails.includes((user.email || email).toLowerCase())) {
        console.log('Admin detected. Redirecting to Operations Center...');
        this.router.navigate(['/admin/dashboard']);
      } else if (userProfile?.role === 'Teacher' && userProfile?.status === 'active') {
        this.router.navigate(['/teacher/referrals']);
      } else if (userProfile?.role === 'Delivery' && userProfile?.status === 'active') {
        this.router.navigate(['/delivery-portal']);
      } else if (userProfile?.role === 'Student' && userProfile?.status === 'active') {
        if (returnUrl && returnUrl.startsWith('/new-order')) {
          this.router.navigateByUrl(returnUrl);
        } else {
          this.router.navigate(['/dashboard/home']);
        }
      } else {
        await this.authService.logout();
        this.notificationService.show('error', 'This account does not have an active student, teacher, delivery, or administrator role.', 'Account Not Active');
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

  goSupport() {
    this.router.navigate(['/login-support']);
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

  closeStatusModals(): void {
    this.showPendingModal = false;
    this.showRejectedModal = false;
  }

  contactSupport(): void {
    const role = this.rejectedApplicant?.role || this.pendingApplicant?.role || 'Partner';
    const email = this.rejectedApplicant?.email || this.pendingApplicant?.email || '';
    const subject = encodeURIComponent(`Student Solutions Application Inquiry - ${role} (${email})`);
    const mailto = `mailto:support@studentsolutions.online?subject=${subject}`;
    if (typeof window !== 'undefined') {
      window.open(mailto, '_blank');
    }
  }
}
